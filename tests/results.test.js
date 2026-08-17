/* =====================================================================
   Aqua Zero Heavens Arena - the post-fight ceremony
   Luminara Digital

   The stat block was being recorded on every fight and never shown. This
   suite holds the line on the three claims that pass makes:

     - a method line exists for EVERY result the game can produce,
       including a defeat and a forfeit, where the battle layer records
       no finishing technique at all
     - the stat rows never invent a denominator, so no bar is ever NaN
       and an unmeasured stat has no bar rather than an empty one
     - the grade is an ordering, not an opinion: no loss can outgrade a
       win, and a decision survived cannot outgrade a perfect finish
     - the ceremony's cues fire exactly once, whatever size the step is
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;

  /* a real stat block from the real constructor, then filled in the way
     the battle layer fills it - never a hand-rolled object literal, or
     the suite stops testing the shape the game actually produces */
  const stat = (over) => Object.assign(A.newDuelStats(), over || {});

  /* every result kind endDuel and outOfSteps can put on G.result */
  const KINDS = ["win", "ko", "steps", "survwin", "survend", "dailywin",
                 "dailyloss", "rankwin", "rankloss", "vswin", "vsloss"];

  section("method of victory - it always has one");
  {
    const finishes = [
      ["a submission", stat({ win: true, turns: 14, koClass: "SUB", koRange: "GROUND",
                              ranges: { GROUND: 10, MID: 4 } }), "SUBMISSION"],
      ["a head kick", stat({ win: true, turns: 6, koClass: "STRIKE", koRange: "LONG",
                             ranges: { LONG: 5, MID: 1 } }), "KNOCKOUT"],
      ["ground and pound", stat({ win: true, turns: 14, koClass: "STRIKE", koRange: "GROUND",
                                  ranges: { GROUND: 14 } }), "TECHNICAL KNOCKOUT"],
      ["a slam", stat({ win: true, turns: 9, koClass: "THROW", koRange: "CLINCH",
                        ranges: { CLINCH: 9 } }), "TECHNICAL KNOCKOUT"],
    ];
    finishes.forEach(([label, st, want]) => {
      const m = A.methodOfVictory(st);
      ok(m.method === want, label + " reads as " + want, m.method);
    });
    const gp = A.methodOfVictory(finishes[2][1]);
    ok(gp.method !== "KNOCKOUT",
       "punches on a man already down is a stoppage, not a knockout", gp.method);
  }
  {
    /* turnEnd only writes koClass when the OPPONENT falls, so a defeat
       arrives with koClass null and koRange null - the method has to
       come out of hpLeft and turns instead */
    const quick = A.methodOfVictory(stat({ win: false, turns: 3, hpLeft: 0, ranges: { MID: 3 } }));
    const long = A.methodOfVictory(stat({ win: false, turns: 11, hpLeft: 0,
                                          ranges: { MID: 6, CLINCH: 5 } }));
    ok(quick.method === "KNOCKOUT", "a fast defeat is a knockout", quick.method);
    ok(long.method === "TECHNICAL KNOCKOUT", "a long defeat is a stoppage", long.method);
    ok(quick.tone === "bad" && long.tone === "bad", "and both are marked a bad result");
    ok(long.line.indexOf("TURN 11") >= 0, "the defeat line still says when", long.line);
    ok(long.rangeLabel.length > 0,
       "and where, borrowed from the range the fight lived in", long.line);
  }
  {
    const ff = A.methodOfVictory(stat({ win: false, turns: 6, hpLeft: 0, forfeit: true,
                                        ranges: { MID: 6 } }));
    ok(ff.method === "FORFEIT", "a forfeit is a forfeit", ff.method);
    ok(ff.line.indexOf("TURN 6") >= 0, "and it says which turn it was given up on", ff.line);
    ok(!ff.finish, "a forfeit is not a finish");
    /* a forfeit sets hp to zero, so every other rule would call it a
       knockout - the priority order is what stops that */
    const same = A.methodOfVictory(stat({ win: false, turns: 6, hpLeft: 0, forfeit: true,
                                          koClass: "STRIKE", koRange: "MID" }));
    ok(same.method === "FORFEIT", "and it outranks a recorded finish", same.method);
  }
  {
    const win = A.methodOfVictory(stat({ win: true, turns: 20, ranges: { MID: 20 } }), { limit: 20 });
    const loss = A.methodOfVictory(stat({ win: false, turns: 20, hpLeft: 0.4, ranges: { MID: 20 } }),
                                   { limit: 20 });
    ok(win.method === "DECISION", "a fight that reached the clock is a decision", win.method);
    ok(loss.method === "DECISION", "won or lost", loss.method);
    ok(win.detail !== loss.detail, "and the clause knows which way it went");
    const time = A.methodOfVictory(stat({ win: false, turns: 12, hpLeft: 0.5, ranges: { MID: 12 } }));
    ok(time.method === "TIME", "a loss with both men standing is the clock", time.method);
  }
  {
    /* the one thing this function is not allowed to do is come back
       empty - the result screen has no fallback text */
    const blocks = [null, undefined, {}, A.newDuelStats(),
                    stat({ win: true }), stat({ win: false, forfeit: true }),
                    stat({ win: true, koClass: "GUARD", koRange: "ANY" }),
                    stat({ win: true, turns: 4, koClass: "SETUP", koRange: "MID" })];
    let bad = 0, detail = 0;
    blocks.forEach((b) => {
      const m = A.methodOfVictory(b);
      if (!m || typeof m.method !== "string" || !m.method.length || !m.line.length) bad++;
      if (!m || !m.detail || !m.detail.length) detail++;
    });
    ok(bad === 0, "every stat block produces a method and a line", bad);
    ok(detail === 0, "and a clause of detail", detail);
    const any = A.methodOfVictory(stat({ win: true, turns: 3, koClass: "STRIKE", koRange: "ANY" }));
    ok(any.line.indexOf("ANY") < 0, "an ANY-range finish never prints ANY as a place", any.line);
  }
  {
    const beaten = stat({ win: false, turns: 5, hpLeft: 0, ranges: { MID: 5 } });
    const you = A.methodOfVictory(beaten);
    const seat = A.methodOfVictory(beaten, { hotseat: true });
    ok(you.detail.indexOf("YOU") >= 0,
       "the single-player clause is addressed to the player", you.detail);
    ok(seat.detail !== you.detail && seat.detail.indexOf("YOU") < 0,
       "the hot-seat clause names nobody - neither of them is the player", seat.detail);
    ok(seat.method === you.method, "but the method itself does not change with the audience");
  }

  section("where the fight lived");
  {
    const d = A.dominantRange({ GROUND: 9, MID: 3 }, 12);
    ok(d.key === "GROUND", "the busiest range wins", d.key);
    ok(d.turns === 9 && Math.abs(d.share - 0.75) < 1e-9, "with its real share", d.share);
    ok(d.label === A.RANGE_LABEL.GROUND, "and the label the rest of the game uses", d.label);
    const tie = A.dominantRange({ MID: 5, GROUND: 5 }, 10);
    ok(tie.key === "GROUND", "a tie breaks toward the closer range - it had to be earned", tie.key);
    const none = A.dominantRange({}, 0);
    ok(none.key === null && none.share === 0, "an empty tally claims nothing", none.key);
    const junk = A.dominantRange(null, 0);
    ok(junk && junk.key === null, "and a missing tally does not throw");
  }

  section("the stat rows");
  {
    const rows = A.fightStatRows(stat({
      win: true, turns: 12, dmgDealt: 140, dmgTaken: 60, strikes: 9, throws: 3, subs: 1,
      guards: 4, perfectGuards: 2, comboMax: 3, ranges: { MID: 7, GROUND: 5 },
    }));
    const by = {}; rows.forEach((r) => (by[r.key] = r));
    ["dealt", "taken", "strikes", "throws", "subs", "combo", "guards", "turns", "range"]
      .forEach((k) => ok(!!by[k], "the panel carries " + k));
    ok(rows.every((r) => typeof r.label === "string" && typeof r.value === "string"),
       "every row is a label and a printable value");
    ok(Math.abs(by.dealt.bar - 0.7) < 1e-9, "damage dealt is its share of the fight", by.dealt.bar);
    ok(Math.abs(by.dealt.bar + by.taken.bar - 1) < 1e-9, "and the two sides sum to the whole");
    ok(by.guards.value.indexOf("2 PERFECT") >= 0, "perfect guards ride along", by.guards.value);
    ok(by.range.value.indexOf("58%") >= 0, "the range row shows the share too", by.range.value);
    ok(by.combo.bar === 1, "a three-hit air combo fills the combo bar", by.combo.bar);
  }
  {
    /* the panel gets drawn after a one-turn forfeit too, and a bar of
       0/0 would be NaN - which draws as a rail of nothing at all */
    const rows = A.fightStatRows(A.newDuelStats());
    const bad = rows.filter((r) => r.bar !== null && !(r.bar >= 0 && r.bar <= 1));
    ok(bad.length === 0, "an empty fight produces no NaN bars", bad.map((r) => r.key).join());
    ok(rows.filter((r) => r.bar === null).length > 0,
       "an unmeasurable stat has no bar rather than an empty one");
    ok(rows.every((r) => r.value.length > 0), "and every value still prints something");
  }
  {
    const full = A.fightStatRows(A.newDuelStats());
    const lean = A.fightStatRows(A.newDuelStats(), { compact: true });
    ok(lean.length < full.length, "compact drops the rows that are honestly zero",
       full.length + " -> " + lean.length);
    ok(lean.some((r) => r.key === "dealt") && lean.some((r) => r.key === "turns"),
       "but never the core ones");
    const kept = A.fightStatRows(stat({ subs: 2, throws: 1, comboMax: 3 }), { compact: true });
    ok(kept.length === full.length, "and keeps them the moment they are non-zero", kept.length);
    ok(A.fightStatRows(A.newDuelStats(), { max: 5 }).length === 5, "max caps the panel");
  }

  section("the grade is an ordering, not an opinion");
  {
    const perfect = A.fightGrade(stat({ win: true, turns: 1, dmgDealt: 40, dmgTaken: 0,
                                        hpLeft: 1, lowest: 1 }));
    const decision = A.fightGrade(stat({ win: true, turns: 16, dmgDealt: 100, dmgTaken: 95,
                                         hpLeft: 0.12, lowest: 0.1 }));
    ok(perfect.score > decision.score,
       "a first-turn perfect finish outgrades a bloody decision",
       perfect.grade + " " + perfect.score + " vs " + decision.grade + " " + decision.score);
    ok(perfect.grade === "S", "and it is the top grade", perfect.grade);
    ok(perfect.note.length > 0 && decision.note.length > 0, "both carry a justification");
    ok(perfect.note !== decision.note, "and it is not the same justification");
  }
  {
    /* the guarantee that makes the scale defensible: the worst win beats
       the best loss, so nobody can argue a grade with a damage total */
    const worstWin = A.fightGrade(stat({ win: true, turns: 40, dmgDealt: 1, dmgTaken: 999,
                                         hpLeft: 0, lowest: 0 }));
    const bestLoss = A.fightGrade(stat({ win: false, turns: 2, dmgDealt: 1000, dmgTaken: 10,
                                         hpLeft: 0, lowest: 0, comboMax: 3, sigPerfect: 9,
                                         perfectGuards: 9 }));
    ok(worstWin.score > bestLoss.score, "the worst win outgrades the best loss",
       worstWin.score + " vs " + bestLoss.score);
    ok(bestLoss.score === A.RESULT_CONFIG.grade.lossCap,
       "a loss is capped no matter how well it went", bestLoss.score);
    const ff = A.fightGrade(stat({ win: false, turns: 5, forfeit: true }));
    ok(ff.grade === "F" && ff.score === 0, "a forfeit scores nothing", ff.grade + " " + ff.score);
    ok(ff.score <= bestLoss.score, "and never outgrades a fight that was finished");
  }
  {
    /* more damage share, better grade - monotone, not lumpy */
    let prev = -1, monotone = true;
    for (let i = 0; i <= 10; i++) {
      const s = A.fightGrade(stat({ win: true, turns: 8, dmgDealt: i * 10, dmgTaken: 100 - i * 10,
                                    hpLeft: 0.5, lowest: 0.5 })).score;
      if (s < prev) monotone = false;
      prev = s;
    }
    ok(monotone, "the score rises with the share of damage dealt");
    const grades = {};
    [A.fightGrade(stat({ win: true, turns: 2, dmgDealt: 90, dmgTaken: 0, hpLeft: 1 })),
     A.fightGrade(stat({ win: true, turns: 9, dmgDealt: 90, dmgTaken: 40, hpLeft: 0.6 })),
     A.fightGrade(stat({ win: false, turns: 9, dmgDealt: 40, dmgTaken: 90, hpLeft: 0 }))]
      .forEach((g) => (grades[g.grade] = 1));
    ok(Object.keys(grades).length === 3, "three different fights get three different letters",
       Object.keys(grades).join());
    ok(A.fightGrade(null).grade === "F", "a missing stat block still grades");
  }

  section("the ceremony - beats, and cues that fire once");
  {
    const st = stat({ win: true, turns: 9, dmgDealt: 90, dmgTaken: 20, ranges: { MID: 9 } });
    let worst = 0, broken = "";
    KINDS.forEach((k) => {
      const c = A.ceremonyBeats({ kind: k }, st);
      if (c.total > worst) worst = c.total;
      if (!c.list.length) broken = k;
      for (let i = 1; i < c.list.length; i++) if (c.list[i].at < c.list[i - 1].at) broken = k;
    });
    ok(broken === "", "every result kind gets an ordered timeline", broken);
    ok(worst <= 150, "and none of them runs past 150 frames", worst);
    const win = A.ceremonyBeats({ kind: "win" }, st);
    ok(["art", "method", "grade", "stats", "payout", "prompt"]
       .every((id) => A.ceremonyHas(win, id)), "a won fight raises art, method, grade, stats, prompt");
    ok(win.at.art < win.at.method && win.at.method < win.at.stats &&
       win.at.stats < win.at.prompt, "in that order");
  }
  {
    /* running out of steps on the field is not a fight - there is no
       winner to raise and no stat line to read, and the remaining beats
       must close the gap rather than wait out the hole */
    const steps = A.ceremonyBeats({ kind: "steps" }, null);
    ok(!A.ceremonyHas(steps, "art") && !A.ceremonyHas(steps, "stats"),
       "the field re-roll has no art and no stat panel");
    ok(steps.at.method === 0, "the first beat shown always starts at zero", steps.at.method);
    ok(steps.total < A.ceremonyBeats({ kind: "win" }, stat({ turns: 9 })).total,
       "and the whole ceremony is shorter for it", steps.total);
    ok(A.ceremonyPhase(steps, "art") === 0, "a beat that is not in the timeline never advances");
  }
  {
    const st = stat({ win: true, turns: 9 });
    const zero = A.ceremonyBeats({ kind: "vswin" }, A.newDuelStats());
    ok(!A.ceremonyHas(zero, "stats"),
       "a fight that recorded no turns shows no stat panel");
    const seat = A.ceremonyBeats({ kind: "vswin" }, st);
    ok(A.ceremonyHas(seat, "stats"), "a real hot-seat fight does");
    ok(A.ceremonyBeats({ kind: "rankwin" }, st).dense === true,
       "the ladder screen is flagged dense - it already owns its layout");
    ok(A.ceremonyBeats({ kind: "win" }, st).dense === false, "an adventure win is not");
  }
  {
    /* mainLoop runs up to EIGHT step()s between renders, so a cue that
       is tested for equality fires on a frame nobody ever saw */
    const st = stat({ win: true, turns: 9 });
    const c = A.ceremonyBeats({ kind: "win" }, st);
    const seen = {};
    let dupes = 0;
    [8, 40, 200, 200].forEach((dt) => {
      A.ceremonyStep(c, dt).forEach((id) => { if (seen[id]) dupes++; seen[id] = (seen[id] || 0) + 1; });
    });
    ok(dupes === 0, "catching up several steps at once fires each cue exactly once", dupes);
    ok(Object.keys(seen).length === c.list.length, "and fires all of them", Object.keys(seen).join());
    ok(c.done === true, "the ceremony finishes");
    ok(A.ceremonyStep(c, 500).length === 0, "and nothing fires again afterwards");
  }
  {
    const c = A.ceremonyBeats({ kind: "win" }, stat({ win: true, turns: 9 }));
    const order = [];
    for (let i = 0; i < c.total + 30; i++) A.ceremonyStep(c).forEach((id) => order.push(id));
    ok(order.join(",") === c.list.map((b) => b.id).join(","),
       "one frame at a time gives exactly the same cues in the same order", order.join(","));
    ok(new Set(order).size === order.length, "and never repeats one");
  }
  {
    /* the absolute-clock form, the shape the entrance module uses - the
       page owns G.t and hands over "frames since the scene opened" */
    const c = A.ceremonyBeats({ kind: "win" }, stat({ win: true, turns: 9 }));
    const first = A.ceremonyCues(c, 30);
    ok(first.indexOf("art") >= 0 && first.indexOf("method") >= 0,
       "an absolute clock fires every cue it passed", first.join());
    ok(A.ceremonyCues(c, 30).length === 0, "the same frame twice fires nothing");
    ok(A.ceremonyCues(c, 5).length === 0, "and a clock that went backwards never rewinds a cue");
    ok(c.f === 30, "the ceremony only ever moves forward", c.f);
    const rest = A.ceremonyCues(c, 999);
    ok(rest.length + first.length === c.list.length,
       "and between them every cue fired exactly once", rest.join());
  }
  {
    const c = A.ceremonyBeats({ kind: "win" }, stat({ win: true, turns: 9 }));
    A.ceremonyStep(c, 25);
    const rest = A.ceremonySkip(c);
    ok(rest.length > 0 && rest.indexOf("art") < 0,
       "skipping fires the cues that had not landed yet, and only those", rest.join());
    ok(A.ceremonySkip(c).length === 0, "and skipping twice fires nothing");
    ok(c.done === true && c.f === c.total, "a skipped ceremony is a finished one");
  }
  {
    /* the screen keeps stepping for as long as the player leaves it up, so
       by the time anyone presses a button the clock is normally far past
       the end. Skipping then must not drag it backwards - ceremonyCues
       computes its delta off c.f and is documented to only move forward */
    const c = A.ceremonyBeats({ kind: "win" }, stat({ win: true, turns: 9 }));
    A.ceremonyStep(c, c.total + 400);
    const before = c.f;
    ok(A.ceremonySkip(c).length === 0, "skipping a ceremony already over fires nothing");
    ok(c.f === before, "and never rewinds a clock that ran past the end", c.f + " was " + before);
    ok(A.ceremonyCues(c, before + 1).length === 0,
       "so the absolute clock does not replay the whole ceremony afterwards");
  }
  {
    const c = A.ceremonyBeats({ kind: "win" }, stat({ win: true, turns: 9 }), { motion: false });
    ok(c.list.every((b) => b.at === 0), "reduced motion puts every beat on frame zero");
    ok(c.total <= A.RESULT_CONFIG.ceremony.reduced,
       "and the whole ceremony is a handful of frames", c.total);
    ok(A.ceremonyStep(c, 1).length === c.list.length, "with every cue still firing once");
    ok(A.ceremonyPhase(c, "stats") === 1, "and everything already fully drawn");
  }
  {
    const c = A.ceremonyBeats({ kind: "win" }, stat({ win: true, turns: 9 }));
    ok(A.ceremonyPhase(c, "art") === 0, "a beat is at zero before its frame");
    A.ceremonyStep(c, c.at.art + c.dur.art);
    ok(A.ceremonyPhase(c, "art") === 1, "and at one after it");
    ok(A.ceremonyPhase(c, "prompt") === 0, "while a later beat has not started");
    ok(A.ceremonyStep(null).length === 0 && A.ceremonySkip(null).length === 0,
       "and none of it throws on a missing ceremony");
  }

  section("it survives the real result screen");
  {
    /* drive an actual fight to a real G.result and read the ceremony off
       it - the point of the module is the screen it feeds, and a shape
       change in endDuel has to fail here rather than in a browser */
    h.exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv);");
    h.exec("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    h.exec("G.duel.stats.turns=7; G.duel.stats.ranges={MID:5,CLINCH:2};" +
           "G.duel.stats.dmgDealt=90; G.duel.stats.dmgTaken=25; G.duel.stats.strikes=6;" +
           "G.duel.e.hp=0; G.duel.stats.koClass='STRIKE'; G.duel.stats.koRange='MID';" +
           "endDuel(G.duel);");
    const st = A.G.duel.stats;
    ok(A.G.scene === A.S.RESULT, "the fight lands on a result", A.G.result && A.G.result.kind);
    ok(st.win === true && st.hpLeft > 0, "endDuel finished the stat block", st.hpLeft);
    const m = A.methodOfVictory(st);
    ok(m.method === "KNOCKOUT", "and the real block reads as a knockout", m.line);
    const rows = A.fightStatRows(st);
    ok(rows.length === 9 && rows.every((r) => r.bar === null || (r.bar >= 0 && r.bar <= 1)),
       "the real block fills a clean panel", rows.length);
    const cer = A.ceremonyBeats(A.G.result, st);
    ok(cer.total > 0 && cer.total <= 150 && A.ceremonyHas(cer, "stats"),
       "and the real result gets a ceremony with a stat beat", cer.total);
  }
  {
    /* a forfeit is the path with the least recorded about it: no finish,
       no winner, and hp forced to zero by the menu rather than by a
       technique. It still has to produce a whole screen. */
    h.exec("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    /* forfeitDuel ends the fight itself (page.template.html:1757 calls
       endDuel on the way out). Calling endDuel again here would double
       every progression side effect it owns - bumpRec, awardMastery,
       bumpFighter, the purse - and would be testing a state the game
       cannot reach. */
    h.exec("G.duel.stats.turns=2; G.duel.stats.ranges={MID:2}; forfeitDuel(G.duel);");
    const st = A.G.duel.stats;
    ok(st.forfeit === true, "the stat block records the forfeit", st.forfeit);
    const m = A.methodOfVictory(st);
    ok(m.method === "FORFEIT" && m.line.length > 0, "which the method line says plainly", m.line);
    ok(A.fightGrade(st).grade === "F", "and the grade does not reward it");
    const cer = A.ceremonyBeats(A.G.result, st);
    ok(cer.list.length > 0, "the ceremony still has beats to play", cer.list.length);
  }
};
