import React, { useEffect, useRef } from 'react';

/**
 * BirthdayHatOverlay
 * Tracks the user's face using MediaPipe FaceLandmarker and renders a 3D-styled,
 * animated, perfectly upright birthday party hat on top of the head.
 * Supports object-contain and object-cover video rendering.
 */
export default function BirthdayHatOverlay({
  videoRef,
  isBirthdayPerson = true,
  hatStyle = 'royal-gold',
  isMirrored = true,
  objectFit = 'contain',
  yOffsetRatio = 0.36,
  sizeScale = 0.88
}) {
  const canvasRef = useRef(null);

  // Smooth interpolation tracking state
  const stateRef = useRef({
    x: 0,
    y: 0,
    size: 130,
    angle: 0,
    targetX: 0,
    targetY: 0,
    targetSize: 130,
    targetAngle: 0,
    hasFace: false,
    pomPomJiggle: 0,
    pomPomVel: 0,
    particles: []
  });

  // Initialize orbiting sparkles and hearts
  useEffect(() => {
    const particles = [];
    for (let i = 0; i < 14; i++) {
      particles.push({
        angle: (i / 14) * Math.PI * 2,
        distance: 55 + Math.random() * 30,
        speed: 0.025 + Math.random() * 0.02,
        size: 3 + Math.random() * 3,
        type: i % 2 === 0 ? 'star' : 'heart',
        opacity: 0.45 + Math.random() * 0.5,
        yOffset: -12 + Math.random() * 24
      });
    }
    stateRef.current.particles = particles;
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let faceLandmarker = null;
    let animationFrameId = null;
    let lastVideoTime = -1;
    let lastDetectTime = 0;

    async function initMediaPipe() {
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        if (isCancelled) return;

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1
        });
      } catch (err) {
        console.warn('[BirthdayHat] MediaPipe optional loading notice:', err.message);
      }
    }

    initMediaPipe();

    // Coordinate mapping with object-contain & object-cover aspect ratio scaling
    function mapToCanvas(normX, normY, videoW, videoH, canvasW, canvasH, mirrored, fit) {
      if (!videoW || !videoH || videoW <= 0 || videoH <= 0) {
        const x = mirrored ? (1 - normX) * canvasW : normX * canvasW;
        return { x, y: normY * canvasH };
      }

      const scale = fit === 'contain'
        ? Math.min(canvasW / videoW, canvasH / videoH)
        : Math.max(canvasW / videoW, canvasH / videoH);

      const renderedW = videoW * scale;
      const renderedH = videoH * scale;
      const offsetX = (canvasW - renderedW) / 2;
      const offsetY = (canvasH - renderedH) / 2;

      const rawX = normX * renderedW;
      const rawY = normY * renderedH;

      const x = mirrored ? (canvasW - (offsetX + rawX)) : (offsetX + rawX);
      const y = offsetY + rawY;

      return { x, y };
    }

    function renderLoop() {
      try {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (canvas && video && video.readyState >= 2) {
          const rect = video.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }

            const width = canvas.width;
            const height = canvas.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);

            let detectedFace = false;

            // MediaPipe Face Tracking (Optimized 25fps throttle to eliminate lag)
            const now = performance.now();
            if (faceLandmarker && (now - lastDetectTime >= 40) && video.currentTime !== lastVideoTime && !video.paused) {
              lastDetectTime = now;
              lastVideoTime = video.currentTime;
              try {
                const results = faceLandmarker.detectForVideo(video, performance.now());
                if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                  const landmarks = results.faceLandmarks[0];

                  if (landmarks && landmarks.length > 454) {
                    const vW = video.videoWidth || width;
                    const vH = video.videoHeight || height;

                    // Landmark 10: Forehead top
                    const pForehead = mapToCanvas(landmarks[10].x, landmarks[10].y, vW, vH, width, height, isMirrored, objectFit);
                    // Landmark 152: Chin bottom
                    const pChin = mapToCanvas(landmarks[152].x, landmarks[152].y, vW, vH, width, height, isMirrored, objectFit);
                    // Landmark 234 & 454: Cheek edges / Ears
                    const pEar1 = mapToCanvas(landmarks[234].x, landmarks[234].y, vW, vH, width, height, isMirrored, objectFit);
                    const pEar2 = mapToCanvas(landmarks[454].x, landmarks[454].y, vW, vH, width, height, isMirrored, objectFit);

                    // Central facial axis from chin to forehead (upward vector)
                    let axisDx = pForehead.x - pChin.x;
                    let axisDy = pForehead.y - pChin.y;
                    const rawDist = Math.hypot(axisDx, axisDy) || 1;

                    // Safety: In screen coordinates, forehead must be above chin (axisDy < 0)
                    if (axisDy >= -10) {
                      axisDy = -Math.max(20, Math.abs(axisDy));
                    }
                    const faceHeight = Math.hypot(axisDx, axisDy) || rawDist;

                    // Unit vector pointing upward along the head
                    const unitUpX = axisDx / faceHeight;
                    const unitUpY = axisDy / faceHeight;

                    // Head tilt angle calculation (upright = 0)
                    let rollAngle = Math.atan2(axisDy, axisDx) + Math.PI / 2;
                    while (rollAngle > Math.PI) rollAngle -= Math.PI * 2;
                    while (rollAngle < -Math.PI) rollAngle -= Math.PI * 2;
                    // Clamp roll angle to natural tilt range [-35 deg, +35 deg] so hat is always upright
                    rollAngle = Math.max(-0.6, Math.min(0.6, rollAngle));

                    // Head width across cheek/ears
                    const headWidth = Math.hypot(pEar1.x - pEar2.x, pEar1.y - pEar2.y) || (faceHeight * 0.75);

                    // Place the base of the party hat right at the crown/hairline comfortably ABOVE the forehead
                    const hairOffset = faceHeight * (yOffsetRatio || 0.36);
                    const hatBaseX = pForehead.x + unitUpX * hairOffset;
                    // Ensure hat base is strictly above the forehead by at least 32px or 25% face height so it never blocks eyes
                    const minSafeTop = pForehead.y - Math.max(32, faceHeight * 0.25);
                    const hatBaseY = Math.min(minSafeTop, pForehead.y + unitUpY * hairOffset);

                    const targetSize = Math.max(80, Math.min(185, headWidth * (sizeScale || 0.88)));

                    if (isFinite(hatBaseX) && isFinite(hatBaseY) && isFinite(targetSize)) {
                      stateRef.current.targetX = hatBaseX;
                      stateRef.current.targetY = hatBaseY;
                      stateRef.current.targetSize = targetSize;
                      stateRef.current.targetAngle = rollAngle;
                      stateRef.current.hasFace = true;
                      detectedFace = true;
                    }
                  }
                }
              } catch (e) {
                // Ignore transient frame busy exceptions
              }
            }

            // Fallback: Flattering top-center head position if face is initializing or lost
            if (!detectedFace) {
              const defaultX = width * 0.5;
              const defaultY = height * 0.18;
              const defaultSize = Math.max(90, Math.min(150, width * 0.28));

              const t = performance.now() * 0.002;
              const swayX = Math.sin(t) * 2;
              const swayY = Math.cos(t * 1.5) * 1.5;
              const swayAngle = Math.sin(t) * 0.02;

              stateRef.current.targetX = defaultX + swayX;
              stateRef.current.targetY = defaultY + swayY;
              stateRef.current.targetSize = defaultSize;
              stateRef.current.targetAngle = swayAngle;
            }

            // Smooth interpolation
            const s = stateRef.current;
            s.x += (s.targetX - s.x) * 0.25;
            s.y += (s.targetY - s.y) * 0.25;
            s.size += (s.targetSize - s.size) * 0.22;
            s.angle += (s.targetAngle - s.angle) * 0.22;

            // Pom-pom bounce physics
            const angleDiff = s.targetAngle - s.angle;
            s.pomPomVel += angleDiff * 16 - s.pomPomJiggle * 0.18;
            s.pomPomVel *= 0.85;
            s.pomPomJiggle += s.pomPomVel;

            // Draw Hat only for Birthday Person
            if (isBirthdayPerson && isFinite(s.x) && isFinite(s.y) && s.size > 10) {
              drawPartyHat(ctx, s.x, s.y, s.size, s.angle, s.pomPomJiggle, s.particles, hatStyle);
            }
          }
        }
      } catch (err) {
        console.error('[BirthdayHat] Render error:', err);
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    }

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      isCancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (faceLandmarker) {
        try { faceLandmarker.close(); } catch (e) {}
      }
    };
  }, [videoRef, isBirthdayPerson, hatStyle, isMirrored, objectFit, yOffsetRatio, sizeScale]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
    />
  );
}

/**
 * Draw the upright 3D Party Hat
 */
function drawPartyHat(ctx, cx, cy, hatWidth, angle, pomPomJiggle, particles = [], style = 'royal-gold') {
  if (!isFinite(cx) || !isFinite(cy) || !isFinite(hatWidth) || hatWidth <= 5) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const halfW = hatWidth * 0.5;
  const hatHeight = hatWidth * 1.35;
  const coneApexX = 0;
  const coneApexY = -hatHeight; // Points UPWARDS into the air

  // 1. Shadow underneath the base
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 4, Math.max(1, halfW * 0.8), 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.filter = 'blur(4px)';
  ctx.fill();
  ctx.restore();

  // 2. Hat Cone Body Path
  ctx.beginPath();
  ctx.moveTo(-halfW, 0);
  ctx.lineTo(coneApexX, coneApexY);
  ctx.lineTo(halfW, 0);
  ctx.quadraticCurveTo(0, 15, -halfW, 0);
  ctx.closePath();

  let coneGrad = ctx.createLinearGradient(-halfW, -hatHeight * 0.5, halfW, 0);
  if (style === 'midnight-ruby') {
    coneGrad.addColorStop(0, '#500724');
    coneGrad.addColorStop(0.35, '#be123c');
    coneGrad.addColorStop(0.7, '#fb7185');
    coneGrad.addColorStop(1, '#881337');
  } else if (style === 'celestial-pink') {
    coneGrad.addColorStop(0, '#3b0764');
    coneGrad.addColorStop(0.35, '#a21caf');
    coneGrad.addColorStop(0.7, '#f472b6');
    coneGrad.addColorStop(1, '#581c87');
  } else {
    // Royal Gold
    coneGrad.addColorStop(0, '#260838');
    coneGrad.addColorStop(0.3, '#581c87');
    coneGrad.addColorStop(0.65, '#d97706');
    coneGrad.addColorStop(0.85, '#fde047');
    coneGrad.addColorStop(1, '#78350f');
  }

  ctx.fillStyle = coneGrad;
  ctx.fill();

  // 3. Diagonal Golden Spiral Stripes
  ctx.save();
  ctx.clip();

  const stripeCount = 5;
  for (let i = -stripeCount; i <= stripeCount; i++) {
    const yOffset = (i / stripeCount) * hatHeight;
    ctx.beginPath();
    ctx.moveTo(-hatWidth * 1.3, yOffset - 25);
    ctx.lineTo(hatWidth * 1.3, yOffset + 35);
    ctx.lineTo(hatWidth * 1.3, yOffset + 50);
    ctx.lineTo(-hatWidth * 1.3, yOffset - 10);
    ctx.closePath();

    const goldGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    goldGrad.addColorStop(0, 'rgba(251, 191, 36, 0.2)');
    goldGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.9)');
    goldGrad.addColorStop(1, 'rgba(245, 158, 11, 0.25)');
    ctx.fillStyle = goldGrad;
    ctx.fill();
  }

  // Polka dot sparkles
  ctx.fillStyle = '#ffffff';
  for (let p = 0; p < 6; p++) {
    const px = Math.sin(p * 2.3) * (halfW * 0.5);
    const py = -hatHeight * (0.2 + (p * 0.12));
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Scalloped Golden Trim at Base
  ctx.beginPath();
  const scallops = 8;
  const scallopW = hatWidth / scallops;
  ctx.moveTo(-halfW, 0);
  for (let i = 0; i < scallops; i++) {
    const sx = -halfW + i * scallopW;
    const midX = sx + scallopW * 0.5;
    const nextX = sx + scallopW;
    ctx.quadraticCurveTo(midX, 12, nextX, 0);
  }
  ctx.quadraticCurveTo(0, -6, -halfW, 0);
  ctx.closePath();

  const trimGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
  trimGrad.addColorStop(0, '#f59e0b');
  trimGrad.addColorStop(0.5, '#fef08a');
  trimGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = trimGrad;
  ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 5. Crown / Ribbon Text: "★ BIRTHDAY STAR ★"
  ctx.save();
  ctx.fillStyle = '#fef08a';
  ctx.font = `bold ${Math.max(9, Math.round(hatWidth * 0.095))}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 4;
  ctx.fillText('★ BIRTHDAY STAR ★', 0, -hatHeight * 0.2);
  ctx.restore();

  // 6. Bouncy 3D Pom-Pom at Apex
  const pomX = coneApexX + (isFinite(pomPomJiggle) ? pomPomJiggle * 0.25 : 0);
  const pomY = coneApexY - 3;
  const pomRadius = Math.max(3, hatWidth * 0.15);

  ctx.save();
  ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
  ctx.shadowBlur = 10;

  const pomGrad = ctx.createRadialGradient(pomX - 3, pomY - 3, 2, pomX, pomY, pomRadius);
  pomGrad.addColorStop(0, '#ffffff');
  pomGrad.addColorStop(0.35, '#fef08a');
  pomGrad.addColorStop(0.75, '#f59e0b');
  pomGrad.addColorStop(1, '#b45309');

  ctx.fillStyle = pomGrad;
  ctx.beginPath();
  ctx.arc(pomX, pomY, pomRadius, 0, Math.PI * 2);
  ctx.fill();

  for (let t = 0; t < 10; t++) {
    const tuftAngle = (t / 10) * Math.PI * 2;
    const tx = pomX + Math.cos(tuftAngle) * pomRadius * 0.92;
    const ty = pomY + Math.sin(tuftAngle) * pomRadius * 0.92;
    ctx.beginPath();
    ctx.arc(tx, ty, pomRadius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }
  ctx.restore();

  // 7. Orbiting Sparkles & Mini Hearts
  if (Array.isArray(particles)) {
    particles.forEach(p => {
      p.angle += p.speed;
      const px = Math.cos(p.angle) * p.distance;
      const py = -hatHeight * 0.5 + Math.sin(p.angle) * (p.distance * 0.35) + p.yOffset;

      ctx.save();
      ctx.globalAlpha = p.opacity;

      if (p.type === 'star') {
        drawLittleStar(ctx, px, py, p.size, '#fbbf24');
      } else {
        drawLittleHeart(ctx, px, py, p.size * 1.15, '#f43f5e');
      }
      ctx.restore();
    });
  }

  ctx.restore();
}

function drawLittleStar(ctx, x, y, size, color) {
  ctx.fillStyle = color;
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

function drawLittleHeart(ctx, x, y, size, color) {
  ctx.fillStyle = color;
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
