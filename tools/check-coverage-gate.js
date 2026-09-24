#!/usr/bin/env node
/**
 * Production coverage / check-count gate (no Istanbul required).
 *
 * This repo is a static HTML game with a custom Node harness. Instead of
 * instrumented line coverage, CI enforces that the full suite runs and reports
 * at least MIN_CHECKS passed checks (see constant below).
 *
 * Also asserts that every suite file listed in tests/run-tests.js exists.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

/** Minimum total checks required from `node tests/run-tests.js` summary line. */
const MIN_CHECKS = 500;

const RUNNER = path.join(ROOT, "tests", "run-tests.js");
const KEY_TEST_FILES = [
  "tests/run-tests.js",
  "tests/harness.js",
  "tests/ranking.test.js",
  "tests/belt-career.test.js",
  "tests/battle.test.js",
  "tests/combat.test.js",
  "tests/game.test.js",
  "tests/backup.test.js",
  "tests/security.test.js",
  "tests/library.test.js",
  "tests/navigation.test.js",
  "tests/progression.test.js",
  "tests/systems.test.js",
  "tests/tell.test.js",
  /* the three permanent-progression modules and the wiring that joins them to
     the game: each one owns a save block, so a missing suite here is a save
     migration nobody is asserting */
  "tests/meta.test.js",
  "tests/discipline-mastery.test.js",
  "tests/leaderboard.test.js",
  "tests/wiring.test.js",
];

const failures = [];

function fail(msg) {
  failures.push(msg);
}

KEY_TEST_FILES.forEach((rel) => {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    fail("missing required test file: " + rel);
  }
});

if (!fs.existsSync(RUNNER)) {
  fail("missing test runner: tests/run-tests.js");
} else {
  const runnerSrc = fs.readFileSync(RUNNER, "utf8");
  const suiteRe = /^\s*([a-z]+):\s*"\.\/([^"]+)"/gm;
  let m;
  while ((m = suiteRe.exec(runnerSrc)) !== null) {
    const suiteFile = path.join(ROOT, "tests", m[2] + ".js");
    if (!fs.existsSync(suiteFile)) {
      fail("suite listed in run-tests.js missing on disk: tests/" + m[2] + ".js");
    }
  }
}

const result = spawnSync(process.execPath, [RUNNER, "--quiet"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  env: process.env,
});

const combined = String(result.stdout || "") + String(result.stderr || "");
if (result.error) {
  fail("failed to spawn tests/run-tests.js: " + result.error.message);
} else if (result.status !== 0) {
  fail("tests/run-tests.js exited " + result.status + " (coverage gate requires a green suite)");
}

const summaryRe = /all\s+(\d+)\s+checks\s+passed/i;
const match = combined.match(summaryRe);
if (!match) {
  fail('could not find summary line matching /all N checks passed/ in test output');
} else {
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < MIN_CHECKS) {
    fail(
      "check count gate failed: got " +
        count +
        ", need >= " +
        MIN_CHECKS +
        " (MIN_CHECKS in tools/check-coverage-gate.js)"
    );
  } else {
    console.log(
      "OK  coverage gate: all " +
        count +
        " checks passed (threshold MIN_CHECKS=" +
        MIN_CHECKS +
        ")"
    );
  }
}

if (failures.length) {
  console.error("coverage gate FAILED:");
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}

console.log("OK  required test files present");
process.exit(0);
