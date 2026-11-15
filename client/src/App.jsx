import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Sparkles,
  Heart,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Crown,
  Users,
  UtensilsCrossed,
  Mail,
  RotateCcw,
  Cake,
  PartyPopper
} from 'lucide-react';
import confetti from 'canvas-confetti';

import WelcomeScreen from './components/WelcomeScreen';
import RoomModal from './components/RoomModal';
import VideoCall from './components/VideoCall';
import Cake3D from './components/Cake3D';
import CandleBlowingControls from './components/CandleBlowingControls';
import FireworksCelebration from './components/FireworksCelebration';
import CakeCuttingModal from './components/CakeCuttingModal';
import RomanticEnding from './components/RomanticEnding';
import ReactionFloatingBar from './components/ReactionFloatingBar';
import ErrorBoundary from './components/ErrorBoundary';
import { soundEngine } from './utils/audio';

const SOCKET_SERVER_URL = window.location.port === '5173'
  ? 'http://localhost:3001'
  : window.location.origin;

export default function App() {
  // Navigation & Screen Stages
  const [appStage, setAppStage] = useState('welcome'); // 'welcome' | 'room-setup' | 'celebration'
  // 11-step Sequence Stage: 'ready-to-celebrate' | 'blowing' | 'cutting' | 'celebration' | 'letter'
  const [celebrationStage, setCelebrationStage] = useState('ready-to-celebrate');

  // Socket & Room State
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [readyUsers, setReadyUsers] = useState([]); // Socket IDs who pressed "LET'S CELEBRATE 🎂"
  const [linkCopied, setLinkCopied] = useState(false);

  // Music State
  const [isMusicMuted, setIsMusicMuted] = useState(false);

  // Cake & Celebration State
  const [cakeConfig, setCakeConfig] = useState({
    name: 'My Love',
    message: 'Happy Birthday to my favorite person in the world!',
    theme: 'romantic-rose',
    cakeColor: '#f43f5e',
    accentColor: '#fbbf24',
    candleCount: 5,
    candlesLit: true,
    candleBlowProgress: 0
  });

  const [blowIntensity, setBlowIntensity] = useState(0);
  const [cuttingProgress, setCuttingProgress] = useState(0);
  const [isCutComplete, setIsCutComplete] = useState(false);
  const [isFireworksActive, setIsFireworksActive] = useState(false);
  const [letterData, setLetterData] = useState({
    senderName: 'Forever Yours',
    recipientName: 'Birthday Star',
    title: 'Under the Midnight Stars',
    body: `Happy Birthday, my favorite soul in the universe!

Even across the distance and miles between us, my heart is right beside yours tonight.
Watching you smile as you blow out these candles makes the whole world feel warmer.

May this new year bring you infinite joy, gentle mornings, soaring dreams, and all the love you give so effortlessly to the world.

Always and forever with you ❤️`,
    revealed: false
  });
  const [wishes, setWishes] = useState([]);
  const [hatStyle, setHatStyle] = useState('royal-gold'); // 'royal-gold' | 'midnight-ruby' | 'celestial-pink'

  // Check URL query param for room invitation (?room=XYZ)
  const initialRoomId = new URLSearchParams(window.location.search).get('room') || '';

  // Initialize Socket.IO connection
  useEffect(() => {
    const s = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    setSocket(s);

    s.on('connect', () => {
      console.log('[App] Connected to Socket server with ID:', s.id);
    });

    // Room created / joined responses
    s.on('room-created', ({ roomId: id, roomState }) => {
      setRoomId(id);
      applyRoomState(roomState);
      setAppStage('celebration');
    });

    s.on('room-joined', ({ roomId: id, roomState }) => {
      setRoomId(id);
      applyRoomState(roomState);
      setAppStage('celebration');
    });

    s.on('peer-joined', ({ peer, roomState }) => {
      if (roomState) applyRoomState(roomState);
      soundEngine.playSparkleChime();
    });

    s.on('peer-left', ({ peerName, roomState }) => {
      if (roomState) applyRoomState(roomState);
    });

    // Synchronized readiness: "LET'S CELEBRATE 🎂"
    s.on('celebrate-readiness', ({ readyUserIds }) => {
      setReadyUsers(readyUserIds || []);
    });

    // Step 4: Celebration Start triggered when both participants press "LET'S CELEBRATE"
    s.on('celebration-start', ({ stage, roomState }) => {
      console.log('[App] Celebration Start triggered! Starting Happy Birthday Song.');
      setCelebrationStage('blowing');
      soundEngine.ensureContext();
      soundEngine.startMusic('birthday');
      soundEngine.playSparkleChime();
      triggerConfettiBurst();
      if (roomState) applyRoomState(roomState);
    });

    // Cake config sync
    s.on('cake-config-updated', (newConfig) => {
      setCakeConfig(prev => ({ ...prev, ...newConfig }));
    });

    // Candle blowing sync
    s.on('candle-blow-intensity', ({ intensity, progress }) => {
      setBlowIntensity(intensity);
      setCakeConfig(prev => ({ ...prev, candleBlowProgress: progress }));
    });

    // Step 6 -> Step 7: Candles Extinguished -> Immediately shows Virtual Cake Knife
    s.on('candles-extinguished', ({ roomState }) => {
      console.log('[App] Candles extinguished! Advancing to knife cutting.');
      soundEngine.playExtinguishSound();
      setCakeConfig(prev => ({ ...prev, candlesLit: false, candleBlowProgress: 100 }));
      setCelebrationStage('cutting'); // Next stage is cake cutting!
      setIsFireworksActive(false);
      if (roomState) applyRoomState(roomState);
    });

    s.on('candles-relit', ({ roomState }) => {
      soundEngine.setMusicMode('romantic');
      setCakeConfig(prev => ({ ...prev, candlesLit: true, candleBlowProgress: 0 }));
      setCelebrationStage('blowing');
      setIsFireworksActive(false);
      setIsCutComplete(false);
      setCuttingProgress(0);
      if (roomState) applyRoomState(roomState);
    });

    // Stage changes
    s.on('stage-updated', ({ stage }) => {
      setCelebrationStage(stage);
      if (stage === 'cutting') {
        setIsFireworksActive(false);
      }
    });

    // Cake Cutting Sync
    s.on('cut-cake-progress', ({ progress }) => {
      setCuttingProgress(progress);
    });

    // Step 9 -> Step 10 & 11: Cake Cut Complete -> Grand Celebration Message & Fireworks
    s.on('cake-cut-completed', ({ celebrationState, roomState }) => {
      console.log('[App] Cake cut completed! Showing custom birthday message & fireworks.');
      setIsCutComplete(true);
      setCuttingProgress(100);
      soundEngine.playKnifeCutSound();
      soundEngine.setMusicMode('celebration');
      setCelebrationStage('celebration');
      setIsFireworksActive(true);
      if (roomState) applyRoomState(roomState);
    });

    // Love Letter Sync
    s.on('letter-updated', (letter) => {
      setLetterData(letter);
    });

    s.on('letter-revealed', (letter) => {
      setLetterData(letter);
      setCelebrationStage('letter');
    });

    // Wishes
    s.on('wish-added', (newWish) => {
      setWishes(prev => [...prev, newWish]);
      soundEngine.playSparkleChime();
    });

    return () => {
      s.disconnect();
    };
  }, []);

  function applyRoomState(state) {
    if (!state) return;
    if (state.participants) setParticipants(state.participants);
    if (state.readyUsers) setReadyUsers(state.readyUsers);
    if (state.cakeConfig) setCakeConfig(state.cakeConfig);
    if (state.stage) setCelebrationStage(state.stage);
    if (state.celebrationState) {
      setIsFireworksActive(state.celebrationState.fireworksActive);
      setIsCutComplete(state.celebrationState.cakeCut);
      setCuttingProgress(state.celebrationState.cakeCutProgress);
      if (state.celebrationState.wishes) setWishes(state.celebrationState.wishes);
    }
    if (state.letter) setLetterData(state.letter);
  }

  function triggerConfettiBurst() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#f43f5e', '#fbbf24', '#f472b6', '#ffffff', '#fb7185']
    });
  }

  // Handle joining or creating room
  const handleJoinOrCreateRoom = ({ roomId: id, userName, role, cakeConfig: newCakeConfig }) => {
    if (!socket) return;

    const user = {
      name: userName,
      role, // 'star' | 'partner'
      isStar: role === 'star'
    };
    setCurrentUser(user);

    if (newCakeConfig) {
      setCakeConfig(prev => ({ ...prev, ...newCakeConfig }));
    }

    socket.emit('join-room', {
      roomId: id,
      userName,
      role
    });

    setRoomId(id);
    soundEngine.ensureContext();
    soundEngine.startMusic('romantic');
  };

  // Both users must press "LET'S CELEBRATE 🎂"
  const handlePressCelebrate = () => {
    soundEngine.ensureContext();
    soundEngine.playSparkleChime();
    if (socket && roomId) {
      socket.emit('user-press-celebrate');
    }
  };

  // Toggle Music Mute
  const handleToggleMusic = () => {
    const muted = soundEngine.toggleMute();
    setIsMusicMuted(muted);
  };

  // Copy invitation link
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Transition from Cake Cutting / Celebration to Romantic Letter
  const handleProceedToLetter = () => {
    setCelebrationStage('letter');
    if (socket && roomId) {
      socket.emit('set-stage', { stage: 'letter' });
    }
  };

  // Relight Candles to celebrate again
  const handleRelightCandles = () => {
    if (socket && roomId) {
      socket.emit('relight-candles');
    }
  };

  // Send a Wish
  const handleSendWish = (wish) => {
    if (socket && roomId) {
      socket.emit('send-wish', { wish, author: currentUser?.name || 'Someone Special' });
    }
  };

  // Update Letter
  const handleUpdateLetter = (updated) => {
    if (socket && roomId) {
      socket.emit('update-letter', updated);
    }
  };

  // Reveal Letter
  const handleRevealLetter = () => {
    if (socket && roomId) {
      socket.emit('reveal-letter');
    }
  };

  // Render Welcome Screen
  if (appStage === 'welcome') {
    return (
      <WelcomeScreen
        onEnter={() => setAppStage('room-setup')}
        isMusicMuted={isMusicMuted}
        onToggleMusic={handleToggleMusic}
      />
    );
  }

  // Render Room Setup Modal
  if (appStage === 'room-setup') {
    return (
      <RoomModal
        isOpen={true}
        initialRoomId={initialRoomId}
        onJoinRoom={handleJoinOrCreateRoom}
      />
    );
  }

  // Main Celebration Room
  const isBirthdayStar = currentUser?.role === 'star';
  const hasPartnerJoined = participants.length >= 2;
  const isLocalReady = socket?.id && readyUsers.includes(socket.id);
  const isPartnerReady = readyUsers.some(id => id !== socket?.id);

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-midnight-gradient text-pink-100 overflow-x-hidden select-none">
      
      {/* Top Atmospheric Navbar */}
      <header className="relative z-30 w-full px-4 sm:px-8 py-3 flex items-center justify-between border-b border-pink-500/15 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-float">🎂</span>
          <div>
            <h1 className="font-cinzel-royal text-sm sm:text-base tracking-widest text-amber-200 font-bold uppercase">
              Our Midnight Celebration
            </h1>
            <p className="text-[10px] text-pink-300/70 hidden sm:block">
              {cakeConfig.name ? `Celebrating ${cakeConfig.name}` : 'A Virtual Birthday Sanctuary'}
            </p>
          </div>
        </div>

        {/* Room Code & Connection Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleCopyLink}
            title="Click to copy invitation link"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-mono font-medium border border-pink-500/30 transition-all shadow-sm cursor-pointer"
          >
            {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
            <span className="tracking-wider">{roomId}</span>
          </button>

          {/* Connected Participants Count Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs text-pink-200/90 backdrop-blur-md">
            <Users className="w-3.5 h-3.5 text-pink-400" />
            <span>
              {hasPartnerJoined ? 'Both Participants Connected ❤️' : `${participants.length} Connected`}
            </span>
          </div>

          {/* Hat Style Selector for Birthday Star */}
          {isBirthdayStar && (
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[11px] text-amber-300/80 font-medium">Hat Style:</span>
              <select
                value={hatStyle}
                onChange={e => setHatStyle(e.target.value)}
                className="bg-black/60 border border-amber-400/40 text-amber-200 text-xs rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
              >
                <option value="royal-gold">Royal Gold</option>
                <option value="midnight-ruby">Midnight Ruby</option>
                <option value="celestial-pink">Celestial Pink</option>
              </select>
            </div>
          )}

          {/* Music Toggle */}
          <button
            onClick={handleToggleMusic}
            title="Toggle Birthday Music"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
          >
            {isMusicMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
          </button>
        </div>
      </header>

      {/* Cinematic Banner: Shown once celebration starts */}
      {celebrationStage !== 'ready-to-celebrate' && (
        <div className="relative z-20 w-full py-2.5 px-4 bg-gradient-to-r from-amber-500/20 via-rose-500/30 to-pink-500/20 border-b border-amber-400/30 text-center animate-fadeIn shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            <span className="font-serif-luxury text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-100 to-amber-300 tracking-wider">
              {celebrationStage === 'blowing' && 'HAPPY BIRTHDAY TO YOU! ❤️'}
              {celebrationStage === 'cutting' && 'NOW CUT YOUR BIRTHDAY CAKE! 🎂'}
              {celebrationStage === 'celebration' && `HAPPY BIRTHDAY, ${(cakeConfig.name || 'MY LOVE').toUpperCase()}! 🎉`}
              {celebrationStage === 'letter' && 'UNDER THE MIDNIGHT STARS 💌'}
            </span>
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Stage Progression Breadcrumb Bar */}
      <div className="relative z-20 w-full px-4 py-2 flex items-center justify-center gap-2 sm:gap-6 bg-black/20 border-b border-pink-500/10 text-[11px] sm:text-xs">
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'ready-to-celebrate'
              ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-400/50 shadow-glow'
              : 'text-pink-300/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>1. Join & Connect</span>
        </span>

        <span className="text-pink-500/30">→</span>

        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'blowing'
              ? 'bg-rose-500/20 text-rose-200 font-semibold border border-rose-400/50 shadow-glow'
              : 'text-pink-300/60'
          }`}
        >
          <Cake className="w-3.5 h-3.5" />
          <span>2. Blow Candles</span>
        </span>

        <span className="text-pink-500/30">→</span>

        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'cutting'
              ? 'bg-pink-500/20 text-pink-200 font-semibold border border-pink-400/50 shadow-glow'
              : 'text-pink-300/60'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>3. Cut Cake</span>
        </span>

        <span className="text-pink-500/30">→</span>

        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'celebration' || celebrationStage === 'letter'
              ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-400/50 shadow-glow'
              : 'text-pink-300/60'
          }`}
        >
          <PartyPopper className="w-3.5 h-3.5" />
          <span>4. Fireworks & Love Letter</span>
        </span>
      </div>

      {/* Main Celebration Content Area */}
      <main className="relative flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between p-3 sm:p-6 gap-4 sm:gap-6">
        
        {/* Left Side: 3D Birthday Cake & Virtual Candle Blowing Controls */}
        <div className="relative w-full lg:w-7/12 h-[420px] sm:h-[500px] lg:h-[620px] flex flex-col items-center justify-between rounded-3xl bg-cake-stage border border-pink-500/20 p-2 sm:p-4 shadow-2xl overflow-hidden">
          
          {/* Subtle Stage Lighting Ring */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent" />

          {/* 3D Cake Canvas Component */}
          <div className="relative w-full flex-1">
            <ErrorBoundary>
              <Cake3D
                cakeConfig={cakeConfig}
                blowIntensity={blowIntensity}
                cuttingProgress={cuttingProgress}
                isSliceSeparated={isCutComplete}
              />
            </ErrorBoundary>
          </div>

          {/* Bottom Console: Step 3 "LET'S CELEBRATE 🎂" OR Candle Blowing Controls */}
          <div className="w-full mt-2">
            {celebrationStage === 'ready-to-celebrate' ? (
              <div className="relative z-30 max-w-md mx-auto w-full px-5 py-4 rounded-3xl bg-[#1c0828]/95 border-2 border-amber-400/50 shadow-2xl backdrop-blur-2xl text-center select-none animate-fadeIn">
                {!hasPartnerJoined ? (
                  <>
                    <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-amber-200 mb-1">
                      Waiting for Partner to Join ❤️
                    </h3>
                    <p className="text-xs sm:text-sm text-pink-200/80 mb-3">
                      Both of you need to be connected to begin the midnight celebration together!
                    </p>
                    <button
                      onClick={handleCopyLink}
                      className="px-5 py-2.5 rounded-full bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-semibold border border-pink-400/40 transition-all flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-300" />}
                      <span>{linkCopied ? 'Link Copied to Clipboard!' : 'Copy Invitation Link'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Both Participants Connected ❤️</span>
                    </div>

                    <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-amber-200 mb-1">
                      Ready to Celebrate Together! 🎉
                    </h3>

                    <p className="text-xs text-pink-200/80 mb-4">
                      {isLocalReady
                        ? "Waiting for your partner... ⏳ (1/2 Ready)"
                        : isPartnerReady
                        ? "Your partner is ready! Press to start the celebration! 💖"
                        : "Both of you must press the button below to begin the birthday celebration simultaneously!"}
                    </p>

                    <button
                      onClick={handlePressCelebrate}
                      disabled={isLocalReady}
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-base sm:text-lg shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 border ${
                        isLocalReady
                          ? 'bg-white/10 text-pink-200/70 border-white/10 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 hover:from-amber-400 hover:via-rose-400 hover:to-pink-500 text-white border-amber-300/60 shadow-glow hover:scale-105 active:scale-95 cursor-pointer'
                      }`}
                    >
                      <span>🎂</span>
                      <span>{isLocalReady ? "Waiting for your partner... ⏳" : "LET'S CELEBRATE 🎂"}</span>
                      {!isLocalReady && <Sparkles className="w-5 h-5 text-amber-200 animate-spin" />}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <CandleBlowingControls
                socket={socket}
                roomId={roomId}
                candlesLit={cakeConfig.candlesLit}
                isBirthdayStar={isBirthdayStar}
                onExtinguishCandles={() => {
                  setCakeConfig(prev => ({ ...prev, candlesLit: false, candleBlowProgress: 100 }));
                  setCelebrationStage('cutting'); // Lead directly to knife cutting!
                }}
                onBlowIntensity={(intensity, progress) => {
                  setBlowIntensity(intensity);
                  setCakeConfig(prev => ({ ...prev, candleBlowProgress: progress }));
                }}
              />
            )}
          </div>
        </div>

        {/* Right Side: WebRTC Live 2-Person Video Call with Head-Tracked Hat */}
        <div className="relative w-full lg:w-5/12 h-[340px] sm:h-[440px] lg:h-[620px] flex flex-col items-center justify-center rounded-3xl bg-black/40 border border-pink-500/20 shadow-2xl overflow-hidden">
          <ErrorBoundary>
            <VideoCall
              socket={socket}
              roomId={roomId}
              currentUser={currentUser}
              participants={participants}
              hatStyle={hatStyle}
            />
          </ErrorBoundary>
        </div>
      </main>

      {/* Synchronized Cake Cutting Modal (Step 7 & 8) */}
      {celebrationStage === 'cutting' && (
        <CakeCuttingModal
          socket={socket}
          roomId={roomId}
          cuttingProgress={cuttingProgress}
          isCutComplete={isCutComplete}
          onProceedToLetter={handleProceedToLetter}
          isHost={currentUser?.role === 'star'}
        />
      )}

      {/* Grand Fullscreen Fireworks Celebration & Custom Birthday Message (Step 10 & 11) */}
      {isFireworksActive && (
        <FireworksCelebration
          isActive={isFireworksActive}
          partnerName={cakeConfig.name}
          customMessage={cakeConfig.message}
          onProceedToLetter={handleProceedToLetter}
          onRelightCandles={handleRelightCandles}
        />
      )}

      {/* Romantic Surprise Ending & Love Letter Overlay */}
      {celebrationStage === 'letter' && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-2xl overflow-y-auto">
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setCelebrationStage('blowing')}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Cake</span>
            </button>
          </div>

          <RomanticEnding
            letter={letterData}
            onUpdateLetter={handleUpdateLetter}
            onRevealLetter={handleRevealLetter}
            onRelightCandles={handleRelightCandles}
            onSendWish={handleSendWish}
            wishes={wishes}
            isHost={currentUser?.role === 'star'}
          />
        </div>
      )}

      {/* Floating Reactions Bar (Hearts, Kisses, Cheers) */}
      <ReactionFloatingBar
        socket={socket}
        roomId={roomId}
        userName={currentUser?.name || 'Someone'}
      />
    </div>
  );
}
