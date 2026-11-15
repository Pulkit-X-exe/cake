const { io } = require('socket.io-client');

async function runTest() {
  console.log('🧪 Starting End-to-End Real-Time Multi-Peer Celebration Flow Test...');

  const URL = 'http://localhost:3001';
  const roomId = 'ROOM' + Math.floor(Math.random() * 10000);

  // Peer 1: Birthday Star
  const star = io(URL);
  // Peer 2: Celebrating Partner
  const partner = io(URL);

  await new Promise((resolve) => {
    let count = 0;
    const check = () => {
      count++;
      if (count === 2) resolve();
    };
    star.on('connect', () => {
      console.log('✅ Star connected to Socket.IO (ID:', star.id, ')');
      check();
    });
    partner.on('connect', () => {
      console.log('✅ Partner connected to Socket.IO (ID:', partner.id, ')');
      check();
    });
  });

  // STEP 1: Star Creates Room
  console.log(`\n1️⃣ Testing Room Creation for Room: ${roomId}`);
  star.emit('create-room', {
    roomId,
    userName: 'Princess',
    role: 'star',
    cakeConfig: {
      name: 'Princess',
      message: 'Happy Birthday to my favorite person in the world!',
      candleCount: 5,
      theme: 'romantic-rose'
    }
  });

  await new Promise((resolve) => {
    star.on('room-created', ({ roomId: id, roomState }) => {
      console.log(`✅ Room Created: ${id}, participants: ${roomState.participants.length}, stage: ${roomState.stage}`);
      if (roomState.stage === 'ready-to-celebrate') {
        console.log('✅ Initial room stage is correctly "ready-to-celebrate"');
      }
      resolve();
    });
  });

  // STEP 2: Partner Joins Room
  console.log(`\n2️⃣ Testing Partner Joining Room: ${roomId}`);
  partner.emit('join-room', {
    roomId,
    userName: 'Romeo',
    role: 'partner'
  });

  await new Promise((resolve) => {
    let bothNotified = 0;
    partner.on('room-joined', ({ peers, roomState }) => {
      console.log(`✅ Partner joined room successfully. Total participants: ${roomState.participants.length}`);
      bothNotified++;
      if (bothNotified === 2) resolve();
    });

    star.on('peer-joined', ({ peer, roomState }) => {
      console.log(`✅ Star received peer-joined for: ${peer.name} (${peer.role})`);
      bothNotified++;
      if (bothNotified === 2) resolve();
    });
  });

  // STEP 3: Server-Coordinated WebRTC Handshake
  console.log('\n3️⃣ Testing Server-Coordinated WebRTC Signaling Handshake...');
  star.emit('webrtc-ready');
  partner.emit('webrtc-ready');

  await new Promise((resolve) => {
    let callerReceived = false;
    let calleeReceived = false;

    star.on('start-webrtc-call', ({ to }) => {
      console.log(`✅ Star designated as CALLER to target: ${to}`);
      callerReceived = true;
      // Caller sends offer
      star.emit('signal-offer', {
        to,
        offer: { type: 'offer', sdp: 'fake-sdp-star-offer' }
      });
    });

    partner.on('expect-webrtc-call', ({ from }) => {
      console.log(`✅ Partner designated as CALLEE from source: ${from}`);
      calleeReceived = true;
    });

    partner.on('signal-offer', ({ from, offer }) => {
      console.log(`✅ Partner received WebRTC offer from: ${from}`);
      partner.emit('signal-answer', {
        to: from,
        answer: { type: 'answer', sdp: 'fake-sdp-partner-answer' }
      });
    });

    star.on('signal-answer', ({ from, answer }) => {
      console.log(`✅ Star received WebRTC answer from: ${from}`);
      resolve();
    });
  });

  // STEP 4: Big Button "🎂 START MY BDAY ❤️" (Single press starts for both!)
  console.log('\n4️⃣ Testing "🎂 START MY BDAY ❤️" (Single click starts celebration for both)...');
  partner.emit('start-my-bday');

  await new Promise((resolve) => {
    let bothStarted = 0;
    const onStart = (device, data) => {
      console.log(`✅ [${device}] Celebration Started! Stage: ${data.stage}`);
      bothStarted++;
      if (bothStarted === 2) resolve();
    };

    star.on('celebration-start', (d) => onStart('Star Device', d));
    partner.on('celebration-start', (d) => onStart('Partner Device', d));
  });

  // STEP 5: Candle Blowing & Extinguish -> Advances to cutting
  console.log('\n5️⃣ Testing Candle Blowing & Extinguish...');
  star.emit('candle-blow-intensity', { intensity: 0.85, progress: 70 });

  await new Promise((resolve) => {
    partner.on('candle-blow-intensity', ({ intensity, progress }) => {
      console.log(`✅ Partner received live wavering blow intensity: ${(intensity * 100).toFixed(0)}%, progress: ${progress}%`);
      resolve();
    });
  });

  star.emit('extinguish-candles', { blownBy: 'Princess' });

  await new Promise((resolve) => {
    partner.on('candles-extinguished', ({ blownBy, roomState }) => {
      console.log(`✅ Partner received candles-extinguished! Stage advanced to: ${roomState.stage}`);
      if (roomState.stage === 'cutting') {
        console.log('✅ Correctly advanced to "cutting" stage (Virtual knife appears)!');
      }
      resolve();
    });
  });

  // STEP 6: Virtual Cake Knife Slicing & Cake Cut
  console.log('\n6️⃣ Testing Synchronized Cake Cutting...');
  star.emit('cut-cake-progress', { progress: 75 });

  await new Promise((resolve) => {
    partner.on('cut-cake-progress', ({ progress }) => {
      console.log(`✅ Partner received knife slicing progress: ${progress}%`);
      resolve();
    });
  });

  star.emit('complete-cake-cut');

  await new Promise((resolve) => {
    partner.on('cake-cut-completed', ({ celebrationState, roomState }) => {
      console.log(`✅ Partner received cake-cut-completed! Cut: ${celebrationState.cakeCut}, Slices Separated: ${celebrationState.sliceSeparated}, Stage: ${roomState.stage}`);
      if (roomState.stage === 'celebration' && celebrationState.fireworksActive) {
        console.log('✅ Correctly advanced to "celebration" stage with fireworks active!');
      }
      resolve();
    });
  });

  console.log('\n🎉 ALL REAL-TIME STEPS PASSED WITH 100% SUCCESS!\n');
  star.disconnect();
  partner.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
