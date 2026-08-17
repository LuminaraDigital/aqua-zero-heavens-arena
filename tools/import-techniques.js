#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - technique importer
   Luminara Digital

   Converts technique lines extracted from the training library
   (name|discipline|class|range|power1-10|notes) into T() entries and
   appends them to src/data/techniques.js under a marked section.
   Re-running replaces the section, so the import is idempotent.

   Stats derive from the book's own 1-10 danger rating:
     game power  = 8 + p*4          (a 2 is a jab, a 9 is a fight-ender)
     accuracy    = 100 - p*3.5      (the deadlier, the harder to land)
     speed       = 94 - p*4         (big weapons are slow)
     stamina     = 3 + p*1.2        (big weapons cost air)
     learn level = clamp(1..9, p)   (elite techniques come late)

   Effects come from the notes: cuts bleed, chokes wind, leg attacks
   break the base, locks ruin arms, sweeps unbalance, pins pin.

   Usage: node tools/import-techniques.js <extracted-dir>
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const DIR = process.argv[2];
if (!DIR) { console.error("usage: node tools/import-techniques.js <dir-of-pipe-files>"); process.exit(1); }
const DEX = path.resolve(__dirname, "..", "src", "data", "techniques.js");
const MARK_A = "/* ==== imported from the training library - do not edit by hand, re-run tools/import-techniques.js ==== */";
const MARK_B = "/* ==== end imported ==== */";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KNOWN_DISC = ["boxing","kickboxing","muaythai","lethwei","taekwondo","shotokan","kyokushin","kenpo","wushu","sumo","judo","wrestling","grappling","sambo","bjj","jiujitsu","subgrap","mma","draka"];

function idOf(name) {
  return name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 26);
}
function effOf(cls, notes, p) {
  const s = notes.toLowerCase();
  const ch = clamp(20 + p * 4, 20, 65);
  if (/cut|bleed|elbow tip|slice|brow/.test(s)) return { st: "BLEEDING", ch };
  if (/chok|strangl|neck under|gullet|throat/.test(s)) return { st: "WINDED", ch: clamp(ch + 10, 30, 70) };
  if (/leg|thigh|calf|knee(bar)?|achilles|ankle|heel hook/.test(s) && (cls === "SUB" || /lock|bar|jam|twist/.test(s)))
    return { st: "LEG_HURT", ch: clamp(ch + 10, 30, 70) };
  if (/arm|shoulder|wrist|elbow lever|kimura|americana|hammerlock|keylock/.test(s) && cls === "SUB")
    return { st: "ARM_HURT", ch: clamp(ch + 10, 30, 70) };
  if (/pin|shoulders to( the)? mat|flatten|cradle|nelson|ride|scissors|hold/.test(s) && cls === "SETUP")
    return { st: "PINNED", ch: clamp(ch, 25, 60) };
  if (/sweep|trip|topple|off-balanc|balance|fell|dump/.test(s)) return { st: "OFF_BALANCE", ch: clamp(ch + 5, 30, 65) };
  if (/chin|jaw|head|temple|skull|knockout|stun/.test(s) && cls === "STRIKE" && p >= 5) return { st: "STUNNED", ch: clamp(p * 4, 16, 40) };
  if (/liver|body|ribs|midsection|solar plexus|belly|winds?/.test(s) && cls === "STRIKE") return { st: "WINDED", ch: clamp(ch - 5, 18, 45) };
  if (/hold|tie|clinch|control|grip|trap/.test(s) && cls === "SETUP") return { st: "HELD", ch: clamp(ch, 25, 60) };
  return null;
}
function movesOf(cls, range, notes) {
  const s = notes.toLowerCase();
  if (cls === "THROW" && range !== "GROUND" && /take ?down|throw|dump|mat|topple|drops?|fell|suplex|trip|sweep|slam|scissors/.test(s)) return "GROUND";
  if (cls === "THROW" && range === "GROUND") return null;             // ground sweeps stay grounded
  if (/push|shove|force.*out|away|stops? advance/.test(s)) return "LONG";
  if (/back to (the )?feet|to standing|stand/.test(s)) return "MID";
  if (/clinch entry|plum|tie-up|collar/.test(s) && cls === "SETUP") return "CLINCH";
  return null;
}
function prioOf(cls, p, notes) {
  if (cls === "GUARD") return 2;
  if (/sprawl/.test(notes.toLowerCase())) return 3;
  if (p <= 2 && cls === "STRIKE") return 1;
  if (/counter|intercept|jam|stop/.test(notes.toLowerCase())) return 1;
  return 0;
}

/* ---- read every pipe file ---- */
const rows = [];
for (const f of fs.readdirSync(DIR)) {
  if (!/\.txt$/.test(f)) continue;
  for (const line of fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/)) {
    const parts = line.split("|");
    if (parts.length < 6) continue;
    const [name, disc, cls, range, pow, ...noteBits] = parts;
    if (!KNOWN_DISC.includes(disc.trim())) continue;
    if (!["STRIKE", "THROW", "SUB", "GUARD", "SETUP"].includes(cls.trim())) continue;
    if (!["LONG", "MID", "CLINCH", "GROUND"].includes(range.trim())) continue;
    rows.push({ name: name.trim(), disc: disc.trim(), cls: cls.trim(), range: range.trim(),
                p: clamp(+pow || 3, 1, 10), notes: noteBits.join("|").trim() });
  }
}

/* ---- dedupe against the hand-authored dex and within the import ---- */
const dex = fs.readFileSync(DEX, "utf8");
const existingIds = new Set([...dex.matchAll(/^T\("([^"]+)"/gm)].map((m) => m[1]));
const existingNames = new Set([...dex.matchAll(/^T\("[^"]+",\s*"([^"]+)"/gm)].map((m) => m[1].toLowerCase()));
const seen = new Set();
const out = [];
for (const r of rows) {
  let id = idOf(r.name);
  const plain = r.name.toLowerCase().replace(/\s*\(.*\)\s*/g, "").trim();
  if (existingNames.has(r.name.toLowerCase()) || existingNames.has(plain)) continue;
  if (seen.has(id) || existingIds.has(id)) {
    id = (id + "_" + r.disc).slice(0, 30);
    if (seen.has(id) || existingIds.has(id)) continue;
  }
  seen.add(id);
  const p = r.p;
  const power = r.cls === "GUARD" ? 0 : r.cls === "SETUP" ? clamp(p * 2, 0, 12) : 8 + p * 4;
  const acc = Math.round(r.cls === "GUARD" ? 100 : 100 - p * 3.5);
  const spd = Math.round(clamp(94 - p * 4, 56, 96));
  const stam = r.cls === "GUARD" ? 0 : Math.round(3 + p * 1.2);
  const learn = clamp(Math.round(p), 1, 9);
  const opts = {};
  const prio = prioOf(r.cls, p, r.notes); if (prio) opts.prio = prio;
  const moves = movesOf(r.cls, r.range, r.notes); if (moves) opts.moves = moves;
  const eff = effOf(r.cls, r.notes, p); if (eff) opts.eff = eff;
  const flags = [];
  if (/jump|leap|flying|airborne/.test(r.notes.toLowerCase()) || /twio|jump|flying/i.test(r.name)) flags.push("jump");
  if (/spin|turning|whip/i.test(r.name + r.notes)) flags.push("spin");
  if (p >= 8 && r.cls === "STRIKE") flags.push("power");
  if (p >= 8 && r.cls !== "GUARD") flags.push("elite");
  if (/launcher|uppercut under|hoisted|launch|overhead/.test(r.notes.toLowerCase())) flags.push("launcher");
  if (/sweep/i.test(r.name + r.notes) && r.cls === "THROW") flags.push("sweep");
  if (/choke|strangl/i.test(r.name + r.notes)) flags.push("choke");
  if (/escape|back to guard|reverses|free of/.test(r.notes.toLowerCase())) flags.push("escape");
  if (flags.length) opts.flags = flags;
  const o = JSON.stringify(opts).replace(/"([a-z]+)":/g, "$1: ").replace(/,/g, ", ").replace(/\{ ?/, "{ ").replace(/\}$/, " }");
  out.push('T(' + JSON.stringify(id) + ', ' + JSON.stringify(r.name) + ', ' + JSON.stringify(r.disc) + ', "' + r.cls +
    '", "' + r.range + '", ' + power + ', ' + acc + ', ' + spd + ', ' + stam + ', ' + learn + ', ' +
    (Object.keys(opts).length ? o : "{}") + ');   // ' + r.notes);
}

/* ---- splice into the dex under the import marker ---- */
let base = dex;
const a = base.indexOf(MARK_A);
if (a >= 0) {
  const b = base.indexOf(MARK_B);
  if (b < 0) throw new Error("import start marker without end marker");
  base = base.slice(0, a) + base.slice(b + MARK_B.length + 1);
}
const anchor = "const TECH_IDS = Object.keys(TECH);";
if (!base.includes(anchor)) throw new Error("anchor not found in techniques.js");
base = base.replace(anchor, MARK_A + "\n" + out.join("\n") + "\n" + MARK_B + "\n\n" + anchor);
fs.writeFileSync(DEX, base);
console.log("imported " + out.length + " techniques (" + rows.length + " read, " + (rows.length - out.length) + " duplicates or rejects)");
