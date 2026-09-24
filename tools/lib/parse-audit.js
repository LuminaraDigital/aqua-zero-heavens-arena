/* =====================================================================
   Aqua Zero Heavens Arena - one parser for tools/audit-balance.js
   Luminara Digital

   TWO CALL SITES, and they must never disagree:

     tools/check-balance-gate.js   turns these numbers into pass/fail
     tools/gen-docs.js             writes them into ARCHITECTURE.md

   They used to hold separate copies of the same regexes, and the copies
   had already drifted apart in two places that would have produced
   different answers from identical audit output:

     - the discipline gap. One copy took the first and last printed row
       positionally; the other took max minus min. They agree only while
       the audit happens to print sorted, and the day it doesn't, the
       gate and the docs report different gaps for the same build with
       neither of them erroring.
     - the range shares. One copy scoped its regex to the range section;
       the other matched /([\d.]+)%  GROUND/ anywhere in stdout, which is
       a technique row away from being wrong.

   This module is the stricter of each pair: every regex is scoped to the
   section that owns it, and every extreme is min/max, never positional.
   A label change in audit-balance.js is now one fix, here.

   Nothing throws. `parseAudit` returns a `missing` array of
   already-formatted failure strings, because the gate wants to report
   every missing label and still run its remaining checks, while gen-docs
   wants to bail on the first sign of a half-written page. Each caller
   decides; the parse is the same parse.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const AUDIT = path.join(ROOT, "tools", "audit-balance.js");
const BUILD = path.join(ROOT, "tools", "build.js");
const PAGE = path.join(ROOT, "aqua-zero-heavens-arena.html");
const CACHE = path.join(ROOT, ".build", "temp", "audit-cache.json");

/* 4 fights per matchup is what docs/IMPLEMENTATION_PLAN.md measured its
   baseline table with and what the gate runs, so the plan, the gate and
   ARCHITECTURE.md all quote one set of numbers. */
const DEFAULT_REPS = 4;

/* ---------------------------------------------------------------------
   parse
   --------------------------------------------------------------------- */

function parseAudit(stdout) {
  const out = String(stdout || "");
  const missing = [];

  /* the gate's existing wording, kept verbatim so its failure output
     does not change when it switches to this module */
  function want(label) { missing.push("could not find '" + label + "' in audit output"); }

  function section(label, next) {
    const i = out.indexOf(label);
    if (i < 0) { missing.push("could not find section '" + label + "'"); return ""; }
    const j = next ? out.indexOf(next, i) : -1;
    return out.slice(i, j < 0 ? undefined : j);
  }
  function num(hay, re, label) {
    const m = hay.match(re);
    if (!m) { want(label); return NaN; }
    return parseFloat(m[1]);
  }
  function str(hay, re, label) {
    const m = hay.match(re);
    if (!m) { want(label); return ""; }
    return m[1].trim();
  }

  /* every lookup below reads its own section, never the whole stdout.
     "3.2%  Juji-Gatame  SUB/GROUND" is one loose regex away from being
     read as the GROUND share of turns. */
  const header = section("BALANCE AUDIT", "-- ROSTER SPREAD");
  const rosterSec = section("-- ROSTER SPREAD", "-- FIGHT LENGTH");
  const lenSec = section("-- FIGHT LENGTH --", "-- WHAT THE AI ACTUALLY THROWS --");
  const dexSec = section("-- WHAT THE AI ACTUALLY THROWS --", "-- CATEGORY MIX --");
  const rangeSec = section("-- DOES RANGE ACTUALLY MOVE? --", "-- HOW FIGHTS END --");
  const finishSec = section("-- HOW FIGHTS END --", "-- DISCIPLINE WIN RATES --");
  const discSec = section("-- DISCIPLINE WIN RATES --", "-- COMPETITIVE FINISH RATES");

  const fights = parseInt(
    str(header, /BALANCE AUDIT - ([\d,]+) fights/, "fight count").replace(/,/g, ""), 10);
  const repsSeen = num(header, /fights, (\d+) per matchup/, "reps per matchup");

  const rosterBest = num(rosterSec, /spread: ([\d.]+)% down to/, "roster spread best");
  const rosterWorst = num(rosterSec, /spread: [\d.]+% down to ([\d.]+)%/, "roster spread worst");
  const verdict = str(rosterSec, /verdict: (.+)/, "verdict");

  const fightLen = num(lenSec, /average ([\d.]+) turns/, "average turns");
  const turnCap = num(lenSec, /hit the (\d+)-turn cap/, "turn cap");
  const hitCapPct = num(lenSec, /hit the \d+-turn cap: ([\d.]+)%/, "turn cap share");

  const subFinish = num(finishSec, /submission finishes: ([\d.]+)%/, "submission finishes");
  const strikeFinish = num(finishSec, /strike finishes\s*: ([\d.]+)%/, "strike finishes");

  const dexThrown = num(dexSec, /(\d+) of \d+ techniques ever thrown/, "techniques thrown");
  const dexTotal = num(dexSec, /\d+ of (\d+) techniques ever thrown/, "dex size");

  /* roster rows: "  1. Ruslan Magomedov       61.5%  ####". The audit
     prints only the top five and the bottom five, so a tie counted here
     is a tie at a printed extreme, not across the whole roster - which
     is exactly the clamp signature the plan asks about, and is why the
     metric is named for the printed extreme and not for the roster. */
  const rosterRows = [];
  rosterSec.split("\n").forEach((l) => {
    const m = l.match(/^\s+(\d+)\.\s+(.+?)\s+([\d.]+)%/);
    if (m) rosterRows.push({ rank: +m[1], name: m[2].trim(), rate: parseFloat(m[3]) });
  });
  if (!rosterRows.length) missing.push("could not parse any roster rows");

  /* discipline rows: "   61.5%  Sambo" */
  const discRows = [];
  discSec.split("\n").forEach((l) => {
    const m = l.match(/^\s+([\d.]+)%\s+(.+)$/);
    if (m) discRows.push({ rate: parseFloat(m[1]), name: m[2].trim() });
  });
  if (!discRows.length) missing.push("could not parse any discipline rows");

  /* range rows: "   22.6%  GROUND" - anchored to the whole line so a
     technique row can never supply one */
  const rangeSharePct = {};
  rangeSec.split("\n").forEach((l) => {
    const m = l.match(/^\s+([\d.]+)%\s+(LONG|MID|CLINCH|GROUND)\s*$/);
    if (m) rangeSharePct[m[2]] = parseFloat(m[1]);
  });
  ["LONG", "MID", "CLINCH", "GROUND"].forEach((r) => {
    if (!(r in rangeSharePct)) { rangeSharePct[r] = NaN; want(r + " share"); }
  });

  /* extremes by value, never by print order */
  const rates = rosterRows.map((r) => r.rate);
  const atBestRate = rates.filter((r) => r === rosterBest).length;
  const atWorstRate = rates.filter((r) => r === rosterWorst).length;
  const bestRow = pickExtreme(rosterRows, rosterBest, "max");
  const worstRow = pickExtreme(rosterRows, rosterWorst, "min");
  const discBest = pickExtreme(discRows, NaN, "max");
  const discWorst = pickExtreme(discRows, NaN, "min");

  const discGap = discRows.length ? round1(discBest.rate - discWorst.rate) : NaN;
  /* Two forms on purpose. The roster and discipline gaps are differences of
     two rates the audit already prints to 1dp, so rounding there only strips
     IEEE noise (61.5 - 40.6 = 20.900000000000006) and cannot move a gate whose
     thresholds are integers. Dex coverage is a true ratio, so rounding it WOULD
     move a gate: a raw 64.96 becomes 65.0 and passes `>= 65`. That is a 0.04pt
     loosening of a gate the plan turns hard in Phase 3, and the plan forbids
     loosening without a note - so the gate reads the raw value and only the
     human-facing report rounds. */
  const dexCoverageRaw = dexThrown / dexTotal * 100;
  const dexCoverage = round1(dexCoverageRaw);

  return {
    missing: missing,
    fights: fights,
    repsSeen: repsSeen,
    roster: {
      fighters: rosterRows.length ? Math.max.apply(null, rosterRows.map((r) => r.rank)) : NaN,
      best: { name: bestRow.name, ratePct: rosterBest },
      worst: { name: worstRow.name, ratePct: rosterWorst },
      /* subtracted from the two printed rates rather than read off the
         audit's own "(gap x%)", which rounds the raw fractions and can
         land 0.1 away. Both call sites subtract, so the number that
         fails CI and the number in the docs are one number. */
      gapPts: round1(rosterBest - rosterWorst),
      atBestRate: atBestRate,
      atWorstRate: atWorstRate,
      identicalAtExtreme: Math.max(atBestRate, atWorstRate),
      verdict: verdict,
    },
    discipline: {
      count: discRows.length,
      best: { name: discBest.name, ratePct: discBest.rate },
      worst: { name: discWorst.name, ratePct: discWorst.rate },
      gapPts: discGap,
    },
    rangeSharePct: rangeSharePct,
    finishSharePct: { submission: subFinish, strike: strikeFinish },
    fightLength: { avgTurns: fightLen, turnCap: turnCap, hitCapPct: hitCapPct },
    techniques: { thrown: dexThrown, total: dexTotal, coveragePct: dexCoverage },

    /* flat aliases in the names tools/check-balance-gate.js already uses,
       so its gate() calls need no rewriting when it switches over */
    gate: {
      rosterBest: rosterBest, rosterWorst: rosterWorst, rosterGap: round1(rosterBest - rosterWorst),
      fightLen: fightLen, groundShare: rangeSharePct.GROUND, midShare: rangeSharePct.MID,
      subFinish: subFinish, strikeFinish: strikeFinish,
      /* raw, not rounded - see the note beside dexCoverageRaw above */
      dexThrown: dexThrown, dexTotal: dexTotal, dexCoverage: dexCoverageRaw,
      identicalAtExtreme: Math.max(atBestRate, atWorstRate), discGap: discGap,
    },
  };
}

/* first row at the max, last row at the min - deterministic under ties.
   `known` pins the value when the audit printed it separately (the
   roster's "spread:" line); NaN means derive it from the rows. */
function pickExtreme(rows, known, dir) {
  if (!rows.length) return { name: "", rate: NaN };
  const vals = rows.map((r) => r.rate);
  const target = Number.isFinite(known) ? known
    : (dir === "max" ? Math.max.apply(null, vals) : Math.min.apply(null, vals));
  const hits = rows.filter((r) => r.rate === target);
  if (!hits.length) return dir === "max" ? rows[0] : rows[rows.length - 1];
  return dir === "max" ? hits[0] : hits[hits.length - 1];
}

function round1(n) { return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN; }

/* ---------------------------------------------------------------------
   run

   The audit is deterministic: every fight is seeded from
   (fighterA, fighterB, rep), so the same page and the same rep count
   always print the same stdout. That makes the output cacheable against
   a hash of the built page, which is what lets `npm run ci` pay for one
   ~25s audit instead of one per consumer. Any rebuild changes the hash
   and the cache misses. Set AZHA_AUDIT_NOCACHE=1 to force a fresh run.
   --------------------------------------------------------------------- */

/* The cache answers "what did the audit print for this build?", so the key has
   to cover everything that decides that answer - not just the page. The audit
   script chooses the seeds, the matchups and the output format, and it boots
   the page through the test harness, so a change to either produces different
   numbers from an unchanged page. Keying on the page alone meant editing the
   audit and re-running returned the PREVIOUS run's stdout with no miss and no
   warning: the gate and ARCHITECTURE.md would certify numbers produced by code
   that no longer existed. A cache that silently answers for an input it does
   not hash is worse than the duplicated parsers this module replaced - those
   gave two visible answers, this gives one confident wrong one. */
const FINGERPRINTED = [PAGE, AUDIT, path.join(ROOT, "tests", "harness.js")];

function pageFingerprint() {
  const h = crypto.createHash("sha1");
  for (const f of FINGERPRINTED) {
    try {
      h.update(fs.readFileSync(f));
    } catch (e) {
      h.update("missing:" + f);
    }
  }
  return h.digest("hex");
}

function readCache(key) {
  if (process.env.AZHA_AUDIT_NOCACHE) return null;
  try {
    const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    return c && c.key === key ? String(c.stdout) : null;
  } catch (e) {
    return null;
  }
}

function writeCache(key, stdout) {
  if (process.env.AZHA_AUDIT_NOCACHE) return;
  try {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    writeFileAtomic(CACHE, JSON.stringify({ key: key, stdout: stdout }));
  } catch (e) { /* a cache that cannot be written is not an error */ }
}

/* write-then-rename. A reader that opens the file between the two sees
   either the old bytes or the new ones, never half of either - which is
   what tests/docs.test.js hit when it read balance-report.json while a
   gen-docs run was rewriting it. */
function writeFileAtomic(file, data) {
  const tmp = file + ".tmp" + process.pid;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function runAudit(opts) {
  opts = opts || {};
  const reps = opts.reps || DEFAULT_REPS;
  const key = pageFingerprint() + ":" + reps;

  const cached = opts.cache === false ? null : readCache(key);
  if (cached !== null) return { ok: true, stdout: cached, cached: true };

  const r = spawnSync(process.execPath, [AUDIT, String(reps)], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: process.env,
  });
  const stdout = String(r.stdout || "");
  if (r.error) return { ok: false, stdout: stdout, err: "audit did not spawn: " + r.error.message, tail: "" };
  if (r.status !== 0) {
    return { ok: false, stdout: stdout, err: "audit exited " + r.status,
             tail: (stdout + String(r.stderr || "")).slice(-1500) };
  }
  if (opts.cache !== false) writeCache(key, stdout);
  return { ok: true, stdout: stdout, cached: false };
}

function rebuild() {
  const r = spawnSync(process.execPath, [BUILD], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: process.env,
  });
  return !r.error && r.status === 0;
}

/* ---------------------------------------------------------------------
   measure: run (or reuse) and parse, with one rebuild-and-retry

   Workers run in parallel and the audit loads the built page, so an
   audit launched mid-build reads a half-written
   aqua-zero-heavens-arena.html and dies on a syntax error. That is a
   race, not a result: rebuild once and try again.

   Pass `stdout` to parse output you already have and skip the run
   entirely - that is how one audit feeds both consumers in-process.
   --------------------------------------------------------------------- */

function measure(opts) {
  opts = opts || {};
  const reps = opts.reps || DEFAULT_REPS;
  const onRetry = opts.onRetry || function () {};

  if (typeof opts.stdout === "string") {
    const parsed = parseAudit(opts.stdout);
    return parsed.missing.length
      ? { ok: false, err: "audit output is missing: " + parsed.missing.join(", "),
          tail: opts.stdout.slice(-1500) }
      : { ok: true, report: parsed, stdout: opts.stdout, cached: true };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const run = runAudit({ reps: reps, cache: opts.cache });
    if (run.ok) {
      const parsed = parseAudit(run.stdout);
      if (!parsed.missing.length) {
        return { ok: true, report: parsed, stdout: run.stdout, cached: run.cached };
      }
      if (attempt) {
        return { ok: false, err: "audit output is missing: " + parsed.missing.join(", "),
                 tail: run.stdout.slice(-1500) };
      }
      onRetry("audit output did not parse: " + parsed.missing.join(", "));
    } else {
      if (attempt) return { ok: false, err: run.err, tail: run.tail };
      onRetry(run.err);
    }
    if (!rebuild()) {
      return { ok: false, rebuildFailed: true,
               err: "the audit failed and `node tools/build.js` could not rebuild the page" };
    }
  }
  return { ok: false, err: "unreachable" };
}

module.exports = {
  DEFAULT_REPS: DEFAULT_REPS,
  AUDIT_PATH: AUDIT,
  parseAudit: parseAudit,
  runAudit: runAudit,
  rebuild: rebuild,
  measure: measure,
  writeFileAtomic: writeFileAtomic,
};
