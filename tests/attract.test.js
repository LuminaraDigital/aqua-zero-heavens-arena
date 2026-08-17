/* =====================================================================
   Aqua Zero Heavens Arena - attract mode
   Luminara Digital

   The demo that plays itself. What is actually being proven here is not
   "it picks a fighter" - it is that the riskiest module in the game
   cannot hurt anything:

     - it never starts over a run, a fresh save, or a muted page
     - it never picks the boss, and never picks a mirror match
     - it delegates the fight brain instead of owning a second one
     - it does not write a single byte into the duel
     - and there is no state it can reach where it fails to say "stop"
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;

  /* a full set of "yes, go ahead" conditions, so each check below can
     spoil exactly one of them and prove that one carries the veto */
  const goOpts = () => ({
    save: { rec: { duels: 4, stages: 2 } },
    gesture: true, sound: true, runActive: false, duel: null,
    scene: A.S.TITLE, titleScene: A.S.TITLE,
  });
  const IDLE = A.ATTRACT_CONFIG.idleFrames;

  section("the config is the arcade's, not a programmer's");
  {
    ok(IDLE >= 900 && IDLE <= 1500, "idle threshold is around 20 seconds at 60fps", IDLE);
    ok(A.ATTRACT_CONFIG.maxTurns > 0 && A.ATTRACT_CONFIG.maxTurns <= 20,
       "the demo is capped at a watchable number of turns", A.ATTRACT_CONFIG.maxTurns);
    ok(A.ATTRACT_CONFIG.maxFrames > A.ATTRACT_CONFIG.idleFrames,
       "and at a hard frame ceiling above the idle wait", A.ATTRACT_CONFIG.maxFrames);
    ok(A.ATTRACT_CONFIG.bannerOn > 0 && A.ATTRACT_CONFIG.bannerOn < A.ATTRACT_CONFIG.bannerPeriod,
       "the banner blinks rather than sitting on or off",
       A.ATTRACT_CONFIG.bannerOn + "/" + A.ATTRACT_CONFIG.bannerPeriod);
    ok(typeof A.ATTRACT_CONFIG.label === "string" && A.ATTRACT_CONFIG.label.length > 0,
       "and it has something to say", A.ATTRACT_CONFIG.label);
  }

  section("when a demo may start - and the four reasons it may not");
  {
    ok(A.attractReady(IDLE, goOpts()) === true, "twenty idle seconds on the title starts one");
    ok(A.attractReady(IDLE - 1, goOpts()) === false, "one frame short is not enough");
    ok(A.attractReady(0, goOpts()) === false, "and a fresh title screen certainly is not");

    // 1. a run in progress is the one that would actually destroy something
    ok(A.attractReady(IDLE, Object.assign(goOpts(), { runActive: true })) === false,
       "a live run vetoes it - starting would overwrite G.duel");
    const saved = goOpts(); saved.save = { rec: { duels: 9 }, run: { adv: { stage: 2 } } };
    ok(A.attractReady(IDLE, saved) === false, "so does a run sitting in the save");

    // 2. a brand new save has not read the title yet
    const fresh = goOpts(); fresh.save = { rec: { duels: 0, stages: 0 } };
    ok(A.attractReady(IDLE, fresh) === false, "a brand new save never sees the demo first");
    fresh.titleSeen = true;
    ok(A.attractReady(IDLE, fresh) === true, "unless the page says the title has been sat through");

    // 3. audio needs a gesture, and a silent demo is worse than none
    ok(A.attractReady(IDLE, Object.assign(goOpts(), { gesture: false })) === false,
       "no gesture yet means no audio, so no demo");
    ok(A.attractReady(IDLE, Object.assign(goOpts(), { sound: false })) === false,
       "sound switched off means no demo");

    // 4. we have to be standing on the title with nothing else open
    ok(A.attractReady(IDLE, Object.assign(goOpts(), { scene: A.S.MENU })) === false,
       "the main menu is not the title");
    ok(A.attractReady(IDLE, Object.assign(goOpts(), { duel: {} })) === false,
       "a duel already exists");
    const blind = goOpts(); delete blind.scene;
    ok(A.attractReady(IDLE, blind) === false,
       "a caller that names the title scene has to say which scene it is on");
    ok(A.attractReady(IDLE, Object.assign(goOpts(), { active: true })) === false,
       "and one demo at a time");

    // the default answer to a question it cannot answer is no
    ok(A.attractReady(IDLE) === false, "polled with no context at all, it declines");
    ok(A.attractReady(IDLE, {}) === false, "and with no save it declines");
    ok(A.attractReady(NaN, goOpts()) === false, "a broken counter declines");
    ok(A.attractReady("1200", goOpts()) === false, "so does a counter that is not a number");
    const noRec = goOpts(); noRec.save = {};
    ok(A.attractReady(IDLE, noRec) === false, "a save with no record block is treated as new");
  }

  section("the idle counter and the banner blink");
  {
    const st = A.newAttract();
    ok(st.idle === 0 && st.on === false && st.frames === 0, "a new state is idle and not playing");
    ok(Array.isArray(st.recent) && st.recent.length === 0, "with nothing remembered yet");
    for (let i = 0; i < 100; i++) A.attractTick(st);
    ok(st.idle === 100, "silence on the title counts up", st.idle);
    ok(st.frames === 0, "and the demo clock stays at zero while nothing plays", st.frames);

    A.attractStart(st, { p1: 3, p2: 7 });
    ok(st.on === true && st.p1 === 3 && st.p2 === 7, "starting records who is in there");
    const idleAt = st.idle;
    for (let i = 0; i < 5; i++) A.attractTick(st);
    ok(st.frames === 5, "the demo clock runs while it plays", st.frames);
    ok(st.idle === idleAt, "and the idle clock does not - watching is not being away", st.idle);

    A.attractStop(st);
    ok(st.on === false, "stopping ends it");
    ok(st.idle === -A.ATTRACT_CONFIG.cooldown,
       "and leaves the idle counter negative, which is the cooldown", st.idle);
    ok(A.attractReady(st.idle, goOpts()) === false,
       "so the demo cannot restart the instant it finishes");
  }
  {
    // one full period: lit for exactly bannerOn frames of every bannerPeriod
    const st = A.newAttract();
    const C = A.ATTRACT_CONFIG;
    let lit = 0, dark = 0;
    for (let i = 0; i < C.bannerPeriod; i++) { A.attractTick(st); if (st.banner) lit++; else dark++; }
    ok(lit === C.bannerOn, "the banner is lit for its share of the cadence", lit + "/" + C.bannerPeriod);
    ok(dark === C.bannerPeriod - C.bannerOn, "and dark for the rest", dark);
    const phaseA = st.phase;
    for (let i = 0; i < C.bannerPeriod; i++) A.attractTick(st);
    ok(st.phase === phaseA, "and the cadence is periodic", st.phase);
  }
  {
    // real input: the clock restarts, a running demo is over, the gesture latches
    const st = A.newAttract();
    for (let i = 0; i < 50; i++) A.attractTick(st);
    A.attractPoke(st);
    ok(st.idle === 0, "any input restarts the idle clock");
    ok(st.gesture === true, "and latches the gesture the audio layer is waiting on");
    ok(st.input === false, "but does not flag an input on a demo that is not running");
    A.attractStart(st, { p1: 0, p2: 1 });
    A.attractPoke(st);
    ok(st.input === true, "while it is running, it does");
    A.attractPoke(st);
    ok(st.gesture === true, "and the gesture never un-latches");
  }
  {
    // polled from the title, where nothing exists yet
    ok(A.attractTick(null) === null, "ticking nothing is not a crash");
    ok(A.attractStart(null) === null, "nor is starting nothing");
    ok(A.attractStop(null) === null, "nor stopping it");
    ok(A.attractPoke(null) === null, "nor poking it");
    const st = A.newAttract();
    ok(A.attractStart(st) === st, "starting with no pairing still starts");
  }
  {
    // a seed replays the same demo
    const a = A.newAttract({ seed: 99 }), b = A.newAttract({ seed: 99 });
    ok(typeof a.rng === "function", "a seeded state carries its own generator");
    ok(a.rng() === b.rng(), "and two states on the same seed agree");
    ok(A.newAttract().rng === null, "an unseeded state falls through to Math.random at call time");
  }

  section("who fights - watchable, and never the champion");
  {
    const R = A.seededRng(20260808);
    let mirrors = 0, boss = 0, outOfRange = 0, shareEverything = 0, worst = 0;
    const seen = {}, cards = {};
    for (let i = 0; i < 200; i++) {
      const pk = A.attractPick(R, {});
      if (pk.p1 === pk.p2) mirrors++;
      if (pk.p1 === A.BOSS_ID || pk.p2 === A.BOSS_ID) boss++;
      if (pk.p1 < 0 || pk.p2 < 0 || pk.p1 >= A.FIGHTERS.length || pk.p2 >= A.FIGHTERS.length) outOfRange++;
      if (!pk.split) shareEverything++;
      if (pk.overlap > worst) worst = pk.overlap;
      seen[pk.p1] = 1; cards[pk.p1 + "v" + pk.p2] = 1;
    }
    ok(mirrors === 0, "never a mirror match", mirrors);
    ok(boss === 0, "never the boss - he is met, not previewed", boss);
    ok(outOfRange === 0, "and always two real roster entries", outOfRange);
    ok(shareEverything === 0, "the pair never wants the fight in exactly the same places", shareEverything);
    // measured against the live dossiers: the least-shared partner on this
    // roster is never worse than a third, and usually far better
    ok(worst <= 0.4, "and the range ladder always has somewhere to go", worst.toFixed(3));
    ok(Object.keys(seen).length > 10, "the demo is not always the same man", Object.keys(seen).length);
    ok(Object.keys(cards).length > 10, "nor always the same card", Object.keys(cards).length);
  }
  {
    const one = A.attractPick(A.seededRng(4242), {});
    const two = A.attractPick(A.seededRng(4242), {});
    ok(one.p1 === two.p1 && one.p2 === two.p2, "the same seed picks the same fight",
       one.p1 + " vs " + one.p2);
    const other = A.attractPick(A.seededRng(4243), {});
    ok(typeof other.p1 === "number", "and a different seed still picks a legal one");
  }
  {
    // the range-ladder preference, proven against a roster whose home
    // ranges are known rather than whatever the real dossiers carry
    const homeOf = (i) => (i === 0 ? ["LONG"] : i === 1 ? ["LONG", "MID"] : ["GROUND"]);
    const R = A.seededRng(11);
    let bad = 0, seen = {};
    for (let i = 0; i < 60; i++) {
      const pk = A.attractPick(R, { roster: 4, bossId: 3, homeOf });
      seen[pk.p1] = 1;
      // 0 and 1 both share LONG, so the grappler is the only right answer
      if ((pk.p1 === 0 || pk.p1 === 1) && pk.p2 !== 2) bad++;
      if ((pk.p1 === 0 || pk.p1 === 1) && pk.overlap !== 0) bad++;
      if (pk.p1 === pk.p2 || !pk.split) bad++;
    }
    ok(bad === 0, "a striker is matched with a grappler so the range ladder has to move", bad);
    ok(Object.keys(seen).length > 1, "and the first name is not always the same one",
       Object.keys(seen).join());

    // a tie at the minimum goes to the rng, not to whoever is first in the
    // roster - otherwise the "random" tiebreak is the same fight forever
    const seq = (vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
    const tieA = A.attractPick(seq([0.99, 0]), { roster: 4, bossId: 3, homeOf });
    const tieB = A.attractPick(seq([0.99, 0.99]), { roster: 4, bossId: 3, homeOf });
    ok(tieA.p1 === 2 && tieB.p1 === 2 && tieA.p2 !== tieB.p2,
       "a tie at the minimum is broken by the rng, not by list order",
       tieA.p2 + " / " + tieB.p2);

    // and least-shared beats none-shared: when nothing is disjoint the
    // smallest overlap still wins, which is the whole reason the rule is
    // proportional rather than a filter
    const half = A.attractPick(() => 0, { roster: 3, bossId: -1,
      homeOf: (i) => (i === 0 ? ["MID"] : i === 1 ? ["MID", "CLINCH"] : ["MID", "CLINCH", "GROUND"]) });
    ok(half.p1 === 0 && half.p2 === 2 && half.split === true && half.overlap < 0.5,
       "with nothing disjoint on the card, the smallest overlap still wins",
       JSON.stringify(half));
  }
  {
    // the boss is excluded by id, so a roster that ends on him still works
    const R = A.seededRng(5);
    let hit = 0;
    for (let i = 0; i < 40; i++) { const pk = A.attractPick(R, { roster: 4, bossId: 3 }); if (pk.p1 === 3 || pk.p2 === 3) hit++; }
    ok(hit === 0, "the excluded boss index never appears", hit);
    let ex = 0;
    for (let i = 0; i < 40; i++) {
      const pk = A.attractPick(R, { roster: 5, bossId: 4, exclude: [0, 1] });
      if (pk.p1 < 2 || pk.p2 < 2) ex++;
    }
    ok(ex === 0, "and an explicit exclude list is honoured", ex);
  }
  {
    // degenerate rosters are "no demo tonight", not an exception
    const none = A.attractPick(A.seededRng(1), { roster: 1, bossId: -1 });
    ok(none.p1 === -1 && none.p2 === -1, "one fighter cannot make a pairing");
    const only = A.attractPick(A.seededRng(1), { roster: 2, bossId: 0 });
    ok(only.p1 === -1, "and neither can one fighter plus the boss");
    const noRng = A.attractPick(null, { roster: 6, bossId: 5 });
    ok(noRng.p1 >= 0 && noRng.p1 !== noRng.p2, "a missing rng falls back rather than throwing");
    const wild = A.attractPick(() => 1, { roster: 6, bossId: 5 });
    ok(wild.p1 >= 0 && wild.p1 <= 4 && wild.p2 >= 0 && wild.p2 <= 4,
       "and an rng that returns 1 cannot index off the end", wild.p1 + "/" + wild.p2);
  }

  section("what the demo throws - the game's own brain, with a thumb on it");
  {
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:5,oppHp:120,oppPool:[0,1,2,3,4],oppLv:5});");
    exec("beginRound(G.duel);");
    const d = A.G.duel;
    ok(d.p.techs.length > 1, "the hero walks in with a real movelist", d.p.techs.length);

    const pinned = () => A.newAttract({ rng: () => 0.5 });
    const ix = A.attractChoose(d, d.p, pinned());
    ok(ix >= 0 && ix < d.p.techs.length, "it names a technique the fighter actually has", ix);
    ok(!!A.TECH[d.p.techs[ix]], "and that id is in the dex", d.p.techs[ix]);
    const again = A.attractChoose(d, d.p, pinned());
    ok(again === ix, "pinned rng, same duel, same answer", again);

    const eIx = A.attractChoose(d, d.e, pinned());
    ok(eIx >= 0 && eIx < d.e.techs.length, "it answers for the CPU side too", eIx);

    // a signature is never offered: the meter opens a three-beat input
    // minigame and the demo has no hands.
    //
    // Assert the STRUCTURE first. The finisher is built by signatureOf() and
    // lives at side.sig with an id the dex has never heard of, so a test that
    // only scanned TECH[picked].sig would be checking a flag no movelist
    // entry can carry and would pass on a module that returned the signature
    // every single turn.
    ok(!!d.p.sig && !!d.p.sig.id, "the hero has a finisher to suppress", d.p.sig && d.p.sig.id);
    ok(d.p.techs.indexOf(d.p.sig.id) < 0 && !A.TECH[d.p.sig.id],
       "and it is neither in his movelist nor in the dex", d.p.sig.id);
    d.p.sup = A.SUP_MAX;
    let sig = 0;
    for (let i = 0; i < 30; i++) {
      const n = A.attractChoose(d, d.p, A.newAttract());
      const id = n >= 0 ? d.p.techs[n] : null;
      if (n < 0 || id === d.p.sig.id || (A.TECH[id].flags || []).indexOf("signature") >= 0) sig++;
    }
    ok(sig === 0, "a full meter never makes the demo throw its signature", sig);
    d.p.sup = 0;
  }
  {
    // the one thing this module is not allowed to do
    const d = A.G.duel;
    const before = JSON.stringify({
      php: d.p.hp, pst: d.p.stam, pfo: d.p.focus, psu: d.p.sup,
      ehp: d.e.hp, est: d.e.stam, r: d.range, pos: d.pos, corn: d.cornered,
      turn: d.turn, ph: d.ph, pT: d.pTech && d.pTech.id, eT: d.eTech && d.eTech.id,
      techs: d.p.techs.length, q: d.queue.length,
    });
    const st = A.newAttract({ seed: 3 });
    for (let i = 0; i < 12; i++) A.attractChoose(d, d.p, st);
    A.attractShouldExit(st, d);
    A.attractReady(9999, Object.assign(goOpts(), { duel: d }));
    const after = JSON.stringify({
      php: d.p.hp, pst: d.p.stam, pfo: d.p.focus, psu: d.p.sup,
      ehp: d.e.hp, est: d.e.stam, r: d.range, pos: d.pos, corn: d.cornered,
      turn: d.turn, ph: d.ph, pT: d.pTech && d.pTech.id, eT: d.eTech && d.eTech.id,
      techs: d.p.techs.length, q: d.queue.length,
    });
    ok(before === after, "advising a demo does not move one byte of duel state");
  }
  {
    // a movelist the dex does not know. This is the shape that used to take
    // the page down: the fallback handed the list to aiChooseTechnique, which
    // dereferences TECH[id] unguarded, and scoreTechnique read tech.range off
    // undefined - a TypeError thrown out of step() on the title screen.
    const d = A.G.duel;
    const keep = d.p.techs;
    const st = A.newAttract();
    let threw = null, out;
    d.p.techs = ["ancient_id", "older_still"];
    try { out = A.attractChoose(d, d.p, st); } catch (e) { threw = e; }
    d.p.techs = keep;
    ok(threw === null, "a movelist the dex does not know does not throw",
       threw && threw.message);
    ok(out === -1, "it answers 'nothing to throw' instead", out);
    ok(st.recent.length === 0, "and remembers nothing it never picked");

    // one live id among the dead ones is still answerable
    d.p.techs = ["ancient_id", "jab"];
    let mixed;
    try { mixed = A.attractChoose(d, d.p, A.newAttract()); } catch (e) { mixed = e.message; }
    d.p.techs = keep;
    ok(mixed === 1, "and one live id among the dead ones is still thrown", mixed);
  }
  {
    // scoreTechnique refuses a position-gated technique with a -1e9 floor.
    // The demo has to respect that refusal rather than outbid it: with the
    // opening bid below the floor, an out-of-position ring technique won by
    // default and the demo commanded a move the engine had already refused.
    const d = A.G.duel;
    const gated = A.TECH_IDS.filter((id) => A.TECH[id].pos);
    ok(gated.length > 0, "there are position-gated techniques to try this with", gated.join());
    A.resetPosition(d);
    ok(gated.every((id) => !A.posOk(d, d.p, A.TECH[id])),
       "and out in the centre of the ring none of them is legal");
    const keep = d.p.techs;
    d.p.techs = gated.slice();
    const n = A.attractChoose(d, d.p, A.newAttract());
    d.p.techs = keep;
    ok(n === -1, "a list with nothing legal on it answers 'nothing', not 'the first one'", n);
  }
  {
    // the variety bias: light by default, and it really does bite
    const d = A.G.duel;
    const C = A.ATTRACT_CONFIG;
    ok(C.repeatPenalty > 0 && C.repeatPenalty < 40,
       "the repeat penalty is a thumb on the scale, not a ban", C.repeatPenalty);
    ok(C.recentN >= 2 && C.recentN <= 8, "and it remembers a handful of picks", C.recentN);

    const plain = A.attractChoose(d, d.p, A.newAttract({ rng: () => 0.5 }));
    const st = A.newAttract({ rng: () => 0.5 });
    const first = A.attractChoose(d, d.p, st);
    ok(first === plain, "the first pick of a demo is the AI's own pick", first);
    ok(st.recent.length === 1 && st.recent[0] === d.p.techs[first],
       "and it is remembered, newest first", st.recent.join());

    const keep = C.repeatPenalty;
    C.repeatPenalty = 1e6;                       // crank it so the effect is not a coin toss
    const second = A.attractChoose(d, d.p, st);
    C.repeatPenalty = keep;
    ok(second !== first, "a remembered technique loses ground to the next one down",
       first + " -> " + second);

    for (let i = 0; i < 10; i++) A.attractChoose(d, d.p, st);
    ok(st.recent.length === C.recentN, "the memory is a ring, not a log", st.recent.length);
  }
  {
    // polled from the title screen, where there is no duel
    const st = A.newAttract();
    ok(A.attractChoose(null, null) === -1, "no duel, no answer");
    ok(A.attractChoose(null, { techs: ["jab"] }, st) === -1, "a side without a duel gets none either");
    ok(A.attractChoose({}, { techs: ["jab"] }, st) === -1, "an empty duel object is not enough");
    const d = A.G.duel;
    ok(A.attractChoose(d, { techs: [] }, st) === -1, "a fighter with an empty movelist gets -1");
    ok(A.attractChoose(d, {}, st) === -1, "and so does one with no movelist at all");
    ok(A.attractChoose(d, null, st) === -1, "and no fighter at all");
    ok(A.attractChoose(d, { techs: ["jab"] }, st) === -1,
       "a stranger in neither corner has no opponent to be scored against");
    ok(st.recent.length === 0, "and none of that wrote anything into the memory");
  }

  section("a demo can never hang the front end");
  {
    exec("SAVE=DEF_SAVE(); startDuel({p1:1,oppFid:6,oppHp:140,oppPool:[0,1,2,3,4],oppLv:5});");
    exec("beginRound(G.duel);");
    const d = A.G.duel;
    const live = () => { const s = A.newAttract(); A.attractStart(s, { p1: 1, p2: 6 }); return s; };

    ok(A.attractShouldExit(null, d) === true, "no state at all means stop");
    ok(A.attractShouldExit(A.newAttract(), d) === true, "a state that is not running is already stopped");
    ok(A.attractShouldExit(live(), d) === false, "a healthy fight on turn zero keeps going");
    ok(A.attractShouldExit(live(), null) === true, "the duel going away means stop");
    ok(A.attractShouldExit(live(), {}) === true, "so does a duel with no fighters in it");
    ok(A.attractShouldExit(live(), { p: d.p }) === true, "or only one of them");

    const inp = live(); A.attractPoke(inp);
    ok(A.attractShouldExit(inp, d) === true, "any real input ends it - this is the one that matters");
    const bail = live(); bail.exit = true;
    ok(A.attractShouldExit(bail, d) === true, "and the caller can always ask out");
  }
  {
    const d = A.G.duel;
    const live = () => { const s = A.newAttract(); A.attractStart(s, { p1: 1, p2: 6 }); return s; };
    const C = A.ATTRACT_CONFIG;

    const hpWas = d.e.hp;
    d.e.hp = 0;
    ok(A.attractShouldExit(live(), d) === true, "a knockout ends it");
    d.e.hp = hpWas;
    const phpWas = d.p.hp;
    d.p.hp = 0;
    ok(A.attractShouldExit(live(), d) === true, "so does the demo's own man going down");
    d.p.hp = phpWas;

    const turnWas = d.turn;
    d.turn = C.maxTurns;
    ok(A.attractShouldExit(live(), d) === true, "the turn cap ends it whatever the health bars say");
    d.turn = C.maxTurns - 1;
    ok(A.attractShouldExit(live(), d) === false, "one turn short and it plays on");
    d.turn = turnWas;

    const phWas = d.ph;
    d.ph = A.D.END;
    ok(A.attractShouldExit(live(), d) === true, "the duel reaching its end phase ends it");
    d.ph = phWas;

    const ff = live();
    ok(A.attractShouldExit(ff, Object.assign({}, d, { forfeit: true })) === true, "a forfeit ends it");

    // the two caps the caller keeps itself, for a duel that stops moving
    const stalled = live(); stalled.frames = C.maxFrames;
    ok(A.attractShouldExit(stalled, d) === true,
       "and if the turn counter ever stops moving, the frame ceiling still fires");
    const counted = live(); counted.turns = C.maxTurns;
    ok(A.attractShouldExit(counted, d) === true, "a caller counting turns itself is honoured too");
  }
};
