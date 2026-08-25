/* =====================================================================
   Aqua Zero Heavens Arena - CPU technique selection
   Luminara Digital

   The CPU scores every technique it knows by what that technique is
   actually worth this turn: expected damage after the range fit, the value
   of the condition it might apply, whether it drags the fight toward a
   range its own disciplines own, and whether it can afford the air.

   Difficulty controls the noise on top, so a rookie opponent still throws
   a bad spinning kick from time to time.
   ===================================================================== */
const STATUS_VALUE = { STUNNED: 16, WINDED: 12, BLEEDING: 10, OFF_BALANCE: 8,
                       LEG_HURT: 12, ARM_HURT: 12, HELD: 9, PINNED: 14 };

/* A gameplan reweights what this fighter cares about. No gameplan means the
   old, purely percentage-driven brain. */
function scoreTechnique(d, side, foe, tech, noise, rnd, optWeights) {
  const R = rnd || Math.random;
  const w = optWeights !== undefined ? optWeights : (side.ai || null);
  let s = 0;
  const fit = rangeFit(tech.range, d.range);

  /* ringcraft: a position-gated technique is worthless out of position,
     and the escape roll is worth exactly what being trapped costs */
  if (typeof posOk === "function" && !posOk(d, side, tech)) return -1e9;
  if ((tech.flags || []).indexOf("circle") >= 0) {
    const sev = d.pos === "CORNER" ? 22 : 12;
    return sev * escapeChance(side, d.pos) + (R() - 0.5) * noise;
  }

  if (tech.cls === "GUARD") {
    // covering up is worth a lot when hurt or empty
    s = 6;
    if (side.stam < side.maxStam * 0.3) s += 26;
    if (side.hp < side.maxhp * 0.3) s += 14;
    if (hasStatus(side, "WINDED")) s += 18;
    if (hasStatus(side, "STUNNED")) s += 10;
    if (w) {
      s *= w.guard || 1;
      // a counter-striker guards to bait, then punishes the whiff
      if (w.counterBonus && d.lastWhiffBy === (side === d.p ? "e" : "p")) s += w.counterBonus;
    }
  } else {
    const dmg = damageOf(d, side, foe, tech);
    const acc = accuracyOf(d, side, foe, tech) / 100;
    s = dmg * acc;
    if (dmg >= foe.hp) s += 40;                                  // finish it
    if (tech.eff) s += (STATUS_VALUE[tech.eff.st] || 6) * (tech.eff.ch / 100) * acc;
    if (tech.flags.indexOf("launcher") >= 0) s += 8;
    if (tech.cls === "SUB" && !(hasStatus(foe, "PINNED") || hasStatus(foe, "HELD"))) s -= 8;
    if (fit < 0.7) s -= 6;                                        // out of position
    // a corner-only payoff exists to be cashed - the gate above already
    // proved the other man is trapped
    if (tech.pos === "PRESSING") s += 10;
    if ((tech.flags || []).indexOf("reversal") >= 0) s += d.pos === "CORNER" ? 14 : 8;
    // walking a man down is worth more the closer the meter is to a notch,
    // and worth most to the arts built on it
    if ((tech.flags || []).indexOf("shove") >= 0) {
      const mine = side === d.p ? "p" : "e";
      if (d.cornered !== mine) {
        s += 5 * pressureOf(side);
        if (d.press && d.press.by === mine) s += Math.min(8, d.press.n * 3);
      }
    }
    if (w) {
      s *= w.aggression || 1;
      if (tech.cls === "SUB") s *= w.sub || 1;
      if (tech.range === "GROUND") s *= w.ground || 1;
      // a pressure fighter pays to close, an out-fighter pays to stay away
      if (w.closeIn && tech.moves) {
        const closer = RANGE_INDEX[tech.moves] > RANGE_INDEX[d.range];
        s += closer ? w.closeIn : -w.closeIn;
      }
      if (w.preferRange && tech.moves === w.preferRange) s += 16;
      if (w.preferRange && d.range === w.preferRange) s += 6;
      if (w.counterBonus && d.lastWhiffBy === (side === d.p ? "e" : "p")) s += w.counterBonus;
    }
  }
  // being stuck under someone is a losing position, and the longer it lasts
  // the more a fighter wants out - without this the CPU never stands up and
  // the fight lives on the mat forever
  if ((tech.flags || []).indexOf("escape") >= 0 && d.range === "GROUND") {
    const stuck = d.groundTurns || 0;
    s += 3 + Math.min(12, stuck * 2.5);
    if (homeRanges(side.discs).indexOf("GROUND") < 0) s += 6;    // a striker wants up badly
  }
  // does this technique drag the fight somewhere I am better? Only pay for
  // an actual change of range - "moving" to where we already stand is free.
  if (tech.moves && tech.moves !== d.range) {
    const mine = homeRanges(side.discs), theirs = homeRanges(foe.discs);
    if (mine.indexOf(tech.moves) >= 0) s += 12;
    if (theirs.indexOf(tech.moves) >= 0) s -= 8;
    // and leaving a range we own for one we do not is a mistake
    if (mine.indexOf(d.range) >= 0 && mine.indexOf(tech.moves) < 0) s -= 10;
  }
  const cost = staminaCost(side, tech);
  // a finisher does not pace itself and will swing on an empty tank
  if (cost > side.stam) s -= (w && w.ignoreStamina) ? 6 : 22;
  else s -= cost * (w && w.ignoreStamina ? 0.1 : 0.35);
  return s + (R() - 0.5) * noise;
}

function aiChooseTechnique(d, side, foe, opts) {
  opts = opts || {};
  let weights = (opts && opts.weights) || side.ai || null;
  if (d && d.adaptiveTracker && typeof AdaptiveAI !== "undefined" && typeof AdaptiveAI.adaptWeights === "function") {
    const baseW = weights || (typeof archetypeOf === "function" && typeof archetypeFor === "function" ? archetypeOf(archetypeFor(side.fid)).weights : null);
    if (baseW) {
      weights = AdaptiveAI.adaptWeights(baseW, d.adaptiveTracker, {
        intensity: opts.adaptiveIntensity || 1.0,
        veteran: (d.stage && d.stage >= 5) || (d.towerFloor && d.towerFloor >= 50),
      });
    }
  }
  const noise = (opts.noise === undefined ? 18 : opts.noise) * ((weights && weights.noise) || 1);
  const rnd = opts.rnd || Math.random;
  // a full meter gets cashed in
  if (side.sig && side.sup >= SUP_MAX && rnd() < (opts.superChance === undefined ? 0.75 : opts.superChance))
    return { tech: side.sig, signature: true };
  let best = null, bs = -1e9;
  side.techs.forEach((id) => {
    const t = TECH[id];
    const sc = scoreTechnique(d, side, foe, t, noise, rnd, weights);
    if (sc > bs) { bs = sc; best = t; }
  });
  return { tech: best || TECH.basic_guard, signature: false };
}
