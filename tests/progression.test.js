/* =====================================================================
   The retention layer: camp benefits, fighter mastery, the daily
   gauntlet, challenges and titles, and opponent gameplans.

   These tests care as much about the guard-rails as the features - a
   benefit that trivialises the fight or a streak that punishes a loss
   would be worse than not shipping them.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section, frames, press, scene, phase } = h;
  const A = api;

  section("camp benefits give a run its own shape");
  {
    ok(A.BENEFIT_IDS.length >= 24, "there are enough to make runs differ", A.BENEFIT_IDS.length);
    const tags = {};
    A.BENEFIT_IDS.forEach((id) => (tags[A.BENEFITS[id].tag] = 1));
    ok(Object.keys(tags).length >= 5, "spread across several kinds of camp", Object.keys(tags).join(","));
    let bad = [];
    A.BENEFIT_IDS.forEach((id) => {
      const b = A.BENEFITS[id];
      if (!b.name || !b.desc) bad.push(id + ":copy");
      const hooks = ["side", "dmgOut", "dmgIn", "turnEnd", "onPick", "onStatus", "accOut"];
      if (!hooks.some((k) => b[k]) && !b.guardAll && !b.perfectFocus && !b.stageHeal &&
          !b.freeRead && !b.levelBonus && !b.chainPlus && !b.purseMul) bad.push(id + ":inert");
    });
    ok(bad.length === 0, "every benefit actually does something", bad.join(",") || "all live");
  }
  {
    // no single CAMP benefit may swing damage more than a third. EDGE
    // benefits are exempt by design - breaking a stated rule is their whole
    // identity - but an EDGE that boosts damage must charge for it on the
    // way in, or it is just a bigger number wearing a costume.
    const d = { range: "MID", lastWhiffBy: "e" };
    const side = { hp: 50, maxhp: 100 }, foe = { hp: 20, maxhp: 100 };
    let worst = 1;
    A.BENEFIT_IDS.forEach((id) => {
      const b = A.BENEFITS[id];
      if (!b.dmgOut || b.tag === "EDGE") return;
      const out = b.dmgOut(100, { d, side, foe, tech: A.TECH.jab, ev: {} });
      worst = Math.max(worst, out / 100);
    });
    ok(worst <= 1.35, "no camp benefit multiplies damage past 1.35x", worst.toFixed(2) + "x");
    A.BENEFIT_IDS.forEach((id) => {
      const b = A.BENEFITS[id];
      if (b.tag !== "EDGE" || !b.dmgOut) return;
      ok(!!b.dmgIn && b.dmgIn(100) > 100,
         "EDGE damage (" + id + ") is paid for in damage taken", b.dmgIn && b.dmgIn(100));
    });
  }
  {
    const first = A.benefitChoices([]);
    ok(first.length === 3, "the camp offers exactly three", first.length);
    ok(new Set(first).size === 3, "and never the same one twice");
    const held = A.BENEFIT_IDS.slice(0, A.BENEFIT_IDS.length - 2);
    const late = A.benefitChoices(held);
    ok(late.every((id) => held.indexOf(id) < 0), "it never re-offers what you already hold");
  }
  {
    // the pick screen actually applies it and moves the run on
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv); G.scene=S.STAGECLEAR;");
    const stage0 = A.G.adv.stage;
    press("a");
    ok(scene() === "BENEFIT", "clearing a stage offers the choice", scene());
    press("a");
    ok(scene() === "SHOP", "taking one sends you to the gym to spend the purse", scene());
    press("b");
    ok(scene() === "MAP", "and leaving the gym returns you to the field", scene());
    ok(A.G.adv.benefits.length === 1, "and the run now carries it", A.G.adv.benefits.join());
    ok(A.G.adv.stage === stage0 + 1, "the stage advanced exactly once", A.G.adv.stage);
  }
  {
    // and it reaches the fight
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); G.adv.benefits=['gas_tank']; newField(G.adv);" +
           "G.duel=null; startDuel({oppFid:1,oppHp:90,oppPool:battlePool(1,5),fromAdv:true,oppLv:5,stage:2});");
    frames(700);
    ok(A.G.duel.p.maxStam >= 77, "a stamina benefit is on the fighter at the bell", A.G.duel.p.maxStam);
    ok(A.G.duel.benefits.indexOf("gas_tank") >= 0, "and the duel knows about it");
    A.exec("G.duel=null; G.adv=null;");
  }

  section("mastery makes a lost run still count");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    const loss = A.awardMastery(S, 3, { win: false });
    ok(loss.gained > 0, "losing still earns mastery", loss.gained);
    const win = A.awardMastery(S, 3, { win: true, perfect: true });
    ok(win.gained > loss.gained, "winning earns more", loss.gained + " vs " + win.gained);
    ok(A.masteryXp(S, 3) === loss.gained + win.gained, "and it accumulates");
    ok(A.masteryXp(S, 4) === 0, "per fighter, not shared");
  }
  {
    const S = A.getSave();
    S.mastery = { 7: 0 };
    ok(A.masteryRank(0).level === 0, "everyone starts unranked");
    ok(A.masteryRank(1000).level === A.MASTERY_MAX, "and tops out at black", A.masteryRank(1000).name);
    let last = -1, monotonic = true;
    A.MASTERY_RANKS.forEach((r) => { if (r.need < last) monotonic = false; last = r.need; });
    ok(monotonic, "the belt thresholds only go up");
    ok(A.masteryToNext(0) > 0 && A.masteryToNext(1000) === 0, "the to-next readout is sane");
  }
  {
    // the perks land on the fighter, and stay modest
    A.exec("SAVE=DEF_SAVE(); SAVE.mastery={0:640}; persist(); G.duel=null;" +
           "startDuel({p1:0,p1hp:100,p1pool:battlePool(0,9),oppFid:1,oppHp:100," +
           "oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);
    const mastered = { focus: A.G.duel.p.focusMax, stam: A.G.duel.p.maxStam, sup: A.G.duel.p.sup };
    A.exec("SAVE=DEF_SAVE(); persist(); G.duel=null;" +
           "startDuel({p1:0,p1hp:100,p1pool:battlePool(0,9),oppFid:1,oppHp:100," +
           "oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);
    const raw = { focus: A.G.duel.p.focusMax, stam: A.G.duel.p.maxStam, sup: A.G.duel.p.sup };
    ok(mastered.focus === raw.focus + 1, "a black belt has one more focus", raw.focus + " -> " + mastered.focus);
    ok(mastered.stam === raw.stam + 10, "and ten more stamina", raw.stam + " -> " + mastered.stam);
    ok(mastered.sup > raw.sup, "and starts with some signature banked");
    ok(mastered.stam / raw.stam < 1.2, "mastery smooths, it does not break the game",
       (mastered.stam / raw.stam).toFixed(2) + "x stamina");
    A.exec("G.duel=null;");
  }
  {
    A.exec("SAVE=DEF_SAVE(); SAVE.mastery={5:200}; persist();");
    ok(A.exec("masteryStartLevel(SAVE,5)") === 2, "a blue belt starts adventures further along");
    ok(A.exec("masteryStartLevel(SAVE,6)") === 1, "an unknown fighter does not");
    ok(A.exec("newAdv(5,0).level") === 2, "and the run is built with it");
  }

  section("the daily gauntlet is the same fight for everyone");
  {
    const a = A.dailySetup(20260807, 25), b = A.dailySetup(20260807, 25);
    ok(JSON.stringify(a) === JSON.stringify(b), "the same date always gives the same fight");
    const c = A.dailySetup(20260808, 25);
    ok(JSON.stringify(a) !== JSON.stringify(c), "a different date gives a different one");
    ok(a.hero !== a.opp, "you never fight yourself");
    ok(a.hero >= 0 && a.hero < 25 && a.opp >= 0 && a.opp < 25, "both fighters are on the roster");
    ok(a.stips.length >= 1 && a.stips.length <= 2, "one or two stipulations, never a soup", a.stips.length);
    ok(a.stips.every((s) => !!A.STIPULATIONS[s]), "and they are all real");
  }
  {
    // 400 days: every day is playable and reasonably varied
    const heroes = {}, stips = {};
    for (let i = 0; i < 400; i++) {
      const s = A.dailySetup(20260101 + i, 25);
      if (s.hero === s.opp) ok(false, "day " + i + " paired a fighter with themselves");
      heroes[s.hero] = 1; s.stips.forEach((x) => (stips[x] = 1));
    }
    ok(Object.keys(heroes).length >= 15, "the year uses most of the roster", Object.keys(heroes).length + " fighters");
    ok(Object.keys(stips).length >= 8, "and most of the stipulations", Object.keys(stips).length);
  }
  {
    const S = A.getSave();
    S.daily = null;
    const D = A.dailyState(S, 20260807);
    ok(D.streak === 0 && !D.done, "a fresh day starts clean");
    A.completeDaily(S, 20260807, 900);
    ok(S.daily.done && S.daily.streak === 1, "playing it starts the streak");
    A.dailyState(S, 20260808);
    ok(S.daily.streak === 1, "playing the next day keeps it", S.daily.streak);
    A.completeDaily(S, 20260808, 100);
    ok(S.daily.streak === 2, "and extends it", S.daily.streak);
    ok(S.daily.best === 900, "the best score is the best, not the latest", S.daily.best);
    A.dailyState(S, 20260812);                     // skipped days
    ok(S.daily.streak === 0, "skipping a day ends the streak");
  }
  {
    // the streak must not punish losing - that is the whole design
    const S = A.getSave();
    S.daily = null;
    A.dailyState(S, 20260901);
    A.completeDaily(S, 20260901, 0);               // a loss scores zero
    ok(S.daily.streak === 1, "a loss still counts as showing up", S.daily.streak);
    const r = A.completeDaily(S, 20260901, 5000);
    ok(r.already, "and you only get one attempt a day");
  }
  {
    const better = A.dailyScore({ win: true, hpLeft: 0.9, turns: 4, sigPerfect: 1, comboMax: 3, perfectGuards: 2 });
    const worse = A.dailyScore({ win: true, hpLeft: 0.2, turns: 14, sigPerfect: 0, comboMax: 0, perfectGuards: 0 });
    ok(better > worse, "finishing healthy and fast scores higher", worse + " -> " + better);
    ok(A.dailyScore({ win: false, hpLeft: 0.9, turns: 3 }) === 0, "losing scores nothing");
  }
  {
    // it runs end to end
    A.exec("SAVE=DEF_SAVE(); persist(); G.scene=S.MENU;");
    ok(A.menuItems().some((it) => it[2] === "daily"), "the daily is on the menu");
    A.exec("G.scene=S.DAILY;");
    frames(3);
    ok(scene() === "DAILY", "the gauntlet screen renders");
    press("a");
    ok(scene() === "DUEL" && A.G.duel.daily, "and starts the fight", scene());
    A.exec("G.duel.e.hp=0; endDuel(G.duel);");
    ok(scene() === "RESULT" && A.G.result.kind === "dailywin", "a win records the gauntlet", A.G.result.kind);
    ok(A.getSave().daily.done, "and today is marked done");
    ok(A.getSave().daily.streak === 1, "with the streak started");
  }

  section("titles reward how you win, never with power");
  {
    ok(A.CHALLENGES.length >= 18, "there are real goals to chase", A.CHALLENGES.length);
    let bad = [];
    A.CHALLENGES.forEach((c) => {
      if (!c.title || !c.desc || !c.name) bad.push(c.id + ":copy");
      // the whole point: a title is cosmetic
      ["power", "stat", "bonus", "reward", "grant"].forEach((k) => { if (c[k]) bad.push(c.id + ":" + k); });
    });
    ok(bad.length === 0, "every title is cosmetic and documented", bad.join(",") || "all clean");
  }
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    const st = A.newDuelStats();
    st.win = true; st.dmgTaken = 0; st.turns = 3;
    const won = A.evaluateChallenges(S, st);
    ok(won.indexOf("first_blood") >= 0, "winning earns the debut title");
    ok(won.indexOf("untouched") >= 0, "a flawless win earns its own");
    ok(won.indexOf("quick_work") >= 0, "so does a fast one");
    const again = A.evaluateChallenges(S, st);
    ok(again.length === 0, "and titles are never earned twice");
  }
  {
    const S = A.getSave();
    S.titles = []; S.title = null;
    const st = A.newDuelStats();
    st.win = true; st.koClass = "SUB";
    ok(A.evaluateChallenges(S, st).indexOf("tap_them") >= 0, "finishing with a submission is recognised");
    S.titles = [];
    const st2 = A.newDuelStats();
    st2.win = true; st2.koClass = "STRIKE"; st2.koRange = "LONG";
    ok(A.evaluateChallenges(S, st2).indexOf("head_kick_ko") >= 0, "so is a kicking-range finish");
  }
  {
    const S = A.getSave();
    S.titles = ["untouched"]; S.title = null;
    ok(A.activeTitle(S) === A.titleOf("untouched"), "the newest title is worn by default");
    S.title = "untouched";
    ok(A.activeTitle(S) === "Untouchable", "and you can pick one", A.activeTitle(S));
    S.titles = []; S.title = null;
    ok(A.activeTitle(S) === null, "with none earned, you wear none");
  }

  section("opponents have gameplans you can read");
  {
    ok(A.ARCHETYPE_IDS.length >= 5, "there are several", A.ARCHETYPE_IDS.length);
    A.ARCHETYPE_IDS.forEach((id) => {
      const a = A.ARCHETYPES[id];
      ok(!!a.name && !!a.tell, id + " is named and explained");
    });
    const seen = {};
    for (let i = 0; i < A.FIGHTERS.length; i++) seen[A.archetypeFor(i, 1)] = 1;
    ok(Object.keys(seen).length >= 3, "the roster spreads across gameplans", Object.keys(seen).join(","));
    ok(A.archetypeFor(4, 1) === A.archetypeFor(4, 1), "a fighter's gameplan is stable, not a die roll");
  }
  {
    // a grappler must actually want the mat more than an out-fighter does
    const mk = (arch) => ({ cond: {}, discs: ["mma"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1,
                            stamMul: 1, hp: 100, maxhp: 100, level: 9, fid: 0, sup: 0, sig: null,
                            techs: A.knownTechs(0, 9), ai: A.ARCHETYPES[arch].weights });
    const foe = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    const grap = mk("grappler"), out = mk("outfighter");
    const d = { range: "MID", p: foe, e: grap, lastWhiffBy: null };
    const td = A.TECH.double_leg;
    const gScore = A.scoreTechnique(d, grap, foe, td, 0, () => 0.5);
    d.e = out;
    const oScore = A.scoreTechnique(d, out, foe, td, 0, () => 0.5);
    ok(gScore > oScore, "a grappler values a takedown more than an out-fighter does",
       Math.round(oScore) + " vs " + Math.round(gScore));
  }
  {
    // and the fight assigns one, and says what it is
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=null; G.duel=null;" +
           "startDuel({p1:0,p1hp:100,p1pool:battlePool(0,9),oppFid:9,oppHp:100," +
           "oppPool:battlePool(9,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);
    ok(!!A.G.duel.arch, "the opponent has a gameplan", A.G.duel.arch);
    ok(!!A.G.duel.e.ai, "and the AI is running it");
    ok(!!A.ARCHETYPES[A.G.duel.arch].tell, "which can be described to the player");
    A.exec("G.duel=null;");
  }

  section("a full run still works with all of it on");
  {
    // benefits stack across stages and keep applying
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv);");
    for (let i = 0; i < 4; i++) {
      A.exec("G.scene=S.STAGECLEAR;");
      press("a");                                  // offer
      press("a");                                  // take the first
      press("b");                                  // leave the gym
    }
    const held = A.G.adv.benefits;
    ok(held.length === 4, "four stages leave four benefits", held.length);
    ok(new Set(held).size === 4, "and never a duplicate", held.join(","));
    ok(A.G.adv.stage === 5, "the run advanced once per stage", A.G.adv.stage);
    A.exec("G.duel=null; startDuel({oppFid:1,oppHp:90,oppPool:battlePool(1,5),fromAdv:true,oppLv:5,stage:5});");
    frames(700);
    ok(A.G.duel.benefits.length === 4, "and the whole camp reaches the fight", A.G.duel.benefits.length);
  }
  {
    // 20k frames of mashing with every system live, watching for a throw
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    const keys = ["a", "right", "down", "left", "up", "b", "y"];
    let threw = null, seen = {};
    try {
      for (let i = 1; i <= 20000; i++) {
        A.onKey(keys[(i * 3) % keys.length]);   // stride coprime with the key count
        A.step(); A.render();
        seen[A.G.scene] = 1;
      }
    } catch (e) { threw = String(e && e.message || e); }
    ok(!threw, "20,000 frames of random play with everything on, no exception", threw || "clean");
    ok(Object.keys(seen).length >= 4, "and it moved through several screens", Object.keys(seen).length);
    const S = A.getSave();
    ok(typeof S.mastery === "object" && Array.isArray(S.titles), "the save survived intact");
  }
};
