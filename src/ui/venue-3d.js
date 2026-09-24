/* =====================================================================
   Aqua Zero Heavens Arena - Procedural 3D Arenas & Ring Environments
   Luminara Digital

   Provides real 3D fighting environments in Three.js WebGL:
     - 5 procedural venues: Club, Heavens, Underground Cage, Rooftop, Void
     - Elevated platform / mat with dynamic decals & shadows
     - Dynamic 4-tier ring ropes with spring sway on rope impact (ROPES/CORNER)
     - Volumetric spotlights, floodlights, and crowd flashbulbs
     - Cinematic camera choreography: walkouts (D.INTRO), signature clash
       orbit (D.EXEC), K.O. pull-back (D.END) and pointer parallax
     - Fighter contact shadows on the mat; crowd flashbulb bursts on big
       single-frame damage
   ===================================================================== */

"use strict";

var Venue3D = (function () {
  var currentVenueId = null;
  var venueGroup = null;
  var ringGroup = null;
  var ropes = [];
  var ropeSwayPhase = 0;
  var spotLight = null;

  /* -------------------------------------------------------------------
     Duel camera choreography state. updateCamera is the page's per-frame
     hook: it is handed the live duel every rendered frame, so this is
     the only place the 3D room can read what the fight is doing. The
     amplitudes are tuned against the 2.5D composite - the fighters are
     flat sprites at screen x 200 / 760 of 960, and past a couple of
     world units of camera travel the seam between the layers reads.
     ------------------------------------------------------------------- */
  var choreo = {
    mode: null,   // "walkout" | "duel" | "clash" | "finish"
    clashT: 0,   // seconds swept into the signature orbit
    finishT: 0,  // seconds into the K.O. pull-back
    hpP: null,   // last-seen hp per side, for single-frame drop reads
    hpE: null,
    burstT: 0,   // seconds of raised flashbulb probability remaining
    shadowA: 0,  // damped contact-shadow opacity
    base: { x: 0, y: 4.5, z: 21.0 },  // the framing the lerp tracks; the
    // orbit below writes camera.position from base every frame, so base must
    // exist before the first bell-handoff frame reads it or the handoff
    // crashes on undefined (caught by venue_3d_camera suite, 2026-09-23)
    orbitAngle: 0,  // radians actually applied, eased toward the arc
    seeded: false,  // set once base has a real position to start from
  };
  var CLASH_SECONDS = 1.2;   // out-and-back inside one EXEC (~1.5s at full pace)
  var CLASH_DEG = 4;         // ~1.5 world units of swing at the duel radius 21
  var CLASH_FOV_PULL = 5;    // degrees wider at the arc peak
  var FINISH_SECONDS = 2.0;  // the K.O. pull-back, then hold for the card
  var FINISH_DEG = 6;
  var FINISH_PULLBACK = 3.5; // z 21 -> 24.5: the room widens behind the card
  var FINISH_LIFT = 1.0;     // y 4.5 -> 5.5
  var BURST_SECONDS = 1.5;
  var BURST_SHAKE = 8;       // triggerShake keeps the max, so this can never
                             // stack on the page's own 6 / 14 / 20 hit shakes
  var SWAY_X = 1.2;          // mouse parallax at the mat, world units
  var SWAY_Y = 0.5;
  var SHADOW_OPACITY_MAX = 0.45;
  var SHADOW_FADE_RATE = 3;  // ~0.8s to settle; the bell is not a snap

  /* soft radial blob shadows under the 2D fighters, built with the ring */
  var shadowMeshP = null;
  var shadowMeshE = null;
  var shadowTexture = null;

  var VENUE_PALETTES = {
    club: {
      mat: 0x2b2e3b,
      rope: 0xd8a24a,
      post: 0x8b8e96,
      ambient: 0x252a38,
      key: 0xffe8d6,
      rim: 0x22d3ee,
      fog: 0x07080a,
    },
    heavens: {
      mat: 0x3d3522,
      rope: 0xfbbf24,
      post: 0xf59e0b,
      ambient: 0x3a3020,
      key: 0xfff4cc,
      rim: 0xf59e0b,
      fog: 0x0d0b07,
    },
    underground: {
      mat: 0x1f232b,
      rope: 0x71717a,
      post: 0x3f3f46,
      ambient: 0x181c24,
      key: 0xd4d4d8,
      rim: 0x10b981,
      fog: 0x05070a,
    },
    rooftop: {
      mat: 0x3f2e24,
      rope: 0xe6392f,
      post: 0x854d0e,
      ambient: 0x2c222b,
      key: 0xfecdd3,
      rim: 0x38bdf8,
      fog: 0x0e0914,
    },
    void: {
      mat: 0x180f1e,
      rope: 0xc084fc,
      post: 0xa855f7,
      ambient: 0x200a29,
      key: 0xe879f9,
      rim: 0xe6392f,
      fog: 0x07020a,
    },
  };

  /* -------------------------------------------------------------------
     Pure Math & Kinematics Helpers (tested in Node headless)
     ------------------------------------------------------------------- */
  function computeRopeDisplacement(tier, posState, time) {
    if (posState !== "ROPES" && posState !== "CORNER") {
      return Math.sin(time * 2.5 + tier) * 0.04;
    }
    var base = posState === "CORNER" ? 0.45 : 0.28;
    var amp = base * (1.0 - tier * 0.15);
    return Math.sin(time * 8.0) * amp;
  }

  function computeSpotlightTracking(litTarget, t) {
    // litTarget: "p" (player at -6) or "e" (opponent at +6) or "both" (0)
    var targetX = 0;
    if (litTarget === "p") targetX = -6.5;
    else if (litTarget === "e") targetX = 6.5;

    var wobble = Math.sin(t * 3) * 0.2;
    return { x: targetX + wobble, y: 0, z: 0 };
  }

  function getPalette(venueId) {
    return VENUE_PALETTES[venueId] || VENUE_PALETTES.club;
  }

  function computeFlashbulbTrigger(randVal, threshold) {
    threshold = typeof threshold === "number" ? threshold : 0.85;
    return randVal >= threshold;
  }

  function computeTrussElevation() {
    return 14.5;
  }

  function computeVenueBackdropProps(venueId) {
    var types = {
      club: "warehouse_pillars",
      heavens: "celestial_obelisks",
      underground: "octagonal_cage",
      rooftop: "cyber_skyline",
      void: "floating_monoliths",
    };
    return types[venueId] || "warehouse_pillars";
  }

  /* -------------------------------------------------------------------
     Camera choreography math (pure, tested headless). Every amplitude is
     budgeted for the 2.5D composite: the fighters are flat sprites pinned
     at screen x 200 / 760 of a 960-wide canvas, and past a couple of
     world units of camera travel the seam between the layers reads.
     ------------------------------------------------------------------- */
  function clampUnit(v) {
    return v < -1 ? -1 : v > 1 ? 1 : v;
  }

  function computeClashOrbit(p) {
    // out-and-back over CLASH_SECONDS: sin() peaks mid-clash and is exactly
    // 0 at both ends, so the orbit returns itself, no blend-out needed
    var q = clamp01Num(p);
    var arc = Math.sin(q * Math.PI);
    return { deg: CLASH_DEG * arc, fovPull: CLASH_FOV_PULL * arc };
  }

  function computeFinishPullback(p) {
    // ease-in-out onto the hold values: a K.O. drifts out, then rests
    var q = clamp01Num(p);
    var e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
    return { deg: FINISH_DEG * e, lift: FINISH_LIFT * e, pull: FINISH_PULLBACK * e };
  }

  function clamp01Num(v) {
    if (typeof v !== "number" || v < 0) return 0;
    return v > 1 ? 1 : v;
  }

  function computeParallaxSway(mouseX, mouseY) {
    // the background scene answers the pointer at 1.8 / 1.2 world units;
    // the duel framing gets a smaller budget because the sprites cannot
    // follow, only the room can
    return { x: clampUnit(mouseX) * SWAY_X, y: clampUnit(mouseY) * SWAY_Y };
  }

  function computeCrowdBurst(drop, maxhp) {
    // 14 hp is a knockdown-calibre blow; 18% of a side's ceiling catches
    // the same blow on a small health pool where a flat 14 would miss it
    if (typeof drop !== "number" || drop <= 0) return false;
    if (drop >= 14) return true;
    return typeof maxhp === "number" && maxhp > 0 && drop >= maxhp * 0.18;
  }

  function computeFlashbulbChance(burst) {
    // 0.22 is the idle house-camera strobe rate; a burst is the same bulbs
    // firing 2.5x more often for 1.5s, not more cameras appearing
    return burst ? 0.55 : 0.22;
  }

  function stepFlashbulbs(states, colors, dt, chance) {
    // lifted out of updateVenueEffects so the burst effect is testable
    // without a WebGL venue: same rolls, same decay, a chance parameter
    var fire = typeof chance === "number" ? chance : computeFlashbulbChance(false);
    var updated = false;
    for (var i = 0; i < states.length; i++) {
      var fs = states[i];
      fs.cooldown -= dt;
      if (fs.cooldown <= 0) {
        if (Math.random() < fire) {
          fs.intensity = 1.0;
          fs.cooldown = 1.2 + Math.random() * 3.5;
        } else {
          fs.cooldown = 0.4 + Math.random() * 1.5;
        }
      }

      if (fs.intensity > 0) {
        fs.intensity = Math.max(0, fs.intensity - dt * 8.0);
        if (colors) {
          colors[i * 3]     = 0.05 + fs.intensity * 0.95;
          colors[i * 3 + 1] = 0.05 + fs.intensity * 0.95;
          colors[i * 3 + 2] = 0.08 + fs.intensity * 0.92;
        }
        updated = true;
      } else if (colors) {
        colors[i * 3]     = 0.03;
        colors[i * 3 + 1] = 0.03;
        colors[i * 3 + 2] = 0.05;
      }
    }
    return updated;
  }

  function computeContactShadowPlacement(range, pos, cornered, fov, camDist) {
    // screen x 200 / 760 under the live framing: halfW is the visible
    // half-width at the mat, so the blobs stay glued under the sprites
    // when the range zoom narrows the fov
    var f = (typeof fov === "number" && fov) || 50;
    var dist = (typeof camDist === "number" && camDist) || 21;
    var halfW = Math.tan((f / 2) * Math.PI / 180) * dist;
    var xP = ((200 - 480) / 480) * halfW;
    var xE = ((760 - 480) / 480) * halfW;
    var spreadMul = 1, scale = 1.25;
    if (range === "LONG") { spreadMul = 1.15; }                       // apart, at distance
    else if (range === "CLINCH") { spreadMul = 0.8; scale = 1.4; }    // chest to chest
    else if (range === "GROUND") { spreadMul = 0.7; scale = 1.5; }    // one body, down
    var shift = 0;
    if (pos === "ROPES" || pos === "CORNER") {
      shift = pos === "CORNER" ? 2.0 : 1.2;
      // both men end up on the trapped half of the ring; d.cornered names
      // who is trapped and the player's half of the mat is negative x
      shift *= cornered === "p" ? -1 : cornered === "e" ? 1 : 0;
    }
    return {
      p: { x: xP * spreadMul + shift, scale: scale },
      e: { x: xE * spreadMul + shift, scale: scale },
    };
  }

  function computeShadowFade(current, target, dt, motion) {
    // reduced motion does not animate the blobs, it lands them: a static
    // shadow is not motion, but fading one in would be
    if (!motion) return Math.min(SHADOW_OPACITY_MAX, target || 0);
    var t = Math.max(0, Math.min(1, (dt || 1 / 60) * SHADOW_FADE_RATE));
    var next = current + ((target || 0) - current) * t;
    return Math.max(0, Math.min(SHADOW_OPACITY_MAX, next));
  }

  function computeShadowTint(hex, mul) {
    // the blob reads as the mat's own colour, darkened, so it can never
    // glow on a bright venue
    var m = typeof mul === "number" ? mul : 0.32;
    var r = Math.round(((hex >> 16) & 255) * m);
    var g = Math.round(((hex >> 8) & 255) * m);
    var b = Math.round((hex & 255) * m);
    return (r << 16) | (g << 8) | b;
  }

  /* -------------------------------------------------------------------
     3D Geometry Construction
     ------------------------------------------------------------------- */
  function buildRingGeometry(THREE, palette) {
    var group = new THREE.Group();
    ropes = [];

    // 1. Elevated Canvas Platform / Mat
    var matGeo = new THREE.BoxGeometry(22, 1.2, 22);
    var matMat = new THREE.MeshStandardMaterial({
      color: palette.mat,
      roughness: 0.85,
      metalness: 0.1,
    });
    var matMesh = new THREE.Mesh(matGeo, matMat);
    matMesh.position.y = -0.6;
    matMesh.receiveShadow = true;
    group.add(matMesh);

    // 2. Corner Posts
    var postGeo = new THREE.CylinderGeometry(0.22, 0.25, 4.2, 16);
    var postMat = new THREE.MeshStandardMaterial({
      color: palette.post,
      roughness: 0.3,
      metalness: 0.8,
    });

    var postOffsets = [
      [-10, 1.5, -10],
      [10, 1.5, -10],
      [-10, 1.5, 10],
      [10, 1.5, 10],
    ];

    for (var i = 0; i < postOffsets.length; i++) {
      var post = new THREE.Mesh(postGeo, postMat);
      post.position.set(postOffsets[i][0], postOffsets[i][1], postOffsets[i][2]);
      post.castShadow = true;
      group.add(post);
    }

    // 3. 4-Tier Ring Ropes
    var ropeMat = new THREE.MeshStandardMaterial({
      color: palette.rope,
      roughness: 0.4,
      metalness: 0.6,
    });

    var ropeHeights = [0.8, 1.6, 2.4, 3.2];
    for (var r = 0; r < ropeHeights.length; r++) {
      var h = ropeHeights[r];
      // Front & Back ropes
      var rGeoH = new THREE.CylinderGeometry(0.06, 0.06, 20, 12);
      rGeoH.rotateZ(Math.PI / 2);

      var ropeF = new THREE.Mesh(rGeoH, ropeMat);
      ropeF.position.set(0, h, 10);
      group.add(ropeF);

      var ropeB = new THREE.Mesh(rGeoH, ropeMat);
      ropeB.position.set(0, h, -10);
      group.add(ropeB);

      // Left & Right ropes
      var rGeoV = new THREE.CylinderGeometry(0.06, 0.06, 20, 12);
      rGeoV.rotateX(Math.PI / 2);

      var ropeL = new THREE.Mesh(rGeoV, ropeMat);
      ropeL.position.set(-10, h, 0);
      group.add(ropeL);

      var ropeR = new THREE.Mesh(rGeoV, ropeMat);
      ropeR.position.set(10, h, 0);
      group.add(ropeR);

      ropes.push({ meshF: ropeF, meshB: ropeB, meshL: ropeL, meshR: ropeR, tier: r, baseH: h });
    }

    return group;
  }

  var flashbulbPoints = null;
  var flashbulbColors = null;
  var flashStates = [];
  var animatedVenueProps = [];

  function buildOverheadTruss(THREE, palette) {
    if (!THREE) return null;
    var trussGroup = new THREE.Group();
    var trussMat = new THREE.MeshStandardMaterial({
      color: 0x3f4452,
      metalness: 0.85,
      roughness: 0.25,
    });
    var beamGeo = new THREE.BoxGeometry(26, 0.45, 0.45);

    // 4 Horizontal Perimeter Beams at y=14.5
    var b1 = new THREE.Mesh(beamGeo, trussMat);
    b1.position.set(0, 14.5, 13);
    trussGroup.add(b1);

    var b2 = new THREE.Mesh(beamGeo, trussMat);
    b2.position.set(0, 14.5, -13);
    trussGroup.add(b2);

    var b3 = new THREE.Mesh(beamGeo, trussMat);
    b3.rotation.y = Math.PI / 2;
    b3.position.set(13, 14.5, 0);
    trussGroup.add(b3);

    var b4 = new THREE.Mesh(beamGeo, trussMat);
    b4.rotation.y = Math.PI / 2;
    b4.position.set(-13, 14.5, 0);
    trussGroup.add(b4);

    // Cross-hangers going up
    var hangerGeo = new THREE.CylinderGeometry(0.08, 0.08, 8, 8);
    var hangerCorners = [
      [-13, 18.5, -13],
      [13, 18.5, -13],
      [-13, 18.5, 13],
      [13, 18.5, 13],
    ];
    for (var i = 0; i < hangerCorners.length; i++) {
      var hg = new THREE.Mesh(hangerGeo, trussMat);
      hg.position.set(hangerCorners[i][0], hangerCorners[i][1], hangerCorners[i][2]);
      trussGroup.add(hg);
    }

    // Volumetric Downward Spotlight Cones (additive translucent light shafts)
    var coneGeo = new THREE.CylinderGeometry(0.35, 7.5, 14.5, 16, 1, true);
    coneGeo.translate(0, -7.25, 0);
    var coneMat = new THREE.MeshBasicMaterial({
      color: palette.key,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    var spotOffsets = [
      [-9, 14.5, -9],
      [9, 14.5, -9],
      [-9, 14.5, 9],
      [9, 14.5, 9],
    ];
    for (var s = 0; s < spotOffsets.length; s++) {
      var cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(spotOffsets[s][0], spotOffsets[s][1], spotOffsets[s][2]);
      cone.lookAt(spotOffsets[s][0] * 0.15, 0, spotOffsets[s][2] * 0.15);
      cone.rotateX(Math.PI / 2);
      trussGroup.add(cone);
    }

    return trussGroup;
  }

  function buildCrowdStands(THREE, palette) {
    if (!THREE) return null;
    var crowdGroup = new THREE.Group();
    var standMat = new THREE.MeshStandardMaterial({
      color: 0x0e1118,
      roughness: 0.95,
      metalness: 0.1,
    });

    // 4 Tiered Back Stands (behind ring)
    for (var t = 0; t < 4; t++) {
      var standGeo = new THREE.BoxGeometry(64, 1.8, 4);
      var stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(0, 0.9 + t * 1.8, -24 - t * 3.8);
      crowdGroup.add(stand);
    }

    // 3 Tiered Left & Right stands
    for (var s = 0; s < 3; s++) {
      var sideGeo = new THREE.BoxGeometry(4, 1.8, 48);
      var standL = new THREE.Mesh(sideGeo, standMat);
      standL.position.set(-24 - s * 3.8, 0.9 + s * 1.8, 0);
      crowdGroup.add(standL);

      var standR = new THREE.Mesh(sideGeo, standMat);
      standR.position.set(24 + s * 3.8, 0.9 + s * 1.8, 0);
      crowdGroup.add(standR);
    }

    // Dynamic camera strobe flashbulbs
    var FLASH_COUNT = 80;
    var flashPositions = new Float32Array(FLASH_COUNT * 3);
    flashbulbColors = new Float32Array(FLASH_COUNT * 3);
    flashStates = [];

    for (var i = 0; i < FLASH_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 22 + Math.random() * 16;
      flashPositions[i * 3]     = Math.sin(angle) * dist;
      flashPositions[i * 3 + 1] = 1.5 + Math.random() * 8.5;
      flashPositions[i * 3 + 2] = -16 - Math.random() * 22;

      flashbulbColors[i * 3]     = 0.05;
      flashbulbColors[i * 3 + 1] = 0.05;
      flashbulbColors[i * 3 + 2] = 0.08;

      flashStates.push({
        intensity: 0,
        cooldown: Math.random() * 3.0,
      });
    }

    var flashGeo = new THREE.BufferGeometry();
    flashGeo.setAttribute("position", new THREE.BufferAttribute(flashPositions, 3));
    flashGeo.setAttribute("color", new THREE.BufferAttribute(flashbulbColors, 3));

    var flashMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    flashbulbPoints = new THREE.Points(flashGeo, flashMat);
    crowdGroup.add(flashbulbPoints);

    return crowdGroup;
  }

  function buildVenueProps(THREE, venueId, palette) {
    if (!THREE) return null;
    var group = new THREE.Group();
    animatedVenueProps = [];

    if (venueId === "club") {
      // Industrial warehouse steel columns & glowing neon conduits
      var colGeo = new THREE.CylinderGeometry(0.7, 0.75, 22, 12);
      var colMat = new THREE.MeshStandardMaterial({ color: 0x222631, metalness: 0.8, roughness: 0.3 });
      var neonMat = new THREE.MeshBasicMaterial({ color: palette.rim });

      var colOffsets = [
        [-17, 10, -17],
        [17, 10, -17],
        [-17, 10, 17],
        [17, 10, 17],
      ];
      for (var c = 0; c < colOffsets.length; c++) {
        var col = new THREE.Mesh(colGeo, colMat);
        col.position.set(colOffsets[c][0], colOffsets[c][1], colOffsets[c][2]);
        group.add(col);

        // Neon ring around column
        var ringBandGeo = new THREE.TorusGeometry(0.8, 0.08, 8, 24);
        ringBandGeo.rotateX(Math.PI / 2);
        var ringBand = new THREE.Mesh(ringBandGeo, neonMat);
        ringBand.position.set(colOffsets[c][0], 6.0, colOffsets[c][2]);
        group.add(ringBand);
      }
    } else if (venueId === "heavens") {
      // Golden obelisks flanking corners with celestial stardust ring
      var obGeo = new THREE.CylinderGeometry(0.4, 0.85, 24, 6);
      var obMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.9,
        roughness: 0.2,
      });

      var obCorners = [
        [-16, 11, -16],
        [16, 11, -16],
        [-16, 11, 16],
        [16, 11, 16],
      ];
      for (var o = 0; o < obCorners.length; o++) {
        var ob = new THREE.Mesh(obGeo, obMat);
        ob.position.set(obCorners[o][0], obCorners[o][1], obCorners[o][2]);
        group.add(ob);
      }

      // Floating celestial halo ring orbiting above the arena
      var haloGeo = new THREE.TorusGeometry(18, 0.15, 12, 48);
      haloGeo.rotateX(Math.PI / 2);
      var haloMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.45 });
      var halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, 13.5, 0);
      group.add(halo);
      animatedVenueProps.push({ mesh: halo, rotSpeedY: 0.25 });
    } else if (venueId === "underground") {
      // Octagonal steel chainlink cage enclosure around ring
      var cageGeo = new THREE.CylinderGeometry(13.5, 13.5, 6.5, 8, 1, true);
      var cageMat = new THREE.MeshStandardMaterial({
        color: 0x71717a,
        wireframe: true,
        metalness: 0.8,
        roughness: 0.3,
      });
      var cage = new THREE.Mesh(cageGeo, cageMat);
      cage.position.set(0, 3.25, 0);
      group.add(cage);
    } else if (venueId === "rooftop") {
      // Cyberpunk high-rise skyscrapers against the horizon
      var bldgMat = new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.7, metalness: 0.5 });
      var glowMat = new THREE.MeshBasicMaterial({ color: palette.rim, transparent: true, opacity: 0.7 });

      var skylineOffsets = [
        [-40, 10, -45, 7, 24, 7],
        [-25, 14, -50, 8, 32, 8],
        [-10, 8, -42, 6, 18, 6],
        [8, 16, -48, 9, 36, 9],
        [24, 11, -44, 7, 26, 7],
        [38, 13, -52, 8, 30, 8],
      ];
      for (var k = 0; k < skylineOffsets.length; k++) {
        var sInfo = skylineOffsets[k];
        var bldgGeo = new THREE.BoxGeometry(sInfo[3], sInfo[4], sInfo[5]);
        var bldg = new THREE.Mesh(bldgGeo, bldgMat);
        bldg.position.set(sInfo[0], sInfo[1], sInfo[2]);
        group.add(bldg);

        // Antenna with glowing beacon light on top
        var antGeo = new THREE.CylinderGeometry(0.08, 0.08, 5, 6);
        var ant = new THREE.Mesh(antGeo, glowMat);
        ant.position.set(sInfo[0], sInfo[1] + sInfo[4] / 2 + 2.5, sInfo[2]);
        group.add(ant);
      }
    } else if (venueId === "void") {
      // Floating obsidian monoliths hovering and rotating slowly in deep space
      var monoMat = new THREE.MeshStandardMaterial({
        color: 0x2e1065,
        roughness: 0.2,
        metalness: 0.9,
      });
      var monoOffsets = [
        [-20, 5, -20, 1.8, 7.0],
        [20, 7, -22, 2.2, 8.5],
        [-22, 9, 18, 1.6, 6.5],
        [22, 6, 20, 2.0, 7.5],
        [0, 14, -28, 2.5, 9.0],
      ];
      for (var m = 0; m < monoOffsets.length; m++) {
        var mo = monoOffsets[m];
        var monoGeo = new THREE.BoxGeometry(mo[3], mo[4], mo[3]);
        var mono = new THREE.Mesh(monoGeo, monoMat);
        mono.position.set(mo[0], mo[1], mo[2]);
        group.add(mono);
        animatedVenueProps.push({
          mesh: mono,
          rotSpeedY: (m % 2 === 0 ? 0.35 : -0.35),
          bobFreq: 1.5 + m * 0.4,
          baseY: mo[1],
        });
      }
    }

    return group;
  }

  function buildContactShadows(THREE, palette) {
    if (!THREE) return;
    // a radial gradient canvas: a hard-edged circle reads as a sticker on
    // the mat, a soft falloff reads as light. 64px is enough; the blobs
    // sit under sprites and are never inspected up close.
    var cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    var g = cv.getContext("2d");
    // white, not black: a MeshBasicMaterial multiplies map by color, so a
    // black map would swallow the venue tint and every arena would get
    // the same grey blob. White carries the darkened-mat colour through.
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);

    shadowTexture = new THREE.CanvasTexture(cv);
    var tint = computeShadowTint(palette.mat, 0.32);
    var mk = function () {
      var mat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: tint,
        transparent: true,
        opacity: 0,   // faded in by updateCamera once the bell goes
        depthWrite: false,
      });
      var mesh = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.02;
      mesh.position.z = 0;
      mesh.visible = true;
      return mesh;
    };
    shadowMeshP = mk();
    shadowMeshE = mk();
    venueGroup.add(shadowMeshP);
    venueGroup.add(shadowMeshE);
  }

  function setupVenue(venueId) {
    if (typeof ThreeEngine === "undefined" || !ThreeEngine.getThree()) return;
    var vid = venueId || "club";
    if (currentVenueId === vid && venueGroup) return; // Cached
    var THREE = ThreeEngine.getThree();
    var scene = ThreeEngine.getScene("venue");
    if (!scene) return;

    // Clear previous venue objects
    if (venueGroup) {
      scene.remove(venueGroup);
      venueGroup = null;
    }

    currentVenueId = vid;
    var palette = getPalette(currentVenueId);
    venueGroup = new THREE.Group();

    // 1. Build ring
    ringGroup = buildRingGeometry(THREE, palette);
    venueGroup.add(ringGroup);

    // 2. Build overhead truss and volumetric spot cones
    var trussGroup = buildOverheadTruss(THREE, palette);
    if (trussGroup) venueGroup.add(trussGroup);

    // 3. Build crowd grandstands & dynamic camera flashbulbs
    var crowdGroup = buildCrowdStands(THREE, palette);
    if (crowdGroup) venueGroup.add(crowdGroup);

    // 4. Build venue-specific architectural props
    var propsGroup = buildVenueProps(THREE, currentVenueId, palette);
    if (propsGroup) venueGroup.add(propsGroup);

    // 4b. Contact shadows under the 2D fighters
    buildContactShadows(THREE, palette);

    // 5. Floor Void
    var floorGeo = new THREE.PlaneGeometry(180, 180);
    var floorMat = new THREE.MeshBasicMaterial({ color: palette.fog });
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.65;
    venueGroup.add(floorMesh);

    scene.add(venueGroup);
  }

  function updateVenueEffects(dt) {
    // 1. Update camera strobe flashbulbs. The idle strobe is 0.22; a big
    // single-frame hp drop (tracked by updateCamera, which sees the duel)
    // raises it to 0.55 for BURST_SECONDS - the crowd answers the blow.
    if (flashbulbPoints && flashbulbColors && flashStates.length) {
      var burst = choreo.burstT > 0;
      var updated = stepFlashbulbs(flashStates, flashbulbColors, dt,
        computeFlashbulbChance(burst));
      if (updated && flashbulbPoints.geometry && flashbulbPoints.geometry.attributes.color) {
        flashbulbPoints.geometry.attributes.color.needsUpdate = true;
      }
    }
    /* burstT decay moved to updateCamera (the call that sets it): decaying
       here left a camera-only caller with a burst that never ended. The
       page calls both functions every frame, so production is unchanged. */

    // 2. Update animated venue props
    for (var a = 0; a < animatedVenueProps.length; a++) {
      var item = animatedVenueProps[a];
      if (item.rotSpeedY && item.mesh) {
        item.mesh.rotation.y += item.rotSpeedY * dt;
      }
      if (item.bobFreq && item.mesh) {
        ropeSwayPhase += dt;
        item.mesh.position.y = item.baseY + Math.sin(ropeSwayPhase * item.bobFreq) * 0.45;
      }
    }
  }

  function updateRopePhysics(posState, dt) {
    ropeSwayPhase += dt;
    for (var i = 0; i < ropes.length; i++) {
      var r = ropes[i];
      var disp = computeRopeDisplacement(r.tier, posState, ropeSwayPhase);
      if (r.meshF) r.meshF.position.z = 10 + disp;
      if (r.meshB) r.meshB.position.z = -10 - disp;
      if (r.meshL) r.meshL.position.x = -10 - disp;
      if (r.meshR) r.meshR.position.x = 10 + disp;
    }
  }

  function updateCamera(camera, d, eb, dt) {
    if (!camera) return;

    /* Page consts (D) arrive after module load, so the phase enum is read
       guarded, at call time, not at load time. The old gate compared
       d.ph === 0 and commented "D.INTRO === 0": wrong enum - D.CMD is 0
       and D.INTRO is 8, so the walkout branch never fired once and every
       entrance was framed like mid-fight. */
    var PH_INTRO = (typeof D !== "undefined" && typeof D.INTRO === "number") ? D.INTRO : 8;
    var PH_EXEC = (typeof D !== "undefined" && typeof D.EXEC === "number") ? D.EXEC : 2;
    var PH_END = (typeof D !== "undefined" && typeof D.END === "number") ? D.END : 5;

    var eng = (typeof ThreeEngine !== "undefined") ? ThreeEngine : null;
    /* the page always has the engine; the fallback keeps the math honest
       for a bare require() in Node, where the tests drive fake cameras */
    var lerpCam = function (a, b, t) {
      if (eng && eng.lerp) return eng.lerp(a, b, t);
      var c = t < 0 ? 0 : t > 1 ? 1 : t;
      return a + (b - a) * c;
    };

    /* Reduced motion collapses every amplitude this function adds. The
       engine flag is the named gate; the page's own switch (SAVE.motion,
       the same signal motionOn() reads for the 2D fight) is what actually
       moves in production, so both are honoured. */
    var pageMotionOff = (typeof SAVE !== "undefined" && SAVE && SAVE.motion === false) ||
      (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    var reduced = !!(eng && eng.getState && eng.getState().reducedMotion) || pageMotionOff;

    /* 1. Walkout cinematic camera (D.INTRO). The spotlight beat eb is only
       non-null while the entrance timeline is live, so the gate is ph AND
       eb: at ph 8 with no entrance data there is nothing to frame. */
    var ph = d ? d.ph : null;
    /* the burst window decays on the camera tick, the same call that sets it:
       updateVenueEffects used to own the decay, so a caller driving only the
       camera (a replay, a test) armed a burst that never expired. The page
       calls both functions every frame, so production behaviour is unchanged. */
    if (choreo.burstT > 0) choreo.burstT = Math.max(0, choreo.burstT - dt);
    if (d && ph === PH_INTRO && eb) {
      if (choreo.mode !== "walkout") {
        choreo.mode = "walkout";
        if (eng && eng.setCameraMode) eng.setCameraMode("intro");
      }
      var spot = computeSpotlightTracking(eb.lit, eb.travel || 0);
      camera.position.x = lerpCam(camera.position.x, spot.x * 0.6, dt * 4);
      camera.position.y = lerpCam(camera.position.y, 3.5, dt * 4);
      camera.position.z = lerpCam(camera.position.z, 16.0, dt * 4);
      camera.lookAt(spot.x * 0.4, 1.2, 0);
      return;
    }

    /* Bell handoff: the framing lerp below runs on choreo.base, so base
       must start from where the walkout actually left the camera, not
       from (0,0,0), or the first post-INTRO frame would dive the camera
       through the mat before the lerp recovers. */
    if (choreo.mode === "walkout" || !choreo.seeded) {
      choreo.base.x = camera.position.x;
      choreo.base.y = camera.position.y;
      choreo.base.z = camera.position.z;
      choreo.orbitAngle = 0;
      choreo.seeded = true;
      choreo.mode = "duel";
    }

    /* 2. Crowd excitement: read both hp pools every frame. A large
       single-frame drop is the one robust "something big just happened"
       signal available without touching the page: the drop is the
       resolution of the EXEC queue landing at once. */
    if (d && d.p && d.e) {
      var drops = [];
      if (typeof choreo.hpP === "number") drops.push({ n: choreo.hpP - d.p.hp, max: d.p.maxhp || 0 });
      if (typeof choreo.hpE === "number") drops.push({ n: choreo.hpE - d.e.hp, max: d.e.maxhp || 0 });
      for (var di = 0; di < drops.length; di++) {
        if (computeCrowdBurst(drops[di].n, drops[di].max) && !reduced) {
          choreo.burstT = BURST_SECONDS;
          if (typeof ThreeEngine !== "undefined" && ThreeEngine.triggerShake) {
            ThreeEngine.triggerShake(BURST_SHAKE);
          }
        }
      }
      choreo.hpP = d.p.hp;
      choreo.hpE = d.e.hp;
    }

    /* 3. K.O. / finish pull-back. hp <= 0 is checked alongside ph because
       the duel can sit at D.END for 90 frames and the camera should be
       moving for all of them, not only from the frame the phase flips. */
    var finished = !!(d && (ph === PH_END || (d.p && d.p.hp <= 0) || (d.e && d.e.hp <= 0)));
    var range = d ? d.range : "MID";
    var targetFov = ThreeEngine.calculateFovForRange(range);
    var camZ = range === "CLINCH" || range === "GROUND" ? 17.5 : 21.0;
    var camY = range === "GROUND" ? 3.0 : 4.5;

    /* 4. Signature clash orbit: a signature committed by either side
       during EXEC. Starts on the first frame the condition is true and
       runs its 1.2s out-and-back; if the phase moves on early the
       remaining arc is blended out by the lerp below, so an interrupt
       never leaves the camera parked off-framing. */
    var clashing = !!(d && ph === PH_EXEC && (d.pSuper || d.eSuper) && !reduced);
    if (clashing) {
      if (choreo.mode !== "clash") { choreo.mode = "clash"; choreo.clashT = 0; }
      choreo.clashT += dt;
      if (typeof ThreeEngine !== "undefined" && ThreeEngine.setCameraMode) {
        ThreeEngine.setCameraMode("clash", targetFov + CLASH_FOV_PULL);
      }
    } else if (choreo.mode === "clash") {
      choreo.mode = "duel";
      choreo.clashT = 0;
      if (typeof ThreeEngine !== "undefined" && ThreeEngine.setCameraMode) {
        ThreeEngine.setCameraMode("normal", targetFov);
      }
    }

    if (finished) {
      if (choreo.mode !== "finish") { choreo.mode = "finish"; choreo.finishT = 0; }
      choreo.finishT += dt;
      if (typeof ThreeEngine !== "undefined" && ThreeEngine.setCameraMode) {
        ThreeEngine.setCameraMode("finish", targetFov);
      }
    } else if (choreo.mode === "finish") {
      choreo.mode = "duel";
      choreo.finishT = 0;
      if (typeof ThreeEngine !== "undefined" && ThreeEngine.setCameraMode) {
        ThreeEngine.setCameraMode("normal", targetFov);
      }
    }

    /* 5. Pointer parallax: the room answers the mouse, the fighters
       cannot. state.mouse is damped in ThreeEngine.step (dt * 5), the
       same curve the background scene rides. */
    var sway = { x: 0, y: 0 };
    if (!reduced && typeof ThreeEngine !== "undefined" && ThreeEngine.getState) {
      var ms = ThreeEngine.getState().mouse;
      sway = computeParallaxSway(ms.x, ms.y);
    }

    /* The lerp runs on choreo.base, never on camera.position: the orbit
       rotation below writes into camera.position every frame, and if the
       rotated value fed back into the lerp the angle would compound and
       drift. Base is the framing; camera.position is base, swung. */
    var tX = 0 + sway.x;
    var tY = camY + sway.y;
    var tZ = camZ;
    var tFov = targetFov;
    var desiredDeg = 0;
    if (choreo.mode === "clash" && !reduced) {
      var clash = computeClashOrbit(choreo.clashT / CLASH_SECONDS);
      desiredDeg = clash.deg;
      tFov = targetFov + clash.fovPull;
    } else if (choreo.mode === "finish" && !reduced) {
      var fin = computeFinishPullback(choreo.finishT / FINISH_SECONDS);
      desiredDeg = fin.deg;
      tY = camY + fin.lift;
      tZ = camZ + fin.pull;
    }

    choreo.base.x = ThreeEngine.lerp(choreo.base.x, tX, dt * 4);
    choreo.base.y = ThreeEngine.lerp(choreo.base.y, tY, dt * 4);
    choreo.base.z = ThreeEngine.lerp(choreo.base.z, tZ, dt * 4);

    /* the applied orbit angle tracks the arc through a fast lerp: smooth
       enough to follow the 1.2s sine, slow enough (tau ~0.17s) that an
       early phase exit eases the backdrop home instead of snapping */
    var wantRad = (desiredDeg * Math.PI) / 180;
    choreo.orbitAngle = ThreeEngine.lerp(choreo.orbitAngle, wantRad, dt * 6);
    var cosA = Math.cos(choreo.orbitAngle);
    var sinA = Math.sin(choreo.orbitAngle);
    camera.position.x = choreo.base.x * cosA + choreo.base.z * sinA;
    camera.position.z = -choreo.base.x * sinA + choreo.base.z * cosA;
    camera.position.y = choreo.base.y;
    camera.fov = ThreeEngine.lerp(camera.fov, tFov, dt * 5);
    camera.lookAt(0, 1.4, 0);

    /* 6. Contact shadows: fade in after the walkout, out at the end card.
       Placement follows the live fov so the blobs stay under the sprites
       as the range zoom moves. */
    if (shadowMeshP && shadowMeshE && d) {
      var showShadow = ph !== PH_INTRO && !!(d.p && d.e);
      var shadowTarget = showShadow && ph !== PH_END ? SHADOW_OPACITY_MAX : 0;
      if (reduced) {
        choreo.shadowA = shadowTarget;   // no fade animation under reduced motion
      } else {
        choreo.shadowA = computeShadowFade(choreo.shadowA, shadowTarget, dt, true);
      }
      var place = computeContactShadowPlacement(range, d.pos, d.cornered, camera.fov, camZ);
      shadowMeshP.position.x = place.p.x;
      shadowMeshP.position.z = 0;
      shadowMeshP.scale.set(place.p.scale, place.p.scale, 1);
      shadowMeshE.position.x = place.e.x;
      shadowMeshE.position.z = 0;
      shadowMeshE.scale.set(place.e.scale, place.e.scale, 1);
      shadowMeshP.material.opacity = choreo.shadowA;
      shadowMeshE.material.opacity = choreo.shadowA;
    }
  }

  return {
    setupVenue: setupVenue,
    updateRopePhysics: updateRopePhysics,
    updateVenueEffects: updateVenueEffects,
    updateCamera: updateCamera,
    getPalette: getPalette,
    computeRopeDisplacement: computeRopeDisplacement,
    computeSpotlightTracking: computeSpotlightTracking,
    computeFlashbulbTrigger: computeFlashbulbTrigger,
    computeTrussElevation: computeTrussElevation,
    computeVenueBackdropProps: computeVenueBackdropProps,
    buildOverheadTruss: buildOverheadTruss,
    buildCrowdStands: buildCrowdStands,
    buildVenueProps: buildVenueProps,
    /* the choreography math is pure and headless-testable; the state getters
       exist so a suite can assert behaviour (what the camera does) without a
       WebGL context, the same contract three-engine.test.js already uses */
    computeClashOrbit: computeClashOrbit,
    computeFinishPullback: computeFinishPullback,
    computeParallaxSway: computeParallaxSway,
    computeCrowdBurst: computeCrowdBurst,
    computeContactShadowPlacement: computeContactShadowPlacement,
    computeShadowFade: computeShadowFade,
    getChoreoState: function () {
      return {
        mode: choreo.mode,
        clashT: choreo.clashT,
        finishT: choreo.finishT,
        burstT: choreo.burstT,
        shadowA: choreo.shadowA,
        orbitAngle: choreo.orbitAngle,
        seeded: choreo.seeded,
      };
    },
    resetChoreo: function () {
      choreo.mode = null; choreo.clashT = 0; choreo.finishT = 0;
      choreo.hpP = null; choreo.hpE = null; choreo.burstT = 0;
      choreo.shadowA = 0; choreo.orbitAngle = 0; choreo.seeded = false;
      choreo.base = { x: 0, y: 4.5, z: 21.0 };
    },
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Venue3D;
}
