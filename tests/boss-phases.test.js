/* =====================================================================
   Aqua Zero Heavens Arena - Multi-Phase Tower Boss Test Suite
   Luminara Digital
   ===================================================================== */

module.exports = function (h) {
  const { api, ok, section } = h;

  section("Multi-Phase Tower Bosses & Milestone Encounters");

  const tm = (api && api.TowerMode) || (typeof global !== "undefined" && global.TowerMode) || require("../src/modes/tower");
  ok(tm !== null && typeof tm === "object", "TowerMode object should be defined");

  tm.init();
  tm.getState().unlockedFloors = 200;
  ok(tm.getState().maxFloor === 200, "tower max floor is 200");

  // Check Milestone Boss Definitions
  ok(tm.MILESTONE_BOSSES[50] !== undefined, "Floor 50 milestone boss defined");
  ok(tm.MILESTONE_BOSSES[100] !== undefined, "Floor 100 milestone boss defined");
  ok(tm.MILESTONE_BOSSES[150] !== undefined, "Floor 150 milestone boss defined");
  ok(tm.MILESTONE_BOSSES[200] !== undefined, "Floor 200 final boss defined");

  const floor50Boss = tm.MILESTONE_BOSSES[50];
  ok(floor50Boss.phases === 2, "floor 50 boss has 2 phases");
  ok(floor50Boss.phase2Threshold === 0.30, "floor 50 boss second wind triggers at 30% HP");

  const floor200Boss = tm.MILESTONE_BOSSES[200];
  ok(floor200Boss.phases === 3, "floor 200 final sovereign has 3 phases");

  // Test Phase Transition Trigger
  tm.startFloor(50);
  // Boss at 80% HP -> Phase 1
  let trans = tm.checkBossPhaseTransition(50, 80, 100);
  ok(trans === null, "no phase transition at 80% HP");

  // Boss at 25% HP -> Triggers Phase 2 Second Wind
  trans = tm.checkBossPhaseTransition(50, 25, 100);
  ok(trans !== null && trans.phase === 2, "phase 2 transition triggered at 25% HP");
  ok(trans.buff.dmgMul === 1.15, "phase 2 provides 1.15x damage buff");
  ok(trans.buff.stamRecover === 30, "phase 2 provides +30 stamina recovery");

  // Test Floor 200 Three-Phase Transitions
  tm.startFloor(200);
  // Phase 1 -> Phase 2 at 60% HP
  let transF200P2 = tm.checkBossPhaseTransition(200, 60, 100);
  ok(transF200P2 !== null && transF200P2.phase === 2, "floor 200 phase 2 triggered at 60% HP");

  // Phase 2 -> Phase 3 at 25% HP
  let transF200P3 = tm.checkBossPhaseTransition(200, 25, 100);
  ok(transF200P3 !== null && transF200P3.phase === 3, "floor 200 phase 3 triggered at 25% HP");
  ok(transF200P3.buff.dmgMul === 1.40, "final phase grants massive 1.40x damage buff");
};
