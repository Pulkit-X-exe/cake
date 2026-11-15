import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Crown,
  Heart,
  Copy,
  Check,
  Mic,
  ArrowRight,
  Palette,
  Sliders,
  Users,
  KeyRound
} from 'lucide-react';
import { BlowDetector } from '../utils/blowDetector';

const CAKE_THEMES = [
  { id: 'romantic-rose', name: 'Velvet Rose', color: '#f43f5e', accent: '#fbbf24' },
  { id: 'midnight-gold', name: 'Midnight Violet & Gold', color: '#6b21a8', accent: '#f59e0b' },
  { id: 'chocolate-velvet', name: 'Rich Chocolate Truffle', color: '#451a03', accent: '#f59e0b' },
  { id: 'lavender-dream', name: 'Lavender & Cream', color: '#c084fc', accent: '#fef08a' }
];

export default function RoomModal({
  isOpen = true,
  onJoinRoom = () => {},
  initialRoomId = ''
}) {
  const [mode, setMode] = useState(initialRoomId ? 'join' : 'create'); // 'create' | 'join'
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState('star'); // 'star' | 'partner'
  const [copied, setCopied] = useState(false);

  // Cake Customization State
  const [cakeName, setCakeName] = useState('My Love');
  const [cakeMessage, setCakeMessage] = useState('Happy Birthday!');
  const [selectedTheme, setSelectedTheme] = useState('romantic-rose');
  const [candleCount, setCandleCount] = useState(5);

  // Mic test
  const [micTested, setMicTested] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isBlowingTest, setIsBlowingTest] = useState(false);
  const [blowDetectorInstance, setBlowDetectorInstance] = useState(null);

  // Generate unique room ID on mount if empty
  useEffect(() => {
    if (!roomId) {
      const generated = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(generated);
    }
  }, []);

  // Update room ID if initialRoomId changes (e.g. from URL query param)
  useEffect(() => {
    if (initialRoomId) {
      setRoomId(initialRoomId.toUpperCase());
      setMode('join');
      setRole('partner'); // Often the invitee is the partner celebrating
    }
  }, [initialRoomId]);

  // Handle Microphone Test
  const handleStartMicTest = async () => {
    if (blowDetectorInstance) {
      blowDetectorInstance.stop();
      setBlowDetectorInstance(null);
      setMicTested(false);
      setMicLevel(0);
      return;
    }

    const detector = new BlowDetector({
      sensitivity: 1.2,
      onMeter: ({ rms, blowIntensity, isBlowing }) => {
        setMicLevel(Math.min(100, Math.round(rms * 100)));
        setIsBlowingTest(isBlowing);
      }
    });

    const success = await detector.start();
    if (success) {
      setBlowDetectorInstance(detector);
      setMicTested(true);
    }
  };

  useEffect(() => {
    return () => {
      if (blowDetectorInstance) {
        blowDetectorInstance.stop();
      }
    };
  }, [blowDetectorInstance]);

  // Copy shareable invite link
  const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (blowDetectorInstance) {
      blowDetectorInstance.stop();
    }

    const themeObj = CAKE_THEMES.find(t => t.id === selectedTheme) || CAKE_THEMES[0];

    onJoinRoom({
      roomId: roomId.trim().toUpperCase(),
      userName: userName.trim() || (role === 'star' ? 'Birthday Star' : 'Partner'),
      role,
      cakeConfig: {
        name: cakeName.trim() || 'My Love',
        message: cakeMessage.trim() || 'Happy Birthday!',
        theme: selectedTheme,
        cakeColor: themeObj.color,
        accentColor: themeObj.accent,
        candleCount: Number(candleCount) || 5
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-gradient-to-b from-[#1e072b] via-[#290a3a] to-[#140320] border border-amber-400/40 p-5 sm:p-8 shadow-2xl text-pink-100">
        
        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>CONNECT TWO HEARTS</span>
          </div>
          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-amber-200">
            {mode === 'create' ? 'Set Up Your Birthday Room' : 'Join Birthday Celebration'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-pink-300/80">
            Invite your favorite person to join you live from anywhere in the world.
          </p>
        </div>

        {/* Tab Switcher: Create vs Join */}
        <div className="flex rounded-2xl bg-black/40 p-1 border border-pink-500/20 mb-6">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              mode === 'create'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md'
                : 'text-pink-300 hover:text-white'
            }`}
          >
            Create New Room
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              mode === 'join'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md'
                : 'text-pink-300 hover:text-white'
            }`}
          >
            Join Existing Room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Room ID & Shareable Invitation Link */}
          <div className="p-3 sm:p-4 rounded-2xl bg-black/40 border border-amber-400/30">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Room Code</span>
              </label>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-medium border border-pink-500/30 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                required
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                placeholder="ROOM123"
                className="w-full px-3 py-2 bg-black/60 border border-pink-500/30 rounded-xl text-center font-mono font-bold text-amber-200 tracking-widest text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-pink-300/60 truncate">
              Share link: <span className="text-pink-200">{inviteLink}</span>
            </p>
          </div>

          {/* User Name & Role Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-pink-200 mb-1">Your Name</label>
              <input
                type="text"
                required
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full px-3 py-2 bg-black/40 border border-pink-500/30 rounded-xl text-pink-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-pink-200 mb-1">Your Role Tonight</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('star')}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    role === 'star'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-glow'
                      : 'bg-black/30 border-white/10 text-pink-300/70 hover:text-white'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Birthday Star</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('partner')}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    role === 'partner'
                      ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-glow'
                      : 'bg-black/30 border-white/10 text-pink-300/70 hover:text-white'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>Celebrating</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cake Customization (only in create mode or editable) */}
          {mode === 'create' && (
            <div className="p-3 sm:p-4 rounded-2xl bg-black/30 border border-pink-500/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Palette className="w-3.5 h-3.5" />
                <span>Custom Cake Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-pink-300/80 mb-1">Birthday Person's Name</label>
                  <input
                    type="text"
                    value={cakeName}
                    onChange={e => setCakeName(e.target.value)}
                    placeholder="My Love"
                    className="w-full px-3 py-1.5 bg-black/50 border border-pink-500/30 rounded-xl text-pink-100 text-xs focus:outline-none focus:ring-1 focus:ring-pink-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-pink-300/80 mb-1">Number of Candles ({candleCount})</label>
                  <input
                    type="range"
                    min="1"
                    max="18"
                    value={candleCount}
                    onChange={e => setCandleCount(e.target.value)}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>

              {/* Theme color selectors */}
              <div>
                <label className="block text-[11px] text-pink-300/80 mb-1.5">Cake Frosting Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CAKE_THEMES.map(th => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setSelectedTheme(th.id)}
                      className={`p-2 rounded-xl text-[11px] font-medium border text-left transition-all flex items-center gap-2 ${
                        selectedTheme === th.id
                          ? 'border-amber-400 bg-white/10 text-white shadow-glow'
                          : 'border-white/10 bg-black/20 text-pink-300/60 hover:text-white'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: th.color }} />
                      <span className="truncate">{th.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Microphone Test Section */}
          <div className="p-3 rounded-2xl bg-black/30 border border-pink-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-pink-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-pink-400" />
                <span>Microphone & Candle Blow Test</span>
              </span>

              <button
                type="button"
                onClick={handleStartMicTest}
                className="text-xs px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/30 transition-colors"
              >
                {micTested ? 'Stop Test' : 'Test Mic & Blow'}
              </button>
            </div>

            {micTested ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-pink-300/80">Breath / Blow Energy:</span>
                  <span className={isBlowingTest ? 'text-amber-300 font-bold' : 'text-pink-300'}>
                    {isBlowingTest ? '💨 BLOW DETECTED!' : 'Speak or blow into mic'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      isBlowingTest ? 'bg-amber-400 shadow-glow' : 'bg-pink-500'
                    }`}
                    style={{ width: `${Math.min(100, micLevel)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-pink-300/60">
                Test your mic so candle blowing works smoothly on your actual breath.
              </p>
            )}
          </div>

          {/* Enter Room Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-400 hover:via-pink-500 hover:to-amber-400 text-white font-bold text-base shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-amber-300/50"
          >
            <span>{mode === 'create' ? 'Start Celebration Room 🎂' : 'Join Celebration 💖'}</span>
            <ArrowRight className="w-5 h-5 text-amber-200" />
          </button>
        </form>
      </div>
    </div>
  );
}

