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
  Video,
  Cake,
  Palette
} from 'lucide-react';

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
  const [celebrationStage, setCelebrationStage] = useState('cake'); // 'cake' | 'fireworks' | 'cutting' | 'letter'

  // Socket & Room State
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);

  // Music State
  const [isMusicMuted, setIsMusicMuted] = useState(false);

  // Cake & Celebration State
  const [cakeConfig, setCakeConfig] = useState({
    name: 'My Love',
    message: 'Happy Birthday!',
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
  const [mobileTab, setMobileTab] = useState('both'); // 'both' | 'cake' | 'video'

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

    s.on('room-joined', ({ roomId: id, roomState, peers }) => {
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

    // Cake config sync
    s.on('cake-config-updated', (newConfig) => {
      setCakeConfig(prev => ({ ...prev, ...newConfig }));
    });

    // Candle blowing sync
    s.on('candle-blow-intensity', ({ intensity, progress }) => {
      setBlowIntensity(intensity);
      setCakeConfig(prev => ({ ...prev, candleBlowProgress: progress }));
    });

    s.on('candles-extinguished', ({ roomState }) => {
      soundEngine.playExtinguishSound();
      soundEngine.setMusicMode('celebration');
      setCakeConfig(prev => ({ ...prev, candlesLit: false, candleBlowProgress: 100 }));
      setCelebrationStage('fireworks');
      setIsFireworksActive(true);
    });

    s.on('candles-relit', ({ roomState }) => {
      soundEngine.setMusicMode('romantic');
      setCakeConfig(prev => ({ ...prev, candlesLit: true, candleBlowProgress: 0 }));
      setCelebrationStage('cake');
      setIsFireworksActive(false);
      setIsCutComplete(false);
      setCuttingProgress(0);
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

    s.on('cake-cut-completed', () => {
      setIsCutComplete(true);
      setCuttingProgress(100);
      soundEngine.playKnifeCutSound();
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

  // Transition from Fireworks to Cake Cutting
  const handleProceedToCutting = () => {
    setIsFireworksActive(false);
    setCelebrationStage('cutting');
    if (socket && roomId) {
      socket.emit('set-stage', { stage: 'cutting' });
    }
  };

  // Transition from Cake Cutting to Romantic Letter
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
  const partnerUser = participants.find(p => p.id !== socket?.id);

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-mono font-medium border border-pink-500/30 transition-all shadow-sm"
          >
            {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
            <span className="tracking-wider">{roomId}</span>
          </button>

          {/* Connected Participants Count Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs text-pink-200/90 backdrop-blur-md">
            <Users className="w-3.5 h-3.5 text-pink-400" />
            <span>{participants.length} Connected {participants.length >= 2 ? '❤️' : ''}</span>
          </div>

          {/* Hat Style Selector for Birthday Star */}
          {isBirthdayStar && (
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[11px] text-amber-300/80 font-medium">Hat Style:</span>
              <select
                value={hatStyle}
                onChange={e => setHatStyle(e.target.value)}
                className="bg-black/60 border border-amber-400/40 text-amber-200 text-xs rounded-lg px-2 py-1 focus:outline-none"
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
            title="Toggle Romantic Music"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 backdrop-blur-md transition-colors border border-white/10"
          >
            {isMusicMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
          </button>
        </div>
      </header>

      {/* Stage Progression Breadcrumb Bar */}
      <div className="relative z-20 w-full px-4 py-2 flex items-center justify-center gap-2 sm:gap-6 bg-black/20 border-b border-pink-500/10 text-[11px] sm:text-xs">
        <button
          onClick={() => setCelebrationStage('cake')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'cake'
              ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-400/50 shadow-glow'
              : 'text-pink-300/60 hover:text-white'
          }`}
        >
          <Cake className="w-3.5 h-3.5" />
          <span>1. Blow Candles</span>
        </button>

        <span className="text-pink-500/30">→</span>

        <button
          onClick={() => {
            setCelebrationStage('fireworks');
            setIsFireworksActive(true);
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'fireworks' || isFireworksActive
              ? 'bg-rose-500/20 text-rose-200 font-semibold border border-rose-400/50 shadow-glow'
              : 'text-pink-300/60 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>2. Fireworks</span>
        </button>

        <span className="text-pink-500/30">→</span>

        <button
          onClick={() => setCelebrationStage('cutting')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'cutting'
              ? 'bg-pink-500/20 text-pink-200 font-semibold border border-pink-400/50 shadow-glow'
              : 'text-pink-300/60 hover:text-white'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>3. Cut Cake</span>
        </button>

        <span className="text-pink-500/30">→</span>

        <button
          onClick={() => setCelebrationStage('letter')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
            celebrationStage === 'letter'
              ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-400/50 shadow-glow'
              : 'text-pink-300/60 hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>4. Romantic Letter</span>
        </button>
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

          {/* Candle Blowing Controls Console (Below the cake) */}
          <div className="w-full mt-2">
            <CandleBlowingControls
              socket={socket}
              roomId={roomId}
              candlesLit={cakeConfig.candlesLit}
              isBirthdayStar={isBirthdayStar}
              onExtinguishCandles={() => {
                setCakeConfig(prev => ({ ...prev, candlesLit: false, candleBlowProgress: 100 }));
                setCelebrationStage('fireworks');
                setIsFireworksActive(true);
              }}
              onBlowIntensity={(intensity, progress) => {
                setBlowIntensity(intensity);
                setCakeConfig(prev => ({ ...prev, candleBlowProgress: progress }));
              }}
            />
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

      {/* Grand Fullscreen Fireworks Celebration Overlay */}
      {isFireworksActive && (
        <FireworksCelebration
          isActive={isFireworksActive}
          partnerName={cakeConfig.name}
          onProceedToCutting={handleProceedToCutting}
        />
      )}

      {/* Synchronized Cake Cutting Modal */}
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

      {/* Romantic Surprise Ending & Love Letter Overlay */}
      {celebrationStage === 'letter' && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-2xl overflow-y-auto">
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setCelebrationStage('cake')}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-1.5"
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
