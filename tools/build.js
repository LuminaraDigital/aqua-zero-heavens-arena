const fs = require("fs");
const path = require("path");
const PROJ = path.resolve(__dirname, "..") + "/";
const SP = PROJ + "assets/rom/";

function loadEnvFile() {
  const envPath = path.join(PROJ, ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const s = line.trim();
    if (!s || s.charAt(0) === "#") return;
    const eq = s.indexOf("=");
    if (eq <= 0) return;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
      (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}
loadEnvFile();

function cloudConfigForBuild() {
  return {
    url: String(process.env.AZHA_SUPABASE_URL || ""),
    anonKey: String(process.env.AZHA_SUPABASE_ANON_KEY || ""),
  };
}

function tonConfigForBuild() {
  return {
    manifestUrl: String(process.env.AZHA_TON_MANIFEST_URL || ""),
  };
}

let t = fs.readFileSync(path.resolve(__dirname, "..", "src", "page.template.html"), "utf8");
const rom = fs.readFileSync(SP + "romdata.js", "utf8").trim();
// Solifer was a non-human design and is off the roster - drop the dossier and
// the artwork with it so nothing ships that the game no longer references.
const CUT = ["Solifer"];
function stripKeys(line, prefix) {
  const obj = JSON.parse(line.slice(prefix.length, line.lastIndexOf(";")));
  CUT.forEach((k) => { if (!(k in obj)) throw new Error("cannot cut missing key: " + k); delete obj[k]; });
  return prefix + JSON.stringify(obj) + ";";
}
const bios =
  "/* Fighter dossiers. `a` is the 18 attributes in ATTR_KEYS order. */\n" +
  stripKeys(fs.readFileSync(SP + "bios.txt", "utf8").trim(), "const BIOS=");
const art = stripKeys(fs.readFileSync(SP + "art.txt", "utf8").trim(), "const ART=");

const SRC=require("path").resolve(__dirname,"..","src")+"/";
const MODULE_ORDER=["data/roster-tune.js","data/disciplines.js","data/matchups.js","data/techniques.js","data/i18n.js",
  "battle/style-meter.js","battle/resonance.js",
  "battle/effects.js","battle/order.js","battle/control.js","battle/resolve.js","battle/position.js","battle/sequence.js","battle/intent.js","battle/ai.js",
  "battle/ai-adaptive.js","battle/ai-coach.js","battle/ai-commentary.js","battle/ai-promoter.js",
  "data/benefits.js","data/relics.js","data/camp-focus.js","data/style-traits.js","data/archetypes.js","progress/mastery.js",
  /* the two permanent progression axes sit beside mastery: meta.js reads no
     other module at all, and discipline-mastery.js only touches DISCIPLINES /
     TECH from inside function bodies, so both are load-order-insensitive. */
  "progress/career-arcs.js","progress/rivalry-heat.js","progress/meta.js","progress/discipline-mastery.js","progress/infusions.js","progress/codex.js",
  "data/challenges.js","modes/challenge-run.js","modes/daily.js","modes/tower.js","modes/dojo.js","modes/endless-gauntlet.js","modes/weekly-mutator.js","modes/wagers.js","modes/exhibition.js","data/stories.js","data/narrative-events.js","ui/anim.js","progress/growth.js","progress/draft.js","progress/create-fighter.js","progress/deck-builder.js","modes/shop.js",  "progress/ranking/rank-table.js",
  "progress/ranking/ranking-service.js","progress/ranking/belt-tests.js","progress/ranking/ranking-store.js",
  "progress/save-backup.js","progress/cloud-save.js",
  /* the daily board rides on the daily's seed and on cloud-save's config and
     fetch helpers, so it loads after both of them */
  "progress/leaderboard.js",
  "progress/credit-ledger.js","progress/ton-connect.js","progress/ton-onchain.js","progress/p2p-webrtc.js","progress/replays.js","progress/ghost-battles.js",
  // the presentation layer loads last: it reads the fight, the fight never reads it
  "ui/music.js","ui/sfx.js","ui/combat-fx.js","ui/floating-feedback.js","ui/card-renderer.js","ui/card-tooltip.js","ui/stat-radar.js","ui/settings-gui.js","ui/matchup.js","ui/entrance.js","ui/results.js","modes/attract.js",
  "ui/onboarding.js","ui/venue.js","ui/spectacle.js","ui/map-skin.js","ui/replay-viewer.js","ui/codex-viewer.js","ui/trophy-room.js","ui/virtual-gamepad.js","ui/keybindings.js","ui/interactive-3d-bg.js",
  "ui/venue-3d.js","ui/card-3d.js","ui/combat-fx-3d.js","ui/trophy-3d.js","ui/three-engine.js"];
/* ---------------------------------------------------------------------
   SHELVED - docs/IMPLEMENTATION_PLAN.md item E.

   A CEO review found these three have zero in-game callers: no menu, no
   fight hook, no telemetry feeds them, and a player cannot reach any of
   them by playing. Three of the seven "untested modules" were unreachable
   content. The plan's rule is subtract, then verify, so they come out of
   the shipped page. The files stay, their suites stay and still run (the
   test harness loads them beside the page - see tests/harness.js), and
   `AZHA_SHELVED=0 npm run build` puts them back. Wiring them is a Phase 4
   feature, not a fix; this is not a judgement on the code.

   Verified before removal: nothing else in src/ names scoreRound,
   scoreRoundAllJudges, evaluateDecision, cornerUrgencyPrompt, JUDGES,
   CORNER_ACTIONS, CORNER_ACTION_IDS, getCornerStatus, applyCornerAction,
   checkDoctorStoppage, WEIGHT_CUT_PROFILES, WEIGHT_CUT_IDS,
   getWeightCutProfile or applyWeightCut. The three hooks weight-cut writes
   (weightPowerBonus, weightCardioMod, weightChinMod) are READ by
   resolve.js and order.js, which is harmless the other way round: with the
   module gone nothing sets them, so those branches simply never fire.
   --------------------------------------------------------------------- */
const SHELVED_MODULES = ["battle/judging.js", "battle/corner-protocol.js", "progress/weight-cut.js"];
const shelvedOff = /^(0|off|false|no)$/i.test(String(process.env.AZHA_SHELVED || ""));
const buildOrder = shelvedOff ? MODULE_ORDER.concat(SHELVED_MODULES) : MODULE_ORDER;
if (shelvedOff) console.log("AZHA_SHELVED=0: including " + SHELVED_MODULES.length + " shelved modules");

const modules = buildOrder
  .map((m) => "/* ---- src/" + m + " ---- */\n" + fs.readFileSync(SRC + m, "utf8"))
  .join("\n");
t = t.replace("__MODULES__", () => modules);
t = t.replace("__ROMDATA__", () => rom).replace("__BIOS__", () => bios).replace("__ART__", () => art);
t = t.replace(/__CLOUD_CONFIG__/g, () => JSON.stringify(cloudConfigForBuild()));
t = t.replace(/__TON_CONFIG__/g, () => JSON.stringify(tonConfigForBuild()));
/* Plan C3: the same AZHA_SHELVED that restores the shelved battle modules
   above also restores the launch rows and infra rows that belong with them,
   so one flag un-shelves the whole feature set. Baked as a bare boolean
   literal, not JSON, so the page reads like the code it gates. */
t = t.replace(/__SHELVED_MODES__/g, () => (shelvedOff ? "true" : "false"));

/* [A-Z]+ cannot match an underscore, so the multi-word placeholders
   (__CLOUD_CONFIG__, __TON_CONFIG__, __SHELVED_MODES__) were never actually
   covered by this guard; [A-Z_]+ closes that hole for all of them at once. */
if (/__[A-Z][A-Z_]*__/.test(t)) throw new Error("unreplaced placeholder");

const VENDOR_FILE = PROJ + "assets/vendor/three.min.js";
const vendorJs = fs.existsSync(VENDOR_FILE) ? "/* ---- assets/vendor/three.min.js ---- */\n" + fs.readFileSync(VENDOR_FILE, "utf8").trim() + "\n" : "";
t = t.replace("<script>", () => "<script>\n" + vendorJs);

// keep non-ASCII out of the source the way the original did, so the page is charset-proof
t = t.replace(/[^\x00-\x7F]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));

// carry an already-embedded brand logo across rebuilds
const OUT = PROJ + "aqua-zero-heavens-arena.html";
if (fs.existsSync(OUT)) {
  const prevPage = fs.readFileSync(OUT, "utf8");
  const prev = prevPage.match(/^const LOGO_SRC=("[^"]*");$/m);
  const prevArena = prevPage.match(/^const ARENA_SRC=("[^"]*");$/m);
  if (prevArena && prevArena[1].length > 4) {
    t = t.replace(/^const ARENA_SRC=.*;$/m, () => "const ARENA_SRC=" + prevArena[1] + ";");
    console.log("carried over arena (" + Math.round(prevArena[1].length / 1024) + " KB)");
  }
  if (prev && prev[1].length > 4) {
    t = t.replace(/^const LOGO_SRC=.*;$/m, () => "const LOGO_SRC=" + prev[1] + ";");
    console.log("carried over embedded logo (" + Math.round(prev[1].length / 1024) + " KB)");
  }
}
fs.writeFileSync(OUT, t);

const js = t.slice(t.indexOf("<script>") + 8, t.lastIndexOf("</script>"));
if (!fs.existsSync(PROJ + ".build")) fs.mkdirSync(PROJ + ".build");
fs.writeFileSync(PROJ + ".build/check.js", js);
console.log("written", t.length, "bytes; script", js.length);
