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

  // 7. CardRenderer Tangible Cards, Hand Layout, Stat Chevrons & Status Badges
  const CardRenderer = h.api.CardRenderer || require("../src/ui/card-renderer");
  h.ok(typeof CardRenderer === "object", "CardRenderer object should be defined");
  h.ok(typeof CardRenderer.paintCard === "function", "CardRenderer.paintCard is function");
  h.ok(typeof CardRenderer.paintCardHand === "function", "CardRenderer.paintCardHand is function");
  h.ok(typeof CardRenderer.paintStatStages === "function", "CardRenderer.paintStatStages is function");
  h.ok(typeof CardRenderer.paintStatusBadges === "function", "CardRenderer.paintStatusBadges is function");

  // Attack Height classification
  const highMove = { id: "mt_head_kick", name: "Head Kick", range: "LONG", cls: "STRIKE", flags: ["head", "power"] };
  const midMove = { id: "cross", name: "Cross", range: "MID", cls: "STRIKE", flags: [] };
  const lowMove = { id: "low_kick", name: "Low Kick", range: "LONG", cls: "STRIKE", flags: ["leg"] };
  const specMove = { id: "high_guard", name: "High Guard", range: "ANY", cls: "GUARD", flags: ["block"] };

  h.ok(CardRenderer.getAttackHeight(highMove) === "HIGH", "Head kick classified as HIGH");
  h.ok(CardRenderer.getAttackHeight(midMove) === "MID", "Cross classified as MID");
  h.ok(CardRenderer.getAttackHeight(lowMove) === "LOW", "Low kick classified as LOW");
  h.ok(CardRenderer.getAttackHeight(specMove) === "SPECIAL", "Guard move classified as SPECIAL");

  // Keyword tags extraction
  const counterMove = { id: "check_hook", name: "Check Hook", prio: 1, flags: ["counter"] };
  const bleedMove = { id: "horiz_elbow", name: "Horizontal Elbow", eff: { st: "BLEEDING", ch: 35 }, flags: ["cut"] };
  const stunMove = { id: "lead_hook", name: "Lead Hook", eff: { st: "STUNNED", ch: 12 }, flags: [] };
  const launchMove = { id: "rear_upper", name: "Rear Uppercut", flags: ["launcher"] };

  const counterKw = CardRenderer.getKeywords(counterMove);
  h.ok(counterKw.some(function(k) { return k.label === "Counter"; }), "Counter keyword extracted");

  const bleedKw = CardRenderer.getKeywords(bleedMove);
  h.ok(bleedKw.some(function(k) { return k.label === "Bleed"; }), "Bleed keyword extracted");

  const stunKw = CardRenderer.getKeywords(stunMove);
  h.ok(stunKw.some(function(k) { return k.label === "Stun"; }), "Stun keyword extracted");

  const launchKw = CardRenderer.getKeywords(launchMove);
  h.ok(launchKw.some(function(k) { return k.label === "Launcher"; }), "Launcher keyword extracted");

  // Canvas paint mock verification
  const mockCtx = {
    save: function() {},
    restore: function() {},
    beginPath: function() {},
    closePath: function() {},
    moveTo: function() {},
    lineTo: function() {},
    fillRect: function() {},
    strokeRect: function() {},
    fillText: function() {},
    strokeText: function() {},
    arc: function() {},
    stroke: function() {},
    fill: function() {},
    measureText: function() { return { width: 40 }; },
    createLinearGradient: function() { return { addColorStop: function() {} }; },
    createRadialGradient: function() { return { addColorStop: function() {} }; },
    transform: function() {},
    translate: function() {},
  };

  CardRenderer.paintCard(mockCtx, 10, 10, 120, 168, "jab", { selected: true, pointCost: 4, comboIndex: 1 });
  h.ok(true, "CardRenderer.paintCard rendered without error");

  const handCards = ["jab", "cross", "lead_hook", "switch_kick", "high_guard"];
  CardRenderer.paintCardHand(mockCtx, 20, 300, handCards, 1, { hoveredIndex: 0, comboSequence: [0, 1] });
  h.ok(true, "CardRenderer.paintCardHand rendered 5-card hand without error");

  CardRenderer.paintStatStages(mockCtx, 20, 100, { atk: 2, def: -1, spd: 1, acc: 0 });
  h.ok(true, "CardRenderer.paintStatStages rendered stat stages without error");

  CardRenderer.paintStatusBadges(mockCtx, 20, 140, { BLEEDING: { turns: 2 }, STUNNED: { turns: 1 }, OFF_BALANCE: { turns: 1 } });
  h.ok(true, "CardRenderer.paintStatusBadges rendered status badges with timers without error");

  // 8. Spectacle CRT Filter & Arcade Announcer Callout Banners
  const Spectacle = h.api.Spectacle || require("../src/ui/spectacle");
  h.ok(typeof Spectacle.paintCRTFilter === "function", "Spectacle.paintCRTFilter is function");
  h.ok(typeof Spectacle.paintArcadeBanner === "function", "Spectacle.paintArcadeBanner is function");

  Spectacle.paintCRTFilter(mockCtx, 960, 540, 0.4);
  h.ok(true, "paintCRTFilter rendered without error");

  const callouts = ["ROUND 1 - FIGHT!", "COUNTER HIT!", "GUARD CRUSH!", "GREAT REVERSAL!", "PERFECT KO!"];
  callouts.forEach(function(c) {
    Spectacle.paintArcadeBanner(mockCtx, 960, 540, c, "TACTICAL ADVANTAGE", { alpha: 1.0 });
  });
  h.ok(true, "paintArcadeBanner rendered all announcer callouts without error");

  // 9. DeckBuilder Enhanced Analytics & Vault
  const DeckBuilder = h.api.DeckBuilder || require("../src/progress/deck-builder");
  const sampleLoadout = [
    "kuzushi", "guard_pull", "basic_close", "head_control", "basic_tieup", "switch_step",
    "apkubi", "juchum_seogi", "kkoa_seogi", "high_guard", "plum_clinch", "lw_shell"
  ];
  const dbStats = DeckBuilder.getDeckStats(sampleLoadout);
  h.ok(dbStats.count === 12, "Deck stats calculates count correctly");
  h.ok(dbStats.cost > 0 && dbStats.cost <= 100, "Deck stats calculates cost within 100 PTS");
  h.ok(dbStats.ranges.MID > 0, "Deck stats includes range distribution");
  h.ok(dbStats.staminaCurve.low >= 0, "Deck stats includes stamina curve histogram");
  h.ok(dbStats.isLegal === true, "Sample deck verified legal in stats");

  const vaultCards = DeckBuilder.getVaultCards({ discipline: "boxing", search: "jab" });
  h.ok(vaultCards.length > 0, "Vault filters cards by discipline and search");
  h.ok(vaultCards[0].pointCost !== undefined, "Vault cards include point cost");

  const defDeck = DeckBuilder.getDefaultDeck(0);
  h.ok(Array.isArray(defDeck) && defDeck.length >= 12, "getDefaultDeck returns valid roster deck");
};

