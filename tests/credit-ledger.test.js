/* =====================================================================
   Aqua Zero Heavens Arena - In-House Credit Ledger Test Suite
   Luminara Digital
   ===================================================================== */

module.exports = function (h) {
  const { api, ok, section } = h;

  section("In-House Credit Ledger & Virtual Tokenomics");

  const cl = (api && api.CreditLedger) || (typeof global !== "undefined" && global.CreditLedger) || require("../src/progress/credit-ledger");
  ok(cl !== null && typeof cl === "object", "CreditLedger object should be defined");

  cl.init(500);
  ok(cl.getBalance() === 500, "initial balance set to 500");
  ok(cl.getEscrow() === 0, "initial escrow is 0");
  ok(cl.getAvailable() === 500, "initial available credits is 500");

  // Test Deposit
  const depRes = cl.deposit(150, "Fight Win Purse");
  ok(depRes.ok === true, "deposit 150 succeeds");
  ok(cl.getBalance() === 650, "balance updated to 650 after deposit");

  // Test Withdrawal
  const withRes = cl.withdraw(50, "Gym Purchase");
  ok(withRes.ok === true, "withdraw 50 succeeds");
  ok(cl.getBalance() === 600, "balance updated to 600 after withdrawal");

  // Test Over-withdrawal rejected
  const overWith = cl.withdraw(9999, "Greedy Buy");
  ok(overWith.ok === false, "over-withdrawal is rejected");
  ok(cl.getBalance() === 600, "balance unchanged after failed withdrawal");

  // Test Escrow Lock
  const lockRes = cl.lockEscrow("wager_bout_01", 100, { fight: "Nemesis Rematch" });
  ok(lockRes.ok === true, "escrow lock 100 succeeds");
  ok(cl.getEscrow() === 100, "escrow locked is 100");
  ok(cl.getAvailable() === 500, "available balance reduced to 500 during escrow");

  // Test Escrow Settle (Win with 2.0x multiplier)
  const settleWin = cl.settleEscrow("wager_bout_01", true, 2.0);
  ok(settleWin.ok === true, "escrow settle win succeeds");
  ok(settleWin.profit === 100, "profit is 100 credits on 2.0x payout");
  ok(cl.getEscrow() === 0, "escrow returned to 0 after settlement");
  ok(cl.getBalance() === 700, "balance increased to 700 after win payout");

  // Test Escrow Settle (Loss)
  cl.lockEscrow("wager_bout_02", 50);
  const settleLoss = cl.settleEscrow("wager_bout_02", false);
  ok(settleLoss.ok === true, "escrow settle loss succeeds");
  ok(settleLoss.loss === 50, "loss is 50 credits");
  ok(cl.getBalance() === 650, "balance reduced to 650 after loss settlement");

  // Test Tournament Staking & Yield
  const stakeRes = cl.stakeInTournament("tourney_champ_1", 200, 0.20);
  ok(stakeRes.ok === true, "staked 200 credits in tournament pool");
  ok(cl.getBalance() === 450, "balance is 450 after staking 200");

  const yieldRes = cl.claimTournamentYield("tourney_champ_1", true);
  ok(yieldRes.ok === true, "claimed tournament yield for 1st place");
  ok(yieldRes.returnAmount === 280, "return amount is 280 credits (+40% on win)");
  ok(cl.getBalance() === 730, "balance increased to 730 after claiming yield");

  // Test Integrity Verification
  const integrity = cl.verifyIntegrity();
  ok(integrity.valid === true, "cryptographic ledger hash chain is intact and valid");

  const history = cl.getHistory(10);
  ok(history.length >= 5, "transaction history logged correctly");
};
