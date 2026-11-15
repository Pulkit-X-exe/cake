import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Heart, Cake } from 'lucide-react';
import { soundEngine } from '../utils/audio';

export default function FireworksCelebration({
  isActive = true,
  onProceedToCutting = () => {},
  partnerName = 'My Love'
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    // Switch music to upbeat celebration mode
    soundEngine.setMusicMode('celebration');

    // Trigger canvas confetti bursts
    triggerConfettiExtravaganza();

    // Start full-screen fireworks simulation
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId = null;
    let isCancelled = false;

    // Resize canvas to full window
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Particle & Rocket Pool
    const rockets = [];
    const particles = [];
    const colors = [
      '#f59e0b', // Gold
      '#fef08a', // Light gold
      '#ec4899', // Bright pink
      '#f43f5e', // Rose
      '#c084fc', // Purple
      '#38bdf8', // Cyan
      '#fbbf24', // Amber
      '#ffffff'  // Sparkling diamond
    ];

    function launchRocket() {
      if (isCancelled) return;
      const startX = canvas.width * 0.15 + Math.random() * (canvas.width * 0.7);
      const targetY = canvas.height * 0.12 + Math.random() * (canvas.height * 0.4);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const isHeart = Math.random() > 0.6; // 40% chance of heart burst!

      rockets.push({
        x: startX,
        y: canvas.height,
        targetY,
        vx: (Math.random() - 0.5) * 2,
        vy: -(11 + Math.random() * 4),
        color,
        isHeart,
        trail: []
      });

      soundEngine.playFireworkSound();
    }

    // Launch initial salvo
    launchRocket();
    setTimeout(launchRocket, 300);
    setTimeout(launchRocket, 700);

    // Recurring rocket launches
    const rocketInterval = setInterval(() => {
      if (isActive && !isCancelled) {
        launchRocket();
        if (Math.random() > 0.4) {
          setTimeout(launchRocket, 250);
        }
      }
    }, 1100);

    // Animation Loop
    function loop() {
      // Trail fade effect
      ctx.fillStyle = 'rgba(11, 3, 20, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Update Rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.08; // Gravity

        // Draw rocket head & trail
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Explode when reaching apex or target
        if (r.y <= r.targetY || r.vy >= 0) {
          explodeRocket(r);
          rockets.splice(i, 1);
        }
      }

      // 2. Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // Gravity
        p.vx *= 0.98; // Drag
        p.vy *= 0.98;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        if (p.shape === 'star') {
          drawSparkle(ctx, p.x, p.y, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    }

    function explodeRocket(r) {
      const count = r.isHeart ? 65 : 85;
      for (let i = 0; i < count; i++) {
        let vx, vy;
        if (r.isHeart) {
          // Parametric Heart Formula
          const t = (i / count) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          const speed = 0.22 + Math.random() * 0.08;
          vx = hx * speed;
          vy = hy * speed;
        } else {
          // Spherical shell
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 6;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
        }

        particles.push({
          x: r.x,
          y: r.y,
          vx,
          vy,
          color: r.color,
          alpha: 1.0,
          decay: 0.012 + Math.random() * 0.018,
          size: 1.8 + Math.random() * 2.2,
          shape: Math.random() > 0.5 ? 'star' : 'circle'
        });
      }
    }

    function drawSparkle(ctx, x, y, size) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(
          x + Math.cos((i * Math.PI) / 2) * size,
          y + Math.sin((i * Math.PI) / 2) * size
        );
        ctx.lineTo(
          x + Math.cos((i * Math.PI) / 2 + Math.PI / 4) * (size * 0.3),
          y + Math.sin((i * Math.PI) / 2 + Math.PI / 4) * (size * 0.3)
        );
      }
      ctx.closePath();
      ctx.fill();
    }

    animId = requestAnimationFrame(loop);

    return () => {
      isCancelled = true;
      clearInterval(rocketInterval);
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isActive]);

  function triggerConfettiExtravaganza() {
    const end = Date.now() + 6 * 1000;
    const colors = ['#f59e0b', '#ec4899', '#f43f5e', '#fef08a', '#c084fc'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-between p-4 sm:p-8">
      {/* Background Fireworks Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Floating Sparkles & Hearts in Header */}
      <div className="relative z-10 mt-6 sm:mt-10 text-center animate-float">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-300 text-xs sm:text-sm font-semibold backdrop-blur-md shadow-glow-pink">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>WISH GRANTED ✨</span>
          <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-bounce" />
        </div>
      </div>

      {/* Grand Romantic Celebration Typography */}
      <div className="relative z-10 text-center max-w-3xl px-4 py-6 rounded-3xl bg-black/60 border border-amber-400/30 backdrop-blur-xl shadow-2xl animate-pulse-glow">
        <h1 className="font-serif-luxury text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-300 to-amber-300 drop-shadow-lg tracking-wide uppercase">
          HAPPY BIRTHDAY, MY LOVE ❤️
        </h1>

        <p className="mt-4 font-serif-luxury italic text-lg sm:text-2xl text-pink-200 font-medium">
          “Even miles apart, we're celebrating together.”
        </p>

        <p className="mt-2 text-xs sm:text-sm text-pink-300/80 max-w-md mx-auto">
          Tonight the midnight stars are shining for you. Your wish is carried across the sky!
        </p>

        {/* Action Button: Cut the Cake */}
        <div className="mt-6 pointer-events-auto">
          <button
            onClick={onProceedToCutting}
            className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 text-white font-bold text-base sm:text-lg shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 border border-amber-300/60"
          >
            <Cake className="w-6 h-6 text-amber-200 group-hover:rotate-12 transition-transform" />
            <span>Now Let's Cut Our Cake Together! 🎂</span>
            <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
          </button>
        </div>
      </div>

      {/* Footer spacer */}
      <div className="h-6" />
    </div>
  );
}

