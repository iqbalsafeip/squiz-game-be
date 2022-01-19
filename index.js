const express = require('express')
const app = express()
const socket = require('socket.io')
const cors = require('cors')
const server = require('http').Server(app)
const { v4: uuidv4 } = require('uuid');


function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

const {
    getCurrentQuestion,
    getAnswer,
    getQuestionsByCategory
} = require('./pertanyaan/index');

app.use(cors())

io = socket(server);

server.listen(8080, () => {
    console.log('listen on 8080');
})

var ROOM = [
    {
        name: 'General',
        code: "general",
        players: [],
        max: 10,
        category: 'umum',
        logs: []
    },
    {
        name: 'Funny',
        code: "movie",
        players: [],
        max: 10,
        category: 'film',
        logs: []
    },
    {
        name: 'History',
        code: "history",
        players: [],
        max: 10,
        category: 'sejarah',
        logs: []

    }
]

io.on('connection', (socket) => {
    console.log('someone connected');
    socket.on('setUsername', value => {
        // socket['user'] = User(value);
        socket['username'] = value
        socket.emit('username', value);

    })

    socket.on('getAllRoom', (keyword) => {
        let temp = []
        if (keyword) {
            temp = ROOM.filter(e => e.name.includes(keyword));
        } else {
            temp = ROOM
        }
        socket.emit('sendRoom', temp);
    })
    socket.on('peringkat', () => {
        ROOM.map(e => {
            if (e.code === socket.code) {
                return socket.emit('peringkat', e.players);
            }
        })
    })

    socket.on('buatRoom', (data) => {
        console.log(data);
        let code = makeid(4)
        let temp = { name: data.nama, code, players: [{ name: socket.username, score: 0, socket: JSON.stringify(socket.id), isRM: true }], max: data.jml, category: data.kategori, isPlayed: false }
        temp.question = getQuestionsByCategory(data.kategori);
        ROOM.push(temp)
        socket.join(code)
        let logs = {
            type: 'notif',
            text: ": Anda Berhasil Membuat Room"
        }
        socket.emit('msg', logs)
        socket.emit('msg', {
            type: 'notif',
            text: ": Anda Menjadi Room Master"
        });
        socket.emit('rm')
        io.to(code).emit('initRoom', temp)
        socket.code = code;
        socket.emit('success-join', code)
    })

    function theGame() {
        ROOM = ROOM.map(e => {
            if (e.code === socket.code) {
                let round = 0;
                if (parseInt(e.round) > -1) {
                    round = e.round + 1;
                }
                console.log(e);
                let BASE_DURATION = 20
                let duration = BASE_DURATION - (round * 1.5)
                const currQuestion = getCurrentQuestion(e?.question);
                io.to(e.code).emit('game-dimulai', { question: currQuestion, duration: duration, round: round });
                io.to(e.code).emit('msg', {
                    type: 'notif',
                    text: ": Ronde " + (round + 1 )+ " Dimulai! Persiapkan diri."
                })

                setTimeout(() => {
                    io.to(e.code).emit('msg', {
                        type: 'notif',
                        text: ": Ronde " + (round + 1 )+ " Berakhir!."
                    })
        
                    io.to(e.code).emit('round-end')
                    io.to(e.socketMaster).emit('next-round')         
                }, (duration * 1000) + 8300)

                return { ...e, isPlayed: true, currQuestion, round: round }
            }

            return e
        })
    }

    socket.on('mulai-game', () => {
        theGame()
        
    })
    socket.on('msg', ({ text }) => {
        io.to(socket.code).emit('msg', {
            type: 'msg',
            text: socket.username + " : " + text
        })
    })
    socket.on('masukRoom', code => {
        if (code) {
            ROOM = ROOM.map(e => {
                if (e.code === code) {
                    socket.join(code);
                    let temp = {};
                    let logs = {
                        type: 'notif',
                        text: ": " + socket.username + ' Memasuki Room'
                    }
                    temp = { ...e, players: [...e.players, { name: socket.username, score: 0, socket: JSON.stringify(socket.id), isRM: e.players.length === 0 }] }

                    io.to(code).emit('msg', logs);

                    if (e.players.length === 0) {
                        temp.question = getQuestionsByCategory(e.category);
                        temp.isPlayed = false
                        temp.roomMaster = socket.username
                        temp.socketMaster = JSON.stringify(socket.id)
                        socket.emit('rm')
                        socket.emit('msg', {
                            type: 'notif',
                            text: ": Anda Menjadi Room Master"
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

    socket.on('betul', function (data) {
        console.log(data);
        console.log();

        ROOM = ROOM.map(e => {
            if (e.code === socket.code) {
                let players = e.players.map(player => {
                    if (player.socket == JSON.stringify(socket.id)) {
                        let plus = Math.round(((data.countDown - data.timeleft) * (e.round + 1)) * 10)
                        let score = player.score + plus;
                        socket.emit('msg', {
                            type: 'notif',
                            text: ": Score anda bertambah sebanyak +" + plus
                        });
                        return { ...player, score: Math.round(score) }
                    }
                    return player
                })

                return { ...e, players: players }
            } else {
                return e
            }
        })
    })

    socket.on('disconnect', () => {
        if (socket.code) {
            ROOM = ROOM.map(e => {
                if (e.code === socket.code) {
                    if (e.players.length === 1) {
                        return { ...e, players: e.players.filter(e => e.name !== socket.username) }
                    }
                    let logs = {
                        type: 'notif',
                        text: ": " + socket.username + ' Keluar dari Room'
                    }
                    io.to(socket.code).emit('msg', logs);
                    return { ...e, players: e.players.filter(e => e.name !== socket.username) }
                } else {
                    return e
                }
            })
        }
    })
})

