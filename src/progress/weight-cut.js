/* =====================================================================
   Aqua Zero Heavens Arena - Fight-Week Weight Cut & Rehydration Engine
   Luminara Digital

   Tactical pre-fight weight management strategy balancing power & reach
   leverage against dehydration, chin vulnerability, and late cardio decline.
   ===================================================================== */
"use strict";

const WEIGHT_CUT_PROFILES = {
  CHAMPIONSHIP_CUT: {
    id: "CHAMPIONSHIP_CUT",
    name: "Championship Weight Cut (Brutal)",
    desc: "Maximal size & power leverage (+12% strike power, +4 reach), but compromised chin (-15% head HP) and accelerated late cardio burn.",
    earlyPowerBonus: 0.12,
    reachBonus: 4,
    headHealthMul: 0.85,
    lateCardioPenalty: 0.20, // applied after turn 6
    chinPenalty: 0.15,
  },
  DISCIPLINED_CUT: {
    id: "DISCIPLINED_CUT",
    name: "Disciplined Cut (Standard)",
    desc: "Standard professional weight protocol: balanced physical metrics with baseline stamina recovery.",
    earlyPowerBonus: 0.0,
    reachBonus: 0,
    headHealthMul: 1.0,
    lateCardioPenalty: 0.0,
    chinPenalty: 0.0,
  },
  NATURAL_WEIGHT: {
    id: "NATURAL_WEIGHT",
    name: "Natural Walk-Around Weight (Easy)",
    desc: "Full hydration & granite chin (+20% stun defense, +25% cardio recovery), with slight concession in raw explosive impact (-8% power).",
    earlyPowerBonus: -0.08,
    reachBonus: 0,
    headHealthMul: 1.15,
    lateCardioPenalty: -0.25, // +25% cardio recovery
    chinPenalty: -0.20,      // +20% stun/chin resistance
  },
};

const WEIGHT_CUT_IDS = Object.keys(WEIGHT_CUT_PROFILES);

/**
 * Returns a weight cut profile by id, defaulting to DISCIPLINED_CUT.
 */
function getWeightCutProfile(id) {
  return WEIGHT_CUT_PROFILES[id] || WEIGHT_CUT_PROFILES.DISCIPLINED_CUT;
}

/**
 * Applies fight-week weight cut profile adjustments to a combatant side.
 * @param {Object} side - Fighter combat state side
 * @param {string} profileId - CHAMPIONSHIP_CUT | DISCIPLINED_CUT | NATURAL_WEIGHT
 * @returns {Object} { ok: boolean, profile: Object }
 */
function applyWeightCut(side, profileId) {
  if (!side) return { ok: false, profile: null };
  const prof = getWeightCutProfile(profileId);
  side.weightProfile = prof.id;

  /* Both of the adjustments below used to be applied ON TOP of whatever
     was already there, so calling this twice - changing your mind on the
     profile screen, or re-applying on a rematch - stacked them: two
     championship cuts were +8 inches of reach and a head at 72% instead
     of 85%. A weight cut is a state you are in, not a thing you do again,
     so both are now derived from a remembered baseline and re-applying is
     idempotent. */
  if (prof.reachBonus || typeof side.reachBase === "number") {
    if (typeof side.reachBase !== "number") side.reachBase = typeof side.reach === "number" ? side.reach : 72;
    side.reach = side.reachBase + (prof.reachBonus || 0);
  }

  // Adjust head zone health if tri-zone modeling is active. The head zone
  // takes damage during a fight, so the previous multiplier is divided back
  // out rather than a raw baseline being restored.
  if (side.zones && typeof side.zones.head === "number") {
    const prevMul = side.weightHeadMul || 1;
    side.zones.head = Math.round((side.zones.head / prevMul) * prof.headHealthMul);
  }
  side.weightHeadMul = prof.headHealthMul;

  /* Record power, cardio and chin hooks for the battle resolver.
     weightPowerBonus  -> resolve.js, early strikes
     weightCardioMod   -> order.js, stamina cost after turn 6
     weightChinMod     -> resolve.js chinFactor(), the stun/knockdown path.
     The third one was written here and read nowhere, so the natural
     weight's "+20% stun defense" and the championship cut's "compromised
     chin" were both text on a card and nothing else. */
  side.weightPowerBonus = prof.earlyPowerBonus;
  side.weightCardioMod = prof.lateCardioPenalty;
  side.weightChinMod = prof.chinPenalty;

  return { ok: true, profile: prof };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    WEIGHT_CUT_PROFILES,
    WEIGHT_CUT_IDS,
    getWeightCutProfile,
    applyWeightCut,
  };
}
