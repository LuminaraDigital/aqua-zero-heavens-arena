/* =====================================================================
   Aqua Zero Heavens Arena - ranking store + request layer
   Luminara Digital

   The game is offline, so the store is the save file and the "endpoints"
   are in-process calls. They are shaped like a server API on purpose: the
   service above never touches storage directly, so swapping this adapter
   for an HTTP client is the whole job of going online later.

   Handler shapes mirror the routes they would become:
     GET  /players/:id/ranking        -> rankingApi.getPlayerRanking(id)
     POST /matches/:id/ranking/apply  -> rankingApi.applyMatchRanking(...)
     GET  /leaderboard                -> rankingApi.getLeaderboard()
   ===================================================================== */
const YOU = "you";                       // the local player's id

function makeSaveStore(save) {
  if (!save.ranking) save.ranking = { players: {}, audit: [] };
  const R = save.ranking;
  return {
    get: (id) => R.players[id] || null,
    put: (id, ranking) => { R.players[id] = ranking; },
    all: () => R.players,
    log: (entry) => {
      R.audit.unshift(entry);
      if (R.audit.length > RANK_CONFIG.auditLimit) R.audit.length = RANK_CONFIG.auditLimit;
    },
    audit: () => R.audit,
  };
}
/* an in-memory store, used by the tests and the ladder simulation */
function makeMemoryStore() {
  const players = {}, audit = [];
  return {
    get: (id) => players[id] || null,
    put: (id, r) => { players[id] = r; },
    all: () => players,
    log: (e) => { audit.unshift(e); if (audit.length > RANK_CONFIG.auditLimit) audit.length = RANK_CONFIG.auditLimit; },
    audit: () => audit,
  };
}

function makeRankingApi(service, store, persist) {
  /* every write goes through here, so persistence happens exactly once per
     mutation and a half-applied match cannot be saved */
  function commit(result) { if (persist) persist(); return result; }
  return {
    getPlayerRanking(playerId) {
      const r = service.get(playerId);
      const rank = getRankForPoints(r.promotionPoints);
      return {
        ok: true,
        data: {
          playerId, rank, promotionPoints: +r.promotionPoints.toFixed(2),
          progress: rankProgress(r.promotionPoints),
          pointsToNext: pointsToNextRank(r.promotionPoints),
          nextRank: getNextRank(rank), peakRank: rankByIndex(r.peakRankIndex || 0),
          wins: r.wins, losses: r.losses, totalMatches: r.totalMatches,
          winRate: r.totalMatches ? Math.round((100 * r.wins) / r.totalMatches) : 0,
          streak: r.streak || 0, lastRankChangeAt: r.lastRankChangeAt,
        },
      };
    },
    applyMatchRanking(matchId, body) {
      if (!body || !body.winnerId || !body.loserId) return { ok: false, error: "winnerId and loserId are required" };
      if (body.winnerId === body.loserId) return { ok: false, error: "a fighter cannot beat themselves" };
      const result = service.applyMatchResult(body.winnerId, body.loserId,
        { matchId, matchType: body.matchType, meta: body.meta });
      return commit({ ok: true, data: result });
    },
    getLeaderboard(limit) {
      const all = store.all();
      const rows = Object.keys(all).map((id) => ({
        playerId: id, points: all[id].promotionPoints, rank: getRankForPoints(all[id].promotionPoints),
        wins: all[id].wins, losses: all[id].losses,
      }));
      rows.sort((a, b) => b.points - a.points);
      return { ok: true, data: rows.slice(0, limit || 20) };
    },
    getAuditLog(limit) { return { ok: true, data: (store.audit ? store.audit() : []).slice(0, limit || 20) }; },
  };
}

/* ---------- UI helpers ---------- */
const rankTitle = (rank) => (rank ? rank.title : "Unranked");
const rankColor = (rank) => (rank ? rank.color : DIVISION.unranked.color);
const rankShort = (rank) => (rank ? rank.short : "-");
function rankBadge(ranking) {
  const rank = getRankForPoints(ranking.promotionPoints);
  return { title: rank.title, short: rank.short, color: rank.color,
           division: DIVISION[rank.division].name, progress: rankProgress(ranking.promotionPoints) };
}
/* the rank a CPU opponent fights at, so ladder matches are meaningful */
function cpuRankIndexFor(fid, level, bump) {
  const b = bioOf(fid);
  const ovr = (b && b.ovr) || 85;
  const fromSkill = Math.round((ovr - 82) * 1.15);            // 83 ovr -> ~1, 95 ovr -> ~15
  const fromLevel = Math.round(((level || 1) - 1) * 1.1);
  return Math.max(0, Math.min(MAX_RANK_INDEX, fromSkill + fromLevel + (bump || 0)));
}
