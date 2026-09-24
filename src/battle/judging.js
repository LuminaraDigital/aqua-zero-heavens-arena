/* =====================================================================
   Aqua Zero Heavens Arena - 10-Point Must 3-Judge Scoring Engine
   Luminara Digital

   Implements official Unified Rules of MMA judging criteria across three
   autonomous judges with distinct scoring profiles:
     1. Judge Miller  (Impact Priority)  - heavy damage, knockdowns, deep subs
     2. Judge Sato    (Control Priority) - mat control, takedowns, cage pins
     3. Judge Gomez   (Volume Priority)  - significant strikes, activity
   ===================================================================== */
"use strict";

const JUDGES = [
  {
    id: "impact",
    name: "Judge Miller",
    philosophy: "Effective Striking & Grappling Impact",
    weights: { damage: 0.50, threats: 0.30, control: 0.10, volume: 0.10 },
  },
  {
    id: "control",
    name: "Judge Sato",
    philosophy: "Octagon & Mat Control / Takedowns",
    weights: { damage: 0.25, threats: 0.15, control: 0.45, volume: 0.15 },
  },
  {
    id: "volume",
    name: "Judge Gomez",
    philosophy: "Striking Activity & Volume",
    weights: { damage: 0.30, threats: 0.10, control: 0.15, volume: 0.45 },
  },
];

/**
 * Normalizes and scores a single round's telemetry for a given judge.
 * @param {Object} roundStats - { p: {...}, e: {...} }
 * @param {string|Object} judge - Judge ID or Judge object
 * @returns {Object} { judgeId, judgeName, scoreP, scoreE, winner, dominant, rationale }
 */
function scoreRound(roundStats, judge) {
  const j = typeof judge === "object" ? judge : (JUDGES.find((x) => x.id === judge) || JUDGES[0]);
  const p = (roundStats && roundStats.p) || {};
  const e = (roundStats && roundStats.e) || {};
  const w = j.weights;

  // Impact: damage dealt + cut damage
  const pDamage = (p.dmgDealt || 0) + ((p.cutDealt || 0) * 0.5);
  const eDamage = (e.dmgDealt || 0) + ((e.cutDealt || 0) * 0.5);

  // Stoppage threats: rockeds, deep subs, knockdowns
  const pThreats = ((p.rockeds || 0) * 20) + ((p.subsLocked || 0) * 18) + ((p.knockdowns || 0) * 25);
  const eThreats = ((e.rockeds || 0) * 20) + ((e.subsLocked || 0) * 18) + ((e.knockdowns || 0) * 25);

  // Control: top control seconds, takedowns, wall pins
  const pControl = ((p.controlSec || 0) * 0.5) + ((p.takedowns || 0) * 12) + ((p.wallPins || 0) * 8);
  const eControl = ((e.controlSec || 0) * 0.5) + ((e.takedowns || 0) * 12) + ((e.wallPins || 0) * 8);

  // Volume: total landed strikes
  const pVolume = (p.strikes || 0) * 2.5 + ((p.combos || 0) * 4);
  const eVolume = (e.strikes || 0) * 2.5 + ((e.combos || 0) * 4);

  // Calculate weighted round rating
  const pRating = (pDamage * w.damage) + (pThreats * w.threats) + (pControl * w.control) + (pVolume * w.volume);
  const eRating = (eDamage * w.damage) + (eThreats * w.threats) + (eControl * w.control) + (eVolume * w.volume);

  let scoreP = 10;
  let scoreE = 9;
  let winner = "p";
  let dominant = false;
  let rationale = "";

  const diff = Math.abs(pRating - eRating);
  const maxR = Math.max(1, Math.max(pRating, eRating));
  const ratio = maxR / Math.max(1, Math.min(pRating, eRating));

  if (diff < 1.5 && ratio < 1.05) {
    scoreP = 10;
    scoreE = 10;
    winner = "draw";
    rationale = "Evenly contested round";
  } else if (pRating >= eRating) {
    winner = "p";
    // Check 10-8 dominance criteria: heavy damage lead or multiple stoppage threats
    if ((pRating >= eRating * 2.1 && pThreats > 0) || (pThreats >= 40 && eThreats === 0)) {
      scoreP = 10;
      scoreE = 8;
      dominant = true;
      rationale = "Dominant round for Player with significant stoppage danger";
    } else {
      scoreP = 10;
      scoreE = 9;
      rationale = "Player edged round on " + j.philosophy;
    }
  } else {
    winner = "e";
    if ((eRating >= pRating * 2.1 && eThreats > 0) || (eThreats >= 40 && pThreats === 0)) {
      scoreP = 8;
      scoreE = 10;
      dominant = true;
      rationale = "Dominant round for Opponent with significant stoppage danger";
    } else {
      scoreP = 9;
      scoreE = 10;
      rationale = "Opponent edged round on " + j.philosophy;
    }
  }

  return {
    judgeId: j.id,
    judgeName: j.name,
    scoreP,
    scoreE,
    winner,
    dominant,
    rationale,
    ratings: { p: Math.round(pRating * 10) / 10, e: Math.round(eRating * 10) / 10 },
  };
}

/**
 * Evaluates a round across all three judges simultaneously.
 */
function scoreRoundAllJudges(roundStats, roundNum) {
  return JUDGES.map((judge) => {
    const res = scoreRound(roundStats, judge);
    return Object.assign({ round: roundNum || 1 }, res);
  });
}

/**
 * Aggregates a series of round scores into an official 3-judge decision.
 * @param {Array} scorecards - Array of round score arrays or flattened judge cards
 * @returns {Object} Decision breakdown
 */
function evaluateDecision(scorecards) {
  const cards = {
    impact: { p: 0, e: 0, judge: "Judge Miller" },
    control: { p: 0, e: 0, judge: "Judge Sato" },
    volume: { p: 0, e: 0, judge: "Judge Gomez" },
  };

  const flat = Array.isArray(scorecards) ? scorecards.flat() : [];
  flat.forEach((sc) => {
    if (sc && cards[sc.judgeId]) {
      cards[sc.judgeId].p += sc.scoreP || 0;
      cards[sc.judgeId].e += sc.scoreE || 0;
    }
  });

  const totals = Object.keys(cards).map((k) => {
    const c = cards[k];
    let win = "draw";
    if (c.p > c.e) win = "p";
    else if (c.e > c.p) win = "e";
    return { id: k, judge: c.judge, p: c.p, e: c.e, win, text: c.p + "-" + c.e };
  });

  const pWins = totals.filter((t) => t.win === "p").length;
  const eWins = totals.filter((t) => t.win === "e").length;
  const draws = totals.filter((t) => t.win === "draw").length;

  let overallWinner = "draw";
  let decisionType = "DRAW";
  let summary = "";

  const scoreText = totals.map((t) => t.text).join(", ");

  if (pWins === 3) {
    overallWinner = "p";
    decisionType = "UNANIMOUS";
    summary = "Unanimous Decision (" + scoreText + ")";
  } else if (eWins === 3) {
    overallWinner = "e";
    decisionType = "UNANIMOUS";
    summary = "Unanimous Decision (" + scoreText + ")";
  } else if (pWins === 2 && eWins === 1) {
    overallWinner = "p";
    decisionType = "SPLIT";
    summary = "Split Decision (" + scoreText + ")";
  } else if (eWins === 2 && pWins === 1) {
    overallWinner = "e";
    decisionType = "SPLIT";
    summary = "Split Decision (" + scoreText + ")";
  } else if (pWins === 2 && draws === 1) {
    overallWinner = "p";
    decisionType = "MAJORITY";
    summary = "Majority Decision (" + scoreText + ")";
  } else if (eWins === 2 && draws === 1) {
    overallWinner = "e";
    decisionType = "MAJORITY";
    summary = "Majority Decision (" + scoreText + ")";
  } else if (draws >= 2 || (pWins === 1 && eWins === 1 && draws === 1)) {
    overallWinner = "draw";
    decisionType = "DRAW";
    summary = "Majority Draw (" + scoreText + ")";
  } else {
    overallWinner = "draw";
    decisionType = "DRAW";
    summary = "Split Draw (" + scoreText + ")";
  }

  return {
    winner: overallWinner,
    type: decisionType,
    summary,
    judges: totals,
  };
}

/**
 * Returns cornerman urgency if a fighter is currently trailing on 2+ scorecards.
 */
function cornerUrgencyPrompt(scorecards, sideKey) {
  const checkSide = sideKey || "p";
  const oppSide = checkSide === "p" ? "e" : "p";
  const dec = evaluateDecision(scorecards);

  let trailingCards = 0;
  dec.judges.forEach((j) => {
    if (j[oppSide] > j[checkSide]) trailingCards++;
  });

  if (trailingCards >= 2) {
    return {
      urgent: true,
      cardsDown: trailingCards,
      prompt: "Corner Alert: You are trailing on " + trailingCards + " of 3 judge scorecards! You need a stoppage to win this fight!",
    };
  }

  return {
    urgent: false,
    cardsDown: trailingCards,
    prompt: "Corner: Fighting ahead on the cards. Stay composed and protect your lead.",
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    JUDGES,
    scoreRound,
    scoreRoundAllJudges,
    evaluateDecision,
    cornerUrgencyPrompt,
  };
}
