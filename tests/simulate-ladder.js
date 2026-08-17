#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - ladder simulation
   Luminara Digital

     node tests/simulate-ladder.js            # 100 matches, two fighters
     node tests/simulate-ladder.js 300        # longer run
     node tests/simulate-ladder.js --table    # print the whole rank table
     node tests/simulate-ladder.js --gaps     # point exchange at every gap

   Shows how two fighters' grades move against each other, then how long a
   climb from Beginner to 10th Dan actually takes at a given win rate.
   ===================================================================== */
"use strict";
const boot = require("./harness");
const h = boot({ quiet: true });
const A = h.api;

const args = process.argv.slice(2);
const N = parseInt(args.find((a) => /^\d+$/.test(a)) || "100", 10);
const pad = (s, n) => String(s).padEnd(n);
const bar = (v, w) => "#".repeat(Math.round(v * w)) + ".".repeat(w - Math.round(v * w));

function rankOf(svc, id) { return A.getRankForPoints(svc.get(id).promotionPoints); }

if (args.includes("--table")) {
  console.log("\nRANK TABLE\n");
  console.log(pad("IDX", 5) + pad("TYPE", 10) + pad("GRADE", 7) + pad("TITLE", 12) + pad("DIVISION", 11) + "POINTS");
  A.RANK_TABLE.forEach((r) => {
    console.log(pad(r.index, 5) + pad(r.type, 10) + pad(r.grade, 7) + pad(r.title, 12) +
      pad(A.DIVISION[r.division].name, 11) + r.threshold);
  });
  process.exit(0);
}

if (args.includes("--gaps")) {
  console.log("\nPOINT EXCHANGE BY RANK GAP (ranked match)\n");
  console.log(pad("GAP", 6) + pad("EXPECTED WIN", 16) + pad("UPSET WIN", 14) + "LOSER DROPS (expected)");
  for (let gap = 0; gap <= 4; gap++) {
    const hi = A.rankByIndex(10 + gap), lo = A.rankByIndex(10);
    const expected = A.calculatePointsExchange(hi, lo, "ranked");
    const upset = A.calculatePointsExchange(lo, hi, "ranked");
    console.log(pad(gap, 6) + pad("+" + expected.winnerGain, 16) + pad("+" + upset.winnerGain, 14) +
      "-" + expected.loserLoss);
  }
  process.exit(0);
}

/* ---------------- two fighters, N matches ---------------- */
console.log("\n=== TWO FIGHTERS, " + N + " MATCHES ===\n");
console.log("Ryu wins 62% of the time. Kenji starts three grades above him,");
console.log("so early wins are worth a lot to Ryu and almost nothing to Kenji.\n");
{
  const store = A.makeMemoryStore();
  let clock = 0;
  const svc = A.RankingService(store, () => ++clock);

  const kenji = A.newPlayerRanking("kenji");
  kenji.promotionPoints = A.RANK_TABLE[8].threshold;      // 3rd Kyu
  kenji.peakRankIndex = 8;
  store.put("kenji", kenji);
  store.put("ryu", A.newPlayerRanking("ryu"));            // Beginner

  console.log(pad("MATCH", 7) + pad("WINNER", 8) + pad("RYU", 22) + pad("KENJI", 22) + "EXCHANGE");
  let ryuWins = 0;
  for (let i = 1; i <= N; i++) {
    const ryuWon = Math.random() < 0.62;
    if (ryuWon) ryuWins++;
    const before = { r: rankOf(svc, "ryu"), k: rankOf(svc, "kenji") };
    const res = svc.applyMatchResult(ryuWon ? "ryu" : "kenji", ryuWon ? "kenji" : "ryu", { matchType: "ranked" });
    const after = { r: rankOf(svc, "ryu"), k: rankOf(svc, "kenji") };
    const moved = after.r.index !== before.r.index || after.k.index !== before.k.index;
    if (i <= 12 || moved || i % 20 === 0 || i === N) {
      const rp = svc.get("ryu").promotionPoints.toFixed(2), kp = svc.get("kenji").promotionPoints.toFixed(2);
      console.log(pad(i, 7) + pad(ryuWon ? "Ryu" : "Kenji", 8) +
        pad(after.r.title + " (" + rp + ")" + (after.r.index > before.r.index ? "  UP" : ""), 22) +
        pad(after.k.title + " (" + kp + ")" + (after.k.index < before.k.index ? "  DOWN" : ""), 22) +
        "+" + res.exchange.winnerGain + " / -" + res.exchange.loserLoss + (res.exchange.upset ? "  UPSET" : ""));
    }
  }
  const r = svc.get("ryu"), k = svc.get("kenji");
  console.log("\nRyu   " + rankOf(svc, "ryu").title + "   " + r.promotionPoints.toFixed(2) + " pts   " +
    r.wins + "W " + r.losses + "L   " + bar(A.rankProgress(r.promotionPoints), 20));
  console.log("Kenji " + rankOf(svc, "kenji").title + "   " + k.promotionPoints.toFixed(2) + " pts   " +
    k.wins + "W " + k.losses + "L   " + bar(A.rankProgress(k.promotionPoints), 20));
  console.log("\nRyu won " + ryuWins + "/" + N + " (" + Math.round((100 * ryuWins) / N) + "%)");
}

/* ---------------- how long is the climb? ---------------- */
console.log("\n\n=== CLIMB TO 10TH DAN, MATCHED AGAINST YOUR OWN GRADE ===\n");
console.log(pad("WIN RATE", 10) + pad("MATCHES", 10) + "FINAL GRADE");
[0.5, 0.55, 0.6, 0.7, 0.85].forEach((wr) => {
  const store = A.makeMemoryStore();
  let clock = 0;
  const svc = A.RankingService(store, () => ++clock);
  store.put("hero", A.newPlayerRanking("hero"));
  let matches = 0;
  const CAP = 20000;
  while (matches < CAP) {
    const hi = rankOf(svc, "hero").index;
    if (hi >= A.MAX_RANK_INDEX) break;
    // the matchmaker hands you a fresh opponent at your own grade every time,
    // exactly as the game does - grades are assigned per match, not ground down
    const oppId = "grade" + hi;
    const o = store.get(oppId) || A.newPlayerRanking(oppId);
    o.promotionPoints = A.RANK_TABLE[hi].threshold;
    o.peakRankIndex = hi;
    store.put(oppId, o);
    const win = Math.random() < wr;
    svc.applyMatchResult(win ? "hero" : oppId, win ? oppId : "hero", { matchType: "ranked" });
    matches++;
  }
  const final = rankOf(svc, "hero");
  console.log(pad(Math.round(wr * 100) + "%", 10) + pad(matches >= CAP ? ">" + CAP : matches, 10) + final.title);
});

/* ---------------- what the grades feel like ---------------- */
console.log("\n\n=== DIVISIONS ===\n");
A.RANK_DIVISIONS.forEach((div) => {
  const inDiv = A.RANK_TABLE.filter((r) => r.division === div.id);
  if (!inDiv.length) return;
  console.log(pad(div.name, 11) + pad(inDiv[0].title + (inDiv.length > 1 ? " - " + inDiv[inDiv.length - 1].title : ""), 26) +
    inDiv[0].threshold + " pts+");
});
console.log("");
