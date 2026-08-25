/* =====================================================================
   Aqua Zero Heavens Arena - Narrative Events & Banter Test Suite
   Luminara Digital
   ===================================================================== */

module.exports = function (h) {
  const { api, ok, section } = h;

  section("Narrative Roguelike Events & Dynamic Banter");

  const ne = (api && api.NarrativeEvents) || (typeof global !== "undefined" && global.NarrativeEvents) || require("../src/data/narrative-events");
  ok(ne !== null && typeof ne === "object", "NarrativeEvents object should be defined");

  // Check event definitions
  const events = ne.NARRATIVE_EVENTS;
  ok(events.EVENT_CUTMAN !== undefined, "Cutman event defined");
  ok(events.EVENT_BOOKIE !== undefined, "Bookie event defined");
  ok(events.EVENT_SENSEI !== undefined, "Sensei event defined");

  // Test Random Event Retrieval
  const ev = ne.getRandomNarrativeEvent(0);
  ok(ev && typeof ev.title === "string", "event retrieved with valid title");
  ok(Array.isArray(ev.choices) && ev.choices.length === 3, "event contains 3 distinct choices");

  // Test Cutman Option Effect
  const mockRun = { maxhp: 120, hp: 50, purse: 60 };
  const cutmanChoice = events.EVENT_CUTMAN.choices[0];
  const choiceRes = cutmanChoice.effect(mockRun);
  ok(choiceRes.ok === true, "cutman stitches choice executed");
  ok(mockRun.hp === 80, "health restored by 25% of maxhp (30 HP healed to 80)");
  ok(mockRun.purse === 30, "30 purse deducted (30 remaining)");

  // Test Bookie Blitz Wager Choice
  const bookieChoice = events.EVENT_BOOKIE.choices[0];
  const wagerRes = bookieChoice.effect({ purse: 70 });
  ok(wagerRes.ok === true, "syndicate wager booked successfully");

  // Test Dynamic Banter Generator
  const introBanter = ne.generateDynamicBanter("Striker", "INTRO", false);
  ok(typeof introBanter === "string" && introBanter.length > 5, "generated valid intro banter");

  const grudgeBanter = ne.generateDynamicBanter("Striker", "INTRO", true);
  ok(typeof grudgeBanter === "string" && grudgeBanter.length > 5, "generated valid grudge rematch banter");

  const counterBanter = ne.generateDynamicBanter("Striker", "COUNTER", false);
  ok(typeof counterBanter === "string" && counterBanter.length > 5, "generated valid counter-hit callout");

  const koBanter = ne.generateDynamicBanter("Striker", "KNOCKOUT", false);
  ok(typeof koBanter === "string" && koBanter.length > 5, "generated valid knockout victory line");
};
