import React, { useEffect, useRef } from 'react';
import { Sparkles, Heart, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { soundEngine } from '../utils/audio';

export default function WelcomeScreen({
  onEnter = () => {},
  isMusicMuted = false,
  onToggleMusic = () => {}
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Starfield and floating heart particles
    const stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        twinkleSpeed: 0.01 + Math.random() * 0.03,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.3 ? '#ffffff' : '#fef08a'
      });
    }

    const hearts = [];
    for (let i = 0; i < 24; i++) {
      hearts.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 200,
        size: 8 + Math.random() * 14,
        speedY: 0.4 + Math.random() * 0.8,
        swaySpeed: 0.02 + Math.random() * 0.02,
        swayPhase: Math.random() * Math.PI * 2,
        swayDist: 20 + Math.random() * 30,
        opacity: 0.2 + Math.random() * 0.5,
        color: Math.random() > 0.5 ? '#f43f5e' : '#ec4899'
      });
    }

    function render() {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Stars
      stars.forEach(star => {
        star.twinklePhase += star.twinkleSpeed;
        const alpha = 0.3 + Math.sin(star.twinklePhase) * 0.6;
        ctx.fillStyle = star.color;
        ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Floating Hearts
      hearts.forEach(h => {
        h.y -= h.speedY;
        h.swayPhase += h.swaySpeed;
        const currentX = h.x + Math.sin(h.swayPhase) * h.swayDist;

        if (h.y < -50) {
          h.y = canvas.height + 40;
          h.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.globalAlpha = h.opacity;
        ctx.fillStyle = h.color;
        drawHeart(ctx, currentX, h.y, h.size);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  function drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 2, x, y + size);
    ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 2, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
    ctx.closePath();
    ctx.fill();
  }

  const handleEnterClick = () => {
    soundEngine.ensureContext();
    soundEngine.playSparkleChime();
    soundEngine.startMusic('romantic');
    onEnter();
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 sm:p-12 overflow-hidden bg-midnight-gradient select-none">
      {/* Background Starfield and Floating Hearts Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Top Navbar: Brand & Romantic Music Toggle */}
      <div className="relative z-10 w-full max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎂</span>
          <span className="font-cinzel-royal text-sm sm:text-base tracking-widest text-amber-200/90 uppercase font-semibold">
            Our Midnight Celebration
          </span>
        </div>

        <button
          onClick={onToggleMusic}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 text-xs font-medium backdrop-blur-md transition-all border border-pink-500/20 shadow-md"
        >
          {isMusicMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-rose-400" />
              <span>Music Off</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Romantic Music</span>
            </>
          )}
        </button>
      </div>

      {/* Main Cinematic Hero Content */}
      <div className="relative z-10 max-w-2xl text-center my-auto px-4 py-8">
        {/* Glowing Romantic Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-amber-500/20 border border-pink-400/30 text-pink-200 text-xs sm:text-sm font-medium backdrop-blur-xl mb-6 shadow-glow">
          <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
          <span>A Virtual Birthday Party for Two</span>
          <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
        </div>

        {/* Cinematic Quotes */}
        <p className="font-serif-luxury italic text-xl sm:text-2xl md:text-3xl text-pink-200/90 font-normal tracking-wide">
          “Tonight is not just another night...”
        </p>

        <h1 className="mt-3 font-serif-luxury text-4xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-300 to-amber-300 drop-shadow-xl tracking-tight leading-tight">
          Tonight, we celebrate YOU ❤️
        </h1>

        <p className="mt-6 text-sm sm:text-base text-pink-200/80 max-w-lg mx-auto font-light leading-relaxed">
          Step into our candlelit midnight sanctuary. Turn on your cameras, hear each other’s voices, blow out glowing 3D candles together, and share a sweet slice of happiness.
        </p>

        {/* The Big ENTER CELEBRATION Button */}
        <div className="mt-10">
          <button
            onClick={handleEnterClick}
            className="group relative inline-flex items-center gap-3 px-10 py-4 sm:px-12 sm:py-5 rounded-full bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-400 hover:via-pink-500 hover:to-amber-400 text-white font-cinzel-royal font-bold text-base sm:text-lg tracking-widest uppercase shadow-[0_0_35px_rgba(244,63,94,0.5)] hover:shadow-[0_0_50px_rgba(251,191,36,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 border border-amber-300/60"
          >
            <span>ENTER CELEBRATION</span>
            <ArrowRight className="w-5 h-5 text-amber-200 group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 text-center text-xs text-pink-300/50">
        WebRTC P2P Video • Real Microphone Breath Sensing • 3D Candlelit Atmosphere
      </div>
    </div>
  );
}

