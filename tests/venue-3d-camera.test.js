"use strict";

/* Venue 3D camera choreography. The walkout gate here pins the bug where the
   branch compared d.ph === 0 with a comment claiming D.INTRO === 0: D.CMD is 0
   and D.INTRO is 8, so the walkout framing never fired once. Everything else
   asserts the choreography's player-visible behaviour through the exported
   pure math and state getters, with a fake camera: the amplitudes are what the
   player sees (framing moves at the walkout, orbit on a signature, pull-back
   at the finish, collapse under reduced motion), so they are what is pinned. */

module.exports = function (h) {
  const Venue3D = h.api.Venue3D || require("../src/ui/venue-3d");
  const ThreeEngine = h.api.ThreeEngine || require("../src/ui/three-engine");

  h.section("Venue 3D camera choreography");
  h.ok(typeof Venue3D.updateCamera === "function", "Venue3D.updateCamera exported");
  h.ok(typeof Venue3D.resetChoreo === "function", "Venue3D.resetChoreo exported");

  const mkCam = () => ({ position: { x: 0, y: 4.5, z: 21 }, fov: 50,
    lookAt: function () {} });
  const run = (frames, dObj, eb) => {
    const cam = mkCam();
    for (let i = 0; i < frames; i++) Venue3D.updateCamera(cam, dObj, eb, 1 / 60);
    return cam;
  };

  // ------------------------------------------------------------------
  // (1) The walkout gate. ph 8 (D.INTRO) with entrance data walks the camera
  //     down to the walkout framing; ph 0 (D.CMD, the old dead gate) does
  //     not. Convergence needs the frames: lerp(y, 3.5, dt*4) reaches
  //     within 0.2 of target after ~40 frames at 60fps, one frame gets 4.43.
  // ------------------------------------------------------------------
  h.section("Walkout gate");

  Venue3D.resetChoreo();
  const walkCam = run(90, { ph: 8, range: "MID" }, { lit: "p", travel: 0.5 });
  h.ok(Math.abs(walkCam.position.y - 3.5) < 0.15,
    "INTRO walkout: camera y settles near 3.5 after 90 frames (got " +
    walkCam.position.y.toFixed(2) + ")");
  h.ok(Math.abs(walkCam.position.z - 16.0) < 0.15,
    "INTRO walkout: camera z settles near 16.0 (got " +
    walkCam.position.z.toFixed(2) + ")");

  Venue3D.resetChoreo();
  const flatCam = run(90, { ph: 0, range: "MID" }, { lit: "p", travel: 0.5 });
  h.ok(Math.abs(flatCam.position.y - 4.5) < 0.15,
    "ph 0 (D.CMD) with eb: no walkout framing, y stays near 4.5 (got " +
    flatCam.position.y.toFixed(2) + ")");
  h.ok(Math.abs(flatCam.position.z - 21.0) < 0.15,
    "ph 0 (D.CMD) with eb: z stays near 21.0 (got " +
    flatCam.position.z.toFixed(2) + ")");

  // The bell handoff must not crash: the first frame after INTRO seeds the
  // framing from wherever the walkout left the camera (this is the crash the
  // uninitialized choreo.base produced before the fix).
  Venue3D.resetChoreo();
  let bellOk = true;
  try {
    run(30, { ph: 8, range: "MID" }, { lit: "p", travel: 0.5 });
    run(30, { ph: 0, range: "MID" }, null);
  } catch (e) { bellOk = false; }
  h.ok(bellOk, "bell handoff INTRO -> CMD frames without throwing");
  const st = Venue3D.getChoreoState();
  h.ok(st.seeded === true && st.mode === "duel",
    "after the bell the choreography is seeded in duel mode (mode=" + st.mode + ")");

  // ------------------------------------------------------------------
  // (2) Signature clash orbit: bounded, restores framing after.
  // ------------------------------------------------------------------
  h.section("Signature clash orbit");

  const clashArc = Venue3D.computeClashOrbit(0.5);
  h.ok(clashArc.deg <= 4 && clashArc.deg >= 0,
    "clash orbit bounded to the 4-degree arc at mid-swing (deg=" + clashArc.deg.toFixed(2) + ")");
  h.ok(Venue3D.computeClashOrbit(1).deg < 1e-9,
    "clash orbit returns to ~0 degrees at the end of the 1.2s arc (deg=" +
    Venue3D.computeClashOrbit(1).deg.toFixed(6) + ")");
  h.ok(Venue3D.computeClashOrbit(0).deg === 0,
    "clash orbit starts at 0 degrees");

  Venue3D.resetChoreo();
  const s = ThreeEngine.getState();
  const origReduced = s.reducedMotion;
  s.reducedMotion = false;
  const exCam = run(20, { ph: 2, range: "MID", pSuper: true, eSuper: false }, null);
  const exSt = Venue3D.getChoreoState();
  h.ok(exSt.mode === "clash", "EXEC with a signature engages clash mode (mode=" + exSt.mode + ")");
  h.ok(Math.abs(exSt.orbitAngle) > 0.001,
    "the orbit angle is actually moving during the signature (rad=" +
    exSt.orbitAngle.toFixed(4) + ")");
  h.ok(Math.abs(exCam.fov - 50) < 12 && exCam.fov >= 48,
    "clash FOV pull stays bounded near the range FOV (got " + exCam.fov.toFixed(1) + ")");

  // after the signature ends the framing restores and the mode returns
  const afterCam = run(60, { ph: 0, range: "MID", pSuper: false, eSuper: false }, null);
  const afterSt = Venue3D.getChoreoState();
  h.ok(afterSt.mode === "duel",
    "when the signature phase passes the mode returns to duel (mode=" + afterSt.mode + ")");
  h.ok(Math.abs(afterCam.position.x) < 1.0 && Math.abs(afterCam.position.z - 21.0) < 1.0,
    "framing restores after the orbit (x=" + afterCam.position.x.toFixed(2) +
    " z=" + afterCam.position.z.toFixed(2) + ")");

  // ------------------------------------------------------------------
  // (3) Reduced motion collapses the amplitudes.
  // ------------------------------------------------------------------
  h.section("Reduced motion");

  s.reducedMotion = true;
  Venue3D.resetChoreo();
  const rCam = run(60, { ph: 2, range: "MID", pSuper: true, eSuper: false }, null);
  const rSt = Venue3D.getChoreoState();
  h.ok(rSt.mode !== "clash",
    "reduced motion: a signature does not engage the orbit (mode=" + rSt.mode + ")");
  h.ok(Math.abs(rCam.position.x) < 0.05 && Math.abs(rCam.position.y - 4.5) < 0.15,
    "reduced motion: camera stays on the flat framing (x=" +
    rCam.position.x.toFixed(3) + " y=" + rCam.position.y.toFixed(2) + ")");
  s.reducedMotion = origReduced;

  // ------------------------------------------------------------------
  // (4) Contact shadow placement: LONG spread wider than CLINCH, both
  //     capped by SHADOW_OPACITY_MAX (0.45), fade computed by the frame.
  // ------------------------------------------------------------------
  h.section("Contact shadows");

  const longP = Venue3D.computeContactShadowPlacement("LONG", "CENTRE", null, 52, 21);
  const clinchP = Venue3D.computeContactShadowPlacement("CLINCH", "CENTRE", null, 38, 17.5);
  h.ok(longP.p.x < clinchP.p.x,
    "LONG places the player shadow farther out than CLINCH (" +
    longP.p.x.toFixed(2) + " vs " + clinchP.p.x.toFixed(2) + ")");
  h.ok(clinchP.p.scale > longP.p.scale,
    "CLINCH blobs are larger (chest-to-chest) than LONG (" +
    clinchP.p.scale.toFixed(2) + " vs " + longP.p.scale.toFixed(2) + ")");
  const cornerP = Venue3D.computeContactShadowPlacement("MID", "CORNER", "e", 46, 21);
  h.ok(cornerP.p.x !== clinchP.p.x || cornerP.e.x !== clinchP.e.x,
    "a cornered state shifts the shadows off the symmetric placement");

  // opacity rises toward the cap and never past it
  let a = 0;
  for (let i = 0; i < 240; i++) a = Venue3D.computeShadowFade(a, 0.45, 1 / 60, true);
  h.ok(Math.abs(a - 0.45) < 0.01,
    "shadow opacity converges to the 0.45 cap (got " + a.toFixed(3) + ")");
  let over = Venue3D.computeShadowFade(0.5, 0.45, 1 / 60, true);
  h.ok(over <= 0.45 + 1e-9,
    "shadow opacity never exceeds the cap coming from above (got " + over.toFixed(3) + ")");

  // ------------------------------------------------------------------
  // (5) Crowd burst: the pure trigger, the bounded duration, and the
  //     state flag actually set by updateCamera on a big hp drop.
  // ------------------------------------------------------------------
  h.section("Crowd burst on big damage");

  h.ok(Venue3D.computeCrowdBurst(20, 100) === true,
    "a 20-point drop on a 100hp pool is a crowd burst");
  h.ok(Venue3D.computeCrowdBurst(5, 100) === false,
    "a 5-point chip is not");
  h.ok(Venue3D.computeCrowdBurst(25, 60) === true,
    "a 25-point drop on a 60hp pool (>= 18 percent) is a burst");

  const bstate = ThreeEngine.getState();
  bstate.reducedMotion = false;
  Venue3D.resetChoreo();
  const bigDrop = { ph: 2, range: "MID",
    p: { hp: 90, maxhp: 100 }, e: { hp: 70, maxhp: 100 } };
  run(1, bigDrop, null);                     // seed hp readings
  bigDrop.e.hp = 45;                         // a 25-point single-frame drop
  run(1, bigDrop, null);
  const burstSt = Venue3D.getChoreoState();
  h.ok(burstSt.burstT > 0,
    "a big single-frame hp drop raises the flash burst window (burstT=" +
    burstSt.burstT.toFixed(2) + "s)");
  run(120, { ph: 2, range: "MID", p: { hp: 90, maxhp: 100 }, e: { hp: 45, maxhp: 100 } }, null);
  const burstSt2 = Venue3D.getChoreoState();
  h.ok(burstSt2.burstT === 0,
    "the burst window decays back to zero after ~2s (burstT=" +
    burstSt2.burstT.toFixed(2) + ")");
  bstate.reducedMotion = origReduced;
};