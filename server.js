const express = require("express");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

// Game state object
const gamestate = {};
const bullets = []; // Store bullets

io.on("connection", function (socket) {
  console.log(`A user connected: ${socket.id}`);

  // Initialize new player
  gamestate[socket.id] = {
    x: 500, // Starting x position
    y: 600, // Starting y position
    score: 0,
    name: `Player ${socket.id.substring(0, 4)}`, // Default name
  };

  // Send updated state to everyone
  io.emit("state: ", gamestate);

  // Handle player movement
  socket.on("move", (data) => {
    if (gamestate[socket.id]) {
      gamestate[socket.id].x += data.dx || 0;
      gamestate[socket.id].y += data.dy || 0;
      io.emit("state: ", gamestate); // Broadcast updated state
    }
  });

  // Handle shoot
  socket.on("shoot", (bulletData) => {
    bullets.push({ x: bulletData.x, y: bulletData.y, owner: socket.id });

    // Broadcast updated bullets
    io.emit("bullets: ", bullets);
  });

  // Handle scoring
  socket.on("point", () => {
    if (gamestate[socket.id]) {
      gamestate[socket.id].score += 1;
      io.emit("state: ", gamestate);
    }
  });

  // Handle name changes
  socket.on("name", (name) => {
    if (gamestate[socket.id]) {
      gamestate[socket.id].name = name;
      io.emit("state: ", gamestate);
    }
  });

  // Handle disconnection

  socket.on("disconnect", () => {
    console.log(`A user disconnected: ${socket.id}`);
    delete gamestate[socket.id];
    io.emit("state: ", gamestate);

    // Remove bullets owned by the disconnected player
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].owner === socket.id) {
        bullets.splice(i, 1);
      }
    }

    io.emit("bullets: ", bullets); // Update clients
  });

  setInterval(() => {
    // Update bullet positions
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 12; // Move bullets up

      if (bullets[i].y < 0) {
        bullets.splice(i, 1); // Remove off-screen bullets
      }
    }

    io.emit("bullets: ", bullets); // Broadcast updated bullets
  }, 50);
});

// Serve static files
app.use(express.static("."));

server.listen(port, function () {
  console.log("Game app listening on port " + port);
});
