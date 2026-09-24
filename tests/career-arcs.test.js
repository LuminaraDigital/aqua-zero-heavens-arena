/* =====================================================================
   Aqua Zero Heavens Arena - career arcs
   Luminara Digital

   Potential is a ceiling, not a destination. The arc is permanent per
   fighter, fight count is the age, and the only thing a player ever
   sees of it is the mastery number after a fight: an early peaker's
   first win is worth more than a late developer's, and less than his
   own once he is past his prime. Those are the numbers pinned here,
   with the resurgence dice driven by hand so nothing is left to chance.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;
  const X = (src) => A.exec(src);
  const ARCS = A.CAREER_ARCS;

  section("four arcs");
  {
    ok(A.CAREER_ARC_IDS.join(",") === "early_peak,standard,late_developer,long_prime", "four shapes of a career",
       A.CAREER_ARC_IDS.join(","));
    ok(A.CAREER_ARC_IDS.every((id) => ARCS[id].id === id && !!ARCS[id].name && !!ARCS[id].note), "each named and explained");
    ok(A.CAREER_ARC_IDS.every((id) => ARCS[id].primeStart <= ARCS[id].primeEnd &&
       ARCS[id].earlyMul > 0 && ARCS[id].primeMul > 0 && ARCS[id].lateMul > 0),
       "every prime opens before it closes and no multiplier is zero");
    ok(ARCS.late_developer.primeMul > ARCS.early_peak.primeMul && ARCS.long_prime.primeEnd > ARCS.early_peak.primeEnd,
       "the names are honest: late developers peak higher, long primes last");
    // KNOWN DEFECT: early_peak's earlyMul (1.35) is never applied because its
    // primeStart is 0, so careerPhase never returns "early" for it. In play an
    // early peaker's debut pays primeMul 1.05x against standard's earlyMul
    // 1.10x - the "fast early gains" fighter grows slower than the textbook
    // one at every stage. This check is RED on purpose until the arc is fixed.
    ok(A.careerArcGrowthMul(ARCS.early_peak, 0) > A.careerArcGrowthMul(ARCS.standard, 0),
       "KNOWN DEFECT: an early peaker's debut should out-grow a standard fighter's",
       A.careerArcGrowthMul(ARCS.early_peak, 0) + " vs " + A.careerArcGrowthMul(ARCS.standard, 0));
  }

  section("the phases");
  {
    ok(A.careerPhase(ARCS.standard, 0) === "early" && A.careerPhase(ARCS.standard, 7) === "early",
       "before the prime starts you are early");
    ok(A.careerPhase(ARCS.standard, 8) === "prime" && A.careerPhase(ARCS.standard, 40) === "prime",
       "the prime is inclusive at both ends");
    ok(A.careerPhase(ARCS.standard, 41) === "late", "one past the end and you are late");
    /* was "is in his prime from fight one", which is what the primeStart: 0 bug
       produced. Six fights of early now, so the 1.35 is reachable. */
    ok(A.careerPhase(ARCS.early_peak, 0) === "early" && A.careerPhase(ARCS.early_peak, 5) === "early",
       "an early peaker opens in his early phase, where his bonus lives");
    ok(A.careerPhase(ARCS.early_peak, 6) === "prime" && A.careerPhase(ARCS.early_peak, 19) === "late",
       "and he peaks sooner than a standard fighter - prime at six, late past eighteen");
    ok(A.careerPhase(null, 3) === "early" && A.careerPhase(ARCS.standard, -5) === "early",
       "no arc reads as standard, and garbage fights read as none");
  }
  {
    ok(A.careerArcGrowthMul(ARCS.late_developer, 2) === 0.75 && A.careerArcGrowthMul(ARCS.late_developer, 30) === 1.3 &&
       A.careerArcGrowthMul(ARCS.late_developer, 60) === 0.95,
       "a late developer grows 25% slower young, 30% faster in his prime, 5% slower old");
    // the three rates an early peaker actually sees, now that earlyMul is
    // reachable: the fast start the arc is named for, the plateau it warns
    // about, and the drop past eighteen
    ok(A.careerArcGrowthMul(ARCS.early_peak, 0) === 1.35 &&
       A.careerArcGrowthMul(ARCS.early_peak, 10) === 1.05 &&
       A.careerArcGrowthMul(ARCS.early_peak, 40) === 0.7,
       "an early peaker grows 35% faster young, plateaus in his prime, 30% slower once past it");
    ok(A.careerArcGrowthMul("late_developer", 30) === 1.3, "an arc can be named by id");
    ok(A.careerArcGrowthMul("nonsense", 30) === 1 && A.careerArcGrowthMul(null, 30) === ARCS.standard.primeMul,
       "an unknown id is neutral and a missing arc is the standard one");
  }

  section("who gets which arc");
  {
    const n = A.FIGHTERS.length;
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(A.careerArcOf(i).id);
    ok(ids.every((id) => !!ARCS[id]), "every fighter on the roster has a real arc");
    ok(ids.every((id, i) => A.careerArcOf(i).id === id), "and it is the same arc every time you ask");
    ok(new Set(ids).size === 4, "the roster spans all four arcs", Array.from(new Set(ids)).join(","));
    const grappleArts = ["bjj", "wrestling", "judo", "sambo", "subgrap", "grappling", "jiujitsu"];
    let grapplersOk = true, strikersOk = true, grapplers = 0, strikers = 0;
    for (let i = 0; i < n; i++) {
      const g = A.disciplinesOf(i).some((d) => grappleArts.indexOf(d) >= 0);
      if (g) { grapplers++; if (ids[i] === "early_peak") grapplersOk = false; }
      else { strikers++; if (ids[i] === "long_prime") strikersOk = false; }
    }
    ok(grapplers > 0 && strikers > 0, "the roster has both grapplers and strikers", grapplers + "/" + strikers);
    ok(grapplersOk, "no grappler is an early peaker");
    ok(strikersOk, "and no pure striker holds a long prime");
    ok(A.careerArcOf(9999).id === ARCS[A.careerArcOf(9999).id].id, "a fighter off the roster still gets an arc");
  }

  section("fight count is the age");
  {
    ok(A.careerFightCount(null, 0) === 0 && A.careerFightCount({}, 0) === 0, "no record, no age");
    ok(A.careerFightCount({ fr: { 3: { w: 3, l: 2 } } }, 3) === 5, "wins and losses both count");
    ok(A.careerFightCount({ fr: { "4": { w: 1, l: 0 } } }, 4) === 1, "a string key reads the same as a number");
    ok(A.careerFightCount({ fr: { 3: { w: 3 } } }, 5) === 0, "a fighter with no row is a debutant");
    ok(A.careerFightCount({ fr: { 3: { w: -9, l: "x" } } }, 3) === 0, "a corrupt row never reads negative");
  }

  section("the resurgence");
  {
    const arc = ARCS.early_peak;   // prime ends at 18
    ok(A.careerArcResurgeChance(arc, 30, false, () => 0) === false, "a loss never resurges, even on a perfect roll");
    ok(A.careerArcResurgeChance(arc, 18, true, () => 0) === false, "nor does a win inside the prime");
    ok(A.careerArcResurgeChance(arc, 19, true, () => 0) === true, "one fight past the prime it is possible");
    ok(A.careerArcResurgeChance(arc, 19, true, () => 0.99) === false, "but it is rare");
    ok(A.careerArcResurgeChance(arc, 23, true, () => 0.03) === true &&
       A.careerArcResurgeChance(arc, 30, true, () => 0.03) === false &&
       A.careerArcResurgeChance(arc, 40, true, () => 0.01) === true &&
       A.careerArcResurgeChance(arc, 40, true, () => 0.02) === false,
       "and it falls off with age: 4.5% just past the prime, then 2.7%, then 1.6%");
  }

  section("the number the player sees");
  {
    // early_peak fighter 5, late_developer fighter 15 (see roster probe)
    const ep = A.FIGHTERS.map((f, i) => i).find((i) => A.careerArcOf(i).id === "early_peak");
    const ld = A.FIGHTERS.map((f, i) => i).find((i) => A.careerArcOf(i).id === "late_developer");
    ok(ep !== undefined && ld !== undefined, "an early peaker and a late developer are on the card", ep + "/" + ld);
    exec("SAVE=DEF_SAVE(); persist();");
    const base = A.exec("masteryFor({win:true})");
    /* the whole point of the arc, and what the primeStart bug was costing:
       his debut now pays MORE than a standard fighter's, not less */
    ok(A.masteryForWithArc({ win: true }, A.getSave(), ep) === Math.round(base * ARCS.early_peak.earlyMul),
       "an early peaker's debut win pays his fast-start rate", A.masteryForWithArc({ win: true }, A.getSave(), ep));
    ok(A.masteryForWithArc({ win: true }, A.getSave(), ld) === Math.round(base * ARCS.late_developer.earlyMul),
       "a late developer's debut win pays his slow start", A.masteryForWithArc({ win: true }, A.getSave(), ld));
    ok(A.masteryForWithArc({ win: true }, A.getSave(), ld) < A.masteryForWithArc({ win: true }, A.getSave(), ep),
       "so the same first win is worth less to the late developer");
    // age him out of his prime with a loss so the resurgence dice stay out of it
    A.getSave().fr[ep] = { w: ARCS.early_peak.primeEnd + 5, l: 0 };
    const lateLoss = A.masteryForWithArc({ win: false }, A.getSave(), ep);
    A.getSave().fr[ep] = { w: 0, l: 0 };
    const primeLoss = A.masteryForWithArc({ win: false }, A.getSave(), ep);
    ok(lateLoss < primeLoss, "past his prime the same fight teaches him less", primeLoss + " -> " + lateLoss);
    // and with the dice pinned, the resurgence is a visible 25% on top
    A.getSave().fr[ep] = { w: ARCS.early_peak.primeEnd + 5, l: 0 };
    X("globalThis.__rnd0=Math.random; Math.random=()=>0.99;");
    const lateWin = A.masteryForWithArc({ win: true }, A.getSave(), ep);
    X("Math.random=()=>0;");
    const resurged = A.masteryForWithArc({ win: true }, A.getSave(), ep);
    X("Math.random=globalThis.__rnd0; delete globalThis.__rnd0;");
    ok(resurged === Math.round(lateWin * 1.25), "a resurgence pays a quarter more", lateWin + " -> " + resurged);
    // the arc reaches the save through awardMastery and the side through mkSide
    A.getSave().fr[ld] = { w: 0, l: 0 };
    const award = A.awardMastery(A.getSave(), ld, { win: true });
    ok(award.gained === Math.round(base * ARCS.late_developer.earlyMul), "awardMastery pays the arc-adjusted number", award.gained);
    exec("startDuel({p1:" + ld + ",oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    ok(A.G.duel.p.careerArc === "late_developer", "and the side carries its arc into the duel", A.G.duel.p.careerArc);
  }
};
