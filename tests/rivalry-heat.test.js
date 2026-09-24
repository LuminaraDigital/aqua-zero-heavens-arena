/* =====================================================================
   Aqua Zero Heavens Arena - callouts and media heat
   Luminara Digital

   A player calls someone out, the heat between them goes up, and the
   next time they meet both corners hit a little harder and the purse is
   a little fatter. Heat lives on the save, caps at 8, decays a point at
   a time, and never touches ranked points. What is pinned here is the
   heat the player would see (2 a callout, 3 for an authored rival, 8
   at most), the bite at the bell (1.5% attack per point, on BOTH
   corners), the purse line (4 a point) and the fact that a callout
   changes nothing else on the save.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;
  const C = A.CALLOUT_CONFIG;

  section("keys and the bag");
  {
    ok(A.calloutKey(3, 1) === "1:3" && A.calloutKey(1, 3) === "1:3", "a pair is the same pair from either side");
    ok(A.calloutKey("3", 1) === "1:3", "and ids are read as integers");
    const nothing = A.ensureCallouts(null);
    ok(nothing && Object.keys(nothing.heat).length === 0 && nothing.log.length === 0, "no save gets an empty bag, not a throw");
    const junk = { callouts: "nonsense" };
    A.ensureCallouts(junk);
    ok(typeof junk.callouts === "object" && typeof junk.callouts.heat === "object" && Array.isArray(junk.callouts.log),
       "a corrupt bag is rebuilt");
    const half = { callouts: { heat: { "0:1": 5 } } };
    A.ensureCallouts(half);
    ok(half.callouts.heat["0:1"] === 5 && Array.isArray(half.callouts.log), "a bag missing its log keeps its heat");
  }

  section("reading heat");
  {
    exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    ok(A.rivalryHeatOf(S, 0, 1) === 0, "a fresh save has no heat anywhere");
    ok(A.rivalryHeatOf(S, 4, 4) === 0 && A.rivalryHeatOf(S, null, 1) === 0, "no heat with yourself or with nobody");
    S.callouts.heat["0:1"] = 99;
    ok(A.rivalryHeatOf(S, 1, 0) === C.heatCap, "a stored value over the cap reads as the cap", A.rivalryHeatOf(S, 1, 0));
    S.callouts.heat["0:1"] = -3;
    ok(A.rivalryHeatOf(S, 0, 1) === 0, "and a negative one reads as none");
  }

  section("issuing a callout");
  {
    exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    ok(A.issueCallout(S, 2, 2).ok === false && A.issueCallout(S, 2, 2).reason === "bad_pair", "you cannot call yourself out");
    ok(A.issueCallout(null, 0, 1).ok === false && A.issueCallout(S, 0, null).ok === false, "nor call out nobody");
    const pair = [1, 2];
    ok(!A.isRivalPair(pair[0], pair[1]), "fighters 1 and 2 have no authored history");
    // snapshot the save before anything is issued, so the "nothing else
    // moved" check below has something to move
    const before = JSON.parse(JSON.stringify(S));
    delete before.callouts;
    const r = A.issueCallout(S, pair[0], pair[1]);
    ok(r.ok === true && r.heat === C.heatGain && r.gained === C.heatGain && r.key === "1:2",
       "a first callout is worth " + C.heatGain + " heat", JSON.stringify(r));
    ok(A.rivalryHeatOf(S, pair[1], pair[0]) === C.heatGain, "and it reads back from the other corner");
    const rival = A.RIVALRIES[0];
    const rr = A.issueCallout(S, rival.a, rival.b);
    ok(A.isRivalPair(rival.a, rival.b) && rr.gained === C.heatGain + 1,
       "calling out an authored rival is worth one more", rr.gained);
    const after = JSON.parse(JSON.stringify(S));
    delete after.callouts;
    ok(S.callouts.heat["1:2"] === C.heatGain && JSON.stringify(before) === JSON.stringify(after),
       "two callouts changed the heat and nothing else on the save");
    ok(S.callouts.log.length === 2 && S.callouts.log[0].from === pair[0] && S.callouts.log[0].to === pair[1] &&
       S.callouts.log[0].heat === C.heatGain && typeof S.callouts.log[0].at === "number",
       "the press remembers who called out whom");
  }
  {
    exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    let last = null;
    for (let i = 0; i < 60; i++) last = A.issueCallout(S, 5, 6);
    ok(last.heat === C.heatCap && last.gained === 0, "heat stops at " + C.heatCap + " and further callouts add nothing", last.heat);
    ok(S.callouts.log.length === C.maxStored, "the press only keeps the last " + C.maxStored, S.callouts.log.length);
  }

  section("decay");
  {
    exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    A.issueCallout(S, 0, 1);
    ok(A.decayCalloutHeat(S, 1, 0) === C.heatGain - C.heatDecay, "a quiet week takes a point off");
    ok(A.decayCalloutHeat(S, 0, 1) === 0 && !("0:1" in S.callouts.heat), "and when it hits zero the pair is forgotten");
    ok(A.decayCalloutHeat(S, 0, 1) === 0 && A.decayCalloutHeat(null, 0, 1) === 0, "nothing decays below nothing");
  }

  section("the bite at the bell");
  {
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    const cold = A.G.duel;
    ok(cold.calloutHeat === undefined && cold.calloutLine === undefined, "no heat, no headline");
    ok(A.applyCalloutHeatToDuel(cold, A.getSave()) === 0, "and applying nothing returns nothing");
    const pAtk0 = cold.p.atkMul, eAtk0 = cold.e.atkMul;
    cold.range = "MID";
    const dmg0 = A.damageOf(cold, cold.p, cold.e, A.TECH.cross);
    A.issueCallout(A.getSave(), 0, 1);
    exec("startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    const warm = A.G.duel;
    ok(warm.calloutHeat === C.heatGain && warm.calloutLine === "MEDIA HEAT ON THIS CARD",
       "one callout puts media heat on the card", warm.calloutLine);
    const mul = 1 + C.heatGain * C.atkMulPerHeat;
    ok(Math.abs(warm.p.atkMul - pAtk0 * mul) < 1e-9 && Math.abs(warm.e.atkMul - eAtk0 * mul) < 1e-9,
       "and both corners hit " + ((mul - 1) * 100).toFixed(0) + "% harder", warm.p.atkMul / pAtk0);
    for (let i = 0; i < 5; i++) A.issueCallout(A.getSave(), 0, 1);
    exec("startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    const hot = A.G.duel;
    ok(hot.calloutHeat === C.heatCap && hot.calloutLine === "THE CALLOUT MADE THIS PERSONAL",
       "keep calling him out and it gets personal", hot.calloutLine);
    // two points of heat is 3%, which a 24-power cross rounds away; the cap is
    // 12%, which it cannot
    hot.range = "MID";
    ok(A.damageOf(hot, hot.p, hot.e, A.TECH.cross) > dmg0, "and at full heat the cross shows it on the damage line",
       dmg0 + " -> " + A.damageOf(hot, hot.p, hot.e, A.TECH.cross));
    ok(A.applyCalloutHeatToDuel({ p: {}, e: {} }, null) === 0 && A.applyCalloutHeatToDuel(null, A.getSave()) === 0,
       "a duel with no save, or no duel, is left alone");
  }

  section("the purse");
  {
    exec("SAVE=DEF_SAVE(); persist();");
    ok(A.calloutPurseBonus(A.getSave(), 0, 1) === 0, "no heat, no bonus");
    A.issueCallout(A.getSave(), 0, 1);
    ok(A.calloutPurseBonus(A.getSave(), 1, 0) === C.heatGain * C.purseBonusPerHeat,
       "each point of heat is " + C.purseBonusPerHeat + " on the purse", A.calloutPurseBonus(A.getSave(), 1, 0));
    for (let i = 0; i < 9; i++) A.issueCallout(A.getSave(), 0, 1);
    ok(A.calloutPurseBonus(A.getSave(), 0, 1) === C.heatCap * C.purseBonusPerHeat, "and it tops out with the heat");
  }
};
