/* =====================================================================
   Navigation: B always does something, every mode can be left, and the
   help you can reach describes the game you are actually playing.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section, frames, press, scene, phase } = h;
  const A = api;

  const toDuel = () => {
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=null; G.surv=null; G.duel=null;" +
           "startDuel({p1:0,p1hp:120,p1pool:battlePool(0,9),oppFid:1,oppHp:120," +
           "oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);                                   // clear the walkout and the bell
  };

  section("B opens the fight menu");
  {
    toDuel();
    ok(phase() === "CMD", "the fight is waiting on your command", phase());
    press("b");
    ok(phase() === "MENU", "B opens the fight menu mid-fight", phase());
    press("b");
    ok(phase() === "CMD", "B again resumes exactly where you were", phase());
  }
  {
    // and from the other choosing phases
    toDuel();
    A.exec("G.duel.ph=D.INTRO;");
    press("b");
    ok(phase() === "MENU", "B works during the announce");
    press("b");
    toDuel();
    A.exec("G.duel.ph=D.END; G.duel.t=0;");
    press("b");
    ok(phase() === "MENU", "and on the K.O. screen");
  }
  {
    // the technique list is not behind a category any more - it IS the
    // command menu, and left/right filter it without leaving the screen
    toDuel();
    press("right");
    ok(phase() === "CMD" && A.G.duel.cmdCat === 1,
       "left and right filter the list in place", phase() + " tab " + A.G.duel.cmdCat);
    A.exec("G.duel.ph=D.TECH;");
    press("b");
    ok(phase() === "CMD", "the old second step folds back into the one menu", phase());
  }

  section("how to fight is reachable from the fight");
  {
    toDuel();
    press("b");
    A.exec("G.duel.menuSel=1;");
    press("a");
    ok(scene() === "HOW", "the fight menu opens the rules", scene());
    ok(A.G.howTopic === "fight", "on the fight topic", A.G.howTopic);
    frames(2);
    press("b");
    ok(scene() === "DUEL", "and hands you back to the fight", scene());
    ok(phase() === "CMD", "resumed where you left off, not in the menu", phase());
  }

  section("forfeiting is a loss, not an escape");
  {
    // ranked: walking away still costs grade
    A.exec("SAVE=DEF_SAVE(); persist();");
    A.exec("rankApi().applyMatchRanking('seed',{winnerId:YOU,loserId:'cpu:5',matchType:'ranked'});");
    A.exec("rankApi().applyMatchRanking('seed2',{winnerId:YOU,loserId:'cpu:6',matchType:'ranked'});");
    const before = A.myRanking().promotionPoints;
    A.exec("G.duel=null; startRanked(0);");
    frames(700);
    press("b");
    A.exec("G.duel.menuSel=2;");
    press("a");                                    // arms the confirm
    ok(A.G.duel && A.G.duel.quitArm === 1, "the first press only arms the forfeit");
    press("a");                                    // confirms
    const after = A.myRanking().promotionPoints;
    ok(scene() === "RESULT", "forfeiting ends the match", scene());
    ok(after < before, "and it costs ladder points like any loss", before + " -> " + after);
    ok(A.getSave().rec.losses >= 1, "the loss is recorded");
  }
  {
    // exhibition: forfeit just leaves, nothing at stake
    A.exec("SAVE=DEF_SAVE(); persist(); G.duel=null;" +
           "startDuel({p1:2,p1hp:100,p1pool:battlePool(2,9),oppFid:3,oppHp:100," +
           "oppPool:battlePool(3,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);
    press("b");
    A.exec("G.duel.menuSel=2;");
    press("a"); press("a");
    ok(scene() === "RESULT", "an exhibition forfeit resolves too", scene());
    press("a");
    ok(scene() === "MENU", "and drops you back to the menu", scene());
  }

  section("B is never a dead key");
  {
    const probe = (setup, label, expect) => {
      A.exec(setup);
      frames(1);
      const from = scene() + ":" + (A.G.duel ? A.G.duel.ph : "-") + ":" + A.G.how;
      press("b");
      const to = scene() + ":" + (A.G.duel ? A.G.duel.ph : "-") + ":" + A.G.how;
      ok(from !== to, label, from + " -> " + to);
      if (expect) ok(scene() === expect, label + " lands on " + expect, scene());
    };
    probe("SAVE=DEF_SAVE(); G.duel=null; G.adv=null; G.scene=S.TITLE;", "title offers help", "HOW");
    probe("G.scene=S.MENU; G.menuSel=0;", "menu backs to the title", "TITLE");
    probe("G.scene=S.HOW; G.howTopic='general'; G.how=0; G.prevScene=S.MENU;", "help backs out", "MENU");
    probe("G.scene=S.RECORDS;", "records back out", "MENU");
    probe("G.scene=S.BOARD; G.boardTab=0;", "boards back out", "MENU");
    probe("G.scene=S.OPTIONS; G.optSel=0;", "options back out", "MENU");
    probe("G.selMode='vs1'; G.scene=S.SELECT; G.sel=0;", "select backs out", "MENU");
    probe("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;", "the map pauses", "PAUSE");
    probe("G.scene=S.PAUSE; G.pauseSel=0;", "pause resumes", "MAP");
    probe("G.scene=S.STAGECLEAR;", "stage clear can be paused", "PAUSE");
  }

  section("the help matches the game that exists");
  {
    A.exec("G.howTopic='fight'; G.how=0;");
    const pages = A.exec("howPages()");
    ok(pages.length >= 2, "the fight topic has real depth", pages.length + " pages");
    const text = JSON.stringify(pages).toUpperCase();
    ok(text.indexOf("ROULETTE") < 0, "no stale roulette instructions survive");
    ok(text.indexOf("HAND OF 4") < 0, "no stale card-hand instructions survive");
    ok(/STRIKE/.test(text) && /GRAPPLE/.test(text) && /SIGNATURE/.test(text), "the four categories are explained");
    ok(/KICKING/.test(text) && /CLINCH/.test(text) && /GROUND/.test(text), "range is explained");
    ok(/STAMINA/.test(text), "stamina is explained");
    ok(/FORFEIT/.test(text), "and it tells you how to leave");
    A.exec("G.howTopic='adventure'; G.how=0;");
    ok(A.exec("howPages()").length >= 1, "adventure has its own topic");
    A.exec("G.howTopic='general'; G.how=0;");
    const gen = JSON.stringify(A.exec("howPages()")).toUpperCase();
    ok(/RANKED/.test(gen) && /SURVIVAL/.test(gen) && /EXHIBITION/.test(gen), "every mode is described");
  }

  section("the pad tells you what the buttons do");
  {
    toDuel();
    let hint = A.exec("hintFor()");
    ok(hint.b === "FIGHT MENU", "in a fight, B is advertised as the fight menu", hint.b);
    ok(!!hint.a, "and A has a label", hint.a);
    A.exec("G.duel.ph=D.TECH;");
    hint = A.exec("hintFor()");
    ok(hint.b === "BACK", "in the technique list B reads as back", hint.b);
    A.exec("G.duel=null; G.adv=null; G.scene=S.MAP; G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    hint = A.exec("hintFor()");
    ok(hint.b === "PAUSE MENU", "on the map B reads as the pause menu", hint.b);
    ok(hint.y === "YOUR DOSSIER", "and Y is labelled too", hint.y);
    A.exec("G.scene=S.MENU;");
    ok(A.exec("hintFor()").b === "TITLE", "the label follows the scene");
    ok(A.exec("typeof syncHint") === "function", "and the pad is synced every frame");
  }

  section("legends are read off the binding table");
  {
    const K = A.Keybindings;
    ok(A.exec("KMAP===Keybindings.ARENA_KEYS"), "the page's key map IS the module's table, not a copy");
    /* the bug: fighter select promised A - CONFIRM while the a key moved the cursor */
    ok(K.arenaAction("a", "SELECT") === "left", "the a key is a cursor key", K.arenaAction("a", "SELECT"));
    ok(K.arenaAction("z", "SELECT") === "a" && K.arenaAction("Enter", "SELECT") === "a" && K.arenaAction(" ", "SELECT") === "a",
       "Z, Enter and Space are what confirm");
    ok(K.legendFor("a", "CONFIRM", "SELECT") === "Z / ENTER - CONFIRM",
       "so the legend names the keys that confirm, and not the A key that moves", K.legendFor("a", "CONFIRM", "SELECT"));
    /* every key a legend names must resolve to the action it is a legend
       for, on the scene it is printed on - the check that fails if a string
       and the table ever part ways again */
    const scenes = ["TITLE", "MENU", "SELECT", "MAP", "BRIEF", "DUEL", "RESULT", "OPTIONS", "HOW", ""];
    const raw = { SPACE: " ", ENTER: "Enter", ESC: "Escape", BKSP: "Backspace" };
    const bad = [];
    scenes.forEach((sc) => ["a", "b", "y", "diff", "rand", "code"].forEach((act) => {
      const keys = K.arenaKeysFor(act, sc);
      /* the face buttons always have a key; difficulty, random and code
         are only offered on some scenes and must name nothing elsewhere */
      if (!keys.length && (act === "a" || act === "b" || act === "y")) bad.push(sc + ":" + act + ":no key");
      keys.forEach((label) => {
        const key = raw[label] || label.toLowerCase();
        if (K.arenaAction(key, sc) !== act) bad.push(sc + ":" + act + ":" + label);
      });
      if (keys.length && K.legendFor(act, "VERB", sc).indexOf(keys[0]) < 0) bad.push(sc + ":" + act + ":legend");
      if (!keys.length && K.legendFor(act, "VERB", sc) !== "VERB") bad.push(sc + ":" + act + ":phantom key");
    }));
    ok(bad.length === 0, "every key a legend names does what the legend says, on that scene", bad.join(",") || "clean");
    ok(K.legendFor("b", "BACK", "SELECT") === "B / ESC - BACK",
       "on select X cycles difficulty, so B's key is ESC there", K.legendFor("b", "BACK", "SELECT"));
    ok(K.legendFor("diff", "DIFFICULTY", "SELECT") === "X - DIFFICULTY",
       "and the difficulty legend names only X there", K.legendFor("diff", "DIFFICULTY", "SELECT"));
    ok(K.legendFor("diff", "DIFFICULTY", "TITLE") === "X - DIFFICULTY",
       "the title cycles difficulty with X, and D stays a movement key", K.legendFor("diff", "DIFFICULTY", "TITLE"));
    ok(K.legendFor("b", "BACK", "DUEL") === "B / X - BACK", "and in a fight X is back again", K.legendFor("b", "BACK", "DUEL"));
    ok(K.legendFor("y", "DOSSIER", "SELECT") === "Y / C - DOSSIER", "Y is C on the keyboard", K.legendFor("y", "DOSSIER", "SELECT"));
    /* the page helpers read the live scene */
    A.exec("SAVE=DEF_SAVE(); persist(); G.duel=null; G.adv=null; G.selMode='adventure'; G.scene=S.SELECT; G.sel=0;");
    ok(A.exec('LG("a","CONFIRM")') === K.legendFor("a", "CONFIRM", "SELECT"), "LG() on select is the select legend");
    ok(A.exec('KH("a")') === "Z / ENTER", "and KH() is the key head for a PRESS prompt", A.exec('KH("a")'));
    ok(A.exec('LGJ(LG("a","CONFIRM"),"",LG("b","BACK"))') === "Z / ENTER - CONFIRM   \u00B7   B / ESC - BACK",
       "LGJ() joins with the footer's dot and drops blanks", A.exec('LGJ(LG("a","CONFIRM"),"",LG("b","BACK"))'));
    /* and the keys do what the footer now says: a moves, Z confirms */
    frames(1);
    const sel0 = A.G.sel;
    press(K.arenaAction("a", "SELECT"));
    ok(scene() === "SELECT" && A.G.sel !== sel0, "pressing the a key moves the cursor", scene() + " sel " + A.G.sel);
    press(K.arenaAction("z", "SELECT"));
    ok(scene() === "MAP", "pressing Z confirms the fighter", scene());
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=null; G.duel=null; G.selMode='adventure'; G.scene=S.SELECT; G.sel=0; setFocused(true);");
    A.exec("onArenaKey({key:'Enter',code:'Enter',preventDefault:function(){}})");
    ok(scene() === "MAP", "Enter confirms the fighter the footer names", scene());
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=null; G.duel=null; G.selMode='adventure'; G.scene=S.SELECT; G.sel=0; setFocused(true);");
    A.exec("onArenaKey({key:'NumpadEnter',code:'NumpadEnter',preventDefault:function(){}})");
    ok(scene() === "MAP", "the numpad Enter confirms too", scene());
    /* the on-screen pad's key captions come from the same table */
    A.exec("G.scene=S.SELECT;");
    ok(K.arenaKeysFor("a", "SELECT")[0] === "Z" && K.arenaKeysFor("b", "SELECT")[0] === "B",
       "the pad captions read Z and B on select", K.arenaKeysFor("b", "SELECT").join(","));
    ok(K.arenaKeysFor("b", "SELECT").indexOf("ESC") >= 0, "and ESC still goes back there");
    /* the controls page prints the derived strings, not hand-written ones */
    const how = A.exec("JSON.stringify(HOW_TOPICS)");
    ok(how.indexOf(K.legendFor("a", "CONFIRM")) >= 0, "the controls page prints the derived confirm legend");
    ok(how.indexOf("A (Z)") < 0 && how.indexOf("C / Y  -") < 0, "and none of the old hand-written ones");
    /* on a pad the keyboard half is dropped */
    K.setInputDevice("gamepad");
    ok(K.legendFor("a", "CONFIRM", "SELECT") === "(A) - CONFIRM", "a pad legend is the pad glyph", K.legendFor("a", "CONFIRM", "SELECT"));
    K.setInputDevice("keyboard");
  }
};
