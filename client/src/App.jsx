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
  // Strict 12-step Sequence Stage: 'ready-to-celebrate' | 'blowing' | 'cutting' | 'celebration' | 'letter'
  const [celebrationStage, setCelebrationStage] = useState('ready-to-celebrate');

  // Socket & Room State
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
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

    // Step 4 & 5: Celebration Start triggered by "START MY BDAY ❤️" button
    const handleCelebrationStart = ({ stage, roomState }) => {
      console.log('[App] Celebration Start triggered! Starting Happy Birthday Song.');
      setIsStarting(false);
      setCelebrationStage('blowing');
      soundEngine.ensureContext();
      soundEngine.startMusic('birthday');
      soundEngine.playSparkleChime();
      triggerConfettiBurst();
      if (roomState) applyRoomState(roomState);
    };

    s.on('celebration-start', handleCelebrationStart);
    s.on('birthday:start', handleCelebrationStart);

    s.on('birthday:music-start', () => {
      soundEngine.ensureContext();
      soundEngine.startMusic('birthday');
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

    // Step 7 & 8: Candles Extinguished -> Immediately shows Virtual Cake Knife
    const handleCandlesExtinguished = ({ roomState }) => {
      console.log('[App] Candles extinguished! Advancing to knife cutting.');
      soundEngine.playExtinguishSound();
      setCakeConfig(prev => ({ ...prev, candlesLit: false, candleBlowProgress: 100 }));
      setCelebrationStage('cutting'); // Next stage is cake cutting!
      setIsFireworksActive(false);
      if (roomState) applyRoomState(roomState);
    };

    s.on('candles-extinguished', handleCandlesExtinguished);
    s.on('birthday:candles-blown', handleCandlesExtinguished);

    s.on('birthday:knife-ready', () => {
      setCelebrationStage('cutting');
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

    // Step 10, 11 & 12: Cake Cut Complete -> Grand Celebration Message & Fireworks
    const handleCakeCutComplete = ({ celebrationState, roomState }) => {
      console.log('[App] Cake cut completed! Showing custom birthday message & fireworks.');
      setIsCutComplete(true);
      setCuttingProgress(100);
      soundEngine.playKnifeCutSound();
      soundEngine.setMusicMode('celebration');
      setCelebrationStage('celebration');
      setIsFireworksActive(true);
      if (roomState) applyRoomState(roomState);
    };

    s.on('cake-cut-completed', handleCakeCutComplete);
    s.on('birthday:cake-cut', handleCakeCutComplete);

    s.on('birthday:message-reveal', ({ message, name }) => {
      if (message || name) {
        setCakeConfig(prev => ({
          ...prev,
          message: message || prev.message,
          name: name || prev.name
        }));
      }
      setIsFireworksActive(true);
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

  // Big Button Action: "🎂 START MY BDAY ❤️"
  const handleStartMyBday = () => {
    soundEngine.ensureContext();
    soundEngine.playSparkleChime();
    setIsStarting(true);
    if (socket && roomId) {
      socket.emit('start-my-bday');
      socket.emit('birthday:start');
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
  const hasPartnerJoined = participants.length >= 2 || participants.some(p => p.id !== socket?.id);

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
              {celebrationStage === 'cutting' && "Now it's time to cut your birthday cake! 🎂"}
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
          <span>1. Live Video Call</span>
        </span>

        <span className="text-pink-500/30">→</span>

        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'ready-to-celebrate'
              ? 'text-amber-300 font-semibold'
              : 'text-pink-300/60'
          }`}
        >
          <PartyPopper className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          <span>2. Start My Bday</span>
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
          <span>3. Blow Candles</span>
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
          <span>4. Cut Cake</span>
        </span>

        <span className="text-pink-500/30">→</span>

        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'celebration' || celebrationStage === 'letter'
              ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-400/50 shadow-glow'
              : 'text-pink-300/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>5. Fireworks & Message</span>
        </span>
      </div>

      {/* Main Celebration Content Area: Responsive 2-column layout */}
      <main className="relative flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch justify-center p-3 sm:p-5 gap-4 sm:gap-6">
        
        {/* Left Side: 3D Birthday Cake & START MY BDAY Console */}
        <div className="relative w-full lg:w-7/12 min-h-[500px] sm:min-h-[560px] lg:min-h-[620px] flex flex-col justify-between rounded-3xl bg-cake-stage border border-pink-500/20 p-3 sm:p-5 shadow-2xl overflow-visible">
          
          {/* Subtle Stage Lighting Ring */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent" />

          {/* 3D Cake Canvas Component with dedicated height */}
          <div className="relative w-full h-[280px] sm:h-[340px] lg:h-[380px] flex items-center justify-center">
            <ErrorBoundary>
              <Cake3D
                cakeConfig={cakeConfig}
                blowIntensity={blowIntensity}
                cuttingProgress={cuttingProgress}
                isSliceSeparated={isCutComplete}
              />
            </ErrorBoundary>
          </div>

          {/* Directly below the 3D Birthday Cake: Prominent Controls Area */}
          <div className="w-full relative z-30 mt-3 px-1 pb-1">
            {celebrationStage === 'ready-to-celebrate' ? (
              <div className="max-w-md mx-auto w-full p-4 sm:p-5 rounded-3xl bg-[#1c0828]/95 border-2 border-amber-400/50 shadow-2xl backdrop-blur-2xl text-center select-none animate-fadeIn">
                {/* Connection Status Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{hasPartnerJoined ? 'Both Participants Connected ❤️' : 'Waiting for Partner to Join ❤️'}</span>
                </div>

                <p className="text-xs text-pink-200/90 mb-3">
                  {hasPartnerJoined
                    ? 'Both participants are ready! Click the button below to begin the birthday celebration!'
                    : 'Share your room invitation link so your partner can join you for the celebration!'}
                </p>

                {/* LARGE, PROMINENT, GLOWING "START MY BDAY" BUTTON */}
                <button
                  onClick={handleStartMyBday}
                  disabled={isStarting}
                  className={`w-full py-4 px-6 rounded-2xl font-extrabold text-lg sm:text-2xl shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 border-2 ${
                    isStarting
                      ? 'bg-amber-600/50 text-white/80 border-amber-400/40 cursor-wait'
                      : 'bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 hover:from-amber-300 hover:via-rose-400 hover:to-pink-400 text-white border-amber-300 shadow-glow hover:scale-[1.03] active:scale-[0.98] cursor-pointer'
                  }`}
                >
                  <span className="text-2xl sm:text-3xl animate-bounce">🎂</span>
                  <span>{isStarting ? 'STARTING CELEBRATION... 🎉' : '🎂 START MY BDAY ❤️'}</span>
                  <Sparkles className="w-6 h-6 text-amber-200 animate-spin" />
                </button>

                {!hasPartnerJoined && (
                  <div className="mt-3">
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                    >
                      {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
                      <span>{linkCopied ? 'Link Copied to Clipboard!' : 'Copy Invitation Link'}</span>
                    </button>
                  </div>
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
        <div className="relative w-full lg:w-5/12 min-h-[460px] sm:min-h-[520px] lg:min-h-[620px] flex flex-col items-center justify-center rounded-3xl bg-black/40 border border-pink-500/20 shadow-2xl p-2 sm:p-3 overflow-hidden">
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

      {/* Synchronized Cake Cutting Modal (Step 8 & 9) */}
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

      {/* Grand Fullscreen Fireworks Celebration & Custom Birthday Message (Step 11 & 12) */}
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
