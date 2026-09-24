/* =====================================================================
   Aqua Zero Heavens Arena - Three.js WebGL Engine & Scene Manager
   Luminara Digital

   Provides hardware-accelerated 3D rendering for Aqua Zero:
     - High-performance WebGL renderer on #bg-canvas (or dynamic canvas)
     - Multi-scene graph: background cyber field, 3D venues, 3D combat cards,
       character showcase, and 3D trophy room
     - Animated 3D cyber grid & glowing particle constellation with mouse physics
     - Audio-reactive frequency modulation and wave pulsing
     - Cinematic 3D camera controller with spring damping, shake, and orbits
     - Zero-dependency headless safety: pure math & state exports for Node tests
   ===================================================================== */

"use strict";

var ThreeEngine = (function () {
  var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  var THREE_LIB = (typeof THREE !== "undefined") ? THREE : (typeof require === "function" ? (function () {
    try { return require("../../assets/vendor/three.min.js"); } catch (e) { return null; }
  })() : null);

  var state = {
    supported: false,
    initialized: false,
    width: 960,
    height: 540,
    dpr: 1,
    activeScene: "background", // "background" | "venue" | "showcase" | "trophy" | "tower"
    theme: "cyber",
    audioLevel: 0,
    cameraMode: "normal", // "normal" | "intro" | "clash" | "finish" | "orbit"
    cameraT: 0,
    cameraTargetFov: 50,
    shake: 0,
    reducedMotion: false,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
  };

  var THEME_HEX = {
    cyber:   { primary: 0x22d3ee, secondary: 0x0ea5e9, accent: 0xf59e0b, ambient: 0x121828 },
    heavens: { primary: 0xf59e0b, secondary: 0xfbbf24, accent: 0xe6392f, ambient: 0x221808 },
    crimson: { primary: 0xe6392f, secondary: 0xff6b61, accent: 0xf59e0b, ambient: 0x200808 },
    tokyo:   { primary: 0x10b981, secondary: 0x34d399, accent: 0x22d3ee, ambient: 0x081c12 },
    abyss:   { primary: 0xa855f7, secondary: 0xc084fc, accent: 0xec4899, ambient: 0x180824 },
  };

  var renderer = null;
  var camera = null;
  var scenes = {};
  var lights = {};
  var clock = null;

  // Background scene elements
  var cyberGrid = null;
  var particlePoints = null;
  var particlePositions = null;
  var particleVelocities = [];
  var PARTICLE_COUNT = 240;

  // Trophy scene elements
  var trophyBeltMesh = null;

  /* Check WebGL capability safely */
  function detectWebGL() {
    if (!isBrowser || !THREE_LIB) return false;
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }

  /* -------------------------------------------------------------------
     Pure Math & Camera Kinematics (testable without WebGL/DOM)
     ------------------------------------------------------------------- */
  function computeCameraOrbit(radius, angleRad, height, target) {
    target = target || { x: 0, y: 0, z: 0 };
    return {
      x: target.x + radius * Math.sin(angleRad),
      y: target.y + height,
      z: target.z + radius * Math.cos(angleRad),
      lookAt: { x: target.x, y: target.y, z: target.z },
    };
  }

  function computeCameraShake(intensity, time) {
    if (!intensity || intensity <= 0) return { x: 0, y: 0, z: 0 };
    var freq = 28;
    return {
      x: Math.sin(time * freq) * intensity * 0.08,
      y: Math.cos(time * freq * 1.3) * intensity * 0.08,
      z: Math.sin(time * freq * 0.7) * intensity * 0.04,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  function calculateFovForRange(range) {
    switch (range) {
      case "LONG": return 52;
      case "MID": return 46;
      case "CLINCH": return 38;
      case "GROUND": return 34;
      default: return 48;
    }
  }

  /* -------------------------------------------------------------------
     Scene Initialization
     ------------------------------------------------------------------- */
  function init(canvasEl, opts) {
    opts = opts || {};
    state.supported = detectWebGL();
    if (!state.supported || !canvasEl) {
      return false;
    }

    try {
      state.width = opts.width || canvasEl.width || 960;
      state.height = opts.height || canvasEl.height || 540;
      state.dpr = Math.min(2, opts.dpr || (window.devicePixelRatio || 1));
      state.theme = opts.theme || "cyber";

      renderer = new THREE_LIB.WebGLRenderer({
        canvas: canvasEl,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(state.width, state.height, false);
      renderer.setPixelRatio(state.dpr);
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE_LIB.PCFSoftShadowMap;
      }

      camera = new THREE_LIB.PerspectiveCamera(state.cameraTargetFov, state.width / state.height, 0.1, 2000);
      camera.position.set(0, 4.5, 20);
      camera.lookAt(0, 0, 0);

      clock = new THREE_LIB.Clock();

      // Allocate main scene graphs
      scenes.background = new THREE_LIB.Scene();
      scenes.venue = new THREE_LIB.Scene();
      scenes.showcase = new THREE_LIB.Scene();
      scenes.trophy = new THREE_LIB.Scene();

      initDefaultLighting();
      initBackgroundScene();
      initTrophyScene();
      initVenueVFX();

      state.initialized = true;
      return true;
    } catch (err) {
      console.warn("ThreeEngine init failed, falling back to 2D:", err);
      state.supported = false;
      return false;
    }
  }

  function initDefaultLighting() {
    if (!THREE_LIB) return;

    // Background lighting
    var th = THEME_HEX[state.theme] || THEME_HEX.cyber;
    var bgAmbient = new THREE_LIB.AmbientLight(th.ambient, 1.4);
    scenes.background.add(bgAmbient);
    lights.bgAmbient = bgAmbient;

    // Venue lighting
    var venueAmbient = new THREE_LIB.AmbientLight(0x333a4f, 1.0);
    var keyLight = new THREE_LIB.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(10, 25, 15);
    keyLight.castShadow = true;

    var rimLightL = new THREE_LIB.PointLight(th.primary, 2.5, 50);
    rimLightL.position.set(-14, 8, -6);

    var rimLightR = new THREE_LIB.PointLight(th.accent, 2.5, 50);
    rimLightR.position.set(14, 8, -6);

    var followSpot = new THREE_LIB.SpotLight(0xffffff, 3.0, 60, Math.PI / 6, 0.4, 1.5);
    followSpot.position.set(0, 22, 0);
    followSpot.target.position.set(0, 0, 0);

    scenes.venue.add(venueAmbient);
    scenes.venue.add(keyLight);
    scenes.venue.add(rimLightL);
    scenes.venue.add(rimLightR);
    scenes.venue.add(followSpot);
    scenes.venue.add(followSpot.target);

    lights.key = keyLight;
    lights.rimL = rimLightL;
    lights.rimR = rimLightR;
    lights.spot = followSpot;
  }

  function initBackgroundScene() {
    if (!THREE_LIB) return;
    var th = THEME_HEX[state.theme] || THEME_HEX.cyber;

    // 1. Retro-futuristic 3D Cyber Grid Floor
    cyberGrid = new THREE_LIB.GridHelper(90, 45, th.primary, th.secondary);
    cyberGrid.position.set(0, -5, -8);
    cyberGrid.material.transparent = true;
    cyberGrid.material.opacity = 0.35;
    scenes.background.add(cyberGrid);

    // 2. 3D Particle Constellation
    var pGeo = new THREE_LIB.BufferGeometry();
    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleVelocities = [];

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particlePositions[i * 3]     = (Math.random() - 0.5) * 55;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 28;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 45;

      particleVelocities.push({
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 + 0.08,
        vz: (Math.random() - 0.5) * 0.25,
      });
    }

    pGeo.setAttribute("position", new THREE_LIB.BufferAttribute(particlePositions, 3));

    var pMat = new THREE_LIB.PointsMaterial({
      color: th.primary,
      size: 0.4,
      transparent: true,
      opacity: 0.75,
      blending: THREE_LIB.AdditiveBlending,
    });

    particlePoints = new THREE_LIB.Points(pGeo, pMat);
    scenes.background.add(particlePoints);
  }

  function initTrophyScene() {
    if (!THREE_LIB) return;

    var trophyAmbient = new THREE_LIB.AmbientLight(0x444b60, 1.2);
    scenes.trophy.add(trophyAmbient);

    var trophySpot = new THREE_LIB.SpotLight(0xfffae0, 4.0, 45, Math.PI / 4, 0.3, 1.2);
    trophySpot.position.set(0, 10, 18);
    scenes.trophy.add(trophySpot);

    if (typeof Trophy3D !== "undefined" && typeof Trophy3D.buildBeltGeometry === "function") {
      trophyBeltMesh = Trophy3D.buildBeltGeometry(THREE_LIB);
      if (trophyBeltMesh) {
        trophyBeltMesh.position.set(3.1, 2.7, 8.5);
        trophyBeltMesh.scale.set(0.60, 0.60, 0.60);
        scenes.trophy.add(trophyBeltMesh);
        trophySpot.position.set(3.1, 7, 16);
        trophySpot.target = trophyBeltMesh;
      }
    }
  }

  var fxParticlePoints = null;
  var fxParticlePositions = null;
  var fxParticleColors = null;
  var fxShockwaveMeshes = [];

  function initVenueVFX() {
    if (!THREE_LIB || !scenes.venue) return;

    var MAX_FX = 1200;
    fxParticlePositions = new Float32Array(MAX_FX * 3);
    fxParticleColors = new Float32Array(MAX_FX * 3);

    for (var i = 0; i < MAX_FX; i++) {
      fxParticlePositions[i * 3 + 1] = -999;
      fxParticleColors[i * 3]     = 1.0;
      fxParticleColors[i * 3 + 1] = 1.0;
      fxParticleColors[i * 3 + 2] = 1.0;
    }

    var fxGeo = new THREE_LIB.BufferGeometry();
    fxGeo.setAttribute("position", new THREE_LIB.BufferAttribute(fxParticlePositions, 3));
    fxGeo.setAttribute("color", new THREE_LIB.BufferAttribute(fxParticleColors, 3));

    var fxMat = new THREE_LIB.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      blending: THREE_LIB.AdditiveBlending,
      depthWrite: false,
    });

    fxParticlePoints = new THREE_LIB.Points(fxGeo, fxMat);
    scenes.venue.add(fxParticlePoints);

    var ringGeo = new THREE_LIB.RingGeometry(0.8, 1.3, 32);
    ringGeo.rotateX(-Math.PI / 2);
    fxShockwaveMeshes = [];

    for (var s = 0; s < 6; s++) {
      var swMat = new THREE_LIB.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0,
        blending: THREE_LIB.AdditiveBlending,
        side: THREE_LIB.DoubleSide,
        depthWrite: false,
      });
      var swMesh = new THREE_LIB.Mesh(ringGeo, swMat);
      swMesh.visible = false;
      scenes.venue.add(swMesh);
      fxShockwaveMeshes.push(swMesh);
    }
  }

  function setTheme(themeName) {
    if (!THEME_HEX[themeName]) return false;
    state.theme = themeName;
    var th = THEME_HEX[themeName];

    if (lights.bgAmbient) lights.bgAmbient.color.setHex(th.ambient);
    if (lights.rimL) lights.rimL.color.setHex(th.primary);
    if (lights.rimR) lights.rimR.color.setHex(th.accent);
    if (cyberGrid) {
      cyberGrid.material.color.setHex(th.primary);
    }
    if (particlePoints) {
      particlePoints.material.color.setHex(th.primary);
    }
    return true;
  }

  function onMouseMove(clientX, clientY) {
    var nx = (clientX / state.width) * 2 - 1;
    var ny = -(clientY / state.height) * 2 + 1;
    state.mouse.targetX = Math.max(-1, Math.min(1, nx));
    state.mouse.targetY = Math.max(-1, Math.min(1, ny));
  }

  function resize(w, h, dpr) {
    state.width = w;
    state.height = h;
    state.dpr = dpr || state.dpr;
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (renderer) {
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(state.dpr);
    }
  }

  function setActiveScene(name) {
    if (scenes[name]) {
      state.activeScene = name;
      return true;
    }
    return false;
  }

  function setCameraMode(mode, targetFov) {
    state.cameraMode = mode;
    state.cameraT = 0;
    if (typeof targetFov === "number") {
      state.cameraTargetFov = targetFov;
    }
  }

  function updateAudioLevel(lvl) {
    state.audioLevel = Math.max(0, Math.min(1, lvl));
  }

  function triggerShake(intensity) {
    state.shake = Math.max(state.shake, intensity || 10);
  }

  function step(dt) {
    dt = dt || (clock ? clock.getDelta() : 1 / 60);
    state.cameraT += dt;

    // Mouse parallax damping
    state.mouse.x = lerp(state.mouse.x, state.mouse.targetX, dt * 5);
    state.mouse.y = lerp(state.mouse.y, state.mouse.targetY, dt * 5);

    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 25);
    }

    // Camera updates
    if (camera) {
      camera.fov = lerp(camera.fov, state.cameraTargetFov, dt * 6.0);
      camera.updateProjectionMatrix();

      // Camera base parallax in background / showcase mode
      if (state.activeScene === "background" || state.activeScene === "showcase") {
        camera.position.x = state.mouse.x * 1.8;
        camera.position.y = 4.5 + state.mouse.y * 1.2;
        camera.position.z = 20.0;
        camera.lookAt(0, 0, 0);
      }

      // Camera shake injection
      if (state.shake > 0) {
        var s = computeCameraShake(state.shake, state.cameraT);
        camera.position.x += s.x;
        camera.position.y += s.y;
        camera.position.z += s.z;
      }
    }

    // 3D Cyber grid forward rolling animation
    if (cyberGrid) {
      cyberGrid.position.z = -8 + ((state.cameraT * 4.5) % 2.0);
      // Audio reactive grid bounce
      cyberGrid.position.y = -5 + Math.sin(state.cameraT * 4) * (0.08 + state.audioLevel * 0.65);
    }

    // 3D Particles step
    if (particlePoints && particlePositions) {
      var repulseX = state.mouse.x * 25;
      var repulseY = state.mouse.y * 12;

      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var idx = i * 3;
        var v = particleVelocities[i];

        particlePositions[idx]     += v.vx * dt * 15;
        particlePositions[idx + 1] += v.vy * dt * 15;
        particlePositions[idx + 2] += v.vz * dt * 15;

        // Wrap around bounds
        if (particlePositions[idx] < -28) particlePositions[idx] = 28;
        if (particlePositions[idx] > 28)  particlePositions[idx] = -28;
        if (particlePositions[idx + 1] < -14) particlePositions[idx + 1] = 14;
        if (particlePositions[idx + 1] > 14)  particlePositions[idx + 1] = -14;
        if (particlePositions[idx + 2] < -22) particlePositions[idx + 2] = 22;
        if (particlePositions[idx + 2] > 22)  particlePositions[idx + 2] = -22;

        // Mouse repulsion
        var dx = particlePositions[idx] - repulseX;
        var dy = particlePositions[idx + 1] - repulseY;
        var distSq = dx * dx + dy * dy;
        if (distSq < 36 && distSq > 0.1) {
          var dist = Math.sqrt(distSq);
          particlePositions[idx]     += (dx / dist) * 0.15;
          particlePositions[idx + 1] += (dy / dist) * 0.15;
        }
      }
      particlePoints.geometry.attributes.position.needsUpdate = true;
    }

    // 3D Combat FX update in venue mode
    if (state.activeScene === "venue" && typeof CombatFX3D !== "undefined") {
      CombatFX3D.step(dt);

      if (fxParticlePoints && fxParticlePositions && fxParticleColors) {
        var pList = CombatFX3D.getParticles();
        var activeCount = pList.length;
        for (var pi = 0; pi < 1200; pi++) {
          var pIdx = pi * 3;
          if (pi < activeCount) {
            var pt = pList[pi];
            fxParticlePositions[pIdx]     = pt.x;
            fxParticlePositions[pIdx + 1] = pt.y;
            fxParticlePositions[pIdx + 2] = pt.z;

            var cHex = pt.color || 0xffd700;
            var cr = ((cHex >> 16) & 255) / 255;
            var cg = ((cHex >> 8) & 255) / 255;
            var cb = (cHex & 255) / 255;
            var fade = pt.life / pt.maxLife;

            fxParticleColors[pIdx]     = cr * fade;
            fxParticleColors[pIdx + 1] = cg * fade;
            fxParticleColors[pIdx + 2] = cb * fade;
          } else {
            fxParticlePositions[pIdx + 1] = -999;
          }
        }
        fxParticlePoints.geometry.attributes.position.needsUpdate = true;
        fxParticlePoints.geometry.attributes.color.needsUpdate = true;
      }

      // Shockwaves update
      if (fxShockwaveMeshes.length) {
        var swList = CombatFX3D.getShockwaves();
        for (var si = 0; si < fxShockwaveMeshes.length; si++) {
          var mesh = fxShockwaveMeshes[si];
          if (si < swList.length) {
            var sw = swList[si];
            var swScale = CombatFX3D.computeShockwaveScale(sw.radius, sw.progress);
            mesh.position.set(sw.x, sw.y, sw.z);
            mesh.scale.set(swScale.radius, 1, swScale.radius);
            mesh.material.color.setHex(sw.color || 0x22d3ee);
            mesh.material.opacity = swScale.alpha;
            mesh.visible = true;
          } else {
            mesh.visible = false;
          }
        }
      }
    }

    // Trophy belt animation in trophy mode
    if (state.activeScene === "trophy" && trophyBeltMesh) {
      if (typeof Trophy3D !== "undefined") {
        Trophy3D.step(dt);
      } else {
        trophyBeltMesh.rotation.y += dt * 0.35;
      }
    }
  }

  function render() {
    if (!renderer || !camera) return;
    var targetScene = scenes[state.activeScene] || scenes.background;
    if (targetScene) {
      renderer.render(targetScene, camera);
    }
  }

  function getThree() {
    return THREE_LIB;
  }

  function getState() {
    return state;
  }

  function getScene(name) {
    return scenes[name] || null;
  }

  function getCamera() {
    return camera;
  }

  function getRenderer() {
    return renderer;
  }

  function getLights() {
    return lights;
  }

  return {
    init: init,
    resize: resize,
    step: step,
    render: render,
    setActiveScene: setActiveScene,
    setCameraMode: setCameraMode,
    setTheme: setTheme,
    onMouseMove: onMouseMove,
    updateAudioLevel: updateAudioLevel,
    triggerShake: triggerShake,
    getState: getState,
    getScene: getScene,
    getCamera: getCamera,
    getRenderer: getRenderer,
    getLights: getLights,
    getThree: getThree,
    // Pure math exports for testing
    detectWebGL: detectWebGL,
    computeCameraOrbit: computeCameraOrbit,
    computeCameraShake: computeCameraShake,
    calculateFovForRange: calculateFovForRange,
    lerp: lerp,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = ThreeEngine;
}
