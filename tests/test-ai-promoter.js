/* =====================================================================
   Aqua Zero Heavens Arena - Automated Verification: AI Promoter & Tokenomics
   Luminara Digital
   ===================================================================== */

const assert = require("assert");
const AIPromoter = require("../src/battle/ai-promoter.js");
const CreditLedger = require("../src/progress/credit-ledger.js");
const shop = require("../src/modes/shop.js");

console.log("▶ Running AI Promoter & Tokenomics Automated Verification...");

// 1. Test Contract Generation
{
  const c1 = AIPromoter.generateContract(0, 1, 1, 1, 1, false, "adventure");
  assert.strictEqual(c1.showMoney, 12, "Stage 1 show purse should be 12");
  assert.strictEqual(c1.winBonus, 28, "Stage 1 win bonus should be 28");
  assert.strictEqual(c1.finishBonus, 15, "Stage 1 finish bonus should be 15");
  assert.ok(c1.odds, "Contract should have odds generated");
  assert.ok(c1.odds.playerLine, "Should have player moneyline");

  const c5 = AIPromoter.generateContract(0, 1, 5, 5, 5, true, "ranked");
  assert.ok(c5.showMoney > c1.showMoney, "Stage 5 show money must scale above stage 1");
  assert.ok(c5.winBonus > c1.winBonus, "Stage 5 win bonus must scale above stage 1");
  assert.ok(c5.grudgeBonus > 0, "Nemesis grudge bonus must be positive");
  console.log("  ✓ Contract generation & stage scaling verified");
}

// 2. Test Vegas Odds Calculation
{
  const evenOdds = AIPromoter.calculateMatchOdds(0, 1, 5, 5);
  assert.strictEqual(typeof evenOdds.playerProb, "number");
  assert.strictEqual(typeof evenOdds.playerLine, "string");

  const underdogOdds = AIPromoter.calculateMatchOdds(0, 1, 1, 10);
  assert.ok(underdogOdds.isUnderdog, "Level 1 vs Level 10 should be underdog");
  assert.ok(underdogOdds.playerProb < 45, "Underdog prob should be under 45%");
  console.log("  ✓ Dynamic match odds engine verified");
}

// 3. Test MMA Pay & Deductions (Show, Win, Finish, POTN, FOTN)
{
  const contract = AIPromoter.generateContract(0, 1, 1, 1, 1, false, "adventure");

  // Case A: Simple Decision Loss
  const payLoss = AIPromoter.evaluateFightPay(contract, { win: false, turns: 8, dmgDealt: 30, dmgTaken: 50 }, {}, {});
  assert.strictEqual(payLoss.won, false);
  assert.strictEqual(payLoss.breakdown.show, 12);
  assert.strictEqual(payLoss.breakdown.win, 0);
  assert.strictEqual(payLoss.deductions.total, payLoss.deductions.campFee + payLoss.deductions.cornerFee);
  assert.strictEqual(payLoss.netPurse, payLoss.grossPurse - payLoss.deductions.total);
  assert.ok(payLoss.netPurse > 0, "Losing fighter still gets paid net show money");

  // Case B: Clinical Knockout (Finish + POTN)
  const payClinic = AIPromoter.evaluateFightPay(contract, { win: true, koClass: "STRIKE", turns: 4, dmgDealt: 80, dmgTaken: 0, perfect: true }, { tacticsGrade: "S", execGrade: "S" }, { grade: "S" });
  assert.strictEqual(payClinic.won, true);
  assert.strictEqual(payClinic.breakdown.finish, 15, "Finish bonus awarded");
  assert.strictEqual(payClinic.breakdown.potn, 35, "POTN bonus awarded for clinic");
  assert.ok(payClinic.eventTokens >= 1, "POTN awards at least 1 event token");
  assert.strictEqual(payClinic.netPurse, payClinic.grossPurse - payClinic.deductions.total);

  // Case C: Blood-and-Guts War (FOTN)
  const payWar = AIPromoter.evaluateFightPay(contract, { win: true, koClass: "SUB", turns: 9, dmgDealt: 70, dmgTaken: 65, minHpRatio: 0.15 }, {}, { grade: "B" });
  assert.strictEqual(payWar.won, true);
  assert.strictEqual(payWar.breakdown.fotn, 40, "FOTN bonus awarded for brutal war");
  assert.ok(payWar.eventTokens >= 1, "FOTN awards event tokens");
  console.log("  ✓ MMA Fight Pay (Show/Win/Finish/POTN/FOTN/Deductions) verified");
}

// 4. Test Multi-Currency Cryptographic Credit Ledger
{
  CreditLedger.init(100);
  const startBal = CreditLedger.getBalance();
  const startGlory = CreditLedger.getGlory();
  const startTokens = CreditLedger.getEventTokens();

  // Test Glory deposit/spend
  CreditLedger.depositGlory(50, "Rank Up");
  assert.strictEqual(CreditLedger.getGlory(), startGlory + 50);
  CreditLedger.spendGlory(20, "Avatar Unlock");
  assert.strictEqual(CreditLedger.getGlory(), startGlory + 30);

  // Test Event Tokens deposit/spend
  CreditLedger.depositEventTokens(5, "Fight Week Objective");
  assert.strictEqual(CreditLedger.getEventTokens(), startTokens + 5);

  // Test Contract Settlement
  const mockPayout = {
    grossPurse: 100,
    netPurse: 80,
    deductions: { campFee: 10, cornerFee: 10, total: 20 },
    breakdown: { show: 15, win: 35, finish: 15, potn: 35 },
    eventTokens: 2,
    contractId: "CTR_TEST_01"
  };

  const settleRes = CreditLedger.settleFightContract(mockPayout);
  assert.strictEqual(settleRes.ok, true);
  assert.strictEqual(CreditLedger.getBalance(), startBal + 80);
  assert.strictEqual(CreditLedger.getEventTokens(), startTokens + 7);

  // Test Store Redemption
  const mockItem = { id: "ITEM_SPECIAL_GI", name: "Special Gi", costTokens: 3, costGlory: 25 };
  const redeemRes = CreditLedger.redeemStoreItem(mockItem, "TOKENS");
  assert.strictEqual(redeemRes.ok, true);
  assert.strictEqual(CreditLedger.getEventTokens(), startTokens + 4);
  assert.ok(CreditLedger.getInventory().includes("ITEM_SPECIAL_GI"));

  // Prevent duplicate purchase
  const dupRes = CreditLedger.redeemStoreItem(mockItem, "TOKENS");
  assert.strictEqual(dupRes.ok, false);

  // Verify cryptographic hash chain integrity
  const integrity = CreditLedger.verifyIntegrity();
  assert.strictEqual(integrity.valid, true, "Cryptographic hash chain must be unbroken");
  console.log("  ✓ Multi-currency CreditLedger (Purse, Glory, Tokens, Merkle-chain) verified");
}

console.log("✅ ALL AI PROMOTER & TOKENOMICS VERIFICATION CHECKS PASSED!");
