#!/usr/bin/env node
/**
 * CI orchestrator for Windows and Unix: build, test, security, coverage gate.
 * Exits non-zero on the first failing step.
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const STEPS = [
  { label: "build", args: ["tools/build.js"] },
  { label: "test", args: ["tests/run-tests.js"] },
  /* the audit is deterministic, 4 reps is ~21s; see tools/check-balance-gate.js */
  { label: "check:balance", args: ["tools/check-balance-gate.js"] },
  /* after check:balance on purpose: both read the same audit, and a docs-drift
     message is noise while the gate is already red. gen-docs covers the numbers
     inside the generated block; the `docs` suite under `test` covers the prose
     around it. Removing either half reopens the hole - ARCHITECTURE.md claimed a
     19.1-point roster spread while the tool measured 58.3 and printed BROKEN. */
  { label: "check:docs", args: ["tools/gen-docs.js", "--check"] },
  { label: "check:security", args: ["tools/check-production-security.js"] },
  { label: "check:coverage", args: ["tools/check-coverage-gate.js"] },
  { label: "check:resilience", args: ["tools/check-resilience.js"] },
];

function runStep(step) {
  console.log("\n>>> ci: " + step.label);
  const result = spawnSync(process.execPath, step.args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("ci: failed to spawn " + step.label + ": " + result.error.message);
    process.exit(1);
  }
  const code = result.status == null ? 1 : result.status;
  if (code !== 0) {
    console.error("ci: step failed: " + step.label + " (exit " + code + ")");
    process.exit(code);
  }
}

STEPS.forEach(runStep);
console.log("\n>>> ci: all steps passed");
process.exit(0);
