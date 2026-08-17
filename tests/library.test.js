/* =====================================================================
   The training library update: the imported technique dex, unique kits,
   the open roster, leaderboards, the profile name, and the arena.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function (h) {
  const { api, ok, section, frames, press, scene } = h;
  const A = api;

  section("the technique dex covers the library");
  ok(A.TECH_IDS.length >= 350, "the dex holds the books' techniques", A.TECH_IDS.length + " techniques");
  {
    const ground = A.TECH_IDS.filter((id) => A.TECH[id].range === "GROUND");
    ok(ground.length >= 100, "the ground game is deep", ground.length + " ground techniques");
    const subs = ground.filter((id) => A.TECH[id].cls === "SUB");
    ok(subs.length >= 30, "with a real submission arsenal", subs.length + " submissions");
    const sweeps = A.TECH_IDS.filter((id) => A.TECH[id].flags.indexOf("sweep") >= 0);
    ok(sweeps.length >= 10, "and sweeps to reverse position", sweeps.length);
  }
  {
    // every discipline a fighter can hold has real coverage
    const discCount = {};
    A.TECH_IDS.forEach((id) => { const d = A.TECH[id].disc; if (d) discCount[d] = (discCount[d] || 0) + 1; });
    const short = Object.keys(A.DISCIPLINES).filter((d) => (discCount[d] || 0) < 5);
    ok(short.length === 0, "every discipline has at least 5 techniques", short.join(",") || "none short");
  }
  {
    // imported entries carry sane derived stats
    let bad = 0;
    A.TECH_IDS.forEach((id) => {
      const t = A.TECH[id];
      if (t.cls !== "GUARD" && t.cls !== "SETUP" && (t.power < 2 || t.power > 60)) bad++;
      if (t.acc < 5 || t.acc > 100) bad++;
      if (t.learn < 1 || t.learn > 9) bad++;
    });
    ok(bad === 0, "every technique's numbers are in range", bad + " out of range");
  }

  section("every fighter has a unique kit");
  {
    let thin = [];
    for (let i = 0; i < A.FIGHTERS.length; i++)
      if (A.knownTechs(i, 9).length < 20) thin.push(A.FIGHTERS[i].name);
    ok(thin.length === 0, "everyone has a full movelist at level 9", thin.join(",") || "none thin");
  }
  {
    // two fighters sharing disciplines still finish differently
    const kits = {};
    for (let i = 0; i < A.FIGHTERS.length; i++) kits[i] = A.exec("exclusiveOf(" + i + ")");
    let identical = 0, pairs = 0;
    for (let a = 0; a < A.FIGHTERS.length; a++) for (let b = a + 1; b < A.FIGHTERS.length; b++) {
      const da = A.disciplinesOf(a).join(), db = A.disciplinesOf(b).join();
      if (da !== db) continue;
      pairs++;
      if (JSON.stringify(kits[a]) === JSON.stringify(kits[b])) identical++;
    }
    ok(pairs === 0 || identical < pairs, "same-style fighters own different elite kits",
       identical + "/" + pairs + " identical");
    const eliteLeak = [];
    for (let i = 0; i < A.FIGHTERS.length; i++) {
      const kit = kits[i];
      A.knownTechs(i, 9).forEach((id) => {
        if (A.TECH[id].learn >= 7 && kit.indexOf(id) < 0) eliteLeak.push(A.FIGHTERS[i].name + ":" + id);
      });
    }
    ok(eliteLeak.length === 0, "elite techniques outside the kit stay locked", eliteLeak.slice(0, 3).join(","));
  }
  {
    // the user's complaint: grapplers must actually have mat techniques
    let missing = [];
    const grapDiscs = ["bjj", "wrestling", "sambo", "judo", "grappling", "subgrap", "jiujitsu"];
    for (let i = 0; i < A.FIGHTERS.length; i++) {
      if (!A.disciplinesOf(i).some((d) => grapDiscs.indexOf(d) >= 0)) continue;
      const ground = A.knownTechs(i, 9).filter((id) => A.TECH[id].range === "GROUND");
      if (ground.length < 8) missing.push(A.FIGHTERS[i].name + "(" + ground.length + ")");
    }
    ok(missing.length === 0, "every grappler carries a real ground game", missing.join(",") || "all covered");
  }

  section("the whole roster is playable");
  {
    A.exec("SAVE=DEF_SAVE(); persist(); G.scene=S.MENU; G.menuSel=0;");
    // fresh save has only 3 mastered - pick fighter #10 in exhibition anyway
    const items = A.menuItems();
    const vs = items.findIndex((it) => it[2] === "vs");
    ok(vs >= 0, "exhibition is on the menu");
    A.exec("G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=10;");
    press("a");                                       // P1 = fighter 10 (never a starter)
    A.exec("G.sel=17;");
    press("a");                                       // P2 = fighter 17
    ok(scene() === "DUEL", "a locked-in-the-old-build fighter starts a duel", scene());
    ok(A.G.duel.p.fid === 10, "and you actually fight AS that fighter", A.G.duel.p.fid);
    ok(A.G.duel.e.fid === 17, "against the one you chose", A.G.duel.e.fid);
    ok(A.G.duel.p.techs.length >= 20, "with their own movelist", A.G.duel.p.techs.length);
    A.exec("G.duel=null; G.scene=S.MENU;");
  }

  section("leaderboards");
  {
    A.exec("G.scene=S.MENU; G.menuSel=0;");
    const items = A.menuItems();
    ok(items.some((it) => it[2] === "board"), "the menu offers leaderboards");
    A.exec("G.scene=S.BOARD; G.boardTab=0;");
    frames(3);
    ok(scene() === "BOARD", "the board renders without throwing");
    press("right");
    frames(2);
    ok(A.G.boardTab === 1, "and switches to the hall of records");
    press("a");
    ok(scene() === "MENU", "A returns to the menu");
  }

  section("profile name");
  {
    // find the row by id - hardcoding the index made this test a tripwire for
    // any new option rather than a test of the name prompt
    A.exec("G.scene=S.OPTIONS; G.optSel=optionRows().findIndex(r=>r.id==='name'); window.prompt=()=>'lumi the great';");
    press("a");
    ok(A.getSave().name === "LUMI THE GREAT", "the name is set, cleaned and persisted", A.getSave().name);
    A.exec("window.prompt=()=>null;");
    press("a");
    ok(A.getSave().name === "LUMI THE GREAT", "cancelling keeps the old name");
    A.exec("delete window.prompt; SAVE=DEF_SAVE(); persist(); G.scene=S.MENU;");
  }

  section("the arena ships in the page");
  {
    const page = fs.readFileSync(path.resolve(__dirname, "..", "aqua-zero-heavens-arena.html"), "utf8");
    ok(/^const ARENA_SRC="data:image\/png;base64,/m.test(page), "the ring render is embedded");
    ok(/^const LOGO_SRC="data:image\/png;base64,/m.test(page), "the brand mark is still embedded");
  }
};
