"use strict";

module.exports = function (h) {
  h.section("Three.js WebGL Engine, 3D Arenas, Cards, VFX & Trophy Suite");

  const ThreeEngine = h.api.ThreeEngine || require("../src/ui/three-engine");
  const Venue3D = h.api.Venue3D || require("../src/ui/venue-3d");
  const Card3D = h.api.Card3D || require("../src/ui/card-3d");
  const CombatFX3D = h.api.CombatFX3D || require("../src/ui/combat-fx-3d");
  const Trophy3D = h.api.Trophy3D || require("../src/ui/trophy-3d");

  // -----------------------------------------------------------------
  // 1. Core ThreeEngine & Camera Kinematics
  // -----------------------------------------------------------------
  h.ok(typeof ThreeEngine === "object", "ThreeEngine object is defined");
  h.ok(typeof ThreeEngine.detectWebGL === "function", "detectWebGL exported");
  h.ok(ThreeEngine.detectWebGL() === false, "detectWebGL cleanly reports false in headless environment");

  const orbit = ThreeEngine.computeCameraOrbit(20, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  h.ok(Math.round(orbit.x) === 20, "Orbit X coordinate at 90 deg is equal to radius");
  h.ok(Math.round(orbit.z) === 0, "Orbit Z coordinate at 90 deg is 0");
  h.ok(orbit.y === 5, "Orbit height is preserved");

  const shakeZero = ThreeEngine.computeCameraShake(0, 1.0);
  h.ok(shakeZero.x === 0 && shakeZero.y === 0 && shakeZero.z === 0, "Zero intensity produces zero shake");

  const shakeActive = ThreeEngine.computeCameraShake(10, 0.5);
  h.ok(typeof shakeActive.x === "number" && typeof shakeActive.y === "number", "Active intensity produces camera offset");

  h.ok(ThreeEngine.calculateFovForRange("LONG") === 52, "LONG range uses wide FOV (52)");
  h.ok(ThreeEngine.calculateFovForRange("MID") === 46, "MID range uses standard FOV (46)");
  h.ok(ThreeEngine.calculateFovForRange("CLINCH") === 38, "CLINCH range uses tight FOV (38)");
  h.ok(ThreeEngine.calculateFovForRange("GROUND") === 34, "GROUND range uses intimate FOV (34)");

  h.ok(ThreeEngine.lerp(10, 20, 0.5) === 15, "Linear interpolation computes midpoint");
  h.ok(ThreeEngine.lerp(10, 20, 0) === 10, "Lerp at t=0 returns start value");
  h.ok(ThreeEngine.lerp(10, 20, 1) === 20, "Lerp at t=1 returns end value");

  ThreeEngine.updateAudioLevel(0.75);
  h.ok(ThreeEngine.getState().audioLevel === 0.75, "Audio level updated in engine state");

  ThreeEngine.triggerShake(15);
  h.ok(ThreeEngine.getState().shake >= 15, "Camera shake triggered and stored");

  // -----------------------------------------------------------------
  // 2. Procedural 3D Venues & Ropes
  // -----------------------------------------------------------------
  h.ok(typeof Venue3D === "object", "Venue3D object is defined");
  const clubPal = Venue3D.getPalette("club");
  h.ok(typeof clubPal.mat === "number" && typeof clubPal.rope === "number", "Club palette defined with hex colors");

  const heavensPal = Venue3D.getPalette("heavens");
  h.ok(heavensPal.rope === 0xfbbf24, "Heavens palette uses golden ropes");

  const voidPal = Venue3D.getPalette("void");
  h.ok(voidPal.rope === 0xc084fc, "Void palette uses purple ropes");

  const neutralRope = Venue3D.computeRopeDisplacement(0, "CENTRE", 1.0);
  h.ok(Math.abs(neutralRope) <= 0.05, "Neutral stance has minimal idle rope sway");

  const ropesContact = Venue3D.computeRopeDisplacement(0, "ROPES", 1.0);
  h.ok(Math.abs(ropesContact) <= 0.35, "ROPES contact triggers spring sway");

  const cornerContact = Venue3D.computeRopeDisplacement(0, "CORNER", 1.0);
  h.ok(Math.abs(cornerContact) <= 0.55, "CORNER pressure triggers maximum rope displacement");

  const spotP = Venue3D.computeSpotlightTracking("p", 1.0);
  h.ok(spotP.x < 0, "Player spotlight tracks to left side of ring");

  const spotE = Venue3D.computeSpotlightTracking("e", 1.0);
  h.ok(spotE.x > 0, "Opponent spotlight tracks to right side of ring");

  h.ok(Venue3D.computeTrussElevation() === 14.5, "Overhead steel truss is elevated at 14.5 units");
  h.ok(Venue3D.computeFlashbulbTrigger(0.9, 0.85) === true, "High random roll triggers camera strobe flashbulb");
  h.ok(Venue3D.computeFlashbulbTrigger(0.4, 0.85) === false, "Low random roll does not trigger flashbulb");
  h.ok(Venue3D.computeVenueBackdropProps("club") === "warehouse_pillars", "Club venue uses warehouse pillars");
  h.ok(Venue3D.computeVenueBackdropProps("heavens") === "celestial_obelisks", "Heavens venue uses celestial obelisks");
  h.ok(Venue3D.computeVenueBackdropProps("underground") === "octagonal_cage", "Underground venue uses octagonal cage");
  h.ok(Venue3D.computeVenueBackdropProps("rooftop") === "cyber_skyline", "Rooftop venue uses cyber skyline");
  h.ok(Venue3D.computeVenueBackdropProps("void") === "floating_monoliths", "Void venue uses floating monoliths");

  // -----------------------------------------------------------------
  // 3. Tangible 3D Combat Cards & Holographic Foil
  // -----------------------------------------------------------------
  h.ok(typeof Card3D === "object", "Card3D object is defined");
  h.ok(Card3D.CARD_WIDTH > 0 && Card3D.CARD_HEIGHT > 0, "Card dimensions defined");

  const fanMid = Card3D.computeCardFanTransform(2, 5, -1, 0);
  h.ok(Math.abs(fanMid.x) < 0.001, "Center card in 5-card fan is centered at X=0");

  const fanLeft = Card3D.computeCardFanTransform(0, 5, -1, 0);
  h.ok(fanLeft.x < 0 && fanLeft.rotZ > 0, "Leftmost card is positioned left with clockwise rotation");

  const fanRight = Card3D.computeCardFanTransform(4, 5, -1, 0);
  h.ok(fanRight.x > 0 && fanRight.rotZ < 0, "Rightmost card is positioned right with counter-clockwise rotation");

  const hoverCard = Card3D.computeCardFanTransform(2, 5, 2, 0);
  h.ok(hoverCard.y > fanMid.y, "Hovered card elevates upwards");
  h.ok(hoverCard.z > fanMid.z, "Hovered card moves forward towards camera");
  h.ok(hoverCard.scale > 1.0, "Hovered card scales up");

  const launchCard = Card3D.computeCardFanTransform(2, 5, 2, 0.5);
  h.ok(launchCard.z > hoverCard.z, "Played card arcs forward in Z towards the ring");

  const foilSheen = Card3D.computeFoilIridescence(0.2, 0.9);
  h.ok(foilSheen.hue >= 0 && foilSheen.hue <= 360, "Foil iridescence computes valid hue angle");
  h.ok(foilSheen.intensity >= 0 && foilSheen.intensity <= 1, "Foil intensity normalized between 0 and 1");

  h.ok(typeof Card3D.initHand === "function", "Card3D.initHand function exported");
  h.ok(typeof Card3D.syncHand === "function", "Card3D.syncHand function exported");
  h.ok(typeof Card3D.hideHand === "function", "Card3D.hideHand function exported");
  Card3D.hideHand();
  h.ok(true, "Card3D.hideHand survives without active WebGL context");

  // -----------------------------------------------------------------
  // 4. GPU Combat VFX & 3D Particle Systems
  // -----------------------------------------------------------------
  h.ok(typeof CombatFX3D === "object", "CombatFX3D object is defined");

  const particle = CombatFX3D.createParticle({ x: 0, y: 1, z: 0 }, { x: 2, y: 5, z: 0 }, 0xffd700, 0.5, 1.2);
  h.ok(particle.y === 1 && particle.life === 0.5, "Particle initialized with origin and lifetime");

  const pList = [particle];
  CombatFX3D.stepParticleList(pList, 0.1);
  h.ok(pList[0].life === 0.4, "Particle lifetime decreases on physics step");
  h.ok(pList[0].x > 0, "Particle moves along velocity vector");

  CombatFX3D.stepParticleList(pList, 0.5);
  h.ok(pList.length === 0, "Expired particle removed from buffer");

  const swScale = CombatFX3D.computeShockwaveScale(10, 0.5);
  h.ok(swScale.radius > 2 && swScale.radius < 10, "Shockwave expands progressively");
  h.ok(swScale.alpha < 0.85, "Shockwave alpha fades over progress");

  const aura = CombatFX3D.computeAuraPulse(1.0, 1.0);
  h.ok(aura.scale >= 0.8 && aura.scale <= 1.25, "Aura pulsates around unit scale");
  h.ok(aura.alpha > 0, "Aura alpha remains positive");

  CombatFX3D.spawnClashSparks({ x: 0, y: 2, z: 0 }, 15, 0xffaa00);
  h.ok(CombatFX3D.getParticles().length === 15, "Clash sparks spawned in buffer");

  CombatFX3D.spawnShockwave({ x: 0, y: 0, z: 0 }, 8.0, 0x22d3ee);
  h.ok(CombatFX3D.getShockwaves().length > 0, "Shockwave added to active queue");

  // -----------------------------------------------------------------
  // 5. 3D Trophy Room & Spire Tower Progression
  // -----------------------------------------------------------------
  h.ok(typeof Trophy3D === "object", "Trophy3D object is defined");

  const rotDamped = Trophy3D.computeTrophyRotation(0, 1.0, 0.05);
  h.ok(rotDamped > 0 && rotDamped < 1.0, "Trophy rotation smoothly damps toward target");

  h.ok(Trophy3D.computeTowerFloorElevation(1) === 0, "Floor 1 elevation is ground level (0)");
  h.ok(Trophy3D.computeTowerFloorElevation(10) === 9 * 1.4, "Floor 10 elevation is 9 * floorHeight");

  const towerCam = Trophy3D.computeTowerCameraFraming(1, 10, 0.5);
  h.ok(towerCam.camY > Trophy3D.computeTowerFloorElevation(1), "Tower camera pans vertically between floors");
  h.ok(towerCam.camRadius === 18.0, "Tower camera maintains orbit radius");

  const dummyMesh = { rotation: { y: 0 } };
  Trophy3D.setMesh(dummyMesh);
  h.ok(Trophy3D.getMesh() === dummyMesh, "Trophy3D mesh setter and getter work cleanly");
};
