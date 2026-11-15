import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, Star, RotateCcw, X, Mail, Send, Feather } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundEngine } from '../utils/audio';

export default function RomanticMessageModal({
  isOpen = true,
  onClose = () => {},
  socket,
  roomId,
  cakeConfig = {},
  letterData = {},
  currentUser = {},
  onRelightCandles = () => {},
  isHost = true
}) {
  const [isOpened, setIsOpened] = useState(Boolean(letterData?.revealed));
  const [revealedChars, setRevealedChars] = useState(0);
  const [showWishModal, setShowWishModal] = useState(false);
  const [wishText, setWishText] = useState('');
  const [shootingStars, setShootingStars] = useState([]);

  const recipientName = cakeConfig.name || letterData.recipientName || 'Birthday Star';
  const customMessage = cakeConfig.message || letterData.body || 'Happy Birthday to my favorite person in the world!';
  const senderName = currentUser?.name || letterData.senderName || 'Forever Yours';

  // Listen to remote open events
  useEffect(() => {
    if (letterData?.revealed) {
      setIsOpened(true);
    }
  }, [letterData?.revealed]);

  // Handle open message click
  const handleOpenEnvelope = () => {
    soundEngine.playSparkleChime();
    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#f43f5e', '#fbbf24', '#ffffff', '#fb7185']
    });

    setIsOpened(true);

    if (socket && roomId) {
      socket.emit('open-birthday-message');
      socket.emit('birthday:open-message');
    }
  };

  // Smooth typewriter reveal effect for the personalized message
  useEffect(() => {
    if (!isOpened) return;
    setRevealedChars(0);
    let count = 0;
    const interval = setInterval(() => {
      count += 2;
      setRevealedChars(count);
      if (count >= customMessage.length) {
        clearInterval(interval);
      }
    }, 28);

    return () => clearInterval(interval);
  }, [isOpened, customMessage]);

  // Handle sending a secret wish
  const handleSendWish = (e) => {
    e.preventDefault();
    if (!wishText.trim()) return;

    soundEngine.playSparkleChime();
    if (socket && roomId) {
      socket.emit('send-wish', { wish: wishText.trim(), author: currentUser?.name || 'Someone' });
    }

    const starId = Date.now();
    setShootingStars(prev => [...prev, { id: starId, x: Math.random() * 80 + 10, y: Math.random() * 30 + 10 }]);
    setTimeout(() => {
      setShootingStars(prev => prev.filter(s => s.id !== starId));
    }, 1800);

    setWishText('');
    setShowWishModal(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fadeIn select-none overflow-y-auto">
      {/* Shooting stars animation */}
      {shootingStars.map(star => (
        <div
          key={star.id}
          className="fixed z-50 pointer-events-none w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_14px_#ffffff] animate-shootingStar"
          style={{ top: `${star.y}%`, left: `${star.x}%` }}
        />
      ))}

      {/* Close button */}
      <button
        onClick={onClose}
        title="Return to Celebration Room"
        className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 hover:text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer shadow-lg"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative w-full max-w-xl mx-auto my-auto transition-all duration-500">
        {!isOpened ? (
          /* ========================================================= */
          /* 1. CLOSED ROMANTIC ENVELOPE (With Wax Seal & Big Button)  */
          /* ========================================================= */
          <div
            onClick={handleOpenEnvelope}
            className="group relative cursor-pointer mx-auto max-w-md p-6 sm:p-9 rounded-3xl bg-gradient-to-br from-[#240833] via-[#350d40] to-[#160421] border-2 border-amber-400/40 shadow-2xl hover:border-amber-300/80 transition-all duration-300 text-center overflow-hidden"
          >
            {/* Subtle flap lines */}
            <div className="absolute top-0 left-0 right-0 h-28 border-b border-amber-400/20 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-400/30 text-pink-200 text-[11px] font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>PRIVATE CELEBRATION KEEPSAKE</span>
              </div>

              <span className="text-[11px] uppercase tracking-widest text-amber-300/70 font-semibold">
                Special Message For
              </span>
              <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-amber-100 mt-1">
                {recipientName} ❤️
              </h2>

              {/* Glowing Wax Seal */}
              <div className="mt-6 w-20 h-20 rounded-full bg-gradient-to-br from-rose-600 via-rose-700 to-rose-950 border-2 border-rose-400 shadow-[0_0_25px_rgba(225,29,72,0.6)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-transform duration-200">
                <Heart className="w-9 h-9 text-rose-100 fill-rose-200 drop-shadow" />
              </div>

              <p className="mt-4 text-xs text-pink-200/90 font-medium">
                Tap seal or click below to unseal your midnight message
              </p>

              {/* LARGE GLOWING "OPEN THE MESSAGE" BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEnvelope();
                }}
                className="mt-5 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 hover:from-amber-400 hover:via-rose-400 hover:to-pink-500 text-white font-bold text-base sm:text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 border border-amber-300/60 cursor-pointer"
              >
                <Mail className="w-5 h-5 text-amber-200" />
                <span>OPEN THE MESSAGE ❤️</span>
                <Sparkles className="w-4 h-4 text-amber-200 animate-spin" />
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* 2. OPENED VINTAGE PARCHMENT LETTER (Smooth Line Reveal)    */
          /* ========================================================= */
          <div className="relative mx-auto rounded-3xl bg-[#fefaf0] text-[#2c1409] p-6 sm:p-9 shadow-2xl border-2 border-amber-400/50 font-serif-luxury animate-fadeIn">
            {/* Header / Ribbon */}
            <div className="flex items-center justify-between border-b border-amber-900/15 pb-3 mb-5">
              <div className="flex items-center gap-2 text-rose-800">
                <Feather className="w-4 h-4 text-amber-700" />
                <span className="text-[11px] uppercase tracking-widest font-sans font-bold text-amber-900/80">
                  Midnight Keepsake Letter
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-amber-800/80 font-sans font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>For {recipientName}</span>
              </div>
            </div>

            {/* Letter Title */}
            <h2 className="text-2xl sm:text-3xl font-bold text-amber-950 mb-4 text-center">
              Under the Midnight Stars ✨
            </h2>

            {/* Typewriter Line-by-Line Reveal of Custom Message */}
            <div className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-amber-950 font-serif-luxury px-2 sm:px-4 py-2 bg-amber-50/50 rounded-2xl border border-amber-900/10 min-h-[120px]">
              {customMessage.slice(0, revealedChars)}
              {revealedChars < customMessage.length && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-rose-600 animate-pulse" />
              )}
            </div>

            {/* Signature */}
            <div className="mt-6 text-right pr-4">
              <p className="text-xs uppercase tracking-wider text-amber-900/60 font-sans font-semibold">
                With all my love,
              </p>
              <p className="font-script-romantic text-2xl sm:text-3xl text-rose-800 mt-1">
                {senderName}
              </p>
            </div>

            {/* Action Buttons: Wish, Relight, Close */}
            <div className="mt-8 pt-4 border-t border-amber-900/15 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setShowWishModal(true)}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-sans font-semibold text-xs sm:text-sm shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Star className="w-4 h-4 text-amber-200 fill-amber-200" />
                <span>One More Wish? 🌟</span>
              </button>

              <button
                onClick={onRelightCandles}
                className="px-5 py-2.5 rounded-full bg-amber-900/10 hover:bg-amber-900/20 text-amber-950 font-sans font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-amber-800" />
                <span>Relight Candles 🎂</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-full bg-transparent hover:bg-amber-900/10 text-amber-900/70 font-sans text-xs transition-colors cursor-pointer"
              >
                Back to Celebration
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Make a Wish Modal */}
      {showWishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-[#1d092c] border border-amber-400/40 p-6 shadow-2xl text-center">
            <Star className="w-9 h-9 text-amber-300 mx-auto mb-2 fill-amber-300 animate-bounce" />
            <h3 className="font-serif-luxury text-2xl font-bold text-amber-100">
              Make a Secret Midnight Wish 🌟
            </h3>
            <p className="mt-1 text-xs text-pink-300/80">
              Your wish will fly into the midnight sky as a shooting star.
            </p>

            <form onSubmit={handleSendWish} className="mt-5 space-y-4">
              <textarea
                rows={3}
                required
                value={wishText}
                onChange={e => setWishText(e.target.value)}
                placeholder="What does your heart wish for tonight?"
                className="w-full p-3 bg-black/50 border border-pink-500/30 rounded-2xl text-pink-100 placeholder-pink-400/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWishModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-pink-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to the Stars</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
