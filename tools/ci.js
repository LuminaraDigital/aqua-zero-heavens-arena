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
