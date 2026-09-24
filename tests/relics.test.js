/* =====================================================================
   Aqua Zero Heavens Arena - Synergistic Relics & Adventure Meta Perks
   Comprehensive Test Suite
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;
  const X = (src) => A.exec(src);
  const J = (src) => A.exec("JSON.parse(JSON.stringify((" + src + ")))");
  const fresh = () =>
    A.exec("SAVE=DEF_SAVE(); G.adv=null; G.duel=null; persist(); 1");

  section("relics catalogue & data structures");
  {
    ok(typeof A.RELICS === "object" && A.RELICS !== null, "RELICS catalogue exists");
    ok(Array.isArray(A.RELIC_IDS), "RELIC_IDS is an array");
    ok(A.RELIC_IDS.length >= 16, "at least 16 relics catalogued", A.RELIC_IDS.length);
    ok(Array.isArray(A.RELIC_TIERS), "RELIC_TIERS is an array");

    let bad = [];
    A.RELIC_IDS.forEach((id) => {
      const r = A.RELICS[id];
      if (!r || !r.name || !r.desc || !r.tier || !r.tag) bad.push(id + ":missing_field");
      if (A.RELIC_TIERS.indexOf(r.tier) < 0) bad.push(id + ":bad_tier_" + r.tier);
    });
    ok(bad.length === 0, "all relics have valid fields and tiers", bad.join(",") || "clean");
  }

  section("relic choices & drafting");
  {
    ok(typeof A.relicChoices === "function", "relicChoices is a function");
    const c1 = A.relicChoices([]);
    ok(Array.isArray(c1) && c1.length === 3, "choices returns 3 relics", c1.length);
    ok(new Set(c1).size === 3, "all 3 choices are distinct");

    const c2 = A.relicChoices(["serrated_tape", "rubber_soles"]);
    ok(c2.indexOf("serrated_tape") < 0 && c2.indexOf("rubber_soles") < 0,
      "already held relics are excluded from choices");

    const rarePicks = A.relicChoices([], "RARE");
    ok(rarePicks.every((id) => A.RELICS[id].tier === "RARE"),
      "tier-filtered choices only return relics of that tier");
  }

  section("relic flags & dispatch mechanics");
  {
    ok(typeof A.relicFlag === "function", "relicFlag is a function");
    ok(A.relicFlag(["ankle_locks"], "preventSprawl") === true, "ankle_locks provides preventSprawl flag");
    ok(A.relicFlag(["rubber_soles"], "preventSprawl") === false, "other relics do not provide preventSprawl");
    ok(A.relicFlag([], "preventSprawl") === false, "empty relic list returns false");
    ok(A.relicFlag(["shadow_stance"], "alwaysTell") === true, "shadow_stance provides alwaysTell");
  }

  section("relic hooks: damage calculations & exponential multipliers");
  {
    fresh();
    X("var mockD = { p: { fid: 0 }, e: { fid: 1 }, styleState: { lastGrade: 'SSS' } };");
    X("mockD.p.hp = 100; mockD.p.maxhp = 100; mockD.p.stam = 50; mockD.p.maxStam = 60;");
    X("mockD.e.hp = 100; mockD.e.maxhp = 100; mockD.e.cond = {};");

    // 1. Glass Katana: +80% damage dealt
    const katanaDmg = X("relicHook(['glass_katana'], 'onDmgCalc', 20, { side: mockD.p, d: mockD })");
    ok(katanaDmg === 36, "glass_katana multiplies damage by 1.80x (20 -> 36)", katanaDmg);

    // 2. Neon Spotlight: SSS Grade multiplies damage by 3.20x
    const neonDmg = X("relicHook(['neon_spotlight'], 'onDmgCalc', 20, { side: mockD.p, d: mockD })");
    ok(neonDmg === 64, "neon_spotlight SSS grade multiplies damage by 3.20x (20 -> 64)", neonDmg);

    // 3. Apex Predator: 2.5x critical damage when opponent has 2+ conditions
    X("mockD.e.cond = { BLEEDING: 2, OFF_BALANCE: 1 };");
    const apexDmg = X("relicHook(['apex_predator'], 'onDmgCalc', 20, { side: mockD.p, foe: mockD.e, d: mockD })");
    ok(apexDmg === 50, "apex_predator inflicts 2.5x critical damage on 2+ conditions (20 -> 50)", apexDmg);

    // 4. Weighted Gloves: +15% damage on strikes
    const glovesDmg = X("relicHook(['weighted_gloves'], 'onDmgCalc', 20, { side: mockD.p, tech: { cls: 'STRIKE' }, d: mockD })");
    ok(glovesDmg === 23, "weighted_gloves increases strike damage by 15%", glovesDmg);

    // 5. Rubber Soles: +10 accuracy
    X("mockD.p.accBonus = 0; relicHook(['rubber_soles'], 'onPreStrike', null, { side: mockD.p, d: mockD });");
    ok(X("mockD.p.accBonus") === 10, "rubber_soles grants +10 accBonus on pre-strike", X("mockD.p.accBonus"));
  }

  section("relic hooks: stateful & transcendent rule-breakers");
  {
    fresh();
    X("var mockD2 = { p: { fid: 0 }, e: { fid: 1 } };");
    X("mockD2.p.hp = 10; mockD2.p.maxhp = 100; mockD2.p.stam = 5; mockD2.p.maxStam = 60;");

    // Phoenix Ember Awakening at <= 15% HP
    X("var emberList = ['phoenix_ember'];");
    X("relicHook(emberList, 'onTurnStart', null, { side: mockD2.p, d: mockD2 });");
    ok(X("mockD2.p.stam === mockD2.p.maxStam"), "phoenix_ember restores full stamina on low HP");
    ok(X("mockD2.p.atkMul === 2.0"), "phoenix_ember grants 2.0x attack multiplier on awakening");
    ok(X("mockD2.p.invulnerable === 1"), "phoenix_ember grants 1 turn of invulnerability");

    // Ouroboros Chain: overrides chain length and scales exponentially
    ok(A.RELICS.ouroboros_chain.chainCapOverride === 99, "ouroboros_chain overrides combo chain cap to 99");
    X("var ouroCtx = { side: mockD2.p, d: mockD2, linkIndex: 3, cost: 10, chainMult: 1 };");
    X("relicHook(['ouroboros_chain'], 'onComboLink', null, ouroCtx);");
    ok(X("ouroCtx.chainMult > 1.8"), "ouroboros_chain compounds 1.35x exponential combo multiplier", X("ouroCtx.chainMult"));

    // Counter Prism: doubles parry counter damage and stuns foe
    X("mockD2.e.cond = {};");
    X("var counterEv = { counter: 14 };");
    X("relicHook(['counter_prism'], 'onCounter', null, { side: mockD2.p, foe: mockD2.e, ev: counterEv, d: mockD2 });");
    ok(X("counterEv.counter") === 28, "counter_prism doubles counter damage (14 -> 28)");
    ok(X("mockD2.e.cond.STUNNED && (mockD2.e.cond.STUNNED.turns === 1 || mockD2.e.cond.STUNNED === 1)"), "counter_prism applies STUNNED to opponent");
  }

  section("shop integration for relics");
  {
    fresh();
    X("var mockRun = { stage: 1, hp: 100, maxhp: 100, purse: 500, relics: [], benefits: [] };");
    const rItem = J("relicItem(mockRun, 'rubber_soles')");
    ok(rItem && rItem.kind === "RELIC", "relicItem returns RELIC kind");
    ok(rItem.id === "rubber_soles", "relicItem carries correct id");
    ok(rItem.price > 0, "relicItem has a non-zero price", rItem.price);

    // Stock generation includes a relic
    const stock = J("shopStock(mockRun)");
    ok(stock.some((it) => it.kind === "RELIC"), "shopStock offers a relic slot in shop");

    // Buying relic adds it to run
    X("var buyRes = buyItem(mockRun, relicItem(mockRun, 'rubber_soles'));");
    ok(X("buyRes.ok === true"), "buying relic succeeds");
    ok(X("mockRun.relics.indexOf('rubber_soles') >= 0"), "purchased relic added to run.relics");
    ok(X("mockRun.purse < 500"), "relic purchase debited run purse");
  }

  section("adventure permanent meta-progression perks");
  {
    fresh();
    ok(typeof A.ADV_PERKS === "object", "ADV_PERKS catalogue defined");
    ok(Array.isArray(A.ADV_PERK_IDS), "ADV_PERK_IDS is defined");
    ok(A.ADV_PERK_IDS.length >= 4, "at least 4 adventure perks defined", A.ADV_PERK_IDS.length);

    // Check pool with no perks bought
    const freshPool = J("metaRunPool(SAVE)");
    ok(!freshPool.startFocus, "fresh save has no starting focus");
    ok(!freshPool.ironGritMul, "fresh save has no iron grit HP");
    ok(!freshPool.revives, "fresh save has no second wind revives");

    // Buy perks with renown
    X("SAVE.meta.renown = 500;");
    const buyFocus = J("buyAdvPerk(SAVE, 'adv_focus')");
    ok(buyFocus.ok === true, "bought Starting Focus perk");

    const buyGrit = J("buyAdvPerk(SAVE, 'adv_grit')");
    ok(buyGrit.ok === true, "bought Iron Grit perk");

    const buyRevive = J("buyAdvPerk(SAVE, 'adv_second_wind')");
    ok(buyRevive.ok === true, "bought Second Wind revive perk");

    const upgradedPool = J("metaRunPool(SAVE)");
    ok(upgradedPool.startFocus === 1, "metaRunPool reflects +1 starting focus", upgradedPool.startFocus);
    ok(upgradedPool.ironGritMul === 0.10, "metaRunPool reflects +10% iron grit HP", upgradedPool.ironGritMul);
    ok(upgradedPool.revives === 1, "metaRunPool reflects 1 revive", upgradedPool.revives);

    // Verify newAdv reads them and starts with bonus HP and revives
    X("G.adv = newAdv(0, 0);");
    ok(X("G.adv.startFocus === 1"), "newAdv includes startFocus");
    ok(X("G.adv.revives === 1"), "newAdv includes revives");
    ok(X("G.adv.hp > hpOf(0)"), "newAdv grants iron grit HP bonus to adventure run", X("G.adv.hp"));
    ok(Array.isArray(X("G.adv.relics")), "newAdv initializes relics array");

    // Verify ranked ladder is unaffected (zero sum parity)
    fresh();
    X("SAVE.meta.renown = 500; buyAdvPerk(SAVE, 'adv_grit');");
    X("G.duel = startDuel({ p1: 0, p1hp: hpOf(0), p1pool: battlePool(0, 9), oppFid: 1, oppHp: hpOf(1), oppPool: battlePool(1, 5), ranked: true, fromAdv: false });");
    ok(X("G.duel.p.hp === hpOf(0)"), "ranked bout HP is strictly unbuffed (fair ranked parity)", X("G.duel.p.hp"));
  }
};
