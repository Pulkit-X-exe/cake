import React, { useState, useEffect, useRef } from 'react';
import { UtensilsCrossed, Sparkles } from 'lucide-react';
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(0);
  const trackRef = useRef(null);

  useEffect(() => {
    setLocalProgress(cuttingProgress);
  }, [cuttingProgress]);

  // Synchronized cut action
  const updateCutProgress = (newProgress) => {
    if (isCutComplete) return;

    const clamped = Math.max(0, Math.min(100, newProgress));
    setLocalProgress(clamped);

    soundEngine.playKnifeCutSound();

    if (socket) {
      socket.emit('cut-cake-progress', { progress: clamped });
      if (clamped >= 100) {
        socket.emit('complete-cake-cut');
        socket.emit('birthday:cake-cut');
        triggerSliceConfetti();
      }
    }
  };

  const handleSliceClick = () => {
    updateCutProgress(localProgress + 35);
  };

  // Dragging support (mouse & touch)
  const handlePointerDown = (e) => {
    if (isCutComplete || !isHost) return;
    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    dragStartRef.current = clientX;
  };

  const handlePointerMove = (e) => {
    if (!isDragging || isCutComplete || !isHost) return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      if (pct > localProgress) {
        updateCutProgress(pct);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
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
    <div
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      className="fixed inset-x-4 bottom-6 sm:bottom-10 max-w-lg mx-auto z-40 bg-[#1f0a2d]/95 border-2 border-amber-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-2xl text-center select-none animate-fadeIn"
    >
      {!isCutComplete ? (
        <>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold mb-2">
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>CAKE CUTTING CEREMONY</span>
          </div>

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-amber-300 tracking-wide uppercase">
            Now it's time to cut your birthday cake! 🎂
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-pink-200/90 font-medium">
            {isHost
              ? "Drag the virtual knife or tap the slice button to cut through the cake and separate two slices! 🍰"
              : "Watch closely! The birthday star is slicing through the cake right now... ❤️"}
          </p>

          {/* Interactive Slicing Track / Knife Slider */}
          <div
            ref={trackRef}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className={`mt-4 relative w-full h-8 rounded-full bg-black/60 border border-pink-500/40 overflow-hidden shadow-inner flex items-center px-1 ${
              isHost ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
          >
            {/* Progress Fill */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 rounded-full transition-all duration-150 shadow-glow"
              style={{ width: `${localProgress}%` }}
            />

            {/* Draggable Knife Icon Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-transform duration-100 flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 border border-amber-200 shadow-xl text-black font-bold text-sm"
              style={{ left: `calc(${Math.min(92, Math.max(4, localProgress))}% - 16px)` }}
            >
              🔪
            </div>

            <span className="relative z-10 w-full text-center text-[11px] font-bold text-white/80 pointer-events-none">
              {isHost ? '← Drag Knife Across Cake →' : 'Live Cutting Progress'}
            </span>
          </div>

          <div className="mt-1 flex justify-between text-[11px] text-pink-300/80 font-medium px-1">
            <span>First Touch</span>
            <span className="font-mono text-amber-300 font-bold">{Math.round(localProgress)}% Sliced</span>
            <span>Two Slices Ready ❤️</span>
          </div>

          {/* Interactive Cut Button */}
          <div className="mt-4">
            {isHost ? (
              <button
                onClick={handleSliceClick}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-400 hover:via-pink-500 hover:to-amber-400 text-white font-bold text-base sm:text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-amber-300/50 cursor-pointer"
              >
                <UtensilsCrossed className="w-5 h-5 text-amber-200" />
                <span>SLICE THE CAKE 🔪🍰</span>
                <Sparkles className="w-4 h-4 text-amber-200 animate-spin" />
              </button>
            ) : (
              <div className="py-3 px-4 rounded-2xl bg-white/5 border border-pink-500/20 text-pink-200/80 text-xs sm:text-sm flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Waiting for Birthday Star to cut the cake...</span>
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
            The Cake Has Been Cut into Two Slices! 🎉
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
