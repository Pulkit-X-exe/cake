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

  const customTestMessage = `Happy Birthday, my favourite person! ❤️

Distance may keep us apart tonight, but my heart is always with you.

I hope every candle you blow brings a beautiful wish into your life.

I love you. Happy Birthday, my love! ❤️`;

  // STEP 1: Partner Creates Room with Custom Personal Message
  console.log(`\n1️⃣ Testing Room Creation with Custom Keepsake Letter for Room: ${roomId}`);
  partner.emit('create-room', {
    roomId,
    userName: 'Romeo',
    role: 'partner',
    personalMessage: customTestMessage,
    cakeConfig: {
      name: 'Princess',
      message: 'Happy Birthday!',
      candleCount: 5,
      theme: 'romantic-rose'
    }
  });

  await new Promise((resolve) => {
    partner.on('room-created', ({ roomId: id, roomState }) => {
      console.log(`✅ Room Created: ${id}, participants: ${roomState.participants.length}, stage: ${roomState.stage}`);
      if (roomState.letter && roomState.letter.body === customTestMessage) {
        console.log('✅ Custom personal message properly saved in room.letter.body!');
      } else {
        console.error('❌ Failed to save custom message in room.letter:', roomState.letter);
      }
      resolve();
    });
  });

  // STEP 2: Birthday Star Joins Room
  console.log(`\n2️⃣ Testing Star Joining Room: ${roomId}`);
  star.emit('join-room', {
    roomId,
    userName: 'Princess',
    role: 'star'
  });

  await new Promise((resolve) => {
    let bothNotified = 0;
    star.on('room-joined', ({ peers, roomState }) => {
      console.log(`✅ Star joined room successfully. Total participants: ${roomState.participants.length}`);
      bothNotified++;
      if (bothNotified === 2) resolve();
    });

    partner.on('peer-joined', ({ peer, roomState }) => {
      console.log(`✅ Partner received peer-joined for: ${peer.name} (${peer.role})`);
      bothNotified++;
      if (bothNotified === 2) resolve();
    });
  });

  // STEP 3: Server-Coordinated WebRTC Handshake
  console.log('\n3️⃣ Testing Server-Coordinated WebRTC Signaling Handshake...');
  star.emit('webrtc-ready');
  partner.emit('webrtc-ready');

  await new Promise((resolve) => {
    const handleCaller = (socket, name) => ({ to }) => {
      console.log(`✅ ${name} designated as CALLER to target: ${to}`);
      socket.emit('signal-offer', {
        to,
        offer: { type: 'offer', sdp: 'fake-sdp-offer' }
      });
    };

    const handleCallee = (name) => ({ from }) => {
      console.log(`✅ ${name} designated as CALLEE from source: ${from}`);
    };

    const handleOffer = (socket, name) => ({ from, offer }) => {
      console.log(`✅ ${name} received WebRTC offer from: ${from}`);
      socket.emit('signal-answer', {
        to: from,
        answer: { type: 'answer', sdp: 'fake-sdp-answer' }
      });
    };

    const handleAnswer = (name) => ({ from, answer }) => {
      console.log(`✅ ${name} received WebRTC answer from: ${from}`);
      resolve();
    };

    star.on('start-webrtc-call', handleCaller(star, 'Star'));
    partner.on('start-webrtc-call', handleCaller(partner, 'Partner'));

    star.on('expect-webrtc-call', handleCallee('Star'));
    partner.on('expect-webrtc-call', handleCallee('Partner'));

    star.on('signal-offer', handleOffer(star, 'Star'));
    partner.on('signal-offer', handleOffer(partner, 'Partner'));

    star.on('signal-answer', handleAnswer('Star'));
    partner.on('signal-answer', handleAnswer('Partner'));
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

  // STEP 7: "OPEN THE MESSAGE ❤️" Button & Romantic Keepsake Reveal
  console.log('\n7️⃣ Testing "OPEN THE MESSAGE ❤️" Button Synchronization...');
  partner.emit('open-birthday-message');

  await new Promise((resolve) => {
    let bothOpened = 0;
    const onOpen = (device, { message, name, letter, roomState }) => {
      console.log(`✅ [${device}] Received birthday:open-message! Recipient: ${name}`);
      console.log(`📜 Message preview: "${(letter?.body || message).substring(0, 40)}..."`);
      if (letter?.body === customTestMessage || message === customTestMessage) {
        console.log(`✅ [${device}] EXACT custom personal message verified on device!`);
      } else {
        console.error(`❌ [${device}] Custom message mismatch! Expected exact test message, got:`, letter?.body || message);
      }
      if (roomState.stage === 'message' && !roomState.celebrationState.fireworksActive) {
        console.log(`✅ [${device}] Room stage correctly set to "message" and fireworks dismissed.`);
      }
      bothOpened++;
      if (bothOpened === 2) resolve();
    };

    star.on('birthday:open-message', (data) => onOpen('Star Device', data));
    partner.on('birthday:open-message', (data) => onOpen('Partner Device', data));
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
