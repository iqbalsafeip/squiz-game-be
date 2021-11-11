const express = require('express')
const app = express()
const socket = require('socket.io')
const cors = require('cors')
const server = require('http').Server(app)

const { 
    getCurrentQuestion,
    getAnswer,
    getQuestionsByCategory 
} = require('./pertanyaan/index');

app.use(cors())

io = socket(server);

server.listen(8080, ()=> {
    console.log('listen on 8080');
})

var ROOM = [
    {
        name: 'General',
        code : "general",
        players: [],
        max: 10,
        category: 'umum',
        logs: []
    },
    {
        name: 'Funny',
        code : "movie",
        players: [],
        max: 10,
        category: 'film',
        logs: []
    },
    {
        name: 'History',
        code : "history",
        players: [],
        max: 10,
        category: 'sejarah',
        logs: []

    }
]

io.on('connection', (socket)=> {
    
    socket.on('setUsername', value => {
        socket['user'] = User(value);
        socket['username'] = value
        socket.emit('username', value);
        
    })

    socket.on('getAllRoom',(keyword)=>{
        let temp = []
        if(keyword){
            temp = ROOM.filter(e => e.name.includes(keyword));
        } else {
            temp = ROOM
        }
        socket.emit('sendRoom', temp);
    })
    socket.on('peringkat', ()=> {
        ROOM.map(e => {
            if(e.code === socket.code){
                return socket.emit('peringkat', e.players);
            } 
        })
    })
    socket.on('mulai-game', ()=> {
        ROOM.map(e => {
            if(e.code === socket.code){
                const currQuestion = getCurrentQuestion(e?.question);
                io.to(e.code).emit('init-pertanyaan', currQuestion);
            }
        })
    })
    socket.on('msg', ({text})=> {
        io.to(socket.code).emit('msg',{
            type : 'msg',
            text : socket.username + " : " + text
        })
    })
    socket.on('masukRoom', code => {
        if(code){
            ROOM = ROOM.map(e => {
                if(e.code === code){
                    socket.join(code);
                    let temp = {};
                    let logs = {
                        type: 'notif',
                        text: ": " +socket.username + ' Memasuki Room'
                    }
                    temp = {...e, players: [...e.players, {name :socket.username, score: 0, socket: JSON.stringify(socket.id), isRM: e.players.length === 0 }]}

                    io.to(code).emit('msg', logs);
                    
                    if(e.players.length === 0){
                        temp.question= getQuestionsByCategory(e.category);
                        temp.isPlayed = false
                        temp.roomMaster= socket.username
                        temp.ronde = 0;
                        socket.emit('rm')
                        socket.emit('msg', {
                            type : 'notif',
                            text : ": Anda Menjadi Room Master"
                        });
                    }

                    io.to(code).emit('initRoom', temp)
                    socket.code = e.code;
                    socket.emit('success-join', e.code)
                    return temp
                } else {
                    return e
                }
            })
        }
    })
    socket.on('disconnect', ()=>{
        if(socket.code){
            ROOM = ROOM.map(e => {
                if(e.code === socket.code){
                    if(e.players.length === 1){
                        return {...e,players: e.players.filter(e => e.name !== socket.username)}
                    }
                    let logs = {
                        type: 'notif',
                        text: ": " +socket.username + ' Keluar dari Room'
                    }
                    io.to(socket.code).emit('msg', logs);
                    return {...e,players: e.players.filter(e => e.name !== socket.username)}
                } else {
                    return e
                }
            })
        }
    })
})