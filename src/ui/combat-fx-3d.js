/* =====================================================================
   Aqua Zero Heavens Arena - GPU Combat VFX & 3D Particle Systems
   Luminara Digital

   Provides hardware-accelerated 3D combat visual effects:
     - High-count GPU clash sparks, blood droplets, and directional impact sprays
     - 3D Expanding Shockwave blast rings on heavy strikes and counter hits
     - Character Resonance & Desperation Auras (volumetric energy pulsation)
     - Dynamic 3D camera impulse & hit-stop coordination
   ===================================================================== */

"use strict";

var CombatFX3D = (function () {
  var MAX_PARTICLES = 1200;
  var particles = [];
  var shockwaves = [];
  var particleMesh = null;
  var shockwaveMeshes = [];

  /* -------------------------------------------------------------------
     Pure Math & Particle Physics (testable in Node headless)
     ------------------------------------------------------------------- */
  function createParticle(origin, velocity, color, life, size) {
    return {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: velocity.x,
      vy: velocity.y,
      vz: velocity.z,
      color: color || 0x22d3ee,
      maxLife: life || 0.6,
      life: life || 0.6,
      size: size || 1.0,
    };
  }

  function stepParticleList(list, dt) {
    if (!list) return;
    var gravity = -9.8;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += gravity * dt * 0.4;
      p.vx *= 0.96;
      p.vz *= 0.96;
    }
  }

  function computeShockwaveScale(radius, progress) {
    var p = Math.max(0, Math.min(1, progress));
    var currentRadius = radius * (0.2 + 0.8 * Math.sqrt(p));
    var alpha = (1.0 - p) * 0.85;
    return {
      radius: currentRadius,
      alpha: alpha,
    };
  }

  function computeAuraPulse(time, intensity) {
    var freq = 6.0;
    var wave = Math.sin(time * freq) * 0.12 + Math.cos(time * freq * 1.7) * 0.06;
    return {
      scale: 1.0 + wave * intensity,
      alpha: 0.35 + wave * 0.4 * intensity,
    };
  }

  /* -------------------------------------------------------------------
     3D Geometry & Emitter Operations
     ------------------------------------------------------------------- */
  function spawnClashSparks(pos, count, colorHex) {
    count = count || 35;
    colorHex = colorHex || 0xffd700;
    for (var i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      var theta = Math.random() * Math.PI * 2;
      var phi = (Math.random() - 0.5) * Math.PI;
      var speed = 4.0 + Math.random() * 8.0;

      particles.push(createParticle(
        pos,
        {
          x: Math.cos(theta) * Math.cos(phi) * speed,
          y: Math.sin(phi) * speed + 2.0,
          z: Math.sin(theta) * Math.cos(phi) * speed,
        },
        colorHex,
        0.35 + Math.random() * 0.35,
        1.5 + Math.random() * 2.0
      ));
    }
  }

  function spawnShockwave(pos, maxRadius, colorHex) {
    shockwaves.push({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      radius: maxRadius || 6.0,
      progress: 0.0,
      speed: 2.2,
      color: colorHex || 0x22d3ee,
    });
  }

  function step(dt) {
    stepParticleList(particles, dt);

    for (var i = shockwaves.length - 1; i >= 0; i--) {
      var sw = shockwaves[i];
      sw.progress += sw.speed * dt;
      if (sw.progress >= 1.0) {
        shockwaves.splice(i, 1);
      }
    }
  }

  function getParticles() {
    return particles;
  }

  function getShockwaves() {
    return shockwaves;
  }

  return {
    createParticle: createParticle,
    stepParticleList: stepParticleList,
    computeShockwaveScale: computeShockwaveScale,
    computeAuraPulse: computeAuraPulse,
    spawnClashSparks: spawnClashSparks,
    spawnShockwave: spawnShockwave,
    step: step,
    getParticles: getParticles,
    getShockwaves: getShockwaves,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = CombatFX3D;
}
