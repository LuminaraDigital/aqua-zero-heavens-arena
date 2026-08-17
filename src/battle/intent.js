/* =====================================================================
   Aqua Zero Heavens Arena - the tell
   Luminara Digital

   The CPU commits its technique before the player chooses - that has been
   true since beginRound() was written, and for most of the game's life the
   commitment was invisible unless you paid a focus for a READ. All the
   range work, the position work and the stamina work happened behind a
   curtain, and the player was asked to make seven decisions a fight
   against a slot machine.

   This file opens the curtain exactly one inch. A fighter about to shoot
   a double leg looks different from a fighter about to jab: his weight
   drops, his lead hand floats. Corners read this from the apron all
   night. So the player gets the TELL for free - the class of what is
   coming and where it wants the fight to go - and the READ still costs
   focus, because the tell says "he is shooting" and the read says
   "it is the high-crotch, 34 power, he has the air for it".

   Every function is pure: reads the duel, returns data, renders nothing.

     intentFor(d)                the tell for the enemy's committed action
     intentHint(d, side, tech)   how one menu row answers that tell
     forecastFirst(d, side, tech) who probably moves first this turn
     posOk(d, side, tech)        can this technique be thrown from here
     seqMaxLen(d)                chain cap after benefits
   ===================================================================== */

/* ---------------------------------------------------------------------
   the tell itself

   Deliberately coarse. It names the CLASS and the DIRECTION, never the
   technique: "he wants this on the mat" is a corner call, "it is exactly
   the uchi mata" is a paid read. If the read has been bought this file
   still only describes the tell - the read banner is the caller's job.
   --------------------------------------------------------------------- */
const INTENT_TELLS = {
  SIGNATURE: { key: "SIGNATURE", label: "SIGNATURE",
               line: "THEIR WEIGHT IS ALL THE WAY BACK - THE FINISHER IS LOADED" },
  TAKEDOWN:  { key: "TAKEDOWN", label: "SHOOTING",
               line: "LEVEL CHANGE - THEY WANT THIS ON THE MAT" },
  THROW:     { key: "THROW", label: "GRABBING",
               line: "HANDS OPEN, STEPPING IN - THEY WANT A HOLD OF YOU" },
  SUB:       { key: "SUB", label: "HUNTING A HOLD",
               line: "THEY ARE HUNTING A LIMB, NOT A KNOCKOUT" },
  STRIKE_IN: { key: "STRIKE_IN", label: "SWINGING CLOSE",
               line: "SHOULDERS LOOSE, CLOSING IN - SHORT WORK IS COMING" },
  STRIKE_OUT:{ key: "STRIKE_OUT", label: "SWINGING LONG",
               line: "ON THE BALL OF THE BACK FOOT - SOMETHING LONG IS COMING" },
  GUARD:     { key: "GUARD", label: "COVERING",
               line: "ELBOWS TIGHT, CHIN DOWN - THEY ARE WEATHERING THIS TURN" },
  MOVE:      { key: "MOVE", label: "REPOSITIONING",
               line: "LIGHT ON THEIR FEET - THEY ARE MOVING THE FIGHT, NOT SWINGING" },
};

function intentFor(d) {
  if (!d || d.hotseat) return null;                 // two humans keep their secrets
  if (d.eSuper) return INTENT_TELLS.SIGNATURE;
  const t = d.eTech;
  if (!t) return null;
  const f = t.flags || [];
  if (t.cls === "GUARD") return INTENT_TELLS.GUARD;
  if (f.indexOf("takedown") >= 0) return INTENT_TELLS.TAKEDOWN;
  if (t.cls === "THROW") return INTENT_TELLS.THROW;
  if (t.cls === "SUB") return INTENT_TELLS.SUB;
  if (t.cls === "SETUP" || f.indexOf("reposition") >= 0 || f.indexOf("circle") >= 0)
    return INTENT_TELLS.MOVE;
  // a strike: long or short, read off where it wants to land
  const r = t.range === "ANY" ? d.range : t.range;
  return (RANGE_INDEX[r] <= RANGE_INDEX.MID && RANGE_INDEX[d.range] <= RANGE_INDEX.MID && r === "LONG")
    ? INTENT_TELLS.STRIKE_OUT
    : (r === "LONG" ? INTENT_TELLS.STRIKE_OUT : INTENT_TELLS.STRIKE_IN);
}

/* ---------------------------------------------------------------------
   how a menu row answers the tell

   Returns null (nothing worth saying) or { edge, note }:
     edge  +2 hard counter, +1 favourable, -1 walking into it
     note  a two-or-three word chip for the row

   The rules are the game's real rules, not vibes: the sprawl is the one
   hard counter in the resolver, a parry answers strikes, a takedown
   punishes a man covering up (guards do not stop the change of range),
   and throwing long limbs at a man diving at your hips is how you end up
   on your back.
   --------------------------------------------------------------------- */
function intentHint(d, side, tech) {
  const it = intentFor(d);
  if (!it || !tech) return null;
  const f = tech.flags || [];
  if (it.key === "TAKEDOWN") {
    if (f.indexOf("anti-takedown") >= 0) return { edge: 2, note: "SPRAWL - COUNTERS IT" };
    if (tech.cls === "GUARD") return { edge: -1, note: "COVERS, STILL LANDS ON MAT" };
    if (tech.cls === "STRIKE" && (tech.prio || 0) > 0) return { edge: 1, note: "BEATS THE SHOT IN" };
  }
  if (it.key === "STRIKE_IN" || it.key === "STRIKE_OUT") {
    if (tech.cls === "GUARD" && f.indexOf("parry") >= 0) return { edge: 2, note: "PARRY ANSWERS BACK" };
    if (tech.cls === "GUARD" && f.indexOf("evade") >= 0) return { edge: 1, note: "SLIPS IT" };
    if (tech.cls === "GUARD") return { edge: 1, note: "SOAKS IT" };
    if (f.indexOf("takedown") >= 0) return { edge: 1, note: "CHANGES THE QUESTION" };
  }
  if (it.key === "GUARD") {
    if (tech.cls === "STRIKE" && tech.power >= 30) return { edge: -1, note: "SWINGS INTO A SHELL" };
    if (tech.cls === "SETUP" || tech.moves || tech.shift) return { edge: 1, note: "FREE STEP" };
    if (tech.cls === "THROW") return { edge: 1, note: "GUARDS DON'T STOP THROWS" };
  }
  if (it.key === "THROW" || it.key === "SUB") {
    if (f.indexOf("anti-takedown") >= 0) return { edge: 1, note: "HIPS BACK, HANDS READY" };
    if (tech.cls === "STRIKE" && (tech.prio || 0) > 0) return { edge: 1, note: "STICK THEM COMING IN" };
  }
  if (it.key === "SIGNATURE" && tech.cls === "GUARD") return { edge: 1, note: "BRACE FOR IT" };
  return null;
}

/* ---------------------------------------------------------------------
   who moves first - the same maths initiativeOf uses, minus the jitter,
   so the forecast is honest about the coin without rolling it.
   Returns 1 (clearly you), -1 (clearly them), 0 (inside the jitter band).
   --------------------------------------------------------------------- */
function forecastFirst(d, side, tech) {
  if (!tech || d.hotseat) return 0;
  const foe = side === d.p ? d.e : d.p;
  const foeTech = d.eSuper ? null : d.eTech;
  if (d.eSuper) return -1;                          // a signature always jumps the queue
  if (!foeTech) return 0;
  const mean = (s, t) => {
    const mods = statusMods(s), disc = DISCIPLINES[t.disc];
    return (t.prio || 0) * 1000 + t.speed * (disc ? disc.bias.spd : 1) * mods.spd * (s.spdMul || 1);
  };
  const a = mean(side, tech), b = mean(foe, foeTech);
  // the jitter band is +/-8% of raw speed; outside ~1.16x it cannot flip
  if (a > b * 1.18) return 1;
  if (b > a * 1.18) return -1;
  return 0;
}

/* ---------------------------------------------------------------------
   position-gated techniques

   tech.pos is null for almost the whole dex. The handful that carry it:
     "PRESSING"  needs the OTHER man trapped on the ropes or in the corner
     "TRAPPED"   needs YOU to be the one with your back to it
   --------------------------------------------------------------------- */
function posOk(d, side, tech) {
  if (!tech || !tech.pos) return true;
  const key = side === d.p ? "p" : "e";
  const trapped = d.pos !== "CENTRE" && d.cornered === key;
  const pressing = d.pos !== "CENTRE" && d.cornered && d.cornered !== key;
  if (tech.pos === "PRESSING") return pressing;
  if (tech.pos === "TRAPPED") return trapped;
  return true;
}

/* chain length cap after benefits - the fourth link is bought, not free */
function seqMaxLen(d) {
  const extra = (typeof benefitFlag === "function" && d && !d.hotseat)
    ? (benefitFlag(d.benefits, "chainPlus") || 0) : 0;
  return SEQ_CONFIG.maxLen + extra;
}
