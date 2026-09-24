/* =====================================================================
   Aqua Zero Heavens Arena - Interactive 3D Three.js-Style Background & UI Engine
   Luminara Digital

   Brings an ultra-modern, high-polish, 100x interactive 3D WebGL / Canvas
   depth field to the arena. Features:
     - 3D Perspective Particle Constellation & Cyber-Embers with mouse physics
     - Retro-futuristic 3D Cyber-Grid Floor with perspective camera tilt
     - Dynamic Volumetric Cursor-Tracking Spotlights
     - 3D Holographic Character Showcase Carousel with smooth transitions
     - Audio-reactive frequency modulation and shockwave burst ripples
     - Multi-theme cyber palettes (Cyber Cyan, Heavens Gold, Crimson Heat, Tokyo Matrix, Abyss Neon)
     - Full offline-first design, zero external runtime dependencies

   Pure math and state functions are isolated and exported for unit testing.
   ===================================================================== */

"use strict";

const THEMES_3D = {
  cyber: {
    id: "cyber",
    name: "Cyber Neon",
    primary: "#22d3ee",
    secondary: "#0ea5e9",
    accent: "#f59e0b",
    glow: "rgba(34,211,238,.4)",
    grid: "rgba(34,211,238,.18)",
    horizon: "rgba(14,165,233,.25)",
    voidTop: "#07090e",
    voidBot: "#030407",
    spotlight: "rgba(34,211,238,.12)",
    hologram: "rgba(34,211,238,.75)",
  },
  heavens: {
    id: "heavens",
    name: "Heavens Gold",
    primary: "#f59e0b",
    secondary: "#fbbf24",
    accent: "#e6392f",
    glow: "rgba(245,158,11,.4)",
    grid: "rgba(245,158,11,.20)",
    horizon: "rgba(245,158,11,.28)",
    voidTop: "#0d0b07",
    voidBot: "#050403",
    spotlight: "rgba(245,158,11,.14)",
    hologram: "rgba(245,158,11,.8)",
  },
  crimson: {
    id: "crimson",
    name: "Crimson Heat",
    primary: "#e6392f",
    secondary: "#ff6b61",
    accent: "#f59e0b",
    glow: "rgba(230,57,47,.45)",
    grid: "rgba(230,57,47,.20)",
    horizon: "rgba(230,57,47,.30)",
    voidTop: "#0f0707",
    voidBot: "#050202",
    spotlight: "rgba(230,57,47,.14)",
    hologram: "rgba(230,57,47,.8)",
  },
  tokyo: {
    id: "tokyo",
    name: "Tokyo Matrix",
    primary: "#10b981",
    secondary: "#34d399",
    accent: "#22d3ee",
    glow: "rgba(16,185,129,.4)",
    grid: "rgba(16,185,129,.20)",
    horizon: "rgba(16,185,129,.28)",
    voidTop: "#060e0a",
    voidBot: "#020503",
    spotlight: "rgba(16,185,129,.12)",
    hologram: "rgba(16,185,129,.75)",
  },
  abyss: {
    id: "abyss",
    name: "Abyss Neon",
    primary: "#a855f7",
    secondary: "#c084fc",
    accent: "#ec4899",
    glow: "rgba(168,85,247,.4)",
    grid: "rgba(168,85,247,.20)",
    horizon: "rgba(168,85,247,.28)",
    voidTop: "#0b0612",
    voidBot: "#040206",
    spotlight: "rgba(168,85,247,.14)",
    hologram: "rgba(168,85,247,.8)",
  },
};

const Interactive3DBG = (function () {
  const PARTICLE_COUNT = 65;
  const FOCAL_LENGTH = 320;
  const MAX_DEPTH = 800;

  let state = {
    initialized: false,
    theme: "cyber",
    autoCycle: true,
    cycleIntervalMs: 5000,
    lastCycleTs: 0,
    fighterId: 0,
    prevFighterId: 0,
    transitionProgress: 1.0, // 0 to 1
    camera: {
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      fov: FOCAL_LENGTH,
      x: 0,
      y: 0,
      z: 0,
    },
    mouse: {
      x: 0.5,
      y: 0.5,
      targetX: 0.5,
      targetY: 0.5,
      speed: 0,
      isDown: false,
      lastMove: 0,
    },
    particles: [],
    shockwaves: [],
    audioLevel: 0, // 0 to 1
    audioBars: new Array(16).fill(0),
    reducedMotion: false,
    canvas: null,
    cx: null,
    width: 960,
    height: 540,
    dpr: 1,
    hologramVisible: true,
  };

  /* -------------------------------------------------------------------
     Pure Math & 3D Vector Helpers
     ------------------------------------------------------------------- */
  function project3D(x, y, z, cam, screenW, screenH) {
    // Camera-relative translation
    const rx = x - cam.x;
    const ry = y - cam.y;
    const rz = z - cam.z;

    // Yaw rotation (around Y axis)
    const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
    const x1 = rx * cosY - rz * sinY;
    const z1 = rx * sinY + rz * cosY;

    // Pitch rotation (around X axis)
    const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
    const y2 = ry * cosP - z1 * sinP;
    const z2 = ry * sinP + z1 * cosP;

    if (z2 <= 10) return { visible: false, x: 0, y: 0, scale: 0, z: z2 };

    const scale = cam.fov / z2;
    const sx = screenW / 2 + x1 * scale;
    const sy = screenH / 2 + y2 * scale;

    return {
      visible: sx >= -100 && sx <= screenW + 100 && sy >= -100 && sy <= screenH + 100,
      x: sx,
      y: sy,
      scale: scale,
      z: z2,
    };
  }

  function initParticles(count, spreadX, spreadY, maxZ) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: (Math.random() - 0.5) * spreadX,
        y: (Math.random() - 0.5) * spreadY,
        z: Math.random() * maxZ + 40,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3 - 0.1,
        vz: (Math.random() - 0.5) * 0.2,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        seed: Math.random() * 100,
      });
    }
    return list;
  }

  function stepParticles(list, cam, mouse, bounds, dt) {
    if (!list) return;
    const repulseR = 180;
    const repulseStrength = mouse.speed > 0.05 ? 1.4 : 0.6;

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Wrap-around in 3D bounds
      const halfW = bounds.spreadX / 2;
      const halfH = bounds.spreadY / 2;
      if (p.x < -halfW) p.x += bounds.spreadX;
      if (p.x > halfW) p.x -= bounds.spreadX;
      if (p.y < -halfH) p.y += bounds.spreadY;
      if (p.y > halfH) p.y -= bounds.spreadY;
      if (p.z < 20) p.z += bounds.maxZ;
      if (p.z > bounds.maxZ + 20) p.z -= bounds.maxZ;

      // Mouse 3D repulsion
      const mx = (mouse.x - 0.5) * bounds.spreadX;
      const my = (mouse.y - 0.5) * bounds.spreadY;
      const dx = p.x - mx;
      const dy = p.y - my;
      const distSq = dx * dx + dy * dy;
      if (distSq < repulseR * repulseR && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const force = ((repulseR - dist) / repulseR) * repulseStrength;
        p.vx += (dx / dist) * force * 0.08;
        p.vy += (dy / dist) * force * 0.08;
      }

      // Drag
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
  }

  function stepShockwaves(waves, dt) {
    if (!waves || !waves.length) return;
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.radius += w.speed * dt;
      w.alpha -= w.decay * dt;
      if (w.alpha <= 0) {
        waves.splice(i, 1);
      }
    }
  }

  function spawnShockwave(x, y, color) {
    state.shockwaves.push({
      x: x,
      y: y,
      radius: 5,
      maxRadius: 280,
      speed: 8.5,
      alpha: 0.85,
      decay: 0.028,
      color: color || THEMES_3D[state.theme].primary,
    });
  }

  function calculateCameraDamping(cam, mouse, reduced) {
    if (reduced) {
      cam.targetYaw = 0;
      cam.targetPitch = 0;
      cam.yaw = 0;
      cam.pitch = 0;
      return;
    }
    // Subtle 3D perspective angle (in radians)
    cam.targetYaw = (mouse.x - 0.5) * 0.32;
    cam.targetPitch = -(mouse.y - 0.5) * 0.22;

    cam.yaw += (cam.targetYaw - cam.yaw) * 0.08;
    cam.pitch += (cam.targetPitch - cam.pitch) * 0.08;
  }

  /* -------------------------------------------------------------------
     State & Fighter Showcase Controls
     ------------------------------------------------------------------- */
  function getRosterLength() {
    if (typeof FIGHTERS !== "undefined" && Array.isArray(FIGHTERS)) return FIGHTERS.length;
    return 25;
  }

  function setFighter(id) {
    const total = getRosterLength();
    const cleanId = Math.max(0, Math.min(total - 1, Number(id) || 0));
    if (cleanId === state.fighterId && state.transitionProgress >= 1.0) return;
    state.prevFighterId = state.fighterId;
    state.fighterId = cleanId;
    state.transitionProgress = 0.0;
    state.lastCycleTs = Date.now();
  }

  function nextFighter() {
    const total = getRosterLength();
    setFighter((state.fighterId + 1) % total);
  }

  function prevFighter() {
    const total = getRosterLength();
    setFighter((state.fighterId - 1 + total) % total);
  }

  function setTheme(themeId) {
    if (THEMES_3D[themeId]) {
      state.theme = themeId;
      return true;
    }
    return false;
  }

  function setAutoCycle(enabled) {
    state.autoCycle = !!enabled;
    state.lastCycleTs = Date.now();
  }

  function updateAudioLevel(level) {
    state.audioLevel = Math.max(0, Math.min(1, Number(level) || 0));
    // Simulate frequency bins
    for (let i = 0; i < state.audioBars.length; i++) {
      const target = state.audioLevel * (0.4 + Math.sin(Date.now() * 0.008 + i) * 0.6);
      state.audioBars[i] += (target - state.audioBars[i]) * 0.3;
    }
  }

  function onMouseMove(clientX, clientY, rect) {
    const r = rect || { left: 0, top: 0, width: state.width, height: state.height };
    const nx = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    const ny = Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height)));

    const dx = nx - state.mouse.targetX;
    const dy = ny - state.mouse.targetY;
    state.mouse.speed = Math.sqrt(dx * dx + dy * dy);

    state.mouse.targetX = nx;
    state.mouse.targetY = ny;
    state.mouse.lastMove = Date.now();
  }

  function onClick(clientX, clientY, rect) {
    const r = rect || { left: 0, top: 0, width: state.width, height: state.height };
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    const col = THEMES_3D[state.theme].primary;
    spawnShockwave(sx, sy, col);
  }

  /* -------------------------------------------------------------------
     Rendering: 3D Grid, Particles, Spotlights & Hologram Showcase
     ------------------------------------------------------------------- */
  function draw3DCyberGrid(cx, cam, screenW, screenH, theme) {
    const floorY = 165; // 3D floor level
    const gridCols = 20;
    const gridStepX = 65;
    const minZ = 35;
    const maxZ = 700;
    const zStep = 40;
    const now = Date.now();
    const wave = Math.sin(now * 0.002) * 6 + state.audioLevel * 16;
    const pulseRing = (now * 0.06) % 650;

    cx.save();
    cx.lineWidth = 1.0;

    // Longitudinal lines (extending to horizon)
    for (let c = -gridCols / 2; c <= gridCols / 2; c++) {
      const wx = c * gridStepX;
      const pNear = project3D(wx, floorY + wave, minZ, cam, screenW, screenH);
      const pFar = project3D(wx, floorY, maxZ, cam, screenW, screenH);

      if (pNear.visible && pFar.visible) {
        const grad = cx.createLinearGradient(pNear.x, pNear.y, pFar.x, pFar.y);
        grad.addColorStop(0, theme.grid);
        grad.addColorStop(0.65, theme.horizon);
        grad.addColorStop(1, "rgba(0,0,0,0)");

        cx.strokeStyle = grad;
        cx.beginPath();
        cx.moveTo(pNear.x, pNear.y);
        cx.lineTo(pFar.x, pFar.y);
        cx.stroke();
      }
    }

    // Transverse lines (horizontal lines receding in depth)
    for (let wz = minZ; wz <= maxZ; wz += zStep) {
      const leftX = (-gridCols / 2) * gridStepX;
      const rightX = (gridCols / 2) * gridStepX;
      const pL = project3D(leftX, floorY + Math.sin(wz * 0.05 + now * 0.003) * 3, wz, cam, screenW, screenH);
      const pR = project3D(rightX, floorY + Math.sin(wz * 0.05 + now * 0.003) * 3, wz, cam, screenW, screenH);

      if (pL.visible || pR.visible) {
        const depthAlpha = Math.max(0, 1 - (wz - minZ) / (maxZ - minZ));
        const isPulse = Math.abs(wz - pulseRing) < 30;
        const pulseBoost = isPulse ? 0.35 : 0;
        cx.strokeStyle = theme.grid.replace(/[\d.]+\)$/, `${(depthAlpha * 0.35 + pulseBoost).toFixed(3)})`);
        cx.lineWidth = isPulse ? 1.8 : 0.8;
        cx.beginPath();
        cx.moveTo(pL.x, pL.y);
        cx.lineTo(pR.x, pR.y);
        cx.stroke();
      }
    }

    // Concentric Arena Octagon Rings on floor
    const ringRadii = [90, 180, 300, 440];
    for (let rIdx = 0; rIdx < ringRadii.length; rIdx++) {
      const baseR = ringRadii[rIdx] + (pulseRing * 0.15) % 80;
      const ringGrad = cx.createRadialGradient(screenW / 2, screenH * 0.85, 10, screenW / 2, screenH * 0.85, baseR * 1.5);
      ringGrad.addColorStop(0, "rgba(0,0,0,0)");
      ringGrad.addColorStop(0.7, theme.grid.replace(/[\d.]+\)$/, "0.22)"));
      ringGrad.addColorStop(1, "rgba(0,0,0,0)");

      cx.strokeStyle = ringGrad;
      cx.lineWidth = 1.2;
      cx.beginPath();
      cx.ellipse(screenW / 2 + cam.yaw * 120, screenH * 0.88 + cam.pitch * 60, baseR * 1.4, baseR * 0.38, 0, 0, Math.PI * 2);
      cx.stroke();
    }

    cx.restore();
  }

  function draw3DParticles(cx, particles, cam, screenW, screenH, theme) {
    cx.save();
    const count = particles.length;
    const now = Date.now();

    // Draw connecting high-energy laser plexus arcs
    for (let i = 0; i < count; i++) {
      const p1 = particles[i];
      const proj1 = project3D(p1.x, p1.y, p1.z, cam, screenW, screenH);
      if (!proj1.visible) continue;

      for (let j = i + 1; j < count; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < 110 * 110) {
          const proj2 = project3D(p2.x, p2.y, p2.z, cam, screenW, screenH);
          if (proj2.visible) {
            const lineAlpha = (1 - Math.sqrt(distSq) / 110) * 0.16 * p1.alpha;
            cx.strokeStyle = theme.primary.replace(/#/, "").length === 6
              ? `rgba(${parseInt(theme.primary.slice(1, 3), 16)},${parseInt(theme.primary.slice(3, 5), 16)},${parseInt(theme.primary.slice(5, 7), 16)},${lineAlpha.toFixed(3)})`
              : theme.glow;
            cx.lineWidth = 0.65;
            cx.beginPath();
            cx.moveTo(proj1.x, proj1.y);
            cx.lineTo(proj2.x, proj2.y);
            cx.stroke();
          }
        }
      }

      // Draw kinetic spark needle with velocity motion streak
      const sz = Math.max(1.2, p1.size * proj1.scale * 1.5);
      const audioPulse = 1 + state.audioLevel * 0.7;
      const speedX = p1.vx * proj1.scale * 18;
      const speedY = (p1.vy - 0.4) * proj1.scale * 18; // upward draft
      const isHot = i % 3 === 0;

      // Glow halo
      cx.save();
      cx.globalAlpha = p1.alpha * Math.min(0.85, proj1.scale * 1.6);
      cx.fillStyle = isHot ? theme.accent : theme.primary;
      cx.shadowColor = isHot ? theme.accent : theme.primary;
      cx.shadowBlur = 8 * proj1.scale;

      // Motion streak needle
      cx.beginPath();
      cx.moveTo(proj1.x + speedX, proj1.y + speedY);
      cx.lineTo(proj1.x - speedX * 0.4, proj1.y - speedY * 0.4);
      cx.lineWidth = sz * 0.8 * audioPulse;
      cx.strokeStyle = isHot ? theme.accent : theme.primary;
      cx.stroke();

      // White-hot core bead
      cx.fillStyle = "#ffffff";
      cx.beginPath();
      cx.arc(proj1.x, proj1.y, Math.max(0.8, sz * 0.45 * audioPulse), 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    }
    cx.restore();
  }

  function drawVolumetricSpotlights(cx, mouse, screenW, screenH, theme) {
    const now = Date.now();
    cx.save();

    // 1. Dual Sweeping Arena Searchlights (Championship Stadium Effect)
    const sweepL_Angle = Math.sin(now * 0.0012) * 0.35 + 0.25;
    const sweepR_Angle = Math.sin(now * 0.0015 + 1.8) * 0.35 - 0.25;
    const rigL_X = screenW * 0.12;
    const rigR_X = screenW * 0.88;
    const rigY = -20;
    const spotR = 260 + state.audioLevel * 100;

    // Left Sweeping Beam
    const targetLX = screenW * (0.45 + Math.sin(now * 0.0012) * 0.3);
    const gradBeamL = cx.createRadialGradient(rigL_X, rigY, 15, targetLX, screenH * 0.85, spotR);
    gradBeamL.addColorStop(0, theme.spotlight);
    gradBeamL.addColorStop(0.4, theme.spotlight.replace(/[\d.]+\)$/, "0.05)"));
    gradBeamL.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = gradBeamL;
    cx.beginPath();
    cx.moveTo(rigL_X, rigY);
    cx.lineTo(targetLX - spotR * 0.7, screenH);
    cx.lineTo(targetLX + spotR * 0.7, screenH);
    cx.closePath();
    cx.fill();

    // Right Sweeping Beam
    const targetRX = screenW * (0.55 + Math.sin(now * 0.0015 + 1.8) * 0.3);
    const gradBeamR = cx.createRadialGradient(rigR_X, rigY, 15, targetRX, screenH * 0.85, spotR);
    gradBeamR.addColorStop(0, theme.spotlight);
    gradBeamR.addColorStop(0.4, theme.spotlight.replace(/[\d.]+\)$/, "0.05)"));
    gradBeamR.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = gradBeamR;
    cx.beginPath();
    cx.moveTo(rigR_X, rigY);
    cx.lineTo(targetRX - spotR * 0.7, screenH);
    cx.lineTo(targetRX + spotR * 0.7, screenH);
    cx.closePath();
    cx.fill();

    // 2. Cursor-Tracking Arena Spotlight
    const lightX = screenW * mouse.x;
    const lightY = screenH * 0.05;
    const curSpotR = 200 + state.audioLevel * 60;

    // Fixture glow
    const gFixture = cx.createRadialGradient(lightX, lightY, 2, lightX, lightY, 50);
    gFixture.addColorStop(0, theme.primary);
    gFixture.addColorStop(0.3, theme.glow);
    gFixture.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = gFixture;
    cx.beginPath();
    cx.arc(lightX, lightY, 50, 0, Math.PI * 2);
    cx.fill();

    // Floor specular oval
    cx.fillStyle = theme.glow;
    cx.beginPath();
    cx.ellipse(lightX, screenH * 0.88, curSpotR * 0.55, 20, 0, 0, Math.PI * 2);
    cx.fill();

    // 3. Cinematic Atmospheric Vignette (Dark Obsidian with Edge Rim Glow)
    const vignette = cx.createRadialGradient(screenW / 2, screenH / 2, screenH * 0.35, screenW / 2, screenH / 2, screenW * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.7, "rgba(3,4,8,0.45)");
    vignette.addColorStop(1, "rgba(2,3,6,0.92)");
    cx.fillStyle = vignette;
    cx.fillRect(0, 0, screenW, screenH);

    cx.restore();
  }


  function drawShockwaves(cx, waves) {
    if (!waves || !waves.length) return;
    cx.save();
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      cx.strokeStyle = w.color;
      cx.globalAlpha = Math.max(0, w.alpha);
      cx.lineWidth = 2.0;
      cx.beginPath();
      cx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      cx.stroke();
    }
    cx.restore();
  }

  function drawFighterHologram(cx, fighterId, x, y, maxH, alpha, theme, isLeft) {
    if (typeof artOf !== "function" || typeof FIGHTERS === "undefined" || !FIGHTERS[fighterId]) return;
    const img = artOf(fighterId);
    if (!img || !img.complete || !img.naturalWidth) return;

    const r = Math.min(maxH / img.naturalHeight, 380 / img.naturalWidth);
    const w = img.naturalWidth * r;
    const h = img.naturalHeight * r;

    cx.save();
    cx.globalAlpha = alpha;

    // Scanline & Hologram glow filter
    const breathe = Math.sin(Date.now() * 0.003 + fighterId) * 4;
    const posX = x + (isLeft ? -15 : 15);
    const posY = y + breathe;

    cx.translate(posX, posY);
    if (isLeft) cx.scale(-1, 1);

    // Hologram chromatic glow silhouette behind
    cx.save();
    cx.filter = "blur(12px) brightness(1.5)";
    cx.globalAlpha = alpha * 0.45;
    cx.drawImage(img, -w / 2, -h, w, h);
    cx.restore();

    // Base character image
    cx.drawImage(img, -w / 2, -h, w, h);

    // Subtle scanlines overlay across character
    cx.fillStyle = theme.grid;
    for (let sl = -h; sl < 0; sl += 6) {
      cx.fillRect(-w / 2, sl, w, 1.5);
    }

    cx.restore();
  }

  function drawShowcaseOverlay(cx, screenW, screenH, theme) {
    if (!state.hologramVisible || typeof FIGHTERS === "undefined" || !FIGHTERS[state.fighterId]) return;

    const curF = FIGHTERS[state.fighterId];
    const prevF = FIGHTERS[state.prevFighterId];
    const prog = state.transitionProgress;

    // Left and Right 3D holographic character showcases
    const leftX = screenW * 0.16;
    const rightX = screenW * 0.84;
    const charBaseY = screenH * 0.92;
    const charH = Math.min(360, screenH * 0.65);

    // Prev fighter fading out
    if (prog < 1.0 && prevF) {
      const outAlpha = (1.0 - prog) * 0.22;
      drawFighterHologram(cx, state.prevFighterId, leftX, charBaseY, charH, outAlpha, theme, true);
    }
    // Current fighter fading in
    const inAlpha = prog * 0.25;
    drawFighterHologram(cx, state.fighterId, rightX, charBaseY, charH, inAlpha, theme, false);
  }

  /* -------------------------------------------------------------------
     Main Step & Render Entry
     ------------------------------------------------------------------- */
  function step(dt) {
    const delta = dt || 1.0;
    const bounds = { spreadX: state.width * 1.4, spreadY: state.height * 1.2, maxZ: MAX_DEPTH };

    // Mouse position damping
    state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.08;
    state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.08;

    calculateCameraDamping(state.camera, state.mouse, state.reducedMotion);
    stepParticles(state.particles, state.camera, state.mouse, bounds, delta);
    stepShockwaves(state.shockwaves, delta);

    // Auto-cycle roster
    if (state.autoCycle && Date.now() - state.lastCycleTs >= state.cycleIntervalMs) {
      nextFighter();
    }

    // Transition progress easing
    if (state.transitionProgress < 1.0) {
      state.transitionProgress = Math.min(1.0, state.transitionProgress + 0.035 * delta);
    }
  }

  function render(customCx, customW, customH) {
    const cx = customCx || state.cx;
    const w = customW || state.width;
    const h = customH || state.height;
    if (!cx) return;

    const theme = THEMES_3D[state.theme] || THEMES_3D.cyber;

    // Void background gradient
    const bgGrad = cx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, theme.voidTop);
    bgGrad.addColorStop(1, theme.voidBot);
    cx.fillStyle = bgGrad;
    cx.fillRect(0, 0, w, h);

    // 3D Perspective Grid
    draw3DCyberGrid(cx, state.camera, w, h, theme);

    // Volumetric Cursor Spotlights
    drawVolumetricSpotlights(cx, state.mouse, w, h, theme);

    // 3D Particles Constellation
    draw3DParticles(cx, state.particles, state.camera, w, h, theme);

    // Hologram Character Showcase
    drawShowcaseOverlay(cx, w, h, theme);

    // Click Shockwaves
    drawShockwaves(cx, state.shockwaves);
  }

  /* -------------------------------------------------------------------
     Initialization & DOM Bindings
     ------------------------------------------------------------------- */
  function init(canvasEl, options) {
    const opts = options || {};
    state.canvas = canvasEl;
    if (canvasEl && typeof canvasEl.getContext === "function") {
      state.cx = canvasEl.getContext("2d");
      state.width = canvasEl.width || 960;
      state.height = canvasEl.height || 540;
    }
    if (opts.theme && THEMES_3D[opts.theme]) state.theme = opts.theme;
    if (opts.autoCycle !== undefined) state.autoCycle = opts.autoCycle;
    if (opts.cycleIntervalMs) state.cycleIntervalMs = opts.cycleIntervalMs;

    state.particles = initParticles(
      opts.particleCount || PARTICLE_COUNT,
      state.width * 1.4,
      state.height * 1.2,
      MAX_DEPTH
    );

    state.initialized = true;
    state.lastCycleTs = Date.now();

    // Check media query for motion
    if (typeof window !== "undefined" && window.matchMedia) {
      state.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }

  function resize(w, h, dpr) {
    state.width = w;
    state.height = h;
    state.dpr = dpr || 1;
    if (state.canvas) {
      state.canvas.width = Math.round(w * state.dpr);
      state.canvas.height = Math.round(h * state.dpr);
      if (state.cx) {
        state.cx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      }
    }
  }

  return {
    THEMES: THEMES_3D,
    init: init,
    step: step,
    render: render,
    resize: resize,
    setFighter: setFighter,
    nextFighter: nextFighter,
    prevFighter: prevFighter,
    setTheme: setTheme,
    setAutoCycle: setAutoCycle,
    updateAudioLevel: updateAudioLevel,
    onMouseMove: onMouseMove,
    onClick: onClick,
    spawnShockwave: spawnShockwave,
    project3D: project3D,
    initParticles: initParticles,
    stepParticles: stepParticles,
    stepShockwaves: stepShockwaves,
    calculateCameraDamping: calculateCameraDamping,
    getState: function () {
      return state;
    },
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Interactive3DBG;
}
