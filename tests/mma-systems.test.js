/* =====================================================================
   Aqua Zero Heavens Arena - MMA Fighter Combat & Meta-Systems Tests
   Luminara Digital
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;

  section("multi-stage ground submission engine");
  {
    const makeFighter = (name, disc) => ({
      fid: 0, name, hp: 100, maxhp: 100, stam: 60, maxStam: 60,
      discs: [disc], cond: {}, atkMul: 1, defMul: 1, spdMul: 1, stamMul: 1,
      techs: A.knownTechs(0, 9),
    });

    const p = makeFighter("Attacker", "bjj");
    const e = makeFighter("Defender", "boxing");
    const d = { range: "GROUND", p, e, pos: "CENTRE", turn: 1 };

    // Stage 1: Initial Submission catch
    const rnc = A.TECH.rnc;
    const ev1 = A.executeTechnique(d, p, e, rnc, null, () => 0.01);
    ok(ev1.hit === true, "submission technique landed");
    ok(d.subStage === 1, "duel advanced to submission stage 1");
    ok(d.subAttacker === p, "attacker recorded on duel");
    ok(A.hasStatus(e, "SUB_TRAPPED"), "defender afflicted with SUB_TRAPPED");
    ok(ev1.note && ev1.note.indexOf("STAGE 1") >= 0, "event note logs stage 1 trap");

    // Stage 2: Figure-four lock advance
    const stamBefore = e.stam;
    const ev2 = A.executeTechnique(d, p, e, rnc, null, () => 0.01);
    ok(d.subStage === 2, "duel advanced to submission stage 2");
    ok(A.hasStatus(e, "SUB_LOCKED"), "defender afflicted with SUB_LOCKED");
    ok(!A.hasStatus(e, "SUB_TRAPPED"), "SUB_TRAPPED replaced by SUB_LOCKED");
    ok(e.stam < stamBefore, "locking submission drained defender stamina");
    ok(ev2.note && ev2.note.indexOf("STAGE 2") >= 0, "event note logs stage 2 lock");

    // Escape regression: defender uses an escape technique
    const escTech = A.TECH.scissor_sweep; // has sweep flag
    const evEsc = A.executeTechnique(d, e, p, escTech, null, () => 0.01);
    ok(d.subStage === 1, "escape regressed submission to stage 1");
    ok(evEsc.subRegressed === true, "event recorded submission regression");

    // Second escape breaks the submission completely
    const evEsc2 = A.executeTechnique(d, e, p, escTech, null, () => 0.01);
    ok(d.subStage === 0, "second escape broke submission completely");
    ok(evEsc2.subBroken === true, "event recorded submission broken");
    ok(!A.hasStatus(e, "SUB_TRAPPED") && !A.hasStatus(e, "SUB_LOCKED"), "all submission statuses removed");

    // Stage 3 on a fresh defender: he survives the crank. Three landed subs
    // used to be a finish at any HP, which is why fights were ending on turn 4.
    d.subStage = 2;
    d.subAttacker = p;
    d.subDefender = e;
    A.addStatus(e, "SUB_LOCKED");
    const evCrank = A.executeTechnique(d, p, e, rnc, null, () => 0.01);
    ok(evCrank.subCranked === true && !evCrank.tapout, "a man with most of his health left survives the crank");
    ok(d.subStage === 2 && e.hp > 0, "and the lock stays at stage 2 rather than ending the fight", d.subStage + " / " + e.hp);
    ok(evCrank.dmg > ev2.dmg, "but the crank is the heaviest hit of the ladder", evCrank.dmg + " vs " + ev2.dmg);

    // Stage 3 on a worn defender (30% HP window): Tapout Stoppage
    e.hp = 28;
    d.subStage = 2;
    const ev3 = A.executeTechnique(d, p, e, rnc, null, () => 0.01);
    ok(d.subStage === 3, "advanced to stage 3 tapout");
    ok(ev3.tapout === true, "event flagged tapout submission finish");
    ok(e.hp === 0, "tapout finish brought defender to 0 HP");

    // Range shift out of ground resets submission stage
    d.subStage = 2;
    A.applyRangeShift(d, { moves: "MID", flags: ["reset"] }, {});
    ok(d.subStage === 0, "standing up out of ground resets submission stage");
  }

  section("tri-zone damage modeling & checked kick reflection");
  {
    const p1 = { fid: 0, hp: 100, maxhp: 100, stam: 60, maxStam: 60, discs: ["muaythai"], cond: {}, atkMul: 1, defMul: 1, spdMul: 1, stamMul: 1, zones: A.newZones(100) };
    const p2 = { fid: 1, hp: 100, maxhp: 100, stam: 60, maxStam: 60, discs: ["muaythai"], cond: {}, atkMul: 1, defMul: 1, spdMul: 1, stamMul: 1, zones: A.newZones(100) };
    const d = { range: "LONG", p: p1, e: p2, pos: "CENTRE", turn: 1 };

    // Zone target determination
    ok(A.getZoneDamageTarget(A.TECH.mt_low_kick) === "legs", "low roundhouse targets legs");
    ok(A.getZoneDamageTarget(A.TECH.mt_body_kick) === "body", "body roundhouse targets body");
    ok(A.getZoneDamageTarget(A.TECH.cross) === "head", "cross targets head");

    // Checked kick reflection
    const lowKick = A.TECH.mt_low_kick;
    const legCheck = A.TECH.leg_check; // GUARD with leg flag
    const evCheck = A.executeTechnique(d, p1, p2, lowKick, legCheck, () => 0.01);
    ok(evCheck.checkedKick === true, "checked kick detected");
    ok(evCheck.checkedReflection > 0, "reflection damage calculated");
    ok(p1.zones.legs < 100, "attacker took checked kick leg damage");

    // Body shot stamina drain
    const stamBefore = p2.stam;
    A.executeTechnique(d, p1, p2, A.TECH.mt_body_kick, null, () => 0.01);
    ok(p2.zones.body < 100, "body damage deducted from body zone");
    ok(p2.stam < stamBefore, "body strike drained stamina");

    // Head strike and Seek Finish trigger
    const headKick = A.TECH.mt_head_kick;
    const evHead = A.executeTechnique(d, p1, p2, headKick, null, () => 0.01);
    ok(p2.zones.head < 100, "head damage deducted from head zone");
    ok(p1.seekFinish === true, "severe head impact activated seekFinish");
    ok(evHead.rocked === true, "event recorded opponent rocked");

    // Seek finish initiative boost
    const normalInit = A.initiativeOf(p2, A.TECH.jab, () => 0.5);
    const boostedInit = A.initiativeOf(p1, A.TECH.jab, () => 0.5);
    ok(boostedInit > normalInit, "seekFinish grants initiative advantage");

    // Leg trauma speed degradation
    p2.zones.legs = 30; // < 40%
    const slowInit = A.initiativeOf(p2, A.TECH.jab, () => 0.5);
    ok(slowInit < normalInit, "crippled legs reduce mobility and speed");

    // Body trauma stamina cost penalty
    p2.zones.body = 30; // < 40%
    const taxedCost = A.staminaCost(p2, A.TECH.cross);
    p2.zones.body = 100;
    const normalCost = A.staminaCost(p2, A.TECH.cross);
    ok(taxedCost > normalCost, "body trauma increases stamina cost");

    // End of turn upkeep resets seekFinish
    A.endTurnUpkeep(p1);
    ok(p1.seekFinish === false, "endTurnUpkeep clears seekFinish");
  }

  section("19 granular martial arts fighting styles");
  {
    ok(A.ARCHETYPE_IDS.length >= 19, "at least 19 archetypes available", A.ARCHETYPE_IDS.length);

    const expectedStyles = [
      "power_puncher", "counter_puncher", "volume_striker", "pressure_fighter",
      "swarmer", "out_boxer", "defensive_boxer", "switch_hitter", "kickboxer",
      "muay_thai", "wrestler", "bjj", "judo", "karate", "sambo", "taekwondo",
      "greco_roman", "catch_wrestler", "freestyle_wrestler",
    ];

    expectedStyles.forEach((style) => {
      const arch = A.ARCHETYPES[style];
      ok(!!arch, "archetype " + style + " exists");
      ok(!!arch.name && !!arch.tell, style + " has name and tell description");
      ok(typeof arch.weights === "object", style + " has numerical weightings");
    });

    // Legacy aliases preserved
    ok(A.ARCHETYPES.pressure === A.ARCHETYPES.pressure_fighter, "pressure is alias of pressure_fighter");
    ok(A.ARCHETYPES.counter === A.ARCHETYPES.counter_puncher, "counter is alias of counter_puncher");
    ok(A.ARCHETYPES.grappler === A.ARCHETYPES.wrestler, "grappler is alias of wrestler");
    ok(A.ARCHETYPES.outfighter === A.ARCHETYPES.out_boxer, "outfighter is alias of out_boxer");

    // AI scoring with style biases
    const side = {
      cond: {}, discs: ["bjj"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1,
      techs: A.knownTechs(0, 9), ai: A.ARCHETYPES.bjj.weights,
    };
    const foe = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    const d = { range: "GROUND", p: side, e: foe, subStage: 1, subAttacker: side, subDefender: foe };

    const scoreLock = A.scoreTechnique(d, side, foe, A.TECH.rnc, 0, () => 0.5);
    d.subStage = 0;
    const scoreNormal = A.scoreTechnique(d, side, foe, A.TECH.rnc, 0, () => 0.5);
    ok(scoreLock > scoreNormal, "AI strongly prioritizes locking trapped submission");
  }

  section("contract negotiations & performance purse multipliers");
  {
    // Streak and finish purse calculation
    const basePurse = 100;
    const normal = A.calculatePerformancePurse(basePurse, 1, "Decision");
    ok(normal.purse === 100, "normal decision pays 1.0x baseline");
    ok(normal.multiplier === 1.0, "normal multiplier is 1.0");

    const streakPurse = A.calculatePerformancePurse(basePurse, 3, "Decision");
    ok(streakPurse.purse === 150, "3 win streak pays 1.5x purse (+50%)");
    ok(streakPurse.streakBonus === true, "streak bonus flagged true");

    const finishPurse = A.calculatePerformancePurse(basePurse, 1, "Knockout");
    ok(finishPurse.purse === 130, "knockout finish pays 1.3x purse (+30%)");
    ok(finishPurse.finishBonus === true, "finish bonus flagged true");

    const subPurse = A.calculatePerformancePurse(basePurse, 1, "Submission Tapout");
    ok(subPurse.purse === 130, "submission finish pays 1.3x purse (+30%)");

    const stackedPurse = A.calculatePerformancePurse(basePurse, 4, "Knockout");
    ok(stackedPurse.purse === 180, "streak + stoppage finish stacks to 1.8x purse (+80%)");

    // Shop purseFor integration with win streak
    const shopWinBase = A.purseFor({ win: true, stage: 1, turns: 9, streak: 1 });
    const shopWinStreak = A.purseFor({ win: true, stage: 1, turns: 9, streak: 3 });
    ok(shopWinStreak > shopWinBase, "shop purse reflects win streak contract performance");

    // Ladder leapfrog displacement on major upset
    const rankNovice = A.RANK_TABLE[1];  // 10th Kyu
    const rankMaster = A.RANK_TABLE[4];  // 7th Kyu (gap = 3)
    const upsetExchange = A.calculatePointsExchange(rankNovice, rankMaster, "ranked");
    const normalExchange = A.calculatePointsExchange(rankMaster, rankNovice, "ranked");
    ok(upsetExchange.winnerGain > normalExchange.winnerGain, "major upset earns leapfrog acceleration points");
    ok(upsetExchange.upset === true, "upset correctly identified");
  }
};
