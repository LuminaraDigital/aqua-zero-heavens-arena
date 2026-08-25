"use strict";

module.exports = function (h) {
  const { api, ok } = h;

  // =========================================================================
  // 1. Adaptive AI & Habit Tracking
  // =========================================================================
  h.section("Adaptive AI & Habit Tracking");

  ok(typeof api.AdaptiveAI !== "undefined", "AdaptiveAI object should be defined");
  const tracker = api.AdaptiveAI.createTracker();
  ok(tracker.turns === 0, "Tracker initialized with 0 turns");
  ok(tracker.movesByClass.STRIKE === 0, "Initial strike count is 0");

  const mockDuel = {
    range: "LONG",
    turn: 1,
    p: { fid: 0, stam: 10, maxStam: 60, hp: 50, maxhp: 100 },
    e: { fid: 1, stam: 50, maxStam: 60, hp: 80, maxhp: 100 },
  };

  const strikeTech = api.TECH.jab || { id: "jab", cls: "STRIKE", range: "MID" };
  const guardTech = api.TECH.basic_guard || { id: "basic_guard", cls: "GUARD", range: "ANY" };
  const takedownTell = { id: "double_leg", cls: "THROW", flags: ["takedown"] };

  // Record 3 strike commits
  api.AdaptiveAI.recordPlayerCommit(tracker, strikeTech, mockDuel, takedownTell);
  api.AdaptiveAI.recordPlayerCommit(tracker, strikeTech, mockDuel, takedownTell);
  api.AdaptiveAI.recordPlayerCommit(tracker, strikeTech, mockDuel, takedownTell);

  ok(tracker.turns === 3, "Tracker recorded 3 turns");
  ok(tracker.movesByClass.STRIKE === 3, "Strike count incremented to 3");
  ok(tracker.lowStamAttacks === 3, "Low stamina attacks recorded accurately");

  // Combo recording
  api.AdaptiveAI.recordPlayerCombo(tracker, 3);
  ok(tracker.combos.chain3 === 1, "3-chain combo recorded");

  // Adapt weights against strike spam
  const baseWeights = { aggression: 1.0, guard: 1.0, closeIn: 0, noise: 1.0 };
  const adapted = api.AdaptiveAI.adaptWeights(baseWeights, tracker, { intensity: 1.0 });
  ok(adapted.guard > baseWeights.guard, "Adapted CPU guard weight increased against strike spam");
  ok(adapted.counterBonus > 0, "Counter bonus awarded against predictable strikes");

  // Feint evaluation
  const feintHighDiff = api.AdaptiveAI.shouldFeint({ fid: 1 }, tracker, 2, () => 0.05);
  ok(typeof feintHighDiff === "boolean", "Feint check returns boolean");

  // =========================================================================
  // 2. AI Post-Fight Corner Coach
  // =========================================================================
  h.section("AI Post-Fight Corner Coach");

  ok(typeof api.AICoach !== "undefined", "AICoach object should be defined");

  const completedDuel = {
    turn: 8,
    range: "MID",
    p: { fid: 0, hp: 60, maxhp: 100, stam: 40, maxStam: 60, discs: ["muay_thai"] },
    e: { fid: 1, hp: 0, maxhp: 100, stam: 20, maxStam: 60, discs: ["taekwondo"] },
    stats: {
      turns: 8,
      dmgDealt: 105,
      dmgTaken: 40,
      perfectGuards: 2,
      bestCombo: 3,
      cornerDamageDealt: 25,
      cornerDamageTaken: 0,
      escapes: 1,
      strikes: 6,
      throws: 1,
      subs: 0,
    },
    adaptiveTracker: tracker,
  };

  const analysis = api.AICoach.analyzeBout(completedDuel, completedDuel.p, completedDuel.e);
  ok(analysis !== null, "Analysis result generated successfully");
  ok(analysis.won === true, "Analysis correctly identified player victory");
  ok(["S", "A", "B", "C", "D", "F"].indexOf(analysis.grades.tactics) >= 0, "Tactics grade is valid letter");
  ok(["S", "A", "B", "C", "D", "F"].indexOf(analysis.grades.stamina) >= 0, "Stamina grade is valid letter");
  ok(["S", "A", "B", "C", "D", "F"].indexOf(analysis.grades.ringcraft) >= 0, "Ringcraft grade is valid letter");
  ok(["S", "A", "B", "C", "D", "F"].indexOf(analysis.grades.execution) >= 0, "Execution grade is valid letter");
  ok(Array.isArray(analysis.bullets) && analysis.bullets.length >= 3, "Analysis provides at least 3 actionable bullets");
  ok(typeof analysis.summary === "string" && analysis.summary.length > 10, "Analysis summary generated");

  const prompt = api.AICoach.formatLLMPrompt(analysis, "Akin", "Won-Ri");
  ok(prompt.indexOf("Akin") >= 0 && prompt.indexOf("Won-Ri") >= 0, "LLM prompt formats fighter names");

  // =========================================================================
  // 3. Ringside Commentary & Event Bus
  // =========================================================================
  h.section("Ringside Commentary & Event Bus");

  ok(typeof api.CombatEvents !== "undefined", "CombatEvents bus should be defined");
  ok(typeof api.AICommentary !== "undefined", "AICommentary engine should be defined");

  let eventCaught = false;
  api.CombatEvents.on("TEST_EVENT", (ctx) => {
    eventCaught = ctx && ctx.ok;
  });
  api.CombatEvents.emit("TEST_EVENT", { ok: true });
  ok(eventCaught === true, "CombatEvents correctly dispatches custom events");

  api.AICommentary.clearHistory();
  const commLine = api.AICommentary.generateLine("COUNTER_HIT", { turn: 1, fighterName: "Akin" }, () => 0.1);
  ok(commLine !== null, "Commentary generated line for COUNTER_HIT");
  ok(commLine.text.indexOf("AKIN:") >= 0, "Commentary line formatted with fighter context");

  const koLine = api.AICommentary.generateLine("KNOCKOUT", { turn: 2, fighterName: "Akin" }, () => 0.1);
  ok(koLine !== null, "Priority event (KNOCKOUT) generates commentary immediately");

  const history = api.AICommentary.getHistory();
  ok(history.length === 2, "Commentary history stores generated lines");

  // =========================================================================
  // 4. Behavioral Ghost AI Serialization (AZG2)
  // =========================================================================
  h.section("Behavioral Ghost AI (AZG2)");

  ok(typeof api.GhostBattles !== "undefined", "GhostBattles should be defined");
  ok(api.GhostBattles.GHOST_MAGIC_V2 === "AZG2", "GHOST_MAGIC_V2 is AZG2");

  const styleVector = api.GhostBattles.extractStyleVector(tracker);
  ok(Array.isArray(styleVector) && styleVector.length === 8, "Style vector extracted as 8-axis array");

  const ghostBuild = {
    hero: 0,
    name: "Akin Clone",
    techs: ["jab", "cross", "plum_knee"],
    seals: { jab: "SEAL_LIGHTNING" },
    drilled: { jab: 2 },
    benefits: ["iron_chin"],
    styleVector: styleVector,
  };

  const azg2Code = api.GhostBattles.encodeGhostBuild(ghostBuild);
  ok(typeof azg2Code === "string" && azg2Code.length > 10, "AZG2 Ghost build encoded to passcode");

  const decoded = api.GhostBattles.decodeGhostBuild(azg2Code);
  ok(decoded !== null, "Passcode decoded successfully");
  ok(decoded.name === "Akin Clone", "Decoded name matches");
  ok(Array.isArray(decoded.styleVector) && decoded.styleVector.length === 8, "Decoded style vector preserved");

  const ghostBot = api.GhostBattles.createGhostCombatant(decoded);
  ok(ghostBot.isGhost === true, "Ghost bot flagged as AI combatant");
  ok(ghostBot.ai !== null && typeof ghostBot.ai.aggression === "number", "Ghost bot instantiated with style vector AI weights");

  // Legacy AZG1 decoding test
  const legacyPayload = {
    m: "AZG1",
    f: 1,
    t: ["roundhouse", "spinning_back_kick"],
    s: {},
    d: {},
    b: [],
    n: "Legacy Won-Ri",
  };
  const legacyCode = Buffer.from(JSON.stringify(legacyPayload)).toString("base64").replace(/=/g, "");
  const legacyDecoded = api.GhostBattles.decodeGhostBuild(legacyCode);
  ok(legacyDecoded !== null, "Legacy AZG1 passcode decoded successfully");
  ok(legacyDecoded.name === "Legacy Won-Ri", "Legacy AZG1 name parsed accurately");

  // =========================================================================
  // 5. Settings GUI AI Configuration
  // =========================================================================
  h.section("Settings GUI AI Controls");

  ok(typeof api.SettingsGUI !== "undefined", "SettingsGUI should be defined");
  const aiCfg = api.SettingsGUI.getAISettings();
  ok(typeof aiCfg.adaptiveCPU === "boolean", "adaptiveCPU setting exists");
  ok(typeof aiCfg.coachMode === "string", "coachMode setting exists");
  ok(typeof aiCfg.commentary === "string", "commentary setting exists");

  const initialAdaptive = aiCfg.adaptiveCPU;
  const toggledAdaptive = api.SettingsGUI.toggleAISetting("adaptiveCPU");
  ok(toggledAdaptive === !initialAdaptive, "adaptiveCPU toggled successfully");
  api.SettingsGUI.toggleAISetting("adaptiveCPU"); // revert back

  const toggledCoach = api.SettingsGUI.toggleAISetting("coachMode");
  ok(toggledCoach === "compact", "coachMode cycled to compact");
  api.SettingsGUI.toggleAISetting("coachMode");
  api.SettingsGUI.toggleAISetting("coachMode"); // back to full
};
