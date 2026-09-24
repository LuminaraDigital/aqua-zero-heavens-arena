/* =====================================================================
   Aqua Zero Heavens Arena - onboarding contracts
   Luminara Digital

   The game shipped with no first-run path at all: every combat concept was
   locked inside HOW_TOPICS.fight, which is only reachable from a live duel,
   and the save carried no first-run flag. src/ui/onboarding.js is the
   decision layer that fixes that - it renders nothing, so everything below
   is a pure statement about what a player should be told and when.
   ===================================================================== */
module.exports = function (h) {
  const { api: A, ok, section } = h;
  const O = A.Onboarding;

  const fresh = () => {
    const s = { v: 4, rec: { duels: 0, wins: 0, losses: 0, stages: 0 }, defeats: {}, run: null };
    s[O.KEY] = O.defaultState();
    return s;
  };
  const veteran = () => ({
    v: 4, rec: { duels: 61, wins: 40, losses: 21, stages: 12 }, defeats: { 3: 1, 7: 1 }, run: null,
  });
  const goalId = (save, ctx) => { const g = O.nextGoal(save, ctx); return g ? g.id : null; };
  const tipText = (d, side, ctx) => { const t = O.coachTip(d, side, ctx); return t ? t.text : null; };

  section("the module is in the page and answers the three questions");
  {
    ok(!!O, "Onboarding ships");
    ["defaultState", "normalize", "isNewPlayer", "nextGoal", "lessons",
     "pendingLesson", "markSeen", "coachTip", "isComplete"].forEach((k) => {
      ok(typeof O[k] === "function", k + "() is exported");
    });
    ok(O.KEY === "onboarding", "the persisted block has a documented key", O.KEY);
  }

  section("a fresh save knows it is a first run");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const save = A.getSave();
    ok(!!save[O.KEY], "DEF_SAVE seats the onboarding block - the flag the audit was missing");
    ok(O.isNewPlayer(save), "a fresh save reads as a new player");
    ok(!O.isComplete(save), "and has not finished the course");
    ok(O.isNewPlayer(null) && O.isNewPlayer("junk"), "so does a missing or corrupt save");
    ok(!O.isNewPlayer(veteran()), "a career save does not");
    ok(O.isComplete(veteran()), "a save written before onboarding existed counts as graduated");
  }

  section("the persisted state is small, versioned and forward-compatible");
  {
    const d = O.defaultState();
    ok(d.v === 1, "state is versioned", d.v);
    ok(JSON.stringify(d).length < 64, "and small enough to sit in a save", JSON.stringify(d).length);
    [null, undefined, 0, "", "junk", [], NaN, true].forEach((bad) => {
      const n = O.normalize(bad);
      ok(n && n.v >= 1 && typeof n.seen === "object", "normalize survives " + JSON.stringify(bad));
    });
    const junk = O.normalize({ v: "x", seen: { l_range: 1, "": 1, no: 0 }, greeted: "yes", done: 1 });
    ok(junk.v === 1, "a junk version falls back", junk.v);
    ok(junk.seen.l_range === 1 && junk.seen[""] === undefined && junk.seen.no === undefined,
      "only real, truthy ids are kept", JSON.stringify(junk.seen));
    ok(junk.greeted === false && junk.done === false, "non-boolean flags are not trusted");
    const future = O.normalize({ v: 9, seen: { l_range: 1, l_not_yet_written: 1 } });
    ok(future.v === 9 && future.seen.l_not_yet_written === 1,
      "a state from a later build round-trips intact", JSON.stringify(future));
  }

  section("the curriculum is six concepts in the order they are needed");
  {
    const L = O.lessons();
    ok(L.length === 6, "six lessons", L.length);
    ok(L.map((l) => l.id).join(",") === "l_range,l_initiative,l_stamina,l_focus,l_signature,l_conditions",
      "range, then the turn, then air, then focus, then the meter, then conditions",
      L.map((l) => l.id).join(","));
    ok(L.every((l) => l.lines.length >= 2 && l.lines.length <= 4), "each is 2-4 lines");
    ok(L.every((l) => l.title && l.concept && l.trigger), "each names a title, a concept and its trigger");
    ok(L.every((l) => l.lines.every((s) => /^[\x20-\x7E]*$/.test(s))), "ASCII only - the build escapes anything else");
    ok(L.every((l) => l.lines.join(" ").indexOf("!") < 0), "no exclamation marks - HOW_TOPICS does not shout");
    ok(L.every((l) => l.lines.every((s) => s === s.toUpperCase())), "and it is in the same register");
    L[0].lines[0] = "MUTATED";
    ok(O.lessons()[0].lines[0] !== "MUTATED", "lessons() hands out copies, not the table");
    /* the dojo drill script claims a STRIKE > THROW > GUARD triangle the
       resolver never implemented - this curriculum must not repeat it */
    const text = O.lessons().map((l) => l.lines.join(" ")).join(" ");
    ok(!/BEATS THROW|THROW BEATS|ROCK|TRIANGLE/.test(text), "no invented rock-paper-scissors triangle");
    ok(/PRIORITY/.test(text) && /SPRAWL/.test(text), "initiative is taught as priority then speed");
    ok(/HALF/.test(text), "the signature meter is taught as arming at half");
  }

  section("lessons are tied to real moments in a real duel");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    A.exec("startExhibitionBout(0,1,{});");
    const d = A.G.duel;
    const save = A.getSave();
    d.turn = 0;
    /* the bell alone teaches nothing - on a one-exchange patrol range never
       came into it, and the card sat over both fighters saying it did */
    ok(O.pendingLesson(save, { scene: "DUEL", duel: d, turn: 0 }) === null,
      "turn 1 by itself is not the range lesson's moment");
    const away = A.RANGE_ORDER.find((r) => r !== d.range);
    let p = O.pendingLesson(save, { scene: "DUEL", duel: d, turn: 0, tech: { range: away } });
    ok(p && p.id === "l_range", "the cursor on an out-of-range technique is", p && p.id);
    ok(p && p.anchor === "range", "and the card is anchored to the range bar", p && p.anchor);
    O.markSeen(save, "l_range");
    ok(O.pendingLesson(save, { scene: "DUEL", duel: d, turn: 0, tech: { range: away } }) === null,
      "and then holds its tongue until something else happens");
    d.turn = 2;
    p = O.pendingLesson(save, { scene: "DUEL", duel: d, turn: 2 });
    ok(p && p.id === "l_initiative", "the first resolved exchange teaches initiative", p && p.id);
    O.markSeen(save, "l_initiative");
    d.p.stam = Math.round(d.p.maxStam * 0.4);
    p = O.pendingLesson(save, { scene: "DUEL", duel: d });
    ok(p && p.id === "l_stamina", "a half-empty tank teaches the budget", p && p.id);
    O.markSeen(save, "l_stamina");
    d.p.stam = d.p.maxStam;
    d.p.focus = 2;
    p = O.pendingLesson(save, { scene: "DUEL", duel: d });
    ok(p && p.id === "l_focus", "banked focus teaches the read", p && p.id);
    O.markSeen(save, "l_focus");
    d.p.focus = 0;
    d.p.sup = A.SUP_MAX / 2;
    p = O.pendingLesson(save, { scene: "DUEL", duel: d });
    ok(p && p.id === "l_signature", "half a bar teaches the signature", p && p.id);
    d.p.sup = A.SUP_MAX / 2 - 1;
    ok(O.pendingLesson(save, { scene: "DUEL", duel: d }) === null, "a point short of half is not the moment");
    O.markSeen(save, "l_signature");
    A.addStatus(d.e, "BLEEDING");
    p = O.pendingLesson(save, { scene: "DUEL", duel: d });
    ok(p && p.id === "l_conditions", "a live condition teaches durations", p && p.id);
    O.markSeen(save, "l_conditions");
    ok(O.isComplete(save), "six seen closes the course");
    ok(O.pendingLesson(save, { scene: "DUEL", duel: d }) === null, "a graduate is never taught again");
    ok(O.pendingLesson(save, {}) === null, "and nothing is ever taught outside a duel");
  }

  section("no lesson tells you to press a key that does not exist");
  {
    /* THE BUG THIS HOLDS SHUT: the focus lesson read "PRESS B ON THE MARK".
       There is no B key - b is x / X / Escape / Backspace - so a keyboard
       player was told to press a dead one, by the onboarding file itself. */
    const K = A.Keybindings;
    const raw = O.lessons();
    const bodies = raw.map((l) => l.lines.join(" ")).join(" ");
    /* the A's in "A TECHNIQUE" / "A SPRAWL" are English; B and Y never are */
    const stripped = bodies.replace(/\{[ABY]\}/g, "");
    ok(!/\b[BY]\b/.test(stripped), "no lesson body spells a bare pad glyph", stripped.match(/\b[BY]\b/g) || "clean");
    ok(/\{B\}/.test(bodies) && /\{Y\}/.test(bodies), "the two that name buttons use tokens instead");
    /* every token names an action the real table can actually resolve */
    const tokens = (bodies.match(/\{([ABY])\}/g) || []).map((t) => t.slice(1, 2).toLowerCase());
    const unresolvable = tokens.filter((act) => K.arenaKeysFor(act, "DUEL").length === 0);
    ok(tokens.length > 0 && unresolvable.length === 0,
       "and every token is an action ARENA_KEYS resolves", unresolvable.join(",") || tokens.join(","));
    /* expanded through the table, the body names the key a player presses */
    const keys = { a: K.legendFor("a", "", "DUEL"), b: K.legendFor("b", "", "DUEL"), y: K.legendFor("y", "", "DUEL") };
    const focus = O.lessons(keys).find((l) => l.id === "l_focus");
    const text = focus.lines.join(" ");
    ok(text.indexOf("{") < 0, "an expanded body has no tokens left", text);
    ok(text.indexOf("B / X") >= 0 && text.indexOf("Y / C") >= 0,
       "it names the pad button and the key that presses it", text);
    const raws = { b: "x", y: "c" };
    const wrong = Object.keys(raws).filter((act) => K.arenaAction(raws[act], "DUEL") !== act);
    ok(wrong.length === 0, "and those keys really do drive those actions", wrong.join(",") || "clean");
    ok(O.expandKeys("PRESS {B}", { b: "B / X" }) === "PRESS B / X", "expandKeys substitutes");
    ok(O.expandKeys("PRESS {B}", null) === "PRESS {B}",
       "and a caller that passes no labels leaves the token showing rather than naming a dead key");
    ok(O.expandKeys("NOTHING {Q} HERE", { b: "B / X" }) === "NOTHING {Q} HERE", "an unknown token is left alone");
    ok(raw.every((l) => l.lines.every((s) => s === s.toUpperCase())), "tokens keep the game's register");
    /* and the page hands the labels over rather than letting the fallback run */
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=null; G.duel=null; startExhibitionBout(0,1,{});");
    A.exec("G.duel.ph=D.CMD; G.duel.t=0; G.duel.p.focus=2; SAVE.onboarding=Onboarding.defaultState();" +
           "['l_range','l_initiative','l_stamina'].forEach(id=>Onboarding.markSeen(SAVE,id));");
    A.exec("render()");
    const drawn = A.exec("(function(){var t=cursorTech(G.duel);" +
      "var l=Onboarding.pendingLesson(SAVE,{scene:'DUEL',duel:G.duel,turn:G.duel.turn,tech:t," +
      "keys:{a:KH('a'),b:KH('b'),y:KH('y')}}); return l?l.lines.join(' '):null;})()");
    ok(drawn && drawn.indexOf("B / X") >= 0 && drawn.indexOf("{") < 0,
       "the lesson the page draws names the real key", drawn);
  }

  section("the range lesson fires where it is true");
  {
    /* RANGE DECIDES used to fire on turn 1 of every duel, including a patrol
       where range never mattered. It is only true while the player is
       looking at a technique that does not belong to the range the fight is
       in - so that is the only moment it fires. */
    const save = fresh();
    A.exec("startExhibitionBout(0,1,{});");
    const d = A.G.duel;
    d.turn = 0; d.range = "MID";
    const at = (tech) => {
      const p = O.pendingLesson(save, { scene: "DUEL", duel: d, turn: 0, tech: tech });
      return p ? p.id : null;
    };
    ok(at(null) === null, "no technique under the cursor, no lesson");
    ok(at({ range: "MID" }) === null, "a technique at the fight's range is not the moment");
    ok(at({ range: "ANY" }) === null, "nor is one that works anywhere");
    ok(at({ range: "GROUND" }) === "l_range", "a technique from another range is", at({ range: "GROUND" }));
    ok(at({ range: "LONG" }) === "l_range", "whichever direction it is out", at({ range: "LONG" }));
    d.turn = 7;
    ok(at({ range: "GROUND" }) === "l_range", "and it is not gated on the turn number any more");
    d.turn = 0;
    ok(at({ range: 5 }) === null && at("junk") === null, "a junk technique is ignored");
    /* the page hands over the real cursor: point it at a row whose range is
       not the fight's and the director sees exactly that row */
    A.exec("SAVE=DEF_SAVE(); persist(); G.adv=null; G.duel=null; startExhibitionBout(0,1,{});");
    const live = A.G.duel;
    live.ph = A.D.CMD;
    const list = A.exec("menuTechsFor(G.duel,G.duel.p)");
    const off = list.findIndex((t) => t.range && t.range !== "ANY" && t.range !== live.range);
    const on = list.findIndex((t) => !t.range || t.range === "ANY" || t.range === live.range);
    ok(off >= 0 && on >= 0, "the command menu lists both in- and out-of-range rows", off + "/" + on);
    A.exec("cmdPoint(G.duel,G.duel.p," + on + ")");
    const ct = A.exec("cursorTech(G.duel)");
    ok(ct && ct.id === list[on].id, "cursorTech reads the row the cursor is on", ct && ct.id);
    A.exec("cmdPoint(G.duel,G.duel.p," + off + ")");
    ok(A.exec("cursorTech(G.duel).range") === list[off].range, "and follows it when it moves");
    live.ph = A.D.TAPE;
    ok(A.exec("cursorTech(G.duel)") === null, "and reads nothing outside the command phase");
  }

  section("a lesson card never covers the fighters");
  {
    /* the widest roster art is 229px at the arena's 300px height, centred at
       x 200 and x 760 - the band between them is x 315..645, under the range
       strip (bottom edge 126) and above the command panel (398) */
    const L = O.lessons();
    L.forEach((l) => {
      const b = A.exec("lessonBox(" + JSON.stringify(l) + ")");
      ok(b.x >= 315 && b.x + b.w <= 645, l.id + " sits in the band between the fighters", b.x + ".." + (b.x + b.w));
      ok(b.y >= 126 && b.y + b.h <= 392, l.id + " sits under the range strip and above the panel", b.y + ".." + (b.y + b.h));
    });
    ok(L.every((l) => l.anchor), "every lesson names where it belongs", L.map((l) => l.anchor).join(","));
    ok(A.exec("lessonBox(Onboarding.lessons()[0]).anchor") === "range", "the range card carries its anchor");
    ok(A.exec("lessonBox(null).h") > 0, "and a missing lesson still gets a box");
  }

  section("an untriggered lesson never stalls the ones behind it");
  {
    const save = fresh();
    ["l_range", "l_initiative", "l_stamina", "l_focus"].forEach((id) => O.markSeen(save, id));
    A.exec("startExhibitionBout(2,3,{});");
    const d = A.G.duel;
    d.turn = 9; d.p.sup = 0;
    A.addStatus(d.p, "PINNED");
    const p = O.pendingLesson(save, { scene: "DUEL", duel: d });
    ok(p && p.id === "l_conditions", "conditions surface with the meter lesson still unseen", p && p.id);
  }

  section("markSeen mutates the save and never throws");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const save = A.getSave();
    const back = O.markSeen(save, "l_range");
    ok(back === save, "the save comes back for chaining");
    ok(save[O.KEY].seen.l_range === 1, "the lesson is recorded");
    ok(save[O.KEY].greeted === true, "the first run is flagged greeted");
    ok(O.markSeen(null, "l_range") === null, "a null save comes straight back");
    ok(O.markSeen(save, null) === save && Object.keys(save[O.KEY].seen).length === 1,
      "a junk id is ignored rather than stored");
    const bare = { rec: { duels: 1 } };
    O.markSeen(bare, "l_range");
    ok(bare[O.KEY] && bare[O.KEY].seen.l_range === 1, "state is created on a save that has none");
    ok(O.stateOf(bare).seen.l_range === 1, "and stateOf reads it straight back off any save");
  }

  section("nextGoal walks a first-timer past NEW ADVENTURE");
  {
    const g = O.nextGoal(fresh(), { scene: "MENU" });
    ok(g && g.id === "g_read_rules", "step one is the rules the game only shows mid-fight", g && g.id);
    ok(g && g.title && g.line && g.action, "a goal carries id, title, line and action", JSON.stringify(g));
    const save = fresh();
    O.markSeen(save, "l_range");
    ok(goalId(save, { scene: "MENU" }) === "g_first_bout", "step two is one bout");
    ok(O.nextGoal(save, { scene: "MENU" }).action === "vs",
      "and it points at EXHIBITION, not the 15x15 field with no objective");
    save.rec.duels = 1;
    ok(goalId(save, { scene: "MENU" }) === "g_first_win", "then a win");
    save.rec.wins = 1;
    ok(goalId(save, { scene: "MENU" }) === "g_first_run", "then the adventure");
    save.run = { adv: { stage: 1 } };
    ok(goalId(save, { scene: "MENU" }) === "g_clear_stage", "then the first field");
    save.rec.stages = 1;
    ok(goalId(save, { scene: "MENU" }) === "g_master_one", "then mastering somebody");
    save.defeats = { 4: 1 };
    save.rec.duels = 6;
    ok(goalId(save, { scene: "MENU" }) === "g_ladder", "and the ladder is the last stop");
    ok(goalId(veteran(), { scene: "MENU" }) === null, "a veteran is never nagged");
    ok(goalId(fresh(), { scene: "DUEL" }) === null, "the signpost stands down inside a fight");
    ok(goalId(null, {}) === "g_read_rules" && goalId("junk", {}) === "g_read_rules",
      "a missing or corrupt save is treated as a first run");
    ok(O.nextGoal(fresh()) !== null, "ctx is optional");
    ok(O.nextGoal(fresh(), { scene: "MENU", mode: "vs" }).mode === "vs", "ctx.mode rides along when supplied");
    const keys = A.menuItems().map((it) => it[2]);
    ok(["vs", "adv", "ranked"].every((k) => keys.indexOf(k) >= 0),
      "the goal actions name real menu keys", keys.slice(0, 6).join(","));
  }

  section("coachTip reads the live fight");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    A.exec("startExhibitionBout(0,1,{});");
    const d = A.G.duel;
    d.turn = 5; d.p.focus = 0; d.p.sup = 0; d.readShown = false;
    ok(O.coachTip(null, "p", {}) === null, "no duel, no tip");
    ok(O.coachTip({}, "p", {}) === null, "an empty duel is survivable");
    const clean = tipText(d, "p", {});
    ok(clean === null, "a clean even fight gets no chatter", clean);
    d.p.stam = 0;
    ok(/NO AIR/.test(tipText(d, "p", {})), "an empty tank is the loudest call", tipText(d, "p", {}));
    ok(O.coachTip(d, "p", {}).tone === "urgent", "and it is urgent");
    d.p.stam = d.p.maxStam;
    d.p.hp = Math.round(d.p.maxhp * 0.2);
    ok(/ONE CLEAN SHOT/.test(tipText(d, "p", {})), "then the last quarter of the bar");
    d.p.hp = d.p.maxhp;
    A.addStatus(d.p, "PINNED");
    ok(/PINNED/.test(tipText(d, "p", {})), "a condition that removes an option names it");
    A.clearStatus(d.p, "PINNED");
    d.p.sup = A.SUP_MAX / 2;
    ok(/SIGNATURE/.test(tipText(d, "p", {})), "the meter is called armed at half, not full");
    d.p.sup = 0;
    d.p.focus = 1;
    ok(/READS/.test(tipText(d, "p", {})), "banked focus is called out");
    d.readShown = true;
    ok(tipText(d, "p", {}) === null, "and not once the read is already on screen");
    d.readShown = false; d.p.focus = 0;
    d.range = "GROUND";
    ok(/WRONG RANGE/.test(tipText(d, "p", { home: ["LONG", "MID"] })), "a fight held outside your art is flagged");
    ok(tipText(d, "p", { home: ["GROUND"] }) === null, "and not when the ground is where you live");
    d.range = "MID";
    d.p.stam = Math.round(d.p.maxStam * 0.2);
    ok(/STAMINA IS LOW/.test(tipText(d, "p", {})), "a draining tank is a warning");
    d.p.stam = d.p.maxStam;
    A.addStatus(d.e, "STUNNED");
    ok(/CHAIN A COMBINATION/.test(tipText(d, "p", {})), "a hurt opponent is an opening");
    A.clearStatus(d.e, "STUNNED");
    d.turn = 0;
    const bell = O.coachTip(d, "p", {});
    ok(/CATEGORY FIRST/.test(bell.text), "the bell explains the two-step technique menu", bell.text);
    ok(["urgent", "warn", "good", "info"].indexOf(bell.tone) >= 0, "tone is one of four", bell.tone);
    ok(bell.text === bell.text.toUpperCase() && bell.text.indexOf("!") < 0, "tips keep the game's voice");
    ok(bell.text.length <= 40, "and stay short enough for one line", bell.text.length);
    d.turn = 5;
    d.e.hp = 5;
    ok(tipText(d, "e", {}) !== null, "the corner works for either side");
    ok(tipText(d, d.e, {}) !== null, "a side object can be handed in directly");
  }

  section("coachTip is cheap enough to call every frame");
  {
    A.exec("startExhibitionBout(0,1,{});");
    const d = A.G.duel;
    d.turn = 5;
    const t0 = Date.now();
    for (let i = 0; i < 100000; i++) O.coachTip(d, "p", { home: ["MID"] });
    const ms = Date.now() - t0;
    ok(ms < 1000, "100k calls stay well inside a frame budget", ms + "ms");
  }

  section("nothing here can break a save");
  {
    const nasty = [null, undefined, 0, "", "x", [], {}, { rec: null }, { rec: [] },
                   { rec: { duels: "many" } }, { onboarding: "no" }, { onboarding: [] },
                   { run: 7 }, { defeats: "none" }];
    let threw = null;
    nasty.forEach((bad) => {
      try {
        O.isNewPlayer(bad); O.isComplete(bad); O.nextGoal(bad, bad); O.pendingLesson(bad, bad);
        O.markSeen(bad, bad); O.normalize(bad); O.coachTip(bad, bad, bad);
      } catch (e) { threw = JSON.stringify(bad) + " -> " + e.message; }
    });
    ok(threw === null, "every entry point survives every hostile shape", threw || "clean");
    A.exec("SAVE=DEF_SAVE(); persist();");
    ok(!!A.getSave(), "and the live save is still there afterwards");
  }
};
