#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - generated balance docs
   Luminara Digital

   ARCHITECTURE.md used to carry hand-written balance numbers. They were
   wrong: the document claimed a 19.1-point roster spread while the audit
   printed 58.3 and the word BROKEN. A number a human types once is a
   number that stops being true the next time someone touches combat, and
   nobody notices because prose does not fail CI.

   So the numbers are generated. This tool runs the audit, writes
   docs/balance-report.json, and splices a markdown block into
   ARCHITECTURE.md between two marker comments. `--check` regenerates in
   memory and fails if the committed docs disagree - that is the CI step,
   and it is the thing that makes the claim rot-proof.

   WHAT --check DOES NOT COVER, on purpose: it only reads between the
   markers. Prose outside them is not its business, so a hand-typed
   sentence like "the roster now sits inside a 3.2-point spread" three
   lines above the block passes --check cleanly. Catching that is
   tests/docs.test.js's job - it scans the prose for percentages and
   point-spreads that no longer have a generator behind them. Acceptance
   criterion 2 therefore needs BOTH steps in CI: `check:docs` for the
   numbers inside the block and `npm test` for the prose around it.
   Removing either half reopens exactly the hole this tool was built to
   close. Do not trim one and assume the other covers it.

   Usage:
     node tools/gen-docs.js                # write the report + the block
     node tools/gen-docs.js --check        # fail on drift, write nothing
     node tools/gen-docs.js --reps=6       # more fights, slower, tighter
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const audit = require("./lib/parse-audit");

const ROOT = path.resolve(__dirname, "..");
const ARCH = path.join(ROOT, "ARCHITECTURE.md");
const REPORT = path.join(ROOT, "docs", "balance-report.json");
const BEGIN = "<!-- BEGIN GENERATED BALANCE -->";
const END = "<!-- END GENERATED BALANCE -->";

/* the rep count lives in the shared module - the plan's baseline table,
   the gate and this document all have to quote the same sweep */
const DEFAULT_REPS = audit.DEFAULT_REPS;

const args = process.argv.slice(2);
const CHECK = args.indexOf("--check") >= 0;
const REPS = (function () {
  const flag = args.find((a) => a.startsWith("--reps="));
  const n = parseInt(flag ? flag.slice(7) : String(DEFAULT_REPS), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REPS;
})();

/* the parser lives in tools/lib/parse-audit.js, shared with
   tools/check-balance-gate.js - see that file's header for why the two
   copies had to become one */

/* thousands separator without toLocaleString - the docs must read the
   same on a machine with a French locale as on CI */
function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

/* the shared module runs the audit, retries once through a rebuild when
   a parallel worker was mid-build, and parses. Anything it cannot get a
   clean parse out of stops us here: a garbage report committed as
   "generated" is worse than no report. */
function measure() {
  const m = audit.measure({
    reps: REPS,
    onRetry: (why) => console.error("gen-docs: first audit failed (" + why +
      "); rebuilding and retrying once"),
  });
  if (m.ok) return m.report;
  if (m.rebuildFailed) fail(m.err + ".", m.tail);
  fail("the audit still fails after a rebuild: " + m.err + "\n" +
    "  run `node tools/audit-balance.js " + REPS + "` by hand. Nothing was written.", m.tail);
}

function fail(msg, tail) {
  console.error("\ngen-docs FAILED: " + msg);
  if (tail) console.error("\n--- last of the audit output ---\n" + tail);
  process.exit(2);
}

/* ---------------------------------------------------------------------
   the report and the block
   --------------------------------------------------------------------- */

/* no shell:true - it is a deprecation warning on modern node and this
   never needs shell resolution; a tarball with no .git just says unknown */
function gitShortSha() {
  const r = spawnSync(process.platform === "win32" ? "git.exe" : "git",
    ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  if (r.error || r.status !== 0) return "unknown";
  return String(r.stdout || "").trim() || "unknown";
}

function buildReport(parsed) {
  return Object.assign({
    /* generatedAt and git move on every run and every commit, so
       --check deliberately ignores them; see sameMetrics(). */
    generatedAt: new Date().toISOString(),
    generator: "tools/gen-docs.js",
    git: { shortSha: gitShortSha() },
    audit: {
      command: "node tools/audit-balance.js " + REPS,
      repsPerMatchup: REPS,
      fights: parsed.fights,
    },
  }, {
    roster: parsed.roster,
    discipline: parsed.discipline,
    rangeSharePct: parsed.rangeSharePct,
    finishSharePct: parsed.finishSharePct,
    fightLength: parsed.fightLength,
    techniques: parsed.techniques,
  });
}

/* every key --check compares. generatedAt and git are provenance, not
   measurement: a new commit must not fail the docs gate. */
function metricsOnly(r) {
  return JSON.stringify({
    audit: r.audit, roster: r.roster, discipline: r.discipline,
    rangeSharePct: r.rangeSharePct, finishSharePct: r.finishSharePct,
    fightLength: r.fightLength, techniques: r.techniques,
  }, null, 2);
}
function sameMetrics(a, b) { return metricsOnly(a) === metricsOnly(b); }

function renderBlock(r) {
  const pct = (n) => n.toFixed(1) + "%";
  const ro = r.roster, di = r.discipline, ra = r.rangeSharePct;
  const lines = [
    BEGIN,
    "<!-- Written by `node tools/gen-docs.js`. Do not edit between the markers:",
    "     the next run overwrites it and `node tools/gen-docs.js --check` fails CI. -->",
    "",
    "Measured by `" + r.audit.command + "` - " + commas(r.audit.fights) +
      " fights, whole roster against itself, AI on both sides at level 9 with no benefits.",
    "The timestamp and the commit these numbers came from are in `docs/balance-report.json`.",
    "",
    "| Metric | Measured |",
    "|---|---|",
    "| Roster win rate | " + pct(ro.best.ratePct) + " (" + ro.best.name + ") down to " +
      pct(ro.worst.ratePct) + " (" + ro.worst.name + "), a " + ro.gapPts.toFixed(1) +
      "-point gap across " + ro.fighters + " fighters |",
    "| Audit's own verdict | " + ro.verdict + " |",
    "| Fighters sharing a printed extreme | " + ro.identicalAtExtreme +
      " (" + ro.atBestRate + " at the top rate, " + ro.atWorstRate + " at the bottom) |",
    "| Discipline win rate | " + pct(di.best.ratePct) + " (" + di.best.name + ") down to " +
      pct(di.worst.ratePct) + " (" + di.worst.name + "), a " + di.gapPts.toFixed(1) +
      "-point gap across " + di.count + " disciplines |",
    "| Share of turns by range | LONG " + pct(ra.LONG) + " / MID " + pct(ra.MID) +
      " / CLINCH " + pct(ra.CLINCH) + " / GROUND " + pct(ra.GROUND) + " |",
    "| How fights end | submission " + pct(r.finishSharePct.submission) +
      " / strike " + pct(r.finishSharePct.strike) + " |",
    "| Fight length | " + r.fightLength.avgTurns.toFixed(1) + " turns on average, " +
      pct(r.fightLength.hitCapPct) + " hit the " + r.fightLength.turnCap + "-turn cap |",
    "| Techniques the AI ever throws | " + r.techniques.thrown + " of " + r.techniques.total +
      " (" + pct(r.techniques.coveragePct) + " of the dex) |",
    END,
  ];
  return lines.join("\n");
}

function splice(md, block) {
  const i = md.indexOf(BEGIN);
  const j = md.indexOf(END);
  if (i < 0 || j < 0 || j < i) {
    fail("ARCHITECTURE.md has no `" + BEGIN + "` / `" + END + "` pair.\n" +
      "  Put both markers in the \"Balance is measured\" section and re-run.");
  }
  return md.slice(0, i) + block + md.slice(j + END.length);
}

function currentBlock(md) {
  const i = md.indexOf(BEGIN);
  const j = md.indexOf(END);
  if (i < 0 || j < 0 || j < i) return null;
  return md.slice(i, j + END.length);
}

/* a plain line diff - enough to see which row moved, without a dep */
function diffLines(want, got) {
  const a = want.split("\n"), b = got.split("\n");
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (b[i] !== undefined) out.push("  on disk  | " + b[i]);
    if (a[i] !== undefined) out.push("  fresh    | " + a[i]);
  }
  return out.join("\n");
}

/* ---------------------------------------------------------------------
   main
   --------------------------------------------------------------------- */

const report = buildReport(measure());
const block = renderBlock(report);

if (CHECK) {
  const problems = [];

  let onDiskReport = null;
  if (!fs.existsSync(REPORT)) {
    problems.push("docs/balance-report.json is missing");
  } else {
    try {
      onDiskReport = JSON.parse(fs.readFileSync(REPORT, "utf8"));
    } catch (e) {
      problems.push("docs/balance-report.json does not parse: " + e.message);
    }
  }
  if (onDiskReport && !sameMetrics(onDiskReport, report)) {
    problems.push("docs/balance-report.json is stale - the audit now measures something else:\n" +
      diffLines(metricsOnly(report), metricsOnly(onDiskReport)));
  }

  const md = fs.readFileSync(ARCH, "utf8");
  const onDiskBlock = currentBlock(md);
  if (onDiskBlock === null) {
    problems.push("ARCHITECTURE.md has no " + BEGIN + " / " + END + " pair");
  } else if (onDiskBlock !== block) {
    problems.push("the generated block in ARCHITECTURE.md is stale:\n" + diffLines(block, onDiskBlock));
  }

  if (problems.length) {
    console.error("gen-docs --check FAILED: the docs no longer match the audit.\n");
    problems.forEach((p) => console.error("  - " + p + "\n"));
    console.error("run `node tools/gen-docs.js` and commit the result.");
    process.exit(1);
  }
  console.log("OK  gen-docs: ARCHITECTURE.md and docs/balance-report.json match the audit " +
    "(" + report.audit.command + ")");
  process.exit(0);
}

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
const beforeMd = fs.readFileSync(ARCH, "utf8");
const afterMd = splice(beforeMd, block);

let previous = null;
if (fs.existsSync(REPORT)) {
  try { previous = JSON.parse(fs.readFileSync(REPORT, "utf8")); } catch (e) { previous = null; }
}
/* running twice must leave no diff, so when nothing measured has moved we
   keep the old stamp. It then reads as "when these numbers were taken",
   which is the more useful meaning anyway. */
const unchanged = previous && sameMetrics(previous, report);
if (unchanged) {
  report.generatedAt = previous.generatedAt;
  report.git = previous.git;
}
const out = JSON.stringify(report, null, 2) + "\n";

/* write-then-rename, both files. tests/docs.test.js reads this report off
   disk and once failed on its own input - "the roster gap is best minus
   worst [12]" - because a gen-docs run was halfway through rewriting the
   file it was reading. A rename is atomic on NTFS and on POSIX, so a
   concurrent reader gets the old bytes or the new ones and never half a
   JSON document. */
if (!previous || out !== JSON.stringify(previous, null, 2) + "\n") audit.writeFileAtomic(REPORT, out);
if (afterMd !== beforeMd) audit.writeFileAtomic(ARCH, afterMd);

console.log("gen-docs: " + report.audit.command + " -> " + commas(report.audit.fights) + " fights");
console.log("  docs/balance-report.json  " + (!previous ? "created" : unchanged ? "unchanged" : "updated"));
console.log("  ARCHITECTURE.md           " + (afterMd === beforeMd ? "unchanged" : "block updated"));
