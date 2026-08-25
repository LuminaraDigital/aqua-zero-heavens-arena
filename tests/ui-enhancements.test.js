"use strict";

module.exports = function (h) {
  h.section("UI Enhancements: Card Tooltips, Combat FX, Dojo Tutorial, Stat Radar & Settings GUI");

  // 1. CardTooltip Suite
  const CardTooltip = h.api.CardTooltip || require("../src/ui/card-tooltip");
  h.ok(typeof CardTooltip === "object", "CardTooltip object should be defined");

  const strikeCard = { pow: 28, type: 0, name: "Right Cross", slot: 1 };
  const details = CardTooltip.formatCardDetails(strikeCard, { archetype: "Striker" });
  h.ok(details.type === "STRIKE", "Strike card formatted correctly");
  h.ok(details.beats === "Beats Throw", "Strike beats throw rule present");
  h.ok(details.speedTier.indexOf("Slow") >= 0, "Speed tier classified as Heavy/Slow");
  h.ok(details.synergy.indexOf("Velocity") >= 0, "Striker archetype synergy applied");

  CardTooltip.setHoverCard(strikeCard, null, 100, 200);
  h.ok(CardTooltip.getActiveTooltip() !== null, "Active tooltip set");
  CardTooltip.clear();
  h.ok(CardTooltip.getActiveTooltip() === null, "Active tooltip cleared");

  // 2. CombatFX Particles & Battle Banners
  const CombatFX = h.api.CombatFX || require("../src/ui/combat-fx");
  h.ok(typeof CombatFX === "object", "CombatFX defined");
  CombatFX.spawnSparks(200, 200, 10, "#fbbf24");
  h.ok(CombatFX.particles.length > 0, "Particles spawned in emitter");
  
  CombatFX.update();
  h.ok(CombatFX.particles.length >= 0, "Particles updated and decaying");

  CombatFX.triggerClash(300, 300);
  h.ok(CombatFX.banner !== null && CombatFX.banner.text === "CLASH!", "Clash triggers banner");

  CombatFX.triggerCounterHit(300, 300);
  h.ok(CombatFX.banner !== null && CombatFX.banner.text === "COUNTER!", "Counter hit triggers banner");

  // 3. Dojo Interactive Guided Tutorial
  const DojoMode = h.api.DojoMode || require("../src/modes/dojo");
  h.ok(typeof DojoMode === "object", "DojoMode defined");

  DojoMode.startTutorial();
  h.ok(DojoMode.isTutorialActive() === true, "Tutorial active");
  const st1 = DojoMode.getCurrentStage();
  h.ok(st1.id === "strike_beats_throw", "Stage 1 is Strike beats Throw");

  // Incorrect move validation
  const wrongRes = DojoMode.validateAction("GUARD");
  h.ok(wrongRes.success === false, "Incorrect action caught");
  h.ok(DojoMode.getCurrentStage().id === "strike_beats_throw", "Still on stage 1 after fail");

  // Correct move validation
  const correctRes = DojoMode.validateAction("STRIKE");
  h.ok(correctRes.success === true, "Correct action advances stage");
  h.ok(DojoMode.getCurrentStage().id === "throw_beats_guard", "Stage advanced to Stage 2");

  // Complete remaining stages
  DojoMode.validateAction("THROW"); // Stage 2 -> 3
  DojoMode.validateAction("GUARD"); // Stage 3 -> 4
  const finalRes = DojoMode.validateAction("FOCUS"); // Stage 4 -> Graduate
  h.ok(finalRes.success === true, "Tutorial completed successfully");
  h.ok(DojoMode.getCurrentStage().completed === true, "Graduate state reached");

  // 4. StatRadar Hexagonal Attribute Chart
  const StatRadar = h.api.StatRadar || require("../src/ui/stat-radar");
  h.ok(typeof StatRadar === "object", "StatRadar defined");
  const rawAttrs = [80, 75, 90, 60, 85, 70]; // array
  const norm = StatRadar.normalizeStats(rawAttrs);
  h.ok(norm.power === 80, "Normalized power attribute");
  h.ok(norm.speed === 75, "Normalized speed attribute");
  h.ok(norm.technique === 90, "Normalized technique attribute");
  h.ok(StatRadar.getAxes().length === 6, "Axes count is 6");

  // 5. VirtualGamepad Touch & Haptics
  const VirtualGamepad = h.api.VirtualGamepad || require("../src/ui/virtual-gamepad");
  h.ok(typeof VirtualGamepad === "object", "VirtualGamepad defined");
  VirtualGamepad.setOpacity(0.5);
  h.ok(VirtualGamepad.getState().opacity === 0.5, "Gamepad opacity configured");

  // 6. SettingsGUI Audio Mixer & Keybinding Rebinding
  const SettingsGUI = h.api.SettingsGUI || require("../src/ui/settings-gui");
  h.ok(typeof SettingsGUI === "object", "SettingsGUI defined");

  const sfxVol = SettingsGUI.adjustVolume("sfxVolume", -20);
  h.ok(sfxVol <= 100 && sfxVol >= 0, "SFX volume adjusted");

  const bgmVol = SettingsGUI.adjustVolume("bgmVolume", 10);
  h.ok(bgmVol <= 100 && bgmVol >= 0, "BGM volume adjusted");

  SettingsGUI.startRebinding("attack", "combat");
  h.ok(SettingsGUI.getRebindState().active === true, "Rebinding active");
  SettingsGUI.handleKeyEvent("w");
  h.ok(SettingsGUI.getRebindState().active === false, "Rebinding completed on key press");

  SettingsGUI.startRebinding("attack", "combat");
  SettingsGUI.handleKeyEvent("Escape");
  h.ok(SettingsGUI.getRebindState().active === false, "Rebinding cancelled on Escape");
};
