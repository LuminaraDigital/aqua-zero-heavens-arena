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
      /* The first two stage-one fights of a fresh run are a lesson and
         are not one exchange. This is a later patrol. */
      A.exec("G.adv.fights=2; SAVE.rec.duels=3;");
      A.exec("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    };
    begin();
    ok(A.exec("G.duel.lessonFight") === false, "a later patrol is not a lesson");
    ok(A.exec("G.duel.oneShot") === true, "a later field patrol is one exchange");
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

  section("a patrol in the ring is lit like the player");
  {
    ok(A.exec("ringSilhouette()") === false, "the ring does not ask for a black silhouette");
    ok(PAGE.indexOf("function ringSilhouette(){ return false; }") > 0, "the built page keeps that rule");
    ok(PAGE.indexOf("ringSilhouette(d)") > 0 && PAGE.indexOf("ringSilhouette(f)") > 0,
       "the brief, the tape and the ring all ask it");
    ok(PAGE.indexOf("true, d.tf") < 0 && PAGE.indexOf("true, f.tf") < 0 && PAGE.indexOf("true,!!d.tf") < 0,
       "none of them pass the patrol flag as the black-paint switch");
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv);");
    A.exec("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    ok(A.exec("oppName(G.duel)") === "AZX FORCE", "the name is still AZX FORCE");
    ok(A.exec("G.duel.e.fid") >= 0 && A.exec("FIGHTERS[G.duel.e.fid].name") !== "AZX FORCE",
       "and the body is a roster fighter's art", A.exec("FIGHTERS[G.duel.e.fid].name"));
  }

  section("the field shows the exit and the next step");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    const route = A.exec("(function(){ var m=G.adv.map; var r=fieldRoute(m); var walls=0;" +
      "(r.path||[]).forEach(function(p){ if(m.g[p.y]&&m.g[p.y][p.x]) walls++; });" +
      "return {n:(r.path||[]).length, walls:walls, kind:r.dest&&r.dest.kind, ex:fieldExit(m).x, ey:m.exitY}; })()");
    ok(route.n > 1, "a fresh field has a path off the start tile", route.n);
    ok(route.walls === 0, "and that path does not step on a wall", route.walls);
    ok(["FORCE", "RIVAL", "CAMP", "GYM", "TEMPLE", "CARD", "EXIT", "TOWER"].indexOf(route.kind) >= 0,
       "the path ends on a node or the exit", route.kind);
    ok(route.ex === 14, "the exit sits on the east edge", route.ex);
    const capLine = A.exec("fieldRouteCaption(G.adv.map)");
    ok(capLine.indexOf("NEXT:") >= 0 && capLine.indexOf("EXIT:") >= 0, "the caption names the next node and the exit", capLine);
    ok(capLine.indexOf("EAST") >= 0 || capLine.indexOf("TOWER") >= 0, "and which way the exit is", capLine);
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("ARROWS / WASD - MOVE") >= 0, "the movement hint stays", drawn);
    ok(drawn.indexOf("NEXT:") >= 0 && drawn.indexOf("EXIT:") >= 0, "the field prints the route", drawn);
    const pal = A.exec("mapPalette(false)");
    ok(pal.floor !== "#07080a" && pal.grid !== "#07080a", "the floor and the grid are lighter than the void", pal.floor + " / " + pal.grid);
    ok(A.exec("(function(){ return !!fieldWalk(G.adv.map,[fieldExit(G.adv.map)]); })()"),
       "the east exit can be walked to");
    const step = A.exec("(function(){ var m=G.adv.map; var r=fieldRoute(m); var s=r.path&&r.path[1];" +
      "if(!s) return null; return {adj:Math.abs(s.x-m.px)+Math.abs(s.y-m.py)," +
      "wall:!!(m.g[s.y]&&m.g[s.y][s.x])}; })()");
    ok(step && step.adj === 1 && !step.wall, "the lit path steps onto an open tile", JSON.stringify(step));
    ok(drawn.indexOf("DOSSIER") < 0 && drawn.indexOf("B / X - PAUSE") < 0 && drawn.indexOf("PAUSE") < 0,
       "the legend is not covered by the pause line", drawn);
  }

  section("a hunting patrol can be stepped on");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    const landed = A.exec("(function(){ var m=G.adv.map; var nx=m.px+1, ny=m.py;" +
      "m.g[ny][nx]=0; var f=m.foes[0]; if(!f) return 'nofoe';" +
      "f.done=false; f.hunting=true; f.x=nx; f.y=ny;" +
      "(m.patrols||[]).forEach(function(p){ if(p.x===nx&&p.y===ny) p.used=true; });" +
      "m.camps=[]; (m.gyms||[]).forEach(function(g){ g.used=true; });" +
      "advMove(1,0); return G.scene===S.BRIEF?'brief':String(G.scene); })()");
    ok(landed === "brief", "walking east onto a hunting patrol opens the fight", landed);
  }

  section("the first fights of a fresh run last long enough to teach");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv);");
    A.exec("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    ok(A.exec("G.duel.lessonFight") === true, "the first stage-one fight is a lesson");
    ok(A.exec("G.duel.oneShot") === false, "so it is not over after one exchange");
    ok(A.exec("G.duel.e.hp") >= 110, "and the opponent has enough health to take several hits", A.exec("G.duel.e.hp"));
    ok(A.exec("G.duel.e.atkMul") < A.exec("mkSide(3,40,[0,1,2,3,4],{level:1}).atkMul"),
       "only this bout's hands are softer");
    const tell = A.exec("teachBeat(G.duel)");
    ok(tell && tell.line.indexOf("READ THE TELL") >= 0, "the opening beat is the tell", tell && tell.line);
    A.exec("G.duel.turn=1;");
    const answer = A.exec("teachBeat(G.duel)");
    ok(answer && answer.line.indexOf("ANSWER THE TELL") >= 0, "the next beat is answering it", answer && answer.line);
    A.exec("G.duel.turn=2;");
    const timing = A.exec("teachBeat(G.duel)");
    ok(timing && timing.line.indexOf("HIT THE WINDOW") >= 0, "then the timing window", timing && timing.line);
    A.exec("G.duel.turn=0; G.duel.eTech=TECH.basic_sprawl||TECH[G.duel.e.techs[0]];");
    const grade = A.exec("(function(){ var d=G.duel; var t=TECH.basic_sprawl;" +
      "d.eTech=t; return gradeTell(d, TECH.basic_guard||TECH[d.p.techs[0]]); })()");
    ok(typeof grade === "string" && grade.length > 0, "a chosen card is graded against the tell", grade);
    A.exec("G.duel.ph=D.CMD; G.duel.turn=0; G.scene=S.DUEL;" +
           "if(typeof Onboarding!=='undefined') Onboarding.markSeen(SAVE,'l_range');");
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("READ THE TELL") >= 0, "the fight screen prints the tell beat", drawn);
    ok(drawn.indexOf("[1]-[5] PICK CARD") >= 0 && drawn.indexOf("EXECUTE") >= 0,
       "the footer says number keys pick and confirm executes", drawn);
    ok(drawn.indexOf("SWITCH [ATTACK") < 0, "the footer is one line, with no category overdraw", drawn);
    A.exec("G.duel.e.hp=0; endDuel(G.duel);");
    A.exec("startDuel({fromAdv:true,tf:true,oppFid:4,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    ok(A.exec("G.duel.lessonFight") === true && A.exec("G.duel.oneShot") === false,
       "the second fight of that run is still a lesson");
    A.exec("G.duel.e.hp=0; endDuel(G.duel);");
    A.exec("startDuel({fromAdv:true,tf:true,oppFid:5,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    ok(A.exec("G.duel.lessonFight") === false && A.exec("G.duel.oneShot") === true && A.exec("G.duel.e.hp") === 40,
       "the third fight is an ordinary patrol again", A.exec("G.duel.e.hp"));
    fresh();
    A.exec("G.adv=newAdv(0,0); G.adv.ng=1; newField(G.adv);");
    A.exec("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    ok(A.exec("G.duel.lessonFight") === false, "new game plus is not retaught");
    fresh();
    A.exec("G.adv=newAdv(0,0); G.adv.stage=2; newField(G.adv);");
    A.exec("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:2});");
    ok(A.exec("G.duel.lessonFight") === false && A.exec("G.duel.e.hp") === 90,
       "a later stage keeps the health it was given", A.exec("G.duel.e.hp"));
  }

  section("a learned technique leads the next hand");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.adv.fights=2; SAVE.rec.duels=3;");
    const id = A.exec("(function(){ var pool=draftPool(G.adv);" +
      "for(var i=0;i<pool.length;i++){ if(pool[i]&&pool[i].id) return pool[i].id; } return null; })()");
    ok(!!id && A.TECH[id], "there is a technique this run can learn", id);
    const applied = A.exec("applyDraft(G.adv," + JSON.stringify(id) + ")");
    ok(applied && applied.id === id, "the draft takes it", applied && applied.id);
    A.exec("G.adv.handNote={id:" + JSON.stringify(id) + ", name:TECH[" + JSON.stringify(id) + "].name};");
    A.exec("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1}); beginRound(G.duel);");
    ok(A.exec("G.adv.handNote") === null, "the note is spent on this fight");
    ok(A.exec("G.duel.handNote&&G.duel.handNote.id") === id, "the fight remembers what was added");
    ok(A.exec("menuTechsFor(G.duel,G.duel.p)[0].id") === id, "and that card leads the hand", A.exec("menuTechsFor(G.duel,G.duel.p)[0].id"));
    A.exec("G.duel.ph=D.CMD; G.scene=S.DUEL;");
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("ADDED TO YOUR HAND") >= 0, "the hand says it was added", drawn);
    ok(drawn.indexOf(A.TECH[id].name) >= 0, "and names the technique", A.TECH[id].name);
  }

  section("a reward says what the purse and the points are for");
  {
    const lines = A.exec("rewardGuideLines()");
    ok(lines.length === 3, "three lines, one per thing a fight pays", lines.length);
    const blob = lines.join(" | ");
    ok(blob.indexOf("TEMPLE") >= 0 && blob.indexOf("GYM") >= 0 && blob.indexOf("BELT") >= 0,
       "points, purse and the belt each name where they go", blob);
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.adv.fights=2; SAVE.rec.duels=3;");
    A.exec("startDuel({fromAdv:true,tf:true,oppFid:3,oppHp:40,oppPool:[0,1,2,3,4],oppLv:1,stage:1});");
    A.exec("G.duel.e.hp=0; G.duel.stats.win=true; endDuel(G.duel); G.scene=S.RESULT;");
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("PATROL CLEARED") >= 0, "the patrol card is the one on screen", drawn);
    ok(drawn.indexOf("TEMPLE") >= 0, "card points say they buy a level at a temple", drawn);
    ok(drawn.indexOf("GYM") >= 0, "the purse says to spend it at the gym", drawn);
    ok(drawn.indexOf("WHITE") >= 0 || drawn.indexOf("BELT") >= 0, "mastery says what the belt is", drawn);
  }

  section("every roster row clears the footer");
  {
    fresh();
    A.exec("G.selMode='adventure'; G.scene=S.SELECT; G.sel=0;");
    const rib = A.exec("rosterRibbon()");
    ok(rib.rows >= 4, "the stock roster is four rows", rib.rows);
    ok(rib.bottom <= rib.footerY, "and the last row finishes above the footer", rib.bottom + " vs " + rib.footerY);
    ok(rib.bottom <= 500 && rib.footerY === 500, "on the 960x540 canvas that 1280x800 letterboxes", rib.bottom);
    const drawn = joined(cap(() => frames(1)));
    const last = A.FIGHTERS[A.FIGHTERS.length - 1].name;
    ok(drawn.indexOf(last) >= 0, "the last fighter is drawn, not clipped off the canvas", last);
    A.exec("(function(){ SAVE.customFighters=[]; for(var i=0;i<10;i++) SAVE.customFighters.push({name:'ENTRY '+i,deck:0}); syncCustomFighters(); })();");
    const extra = A.exec("rosterRibbon()");
    ok(extra.rows > rib.rows, "registered fighters add a row", extra.rows);
    ok(extra.bottom <= extra.footerY, "and that row still clears the footer", extra.bottom + " vs " + extra.footerY);
    A.exec("SAVE.customFighters=[]; syncCustomFighters();");
    ok(A.exec("FIGHTERS.length") === 25, "the stock roster is restored");
  }

  section("the title takes the keyboard on load");
  {
    const boot = PAGE.lastIndexOf("focusArena();");
    const raf = PAGE.lastIndexOf("requestAnimationFrame(mainLoop);");
    ok(boot > 0 && boot < raf, "focus is placed before the first frame");
    ok(PAGE.indexOf('href="manifest.json"') < 0, "the built page does not request manifest.json");
    ok(PAGE.indexOf('rel="icon"') > 0, "it carries its own icon");
    ok(PAGE.indexOf('href="favicon.ico"') < 0 && PAGE.indexOf("href='favicon.ico'") < 0,
       "and it does not request favicon.ico");
    const sw = fs.readFileSync(path.resolve(__dirname, "..", "sw.js"), "utf8");
    ok(sw.indexOf("manifest.json") < 0, "the service worker does not fetch the manifest either");
    A.exec("G.scene=S.TITLE; setFocused(false);");
    ok(A.exec("arenaFocused()") === false, "an unfocused title still ignores keys");
    A.exec("focusArena();");
    ok(A.exec("arenaFocused()") === true, "focusArena puts the keyboard on the arena");
    A.exec("onArenaKey({key:'Enter',preventDefault:function(){}})");
    ok(scene() === "MENU", "so Enter on the title works without a click", scene());
  }

  section("new adventure over a finished career still teaches the first fight");
  {
    fresh();
    A.exec("SAVE.rec.duels=12; SAVE.onboarding={done:true,seen:{l_range:1}}; persist();");
    A.exec("G.scene=S.MENU; setFocused(true);");
    ok(A.menuGoTo("adv") === true, "new adventure is on the menu");
    A.exec("onArenaKey({key:'Enter',preventDefault:function(){}})");
    ok(scene() === "SELECT", "confirming that row opens fighter select", scene());
    A.exec("onArenaKey({key:'Enter',preventDefault:function(){}})");
    ok(scene() === "MAP" && A.exec("G.adv&&G.adv.fights") === 0, "confirming Akin starts a new run", scene());
    const opened = A.exec("(function(){ var m=G.adv.map; var f=null, best=1e9;" +
      "m.foes.forEach(function(o){ if(o.done||!o.tf) return;" +
      "var dist=Math.abs(o.x-m.px)+Math.abs(o.y-m.py); if(dist<best){ best=dist; f=o; } });" +
      "if(!f) return null; G.brief={f:f}; G.scene=S.BRIEF; return true; })()");
    ok(opened === true, "the first foe a new run meets is a patrol");
    const brief = joined(cap(() => frames(1)));
    ok(brief.indexOf("ONE EXCHANGE") < 0, "that brief does not call the fight one exchange", brief);
    ok(brief.indexOf("A LESSON") >= 0 && brief.indexOf("READ THE TELL") >= 0,
       "and it says the fight will teach the tell", brief);
    A.exec("onArenaKey({key:'Enter',preventDefault:function(){}})");
    ok(scene() === "DUEL" && A.exec("G.duel.lessonFight") === true, "confirming it starts a lesson", scene());
    ok(A.exec("G.duel.oneShot") === false && A.exec("G.duel.e.hp") >= 110,
       "the opponent survives the first exchange", A.exec("G.duel.e.hp"));
    ok(A.exec("G.duel.ent&&G.duel.ent.banner") === "ADVENTURE",
       "an adventure fight is billed as an adventure", A.exec("G.duel.ent&&G.duel.ent.banner"));
    const marks = A.exec("lessonMark(G.duel,{edge:1,note:'x'})+'|'+lessonMark(G.duel,{edge:-1,note:'y'})");
    ok(marks.indexOf("GOOD") >= 0 && marks.indexOf("BAD") >= 0, "cards are marked good or bad", marks);
    A.exec("G.duel.ph=D.CMD; G.duel.turn=0; G.scene=S.DUEL;");
    const drawn = joined(cap(() => frames(1)));
    ok(drawn.indexOf("READ THE TELL") >= 0, "the tell beat is on screen for that first fight", drawn);
    ok(drawn.indexOf("RANGE DECIDES") < 0, "the range card does not cover the tell", drawn);
  }

  section("difficulty is never on a movement key");
  {
    fresh();
    A.exec("G.scene=S.TITLE; SAVE.diff=2; setFocused(true);");
    A.exec("onArenaKey({key:'ArrowLeft',preventDefault:function(){}})");
    ok(A.exec("SAVE.diff") === 1 && scene() === "TITLE", "left arrow steps difficulty down and stays on the title", A.exec("SAVE.diff"));
    A.exec("onArenaKey({key:'d',preventDefault:function(){}})");
    A.exec("onArenaKey({key:'D',preventDefault:function(){}})");
    ok(A.exec("SAVE.diff") === 1 && scene() === "TITLE", "D does not change difficulty and does not open how to play");
    A.exec("onArenaKey({key:'ArrowRight',preventDefault:function(){}})");
    ok(A.exec("SAVE.diff") === 2, "right arrow steps it back up", A.exec("SAVE.diff"));
    keyDoes("d", "TITLE", "right");
    keyDoes("d", "BRIEF", "right");
    keyDoes("d", "MAP", "right");
    keyDoes("ArrowLeft", "TITLE", "diffDown");
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.adv.fights=2; SAVE.diff=1;");
    A.exec("G.brief={f:G.adv.map.foes[0]}; G.scene=S.BRIEF; setFocused(true);");
    A.exec("onArenaKey({key:'d',preventDefault:function(){}})");
    A.exec("onArenaKey({key:'D',preventDefault:function(){}})");
    ok(A.exec("SAVE.diff") === 1 && scene() === "BRIEF", "walking into a fight on D does not retune the bout", scene());
  }

  section("how to play, the field, and the deck say what they do");
  {
    fresh();
    A.exec("G.scene=S.HOW; G.prevScene=S.MENU; G.how=3; setFocused(true);");
    A.exec("onArenaKey({key:'b',preventDefault:function(){}})");
    ok(scene() === "MENU", "B leaves how to play", scene());
    ok(PAGE.indexOf('addEventListener("keydown",onArenaKey,true)') >= 0,
       "keys are taken before a focused button can eat them");
    A.exec("G.adv=newAdv(0,0); newField(G.adv);");
    ok(A.exec("(function(){ var m=G.adv.map; m.seen[14][14]=false;" +
              "return foeShown(m,{done:false,hunting:true,x:14,y:14})===true" +
              " && foeShown(m,{done:false,hunting:false,x:14,y:14})===false; })()") === true,
       "a foe who is closing in is drawn through the fog");
    const capLine = A.exec("fieldRouteCaption(G.adv.map)");
    ok(capLine.indexOf("STEPS") >= 0 && capLine.indexOf("STEPS") < capLine.indexOf("NEXT:"),
       "the step count leads the route line, ahead of the part the buttons cover", capLine);
    const pool = A.exec("G.adv.pool.length");
    A.exec("G.adv.drafted.push('learned'); G.scene=S.MAP;");
    const deck = joined(cap(() => frames(1)));
    ok(deck.indexOf((pool + 1) + " CARDS") >= 0, "learning a technique changes the deck count", deck);
    ok(deck.indexOf("DECK +1 ADDED") >= 0, "and the field says it was added", deck);
    const faces = A.exec("(function(){ var m=G.adv.map;" +
      "var rival=m.foes.filter(function(o){return !o.tf;})[0];" +
      "var p=m.foes.filter(function(o){return o.tf;})[0];" +
      "p.art=rival.id; p.art2=G.adv.hero; clearPatrolFaces(m.foes, G.adv.hero);" +
      "var named={}; named[G.adv.hero]=1;" +
      "m.foes.forEach(function(o){ if(!o.tf) named[o.id]=1; });" +
      "return m.foes.filter(function(o){return o.tf&&named[o.art];}).length; })()");
    ok(faces === 0, "a patrol does not keep a kit that belongs to someone on this field", faces);
    ok(PAGE.indexOf('PATROL_FACE="Patrol"') >= 0 && !/solifer/i.test(PAGE),
       "patrols draw a portrait that is not a named roster fighter");
    const patrolArt = PAGE.match(/"Patrol":\{"w":439,"h":640,"d":"([^"]+)"\}/);
    ok(!!patrolArt, "AZX Force ships its own portrait");
    ok(require("crypto").createHash("sha256").update(patrolArt ? patrolArt[1] : "").digest("hex")
         === "70c52c8b9eb0efaea96c3dc9b39c3d5e6ef4e289e9b0002ab12f9775d9393cb1",
       "the Force portrait is the human fighter");
    ok(A.exec("divLabel('Middleweight')") === "Middle"
       && A.exec("divLabel('Welterweight')") === "Welter"
       && A.exec("divLabel('Light Heavyweight')") === "Lt Heavy",
       "weight classes are shortened on a word, not sliced mid-letter");
  }

  section("after camp, east is a step or a wall, and the route stays");
  {
    fresh();
    A.exec("G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP;");
    const camp = A.exec("(function(){" +
      "var m=G.adv.map, c=(m.camps||[])[0]; if(!c) return null;" +
      "m.px=c.x; m.py=c.y; G.campFirst=true; G.adv.campTaken=true; m.camps.length=0;" +
      "openDeadEast(m); var eastX=m.px+1, eastY=m.py;" +
      "var blocked=eastX>=m.N||!!(m.g[eastY]&&m.g[eastY][eastX]);" +
      "var r=fieldRoute(m), s=r.path&&r.path[1];" +
      "var legal=!!(s&&Math.abs(s.x-m.px)+Math.abs(s.y-m.py)===1&&!(m.g[s.y]&&m.g[s.y][s.x]));" +
      "var before=m.px+','+m.py; if(!blocked) advMove(1,0);" +
      "return {blocked:blocked, legal:legal, moved:m.px+','+m.py!==before, n:(r.path||[]).length," +
      "kind:r.dest&&r.dest.kind, wall:mapPalette(false).wall, floor:mapPalette(false).floor};" +
      "})()");
    ok(camp && camp.n > 1, "leaving camp still has a route off the tile", camp && camp.n);
    ok(camp && (!camp.blocked || camp.legal), "east is walkable, or the lit path has another legal step", JSON.stringify(camp));
    if (camp && !camp.blocked) ok(camp.moved, "a walkable east tile actually takes the step", JSON.stringify(camp));
    const lum = (hex) => {
      const n = parseInt(String(hex).slice(1), 16);
      return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
    };
    ok(camp && lum(camp.wall) < lum(camp.floor), "a wall is darker than the floor", camp && (camp.wall + " vs " + camp.floor));
    const opened = A.exec("(function(){" +
      "var N=15, g=Array.from({length:N},function(){return Array(N).fill(1);});" +
      "g[7][5]=0; g[7][14]=0; g[7][13]=0;" +
      "var m={N:N,g:g,px:5,py:7,exitY:7,ogre:false,foes:[],patrols:[],temples:[],cards:[],pits:[],camps:[],gyms:[]};" +
      "openDeadEast(m); return m.g[7][6]===0; })()");
    ok(opened === true, "with no legal step, the east wall toward the exit opens");
    ok(PAGE.indexOf("fittedDisc.slice(0, 11)") < 0, "card styles are not clipped mid-word");
    ok(PAGE.indexOf('"TAEKWONDO": "TKD"') >= 0 && PAGE.indexOf('"MUAY THAI": "MUAY"') >= 0,
       "long styles have a short form that is still the art");
    ok(A.exec("nameShortForm('Kwon Won-Ri')") === "Kwon W.", "a tight roster name keeps a readable short form",
       A.exec("nameShortForm('Kwon Won-Ri')"));
    const clip = A.exec("fitLine('e'+String.fromCharCode(0x0301)+'XTRA NAME', 5, 12, 800)");
    ok(String(clip).indexOf("\u0301") >= 0, "a clip does not cut a combining mark off its letter", clip);
  }

  section("a blocked neighbour uses the wall draw");
  {
    const lum = (hex) => {
      const n = parseInt(String(hex).replace("#", ""), 16);
      return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
    };
    const spot = A.exec("(function(){" +
      "SAVE=DEF_SAVE(); persist(); G.duel=null; G.adv=newAdv(0,0); newField(G.adv); G.scene=S.MAP; setFocused(true);" +
      "function audit(m){" +
      "  var dirs=[[1,0],[-1,0],[0,1],[0,-1]], bad=[];" +
      "  dirs.forEach(function(d){" +
      "    var x=m.px+d[0], y=m.py+d[1];" +
      "    var face=fieldCellFace(m,x,y);" +
      "    var oob=x<0||y<0||x>=m.N||y>=m.N;" +
      "    var blocked=oob||!!(m.g[y]&&m.g[y][x]);" +
      "    if(face==='floor'&&blocked) bad.push('floor-blocked '+x+','+y);" +
      "    if(!blocked&&face!=='floor') bad.push('open-'+face+' '+x+','+y);" +
      "    if(blocked&&!oob&&face!=='wall') bad.push('blocked-'+face+' '+x+','+y);" +
      "  });" +
      "  return bad;" +
      "}" +
      "var bad=[], guard=0;" +
      "while(guard++<40 && G.adv.pool.length<6){" +
      "  if(G.scene===S.BENEFIT){ onKey('a'); continue; }" +
      "  if(G.scene!==S.MAP) break;" +
      "  var m=G.adv.map; bad=bad.concat(audit(m));" +
      "  var r=fieldRoute(m), s=r.path&&r.path[1];" +
      "  if(!s) break;" +
      "  var dx=s.x-m.px, dy=s.y-m.py;" +
      "  if(Math.abs(dx)+Math.abs(dy)!==1) break;" +
      "  if(m.g[s.y]&&m.g[s.y][s.x]) break;" +
      "  var foe=(m.foes||[]).some(function(o){return !o.done&&o.x===s.x&&o.y===s.y;});" +
      "  if(foe) break;" +
      "  advMove(dx,dy);" +
      "}" +
      "if(G.scene===S.BENEFIT) onKey('a');" +
      "var m=G.adv.map;" +
      "if(G.scene===S.MAP && G.adv.pool.length>=6 && m.py>0 && !(m.g[m.py-1]&&m.g[m.py-1][m.px])){" +
      "  var foeN=(m.foes||[]).some(function(o){return !o.done&&o.x===m.px&&o.y===m.py-1;});" +
      "  if(!foeN) advMove(0,-1);" +
      "}" +
      "m=G.adv.map; bad=bad.concat(audit(m));" +
      "var northFace=m.py>0?fieldCellFace(m,m.px,m.py-1):'void';" +
      "var northBlocked=m.py<=0||!!(m.g[m.py-1]&&m.g[m.py-1][m.px]);" +
      "var px=m.px, py=m.py, steps=m.steps;" +
      "if(northBlocked) advMove(0,-1);" +
      "var stayed=m.px===px&&m.py===py&&m.steps===steps;" +
      "var route=fieldRoute(m), step=route.path&&route.path[1];" +
      "var pal=mapPalette(false);" +
      "var fills=[], cx={fillStyle:'',globalAlpha:1,fillRect:function(){fills.push(String(this.fillStyle));}};" +
      "mapPaintWallCell(cx,0,0,28,28,pal);" +
      "var wallFill=fills[0]; fills.length=0;" +
      "mapPaintFloorCell(cx,0,0,28,28,pal,1,1);" +
      "var floorFill=fills[0]; fills.length=0;" +
      "mapPaintFogCell(cx,0,0,28,28,pal,2,2,0);" +
      "var fogFill=fills[0];" +
      "if(m.py>0){ m.g[m.py-1][m.px]=1; m.seen[m.py-1][m.px]=false; }" +
      "var unseen=m.py>0?fieldCellFace(m,m.px,m.py-1):'void';" +
      "return {bad:bad, deck:G.adv.pool.length, px:m.px, py:m.py, scene:G.scene," +
      "  northFace:northFace, northBlocked:northBlocked, stayed:stayed, unseen:unseen," +
      "  step:step?{x:step.x,y:step.y}:null," +
      "  wall:pal.wall, floor:pal.floor, fog:pal.fog, wallHi:pal.wallHi," +
      "  wallFill:wallFill, floorFill:floorFill, fogFill:fogFill, grain:pal.fogGrain};" +
      "})()");
    ok(spot && spot.deck >= 6, "the walk picks up the card and the deck reads 6", spot && spot.deck);
    ok(spot && spot.bad.length === 0, "every open-floor neighbour is walkable, and every blocked neighbour is a wall",
       spot && spot.bad.join("; "));
    ok(spot && spot.northBlocked && spot.northFace === "wall" && spot.stayed,
       "the refused step above the card is a wall and the player stays put",
       spot && (spot.northFace + " stayed=" + spot.stayed + " at " + spot.px + "," + spot.py));
    ok(spot && spot.unseen === "wall", "a blocked neighbour stays a wall when it has not been revealed", spot && spot.unseen);
    ok(spot && spot.step && (spot.step.x !== spot.px || spot.step.y !== spot.py),
       "the lit path still has a step off that tile", spot && JSON.stringify(spot.step));
    ok(spot && spot.wallFill === spot.wall && spot.fogFill === spot.fog,
       "blocked tiles take the wall fill and unexplored tiles take the fog fill",
       spot && (spot.wallFill + " / " + spot.fogFill));
    ok(spot && lum(spot.wall) < lum(spot.floor) && lum(spot.wallHi) < lum(spot.floor) && lum(spot.fog) < lum(spot.floor),
       "wall and fog are darker than open floor",
       spot && (spot.wall + " " + spot.wallHi + " " + spot.fog + " vs " + spot.floor));
    ok(spot && String(spot.floorFill).indexOf(String(spot.wall)) < 0 && lum(spot.floor) > lum(spot.wall),
       "the floor painter is the lighter tile", spot && spot.floorFill);
    ok(PAGE.indexOf("rgba(120,140,170") < 0, "fog grain is not a light speck that reads as floor");
    ok(PAGE.indexOf("function fieldCellFace") >= 0 && PAGE.indexOf('fogGrain: "rgba(0,0,0,.45)"') >= 0,
       "the field asks each cell what it is, and fog grain is dark");
  }
};
