#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - fight-data build tool
   Luminara Digital

   The roster's card data lives in one binary, as a flat run of fixed-size
   records starting at 0xF3F10:

       bytes  0..59   15 cards x 4 bytes  [power, type, flags, reserved]
       bytes 60..74   15 growth-order slots (which card is learned when)

   There are exactly 21 records. The run ends at 0xF4537, which is where
   the champion's 5-card sealed record begins - the two are back to back, and
   that adjacency is what pins the record count down.

   Usage:
     node tools/build-card-data.js                # readable dump
     node tools/build-card-data.js --json         # emit DECKS/ORDER/BOSS as JS
     node tools/build-card-data.js --check FILE   # verify FILE's embedded arrays
     node tools/build-card-data.js --bin PATH     # point at a different binary
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const CARD_BASE = 0xf3f10;
const REC_BYTES = 75;
const CARDS_PER = 15;
const BOSS_BASE = 0xf4537;
const BOSS_CARDS = 5;

const F = { GUARD: 0x01, EVADE: 0x02, PARRY: 0x04, LOW: 0x08, MID: 0x10, HIGH: 0x20, CTR: 0x40, UNBLK: 0x80 };

function argOf(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function findBinary(dir) {
  const explicit = argOf("--bin", argOf("--rom", null));
  if (explicit) return explicit;
  const preferred = path.join(dir, "fight-data.ws");
  if (fs.existsSync(preferred)) return preferred;
  const hit = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".ws"));
  if (!hit) throw new Error("no fight-data binary found in " + dir + " (pass --bin PATH)");
  return path.join(dir, hit);
}

function readRecord(bin, i) {
  const o = CARD_BASE + i * REC_BYTES;
  const cards = [];
  for (let c = 0; c < CARDS_PER; c++) cards.push([bin[o + c * 4], bin[o + c * 4 + 1], bin[o + c * 4 + 2], bin[o + c * 4 + 3]]);
  const order = [];
  for (let c = 0; c < CARDS_PER; c++) order.push(bin[o + 60 + c]);
  return { addr: o, cards, order };
}

/* A record is well-formed when slot 0 is a guard (power 0), the growth order
   is a permutation of 0..14, and the last three slots are the ascending
   air-combo tiers. The first record that fails all of that is past the end. */
function looksValid(r) {
  const permOK = [...r.order].sort((a, b) => a - b).join() === [...Array(CARDS_PER).keys()].join();
  const airOK = r.cards[12][0] > 0 && r.cards[13][0] > r.cards[12][0] && r.cards[14][0] > r.cards[13][0];
  return r.cards[0][0] === 0 && permOK && airOK;
}

function extract(binPath) {
  const bin = fs.readFileSync(binPath);
  const decks = [], orders = [];
  for (let i = 0; i < 64; i++) {
    const r = readRecord(bin, i);
    if (!looksValid(r)) break;
    decks.push(r.cards);
    orders.push(r.order);
  }
  const boss = [];
  for (let c = 0; c < BOSS_CARDS; c++)
    boss.push([bin[BOSS_BASE + c * 4], bin[BOSS_BASE + c * 4 + 1], bin[BOSS_BASE + c * 4 + 2], bin[BOSS_BASE + c * 4 + 3]]);
  return { bin, binPath, decks, orders, boss, endAddr: CARD_BASE + decks.length * REC_BYTES };
}

function kindOf(c) { return c[0] === 0 ? "GUARD" : c[1] === 1 ? "THROW" : "STRIKE"; }
function flagsOf(c) {
  const out = [];
  for (const k in F) if (c[2] & F[k]) out.push(k);
  return out.join("|") || "-";
}

function dump(x) {
  console.log("source binary  : " + path.basename(x.binPath) + " (" + x.bin.length.toLocaleString() + " bytes)");
  console.log("record run     : 0x" + CARD_BASE.toString(16).toUpperCase() + " .. 0x" + x.endAddr.toString(16).toUpperCase());
  console.log("records        : " + x.decks.length + " x " + REC_BYTES + " bytes");
  console.log("sealed record  : 0x" + BOSS_BASE.toString(16).toUpperCase() + " (" + x.boss.length + " cards)");
  console.log("run abuts the sealed record: " + (x.endAddr === BOSS_BASE ? "yes" : "NO - record count is suspect"));
  console.log("");
  x.decks.forEach((d, i) => {
    const top = Math.max(...d.slice(0, 12).map((c) => c[0]));
    console.log("-- deck " + String(i).padStart(2, "0") + "  offset +" + i * REC_BYTES +
      "  top " + top + "  air " + d.slice(12).map((c) => c[0]).join("/"));
    d.forEach((c, j) => {
      const label = j >= 12 ? "AIR TIER " + (j - 11) : kindOf(c) + (c[0] > 0 && c[1] >= 4 ? " / LAUNCHER" : "");
      const gained = j >= 12 ? "-" : (x.orders[i].indexOf(j) < 5 ? "START" : "LV " + (x.orders[i].indexOf(j) - 3));
      console.log(
        "   " + String(j).padStart(2) + "  pow " + String(c[0]).padStart(3) + "  type " + String(c[1]).padStart(3) +
        "  flags 0x" + c[2].toString(16).toUpperCase().padStart(2, "0") + " " + flagsOf(c).padEnd(20) +
        label.padEnd(20) + gained
      );
    });
  });
  console.log("");
  console.log("-- sealed record (champion)");
  x.boss.forEach((c, j) =>
    console.log("   " + String(j).padStart(2) + "  pow " + String(c[0]).padStart(3) + "  type " + String(c[1]).padStart(3) +
      "  flags 0x" + c[2].toString(16).toUpperCase().padStart(2, "0") + " " + flagsOf(c)));
}

function asJs(x) {
  return (
    "const DECKS=" + JSON.stringify(x.decks) + ";\n" +
    "const ORDER=" + JSON.stringify(x.orders) + ";\n" +
    "const BOSS=" + JSON.stringify(x.boss) + ";\n"
  );
}

/* --check: pull the three arrays out of the page and compare byte for byte. */
function check(x, file) {
  const src = fs.readFileSync(file, "utf8");
  const grab = (name) => {
    const m = src.match(new RegExp("const " + name + "=(\\[.*?\\]);\\r?\\n"));
    if (!m) throw new Error("could not find `const " + name + "=` in " + file);
    return JSON.parse(m[1]);
  };
  let bad = 0;
  const cmp = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log((ok ? "  OK   " : "  FAIL ") + name + "  (" + want.length + " records)");
    if (!ok) bad++;
  };
  console.log("checking " + path.basename(file) + " against " + path.basename(x.binPath));
  cmp("DECKS", grab("DECKS"), x.decks);
  cmp("ORDER", grab("ORDER"), x.orders);
  cmp("BOSS", grab("BOSS"), x.boss);
  if (bad) { console.error("\n" + bad + " array(s) do not match the source binary."); process.exitCode = 1; }
  else console.log("\nall card data in the page is byte-identical to the source binary.");
}

function main() {
  const here = path.resolve(__dirname, "..");
  const x = extract(findBinary(here));
  const checkFile = argOf("--check", null);
  if (checkFile) check(x, path.resolve(checkFile));
  else if (process.argv.includes("--json")) process.stdout.write(asJs(x));
  else dump(x);
}
main();
