/* =====================================================================
   Game tests - roster, saves, the adventure loop, modes and the soak.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const PAGE = fs.readFileSync(path.resolve(__dirname, "..", "aqua-zero-heavens-arena.html"), "utf8");

module.exports = function (h) {
  const { api, ok, section, frames, press, scene } = h;
  const A = api;
  const toMenu = () => { A.G.scene = A.S.TITLE; frames(1); press("a"); };
  const menuPick = (key) => {
    toMenu();
    /* the menu is grouped into tabs, so a row is addressed by its key and the
       cursor lands on whichever tab holds it */
    if (!A.menuGoTo(key)) throw new Error("no menu item " + key);
    press("a");
  };

  section("boot and roster");
  frames(120);
  ok(scene() === "TITLE", "boots to TITLE without waiting on art", scene());
  ok(A.FIGHTERS.length === 25, "roster is 25 fighters", A.FIGHTERS.length);
  ok(!A.FIGHTERS.some((f) => f.name === "Solifer"), "no non-human fighter on the roster");
  ok(Object.keys(A.ART).length === 25 && Object.keys(A.BIOS).length === 25, "art and dossiers match the roster");
  ok(A.FIGHTERS[A.BOSS_ID].name === "Ogun Celsus" && A.FIGHTERS[A.BOSS_ID].role === "boss",
     "Ogun Celsus is the final boss");
  ok(A.FIGHTERS.every((f) => !!A.BIOS[f.name]), "every fighter has a dossier");

  section("branding is clean");
  ok(!/solifer|tekken|wonderswan|cartridge|card challenge/i.test(PAGE), "no legacy wording in the shipped page");
  ok(PAGE.indexOf("Aqua Zero Heavens Arena") > 0 && PAGE.indexOf("Luminara Digital") > 0, "brand present");

  section("keyboard focus gating");
  ok(PAGE.includes("if(!gameFocused) return;"), "keydown bails when the arena is not focused");
  ok(PAGE.indexOf("e.preventDefault(); onKey(k);") > PAGE.indexOf("if(!gameFocused) return;"),
     "preventDefault only after the focus check");

  section("adventure");
  menuPick("adv");
  ok(scene() === "SELECT", "menu -> select");
  press("a");
  ok(scene() === "MAP", "select -> map");
  const a = A.G.adv;
  ok(a.maxhp === A.hpOf(a.hero), "hero HP comes from traits", a.maxhp);
  ok(a.map.steps === 60, "60 steps");
  ok(!!A.getSave().run, "the run is persisted immediately");

  section("out of steps costs you");
  {
    const hp0 = a.hp;
    a.map.steps = 1;
    A.onKey("right"); frames(2);
    ok(scene() === "RESULT" && A.G.result.kind === "steps", "running out of steps hits the result screen");
    ok(a.hp < hp0 && a.hp !== a.maxhp, "it costs HP and grants no free heal", hp0 + " -> " + a.hp);
    press("a");
    ok(scene() === "MAP", "back to a re-rolled field");
  }

  section("cleared content stays cleared");
  {
    const f = a.map.foes[0]; f.done = true; a.beaten[f.key] = 1;
    const t = a.map.temples[0]; t.used = true; a.used[t.key] = 1;
    a.reroll++; A.newField(a);
    ok(a.map.foes.find((x) => x.key === f.key).done === true, "a beaten foe does not respawn");
    ok(a.map.temples.find((x) => x.key === t.key).used === true, "a used temple does not come back");
  }

  section("the field hunts you");
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    const m = A.G.adv.map, foe = m.foes[0];
    foe.x = m.px + 3; foe.y = m.py; foe.done = false;
    const before = Math.abs(foe.x - m.px) + Math.abs(foe.y - m.py);
    A.huntStep(m);
    ok(Math.abs(foe.x - m.px) + Math.abs(foe.y - m.py) < before, "a foe in range closes in");
    ok(foe.hunting === true, "and is flagged as hunting");
  }

  section("saves");
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); G.adv.stage=4; G.adv.level=5; newField(G.adv); saveRun();");
    const raw = A.localStore.get("azha_save");
    ok(!!raw, "written to localStorage");
    const parsed = JSON.parse(raw);
    ok(parsed.v === 4 && parsed.run.adv.stage === 4, "versioned, and the run carries", parsed.v);
    A.exec("G.adv=null; SAVE=load(); resumeRun();");
    ok(A.G.adv && A.G.adv.stage === 4 && A.G.scene === A.S.MAP, "a reload resumes the run");
    ok(A.menuTabItems(0)[0][2] === "cont", "CONTINUE RUN heads the FIGHT tab");
  }
  {
    A.localStore.delete("azha_save");
    A.localStore.set("azx_save", JSON.stringify({ v: 2, unlocked: [0, 1, 2, 23, 24, 25],
                                                  defeats: { 24: 2 }, fr: { 25: { w: 3, l: 1 } }, rec: { wins: 7 } }));
    A.exec("SAVE=load();");
    const s = A.getSave();
    ok(s.v === 4, "a legacy save upgrades");
    ok(!!s.mastery && Array.isArray(s.titles), "and gains the mastery and title fields");
    ok(JSON.stringify(s.unlocked) === JSON.stringify([0, 1, 2, 23, 24]),
       "roster indices remap across the cut", JSON.stringify(s.unlocked));
    ok(s.rec.wins === 7 && !!s.fr[24], "records and per-fighter history survive");
    A.exec("persist();");
    ok(!!A.localStore.get("azha_save"), "and re-persist under the current key");
    A.exec("SAVE=DEF_SAVE(); persist();");
  }
  {
    A.localStore.delete("azha_save_backups");
    A.exec("SAVE=DEF_SAVE(); SAVE.name='VAULT'; persist();");
    ok(!!A.localStore.get("azha_save_backups"), "persist also writes the backup vault");
    const vault = JSON.parse(A.localStore.get("azha_save_backups"));
    ok(Array.isArray(vault.snaps) && vault.snaps.length >= 1, "vault holds at least one snapshot");
  }

  section("modes reachable");
  {
    menuPick("ranked");
    ok(scene() === "SELECT", "ranked -> fighter select");
    press("a");
    ok(scene() === "DUEL" && A.G.duel.ranked, "ranked starts a graded duel");
    ok(typeof A.G.duel.oppRankIndex === "number", "with a graded opponent", A.G.duel.oppRankIndex);
    let g = 0; while (A.G.scene === A.S.DUEL && g < 40000) { A.onKey("a"); A.step(); A.render(); g++; }
    ok(A.G.scene === A.S.RESULT, "and resolves", scene());
    ok(["rankwin", "rankloss"].includes(A.G.result.kind), "into a ranked result", A.G.result.kind);
    ok(A.myRanking().totalMatches === 1, "which moves the ladder", A.myRanking().rank.title);
  }
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=null; G.surv=null; G.duel=null;");
    /* the gauntlet row used to carry the key "surv" and start the stripped
       survival loop while advertising the endless one; it now reaches the mode
       its own blurb describes. The mode itself is shelved off the default
       menu (plan item C3): the flag is a build-time var, but the harness runs
       the real page, so the launch is reached the way a flag build reaches it,
       by flipping the gate before menuPick and restoring it after. */
    A.exec("AZHA_SHELVED_MODES = true;");
    menuPick("endless"); press("a");
    A.exec("AZHA_SHELVED_MODES = false;");
    ok(scene() === "DUEL" && A.G.duel.endless, "the gauntlet starts", scene());
    ok(!!A.G.endless && A.G.endless.wave >= 1, "with a gauntlet run behind it");
    let g = 0; while (A.G.scene === A.S.DUEL && g < 40000) { A.onKey("a"); A.step(); A.render(); g++; }
    ok(["endlesswin", "endlessloss", "gauntletvictory"].includes(A.G.result.kind),
      "the gauntlet resolves", A.G.result.kind);
  }
  {
    A.exec("G.vsHotseat=true; G.vsP1=0; G.selMode='vs2'; G.scene=S.SELECT; G.sel=1;");
    press("a");
    ok(scene() === "DUEL" && A.G.duel.hotseat, "hot-seat starts");
    frames(700);
    ok(!A.G.duel.eTech, "player two's technique is not chosen by the CPU");
    let g = 0; while (A.G.scene === A.S.DUEL && g < 40000) { A.onKey("a"); A.step(); A.render(); g++; }
    ok(A.G.scene === A.S.RESULT && A.G.result.hotseat, "hot-seat resolves", A.G.result.kind);
  }

  section("pause and continues");
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv); saveRun(); G.scene=S.MAP;");
    press("b");
    ok(scene() === "PAUSE", "B on the map pauses");
    A.G.pauseSel = 3; press("a");
    ok(scene() === "MENU" && !A.G.adv && !A.getSave().run, "abandon clears the run");
    A.exec("SAVE.diff=0; G.adv=newAdv(0,0); newField(G.adv); G.adv.hp=1;");
    ok(A.G.adv.continues === 3, "rookie grants 3 continues");
    A.exec("G.result={kind:'ko',cont:true}; G.scene=S.RESULT;");
    press("a");
    ok(scene() === "MAP" && A.G.adv.continues === 2 && A.G.adv.hp > 1, "a continue puts you back at 60% HP");
    A.exec("SAVE.diff=1;");
  }

  section("boss and ending");
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); G.adv.level=9; G.adv.points=90; newField(G.adv); G.scene=S.MAP;");
    ok(A.G.adv.map.ogre === true, "level 9 opens the Heavens Gate field");
    A.exec("G.brief={f:{boss:true},t:0}; G.scene=S.BRIEF;");
    press("a");
    ok(scene() === "DUEL" && A.G.duel.boss, "the tower starts the final bout");
    ok(A.G.duel.e.deck.length === 5, "the champion fights on the sealed record");
    A.exec("G.duel.e.hp=1; G.duel.p.maxhp=9999; G.duel.p.hp=9999;");
    let g = 0; while (A.G.scene === A.S.DUEL && g < 40000) { A.onKey("a"); A.step(); A.render(); g++; }
    ok(A.G.scene === A.S.CREDITS || A.G.scene === A.S.RESULT, "the bout resolves", scene());
    if (A.G.scene === A.S.CREDITS) {
      ok(A.getSave().unlocked.includes(A.BOSS_ID), "the champion joins the roster");
      ok((A.getSave().rec.ngplus || 0) >= 1, "New Game+ unlocks");
    }
  }

  section("40,000 frames of random input");
  {
    A.exec("SAVE=DEF_SAVE(); persist(); G.scene=S.TITLE; G.adv=null; G.surv=null; G.duel=null;");
    const keys = ["up", "down", "left", "right", "a", "a", "a", "b", "y"];
    const seen = new Set();
    let err = null;
    try {
      for (let i = 0; i < 40000; i++) {
        if (i % 3 === 0) A.onKey(keys[(Math.random() * keys.length) | 0]);
        A.step(); A.render();
        seen.add(A.G.scene);
        const d = A.G.duel;
        if (d) {
          if (d.p.hp < 0 || d.e.hp < 0) throw new Error("negative HP at frame " + i);
          if (d.p.hp > d.p.maxhp) throw new Error("HP above max at frame " + i);
          if (d.p.stam < 0 || d.p.stam > d.p.maxStam) throw new Error("stamina out of range at frame " + i);
        }
        if (A.G.adv && (A.G.adv.hp < 0 || A.G.adv.hp > A.G.adv.maxhp))
          throw new Error("adventure HP out of range at frame " + i);
      }
    } catch (e) { err = e; }
    ok(!err, "no exception and no impossible state", err && err.message);
    ok(seen.size >= 7, "random play reaches many scenes", seen.size + " scenes");
  }

  section("accessibility and data");
  ok(PAGE.includes('role="status"') && PAGE.includes('aria-live="polite"'), "live region present");
  ok(PAGE.includes('cv.setAttribute("aria-label"'), "canvas label follows the scene");
  ok(PAGE.includes("prefers-reduced-motion: reduce"), "reduced motion respected in JS");
};
