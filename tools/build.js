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
  "/* Fighter dossiers - UFC Undisputed 3 style. `a` is the 18 attributes in ATTR_KEYS order. */\n" +
  stripKeys(fs.readFileSync(SP + "bios.txt", "utf8").trim(), "const BIOS=");
const art = stripKeys(fs.readFileSync(SP + "art.txt", "utf8").trim(), "const ART=");

const SRC=require("path").resolve(__dirname,"..","src")+"/";
const MODULE_ORDER=["data/roster-tune.js","data/disciplines.js","data/matchups.js","data/techniques.js",
  "battle/effects.js","battle/order.js","battle/resolve.js","battle/position.js","battle/sequence.js","battle/intent.js","battle/ai.js",
  "data/benefits.js","data/archetypes.js","progress/mastery.js","data/challenges.js","modes/daily.js","data/stories.js","ui/anim.js","progress/growth.js","progress/draft.js","modes/shop.js","progress/ranking/rank-table.js",
  "progress/ranking/ranking-service.js","progress/ranking/ranking-store.js",
  "progress/save-backup.js","progress/cloud-save.js","progress/ton-connect.js",
  // the presentation layer loads last: it reads the fight, the fight never reads it
  "ui/music.js","ui/matchup.js","ui/entrance.js","ui/results.js","modes/attract.js",
  "ui/venue.js","ui/spectacle.js","ui/map-skin.js"];
const modules = MODULE_ORDER
  .map((m) => "/* ---- src/" + m + " ---- */\n" + fs.readFileSync(SRC + m, "utf8"))
  .join("\n");
t = t.replace("__MODULES__", () => modules);
t = t.replace("__ROMDATA__", () => rom).replace("__BIOS__", () => bios).replace("__ART__", () => art);
t = t.replace(/__CLOUD_CONFIG__/g, () => JSON.stringify(cloudConfigForBuild()));
t = t.replace(/__TON_CONFIG__/g, () => JSON.stringify(tonConfigForBuild()));

// keep non-ASCII out of the source the way the original did, so the page is charset-proof
t = t.replace(/[^\x00-\x7F]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));

if (/__[A-Z]+__/.test(t)) throw new Error("unreplaced placeholder");

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
