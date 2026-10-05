/* =====================================================================
   Technique battle tests - the dex, learnsets, ranges, conditions,
   initiative, resolution and the command menu.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section, frames, press, scene, phase } = h;
  const A = api;

  section("the technique dex");
  ok(A.TECH_IDS.length >= 140, "the dex is large", A.TECH_IDS.length + " techniques");
  ok(Object.keys(A.DISCIPLINES).length === 19, "nineteen canonical disciplines", Object.keys(A.DISCIPLINES).length);
  {
    const bad = A.TECH_IDS.filter((id) => {
      const t = A.TECH[id];
      return !t.name || !t.cls || !t.range || t.acc <= 0 || t.learn < 1 || t.learn > 9;
    });
    ok(bad.length === 0, "every technique is well formed", bad.join(", "));
    const orphan = A.TECH_IDS.filter((id) => A.TECH[id].disc && !A.DISCIPLINES[A.TECH[id].disc]);
    ok(orphan.length === 0, "no technique points at a discipline that does not exist", orphan.join(", "));
    const classes = {};
    A.TECH_IDS.forEach((id) => (classes[A.TECH[id].cls] = (classes[A.TECH[id].cls] || 0) + 1));
    ok(classes.STRIKE > 40 && classes.THROW > 15 && classes.SUB > 12 && classes.GUARD >= 6,
       "the dex is spread across strikes, throws, submissions and guards", JSON.stringify(classes));
    const covered = {};
    A.TECH_IDS.forEach((id) => { if (A.TECH[id].disc) covered[A.TECH[id].disc] = 1; });
    ok(Object.keys(covered).length === 19, "every discipline has techniques", Object.keys(covered).length);
  }
  {
    const dup = {};
    let clashes = 0;
    A.TECH_IDS.forEach((id) => { const n = A.TECH[id].name; if (dup[n]) clashes++; dup[n] = 1; });
    ok(clashes === 0, "no duplicated technique names", clashes);
  }

  section("every fighter maps onto real disciplines");
  {
    const unmapped = [];
    A.FIGHTERS.forEach((f, i) => {
      const b = A.BIOS[f.name];
      (b.sty || []).forEach((s) => { if (!A.disciplineId(s)) unmapped.push(f.name + ": " + s); });
    });
    ok(unmapped.length === 0, "every dossier style resolves to a discipline", unmapped.join(", "));
    const thin = A.FIGHTERS.map((f, i) => i).filter((i) => A.knownTechs(i, 9).length < 12);
    ok(thin.length === 0, "every fighter has a deep movelist at level 9",
       thin.map((i) => A.FIGHTERS[i].name).join(", "));
    const counts = A.FIGHTERS.map((f, i) => A.knownTechs(i, 9).length);
    ok(Math.min.apply(null, counts) >= 12, "smallest movelist", Math.min.apply(null, counts));
    ok(Math.max.apply(null, counts) >= 25, "largest movelist", Math.max.apply(null, counts));
  }

  section("techniques arrive with power level");
  {
    const lv1 = A.knownTechs(0, 1), lv5 = A.knownTechs(0, 5), lv9 = A.knownTechs(0, 9);
    ok(lv1.length < lv5.length && lv5.length < lv9.length,
       "the movelist grows every few levels", lv1.length + " -> " + lv5.length + " -> " + lv9.length);
    ok(lv1.every((id) => lv9.indexOf(id) >= 0), "nothing is ever lost on the way up");
    ok(lv1.every((id) => A.TECH[id].learn === 1), "level 1 only knows the fundamentals");
    const late = lv9.filter((id) => A.TECH[id].learn >= 7);
    ok(late.length > 0, "the hardest techniques are gated behind high level", late.length + " late unlocks");
    ok(A.knownTechs(0, 99).length === A.knownTechs(0, 9).length, "level is clamped at 9");
  }
  {
    const sig = A.signatureOf(A.BOSS_ID);
    ok(!!sig && sig.sig === true, "the boss has a signature built from their dossier");
    ok(sig.power > 55, "and it hits like a finisher", sig.power);
    const all = A.FIGHTERS.map((f, i) => A.signatureOf(i)).filter(Boolean);
    ok(all.length === A.FIGHTERS.length, "every fighter has one", all.length + "/" + A.FIGHTERS.length);
    const names = {}; let dup = 0;
    all.forEach((s) => { if (names[s.name]) dup++; names[s.name] = 1; });
    ok(dup === 0, "and no two share a name");
  }

  section("range is the matchup layer");
  ok(A.rangeFit("GROUND", "GROUND") === 1, "a technique at home is at full value");
  ok(A.rangeFit("GROUND", "LONG") < 0.3, "an armbar from kicking range is almost worthless",
     A.rangeFit("GROUND", "LONG"));
  ok(A.rangeFit("ANY", "GROUND") === 1, "universal techniques work anywhere");
  ok(A.rangeFit("MID", "CLINCH") > A.rangeFit("MID", "GROUND"), "the falloff is by distance");
  {
    const judoka = A.homeRanges(["judo"]);
    ok(judoka.indexOf("CLINCH") >= 0 && judoka.indexOf("LONG") < 0, "a judoka wants the clinch, not kicking range");
    ok(A.comfort(["bjj"], "GROUND") === 1, "a grappler is at home on the mat");
    ok(A.comfort(["bjj"], "LONG") < 1, "and out of place at kicking range", A.comfort(["bjj"], "LONG"));
  }

  section("conditions");
  {
    const side = { cond: {} };
    ok(A.addStatus(side, "STUNNED") === true, "a condition applies");
    ok(A.hasStatus(side, "STUNNED"), "and reads back");
    const m = A.statusMods(side);
    ok(m.spd < 1 && m.acc < 1, "being stunned costs speed and accuracy", JSON.stringify(m));
    A.tickStatus(side);
    ok(!A.hasStatus(side, "STUNNED"), "and it wears off");
    const bleed = { cond: {} };
    A.addStatus(bleed, "BLEEDING");
    ok(A.tickStatus(bleed) > 0, "bleeding ticks damage every turn");
    const stacked = { cond: {} };
    A.addStatus(stacked, "WINDED"); A.addStatus(stacked, "LEG_HURT");
    const sm = A.statusMods(stacked);
    ok(sm.pow < 0.8, "conditions stack multiplicatively", sm.pow.toFixed(2));
  }

  section("initiative");
  {
    const s = { cond: {}, spdMul: 1 };
    const jab = A.TECH.jab, spin = A.TECH.dwi_huryeo;
    const fixed = () => 0.5;
    ok(A.initiativeOf(s, jab, fixed) > A.initiativeOf(s, spin, fixed), "a jab beats a spinning kick to the punch");
    ok(A.initiativeOf(s, A.TECH.sprawl, fixed) > A.initiativeOf(s, jab, fixed),
       "a sprawl outranks everything on priority");
    const slow = { cond: {}, spdMul: 1 };
    A.addStatus(slow, "STUNNED");
    ok(A.initiativeOf(slow, jab, fixed) < A.initiativeOf(s, jab, fixed), "a stunned fighter is slower");
    const order = A.orderTurn([{ init: 10 }, { init: 90 }, { init: 50 }]);
    ok(order[0].init === 90 && order[2].init === 10, "the turn resolves fastest first");
  }

  section("resolution");
  {
    const d = { range: "GROUND", p: null, e: null };
    const atk = { cond: {}, discs: ["bjj"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1 };
    const def = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    d.p = atk; d.e = def;
    const onMat = A.damageOf(d, atk, def, A.TECH.armbar);
    d.range = "LONG";
    const standing = A.damageOf(d, atk, def, A.TECH.armbar);
    /* Exactly twice, not more: the fit layer is budgeted 0.50-1.30
       (DMG_CLAMP.fit), so the whole spread between the right range and
       the wrong one is 2.6x at the very most, and an armbar at kicking
       range sits on the 0.50 floor while the same armbar on the mat sits
       at 1.00. Before the collapse the raw product was 0.172 and an
       out-of-range technique was simply deleted; the point of the budget
       is that no single layer can do that on its own. */
    ok(onMat >= standing * 2, "the same submission is far better on the mat", onMat + " vs " + standing);
    ok(onMat <= standing * (A.DMG_CLAMP.fit[1] / A.DMG_CLAMP.fit[0]),
       "and no more than the fit budget allows", onMat + " vs " + standing);
    d.range = "GROUND";
    const accClean = A.accuracyOf(d, atk, def, A.TECH.armbar);
    A.addStatus(def, "PINNED");
    ok(A.accuracyOf(d, atk, def, A.TECH.armbar) > accClean, "a pinned opponent is easier to submit");
  }
  {
    // a sprawl stuffs a takedown outright
    const d = { range: "MID" };
    const w = { cond: {}, discs: ["wrestling"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1, hp: 100, maxhp: 100 };
    const g = { cond: {}, discs: ["wrestling"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1, hp: 100, maxhp: 100 };
    d.p = w; d.e = g;
    const ev = A.executeTechnique(d, w, g, A.TECH.double_leg, A.TECH.sprawl, () => 0.01);
    ok(ev.whiff && ev.note === "SPRAWLED ON", "a sprawl stuffs the double leg", ev.note);
    ok(A.hasStatus(w, "OFF_BALANCE"), "and leaves the shooter off balance");
  }
  {
    // guarding soaks the hit and buys air back
    const d = { range: "MID" };
    const a = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1, hp: 100, maxhp: 100 };
    const b = { cond: {}, discs: ["boxing"], stam: 20, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1, hp: 100, maxhp: 100 };
    d.p = a; d.e = b;
    const open = A.executeTechnique(d, a, b, A.TECH.cross, null, () => 0.01);
    const onGuard = A.executeTechnique(d, a, b, A.TECH.cross, A.TECH.high_guard, () => 0.01);
    ok(onGuard.dmg < open.dmg, "a guard cuts the damage", open.dmg + " -> " + onGuard.dmg);
    const gev = A.executeTechnique(d, b, a, A.TECH.high_guard, null, () => 0.5);
    ok(gev.guarded && b.stam > 20, "guarding recovers stamina", b.stam);
  }
  {
    // stamina drains and running empty leaves you winded
    const d = { range: "MID" };
    const a = { cond: {}, discs: ["muaythai"], stam: 12, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1, hp: 100, maxhp: 100 };
    const b = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    d.p = a; d.e = b;
    A.executeTechnique(d, a, b, A.TECH.mt_head_kick, null, () => 0.99);
    ok(a.stam === 0, "a heavy technique empties the tank", a.stam);
    ok(A.hasStatus(a, "WINDED"), "and leaves you winded");
    const before = a.stam;
    A.endTurnUpkeep(a);
    ok(a.stam > before, "the corner buys some air back between turns", a.stam);
  }
  {
    // techniques that move the fight change the range
    const d = { range: "MID" };
    const a = { cond: {}, discs: ["judo"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1, hp: 100, maxhp: 100 };
    const b = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    d.p = a; d.e = b;
    d.range = "CLINCH";
    const ev = A.executeTechnique(d, a, b, A.TECH.o_soto_gari, null, () => 0.01);
    ok(ev.hit && d.range === "GROUND", "a throw puts the fight on the mat", d.range);
  }

  section("the CPU picks with intent");
  {
    const d = { range: "GROUND" };
    const grappler = { cond: {}, discs: ["bjj"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1,
                       hp: 100, maxhp: 100, level: 9, fid: 0, sup: 0, sig: null,
                       techs: A.knownTechs(9, 9) };
    const foe = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    d.p = foe; d.e = grappler;
    let ground = 0;
    for (let i = 0; i < 40; i++) {
      const pick = A.aiChooseTechnique(d, grappler, foe, { noise: 0 });
      if (pick.tech.range === "GROUND" || pick.tech.range === "ANY") ground++;
    }
    ok(ground >= 35, "a grappler on the mat picks mat techniques", ground + "/40");
  }
  {
    const d = { range: "MID" };
    const tired = { cond: {}, discs: ["boxing"], stam: 3, maxStam: 60, atkMul: 1, defMul: 1, stamMul: 1,
                    hp: 20, maxhp: 100, level: 9, fid: 0, sup: 0, sig: null, techs: A.knownTechs(0, 9) };
    const foe = { cond: {}, discs: ["boxing"], stam: 60, maxStam: 60, atkMul: 1, defMul: 1, hp: 100, maxhp: 100 };
    d.p = foe; d.e = tired;
    let guards = 0;
    for (let i = 0; i < 30; i++) if (A.aiChooseTechnique(d, tired, foe, { noise: 0 }).tech.cls === "GUARD") guards++;
    ok(guards >= 25, "an empty, hurt fighter covers up", guards + "/30");
  }

  section("a full technique battle");
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=null; G.surv=null; G.duel=null;");
    A.exec("startDuel({p1:0,p1hp:120,p1pool:battlePool(0,9),p1level:9," +
           "oppFid:1,oppHp:120,oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:3});");
    const d = A.G.duel;
    // outside adventure (which already has its own brief) the fight now opens
    // on the tale of the tape, and A takes you from there to the announce
    ok(d.ph === A.D.TAPE, "the fight opens on the tale of the tape", phase());
    A.onKey("a");
    ok(d.ph === A.D.INTRO, "and A goes on to the announce", phase());
    ok(!!d.range && A.RANGE_ORDER.indexOf(d.range) >= 0, "the fight starts at a real range", d.range);
    ok(d.p.techs.length > 10 && d.e.techs.length > 10, "both fighters bring a movelist",
       d.p.techs.length + " vs " + d.e.techs.length);
    ok(d.p.stam === d.p.maxStam, "and a full tank", d.p.stam);
    frames(700);
    ok(d.ph === A.D.CMD, "then hands you the command menu", phase());
    ok(!!d.eTech || d.eSuper, "the CPU has already committed - a READ has something to reveal");
    const f0 = d.p.focus;
    A.onKey("y");
    ok(d.readShown && d.p.focus === f0 - 1, "Y spends focus to read the opponent");
    // walk the menu. The categories are a filter now, not a gate: the command
    // menu opens on the technique rows themselves, so A commits one.
    const rows = A.menuTechsFor(d, d.p);
    ok(rows.length > 0, "the menu opens on techniques, not categories", rows.length);
    A.onKey("down"); A.onKey("a");
    ok(d.ph !== A.D.CHAIN, "Z and Enter throw the card instead of opening add-a-link", phase());
    ok(d.ph === A.D.EXEC || d.ph === A.D.DEFEND || d.ph === A.D.JUGGLE,
       "A throws the row under the cursor", phase());
    ok(d.queue.length === 2 || d.ph === A.D.EXEC || d.ph === A.D.DEFEND || d.ph === A.D.JUGGLE,
       "committing builds the turn", phase());
    // play it out
    let g = 0;
    while (A.G.scene === A.S.DUEL && g < 40000) { A.onKey("a"); A.step(); A.render(); g++; }
    ok(g < 40000, "the battle terminates", g + " frames");
    ok(A.G.scene === A.S.RESULT, "and lands on a result", scene());
  }

  section("number keys pick a card and confirm throws it");
  {
    A.exec("SAVE=DEF_SAVE(); G.adv=null; G.surv=null; G.duel=null;");
    A.exec("startDuel({p1:0,p1hp:120,p1pool:battlePool(0,9),p1level:9," +
           "oppFid:1,oppHp:120,oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:3});");
    frames(700);
    const d = A.G.duel;
    ok(d.ph === A.D.CMD, "the hand is waiting", phase());
    ok(A.Keybindings.arenaAction("z", "DUEL") === "a" && A.Keybindings.arenaAction("Enter", "DUEL") === "a",
       "Z and Enter are the confirm keys");
    ok(A.Keybindings.arenaAction("q", "DUEL") === "chain", "Q is add-a-link, not confirm");
    ok(A.Keybindings.arenaAction("1", "DUEL") === "1" && A.Keybindings.arenaAction("5", "DUEL") === "5",
       "1 through 5 stay card keys");
    A.exec("G.duel.cmdCat=0; G.duel.cmdSel=0; G.duel.cmdKey=null; G.duel.cmdScroll=0;");
    const n = A.exec("menuTechsFor(G.duel,G.duel.p).length");
    ok(n >= 5, "five numbered slots are on the hand", n);
    A.onKey("4");
    ok(d.ph === A.D.CMD, "4 does not throw", phase());
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 3,
       "4 selects the fourth card");
    A.onKey("1");
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 0,
       "1 selects the first card");
    A.onKey("2");
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 1,
       "2 selects the second card");
    const cat = d.cmdCat;
    A.onKey("right");
    ok(d.ph === A.D.CMD && d.cmdCat === cat, "right stays on this filter", phase());
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 2,
       "right moves the cursor to the next card");
    A.onKey("left");
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 1,
       "left moves the cursor back");
    A.onKey("5");
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 4,
       "5 selects the fifth card");
    A.onKey("3");
    ok(A.exec("(function(){ var d=G.duel; return cmdFocus(d,d.p,menuTechsFor(d,d.p)); })()") === 2,
       "3 selects the third card");
    A.exec("(function(){ var d=G.duel; var list=menuTechsFor(d,d.p); var i=0;" +
           "for(var n=0;n<list.length;n++){ var t=list[n];" +
           "if(t&&!t.sig&&t.power>0&&!(d.p.sig&&t===d.p.sig)){ i=n; break; } }" +
           "cmdPoint(d,d.p,i,list); })();");
    A.onKey("chain");
    if (d.ph === A.D.CHAIN) {
      ok((d.seq || []).length === 1, "Q opens add-a-link on the selected card");
      A.onKey("b");
      ok(d.ph === A.D.CMD, "B leaves add-a-link without throwing", phase());
    }
    A.onKey("a");
    ok(d.ph !== A.D.CHAIN, "confirm does not open add-a-link", phase());
    ok(d.ph === A.D.EXEC || d.ph === A.D.DEFEND || d.ph === A.D.JUGGLE,
       "confirm throws the selected card", phase());
  }

  section("turn upkeep and win conditions");
  {
    A.exec("G.duel=null; startDuel({p1:0,p1hp:20,p1pool:battlePool(0,9),p1level:9," +
           "oppFid:1,oppHp:20,oppPool:battlePool(1,9),oppLv:9,fromAdv:false,stage:1}); G.duel.t=999;");
    frames(2);
    const d = A.G.duel;
    d.e.hp = 1;
    A.exec("turnEnd(G.duel);");
    ok(d.ph === A.D.CMD || d.ph === A.D.END, "upkeep either continues the fight or ends it", phase());
    d.e.hp = 0;
    A.exec("turnEnd(G.duel);");
    ok(d.ph === A.D.END, "a fighter at zero ends the bout");
  }
};
