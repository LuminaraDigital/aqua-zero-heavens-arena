/* =====================================================================
   Aqua Zero Heavens Arena - Combat Style Meter Engine
   Luminara Digital

   Evaluates turn-by-turn tactical flair, clean execution, counter reads,
   position control, and combo diversity.
   Grades: D (Dull) -> C (Clean) -> B (Brutal) -> A (Artistic) -> S (Supreme) -> SSS (Sensational).

   High style grades award purse bonuses, renown modifiers, and crowd hype.
   ===================================================================== */

const STYLE_RANKS = [
  { grade: "D", label: "DULL", min: 0, color: "#9ca3af", purseMul: 1.00, renownBonus: 0 },
  { grade: "C", label: "CLEAN", min: 300, color: "#22c3ee", purseMul: 1.05, renownBonus: 2 },
  { grade: "B", label: "BRUTAL", min: 750, color: "#10b981", purseMul: 1.12, renownBonus: 5 },
  { grade: "A", label: "ARTISTIC", min: 1300, color: "#f59e0b", purseMul: 1.20, renownBonus: 9 },
  { grade: "S", label: "SUPREME", min: 2000, color: "#e6392f", purseMul: 1.35, renownBonus: 14 },
  { grade: "SSS", label: "SENSATIONAL", min: 2800, color: "#ec4899", purseMul: 1.50, renownBonus: 20 },
];

const STYLE_TRIGGERS = {
  HIT_BASE: 80,
  COUNTER_HIT: 300,
  PARRY_GUARD: 250,
  PERFECT_GUARD: 200,
  STAMINA_BREAK: 280,
  SUBMISSION_LAND: 380,
  RANGE_SHIFT: 140,
  CORNER_REVERSAL: 350,
  CORNER_PRESSURE: 120,
  COMBO_3_HIT: 320,
  DESPERATION_HIT: 400,
  STALE_PENALTY: 120,
};

function DEF_STYLE_STATE() {
  return {
    score: 0,
    peakScore: 0,
    history: [],
    lastGrade: "D",
    techHistory: [],
    recentEvents: [],
  };
}

function styleGradeForScore(score) {
  const s = Math.max(0, Math.round(score || 0));
  let current = STYLE_RANKS[0];
  for (let i = 0; i < STYLE_RANKS.length; i++) {
    if (s >= STYLE_RANKS[i].min) current = STYLE_RANKS[i];
  }
  return current;
}

function styleProgressToNext(score) {
  const s = Math.max(0, Math.round(score || 0));
  const current = styleGradeForScore(s);
  const idx = STYLE_RANKS.indexOf(current);
  if (idx >= STYLE_RANKS.length - 1) return 1.0;
  const next = STYLE_RANKS[idx + 1];
  return Math.max(0, Math.min(1.0, (s - current.min) / (next.min - current.min)));
}

function evaluateStyleEvent(state, event, side, duel) {
  if (!state || !event) return { pointsAdded: 0, grade: "D", events: [] };
  if (!state.techHistory) state.techHistory = [];
  if (!state.recentEvents) state.recentEvents = [];

  let pts = 0;
  const evList = [];

  if (event.hit) {
    pts += STYLE_TRIGGERS.HIT_BASE;
    /* against the bar the damage landed on, not a flat number. `>= 35`
       was written when TECH_DMG_SCALE was 0.42 and fired on 0.00% of
       1,473 landed techniques at 0.37 - HEAVY IMPACT was dead content.
       The share is the one the reaction animation already uses for a
       stagger, so the meter cheers the shot the screen reacts to. */
    const target = (duel && duel.p && duel.e) ? (duel.p === side ? duel.e : duel.p) : side;
    const share = typeof dmgShare === "function" ? dmgShare(target, event.dmg)
      : (event.dmg || 0) / (((target && target.maxhp) || 100));
    const heavy = typeof STAGGER_SHARE === "number" ? STAGGER_SHARE : 0.26;
    if (share >= heavy) {
      pts += 100;
      evList.push("HEAVY IMPACT");
    }
  }

  if (event.counter) {
    pts += STYLE_TRIGGERS.COUNTER_HIT;
    evList.push("COUNTER INTERCEPTION");
  }

  if (event.guarded) {
    pts += STYLE_TRIGGERS.PARRY_GUARD;
    evList.push("TACTICAL GUARD");
  }

  if (event.reversal) {
    pts += STYLE_TRIGGERS.CORNER_REVERSAL;
    evList.push("CORNER REVERSAL");
  }

  if (event.rangeTo) {
    pts += STYLE_TRIGGERS.RANGE_SHIFT;
    evList.push("RANGE CONTROL");
  }

  if (event.launcher) {
    pts += STYLE_TRIGGERS.COMBO_3_HIT;
    evList.push("LAUNCHER SEQUENCE");
  }

  if (event.tech && event.tech.cls === "SUB" && event.hit) {
    pts += STYLE_TRIGGERS.SUBMISSION_LAND;
    evList.push("SUBMISSION WORK");
  }

  // Desperation bonus (<20% HP)
  if (side && side.hp && side.maxhp && (side.hp / side.maxhp) <= 0.20 && event.hit) {
    pts += STYLE_TRIGGERS.DESPERATION_HIT;
    evList.push("DESPERATION RUSH");
  }

  // Stale move penalty check
  if (event.tech && event.tech.id) {
    state.techHistory.push(event.tech.id);
    if (state.techHistory.length > 6) state.techHistory.shift();

    let repeatCount = 0;
    for (let i = state.techHistory.length - 1; i >= 0; i--) {
      if (state.techHistory[i] === event.tech.id) repeatCount++;
    }
    if (repeatCount >= 3) {
      pts = Math.max(0, pts - STYLE_TRIGGERS.STALE_PENALTY);
      evList.push("STALE MOVE");
    }
  }

  // Natural Turn Decay
  state.score = Math.max(0, Math.round(state.score * 0.90 + pts));
  if (state.score > state.peakScore) state.peakScore = state.score;

  const currentRank = styleGradeForScore(state.score);
  state.lastGrade = currentRank.grade;
  state.recentEvents = evList;

  return {
    pointsAdded: pts,
    score: state.score,
    grade: currentRank.grade,
    label: currentRank.label,
    color: currentRank.color,
    events: evList,
    progress: styleProgressToNext(state.score),
  };
}

const StyleMeter = {
  STYLE_RANKS,
  STYLE_TRIGGERS,
  DEF_STYLE_STATE,
  styleGradeForScore,
  styleProgressToNext,
  evaluateStyleEvent,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = StyleMeter;
}
