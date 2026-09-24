/* =====================================================================
   Aqua Zero Heavens Arena - belt tests (division gates)
   Luminara Digital

   Crossing into a new division (Bronze, Silver, Gold, Sapphire, Obsidian,
   Heavens) requires a belt test. Points that would push you past the gate
   are held just below the threshold until the test is passed. Failure does
   not demote; the pending test stays until you clear it.
   ===================================================================== */
const BELT_TEST_BONUS = 2;

/* First rank index of each gated division. Copper is the student start and
   is not gated; you earn it by climbing. */
const BELT_TEST_GATES = [
  { id: "bronze",   division: "bronze",   rankIndex: 5 },
  { id: "silver",   division: "silver",   rankIndex: 8 },
  { id: "gold",     division: "gold",     rankIndex: 11 },
  { id: "sapphire", division: "sapphire", rankIndex: 14 },
  { id: "obsidian", division: "obsidian", rankIndex: 17 },
  { id: "heavens",  division: "heavens",  rankIndex: 20 },
];

function emptyBeltTests() {
  return { cleared: [], pending: null };
}

function normalizeBeltTests(raw) {
  const out = emptyBeltTests();
  if (!raw || typeof raw !== "object") return out;
  if (Array.isArray(raw.cleared)) {
    const ids = {};
    BELT_TEST_GATES.forEach((g) => { ids[g.id] = true; });
    raw.cleared.forEach((id) => {
      const s = String(id || "");
      if (ids[s] && out.cleared.indexOf(s) < 0) out.cleared.push(s);
    });
  }
  const p = raw.pending;
  if (p && typeof p === "object") {
    const gate = BELT_TEST_GATES.find((g) => g.id === p.gateId || g.division === p.targetDivision);
    if (gate) {
      out.pending = {
        gateId: gate.id,
        targetDivision: gate.division,
        targetRankIndex: gate.rankIndex,
      };
    }
  }
  return out;
}

function ensureBeltTests(save) {
  if (!save.ranking) save.ranking = { players: {}, audit: [] };
  save.ranking.beltTests = normalizeBeltTests(save.ranking.beltTests);
  return save.ranking.beltTests;
}

function gateById(id) {
  return BELT_TEST_GATES.find((g) => g.id === id) || null;
}

function isGateCleared(beltTests, gateId) {
  const bt = normalizeBeltTests(beltTests);
  return bt.cleared.indexOf(gateId) >= 0;
}

/* Highest uncleared gate whose threshold sits strictly above fromIndex and
   at or below toIndex (i.e. the player crossed into that division). */
function unclearedGateCrossed(fromIndex, toIndex, beltTests) {
  const from = fromIndex | 0, to = toIndex | 0;
  if (to <= from) return null;
  const bt = normalizeBeltTests(beltTests);
  let hit = null;
  for (let i = 0; i < BELT_TEST_GATES.length; i++) {
    const g = BELT_TEST_GATES[i];
    if (bt.cleared.indexOf(g.id) >= 0) continue;
    if (from < g.rankIndex && to >= g.rankIndex) hit = g;
  }
  return hit;
}

function capPointsBelowGate(points, gate) {
  const thr = RANK_TABLE[gate.rankIndex].threshold;
  return Math.max(0, +(thr - 0.01).toFixed(3));
}

/* After a match that moved YOU: if they crossed an uncleared gate, hold
   points and set pending. Returns { held, gate, pending } or { held:false }. */
function enforceBeltTestHold(save, playerId, beforeRankIndex) {
  const bt = ensureBeltTests(save);
  const players = save.ranking.players || {};
  const p = players[playerId];
  if (!p) return { held: false };
  const after = getRankForPoints(p.promotionPoints);
  const gate = unclearedGateCrossed(beforeRankIndex, after.index, bt);
  if (!gate) return { held: false, pending: bt.pending };
  p.promotionPoints = capPointsBelowGate(p.promotionPoints, gate);
  const heldRank = getRankForPoints(p.promotionPoints);
  p.rankIndex = heldRank.index;
  bt.pending = {
    gateId: gate.id,
    targetDivision: gate.division,
    targetRankIndex: gate.rankIndex,
  };
  return { held: true, gate, pending: bt.pending, rank: heldRank };
}

/* Pass the pending belt test: clear the gate, grant enough points to enter
   the division, plus a small bonus. */
function completeBeltTest(save, playerId, opts) {
  opts = opts || {};
  const bt = ensureBeltTests(save);
  const pending = bt.pending;
  if (!pending) return { ok: false, error: "no pending belt test" };
  const gate = gateById(pending.gateId) || BELT_TEST_GATES.find((g) => g.rankIndex === pending.targetRankIndex);
  if (!gate) return { ok: false, error: "unknown gate" };
  if (bt.cleared.indexOf(gate.id) < 0) bt.cleared.push(gate.id);
  bt.pending = null;
  const players = save.ranking.players || {};
  let p = players[playerId];
  if (!p) {
    p = newPlayerRanking(playerId);
    players[playerId] = p;
  }
  const thr = RANK_TABLE[gate.rankIndex].threshold;
  const bonus = opts.bonus !== undefined ? opts.bonus : BELT_TEST_BONUS;
  const need = Math.max(0, thr - (p.promotionPoints || 0));
  p.promotionPoints = +((p.promotionPoints || 0) + need + bonus).toFixed(3);
  const after = getRankForPoints(p.promotionPoints);
  p.rankIndex = after.index;
  if (after.index > (p.peakRankIndex || 0)) p.peakRankIndex = after.index;
  p.lastRankChangeAt = (opts.now || Date.now)();
  return {
    ok: true,
    gate,
    ranking: p,
    rank: after,
    bonus: need + bonus,
    cleared: bt.cleared.slice(),
  };
}

function beltTestStatus(save) {
  const bt = ensureBeltTests(save);
  const pending = bt.pending;
  const gate = pending ? (gateById(pending.gateId) || null) : null;
  const div = gate && DIVISION[gate.division] ? DIVISION[gate.division] : null;
  return {
    cleared: bt.cleared.slice(),
    pending: pending,
    pendingTitle: div ? (div.name + " Belt Test") : null,
    pendingColor: div ? div.color : null,
    gates: BELT_TEST_GATES.map((g) => ({
      id: g.id,
      division: g.division,
      rankIndex: g.rankIndex,
      title: DIVISION[g.division] ? DIVISION[g.division].name : g.id,
      cleared: bt.cleared.indexOf(g.id) >= 0,
      pending: !!(pending && pending.gateId === g.id),
    })),
  };
}
