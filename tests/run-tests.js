#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - test runner
   Luminara Digital

     node tests/run-tests.js            # everything
     node tests/run-tests.js ranking    # one suite
     node tests/run-tests.js --quiet    # failures only
   ===================================================================== */
"use strict";
const boot = require("./harness");

const SUITES = {
  ranking: "./ranking.test",
  battle: "./battle.test",
  combat: "./combat.test",
  game: "./game.test",
  backup: "./backup.test",
  security: "./security.test",
  library: "./library.test",
  navigation: "./navigation.test",
  progression: "./progression.test",
  systems: "./systems.test",
  tell: "./tell.test",
  music: "./music.test",
  matchup: "./matchup.test",
  entrance: "./entrance.test",
  results: "./results.test",
  attract: "./attract.test",
  cloud: "./cloud.test",
  ton: "./ton.test",
  meta: "./meta.test",
  discmastery: "./discipline-mastery.test",
  leaderboard: "./leaderboard.test",
  wiring: "./wiring.test",
  expansion: "./expansion.test",
  ui_enhancements: "./ui-enhancements.test",
  gared: "./gared-features.test",
  ai_systems: "./ai-systems.test",
  credit_ledger: "./credit-ledger.test",
  deck_builder: "./deck-builder.test",
  boss_phases: "./boss-phases.test",
  narrative_events: "./narrative-events.test",
  interactive_3d_bg: "./interactive-3d-bg.test",
};

const args = process.argv.slice(2);
const quiet = args.indexOf("--quiet") >= 0;
const wanted = args.filter((a) => !a.startsWith("--"));
const names = wanted.length ? wanted : Object.keys(SUITES);

(async () => {
  let totalFails = 0,
    totalChecks = 0;
  for (const name of names) {
    const mod = SUITES[name];
    if (!mod) {
      console.error("unknown suite: " + name + " (have: " + Object.keys(SUITES).join(", ") + ")");
      process.exitCode = 1;
      continue;
    }
    console.log("\n############ " + name.toUpperCase() + " ############");
    const h = boot({ quiet });
    try {
      const maybe = require(mod)(h);
      if (maybe && typeof maybe.then === "function") await maybe;
    } catch (e) {
      console.log("  FAIL  suite threw: " + e.message);
      console.log(e.stack.split("\n").slice(1, 4).join("\n"));
      totalFails++;
    }
    const r = h.report();
    totalFails += r.fails;
    totalChecks += r.checks;
    console.log("\n" + name + ": " + (r.fails ? r.fails + " FAILED of " + r.checks : "all " + r.checks + " passed"));
  }

  console.log("\n=========================================");
  console.log(totalFails ? totalFails + " FAILED of " + totalChecks : "all " + totalChecks + " checks passed");
  process.exitCode = totalFails ? 1 : 0;
})();
