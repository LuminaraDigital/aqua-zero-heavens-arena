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
    // but a committed shot does put you on the ground in one motion
    const a = mk(["wrestling"]), b = mk(["boxing"]);
    const d = duel("MID"); d.p = a; d.e = b;
    A.executeTechnique(d, a, b, A.TECH.double_leg, null, () => 0.01);
    ok(d.range === "GROUND", "a double leg from punching range reaches the mat", d.range);
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
    ok(stale <= 1.31, "but it never becomes a free stand-up", stale.toFixed(2));
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
};
