/* =====================================================================
   Aqua Zero Heavens Arena - Custom Deck Builder Test Suite
   Luminara Digital
   ===================================================================== */

module.exports = function (h) {
  const { api, ok, section } = h;

  section("Custom Deck Builder & Discipline Budget");

  const db = (api && api.DeckBuilder) || (typeof global !== "undefined" && global.DeckBuilder) || require("../src/progress/deck-builder");
  ok(db !== null && typeof db === "object", "DeckBuilder object should be defined");

  // Valid 12-card deck built from cheap legal techniques (TECH costs drift)
  const sampleDeck = [
    "kuzushi", "guard_pull", "basic_close", "head_control", "basic_tieup", "switch_step",
    "apkubi", "juchum_seogi", "kkoa_seogi", "high_guard", "plum_clinch", "lw_shell"
  ];

  const cost = db.calculateDeckCost(sampleDeck);
  ok(typeof cost === "number" && cost > 0, "calculated deck cost is positive number");
  ok(cost <= db.MAX_BUDGET, "sample deck is within 100-pt budget (" + cost + " pts)");

  const validation = db.validateDeck(sampleDeck);
  ok(validation.ok === true, "sample deck validation passed");
  ok(validation.count === 12, "deck contains 12 cards");
  ok(validation.ranges.length >= 2, "deck covers multiple ranges");

  // Test Too Small Deck (<12 cards)
  const smallDeck = ["jab", "cross", "lead_hook"];
  const smallVal = db.validateDeck(smallDeck);
  ok(smallVal.ok === false, "deck with <12 cards is rejected");

  // Test Duplicate Cards
  const dupDeck = [
    "jab", "jab", "lead_hook", "rear_hook", "lead_upper", "rear_upper",
    "overhand", "liver_shot", "check_hook", "shoulder_roll", "switch_kick", "low_kick"
  ];
  const dupVal = db.validateDeck(dupDeck);
  ok(dupVal.ok === false, "deck with duplicate cards is rejected");

  // Test Save and Retrieve Custom Deck
  const saveRes = db.saveCustomDeck(0, "Iron Fist Loadout", sampleDeck);
  ok(saveRes.ok === true, "custom deck saved successfully");

  const loaded = db.getCustomDeck(0);
  ok(loaded !== null && loaded.name === "Iron Fist Loadout", "loaded deck matches saved name");
  ok(loaded.techniques.length === 12, "loaded deck has 12 techniques");

  // Test Export and Import Deck Codes
  const expRes = db.exportDeckCode(0, "Iron Fist Loadout", sampleDeck);
  ok(expRes.ok === true, "deck exported to code");
  ok(typeof expRes.code === "string" && expRes.code.startsWith("AZD1-"), "export code has AZD1 prefix");

  const impRes = db.importDeckCode(expRes.code);
  ok(impRes.ok === true, "deck imported from code successfully");
  ok(impRes.deckName === "Iron Fist Loadout", "imported deck name matches original");
  ok(impRes.techniques.length === 12, "imported deck has all 12 cards");

  // Test Analytics & Stats helper
  const stats = db.getDeckStats(sampleDeck);
  ok(stats !== null && typeof stats === "object", "deck stats returned valid object");
  ok(stats.count === 12, "deck stats count is 12");
  ok(stats.cost === cost, "deck stats cost matches calculated cost");
  ok(stats.remainingBudget === db.MAX_BUDGET - cost, "remaining budget is accurate");
  ok(stats.ranges.MID > 0, "deck stats tracks MID range count");
  ok(stats.staminaCurve.low >= 0, "deck stats tracks stamina curve");
  ok(stats.isLegal === true, "deck stats marks legal deck");

  // Test Vault Card Retrieval
  const vaultAll = db.getVaultCards({ discipline: "all" });
  ok(Array.isArray(vaultAll) && vaultAll.length > 0, "getVaultCards retrieves card list");
  const vaultBoxing = db.getVaultCards({ discipline: "boxing" });
  ok(Array.isArray(vaultBoxing) && vaultBoxing.every(function(t) { return t.disc === "boxing"; }), "getVaultCards filters by discipline");

  // Test Default Deck
  const defaultDeck = db.getDefaultDeck(0);
  ok(Array.isArray(defaultDeck) && defaultDeck.length >= 12, "getDefaultDeck returns valid deck for fighter");
};

