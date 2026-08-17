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
    textContent: "", innerHTML: "", value: "", dataset: {},
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
    requestAnimationFrame: () => 0,
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
    // technique layer
    "TECH", "TECH_IDS", "DISCIPLINES", "disciplineId", "RANGE_ORDER", "RANGE_LABEL",
    "rangeFit", "rangeAccFit", "comfort", "homeRanges", "STATUS", "addStatus", "hasStatus",
    "statusMods", "tickStatus", "initiativeOf", "orderTurn", "staminaCost",
    "POSITIONS","POSITION_ORDER","positionMods","positionModsFor","escapeChance","attemptEscape","pressureShift","cornerDamageBonus","describePosition","resetPosition","pressureDecay",
    "guardFactor","applyRangeShift","executeTechnique", "tickRangeClock", "groundEscapeBonus", "accuracyOf", "damageOf", "endTurnUpkeep", "aiChooseTechnique", "scoreTechnique",
    "disciplinesOf", "learnsetOf", "knownTechs", "techsGainedAt", "signatureOf", "CATEGORIES",
    "techsInCategory", "buildTurn", "stepQueue", "turnEnd", "mkSide", "startDuel", "beginRound",
    // ranking layer
    "BENEFITS","BENEFIT_IDS","benefitChoices","benefitHook","benefitFlag","MASTERY_RANKS","MASTERY_MAX","masteryXp","masteryRank","masteryProgress","masteryToNext","awardMastery","masteryLevel","applyMastery","masteryStartLevel","CHALLENGES","CHALLENGE_BY_ID","newDuelStats","evaluateChallenges","challengeSweep","titleOf","activeTitle","ARCHETYPES","ARCHETYPE_IDS","archetypeFor","archetypeOf","seededRng","dayKey","STIPULATIONS","dailySetup","dailyScore","dailyState","completeDaily","stipMul","stipFlag","startDailyGauntlet","exclusiveOf",
    "DRAFT_CONFIG","draftChoices","applyDraft","draftedTechs","canDraft","draftSummary","draftPowerBudget","draftPool",
    "PURSE","purseFor","BUY_REASON","conditioningPrice","openShop","SHOP_CONFIG","shopStock","buyItem","canAfford","rerollCost","rerollTicket","CONDITIONING","CORNER_ITEMS","applyConditioning","takeCorner",
    "SEQ_CONFIG","canChain","chainBonus","sequenceCost","validSequences","interruptChance","resolveSequence","describeSequence","sequenceOdds","chainOptions",
    "intentFor","intentHint","forecastFirst","posOk","seqMaxLen","swapCorner","techMenuFromList",
    "cutCandidates","drillCandidates","cutTicket","drillTicket","menuTechsFor","INTENT_TELLS",
    "bagOpen","bagLit","applyCornerFx","useCornerItem",
    "STORIES","RIVALRIES","rivalOf","rivalryReason","storyOf","calloutFor","grudgeBonus","GRUDGE_CONFIG",
    "ANIM_CONFIG","animFor","startAnim","tickAnim","animTransform","impactBurst","hitStopFor","cameraFor","rangeMoveOf","EASE",
    "TRAIT_TUNE","traitTuneFor",
    "RANK_TABLE", "RANK_THRESHOLDS", "RANK_CONFIG", "RANK_DIVISIONS", "DIVISION", "MAX_RANK_INDEX",
    "FIRST_DAN_INDEX", "rankByIndex", "rankByTitle", "getRankForPoints", "getNextRank", "getPreviousRank",
    "rankProgress", "pointsToNextRank", "calculatePointsExchange", "newPlayerRanking", "RankingService",
    "makeMemoryStore", "makeSaveStore", "makeRankingApi", "cpuRankIndexFor", "rankBadge", "YOU",
    "rankApi", "myRanking", "findLadderOpponent", "startRanked",
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
    "musicMute", "bellNotes", "crowdSwell",
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
  ];
  const tail = "\n;globalThis.__api={" + EXPORTS.map((k) => k + ":typeof " + k + "!==\"undefined\"?" + k + ":undefined").join(",") +
    ",getSave:()=>SAVE,setSave:(v)=>{SAVE=v;},run:(src)=>eval(src),store:null};";
  vm.createContext(sandbox);
  vm.runInContext(js + tail, sandbox, { filename: "aqua-zero-heavens-arena.js" });
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
