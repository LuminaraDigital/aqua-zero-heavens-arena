/* =====================================================================
   Aqua Zero Heavens Arena - ring position
   Luminara Digital

   RANGE says how far apart they are. POSITION says where in the ring the
   action is. Both are true at once: you can be at kicking range with your
   back to the ropes, or on the mat in the middle of the canvas.

   The whole layer is one shared value plus one name:

     d.pos      "CENTRE" | "ROPES" | "CORNER"  - where the fight is
     d.cornered "p" | "e" | null               - whose back is to it
     d.press    { by, n }                      - the pressure meter

   One value, not two coordinates. In a two-fighter ring the interesting
   fact is never "where is each man standing", it is "who has run out of
   room" - so that is the only thing stored.

   The design rule this file obeys: being cornered must hurt enough to be
   a win condition and never enough to be the win itself. Position is
   EARNED over two or three turns of landed pressure, it is ESCAPABLE by
   a fighter who spends air or has the feet for it, and it is WORTH about
   a 20-30 percent swing in the exchange. It does not roll dice to decide
   who wins - it decides who is comfortable.
   ===================================================================== */

/* ---------------------------------------------------------------------
   the three places the fight can be

     atk      what the fighter with room to work gets
     trapped  what the fighter with his back to it suffers
     escape   base chance to circle out, before feet, air and conditions
     cost     stamina an escape attempt burns

   Deliberate asymmetry: most of the corner's bite is in `escape` and in
   the attacker's `atk.pow`, and almost none of it is in `trapped.pow`.
   A cornered fighter is not suddenly weak - he is out of room. Punishing
   his damage too as well would double-dip and turn a bad spot into a
   death spiral, which is exactly the coin-flip this layer must not be.
   --------------------------------------------------------------------- */
const POSITIONS = {};
function P(id, name, desc, atk, trapped) {
  POSITIONS[id] = { id, name, desc, atk, trapped };
}

P("CENTRE", "CENTRE RING",
  "open canvas - both men have somewhere to put their feet",
  { pow: 1.00, acc: 1.00 },
  { pow: 1.00, acc: 1.00, escape: 1.00, cost: 0 });

P("ROPES", "ON THE ROPES",
  "one man is giving ground and the ring is getting smaller",
  { pow: 1.09, acc: 1.03 },
  { pow: 0.97, acc: 0.98, escape: 0.58, cost: 6 });

P("CORNER", "IN THE CORNER",
  "nowhere left to go - he has to fight his way out or wear it",
  { pow: 1.18, acc: 1.05 },
  { pow: 0.94, acc: 0.96, escape: 0.38, cost: 9 });

const POSITION_ORDER = ["CENTRE", "ROPES", "CORNER"];
const POS_INDEX = { CENTRE: 0, ROPES: 1, CORNER: 2 };

/* ---------------------------------------------------------------------
   style tables

   Who walks a man down and who circles off him is a property of the art,
   not a stat block, so it is read from the same discipline ids the rest
   of the game uses. Positive footwork means light feet. Positive pressure
   means the art is built on taking ground away.

   A fighter takes his BEST bonus and his WORST penalty and adds both: a
   boxer-wrestler really is light on his feet and really is heavy through
   the hips, and neither cancels out because he trained the other.
   --------------------------------------------------------------------- */
const FOOTWORK = {
  taekwondo: 0.12, wushu: 0.12, boxing: 0.10, kenpo: 0.10, kickboxing: 0.08,
  shotokan: 0.06, mma: 0.03, muaythai: 0.00,
  kyokushin: -0.04, jiujitsu: -0.05, lethwei: -0.06, judo: -0.06, sambo: -0.06,
  grappling: -0.07, wrestling: -0.08, bjj: -0.08, subgrap: -0.08, sumo: -0.18,
};
const PRESSURE = {
  sumo: 0.30, wrestling: 0.20, muaythai: 0.18, lethwei: 0.16, kyokushin: 0.12,
  grappling: 0.12, judo: 0.10, sambo: 0.10, mma: 0.08, draka: 0.06, boxing: 0.05,
  kickboxing: 0.00, shotokan: -0.05, jiujitsu: -0.05, kenpo: -0.08,
  wushu: -0.12, subgrap: -0.12, taekwondo: -0.15, bjj: -0.15,
};

function styleFactor(discs, table, lo, hi) {
  let best = 0, worst = 0;
  for (const id of discs || []) {
    const v = table[id];
    if (v == null) continue;
    if (v > best) best = v;
    if (v < worst) worst = v;
  }
  return Math.max(lo, Math.min(hi, 1 + best + worst));
}
/* how well this fighter circles out - out-fighters escape, sumo does not */
function footworkOf(side) { return styleFactor(side && side.discs, FOOTWORK, 0.78, 1.20); }
/* how well this fighter takes ground away - wrestlers and pressure arts do */
function pressureOf(side) { return styleFactor(side && side.discs, PRESSURE, 0.75, 1.35); }

/* conditions that make circling out harder. Multiplicative, same idiom as
   statusMods - being HELD or PINNED is very nearly a lock, but never one. */
const ESCAPE_COND = { STUNNED: 0.55, OFF_BALANCE: 0.70, WINDED: 0.80, LEG_HURT: 0.72,
                      HELD: 0.45, PINNED: 0.35 };
function escapeCondFactor(side) {
  let f = 1;
  for (const k in (side && side.cond) || {}) if (ESCAPE_COND[k]) f *= ESCAPE_COND[k];
  return f;
}

const clamp01 = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ---------------------------------------------------------------------
   what the ring is doing to you right now

   `isCornered` picks which side of the ledger you read. Both fighters ask
   this every turn with the same `pos` - one gets the attacker's column,
   the other gets the trapped column.

   NOTE for integration: positionMods(pos, false).pow is the SAME number
   cornerDamageBonus(pos) returns. It is one multiplier with two doors on
   it, for readability at the call site. Apply it once, not twice.
   --------------------------------------------------------------------- */
function positionMods(pos, isCornered) {
  const P0 = POSITIONS[pos] || POSITIONS.CENTRE;
  const m = isCornered ? P0.trapped : P0.atk;
  return { pow: m.pow, acc: m.acc, escape: isCornered ? P0.trapped.escape : 1 };
}
/* the multiplier an attacker earns on a man who has run out of room */
function cornerDamageBonus(pos) { return (POSITIONS[pos] || POSITIONS.CENTRE).atk.pow; }

/* convenience: the mods for one named side of this duel, cornered or not */
function positionModsFor(d, side) {
  const key = side === d.p ? "p" : "e";
  return positionMods(d.pos || "CENTRE", d.cornered === key);
}

/* ---------------------------------------------------------------------
   escaping

   0..1, and never 0 or 1 - a fighter is never welded to the ropes and
   never simply steps off them. Four things decide it: where he is, what
   his feet were trained to do, how much air he has left, and what is
   currently wrong with him.
   --------------------------------------------------------------------- */
const ESCAPE_MIN = 0.05, ESCAPE_MAX = 0.92;
function escapeChance(side, pos) {
  const P0 = POSITIONS[pos] || POSITIONS.CENTRE;
  if (P0.trapped.escape >= 1) return 1;            // centre ring - nothing to escape from
  const maxStam = (side && side.maxStam) || 60;
  const stamFrac = clamp01(((side && side.stam) || 0) / maxStam, 0, 1);
  let c = P0.trapped.escape;
  c *= footworkOf(side);
  c *= 0.60 + 0.40 * stamFrac;                     // you circle out on your legs, and legs cost air
  c *= escapeCondFactor(side);
  c *= (side && side.escapeMul) || 1;              // hook for camp benefits, same idiom as atkMul
  return clamp01(c, ESCAPE_MIN, ESCAPE_MAX);
}

/* one attempt to get off the ropes. Costs air whether it works or not -
   that is the price that stops escape being a free button, and it is why
   a gassed fighter stays cornered. Success walks the fight ONE notch back
   toward the centre, not straight to open canvas: you fight your way out
   of a corner onto the ropes, then off the ropes. */
function attemptEscape(d, side, rnd) {
  const R = rnd || Math.random;
  const from = d.pos || "CENTRE";
  const key = side === d.p ? "p" : "e";
  const P0 = POSITIONS[from] || POSITIONS.CENTRE;
  const out = { escaped: false, to: from, chance: 0, stam: 0 };

  if (from === "CENTRE" || d.cornered !== key) { out.escaped = true; return out; }

  const cost = side.escapeFree ? 0 : Math.round(P0.trapped.cost * ((side && side.stamMul) || 1));
  side.stam = Math.max(0, side.stam - cost);
  out.stam = cost;

  out.chance = escapeChance(side, from);
  if (R() >= out.chance) return out;                // he tried, the man in front of him did not move

  out.escaped = true;
  out.to = stepPosition(d, -1, key);
  /* he physically got out, so whatever the other man had banked is gone.
     Without this the presser re-corners him on the very next landed shot
     and the escape was never worth the air it cost. */
  d.press = { by: key, n: 0 };
  return out;
}

/* ---------------------------------------------------------------------
   moving the fight

   `dir` +1 walks the man named by `presser` INTO trouble's opposite - i.e.
   the other fighter loses ground. `dir` -1 gives ground back to whoever is
   trapped. Position is only ever moved one notch at a time; nobody goes
   from centre ring to the corner in a single technique.
   --------------------------------------------------------------------- */
function stepPosition(d, dir, presser) {
  const i = POS_INDEX[d.pos || "CENTRE"] || 0;
  const j = Math.max(0, Math.min(POSITION_ORDER.length - 1, i + dir));
  d.pos = POSITION_ORDER[j];
  if (d.pos === "CENTRE") {
    /* back on open canvas, so nobody owns the ring and the meter starts
       clean - momentum should not carry through neutral ground. */
    d.cornered = null;
    d.press = { by: presser, n: 0 };
  } else if (dir > 0) {
    d.cornered = presser === "p" ? "e" : "p";
  }
  return d.pos;
}

/* The trapped man turns the exchange around and puts THEM on the ropes
   instead - same spot in the ring, other back against it. The meter resets
   to the new presser so the swap is a fresh start, not a free corner. */
function swapCorner(d, byKey) {
  if (!d || d.pos === "CENTRE" || d.cornered !== byKey) return false;
  d.cornered = byKey === "p" ? "e" : "p";
  d.press = { by: byKey, n: 0 };
  return true;
}

/* set the ring up at the bell */
function resetPosition(d) {
  d.pos = "CENTRE";
  d.cornered = null;
  d.press = { by: "p", n: 0 };
  return d;
}

/* ---------------------------------------------------------------------
   pressure

   Called after a technique lands. It does not roll - it books pressure,
   and only a full meter moves the fight. That is the whole anti-coin-flip
   design: the corner is a running total of work done, so a pressure
   fighter reaches it in two turns and a counter-puncher who happens to
   land a jab does not reach it at all.

     PRESS_STEP    how much pressure buys one notch of ring
     PRESS_BASE    any landed technique gives ground
     PRESS_PUSH    push / charge / control techniques give it properly

   The meter has an owner. If the other man lands, his work comes off the
   total first, and when it goes past zero the meter flips to him. So the
   trapped fighter has two ways out - circle (attemptEscape, a roll he
   pays air for) or punch his way off the ropes (this, no roll at all).
   --------------------------------------------------------------------- */
const PRESS_STEP = 2.2;
const PRESS_BASE = 1.0;
const PRESS_PUSH = 1.0;
const PRESS_FLAGS = ["push", "charge", "control"];

function pressureShift(d, attacker, ev) {
  const from = d.pos || "CENTRE";
  const out = { moved: false, from, to: from, gain: 0, meter: 0, cornered: d.cornered || null };

  if (!ev || !ev.hit) return out;              // you cannot walk a man down by missing him
  /* Half this game happens on the mat, so barring the ground outright starved
     the meter and the ring never moved. Mat work still travels - you drive a
     man toward the fence and work him against it - it just travels slower
     than feet do, and only control work moves him at all. */
  let groundScale = 1;
  if (d.range === "GROUND") {
    const gf = (ev.tech && ev.tech.flags) || [];
    const controls = gf.indexOf("control") >= 0 || gf.indexOf("pin") >= 0 ||
                     gf.indexOf("dominant") >= 0 || gf.indexOf("position") >= 0 ||
                     (ev.tech && ev.tech.cls === "SETUP");
    if (!controls) return out;
    groundScale = 0.6;
  }

  const me = attacker === d.p ? "p" : "e";
  const defender = me === "p" ? d.e : d.p;
  const tech = ev.tech || {};
  const flags = tech.flags || [];

  let gain = PRESS_BASE;
  for (const f of PRESS_FLAGS) if (flags.indexOf(f) >= 0) { gain += PRESS_PUSH; break; }
  /* ringcraft: a shove is a technique whose whole job is taking ground -
     it books more than a push flag riding on a strike does */
  if (flags.indexOf("shove") >= 0) gain += PRESS_PUSH * 0.8;
  if (ev.blocked) gain *= 0.5;                 // he covered up - but he still gave ground doing it
  gain *= pressureOf(attacker);                // wrestlers and Thai boxers take the ring away
  gain /= footworkOf(defender);                // out-fighters give it back
  /* a man with nothing left in the tank stops moving his feet first */
  const dMax = (defender && defender.maxStam) || 60;
  gain *= 1 + 0.25 * (1 - clamp01(((defender && defender.stam) || 0) / dMax, 0, 1));
  gain *= groundScale;
  out.gain = gain;

  const m = d.press || (d.press = { by: me, n: 0 });
  if (m.by === me) {
    m.n += gain;
  } else {
    m.n -= gain;
    if (m.n < 0) { m.by = me; m.n = -m.n; }     // he has turned the pressure around
  }

  if (m.n >= PRESS_STEP) {
    /* if the man with the meter is the one with his back to it, his work
       buys ring back instead of taking it. Fighting off the ropes. */
    const dir = d.cornered && d.cornered === m.by ? -1 : 1;
    const j = (POS_INDEX[from] || 0) + dir;
    if (j < 0 || j > POSITION_ORDER.length - 1) {
      /* the ring has run out - bank the pressure at one notch rather than
         burning it, so a man already in the corner is not paying for work
         that has nowhere to go. */
      m.n = PRESS_STEP;
    } else {
      /* surplus carries, but only one notch ever moves per technique - it is
         capped so a huge single hit cannot chain centre to corner at once. */
      m.n = Math.min(m.n - PRESS_STEP, PRESS_STEP * 0.9);
      out.to = stepPosition(d, dir, m.by);
      out.moved = out.to !== from;
      if (out.moved) { ev.posTo = d.pos; ev.cornered = d.cornered; }
    }
  }
  out.meter = d.press.n;
  out.cornered = d.cornered || null;
  return out;
}

/* Optional, for end of turn. A stalled fight should drift back to open
   canvas rather than sitting on a half-full meter forever - if neither man
   is doing work, the ring opens up again. */
function pressureDecay(d) {
  const m = d.press;
  if (!m) return;
  m.n = Math.max(0, m.n - 0.15);
  if (m.n <= 0 && d.pos !== "CENTRE" && d.cornered) {
    /* nobody is imposing anything, so the trapped man walks out on his own */
    stepPosition(d, -1, d.cornered === "p" ? "e" : "p");
  }
}

/* ---------------------------------------------------------------------
   announcer line - short, shouty, no punctuation to fight the UI with
   --------------------------------------------------------------------- */
function positionSideName(d, key) {
  const s = key === "p" ? d.p : d.e;
  if (s && s.name) return String(s.name).toUpperCase();
  return key === "p" ? "YOU" : "THEY";
}
function describePosition(d) {
  const pos = d.pos || "CENTRE";
  if (pos === "CENTRE" || !d.cornered) return "CENTRE RING";
  const who = positionSideName(d, d.cornered);
  const verb = who === "YOU" || who === "THEY" ? "ARE" : "IS";
  return who + " " + verb + (pos === "CORNER" ? " CORNERED" : " ON THE ROPES");
}
