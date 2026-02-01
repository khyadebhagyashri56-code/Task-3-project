const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const rooms = {};

io.on("connection", socket => {
  socket.on("join", room => {
    socket.join(room);
    socket.to(room).emit("user-joined", socket.id);

    // Relay WebRTC signals
    socket.on("signal", data => {
      io.to(data.to).emit("signal", { from: socket.id, signal: data.signal });
    });

    // Whiteboard drawing
    socket.on("draw", data => {
      socket.to(room).emit("draw", data);
    });
  });
});

http.listen(3000, () => {
  console.log("Server running → http://localhost:3000");
});
