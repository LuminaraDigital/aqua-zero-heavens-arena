/* =====================================================================
   Aqua Zero Heavens Arena - ranking service
   Luminara Digital

   Promotion points are exchanged between the two fighters. How many
   depends on the gap between their ranks: an expected win against someone
   well below you is worth almost nothing, and beating someone well above
   you is worth a great deal. That keeps the ladder honest without an
   opaque hidden rating.

   Everything here is pure except applyMatchResult, which is the single
   place that touches the store. Tunables live in RANK_CONFIG.
   ===================================================================== */
const RANK_CONFIG = {
  base: 1,
  /* winner is the higher-ranked fighter - the expected result, so it pays less
     the further apart they are: same rank, 1 apart, 2 apart, 3+ apart */
  gapFactor:   [1, 0.5, 0.25, 0.125],
  /* winner is the lower-ranked fighter - an upset, worth progressively more */
  upsetFactor: [1, 1.75, 2.5, 3.25],
  maxGain: 4,
  maxLoss: 4,
  /* A true exchange: what the winner banks is what the loser drops. Anything
     less than 1 here quietly inflates the whole ladder - at 0.9 a fighter who
     wins exactly half their matches still drifts all the way to 10th Dan,
     which makes the grade meaningless. The novice shield below is the one
     deliberate exception. */
  lossRatio: 1.0,
  /* once you have earned a dan grade you cannot be demoted out of it */
  demotionFloorIndex: FIRST_DAN_INDEX,
  /* below this rank a loss costs less - new fighters are not punished for learning */
  noviceShieldIndex: 4,     // Beginner .. 8th Kyu
  noviceLossRatio: 0.4,
  /* what each mode is worth on the ladder */
  matchTypeMultiplier: { ranked: 1, adventure: 0.5, survival: 0.6, exhibition: 0, hotseat: 0 },
  auditLimit: 40,
};

/* ---------- pure rank maths ---------- */
function getRankForPoints(points) {
  const p = Math.max(0, points || 0);
  let r = RANK_TABLE[0];
  for (let i = 0; i < RANK_TABLE.length; i++) if (p >= RANK_TABLE[i].threshold) r = RANK_TABLE[i];
  return r;
}
function getNextRank(rank) { return rank.index >= MAX_RANK_INDEX ? null : rankByIndex(rank.index + 1); }
function getPreviousRank(rank) { return rank.index <= 0 ? null : rankByIndex(rank.index - 1); }

/* 0..1 through the current rank - drives the progress bar */
function rankProgress(points) {
  const r = getRankForPoints(points), n = getNextRank(r);
  if (!n) return 1;
  const span = n.threshold - r.threshold;
  return span <= 0 ? 1 : Math.max(0, Math.min(1, (points - r.threshold) / span));
}
function pointsToNextRank(points) {
  const n = getNextRank(getRankForPoints(points));
  return n ? Math.max(0, +(n.threshold - points).toFixed(2)) : 0;
}

function calculatePointsExchange(winnerRank, loserRank, matchType, pointScale) {
  const cfg = RANK_CONFIG;
  const gap = Math.min(3, Math.abs(winnerRank.index - loserRank.index));
  const upset = winnerRank.index < loserRank.index;
  const factor = upset ? cfg.upsetFactor[gap] : cfg.gapFactor[gap];
  const mult = cfg.matchTypeMultiplier[matchType || "ranked"];
  const modeMult = mult === undefined ? 1 : mult;
  const scale = (typeof pointScale === "number" && isFinite(pointScale) && pointScale > 0)
    ? pointScale : 1;

  let winnerGain = cfg.base * factor * modeMult * scale;
  // Ladder Leapfrog Displacement: Major upsets (2+ ranks higher) grant an acceleration bonus
  if (upset && gap >= 2) {
    winnerGain = Math.min(cfg.maxGain, winnerGain * (1 + 0.15 * gap));
  }
  winnerGain = Math.max(0, Math.min(cfg.maxGain, winnerGain));

  let loserLoss = winnerGain * cfg.lossRatio;
  if (loserRank.index <= cfg.noviceShieldIndex) loserLoss *= cfg.noviceLossRatio;
  loserLoss = Math.max(0, Math.min(cfg.maxLoss, loserLoss));

  return { winnerGain: +winnerGain.toFixed(3), loserLoss: +loserLoss.toFixed(3), gap, upset, modeMult, pointScale: scale };
}

/* Performance contract purse calculation adapted from contractNegotiation.js:
   - 3+ win streak bonus: +50% multiplier
   - Stoppage finish bonus (KO or Submission): +30% multiplier
*/
function calculatePerformancePurse(basePurse, streak, method) {
  let mult = 1.0;
  if ((streak || 0) >= 3) mult += 0.50;
  const m = String(method || "").toLowerCase();
  const isStoppage = m.indexOf("ko") >= 0 || m.indexOf("knockout") >= 0 || m.indexOf("sub") >= 0 || m.indexOf("tapout") >= 0;
  if (isStoppage) mult += 0.30;
  return {
    purse: Math.round((basePurse || 0) * mult),
    multiplier: +mult.toFixed(2),
    streakBonus: (streak || 0) >= 3,
    finishBonus: isStoppage,
  };
}

/* points can never fall out of a dan grade once it has been earned */
function applyPointDelta(ranking, delta) {
  let pts = (ranking.promotionPoints || 0) + delta;
  const floor = ranking.peakRankIndex >= RANK_CONFIG.demotionFloorIndex
    ? RANK_TABLE[RANK_CONFIG.demotionFloorIndex].threshold : 0;
  return Math.max(floor, +pts.toFixed(3));
}

/* ---------- the entity ---------- */
function newPlayerRanking(playerId) {
  return {
    playerId, promotionPoints: 0, rankIndex: 0, peakRankIndex: 0,
    wins: 0, losses: 0, totalMatches: 0, lastRankChangeAt: 0, streak: 0,
    bestStreak: 0,
  };
}
const rankOf = (ranking) => getRankForPoints(ranking.promotionPoints);

/* ---------- the one mutating entry point ---------- */
/* store: { get(id), put(id, ranking), log(entry) } - swap it for a server
   adapter and nothing above this line changes. */
function RankingService(store, now) {
  const clock = now || (() => Date.now());

  function get(playerId) {
    return store.get(playerId) || newPlayerRanking(playerId);
  }
  function ensure(playerId) {
    const r = get(playerId);
    if (!store.get(playerId)) store.put(playerId, r);
    return r;
  }
  /* applies one decided match. Reads both rankings, computes the exchange from
     the ranks as they were BEFORE the match, then writes both - so the order of
     the two writes cannot change the result. */
  function applyMatchResult(winnerId, loserId, meta) {
    meta = meta || {};
    const w = get(winnerId), l = get(loserId);
    const wRank = rankOf(w), lRank = rankOf(l);
    const ex = calculatePointsExchange(wRank, lRank, meta.matchType, meta.pointScale);

    w.promotionPoints = applyPointDelta(w, ex.winnerGain);
    l.promotionPoints = applyPointDelta(l, -ex.loserLoss);
    w.wins++; l.losses++;
    w.totalMatches++; l.totalMatches++;
    w.streak = Math.max(1, (w.streak || 0) + 1);
    l.streak = Math.min(-1, (l.streak || 0) - 1);
    if (w.streak > (w.bestStreak || 0)) w.bestStreak = w.streak;

    const wAfter = rankOf(w), lAfter = rankOf(l);
    w.rankIndex = wAfter.index; l.rankIndex = lAfter.index;
    if (wAfter.index > (w.peakRankIndex || 0)) w.peakRankIndex = wAfter.index;
    if (lAfter.index > (l.peakRankIndex || 0)) l.peakRankIndex = lAfter.index;
    const t = clock();
    if (wAfter.index !== wRank.index) w.lastRankChangeAt = t;
    if (lAfter.index !== lRank.index) l.lastRankChangeAt = t;

    store.put(winnerId, w); store.put(loserId, l);
    const entry = {
      at: t, matchId: meta.matchId || null, matchType: meta.matchType || "ranked",
      winnerId, loserId, winnerGain: ex.winnerGain, loserLoss: ex.loserLoss,
      upset: ex.upset, gap: ex.gap,
      winnerRank: wRank.title, winnerRankAfter: wAfter.title,
      loserRank: lRank.title, loserRankAfter: lAfter.title,
    };
    if (store.log) store.log(entry);
    return {
      exchange: ex, audit: entry,
      winner: { ranking: w, before: wRank, after: wAfter, promoted: wAfter.index > wRank.index },
      loser: { ranking: l, before: lRank, after: lAfter, demoted: lAfter.index < lRank.index },
    };
  }
  return { get, ensure, applyMatchResult, calculatePointsExchange, getRankForPoints, getNextRank, getPreviousRank };
}
