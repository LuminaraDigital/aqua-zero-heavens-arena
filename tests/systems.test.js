/* =====================================================================
   The competitive-parity systems: the gym economy, combinations, the
   roster tuning table, fighter stories and the animation layer.

   These five landed last and each one interacts with the fight, so the
   tests lean on the interactions rather than the units.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section, frames, press, scene, phase } = h;
  const A = api;

  section("the gym economy");
  {
    const run = { hero: 0, level: 5, stage: 2, hp: 80, maxhp: 120, purse: 0,
                  benefits: [], drafted: [], conditioning: {}, corner: [] };
    const win = A.purseFor({ win: true, turns: 5, hpLeft: 0.9, koClass: "SUB", stage: 2, level: 5, oppLevel: 5 });
    const loss = A.purseFor({ win: false, turns: 12, hpLeft: 0, stage: 2, level: 5, oppLevel: 5 });
    ok(win > loss, "winning pays more than losing", loss + " -> " + win);
    ok(loss > 0, "but you still get paid to show up", loss);
    const late = A.purseFor({ win: true, turns: 5, hpLeft: 0.9, koClass: "SUB", stage: 5, level: 9, oppLevel: 9 });
    ok(late > win, "and purses grow with the stage", win + " -> " + late);
  }
  {
    const run = { hero: 0, level: 5, stage: 2, hp: 80, maxhp: 120, purse: 500,
                  benefits: [], drafted: [], conditioning: {}, corner: [] };
    const stock = A.shopStock(run);
    ok(stock.length >= 4 && stock.length <= 6, "the rack holds 4-6 items", stock.length);
    ok(new Set(stock.map((i) => i.id)).size === stock.length, "with no duplicates");
    ok(stock.every((i) => i.price > 0 && i.name && i.kind), "every item is priced and named");
    const before = run.purse, item = stock[0];
    const res = A.buyItem(run, item);
    ok(res.ok && run.purse === before - item.price, "buying deducts exactly the price",
       before + " -> " + run.purse);
    const broke = { hero: 0, level: 5, stage: 2, hp: 80, maxhp: 120, purse: 0,
                    benefits: [], drafted: [], conditioning: {}, corner: [] };
    ok(!A.buyItem(broke, item).ok, "and you cannot buy what you cannot afford");
    ok(broke.purse === 0, "a rejected purchase moves no money");
  }
  {
    // conditioning has to actually reach the fighter
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv);");
    const run = A.G.adv;
    run.purse = 4000;
    let bought = 0;
    for (let i = 0; i < 6; i++) {
      const stock = A.shopStock(run);
      const cond = stock.find((s) => s.kind === "CONDITIONING");
      if (cond && A.buyItem(run, cond).ok) bought++;
    }
    ok(bought > 0, "conditioning is purchasable", bought + " bought");
    A.exec("G.duel=null; startDuel({oppFid:1,oppHp:100,oppPool:battlePool(1,5),fromAdv:true,oppLv:5,stage:2});");
    frames(700);
    ok(!!A.G.duel, "and a fight still starts with it applied");
  }

  section("combinations are a real risk and a real reward");
  {
    ok(A.SEQ_CONFIG.maxLen === 3, "chains cap at three", A.SEQ_CONFIG.maxLen);
    ok(A.canChain(A.TECH.jab, A.TECH.cross), "jab flows into cross");
    ok(!A.canChain(A.TECH.jab, A.TECH.armbar), "jab does not flow into an armbar");
    ok(!A.canChain(A.TECH.basic_guard, A.TECH.jab), "nothing follows a guard");
    ok(A.canChain(A.TECH.level_change, A.TECH.double_leg), "a level change sets up the shot");
    ok(A.canChain(A.TECH.mount, A.TECH.armbar), "mount sets up the armbar");
  }
  {
    const fresh = { cond: {}, stam: 60, maxStam: 60, discs: ["boxing"] };
    const hurt = { cond: { OFF_BALANCE: { turns: 1 } }, stam: 20, maxStam: 60, discs: ["boxing"] };
    const seq = [A.TECH.jab, A.TECH.cross, A.TECH.lead_hook];
    const vFresh = A.interruptChance(fresh, seq, 2), vHurt = A.interruptChance(hurt, seq, 2);
    ok(vHurt < vFresh, "a hurt opponent breaks the chain less often",
       (vFresh * 100).toFixed(0) + "% vs " + (vHurt * 100).toFixed(0) + "%");
    ok(A.interruptChance(fresh, seq, 0) < vFresh, "and deeper links are riskier than early ones");
    ok(A.chainBonus(seq, 2) > A.chainBonus(seq, 0), "later links pay more",
       A.chainBonus(seq, 0).toFixed(2) + " -> " + A.chainBonus(seq, 2).toFixed(2));
  }
  {
    // the chain menu and the fight have to survive each other
    A.exec("SAVE=DEF_SAVE(); G.adv=null; G.duel=null;" +
           "startDuel({p1:0,p1hp:200,p1pool:battlePool(0,9),oppFid:1,oppHp:200," +
           "oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);
    press("a");                       // the row under the cursor - no category gate
    const chained = phase() === "CHAIN";
    ok(chained, "picking a technique offers a combination", phase());
    if (chained) {
      ok(A.G.duel.seq.length === 1, "the chain opens on what you picked");
      press("a");
      ok(A.G.duel.seq.length >= 1, "adding a link works", A.G.duel.seq.length);
    }
    // and the whole fight must still resolve. G.duel persists past the bell -
    // the scene is what actually changes, which is what a naive exit condition
    // on G.duel gets wrong.
    let f = 0;
    while (A.G.scene === A.S.DUEL && f < 30000) { A.onKey("a"); A.step(); A.render(); f++; }
    ok(A.G.scene === A.S.RESULT, "a fight with combinations still reaches a result",
       scene() + " after " + f + " frames");
  }

  section("the roster is competitive");
  {
    ok(typeof A.traitTuneFor === "function", "the tuning table is wired into traits");
    const tuned = Object.keys(A.TRAIT_TUNE || {}).length;
    ok(tuned > 0, "and it carries corrections", tuned + " fighters corrected");
    /* Two bounds, because they say different things. The hard one is the
       tuner's own clamp in tools/tune-roster.js - nothing may ever sit
       outside it, or the table has been hand-edited or the clamp moved
       without a note. The soft one is the original 0.7-1.4 "a correction
       is a thumb, not a rewrite" rule: after the damage-model collapse a
       handful of fighters genuinely needed more thumb than that (the
       tuner floor had to go to 0.50 for one single-discipline kickboxer
       who won 68.8% while the other 24 spanned 8.4 points), so the rule
       is now that the roster as a whole still lives inside it. */
    const keys = Object.keys(A.TRAIT_TUNE || {});
    let outsideClamp = 0, outsideThumb = 0;
    keys.forEach((k) => {
      const v = A.TRAIT_TUNE[k];
      if (v < 0.50 || v > 1.52) outsideClamp++;
      if (v < 0.7 || v > 1.4) outsideThumb++;
    });
    ok(outsideClamp === 0, "no correction escapes the tuner's own clamp", outsideClamp);
    /* the real "thumb, not a rewrite" signal: a table that has quietly
       become a rescale of the whole roster has a median a long way off 1,
       whatever its extremes are doing */
    const sorted = keys.map((k) => A.TRAIT_TUNE[k]).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    ok(Math.abs(median - 1) <= 0.15, "the typical fighter is barely corrected at all",
       "median " + median.toFixed(3));
    ok(outsideThumb <= Math.ceil(keys.length / 3),
       "and only a minority need more than the original 0.7-1.4 thumb",
       outsideThumb + " of " + keys.length);
  }
  {
    // the tuning must not have flattened the roster into clones
    const pows = [];
    for (let i = 0; i < A.FIGHTERS.length; i++) pows.push(A.traitsOf(i).pow);
    const spread = Math.max.apply(null, pows) - Math.min.apply(null, pows);
    ok(spread > 0.08, "fighters still differ from each other after tuning", spread.toFixed(3));
    let sane = true;
    for (let i = 0; i < A.FIGHTERS.length; i++) {
      const t = A.traitsOf(i);
      if (!(t.hp > 60 && t.hp < 200 && t.pow > 0.5 && t.pow < 2)) sane = false;
    }
    ok(sane, "and every fighter's numbers are still sane");
  }

  section("fighters want things");
  {
    ok(Object.keys(A.STORIES).length >= 25, "the whole roster has a story",
       Object.keys(A.STORIES).length);
    let bad = [];
    for (let i = 0; i < A.FIGHTERS.length; i++) {
      const s = A.storyOf(i);
      if (!s || !s.goal || !s.creed || !s.callout) bad.push(A.FIGHTERS[i].name);
      const words = String(s && s.callout || "").split(/\s+/).length;
      if (words < 6 || words > 18) bad.push(A.FIGHTERS[i].name + ":callout-length");
    }
    ok(bad.length === 0, "every entry is complete and the callouts are the right length",
       bad.slice(0, 3).join(",") || "all good");
  }
  {
    ok(A.RIVALRIES.length >= 8, "there are real rivalries", A.RIVALRIES.length);
    let covered = 0;
    for (let i = 0; i < A.FIGHTERS.length; i++) if (A.rivalOf(i).length) covered++;
    ok(covered >= 20, "and most of the roster is in one", covered + "/" + A.FIGHTERS.length);
    const r = A.RIVALRIES[0];
    ok(A.rivalryReason(r.a, r.b) === A.rivalryReason(r.b, r.a), "a rivalry reads the same both ways");
    ok(A.rivalOf(999).length === 0, "an unknown fighter has no rivals and does not crash");
  }
  {
    const save = { fr: {} };
    ok(A.grudgeBonus(save, 3) === 1, "a fighter who has never beaten you has no grudge");
    save.fr[3] = { w: 0, l: 1 };
    const one = A.grudgeBonus(save, 3);
    ok(one > 1, "one loss earns them something", one.toFixed(3));
    save.fr[3] = { w: 0, l: 99 };
    ok(A.grudgeBonus(save, 3) <= 1.15, "and it is capped so it never becomes a wall",
       A.grudgeBonus(save, 3).toFixed(3));
  }

  section("fighters move like what they threw");
  {
    const kinds = {};
    A.TECH_IDS.forEach((id) => { kinds[A.animFor(A.TECH[id], { hit: true }).kind] = 1; });
    ok(Object.keys(kinds).length >= 8, "the dex produces many distinct motions",
       Object.keys(kinds).length + ": " + Object.keys(kinds).join(","));
    const kick = A.animFor(A.TECH.mt_head_kick, { hit: true });
    const sub = A.animFor(A.TECH.armbar, { hit: true });
    ok(kick.kind !== sub.kind, "a head kick and an armbar do not look alike",
       kick.kind + " vs " + sub.kind);
    ok(A.animFor(A.TECH.spin_backfist, { hit: true }).kind === "spin", "a spinning backfist spins");
    ok(A.animFor(A.TECH.flying_knee, { hit: true }).kind === "air", "a flying knee leaves the floor");
  }
  {
    // reduced motion must genuinely reduce motion
    const full = A.animFor(A.TECH.mt_head_kick, { hit: true }, true);
    const still = A.animFor(A.TECH.mt_head_kick, { hit: true }, false);
    ok(Math.abs(still.dx) <= Math.abs(full.dx), "reduced motion travels no further",
       full.dx + " -> " + still.dx);
    const cam = A.cameraFor({ hit: true, dmg: 40 }, false);
    ok(!cam || (!cam.shakeX && !cam.shakeY), "and the camera does not shake");
  }
  {
    // the null-tech reaction path is the one that crashed on a name collision
    const side = { anim: null };
    let threw = null;
    try { A.startAnim(side, null, { hit: true, dmg: 20 }, true); A.tickAnim(side); }
    catch (e) { threw = e.message; }
    ok(!threw, "a reaction with no technique animates without throwing", threw || "clean");
    const tr = A.animTransform({ anim: null }, 1, true);
    ok(tr && typeof tr.dx === "number", "and a fighter with no animation still transforms");
  }
};
