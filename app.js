var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose'),
    path = require('path'),
    users = {},
    port = process.env.PORT || 3000;

server.listen(port, function () {
    console.log('listening to *: %d...',port);
});

mongoose.connect('mongodb://localhost/chat', function (err) {
    if (err) {
        console.log(err)
    } else {
        console.log('successfully connected');
    }
});

var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    created: {type: Date, default: Date.now()}
});

var Chat = mongoose.model('Message', chatSchema);


app.get('/css', express.static(__dirname + '/css'));


app.get('/chat', function (req, res) {
    res.sendFile(path.join(__dirname, '/chat.html'));
});


io.on('connection', function (socket) {

    Chat.find({},function (err,docs) {
        if(err) throw err;
        console.log('old messages');
        socket.emit('old messages',docs);
    });

    //log new users
    console.log('new user has connected');

    //new messages
    socket.on('new message', function (data, callback) {
        var msg = data.trim();
        if (msg.substr(0, 3) === '/w ') {

            msg = msg.substr(3);
            var ind = msg.indexOf(' ');
            if (ind !== -1) {
                var name = msg.substr(0, ind);
                msg = msg.substr(ind + 1);
                if (name in users) {
                    users[name].emit('private message', {
                        nick: socket.nickname,
                        msg: msg
                    });
                } else {
                    callback('Error : not a valid user');
                }
            } else {
                callback('Error : please Enter a message');
            }


        } else {
            //save new document to mongoDB
            var newMsg = new Chat({
                nick: socket.nickname,
                msg: data
            });

            newMsg.save(function (err) {

                if(err) throw err;

                io.emit('general message', {
                    nick: socket.nickname,
                    msg: data
                });
            });
        }
    });

    //nickname handler
    socket.on('new user', function (data, callback) {
        if (data in users) {
            callback(false);
        } else {
            socket.nickname = data;
            users[socket.nickname] = socket;
            updateUserNames();
            callback(true);
        }
    });

    function updateUserNames() {
        io.emit('username', Object.keys(users));
    }

    socket.on('disconnect', function () {

        io.emit('userdisconnect', socket.nickname);

        if (!socket.nickname) return;

        delete users[socket.nickname];
        updateUserNames();
    });
});
