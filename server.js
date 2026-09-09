// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(__dirname));

const roomsData = {};

io.on('connection', (socket) => {
  console.log(`Bir oyuncu bağlandı: ${socket.id}`);

  socket.on('join-room', (data) => {
    socket.join(data.roomCode);
    socket.username = data.username;
    
    if (!roomsData[data.roomCode]) {
      roomsData[data.roomCode] = [];
    }

    const existingPlayer = roomsData[data.roomCode].find(p => p.id === socket.id);
    if (!existingPlayer) {
      roomsData[data.roomCode].push({
        id: socket.id,
        username: data.username,
        slot: roomsData[data.roomCode].length + 1,
        isTurn: roomsData[data.roomCode].length === 0
      });
    } else {
      existingPlayer.username = data.username;
    }

    const playerList = roomsData[data.roomCode];
    const currentPlayer = playerList.find(p => p.id === socket.id);

    console.log(`Oyuncu ${data.username} (${socket.id}), ${data.roomCode} odasına katıldı. Slot: ${currentPlayer.slot}`);
    
    socket.emit('init-room-state', {
      slot: currentPlayer.slot,
      isMyTurn: currentPlayer.isTurn,
      players: playerList
    });

    io.to(data.roomCode).emit('update-players', playerList);
  });

  socket.on('board-update', (data) => {
    socket.to(data.roomCode).emit('sync-board', {
      senderId: socket.id,
      ...data
    });
  });

  socket.on('end-turn', (data) => {
    socket.to(data.roomCode).emit('sync-turn', {
      nextPlayerId: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log(`Oyuncu ayrıldı: ${socket.id}`);
    for (const roomCode in roomsData) {
      roomsData[roomCode] = roomsData[roomCode].filter(p => p.id !== socket.id);
      io.to(roomCode).emit('update-players', roomsData[roomCode]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

// İstediğinde sunucuyu uzaktan kapatmak için gizli endpoint
app.get('/shutdown-arena', (req, res) => {
  res.send("Masa kapatılıyor, sunucu durduruldu.");
  console.log("Kullanıcı isteğiyle sunucu kapatıldı.");
  process.exit(0); // Bu komut Node.js sürecini sonlandırır
});