const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Rooms in memory
const rooms = new Map();

// Helper to create default room state
function createDefaultRoom(roomId) {
  return {
    roomId,
    createdAt: Date.now(),
    creatorSocketId: null,
    participants: [],
    readyForWebRtc: [], // Socket IDs ready for WebRTC
    celebrationStarted: false, // Prevents duplicate celebration triggers
    stage: 'ready-to-celebrate', // 'ready-to-celebrate' | 'blowing' | 'cutting' | 'celebration' | 'letter'
    cakeConfig: {
      name: 'My Love',
      message: 'Happy Birthday to my favorite person in the world!',
      theme: 'romantic-rose', // 'romantic-rose' | 'midnight-gold' | 'chocolate-velvet' | 'lavender-dream'
      cakeColor: '#f43f5e',
      accentColor: '#fbbf24',
      layerCount: 3,
      candleCount: 5,
      candlesLit: true,
      candleBlowProgress: 0
    },
    celebrationState: {
      fireworksActive: false,
      cakeCut: false,
      cakeCutProgress: 0,
      sliceSeparated: false,
      wishes: []
    },
    letter: {
      senderName: 'Forever Yours',
      recipientName: 'Birthday Star',
      title: 'Under the Midnight Stars',
      body: `Happy Birthday, my favorite soul in the universe!

Even across the distance and miles between us, my heart is right beside yours tonight.
Watching you smile as you blow out these candles makes the whole world feel warmer.

May this new year bring you infinite joy, gentle mornings, soaring dreams, and all the love you give so effortlessly to the world.

Always and forever with you ❤️`,
      revealed: false
    }
  };
}

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  let currentRoomId = null;

  // Create Room
  socket.on('create-room', ({ roomId, userName, role, cakeConfig, letter }) => {
    const id = (roomId || Math.random().toString(36).substring(2, 9)).toUpperCase();
    currentRoomId = id;

    let room = rooms.get(id);
    if (!room) {
      room = createDefaultRoom(id);
      room.creatorSocketId = socket.id;
      if (cakeConfig) room.cakeConfig = { ...room.cakeConfig, ...cakeConfig };
      if (letter) room.letter = { ...room.letter, ...letter };
      rooms.set(id, room);
    }

    const participant = {
      id: socket.id,
      name: userName || 'Host',
      role: role || 'star', // 'star' is the birthday person, 'partner' is celebrating with them
      isStar: role === 'star',
      isMuted: false,
      isVideoOff: false,
      joinedAt: Date.now()
    };

    const existingIndex = room.participants.findIndex(p => p.id === socket.id);
    if (existingIndex >= 0) {
      room.participants[existingIndex] = participant;
    } else {
      room.participants.push(participant);
    }

    socket.join(id);
    socket.emit('room-created', { roomId: id, roomState: room });
    console.log(`[Room Created] ID: ${id} by ${participant.name}`);
  });

  // Join Room
  socket.on('join-room', ({ roomId, userName, role }) => {
    const id = (roomId || '').trim().toUpperCase();
    if (!id || !rooms.has(id)) {
      const newRoom = createDefaultRoom(id);
      newRoom.creatorSocketId = socket.id;
      rooms.set(id, newRoom);
    }

    const room = rooms.get(id);
    currentRoomId = id;

    const otherParticipants = room.participants.filter(p => p.id !== socket.id);
    
    // Auto-assign role if needed (if one is star, the other is partner)
    let assignedRole = role;
    if (!assignedRole) {
      const hasStar = otherParticipants.some(p => p.role === 'star');
      assignedRole = hasStar ? 'partner' : 'star';
    }

    const participant = {
      id: socket.id,
      name: userName || (assignedRole === 'star' ? 'Birthday Star' : 'Partner'),
      role: assignedRole,
      isStar: assignedRole === 'star',
      isMuted: false,
      isVideoOff: false,
      joinedAt: Date.now()
    };

    const existingIndex = room.participants.findIndex(p => p.id === socket.id);
    if (existingIndex >= 0) {
      room.participants[existingIndex] = participant;
    } else {
      room.participants.push(participant);
    }

    socket.join(id);

    // Send full current room state to joining participant
    socket.emit('room-joined', {
      roomId: id,
      roomState: room,
      peers: otherParticipants
    });

    // Notify other peers in room
    socket.to(id).emit('peer-joined', {
      peer: participant,
      roomState: room
    });

    console.log(`[Peer Joined] ${participant.name} (${participant.role}) into room ${id}`);
  });

  // WebRTC Signaling: Client Media & RTCPeerConnection Ready
  socket.on('webrtc-ready', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    if (!room.readyForWebRtc) room.readyForWebRtc = [];

    if (!room.readyForWebRtc.includes(socket.id)) {
      room.readyForWebRtc.push(socket.id);
    }

    console.log(`[WebRTC Ready] from ${socket.id} in room ${currentRoomId} (${room.readyForWebRtc.length} ready)`);

    // Broadcast standard webrtc-ready to other peers in room
    socket.to(currentRoomId).emit('webrtc-ready', { from: socket.id });

    // When both participants are ready, designate Caller and Callee explicitly to prevent glare/race conditions
    if (room.participants.length >= 2 && room.readyForWebRtc.length >= 2) {
      const caller = room.participants[0];
      const callee = room.participants[1];

      console.log(`[WebRTC Handshake Trigger] Caller: ${caller.id}, Callee: ${callee.id}`);
      io.to(caller.id).emit('start-webrtc-call', { to: callee.id });
      io.to(callee.id).emit('expect-webrtc-call', { from: caller.id });
    }
  });

  // WebRTC Signaling: Offer
  socket.on('signal-offer', ({ to, offer }) => {
    if (to) {
      io.to(to).emit('signal-offer', { from: socket.id, offer });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit('signal-offer', { from: socket.id, offer });
    }
  });

  // WebRTC Signaling: Answer
  socket.on('signal-answer', ({ to, answer }) => {
    if (to) {
      io.to(to).emit('signal-answer', { from: socket.id, answer });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit('signal-answer', { from: socket.id, answer });
    }
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('signal-ice', ({ to, candidate }) => {
    if (to) {
      io.to(to).emit('signal-ice', { from: socket.id, candidate });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit('signal-ice', { from: socket.id, candidate });
    }
  });

  // START MY BDAY BUTTON (Either user can click; starts celebration once for both)
  const handleStartMyBday = () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    
    // Start celebration only once; prevent duplicate clicks
    if (room.celebrationStarted) {
      console.log(`[Start My Bday] Already started in room ${currentRoomId}, skipping duplicate.`);
      return;
    }

    room.celebrationStarted = true;
    room.stage = 'blowing';

    console.log(`[Start My Bday] Triggered by ${socket.id} in room ${currentRoomId}!`);

    // Broadcast celebration start and music start to all participants
    io.in(currentRoomId).emit('celebration-start', {
      stage: 'blowing',
      roomState: room
    });
    io.in(currentRoomId).emit('birthday:start', {
      stage: 'blowing',
      roomState: room
    });
    io.in(currentRoomId).emit('birthday:music-start');
  };

  socket.on('start-my-bday', handleStartMyBday);
  socket.on('birthday:start', handleStartMyBday);
  socket.on('user-press-celebrate', handleStartMyBday);

  // User media state update
  socket.on('update-user-media', ({ isMuted, isVideoOff, name, role }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    const p = room.participants.find(part => part.id === socket.id);
    if (p) {
      if (typeof isMuted === 'boolean') p.isMuted = isMuted;
      if (typeof isVideoOff === 'boolean') p.isVideoOff = isVideoOff;
      if (name) p.name = name;
      if (role) {
        p.role = role;
        p.isStar = role === 'star';
      }
      io.in(currentRoomId).emit('participant-updated', { participant: p });
    }
  });

  // Cake Config Update (Customization)
  socket.on('update-cake-config', (newConfig) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.cakeConfig = { ...room.cakeConfig, ...newConfig };
    io.in(currentRoomId).emit('cake-config-updated', room.cakeConfig);
  });

  // Candle Blowing Intensity (wavering flames real-time preview)
  socket.on('candle-blow-intensity', ({ intensity, progress }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.cakeConfig.candleBlowProgress = progress || 0;
    socket.to(currentRoomId).emit('candle-blow-intensity', { intensity, progress });
  });

  // Candle Extinguished Event: Step 6 & 7 -> advances directly to knife cutting
  const handleExtinguishCandles = ({ blownBy }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.cakeConfig.candlesLit = false;
    room.cakeConfig.candleBlowProgress = 100;
    room.stage = 'cutting'; // Next stage is cake cutting!

    io.in(currentRoomId).emit('candles-extinguished', {
      blownBy: blownBy || 'Birthday Star',
      roomState: room
    });
    io.in(currentRoomId).emit('birthday:candles-blown', {
      blownBy: blownBy || 'Birthday Star',
      roomState: room
    });
    io.in(currentRoomId).emit('birthday:knife-ready');

    console.log(`[Candles Extinguished] in room ${currentRoomId}. Advancing to knife cutting.`);
  };

  socket.on('extinguish-candles', handleExtinguishCandles);
  socket.on('birthday:candles-blown', handleExtinguishCandles);

  // Relight Candles (if user wants to celebrate again)
  socket.on('relight-candles', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.cakeConfig.candlesLit = true;
    room.cakeConfig.candleBlowProgress = 0;
    room.stage = 'blowing';
    room.celebrationStarted = true;
    room.celebrationState.fireworksActive = false;
    room.celebrationState.cakeCut = false;
    room.celebrationState.cakeCutProgress = 0;
    room.celebrationState.sliceSeparated = false;

    io.in(currentRoomId).emit('candles-relit', { roomState: room });
  });

  // Stage change
  socket.on('set-stage', ({ stage }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.stage = stage;
    io.in(currentRoomId).emit('stage-updated', { stage, roomState: room });
  });

  // Cake Cutting Animation Sync
  socket.on('cut-cake-progress', ({ progress }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.celebrationState.cakeCutProgress = progress;
    socket.to(currentRoomId).emit('cut-cake-progress', { progress });
  });

  // Cake cut complete: Step 9 -> leads to Step 10 & 11 (Custom Birthday Message & Fireworks)
  const handleCompleteCakeCut = () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.celebrationState.cakeCut = true;
    room.celebrationState.cakeCutProgress = 100;
    room.celebrationState.sliceSeparated = true;
    room.celebrationState.fireworksActive = true;
    room.stage = 'celebration'; // Transition to full celebration with custom message and fireworks!

    io.in(currentRoomId).emit('cake-cut-completed', {
      celebrationState: room.celebrationState,
      roomState: room
    });
    io.in(currentRoomId).emit('birthday:cake-cut', {
      celebrationState: room.celebrationState,
      roomState: room
    });
    io.in(currentRoomId).emit('birthday:message-reveal', {
      message: room.cakeConfig.message,
      name: room.cakeConfig.name
    });
    io.in(currentRoomId).emit('birthday:celebration-complete');

    console.log(`[Cake Cut Complete] in room ${currentRoomId}. Advancing to celebration message & fireworks.`);
  };

  socket.on('complete-cake-cut', handleCompleteCakeCut);
  socket.on('birthday:cake-cut', handleCompleteCakeCut);

  // Love Letter Update & Reveal
  socket.on('update-letter', (letterData) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.letter = { ...room.letter, ...letterData };
    io.in(currentRoomId).emit('letter-updated', room.letter);
  });

  socket.on('reveal-letter', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.letter.revealed = true;
    room.stage = 'letter';
    io.in(currentRoomId).emit('letter-revealed', room.letter);
  });

  // Send Romantic Wishes
  socket.on('send-wish', ({ wish, author }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    const newWish = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      author: author || 'Special Someone',
      wish,
      timestamp: Date.now()
    };
    room.celebrationState.wishes.push(newWish);
    io.in(currentRoomId).emit('wish-added', newWish);
  });

  // Live Floating Reactions
  socket.on('send-reaction', ({ type, senderName }) => {
    if (!currentRoomId) return;
    io.in(currentRoomId).emit('reaction-received', {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      type,
      senderName: senderName || 'Someone',
      x: 20 + Math.random() * 60,
      timestamp: Date.now()
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    if (!currentRoomId || !rooms.has(currentRoomId)) return;

    const room = rooms.get(currentRoomId);
    const index = room.participants.findIndex(p => p.id === socket.id);
    if (index >= 0) {
      const removed = room.participants.splice(index, 1)[0];
      if (room.readyForWebRtc) {
        room.readyForWebRtc = room.readyForWebRtc.filter(id => id !== socket.id);
      }
      socket.to(currentRoomId).emit('peer-left', {
        peerId: socket.id,
        peerName: removed ? removed.name : 'Participant',
        roomState: room
      });
    }

    if (room.participants.length === 0) {
      setTimeout(() => {
        if (rooms.has(currentRoomId) && rooms.get(currentRoomId).participants.length === 0) {
          rooms.delete(currentRoomId);
          console.log(`[Room Cleaned] ${currentRoomId}`);
        }
      }, 3600000);
    }
  });
});

// Serve frontend in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✨ Our Midnight Celebration Server running on http://localhost:${PORT}`);
});
