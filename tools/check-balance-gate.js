#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - balance gate
   Luminara Digital

   Runs tools/audit-balance.js and fails CI when the roster stops being a
   game. The audit is already deterministic: every fight is seeded from
   (fighterA, fighterB, rep), so the same build always prints the same
   numbers and a threshold here means the same thing on every machine.

   Rep count: 4 fights per matchup is 2,400 fights and runs in ~21s on a
   laptop (measured 2026-09-21). It is also what docs/IMPLEMENTATION_PLAN.md
   used for its baseline, so the numbers in the plan's table and the
   numbers this gate reads are the same numbers.

   Usage: node tools/check-balance-gate.js [repsPerPair]
   ===================================================================== */
"use strict";

/* One parser, shared with tools/gen-docs.js. The two used to hold separate
   copies of the same regexes and had already drifted: this file took the
   discipline spread as max-min while gen-docs took the first and last printed
   row, and this file's GROUND regex was unscoped, so a technique row printing
   "3.2%  GROUND" could have supplied the range share. Same parse now, and one
   audit run feeds both consumers instead of two. */
const audit = require("./lib/parse-audit");

const REPS = parseInt(process.argv[2] || "4", 10);

/* ---------------------------------------------------------------------
   thresholds. Every number here is a HARD gate unless marked soft.
   The plan's rule: tighten freely, never loosen without a note in
   docs/IMPLEMENTATION_PLAN.md.

   ratchet history (date  metric  old -> new  reason)
     2026-09-21  all      created from the plan table, baseline audit:
                          gap 58.3 / disc gap 53.2 / GROUND 48.5 / MID 14.2 /
                          sub 57.0 / strike 23.9 / len 7.7 / dex 189
     2026-09-22  none     A3 (damage-model collapse + ground re-price +
                          re-tune) brought every hard gate inside the plan's
                          own targets, so nothing was ratcheted and nothing
                          was loosened. Measured on that build:
                          gap 10.4 / disc gap 7.3 / GROUND 30.4 / MID 26.4 /
                          sub 33.7 / strike 42.3 / len 15.5 / extremes 1 /
                          dex 59.3 (soft, still short of 65).
                          Thinnest margins: fight length is 0.5 off its
                          16-turn ceiling and strike finishes 2.3 above
                          their floor. The audit is deterministic, so a thin
                          margin is a fixed number rather than a flaky one -
                          but anything that moves the ground game moves
                          GROUND, MID, both finish shares and fight length
                          at once, so re-measure all of them together.
   --------------------------------------------------------------------- */
const GATES = {
  /* best minus worst win rate across the roster, percentage points */
  ROSTER_GAP_MAX: 15,
  /* best minus worst discipline win rate, percentage points */
  DISCIPLINE_GAP_MAX: 20,
  /* share of all turns spent at each range */
  GROUND_SHARE_MIN: 25,
  GROUND_SHARE_MAX: 35,
  MID_SHARE_MIN: 20,
  /* share of fights ended by a submission / a strike */
  SUB_FINISH_MAX: 40,
  STRIKE_FINISH_MIN: 40,
  /* turns per fight */
  FIGHT_LEN_MIN: 11,
  FIGHT_LEN_MAX: 16,
  /* clamp signature: how many fighters share the best (or the worst) win
     rate. At 4 reps a win rate is a multiple of 1/96, so two fighters on
     the same number is chance; three or more piled on the ceiling is what
     a clamp looks like (the 2026-09-21 baseline had four at 74.0%). */
  IDENTICAL_AT_EXTREME_MAX: 2,
  /* SOFT until Phase 3: share of the dex the AI ever throws */
  DEX_COVERAGE_MIN_SOFT: 65,
};

/* ---------------------------------------------------------------------
   run the audit, then read it through the shared parser. A label the
   parser could not find lands in `parsed.missing` and becomes a gate
   failure, not a silent pass.
   --------------------------------------------------------------------- */
const t0 = Date.now();
const run = audit.runAudit({ reps: REPS });
if (!run.ok) {
  console.error("balance gate FAILED: audit did not run (" + run.err + ")");
  console.error(String(run.tail || run.stdout || "").slice(-2000));
  process.exit(1);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const parsed = audit.parseAudit(run.stdout);
const failures = parsed.missing.slice(), warnings = [];
const g = parsed.gate;
const rosterGap = g.rosterGap;
const fightLen = g.fightLen;
const groundShare = g.groundShare;
const midShare = g.midShare;
const subFinish = g.subFinish;
const strikeFinish = g.strikeFinish;
const dexCoverage = g.dexCoverage;
const identicalAtExtreme = g.identicalAtExtreme;
const discGap = g.discGap;

/* ---------------------------------------------------------------------
   judge
   --------------------------------------------------------------------- */
function gate(label, value, ok, want) {
  const line = label.padEnd(30) + String(Number.isFinite(value) ? +value.toFixed(1) : value).padStart(7) + "   " + want;
  if (ok) console.log("  ok    " + line);
  else { console.log("  FAIL  " + line); failures.push(label + " = " + (+value.toFixed(1)) + ", want " + want); }
}
function soft(label, value, ok, want) {
  const line = label.padEnd(30) + String(+value.toFixed(1)).padStart(7) + "   " + want;
  if (ok) console.log("  ok    " + line);
  else { console.log("  warn  " + line + "   (soft until Phase 3)"); warnings.push(label + " = " + (+value.toFixed(1)) + ", want " + want); }
}

console.log("balance gate: " + REPS + " fights per matchup, audit took " + secs + "s\n");
gate("roster win-rate gap (pts)", rosterGap, rosterGap <= GATES.ROSTER_GAP_MAX, "<= " + GATES.ROSTER_GAP_MAX);
gate("discipline win-rate gap (pts)", discGap, discGap <= GATES.DISCIPLINE_GAP_MAX, "<= " + GATES.DISCIPLINE_GAP_MAX);
gate("GROUND share of turns (%)", groundShare, groundShare >= GATES.GROUND_SHARE_MIN && groundShare <= GATES.GROUND_SHARE_MAX,
  GATES.GROUND_SHARE_MIN + ".." + GATES.GROUND_SHARE_MAX);
gate("MID share of turns (%)", midShare, midShare >= GATES.MID_SHARE_MIN, ">= " + GATES.MID_SHARE_MIN);
gate("submission finishes (%)", subFinish, subFinish <= GATES.SUB_FINISH_MAX, "<= " + GATES.SUB_FINISH_MAX);
gate("strike finishes (%)", strikeFinish, strikeFinish >= GATES.STRIKE_FINISH_MIN, ">= " + GATES.STRIKE_FINISH_MIN);
gate("average fight length (turns)", fightLen, fightLen >= GATES.FIGHT_LEN_MIN && fightLen <= GATES.FIGHT_LEN_MAX,
  GATES.FIGHT_LEN_MIN + ".." + GATES.FIGHT_LEN_MAX);
gate("fighters sharing an extreme", identicalAtExtreme, identicalAtExtreme <= GATES.IDENTICAL_AT_EXTREME_MAX,
  "<= " + GATES.IDENTICAL_AT_EXTREME_MAX);
soft("dex coverage (%)", dexCoverage, dexCoverage >= GATES.DEX_COVERAGE_MIN_SOFT, ">= " + GATES.DEX_COVERAGE_MIN_SOFT);

if (warnings.length) {
  console.log("\nsoft warnings:");
  warnings.forEach((w) => console.log("  - " + w));
}
if (failures.length) {
  console.error("\nbalance gate FAILED:");
  failures.forEach((f) => console.error("  - " + f));
  console.error("\nrun `node tools/audit-balance.js " + REPS + "` for the full report, " +
    "`node tools/tune-roster.js` to re-fit the roster.");
  process.exit(1);
}
console.log("\nOK  balance gate: all hard gates pass");
process.exit(0);
