// ライブラリやモジュール、フレームワークをインポート
const express =require('express');
const mysql =require('mysql2');
const bcrypt=require('bcrypt');
const http=require('http');
const session =require("express-session");
const socketIo=require('socket.io');
const multer=require('multer');

// アプリ（インスタンス）を作成
const app =express();
// アプリをhtmlサーバーに
const server=http.createServer(app);
// htmlサーバーにsocketを紐づける
const io=socketIo(server);
// データベースとの接続をするオブジェクトを作成
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'ddrk',
    database: 'myschema'
  });
// ファイルをどこにどんな名前で保存するか決める
const storage=multer.diskStorage({
    destination:function (req,file,cb){
        cb(null,'upload');
    },
    filename:function (req,file,cb){
       cb(null,Date.now()+'-'+file.originalname);
    }
});
// ファイルのミドルウェアを作る（ルール）
const upload=multer({storage:storage});


// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝ミドルウェア＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

// セッションするための設定
app.use(session({
    secret: "mysecretkey",  
    resave: false,
    saveUninitialized: false
}));

// 静的ファイル読みこみ
app.use(express.static('public'));
// URLエンコードの解析（フラットのみ）
app.use(express.urlencoded({extended: false}));
// /uploadというエンドポイントにだけこのミドルウェアを仕込む
app.use('/upload',express.static('upload'));
// ビューエンジンのテンプレートエンジンをejsに設定
app.set('view engine', 'ejs');

// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝ページ移動＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

app.get('/', (req, res) => {
    res.render('homepage', { title: "USEFUL COLLEGE TOOL" });
});
app.get('/page2.reg',(req,res)=>{
    res.render('register');
})
app.get('/page3.login',(req,res)=>{
    res.render('login');
});



// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝新規登録・ログイン＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
app.post("/register",async (req,res)=>{
    const {name,password}=req.body;
    connection.query('SELECT*FROM login',
        async (error,results)=>{
            const usedPassword=await Promise.all(results.map(user=>bcrypt.compare(password,user.password)));
            if(usedPassword.includes(true)){
                console.log('このパスワードはすでに使用されています');
                res.redirect('/page2.reg');
            
            }else{  
                const hashPassword =await bcrypt.hash(password,10);
                connection.query('INSERT INTO login (name,password) VALUES (?,?)',[name,hashPassword],
                   ()=>{
                       console.log('登録完了');
                     res.redirect('/page2.reg');
                    }
                );  
            }

        }
    );  
});

app.post("/login",async(req,res)=>{
    const{name,password}=req.body;
    connection.query('SELECT* FROM login WHERE name =? ',[name],
        async (error,results)=>{
            if(results.length>0){
                try{
                   const matches= await Promise.all(results.map(user => bcrypt.compare(password,user.password)));
                   const matchUser=results.find((user,index)=>matches[index]);
                   if(matchUser){
                    req.session.user=matchUser;
                    return res.redirect('/dashboard');
                   }else{
                    res.send('パスワードが違います')
                   }
                }catch(err){
                console.log('ログイン失敗');
                return res.send('エラー発生');
                }
            }else{
                console.log('この名前のユーザーはいません');
            }
        }
    );
});


app.post('/memos',(req,res)=>{
    if(!req.session.user){
        res.redirect('/page3.login');
    }
    const userID=req.session.user.id;
    console.log(userID);
    const {content}=req.body;
    connection.query('INSERT INTO memos(user_id,memo) VALUES(?,?)',[userID,content],
        (error,results)=>{
            if (error) {
                console.error("メモ追加エラー:", error);  
                return res.send("データベースエラーが発生しました");
            }
            res.redirect('/dashboard'); 
        });
});

app.get('/dashboard',(req,res)=>{
    if(!req.session.user){
        res.redirect('/page3.login');
    }
    connection.query('SELECT* FROM memos WHERE user_id=?',[req.session.user.id],
        (error,results)=>{
            if (error) {
               console.error("メモ取得エラー:", error);  
               return res.send("データベースエラーが発生しました");
            }
            res.render('user',{use:req.session.user,memos:results});
        });
});

app.get('/logout',(req,res)=>{
    req.session.destroy(()=>{
        res.redirect("/page3.login");
    });
})


// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝チャット機能＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
app.get('/chatroom',(req,res)=>{
    console.log(req.session);
    if(!req.session.user){
        console.log('入室許可がでてません');
        res.redirect('/dashboard');
    }else{
        res.render('chatroom',{name:req.session.user.name});
    }
});

app.get('/select',(req,res)=>{
    if(!req.session.user){
    }else{
        connection.query('SELECT*FROM login ',
            (error,results)=>{
            const username=req.session.user.name;
            res.render('userSelect',{results,username});
            }
        );
    }
});

app.get('/chat/:user/:receiver',(req,res)=>{
   const {user,receiver}=req.params;
   connection.query('SELECT* FROM messages WHERE(sender=? AND receiver=?)OR(sender=? AND receiver=?) ORDER BY created_at ASC',
    [user,receiver,receiver,user],(error,results)=>{
     res.render('privateChat', { user, receiver, messages: results});
    });
});

const users={};
io.on('connection',(socket)=>{
    console.log('ユーザーが参加しました');
  
    socket.on('chatMessage',(msg,username)=>{
           io.emit('chatMessage',{message:msg,name:username});
    });

    socket.on('register',sender=>{
      users[sender]=socket.id;
    });

    socket.on('privateMessage',({sender,receiver,message})=>{
        connection.query('INSERT INTO messages (sender,receiver,message)VALUE(?,?,?)',[sender,receiver,message],
             (error,results)=>{
                   if(users[receiver]){
                      io.to(users[receiver]).emit('privateMessage', { sender, message });
                   }
             }
        );
    });

    socket.on('chatFile',({fileUrl,receiver,sender})=>{
        connection.query('INSERT INTO messages (sender,receiver,image_url)VALUE(?,?,?)',[sender,receiver,fileUrl],
             (error,results)=>{
                   if(users[receiver]){
                      io.to(users[receiver]).emit('chatFile', { sender, fileUrl});
                   }
             }
        );
    });

    socket.on('disconnect', () => {
        const disconnectedUser = Object.keys(users).find(user => users[user] === socket.id);
        if (disconnectedUser) {
            delete users[disconnectedUser]; // ユーザー情報を削除
            console.log(`${disconnectedUser} が切断しました`);
        }
    });

    
});

// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝ファイル送信＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
app.post('/upload',upload.single('file'),(req,res)=>{
    const fileUrl = `/upload/${req.file.filename}`;
    res.json({fileUrl});
});


// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝サーバー起動＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

server.listen(3000, () => {
    console.log('http://localhost:3000 でサーバーが起動しました');
});