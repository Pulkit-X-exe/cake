const { io } = require('socket.io-client');

async function runTest() {
  console.log('🧪 Starting End-to-End Real-Time Multiplayer Sync Test...');

  const URL = 'http://localhost:3001';
  const roomId = 'TEST' + Math.floor(Math.random() * 1000);

  // Peer 1: Birthday Star
  const star = io(URL);
  // Peer 2: Partner
  const partner = io(URL);

  let starConnected = false;
  let partnerConnected = false;

  await new Promise((resolve) => {
    let count = 0;
    const check = () => {
      count++;
      if (count === 2) resolve();
    };
    star.on('connect', () => {
      starConnected = true;
      console.log('✅ Birthday Star connected to Socket.IO');
      check();
    });
    partner.on('connect', () => {
      partnerConnected = true;
      console.log('✅ Partner connected to Socket.IO');
      check();
    });
  });

  // 1. Star Creates / Joins Room
  console.log(`\n1️⃣ Testing Room Creation for Room: ${roomId}`);
  star.emit('create-room', {
    roomId,
    userName: 'Princess',
    role: 'star',
    cakeConfig: {
      name: 'Princess',
      candleCount: 7,
      theme: 'romantic-rose'
    }
  });

  await new Promise((resolve) => {
    star.on('room-created', ({ roomId: id, roomState }) => {
      console.log(`✅ Room Created: ${id}, participants: ${roomState.participants.length}, candles: ${roomState.cakeConfig.candleCount}`);
      resolve();
    });
  });

  // 2. Partner Joins Room
  console.log(`\n2️⃣ Testing Partner Joining Room: ${roomId}`);
  partner.emit('join-room', {
    roomId,
    userName: 'Romeo',
    role: 'partner'
  });

  await new Promise((resolve) => {
    let bothNotified = 0;
    partner.on('room-joined', ({ peers, roomState }) => {
      console.log(`✅ Partner joined successfully. Existing peers: ${peers.length}`);
      bothNotified++;
      if (bothNotified === 2) resolve();
    });

    star.on('peer-joined', ({ peer }) => {
      console.log(`✅ Star received peer-joined notification for: ${peer.name} (${peer.role})`);
      bothNotified++;
      if (bothNotified === 2) resolve();
    });
  });

  // 3. WebRTC Signaling Test (Offer -> Answer -> Candidate)
  console.log('\n3️⃣ Testing WebRTC Signaling flow...');
  star.emit('signal-offer', {
    to: partner.id,
    offer: { type: 'offer', sdp: 'fake-sdp-offer-for-testing' }
  });

  await new Promise((resolve) => {
    partner.on('signal-offer', ({ from, offer }) => {
      console.log(`✅ Partner received WebRTC offer from: ${from}`);
      partner.emit('signal-answer', {
        to: from,
        answer: { type: 'answer', sdp: 'fake-sdp-answer-for-testing' }
      });
    });

    star.on('signal-answer', ({ from, answer }) => {
      console.log(`✅ Star received WebRTC answer from: ${from}`);
      resolve();
    });
  });

  // 4. Real-time Candle Blowing & Extinguishing Sync
  console.log('\n4️⃣ Testing Candle Extinguish Synchronization...');
  star.emit('extinguish-candles', { blownBy: 'Princess' });

  await new Promise((resolve) => {
    partner.on('candles-extinguished', ({ blownBy, roomState }) => {
      console.log(`✅ Partner received candles-extinguished event! Blown by: ${blownBy}, Stage: ${roomState.stage}, Fireworks: ${roomState.celebrationState.fireworksActive}`);
      resolve();
    });
  });

  // 5. Synchronized Cake Cutting Test
  console.log('\n5️⃣ Testing Synchronized Cake Cutting...');
  partner.emit('cut-cake-progress', { progress: 50 });

  await new Promise((resolve) => {
    star.on('cut-cake-progress', ({ progress }) => {
      console.log(`✅ Star received cake cut progress: ${progress}%`);
      resolve();
    });
  });

  star.emit('complete-cake-cut');

  await new Promise((resolve) => {
    partner.on('cake-cut-completed', ({ celebrationState }) => {
      console.log(`✅ Partner received cake-cut-completed! Cut: ${celebrationState.cakeCut}, Slice Separated: ${celebrationState.sliceSeparated}`);
      resolve();
    });
  });

  // 6. Romantic Love Letter Sync Test
  console.log('\n6️⃣ Testing Romantic Love Letter Reveal...');
  star.emit('reveal-letter');

  await new Promise((resolve) => {
    partner.on('letter-revealed', (letter) => {
      console.log(`✅ Partner received letter-revealed! Title: "${letter.title}", Revealed: ${letter.revealed}`);
      resolve();
    });
  });

  // 7. Live Floating Reaction Test
  console.log('\n7️⃣ Testing Live Floating Reactions...');
  partner.emit('send-reaction', { type: 'heart', senderName: 'Romeo' });

  await new Promise((resolve) => {
    star.on('reaction-received', ({ type, senderName }) => {
      console.log(`✅ Star received live floating reaction: ${type} from ${senderName}`);
      resolve();
    });
  });

  console.log('\n🎉 ALL 7 REAL-TIME MULTIPLAYER TESTS PASSED PERFECTLY!\n');
  star.disconnect();
  partner.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

