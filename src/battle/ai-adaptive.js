/* =====================================================================
   Aqua Zero Heavens Arena - Adaptive Opponent AI & Habit Recognition
   Luminara Digital

   Monitors player behavioral tendencies in real-time during duels,
   evaluates spam and range patterns, and dynamically adapts CPU scoring
   weights to counter player strategies while preserving determinism and
   game balance.
   ===================================================================== */

const AdaptiveAI = (function() {
  function createTracker() {
    return {
      turns: 0,
      movesByClass: { STRIKE: 0, THROW: 0, SUB: 0, GUARD: 0, SETUP: 0 },
      movesByRange: { LONG: 0, MID: 0, CLINCH: 0, GROUND: 0 },
      rangeOccupancy: { LONG: 0, MID: 0, CLINCH: 0, GROUND: 0 },
      lowStamGuards: 0,
      lowStamAttacks: 0,
      tellsRespected: 0,
      tellsIgnored: 0,
      combos: { single: 0, chain2: 0, chain3: 0 },
      lastPlayerTech: null,
      history: [],
    };
  }

  function recordPlayerCommit(tracker, tech, d, tellTech) {
    if (!tracker || !tech) return;
    tracker.turns++;
    const cls = tech.cls || "STRIKE";
    tracker.movesByClass[cls] = (tracker.movesByClass[cls] || 0) + 1;

    const r = d ? d.range : (tech.range !== "ANY" ? tech.range : "MID");
    tracker.movesByRange[r] = (tracker.movesByRange[r] || 0) + 1;
    if (d && d.range) {
      tracker.rangeOccupancy[d.range] = (tracker.rangeOccupancy[d.range] || 0) + 1;
    }

    if (d && d.p && d.p.stam < (d.p.maxStam || 60) * 0.35) {
      if (cls === "GUARD") tracker.lowStamGuards++;
      else tracker.lowStamAttacks++;
    }

    if (tellTech && d) {
      // Did player counter the tell? (e.g., guarded against a heavy strike, or threw sprawl vs takedown)
      const isSprawl = tech.flags && tech.flags.indexOf("anti-takedown") >= 0;
      const isTakedown = tellTech.flags && tellTech.flags.indexOf("takedown") >= 0;
      if ((tellTech.cls === "STRIKE" && cls === "GUARD") || (isTakedown && isSprawl)) {
        tracker.tellsRespected++;
      } else {
        tracker.tellsIgnored++;
      }
    }

    tracker.lastPlayerTech = tech;
    tracker.history.push({
      turn: tracker.turns,
      id: tech.id,
      cls: cls,
      range: r,
      stam: d && d.p ? d.p.stam : 0,
      hp: d && d.p ? d.p.hp : 0,
    });
    if (tracker.history.length > 20) tracker.history.shift();
  }

  function recordPlayerCombo(tracker, length) {
    if (!tracker) return;
    if (length <= 1) tracker.combos.single++;
    else if (length === 2) tracker.combos.chain2++;
    else tracker.combos.chain3++;
  }

  function adaptWeights(baseWeights, tracker, opts) {
    if (!baseWeights) return null;
    const w = Object.assign({}, baseWeights);
    if (!tracker || tracker.turns < 2) return w;

    opts = opts || {};
    const intensity = opts.intensity !== undefined ? opts.intensity : 1.0;
    const totalMoves = Math.max(1, tracker.turns);

    // 1. Anti-Strike / Spam Adjustment
    const strikeRatio = (tracker.movesByClass.STRIKE || 0) / totalMoves;
    if (strikeRatio > 0.65) {
      w.guard = (w.guard || 1.0) * (1.0 + 0.25 * intensity);
      w.counterBonus = (w.counterBonus || 0) + Math.round(8 * intensity);
    }

    // 2. Anti-Grapple / Takedown Spurt
    const grappleRatio = ((tracker.movesByClass.THROW || 0) + (tracker.movesByClass.SUB || 0)) / totalMoves;
    if (grappleRatio > 0.45) {
      w.aggression = (w.aggression || 1.0) * (1.0 + 0.2 * intensity);
      w.closeIn = (w.closeIn || 0) - Math.round(6 * intensity); // keep distance
    }

    // 3. Low Stamina Guard Punish
    if (tracker.lowStamGuards >= 2) {
      // Player turtles when tired -> CPU grapples or saves air for big break
      w.sub = (w.sub || 1.0) * (1.0 + 0.3 * intensity);
      w.ground = (w.ground || 1.0) * (1.0 + 0.2 * intensity);
    }

    // 4. Heavy Combo Greed Punish
    const longChainRatio = (tracker.combos.chain3 || 0) / totalMoves;
    if (longChainRatio > 0.3) {
      w.counterBonus = (w.counterBonus || 0) + Math.round(6 * intensity);
      w.guard = (w.guard || 1.0) * (1.0 + 0.15 * intensity);
    }

    // 5. Range Habit Adaptation
    const longOccupancy = (tracker.rangeOccupancy.LONG || 0) / totalMoves;
    if (longOccupancy > 0.6 && w.closeIn !== undefined && w.closeIn >= 0) {
      w.closeIn = (w.closeIn || 0) + Math.round(8 * intensity);
    }

    // 6. Reduce execution noise for veteran adaptive bots
    if (opts.veteran && w.noise) {
      w.noise = Math.max(0.4, w.noise * 0.75);
    }

    return w;
  }

  function shouldFeint(side, tracker, difficulty, rnd) {
    if (difficulty < 2 || !tracker || tracker.turns < 3) return false;
    const R = rnd || Math.random;
    // Feint chance for high-level bots when player consistently counters tells
    const tellCounterRatio = (tracker.tellsRespected || 0) / Math.max(1, (tracker.tellsRespected + tracker.tellsIgnored));
    if (tellCounterRatio > 0.6 && R() < 0.22) {
      return true;
    }
    return false;
  }

  return {
    createTracker: createTracker,
    recordPlayerCommit: recordPlayerCommit,
    recordPlayerCombo: recordPlayerCombo,
    adaptWeights: adaptWeights,
    shouldFeint: shouldFeint,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = AdaptiveAI;
}
