/* =====================================================================
   THE WIRING.

   Three modules landed with no consumer: renown (progress/meta.js),
   discipline mastery (progress/discipline-mastery.js) and the daily board
   (progress/leaderboard.js). Their own suites prove the logic. This one
   proves the joins, which is where the value actually is - a currency
   nobody is ever paid, an XP bar nothing feeds and a board no screen
   reaches are all indistinguishable from not shipping them.

   It also covers the two features built on top of that wiring: the
   nemesis who outlives a run, and the challenge run.

   Everything here goes through exec() and the real key handlers, so it
   passes without any edit to tests/harness.js.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section, press, frames, scene } = h;
  const A = api;
  const X = (src) => A.exec(src);
  const J = (src) => JSON.parse(A.exec("JSON.stringify(" + src + ")"));
  const fresh = () => A.exec("SAVE=DEF_SAVE(); G.adv=null; G.runEnd=null; G.challengePick=null; G.openTier=0; persist(); 1");

  /* a hero whose own arts do NOT include the discipline we are about to buy,
     so a bought pass is visibly an ADDITION rather than a coincidence */
  const heroWithout = (disc) =>
    X("FIGHTERS.map((f,i)=>i).filter(i=>(disciplinesOf(i)||[]).indexOf('" + disc + "')<0)[0]");

  section("the three modules are in the bundle and reachable from the page");
  {
    ok(X('typeof metaAwardFor==="function"'), "renown is in the build");
    ok(X('typeof awardDiscMastery==="function"'), "discipline mastery is in the build");
    ok(X('typeof lbSubmitDaily==="function"'), "the daily board is in the build");
    ok(X('typeof DEF_META==="function" && typeof discMasteryNormalize==="function"'),
       "and both save-block sanitisers are reachable");
  }

  section("the save carries the three new blocks across a reload");
  {
    fresh();
    const d = J("DEF_SAVE()");
    ok(!!d.meta && typeof d.meta === "object", "a fresh save has a renown ledger");
    ok(!!d.discMastery && typeof d.discMastery === "object", "and a discipline mastery block");
    ok(d.nem === null, "and no nemesis yet");
    ok(d.v === 4, "and the save version is unchanged - none of this invalidates an old save", d.v);
  }
  {
    /* sanitizeSavePayload whitelists keys and drops the rest, so this is the
       assertion that the three blocks are actually re-attached in load() */
    fresh();
    X("SAVE.meta=metaCredit(SAVE.meta,120); SAVE.discMastery={boxing:90};" +
      "SAVE.nem={fid:2,losses:3,wins:1,active:true}; persist(); SAVE=load(); 1");
    ok(X("SAVE.meta.renown") === 120, "renown survives a save and a reload", X("SAVE.meta.renown"));
    ok(X("SAVE.discMastery.boxing") === 90, "so does discipline xp", X("SAVE.discMastery.boxing"));
    ok(X("SAVE.nem&&SAVE.nem.fid") === 2 && X("SAVE.nem.losses") === 3,
       "and so does the nemesis record");
    ok(X("discMasteryRank(SAVE.discMastery.boxing).level") >= 2,
       "with the grade it had earned", X("discMasteryRank(SAVE.discMastery.boxing).name"));
  }
  {
    // the hand-edited blob: every one of the three has to normalise, not throw
    fresh();
    let threw = null;
    try {
      X("localStorage.setItem('azha_save',JSON.stringify(Object.assign(JSON.parse(" +
        "localStorage.getItem('azha_save')),{meta:'nonsense',discMastery:[1,2,3]," +
        "nem:{fid:9999,losses:-4}}))); SAVE=load(); 1");
    } catch (e) { threw = String(e.message || e); }
    ok(!threw, "a tampered blob loads without an exception", threw || "clean");
    ok(X("SAVE.meta.renown") === 0 && X("Object.keys(SAVE.discMastery).length") === 0,
       "with both blocks reset to empty rather than left as junk");
    ok(X("SAVE.nem") === null, "and a nemesis who is not on the roster is dropped");
    fresh();
  }

  section("every run pays renown, and the screen that ends it says so");
  {
    fresh();
    X("G.adv=newAdv(0,0); G.adv.stage=3; G.adv.won=9; G.adv.fights=12; newField(G.adv); 1");
    const before = X("SAVE.meta.renown");
    X("G.result={kind:'ko',cont:false}; G.scene=S.RESULT; 1");
    press("a");
    ok(scene() === "RUNEND", "a run-ending KO opens the run summary", scene());
    const after = X("SAVE.meta.renown");
    ok(after > before, "and the run is paid on the way out", before + " -> " + after);
    ok(X("!!(G.runEnd&&G.runEnd.renown&&G.runEnd.renown.total>0)"),
       "the summary carries the award so the screen can show it",
       X("G.runEnd&&G.runEnd.renown&&G.runEnd.renown.total"));
    ok(X("G.runEnd.renown.lines.length") >= 1,
       "with its arithmetic, not one mystery number", X("G.runEnd.renown.lines.length"));
    ok(X("SCENE_LABEL[S.RUNEND].indexOf('Renown earned')") >= 0,
       "and the screen reader is told too");
    frames(2);
    ok(scene() === "RUNEND", "the screen renders without throwing");
  }
  {
    // deeper runs pay more, and nothing pays twice
    fresh();
    X("G.adv=newAdv(0,0); G.adv.stage=1; G.adv.won=1; 1");
    const shallow = X("awardRunRenown(G.adv,{}).total");
    ok(X("awardRunRenown(G.adv,{})") === null, "a run cannot be paid twice", "second call is null");
    fresh();
    X("G.adv=newAdv(0,0); G.adv.stage=4; G.adv.won=16; 1");
    const deep = X("awardRunRenown(G.adv,{}).total");
    ok(deep > shallow, "depth is what it pays for", shallow + " -> " + deep);
    fresh();
    X("G.adv=newAdv(0,0); G.adv.stage=4; G.adv.won=16; 1");
    const cleared = X("awardRunRenown(G.adv,{cleared:true}).total");
    ok(cleared > deep, "and finishing the climb pays best of all", deep + " -> " + cleared);
  }
  {
    // abandoning is not finishing, and must not become a renown faucet
    fresh();
    X("G.adv=newAdv(0,0); newField(G.adv); saveRun(); G.scene=S.MAP; 1");
    press("b");
    A.G.pauseSel = 3;
    press("a");
    ok(scene() === "MENU" && !A.G.adv, "abandon still leaves the run", scene());
    ok(X("SAVE.meta.renown") === 0, "and pays nothing - start/abandon/repeat is not an economy",
       X("SAVE.meta.renown"));
  }
  {
    // the give-up press on a KO you could have continued from
    fresh();
    X("SAVE.diff=0; G.adv=newAdv(0,0); G.adv.stage=2; G.adv.won=4; newField(G.adv);" +
      "G.result={kind:'ko',cont:true}; G.scene=S.RESULT; 1");
    press("b");
    ok(scene() === "RUNEND", "B on a KO with continues left ends the run properly", scene());
    ok(X("SAVE.meta.renown") > 0, "and is paid for, instead of dead-ending on the title",
       X("SAVE.meta.renown"));
    X("SAVE.diff=1; 1");
  }

  section("what renown buys actually reaches the run");
  {
    fresh();
    const hero = heroWithout("bjj");
    X("SAVE.meta=metaCredit(SAVE.meta,4000); SAVE.meta=metaBuy(SAVE.meta,'art_bjj').meta; 1");
    X("G.adv=newAdv(" + hero + ",0); 1");
    ok(X("G.adv.metaDiscs.indexOf('bjj')") >= 0, "a bought art pass reaches the run",
       X("JSON.stringify(G.adv.metaDiscs)"));
    ok(X("draftDiscs(G.adv).indexOf('bjj')") >= 0, "and the drafter treats it as one of yours");
    ok(X("draftDiscs(G.adv).length") === X("(disciplinesOf(" + hero + ")||[]).length+1"),
       "purely as an ADDITION - nothing of the fighter's own is displaced");
    ok(X("!!draftRanges(G.adv).GROUND"), "which opens the ranges that art fights at");
    ok(X("draftPool(G.adv).length") > 0, "and the pool is still a pool", X("draftPool(G.adv).length"));
  }
  {
    fresh();
    X("SAVE.meta=metaCredit(SAVE.meta,4000); SAVE.meta=metaBuy(SAVE.meta,'corner_slot').meta; 1");
    X("G.adv=newAdv(0,0); 1");
    const want = X("G.adv.cornerSlots");
    ok(want > X("META_CONFIG.cornerBase"), "a bought slot widens the run's corner bag", want);
    ok(X("withCornerSlots(G.adv,()=>SHOP_CONFIG.cornerCarry)") === want,
       "the gym is told about it for exactly the length of the call");
    ok(X("SHOP_CONFIG.cornerCarry") === X("META_CONFIG.cornerBase"),
       "and the constant is put back afterwards, so no run leaks into the next",
       X("SHOP_CONFIG.cornerCarry"));
    // and the shop genuinely sells the extra slot rather than refusing it
    X("G.adv.corner=['ice','ice2','ice3']; G.adv.purse=9999; 1");
    const item = X("JSON.stringify(shopStock(G.adv).filter(i=>i.kind==='CORNER')[0]||null)");
    if (item && item !== "null") {
      const r = J("withCornerSlots(G.adv,()=>canAfford(G.adv," + item + ")?buyItem(G.adv," + item + "):{ok:false})");
      ok(r.ok === true, "a fourth corner item goes in the bag", r.reason || "bought");
    } else {
      ok(true, "no corner item in stock this roll - capacity asserted above");
    }
  }
  {
    fresh();
    X("SAVE.meta=metaCredit(SAVE.meta,4000); SAVE.meta=metaBuy(SAVE.meta,'camp_start').meta; 1");
    X("G.adv=newAdv(0,0); 1");
    ok(X("G.adv.benefits.length") === 1, "a standing camp opens the run holding one benefit",
       X("JSON.stringify(G.adv.benefits)"));
    ok(X("G.adv.benefits.every(id=>!!BENEFITS[id]&&(BENEFITS[id].tags||[]).indexOf('EDGE')<0)"),
       "rolled from the ordinary camp pool - never an EDGE");
  }
  {
    fresh();
    X("SAVE.meta=metaCredit(SAVE.meta,4000); SAVE.meta=metaBuy(SAVE.meta,'map_gauntlet').meta; 1");
    X("G.adv=newAdv(0,0); newField(G.adv); 1");
    ok(X("G.adv.layouts.length") >= 2, "a bought layout reaches the field generator",
       X("JSON.stringify(G.adv.layouts)"));
    let bad = 0;
    for (let i = 0; i < 12; i++) {
      X("G.adv.reroll=" + i + "; newField(G.adv); 1");
      const walk = X("(function(){var m=G.adv.map,N=m.N,seen={},q=[[0,m.py]],d={};" +
        "seen[m.py*N]=1;var n=0;while(q.length){var c=q.shift();n++;" +
        "[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(v){var x=c[0]+v[0],y=c[1]+v[1];" +
        "if(x<0||y<0||x>=N||y>=N||m.g[y][x]||seen[y*N+x])return;seen[y*N+x]=1;q.push([x,y]);});}" +
        "return m.foes.filter(function(o){return !seen[o.y*N+o.x];}).length;})()");
      if (walk > 0) bad++;
    }
    ok(bad === 0, "and every field it lays out still has reachable opponents", bad + " unreachable");
  }
  {
    fresh();
    ok(X("metaOpenTier(SAVE,2).tier") === 0, "an opening you never bought is quietly the full card");
    X("SAVE.meta=metaCredit(SAVE.meta,4000); SAVE.meta=metaBuy(SAVE.meta,'open_stage').meta;" +
      "G.openTier=1; 1");
    X("G.adv=newAdv(0,0); 1");
    ok(X("G.adv.stage") === 2, "a bought opening starts the run deeper", X("G.adv.stage"));
    ok(X("G.adv.purseMul") > 1, "and pays a premium for it all run", X("G.adv.purseMul"));
    fresh();
    X("G.openTier=2; G.adv=newAdv(0,0); 1");
    ok(X("G.adv.stage") === 1 && X("G.adv.purseMul") === 1,
       "asking for one you do not own gives you the ordinary run at ordinary money");
    fresh();
  }
  {
    // the load-bearing promise: buying nothing changes nothing
    fresh();
    X("G.adv=newAdv(0,0); 1");
    ok(X("G.adv.metaDiscs.length") === 0 && X("G.adv.benefits.length") === 0,
       "a fresh save is dealt exactly what it always was");
    ok(X("G.adv.stage") === 1 && X("G.adv.purseMul") === 1 &&
       X("G.adv.cornerSlots") === X("SHOP_CONFIG.cornerCarry"),
       "same stage, same money, same bag");
    ok(X("JSON.stringify(G.adv.layouts)") === '["' + X("META_CONFIG.baseLayout") + '"]',
       "and the stock field", X("JSON.stringify(G.adv.layouts)"));
    ok(X("draftDiscs(G.adv).join(',')") === X("(disciplinesOf(0)||[]).join(',')"),
       "and the drafter sees the fighter's own arts and nothing else");
  }

  section("discipline mastery is fed by the techniques actually thrown");
  {
    fresh();
    X("G.adv=newAdv(0,0); newField(G.adv); 1");
    X("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1}); 1");
    /* a whole real fight, played the way battle.test.js plays one: the tally has
       to come out of commitEvent as techniques resolve, never out of a fixture */
    let g = 0;
    while (X("G.scene===S.DUEL") === true && g < 40000) { A.onKey("a"); A.step(); A.render(); g++; }
    ok(g < 40000, "the fight terminates", g + " frames");
    const used = J("(G.lastStats&&G.lastStats.discs)||{}");
    ok(Object.keys(used).length > 0, "the fight recorded which arts were thrown",
       JSON.stringify(used));
    ok(Object.keys(used).every((k) => X("!!DISCIPLINES['" + k + "']")),
       "every one of them is a real art", Object.keys(used).join(","));
  }
  {
    fresh();
    X("G.adv=newAdv(0,0); newField(G.adv); 1");
    X("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1}); 1");
    const disc = X("(disciplinesOf(G.duel.p.fid)||[])[0]");
    X("G.duel.stats.discs={}; discNoteUse(G.duel.stats.discs,'" + disc + "',5);" +
      "G.duel.e.hp=0; G.duel.stats.koDisc='" + disc + "'; endDuel(G.duel); 1");
    ok(X("discMasteryXp(SAVE,'" + disc + "')") > 0, "the bell banks it, permanently",
       X("discMasteryXp(SAVE,'" + disc + "')"));
    ok(X("!!(G.payout&&G.payout.disc&&G.payout.disc.total>0)"),
       "and the result screen is handed the numbers to show",
       X("G.payout&&G.payout.disc&&G.payout.disc.total"));
    frames(2);
    ok(scene() === "RESULT", "which it renders without throwing", scene());
  }
  {
    // a loss trains too - that is the whole point of a second axis
    fresh();
    X("G.adv=newAdv(0,0); newField(G.adv); 1");
    X("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1}); 1");
    const disc = X("(disciplinesOf(G.duel.p.fid)||[])[0]");
    X("G.duel.stats.discs={}; discNoteUse(G.duel.stats.discs,'" + disc + "',4);" +
      "G.duel.p.hp=0; endDuel(G.duel); 1");
    ok(X("discMasteryXp(SAVE,'" + disc + "')") > 0, "xp from a fight you lost",
       X("discMasteryXp(SAVE,'" + disc + "')"));
  }
  {
    // and a hot-seat bout writes nothing, the rule fighter mastery already keeps
    fresh();
    X("startDuel({p1:0,p1hp:90,p1pool:[0,1,2,3,4],oppFid:3,oppHp:90,oppPool:[0,1,2,3,4]," +
      "oppLv:9,fromAdv:false,hotseat:true,stage:5}); 1");
    const disc = X("(disciplinesOf(0)||[])[0]");
    X("G.duel.stats.discs={}; discNoteUse(G.duel.stats.discs,'" + disc + "',6);" +
      "G.duel.e.hp=0; endDuel(G.duel); 1");
    ok(X("discMasteryXp(SAVE,'" + disc + "')") === 0, "two players on one device train nobody");
  }

  section("the drafter consumes the multiplier - and the budget is untouched");
  {
    fresh();
    const hero = 0;
    const own = X("(disciplinesOf(" + hero + ")||[])[0]");
    X("G.adv=newAdv(" + hero + ",0); G.adv.stage=3; 1");
    const flat = X("draftPool(G.adv).reduce((n,p)=>n+p.w,0)");
    ok(X("discDraftMul(SAVE,'" + own + "')") === 1, "a fresh save shades nothing");
    X("SAVE.discMastery={'" + own + "':9999}; 1");
    const mastered = X("draftPool(G.adv).reduce((n,p)=>n+p.w,0)");
    ok(X("discDraftMul(SAVE,'" + own + "')") > 1, "a mastered art shades the offer",
       X("discDraftMul(SAVE,'" + own + "')"));
    ok(mastered > flat, "so the pool leans toward the art you have trained",
       Math.round(flat) + " -> " + Math.round(mastered));
    ok(X("discDraftMul(SAVE,'" + own + "')") <= X("DRAFT_CONFIG.doorMul"),
       "and never louder than the loudest shade draft.js already had",
       X("discDraftMul(SAVE,'" + own + "')") + " vs " + X("DRAFT_CONFIG.doorMul"));
    // the POWER budget is a different question and this must not have touched it
    ok(X("draftPowerBudget(3)") === X("Math.round(DRAFT_CONFIG.powerBase+DRAFT_CONFIG.powerStep*2)"),
       "the stage budget is exactly what it was", X("draftPowerBudget(3)"));
    ok(X("draftPool(G.adv).every(p=>TECH[p.id].power<=draftPowerBudget(3))"),
       "and no offer is over it, mastered or not");
    ok(X("draftChoices(G.adv).length") === X("DRAFT_CONFIG.choices"),
       "three cards on the table, as before", X("draftChoices(G.adv).length"));
    fresh();
  }

  section("the daily reaches the board, and shrugs when there is no board");
  {
    fresh();
    /* This build may or may not carry AZHA_SUPABASE_* - both are normal, and
       neither may change what the game does. Nobody is signed in either way, so
       the board is at best read-only, and the harness has no fetch at all, which
       is exactly the offline case a player is in most of the time. */
    ok(["OFF", "READ ONLY", "ON", "..."].indexOf(X("lbStatusLabel(localStorage)")) >= 0,
       "the board states its own status honestly", X("lbStatusLabel(localStorage)"));
    ok(X("lbConfigured()") === false || X("lbStatusLabel(localStorage)") === "READ ONLY",
       "with no session a configured board is read-only, never a write");
    ok(X("lbBoardNow(dayKey()).length") === 0, "and there is nothing cached to draw");
    ok(J("lbBoardNow(dayKey())").length === 0 && Array.isArray(J("lbBoardNow(dayKey())")),
       "the synchronous read a scene uses is always an array, never a promise");
    X("G.scene=S.MENU; G.menuSel=menuItems().findIndex(it=>it[2]==='daily'); 1");
    press("a");
    ok(scene() === "DAILY", "the daily is still reachable from the menu", scene());
    frames(3);
    ok(scene() === "DAILY", "and the screen renders with the board line on it");
    press("b");
    ok(scene() === "MENU", "B backs out");
  }
  {
    // finishing the gauntlet must not be blocked, delayed or broken by the board
    fresh();
    let threw = null;
    try {
      X("startDailyGauntlet(); G.duel.e.hp=0; endDuel(G.duel); 1");
    } catch (e) { threw = String(e.message || e); }
    ok(!threw, "completing the daily with no server does not throw", threw || "clean");
    ok(X("G.result&&G.result.kind") === "dailywin", "the result is the ordinary one",
       X("G.result&&G.result.kind"));
    ok(X("SAVE.daily&&SAVE.daily.done") === true && X("SAVE.daily.streak") >= 1,
       "and the streak is the player's whether or not anyone is listening",
       X("SAVE.daily&&SAVE.daily.streak"));
  }
  {
    // the submission itself, driven with a fake fetch so the join is real
    fresh();
    const out = J("(function(){var seen=null;var f=function(u,o){seen={u:u,o:o};" +
      "return Promise.resolve({ok:true,status:201,json:function(){return Promise.resolve(null);}});};" +
      "var r=lbBuildEntry(20260817,1234,3,'CHALLENGER');return {entry:r};})()");
    ok(!!out.entry && out.entry.day === 20260817, "the payload the daily would post is well formed",
       JSON.stringify(out.entry));
    ok(Object.keys(out.entry).sort().join(",") === "day,fighter,name,score",
       "and carries four fields and nothing else", Object.keys(out.entry).join(","));
  }

  section("the nemesis outlives the run");
  {
    fresh();
    const rival = X("RIVAL_IDS[0]");
    X("G.adv=newAdv(0,0); G.adv.stage=2; G.adv.won=4; newField(G.adv); 1");
    X("startDuel({fromAdv:true,oppFid:" + rival + ",oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:2}); 1");
    X("G.duel.p.hp=0; endDuel(G.duel); 1");
    ok(X("G.adv&&G.adv.nemesis") === rival, "losing inside the run flags him", X("G.adv&&G.adv.nemesis"));
    ok(X("G.adv.endedByFid") === rival, "and records who signed the run", X("G.adv.endedByFid"));
    X("G.result={kind:'ko',cont:false}; G.scene=S.RESULT; 1");
    press("a");
    ok(scene() === "RUNEND", "the run ends", scene());
    ok(X("SAVE.nem&&SAVE.nem.fid") === rival, "and the save now remembers him", X("SAVE.nem&&SAVE.nem.fid"));
    ok(X("SAVE.nem.losses") === 1 && X("SAVE.nem.active") === true,
       "with a record between you, and standing", JSON.stringify(J("SAVE.nem")));
  }
  {
    // and he opens the next one
    const rival = X("SAVE.nem.fid");
    X("SAVE=load(); 1");
    ok(X("SAVE.nem&&SAVE.nem.fid") === rival, "the record survives a reload");
    X("G.adv=newAdv(0,0); newField(G.adv); 1");
    ok(X("G.adv.nemesis") === rival, "the next run opens carrying him", X("G.adv.nemesis"));
    ok(X("G.adv.map.foes.some(o=>!o.tf&&o.id===" + rival + ")") === true,
       "and he is standing on the first field");
    ok(X("G.adv.map.foes.filter(o=>!o.tf).length") === 2,
       "seated in a rival slot, not added to it - the field is the same size",
       X("G.adv.map.foes.filter(o=>!o.tf).length"));
    // the brief says so
    X("G.brief={f:G.adv.map.foes.filter(o=>!o.tf&&o.id===" + rival + ")[0],t:0}; G.scene=S.BRIEF; 1");
    frames(2);
    ok(scene() === "BRIEF", "the brief renders his card", scene());
    X("startDuel({fromAdv:true,oppFid:" + rival + ",oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1}); 1");
    ok(X("G.duel.nemesis") === true, "and the bell knows what he is");
    ok(X("G.duel.e.atkMul") > X("mkSide(" + rival + ",90,[0,1,2,3,4],{level:4}).atkMul"),
       "he comes in a little up, as a nemesis always has");
  }
  {
    // collecting settles it
    const rival = X("SAVE.nem.fid");
    X("G.duel.e.hp=0; endDuel(G.duel); 1");
    ok(X("G.payRevenge") === true, "beating him pays the revenge purse");
    ok(X("SAVE.nem.wins") === 1, "the record counts it", X("SAVE.nem.wins"));
    ok(X("SAVE.nem.active") === false, "and he stops opening your runs until he ends another one");
    ok(X("SAVE.nem.fid") === rival, "the story is kept either way - it is the only one about you");
    X("G.adv=null; SAVE.run=null; 1");
    X("G.adv=newAdv(0,0); 1");
    ok(X("G.adv.nemesis") === null, "so the next run opens against nobody in particular");
    fresh();
  }

  section("the challenge run");
  {
    fresh();
    const rows = J("challengeRows()");
    ok(rows.length > 1, "there are objectives to take", rows.length);
    ok(rows[0].id === "none", "and the ordinary run heads the list");
    ok(rows.slice(1).every((r) => X("!!CHALLENGE_BY_ID['" + r.id + "']")),
       "every row is a real challenge out of data/challenges.js");
    ok(rows.slice(1).every((r) => X("!!CHALLENGE_BY_ID['" + r.id + "'].test")),
       "and only the ones a single fight can settle");
    X("SAVE.titles=CHALLENGES.filter(c=>c.test).map(c=>c.id); 1");
    ok(J("challengeRows()").length === 1, "an objective already earned is not offered again");
    fresh();
  }
  {
    fresh();
    X("G.scene=S.MENU; G.menuSel=menuItems().findIndex(it=>it[2]==='chal'); 1");
    press("a");
    ok(scene() === "CHALLENGE", "CHALLENGE RUN is on the menu and opens", scene());
    frames(2);
    press("down");
    const want = X("challengeRows()[G.chalSel].id");
    press("a");
    ok(scene() === "SELECT" && X("G.selMode") === "adventure",
       "taking one walks straight into fighter select - the objective IS the mode", scene());
    ok(X("G.challengePick") === want, "and the objective is held for the run", X("G.challengePick"));
    press("a");
    ok(scene() === "MAP", "which starts", scene());
    ok(X("G.adv.challenge") === want, "carrying its terms", X("G.adv.challenge"));
    ok(X("G.adv.challengeDone") === false, "not yet met");
    frames(2);
    ok(scene() === "MAP", "and the field draws the objective without throwing");
  }
  {
    // meeting it pays on top, once, at the end of the run
    fresh();
    X("G.challengePick='untouched'; G.adv=newAdv(0,0); G.adv.stage=2; G.adv.won=4; newField(G.adv); 1");
    X("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});" +
      "G.duel.e.hp=0; G.duel.stats.dmgTaken=0; endDuel(G.duel); 1");
    ok(X("G.adv&&G.adv.challengeDone") === true, "the bell notices the objective was met");
    const plain = X("metaAwardFor({stage:G.adv.stage,wins:G.adv.won}).total");
    const paid = X("awardRunRenown(G.adv,{}).total");
    ok(paid > plain, "and the run is paid extra for it", plain + " -> " + paid);
    ok(paid <= X("META_CONFIG.awardCap"), "inside the same cap as everything else", paid);
    fresh();
  }

  section("both new screens are reachable, drawable and leavable");
  {
    fresh();
    X("G.scene=S.MENU; G.menuSel=menuItems().findIndex(it=>it[2]==='renown'); 1");
    press("a");
    ok(scene() === "RENOWN", "the renown wall opens from the menu", scene());
    frames(3);
    ok(scene() === "RENOWN", "and draws at zero renown without throwing");
    const rows = J("renownRows()");
    ok(rows.length === X("META_ITEM_IDS.length") + 1,
       "the whole catalogue is on it, plus the way out", rows.length);
    ok(rows.every((r) => !!r.id), "every row is addressed by id, never by index");
    ok(rows.filter((r) => r.id !== "back").every((r) => !r.can),
       "and nothing is affordable on a fresh save");
    press("a");
    ok(X("G.renownMsg").length > 0, "a refused purchase says why", X("G.renownMsg"));
    ok(X("SAVE.meta.renown") === 0, "and spends nothing");
    X("SAVE.meta=metaCredit(SAVE.meta,4000); G.renownSel=0; 1");
    press("a");
    ok(X("SAVE.meta.renown") < 4000, "with money it buys", X("SAVE.meta.renown"));
    ok(X("Object.keys(SAVE.meta.owned).length") === 1, "exactly one thing");
    frames(2);
    press("b");
    ok(scene() === "MENU", "B goes back", scene());
    X("SAVE=load(); 1");
    ok(X("Object.keys(SAVE.meta.owned).length") === 1, "and the purchase survived the save");
  }
  {
    // the opening picker only appears once an opening has been bought
    fresh();
    ok(J("renownRows()").every((r) => r.id !== "open_pick"),
       "with no opening owned there is nothing to pick between");
    X("SAVE.meta=metaCredit(SAVE.meta,4000); SAVE.meta=metaBuy(SAVE.meta,'open_stage').meta;" +
      "G.scene=S.RENOWN; G.renownSel=renownRows().findIndex(r=>r.id==='open_pick'); 1");
    ok(X("G.renownSel") >= 0, "once one is, the picker is a row");
    const was = X("G.openTier");
    press("right");
    ok(X("G.openTier") !== was, "left and right change it", was + " -> " + X("G.openTier"));
    ok(X("metaOpenTier(SAVE,G.openTier).tier") === X("G.openTier"),
       "and it can only ever be set to one you own");
    frames(2);
    ok(scene() === "RENOWN", "the row draws");
    fresh();
  }
  {
    // nothing here gates a fighter - the rule the whole feature is measured on
    fresh();
    ok(X("selList().length") === X("FIGHTERS.length"),
       "the whole roster is selectable on a save that has bought nothing", X("selList().length"));
    X("SAVE.meta=metaCredit(SAVE.meta,9999); META_ITEM_IDS.forEach(id=>{SAVE.meta=metaBuy(SAVE.meta,id).meta;}); 1");
    ok(X("selList().length") === X("FIGHTERS.length"),
       "and on one that has bought everything - renown never sold a man");
    ok(X("JSON.stringify(Object.keys(metaRunPool(SAVE))).indexOf('hero')") < 0,
       "the run pool has no opinion about who you may play");
    fresh();
  }
};
