/* =====================================================================
   Aqua Zero Heavens Arena - Cornerman & Cutman Protocol
   Luminara Digital

   Simulates realistic 60-second between-round corner allocations:
     - Cold Enswell Iron for facial swelling & vision occlusion
     - Adrenaline / Vaseline Coagulant for cut sealing & bleeding stoppage
     - Coach Tactical Read for mid-fight scouting adjustments
     - Ice Sponge & Deep Breathing for cardio recovery
   ===================================================================== */
"use strict";

const CORNER_ACTIONS = {
  ENSWELL: {
    id: "ENSWELL",
    name: "Cold Enswell Iron",
    desc: "Compress periorbital hematomas, reducing eye swelling by 40 points and restoring vision",
    cost: 1, // 1 action token
  },
  COAGULANT: {
    id: "COAGULANT",
    name: "Adrenaline & Vaseline Cut Seal",
    desc: "Cauterize facial lacerations, reducing cuts by 40 points and clearing active BLEEDING",
    cost: 1,
  },
  COACH_READ: {
    id: "COACH_READ",
    name: "Coach Tactical Read",
    desc: "Scout opponent's dominant archetype habits: +20% counter bonus and +10% evasion next round",
    cost: 1,
  },
  ICE_STAMINA: {
    id: "ICE_STAMINA",
    name: "Ice Sponge & Deep Breathing",
    desc: "Rapid cooling and diaphragmatic recovery: restores +25 stamina and clears WINDED",
    cost: 1,
  },
};

const CORNER_ACTION_IDS = Object.keys(CORNER_ACTIONS);

/* ---------------------------------------------------------------------
   TWO SHAPES OF FIGHTER, ONE CUTMAN.

   This module was written against a side that carries `cuts`, `stamina`
   and `maxStamina` as plain numbers. The engine's side does not: mkSide
   and effects.js carry `cuts: {amount, max}` and `stam` / `maxStam`. So
   handed a real duel side the cutman read every cut as 0 (the doctor
   never intervened), COAGULANT replaced the whole `{amount: 80}` object
   with the number 0 - a silent full heal instead of the 40 points on the
   card - and ICE_STAMINA wrote `side.stamina`, a field nothing in the
   engine reads, so the sponge did nothing at all.

   The module is shelved (docs/IMPLEMENTATION_PLAN.md item E) because no
   menu reaches it, which is exactly why this had to be fixed rather than
   left: a shelved module whose contract is wrong is a trap for whoever
   un-shelves it. These four accessors read and write whichever shape they
   are handed, so both contracts hold and the card's promises are the same
   forty points either way.
   --------------------------------------------------------------------- */
function cutAmountOf(side) {
  if (!side) return 0;
  const c = side.cuts;
  if (c && typeof c === "object") return typeof c.amount === "number" ? c.amount : 0;
  return typeof c === "number" ? c : 0;
}
function setCutAmount(side, n) {
  const c = side.cuts;
  if (c && typeof c === "object") {
    const max = typeof c.max === "number" ? c.max : 100;
    c.amount = Math.max(0, Math.min(max, n));
    return c.amount;
  }
  side.cuts = Math.max(0, n);
  return side.cuts;
}
/* a live duel side keeps its tank in `stam`; this module's own contract
   calls it `stamina`. Whichever the side already has is the one written. */
function stamKeysOf(side) {
  return (side && typeof side.stam === "number")
    ? { cur: "stam", max: "maxStam" }
    : { cur: "stamina", max: "maxStamina" };
}
function stamOf(side) {
  const k = stamKeysOf(side);
  return (side && side[k.cur]) || 0;
}

/**
 * Returns current physiological corner status of a fighter.
 */
function getCornerStatus(side) {
  if (!side) return null;
  const swelling = typeof side.swelling === "number" ? side.swelling : 0;
  const cuts = cutAmountOf(side);
  const eyeOccluded = swelling >= 75 || !!(side.cond && side.cond.SWELLING_BLIND);
  const doctorStoppageRisk = cuts >= 75;

  return {
    swelling,
    cuts,
    eyeOccluded,
    doctorStoppageRisk,
    stamina: stamOf(side),
    hasBleeding: !!(side.cond && side.cond.BLEEDING),
    hasWinded: !!(side.cond && side.cond.WINDED),
    coachReadActive: !!side.coachRead,
  };
}

/**
 * Applies a selected corner action to the fighter.
 * @param {Object} side - Fighter combat state side
 * @param {string} actionId - ENSWELL | COAGULANT | COACH_READ | ICE_STAMINA
 * @param {Object} [duel] - Active duel reference
 * @returns {Object} { ok: boolean, note: string, actionId: string }
 */
function applyCornerAction(side, actionId, duel) {
  if (!side) return { ok: false, note: "Invalid corner participant" };
  const action = CORNER_ACTIONS[actionId];
  if (!action) return { ok: false, note: "Unknown corner action: " + actionId };

  if (typeof side.swelling !== "number") side.swelling = 0;
  /* NOT `if (typeof side.cuts !== "number") side.cuts = 0`. That line is
     how the coagulant used to full-heal a live fighter: it saw the
     engine's {amount, max} object, decided it was not a cut, and replaced
     it with zero before the action had even run. */

  switch (actionId) {
    case "ENSWELL": {
      const prev = side.swelling;
      side.swelling = Math.max(0, side.swelling - 40);
      if (side.cond && side.cond.SWELLING_BLIND) {
        delete side.cond.SWELLING_BLIND;
      }
      return {
        ok: true,
        actionId,
        note: "Enswell applied: swelling reduced from " + prev + "% to " + side.swelling + "%. Vision cleared.",
      };
    }

    case "COAGULANT": {
      const prevCuts = cutAmountOf(side);
      const nowCuts = setCutAmount(side, prevCuts - 40);
      if (side.cond && (side.cond.BLEEDING || side.cond.BLEED)) {
        delete side.cond.BLEEDING;
        delete side.cond.BLEED;
      }
      return {
        ok: true,
        actionId,
        note: "Adrenaline & Vaseline sealed cuts from " + prevCuts + "% to " + nowCuts + "%. Bleeding halted.",
      };
    }

    case "COACH_READ": {
      side.coachRead = true;
      side.coachReadBonus = 0.20; // +20% counter bonus
      side.coachEvasionBonus = 0.10; // +10% evasion
      return {
        ok: true,
        actionId,
        note: "Coach read locked in: tactical counter adjustments active for the next round.",
      };
    }

    case "ICE_STAMINA": {
      const k = stamKeysOf(side);
      const maxStam = side[k.max] || 100;
      const prevStam = side[k.cur] || 0;
      side[k.cur] = Math.min(maxStam, prevStam + 25);
      if (side.cond && side.cond.WINDED) {
        delete side.cond.WINDED;
      }
      return {
        ok: true,
        actionId,
        note: "Ice sponge applied: stamina restored from " + prevStam + " to " + side[k.cur] + ". Cardio refreshed.",
      };
    }

    default:
      return { ok: false, note: "Unhandled corner action" };
  }
}

/**
 * Checks if severe untreated facial lacerations trigger an official ringside doctor check.
 */
function checkDoctorStoppage(side) {
  if (!side) return { stoppage: false, warning: false };
  const cuts = cutAmountOf(side);

  if (cuts >= 95) {
    return {
      stoppage: true,
      warning: true,
      reason: "Ringside physician stops the bout due to catastrophic facial laceration.",
    };
  }
  if (cuts >= 75) {
    return {
      stoppage: false,
      warning: true,
      reason: "Referee calls in the ringside physician to inspect severe cut above the eyebrow.",
    };
  }
  return { stoppage: false, warning: false };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CORNER_ACTIONS,
    CORNER_ACTION_IDS,
    getCornerStatus,
    applyCornerAction,
    checkDoctorStoppage,
  };
}
