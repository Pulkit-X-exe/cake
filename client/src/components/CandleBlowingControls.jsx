import React, { useState, useEffect, useRef } from 'react';
import { Wind, Sliders, Mic, Sparkles, Heart } from 'lucide-react';
import { BlowDetector } from '../utils/blowDetector';
import { soundEngine } from '../utils/audio';

export default function CandleBlowingControls({
  socket,
  roomId,
  candlesLit = true,
  isBirthdayStar = true,
  onExtinguishCandles = () => {},
  onBlowIntensity = () => {}
}) {
  const [blowProgress, setBlowProgress] = useState(0); // 0 to 100
  const [isBlowing, setIsBlowing] = useState(false);
  const [sensitivity, setSensitivity] = useState(1.2);
  const [showSettings, setShowSettings] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const detectorRef = useRef(null);

  useEffect(() => {
    if (!candlesLit || !isBirthdayStar) {
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current = null;
        setMicActive(false);
      }
      return;
    }

    // Initialize BlowDetector ONLY for Birthday Star
    const detector = new BlowDetector({
      sensitivity,
      onBlow: (intensity, progress) => {
        setBlowProgress(progress);
        setIsBlowing(intensity > 0.15);
        onBlowIntensity(intensity, progress);

        if (intensity > 0.3) {
          soundEngine.playBlowingSound(0.3);
        }

        // Sync intensity over socket so partner sees candle flames waver!
        if (socket && roomId) {
          socket.emit('candle-blow-intensity', { intensity, progress });
        }
      },
      onExtinguish: () => {
        soundEngine.playExtinguishSound();
        setBlowProgress(100);
        setIsBlowing(false);
        onExtinguishCandles();

        if (socket && roomId) {
          socket.emit('extinguish-candles', { blownBy: 'Birthday Star' });
        }
      }
    });

    detectorRef.current = detector;
    detector.start().then(success => {
      setMicActive(success);
    });

    return () => {
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current = null;
      }
    };
  }, [candlesLit, sensitivity, isBirthdayStar]);

  // Manual fallback button
  const handleManualBlow = () => {
    soundEngine.playExtinguishSound();
    setBlowProgress(100);
    onExtinguishCandles();

    if (socket && roomId) {
      socket.emit('extinguish-candles', { blownBy: isBirthdayStar ? 'Birthday Star' : 'Partner' });
    }
  };

  if (!candlesLit) return null;

  return (
    <div className="relative z-30 max-w-md mx-auto w-full px-4 py-3 sm:py-4 rounded-3xl bg-[#1c0828]/95 border-2 border-amber-400/40 shadow-2xl backdrop-blur-2xl text-center select-none animate-fadeIn">
      {/* Make a Wish Title */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
        <h3 className="font-serif-luxury text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-amber-300">
          MAKE A WISH ❤️
        </h3>
        <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
      </div>

      <p className="text-xs sm:text-sm text-pink-200/90 font-medium">
        {isBirthdayStar
          ? 'Close your eyes, make a wish and blow your candles! ❤️'
          : 'Cheer on the Birthday Star as they make a wish and blow out the candles!'}
      </p>

      {/* Real-time Blow Progress Bar */}
      <div className="mt-3 relative w-full h-3 rounded-full bg-black/60 border border-pink-500/30 overflow-hidden shadow-inner">
        <div
          className={`h-full transition-all duration-150 rounded-full ${
            isBlowing
              ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 shadow-glow'
              : 'bg-pink-600/60'
          }`}
          style={{ width: `${blowProgress}%` }}
        />
      </div>

      {isBirthdayStar ? (
        <>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-pink-300/80 font-medium">
            <span className="flex items-center gap-1">
              <Mic className={`w-3 h-3 ${micActive ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
              <span>{micActive ? 'Mic Blow Active' : 'Mic Off'}</span>
            </span>

            <span>{isBlowing ? '💨 Blowing detected!' : 'Waiting for your breath...'}</span>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
              <span>Sensitivity</span>
            </button>
          </div>

          {/* Sensitivity Slider Drawer */}
          {showSettings && (
            <div className="mt-2 p-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-left text-xs animate-fadeIn">
              <div className="flex justify-between text-[11px] text-pink-200 mb-1">
                <span>Microphone Blow Sensitivity</span>
                <span className="font-mono text-amber-300 font-bold">{sensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={sensitivity}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setSensitivity(val);
                  if (detectorRef.current) {
                    detectorRef.current.setSensitivity(val);
                  }
                }}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-pink-300/50 mt-0.5">
                <span>Gentle Breath</span>
                <span>Normal</span>
                <span>Strong Wind</span>
              </div>
            </div>
          )}

          {/* Manual Backup Blow Button */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={handleManualBlow}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 hover:from-amber-400 hover:via-rose-400 hover:to-pink-500 text-white font-bold text-xs sm:text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-amber-300/50 cursor-pointer"
            >
              <Wind className="w-4 h-4 text-amber-200" />
              <span>BLOW CANDLES 🕯️</span>
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 py-2 px-3 rounded-xl bg-white/5 border border-pink-500/20 text-xs text-pink-200/80 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
          <span>The Birthday Star is preparing to blow out the candles!</span>
        </div>
      )}
    </div>
  );
}
