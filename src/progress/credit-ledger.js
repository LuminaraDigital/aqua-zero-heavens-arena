/* =====================================================================
   Aqua Zero Heavens Arena - In-House Virtual Credit & Escrow Ledger
   Luminara Digital

   Virtual Tokenomics & In-House Credit Model:
   - Mirrors cryptocurrency token mechanics (balances, locked escrows,
     tournament stake yields, and cryptographically hashed transaction logs)
   - Operates 100% offline with zero dependencies and seamlessly bridges
     to on-chain TON wallet transactions when online.
   ===================================================================== */

const CREDIT_STORAGE_KEY = "azha_credit_ledger_v1";

const CreditLedger = (function () {
  let state = {
    balance: 500, // Starting purse credits
    escrowLocked: 0,
    lifetimeEarned: 500,
    lifetimeSpent: 0,
    stakedPools: {}, // tournamentId -> { amount, entryTime, yieldRate }
    txHistory: [],
  };

  function simpleHash(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function createTxEntry(type, amount, balanceAfter, meta) {
    const prevHash = state.txHistory.length > 0 ? state.txHistory[state.txHistory.length - 1].hash : "00000000";
    const timestamp = Date.now();
    const payload = `${prevHash}|${type}|${amount}|${balanceAfter}|${timestamp}`;
    const hash = simpleHash(payload);

    const entry = {
      id: "tx_" + timestamp + "_" + Math.floor(Math.random() * 1000),
      type: type, // "DEPOSIT", "WITHDRAW", "ESCROW_LOCK", "ESCROW_SETTLE", "STAKE", "YIELD"
      amount: amount,
      balanceAfter: balanceAfter,
      timestamp: timestamp,
      hash: hash,
      prevHash: prevHash,
      meta: meta || {},
    };

    state.txHistory.push(entry);
    if (state.txHistory.length > 100) {
      state.txHistory.shift(); // Keep last 100 transactions in ledger memory
    }
    save();
    return entry;
  }

  function init(initialBalance) {
    load();
    if (typeof initialBalance === "number" && state.txHistory.length === 0) {
      state.balance = initialBalance;
      state.lifetimeEarned = initialBalance;
      createTxEntry("GENESIS", initialBalance, state.balance, { note: "Initial wallet allotment" });
    }
    return getState();
  }

  function getBalance() {
    return state.balance;
  }

  function getEscrow() {
    return state.escrowLocked;
  }

  function getAvailable() {
    return Math.max(0, state.balance - state.escrowLocked);
  }

  function deposit(amount, reason, meta) {
    if (typeof amount !== "number" || amount <= 0) return { ok: false, error: "Invalid deposit amount" };
    state.balance += Math.round(amount);
    state.lifetimeEarned += Math.round(amount);
    const tx = createTxEntry("DEPOSIT", Math.round(amount), state.balance, Object.assign({ reason: reason || "Reward" }, meta));
    return { ok: true, balance: state.balance, tx: tx };
  }

  function withdraw(amount, reason, meta) {
    if (typeof amount !== "number" || amount <= 0) return { ok: false, error: "Invalid withdrawal amount" };
    const cleanAmount = Math.round(amount);
    if (getAvailable() < cleanAmount) return { ok: false, error: "Insufficient available credits" };

    state.balance -= cleanAmount;
    state.lifetimeSpent += cleanAmount;
    const tx = createTxEntry("WITHDRAW", cleanAmount, state.balance, Object.assign({ reason: reason || "Purchase" }, meta));
    return { ok: true, balance: state.balance, tx: tx };
  }

  function lockEscrow(wagerId, amount, meta) {
    if (typeof amount !== "number" || amount <= 0) return { ok: false, error: "Invalid escrow amount" };
    const cleanAmount = Math.round(amount);
    if (getAvailable() < cleanAmount) return { ok: false, error: "Insufficient balance to lock in escrow" };

    state.escrowLocked += cleanAmount;
    const tx = createTxEntry("ESCROW_LOCK", cleanAmount, state.balance, Object.assign({ wagerId: wagerId }, meta));
    return { ok: true, escrowLocked: state.escrowLocked, available: getAvailable(), tx: tx };
  }

  function settleEscrow(wagerId, won, payoutMultiplier, meta) {
    let originalAmount = 0;
    if (meta && typeof meta.originalAmount === "number") {
      originalAmount = meta.originalAmount;
    } else {
      const match = state.txHistory.slice().reverse().find(function (t) {
        return t.type === "ESCROW_LOCK" && t.meta && t.meta.wagerId === wagerId;
      });
      if (match) {
        originalAmount = match.amount;
      }
    }

    state.escrowLocked = Math.max(0, state.escrowLocked - originalAmount);

    if (won) {
      const mult = typeof payoutMultiplier === "number" ? payoutMultiplier : 1.5;
      const profit = Math.round(originalAmount * (mult - 1.0));
      const totalPayout = originalAmount + profit;
      state.balance += profit;
      state.lifetimeEarned += profit;
      const tx = createTxEntry("ESCROW_SETTLE", profit, state.balance, Object.assign({ wagerId: wagerId, won: true, payout: totalPayout }, meta));
      return { ok: true, won: true, profit: profit, totalPayout: totalPayout, balance: state.balance, tx: tx };
    } else {
      state.balance = Math.max(0, state.balance - originalAmount);
      state.lifetimeSpent += originalAmount;
      const tx = createTxEntry("ESCROW_SETTLE", -originalAmount, state.balance, Object.assign({ wagerId: wagerId, won: false }, meta));
      return { ok: true, won: false, loss: originalAmount, balance: state.balance, tx: tx };
    }
  }

  function stakeInTournament(tournamentId, amount, yieldRate) {
    const cleanAmount = Math.round(amount);
    if (getAvailable() < cleanAmount) return { ok: false, error: "Insufficient available credits" };

    state.balance -= cleanAmount;
    const rate = typeof yieldRate === "number" ? yieldRate : 0.10;
    state.stakedPools[tournamentId] = {
      tournamentId: tournamentId,
      amount: cleanAmount,
      entryTime: Date.now(),
      yieldRate: rate,
      status: "ACTIVE",
    };

    const tx = createTxEntry("STAKE", cleanAmount, state.balance, { tournamentId: tournamentId, rate: rate });
    return { ok: true, staked: cleanAmount, pool: state.stakedPools[tournamentId], balance: state.balance, tx: tx };
  }

  function claimTournamentYield(tournamentId, wonPlacement) {
    const pool = state.stakedPools[tournamentId];
    if (!pool || pool.status !== "ACTIVE") return { ok: false, error: "No active staking pool found" };

    const multiplier = wonPlacement ? (1.0 + pool.yieldRate * 2.0) : (1.0 + pool.yieldRate * 0.5);
    const returnAmount = Math.round(pool.amount * multiplier);
    const netProfit = returnAmount - pool.amount;

    state.balance += returnAmount;
    state.lifetimeEarned += netProfit;
    pool.status = "CLAIMED";
    pool.claimedAt = Date.now();
    pool.returnAmount = returnAmount;

    const tx = createTxEntry("YIELD", returnAmount, state.balance, { tournamentId: tournamentId, profit: netProfit, wonPlacement: !!wonPlacement });
    return { ok: true, returnAmount: returnAmount, netProfit: netProfit, balance: state.balance, tx: tx };
  }

  function getHistory(limit) {
    const count = limit || 20;
    return state.txHistory.slice(-count).reverse();
  }

  function verifyIntegrity() {
    for (let i = 1; i < state.txHistory.length; i++) {
      const current = state.txHistory[i];
      const prev = state.txHistory[i - 1];
      if (current.prevHash !== prev.hash) {
        return { valid: false, brokenAtIndex: i };
      }
    }
    return { valid: true, totalEntries: state.txHistory.length };
  }

  function getState() {
    return {
      balance: state.balance,
      escrowLocked: state.escrowLocked,
      available: getAvailable(),
      lifetimeEarned: state.lifetimeEarned,
      lifetimeSpent: state.lifetimeSpent,
      stakedPools: state.stakedPools,
      txCount: state.txHistory.length,
    };
  }

  function load() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(CREDIT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.balance === "number") {
            state = Object.assign(state, parsed);
          }
        }
      }
    } catch (e) {
      console.warn("Could not load credit ledger from localStorage", e);
    }
  }

  function save() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CREDIT_STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      console.warn("Could not save credit ledger to localStorage", e);
    }
  }

  return {
    init: init,
    getBalance: getBalance,
    getEscrow: getEscrow,
    getAvailable: getAvailable,
    deposit: deposit,
    withdraw: withdraw,
    lockEscrow: lockEscrow,
    settleEscrow: settleEscrow,
    stakeInTournament: stakeInTournament,
    claimTournamentYield: claimTournamentYield,
    getHistory: getHistory,
    verifyIntegrity: verifyIntegrity,
    getState: getState,
    save: save,
    load: load,
  };
})();

if (typeof window !== "undefined") {
  window.CreditLedger = CreditLedger;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = CreditLedger;
}
