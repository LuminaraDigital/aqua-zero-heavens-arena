/* =====================================================================
   Aqua Zero Heavens Arena - technique resolution
   Luminara Digital

   One technique, executed. Everything that decides the outcome is read
   from data: the technique's own numbers, its discipline's bias, how well
   it fits the range the fight is actually in, the conditions on both
   fighters, and the guard the target chose.

   Returns an event describing what happened. The renderer and the battle
   log both read that event - neither knows anything about damage maths.
   ===================================================================== */
/* Fights were averaging 7.6 turns - about seven decisions, which is thin for
   a game whose whole pitch is technique choice. Pulling the scale down
   lengthens the fight without touching a single technique's numbers, so the
   relative balance of the dex is preserved while the decision count roughly
   doubles. Re-measure with tools/audit-balance.js after any change here. */
const TECH_DMG_SCALE = 0.37;

/* =====================================================================
   THE DAMAGE MODEL - four budgeted layers on top of a base

     dmg = base  x  fit  x  situation  x  investment  x  finish  x  SCALE
     acc = base  x  fit  x  situation  x  finish      +  investment points

   Why this shape. damageOf used to be about twenty-five multiplicative
   terms applied in a line, and nobody - including the people editing it -
   could say what any single term was worth by the time the others had had
   their turn. The symptom is recorded two comments up: TECH_DMG_SCALE was
   pulled from 0.42 specifically to double a 7.6-turn fight, and the fight
   stayed at 7.7, because the terms downstream of the scale absorbed the
   whole change. A stack with no budget cannot be tuned; it can only be
   poked at.

   So every term now belongs to exactly one named layer, and every layer
   has a documented clamp. Nothing was dropped - each of the old terms is
   still here, in the layer it belongs to - but no layer can run away, and
   a new bonus has to be argued for inside somebody's budget instead of
   being appended to the end of the line.

     base        what the two fighters' numbers say before the fight
                 starts: the technique's power, its discipline's bias, the
                 attacker's own strength multipliers and the defender's own
                 toughness. NOT clamped, deliberately - these are the
                 handles tools/tune-roster.js turns, and a tuner whose
                 handle saturates cannot converge.
     fit         0.50-1.30  is this the right tool for the range the fight
                 is actually in, and is the fighter at home here
     situation   0.60-1.80  everything true about this exact moment:
                 ring position, clinch/ground control, both fighters'
                 conditions, guard break, the strike-into-focus read, and
                 an empty tank
     investment  1.00-1.60  what the player spent to make this hit harder:
                 drill reps, seals, resonance pairs, relics. Never below 1
                 - investment cannot backfire.
     finish      1.00-1.50  punishing a man who is already hurt or held.
                 Capped because three "he is hurt" multipliers in a row is
                 how submissions got to 57% of all finishes.

   Each layer is clamped on the way out, and `raw` keeps the unclamped
   product so tests/combat.test.js can see how hard a layer is pressing on
   its budget. Events carry the breakdown (`ev.dmgLayers`) so the HUD can
   show the same five numbers the maths used - which is the acceptance
   criterion: a reader predicts the hit from what is on screen.
   ===================================================================== */
const DMG_CLAMP = {
  fit: [0.50, 1.30],
  situation: [0.60, 1.80],
  investment: [1.00, 1.60],
  finish: [1.00, 1.50],
};
/* accuracy is a percentage, so its investment is POINTS, not a multiplier -
   "+5 per drill rep" is a thing a player can hold in their head, and a
   multiplier on a number that is already 0-100 is not. */
const ACC_CLAMP = {
  fit: [0.50, 1.30],
  situation: [0.60, 1.80],
  finish: [1.00, 1.50],
  investmentPts: [0, 25],
};
function clampLayer(n, range) {
  if (!Number.isFinite(n)) return range[0];
  return Math.max(range[0], Math.min(range[1], n));
}

/* =====================================================================
   THE POST-LAYER LEDGER

   damageLayers() is the model, but it is not the last word on a hit. A
   guard soaks it, a cage pin adds four, a locked submission cranks it,
   a relic rewrites it. Those are real and they belong OUTSIDE the five
   layers, because they are things that happened in the exchange rather
   than properties of the technique being thrown.

   What they must not be is invisible. Every adjustment made after the
   layered model has produced its number goes through here, and the event
   carries the complete ordered ledger in `ev.dmgPost`. So `ev.dmg` - the
   damage that actually comes off the man - is always derivable: start at
   `ev.dmgLayers.dmg`, walk the ledger, arrive at `ev.dmg`.

   The CHAIN is what makes this a guard rather than a comment. Each entry
   records the value it started from, so an adjustment appended anywhere -
   before the first entry, between two of them, or after the last - leaves
   either a `from` that does not match the previous `to` or an `ev.dmg`
   that does not match the final `to`. tests/combat.test.js walks that
   chain on every landed technique across a few hundred played fights.
   There is nowhere to put a quiet multiplier.

   This exists because the first version of that test compared the layer
   product against damageLayers' OWN `dmg` field - two numbers the same
   function had just produced together. It proved the model was internally
   consistent and nothing else: a `dmg *= 1.30` dropped into
   executeTechnique passed it on the first run.
   ===================================================================== */
function postLayer(ev, dmg, by, opts) {
  const o = opts || {};
  let next = o.add !== undefined ? dmg + o.add : dmg * o.mul;
  next = Math.round(next);
  if (o.min !== undefined) next = Math.max(o.min, next);
  return postLayerObserved(ev, dmg, next, by);
}
/* for an adjustment whose arithmetic lives somewhere else - a style-trait
   module rewriting ev.dmg, a relic hook, the tapout floor. The ledger
   records what it did; the chain still holds it to starting where the
   previous entry ended. */
function postLayerObserved(ev, from, to, by) {
  if (to === from) return from;
  if (ev) (ev.dmgPost || (ev.dmgPost = [])).push({ by: by, from: from, to: to });
  return to;
}

/* the whole damage calculation, layer by layer, with nothing rounded until
   the end. damageOf() is this plus the relic hook. */
function damageLayers(d, side, foe, tech, foeTech) {
  const out = { base: 0, fit: 1, situation: 1, investment: 1, finish: 1,
                scale: TECH_DMG_SCALE, raw: { fit: 1, situation: 1, investment: 1, finish: 1 }, dmg: 0 };
  if (!tech || !tech.power) return out;
  const mods = statusMods(side);
  const foeMods = foe ? statusMods(foe) : { def: 1 };
  const disc = tech.disc ? DISCIPLINES[tech.disc] : null;

  /* ---- base: the matchup on paper ---- */
  let base = tech.power * (disc ? disc.bias.pow : 1) * (side.atkMul || 1);
  if (tech.cls === "THROW" && side.throwMul) base *= side.throwMul;
  if (tech.cls === "SUB" && side.subMul) base *= side.subMul;
  /* the defender's own toughness. Floored at 0.6 exactly as the old
     combined divisor was, so a tuned-down fighter cannot become armour. */
  base /= Math.max(0.6, (foe && foe.defMul) || 1);

  /* ---- fit: right tool, right place ---- */
  let fit = 1;
  if (d) {
    fit *= rangeFit(tech.range, d.range);
    fit *= comfort(side.discs, d.range);
  }

  /* ---- situation: what is true this turn ---- */
  let sit = mods.pow;                       // what is currently wrong with me
  if (d) {
    sit *= positionModsFor(d, side).pow;    // room to work, or backed onto the ropes
    if (typeof controlModsFor === "function") sit *= controlModsFor(d, side).pow;
  }
  /* what the conditions on HIM have done to his defence. His dossier
     toughness is in `base`; this is only the part the fight caused. */
  sit /= Math.max(0.6, foeMods.def || 1);
  // 3-choice dynamic: a strike thrown into a focus catches him flat-footed
  if (foeTech && typeof classifyTechniqueChoice === "function" && typeof resolve3WayDynamic === "function") {
    const dyn = resolve3WayDynamic(classifyTechniqueChoice(tech), classifyTechniqueChoice(foeTech));
    if (dyn.advantage === "STRIKE" && dyn.winner === "atk") sit *= 1.30;
  }
  // Guard Break: throws and submissions go straight through a guard
  if (foeTech && foeTech.cls === "GUARD" && (tech.cls === "THROW" || tech.cls === "SUB")) sit *= 1.25;
  if (side.stam <= 0) sit *= 0.7;           // nothing left on it

  /* ---- investment: what the player put into this technique ---- */
  let inv = 1;
  if (side.drill && side.drill[tech.id]) inv *= 1 + 0.15 * side.drill[tech.id];
  if (side.seals && side.seals[tech.id] === "SEAL_HEAVY") inv *= 1.25;
  if (side.seals && side.seals[tech.id] === "SEAL_COUNTER" && foeTech && foeTech.cls === "STRIKE") inv *= 1.45;
  if (d && d.range === "CLINCH" && typeof hasResonance === "function" && side.techs &&
      hasResonance(side.techs, "DIRTY_BOXING")) inv *= 1.15;
  /* Bleed, Stun or Winded - the three the resonance card names, and no
     more. It had quietly grown DAZED and STAMINA_BREAK, which is a wider
     trigger than the player was sold; A3's brief was to re-express every
     existing effect, not to extend one. */
  if (typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "RUTHLESS_COMBAT") &&
      (hasStatus(foe, "BLEEDING") || hasStatus(foe, "STUNNED") || hasStatus(foe, "WINDED"))) inv *= 1.25;

  /* ---- finish: punishing a man who is already in trouble ----
     PINNED already opens him up through statusMods (def 0.75) and through
     accuracy (x1.25). The old x1.4 here made a locked-in sub the biggest
     hit in the game by a distance - 57% of all finishes were submissions -
     so it is a nudge, and the whole layer is capped at 1.5. */
  let fin = 1;
  if (hasStatus(foe, "STUNNED")) fin *= 1.3;
  if (hasStatus(foe, "DAZED")) fin *= 1.15;
  if (tech.cls === "SUB" && (hasStatus(foe, "PINNED") || hasStatus(foe, "HELD"))) fin *= 1.15;

  out.base = base;
  out.raw = { fit: fit, situation: sit, investment: inv, finish: fin };
  out.fit = clampLayer(fit, DMG_CLAMP.fit);
  out.situation = clampLayer(sit, DMG_CLAMP.situation);
  out.investment = clampLayer(inv, DMG_CLAMP.investment);
  out.finish = clampLayer(fin, DMG_CLAMP.finish);
  out.dmg = Math.max(2, Math.round(base * out.fit * out.situation * out.investment * out.finish * TECH_DMG_SCALE));
  return out;
}

/* `layers` is an optional already-computed breakdown, so the resolver can
   keep the numbers it is about to put on the event without paying for the
   whole calculation twice on every landed technique. */
function damageOf(d, side, foe, tech, foeTech, layers, ev) {
  if (!tech || !tech.power) return 0;
  const modelled = (layers || damageLayers(d, side, foe, tech, foeTech)).dmg;
  let dmg = modelled;
  if (d && d.relics && typeof relicHook === "function") {
    dmg = relicHook(d.relics, "onDmgCalc", dmg, { d, side, foe, tech, foeTech });
  }
  dmg = Math.max(1, dmg);
  /* a relic is the first thing that can move a hit off its modelled value,
     so it is the first entry in the ledger */
  return postLayerObserved(ev, modelled, dmg, "relic");
}

/* accuracy, same four layers, but the investment layer pays in points */
function accuracyLayers(d, side, foe, tech) {
  const mods = statusMods(side);
  const disc = (tech && tech.disc) ? DISCIPLINES[tech.disc] : null;

  /* ---- base ---- */
  const base = (tech ? tech.acc : 90) * (disc ? disc.bias.acc : 1);

  /* ---- fit ---- */
  let fit = 1;
  if (d && tech) {
    fit *= rangeAccFit(tech.range, d.range);
    fit *= comfort(side.discs, d.range);
    /* a shot from further out than it was built for is telegraphed: 2,400
       audited fights had wrestlers landing double legs from kicking range
       at 72% and the mat eating 48% of all turns. -22% on top of the range
       fall-off prices the LONG shot without touching the MID one. */
    if (tech.range && tech.range !== "ANY" && (tech.flags || []).indexOf("takedown") >= 0 &&
        RANGE_INDEX[d.range] < RANGE_INDEX[tech.range]) fit *= 0.68;
  }
  // punching range is the cleanest exchange in fighting - it should be worth
  // standing in rather than a corridor between kicks and the clinch
  if (d && d.range === "MID") fit *= 1.06;

  /* ---- situation ---- */
  let sit = mods.acc;
  if (hasStatus(foe, "OFF_BALANCE")) sit *= 1.18;
  if (hasStatus(foe, "STAMINA_BREAK")) sit *= 1.20;
  if (side.stam <= 0) sit *= 0.85;
  if (d) sit *= positionModsFor(d, side).acc;
  if (d && typeof controlModsFor === "function") sit *= controlModsFor(d, side).acc;
  if (typeof cutPenalty === "function") sit *= cutPenalty(side).acc;
  // the longer you are held down, the better your work back to the feet
  if (d && tech && (tech.flags || []).indexOf("escape") >= 0) {
    sit *= groundEscapeBonus(d);
    if (typeof controlModsFor === "function") sit *= controlModsFor(d, side).escape;
  }

  /* ---- finish ---- */
  let fin = 1;
  if (hasStatus(foe, "PINNED") && tech && tech.cls === "SUB") fin *= 1.25;
  if (hasStatus(foe, "HELD") && tech && (tech.cls === "THROW" || tech.cls === "SUB")) fin *= 1.15;
  if (hasStatus(foe, "DAZED")) fin *= 1.15;

  /* ---- investment, in points ----
     These used to be `acc += 5` dropped into the middle of the multiplier
     chain, so what a drill rep was worth depended on where in the ring you
     were standing. A drilled technique is worth the same five points
     wherever you throw it. */
  let pts = 0;
  if (side.drill && tech && side.drill[tech.id]) pts += 5 * side.drill[tech.id];
  if (side.seals && tech && side.seals[tech.id] === "SEAL_FLOW") pts += 12;
  if (d && d.range === "LONG" && typeof hasResonance === "function" && side.techs &&
      hasResonance(side.techs, "STRIKERS_HORIZON")) pts += 10;
  if (side.accBonus) pts += side.accBonus;

  const out = {
    base: base,
    fit: clampLayer(fit, ACC_CLAMP.fit),
    situation: clampLayer(sit, ACC_CLAMP.situation),
    finish: clampLayer(fin, ACC_CLAMP.finish),
    investmentPts: clampLayer(pts, ACC_CLAMP.investmentPts),
    raw: { fit: fit, situation: sit, finish: fin, investmentPts: pts },
    acc: 0,
  };
  out.acc = base * out.fit * out.situation * out.finish + out.investmentPts;
  return out;
}

function accuracyOf(d, side, foe, tech) {
  let acc = accuracyLayers(d, side, foe, tech).acc;
  if (d && d.relics && typeof relicHook === "function") {
    acc = relicHook(d.relics, "onAccuracy", acc, { d, side, foe, tech });
  }
  return Math.max(5, Math.min(99, acc));
}

/* The fight moves when a technique says so - but it travels, it does not
   teleport. An audit of 3,600 fights found MID at 3.6% and CLINCH at 2.6%
   of all turns: takedowns jumped straight from striking range to the mat
   and escapes jumped straight back, so the two middle ranges were skipped
   entirely and a third of the technique dex was unreachable.
   Now a shift covers one step unless the technique has earned more:
   a committed takedown genuinely does put you on the ground in one motion,
   and an explosive break genuinely does create space - everything else
   passes through the range in between, which is where the clinch lives. */
function applyRangeShift(d, tech, ev, entrant) {
  if (!tech) return;
  let target = tech.moves;
  if (tech.shift) {
    const i = RANGE_INDEX[d.range] + tech.shift;
    target = RANGE_ORDER[Math.max(0, Math.min(RANGE_ORDER.length - 1, i))];
  }
  if (!target || target === d.range) return;
  const fromRange = d.range;
  const from = RANGE_INDEX[d.range], to = RANGE_INDEX[target];
  const f = tech.flags || [];
  let dest;
  if (to > from) {
    /* closing: only a committed shot covers two ranges - you cannot
       hip-throw someone from punching range without tying up with them
       first. Any takedown flag used to be enough, which made every single
       leg from MID a one-motion trip to the mat: GROUND took 42-48% of all
       turns against a 25-35% band and the clinch barely existed at 13%.
       A double or a single that is not thrown with everything behind it
       ends in a tie-up against the fence, which is where it ends in a real
       fight - and the follow-up throw from there is still one step down,
       so the takedown still works, it just takes the extra beat that gives
       the other man something to defend. */
    const committed = f.indexOf("power") >= 0 || f.indexOf("elite") >= 0 || f.indexOf("charge") >= 0;
    const leap = committed && (f.indexOf("takedown") >= 0 || f.indexOf("charge") >= 0);
    dest = leap ? to : Math.min(to, from + 1);
  } else {
    // breaking away: a push or an explosive escape covers more than one step
    const leap = f.indexOf("push") >= 0 || f.indexOf("reset") >= 0;
    dest = leap ? to : Math.max(to, from - 1);
  }
  if (dest === from) return;
  d.range = RANGE_ORDER[dest];
  ev.rangeTo = d.range;
  if (typeof syncControlOnRange === "function") {
    syncControlOnRange(d, fromRange, d.range, entrant || null);
    ev.control = typeof controlSnapshot === "function" ? controlSnapshot(d) : null;
  }
  if (d.range !== "GROUND" && d.subStage) {
    d.subStage = 0;
    d.subAttacker = null;
    d.subDefender = null;
    d.subTech = null;
  }
}

/* How long the fight has been on the mat. A fight that stalls on the ground
   gets easier to stand up out of - fighters work back to their feet and
   referees stand them up. Without this the ground is a one-way door and the
   game becomes 63% mat work. */
function tickRangeClock(d) {
  if (d.range === "GROUND") d.groundTurns = (d.groundTurns || 0) + 1;
  else d.groundTurns = 0;
}
/* Ramps from the first full turn on the mat. Under the old 1-turn grace and
   +10%/turn a striker locked in a sub (acc x0.70) stood up at ~40%; the ramp
   now reaches its cap in two turns, which is when the referee would be
   looking at a stall anyway.
   The cap moved 0.30 -> 0.55 for the ground-share gate: with 0.30 the average
   stay on the mat was 2.76 turns and GROUND ate 44% of every fight against a
   25-35% band, because the man on the bottom also carries the control
   penalty (x0.80) and the two very nearly cancelled - the ramp was buying
   him four accuracy points for being stuck. Plan criterion 4 asks for
   escapes that are actually viable, and this is the number that decides it. */
const groundEscapeBonus = (d) => 1 + Math.min(0.70, (d.groundTurns || 0) * 0.30);

/* Guard: a GUARD technique soaks the next incoming hit and buys air back.
   46 of the 51 guards in the dex carry no evade/parry flag, which made them
   mechanically identical to - and strictly worse than - the basic_guard every
   fighter already owns, since that one is ANY-range and clears WINDED. That
   is 39 imported techniques of dead content.
   The fix uses data already on them: a guard built for one range beats a
   generic cover-up when the fight is actually there. A leg check is the right
   answer to a kick and useless on the mat, which is both true and enough to
   give every one of them a reason to exist. */
function guardFactor(target, targetTech, d, atkTech) {
  if (!targetTech || targetTech.cls !== "GUARD") return 1;
  if (target && typeof hasStatus === "function" && hasStatus(target, "STAMINA_BREAK")) return 1.0;
  if (atkTech && (atkTech.cls === "THROW" || atkTech.cls === "SUB")) return 1.0; // Guard Break: Throws and Submissions penetrate Guards completely

  let f = 0.55;
  if (targetTech.flags.indexOf("evade") >= 0) f = 0.25;
  else if (targetTech.flags.indexOf("parry") >= 0) f = 0.45;
  if (d && targetTech.range && targetTech.range !== "ANY") {
    f *= targetTech.range === d.range ? 0.76      // the right guard, in the right place
       : rangeFit(targetTech.range, d.range) >= 0.7 ? 1 : 1.25;   // wrong tool entirely
  }
  // Height interactions for guards
  if (atkTech && typeof attackHeightOf === "function") {
    const atkH = atkTech.height || attackHeightOf(atkTech);
    const defH = targetTech.height || attackHeightOf(targetTech);
    const isLowGuard = defH === "LOW" || (targetTech.flags && targetTech.flags.indexOf("leg") >= 0);

    // Mid beating low guard / crouch
    if (atkH === "MID" && isLowGuard) {
      f = 1.0; // low guard fails against mid attack
    }
    // Low tripping standing guard (high/mid guard)
    else if (atkH === "LOW" && !isLowGuard) {
      f = Math.min(1.0, f * 1.40); // standing guard fails to soak low attack
    }
    // Low checked by low guard (leg check)
    else if (atkH === "LOW" && isLowGuard) {
      f *= 0.70; // low guard cleanly shuts down low attack
    }
  }
  return Math.min(0.95, f);
}

/* Resolve height interaction details between two techniques */
function resolveHeightInteraction(d, side, foe, atkTech, foeTech) {
  if (!atkTech) return { height: "MID", foeHeight: null, note: null, tripped: false, crushed: false, reversalCaught: false };
  const atkH = atkTech.height || (typeof attackHeightOf === "function" ? attackHeightOf(atkTech) : "MID");
  const foeH = foeTech ? (foeTech.height || (typeof attackHeightOf === "function" ? attackHeightOf(foeTech) : "MID")) : null;
  const out = {
    height: atkH,
    foeHeight: foeH,
    note: null,
    tripped: false,
    crushed: false,
    reversalCaught: false
  };

  if (!foeTech) return out;

  const foeFlags = foeTech.flags || [];
  const isLowGuard = foeH === "LOW" || foeFlags.indexOf("leg") >= 0;
  const isStandingGuard = foeTech.cls === "GUARD" && !isLowGuard;

  // Mid beating low guard / crouch
  if (atkH === "MID" && isLowGuard && foeTech.cls === "GUARD") {
    out.crushed = true;
    out.note = "MID CRUSHED LOW GUARD";
  }

  // Low tripping standing guard
  if (atkH === "LOW" && isStandingGuard) {
    out.tripped = true;
    out.note = "LOW TRIPPED STANDING GUARD";
  }

  // Reversals catching specific heights
  const isReversal = foeFlags.indexOf("reversal") >= 0 || foeFlags.indexOf("parry") >= 0;
  if (isReversal && foeTech.cls === "GUARD") {
    const catches = foeTech.catches || (foeTech.catchHeight ? [foeTech.catchHeight] : null);
    if (catches) {
      if (catches.indexOf(atkH) >= 0 || catches.indexOf("ANY") >= 0) {
        out.reversalCaught = true;
        out.note = "REVERSAL CAUGHT " + atkH;
      }
    } else {
      if (atkTech.cls === "STRIKE" && (atkH === "HIGH" || atkH === "MID")) {
        out.reversalCaught = true;
      }
    }
  }

  return out;
}

/* "severe head impact" - the shot that rocks a man and puts the other one
   on the hunt for the finish.

   This used to be a flat `dmg >= 22`, an absolute HP number written when
   TECH_DMG_SCALE was 0.42. The scale is the one knob the balance audit
   turns to set fight length, so every time it moved, this silently moved
   with it: at 0.34 the heaviest kick in the dex (Head Kick, power 42,
   Muay Thai bias 1.14) landed for 19 on a fresh fighter and nothing was
   ever a severe impact again. A share of the target's health bar says the
   same thing - "about a fifth of him, in one shot" - at any scale.

   On the value: 0.18 was arrived at by re-basing 22 from 0.42 to the 0.34
   the scale sat at that afternoon. The shipped scale is 0.37, where the
   same arithmetic gives 19.4, so 0.18 is about 7% more generous than a
   strict re-base - it rocks a man slightly more readily than the 0.42-era
   number did. It is kept because the share form is the right semantics
   whatever the arithmetic says, and because the roster is tuned and green
   against 0.18; moving it moves strike finishes and needs a re-tune.
   Measured, it fires on 6.2% of landed techniques.

   And be clear about what this does NOT fix: the coupling to absolute HP
   is gone, the coupling to TECH_DMG_SCALE is not. How often a fifth of a
   bar arrives in one shot still moves when the tuner moves the scale. */
const ROCK_SHARE = 0.18;

/* THE CHIN. src/progress/weight-cut.js writes weightChinMod on the side -
   +0.15 for the championship cut, -0.20 for walking in at natural weight -
   and until now nothing read it, so "compromised chin" and "+20% stun
   defense" were text on a card that never reached a fight. Above 1 the man
   is easier to rattle, below 1 he is harder; it is the one number, applied
   in the one place the chin decides anything: whether a shot rocks him and
   whether a stunning technique's effect takes. */
const chinFactor = (side) => Math.max(0.5, Math.min(1.5, 1 + ((side && side.weightChinMod) || 0)));
/* A granite chin needs a bigger shot to rock it; a drained one needs less. */
const rockThreshold = (foe) => Math.max(2, ((foe && foe.maxhp) || 100) * ROCK_SHARE / chinFactor(foe));
/* the statuses that ARE getting rocked - everything else on a technique
   (bleeding, a hurt leg, being held) has nothing to do with the chin */
const CHIN_STATUSES = { STUNNED: 1, DAZED: 1 };

/* Who an emitted commentary event is about.

   The broadcast used to be handed a roster FIRST NAME and nothing else, so
   the page's resolver had to match that string back to a corner. That is
   guesswork twice over: an AZX Force patrol borrows a roster fighter's card
   to wear a silhouette, so the HUD said AZX FORCE while the broadcast said
   MIKE, and two roster fighters sharing a first name are simply ambiguous.
   The corner is known here for nothing, so it is sent: "p" or "e", which is
   what src/page.template.html's resolver reads first. The name stays as a
   fallback for any listener that has no duel to resolve against. */
const sideKeyOf = (d, s) => (d && s ? (s === d.p ? "p" : (s === d.e ? "e" : null)) : null);
const firstNameOf = (s) => ((typeof FIGHTERS !== "undefined" && s && FIGHTERS[s.fid])
  ? String(FIGHTERS[s.fid].name).split(" ")[0] : "");

/* execute `tech` by `side` against `foe`. `foeTech` is what the other fighter
   committed this turn, so guards and sprawls can answer it. */
function executeTechnique(d, side, foe, tech, foeTech, rnd) {
  const R = rnd || Math.random;
  const techHeight = tech ? (tech.height || (typeof attackHeightOf === "function" ? attackHeightOf(tech) : "MID")) : "MID";
  const ev = { by: side === d.p ? "p" : "e", tech, name: tech ? tech.name : "Action", hit: false, dmg: 0,
               status: null, rangeTo: null, blocked: false, guarded: false, whiff: false,
               stam: 0, launcher: false, crit: false, height: techHeight };

  if (!tech) { ev.whiff = true; return ev; }

  const blocked = statusBlocks(side, tech.cls);
  if (blocked) { ev.whiff = true; ev.note = blocked; return ev; }

  /* position-gated ringcraft: the menus filter these, so reaching here out
     of position means a stale commit - it whiffs rather than crashes */
  if (typeof posOk === "function" && !posOk(d, side, tech)) {
    ev.whiff = true; ev.note = "OUT OF POSITION"; return ev;
  }

  /* Circle Out IS the escape roll - the one attemptEscape() was built for.
     It charges its own air inside attemptEscape, succeeds against the
     position rather than the man, and a failure is a real turn spent. */
  if (tech.flags.indexOf("circle") >= 0) {
    const esc = attemptEscape(d, side, R);
    ev.stam = esc.stam; ev.escape = esc;
    if (esc.escaped) { ev.note = "CIRCLED OUT"; ev.posTo = d.pos; }
    else { ev.whiff = true; ev.note = "CUT OFF AT THE ROPES"; }
    return ev;
  }

  if (d && d.relics && typeof relicHook === "function") {
    relicHook(d.relics, "onPreStrike", null, { d, side, foe, tech, foeTech });
  }

  let cost = staminaCost(side, tech, d);
  /* Perpetual Motion: the opening technique of every turn is free air */
  if (side.freeOpener && !side._fo) { cost = 0; side._fo = true; }
  /* water break: the corner already paid for this one */
  if (side.freeNext && cost > 0) { cost = 0; side.freeNext = false; }
  const stamRemaining = side.stam - cost;
  if (stamRemaining < 0) {
    side.stam = 0;
    addStatus(side, "STAMINA_BREAK");
    addStatus(side, "WINDED");
    if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
      CombatEvents.emit("STAMINA_BREAK", { turn: d ? d.turn : 0, side: sideKeyOf(d, side), fighterName: firstNameOf(side) });
    }
  } else {
    side.stam = stamRemaining;
    if (side.stam === 0) {
      addStatus(side, "WINDED");
      if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
        CombatEvents.emit("STAMINA_BREAK", { turn: d ? d.turn : 0, side: sideKeyOf(d, side), fighterName: firstNameOf(side) });
      }
    }
  }
  ev.stam = cost;

  // 3-Choice Dynamic FOCUS handling
  const isFocusTech = tech.id === "basic_focus" || tech.id === "focus" || (tech.flags && tech.flags.indexOf("focus") >= 0) || tech.isFocus;
  if (isFocusTech) {
    const fRes = (typeof focusAction === "function") ? focusAction(side, d, foeTech) : { gainedFocus: 1, gainedStam: 18, outResourced: false };
    ev.guarded = true;
    ev.focused = true;
    ev.recovered = fRes.gainedStam;
    ev.focusGained = fRes.gainedFocus;
    ev.note = fRes.outResourced
      ? "FOCUS OUT-RESOURCED GUARD (+2 FOCUS, +" + fRes.gainedStam + " STAM)"
      : "FOCUSED (+" + fRes.gainedFocus + " FOCUS, +" + fRes.gainedStam + " STAM)";
    return ev;
  }

  /* GUARD is not thrown at anyone - it buys stamina and sets up the soak */
  if (tech.cls === "GUARD") {
    const back = 14 + Math.round((side.maxStam || 60) * 0.08) + (side.guardBonus || 0);
    side.stam = Math.min(side.maxStam, side.stam + back);
    ev.guarded = true; ev.recovered = back;
    if (tech.flags.indexOf("recover") >= 0 && side.cond) delete side.cond.WINDED;
    if (d && d.subStage && d.subStage > 0 && d.subDefender === side && (tech.flags.indexOf("escape") >= 0 || tech.flags.indexOf("sweep") >= 0)) {
      d.subStage = Math.max(0, d.subStage - 1);
      if (d.subStage === 0) {
        if (side.cond) { delete side.cond.SUB_TRAPPED; delete side.cond.SUB_LOCKED; delete side.cond.SUB_SUBMITTED; }
        ev.subBroken = true;
        ev.note = (ev.note ? ev.note + " - " : "") + "SUBMISSION BROKEN";
        d.subAttacker = null; d.subDefender = null; d.subTech = null;
      } else {
        if (side.cond) { delete side.cond.SUB_LOCKED; delete side.cond.SUB_SUBMITTED; }
        addStatus(side, "SUB_TRAPPED");
        ev.subRegressed = true;
        ev.note = (ev.note ? ev.note + " - " : "") + "SUBMISSION BROKE TO STAGE 1";
      }
    }
    applyRangeShift(d, tech, ev, side);
    return ev;
  }

  /* a sprawl beats a takedown outright - the one hard counter in the game */
  const sprawlBlocked = d && d.relics && typeof relicFlag === "function" && relicFlag(d.relics, "preventSprawl");
  if (!sprawlBlocked && foeTech && foeTech.flags.indexOf("anti-takedown") >= 0 && tech.flags.indexOf("takedown") >= 0) {
    ev.whiff = true; ev.note = "SPRAWLED ON"; addStatus(side, "OFF_BALANCE");
    return ev;
  }

  const acc = accuracyOf(d, side, foe, tech);
  if (R() * 100 > acc) { ev.whiff = true; return ev; }

  ev.hit = true;
  if (d && d.relics && typeof relicHook === "function") {
    relicHook(d.relics, "onHit", null, { d, side, foe, tech, foeTech, ev });
  }
  /* the breakdown rides along on the event so the HUD, the log and the
     tests all read the same five numbers the maths used */
  const layers = damageLayers(d, side, foe, tech, foeTech);
  ev.dmgLayers = layers;
  let dmg = damageOf(d, side, foe, tech, foeTech, layers, ev);
  /* fresh wraps: a handful of strikes hit harder and cannot be answered */
  const wrapped = side.edge && side.edge.hits > 0 && tech.cls === "STRIKE";
  if (wrapped) { dmg = postLayer(ev, dmg, "fresh wraps", { mul: side.edge.mul || 1.25 }); side.edge.hits--; }

  const heightInter = resolveHeightInteraction(d, side, foe, tech, foeTech);
  let gf = guardFactor(foe, foeTech, d, tech);
  if (side && side.seals && side.seals[tech.id] === "SEAL_HEAVY" && gf < 1) {
    gf = 1 - (1 - gf) * 0.50; // ignores 50% guard reduction
  }
  if (gf < 1) {
    dmg = postLayer(ev, dmg, "guard", { mul: gf, min: 1 });
    ev.blocked = true;
  }

  // Guard Break: Throws and Submissions penetrate Guards completely, dealing 1.25x guard break damage and applying OFF_BALANCE
  if (foeTech && foeTech.cls === "GUARD" && (tech.cls === "THROW" || tech.cls === "SUB")) {
    ev.guardBreak = true;
    ev.blocked = false;
    if (!ev.note) ev.note = "GUARD BREAK";
    addStatus(foe, "OFF_BALANCE");
  }

  // 3-Way Dynamic: Strike counters Focus (+30% dmg, inflicts DAZED)
  if (foeTech && typeof classifyTechniqueChoice === "function" && typeof resolve3WayDynamic === "function") {
    const atkC = classifyTechniqueChoice(tech);
    const defC = classifyTechniqueChoice(foeTech);
    const dyn = resolve3WayDynamic(atkC, defC);
    if (dyn.advantage === "STRIKE" && dyn.winner === "atk") {
      ev.strikeCountersFocus = true;
      if (!ev.note) ev.note = dyn.note || "STRIKE COUNTERED FOCUS";
      addStatus(foe, "DAZED");
      if (!ev.status) ev.status = "DAZED";
    }
  }

  // Low tripping standing guard
  if (heightInter.tripped) {
    ev.tripped = true;
    if (!ev.note) ev.note = heightInter.note;
    addStatus(foe, "OFF_BALANCE");
  }
  // Mid crushing low guard
  if (heightInter.crushed) {
    ev.midCrush = true;
    if (!ev.note) ev.note = heightInter.note;
  }

  /* a parry/reversal answers back */
  const parryCheck = foeTech && foeTech.cls === "GUARD" &&
    (foeTech.flags.indexOf("parry") >= 0 || foeTech.flags.indexOf("reversal") >= 0 || heightInter.reversalCaught) &&
    !(wrapped && side.edge && side.edge.noParry) && !ev.guardBreak;

  if (parryCheck && (heightInter.reversalCaught || R() < 0.5)) {
    ev.counter = Math.max(2, Math.round(dmg * 0.5));
    if (heightInter.reversalCaught && typeof swapCorner === "function") {
      const foeKey = foe === d.p ? "p" : "e";
      if (swapCorner(d, foeKey)) {
        ev.reversal = true; ev.posTo = d.pos; ev.cornered = d.cornered;
      }
    }
    if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
      CombatEvents.emit("COUNTER_HIT", { turn: d ? d.turn : 0, side: sideKeyOf(d, foe), fighterName: firstNameOf(foe) });
    }
  }

  // Apex Predator resonance: extra impact on takedowns/throws
  if (typeof hasResonance === "function" && side.techs && (hasResonance(side.techs, "APEX_PREDATOR") || hasResonance(side.techs, "OCTAGON_PREDATOR")) &&
      (tech.cls === "THROW" || (tech.flags && tech.flags.indexOf("takedown") >= 0))) {
    dmg = postLayer(ev, dmg, "apex predator", { add: 12 });
    ev.predatorBonus = 12;
  }

  // Weight Cut Early Power modifier (rounds 1-2 / turns <= 6)
  if (side.weightPowerBonus && (!d || d.turn <= 6)) {
    dmg = postLayer(ev, dmg, "weight cut", { mul: 1 + side.weightPowerBonus });
    ev.weightPower = true;
  }

  // Coach Tactical Read Counter Bonus
  if (side.coachRead) {
    dmg = postLayer(ev, dmg, "coach read", { mul: 1.20 });
    ev.coachReadBonus = true;
    delete side.coachRead;
  }

  // Dead Leg kick damage reduction
  if (side.cond && side.cond.DEAD_LEG && (tech.flags && (tech.flags.indexOf("kick") >= 0 || (tech.cls === "STRIKE" && tech.height === "LOW")))) {
    dmg = postLayer(ev, dmg, "dead leg", { mul: 0.50, min: 1 });
    ev.deadLegImpaired = true;
  }

  // Wall-Pinned / Cage leverage damage
  if (d && (d.pos === "WALL_PINNED" || (foe.cond && foe.cond.WALL_PINNED))) {
    if (tech.cls === "STRIKE" && d.range === "CLINCH") {
      dmg = postLayer(ev, dmg, "cage leverage", { add: 4 });
      ev.dirtyBoxingCage = true;
    }
  }

  // Vampiric Leech Seal
  if (side && side.seals && side.seals[tech.id] === "SEAL_VAMPIRE" && dmg > 0) {
    const leech = Math.max(1, Math.round(dmg * 0.25));
    side.hp = Math.min(side.maxhp || 100, side.hp + leech);
    ev.leech = leech;
  }

  // Wind Flow Seal
  if (side && side.seals && side.seals[tech.id] === "SEAL_FLOW") {
    side.stam = Math.min(side.maxStam || 60, side.stam + 10);
    ev.flowRefund = 10;
  }

  // Viper Venom Seal
  if (side && side.seals && side.seals[tech.id] === "SEAL_VIPER" && R() * 100 < 75) {
    const vst = tech.eff ? tech.eff.st : "BLEEDING";
    if (addStatus(foe, vst)) ev.status = STATUS[vst] ? STATUS[vst].name : vst;
  }

  // Multi-Stage Ground Submission Engine (subStages.js)
  if (d && d.range === "GROUND" && tech.cls === "SUB" && ev.hit && !ev.whiff) {
    if (!d.subStage || d.subStage === 0 || d.subAttacker !== side) {
      d.subStage = 1;
      d.subAttacker = side;
      d.subDefender = foe;
      d.subTech = tech;
      addStatus(foe, "SUB_TRAPPED");
      ev.subStage = 1;
      ev.note = (ev.note ? ev.note + " - " : "") + "SUBMISSION TRAPPED (STAGE 1)";
    } else if (d.subStage === 1 && d.subAttacker === side) {
      d.subStage = 2;
      if (foe.cond) delete foe.cond.SUB_TRAPPED;
      addStatus(foe, "SUB_LOCKED");
      foe.stam = Math.max(0, (foe.stam || 0) - 14);
      /* SUB_TRAPPED (def 0.80) already opens this hit up through the
         situation layer. The extra 15% on top took submissions back over
         the 40% cap once the damage scale went to 0.37, so the ladder now
         pays in position - the lock, the stamina drain and the blocked
         strike class - rather than in a third damage bonus. */
      dmg = postLayer(ev, dmg, "figure-four lock", { mul: 1.05 });
      ev.subStage = 2;
      ev.note = (ev.note ? ev.note + " - " : "") + "FIGURE-FOUR LOCKED (STAGE 2)";
    } else if (d.subStage >= 2 && d.subAttacker === side) {
      /* Three landed subs used to be a finish at any HP, so a fresh fighter
         tapped on turn 4 and the damage scale could not lengthen a fight.
         A man with more than 26% of his health left survives the crank:
         he eats it as a heavy hit and the lock stays at stage 2, so the
         attacker keeps the position but has to earn the tap. */
      const crank = Math.round(dmg * 1.12);
      if (foe.hp - crank <= (foe.maxhp || 100) * 0.26) {
        d.subStage = 3;
        if (foe.cond) { delete foe.cond.SUB_TRAPPED; delete foe.cond.SUB_LOCKED; }
        addStatus(foe, "SUB_SUBMITTED");
        ev.subStage = 3;
        ev.tapout = true;
        ev.note = "TAPOUT SUBMISSION FINISH!";
        foe.hp = 0;
        dmg = postLayerObserved(ev, dmg, Math.max(dmg, 30), "tapout floor");
      } else {
        addStatus(foe, "SUB_LOCKED");
        dmg = postLayer(ev, dmg, "submission crank", { mul: 1.12 });
        ev.subStage = 2;
        ev.subCranked = true;
        ev.note = (ev.note ? ev.note + " - " : "") + "CRANKED - HE SURVIVES THE LOCK";
      }
    }
  }

  // Submission Escape Check: Defending fighter executing escape, sweep or reversal
  if (d && d.subStage && d.subStage > 0 && d.subDefender === side && ev.hit) {
    const fFlags = tech.flags || [];
    if (fFlags.indexOf("escape") >= 0 || fFlags.indexOf("sweep") >= 0 || fFlags.indexOf("reversal") >= 0) {
      d.subStage = Math.max(0, d.subStage - 1);
      if (d.subStage === 0) {
        if (side.cond) { delete side.cond.SUB_TRAPPED; delete side.cond.SUB_LOCKED; delete side.cond.SUB_SUBMITTED; }
        ev.subBroken = true;
        ev.note = (ev.note ? ev.note + " - " : "") + "SUBMISSION BROKEN";
        d.subAttacker = null;
        d.subDefender = null;
        d.subTech = null;
      } else {
        if (side.cond) { delete side.cond.SUB_LOCKED; delete side.cond.SUB_SUBMITTED; }
        addStatus(side, "SUB_TRAPPED");
        ev.subRegressed = true;
        ev.note = (ev.note ? ev.note + " - " : "") + "SUBMISSION BROKE TO STAGE 1";
      }
    }
  }

  // Tri-Zone Damage & Checked Kick Reflection
  const targetZone = (typeof getZoneDamageTarget === "function") ? getZoneDamageTarget(tech) : "head";
  ev.targetZone = targetZone;

  if (targetZone === "legs" && foeTech && foeTech.cls === "GUARD") {
    const fFlags = foeTech.flags || [];
    const isLegGuard = fFlags.indexOf("leg") >= 0 || fFlags.indexOf("parry") >= 0 || foeTech.height === "LOW";
    if (isLegGuard && !ev.guardBreak) {
      ev.checkedKick = true;
      const refl = Math.max(2, Math.round(dmg * 0.40));
      ev.checkedReflection = refl;
      if (typeof hurtZone === "function") hurtZone(side, "legs", refl);
      ev.note = (ev.note ? ev.note + " - " : "") + "CHECKED KICK (" + refl + " DMG RETURNED)";
    }
  }

  if (typeof hurtZone === "function") {
    hurtZone(foe, targetZone, dmg);
  }

  /* Cut meter: head strikes and cut-flagged work open the face */
  if (typeof hurtCut === "function" && (targetZone === "head" || (tech.flags || []).indexOf("cut") >= 0)) {
    const cutAmt = Math.max(1, Math.round(dmg * ((tech.flags || []).indexOf("cut") >= 0 ? 0.55 : 0.22)));
    const cutNow = hurtCut(foe, cutAmt);
    ev.cut = cutAmt;
    ev.cutTotal = cutNow;
    if (typeof cutPenalty === "function") {
      const cp = cutPenalty(foe);
      if (cp.stopRisk > 0 && R() < cp.stopRisk) {
        ev.cutStoppage = true;
        ev.note = (ev.note ? ev.note + " - " : "") + "CUT STOPPAGE RISK";
      }
    }
  }

  if (typeof applyStyleTraitOnHit === "function") {
    const beforeTrait = dmg;
    ev.dmg = dmg;
    applyStyleTraitOnHit(side, foe, tech, ev);
    dmg = postLayerObserved(ev, beforeTrait, ev.dmg, "style trait");
  }

  if (targetZone === "legs" && foe.zones && foe.zones.max && foe.zones.legs < (foe.zones.max * 0.45)) {
    if (R() < 0.40) addStatus(foe, "LEG_HURT");
  } else if (targetZone === "body") {
    foe.stam = Math.max(0, (foe.stam || 0) - 6);
    if (foe.zones && foe.zones.max && foe.zones.body < (foe.zones.max * 0.45)) {
      if (R() < 0.40) addStatus(foe, "WINDED");
    }
  } else if (targetZone === "head") {
    if (dmg >= rockThreshold(foe) || (foe.cond && foe.cond.STUNNED) || (foe.zones && foe.zones.max && foe.zones.head < (foe.zones.max * 0.35))) {
      side.seekFinish = true;
      ev.rocked = true;
      if (!ev.note) ev.note = "OPPONENT ROCKED - SEEK FINISH!";
    }
  }

  ev.dmg = dmg;

  if (tech.eff) {
    const chance = CHIN_STATUSES[tech.eff.st] ? tech.eff.ch * chinFactor(foe) : tech.eff.ch;
    if (R() * 100 < chance) {
      if (addStatus(foe, tech.eff.st)) ev.status = STATUS[tech.eff.st] ? STATUS[tech.eff.st].name : tech.eff.st;
    }
  }
  if (tech.flags.indexOf("launcher") >= 0 && !ev.blocked) ev.launcher = true;
  applyRangeShift(d, tech, ev, side);
  /* the corner reversal: a trapped man lands it and the corner changes
     hands - the whole point of the technique, so it happens before the
     pressure ledger books anything */
  if (tech.flags.indexOf("reversal") >= 0) {
    const key = side === d.p ? "p" : "e";
    if (swapCorner(d, key)) {
      ev.reversal = true; ev.posTo = d.pos; ev.cornered = d.cornered;
      if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
        CombatEvents.emit("REVERSAL", { turn: d ? d.turn : 0, side: sideKeyOf(d, side), fighterName: firstNameOf(side) });
      }
    }
    if (typeof reverseControl === "function" && reverseControl(d, side)) {
      ev.controlReversal = true;
      ev.control = typeof controlSnapshot === "function" ? controlSnapshot(d) : null;
    }
  }
  pressureShift(d, side, ev);   // sustained pressure walks them toward the ropes

  // Cage Pinning: advancing pressure in clinch against ropes or corner pins opponent to cage
  if (d && d.range === "CLINCH" && (d.pos === "ROPES" || d.pos === "CORNER") && !ev.blocked) {
    if (tech.flags && (tech.flags.indexOf("takedown") >= 0 || tech.cls === "THROW" || tech.cls === "STRIKE")) {
      if (typeof pinToWall === "function") {
        pinToWall(d, side, foe);
        ev.pinnedToWall = true;
      }
    }
  }
  return ev;
}

/* end of turn: conditions tick, both fighters get a little air back */
function endTurnUpkeep(side) {
  const dmg = tickStatus(side);
  const regen = Math.round((side.maxStam || 60) * 0.06);
  side.stam = Math.min(side.maxStam, side.stam + regen);
  if (side.stam > 0 && side.cond) delete side.cond.WINDED;
  side._fo = false;                 // Perpetual Motion resets with the turn
  side.seekFinish = false;          // Seek Finish lasts for 1 turn after the stun
  return dmg;
}

