/* =====================================================================
   Aqua Zero Heavens Arena - Warriors-inspired systems
   Luminara Digital

   Covers clinch/ground ownership, cut meters, camp focus, style traits,
   career arcs, callout heat, commentary invariants, and crowd cue families.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;

  section("clinch and ground ownership");
  {
    const p = A.mkSide(0, 100, A.battlePool(0, 9), { human: true, level: 9 });
    const e = A.mkSide(1, 100, A.battlePool(1, 9), { level: 9 });
    const d = { p: p, e: e, range: "MID", pos: "CENTRE" };
    A.resetControl(d);
    ok(d.clinchController === null && d.groundTop === null, "control starts empty");

    d.range = "CLINCH";
    A.syncControlOnRange(d, "MID", "CLINCH", p);
    ok(A.isClinchController(d, p), "closing into clinch awards entrant");
    ok(!A.isClinchController(d, e), "opponent does not silently own clinch");

    const modsCtrl = A.controlModsFor(d, p);
    const modsTrap = A.controlModsFor(d, e);
    ok(modsCtrl.pow > modsTrap.pow, "controller gets a power edge", modsCtrl.pow + " vs " + modsTrap.pow);

    d.range = "GROUND";
    A.syncControlOnRange(d, "CLINCH", "GROUND", p);
    ok(A.isGroundTop(d, p) && A.isGroundBottom(d, e), "takedown awards top/bottom");
    ok(d.clinchController === null, "ground clears clinch controller");

    A.reverseControl(d, e);
    ok(A.isGroundTop(d, e), "reversal flips ground ownership");

    d.range = "MID";
    A.syncControlOnRange(d, "GROUND", "MID", e);
    ok(!d.groundTop && !d.groundBottom, "standing up clears ground ownership");
  }

  section("cut meter and zone snapshots");
  {
    const side = { maxhp: 100, cond: {}, zones: A.newZones(100), cuts: A.newCuts() };
    A.hurtCut(side, 40);
    ok(side.cuts.amount === 40, "cut meter accumulates");
    ok(A.hasStatus(side, "BLEEDING"), "heavy cut opens BLEEDING");
    const pen = A.cutPenalty(side);
    ok(pen.acc < 1, "cuts tax accuracy", pen.acc);
    const snap = A.zoneSnapshot(side);
    ok(snap.head === 100 && snap.cut === 40, "zone snapshot includes cut");
  }

  section("camp focus apply");
  {
    const side = A.mkSide(0, 100, A.battlePool(0, 9), { level: 9 });
    const before = side.atkMul;
    const res = A.applyCampFocus(side, { focus: "striking", workload: "standard" }, () => 0.99);
    ok(res.ok === true, "camp focus applied");
    ok(side.atkMul > before, "striking camp raises attack");
    ok(side.campFocus === "striking", "camp focus recorded on side");
    ok(A.campFocusChoices().length >= 5, "camp offers multiple focuses");
  }

  section("style traits and AI bias");
  {
    const traits = A.styleTraitsOf(0);
    ok(Array.isArray(traits) && traits.length >= 1 && traits.length <= 2, "1-2 traits per fighter");
    const w = A.applyStyleTraitWeights({ aggression: 1, sub: 1 }, ["submission_ace"]);
    ok(w.sub > 1, "submission ace raises sub weight");
    const side = { styleTraits: ["leg_kicker"], discs: ["muaythai"] };
    const score = A.styleTraitScore({ pos: "CENTRE" }, side, {}, A.TECH.mt_low_kick);
    ok(score > 0, "leg kicker scores low kicks higher");
  }

  section("career arcs shape mastery");
  {
    const arc = A.careerArcOf(0);
    ok(!!arc && !!arc.id, "every fighter has a career arc");
    const early = A.careerArcGrowthMul(A.CAREER_ARCS.early_peak, 2);
    const late = A.careerArcGrowthMul(A.CAREER_ARCS.early_peak, 40);
    ok(early > late, "early peak earns more early than late");
    const save = { mastery: {}, fr: { 0: { w: 2, l: 1 } } };
    const xp = A.masteryForWithArc({ win: true }, save, 0);
    ok(xp >= 1, "arc-aware mastery awards at least 1 xp");
    const awarded = A.awardMastery(save, 0, { win: true });
    ok(awarded.gained >= 1 && save.mastery[0] >= awarded.gained, "awardMastery uses arc path");
  }

  section("player callout rivalry heat");
  {
    const save = {};
    const r = A.issueCallout(save, 0, 1);
    ok(r.ok && r.heat >= 2, "callout raises heat");
    ok(A.rivalryHeatOf(save, 0, 1) === r.heat, "heat is readable either direction");
    const d = {
      p: A.mkSide(0, 100, A.battlePool(0, 9), { level: 9 }),
      e: A.mkSide(1, 100, A.battlePool(1, 9), { level: 9 }),
    };
    const before = d.p.atkMul;
    A.applyCalloutHeatToDuel(d, save);
    ok(d.calloutHeat > 0 && d.p.atkMul > before, "heat applies to duel attack");
    A.decayCalloutHeat(save, 0, 1);
    ok(A.rivalryHeatOf(save, 0, 1) < r.heat, "heat decays after a bout");
  }

  section("commentary structural invariants and sealed cards");
  {
    A.AICommentary.clearHistory();
    A.AICommentary.sealScorecards({ judgeA: "30-27", judgeB: "29-28", judgeC: "29-28" });
    ok(A.AICommentary.scorecardsAreSealed() === true, "scorecards start sealed");
    A.AICommentary.generateLine("TAPE", { turn: 0 });
    A.AICommentary.generateLine("ROUND_OPEN", { turn: 1 });
    A.AICommentary.generateLine("CLASH", { turn: 2 });
    A.AICommentary.generateLine("FINISH", { turn: 10 });
    A.AICommentary.generateLine("OFFICIAL_RESULT", { turn: 11 });
    const check = A.AICommentary.assertStructuralPresent();
    ok(check.ok, "structural lines present", (check.missing || []).join(","));
    const reveal = A.AICommentary.revealScorecards(() => 0);
    ok(reveal.sealed === false && A.AICommentary.scorecardsAreSealed() === false, "reveal opens cards");
    ok(A.AICommentary.isStructural("ROUND_SUMMARY") === true, "round summary is structural");
  }

  section("crowd cue family cooldowns");
  {
    A.crowdCueReset();
    const a = A.crowdCue("ko", 1, 0);
    ok(a.suppressed === false && a.gain > 0, "first KO cue plays");
    const b = A.crowdCue("knockdown", 1, 10);
    ok(b.suppressed === true, "same family suppressed inside cooldown");
    const c = A.crowdCue("ko", 1, 200);
    ok(c.suppressed === false, "cue returns after cooldown");
  }

  section("results rows include zone and cut meters");
  {
    const rows = A.fightStatRows({
      dmgDealt: 40, dmgTaken: 20, strikes: 5, throws: 1, subs: 0,
      turns: 8, guards: 1, perfectGuards: 0, comboMax: 2,
      ranges: { MID: 5, CLINCH: 3 },
      zonesDealt: { head: 20, body: 12, legs: 8 },
      cutDealt: 15,
    });
    const keys = rows.map((r) => r.key);
    ok(keys.indexOf("head") >= 0 && keys.indexOf("body") >= 0 && keys.indexOf("legs") >= 0, "zone rows present");
    ok(keys.indexOf("cut") >= 0, "cut row present");
  }

  section("shop camp ticket and mkSide wiring");
  {
    const run = { hero: 0, level: 3, stage: 2, hp: 80, maxhp: 100, purse: 200,
      benefits: [], drafted: [], conditioning: {}, corner: [], relics: [] };
    const stock = A.shopStock(run, () => 0.1);
    const camp = stock.find((i) => i.kind === "CAMP");
    ok(!!camp, "shop stocks a camp focus ticket");
    if (camp) {
      const bought = A.buyItem(run, camp);
      ok(bought.ok && run.camp && run.camp.focus, "buying camp sets run.camp");
    }
    const side = A.mkSide(0, 100, A.battlePool(0, 9), { level: 9 });
    ok(side.zones && side.cuts && Array.isArray(side.styleTraits), "mkSide ships zones, cuts, traits");
  }
};
