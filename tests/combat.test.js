/* =====================================================================
   The combat rebuild: range travel, the ground clock, guard identity,
   ring position, and the draft loop.

   Each of these exists because the balance audit found something wrong.
   The tests encode the finding so it cannot silently come back.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section, frames, press, scene } = h;
  const A = api;
  const mk = (discs, over) => Object.assign({ discs, stam: 60, maxStam: 60, cond: {}, hp: 100,
    maxhp: 100, atkMul: 1, defMul: 1, stamMul: 1, level: 9, fid: 0, sup: 0, sig: null,
    techs: A.knownTechs(0, 9) }, over || {});
  const duel = (range, extra) => Object.assign({ range, lastWhiffBy: null, benefits: [],
    stats: A.newDuelStats(), pos: "CENTRE", cornered: null }, extra || {});

  section("range travels, it does not teleport");
  {
    // this was the bug: Close Distance and Create Space had no effect at all
    ok(A.TECH.basic_close.shift === 1, "Close Distance actually closes", A.TECH.basic_close.shift);
    ok(A.TECH.basic_break.shift === -1, "Create Space actually creates space", A.TECH.basic_break.shift);
  }
  {
    const a = mk(["boxing"]), b = mk(["boxing"]);
    const d = duel("LONG"); d.p = a; d.e = b;
    A.executeTechnique(d, a, b, A.TECH.basic_close, null, () => 0.01);
    ok(d.range === "MID", "closing from kicking range reaches punching range", d.range);
    A.executeTechnique(d, a, b, A.TECH.basic_close, null, () => 0.01);
    ok(d.range === "CLINCH", "and then the clinch - one step at a time", d.range);
  }
  {
    // a hip throw cannot reach the mat from punching range without tying up
    const a = mk(["judo"]), b = mk(["boxing"]);
    const d = duel("MID"); d.p = a; d.e = b;
    A.executeTechnique(d, a, b, A.TECH.o_soto_gari, null, () => 0.01);
    ok(d.range === "CLINCH", "a throw from punching range only reaches the clinch", d.range);
  }
  {
    /* An ordinary single or double from punching range ends in a tie-up,
       not on the mat. Any `takedown` flag used to be enough to cover two
       ranges in one motion, which made GROUND 44% of every turn against a
       25-35% band and left the clinch at 13%. */
    const a = mk(["wrestling"]), b = mk(["boxing"]);
    const d = duel("MID"); d.p = a; d.e = b;
    A.executeTechnique(d, a, b, A.TECH.double_leg, null, () => 0.01);
    ok(d.range === "CLINCH", "an ordinary double leg from punching range ties up first", d.range);
  }
  {
    // but a committed shot does put you on the ground in one motion
    const a = mk(["wrestling"]), b = mk(["boxing"]);
    const d = duel("MID"); d.p = a; d.e = b;
    ok((A.TECH.blast_double.flags || []).indexOf("power") >= 0,
       "the committed shot is the one flagged as thrown with everything behind it");
    A.executeTechnique(d, a, b, A.TECH.blast_double, null, () => 0.01);
    ok(d.range === "GROUND", "a blast double from punching range reaches the mat", d.range);
  }

  section("the ground is not a one-way door");
  {
    const d = duel("GROUND");
    d.groundTurns = 0;
    const fresh = A.groundEscapeBonus(d);
    d.groundTurns = 6;
    const stale = A.groundEscapeBonus(d);
    ok(stale > fresh, "the longer you are held down the better you work up",
       fresh.toFixed(2) + " -> " + stale.toFixed(2));
    /* The cap moved 1.30 -> 1.70 to get GROUND inside its band, so the
       check is written against the shape rather than the number: the ramp
       must plateau, and it must stay a long way short of a certainty.
       Accuracy is still clamped at 99 and the situation layer at 1.80, so
       "bounded" is what stops this being a free button, not the value. */
    d.groundTurns = 40;
    const forever = A.groundEscapeBonus(d);
    ok(forever === stale, "the ramp plateaus rather than growing forever",
       stale.toFixed(2) + " at 6 turns, " + forever.toFixed(2) + " at 40");
    ok(stale <= 1.75, "but it never becomes a free stand-up", stale.toFixed(2));
    d.groundTurns = 6;
    d.range = "MID"; A.tickRangeClock(d);
    ok(d.groundTurns === 0, "the clock resets the moment you are up");
  }

  section("every guard has a reason to exist");
  {
    // 46 of 51 guards were mechanically identical to the free basic guard
    const g = A.TECH.shoulder_roll;
    const own = A.guardFactor(null, g, { range: "MID" });
    const wrong = A.guardFactor(null, g, { range: "GROUND" });
    ok(own < wrong, "a guard built for a range beats a cover-up when the fight is there",
       own.toFixed(2) + " vs " + wrong.toFixed(2));
    const basic = A.guardFactor(null, A.TECH.basic_guard, { range: "MID" });
    ok(own < basic, "and beats the free universal guard on its own turf",
       own.toFixed(2) + " vs " + basic.toFixed(2));
    ok(wrong > basic, "while being the wrong tool everywhere else",
       wrong.toFixed(2) + " vs " + basic.toFixed(2));
  }
  {
    // no guard may become an outright immunity
    let worst = 0;
    A.TECH_IDS.filter((id) => A.TECH[id].cls === "GUARD").forEach((id) => {
      A.RANGE_ORDER.forEach((r) => { worst = Math.max(worst, 1 - A.guardFactor(null, A.TECH[id], { range: r })); });
    });
    ok(worst <= 0.78, "no guard soaks more than 78% of a hit", (worst * 100).toFixed(0) + "%");
  }

  section("ring position is earned and escapable");
  {
    ok(A.POSITION_ORDER.join(">") === "CENTRE>ROPES>CORNER", "three places the fight can be");
    const wrestler = mk(["wrestling"]), tkd = mk(["taekwondo"]);
    ok(A.escapeChance(tkd, "ROPES") > A.escapeChance(wrestler, "ROPES"),
       "an out-fighter circles out better than a wrestler",
       (A.escapeChance(wrestler, "ROPES") * 100).toFixed(0) + "% vs " + (A.escapeChance(tkd, "ROPES") * 100).toFixed(0) + "%");
    ok(A.escapeChance(tkd, "CORNER") < A.escapeChance(tkd, "ROPES"), "the corner is worse than the ropes");
    ok(A.escapeChance(tkd, "CENTRE") === 1, "there is nothing to escape from in open ring");
  }
  {
    const d = duel("CLINCH"); d.p = mk(["wrestling"]); d.e = mk(["boxing"]);
    A.resetPosition(d);
    ok(d.pos === "CENTRE" && !d.cornered, "every fight opens in open ring");
    let landed = 0;
    for (let i = 0; i < 10 && d.cornered !== "e"; i++) {
      A.pressureShift(d, d.p, { hit: true, dmg: 12, blocked: false, tech: { flags: ["control"], cls: "SETUP" } });
      landed++;
    }
    ok(d.cornered === "e", "sustained pressure corners someone", d.pos);
    ok(landed >= 2, "and it takes more than one technique to do it", landed + " landed");
  }
  {
    // cornering must be worth something, and not everything
    const bonus = A.cornerDamageBonus("CORNER") / A.cornerDamageBonus("CENTRE");
    ok(bonus > 1.1 && bonus < 1.35, "the corner is worth a real but non-decisive edge",
       bonus.toFixed(2) + "x");
  }
  {
    // the interaction that actually broke: half this game is on the mat, and
    // barring ground pressure outright meant the ring never moved at all
    const d = duel("GROUND"); d.p = mk(["wrestling"]); d.e = mk(["boxing"]);
    A.resetPosition(d);
    let moved = false;
    for (let i = 0; i < 12 && !moved; i++) {
      A.pressureShift(d, d.p, { hit: true, dmg: 10, blocked: false, tech: { flags: ["control"], cls: "SETUP" } });
      if (d.pos !== "CENTRE") moved = true;
    }
    ok(moved, "mat control still walks a man toward the fence", d.pos);
    const d2 = duel("GROUND"); d2.p = mk(["bjj"]); d2.e = mk(["boxing"]);
    A.resetPosition(d2);
    A.pressureShift(d2, d2.p, { hit: true, dmg: 30, blocked: false, tech: { flags: [], cls: "SUB" } });
    ok(d2.pos === "CENTRE", "but a submission attempt does not move the ring");
  }

  section("the draft turns a run into something you built");
  {
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv);");
    const run = A.G.adv;
    ok(Array.isArray(run.drafted) && run.drafted.length === 0, "a run starts undrafted");
    ok(A.canDraft(run), "and can draft");
    const picks = A.draftChoices(run);
    ok(picks.length === 3, "three on offer", picks.length);
    ok(new Set(picks).size === 3, "never the same twice");
    const known = A.knownTechs(run.hero, run.level);
    ok(picks.every((id) => known.indexOf(id) < 0), "never something you already know");
    const budget = A.draftPowerBudget(run.stage);
    ok(picks.every((id) => A.TECH[id].power <= budget), "and never above the stage's power budget", budget);
  }
  {
    const run = A.G.adv;
    const before = A.draftedTechs(run).length;
    const res = A.applyDraft(run, A.draftChoices(run)[0]);
    ok(!!res && A.draftedTechs(run).length === before + 1, "taking one adds it to the run");
    // the cap must hold even under abuse
    for (let i = 0; i < 40; i++) { const c = A.draftChoices(run); if (c.length) A.applyDraft(run, c[0]); }
    ok(A.draftedTechs(run).length <= A.DRAFT_CONFIG.maxPerRun,
       "the per-run cap holds under spam", A.draftedTechs(run).length + "/" + A.DRAFT_CONFIG.maxPerRun);
  }
  {
    // the whole point: it has to reach the fight
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv);");
    const run = A.G.adv;
    const taken = [];
    for (let i = 0; i < 3; i++) { const c = A.draftChoices(run); taken.push(c[0]); A.applyDraft(run, c[0]); run.stage++; }
    A.exec("G.duel=null; startDuel({oppFid:1,oppHp:120,oppPool:battlePool(1,5),fromAdv:true,oppLv:5,stage:3});");
    frames(700);
    const inFight = taken.filter((id) => A.G.duel.p.techs.indexOf(id) >= 0);
    ok(inFight.length === taken.length, "every drafted technique is in the movelist at the bell",
       inFight.length + "/" + taken.length);
    A.exec("G.duel=null;");
  }
  {
    // and the screen has to work
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv);" +
           "G.draftPick=draftChoices(G.adv); G.draftSel=0; G.scene=S.DRAFT;");
    frames(3);
    ok(scene() === "DRAFT", "the draft screen renders");
    const n0 = A.draftedTechs(A.G.adv).length;
    press("a");
    ok(A.draftedTechs(A.G.adv).length === n0 + 1, "A learns it");
    ok(scene() === "MAP", "and returns you to the field", scene());
    A.exec("G.draftPick=draftChoices(G.adv); G.draftSel=0; G.scene=S.DRAFT;");
    const n1 = A.draftedTechs(A.G.adv).length;
    press("b");
    ok(A.draftedTechs(A.G.adv).length === n1, "B takes nothing");
    ok(scene() === "MAP", "and still lets you leave");
  }

  section("pokemon-style stat stages (-3 to +3 for Atk, Def, Spd, Acc)");
  {
    ok(A.STAT_STAGES.MIN === -3 && A.STAT_STAGES.MAX === 3, "6 stages: -3 to +3 range defined");
    ok(A.statStageMultiplier("atk", 0) === 1.0, "neutral stage multiplier is 1.0");
    ok(A.statStageMultiplier("atk", 1) === 1.5, "+1 Atk is 1.5x (3/2)");
    ok(A.statStageMultiplier("atk", 2) === 2.0, "+2 Atk is 2.0x (4/2)");
    ok(A.statStageMultiplier("atk", 3) === 2.5, "+3 Atk is 2.5x (5/2)");
    ok(Math.abs(A.statStageMultiplier("atk", -1) - (2 / 3)) < 0.001, "-1 Atk is 2/3x (0.667x)");
    ok(A.statStageMultiplier("atk", -2) === 0.5, "-2 Atk is 0.5x (2/4)");
    ok(A.statStageMultiplier("atk", -3) === 0.4, "-3 Atk is 0.4x (2/5)");

    ok(A.statStageMultiplier("acc", 1) === (4 / 3), "+1 Acc is 4/3x (1.333x)");
    ok(A.statStageMultiplier("acc", 3) === 2.0, "+3 Acc is 2.0x (6/3)");
    ok(A.statStageMultiplier("acc", -1) === 0.75, "-1 Acc is 3/4x (0.75x)");
    ok(A.statStageMultiplier("acc", -2) === 0.6, "-2 Acc is 3/5x (0.60x)");
    ok(A.statStageMultiplier("acc", -3) === 0.5, "-3 Acc is 3/6x (0.50x)");

    const s = mk(["boxing"]);
    ok(A.getStatStage(s, "atk") === 0, "initial stat stage is 0");
    A.modifyStatStage(s, "atk", 2);
    ok(A.getStatStage(s, "atk") === 2, "modified +2 stat stage reads back");
    A.modifyStatStage(s, "atk", 5);
    ok(A.getStatStage(s, "atk") === 3, "stat stages clamp at max +3");
    A.modifyStatStage(s, "atk", -10);
    ok(A.getStatStage(s, "atk") === -3, "stat stages clamp at min -3");
    A.resetStatStages(s);
    ok(A.getStatStage(s, "atk") === 0, "reset clears stages back to 0");

    // Hook into statusMods
    A.setStatStage(s, "atk", 2); // 2.0x
    A.setStatStage(s, "spd", -2); // 0.5x
    const mods = A.statusMods(s);
    ok(mods.pow === 2.0 && mods.spd === 0.5, "statusMods reflects stat stages", JSON.stringify(mods));
  }

  section("status effects & clean duration counters");
  {
    ok(!!A.STATUS.DAZED && !!A.STATUS.DAZE, "DAZED / DAZE status exists");
    ok(!!A.STATUS.BLEED && !!A.STATUS.STUN, "BLEED and STUN aliases exist");

    const s = mk(["boxing"]);
    A.addStatus(s, "DAZED");
    ok(A.hasStatus(s, "DAZED") && A.hasStatus(s, "DAZE"), "hasStatus resolves aliases");
    ok(A.getStatusDuration(s, "DAZED") === A.STATUS.DAZED.turns, "status duration initialized");
    A.setStatusDuration(s, "DAZED", 5);
    ok(A.getStatusDuration(s, "DAZED") === 5, "duration counter updated");
    A.clearStatus(s, "DAZED");
    ok(!A.hasStatus(s, "DAZED"), "clearStatus removes condition cleanly");

    A.addStatus(s, "BLEEDING");
    A.addStatus(s, "STUNNED");
    A.clearAllStatuses(s);
    ok(!A.hasStatus(s, "BLEEDING") && !A.hasStatus(s, "STUNNED"), "clearAllStatuses clears all");
  }

  section("attack heights: HIGH, MID, LOW, SPECIAL");
  {
    ok(A.ATTACK_HEIGHTS.HIGH === "HIGH" && A.ATTACK_HEIGHTS.LOW === "LOW", "attack heights defined");
    ok(A.attackHeightOf(A.TECH.jab) === "HIGH", "jab is HIGH");
    ok(A.attackHeightOf(A.TECH.cross) === "MID", "cross is MID");
    ok(A.attackHeightOf(A.TECH.low_kick) === "LOW", "low kick is LOW");
    ok(A.attackHeightOf(A.TECH.double_leg) === "SPECIAL", "double leg takedown is SPECIAL");
    ok(A.attackHeightOf(A.TECH.armbar) === "SPECIAL", "armbar submission is SPECIAL");
    ok(A.heightAdvantage("HIGH", "MID") === 1, "HIGH has advantage over MID");
    ok(A.heightAdvantage("MID", "LOW") === 1, "MID has advantage over LOW");
    ok(A.heightAdvantage("LOW", "MID") === 1, "LOW trips standing MID");
  }

  section("height-based interactions in combat resolution");
  {
    // High speed advantage in initiative
    const s = mk(["boxing"]);
    const highTech = A.TECH.jab; // HIGH
    const midTech = A.TECH.cross; // MID
    const fixedRnd = () => 0.5;
    const initHigh = A.initiativeOf(s, highTech, fixedRnd);
    const initMid = A.initiativeOf(s, midTech, fixedRnd);
    ok(initHigh > initMid, "High speed technique gains initiative advantage", initHigh + " vs " + initMid);

    // Mid beating low guard / crouch
    const d = duel("MID");
    const p1 = mk(["boxing"]);
    const p2 = mk(["muaythai"]);
    d.p = p1; d.e = p2;
    const lowGuard = A.TECH.leg_check; // LOW guard
    const midStrike = A.TECH.cross; // MID strike
    const lowStrike = A.TECH.low_kick; // LOW strike

    const gfMidVsLowGuard = A.guardFactor(p2, lowGuard, d, midStrike);
    ok(gfMidVsLowGuard >= 0.95, "Mid strike penetrates low guard", gfMidVsLowGuard);

    const gfLowVsLowGuard = A.guardFactor(p2, lowGuard, d, lowStrike);
    ok(gfLowVsLowGuard < 0.5, "Low guard cleanly soaks low kick", gfLowVsLowGuard);

    // Low tripping standing guard
    const standingGuard = A.TECH.high_guard;
    const gfLowVsHighGuard = A.guardFactor(p2, standingGuard, d, lowStrike);
    ok(gfLowVsHighGuard > 0.6, "Standing guard fails against low kick", gfLowVsHighGuard);

    // Execute technique low trip
    const evTrip = A.executeTechnique(d, p1, p2, lowStrike, standingGuard, () => 0.01);
    ok(evTrip.tripped === true, "Low strike trips standing guard");
    ok(A.hasStatus(p2, "OFF_BALANCE"), "Tripped opponent is left off balance");
  }

  section("tekken card tournament 3-choice dynamic (FOCUS, STRIKE, BLOCK)");
  {
    ok(A.CHOICES.FOCUS === "FOCUS" && A.CHOICES.STRIKE === "STRIKE" && A.CHOICES.BLOCK === "BLOCK", "3 choices defined");
    ok(A.classifyTechniqueChoice(A.TECH.cross) === "STRIKE", "Cross is STRIKE");
    ok(A.classifyTechniqueChoice(A.TECH.high_guard) === "BLOCK", "High Guard is BLOCK");
    ok(A.classifyTechniqueChoice(A.TECH.basic_close) === "FOCUS", "Reposition setup is FOCUS");

    const r1 = A.resolve3WayDynamic("STRIKE", "FOCUS");
    ok(r1.advantage === "STRIKE" && r1.winner === "atk", "STRIKE beats FOCUS");

    const r2 = A.resolve3WayDynamic("FOCUS", "BLOCK");
    ok(r2.advantage === "FOCUS" && r2.winner === "atk", "FOCUS beats BLOCK");

    const r3 = A.resolve3WayDynamic("STRIKE", "BLOCK");
    ok(r3.advantage === "BLOCK" && r3.winner === "def", "BLOCK mitigates STRIKE");

    // FOCUS action execution
    const s = mk(["boxing"], { stam: 20, maxStam: 60, focus: 0, focusMax: 3 });
    const fRes = A.focusAction(s, null);
    ok(fRes.gainedFocus === 1 && s.focus === 1, "Focus action gains focus meter");
    ok(s.stam === 38, "Focus action restores stamina (+18)");

    // Focus out-resources Guard (+2 Focus, +24 Stamina)
    const s2 = mk(["boxing"], { stam: 20, maxStam: 60, focus: 0, focusMax: 3 });
    const guardTech = A.TECH.high_guard;
    const fResGuard = A.focusAction(s2, null, guardTech);
    ok(fResGuard.gainedFocus === 2 && s2.focus === 2, "Focus out-resources Guard (+2 Focus)");
    ok(s2.stam === 44, "Focus out-resources Guard (+24 Stamina)");

    // Strike counters Focus (+30% dmg, inflicts DAZED)
    const dDynamic = duel("MID");
    const pAtk = mk(["boxing"], { stam: 60, maxStam: 60 });
    const pFocus = mk(["boxing"], { stam: 60, maxStam: 60, cond: {} });
    dDynamic.p = pAtk; dDynamic.e = pFocus;
    const strikeTech = A.TECH.cross;
    const focusTech = A.TECH.basic_focus;
    const dmgVsFocus = A.damageOf(dDynamic, pAtk, pFocus, strikeTech, focusTech);
    const dmgVsNeutral = A.damageOf(dDynamic, pAtk, pFocus, strikeTech, null);
    ok(dmgVsFocus > dmgVsNeutral, "Strike deals +30% damage against Focus (" + dmgVsFocus + " vs " + dmgVsNeutral + ")");
    const evStrikeFocus = A.executeTechnique(dDynamic, pAtk, pFocus, strikeTech, focusTech, () => 0.01);
    ok(evStrikeFocus.strikeCountersFocus === true, "Strike countered Focus event tagged");
    ok(A.hasStatus(pFocus, "DAZED"), "Strike counters Focus inflicts DAZED");
  }

  section("4-tier difficulty expansion");
  {
    ok(A.DIFFS.length === 4, "DIFFS expanded to 4 tiers");
    const rookie = A.DIFFS[0], pro = A.DIFFS[1], mainEvent = A.DIFFS[2], champion = A.DIFFS[3];

    ok(rookie.name === "ROOKIE" && rookie.dmg === 0.80 && rookie.cont === 3 && rookie.noise === 36 && rookie.jug === -0.5,
       "ROOKIE: 0.80x dmg, 3 cont, noise: 36, jug: -0.5");
    ok(pro.name === "PRO" && pro.dmg === 1.00 && pro.cont === 1 && pro.noise === 18 && pro.jug === 0.0,
       "PRO: 1.00x dmg, 1 cont, noise: 18, jug: 0.0");
    ok(mainEvent.name === "MAIN EVENT" && mainEvent.dmg === 1.25 && mainEvent.cont === 0 && mainEvent.noise === 8 && mainEvent.jug === 0.8 && mainEvent.renownMul === 1.25,
       "MAIN EVENT: 1.25x dmg, 0 cont, noise: 8, jug: 0.8, renownMul: 1.25");
    ok(champion.name === "HEAVENS CHAMPION" && champion.dmg === 1.45 && champion.cont === 0 && champion.noise === 2 && champion.jug === 1.2 && champion.renownMul === 1.50,
       "HEAVENS CHAMPION: 1.45x dmg, 0 cont, noise: 2, jug: 1.2, renownMul: 1.50");

    A.getSave().diff = 3;
    ok(A.diff().name === "HEAVENS CHAMPION", "diff() retrieves HEAVENS CHAMPION at tier 3");
    A.getSave().diff = 1;
  }

  section("true Guard Break (Throws and Submissions penetrate Guards completely)");
  {
    const d = duel("MID");
    const atkFighter = mk(["judo"], { stam: 60, maxStam: 60 });
    const defFighter = mk(["boxing"], { stam: 60, maxStam: 60, cond: {} });
    d.p = atkFighter; d.e = defFighter;

    const throwTech = A.TECH.o_soto_gari; // THROW
    const guardTech = A.TECH.high_guard; // GUARD

    // guardFactor returns 1.0 for throw vs guard (penetrates completely)
    const gf = A.guardFactor(defFighter, guardTech, d, throwTech);
    ok(gf === 1.0, "Throws penetrate guards completely (guardFactor = 1.0)");

    // damageOf deals 1.25x guard break damage
    const dmgNormal = A.damageOf(d, atkFighter, defFighter, throwTech, null);
    const dmgGuardBreak = A.damageOf(d, atkFighter, defFighter, throwTech, guardTech);
    ok(dmgGuardBreak > dmgNormal, "Throw against guard deals 1.25x guard break damage (" + dmgGuardBreak + " vs " + dmgNormal + ")");

    // executeTechnique penetrates guard, deals damage and applies OFF_BALANCE
    const ev = A.executeTechnique(d, atkFighter, defFighter, throwTech, guardTech, () => 0.01);
    ok(ev.guardBreak === true, "Guard Break event tagged on throw vs guard");
    ok(ev.blocked === false, "Guard is penetrated completely (not blocked)");
    ok(A.hasStatus(defFighter, "OFF_BALANCE"), "Guard break applies OFF_BALANCE to defender");

    // Submission guard break
    const dGround = duel("GROUND");
    const subFighter = mk(["bjj"], { stam: 60, maxStam: 60 });
    const defMat = mk(["boxing"], { stam: 60, maxStam: 60, cond: {} });
    dGround.p = subFighter; dGround.e = defMat;
    const subTech = A.TECH.armbar; // SUB
    const evSub = A.executeTechnique(dGround, subFighter, defMat, subTech, guardTech, () => 0.01);
    ok(evSub.guardBreak === true, "Guard Break event tagged on submission vs guard");
    ok(evSub.blocked === false, "Submission penetrates guard completely");
    ok(A.hasStatus(defMat, "OFF_BALANCE"), "Submission guard break applies OFF_BALANCE");
  }

  section("STAMINA_BREAK condition (-35% defense, defense disabled for 1 turn)");
  {
    ok(A.STATUS.STAMINA_BREAK, "STAMINA_BREAK condition is defined in STATUS");
    ok(A.STATUS.STAMINA_BREAK.turns === 1, "STAMINA_BREAK lasts 1 turn");
    ok(A.STATUS.STAMINA_BREAK.blocks.indexOf("GUARD") >= 0, "STAMINA_BREAK blocks GUARD (defense disabled)");

    const side = mk(["boxing"], { stam: 5, maxStam: 60, cond: {} });
    const foe = mk(["boxing"], { stam: 60, maxStam: 60 });
    const d = duel("MID");
    d.p = side; d.e = foe;

    // Overdrawing stamina triggers STAMINA_BREAK
    const heavyTech = A.TECH.cross; // costs > 5 stamina
    A.executeTechnique(d, side, foe, heavyTech, null, () => 0.01);
    ok(side.stam === 0, "Stamina clamped to 0 on depletion");
    ok(A.hasStatus(side, "STAMINA_BREAK"), "Depleting stamina below 0 inflicts STAMINA_BREAK");

    // Defense disabled: GUARD whiffs
    const evGuard = A.executeTechnique(d, side, foe, A.TECH.high_guard, null, () => 0.01);
    ok(evGuard.whiff === true && evGuard.note === "STAMINA BREAK", "Guard disabled under STAMINA_BREAK");

    // +35% damage taken under STAMINA_BREAK
    const dmgNormal = A.damageOf(d, foe, foe, heavyTech, null);
    const dmgBroken = A.damageOf(d, foe, side, heavyTech, null);
    ok(dmgBroken > dmgNormal, "Afflicted fighter takes +35% damage (" + dmgBroken + " vs " + dmgNormal + ")");
  }

  section("multi-card combinations and aerial juggles animations");
  {
    const d = duel("MID");
    const p1 = mk(["boxing"], { stam: 60, maxStam: 60 });
    const p2 = mk(["boxing"], { stam: 60, maxStam: 60, hp: 100, maxhp: 100 });
    d.p = p1; d.e = p2;

    // Multi-card combination resolution
    const combo = [A.TECH.jab, A.TECH.cross, A.TECH.lead_hook];
    const res = A.resolveSequence(d, p1, p2, combo, () => 0.99, (t, prev, i) => A.executeTechnique(d, p1, p2, t, null, () => 0.01));
    ok(res.links.length === 3, "All 3 combo links executed");
    ok(res.totalDmg > 0, "Combination dealt damage (" + res.totalDmg + ")");

    // Aerial juggle beat step animation
    d.ph = A.D.JUGGLE;
    d.jugPos = 50; // center of window (tier 2 / gold)
    d.jugBeat = 0;
    d.jugChain = 0;
    d.jugTotal = 0;
    A.resolveJuggle(d, p1);
    ok(d.jugChain === 1, "Juggle beat 1 connected");
    ok(p1.anim && (p1.anim === "atk" || p1.anim.kind), "Attacker step animation triggered on juggle");
    ok(p2.anim && (p2.anim === "hit" || p2.anim.kind), "Defender reaction animation triggered on juggle");
  }

  /* =====================================================================
     The damage model stays four layers deep.

     damageOf used to be ~25 multiplicative terms in a line and the proof
     that nobody could predict it is in the file: TECH_DMG_SCALE was pulled
     from 0.42 to double a 7.6-turn fight and the fight stayed at 7.7,
     because the terms downstream ate the change. The collapse re-expressed
     every one of those terms inside four budgeted layers on top of a base.

     This section is what stops the stack growing back. It plays a few
     hundred real AI-vs-AI fights - the same loop tools/audit-balance.js
     uses - and checks three things about every single landed technique:

       1. every layer came out inside its documented clamp,
       2. base x fit x situation x investment x finish x scale reproduces
          damageLayers' own answer, and
       3. THE DAMAGE THAT CAME OFF THE FIGHTER is reachable from that
          answer by walking the event's post-layer ledger, entry by entry.

     (3) is the load-bearing one, and (2) on its own is not. The first
     version of this section only had (2), which compares the layer
     product against `L.dmg` - two fields of the same object damageLayers
     had just produced together. It proved the model was self-consistent
     and nothing else, and a `dmg = Math.round(dmg * 1.30)` dropped into
     executeTechnique outside every layer passed it on the first run: a
     30% multiplier invisible to the five numbers on the HUD, green.

     (3) closes that. 22.6% of landed techniques legitimately differ from
     the modelled number - a guard soaks them, a cage pin adds four, a
     locked submission cranks them - so the check is not "ev.dmg equals
     the model". It is "every step from the model to ev.dmg is declared",
     which is the property that actually matters. Each ledger entry
     records the value it started from, so an adjustment appended before
     the first entry, between two of them, or after the last leaves a
     `from` that does not match the previous `to`, or an `ev.dmg` that
     does not match the final `to`. There is nowhere quiet to put one.

     Together they are acceptance criterion 3: the numbers the event
     carries are the whole calculation, so a reader with the HUD in front
     of them can predict the hit.
     ===================================================================== */
  section("the damage model stays four layers deep");
  {
    function rngFrom(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const DC = A.DMG_CLAMP, AC = A.ACC_CLAMP;
    const worst = {};           // how hard each layer pressed on its budget
    const note = (k, v) => {
      const w = worst[k] || (worst[k] = { lo: Infinity, hi: -Infinity });
      if (v < w.lo) w.lo = v;
      if (v > w.hi) w.hi = v;
    };
    let hits = 0, accSamples = 0, outOfClamp = 0, mispredicted = 0, worstErr = 0;
    let firstBadLayer = "", firstBadPredict = "";
    let applied = 0, adjusted = 0, ledgerEntries = 0, offLedger = 0;
    let firstOffLedger = "";

    function checkDamage(L) {
      /* a technique with no power (SETUP, a stand-up, a guard pass) short
         -circuits to 0 before any layer is computed - there is nothing to
         reconstruct and the layers are all identity */
      if (!L.base) return;
      hits++;
      ["fit", "situation", "investment", "finish"].forEach((k) => {
        note(k, L.raw[k]);
        if (L[k] < DC[k][0] - 1e-9 || L[k] > DC[k][1] + 1e-9) {
          outOfClamp++;
          if (!firstBadLayer) firstBadLayer = "dmg." + k + " = " + L[k];
        }
      });
      const predicted = Math.max(2, Math.round(
        L.base * L.fit * L.situation * L.investment * L.finish * L.scale));
      if (predicted !== L.dmg) {
        mispredicted++;
        const err = Math.abs(predicted - L.dmg) / Math.max(1, L.dmg);
        if (err > worstErr) worstErr = err;
        if (!firstBadPredict) firstBadPredict = "predicted " + predicted + ", model returned " + L.dmg;
      }
    }
    function checkAccuracy(d, side, foe, tech) {
      const L = A.accuracyLayers(d, side, foe, tech);
      accSamples++;
      ["fit", "situation", "finish"].forEach((k) => {
        note("acc." + k, L.raw[k]);
        if (L[k] < AC[k][0] - 1e-9 || L[k] > AC[k][1] + 1e-9) {
          outOfClamp++;
          if (!firstBadLayer) firstBadLayer = "acc." + k + " = " + L[k];
        }
      });
      note("acc.investmentPts", L.raw.investmentPts);
      if (L.investmentPts < AC.investmentPts[0] - 1e-9 || L.investmentPts > AC.investmentPts[1] + 1e-9) {
        outOfClamp++;
        if (!firstBadLayer) firstBadLayer = "acc.investmentPts = " + L.investmentPts;
      }
      const predicted = L.base * L.fit * L.situation * L.finish + L.investmentPts;
      if (Math.abs(predicted - L.acc) > 1e-6) {
        mispredicted++;
        if (!firstBadPredict) firstBadPredict = "acc predicted " + predicted + ", model returned " + L.acc;
      }
    }

    /* The ledger walk: from the modelled number to the damage that was
       actually taken off the fighter, every step declared. */
    function checkApplied(ev) {
      if (!ev.hit || !ev.dmgLayers) return;
      applied++;
      const post = ev.dmgPost || [];
      if (post.length) { adjusted++; ledgerEntries += post.length; }
      let cursor = ev.dmgLayers.dmg;
      for (let i = 0; i < post.length; i++) {
        if (post[i].from !== cursor) {
          offLedger++;
          if (!firstOffLedger) {
            firstOffLedger = "ledger step '" + post[i].by + "' starts at " + post[i].from +
              " but the previous step ended at " + cursor +
              " - something changed the damage without declaring it";
          }
          return;
        }
        cursor = post[i].to;
      }
      if (ev.dmg !== cursor) {
        offLedger++;
        if (!firstOffLedger) {
          firstOffLedger = "applied " + ev.dmg + " but the model plus its " + post.length +
            " declared adjustments come to " + cursor;
        }
      }
    }

    /* Every fighter, against a spread of opponents, for a whole fight. The
       point of sweeping real fights rather than constructed cases is the
       combinations: cornered-and-winded-and-locked-in-a-sub is not a case
       anyone writes by hand, and it is exactly where a stack runs away. */
    const N = A.FIGHTERS.length;
    let fought = 0;
    for (let i = 0; i < N; i++) {
      for (let step = 1; step <= 3; step++) {
        const j = (i + step * 7) % N;
        if (i === j) continue;
        const rnd = rngFrom(i * 7919 + j * 104729 + step);
        const P = A.mkSide(i, A.hpOf(i), A.battlePool(i, 9), { human: true, level: 9 });
        const E = A.mkSide(j, A.hpOf(j), A.battlePool(j, 9), { level: 9 });
        P.ai = A.ARCHETYPES[A.archetypeFor(i, 1)].weights;
        E.ai = A.ARCHETYPES[A.archetypeFor(j, 1)].weights;
        const d = { p: P, e: E, range: A.homeRanges(P.discs)[0] || "MID", lastWhiffBy: null,
                    benefits: [], stats: A.newDuelStats() };
        A.resetPosition(d);
        let turn = 0;
        while (P.hp > 0 && E.hp > 0 && turn < 40) {
          const acts = [
            { s: P, f: E, t: A.aiChooseTechnique(d, P, E, { noise: 12, rnd }).tech },
            { s: E, f: P, t: A.aiChooseTechnique(d, E, P, { noise: 12, rnd }).tech },
          ];
          acts.forEach((x) => (x.init = A.initiativeOf(x.s, x.t, rnd)));
          acts.sort((x, y) => y.init - x.init);
          for (const act of acts) {
            if (act.s.hp <= 0 || act.f.hp <= 0) continue;
            const other = acts.find((z) => z !== act);
            checkAccuracy(d, act.s, act.f, act.t);
            const ev = A.executeTechnique(d, act.s, act.f, act.t, other ? other.t : null, rnd);
            if (ev.dmgLayers) checkDamage(ev.dmgLayers);
            checkApplied(ev);
            if (ev.hit) act.f.hp -= ev.dmg;
          }
          A.tickRangeClock(d); A.pressureDecay(d);
          P.hp -= A.endTurnUpkeep(P);
          E.hp -= A.endTurnUpkeep(E);
          turn++;
        }
        fought++;
      }
    }

    ok(fought >= 60, "the sweep played a real spread of fights", fought + " fights");
    ok(hits > 1000, "and landed enough techniques to be worth believing", hits + " resolved");
    ok(accSamples > 2000, "with an accuracy sample on every commitment", accSamples);
    ok(outOfClamp === 0, "every layer stayed inside its documented clamp",
       firstBadLayer || (outOfClamp + " escapes"));
    ok(mispredicted === 0,
       "the layers reproduce damageLayers' own answer exactly",
       firstBadPredict || (mispredicted + " of " + (hits + accSamples) +
         ", worst " + (worstErr * 100).toFixed(1) + "%"));

    /* the guard that matters: not "the model is self-consistent" but
       "the damage the fighter took is the model plus declared steps" */
    ok(applied > 800, "the sweep landed enough techniques on a real fighter to matter", applied);
    ok(adjusted > 100 && ledgerEntries >= adjusted,
       "and enough of them were adjusted after the model that the ledger is exercised",
       adjusted + " of " + applied + " adjusted, " + ledgerEntries + " entries");
    ok(offLedger === 0,
       "every step from the modelled hit to the damage actually taken is declared",
       firstOffLedger || (offLedger + " of " + applied));

    /* Reported, not asserted: a layer whose raw product never reaches its
       ceiling is a budget nobody is spending, and one that is permanently
       pinned to a bound is a clamp doing the balancing instead of the
       design. Both are worth a human look, neither is a failure. */
    ["fit", "situation", "investment", "finish"].forEach((k) => {
      const w = worst[k];
      ok(Number.isFinite(w.lo) && Number.isFinite(w.hi), "dmg " + k + " raw range observed",
         w.lo.toFixed(3) + " .. " + w.hi.toFixed(3) + "   budget " + DC[k][0] + ".." + DC[k][1]);
    });
  }

  /* Acceptance criterion 3: a reader can predict a hit within +/-20% from
     the numbers on screen. The event carries the layers, so "on screen" and
     "in the maths" are the same five numbers - the only way to be wrong is
     for one of them to be rounded before the reader sees it. Round every
     layer to the two decimals a HUD would show and the answer still has to
     land inside the criterion. */
  section("a reader can predict the hit from the numbers on screen");
  {
    const d = duel("CLINCH");
    const a = mk(["muaythai"]), b = mk(["bjj"]);
    d.p = a; d.e = b;
    A.addStatus(b, "STUNNED");
    A.addStatus(a, "WINDED");
    const L = A.damageLayers(d, a, b, A.TECH.dirty_boxing, null);
    const r2 = (n) => Math.round(n * 100) / 100;
    const onScreen = Math.round(Math.round(L.base) * r2(L.fit) * r2(L.situation) *
                                r2(L.investment) * r2(L.finish) * L.scale);
    const err = Math.abs(onScreen - L.dmg) / Math.max(1, L.dmg);
    ok(err <= 0.20, "displayed numbers predict the hit within 20%",
       "read " + onScreen + ", dealt " + L.dmg + "  (" + (err * 100).toFixed(1) + "%)");
  }
};

