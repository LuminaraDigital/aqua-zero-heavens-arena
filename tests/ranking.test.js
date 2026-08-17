/* =====================================================================
   Ranking system tests - point exchange, rank transitions, edge cases
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section } = h;
  const A = api;

  section("rank table");
  ok(A.RANK_TABLE.length === 21, "21 grades: Beginner + 10 kyu + 10 dan", A.RANK_TABLE.length);
  ok(A.RANK_TABLE[0].type === "BEGINNER", "index 0 is Beginner");
  ok(A.RANK_TABLE[1].type === "KYU" && A.RANK_TABLE[1].grade === 10, "index 1 is 10th Kyu");
  ok(A.RANK_TABLE[10].type === "KYU" && A.RANK_TABLE[10].grade === 1, "index 10 is 1st Kyu");
  ok(A.RANK_TABLE[11].type === "DAN" && A.RANK_TABLE[11].grade === 1, "index 11 is 1st Dan");
  ok(A.RANK_TABLE[20].type === "DAN" && A.RANK_TABLE[20].grade === 10, "index 20 is 10th Dan");
  ok(A.RANK_TABLE[1].title === "10th Kyu" && A.RANK_TABLE[20].title === "10th Dan", "titles read correctly");
  {
    let kyuFalls = true, danRises = true;
    for (let i = 2; i <= 10; i++) if (A.RANK_TABLE[i].grade >= A.RANK_TABLE[i - 1].grade) kyuFalls = false;
    for (let i = 12; i <= 20; i++) if (A.RANK_TABLE[i].grade <= A.RANK_TABLE[i - 1].grade) danRises = false;
    ok(kyuFalls, "kyu numbers fall as you improve");
    ok(danRises, "dan numbers rise as you master");
  }
  {
    let rising = true;
    for (let i = 1; i < A.RANK_TABLE.length; i++)
      if (A.RANK_TABLE[i].threshold <= A.RANK_TABLE[i - 1].threshold) rising = false;
    ok(rising, "thresholds strictly increase");
    ok(A.RANK_TABLE.every((r) => !!r.division && !!r.color), "every grade has a division and colour");
  }

  section("points to rank");
  ok(A.getRankForPoints(0).title === "Beginner", "0 points is Beginner");
  ok(A.getRankForPoints(-50).title === "Beginner", "negative points clamp to Beginner");
  ok(A.getRankForPoints(2).title === "10th Kyu", "2 points reaches 10th Kyu");
  ok(A.getRankForPoints(64).title === "2nd Kyu", "just under the 1st Kyu line", A.getRankForPoints(64).title);
  ok(A.getRankForPoints(65).title === "1st Kyu", "65 points is 1st Kyu");
  ok(A.getRankForPoints(80).title === "1st Dan", "crossing 80 enters the dan grades");
  ok(A.getRankForPoints(99999).title === "10th Dan", "the ladder caps at 10th Dan");

  section("rank neighbours");
  ok(A.getNextRank(A.rankByIndex(10)).title === "1st Dan", "1st Kyu is followed by 1st Dan");
  ok(A.getPreviousRank(A.rankByIndex(11)).title === "1st Kyu", "1st Dan is preceded by 1st Kyu");
  ok(A.getNextRank(A.rankByIndex(20)) === null, "10th Dan has no next rank");
  ok(A.getPreviousRank(A.rankByIndex(0)) === null, "Beginner has no previous rank");

  section("progress within a grade");
  ok(A.rankProgress(65) === 0, "progress resets on promotion");
  ok(Math.abs(A.rankProgress(72.5) - 0.5) < 0.01, "halfway between 1st Kyu and 1st Dan", A.rankProgress(72.5));
  ok(A.rankProgress(99999) === 1, "the top grade reads as full");
  ok(A.pointsToNextRank(65) === 15, "15 points from 1st Kyu to 1st Dan", A.pointsToNextRank(65));

  section("point exchange across rank gaps");
  const R = A.rankByIndex;
  {
    const same = A.calculatePointsExchange(R(5), R(5), "ranked");
    ok(same.winnerGain === 1, "same grade exchanges a full point", same.winnerGain);
    ok(same.gap === 0 && !same.upset, "flagged as an even match");
  }
  {
    const one = A.calculatePointsExchange(R(6), R(5), "ranked");
    const two = A.calculatePointsExchange(R(7), R(5), "ranked");
    const three = A.calculatePointsExchange(R(9), R(5), "ranked");
    ok(one.winnerGain === 0.5, "one grade up pays half", one.winnerGain);
    ok(two.winnerGain === 0.25, "two grades up pays a quarter", two.winnerGain);
    ok(three.winnerGain === 0.125, "three or more pays an eighth", three.winnerGain);
    const four = A.calculatePointsExchange(R(14), R(5), "ranked");
    ok(four.winnerGain === three.winnerGain, "the gap factor stops shrinking past three");
  }
  {
    const upset1 = A.calculatePointsExchange(R(5), R(6), "ranked");
    const upset3 = A.calculatePointsExchange(R(5), R(9), "ranked");
    ok(upset1.upset === true, "beating a higher grade is flagged as an upset");
    ok(upset1.winnerGain > 1, "an upset pays more than an even match", upset1.winnerGain);
    ok(upset3.winnerGain > upset1.winnerGain, "the bigger the upset the bigger the reward",
       upset1.winnerGain + " -> " + upset3.winnerGain);
    ok(upset3.winnerGain <= A.RANK_CONFIG.maxGain, "but never above the cap", upset3.winnerGain);
  }
  {
    const beat = A.calculatePointsExchange(R(18), R(1), "ranked");
    ok(beat.loserLoss <= A.RANK_CONFIG.maxLoss, "loss is capped", beat.loserLoss);
    ok(beat.loserLoss < 0.2, "a novice crushed by a master barely loses anything", beat.loserLoss);
  }
  {
    const ranked = A.calculatePointsExchange(R(5), R(5), "ranked");
    const adv = A.calculatePointsExchange(R(5), R(5), "adventure");
    const exh = A.calculatePointsExchange(R(5), R(5), "exhibition");
    ok(adv.winnerGain < ranked.winnerGain, "adventure matches are worth less", adv.winnerGain);
    ok(exh.winnerGain === 0, "exhibition matches are worth nothing");
  }

  section("applying results");
  const mk = () => {
    const store = A.makeMemoryStore();
    let clock = 1000;
    const svc = A.RankingService(store, () => ++clock);
    return { store, svc, api: A.makeRankingApi(svc, store, null) };
  };
  {
    const { svc } = mk();
    const res = svc.applyMatchResult("a", "b", { matchType: "ranked" });
    ok(res.winner.ranking.promotionPoints === 1, "winner banks the exchange", res.winner.ranking.promotionPoints);
    ok(res.loser.ranking.promotionPoints === 0, "a new loser cannot go below zero");
    ok(res.winner.ranking.wins === 1 && res.loser.ranking.losses === 1, "win/loss counters move");
    ok(res.winner.ranking.totalMatches === 1 && res.loser.ranking.totalMatches === 1, "match counts move");
    ok(!!res.audit && res.audit.winnerId === "a", "an audit entry is produced");
  }
  {
    // farming beginners must NOT carry you up the ladder
    const { svc } = mk();
    for (let i = 0; i < 400; i++) svc.applyMatchResult("farmer", "fish" + (i % 7), { matchType: "ranked" });
    const farmer = A.getRankForPoints(svc.get("farmer").promotionPoints);
    ok(farmer.index < A.FIRST_DAN_INDEX,
       "400 wins over beginners stalls out well short of a dan grade", farmer.title);
  }
  {
    // beating your own grade does - which is what the matchmaker pairs you with
    const { svc, store } = mk();
    let promotions = 0, last = "Beginner";
    for (let i = 0; i < 600; i++) {
      const hi = A.getRankForPoints(svc.get("hero").promotionPoints).index;
      const oppId = "grade" + hi;
      if (!store.get(oppId)) {
        const r = A.newPlayerRanking(oppId);
        r.promotionPoints = A.RANK_TABLE[hi].threshold;
        r.peakRankIndex = hi;
        store.put(oppId, r);
      }
      const res = svc.applyMatchResult("hero", oppId, { matchType: "ranked" });
      if (res.winner.after.title !== last) { promotions++; last = res.winner.after.title; }
    }
    ok(promotions >= 15, "beating your peers climbs the whole ladder", promotions + " promotions, now " + last);
    ok(A.getRankForPoints(svc.get("hero").promotionPoints).type === "DAN",
       "and crosses into the dan grades", last);
  }
  {
    // demotion protection: once you hold a dan you cannot fall out of it
    const { svc, store } = mk();
    const r = A.newPlayerRanking("vet");
    r.promotionPoints = A.RANK_TABLE[A.FIRST_DAN_INDEX].threshold;
    r.peakRankIndex = A.FIRST_DAN_INDEX;
    store.put("vet", r);
    for (let i = 0; i < 60; i++) svc.applyMatchResult("bully", "vet", { matchType: "ranked" });
    const after = svc.get("vet");
    ok(A.getRankForPoints(after.promotionPoints).index >= A.FIRST_DAN_INDEX,
       "a dan grade holds through a long losing run", A.getRankForPoints(after.promotionPoints).title);
  }
  {
    const { svc } = mk();
    const a = svc.applyMatchResult("x", "y", {});
    ok(a.winner.before.index === 0, "exchange uses the ranks from before the match");
    ok(a.winner.promoted === (a.winner.after.index > a.winner.before.index), "promotion flag matches the move");
  }

  section("the request layer");
  {
    const { api: rapi } = mk();
    const bad = rapi.applyMatchRanking("m1", { winnerId: "a" });
    ok(bad.ok === false, "a malformed apply is rejected", bad.error);
    const self = rapi.applyMatchRanking("m1", { winnerId: "a", loserId: "a" });
    ok(self.ok === false, "a fighter cannot beat themselves");
    const good = rapi.applyMatchRanking("m2", { winnerId: "a", loserId: "b", matchType: "ranked" });
    ok(good.ok === true, "a valid apply succeeds");
    const view = rapi.getPlayerRanking("a");
    ok(view.ok && view.data.rank.title === "Beginner" && view.data.promotionPoints === 1,
       "the player view reports rank and points", view.data.promotionPoints);
    ok(typeof view.data.progress === "number" && typeof view.data.pointsToNext === "number",
       "and the UI fields it needs");
    ok(view.data.winRate === 100, "win rate is computed", view.data.winRate);
    const lb = rapi.getLeaderboard(10);
    ok(lb.ok && lb.data.length === 2 && lb.data[0].playerId === "a", "leaderboard sorts by points");
    const log = rapi.getAuditLog(10);
    ok(log.ok && log.data.length >= 1 && log.data[0].winnerId === "a", "the audit log records the match");
  }
  {
    // an unknown player reads as a fresh Beginner rather than an error
    const { api: rapi } = mk();
    const view = rapi.getPlayerRanking("nobody");
    ok(view.ok && view.data.rank.index === 0 && view.data.totalMatches === 0,
       "an unseen player is a Beginner with no history");
  }

  section("ladder integration");
  ok(typeof A.rankApi === "function" && A.YOU === "you", "the game exposes a ranking api for the local player");
  {
    const before = A.myRanking();
    ok(before.rank.title === "Beginner", "a fresh save starts at Beginner", before.rank.title);
    const res = A.rankApi().applyMatchRanking("t1", { winnerId: A.YOU, loserId: "cpu:3", matchType: "ranked" });
    ok(res.ok, "the game can apply a ladder result");
    const after = A.myRanking();
    ok(after.promotionPoints > before.promotionPoints, "and the local player gains points",
       before.promotionPoints + " -> " + after.promotionPoints);
    ok(!!A.getSave().ranking && !!A.getSave().ranking.players[A.YOU], "the result is written into the save");
    ok(A.getSave().ranking.audit.length >= 1, "and into the audit log");
  }
  {
    const idx = A.cpuRankIndexFor(A.BOSS_ID, 9);
    ok(idx > A.cpuRankIndexFor(3, 1), "a stronger fighter at a higher level ranks above a weak one", idx);
    ok(idx <= A.MAX_RANK_INDEX, "cpu grades stay on the table");
  }
};
