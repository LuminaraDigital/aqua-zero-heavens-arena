/* =====================================================================
   Aqua Zero Heavens Arena - challenge run mode tests
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;
  const X = (src) => A.exec(src);
  const J = (src) => A.exec("JSON.parse(JSON.stringify((" + src + ")))");
  const fresh = () =>
    A.exec("SAVE=DEF_SAVE(); G.adv=null; G.runEnd=null; G.challengePick=null; G.challengeMastery=false; G.openTier=0; persist(); 1");

  section("challenge-run module is wired");
  {
    ok(typeof A.ChallengeRun === "object", "ChallengeRun export exists");
    ok(typeof A.challengeBuildRows === "function", "challengeBuildRows is reachable");
    ok(typeof A.challengeProgress === "function", "challengeProgress is reachable");
    ok(typeof A.challengeNoteMeet === "function", "challengeNoteMeet is reachable");
    ok(typeof A.challengeRenownBonus === "function", "challengeRenownBonus is reachable");
  }

  section("coach tips and scaled renown");
  {
    fresh();
    ok(String(A.challengeCoachTip("untouched")).length > 10, "untouched has a coach tip");
    ok(String(A.challengeCoachTip("clinch_war")).toLowerCase().indexOf("clinch") >= 0,
      "clinch tip mentions the clinch");
    const easy = A.challengeRenownBonus("first_blood");
    const hard = A.challengeRenownBonus("champion");
    const mastery = A.challengeRenownBonus("champion", { mastery: true });
    ok(hard > easy, "harder objectives pay more renown", easy + " -> " + hard);
    ok(mastery < hard && mastery >= 8, "mastery replays pay less than first clear", mastery);
  }

  section("rows: open catalogue then mastery replays");
  {
    fresh();
    const open = J("challengeRows()");
    ok(open[0].id === "none", "ordinary run still heads the list");
    ok(open.length > 5, "many objectives available on a fresh save", open.length);
    ok(open.slice(1).every((r) => !r.mastery), "fresh rows are not mastery replays");
    ok(open.slice(1).every((r) => r.tip && r.renown > 0), "every pick carries tip and renown");
    X("SAVE.titles=CHALLENGES.filter(c=>c.test).map(c=>c.id); 1");
    const full = J("challengeRows()");
    ok(full.length > 1, "shelf-full still offers rows", full.length);
    ok(full.slice(1).every((r) => r.mastery), "and they are mastery replays");
    ok(full.slice(1).every((r) => /MASTERY/.test(r.name)), "named as mastery");
    fresh();
  }

  section("mutators latch onto the run");
  {
    fresh();
    X("G.challengePick='untouched'; G.adv=newAdv(0,0); 1");
    ok(X("G.adv.challenge") === "untouched", "pick lands on the run");
    ok(X("!!G.adv.chalMut && G.adv.chalMut.healMul < 1"), "untouched thins heals");
    ok(X("challengeScaleHeal(G.adv,100)") < 100, "scaleHeal applies the mutator");
    X("G.challengePick='clinch_war'; G.adv=newAdv(0,0); 1");
    ok(X("G.adv.chalMut && G.adv.chalMut.startRange") === "CLINCH", "clinch war opens in clinch");
    fresh();
  }

  section("live progress and fail flash");
  {
    fresh();
    const clean = J("challengeProgress('untouched',{dmgTaken:0,turns:1,ranges:{}})");
    ok(clean && !clean.broken && clean.frac === 1, "untouched stays clean at 0 damage");
    const hit = J("challengeProgress('untouched',{dmgTaken:12,turns:2,ranges:{}})");
    ok(hit && hit.broken, "untouched breaks when damage is taken");
    const track = { broken: false };
    const msg = X("(function(){ var t={broken:false}; return challengeCheckBreak('untouched',{dmgTaken:5},t); })()");
    ok(!!msg && /BROKEN/i.test(String(msg)), "checkBreak returns a fail line once", msg);
    const again = X("(function(){ var t={broken:true}; return challengeCheckBreak('untouched',{dmgTaken:5},t); })()");
    ok(again === null || again === undefined, "and does not spam after the first flash");
    fresh();
  }

  section("meet eligibility blocks patrol cheese");
  {
    fresh();
    X("G.adv=newAdv(0,0,{challenge:'untouched'}); newField(G.adv); 1");
    X("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:2,stage:1});" +
      "G.duel.e.hp=0; G.duel.stats.dmgTaken=0; G.duel.stats.win=true; endDuel(G.duel); 1");
    ok(X("G.adv&&G.adv.challengeDone") === false, "AZX Force one-shot does not meet Untouched");
    fresh();
    X("G.adv=newAdv(0,0,{challenge:'untouched'}); G.adv.stage=2; G.adv.won=2; newField(G.adv); 1");
    X("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:2});" +
      "G.duel.e.hp=0; G.duel.stats.dmgTaken=0; endDuel(G.duel); 1");
    ok(X("G.adv&&G.adv.challengeDone") === true, "a real rival bout does meet Untouched");
    fresh();
  }

  section("mastery replay pays renown without needing a new title");
  {
    fresh();
    X("SAVE.titles=['untouched']; G.adv=newAdv(0,0,{challenge:'untouched',challengeMastery:true});" +
      "G.adv.stage=2; G.adv.won=3; newField(G.adv); 1");
    ok(X("!!G.adv.challengeMastery") === true, "run is flagged as mastery");
    X("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:2});" +
      "G.duel.e.hp=0; G.duel.stats.dmgTaken=0; endDuel(G.duel); 1");
    ok(X("G.adv&&G.adv.challengeDone") === true, "mastery terms still latch");
    const plain = X("metaAwardFor({stage:G.adv.stage,wins:G.adv.won}).total");
    const award = J("awardRunRenown(G.adv,{})");
    ok(award && award.total > plain, "mastery challenge still pays renown", plain + " -> " + (award && award.total));
    ok(award && award.lines.some((l) => l.label === "MASTERY CHALLENGE"),
      "payout line is labeled mastery", award && award.lines.map((l) => l.label).join(","));
    fresh();
  }

  section("duel HUD draws without throwing under a challenge");
  {
    fresh();
    X("G.challengePick='quick_work'; G.adv=newAdv(0,0); newField(G.adv);" +
      "startDuel({fromAdv:true,oppFid:2,oppHp:80,oppPool:[0,1,2,3,4],oppLv:3,stage:1});" +
      "G.duel.ph=D.CMD; G.scene=S.DUEL; 1");
    ok(X("(function(){ try{ render(); return 1; }catch(e){ return String(e.message||e); } })()") === 1,
      "rDuel with challenge meter renders");
    ok(X("G.duel.range") === "MID" || X("typeof G.duel.range")==="string", "duel still has a range");
    fresh();
  }

    section("every objective the run pool offers can actually be completed");
  {
    /* THE BUG THIS TURNS INTO A CI FAILURE: challenge-run offered
       giant_killer, whose test needs st.ranked, while challengeNoteMeet only
       ever runs on a fromAdv fight - so the objective was selectable and
       could never latch. Rather than trust a list, probe each offered
       objective with the best stat block its own meet rule could ever
       produce and assert something can satisfy it.

       What a meet rule can put on the block: challengeNoteMeet requires
       d.fromAdv, and a ranked bout is never fromAdv, so st.ranked is false
       under every rule; st.boss is true only under meet "boss". */
    const probes = (meet) => {
      const out = [];
      ["SUB", "STRIKE", "THROW"].forEach((koClass) =>
        ["LONG", "MID", "CLINCH", "GROUND"].forEach((koRange) =>
          ["LONG", "MID", "CLINCH", "GROUND"].forEach((dom) =>
            [0, 5].forEach((guards) =>
              [[0, 0], [5, 5]].forEach((grapple) => {
                const turns = 3;                     // <= quick_work, and dom > turns/2
                const ranges = {}; ranges[dom] = turns;
                out.push(Object.assign(A.newDuelStats(), {
                  win: true, turns, dmgDealt: 120, dmgTaken: 0, hpLeft: 1, lowest: 0.1,
                  subs: grapple[0], throws: grapple[1], strikes: 9,
                  guards, perfectGuards: 3, sigPerfect: 2, comboMax: 3,
                  koClass, koRange, ranges, conds: { BLEEDING: 2 },
                  opponentRankIndex: 5, myRankIndex: 0,
                  boss: meet === "boss", ranked: false,
                }));
              })))));
      return out;
    };
    const reachable = (c) => {
      const meet = A.challengeRunMeta(c.id).meet || "bout";
      return probes(meet).some((st) => { try { return !!c.test(st); } catch (e) { return false; } });
    };

    const rows = A.challengeBuildRows({ titles: [] }).filter((r) => r.id !== "none");
    ok(rows.length > 0, "the pool offers objectives", rows.length);
    const dead = rows.map((r) => A.CHALLENGE_BY_ID[r.id]).filter((c) => c && !reachable(c)).map((c) => c.id);
    ok(dead.length === 0, "every objective the pool offers is reachable under its own meet rule",
       dead.join(",") || "all reachable");
    /* the same check, run over the mastery pool the screen falls back to
       once every title is already on the shelf */
    const owned = A.CHALLENGES.filter((c) => c.test).map((c) => c.id);
    const mastery = A.challengeBuildRows({ titles: owned }).filter((r) => r.id !== "none");
    const deadM = mastery.map((r) => A.CHALLENGE_BY_ID[r.id]).filter((c) => c && !reachable(c)).map((c) => c.id);
    ok(mastery.length > 0 && deadM.length === 0,
       "and so is every mastery replay", deadM.join(",") || mastery.length + " rows");

    /* the probe has teeth: it is what disqualified giant_killer */
    ok(!reachable(A.CHALLENGE_BY_ID.giant_killer),
       "a ladder-only objective is correctly judged unreachable from a run");
    ok(rows.every((r) => r.id !== "giant_killer") && mastery.every((r) => r.id !== "giant_killer"),
       "so the pool does not offer it, in either list");
    ok(!A.ChallengeRun.offered(A.CHALLENGE_BY_ID.giant_killer), "the pool filter says so directly");
    ok(A.ChallengeRun.offered(A.CHALLENGE_BY_ID.untouched), "while an ordinary objective is offered");
    /* removed from the pool, not weakened: it is still a title you can win */
    const onLadder = Object.assign(A.newDuelStats(),
      { win: true, ranked: true, myRankIndex: 0, opponentRankIndex: 3 });
    ok(A.CHALLENGE_BY_ID.giant_killer.test(onLadder), "and it is still earned on the ladder");
    /* a run already carrying it keeps its coaching rather than the default */
    ok(A.challengeRunMeta("giant_killer").tip !== A.ChallengeRun.DEFAULT.tip,
       "an in-flight run that picked it keeps its own tip", A.challengeRunMeta("giant_killer").tip);
  }

  section("an objective the pool withdrew is refused, not left to rot");
  {
    /* giant_killer was offered before it was retired, so a save can still be
       carrying it. Migrating the save would be new mechanism; the run refuses
       it on the way in instead, and says so rather than going quiet. */
    fresh();
    X("SAVE.run={adv:newAdv(0,0,{challenge:'giant_killer'})}; SAVE.run.adv.map=null; persist(); 1");
    ok(X("SAVE.run.adv.challenge") === "giant_killer",
       "a run saved before the retirement still carries it", X("SAVE.run.adv.challenge"));
    ok(X("resumeRun()") === true, "the run still resumes");
    ok(X("G.adv.challenge") === null, "and the objective is refused at the point of use", X("G.adv.challenge"));
    ok(X("G.adv.challengeRetired") === "giant_killer", "the id is kept so the card can say why");
    ok(!X("!!G.adv.chalMut"), "its mutator is dropped with it");
    ok(X("!!G.adv.map"), "the run is playable - the field is built");
    /* and it can now finish: nothing is left demanding a ranked flag */
    ok(X("challengeNoteMeet(G.adv,{fromAdv:true},newDuelStats())") === false,
       "no objective is left waiting on a flag an adventure cannot set");
    const s = J("runEndSummary(G.adv)");
    ok(s.challenge === null, "the end card claims no objective", String(s.challenge));
    ok(s.challengeRetired === "giant_killer", "it reports the retirement instead", s.challengeRetired);
    X("G.runEnd=runEndSummary(G.adv); G.runEnd.renown=null; G.runEnd.nem=null; G.scene=S.RUNEND; 1");
    ok(X("(function(){ try{ render(); return 1; }catch(e){ return String(e.message||e); } })()") === 1,
       "and the run-end card draws that line without throwing");
    /* a run carrying an objective the pool still offers is untouched */
    fresh();
    X("SAVE.run={adv:newAdv(0,0,{challenge:'untouched'})}; SAVE.run.adv.map=null; persist(); resumeRun(); 1");
    ok(X("G.adv.challenge") === "untouched", "an objective still in the pool survives the same path");
    ok(!X("!!G.adv.challengeRetired"), "and is not reported as retired");
    fresh();
  }
};
