const socket = io();
const room = location.hash.substring(1);
socket.emit("join", room);

const peers = {};
let localStream;

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
.then(stream => {
  localStream = stream;
  addVideo(stream);

  socket.on("user-joined", id => {
    const pc = createPeer(id);
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  });

  socket.on("signal", async data => {
    let pc = peers[data.from];
    if (!pc) pc = createPeer(data.from, false);

    if (data.signal.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { to: data.from, signal: answer });
    } else if (data.signal.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
    } else if (data.signal.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.signal));
    }
  });
});

function createPeer(id, isInitiator = true) {
  const pc = new RTCPeerConnection();
  peers[id] = pc;

  pc.ontrack = e => addVideo(e.streams[0]);

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: id, signal: e.candidate });
    }
  };

  if (isInitiator && localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit("signal", { to: id, signal: offer });
    });
  }

  return pc;
}

function addVideo(stream) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  document.getElementById("videos").appendChild(video);
}

/* SCREEN SHARE */
function shareScreen() {
  navigator.mediaDevices.getDisplayMedia({ video: true })
  .then(screen => {
    const track = screen.getVideoTracks()[0];
    Object.values(peers).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === "video");
      sender.replaceTrack(track);
    });

    track.onended = () => {
      const cam = localStream.getVideoTracks()[0];
      Object.values(peers).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(cam);
      });
    };
  });
}

/* WHITEBOARD */
function toggleBoard() {
  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  board.width = 800;
  board.height = 400;

  let drawing = false;

  board.onmousedown = () => drawing = true;
  board.onmouseup = () => drawing = false;
  board.onmousemove = e => {
    if (!drawing) return;
    ctx.fillStyle = "black";
    ctx.fillRect(e.offsetX, e.offsetY, 4, 4);
    socket.emit("draw", { x: e.offsetX, y: e.offsetY });
  };

  board.style.display = board.style.display === "block" ? "none" : "block";
}

// Receive drawing from others
const board = document.getElementById("board");
const ctx = board.getContext("2d");
socket.on("draw", data => {
  ctx.fillRect(data.x, data.y, 4, 4);
});
