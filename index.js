const express = require("express");
const app = express();
const socket = require("socket.io");
const cors = require("cors");
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");

function makeid(length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const {
  getCurrentQuestion,
  getAnswer,
  getQuestionsByCategory,
} = require("./pertanyaan/index");

app.use(cors());

io = socket(server);

server.listen(8080, () => {
  console.log("server berjalan dalam port 8080");
});

var ROOM = [
  {
    name: "General",
    code: "general",
    players: [],
    max: 10,
    category: "sport",
    logs: [],
    room_icon: 3,
  },
  {
    name: "Have Fun",
    code: "fun",
    players: [],
    max: 10,
    category: "food",
    logs: [],
    room_icon: 1,
  },
];

io.on("connection", (socket) => {
  console.log("seseorang terkoneksi");
  socket.on("setUsername", (value) => {
    socket["username"] = value.username;
    socket.avatar = value.avatar;
    socket.emit("initSelfData", value);
  });

  socket.on("getAllRoom", (keyword) => {
    let temp = [];
    if (keyword) {
      temp = ROOM.filter((e) => e.name.includes(keyword));
    } else {
      temp = ROOM;
    }
    socket.emit("sendRoom", temp);
  });
  socket.on("peringkat", () => {
    ROOM.map((e) => {
      if (e.code === socket.code) {
        let temp = e.players;
        temp = temp.sort(function (a, b) {
          return parseInt(b.score) - parseInt(a.score);
        });
        return socket.emit("peringkat", temp);
      }
    });
  });

  socket.on("buatRoom", (data) => {
    console.log(data);
    let code = makeid(4);
    let temp = {
      name: data.nama,
      code,
      players: [
        {
          name: socket.username,
          score: 0,
          socket: JSON.stringify(socket.id),
          isRM: true,
          avatar: socket.avatar,
        },
      ],
      room_icon: data.room_icon,
      max: data.jml,
      category: data.kategori,
      isPlayed: false,
    };
    temp.question = getQuestionsByCategory(data.kategori);
    ROOM.push(temp);
    socket.join(code);
    let logs = {
      type: "notif",
      text: ": Anda Berhasil Membuat Room",
    };
    socket.emit("msg", logs);
    socket.emit("msg", {
      type: "notif",
      text: ": Anda Menjadi Room Master",
    });
    socket.emit("rm");
    io.to(code).emit("initRoom", temp);
    socket.code = code;
    socket.emit("success-join", code);
  });

  function theGame() {
    ROOM = ROOM.map((e) => {
      if (e.code === socket.code) {
        let isPlayed = true;
        let round = 0;
        let question = e?.question;
        if (parseInt(e.round) > -1) {
          round = e.round + 1;
          question = question.map((ques) =>
            ques.id === e.currQuestion.id ? { ...ques, isPassed: true } : ques
          );
        }

        let BASE_DURATION = 20;
        let duration = BASE_DURATION - round * 1.5;
        const currQuestion = getCurrentQuestion(question);
        io.to(e.code).emit("game-dimulai", {
          question: currQuestion,
          duration: duration,
          round: round,
        });
        io.to(e.code).emit("msg", {
          type: "notif",
          text: ": Ronde " + (round + 1) + " Dimulai! Persiapkan diri.",
        });

        let counter = 0;
        let interval = null;
        setTimeout(() => {
          interval = setInterval(() => {
            counter += 0.1;
            io.to(e.code).emit("countdown", counter);
            if (counter >= duration) {
              clearInterval(interval);
              io.to(e.code).emit("msg", {
                type: "notif",
                text: ": Ronde " + (round + 1) + " Berakhir!.",
              });

              console.log("rondee", round);

              if (round <= 3) {
                io.to(e.code).emit("round-end");
                io.to(e.socketMaster).emit("next-round");
              } else {
                io.to(e.code).emit("game-end");
                io.to(e.code).emit("msg", {
                  type: "notif",
                  text: ": Permainan Berakhir!.",
                });
                isPlayed = false;
              }
            }
          }, 100);

          io.to(e.code).emit("round-start", counter);
        }, 8000);

        return {
          ...e,
          isPlayed: isPlayed,
          currQuestion,
          round: round,
          question,
        };
      }

      return e;
    });
  }

  socket.on("mulai-game", () => {
    theGame();
  });
  socket.on("msg", ({ text }) => {
    io.to(socket.code).emit("msg", {
      type: "msg",
      text: socket.username + " : " + text,
    });
  });
  socket.on("masukRoom", (code) => {
    if (code) {
      ROOM = ROOM.map((e) => {
        if (e.code === code) {
          socket.join(code);
          let temp = {};
          let logs = {
            type: "notif",
            text: ": " + socket.username + " Memasuki Room",
          };
          temp = {
            ...e,
            players: [
              ...e.players,
              {
                name: socket.username,
                score: 0,
                socket: JSON.stringify(socket.id),
                isRM: e.players.length === 0,
                avatar: socket.avatar,
              },
            ],
          };

          io.to(code).emit("msg", logs);

          if (e.players.length === 0) {
            temp.question = getQuestionsByCategory(e.category);
            temp.isPlayed = false;
            temp.roomMaster = socket.username;
            temp.socketMaster = JSON.stringify(socket.id);
            socket.emit("rm");
            socket.emit("msg", {
              type: "notif",
              text: ": Anda Menjadi Room Master",
            });
          }

          io.to(code).emit("initRoom", temp);
          socket.code = e.code;

          socket.emit("success-join", e.code);
          return temp;
        } else {
          return e;
        }
      });
    }
  });

  socket.on("betul", function (data) {
    console.log(data);
    console.log();

    ROOM = ROOM.map((e) => {
      if (e.code === socket.code) {
        let players = e.players.map((player) => {
          if (player.socket == JSON.stringify(socket.id)) {
            let plus = Math.round(
              (data.countDown - data.timeleft) * (e.round + 1) * 10
            );
            let score = player.score + plus;
            socket.emit("msg", {
              type: "notif",
              text: ": Score anda bertambah sebanyak +" + plus,
            });
            return { ...player, score: Math.round(score) };
          }
          return player;
        });

        return { ...e, players: players };
      } else {
        return e;
      }
    });
  });

  socket.on("keluar-room", () => {
    ROOM = ROOM.map((e) => {
      if (e.code === socket.code) {
        if (e.players.length === 1) {
          return {
            ...e,
            players: e.players.filter((e) => e.name !== socket.username),
            isPlayed: false,
          };
        }
        let logs = {
          type: "notif",
          text: ": " + socket.username + " Keluar dari Room",
        };
        io.to(socket.code).emit("msg", logs);
        return {
          ...e,
          players: e.players.filter((e) => e.name !== socket.username),
        };
      } else {
        return e;
      }
    });
  });

  socket.on("disconnect", () => {
    if (socket.code) {
      ROOM = ROOM.map((e) => {
        if (e.code === socket.code) {
          if (e.players.length === 1) {
            return {
              ...e,
              players: e.players.filter((e) => e.name !== socket.username),
              isPlayed: false,
            };
          }
          let logs = {
            type: "notif",
            text: ": " + socket.username + " Keluar dari Room",
          };
          io.to(socket.code).emit("msg", logs);
          return {
            ...e,
            players: e.players.filter((e) => e.name !== socket.username),
          };
        } else {
          return e;
        }
      });
    }
  });
});
