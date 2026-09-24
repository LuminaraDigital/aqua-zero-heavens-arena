/* =====================================================================
   Aqua Zero Heavens Arena - technique-driven animation
   Luminara Digital

   The old layer shook and lunged. Every technique in a 500-entry dex read
   as the same 38px step forward, which meant the motion carried no
   information at all: with the text off you could not tell a head kick
   from an armbar, and the player had no reason to look at the fighters.

   This file turns a technique plus its resolution event into a motion
   descriptor. It answers one question - "what should this LOOK like" -
   and answers it with numbers only. There is deliberately no canvas, no
   ctx, no DOM and no drawing anywhere below: the renderer owns pixels,
   this owns intent. That split is what lets the same descriptor drive the
   duel screen, a replay, or a test that asserts a takedown reads as low.

   The design rule is twelve legible motions, not fifty mushy ones. Each
   kind has to be nameable from across the room:

     poke      quick stick, in and straight back out
     strike    committed hand at boxing range, weight over the front foot
     kick      deep lunge from long range, hip carries it round
     spin      the whole body turns through the shot
     inside    clinch knee/elbow - no travel at all, everything upward
     air       leaves the floor, crosses, lands
     throw     lifts, turns over the top, comes down low
     takedown  level change: sinks first, then drives, and STAYS down
     sub       compresses onto the hold and stops there
     guard     tucks, settles back, braces
     ground    low and heavy, grinding, no step forward
     setup     a weight shift and a look - no commitment

   plus four reactions, taken by passing tech = null:

     recoil    snapped back by something clean
     stagger   turned off balance and dropped
     blocked   shoved back on the shell
     slip      the shot found nothing and they leaned out of it

   BUDGET: this is a turn-based game. Nobody wants to sit through 40
   frames to watch a jab. Everything here is under 24 frames at 60fps
   except a flagged finisher, which is allowed 40 because it happens once.

   REDUCED MOTION: every entry point takes an optional `motion` boolean,
   default true. When false the kind is preserved (the renderer and the
   log can still branch on it) but every amplitude collapses to zero and
   the duration drops to a handful of frames. Nothing moves, nothing
   flashes, nothing shakes, and the fight still paces correctly. This is
   not a downgrade path bolted on at the end - it is the same code with
   the amplitudes multiplied by nothing.

   RANDOMNESS: none, except behind an `rnd` parameter that defaults to
   Math.random. Two identical liver shots should not be pixel-identical,
   but a test must be able to pin them.

   Globals assumed: TECH, RANGE_INDEX, RANGE_ORDER, STATUS.
   ===================================================================== */

/* ---------------------------------------------------------------------
   EASE - the small set everything else is built from.
   Kept deliberately short. Four curves cover every motion in the file;
   a fifth would just be a slower version of one of these.
   --------------------------------------------------------------------- */
const EASE = {
  /* no shaping - used where the motion IS the shape (a full spin) */
  linear: (p) => p,
  /* the workhorse. Fast off the mark, settles at the end. Everything a
     fighter does explosively starts like this. */
  easeOut: (p) => 1 - Math.pow(1 - p, 3),
  /* the mirror - for weight being gathered before it is spent */
  easeIn: (p) => p * p * p,
  /* travel that has to start and stop under control: a level change, a
     fighter walking themselves back to stance */
  easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  /* overshoot and settle. A body that got moved does not stop dead, it
     rings. Only used on reactions, never on a technique the fighter chose
     to throw - deliberate motion should look controlled. */
  spring: (p) => {
    const c = ANIM_CONFIG.spring;
    return 1 - Math.cos(p * Math.PI * c.freq) * Math.exp(-p * c.damp);
  },
};

/* out and back: the shape of almost every strike. Rises to 1 at `peak`
   of the way through, then returns to 0. The peak sits early because a
   punch spends most of its time coming back, not going out. */
function outBack(p, peak) {
  if (p <= 0 || p >= 1) return 0;
  const k = peak === undefined ? 0.35 : peak;
  return p < k ? EASE.easeOut(p / k) : 1 - EASE.easeInOut((p - k) / (1 - k));
}
/* out, HOLD, back: the shape of anything that arrives somewhere and stays
   - a submission squeeze, a guard, a fighter pinned on the mat. The hold
   is the whole point; it is what makes a sub read as a sub and not as a
   slow punch. */
function holdCurve(p, rise, fall) {
  if (p <= 0 || p >= 1) return 0;
  const r = rise === undefined ? 0.22 : rise;
  const f = fall === undefined ? 0.2 : fall;
  if (p < r) return EASE.easeOut(p / r);
  if (p > 1 - f) return 1 - EASE.easeInOut((p - (1 - f)) / f);
  return 1;
}
/* an arc that leaves the floor and comes back to it */
function arc(p) { return Math.sin(Math.max(0, Math.min(1, p)) * Math.PI); }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/* remap a sub-range of p onto 0..1, for piecewise profiles */
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

/* ---------------------------------------------------------------------
   ANIM_CONFIG - every tunable in one place.

   Distances are canvas pixels at 960x540 with the fighters drawn ~300px
   tall and standing 560px apart; rotations are radians; durations are
   frames at 60fps. The old lunge was a flat 38px, so treat that as the
   midpoint: a poke has to be obviously smaller and a takedown obviously
   bigger or the whole exercise is pointless.

   dy is screen-space, so POSITIVE dy is DOWN. Ground work and takedowns
   are positive; anything that leaves the floor is negative.
   --------------------------------------------------------------------- */
const ANIM_CONFIG = {
  fps: 60,

  /* reduced motion: keep a few frames so turn pacing survives, kill the
     movement entirely */
  reduced: { dur: 6 },

  /* spring shape, shared by every reaction. Slightly hotter ring so a
     recoil/stagger reads from across the room without looking rubbery. */
  spring: { freq: 3.4, damp: 4.4 },

  /* a finisher or an elite signature earns a wind-up and a bigger swing.
     `wind` is the fraction of the duration spent gathering BACKWARD before
     the technique's own profile starts - that gather is what sells it as
     the big one without inventing a thirteenth motion. */
  heavy: { durMul: 1.6, durMax: 40, ampMul: 1.22, wind: 0.26, windPull: 0.42, flash: 7 },

  /* a technique that missed reaches further and finishes off balance */
  whiff: { reachMul: 1.18, rotAdd: 0.1 },

  /* per-kind base descriptor. dur/dx/dy/rot/scale/lean/flash. */
  kinds: {
    /* --- strikes ------------------------------------------------------ */
    poke:     { dur:  9, dx: 15, dy:   0, rot: 0.05, scale: 1.01, lean: 0.04, flash: 0 },
    strike:   { dur: 14, dx: 27, dy:  -3, rot: 0.08, scale: 1.03, lean: 0.11, flash: 0 },
    /* travel amplified ~32% so a kick reads from across the room */
    kick:     { dur: 19, dx: 61, dy: -13, rot: 0.18, scale: 1.04, lean: 0.18, flash: 0 },
    spin:     { dur: 20, dx: 24, dy:   0, rot: Math.PI * 2, scale: 1.02, lean: 0.06, flash: 0 },
    /* inside work has nowhere to travel to - they are already touching.
       All of the read has to come from the vertical snap. */
    inside:   { dur: 12, dx:  9, dy: -22, rot: 0.07, scale: 1.05, lean: 0.09, flash: 0 },
    /* longer hang and cross so air work is unmistakable at distance */
    air:      { dur: 22, dx: 66, dy: -60, rot: 0.22, scale: 1.07, lean: 0.16, flash: 0 },

    /* --- grappling ---------------------------------------------------- */
    /* the throw is the only kind that ends meaningfully rotated: the
       fighter goes over the top and comes down turned */
    throw:    { dur: 24, dx: 40, dy:  44, rot: 0.68, scale: 0.97, lean: 0.20, flash: 0 },
    /* takedown drops BEFORE it travels, and holds the low pose. If it
       returned to stance it would read as a shove. */
    takedown: { dur: 21, dx: 71, dy:  39, rot: 0.28, scale: 0.94, lean: 0.22, flash: 0 },
    /* a sub barely moves. It compresses and it waits. */
    sub:      { dur: 24, dx: -8, dy:  10, rot: 0.14, scale: 0.90, lean: 0.10, flash: 0 },
    ground:   { dur: 17, dx: 13, dy:  28, rot: 0.10, scale: 0.90, lean: 0.08, flash: 0 },

    /* --- everything else ---------------------------------------------- */
    /* guard travels backward: dx is negative so `facing` still points it
       away from the opponent */
    guard:    { dur: 13, dx: -11, dy: 6, rot: -0.06, scale: 0.95, lean: -0.09, flash: 0 },
    setup:    { dur: 11, dx:  9, dy:  -4, rot: 0.04, scale: 1.01, lean: 0.05, flash: 0 },

    /* --- reactions (tech = null) -------------------------------------- */
    /* stronger snap so recoil/stagger carry with the hotter spring */
    recoil:   { dur: 13, dx: -25, dy:  2, rot: -0.15, scale: 0.99, lean: -0.12, flash:  8 },
    stagger:  { dur: 20, dx: -46, dy: 23, rot: -0.48, scale: 0.96, lean: -0.22, flash: 12 },
    blocked:  { dur: 11, dx: -14, dy:  3, rot: -0.03, scale: 0.97, lean: -0.05, flash:  4 },
    slip:     { dur: 12, dx: -16, dy: -2, rot: -0.10, scale: 0.99, lean: -0.12, flash:  0 },

    /* nothing happened, or motion is off */
    still:    { dur:  6, dx:  0, dy:   0, rot: 0, scale: 1, lean: 0, flash: 0 },
  },

  /* particle burst tuning. `spread` is the cone half-angle in radians,
     `speed` is pixels per frame, `life` is frames. */
  burst: {
    base: 12, perDmg: 0.42, maxN: 34,
    colours: {
      blood: "#e03a2f",   // a cut sprays
      clean: "#ffcf6a",   // a clean landed strike
      body:  "#d97b3a",   // a thud into the ribs
      guard: "#9be89b",   // it hit the shell
      dust:  "#8b7a63",   // canvas and mat
      hold:  "#9b8cff",   // the slow pressure of a submission
      air:   "#6d727c",   // it found nothing
    },
  },

  /* hit-stop: frames the whole fight freezes for. Weight comes from the
     pause, not the pixels - this is the cheapest impact in the file. */
  hitstop: { base: 3, perDmg: 0.125, max: 14, guard: 2, blocked: 3,
             launcher: 4, status: 2, finisher: 12, whiff: 0 },

  /* camera punch */
  camera: { zoomMax: 0.06, zoomPerDmg: 0.0014, shakeMax: 15, shakePerDmg: 0.28,
            durBase: 14, durPerDmg: 0.4, durMax: 30, yBias: 0.7, jitter: 0.18 },

  /* range slides */
  rangeMove: { perStep: 34, durBase: 10, durPerStep: 6, groundDrop: 34, groundDur: 6 },
};

/* ---------------------------------------------------------------------
   PROFILE - the shape of each kind over normalised time p (0..1).

   Each returns unit weights that the transform multiplies by the
   descriptor's amplitudes:
     x  travel toward the opponent      y  vertical
     r  the technique's own rotation    l  lean (weight committed)
     s  scale (compression / stretch)
   Splitting rotation from lean matters: a spinning elbow rotates a full
   turn but is not leaning; a takedown barely rotates but is leaning its
   whole weight through the hips. One number could not say both.
   --------------------------------------------------------------------- */
const PROFILE = {
  poke: (p) => { const x = outBack(p, 0.26); return { x, y: 0, r: x * 0.6, l: x, s: x }; },

  strike: (p) => { const x = outBack(p, 0.38); return { x, y: x, r: x * 0.5, l: x, s: x }; },

  /* the kick spends longer out there than a punch - the leg has to come
     back before the fighter is safe, and that recovery is readable */
  kick: (p) => { const x = outBack(p, 0.44); return { x, y: x, r: x, l: x, s: x }; },

  /* rotation runs monotonically through the whole duration: the body
     never stops turning until the shot is finished */
  spin: (p) => ({ x: outBack(p, 0.5), y: 0, r: EASE.easeInOut(p),
                  l: outBack(p, 0.5) * 0.4, s: outBack(p, 0.5) }),

  /* vertical leads, travel is almost nothing - that is the whole read */
  inside: (p) => { const y = outBack(p, 0.22); return { x: outBack(p, 0.3), y, r: y * 0.5, l: y, s: y }; },

  /* rise, cross, land. The scale stretch at the apex and the squash on
     landing are what stop it reading as a long lunge. */
  air: (p) => {
    const a = arc(seg(p, 0, 0.86));
    const land = p > 0.86 ? outBack(seg(p, 0.86, 1), 0.4) : 0;
    return { x: outBack(p, 0.55), y: a, r: a * 0.7, l: outBack(p, 0.55), s: a - land * 0.8 };
  },

  /* lift -> over the top -> down. Three segments, because a throw that
     eases smoothly from A to B looks like a slide, not a throw. */
  throw: (p) => {
    const x = outBack(p, 0.5);
    let y, r;
    if (p < 0.34) { const t = EASE.easeOut(seg(p, 0, 0.34)); y = -0.55 * t; r = 0.35 * t; }
    else if (p < 0.7) { const t = EASE.easeIn(seg(p, 0.34, 0.7)); y = -0.55 + 1.55 * t; r = 0.35 + 0.65 * t; }
    else { const t = EASE.easeInOut(seg(p, 0.7, 1)); y = 1 - t; r = 1 - t * 0.9; }
    return { x, y, r, l: x, s: Math.abs(y) };
  },

  /* sink, drive, stay down, then release. The hold on the low pose is
     what makes it a takedown; the drive alone is a shove. */
  takedown: (p) => {
    const sink = holdCurve(p, 0.26, 0.16);
    const drive = p < 0.26 ? 0 : holdCurve(seg(p, 0.26, 1), 0.42, 0.22);
    return { x: drive, y: sink, r: drive, l: drive, s: sink };
  },

  /* compress, and then nothing at all for half the duration. The stillness
     is the animation. */
  sub: (p) => { const h = holdCurve(p, 0.24, 0.2); return { x: h, y: h, r: h, l: h, s: h }; },

  /* low, heavy and grinding - two short shifts of weight rather than a
     step, because there is nowhere to step to on the mat */
  ground: (p) => {
    const h = holdCurve(p, 0.18, 0.2);
    return { x: h * (0.45 + 0.55 * Math.sin(p * Math.PI * 3)), y: h, r: h, l: h, s: h };
  },

  /* settle into the shell, brace, come out of it */
  guard: (p) => { const h = holdCurve(p, 0.2, 0.28); return { x: h, y: h, r: h, l: h, s: h }; },

  /* a weight shift and a look. Crosses zero so it reads as a feint rather
     than a committed step. */
  setup: (p) => {
    const x = Math.sin(p * Math.PI * 2) * (1 - p * 0.5);
    return { x, y: arc(p) * 0.5, r: x * 0.5, l: x, s: arc(p) };
  },

  /* --- reactions ------------------------------------------------------ */
  /* the head goes first and comes back fast */
  recoil: (p) => { const x = outBack(p, 0.16); return { x, y: x * 0.4, r: x, l: x, s: x }; },

  /* moved, turned, and put down. Springs on the way out because a body
     that has been hit that hard does not stop dead. */
  stagger: (p) => {
    const x = p < 0.22 ? EASE.easeOut(seg(p, 0, 0.22)) : 1 - EASE.spring(seg(p, 0.22, 1)) * 0.98;
    const y = holdCurve(p, 0.5, 0.24);
    return { x, y, r: holdCurve(p, 0.28, 0.3), l: x, s: y };
  },

  /* pushed straight back, no rotation - the guard held its shape */
  blocked: (p) => { const x = outBack(p, 0.2); return { x, y: x, r: x, l: x, s: x }; },

  /* leans out of it and comes back to stance */
  slip: (p) => { const x = outBack(p, 0.34); return { x, y: x, r: x, l: x * 1.2, s: x * 0.5 }; },

  still: () => ({ x: 0, y: 0, r: 0, l: 0, s: 0 }),
};

/* ---------------------------------------------------------------------
   Choosing the kind.

   Read in order of how strongly a cue owns the silhouette. A flying knee
   is airborne before it is a strike; a spinning elbow is a spin before it
   is clinch work; anything happening on the mat is ground work before it
   is anything else. The order below IS the design - flatten it and you
   get fifty mushy motions.
   --------------------------------------------------------------------- */
const has = (arr, k) => !!arr && arr.indexOf(k) >= 0;

/* `bar` is the fighter this animation is for, so "how big was that hit"
   can be asked as a share of HIS health rather than as a flat number -
   `ev.dmg >= 26` was written against a TECH_DMG_SCALE that has moved
   twice since. See dmgShare() in battle/effects.js. Callers that do not
   know the fighter fall back to a 100-point bar, which is what the flat
   number assumed anyway. */
function reactionKind(ev, bar) {
  if (!ev) return "still";
  if (ev.whiff) return "slip";               // they made it miss
  /* ev.guarded means the OTHER fighter chose a guard - nothing was thrown
     at this one, so this one does nothing */
  if (!ev.hit) return "still";
  if (ev.blocked) return "blocked";
  if (ev.launcher || hitShare(ev, bar) >= STAGGER_SHARE) return "stagger";
  return "recoil";
}
function hitShare(ev, bar) {
  return typeof dmgShare === "function" ? dmgShare(bar, ev && ev.dmg)
    : ((ev && ev.dmg) || 0) / (((bar && bar.maxhp) || 100));
}

/* NOT the card kindOf - the game already has a function of that name for
   fight-data cards, declared later, which silently won the collision and
   crashed on a null tech. Named apart so both can exist. */
function animKindOf(tech, ev, bar) {
  if (!tech) return reactionKind(ev, bar);
  const f = tech.flags || [];
  const cls = tech.cls;
  /* where the fight actually is beats where the technique nominally
     lives: ev.rangeTo is the destination, so a technique that ends on the
     mat should already be reading low by then */
  const here = (ev && ev.rangeTo) || tech.range;

  if (cls === "GUARD") return "guard";
  if (has(f, "takedown") || has(f, "charge")) return "takedown";
  if (cls === "SUB" || has(f, "choke") || has(f, "leglock") || has(f, "pin")) return "sub";
  if (has(f, "jump")) return "air";
  if (has(f, "spin") || has(f, "axe")) return "spin";
  if (cls === "THROW" || has(f, "sweep") || has(f, "sacrifice")) return "throw";
  /* mat work that is not a hold or a throw: short heavy strikes, passes,
     scrambles. Low and grinding, never a step forward. */
  if (here === "GROUND" || has(f, "escape") || has(f, "dominant") || has(f, "control")) return "ground";
  if (cls === "SETUP" || has(f, "feint") || has(f, "tie-up") ||
      has(f, "reposition") || has(f, "position") || has(f, "setup")) return "setup";
  if (cls === "STRIKE") {
    if (here === "CLINCH") return "inside";
    if (here === "LONG") return "kick";
    /* a jab is not a small cross, it is a different motion - and with 96
       accuracy and 4 stamina it is thrown constantly, so it is the single
       most-seen animation in the game */
    if (has(f, "fast") || has(f, "poke") || (tech.power || 0) <= 18) return "poke";
    return "strike";
  }
  return "setup";
}

/* a technique that has earned the long version */
function isHeavy(tech, ev, bar) {
  if (!tech) return false;
  const f = tech.flags || [];
  if (tech.sig || has(f, "finisher") || has(f, "elite")) return true;
  return has(f, "power") && !!ev && !!ev.hit && hitShare(ev, bar) >= HEAVY_SWING_SHARE;
}

/* ---------------------------------------------------------------------
   animFor - the descriptor. Pure: same inputs, same object.
   --------------------------------------------------------------------- */
function animFor(tech, ev, motion, bar) {
  const on = motion !== false;
  const kind = animKindOf(tech, ev, bar);
  const base = ANIM_CONFIG.kinds[kind] || ANIM_CONFIG.kinds.still;

  if (!on) {
    /* keep the kind - the renderer and the battle log still want to know
       what happened - and take everything else to zero */
    return { kind, dur: ANIM_CONFIG.reduced.dur, dx: 0, dy: 0, rot: 0,
             scale: 1, lean: 0, flash: 0, wind: 0, still: true };
  }

  const heavy = isHeavy(tech, ev, bar);
  const H = ANIM_CONFIG.heavy;
  const m = heavy ? H.ampMul : 1;
  let dur = heavy ? Math.min(H.durMax, Math.round(base.dur * H.durMul)) : base.dur;
  let dx = base.dx * m;
  let rot = base.rot * m;
  let flash = heavy ? Math.max(base.flash, H.flash) : base.flash;

  /* a shot that found nothing over-reaches and finishes turned. Same
     kind, so a missed head kick still reads as a head kick. */
  if (tech && ev && ev.whiff) {
    dx *= ANIM_CONFIG.whiff.reachMul;
    rot += ANIM_CONFIG.whiff.rotAdd * (rot < 0 ? -1 : 1);
    flash = 0;
  }
  /* a blocked hit does not get the full swing - it was stopped */
  if (tech && ev && ev.blocked) { dx *= 0.85; dur = Math.max(6, Math.round(dur * 0.9)); }

  return {
    kind, dur, dx, dy: base.dy * m, rot,
    scale: 1 + (base.scale - 1) * m,
    lean: base.lean * m,
    flash,
    wind: heavy ? H.wind : 0,
    still: false,
  };
}

/* convenience for callers holding an id rather than the technique object */
function animForId(id, ev, motion, bar) {
  const t = (typeof TECH !== "undefined" && TECH) ? TECH[id] : null;
  return animFor(t || null, ev, motion, bar);
}

/* ---------------------------------------------------------------------
   State: start, tick, transform.

   `side.anim` was a string ("atk"/"hit"/"block"). It is now this object,
   or null when idle. Anything reading the old string will see an object
   and should be updated to read `side.anim.kind`.
   --------------------------------------------------------------------- */
function startAnim(side, tech, ev, motion) {
  if (!side) return null;
  /* the fighter being animated IS the bar the hit landed on, so every
     caller already has what the share thresholds need */
  const a = animFor(tech, ev, motion, side);
  a.f = 0;            // frames elapsed
  a.done = false;
  side.anim = a;
  return a;
}

/* advance one frame. Returns true while the animation is still running.
   Clears side.anim on completion so an idle fighter costs nothing. */
function tickAnim(side) {
  const a = side && side.anim;
  if (!a || typeof a !== "object") return false;
  a.f++;
  if (a.f >= a.dur) { a.done = true; side.anim = null; return false; }
  return true;
}

const animActive = (side) => !!(side && side.anim && typeof side.anim === "object" && !side.anim.done);
const animKind = (side) => (animActive(side) ? side.anim.kind : "");

/* `facing` is +1 for the left corner and -1 for the right, so "forward"
   means "toward the other fighter" for both of them. It flips horizontal
   travel and rotation; it must NOT flip vertical, or the right corner
   would take people down into the ceiling. */
function animTransform(side, facing, motion) {
  const idle = { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1, flash: 0 };
  const a = side && side.anim;
  if (!a || typeof a !== "object" || a.done) return idle;
  if (motion === false || a.still) return idle;

  const fx = facing === undefined ? 1 : (facing < 0 ? -1 : 1);
  const dur = Math.max(1, a.dur);
  let p = clamp(a.f / dur, 0, 1);

  /* the finisher wind-up: gather backward, then run the real profile in
     the time that is left */
  if (a.wind > 0 && p < a.wind) {
    const t = EASE.easeInOut(p / a.wind) * ANIM_CONFIG.heavy.windPull;
    return { dx: -a.dx * t * fx, dy: -a.dy * t * 0.3, rot: -a.rot * t * 0.15 * fx,
             scale: 1 + (a.scale - 1) * t * 0.5, alpha: 1, flash: a.flash };
  }
  if (a.wind > 0) p = seg(p, a.wind, 1);

  const prof = (PROFILE[a.kind] || PROFILE.still)(p);
  /* lean folds into rotation at the last moment: it is the same visual
     channel, but it is authored separately because it means something
     different and scales differently per kind */
  const rot = (a.rot * prof.r + a.lean * prof.l) * fx;

  return {
    dx: a.dx * prof.x * fx,
    dy: a.dy * prof.y,
    rot,
    scale: 1 + (a.scale - 1) * prof.s,
    /* only the slip fades, and only slightly - it sells "not there" */
    alpha: a.kind === "slip" ? 1 - 0.1 * prof.x : 1,
    flash: a.flash ? a.flash * (1 - p) : 0,
  };
}

/* ---------------------------------------------------------------------
   impactBurst - what sprays, and how.

   A cut is a fine fast red spray in a narrow cone. A body kick is a dull
   slow orange puff. A takedown is dust. A submission barely sprays at
   all - it seeps. Same particle system, five numbers, completely
   different reads.
   --------------------------------------------------------------------- */
function statusColour(name) {
  if (!name || typeof STATUS === "undefined" || !STATUS) return null;
  for (const k in STATUS) if (STATUS[k] && STATUS[k].name === name) return STATUS[k].color;
  return null;
}

function impactBurst(ev, motion, rnd) {
  const off = { n: 0, spread: 0, speed: 0, colour: ANIM_CONFIG.burst.colours.dust, life: 0 };
  if (motion === false || !ev) return off;
  const R = rnd || Math.random;
  const C = ANIM_CONFIG.burst.colours;
  const B = ANIM_CONFIG.burst;
  const tech = ev.tech || null;
  const f = (tech && tech.flags) || [];
  const dmg = ev.dmg || 0;

  /* nothing landed */
  if (ev.whiff) return { n: 3, spread: 1.5, speed: 1.1, colour: C.air, life: 12 };
  if (ev.guarded && !ev.hit) return { n: 5, spread: 1.2, speed: 1.4, colour: C.guard, life: 14 };
  if (!ev.hit) return off;

  let n = Math.min(B.maxN, Math.round(B.base + dmg * B.perDmg));
  let spread = 1.0, speed = 3.4, life = 26, colour = C.clean;

  if (ev.blocked) {
    /* it hit the shell: bright, wide, and gone quickly */
    colour = C.guard; n = Math.max(4, Math.round(n * 0.5)); spread = 1.5; speed = 4.2; life = 13;
  } else if (has(f, "cut")) {
    /* elbows open people up - a tight fast arterial spray, not a puff */
    colour = C.blood; n = Math.min(B.maxN, n + 8); spread = 0.42; speed = 6.0; life = 30;
  } else if (has(f, "body")) {
    /* a shot to the ribs has no spray at all, it has a thud */
    colour = C.body; n = Math.max(5, Math.round(n * 0.6)); spread = 0.85; speed = 1.9; life = 20;
  } else if (has(f, "leg")) {
    colour = C.body; n = Math.max(5, Math.round(n * 0.55)); spread = 0.6; speed = 2.4; life = 18;
  } else if (tech && (tech.cls === "SUB" || has(f, "choke") || has(f, "leglock"))) {
    /* a submission does not explode, it tightens. Few, slow, long-lived. */
    colour = C.hold; n = Math.max(4, Math.round(n * 0.3)); spread = 2.2; speed = 0.9; life = 40;
  } else if (tech && (tech.cls === "THROW" || has(f, "takedown") || has(f, "sweep"))) {
    /* mat and canvas, kicked sideways along the floor */
    colour = C.dust; n = Math.min(B.maxN, n + 6); spread = 2.6; speed = 2.6; life = 34;
  } else if (has(f, "power") || ev.launcher) {
    n = Math.min(B.maxN, n + 6); spread = 1.25; speed = 5.6; life = 30;
  }

  /* a landed condition tints the burst its own colour - the player learns
     "purple means I am in trouble on the mat" without reading a word */
  const sc = statusColour(ev.status);
  if (sc) colour = sc;

  /* a touch of variance so twenty identical jabs are not twenty identical
     bursts. Behind rnd, so tests can pin it. */
  const j = 1 + (R() - 0.5) * 0.18;
  return { n: Math.max(1, Math.round(n * j)), spread, speed: speed * j,
           colour, life: Math.round(life * j) };
}

/* ---------------------------------------------------------------------
   hitStopFor - frames the whole fight freezes for.

   The cheapest weight in the file. A jab should barely register; a
   launcher should stop the world. Reduced motion returns 0: a freeze is
   a motion effect and a player who asked for stillness did not ask to
   wait longer.
   --------------------------------------------------------------------- */
function hitStopFor(ev, motion) {
  if (motion === false || !ev) return 0;
  const S = ANIM_CONFIG.hitstop;
  const f = (ev.tech && ev.tech.flags) || [];
  if (ev.whiff) return S.whiff;
  if (ev.guarded && !ev.hit) return S.guard;
  if (!ev.hit) return 0;
  if (has(f, "finisher")) return Math.min(S.max, S.finisher);

  let n = ev.blocked ? S.blocked : S.base + (ev.dmg || 0) * S.perDmg;
  if (ev.launcher) n += S.launcher;
  if (ev.status) n += S.status;
  return Math.min(S.max, Math.round(n));
}

/* ---------------------------------------------------------------------
   cameraFor - the punch on the camera itself.

   Zoom is tiny on purpose: past about 6% the arena backdrop starts to
   crop visibly and the HUD swims. Vertical shake is damped relative to
   horizontal because a fight reads horizontally.
   --------------------------------------------------------------------- */
function cameraFor(ev, motion, rnd) {
  const off = { zoom: 1, shakeX: 0, shakeY: 0, dur: 0 };
  if (motion === false || !ev || !ev.hit) return off;
  const C = ANIM_CONFIG.camera;
  const R = rnd || Math.random;
  const f = (ev.tech && ev.tech.flags) || [];
  const dmg = ev.dmg || 0;

  let z = Math.min(C.zoomMax, dmg * C.zoomPerDmg);
  let s = Math.min(C.shakeMax, 2 + dmg * C.shakePerDmg);
  let dur = Math.min(C.durMax, Math.round(C.durBase + dmg * C.durPerDmg));

  if (ev.blocked) { z *= 0.4; s *= 0.45; dur = Math.round(dur * 0.6); }
  if (ev.launcher || has(f, "finisher")) { z = C.zoomMax; s = C.shakeMax; dur = C.durMax; }
  /* a submission tightening is not a camera punch - it is a slow squeeze,
     so it gets the zoom and almost none of the shake */
  if (ev.tech && ev.tech.cls === "SUB") { s *= 0.25; dur = Math.round(dur * 1.4); }

  const j = 1 + (R() - 0.5) * C.jitter;
  return { zoom: 1 + z, shakeX: s * j, shakeY: s * C.yBias * j, dur };
}

/* ---------------------------------------------------------------------
   rangeMoveOf - the slide when the fight changes range.

   Ranges are a line: LONG - MID - CLINCH - GROUND. Closing brings the two
   fighters toward each other, breaking pushes them apart, and each step
   is worth a fixed distance so a two-step takedown is visibly twice the
   journey of a step in. Arriving on the GROUND additionally drops both
   of them and takes longer, because falling over is not a sidestep.

   `dir` is +1 closing, -1 breaking. `dx` is per fighter - the renderer
   moves each of them dx toward (or away from) the centre.
   --------------------------------------------------------------------- */
function rangeMoveOf(fromRange, toRange, motion) {
  const idle = { steps: 0, dir: 0, dx: 0, dy: 0, dur: 0, drop: false, ease: EASE.easeInOut };
  if (!fromRange || !toRange || fromRange === toRange) return idle;
  const RI = (typeof RANGE_INDEX !== "undefined" && RANGE_INDEX) ? RANGE_INDEX : null;
  const RO = (typeof RANGE_ORDER !== "undefined" && RANGE_ORDER) ? RANGE_ORDER : null;
  const a = RI ? RI[fromRange] : -1, b = RI ? RI[toRange] : -1;
  if (a === undefined || b === undefined || a < 0 || b < 0) return idle;

  const M = ANIM_CONFIG.rangeMove;
  const steps = Math.abs(b - a);
  const dir = b > a ? 1 : -1;
  const last = RO ? RO[RO.length - 1] : "GROUND";
  const drop = toRange === last;

  if (motion === false) {
    /* no travel, but keep a beat so the range strip has time to be read */
    return { steps, dir, dx: 0, dy: 0, dur: ANIM_CONFIG.reduced.dur, drop, ease: EASE.linear };
  }
  return {
    steps, dir,
    dx: steps * M.perStep * dir,
    dy: drop ? M.groundDrop : 0,
    dur: M.durBase + steps * M.durPerStep + (drop ? M.groundDur : 0),
    drop,
    /* closing is explosive, breaking away is controlled */
    ease: dir > 0 ? EASE.easeOut : EASE.easeInOut,
  };
}
