"use strict";

module.exports = function (h) {
  h.section("GARED: Style Meter, Infusion Seals, Martial Arts Codex, Dynamic Modes & Trophies");

  const StyleMeter = h.api.StyleMeter || require("../src/battle/style-meter.js");
  const Resonance = h.api.Resonance || require("../src/battle/resonance.js");
  const Infusions = h.api.Infusions || require("../src/progress/infusions.js");
  const Codex = h.api.Codex || require("../src/progress/codex.js");
  const EndlessGauntlet = h.api.EndlessGauntlet || require("../src/modes/endless-gauntlet.js");
  const WeeklyMutator = h.api.WeeklyMutator || require("../src/modes/weekly-mutator.js");
  const Wagers = h.api.Wagers || require("../src/modes/wagers.js");
  const GhostBattles = h.api.GhostBattles || require("../src/progress/ghost-battles.js");
  const CodexViewer = h.api.CodexViewer || require("../src/ui/codex-viewer.js");
  const TrophyRoom = h.api.TrophyRoom || require("../src/ui/trophy-room.js");

  // 1. Style Meter
  h.ok(typeof StyleMeter === "object", "StyleMeter object defined");
  h.ok(StyleMeter.styleGradeForScore(0).grade === "D", "Style grade D for 0 pts");
  h.ok(StyleMeter.styleGradeForScore(350).grade === "C", "Style grade C for 350 pts");
  h.ok(StyleMeter.styleGradeForScore(800).grade === "B", "Style grade B for 800 pts");
  h.ok(StyleMeter.styleGradeForScore(1400).grade === "A", "Style grade A for 1400 pts");
  h.ok(StyleMeter.styleGradeForScore(2200).grade === "S", "Style grade S for 2200 pts");
  h.ok(StyleMeter.styleGradeForScore(3000).grade === "SSS", "Style grade SSS for 3000 pts");

  const st = StyleMeter.DEF_STYLE_STATE();
  const ev1 = { hit: true, dmg: 40, tech: { id: "jab", name: "Lead Jab" } };
  const res1 = StyleMeter.evaluateStyleEvent(st, ev1, { hp: 100, maxhp: 100 }, {});
  h.ok(res1.pointsAdded > 0, "Style points awarded on hit");
  h.ok(st.score > 0, "Style score increased");

  const evCounter = { hit: true, counter: 20, dmg: 30, tech: { id: "cross", name: "Straight Cross" } };
  const resCounter = StyleMeter.evaluateStyleEvent(st, evCounter, { hp: 100, maxhp: 100 }, {});
  h.ok(resCounter.events.indexOf("COUNTER INTERCEPTION") >= 0, "Counter interception event flagged");

  // Stale move penalty check
  for (let i = 0; i < 4; i++) {
    StyleMeter.evaluateStyleEvent(st, { hit: true, dmg: 10, tech: { id: "jab", name: "Lead Jab" } }, { hp: 100, maxhp: 100 }, {});
  }
  h.ok(st.recentEvents.indexOf("STALE MOVE") >= 0, "Stale move penalty triggered on repeated techniques");

  // 2. Technique Infusion Seals
  h.ok(typeof Infusions === "object", "Infusions object defined");
  const run = { hero: 0, seals: {}, drafted: ["jab", "cross"] };
  h.ok(Infusions.getTechSeal(run, "jab") === null, "Initial technique has no seal");

  h.ok(Infusions.applySealToTech(run, "jab", "SEAL_LIGHTNING") === true, "Apply Lightning seal");
  const seal = Infusions.getTechSeal(run, "jab");
  h.ok(seal !== null && seal.id === "SEAL_LIGHTNING", "Lightning seal active on jab");
  h.ok(seal.stamMul === 0.75, "Lightning seal stamina cost modifier is -25%");

  h.ok(Infusions.removeSealFromTech(run, "jab") === true, "Remove seal succeeds");
  h.ok(Infusions.getTechSeal(run, "jab") === null, "Seal cleared");

  // 3. Discipline Resonance Synergies
  h.ok(typeof Resonance === "object", "Resonance object defined");
  const deck = ["jab", "cross", "overhand", "o_soto_gari", "seoi_nage", "harai_goshi"];
  const active = Resonance.getActiveResonances(deck);
  h.ok(active.length >= 1, "Discipline resonance perks evaluated");
  h.ok(active[0].id === "DIRTY_BOXING", "Dirty Boxing perk activated");
  h.ok(Resonance.hasResonance(deck, "DIRTY_BOXING") === true, "Dirty Boxing resonance active");
  h.ok(Resonance.hasResonance(deck, "STRIKERS_HORIZON") === false, "Inactive resonance rejected");

  // 4. Martial Arts Codex Compendium
  h.ok(typeof Codex === "object", "Codex object defined");
  const codex = Codex.DEF_CODEX();
  h.ok(Codex.codexTierFor(0, 0).id === "UNSEEN", "0 uses is UNSEEN");
  h.ok(Codex.codexTierFor(3, 0).id === "DISCOVERED", "3 uses is DISCOVERED");
  h.ok(Codex.codexTierFor(8, 1).id === "PRACTITIONER", "8 uses + 1 KO is PRACTITIONER");
  h.ok(Codex.codexTierFor(20, 4).id === "ADEPT", "20 uses + 4 KOs is ADEPT");
  h.ok(Codex.codexTierFor(35, 10).id === "EXPERT", "35 uses + 10 KOs is EXPERT");
  h.ok(Codex.codexTierFor(60, 20).id === "GRANDMASTER", "60 uses + 20 KOs is GRANDMASTER");

  Codex.codexRecordUse(codex, "jab", 35, true);
  h.ok(codex.entries.jab.uses === 1, "Codex uses recorded");
  h.ok(codex.entries.jab.kos === 1, "Codex KO recorded");
  h.ok(codex.entries.jab.maxDmg === 35, "Codex peak damage recorded");

  // 5. Endless Survival Gauntlet
  h.ok(typeof EndlessGauntlet === "object", "EndlessGauntlet object defined");
  const endlessSt = EndlessGauntlet.DEF_ENDLESS_STATE(0);
  h.ok(endlessSt.wave === 1, "Endless mode begins at wave 1");

  const opp1 = EndlessGauntlet.endlessOpponentForWave(1);
  const opp5 = EndlessGauntlet.endlessOpponentForWave(5);
  h.ok(opp1.isBoss === false, "Wave 1 is regular gladiator");
  h.ok(opp5.isBoss === true, "Wave 5 is boss wave");
  h.ok(opp5.statMul > opp1.statMul, "Boss wave stat multiplier scales up");

  const adv = EndlessGauntlet.endlessAdvanceWave(endlessSt, true, { hpLeft: 0.8 });
  h.ok(adv.active === true, "Endless advance active");
  h.ok(endlessSt.wave === 2, "Wave incremented to 2");
  h.ok(endlessSt.score > 0, "Score accumulated");

  // 6. Weekly Seeded Mutator
  h.ok(typeof WeeklyMutator === "object", "WeeklyMutator object defined");
  const mut1 = WeeklyMutator.getWeeklyMutator(new Date("2026-08-24T12:00:00Z"));
  const mut2 = WeeklyMutator.getWeeklyMutator(new Date("2026-08-24T18:00:00Z"));
  h.ok(mut1.id === mut2.id, "Weekly mutator seed is deterministic for the same week");
  h.ok(WeeklyMutator.WEEKLY_MUTATORS.length >= 5, "At least 5 weekly mutator presets");

  // 7. Underworld Wagers & Bounties
  h.ok(typeof Wagers === "object", "Wagers object defined");
  const bounties = Wagers.generateBountiesForFight(42);
  h.ok(bounties.length === 3, "3 pre-bout bounties offered");

  const bounty = Wagers.BOUNTY_TEMPLATES[0]; // Reckless Aggression (NO_GUARD)
  const wonStats = { win: true, guards: 0 };
  const res = Wagers.evaluateBountyResult(bounty, wonStats, null);
  h.ok(res.ok === true, "Bounty terms successfully met");
  h.ok(res.purseMul > 1.0, "Bounty pays lucrative purse multiplier");

  // 8. Ghost Passcode Serialization & AI Combatant
  h.ok(typeof GhostBattles === "object", "GhostBattles object defined");
  const build = {
    hero: 2,
    name: "Marcus Prime",
    techniques: ["jab", "cross", "seoi_nage"],
    seals: { jab: "SEAL_LIGHTNING" },
    drilled: { cross: 2 },
  };
  const code = GhostBattles.encodeGhostBuild(build);
  h.ok(typeof code === "string" && code.length > 10, "Champion build encoded into compact passcode");

  const decoded = GhostBattles.decodeGhostBuild(code);
  h.ok(decoded !== null, "Passcode decoded successfully");
  h.ok(decoded.hero === 2, "Hero ID matches decoded build");
  h.ok(decoded.name === "Marcus Prime", "Fighter name matches decoded build");
  h.ok(decoded.seals.jab === "SEAL_LIGHTNING", "Technique seal matches decoded build");
  h.ok(decoded.drilled.cross === 2, "Drill tier matches decoded build");

  const ghostBot = GhostBattles.createGhostCombatant(decoded);
  h.ok(ghostBot.isGhost === true, "Ghost bot flagged as AI combatant");
  h.ok(ghostBot.id === 2, "Ghost bot fighter ID preserved");

  // 9. UI Viewers State & Navigation
  h.ok(typeof CodexViewer === "object", "CodexViewer object defined");
  const codexState = { discIndex: 0, itemIndex: 0 };
  CodexViewer.handleInput("DOWN", codexState);
  h.ok(codexState.itemIndex === 1, "Codex viewer navigated down");
  CodexViewer.handleInput("RIGHT", codexState);
  h.ok(codexState.discIndex === 1, "Codex viewer changed discipline tab");

  h.ok(typeof TrophyRoom === "object", "TrophyRoom object defined");
  const save = { ranking: { peakRankIndex: 12 }, bestStreak: 12, tower: { unlockedFloors: 110 } };
  const trophies = TrophyRoom.getTrophyList(save);
  const goldBelt = trophies.find((t) => t.id === "BELT_GOLD");
  h.ok(goldBelt && goldBelt.unlocked === true, "Gold Belt unlocked on Dan rank");

  const tower100 = trophies.find((t) => t.id === "TOWER_FL100");
  h.ok(tower100 && tower100.unlocked === true, "Tower 100 Crest unlocked on Floor 110 reached");
};
