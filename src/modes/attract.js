/* =====================================================================
   Aqua Zero Heavens Arena - attract mode
   Luminara Digital

   An arcade cabinet nobody is standing at is still fighting. After a
   stretch of silence on the title screen the machine puts two of its own
   up, hangs a DEMO banner over the round and plays. It costs almost
   nothing here because the battle engine already runs with no player and
   no renderer at all - tools/audit-balance.js drives 3,600 fights that
   way - so attract mode is not a second game loop, it is the front end
   asking the same engine to play itself for a minute.

   THE RISK THIS FILE IS BUILT AROUND: `d.p` is the human. mkSide() stamps
   it {human:true}, mastery is applied to it, the corner bag reads it, the
   defence window waits on its input, and the signature opens a three-beat
   timing minigame that only a pair of hands can hit. A demo that drove
   the player side by reaching into the duel and setting fields would
   break every one of those assumptions in a different place.

   So nothing below mutates a duel. Every function is ADVISORY: it answers
   WHEN (attractReady), WHO (attractPick), WHAT NEXT (attractChoose) and
   WHEN TO STOP (attractShouldExit), and the duel loop in
   page.template.html decides whether to act on the answer. The only
   object this file ever writes to is the attract state it created itself.

   The second rule is that every one of these is polled from the TITLE
   screen, where there is no duel, no fighters and no state older than a
   frame. Every entry point therefore has to survive being handed null,
   and a partial duel object is the normal case, not an edge case. When in
   doubt the answer is the boring one: do not start, or stop.

   Globals used at call time only: FIGHTERS, BOSS_ID, TECH, D,
   disciplinesOf, homeRanges, scoreTechnique, aiChooseTechnique,
   seededRng. None of them is touched at load: this module is
   concatenated in above the scene table and the colour constants, so a
   top-level reference to any of them would be a temporal dead zone throw
   and would brick the whole page before the title ever drew.
   ===================================================================== */

/* ---------------------------------------------------------------------
   ATTRACT_CONFIG - every tunable, and literals only.

   Timings are frames at 60fps because that is what step() counts.

   idleFrames is the whole feature's manners. Too short and the demo
   stamps on a player who is reading the fighter count; too long and
   nobody ever sees it. Twenty seconds is the arcade number: long enough
   that it never interrupts, short enough that a machine left alone at a
   games night is fighting by the time anyone looks back at it.

   maxTurns is the safety rail that matters most. The engine's own audit
   caps fights at 60 turns and still times a few out; a demo that ran to
   a real finish could sit on the title screen for four minutes. Twelve
   turns is about forty seconds of fight - a whole exchange arc, the
   range ladder moving, someone in the corner - and then out.
   --------------------------------------------------------------------- */
const ATTRACT_CONFIG = {
  /* Stated, not read - the same declaration MUSIC_CONFIG, ENTRANCE_CONFIG
     and RESULT_CONFIG carry. Every number below is frames, and a config
     that does not say which frames is a config someone will read as
     milliseconds. */
  fps: 60,
  /* 20s at 60fps */
  idleFrames: 1200,
  /* the demo is over after this many turns whatever the health bars say */
  maxTurns: 12,
  /* and after this many frames whatever the turn counter says. Belt and
     braces: if a phase ever stalls, the turn counter stops moving and the
     turn cap alone would never fire. Two minutes, and the title is back. */
  maxFrames: 7200,
  /* banner cadence: lit for bannerOn of every bannerPeriod frames. Half a
     second on, a third of a second off - a blink you read as "this is not
     a fight you are in", not a strobe. */
  bannerPeriod: 48,
  bannerOn: 30,
  label: "DEMO",
  /* after a demo ends, this many frames of title before another can start.
     Without it the idle counter is already past the threshold the frame
     the demo stops and the title screen never gets a turn. */
  cooldown: 240,
  /* the AI runs quieter than a real fight: the demo is a shop window, so
     it should look like two people who know what they are doing rather
     than the difficulty-tuned noise a rookie opponent gets. */
  noise: 10,
  /* frames the demo sits on the command menu before committing, so a
     viewer can see the menu, the tell and the range strip. Instant picks
     read as a video, not as a game being played. */
  beat: 26,
  /* how many past picks the variety bias remembers, and what a repeat
     costs. Deliberately small: this is a thumb on the scale, not a ban.
     A fighter who genuinely should jab four times in a row still does -
     what it stops is the eight-in-a-row that made the old sim reels look
     broken. Scores here are expected damage, typically 20-40, so a
     penalty in the teens moves a close call and nothing else. */
  recentN: 4,
  repeatPenalty: 14,
};

/* ---------------------------------------------------------------------
   the state. Ours, not the duel's - this is the one object in the file
   anything is allowed to write to.

   `idle` counts frames of silence on the title and goes NEGATIVE for the
   cooldown after a demo. `frames` counts the demo itself. They are two
   counters rather than one because they must never run at the same time:
   a demo playing is not the player being idle, and a player watching a
   demo has not gone away.
   --------------------------------------------------------------------- */
function newAttract(opts) {
  opts = opts || {};
  /* a seed is offered so a test (or a bug report) can replay the exact
     demo it saw. Math.random is only ever reached inside a call. */
  const rng = typeof opts.rng === "function" ? opts.rng
    : (opts.seed !== undefined && typeof seededRng === "function" ? seededRng(opts.seed) : null);
  return {
    idle: 0,          // frames of silence on the title (negative = cooling down)
    frames: 0,        // frames this demo has been running
    turns: 0,         // turns the caller has counted, if it is counting
    phase: 0,         // banner blink counter
    banner: true,     // is the banner lit this frame
    on: false,        // is a demo actually playing
    input: false,     // a real key or click arrived while it was
    exit: false,      // the caller wants out for its own reasons
    gesture: false,   // the browser has seen a real gesture at least once
    p1: -1, p2: -1,   // who is in there
    recent: [],       // technique ids recently shown, newest first
    rng,
  };
}

/* one frame. Returns the state so a caller can chain, never null-checks
   for the caller. */
function attractTick(state) {
  if (!state) return null;
  if (state.on) state.frames = (state.frames || 0) + 1;
  else state.idle = (state.idle || 0) + 1;
  const C = ATTRACT_CONFIG;
  state.phase = ((state.phase || 0) + 1) % C.bannerPeriod;
  state.banner = state.phase < C.bannerOn;
  return state;
}

/* the demo is live. Takes the pairing so the state can say who is in
   there without the caller reaching into the duel for it. */
function attractStart(state, pick) {
  if (!state) return null;
  state.on = true;
  state.frames = 0; state.turns = 0;
  state.input = false; state.exit = false;
  state.recent = [];
  state.phase = 0; state.banner = true;
  if (pick) { state.p1 = pick.p1; state.p2 = pick.p2; }
  return state;
}

/* the demo is over. The negative idle IS the cooldown - see the config. */
function attractStop(state) {
  if (!state) return null;
  state.on = false;
  state.frames = 0; state.turns = 0;
  state.recent = [];
  state.idle = -ATTRACT_CONFIG.cooldown;
  return state;
}

/* a real human touched something. Two effects, and they are different:
   the idle clock always restarts, and a demo in progress is now over.
   The gesture flag latches forever because a browser only needs one to
   let audio start, and it never takes it back. */
function attractPoke(state) {
  if (!state) return null;
  state.idle = 0;
  state.gesture = true;
  if (state.on) state.input = true;
  return state;
}

/* ---------------------------------------------------------------------
   attractReady - may a demo start right now.

   Four separate reasons to say no, and all four are real:

   1. A RUN IS IN PROGRESS. Dropping a CPU exhibition on top of a live
      adventure would overwrite G.duel and lose the run. This one is not a
      preference, it is data loss.
   2. THE SAVE IS BRAND NEW. A first-time player has not read the title
      yet, and the first thing the game does must not be to play itself.
      Worse, a demo is a spoiler on a save that has never seen a fight.
      The page can override this once the title has genuinely been sat
      through, with opts.titleSeen.
   3. NO GESTURE YET. Chrome and Safari refuse to start an AudioContext
      before a real input, so a demo launched at t=0 on a fresh page load
      is a silent one - and a silent demo of a fighting game reads as a
      broken page, not as a feature.
   4. WE ARE NOT ON THE TITLE, or a duel already exists.

   Missing opts is a no. The default has to be "do not start", because the
   one thing worse than never seeing the demo is seeing it over the top of
   something else.
   --------------------------------------------------------------------- */
function attractSaveSeen(save) {
  if (!save) return false;
  const rec = save.rec || {};
  return (rec.duels | 0) > 0 || (rec.stages | 0) > 0 || (rec.ngplus | 0) > 0;
}

function attractReady(idleFrames, opts) {
  opts = opts || null;
  if (!opts) return false;
  const need = opts.min === undefined ? ATTRACT_CONFIG.idleFrames : opts.min;
  /* NaN fails this comparison, which is the answer we want anyway */
  if (typeof idleFrames !== "number" || !(idleFrames >= need)) return false;
  if (opts.active) return false;                       // one is already playing
  if (!opts.gesture) return false;
  if (!opts.sound) return false;
  if (opts.runActive) return false;
  if (opts.duel) return false;
  /* a caller that bothers to name the title scene has to say where it
     actually is. Reading "scene undefined" as "close enough" is the one
     shape of this check that can start a demo over a menu, and it is
     precisely the doubt the paragraph above answers with no. */
  if (opts.titleScene !== undefined && opts.scene !== opts.titleScene) return false;
  const sv = opts.save;
  if (!sv) return false;
  if (sv.run) return false;                            // a saved run counts too
  if (!opts.titleSeen && !attractSaveSeen(sv)) return false;
  return true;
}

/* ---------------------------------------------------------------------
   attractPick - who fights.

   Watchable, not fair. Three rules:

   - two DIFFERENT fighters, because a mirror match reads as a bug;
   - never the boss, because the champion at the top of the tower is the
     one thing in the game that should be met and not previewed;
   - and the pairing that shares the LEAST home ground, because that is
     the fight where the range ladder has to move. Two strikers stand at
     MID and trade for twelve turns; a striker against a grappler spends
     the whole demo arguing about where the fight happens, which is the
     actual game.

   That third rule was written as "no shared home range at all" first, and
   measuring it killed it: this is an MMA league, so most dossiers name
   two or three arts and cover most of the ladder. Only 10 of the 552
   possible orderings are strictly disjoint, and 18 of the 24 eligible
   fighters have no disjoint partner anywhere on the roster - the rule
   would have fallen through to a coin toss almost every night. So the
   measure is proportional: the share of home ground the two hold in
   common, minimised, ties broken at random so the demo is not the same
   card forever.

   The rng is a parameter so a demo is reproducible - the same seed picks
   the same fight, which is the difference between a bug report and a
   shrug. opts.homeOf is a seam for the same reason: it lets the pairing
   rule be proven without depending on which disciplines the current
   roster happens to carry.
   --------------------------------------------------------------------- */
function attractHomeRanges(fid, homeOf) {
  if (typeof homeOf === "function") return homeOf(fid) || [];
  if (typeof homeRanges !== "function" || typeof disciplinesOf !== "function") return [];
  return homeRanges(disciplinesOf(fid)) || [];
}

/* the share of home ground two fighters hold in common: 0 they agree on
   nothing, 1 they want the fight in exactly the same places. A fighter
   whose ranges cannot be read counts as 1 - unknown is never a reason to
   claim an interesting matchup. */
function attractOverlap(a, b) {
  if (!a || !b || !a.length || !b.length) return 1;
  let both = 0;
  for (let i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) both++;
  const union = a.length + b.length - both;
  return union > 0 ? both / union : 1;
}

function attractPick(rng, opts) {
  opts = opts || {};
  const R = typeof rng === "function" ? rng : Math.random;
  const n = opts.roster !== undefined ? opts.roster
    : ((typeof FIGHTERS !== "undefined" && FIGHTERS) ? FIGHTERS.length : 0);
  const boss = opts.bossId !== undefined ? opts.bossId
    : ((typeof BOSS_ID !== "undefined") ? BOSS_ID : -1);
  const skip = opts.exclude || [];
  const pool = [];
  for (let i = 0; i < n; i++) if (i !== boss && skip.indexOf(i) < 0) pool.push(i);
  /* a roster too small to make a pairing out of is not an error, it is
     "no demo tonight" - the caller checks p1 */
  if (pool.length < 2) return { p1: -1, p2: -1, overlap: 1, split: false };

  /* an rng that returns exactly 1 would index off the end; clamp rather
     than trust it, because the rng is a caller's */
  const draw = (arr) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(R() * arr.length)))];

  const p1 = draw(pool);
  const rest = pool.filter((i) => i !== p1);
  const mine = attractHomeRanges(p1, opts.homeOf);
  let lo = 2;
  const scored = rest.map((i) => {
    const o = attractOverlap(mine, attractHomeRanges(i, opts.homeOf));
    if (o < lo) lo = o;
    return { i, o };
  });
  /* every candidate tied at the minimum, so the least-shared rule does not
     also fix the name - a demo that showed the same two men every night
     would be a worse advert than a random one */
  const best = scored.filter((x) => x.o <= lo + 1e-9).map((x) => x.i);
  return { p1, p2: draw(best), overlap: lo, split: lo < 1 };
}

/* ---------------------------------------------------------------------
   attractChoose - what the demo throws next, for either side.

   Returns an INDEX into side.techs, or -1 when there is nothing to
   choose. An index rather than a technique because the caller has to map
   it back onto the live list anyway, and because the live list is the one
   thing that is definitely legal to throw - it has already had the run's
   cuts removed and its drafts added.

   The decision is the game's own: scoreTechnique() is the CPU brain, and
   the demo asks it exactly what the CPU asks it. Rewriting that scoring
   here would mean a demo that plays a different game from the one on
   sale, and it would drift the first time anyone tuned the AI.

   Two deliberate departures:

   SIGNATURES ARE SUPPRESSED. A full meter opens D.SUPER, a three-beat
   timing input. The CPU can hit it; the demo driving the player side
   cannot, and the phase then sits on a swinging meter for six seconds
   waiting for the timeout. That is not a demo, that is a hang with a
   progress bar. superChance 0, and the scoring loop only ever walks
   side.techs, which the signature is not in.

   VARIETY. The unmodified brain is close to deterministic once the noise
   is turned down, and a demo that shows the same overhand eight times
   looks like the game only has one technique. Recent picks carry a small
   recency-weighted penalty - the most recent costs the most - so a close
   second choice wins the next turn and a genuinely dominant technique
   still gets thrown again.
   --------------------------------------------------------------------- */
function attractChoose(d, side, state) {
  if (!d || !side) return -1;
  const list = side.techs;
  if (!list || !list.length) return -1;
  if (!d.p || !d.e || !d.range) return -1;
  if (typeof TECH === "undefined" || !TECH) return -1;
  /* a side that is neither corner of this duel has no opponent, and
     guessing one would score the demo against a stranger */
  const foe = side === d.p ? d.e : side === d.e ? d.p : null;
  if (!foe || foe === side) return -1;

  const R = (state && state.rng) || Math.random;
  const recent = (state && state.recent) || [];
  const C = ATTRACT_CONFIG;
  /* the archetype's own jitter is part of the brain - aiChooseTechnique
     scales its noise by side.ai.noise - so scoring without it would make
     the demo's counter-striker read steadier than the one a player fights */
  const noise = C.noise * ((side.ai && side.ai.noise) || 1);

  let bestIx = -1, unknown = 0;
  /* scoreTechnique returns exactly -1e9 for a technique that is illegal
     from where the fight is standing, so the opening bid sits AT that floor
     and never below it. This was written the other way round first and
     measured: with the bid at -1e12, a side holding nothing but the ring
     techniques out of position came back with ring_circle and posOk() false
     - the demo commanding a move the engine had already refused.
     aiChooseTechnique opens at -1e9 for exactly this reason. */
  let bs = -1e9;
  if (typeof scoreTechnique === "function") {
    for (let i = 0; i < list.length; i++) {
      const t = TECH[list[i]];
      if (!t) { unknown++; continue; }
      let sc = scoreTechnique(d, side, foe, t, noise, R);
      const ago = recent.indexOf(list[i]);
      if (ago >= 0) sc -= C.repeatPenalty * (C.recentN - ago) / C.recentN;
      if (sc > bs) { bs = sc; bestIx = i; }
    }
  }
  /* the fallback answers the case where every score came back unusable and
     the engine's own tie-break (guard) is the better answer.

     It is gated on the dex knowing EVERY id, and that gate is the point:
     aiChooseTechnique walks side.techs and dereferences TECH[id] with no
     guard, so scoreTechnique then reads tech.range off undefined. Handing
     it a list the dex does not know throws TypeError inside the engine
     instead of returning a pick, and a throw here takes the title screen
     down with it. An unknown id is therefore a reason to answer -1 - which
     is the caller's "nothing to throw" - and never a reason to ask again. */
  if (bestIx < 0 && unknown === 0 && typeof aiChooseTechnique === "function") {
    const pick = aiChooseTechnique(d, side, foe, { noise: noise, rnd: R, superChance: 0 });
    if (pick && pick.tech) bestIx = list.indexOf(pick.tech.id);
  }
  if (bestIx < 0) return -1;

  /* the only write in the function, and it is to our own state */
  if (state && state.recent) {
    state.recent.unshift(list[bestIx]);
    if (state.recent.length > C.recentN) state.recent.length = C.recentN;
  }
  return bestIx;
}

/* ---------------------------------------------------------------------
   attractShouldExit - the only question the front end has to get right.

   Every exit route in one predicate, because the failure mode of an
   attract mode is not a wrong answer, it is a title screen that never
   comes back. A player who pressed a key and got nothing believes the
   game has crashed, and they are almost right.

   True when: the caller has no state, no demo is running, a real input
   arrived, the duel has gone away, either fighter is out, the duel has
   reached its end phase, or either cap is hit. "No demo is running"
   answering true is deliberate - the question is "should this stop", and
   something that is not running has certainly stopped.
   --------------------------------------------------------------------- */
function attractShouldExit(state, d) {
  if (!state) return true;
  if (!state.on) return true;
  if (state.input || state.exit) return true;
  const C = ATTRACT_CONFIG;
  if ((state.frames || 0) >= C.maxFrames) return true;
  if ((state.turns || 0) >= C.maxTurns) return true;
  if (!d) return true;
  const p = d.p, e = d.e;
  if (!p || !e) return true;
  if (typeof d.turn === "number" && d.turn >= C.maxTurns) return true;
  if ((p.hp || 0) <= 0 || (e.hp || 0) <= 0) return true;
  if (d.forfeit) return true;
  const PH = (typeof D !== "undefined" && D) ? D : null;
  if (PH && d.ph === PH.END) return true;
  return false;
}
