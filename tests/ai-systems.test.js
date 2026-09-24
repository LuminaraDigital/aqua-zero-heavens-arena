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

  // =========================================================================
  // 6. Near-tie technique rotation (dex coverage layer)
  //    aiChooseTechnique rotates only among candidates within AI_TIE_EPS of
  //    the winning score, same class only, preferring fewest uses this duel.
  //    Pinned here: determinism, the diversity delta, and the bounded
  //    property - a clearly better technique always keeps the turn.
  // =========================================================================
  h.section("Near-tie rotation");

  ok(typeof api.aiChooseTechnique === "function", "aiChooseTechnique exported");
  // the window is a page-level const; read it from the live page the harness runs
  const eps = api.exec("AI_TIE_EPS");
  ok(typeof eps === "number" && eps >= 0 && eps <= 4,
    "AI_TIE_EPS is a small bounded window (got " + eps + ")");

  // A duel stub with a rich learnset so more than one candidate can score.
  const mkDuel = () => ({ range: "MID", turn: 5,
    p: { fid: 0, stam: 50, maxStam: 60, hp: 60, maxhp: 100, techs: Object.keys(api.TECH).slice(0, 40), sup: 0 },
    e: { fid: 1, stam: 50, maxStam: 60, hp: 60, maxhp: 100, techs: Object.keys(api.TECH).slice(0, 40), sup: 0 } });

  // (a) Determinism: a pinned rnd sequence yields an identical pick sequence.
  let seq1 = "", seq2 = "";
  for (let run = 0; run < 2; run++) {
    const d = mkDuel(), side = d.p, foe = d.e;
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    let picks = "";
    for (let i = 0; i < 24; i++) {
      const pick = api.aiChooseTechnique(d, side, foe, { rnd, noise: 0 }).tech;
      picks += pick.id + ",";
      side.stam = Math.max(8, side.stam - 2);   // vary state so scores move
    }
    if (run === 0) seq1 = picks; else seq2 = picks;
  }
  ok(seq1 === seq2, "pinned rnd + same duel state -> identical 24-pick sequence");

  // (b) Diversity: a long stretch rotates through several techniques and no
  //     single one monopolizes it - the repetition engine the rotation
  //     replaced threw the same handful every turn.
  const d = mkDuel(), side = d.p, foe = d.e;
  let seedD = 777;
  const rndD = () => { seedD = (seedD * 1103515245 + 12345) % 2147483648; return seedD / 2147483648; };
  const thrown = {};
  for (let i = 0; i < 120; i++) {
    const pick = api.aiChooseTechnique(d, side, foe, { rnd: rndD, noise: 0 }).tech;
    thrown[pick.id] = (thrown[pick.id] || 0) + 1;
    side.stam = 10 + (i % 41);   // sweep stamina so the scoring landscape moves
  }
  const distinct = Object.keys(thrown).length;
  ok(distinct >= 5,
    "a 120-pick stretch rotates through at least 5 distinct techniques (got " + distinct + ")");
  const maxShare = Math.max.apply(null, Object.keys(thrown).map(k => thrown[k])) / 120;
  ok(maxShare <= 0.9,
    "no technique takes more than 90% of a 120-pick stretch (max share " +
    (maxShare * 100).toFixed(1) + "%)");

  // (c) Bounded: the rotation only ever trades within the argmax winner's own
  //     class. With noise 0 the scoring is rnd-independent, so the winner can
  //     be recomputed independently each pick: the chosen technique's class
  //     must equal that winner's class, whatever the stamina landscape does
  //     to WHICH class wins. (Class constancy across picks was the first
  //     draft of this check and was wrong: the winner's class legitimately
  //     changes with stamina; the invariant is per-pick, not per-stretch.)
  const d2 = mkDuel(), side2 = d2.p, foe2 = d2.e;
  let seedB = 999;
  const rndB = () => { seedB = (seedB * 1103515245 + 12345) % 2147483648; return seedB / 2147483648; };
  let classMismatches = 0;
  for (let i = 0; i < 60; i++) {
    let bs = -1e9, winnerCls = null;
    side2.techs.forEach((id) => {
      const t = api.TECH[id];
      if (!t) return;
      const sc = api.scoreTechnique(d2, side2, foe2, t, 0, rndB, null);
      if (sc > bs) { bs = sc; winnerCls = t.cls; }
    });
    const pick = api.aiChooseTechnique(d2, side2, foe2, { rnd: rndB, noise: 0 }).tech;
    if (pick.cls !== winnerCls) classMismatches++;
    side2.stam = 10 + (i % 41);
  }
  ok(classMismatches === 0,
    "rotation never leaves the winning class across 60 picks (mismatches " + classMismatches + ")");
};
