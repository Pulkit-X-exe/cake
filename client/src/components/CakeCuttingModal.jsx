import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Sparkles, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundEngine } from '../utils/audio';

export default function CakeCuttingModal({
  socket,
  roomId,
  cuttingProgress = 0,
  isCutComplete = false,
  onProceedToLetter = () => {},
  isHost = true
}) {
  const [localProgress, setLocalProgress] = useState(cuttingProgress);

  useEffect(() => {
    setLocalProgress(cuttingProgress);
  }, [cuttingProgress]);

  // Synchronized cut action
  const handleCutStep = () => {
    if (isCutComplete) return;

    soundEngine.playKnifeCutSound();
    const newProgress = Math.min(100, localProgress + 34);
    setLocalProgress(newProgress);

    if (socket) {
      socket.emit('cut-cake-progress', { progress: newProgress });
      if (newProgress >= 100) {
        socket.emit('complete-cake-cut');
        triggerSliceConfetti();
      }
    }
  };

  function triggerSliceConfetti() {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#f43f5e', '#fbbf24', '#f472b6', '#ffffff', '#fb7185']
    });
  }

  return (
    <div className="fixed inset-x-4 bottom-6 sm:bottom-10 max-w-lg mx-auto z-40 bg-[#1f0a2d]/95 border-2 border-amber-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-2xl text-center select-none animate-fadeIn">
      {!isCutComplete ? (
        <>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold mb-2">
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>CAKE CUTTING CEREMONY</span>
          </div>

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-amber-300 tracking-wide uppercase">
            NOW CUT YOUR BIRTHDAY CAKE! 🎂
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-pink-200/90 font-medium">
            {isHost
              ? "Swipe or press the knife to slice through the cake and separate the first sweet slice! 🍰"
              : "Watch closely! The birthday star is cutting the cake right now... ❤️"}
          </p>

          {/* Slicing Progress Bar */}
          <div className="mt-4 relative w-full h-4 rounded-full bg-black/60 border border-pink-500/40 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 rounded-full transition-all duration-300 shadow-glow"
              style={{ width: `${localProgress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-pink-300/80 font-medium">
            <span>Knife Positioned</span>
            <span>{Math.round(localProgress)}% Cut</span>
            <span>Two Slices Ready ❤️</span>
          </div>

          {/* Interactive Cut Button */}
          <div className="mt-4">
            {isHost ? (
              <button
                onClick={handleCutStep}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-400 hover:via-pink-500 hover:to-amber-400 text-white font-bold text-base sm:text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-amber-300/50 cursor-pointer"
              >
                <UtensilsCrossed className="w-5 h-5 text-amber-200" />
                <span>SLICE WITH KNIFE 🔪</span>
                <Sparkles className="w-4 h-4 text-amber-200 animate-spin" />
              </button>
            ) : (
              <div className="py-3 px-4 rounded-2xl bg-white/5 border border-pink-500/20 text-pink-200/80 text-xs sm:text-sm flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Waiting for Birthday Star to slice the cake...</span>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Cake is Cut Complete! Cake Splits into Two Visible Slices */
        <div className="space-y-3 animate-fadeIn">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-3xl shadow-glow">
            🍰
          </div>

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-amber-200">
            The Cake Has Been Cut! 🎉
          </h2>

          <p className="font-serif-luxury italic text-sm sm:text-base text-pink-200">
            “A slice of love for you, a slice of joy for me. Every sweet moment is warmer because we celebrate together.”
          </p>

          <p className="text-xs text-amber-300/80">
            Separating the slices... Preparing the grand celebration! ✨
          </p>
        </div>
      )}
    </div>
  );
}
