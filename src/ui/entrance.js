/* =====================================================================
   Aqua Zero Heavens Arena - the walkout
   Luminara Digital

   The pre-fight moment used to be a caption. Two names, two discipline
   lines, the word VS, and at frame 44 the word FIGHT! - 78 frames of a
   screen that never moved and never told you anything the brief had not
   already told you. It cost 1.3 seconds and bought nothing, which is the
   worst trade in the game: a beat the player has to sit through and
   cannot read.

   This file replaces it with a staged walkout. One fighter at a time
   owns the screen - art slides in, a nameplate builds under him, a sting
   lands, it holds a beat - then the other man gets exactly the same
   treatment, then a VS card, then the bell. Pride FC ran its cards this
   way for a reason: a fight between two strangers is a fight you do not
   care about, and the only cheap way to make a stranger matter is to
   point a light at him on his own for a second and a half.

   THIS FILE OWNS THE TIMELINE, NOT THE PIXELS. There is no canvas, no
   cx, no DOM and no audio below - the same rule src/ui/anim.js states in
   its header, for the same reason. Everything here is frames in and
   numbers out: 0..1 progress values the renderer turns into slide
   offsets, alphas, spotlight radii and nameplate reveals, and cue names
   the page hands to the music layer. That split is what lets one
   timeline drive the duel screen, an attract loop, and a test that
   asserts the bell rings exactly once.

   BUDGET: an unskipped exhibition walkout is 214 frames - 3.57 seconds
   at 60fps. The title bout is 280 - 4.67 seconds. Both numbers are the
   sum of the literals in ENTRANCE_CONFIG and nothing else, so the cost
   of the ceremony is auditable from the top of the file. Past about five
   seconds a walkout stops being a walkout and becomes a loading screen.

   SKIPPABILITY IS THE WHOLE DEAL. Ceremony you cannot leave is friction.
   A press of A calls entranceSkip and the bell beat starts on that exact
   frame - not a fade, not a fast-forward. The two stings are latched
   without firing, because a skip that dumps three unplayed cues into the
   mixer at once is a bug the player hears.

   CUES ARE LATCHED, NEVER COMPARED. mainLoop runs up to 8 step() calls
   inside one animation frame (see the guard in mainLoop), so `t === 44`
   is a coin flip, not a schedule - on a slow frame the bell simply never
   rings. entranceCues therefore asks "has this cue's frame passed AND
   has it not fired yet", latches it in the state, and returns an ARRAY,
   because a catch-up of eight frames can legitimately cross two cues at
   once and both of them have to come out.

   REDUCED MOTION: the beat structure, the durations and every cue are
   identical with motion off. Only travel, the spotlight pulse and the
   sting flash collapse to zero. A player who turned motion off asked for
   stillness, not for a shorter show - the nameplates still build, the
   stings still land in the mixer, the bell still rings on frame 188.

   DETERMINISM: no Math.random, no Date, anywhere. The same state and the
   same frame produce the same descriptor forever, which is what makes
   the timeline testable frame by frame.

   Globals assumed: none. This module depends on nothing else in src/ and
   may sit anywhere in MODULE_ORDER.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Small local maths. Deliberately NOT EASE/clamp/seg from anim.js: those
   are `const` at module top level, so borrowing them would silently
   couple this file's position in MODULE_ORDER to anim.js's. Function
   declarations hoist; a const does not. Four functions is a cheaper
   price than an ordering constraint nobody would remember.
   --------------------------------------------------------------------- */
function entClamp01(n) { return n < 0 ? 0 : (n > 1 ? 1 : n); }
/* x/len as a 0..1 fraction, with the divide-by-zero a zeroed beat in
   ENTRANCE_CONFIG would otherwise produce */
function entFrac(x, len) { return len > 0 ? entClamp01(x / len) : (x > 0 ? 1 : 0); }
/* the workhorse: fast off the mark, settles. Everything that arrives. */
function entEaseOut(p) { const q = 1 - entClamp01(p); return 1 - q * q * q; }
/* the mirror, for anything being taken away */
function entEaseIn(p) { const q = entClamp01(p); return q * q * q; }
/* a frame number that is always a usable number */
function entNum(t) { const n = +t; return n === n && n !== Infinity && n !== -Infinity ? n : 0; }

/* ---------------------------------------------------------------------
   entLive - does this state still carry the timeline newEntrance built?

   A null state was always handled. A HALF-BUILT one was not, and it is
   the likelier accident: nothing persists G.duel, so the realistic
   source is a duel object assembled by hand in a test or a future mode,
   which gets `{}` rather than undefined. The cost of not checking is
   badly asymmetric. entranceCues and entranceDone are called from
   step(), and mainLoop wraps only render() in a try/catch - the
   `while(acc>=TICK&&guard++<8){ step(); }` above it is bare, so one
   TypeError out of step() ends the requestAnimationFrame chain and the
   game freezes for the rest of the session, not for a frame. A partial
   state is therefore no state: the ceremony is skipped and the fight
   starts, which is the same failure mode as a duel that never built one.
   --------------------------------------------------------------------- */
function entLive(state) {
  return !!(state && state.segs && state.segs.length && state.cues &&
            state.fired && state.rec && state.total > 0);
}

/* ---------------------------------------------------------------------
   ENTRANCE_CONFIG - every frame budget in one place, all literals.

   Six nameable beats. If you cannot say out loud what a beat is for, it
   should not have frames:

     slide   the man arrives and the spotlight opens on him
     plate   his nameplate builds - name, discipline line, record
     sting   the hit that punctuates him
     hold    the beat where nothing happens, which is what makes the
             sting read as a sting instead of a transition
     vs      the two-shot card with the billing on it
     bell    the last flash and the handoff to the fight

   One walk is slide+plate+sting+hold = 74 frames. Two walks plus the
   vs card plus the bell is 214.

   The title bout lengthens BOTH walks, not just the champion's. An
   asymmetric card makes the shorter man's sting feel like a mistake
   rather than a choice - the audience reads the difference in length as
   the production running out of tape, not as billing. Billing lives in
   `billing`, `banner` and `role`, which is where it can be argued with.

   `billing` WAS CALLED `heat`, AND THAT NAME WAS A TRAP. It is a 0..1
   weight for how big the fight is being sold as, and src/ui/music.js
   exports musicHeat(state, level) taking a 0..1 knob for how DESPERATE
   the fight has got. Two different quantities, the same range, adjacent
   names: `musicHeat(G.music, d.heat)` reads correct and is not. A boss
   billed 1.00 fed into that knob sits above MUSIC_CONFIG.hotAt, so the
   title fight opens in fight_hot with both men untouched and the score
   has nowhere left to go for the rest of the bout. Renamed so the wrong
   line no longer reads like the right one.
   --------------------------------------------------------------------- */
const ENTRANCE_CONFIG = {
  fps: 60,

  /* per fighter: 26+22+10+16 = 74 frames, 1.23s */
  walk: { slide: 26, plate: 22, sting: 10, hold: 16 },

  /* the shared tail: 40+26 = 66 frames, 1.10s */
  card: {
    vs: 40, bell: 26,
    /* the VS card slams rather than fades - it arrives in the first 40%
       of its own beat and then just sits there being read */
    slamFrac: 0.40,
    slamFlash: 10,      /* frames the slam's white-out takes to decay */
    bellFlash: 8,       /* the bell hits harder and shorter */
    flashMul: 0.6,      /* the card is a punctuation mark, not a sting */
    dim: 0.55,          /* both men lit, so the house comes part-way up */
  },

  /* art fades up faster than it arrives, or the first frames of a slide
     are a solid rectangle sliding, which reads as a bug */
  fade: { frac: 0.6 },

  spot: {
    openFrac: 0.7,      /* the light is fully open before the slide ends */
    closeFrac: 0.55,    /* and closes over the tail of the hold, which is
                           what makes the handoff to the next man read as
                           a handoff rather than a cut */
    pulseRate: 0.16,    /* radians per frame - a slow breathing arc lamp */
    pulseAmp: 0.05,
    dimMax: 0.72,       /* how dark the rest of the arena goes */
  },

  /* instant on, decaying out. A sting with an attack ramp reads as a
     swell; the point of a sting is that it has already happened. */
  sting: { flash: 0.7, tail: 0.6 },

  /* nameplate rows, as fractions of the plate reveal. Three rows, three
     thresholds: the name lands immediately, the discipline line a beat
     later, the head-to-head record last - it is the one row that is
     sometimes empty, so it must never be the row holding up the others. */
  reveal: { rows: [0.05, 0.42, 0.78] },

  /* reduced motion multiplies the moving parts by nothing and leaves
     everything else exactly where it was */
  reduced: { travelMul: 0, pulseMul: 0, flashMul: 0 },

  /* the flag that decides the billing. First match in `order` wins, so a
     boss who is also ranked is billed as the boss. */
  order: ["boss", "nemesis", "grudge", "daily", "survival", "ranked", "hotseat", "adventure"],

  flavours: {
    /* the only flavour that buys extra frames. A title fight is allowed
       to be 66 frames longer than an exhibition; nothing else is. */
    boss:       { key: "boss",       billing: 1.00, role: "champion",
                  banner: "THE TOWER - FINAL BOUT",
                  add: { slide: 12, hold: 14, vs: 14 } },
    nemesis:    { key: "nemesis",    billing: 0.80, role: "nemesis",
                  banner: "HE TOOK ONE OFF YOU THIS RUN", add: {} },
    grudge:     { key: "grudge",     billing: 0.70, role: "rival",
                  banner: "THEY REMEMBER BEATING YOU", add: {} },
    daily:      { key: "daily",      billing: 0.55, role: "challenger",
                  banner: "DAILY GAUNTLET", add: {} },
    survival:   { key: "survival",   billing: 0.55, role: "challenger",
                  banner: "SURVIVAL", add: {} },
    ranked:     { key: "ranked",     billing: 0.50, role: "challenger",
                  banner: "RANKED BOUT", add: {} },
    hotseat:    { key: "hotseat",    billing: 0.40, role: "challenger",
                  banner: "TWO PLAYERS", add: {} },
    adventure:  { key: "adventure",  billing: 0.36, role: "challenger",
                  banner: "ADVENTURE", add: {} },
    exhibition: { key: "exhibition", billing: 0.35, role: "challenger",
                  banner: "EXHIBITION", add: {} },
  },
};

/* ---------------------------------------------------------------------
   newEntrance - build the timeline once, at the bell.

   opts:
     pFid, eFid   the two fighter ids, in DUEL corner order (pFid is the
                  left corner, d.p.fid; eFid is the right, d.e.fid).
                  `p` and `e` are accepted as aliases.
     human        "p" or "e" - which corner the player is in. "p1"/"p2"
                  are accepted. The human's corner walks FIRST, so the
                  opponent closes the card; the man you have to beat is
                  the one the lights leave last.
     rec          { w, l } - the PLAYER's head-to-head record against
                  this opponent (SAVE.fr[eFid] shape: w is your wins, l
                  is your losses). entranceBeat mirrors it for whichever
                  corner is lit, so the caller never flips it by hand.
     motion       false collapses travel. Default true.
     boss, ranked, survival, nemesis, grudge, daily, hotseat
                  the flags the duel already computes.

   Returns a state object. It is plain data - it lives on the duel, it is
   never persisted, and every function below takes it as its first
   argument.
   --------------------------------------------------------------------- */
function newEntrance(opts) {
  opts = opts || {};
  const C = ENTRANCE_CONFIG;

  const flags = {
    boss: !!opts.boss, ranked: !!opts.ranked, survival: !!opts.survival,
    nemesis: !!opts.nemesis, grudge: !!opts.grudge, daily: !!opts.daily,
    hotseat: !!opts.hotseat, adventure: !!opts.adventure,
  };
  let key = "exhibition";
  for (let i = 0; i < C.order.length; i++) {
    if (flags[C.order[i]]) { key = C.order[i]; break; }
  }
  const fl = C.flavours[key] || C.flavours.exhibition;
  const add = fl.add || {};

  /* Math.max(1,...) so a beat someone zeroed in config still occupies a
     frame: a zero-length beat would make its cue and its progress values
     unreachable, and the failure would look like a missing sound rather
     than a bad number */
  const w = {
    slide: Math.max(1, C.walk.slide + (add.slide || 0)),
    plate: Math.max(1, C.walk.plate + (add.plate || 0)),
    sting: Math.max(1, C.walk.sting + (add.sting || 0)),
    hold:  Math.max(1, C.walk.hold  + (add.hold  || 0)),
  };
  const vsLen = Math.max(1, C.card.vs + (add.vs || 0));
  const bellLen = Math.max(1, C.card.bell + (add.bell || 0));
  const walkLen = w.slide + w.plate + w.sting + w.hold;

  const human = (opts.human === "e" || opts.human === "p2") ? "e" : "p";
  const first = human, second = human === "p" ? "e" : "p";

  const segs = [];
  const cut = (stage, part, side, len) => {
    const a = segs.length ? segs[segs.length - 1].b : 0;
    segs.push({ stage: stage, part: part, side: side, a: a, b: a + len, len: len });
  };
  /* READ THIS BEFORE WIRING A CORNER TO A STAGE. "p1" and "p2" are
     ORDINALS - first walkout and second walkout - not corners. The human
     walks first, so with human === "e" the stage named "p1" carries
     side "e" and fid === eFid. The corner is always seg.side and never
     the stage name, and the same goes for the cue keys sting_p1 and
     sting_p2. Reading them as "player one" wires the left corner's sound
     to the right corner's man in every hotseat and every e-corner duel,
     and it looks like an audio bug rather than a naming one. */
  cut("p1", "slide", first,  w.slide);
  cut("p1", "plate", first,  w.plate);
  cut("p1", "sting", first,  w.sting);
  cut("p1", "hold",  first,  w.hold);
  cut("p2", "slide", second, w.slide);
  cut("p2", "plate", second, w.plate);
  cut("p2", "sting", second, w.sting);
  cut("p2", "hold",  second, w.hold);
  cut("vs",   "card", "both", vsLen);
  cut("bell", "bell", "both", bellLen);

  const bellAt = 2 * walkLen + vsLen;
  const rec = opts.rec || {};

  return {
    pFid: opts.pFid !== undefined ? opts.pFid : (opts.p !== undefined ? opts.p : null),
    eFid: opts.eFid !== undefined ? opts.eFid : (opts.e !== undefined ? opts.e : null),
    human: human, first: first, second: second,
    flags: flags,
    flavour: fl.key, banner: fl.banner, billing: fl.billing, role: fl.role,
    motion: opts.motion !== false,
    rec: { w: Math.max(0, rec.w || 0), l: Math.max(0, rec.l || 0) },
    beats: { slide: w.slide, plate: w.plate, sting: w.sting, hold: w.hold,
             vs: vsLen, bell: bellLen },
    segs: segs,
    walkLen: walkLen,
    bellAt: bellAt,
    total: bellAt + bellLen,
    /* Sorted by frame, because a catch-up returns them in this order and
       the mixer wants the sting before the bell.

       THE IDS ARE crowdSwell()'s VOCABULARY, NOT THIS FILE'S. The opening
       swell is "entrance" rather than the "crowd" it was first called,
       because crowdSwell in src/ui/music.js authors an envelope under that
       exact name - gain 0.036, a 40-frame attack, a 120-frame release.
       crowdSwell("crowd") matches nothing and falls through to the
       unnamed-event room tone: half the gain and a 14-frame attack, which
       is the arena sounding empty on the one beat the walkout exists for.
       Naming the cue after the envelope means the mixer is
       `crowdSwell(id)` with no translation table to drift out of date.
       "bell" already lined up. The two stings are musical hits with no
       crowd envelope of their own and are the mixer's to place.

       `id`, not `key`: src/ui/results.js names a ceremony beat the same
       way, and one renderer reads both timelines. */
    cues: [
      { id: "entrance", at: 0 },
      { id: "sting_p1", at: w.slide + w.plate },
      { id: "sting_p2", at: walkLen + w.slide + w.plate },
      { id: "bell",     at: bellAt },
    ],
    fired: { entrance: false, sting_p1: false, sting_p2: false, bell: false },
    /* added to every incoming t. entranceSkip is the only thing that
       moves it, and it only ever moves it forward. */
    warp: 0,
    skipped: false,
    /* the last frame anything asked about, so a bare entranceSkip(state)
       from a key handler still knows where the show had got to */
    lastT: 0,
  };
}

/* the frame the timeline is actually on, after any skip */
function entEffective(state, t) {
  const e = entNum(t) + (state.warp || 0);
  return e < 0 ? 0 : e;
}

/* the neutral descriptor: what the renderer draws when the ceremony is
   over, and what it gets if it asks a null state. Every field the live
   descriptor has, all of them safe to multiply by. */
function entShell(state) {
  return {
    stage: "done", part: "done", lit: "none", side: "none", fid: null,
    you: false, role: "",
    t: state ? state.total : 0, total: state ? state.total : 0,
    p: 1, overall: 1,
    slide: 1, travel: 0, dir: 0, alpha: 1,
    spot: 0, pulse: 0, dim: 0,
    plate: 0, rows: 0,
    sting: 0, flash: 0, vs: 0, bell: 1,
    /* guarded field by field rather than on `state` alone, because the
       shell is the thing a broken caller falls back to and it must not
       be the thing that throws */
    rec: { w: state && state.rec ? state.rec.w : 0,
           l: state && state.rec ? state.rec.l : 0, known: false },
    flavour: state ? state.flavour : "exhibition",
    banner: state ? state.banner : "",
    billing: state ? state.billing : 0,
    motion: state ? state.motion : true,
    skipped: state ? !!state.skipped : false,
    done: true,
  };
}

/* the head-to-head, seen from one corner. state.rec is always the
   player's view; the opponent's view is the same two numbers swapped. */
function entRecFor(state, side) {
  const w = side === "e" ? state.rec.l : state.rec.w;
  const l = side === "e" ? state.rec.w : state.rec.l;
  return { w: w, l: l, known: (w + l) > 0 };
}

/* who this man is on the card. The human corner is never billed as an
   opponent, even in a title fight - the champion tag belongs to the man
   across the ring. */
function entRoleFor(state, side) {
  if (side === state.human) {
    if (state.flags.hotseat) return side === state.first ? "player_one" : "player_two";
    return "you";
  }
  if (state.flags.hotseat) return side === state.first ? "player_one" : "player_two";
  return state.role;
}

/* ---------------------------------------------------------------------
   entranceBeat - the descriptor for frame t. Pure: it reads the state
   and never writes it, so the renderer can call it as many times per
   frame as it likes (and mainLoop's catch-up means it will).

   `motion` overrides state.motion when passed; omit it and the state's
   own flag decides. Pass motionOn() from the page and the option screen
   works without rebuilding the timeline.

   Every 0..1 value below is a WEIGHT, not a measurement. `travel` is a
   signed unit offset the renderer multiplies by whatever span the corner
   is worth on its canvas - W and H are not this file's business.
   --------------------------------------------------------------------- */
function entranceBeat(state, t, motion) {
  if (!entLive(state)) return entShell(null);
  const C = ENTRANCE_CONFIG;
  const on = motion === undefined ? state.motion !== false : motion !== false;
  const e = entEffective(state, t);
  if (e >= state.total) return entShell(state);

  let seg = state.segs[state.segs.length - 1];
  for (let i = 0; i < state.segs.length; i++) {
    if (e < state.segs[i].b) { seg = state.segs[i]; break; }
  }

  const w = state.beats;
  const travelMul = on ? 1 : C.reduced.travelMul;
  const pulseMul = on ? 1 : C.reduced.pulseMul;
  const flashMul = on ? 1 : C.reduced.flashMul;

  const d = {
    stage: seg.stage, part: seg.part, lit: seg.side, side: seg.side,
    fid: null, you: false, role: "",
    t: e, total: state.total,
    p: entFrac(e - seg.a, seg.len),
    overall: entFrac(e, state.total),
    slide: 1, travel: 0, dir: 0, alpha: 1,
    spot: 0, pulse: 0, dim: 0,
    plate: 0, rows: 0,
    sting: 0, flash: 0, vs: 0, bell: 0,
    rec: entRecFor(state, seg.side === "both" ? state.human : seg.side),
    flavour: state.flavour, banner: state.banner, billing: state.billing,
    motion: on, skipped: !!state.skipped, done: false,
  };

  if (seg.stage === "p1" || seg.stage === "p2") {
    /* the corner the light is on decides which way the man came from:
       the left corner arrives from off the left edge, so its travel is
       negative. The renderer multiplies; it does not decide direction. */
    d.dir = seg.side === "e" ? 1 : -1;
    d.fid = seg.side === "e" ? state.eFid : state.pFid;
    d.you = seg.side === state.human;
    d.role = entRoleFor(state, seg.side);

    const wt = e - (seg.stage === "p1" ? 0 : state.walkLen);

    d.slide = entEaseOut(entFrac(wt, w.slide));
    d.travel = (1 - d.slide) * d.dir * travelMul;
    d.alpha = entEaseOut(entFrac(wt, w.slide * C.fade.frac));

    const closeLen = w.hold * C.spot.closeFrac;
    /* walkLen - 1, not walkLen: the last frame this walk is ever asked
       about is walkLen-1, so measuring the close against walkLen leaves
       it unfinished. It used to land at 0.30 and then cut to 0 when the
       next man's slide reset it - a 30% brightness step, twice a
       walkout, which is exactly the cut this beat exists to avoid. */
    const closeAt = (state.walkLen - 1) - closeLen;
    const open = entEaseOut(entFrac(wt, w.slide * C.spot.openFrac));
    const close = wt > closeAt ? entEaseIn(entFrac(wt - closeAt, closeLen)) : 0;
    d.spot = open * (1 - close);
    d.pulse = Math.sin(wt * C.spot.pulseRate) * C.spot.pulseAmp * pulseMul;
    /* the house darkens ONCE, at the top of the show, and stays dark
       until the bell. Tying dim to the moving spotlight instead put a
       one-frame flash of full arena light between the two walkouts. */
    d.dim = C.spot.dimMax * entEaseOut(entFrac(e, w.slide * C.spot.openFrac));

    d.plate = entEaseOut(entFrac(wt - w.slide, w.plate));
    d.rows = entRowsAt(d.plate);

    const stingAt = w.slide + w.plate;
    if (wt >= stingAt) {
      const tail = w.sting + w.hold * C.sting.tail;
      d.sting = 1 - entEaseOut(entFrac(wt - stingAt, tail));
    }
    d.flash = d.sting * C.sting.flash * flashMul;
    return d;
  }

  if (seg.stage === "vs") {
    const vt = e - seg.a;
    d.vs = entEaseOut(entFrac(vt, seg.len * C.card.slamFrac));
    d.spot = 1; d.dim = C.card.dim;
    d.plate = 1; d.rows = C.reveal.rows.length;
    d.role = state.role;
    d.flash = (1 - entEaseOut(entFrac(vt, C.card.slamFlash)))
              * C.sting.flash * C.card.flashMul * flashMul;
    return d;
  }

  /* the bell: the card strikes off, the house lights come up, and the
     duel takes the screen back */
  const bt = e - seg.a;
  const bp = entFrac(bt, seg.len);
  d.bell = bp;
  d.vs = 1 - entEaseIn(bp);
  d.spot = 1;
  d.dim = C.card.dim * (1 - entEaseOut(bp));
  d.plate = 1 - entEaseIn(bp);
  d.rows = entRowsAt(d.plate);
  d.role = state.role;
  d.flash = (1 - entEaseOut(entFrac(bt, C.card.bellFlash))) * C.sting.flash * flashMul;
  return d;
}

/* how many nameplate rows are up at this reveal. Thresholds rather than
   a multiply, so the row order is stated in config and readable. */
function entRowsAt(plate) {
  const rows = ENTRANCE_CONFIG.reveal.rows;
  let n = 0;
  for (let i = 0; i < rows.length; i++) if (plate >= rows[i]) n = i + 1;
  return n;
}

/* ---------------------------------------------------------------------
   entranceSkip - jump to the bell.

   Idempotent, safe before the entrance has started, safe twice, safe
   after the bell has already begun. It does not shorten the timeline; it
   slides the timeline under the caller's frame counter, so the bell beat
   plays in full from the frame the button went down and the duel leaves
   INTRO the normal way. Collapsing the timeline instead would land the
   player mid-bell or past it depending on when they pressed, which is a
   different fight opening every time.

   `t` is the caller's current frame. Omit it and the state uses the last
   frame entranceCues or entranceDone was asked about, which in the duel
   loop is the current frame anyway.

   The two stings are LATCHED WITHOUT FIRING. The player skipped them;
   playing them into the mixer on the way past is the exact noise the
   skip was pressed to avoid. `entrance` - the crowd swell - is
   deliberately not latched: if the entrance is skipped before it ever
   drew a frame, the crowd still comes up with the bell, because a bell
   in a silent room is worse than no bell.
   --------------------------------------------------------------------- */
function entranceSkip(state, t) {
  if (!entLive(state)) return state;
  const at = t === undefined ? entNum(state.lastT) : entNum(t);
  if (!state.skipped) {
    /* only ever forward. Pressing A during the bell must not rewind into
       it and ring it twice. */
    if (at + (state.warp || 0) < state.bellAt) state.warp = state.bellAt - at;
    state.fired.sting_p1 = true;
    state.fired.sting_p2 = true;
    state.skipped = true;
  }
  state.lastT = at;
  return state;
}

/* ---------------------------------------------------------------------
   entranceDone - the boolean the duel loop polls to leave D.INTRO.
   A null state is done, so a duel that never built one still starts.
   --------------------------------------------------------------------- */
function entranceDone(state, t) {
  if (!entLive(state)) return true;
  state.lastT = entNum(t);
  return entEffective(state, t) >= state.total;
}

/* ---------------------------------------------------------------------
   entranceCues - the cues that became due at or before frame t and have
   not fired yet, in frame order.

   Call this from step(), never from render(): it LATCHES. render() runs
   once per animation frame and step() runs up to eight times inside it,
   so a cue latched in render would be a cue that fires on a schedule the
   monitor sets.

   Returns an ARRAY. It is empty on most frames, holds one cue on a cue
   frame, and can hold two when the loop catches up across a gap - which
   is exactly the case an equality test on t drops on the floor. The
   caller iterates; it does not compare.
   --------------------------------------------------------------------- */
function entranceCues(state, t) {
  const out = [];
  if (!entLive(state)) return out;
  const e = entEffective(state, t);
  state.lastT = entNum(t);
  for (let i = 0; i < state.cues.length; i++) {
    const c = state.cues[i];
    if (!state.fired[c.id] && e >= c.at) { state.fired[c.id] = true; out.push(c.id); }
  }
  return out;
}
