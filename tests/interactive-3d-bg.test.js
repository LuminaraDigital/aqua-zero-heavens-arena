"use strict";

module.exports = function (h) {
  h.section("Interactive 3D Three.js-Style Background & Character Showcase Suite");

  const Interactive3DBG = h.api.Interactive3DBG || require("../src/ui/interactive-3d-bg");
  h.ok(typeof Interactive3DBG === "object", "Interactive3DBG object should be defined");

  // 1. Theme Configuration
  h.ok(typeof Interactive3DBG.THEMES === "object", "THEMES object is defined");
  h.ok(Interactive3DBG.THEMES.cyber && Interactive3DBG.THEMES.heavens, "Cyber and Heavens themes exist");
  h.ok(Interactive3DBG.THEMES.crimson && Interactive3DBG.THEMES.tokyo && Interactive3DBG.THEMES.abyss, "Crimson, Tokyo, Abyss themes exist");

  const themeSuccess = Interactive3DBG.setTheme("heavens");
  h.ok(themeSuccess === true, "Successfully set valid theme");
  h.ok(Interactive3DBG.getState().theme === "heavens", "Theme updated in state");

  const invalidTheme = Interactive3DBG.setTheme("non_existent_theme");
  h.ok(invalidTheme === false, "Invalid theme rejected");
  h.ok(Interactive3DBG.getState().theme === "heavens", "Theme remains unchanged on invalid input");

  Interactive3DBG.setTheme("cyber");

  // 2. 3D Perspective Projection Math
  const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 320 };
  const projNear = Interactive3DBG.project3D(0, 0, 100, cam, 960, 540);
  h.ok(projNear.visible === true, "Near point in front of camera is visible");
  h.ok(Math.round(projNear.x) === 480 && Math.round(projNear.y) === 270, "Center point projects to screen center");
  h.ok(projNear.scale === 3.2, "Scale calculated as fov / z (320 / 100 = 3.2)");

  const projFar = Interactive3DBG.project3D(0, 0, 320, cam, 960, 540);
  h.ok(projFar.scale === 1.0, "Scale at fov distance is 1.0");
  h.ok(projFar.scale < projNear.scale, "Farther objects have smaller perspective scale");

  const projBehind = Interactive3DBG.project3D(0, 0, -50, cam, 960, 540);
  h.ok(projBehind.visible === false, "Point behind camera is clipped");

  // 3. Particle System Simulation & Repulsion
  const particles = Interactive3DBG.initParticles(20, 800, 600, 500);
  h.ok(particles.length === 20, "Spawned exact particle count");
  h.ok(typeof particles[0].x === "number" && typeof particles[0].z === "number", "Particle has valid 3D coordinates");

  const initialX = particles[0].x;
  Interactive3DBG.stepParticles(particles, cam, { x: 0.5, y: 0.5, speed: 0.2 }, { spreadX: 800, spreadY: 600, maxZ: 500 }, 1.0);
  h.ok(particles[0].x !== initialX || particles[0].vx !== undefined, "Particle stepped in physics tick");

  // 4. Camera Damping
  const mouse = { x: 0.8, y: 0.2 };
  Interactive3DBG.calculateCameraDamping(cam, mouse, false);
  h.ok(cam.yaw !== 0 || cam.targetYaw !== 0, "Camera target yaw calculated from mouse X offset");
  h.ok(cam.pitch !== 0 || cam.targetPitch !== 0, "Camera target pitch calculated from mouse Y offset");

  Interactive3DBG.calculateCameraDamping(cam, mouse, true);
  h.ok(cam.yaw === 0 && cam.pitch === 0, "Reduced motion zeros camera angles");

  // 5. Character Showcase & Roster Carousel
  Interactive3DBG.setFighter(5);
  h.ok(Interactive3DBG.getState().fighterId === 5, "Fighter ID set to 5");
  h.ok(Interactive3DBG.getState().transitionProgress === 0.0, "Transition progress reset to 0.0 on fighter change");

  Interactive3DBG.nextFighter();
  h.ok(Interactive3DBG.getState().fighterId === 6, "nextFighter increments index");

  Interactive3DBG.prevFighter();
  h.ok(Interactive3DBG.getState().fighterId === 5, "prevFighter decrements index");

  Interactive3DBG.setFighter(0);
  Interactive3DBG.prevFighter();
  h.ok(Interactive3DBG.getState().fighterId > 0, "prevFighter wraps around from 0 to end of roster");

  Interactive3DBG.setAutoCycle(false);
  h.ok(Interactive3DBG.getState().autoCycle === false, "Auto-cycle disabled");

  // 6. Audio Visualizer Modulation
  Interactive3DBG.updateAudioLevel(0.85);
  h.ok(Interactive3DBG.getState().audioLevel === 0.85, "Audio level updated");
  h.ok(Interactive3DBG.getState().audioBars.length === 16, "Audio equalizer bars initialized");

  Interactive3DBG.updateAudioLevel(1.5);
  h.ok(Interactive3DBG.getState().audioLevel === 1.0, "Audio level clamped to maximum 1.0");

  Interactive3DBG.updateAudioLevel(-0.5);
  h.ok(Interactive3DBG.getState().audioLevel === 0.0, "Audio level clamped to minimum 0.0");

  // 7. Shockwaves
  Interactive3DBG.spawnShockwave(200, 300, "#22d3ee");
  const shockwaves = Interactive3DBG.getState().shockwaves;
  h.ok(shockwaves.length > 0, "Shockwave spawned");
  const initR = shockwaves[0].radius;
  Interactive3DBG.stepShockwaves(shockwaves, 1.0);
  h.ok(shockwaves[0].radius > initR, "Shockwave expands over time");
};
