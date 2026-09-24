#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - balance audit
   Luminara Digital

   Plays the whole roster against itself, thousands of fights, using the
   real battle model. Answers the questions a designer cannot answer by
   staring at the numbers:

     - is any fighter dominant or hopeless?
     - how long is a fight, really?
     - is one technique or category eating the game?
     - does the range system actually move, or is it decoration?
     - how much of the outcome is the fighter and how much is the dice?

   Usage: node tools/audit-balance.js [fightsPerPair]
   ===================================================================== */
"use strict";
const boot = require("../tests/harness");
const h = boot({ quiet: true });
const A = h.api;

const REPS = parseInt(process.argv[2] || "6", 10);
const TURN_CAP = 60;

/* deterministic so the audit is reproducible */
function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const usage = {}, catUsage = {}, rangeTurns = {}, discWins = {}, discFights = {}, posTurns = {};
let totalTurns = 0, fights = 0, timeouts = 0, subFinishes = 0, strikeFinishes = 0;
const rangeChanges = [];

function simFight(aFid, bFid, rnd) {
  const P = A.mkSide(aFid, A.hpOf(aFid), A.battlePool(aFid, 9), { human: true, level: 9 });
  const E = A.mkSide(bFid, A.hpOf(bFid), A.battlePool(bFid, 9), { level: 9 });
  P.ai = A.ARCHETYPES[A.archetypeFor(aFid, 1)].weights;
  E.ai = A.ARCHETYPES[A.archetypeFor(bFid, 1)].weights;
  const d = { p: P, e: E, range: A.homeRanges(P.discs)[0] || "MID", lastWhiffBy: null,
              benefits: [], stats: A.newDuelStats() };
  A.resetPosition(d);
  let turn = 0, changes = 0, lastKo = null;
  while (P.hp > 0 && E.hp > 0 && turn < TURN_CAP) {
    const before = d.range;
    const pick = [
      { s: P, f: E, side: "p", t: A.aiChooseTechnique(d, P, E, { noise: 12, rnd }).tech },
      { s: E, f: P, side: "e", t: A.aiChooseTechnique(d, E, P, { noise: 12, rnd }).tech },
    ];
    pick.forEach((x) => (x.init = A.initiativeOf(x.s, x.t, rnd)));
    pick.sort((x, y) => y.init - x.init);
    for (const act of pick) {
      if (act.s.hp <= 0 || act.f.hp <= 0) continue;
      const other = pick.find((z) => z !== act);
      const ev = A.executeTechnique(d, act.s, act.f, act.t, other ? other.t : null, rnd);
      usage[act.t.id] = (usage[act.t.id] || 0) + 1;
      catUsage[act.t.cls] = (catUsage[act.t.cls] || 0) + 1;
      if (ev.whiff) d.lastWhiffBy = act.side; else d.lastWhiffBy = null;
      if (ev.hit) { act.f.hp -= ev.dmg; if (act.f.hp <= 0) lastKo = act.t; }
    }
    rangeTurns[d.range] = (rangeTurns[d.range] || 0) + 1;
    posTurns[d.pos] = (posTurns[d.pos] || 0) + 1;
    A.tickRangeClock(d); A.pressureDecay(d);
    if (d.range !== before) changes++;
    P.hp -= A.endTurnUpkeep(P);
    E.hp -= A.endTurnUpkeep(E);
    turn++;
  }
  totalTurns += turn; fights++; rangeChanges.push(changes);
  if (turn >= TURN_CAP) timeouts++;
  if (lastKo) { if (lastKo.cls === "SUB") subFinishes++; else if (lastKo.cls === "STRIKE") strikeFinishes++; }
  return P.hp > 0 && E.hp <= 0 ? 1 : (E.hp > 0 && P.hp <= 0 ? 0 : 0.5);
}

/* ---- round robin ---- */
const N = A.FIGHTERS.length;
const wins = new Array(N).fill(0), played = new Array(N).fill(0);
const matrix = [];
for (let a = 0; a < N; a++) {
  matrix.push(new Array(N).fill(null));
  for (let b = 0; b < N; b++) {
    if (a === b) continue;
    let w = 0;
    for (let r = 0; r < REPS; r++) w += simFight(a, b, rngFrom(a * 9973 + b * 131 + r * 7));
    matrix[a][b] = w / REPS;
    wins[a] += w; played[a] += REPS;
    A.disciplinesOf(a).forEach((dd) => {
      discFights[dd] = (discFights[dd] || 0) + REPS;
      discWins[dd] = (discWins[dd] || 0) + w;
    });
  }
}

const rate = (i) => wins[i] / played[i];
const order = Array.from({ length: N }, (_, i) => i).sort((x, y) => rate(y) - rate(x));
const pct = (v) => (v * 100).toFixed(1) + "%";

console.log("=========================================================");
console.log("  BALANCE AUDIT - " + fights.toLocaleString() + " fights, " + REPS + " per matchup");
console.log("=========================================================\n");

console.log("-- ROSTER SPREAD (AI vs AI, level 9, no benefits) --");
order.forEach((i, n) => {
  if (n < 5 || n >= N - 5) {
    const bar = "#".repeat(Math.round(rate(i) * 40));
    console.log("  " + String(n + 1).padStart(2) + ". " + A.FIGHTERS[i].name.padEnd(22) +
      pct(rate(i)).padStart(6) + "  " + bar);
  } else if (n === 5) console.log("      ... " + (N - 10) + " more ...");
});
const best = rate(order[0]), worst = rate(order[N - 1]);
console.log("\n  spread: " + pct(best) + " down to " + pct(worst) + "  (gap " + pct(best - worst) + ")");
console.log("  verdict: " + (best - worst > 0.45 ? "BROKEN - some fighters are traps"
  : best - worst > 0.30 ? "LOOSE - noticeable tiers" : "TIGHT - the roster is competitive"));

console.log("\n-- FIGHT LENGTH --");
console.log("  average " + (totalTurns / fights).toFixed(1) + " turns");
console.log("  hit the " + TURN_CAP + "-turn cap: " + pct(timeouts / fights) +
  (timeouts / fights > 0.05 ? "   <-- stalemates are a real problem" : "   (fights resolve)"));

console.log("\n-- WHAT THE AI ACTUALLY THROWS --");
const totalUse = Object.values(usage).reduce((a, b) => a + b, 0);
const topUse = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 10);
topUse.forEach(([id, c]) => {
  const t = A.TECH[id];
  console.log("  " + (c / totalUse * 100).toFixed(1).padStart(5) + "%  " + t.name.padEnd(26) +
    (t.cls + "/" + t.range).padEnd(16) + (A.DISCIPLINES[t.disc] ? A.DISCIPLINES[t.disc].name : "basic"));
});
const distinct = Object.keys(usage).length;
console.log("\n  " + distinct + " of " + A.TECH_IDS.length + " techniques ever thrown (" +
  pct(distinct / A.TECH_IDS.length) + " of the dex)");
console.log("  top technique is " + (topUse[0][1] / totalUse * 100).toFixed(1) + "% of all actions" +
  (topUse[0][1] / totalUse > 0.12 ? "   <-- one move is eating the game" : "   (no single dominant move)"));

console.log("\n-- CATEGORY MIX --");
Object.entries(catUsage).sort((a, b) => b[1] - a[1]).forEach(([c, n]) =>
  console.log("  " + (n / totalUse * 100).toFixed(1).padStart(5) + "%  " + c));

console.log("\n-- DOES RANGE ACTUALLY MOVE? --");
const totalRangeTurns = Object.values(rangeTurns).reduce((a, b) => a + b, 0);
A.RANGE_ORDER.forEach((r) =>
  console.log("  " + ((rangeTurns[r] || 0) / totalRangeTurns * 100).toFixed(1).padStart(5) + "%  " + r));
const avgChanges = rangeChanges.reduce((a, b) => a + b, 0) / rangeChanges.length;
console.log("\n  average range changes per fight: " + avgChanges.toFixed(2) +
  (avgChanges < 1 ? "   <-- the range system is barely used" : "   (range is live)"));

console.log("\n-- HOW FIGHTS END --");
console.log("  submission finishes: " + pct(subFinishes / fights));
console.log("  strike finishes    : " + pct(strikeFinishes / fights));

console.log("\n-- DISCIPLINE WIN RATES --");
Object.keys(discWins).sort((a, b) => (discWins[b] / discFights[b]) - (discWins[a] / discFights[a]))
  .forEach((dd) => {
    const r = discWins[dd] / discFights[dd];
    console.log("  " + pct(r).padStart(6) + "  " + (A.DISCIPLINES[dd] ? A.DISCIPLINES[dd].name : dd));
  });

/* Competitive same-tier finish audit (overall gap <= 6). Mismatch pools
   over-report finishes; this mirrors Simulation Lab style calibration. */
if (process.argv.indexOf("--competitive") >= 0) {
  function overallOf(fid) {
    try {
      const b = typeof A.bioOf === "function" ? A.bioOf(fid) : null;
      if (b && typeof b.ovr === "number") return b.ovr;
    } catch (e) {}
    return 80 + (fid % 10);
  }
  const tiers = { low: [], mid: [], high: [] };
  for (let i = 0; i < N; i++) {
    const o = overallOf(i);
    if (o < 68) tiers.low.push(i);
    else if (o < 80) tiers.mid.push(i);
    else tiers.high.push(i);
  }
  console.log("\n-- COMPETITIVE FINISH RATES (gap <= 6 overall) --");
  ["low", "mid", "high"].forEach((band) => {
    const pool = tiers[band];
    let n = 0, finishes = 0, decisions = 0;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (Math.abs(overallOf(pool[i]) - overallOf(pool[j])) > 6) continue;
        for (let r = 0; r < Math.max(2, Math.min(4, REPS)); r++) {
          const seed = pool[i] * 7919 + pool[j] * 104729 + r * 17 + band.length * 3;
          const beforeSubs = subFinishes, beforeStrikes = strikeFinishes, beforeFights = fights, beforeTimeouts = timeouts;
          simFight(pool[i], pool[j], rngFrom(seed));
          n++;
          const finished = (subFinishes + strikeFinishes) > (beforeSubs + beforeStrikes);
          const timed = timeouts > beforeTimeouts;
          if (finished) finishes++;
          else if (timed || fights > beforeFights) decisions++;
        }
      }
    }
    const finishRate = n ? finishes / n : 0;
    console.log("  " + band.padEnd(5) + " n=" + String(n).padStart(4) +
      "  finish " + pct(finishRate) +
      "  (decision-ish " + pct(n ? (n - finishes) / n : 0) + ")");
  });
  console.log("  note: synthetic competitive pairs; use career results for economy truth");
}