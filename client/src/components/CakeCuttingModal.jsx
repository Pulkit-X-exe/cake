import React, { useState, useEffect } from 'react';
import { Cake, Sparkles, Heart, ChevronRight, UtensilsCrossed } from 'lucide-react';
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
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    setLocalProgress(cuttingProgress);
  }, [cuttingProgress]);

  // Synchronized cut action
  const handleCutStep = () => {
    if (isCutComplete) return;

    soundEngine.playKnifeCutSound();
    const newProgress = Math.min(100, localProgress + 25);
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
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f43f5e', '#fbbf24', '#f472b6', '#ffffff']
    });
  }

  return (
    <div className="fixed inset-x-4 bottom-6 sm:bottom-10 max-w-lg mx-auto z-40 bg-[#1f0a2d]/90 border border-amber-400/40 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-2xl text-center">
      {!isCutComplete ? (
        <>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold mb-3">
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
            <span>CAKE CUTTING CEREMONY</span>
          </div>

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-amber-300">
            Now Let's Cut Our Cake Together! 🎂
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-pink-200/80">
            Both of you can tap together to slice through the cake and share the first bite!
          </p>

          {/* Slicing Progress Bar */}
          <div className="mt-4 relative w-full h-3.5 rounded-full bg-black/60 border border-pink-500/30 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 rounded-full transition-all duration-300 shadow-glow"
              style={{ width: `${localProgress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-pink-300/60 font-medium">
            <span>First Touch</span>
            <span>{Math.round(localProgress)}% Sliced</span>
            <span>Slice Shared ❤️</span>
          </div>

          {/* Interactive Cut Button */}
          <div className="mt-5">
            <button
              onClick={handleCutStep}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-400 hover:via-pink-500 hover:to-amber-400 text-white font-bold text-base sm:text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-amber-300/50"
            >
              <UtensilsCrossed className="w-5 h-5 text-amber-200" />
              <span>CUT THE CAKE 🔪🍰</span>
              <Sparkles className="w-4 h-4 text-amber-200 animate-spin" />
            </button>
          </div>
        </>
      ) : (
        /* Cake is Cut Complete! */
        <div className="space-y-4 animate-fadeIn">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-3xl shadow-glow">
            🍰
          </div>

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-amber-200">
            A Slice of Love for You ❤️
          </h2>

          <p className="font-serif-luxury italic text-sm sm:text-base text-pink-200">
            “A slice of love for you, a slice of joy for me. Every sweet moment is warmer because we celebrate together.”
          </p>

          <button
            onClick={onProceedToLetter}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 hover:from-amber-400 hover:via-rose-400 hover:to-pink-500 text-white font-bold text-base shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-amber-300/50"
          >
            <span>Read Romantic Letter 💌</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

