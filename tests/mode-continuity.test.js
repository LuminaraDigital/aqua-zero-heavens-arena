/* =====================================================================
   Aqua Zero Heavens Arena - every mode continues after a fight
   Luminara Digital

   A mode is a sequence of fights, not one fight. Two separate faults used
   to break that:

     1. endDuel writes the result in a mode chain (tower / dojo / gauntlet /
        weekly) and then FELL THROUGH into the plain-versus chain below it,
        which overwrote the result with vswin/vsloss. The result screen reads
        the kind to decide where A goes, so those modes were silently dumped
        on the main menu after a single fight.
     2. Ranked had no session at all - one graded bout, then the menu.

   The suite below pins both: the result kind each mode writes is the kind
   that survives, A off the result screen goes back into the mode, and the
   ladder keeps seating opponents until you leave it or top it out.
   ===================================================================== */
module.exports = function (h) {
  const { api: A, ok, section, press, scene } = h;

  const reset = () => A.exec(
    "SAVE=DEF_SAVE(); persist(); G.adv=null; G.surv=null; G.endless=null;" +
    "G.weekly=null; G.ranked=null; G.duel=null; G.result=null; G.cer=null; G.resTab=0;");
  const win  = () => A.exec("G.duel.e.hp=0; G.duel.ph=D.END; endDuel(G.duel);");
  const lose = () => A.exec("G.duel.p.hp=0; G.duel.ph=D.END; endDuel(G.duel);");
  const kind = () => A.G.result && A.G.result.kind;

  section("a mode's result is the result - nothing overwrites it");
  {
    reset(); A.exec("G.selMode='tower'; startTower(0);");
    win();
    ok(kind() === "towerwin", "a cleared tower floor stays a tower win", kind());

    reset(); A.exec("G.selMode='tower'; startTower(0);");
    lose();
    ok(kind() === "towerloss", "and a lost floor stays a tower loss", kind());

    reset(); A.exec("G.selMode='dojo'; startDojo(0);");
    win();
    ok(kind() === "dojoend", "a dojo drill ends as a dojo drill", kind());

    reset(); A.exec("G.selMode='endless'; startEndless(0); endlessNext();");
    win();
    ok(kind() === "endlesswin" || kind() === "gauntletvictory",
      "a gauntlet wave stays a gauntlet result", kind());

    reset(); A.exec("G.selMode='weekly'; startWeekly(0);");
    win();
    ok(kind() === "weekly_tier_win" || kind() === "weekly_grand_win",
      "a weekly tier stays a weekly result", kind());

    reset(); A.exec("startSurvival(0);");
    win();
    ok(kind() === "survwin", "survival was already safe and stays safe", kind());

    reset(); A.exec("startRanked(0);");
    win();
    ok(kind() === "rankwin", "and a ladder bout stays a ladder bout", kind());
  }

  section("A off the result screen goes back into the mode");
  {
    reset(); A.exec("G.selMode='tower'; startTower(0);");
    const cleared = A.G.duel.towerFloor;
    win(); press("a");
    ok(scene() === "DUEL" && A.G.duel.tower && A.G.duel.towerFloor === cleared + 1,
      "a cleared floor puts you straight on the next one",
      scene() + "/" + (A.G.duel && A.G.duel.towerFloor) + " after " + cleared);
    ok(A.G.duel.p.fid === 0, "with the fighter who climbed there", A.G.duel.p.fid);

    reset(); A.exec("G.selMode='tower'; startTower(0);");
    const fell = A.G.duel.towerFloor;
    lose(); press("a");
    ok(scene() === "DUEL" && A.G.duel.tower && A.G.duel.towerFloor === fell,
      "a defeat re-takes the same floor, which is what the screen promises",
      scene() + "/" + (A.G.duel && A.G.duel.towerFloor) + " vs " + fell);

    reset(); A.exec("G.selMode='tower'; startTower(0);");
    win(); press("b");
    ok(scene() === "TOWER", "B is still the way back to the lobby", scene());

    reset(); A.exec("G.selMode='dojo'; startDojo(0);");
    win(); press("a");
    ok(scene() === "DOJO", "a drill hands you the dojo", scene());

    reset(); A.exec("G.selMode='endless'; startEndless(0); endlessNext();");
    win(); press("a");
    ok(["ENDLESS", "PERK", "DRAFT"].indexOf(scene()) >= 0,
      "a cleared wave hands you the gauntlet, a perk or a draft", scene());

    reset(); A.exec("G.selMode='weekly'; startWeekly(0);");
    win(); press("a");
    ok(scene() === "WEEKLY", "a cleared tier hands you the tournament", scene());

    reset(); A.exec("startSurvival(0);");
    win(); press("a");
    ok(scene() === "DUEL", "and survival goes straight into the next round", scene());
  }

  section("the ladder is a session, not a single bout");
  {
    reset(); A.exec("startRanked(0);");
    ok(!!A.G.ranked && A.G.ranked.bouts === 0, "entering ranked opens a session");
    ok(scene() === "DUEL" && A.G.duel.ranked, "and seats a graded bout", scene());

    win();
    ok(A.G.result.session && A.G.result.session.bouts === 1 && A.G.result.session.wins === 1,
      "the result carries the session record", JSON.stringify(A.G.result.session));
    press("a");
    ok(scene() === "DUEL" && A.G.duel.ranked, "A seats the next ladder opponent", scene());

    lose();
    ok(A.G.result.session.bouts === 2 && A.G.result.session.losses === 1,
      "the record keeps counting across bouts", JSON.stringify(A.G.result.session));
    ok(A.myRanking().totalMatches === 2, "and both bouts moved the ladder", A.myRanking().totalMatches);

    press("b");
    ok(scene() === "MENU", "B ends the session", scene());
    ok(A.G.ranked === null, "and closes it out", JSON.stringify(A.G.ranked));
  }

  section("the ladder closes itself at the top, and only there");
  {
    reset();
    A.exec(
      "invalidateRankApi();" +
      "SAVE.ranking={players:{},audit:[],beltTests:{cleared:BELT_TEST_GATES.map(function(g){return g.id;}),pending:null},session:null};" +
      "rankApi();" +
      "var me=newPlayerRanking(YOU);" +
      "me.promotionPoints=RANK_TABLE[MAX_RANK_INDEX].threshold-0.05;" +
      "me.rankIndex=me.peakRankIndex=MAX_RANK_INDEX-1;" +
      "_rkStore.put(YOU,me);"
    );
    A.exec("startRanked(0);");
    /* Even match at the penultimate grade so the bout always pays enough to crown. */
    A.exec("G.duel.oppRankIndex=MAX_RANK_INDEX-1;");
    win();
    ok(A.myRanking().rank.index === A.MAX_RANK_INDEX, "the last rung is reached",
      A.myRanking().rank.title);
    ok(A.G.result.sessionDone === true, "which finishes the session", A.G.result.sessionDone);
    press("a");
    ok(scene() === "MENU" && A.G.ranked === null,
      "A leaves the ladder rather than seating a fight it cannot pay for", scene());
  }

  section("a graded one-off is still a one-off");
  {
    reset();
    A.exec("startDuel({p1:0,p1hp:hpOf(0),p1pool:battlePool(0,9),p1level:9," +
           "oppFid:1,oppHp:hpOf(1),oppPool:battlePool(1,5),oppLv:5,fromAdv:false," +
           "stage:1,ranked:true,oppRankIndex:3});");
    ok(A.G.ranked === null, "a ranked duel seated by hand opens no session");
    win();
    ok(kind() === "rankwin" && A.G.result.session === null,
      "it resolves without one", JSON.stringify(A.G.result.session));
    press("a");
    ok(scene() === "MENU", "and leaves to the menu the way it always did", scene());
  }

  section("a session never outlives the ladder");
  {
    reset(); A.exec("startRanked(0);");
    ok(!!A.G.ranked, "session open");
    A.exec("startExhibitionBout(0,1,{});");
    ok(A.G.ranked === null, "seating any other fight closes it");
    win();
    ok(kind() === "vswin", "so the exhibition result is an exhibition result", kind());
    press("a");
    ok(scene() !== "DUEL" || !A.G.duel.ranked, "and nothing seats a ladder bout behind it");
  }

  section("every gauntlet wave can name a real fighter");
  {
    /* ORDER holds deck growth arrays, so ORDER[i] is an ARRAY of card indices.
       Using it as a fighter id made hpOf / battlePool / FIGHTERS[...] throw
       inside a key handler, which stranded the gauntlet in its own lobby. */
    const roster = A.exec("FIGHTERS.length");
    let bad = null;
    for (let w = 1; w <= 30 && !bad; w++) {
      const opp = A.endlessOpponentForWave(w, roster);
      if (typeof opp.id !== "number" || !A.FIGHTERS[opp.id]) bad = w + ":" + JSON.stringify(opp.id);
    }
    ok(!bad, "waves 1-30 all seat a real fighter", bad);

    let badTier = null;
    for (let t = 1; t <= 12 && !badTier; t++) {
      const opp = A.weeklyOpponentForTier({ hero: 0, tier: t, year: 2026, week: 4 }, t, roster);
      if (typeof opp.id !== "number" || !A.FIGHTERS[opp.id]) badTier = t + ":" + JSON.stringify(opp.id);
    }
    ok(!badTier, "and so do weekly tiers 1-12", badTier);

    reset(); A.exec("G.selMode='endless'; startEndless(0); G.gauntletOpt=0;");
    press("a");
    ok(scene() === "DUEL" && A.G.duel.endless, "the gauntlet lobby actually opens a wave", scene());
    ok(!!A.FIGHTERS[A.G.duel.e.fid], "against somebody who exists", A.G.duel.e.fid);
  }
};
