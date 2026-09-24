/* =====================================================================
   Aqua Zero Heavens Arena - clinch and ground ownership
   Luminara Digital

   Range says how far apart they are. Position says where in the ring.
   Control says who owns the clinch or the top. Ownership never swaps
   silently: a pummel, reversal, sweep, or range break has to earn it.

     d.clinchController  "p" | "e" | null
     d.groundTop         "p" | "e" | null
     d.groundBottom      "p" | "e" | null

   Inspired by living-world MMA sims; reimplemented for this card duel.
   ===================================================================== */

function resetControl(d) {
  if (!d) return;
  d.clinchController = null;
  d.groundTop = null;
  d.groundBottom = null;
}

function sideKey(d, side) {
  if (!d || !side) return null;
  if (side === d.p) return "p";
  if (side === d.e) return "e";
  return null;
}

function assignClinchControl(d, side) {
  if (!d) return false;
  const key = sideKey(d, side);
  if (!key) return false;
  d.clinchController = key;
  d.groundTop = null;
  d.groundBottom = null;
  return true;
}

function assignGroundControl(d, topSide) {
  if (!d) return false;
  const top = sideKey(d, topSide);
  if (!top) return false;
  d.groundTop = top;
  d.groundBottom = top === "p" ? "e" : "p";
  d.clinchController = null;
  return true;
}

function clearClinchControl(d) {
  if (!d) return;
  d.clinchController = null;
}

function clearGroundControl(d) {
  if (!d) return;
  d.groundTop = null;
  d.groundBottom = null;
}

function clearControl(d) {
  resetControl(d);
}

/* Called after a range change. Closing into CLINCH awards the entrant.
   Completing a takedown onto GROUND awards top. Leaving either clears. */
function syncControlOnRange(d, fromRange, toRange, entrant) {
  if (!d || !toRange) return;
  if (toRange === "CLINCH" && fromRange !== "CLINCH") {
    if (entrant) assignClinchControl(d, entrant);
    return;
  }
  if (toRange === "GROUND" && fromRange !== "GROUND") {
    if (entrant) assignGroundControl(d, entrant);
    return;
  }
  if (fromRange === "CLINCH" && toRange !== "CLINCH") clearClinchControl(d);
  if (fromRange === "GROUND" && toRange !== "GROUND") {
    clearGroundControl(d);
    if (d.subStage) {
      d.subStage = 0;
      d.subAttacker = null;
      d.subDefender = null;
      d.subTech = null;
    }
  }
}

/* Reversal / sweep: trapped or bottom fighter takes ownership. */
function reverseControl(d, side) {
  if (!d) return false;
  const key = sideKey(d, side);
  if (!key) return false;
  if (d.range === "CLINCH") {
    if (d.clinchController && d.clinchController !== key) {
      d.clinchController = key;
      return true;
    }
    return assignClinchControl(d, side);
  }
  if (d.range === "GROUND") {
    if (d.groundBottom === key) {
      assignGroundControl(d, side);
      return true;
    }
  }
  return false;
}

function isClinchController(d, side) {
  return !!(d && sideKey(d, side) && d.clinchController === sideKey(d, side));
}

function isGroundTop(d, side) {
  return !!(d && sideKey(d, side) && d.groundTop === sideKey(d, side));
}

function isGroundBottom(d, side) {
  return !!(d && sideKey(d, side) && d.groundBottom === sideKey(d, side));
}

/* Modest ownership swing: controller gets room to work, trapped side pays.
   `escape` is charged only on techniques flagged `escape`, on top of the
   ground clock ramp in resolve.js. It used to be 0.80 on the bottom, which
   cancelled most of that ramp and left GROUND eating 44% of all turns
   against a 25-35% band: being on the bottom should cost you offence, not
   your way out. Control still owns the exchange; it no longer owns the exit. */
function controlModsFor(d, side) {
  const neutral = { pow: 1, acc: 1, escape: 1 };
  if (!d || !side) return neutral;
  if (d.range === "CLINCH") {
    if (isClinchController(d, side)) return { pow: 1.08, acc: 1.04, escape: 1 };
    if (d.clinchController) return { pow: 0.94, acc: 0.96, escape: 0.92 };
  }
  if (d.range === "GROUND") {
    if (isGroundTop(d, side)) return { pow: 1.10, acc: 1.05, escape: 1 };
    if (isGroundBottom(d, side)) return { pow: 0.92, acc: 0.94, escape: 0.90 };
  }
  return neutral;
}

function controlSnapshot(d) {
  return {
    clinchController: (d && d.clinchController) || null,
    groundTop: (d && d.groundTop) || null,
    groundBottom: (d && d.groundBottom) || null,
  };
}

/* No describeControl() here on purpose. It built an announcer line from a
   roster FIRST NAME - "MIKE ON TOP" - and had no caller anywhere: the HUD
   prints describePosition() and reads the control state out of
   controlSnapshot(). Reviving it would mean reintroducing exactly the
   first-name guess the commentary emits were just fixed to stop making.
   Deleted with its only helper, sideFromKey(). */
