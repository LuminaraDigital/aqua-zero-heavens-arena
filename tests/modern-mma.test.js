/* =====================================================================
   Aqua Zero Heavens Arena - Modern Innovative MMA Systems Test Suite
   Luminara Digital
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;

  section("cage-fence mechanics & wall-walk scrambles");
  {
    ok(A.POSITIONS && A.POSITIONS.WALL_PINNED, "WALL_PINNED position exists");
    ok(A.POSITIONS.WALL_PINNED.atk.pow > 1.20, "attacker has cage leverage power");
    ok(A.POSITIONS.WALL_PINNED.trapped.escape < 0.35, "escaping cage pin requires effort");

    const duel = {
      p: { stamina: 80, cond: {} },
      e: { stamina: 70, cond: {} },
      pos: "CENTRE",
      cornered: null,
      range: "CLINCH",
    };

    const pinned = A.pinToWall(duel, duel.p, duel.e);
    ok(pinned === true, "pinned opponent to cage wall");
    ok(duel.pos === "WALL_PINNED" && duel.cornered === "e", "duel position is WALL_PINNED against e");
    ok(duel.e.cond.WALL_PINNED, "defender gained WALL_PINNED status");
    ok(A.isWallPinned(duel, duel.e) === true, "isWallPinned detects pinned defender");
    ok(A.isWallPinned(duel, duel.p) === false, "attacker is not wall-pinned");

    const getup = A.wallWalkGetup(duel, duel.e);
    ok(getup.ok === true, "wall-walk getup succeeded");
    ok(!duel.e.cond.WALL_PINNED, "WALL_PINNED status cleared after wall-walk");
    ok(duel.range === "CLINCH" && duel.pos === "ROPES", "wall-walk resets to clinch on the ropes");
    ok(duel.e.stamina < 70, "wall-walk burned defender stamina");

    const spring = A.cageSpringStrike(duel, duel.p);
    ok(spring.ok === true && spring.bonus >= 1.30, "cage spring strike grants critical leverage");
  }

  section("live 10-point must 3-judge scoring engine");
  {
    ok(Array.isArray(A.JUDGES) && A.JUDGES.length === 3, "3 distinct judges exist");
    ok(A.JUDGES.some((j) => j.id === "impact"), "Judge Miller has Impact priority");
    ok(A.JUDGES.some((j) => j.id === "control"), "Judge Sato has Control priority");
    ok(A.JUDGES.some((j) => j.id === "volume"), "Judge Gomez has Volume priority");

    // Test standard round scoring
    const round1 = {
      p: { dmgDealt: 45, strikes: 12, takedowns: 1, controlSec: 15, rockeds: 0 },
      e: { dmgDealt: 20, strikes: 6, takedowns: 0, controlSec: 0, rockeds: 0 },
    };
    const r1Scores = A.scoreRoundAllJudges(round1, 1);
    ok(r1Scores.length === 3, "scored round 1 across all 3 judges");
    ok(r1Scores.every((s) => s.scoreP === 10 && s.scoreE === 9), "round 1 scored 10-9 for Player on all cards");

    // Test dominant 10-8 round scoring
    const round2 = {
      p: { dmgDealt: 95, strikes: 24, takedowns: 2, controlSec: 45, rockeds: 2 },
      e: { dmgDealt: 10, strikes: 3, takedowns: 0, controlSec: 0, rockeds: 0 },
    };
    const r2Scores = A.scoreRoundAllJudges(round2, 2);
    ok(r2Scores.some((s) => s.dominant === true && s.scoreE === 8), "dominant round correctly awarded 10-8");

    // Decision calculation
    const allRounds = [r1Scores, r2Scores];
    const decision = A.evaluateDecision(allRounds);
    ok(decision.winner === "p", "Player won the bout on scorecards");
    ok(decision.type === "UNANIMOUS", "decision is Unanimous");
    ok(decision.summary.indexOf("Unanimous Decision") >= 0, "summary correctly formulated");

    // Split decision test
    const splitCards = [
      [{ judgeId: "impact", scoreP: 10, scoreE: 9 }, { judgeId: "control", scoreP: 10, scoreE: 9 }, { judgeId: "volume", scoreP: 9, scoreE: 10 }],
      [{ judgeId: "impact", scoreP: 10, scoreE: 9 }, { judgeId: "control", scoreP: 9, scoreE: 10 }, { judgeId: "volume", scoreP: 9, scoreE: 10 }],
      [{ judgeId: "impact", scoreP: 10, scoreE: 9 }, { judgeId: "control", scoreP: 10, scoreE: 9 }, { judgeId: "volume", scoreP: 9, scoreE: 10 }],
    ];
    const splitDec = A.evaluateDecision(splitCards);
    ok(splitDec.type === "SPLIT", "split decision correctly recognized");

    // Corner urgency prompt
    const losingCards = [
      [{ judgeId: "impact", scoreP: 9, scoreE: 10 }, { judgeId: "control", scoreP: 9, scoreE: 10 }, { judgeId: "volume", scoreP: 10, scoreE: 9 }],
      [{ judgeId: "impact", scoreP: 9, scoreE: 10 }, { judgeId: "control", scoreP: 9, scoreE: 10 }, { judgeId: "volume", scoreP: 9, scoreE: 10 }],
    ];
    const urgency = A.cornerUrgencyPrompt(losingCards, "p");
    ok(urgency.urgent === true && urgency.cardsDown >= 2, "corner alert raised when down on 2+ cards");
  }

  section("cornerman cutman & swelling occlusion protocol");
  {
    ok(A.CORNER_ACTIONS && A.CORNER_ACTIONS.ENSWELL, "ENSWELL action exists");
    ok(A.CORNER_ACTIONS.COAGULANT, "COAGULANT action exists");
    ok(A.CORNER_ACTIONS.COACH_READ, "COACH_READ action exists");
    ok(A.CORNER_ACTIONS.ICE_STAMINA, "ICE_STAMINA action exists");

    const fighter = {
      swelling: 85,
      cuts: 80,
      stamina: 30,
      maxStamina: 100,
      cond: { SWELLING_BLIND: { turns: 3 }, BLEEDING: { turns: 3 }, WINDED: { turns: 2 } },
    };

    const status = A.getCornerStatus(fighter);
    ok(status.eyeOccluded === true, "eye occlusion identified");
    ok(status.doctorStoppageRisk === true, "doctor stoppage risk identified at 80% cuts");

    // Apply enswell
    const enswellRes = A.applyCornerAction(fighter, "ENSWELL");
    ok(enswellRes.ok === true, "enswell applied");
    ok(fighter.swelling < 85, "swelling reduced");
    ok(!fighter.cond.SWELLING_BLIND, "SWELLING_BLIND cleared by enswell");

    // Apply coagulant
    const coagRes = A.applyCornerAction(fighter, "COAGULANT");
    ok(coagRes.ok === true, "cut coagulant applied");
    ok(fighter.cuts < 80, "facial cuts reduced");
    ok(!fighter.cond.BLEEDING, "BLEEDING cleared by coagulant");

    // Apply coach read
    const coachRes = A.applyCornerAction(fighter, "COACH_READ");
    ok(coachRes.ok === true && fighter.coachRead === true, "coach tactical read activated");

    // Apply ice stamina
    const iceRes = A.applyCornerAction(fighter, "ICE_STAMINA");
    ok(iceRes.ok === true && fighter.stamina > 30, "stamina restored by ice sponge");
    ok(!fighter.cond.WINDED, "WINDED cleared by ice recovery");

    // Check doctor stoppage thresholds
    const severeFighter = { cuts: 96 };
    const docCheck = A.checkDoctorStoppage(severeFighter);
    ok(docCheck.stoppage === true, "catastrophic cuts trigger doctor stoppage");
  }

  section("peroneal nerve dead-leg & stance dynamics");
  {
    ok(A.STATUS && A.STATUS.DEAD_LEG, "DEAD_LEG status defined in STATUS table");
    ok(A.STATUS.DEAD_LEG.spd < 1.0, "DEAD_LEG inflicts speed penalty");

    const side = {
      maxhp: 100,
      stance: "orthodox",
      zones: { head: 100, body: 100, legs: 100, max: 100 },
      cond: {},
    };

    // Damage leg down past 35%
    A.hurtZone(side, "legs", 70);
    ok(side.zones.legs <= 30, "leg zone damaged below 35%");
    ok(side.cond.DEAD_LEG, "DEAD_LEG condition triggered on critical leg damage");
    ok(side.stance === "southpaw", "stance involuntarily switched to protect damaged lead leg");

    // Test initiative penalty
    const tech = { disc: "boxing", speed: 50, prio: 0, stam: 10 };
    const initNormal = A.initiativeOf({ cond: {} }, tech, () => 0.5);
    const initDeadLeg = A.initiativeOf({ cond: { DEAD_LEG: true } }, tech, () => 0.5);
    ok(initDeadLeg < initNormal, "dead leg significantly slows down initiative");

    // Test stamina penalty
    const stamNormal = A.staminaCost({ cond: {} }, tech);
    const stamDeadLeg = A.staminaCost({ cond: { DEAD_LEG: true } }, tech);
    ok(stamDeadLeg > stamNormal, "dead leg increases stamina cost of movement and footwork");
  }

  section("fight-week weight cut & rehydration engine");
  {
    ok(A.WEIGHT_CUT_PROFILES && A.WEIGHT_CUT_PROFILES.CHAMPIONSHIP_CUT, "CHAMPIONSHIP_CUT profile exists");
    ok(A.WEIGHT_CUT_PROFILES.NATURAL_WEIGHT, "NATURAL_WEIGHT profile exists");
    ok(A.WEIGHT_CUT_PROFILES.DISCIPLINED_CUT, "DISCIPLINED_CUT profile exists");

    const fighterHardCut = {
      reach: 72,
      zones: { head: 100, body: 100, legs: 100, max: 100 },
    };
    A.applyWeightCut(fighterHardCut, "CHAMPIONSHIP_CUT");
    ok(fighterHardCut.reach === 76, "championship cut provides +4 reach leverage");
    ok(fighterHardCut.zones.head === 85, "championship cut dehydrates head health (-15%)");
    ok(fighterHardCut.weightPowerBonus === 0.12, "early power bonus recorded (+12%)");
    ok(fighterHardCut.weightCardioMod === 0.20, "late cardio penalty recorded (+20%)");

    const fighterNatural = {
      reach: 72,
      zones: { head: 100, body: 100, legs: 100, max: 100 },
    };
    A.applyWeightCut(fighterNatural, "NATURAL_WEIGHT");
    ok(fighterNatural.zones.head === 115, "natural weight grants +15% head health (granite chin)");
    ok(fighterNatural.weightCardioMod === -0.25, "natural weight improves cardio recovery by 25%");
    ok(fighterNatural.weightPowerBonus === -0.08, "natural weight has modest -8% power concession");

    // Test stamina cost past turn 6 with weight cardio penalty
    const tech = { disc: "boxing", speed: 50, prio: 0, stam: 20 };
    const costEarly = A.staminaCost(fighterHardCut, tech, { turn: 2 });
    const costLate = A.staminaCost(fighterHardCut, tech, { turn: 8 });
    ok(costLate > costEarly, "hard weight cut increases stamina cost in late rounds (turn > 6)");
  }
};
