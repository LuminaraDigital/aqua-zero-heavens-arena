/* =====================================================================
   Aqua Zero Heavens Arena - test harness
   Luminara Digital

   The game ships as one self-contained page, so the tests load that page,
   stub just enough DOM and canvas for it to run, and drive the real code.
   Nothing is mocked below the harness line - the suites exercise the same
   functions the browser does.

     const { api, ok, report } = require("./harness")();
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PAGE = path.resolve(__dirname, "..", "aqua-zero-heavens-arena.html");

function el() {
  return {
    textContent: "", innerHTML: "", value: "", dataset: {}, style: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute() {}, getAttribute() {}, addEventListener() {}, appendChild() {},
    contains: () => false, focus() {},
  };
}
function ctx2d() {
  const c = {
    font: "", textAlign: "", textBaseline: "", fillStyle: "", strokeStyle: "",
    lineWidth: 1, globalAlpha: 1, shadowColor: "", shadowBlur: 0, filter: "",
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 }),
  };
  ["fillRect", "fillText", "strokeRect", "strokeText", "save", "restore", "translate", "scale",
   "rotate", "drawImage", "beginPath", "moveTo", "lineTo", "closePath", "fill", "stroke", "arc",
   "ellipse", "rect", "clip", "setTransform", "clearRect", "quadraticCurveTo", "bezierCurveTo"].forEach((k) => (c[k] = () => {}));
  return c;
}

module.exports = function boot(opts) {
  opts = opts || {};
  const page = fs.readFileSync(PAGE, "utf8");
  let js = page.slice(page.indexOf("<script>") + 8, page.lastIndexOf("</script>"));
  // the artwork never decodes here - swap the 1.4 MB blob for a stub
  js = js.replace(/^const ART=\{.*\};$/m, "const ART={};FIGHTERS.forEach(f=>ART[f.name]={w:1,h:1,d:\"\"});");
  js = js.replace(/^const LOGO_SRC=.*;$/m, 'const LOGO_SRC="";');

  const store = new Map();
  const pendingImgs = [];
  const canvas = Object.assign(el(), { getContext: () => ctx2d(), width: 960, height: 540 });
  const sandbox = {
    console, Math, JSON, Date, Object, Array, String, Number, Boolean, Error,
    isNaN, parseInt, parseFloat, RegExp,
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0,
    btoa: (str) => Buffer.from(String(str), "binary").toString("base64"),
    atob: (b64) => Buffer.from(String(b64), "base64").toString("binary"),
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    Image: function () { this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0; pendingImgs.push(this); },
    document: {
      getElementById: (id) => (id === "s" ? canvas : el()),
      querySelector: () => el(), querySelectorAll: () => [],
      createElement: () => el(), body: el(), activeElement: null,
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const EXPORTS = [
    "G", "S", "D", "SAVE", "onKey", "step", "render", "FIGHTERS", "BIOS", "ART", "DECKS", "ORDER", "BOSS",
    "BOSS_ID", "SUP_MAX", "traitsOf", "hpOf", "menuItems", "newField", "battlePool", "huntStep",
    "jugTierAt", "jugWindows", "simScore", "tendency", "startSuper", "startJuggle", "resolveJuggle",
    "DIFFS", "diff",
    // technique layer
    "TECH", "TECH_IDS", "DISCIPLINES", "disciplineId", "RANGE_ORDER", "RANGE_LABEL",
    "rangeFit", "rangeAccFit", "comfort", "homeRanges", "STATUS", "addStatus", "hasStatus",
    "statusMods", "tickStatus", "initiativeOf", "orderTurn", "staminaCost",
    "STAT_STAGES", "statStageMultiplier", "newStatStages", "getStatStage", "setStatStage", "modifyStatStage", "resetStatStages", "statStageMods", "getStatusDuration", "setStatusDuration", "clearStatus", "clearAllStatuses",
    "newZones", "getZoneDamageTarget", "hurtZone",
    "zoneRatio", "zoneSnapshot", "newCuts", "hurtCut", "cutPenalty", "cutSnapshot",
    "resetControl", "assignClinchControl", "assignGroundControl", "clearControl",
    "syncControlOnRange", "reverseControl", "isClinchController", "isGroundTop", "isGroundBottom",
    "controlModsFor", "controlSnapshot",
    "CAMP_FOCI", "CAMP_FOCUS_IDS", "CAMP_WORKLOADS", "CAMP_WORKLOAD_IDS",
    "campFocusOf", "campWorkloadOf", "campFocusChoices", "normalizeCampPlan", "applyCampFocus",
    "STYLE_TRAITS", "STYLE_TRAIT_IDS", "styleTraitsOf", "styleTraitDefs",
    "applyStyleTraitWeights", "styleTraitScore", "applyStyleTraitOnHit",
    "CAREER_ARCS", "CAREER_ARC_IDS", "careerArcOf", "careerFightCount", "careerPhase",
    "careerArcGrowthMul", "careerArcResurgeChance", "masteryForWithArc",
    "CALLOUT_CONFIG", "calloutKey", "ensureCallouts", "rivalryHeatOf", "issueCallout",
    "decayCalloutHeat", "applyCalloutHeatToDuel", "calloutPurseBonus",
    "ATTACK_HEIGHTS", "HEIGHT_ORDER", "attackHeightOf", "heightAdvantage",
    "CHOICES", "classifyTechniqueChoice", "resolve3WayDynamic", "focusAction", "resolveHeightInteraction",
    "POSITIONS","POSITION_ORDER","positionMods","positionModsFor","escapeChance","attemptEscape","pressureShift","cornerDamageBonus","describePosition","resetPosition","pressureDecay",
    "guardFactor","applyRangeShift","executeTechnique", "tickRangeClock", "groundEscapeBonus", "accuracyOf", "damageOf", "damageLayers", "accuracyLayers", "DMG_CLAMP", "ACC_CLAMP", "rockThreshold", "chinFactor", "endTurnUpkeep", "aiChooseTechnique", "scoreTechnique",
    "disciplinesOf", "learnsetOf", "knownTechs", "techsGainedAt", "signatureOf", "CATEGORIES",
    "techsInCategory", "buildTurn", "stepQueue", "turnEnd", "mkSide", "startDuel", "beginRound",
    "customTechsFor", "endDuel", "forfeitDuel", "bumpFighter", "startExhibitionBout",
    // ranking layer
    "BENEFITS","BENEFIT_IDS","benefitChoices","benefitHook","benefitFlag","MASTERY_RANKS","MASTERY_MAX","masteryXp","masteryRank","masteryProgress","masteryToNext","awardMastery","masteryLevel","applyMastery","masteryStartLevel","CHALLENGES","CHALLENGE_BY_ID","newDuelStats","evaluateChallenges","challengeSweep","titleOf","activeTitle","ARCHETYPES","ARCHETYPE_IDS","archetypeFor","archetypeOf","seededRng","dayKey","STIPULATIONS","dailySetup","dailyScore","dailyState","completeDaily","stipMul","stipFlag","startDailyGauntlet","exclusiveOf",
    "DRAFT_CONFIG","draftChoices","applyDraft","draftedTechs","canDraft","draftSummary","draftPowerBudget","draftPool",
    "PURSE","purseFor","BUY_REASON","conditioningPrice","openShop","SHOP_CONFIG","shopStock","buyItem","canAfford","rerollCost","rerollTicket","CONDITIONING","CORNER_ITEMS","applyConditioning","takeCorner","campFocusItem",
    "SEQ_CONFIG","canChain","chainBonus","sequenceCost","validSequences","interruptChance","resolveSequence","describeSequence","sequenceOdds","chainOptions",
    "intentFor","intentHint","forecastFirst","posOk","seqMaxLen","swapCorner","techMenuFromList",
    "cutCandidates","drillCandidates","cutTicket","drillTicket","menuTechsFor","INTENT_TELLS",
    "bagOpen","bagLit","applyCornerFx","useCornerItem",
    "STORIES","RIVALRIES","rivalOf","rivalryReason","storyOf","calloutFor","grudgeBonus","GRUDGE_CONFIG","isRivalPair",
    "ANIM_CONFIG","animFor","startAnim","tickAnim","animTransform","impactBurst","hitStopFor","cameraFor","rangeMoveOf","EASE",
    "TRAIT_TUNE","traitTuneFor",
    "RANK_TABLE", "RANK_THRESHOLDS", "RANK_CONFIG", "RANK_DIVISIONS", "DIVISION", "MAX_RANK_INDEX",
    "FIRST_DAN_INDEX", "rankByIndex", "rankByTitle", "getRankForPoints", "getNextRank", "getPreviousRank",
    "rankProgress", "pointsToNextRank", "calculatePointsExchange", "calculatePerformancePurse", "newPlayerRanking", "RankingService",
    "makeMemoryStore", "makeSaveStore", "makeRankingApi", "cpuRankIndexFor", "rankBadge", "YOU",
    "rankApi", "myRanking", "findLadderOpponent", "startRanked", "applyLadderResult", "invalidateRankApi",
    "BELT_TEST_GATES", "BELT_TEST_BONUS", "emptyBeltTests", "normalizeBeltTests", "ensureBeltTests",
    "unclearedGateCrossed", "enforceBeltTestHold", "completeBeltTest", "beltTestStatus",
    "writeRankedSession", "readRankedSession",
    "BACKUP_KEY", "STAMP_KEY", "BACKUP_LIMIT", "readBackupVault", "writeBackupVault", "snapshotSave",
    "pushBackup", "latestBackup", "exportSaveBlob", "importSaveEnvelope",
    "makeTabId", "readSaveStamp", "writeSaveStamp", "nextSaveStamp", "shouldAdoptRemoteStamp",
    "clearBackupVault", "clearSaveStamp", "sanitizeSavePayload", "escapeHtml", "sanitizeFighterName",
    "applyImportedSave", "restoreLatestBackup", "persist", "DEF_SAVE", "load",
    "adoptRemoteSaveIfNewer", "bumpSaveGen",
    "SECURITY_LOG_KEY", "SECURITY_LOG_LIMIT", "appendSecurityEvent", "readSecurityLog", "clearSecurityLog",
    "IMPORT_RATE_WINDOW_MS", "IMPORT_RATE_MAX", "checkImportRateLimit", "noteImportAttempt",
    "sanitizeRun", "sanitizeDaily", "sanitizeRanking",
    "CLOUD_SESSION_KEY", "CLOUD_CONFIG", "cloudConfigured", "cloudReadSession", "cloudWriteSession",
    "cloudClearSession", "cloudSignUp", "cloudSignIn", "cloudSignOut",
    "cloudPullSave", "cloudPushSave", "cloudResolveConflict", "cloudSchedulePush",
    "cloudStatusLabel", "cloudSyncNow", "cloudBusy",
    "TON_SESSION_KEY", "TON_CONFIG", "tonCanConnect", "tonManifestUrl",
    "tonReadWallet", "tonWriteWallet", "tonShortAddress", "tonStatusLabel",
    "tonConnect", "tonDisconnect",
    // presentation layer - the score, the walkout, the tape, the ceremony, the demo
    "MUSIC_HZ", "MUSIC_BAD", "musicSeq", "MUSIC_CONFIG", "MUSIC_TRACKS", "MUSIC_TRACK_NAMES",
    "musicClamp01", "newMusicState", "musicAdvanceClock", "musicCollectStep", "musicTick",
    "musicSwitch", "musicIntensity", "musicLayersOn", "musicHeat", "musicStop", "musicPlaying",
    "musicMute", "bellNotes", "crowdSwell", "crowdCue", "crowdCueReset", "crowdFamilyOf", "CROWD_FAMILIES",
    "TAPE_CONFIG", "TAPE_METRICS", "TAPE_BLANK", "tapeRows", "tapeHeader", "tapeStoryline",
    "tapeAdvantage", "tapeEdgeOf",
    "ENTRANCE_CONFIG", "newEntrance", "entranceBeat", "entranceSkip", "entranceDone", "entranceCues",
    "RESULT_CONFIG", "RESULT_METHODS", "RESULT_DETAIL", "resNum", "resClamp", "resShare", "resPct",
    "resEase", "dominantRange", "methodOfVictory", "fightStatRows", "fightGrade", "ceremonyBeats",
    "ceremonyStep", "ceremonyCues", "ceremonySkip", "ceremonyHas", "ceremonyPhase",
    "ATTRACT_CONFIG", "newAttract", "attractTick", "attractStart", "attractStop", "attractPoke",
    "attractSaveSeen", "attractReady", "attractHomeRanges", "attractOverlap", "attractPick",
    "attractChoose", "attractShouldExit",
    "optionRows", "menuPreview",
    "SFX", "CombatFX", "FloatingFeedback", "TowerMode", "DojoMode", "CreateFighterMode", "CreditLedger", "NarrativeEvents",
    "P2PNetwork", "ReplayEngine", "ReplayViewer", "TonOnchain", "VirtualGamepad", "Keybindings", "i18n",
    "CardTooltip", "StatRadar", "SettingsGUI", "DeckBuilder", "ExhibitionMode",
    "StyleMeter", "STYLE_RANKS", "STYLE_TRIGGERS", "DEF_STYLE_STATE", "styleGradeForScore", "evaluateStyleEvent",
    "Resonance", "RESONANCE_PAIRS", "countDeckDisciplines", "getActiveResonances", "hasResonance",
    "Infusions", "SEALS", "SEAL_IDS", "getTechSeal", "applySealToTech", "removeSealFromTech", "sealCandidates",
    "Codex", "CODEX_TIERS", "DEF_CODEX", "codexNormalize", "codexTierFor", "codexRecordUse", "codexDisciplineStats", "codexTotalStats",
    "EndlessGauntlet", "ENDLESS_CONFIG", "DEF_ENDLESS_STATE", "endlessOpponentForWave", "endlessAdvanceWave",
    "GAUNTLET_AFFIXES", "GAUNTLET_PERKS", "gauntletPerkChoices", "applyGauntletPerk", "gauntletRestActions",
    "WeeklyMutator", "WEEKLY_CONFIG", "WEEKLY_MUTATORS", "SECONDARY_MUTATORS", "WEEKLY_AUGMENTS", "getWeekNumber", "getIsoWeekYear", "getSecondaryMutator", "getWeeklyMutator", "formatWeeklyCountdown", "DEF_WEEKLY_STATE", "weeklyOpponentForTier", "weeklyAdvanceTier", "weeklyAugmentChoices", "applyWeeklyAugment", "weeklyCornerActions",
    "Wagers", "BOUNTY_TEMPLATES", "generateBountiesForFight", "evaluateBountyResult",
    "ChallengeRun", "CHALLENGE_RUN_META", "challengeRunMeta", "challengeCoachTip",
    "challengeRenownBonus", "challengeMeetEligible", "challengeProgress", "challengeCheckBreak",
    "challengeApplyToAdv", "challengeApplyToDuel", "challengeScaleHeal", "challengeNoteMeet",
    "challengeBuildRows", "challengeMutatorLabel", "challengeNeedHits",
    "GhostBattles", "GHOST_MAGIC", "GHOST_MAGIC_V1", "GHOST_MAGIC_V2", "encodeGhostBuild", "decodeGhostBuild", "createGhostCombatant", "extractStyleVector", "styleVectorToWeights",
    "AdaptiveAI", "AICoach", "AICommentary", "CombatEvents",
    "CodexViewer", "TrophyRoom", "Interactive3DBG", "THEMES_3D",
    "ThreeEngine", "Venue3D", "Card3D", "CombatFX3D", "Trophy3D",
    "Onboarding", "menuGoTo", "menuTabItems", "MENU_TABS", "masteredCount", "PACE_MODES", "paceMode", "paceTape", "paceExec",
    "canvasBox", "syncTouchControls",
    "RELICS", "RELIC_IDS", "RELIC_TIERS", "relicHook", "relicFlag", "relicChoices", "ADV_PERKS", "ADV_PERK_IDS", "buyAdvPerk",
    "scoreRound", "scoreRoundAllJudges", "evaluateDecision", "cornerUrgencyPrompt", "JUDGES",
    "CORNER_ACTIONS", "getCornerStatus", "applyCornerAction", "checkDoctorStoppage",
    "WEIGHT_CUT_PROFILES", "applyWeightCut",
    "isWallPinned", "pinToWall", "wallWalkGetup", "cageSpringStrike",
  ];
  const tail = "\n;globalThis.__api={" + EXPORTS.map((k) => k + ":typeof " + k + "!==\"undefined\"?" + k + ":undefined").join(",") +
    ",getSave:()=>SAVE,setSave:(v)=>{SAVE=v;},run:(src)=>eval(src),store:null};";
  /* The three modules under item E of docs/IMPLEMENTATION_PLAN.md are
     shelved: tools/build.js leaves them out of the page because no menu,
     fight hook or telemetry reaches them. Their suites still run against
     the real code rather than a copy - the files are loaded beside the
     page, into the same context, so they see the same engine globals
     (addStatus, hurtCut, FIGHTERS, the duel) they would have seen inside
     it. Built with AZHA_SHELVED=0 they are already in the page and this
     is a no-op: re-declaring their consts in one context would throw. */
  const SHELVED = ["battle/judging.js", "battle/corner-protocol.js", "progress/weight-cut.js"];
  const shelved = SHELVED
    .filter((m) => js.indexOf("/* ---- src/" + m + " ---- */") < 0)
    .map((m) => "\n/* ---- shelved, loaded by the harness: src/" + m + " ---- */\n" +
      fs.readFileSync(path.resolve(__dirname, "..", "src", m), "utf8"))
    .join("\n");

  vm.createContext(sandbox);
  vm.runInContext(js + shelved + tail, sandbox, { filename: "aqua-zero-heavens-arena.js" });
  pendingImgs.forEach((i) => { if (i.onload) i.onload(); });

  const api = sandbox.__api;
  api.localStore = store;
  api.exec = (src) => vm.runInContext(src, sandbox);

  let fails = 0, checks = 0;
  const quiet = !!opts.quiet;
  function ok(cond, label, extra) {
    checks++;
    if (!cond) { fails++; console.log("  FAIL  " + label + (extra !== undefined ? "  [" + extra + "]" : "")); }
    else if (!quiet) console.log("  ok    " + label);
  }
  const section = (s) => console.log("\n== " + s + " ==");
  const frames = (n) => { for (let i = 0; i < n; i++) { api.step(); api.render(); } };
  const press = (k, n) => { for (let i = 0; i < (n || 1); i++) { api.onKey(k); api.step(); api.render(); } };
  const scene = () => Object.keys(api.S).find((k) => api.S[k] === api.G.scene);
  const phase = () => Object.keys(api.D).find((k) => api.D[k] === (api.G.duel && api.G.duel.ph));
  const report = () => ({ fails, checks });

  return { api, ok, section, frames, press, scene, phase, report, exec: api.exec };
};
