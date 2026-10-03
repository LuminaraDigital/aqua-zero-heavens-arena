/* =====================================================================
   First-playthrough bugs. Title keys, one mastery count, field movement,
   knockout health, settings focus, and a zero-power card pickup.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function (h) {
  const { api, ok, section, frames, press, scene } = h;
  const A = api;
  const PAGE = fs.readFileSync(path.resolve(__dirname, "..", "aqua-zero-heavens-arena.html"), "utf8");

  function cap(draw) {
    A.exec("globalThis.__txt=txt; globalThis.__cap=[]; txt=function(){ __cap.push(String(arguments[0])); return __txt.apply(this, arguments); };");
    draw();
    const lines = A.exec("__cap.slice()");
    A.exec("txt=__txt;");
    return lines;
  }
  function joined(lines) { return lines.join("\n"); }
  function fresh() {
    A.exec("SAVE=DEF_SAVE(); persist(); G.duel=null; G.adv=null; G.scene=S.TITLE; setFocused(true);");
  }
  function keyDoes(key, sc, act) {
    ok(A.Keybindings.arenaAction(key, sc) === act, key + " on " + sc + " is " + act, A.Keybindings.arenaAction(key, sc));
  }

  section("title start keys are the keys the screen names");
  {
    fresh();
    frames(1);
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("[ ENTER ]") >= 0, "the start banner names Enter");
    ok(drawn.indexOf("A / Z - START") >= 0, "the footer names A and Z as start", drawn);
    const spoken = A.exec("SCENE_LABEL[S.TITLE]");
    ok(spoken.indexOf("A") >= 0 && spoken.indexOf("Z") >= 0 && spoken.indexOf("ENTER") >= 0,
       "the accessibility line names A, Z and Enter", spoken);
    ["a", "A", "z", "Z", "Enter", " "].forEach((key) => {
      fresh();
      A.exec("onArenaKey({key:" + JSON.stringify(key) + ",preventDefault:function(){}})");
      ok(scene() === "MENU", "title key " + JSON.stringify(key) + " opens the menu", scene());
    });
    /* A confirms only where the screen says A / Z. On select it still moves. */
    keyDoes("a", "TITLE", "a");
    keyDoes("z", "TITLE", "a");
    keyDoes("Enter", "TITLE", "a");
    keyDoes("a", "SELECT", "left");
    keyDoes("z", "SELECT", "a");
    const legend = A.Keybindings.legendFor("a", "START", "TITLE");
    legend.split(" - ")[0].split(" / ").forEach((label) => {
      const key = { ENTER: "Enter", SPACE: " " }[label] || label.toLowerCase();
      ok(A.Keybindings.arenaAction(key, "TITLE") === "a", "title legend key " + label + " starts");
    });
  }

  section("mastery is one count on the title and on fighter select");
  {
    fresh();
    ok(A.exec("SAVE.unlocked.length") === 3, "a fresh save is handed three starters");
    ok(A.masteredCount() === 0, "and none of them are mastered", A.masteredCount());
    ok(A.exec("fighterMastered(0)") === false, "the first starter has no belt");
    const title = joined(cap(() => { A.exec("G.scene=S.TITLE;"); frames(1); }));
    ok(title.indexOf("0 / 25 FIGHTERS MASTERED") >= 0, "the title says 0 / 25", title);
    ok(title.indexOf("3 / 25") < 0, "the title does not count starters as mastered");
    A.exec("G.selMode='adventure'; G.scene=S.SELECT; G.sel=0;");
    const select = joined(cap(() => frames(1)));
    ok(select.indexOf("0 / 25 MASTERED") >= 0, "fighter select says the same 0 / 25", select);
    ok(select.indexOf("3 / 25") < 0, "fighter select does not count starters either");
    ok(select.indexOf("\u2713") < 0, "and the starter tiles are not ticked");
    A.exec("SAVE.mastery={0:40, 2:39};");
    ok(A.masteredCount() === 1, "forty mastery xp is a belt, thirty-nine is not", A.masteredCount());
    ok(A.exec("fighterMastered(0)") === true && A.exec("fighterMastered(2)") === false, "only the belted fighter counts");
    const title2 = joined(cap(() => { A.exec("G.scene=S.TITLE;"); frames(1); }));
    const select2 = joined(cap(() => { A.exec("G.scene=S.SELECT;"); frames(1); }));
    ok(title2.indexOf("1 / 25 FIGHTERS MASTERED") >= 0, "the title follows the belt", title2);
    ok(select2.indexOf("1 / 25 MASTERED") >= 0, "fighter select follows the same belt", select2);
    ok(select2.indexOf("\u2713") >= 0, "the belted fighter is the one with a tick");
    A.exec("G.scene=S.RECORDS;");
    const records = joined(cap(() => frames(1)));
    ok(records.indexOf("1/25") >= 0, "records uses the same count", records);
  }

  section("the field names the keys that move");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    const move = A.exec("fieldMoveLegend()");
    ok(move === "ARROWS / WASD - MOVE", "the movement legend is arrows and WASD", move);
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("ARROWS / WASD - MOVE") >= 0, "the field screen prints it", drawn);
    ok(drawn.indexOf("EAST") >= 0, "and still says the exit is east");
    const spoken = A.exec("SCENE_LABEL[S.MAP]");
    ok(spoken.indexOf("ARROWS / WASD - MOVE") >= 0, "the accessibility line names the same keys", spoken);
    A.exec("const m=G.adv.map; m.px=5; m.py=5;" +
           "[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ m.g[5+d[1]][5+d[0]]=0; });" +
           "m.foes.forEach(function(f){ f.done=true; });" +
           "(m.patrols||[]).forEach(function(p){ p.used=true; });" +
           "m.cards.forEach(function(c){ c.used=true; });" +
           "m.temples.forEach(function(t){ t.used=true; });" +
           "m.pits=[]; m.camps=[]; (m.gyms||[]).forEach(function(g){ g.used=true; });");
    const step = (key, dx, dy) => {
      A.exec("G.adv.map.px=5; G.adv.map.py=5; G.scene=S.MAP; setFocused(true);");
      A.exec("onArenaKey({key:" + JSON.stringify(key) + ",preventDefault:function(){}})");
      const m = A.G.adv.map;
      ok(m.px === 5 + dx && m.py === 5 + dy, key + " moves on the field", m.px + "," + m.py);
    };
    step("ArrowRight", 1, 0);
    step("ArrowLeft", -1, 0);
    step("ArrowDown", 0, 1);
    step("ArrowUp", 0, -1);
    step("d", 1, 0);
    step("a", -1, 0);
    step("s", 0, 1);
    step("w", 0, -1);
  }

  section("a knockout reports the health the bar shows");
  {
    const begin = () => {
      A.exec("SAVE=DEF_SAVE(); persist(); G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
      A.exec("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    };
    begin();
    ok(A.exec("G.duel.oneShot") === true, "a field patrol is one exchange");
    A.exec("G.duel.p.hp=90; G.duel.e.hp=29; G.duel.pHp0=100; G.duel.eHp0=40;" +
           "G.duel.msg='HIT 11'; G.duel.msg2='LOW ROUNDHOUSE';");
    A.turnEnd(A.G.duel);
    const d = A.G.duel;
    ok(d.e.hp === 0 && d.e.ghost === 0, "the bar is empty after the finish", d.e.hp);
    ok(d.oneShotDrop === true, "the patrol dropped them");
    const line = A.exec("lastAnnouncement()");
    ok(line.indexOf("K.O.") >= 0 && line.indexOf("opponent 0") >= 0, "the result text says K.O. and 0", line);
    ok(line.indexOf("29") < 0, "and it does not keep the pre-drop 29", line);
    ok(A.exec("duelOutcomeWord(G.duel)") === "K.O.", "the banner word is K.O.");
    A.exec("G.scene=S.DUEL; G.duel.ph=D.END;");
    const ko = joined(cap(() => frames(1)));
    ok(ko.indexOf("K.O.") >= 0 && ko.indexOf("OPPONENT 0") >= 0, "the screen prints opponent 0 under the K.O.", ko);
    ok(ko.indexOf("OPPONENT 29") < 0, "the screen does not print 29");

    begin();
    A.exec("G.duel.p.hp=50; G.duel.e.hp=29; G.duel.pHp0=80; G.duel.eHp0=40;" +
           "G.duel.p.tookDamage=true; G.duel.msg='HIT 11'; G.duel.msg2='LOW ROUNDHOUSE';");
    A.turnEnd(A.G.duel);
    const r = A.G.duel;
    ok(r.repel === true && r.e.hp === 29, "a worse exchange leaves them at 29", r.e.hp);
    const driven = A.exec("lastAnnouncement()");
    ok(driven.indexOf("K.O.") < 0, "a non-knockout does not say K.O.", driven);
    ok(driven.indexOf("opponent 29") >= 0, "and it reports the health they still have", driven);
    ok(A.exec("duelOutcomeWord(G.duel)") === "DRIVEN OFF", "the banner says driven off");
    A.exec("G.scene=S.DUEL; G.duel.ph=D.END;");
    const off = joined(cap(() => frames(1)));
    ok(off.indexOf("DRIVEN OFF") >= 0 && off.indexOf("OPPONENT 29") >= 0, "the screen agrees", off);
    ok(off.indexOf("K.O.") < 0, "and the screen does not say K.O.");
  }

  section("closing settings leaves pause on the named key");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP; setFocused(false);");
    const legend = A.Keybindings.legendFor("b", "PAUSE", "MAP");
    ok(legend.indexOf("X") >= 0, "the pause legend names X", legend);
    A.exec("onArenaKey({key:'x',preventDefault:function(){}})");
    ok(scene() === "MAP", "X does nothing while the arena is unfocused", scene());
    A.exec("closeSettingsDrawer();");
    ok(A.exec("arenaFocused()") === true, "closing settings returns focus to the arena");
    A.exec("onArenaKey({key:'x',preventDefault:function(){}})");
    ok(scene() === "PAUSE", "and X opens pause without another click", scene());
    A.exec("G.scene=S.MAP; setFocused(false); closeSettingsDrawer();");
    A.exec("onArenaKey({key:'b',preventDefault:function(){}})");
    ok(scene() === "PAUSE", "B, which the same legend names, opens pause too", scene());
    ok(PAGE.indexOf("closeSettingsDrawer") > 0 && PAGE.indexOf("focusArena") > 0,
       "the built page restores focus when the drawer closes");
  }

  section("a zero-power card is not reported as a gain of 0");
  {
    ok(A.exec("cardGainLine([0,0,1])") === "KURUKURU CARD - GAINED BLOCK",
       "a plain guard names the block", A.exec("cardGainLine([0,0,1])"));
    ok(A.exec("cardGainLine([0,0,4])") === "KURUKURU CARD - GAINED PARRY", "a parry names the parry");
    ok(String(A.exec("cardGainLine([0,0,1])")).indexOf("0") < 0, "the guard line has no zero");
    ok(A.exec("cardGainLine([12,0,16])") === "KURUKURU CARD - GAINED STRIKE 12", "a strike still reports its power");
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    A.exec("(function(){ var m=G.adv.map; m.px=4; m.py=4; m.g[4][5]=0;" +
           "m.foes.forEach(function(f){ f.done=true; });" +
           "(m.patrols||[]).forEach(function(p){ p.used=true; });" +
           "m.cards=[{x:5,y:4,used:false,key:'cZ'}];" +
           "m.temples.forEach(function(t){ t.used=true; }); m.pits=[]; m.camps=[];" +
           "(m.gyms||[]).forEach(function(g){ g.used=true; }); })();");
    press("right");
    const msg = A.G.adv.map.msg || "";
    ok(msg.indexOf("GUARD 0") < 0 && !/GAINED [A-Z]+ 0\b/.test(msg),
       "picking the card up does not say gained 0", msg);
    ok(msg.indexOf("KURUKURU CARD") >= 0, "the pickup still announces the card", msg);
  }

  section("the menu footer names keys that do what it says");
  {
    fresh();
    A.exec("G.scene=S.MENU; G.menuSel=0; G.menuTab=0;");
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("A - SELECT") < 0, "the menu no longer says A selects");
    ok(drawn.indexOf("Z / ENTER - SELECT") >= 0, "it names Z and Enter, which select", drawn);
    ok(drawn.indexOf("Y / C - NEXT TAB") >= 0, "and Y, which changes tab", drawn);
    ok(drawn.indexOf("B / ESC - TITLE") >= 0, "and B, which returns to the title", drawn);
    A.exec("setFocused(true); onArenaKey({key:'z',preventDefault:function(){}})");
    ok(scene() === "SELECT", "Z selects the highlighted row", scene());
  }
};
