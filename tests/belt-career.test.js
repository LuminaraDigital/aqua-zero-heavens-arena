/* =====================================================================
   Belt career loop - adventure feeds ladder, belt tests, session memory
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section } = h;
  const A = api;

  section("adventure and survival multipliers apply");
  {
    const store = A.makeMemoryStore();
    const svc = A.RankingService(store);
    const even = A.calculatePointsExchange(A.rankByIndex(5), A.rankByIndex(5), "adventure");
    ok(even.winnerGain === 0.5, "even adventure bout pays half a point", even.winnerGain);
    const surv = A.calculatePointsExchange(A.rankByIndex(5), A.rankByIndex(5), "survival");
    ok(Math.abs(surv.winnerGain - 0.6) < 0.001, "even survival bout pays 0.6", surv.winnerGain);
    const far = A.calculatePointsExchange(A.rankByIndex(18), A.rankByIndex(1), "adventure");
    ok(far.winnerGain < 0.1, "farming far below on adventure pays near zero", far.winnerGain);
  }

  section("promoMul scales adventure payout");
  {
    const scaled = A.calculatePointsExchange(A.rankByIndex(5), A.rankByIndex(5), "adventure", 1.25);
    ok(Math.abs(scaled.winnerGain - 0.625) < 0.001, "1.25x ladder favor on adventure", scaled.winnerGain);
    const rankedScaled = A.calculatePointsExchange(A.rankByIndex(5), A.rankByIndex(5), "ranked", 1.25);
    ok(rankedScaled.winnerGain === 1.25, "pointScale also works on ranked when passed", rankedScaled.winnerGain);
  }

  section("bestStreak tracks peak win run");
  {
    const store = A.makeMemoryStore();
    const svc = A.RankingService(store);
    svc.applyMatchResult("you", "cpu:1", { matchType: "ranked" });
    svc.applyMatchResult("you", "cpu:2", { matchType: "ranked" });
    svc.applyMatchResult("you", "cpu:3", { matchType: "ranked" });
    const you = svc.get("you");
    ok(you.streak === 3, "streak is 3", you.streak);
    ok(you.bestStreak === 3, "bestStreak peaks at 3", you.bestStreak);
    svc.applyMatchResult("cpu:4", "you", { matchType: "ranked" });
    const after = svc.get("you");
    ok(after.streak < 0, "loss breaks the streak", after.streak);
    ok(after.bestStreak === 3, "bestStreak survives a loss", after.bestStreak);
  }

  section("leaderboard hides cpu rows");
  {
    const save = { ranking: { players: {}, audit: [] } };
    const store = A.makeSaveStore(save);
    const svc = A.RankingService(store);
    const api = A.makeRankingApi(svc, store, null);
    svc.applyMatchResult("you", "cpu:7", { matchType: "ranked" });
    svc.applyMatchResult("cpu:7", "you", { matchType: "ranked" });
    const board = api.getLeaderboard(20).data;
    ok(board.every((r) => String(r.playerId).slice(0, 4) !== "cpu:"),
       "no cpu:* on the board", board.map((r) => r.playerId).join(","));
    ok(board.some((r) => r.playerId === "you"), "you still appear");
  }

  section("belt test gates hold promotion");
  {
    const save = { ranking: { players: {}, audit: [], beltTests: A.emptyBeltTests() } };
    save.ranking.players.you = A.newPlayerRanking("you");
    /* Bronze gate is rank index 5 (threshold 20). Put the player just under. */
    const gate = A.BELT_TEST_GATES[0];
    ok(gate.id === "bronze" && gate.rankIndex === 5, "first gate is bronze");
    save.ranking.players.you.promotionPoints = A.RANK_TABLE[gate.rankIndex].threshold - 0.5;
    save.ranking.players.you.rankIndex = A.getRankForPoints(save.ranking.players.you.promotionPoints).index;
    const before = save.ranking.players.you.rankIndex;
    /* Simulate crossing: push points past the gate. */
    save.ranking.players.you.promotionPoints = A.RANK_TABLE[gate.rankIndex].threshold + 2;
    const held = A.enforceBeltTestHold(save, "you", before);
    ok(held.held === true, "crossing bronze holds the grade");
    ok(save.ranking.players.you.promotionPoints < A.RANK_TABLE[gate.rankIndex].threshold,
       "points sit just below the gate", save.ranking.players.you.promotionPoints);
    ok(save.ranking.beltTests.pending && save.ranking.beltTests.pending.gateId === "bronze",
       "pending bronze belt test");
    const ptsBeforeFail = save.ranking.players.you.promotionPoints;
    /* Fail does nothing demoting - pending stays. */
    ok(save.ranking.beltTests.pending.gateId === "bronze", "fail leaves pending");
    ok(save.ranking.players.you.promotionPoints === ptsBeforeFail, "fail does not demote points");
    const pass = A.completeBeltTest(save, "you", { bonus: 2, now: () => 1 });
    ok(pass.ok, "belt test completes");
    ok(save.ranking.beltTests.pending === null, "pending cleared");
    ok(save.ranking.beltTests.cleared.indexOf("bronze") >= 0, "bronze marked cleared");
    ok(save.ranking.players.you.promotionPoints >= A.RANK_TABLE[gate.rankIndex].threshold,
       "points now enter bronze", save.ranking.players.you.promotionPoints);
  }

  section("sanitizeRanking keeps beltTests and session");
  {
    const raw = {
      players: {
        you: { playerId: "you", promotionPoints: 22, rankIndex: 5, peakRankIndex: 5,
               wins: 4, losses: 1, totalMatches: 5, streak: 2, bestStreak: 3 },
      },
      audit: [{ at: 1, matchType: "adventure", winnerId: "you", loserId: "cpu:1" }],
      beltTests: { cleared: ["bronze"], pending: { gateId: "silver", targetDivision: "silver", targetRankIndex: 8 } },
      session: { hero: 2, bouts: 3, wins: 2, losses: 1, peakRankIndex: 5, startPoints: 10, startRankIndex: 3, done: false },
    };
    const clean = A.sanitizeRanking(raw);
    ok(!!clean, "sanitize accepts ranking blob");
    ok(clean.players.you.promotionPoints === 22, "points preserved");
    ok(clean.players.you.bestStreak === 3, "bestStreak preserved");
    ok(clean.beltTests.cleared.indexOf("bronze") >= 0, "cleared gates preserved");
    ok(clean.beltTests.pending && clean.beltTests.pending.gateId === "silver", "pending preserved");
    ok(clean.session && clean.session.bouts === 3 && clean.session.hero === 2, "session preserved");
  }

  section("ranked session write/read roundtrip");
  {
    const save = { ranking: { players: {}, audit: [], beltTests: A.emptyBeltTests(), session: null } };
    A.writeRankedSession(save, {
      hero: 1, bouts: 4, wins: 3, losses: 1,
      peakRankIndex: 6, startPoints: 12, startRankIndex: 4, done: false,
    });
    const back = A.readRankedSession(save);
    ok(back && back.hero === 1 && back.bouts === 4 && back.wins === 3, "session restores", JSON.stringify(back));
    A.writeRankedSession(save, null);
    ok(A.readRankedSession(save) === null, "clearing session works");
  }

  section("applyLadderResult wires adventure in the live game");
  {
    A.exec("SAVE.ranking={players:{},audit:[],beltTests:emptyBeltTests(),session:null}; invalidateRankApi();");
    const before = A.myRanking().promotionPoints;
    A.exec(
      "G.duel={hotseat:false,dojo:false,tf:false,attract:false,boss:false,fromAdv:true," +
      "e:{fid:1,level:4},oppLv:4,oppRankIndex:5,benefits:[],oppId:'cpu:1'};" +
      "G.result=null;" +
      "var L=applyLadderResult(G.duel,true,'adventure');" +
      "G._ladderSnap=L;"
    );
    const after = A.myRanking().promotionPoints;
    const snap = A.exec("G._ladderSnap");
    ok(after > before, "adventure win moves promotion points", before + " -> " + after);
    ok(snap && snap.matchType === "adventure", "snapshot records adventure");
    ok(typeof snap.delta === "number", "snapshot has delta", snap && snap.delta);
  }

  section("ladder favor benefit exists");
  {
    ok(!!A.BENEFITS.ladder_favor, "ladder_favor benefit is registered");
    ok(A.BENEFITS.ladder_favor.promoMul === 1.25, "promoMul is 1.25");
    ok(A.benefitFlag(["ladder_favor"], "promoMul") === 1.25, "benefitFlag reads promoMul");
  }
};
