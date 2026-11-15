import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Cake3D({
  cakeConfig = {
    name: 'My Love',
    message: 'Happy Birthday!',
    cakeColor: '#f43f5e',
    accentColor: '#fbbf24',
    theme: 'romantic-rose',
    candleCount: 5,
    candlesLit: true
  },
  blowIntensity = 0,
  cuttingProgress = 0, // 0 to 100
  isSliceSeparated = false,
  onCakeClick = null
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const cakeGroupRef = useRef(null);
  const sliceGroupRef = useRef(null);
  const knifeRef = useRef(null);
  const candleFlamesRef = useRef([]);
  const pointLightsRef = useRef([]);
  const smokeParticlesRef = useRef([]);
  const bannerMeshRef = useRef(null);

  // Interaction refs
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const rotationVelocityRef = useRef(0.003); // Gentle auto-rotate
  const cakeRotationYRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 5.5, 11.5);
    camera.lookAt(0, 0.2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 2. Lighting Setup
    // Warm key ambient light
    const ambientLight = new THREE.AmbientLight(0xffe4e6, 0.9);
    scene.add(ambientLight);

    // Main romantic warm spot
    const mainSpot = new THREE.SpotLight(0xfff1f2, 2.8);
    mainSpot.position.set(5, 12, 7);
    mainSpot.angle = Math.PI / 4;
    mainSpot.penumbra = 0.6;
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 1024;
    mainSpot.shadow.mapSize.height = 1024;
    mainSpot.shadow.bias = -0.001;
    scene.add(mainSpot);

    // Rim backlight for romantic silhouette glow
    const rimLight = new THREE.DirectionalLight(0xd946ef, 1.8);
    rimLight.position.set(-6, 8, -6);
    scene.add(rimLight);

    // Warm bounce light from beneath cake platter
    const bounceLight = new THREE.PointLight(0xf59e0b, 1.2, 15);
    bounceLight.position.set(0, -1, 3);
    scene.add(bounceLight);

    // 3. Build Cake Assembly
    const cakeGroup = new THREE.Group();
    cakeGroupRef.current = cakeGroup;
    scene.add(cakeGroup);

    rebuildCake();

    // 4. Create Knife for cutting ceremony
    const knifeGroup = buildKnife();
    knifeGroup.visible = false;
    knifeRef.current = knifeGroup;
    scene.add(knifeGroup);

    // 5. Smoke Particle Pool
    const smokeGroup = new THREE.Group();
    scene.add(smokeGroup);
    const smokeParticles = [];
    const smokeGeo = new THREE.DodecahedronGeometry(0.08, 1);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0,
      roughness: 0.9
    });

    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
      p.visible = false;
      smokeGroup.add(p);
      smokeParticles.push({
        mesh: p,
        active: false,
        life: 0,
        maxLife: 1.0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1
      });
    }
    smokeParticlesRef.current = smokeParticles;

    // 6. Interaction Event Listeners (Orbit & Touch)
    const onPointerDown = (e) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = {
        x: e.clientX || (e.touches && e.touches[0].clientX) || 0,
        y: e.clientY || (e.touches && e.touches[0].clientY) || 0
      };
      rotationVelocityRef.current = 0;
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = clientX - previousMousePositionRef.current.x;

      cakeRotationYRef.current += deltaX * 0.008;
      rotationVelocityRef.current = deltaX * 0.001;

      previousMousePositionRef.current = {
        x: clientX,
        y: e.clientY || (e.touches && e.touches[0].clientY) || 0
      };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onPointerDown);
    domElement.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    domElement.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    let animId = null;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Inertia and gentle auto-rotate
      if (!isDraggingRef.current) {
        rotationVelocityRef.current = THREE.MathUtils.lerp(rotationVelocityRef.current, 0.0035, 0.03);
        cakeRotationYRef.current += rotationVelocityRef.current;
      }
      cakeGroup.rotation.y = cakeRotationYRef.current;

      // Candle Flame Animations
      const lit = cakeConfig.candlesLit;
      const intensity = blowIntensity;

      candleFlamesRef.current.forEach((flame, index) => {
        if (!flame) return;

        if (lit) {
          flame.visible = true;

          // Natural flicker
          const flickerPhase = elapsedTime * 8 + index * 1.5;
          const flickerScaleY = 1 + Math.sin(flickerPhase * 1.7) * 0.12 + Math.cos(flickerPhase * 3.1) * 0.08;
          const flickerScaleX = 1 + Math.cos(flickerPhase * 2.3) * 0.1;

          // React to blow intensity (wind bend & stretch)
          const bendAngle = (intensity * 0.85) + (Math.sin(flickerPhase) * 0.08);
          flame.rotation.z = bendAngle;
          flame.scale.set(
            flickerScaleX * Math.max(0.2, 1 - intensity * 0.6),
            flickerScaleY * Math.max(0.2, 1 - intensity * 0.5),
            flickerScaleX * Math.max(0.2, 1 - intensity * 0.6)
          );
        } else {
          flame.visible = false;
        }
      });

      // Point Lights flicker
      pointLightsRef.current.forEach((light, i) => {
        if (lit) {
          light.intensity = THREE.MathUtils.lerp(
            light.intensity,
            (1.5 + Math.sin(elapsedTime * 12 + i) * 0.3) * (1 - intensity * 0.8),
            0.15
          );
        } else {
          light.intensity = 0;
        }
      });

      // Animate Smoke Particles when extinguished
      smokeParticlesRef.current.forEach(p => {
        if (!p.active) return;
        p.life += delta;
        p.mesh.position.x += p.vx * delta;
        p.mesh.position.y += p.vy * delta;
        p.mesh.position.z += p.vz * delta;

        // Swirling curl
        p.mesh.position.x += Math.sin(elapsedTime * 4 + p.mesh.id) * 0.005;

        const progress = p.life / p.maxLife;
        if (progress >= 1.0) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.mesh.scale.setScalar(p.scale * (1 + progress * 2.5));
          p.mesh.material.opacity = Math.sin(progress * Math.PI) * 0.45;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
      if (domElement) {
        domElement.removeEventListener('mousedown', onPointerDown);
        domElement.removeEventListener('mousemove', onPointerMove);
        domElement.removeEventListener('touchstart', onPointerDown);
        domElement.removeEventListener('touchmove', onPointerMove);
      }
      renderer.dispose();
    };
  }, []);

  // Update Cake whenever configuration changes
  useEffect(() => {
    rebuildCake();
  }, [
    cakeConfig.name,
    cakeConfig.message,
    cakeConfig.cakeColor,
    cakeConfig.accentColor,
    cakeConfig.theme,
    cakeConfig.candleCount,
    cakeConfig.candlesLit
  ]);

  // Handle cutting progress & slice separation
  useEffect(() => {
    const knife = knifeRef.current;
    const slice = sliceGroupRef.current;

    if (cuttingProgress > 0 && cuttingProgress < 100) {
      if (knife) {
        knife.visible = true;
        // Knife descends from above the cake down to the platter
        const startY = 4.2;
        const endY = 1.2;
        const currentY = startY - ((startY - endY) * (cuttingProgress / 100));
        knife.position.set(0, currentY, 0.4);
        knife.rotation.x = 0.2 + (cuttingProgress / 100) * 0.1;
      }
    } else if (cuttingProgress >= 100 || isSliceSeparated) {
      if (knife) {
        // Knife glides aside after cut
        knife.position.set(2.5, 1.8, 1.0);
        knife.rotation.z = -0.5;
        knife.visible = false;
      }
      if (slice) {
        // Separate cake slice forward with celebration reveal
        slice.position.set(0, 0, 1.5);
        slice.rotation.y = 0.12;
      }
    } else {
      if (knife) knife.visible = false;
      if (slice) {
        slice.position.set(0, 0, 0);
        slice.rotation.y = 0;
      }
    }
  }, [cuttingProgress, isSliceSeparated]);

  // Emit smoke burst when candles switch from lit to extinguished
  useEffect(() => {
    if (!cakeConfig.candlesLit) {
      triggerSmokeBurst();
    }
  }, [cakeConfig.candlesLit]);

  function triggerSmokeBurst() {
    const candles = candleFlamesRef.current;
    const particles = smokeParticlesRef.current;
    if (!particles || particles.length === 0) return;

    let pIdx = 0;
    candles.forEach(flame => {
      if (!flame) return;
      const worldPos = new THREE.Vector3();
      flame.getWorldPosition(worldPos);

      // Emit 4 smoke puffs per candle
      for (let k = 0; k < 4; k++) {
        const p = particles[pIdx % particles.length];
        pIdx++;
        p.active = true;
        p.life = 0;
        p.maxLife = 1.2 + Math.random() * 0.8;
        p.scale = 0.7 + Math.random() * 0.5;
        p.vx = (Math.random() - 0.5) * 0.4;
        p.vy = 0.8 + Math.random() * 0.6;
        p.vz = (Math.random() - 0.5) * 0.4;
        p.mesh.position.copy(worldPos);
        p.mesh.visible = true;
      }
    });
  }

  // Build the complete 3D Cake with Pedestal, Tiers, Frosting, Piping, Candles and Plaque
  function rebuildCake() {
    const cakeGroup = cakeGroupRef.current;
    if (!cakeGroup) return;

    // Clear previous cake meshes
    while (cakeGroup.children.length > 0) {
      cakeGroup.remove(cakeGroup.children[0]);
    }
    candleFlamesRef.current = [];
    pointLightsRef.current = [];

    const {
      name = 'My Love',
      cakeColor = '#f43f5e',
      accentColor = '#fbbf24',
      theme = 'romantic-rose',
      candleCount = 5,
      candlesLit = true
    } = cakeConfig;

    // Color definitions
    const primaryColor = new THREE.Color(cakeColor);
    const goldColor = new THREE.Color(accentColor || '#fbbf24');
    const creamColor = new THREE.Color(theme === 'chocolate-velvet' ? '#451a03' : '#fff5f7');
    const fillingColor = new THREE.Color(theme === 'chocolate-velvet' ? '#f59e0b' : '#fb7185');

    // 1. Pedestal Golden Cake Stand Platter
    const platterGroup = new THREE.Group();
    const platterMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.22
    });

    // Platter base
    const baseGeo = new THREE.CylinderGeometry(1.6, 2.2, 0.4, 48);
    const baseMesh = new THREE.Mesh(baseGeo, platterMat);
    baseMesh.position.y = -0.7;
    baseMesh.receiveShadow = true;
    platterGroup.add(baseMesh);

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.6, 32);
    const stemMesh = new THREE.Mesh(stemGeo, platterMat);
    stemMesh.position.y = -0.3;
    platterGroup.add(stemMesh);

    // Top plate
    const plateGeo = new THREE.CylinderGeometry(3.6, 3.4, 0.22, 64);
    const plateMesh = new THREE.Mesh(plateGeo, platterMat);
    plateMesh.position.y = 0.0;
    plateMesh.receiveShadow = true;
    platterGroup.add(plateMesh);

    // Plate rim pearls
    const pearlGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const pearlCount = 36;
    for (let i = 0; i < pearlCount; i++) {
      const angle = (i / pearlCount) * Math.PI * 2;
      const pearl = new THREE.Mesh(pearlGeo, platterMat);
      pearl.position.set(Math.cos(angle) * 3.55, 0.1, Math.sin(angle) * 3.55);
      platterGroup.add(pearl);
    }
    cakeGroup.add(platterGroup);

    // 2. Main Cake Body and Separate Wedge Slice Group
    const mainCakeGroup = new THREE.Group();
    const sliceGroup = new THREE.Group();
    sliceGroupRef.current = sliceGroup;

    // Materials
    const frostingMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.35,
      metalness: 0.05
    });

    const creamMat = new THREE.MeshStandardMaterial({
      color: creamColor,
      roughness: 0.28,
      metalness: 0.02
    });

    // Tier 1: Bottom tier (Radius: 2.8, Height: 1.1)
    const tier1Geo = new THREE.CylinderGeometry(2.8, 2.8, 1.1, 48);
    const tier1Mesh = new THREE.Mesh(tier1Geo, frostingMat);
    tier1Mesh.position.y = 0.65;
    tier1Mesh.castShadow = true;
    tier1Mesh.receiveShadow = true;
    mainCakeGroup.add(tier1Mesh);

    // Tier 1 bottom piping pearls
    addPipingRim(mainCakeGroup, 2.85, 0.15, 32, creamMat, 0.1);

    // Tier 1 middle ribbon band
    const ribbonGeo = new THREE.CylinderGeometry(2.82, 2.82, 0.16, 48);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: goldColor,
      metalness: 0.7,
      roughness: 0.25
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.position.y = 0.65;
    mainCakeGroup.add(ribbonMesh);

    // Tier 2: Top tier (Radius: 1.9, Height: 1.0)
    const tier2Geo = new THREE.CylinderGeometry(1.9, 1.9, 1.0, 48);
    const tier2Mesh = new THREE.Mesh(tier2Geo, frostingMat);
    tier2Mesh.position.y = 1.7;
    tier2Mesh.castShadow = true;
    tier2Mesh.receiveShadow = true;
    mainCakeGroup.add(tier2Mesh);

    // Tier 2 piping rim
    addPipingRim(mainCakeGroup, 1.95, 1.25, 26, creamMat, 0.09);
    addPipingRim(mainCakeGroup, 1.92, 2.22, 24, creamMat, 0.08);

    // Decorative Cream Rosettes on top tier perimeter
    const rosetteGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const rosetteCount = 14;
    for (let r = 0; r < rosetteCount; r++) {
      const ang = (r / rosetteCount) * Math.PI * 2;
      const rosette = new THREE.Mesh(rosetteGeo, creamMat);
      rosette.position.set(Math.cos(ang) * 1.75, 2.25, Math.sin(ang) * 1.75);
      mainCakeGroup.add(rosette);
    }

    // Ganache Drips down the top tier
    addGanacheDrips(mainCakeGroup, 1.91, 2.18, creamMat);

    // 3. Wedge Slice (Pre-built cut section for slicing animation)
    // Slices from theta -0.2 to 0.4
    const sliceGeo1 = new THREE.CylinderGeometry(2.81, 2.81, 1.11, 16, 1, false, -0.25, 0.5);
    const sliceMesh1 = new THREE.Mesh(sliceGeo1, frostingMat);
    sliceMesh1.position.y = 0.65;

    const sliceGeo2 = new THREE.CylinderGeometry(1.91, 1.91, 1.01, 16, 1, false, -0.25, 0.5);
    const sliceMesh2 = new THREE.Mesh(sliceGeo2, frostingMat);
    sliceMesh2.position.y = 1.7;

    // Interior sponge crumb and filling walls
    const crumbWallMat = new THREE.MeshStandardMaterial({
      color: fillingColor,
      roughness: 0.85
    });

    const crumbWallGeo = new THREE.BoxGeometry(2.8, 2.1, 0.05);
    const crumbWall = new THREE.Mesh(crumbWallGeo, crumbWallMat);
    crumbWall.position.set(1.4, 1.15, 0);
    crumbWall.rotation.y = 0.25;

    sliceGroup.add(sliceMesh1);
    sliceGroup.add(sliceMesh2);
    sliceGroup.add(crumbWall);

    cakeGroup.add(mainCakeGroup);
    cakeGroup.add(sliceGroup);

    // 4. Personalized Birthday Plaque Banner on front of cake
    const plaqueMesh = buildPersonalizedPlaque(name, cakeConfig.message, goldColor);
    plaqueMesh.position.set(0, 0.65, 2.85);
    bannerMeshRef.current = plaqueMesh;
    mainCakeGroup.add(plaqueMesh);

    // 5. Birthday Candles on Top Tier
    const candleCountNum = Math.max(1, Math.min(21, candleCount || 5));
    const candleRadius = candleCountNum === 1 ? 0 : 1.15;

    const waxMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.35,
      metalness: 0.1
    });

    const wickMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });

    for (let c = 0; c < candleCountNum; c++) {
      const angle = candleCountNum === 1 ? 0 : (c / candleCountNum) * Math.PI * 2;
      const cx = Math.cos(angle) * candleRadius;
      const cz = Math.sin(angle) * candleRadius;
      const cy = 2.2;

      const candleGroup = new THREE.Group();
      candleGroup.position.set(cx, cy, cz);

      // Wax body
      const waxGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 18);
      const wax = new THREE.Mesh(waxGeo, waxMat);
      wax.position.y = 0.45;
      wax.castShadow = true;
      candleGroup.add(wax);

      // Wick
      const wickGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8);
      const wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.y = 0.95;
      candleGroup.add(wick);

      // 3D Flame
      const flameMesh = buildFlameMesh();
      flameMesh.position.y = 1.15;
      candleGroup.add(flameMesh);
      candleFlamesRef.current.push(flameMesh);

      // Point Light on candle
      const candleLight = new THREE.PointLight(0xf59e0b, candlesLit ? 1.4 : 0, 4.5);
      candleLight.position.set(0, 1.25, 0);
      candleGroup.add(candleLight);
      pointLightsRef.current.push(candleLight);

      mainCakeGroup.add(candleGroup);
    }
  }

  // Helper: Piping Rim around tiers
  function addPipingRim(parent, radius, yPos, count, mat, size) {
    const geo = new THREE.SphereGeometry(size, 12, 12);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const p = new THREE.Mesh(geo, mat);
      p.position.set(Math.cos(ang) * radius, yPos, Math.sin(ang) * radius);
      parent.add(p);
    }
  }

  // Helper: Ganache Drips
  function addGanacheDrips(parent, radius, yPos, mat) {
    const dripCount = 18;
    for (let i = 0; i < dripCount; i++) {
      const ang = (i / dripCount) * Math.PI * 2;
      const dripLen = 0.15 + (Math.sin(i * 3.5) * 0.5 + 0.5) * 0.28;
      const dripGeo = new THREE.ConeGeometry(0.06, dripLen, 12);
      const drip = new THREE.Mesh(dripGeo, mat);
      drip.rotation.x = Math.PI;
      drip.position.set(Math.cos(ang) * radius, yPos - dripLen * 0.5, Math.sin(ang) * radius);
      parent.add(drip);
    }
  }

  // Helper: Procedural 3D Flame Mesh
  function buildFlameMesh() {
    const flameGeo = new THREE.ConeGeometry(0.09, 0.28, 16);
    // Gradient / glowing flame material
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.95
    });

    const outerFlameGeo = new THREE.ConeGeometry(0.14, 0.36, 16);
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.65
    });

    const inner = new THREE.Mesh(flameGeo, flameMat);
    const outer = new THREE.Mesh(outerFlameGeo, outerFlameMat);

    const flameGroup = new THREE.Group();
    flameGroup.add(inner);
    flameGroup.add(outer);
    return flameGroup;
  }

  // Helper: Chef Cake Knife
  function buildKnife() {
    const knifeGroup = new THREE.Group();

    // Steel Blade
    const bladeGeo = new THREE.BoxGeometry(0.06, 0.5, 3.2);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.12
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0, 0);
    blade.castShadow = true;
    knifeGroup.add(blade);

    // Golden Handle
    const handleGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 16);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.1, -2.1);
    knifeGroup.add(handle);

    return knifeGroup;
  }

  // Helper: High Resolution Canvas-Textured Golden Plaque
  function buildPersonalizedPlaque(name, message, goldColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');

    // Plaque background with luxury golden border
    const grad = ctx.createLinearGradient(0, 0, 1024, 380);
    grad.addColorStop(0, '#78350f');
    grad.addColorStop(0.3, '#d97706');
    grad.addColorStop(0.7, '#fef08a');
    grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    roundRect(ctx, 20, 20, 984, 340, 40);
    ctx.fill();

    // Inner dark velvet frame
    ctx.fillStyle = '#26041f';
    roundRect(ctx, 36, 36, 952, 308, 30);
    ctx.fill();

    // Text: "Happy Birthday"
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 52px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
    ctx.shadowBlur = 14;
    ctx.fillText('✨ HAPPY BIRTHDAY ✨', 512, 110);

    // Text: Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px "Great Vibes", cursive, serif';
    ctx.fillText(name || 'My Love', 512, 210);

    // Text: Message or Stars
    ctx.fillStyle = '#f472b6';
    ctx.font = '400 32px "Plus Jakarta Sans", sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText('❤️ Celebrating Together Under The Stars ❤️', 512, 290);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;

    const plaqueGeo = new THREE.PlaneGeometry(2.4, 0.95);
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true
    });

    const mesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    return mesh;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return (
    <div
      ref={containerRef}
      onClick={onCakeClick}
      className="relative w-full h-full min-h-[380px] sm:min-h-[460px] md:min-h-[520px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
    />
  );
}

