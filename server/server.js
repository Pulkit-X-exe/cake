const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

// Production High-Availability ICE Servers (STUN + TURN over UDP, TCP, and TLS)
function getDefaultIceServers() {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:relay.metered.ca:80' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: [
        'turn:relay.metered.ca:80',
        'turn:relay.metered.ca:80?transport=tcp',
        'turn:relay.metered.ca:443',
        'turn:relay.metered.ca:443?transport=tcp',
        'turns:relay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: [
        'turn:staticauth.openrelay.metered.ca:80',
        'turn:staticauth.openrelay.metered.ca:80?transport=tcp',
        'turn:staticauth.openrelay.metered.ca:443',
        'turn:staticauth.openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];
}

// Cached Metered credentials
let cachedMeteredIce = null;
let lastMeteredFetchTime = 0;

async function getIceServers() {
  const appName = process.env.METERED_APP_NAME || process.env.TURN_APP_NAME;
  const apiKey = process.env.METERED_API_KEY || process.env.TURN_API_KEY;

  // 1. If Metered credentials configured via environment variables
  if (appName && apiKey) {
    const now = Date.now();
    if (cachedMeteredIce && (now - lastMeteredFetchTime < 10 * 60 * 1000)) {
      return cachedMeteredIce;
    }
    try {
      const response = await fetch(`https://${appName}.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const iceData = await response.json();
        if (Array.isArray(iceData) && iceData.length > 0) {
          cachedMeteredIce = iceData;
          lastMeteredFetchTime = now;
          console.log('[WebRTC TURN] Successfully fetched fresh Metered TURN credentials from API.');
          return iceData;
        }
      }
    } catch (err) {
      console.warn('[WebRTC TURN] Metered API fetch notice, using fallback relays:', err.message);
    }
  }

  // 2. If standard TURN_SECRET (RFC 5766 time-based HMAC) is configured
  if (process.env.TURN_SECRET && process.env.TURN_SERVER_URL) {
    const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
    const username = `${expiry}:midnight-celebration`;
    const hmac = crypto.createHmac('sha1', process.env.TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: [
          `turn:${process.env.TURN_SERVER_URL}:3478?transport=udp`,
          `turn:${process.env.TURN_SERVER_URL}:3478?transport=tcp`,
          `turns:${process.env.TURN_SERVER_URL}:5349?transport=tcp`
        ],
        username,
        credential
      }
    ];
  }

  return getDefaultIceServers();
}

// Health and ICE REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

app.get('/api/ice-servers', async (req, res) => {
  try {
    const iceServers = await getIceServers();
    res.json({ iceServers });
  } catch (err) {
    res.json({ iceServers: getDefaultIceServers() });
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

  // Real-time ICE Server Credentials
  socket.on('get-ice-servers', async (callback) => {
    try {
      const iceServers = await getIceServers();
      if (typeof callback === 'function') {
        callback({ iceServers });
      } else {
        socket.emit('ice-servers', { iceServers });
      }
    } catch (e) {
      const fallback = getDefaultIceServers();
      if (typeof callback === 'function') callback({ iceServers: fallback });
      else socket.emit('ice-servers', { iceServers: fallback });
    }
  });

  // Create Room
  socket.on('create-room', ({ roomId, userName, role, cakeConfig, letter, personalMessage }) => {
    const id = (roomId || Math.random().toString(36).substring(2, 9)).toUpperCase();
    currentRoomId = id;

    let room = rooms.get(id);
    if (!room) {
      room = createDefaultRoom(id);
      room.creatorSocketId = socket.id;
    }

    if (cakeConfig) {
      room.cakeConfig = { ...room.cakeConfig, ...cakeConfig };
      if (cakeConfig.name) room.letter.recipientName = cakeConfig.name;
    }

    const customBody = (personalMessage && personalMessage.trim()) || (letter && letter.body && letter.body.trim());
    if (customBody) {
      room.letter.body = customBody;
    }
    if (letter) {
      if (letter.title) room.letter.title = letter.title;
      if (letter.senderName) room.letter.senderName = letter.senderName;
      if (letter.recipientName) room.letter.recipientName = letter.recipientName;
    }
    if (role === 'partner' && userName) {
      room.letter.senderName = userName;
    } else if (role === 'star' && userName) {
      room.letter.recipientName = userName;
    }

    rooms.set(id, room);

    const creatorRole = role || 'star';
    const participant = {
      id: socket.id,
      name: userName || 'Host',
      role: creatorRole, // 'star' is the birthday person, 'partner' is celebrating with them
      isStar: creatorRole === 'star',
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
    socket.emit('room-created', { roomId: id, roomState: room, yourRole: creatorRole });
    console.log(`[Room Created] ID: ${id} by ${participant.name} with custom letter body: ${room.letter.body.slice(0, 30)}...`);
  });

  // Join Room
  socket.on('join-room', ({ roomId, userName, role, cakeConfig, letter, personalMessage }) => {
    const id = (roomId || '').trim().toUpperCase();
    let room = rooms.get(id);

    if (!room) {
      room = createDefaultRoom(id);
      room.creatorSocketId = socket.id;
      if (cakeConfig) {
        room.cakeConfig = { ...room.cakeConfig, ...cakeConfig };
        if (cakeConfig.name) room.letter.recipientName = cakeConfig.name;
      }
      const customBody = (personalMessage && personalMessage.trim()) || (letter && letter.body && letter.body.trim());
      if (customBody) {
        room.letter.body = customBody;
      }
      if (letter) {
        if (letter.title) room.letter.title = letter.title;
        if (letter.senderName) room.letter.senderName = letter.senderName;
        if (letter.recipientName) room.letter.recipientName = letter.recipientName;
      }
      if (role === 'partner' && userName) {
        room.letter.senderName = userName;
      } else if (role === 'star' && userName) {
        room.letter.recipientName = userName;
      }
      rooms.set(id, room);
    } else {
      // Room already exists! Retrieve existing room letter. DO NOT overwrite with default!
      const customBody = (personalMessage && personalMessage.trim()) || (letter && letter.body && letter.body.trim());
      const isDefaultBody = !room.letter.body || room.letter.body.startsWith('Happy Birthday, my favorite soul');
      if (customBody && isDefaultBody) {
        room.letter.body = customBody;
      }
      if (role === 'partner' && userName && (!room.letter.senderName || room.letter.senderName === 'Forever Yours')) {
        room.letter.senderName = userName;
      }
      if (role === 'star' && userName && (!room.letter.recipientName || room.letter.recipientName === 'Birthday Star')) {
        room.letter.recipientName = userName;
      }
    }

    currentRoomId = id;

    const otherParticipants = room.participants.filter(p => p.id !== socket.id);
    
    // Strictly enforce complementary roles for a 2-person celebration: exactly 1 Birthday Star and 1 Partner
    let assignedRole = role;
    if (otherParticipants.length > 0) {
      const hasStar = otherParticipants.some(p => p.role === 'star');
      const hasPartner = otherParticipants.some(p => p.role === 'partner');
      if (hasStar && !hasPartner) {
        assignedRole = 'partner';
      } else if (hasPartner && !hasStar) {
        assignedRole = 'star';
      } else if (!assignedRole) {
        assignedRole = hasStar ? 'partner' : 'star';
      }
    } else {
      assignedRole = role || 'star';
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

    // Send full current room state to joining participant with confirmed complementary role
    socket.emit('room-joined', {
      roomId: id,
      roomState: room,
      peers: otherParticipants,
      yourRole: assignedRole
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

    // When both participants are ready, designate Caller and Callee explicitly
    if (room.participants.length >= 2) {
      const caller = room.participants[0];
      const callee = room.participants[1];

      console.log(`[WebRTC Handshake Trigger] Caller: ${caller.id}, Callee: ${callee.id}`);
      io.to(caller.id).emit('start-webrtc-call', { to: callee.id });
      io.to(callee.id).emit('expect-webrtc-call', { from: caller.id });
    }
  });

  // WebRTC Signaling: Offer
  socket.on('signal-offer', ({ to, roomId, offer }) => {
    const targetRoom = roomId || currentRoomId;
    console.log(`[Signaling Offer] from ${socket.id} -> to ${to || targetRoom} (offer valid: ${!!offer})`);
    if (to) {
      io.to(to).emit('signal-offer', { from: socket.id, offer });
    } else if (targetRoom) {
      socket.to(targetRoom).emit('signal-offer', { from: socket.id, offer });
    }
  });

  // WebRTC Signaling: Answer
  socket.on('signal-answer', ({ to, roomId, answer }) => {
    const targetRoom = roomId || currentRoomId;
    console.log(`[Signaling Answer] from ${socket.id} -> to ${to || targetRoom} (answer valid: ${!!answer})`);
    if (to) {
      io.to(to).emit('signal-answer', { from: socket.id, answer });
    } else if (targetRoom) {
      socket.to(targetRoom).emit('signal-answer', { from: socket.id, answer });
    }
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('signal-ice', ({ to, roomId, candidate }) => {
    const targetRoom = roomId || currentRoomId;
    console.log(`[Signaling ICE] from ${socket.id} -> to ${to || targetRoom} (type: ${candidate?.type || 'null'})`);
    if (to) {
      io.to(to).emit('signal-ice', { from: socket.id, candidate });
    } else if (targetRoom) {
      socket.to(targetRoom).emit('signal-ice', { from: socket.id, candidate });
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

  // Synchronized Birthday Message Open & Reveal (Step 12)
  const handleOpenBirthdayMessage = () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.stage = 'message';
    room.celebrationState.fireworksActive = false;
    room.celebrationState.messageOpened = true;
    room.letter.revealed = true;
    // DO NOT overwrite room.letter.body with cakeConfig.message!
    // room.letter.body holds the personal keepsake letter!
    if (room.cakeConfig && room.cakeConfig.name && (!room.letter.recipientName || room.letter.recipientName === 'Birthday Star')) {
      room.letter.recipientName = room.cakeConfig.name;
    }

    io.in(currentRoomId).emit('birthday:open-message', {
      message: room.letter.body,
      name: room.letter.recipientName,
      letter: room.letter,
      roomState: room
    });
    io.in(currentRoomId).emit('stage-updated', {
      stage: 'message',
      roomState: room
    });
    io.in(currentRoomId).emit('letter-revealed', room.letter);
    console.log(`[Open Message] Triggered in room ${currentRoomId}. Advancing to message modal.`);
  };

  socket.on('open-birthday-message', handleOpenBirthdayMessage);
  socket.on('birthday:open-message', handleOpenBirthdayMessage);
  socket.on('reveal-letter', handleOpenBirthdayMessage);

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
const indexHtml = path.join(clientDist, 'index.html');
app.use(express.static(clientDist));

app.get('*', (req, res) => {
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('✨ Our Midnight Celebration Server is live and healthy!');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✨ Our Midnight Celebration Server running on http://localhost:${PORT}`);
});
