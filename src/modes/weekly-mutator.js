/* =====================================================================
   Aqua Zero Heavens Arena - Weekly Seeded Mutator Arena
   Luminara Digital

   Deterministic weekly rotating tournament rulesets.
   Provides unique global competitive conditions that refresh every Monday.
   ===================================================================== */

const WEEKLY_MUTATORS = [
  {
    id: "GLASS_CANNON",
    name: "Glass Cannon Arena",
    tag: "HIGH LETHALITY",
    desc: "Damage dealt & taken is increased by 250%. Maximum HP is halved.",
    color: "#e6392f",
    powMul: 2.5,
    hpMul: 0.5,
    stamMul: 1.0,
  },
  {
    id: "MAT_WARFARE",
    name: "Submissions & Mat Warfare",
    tag: "GRAPPLING ONLY",
    desc: "Bouts begin on the Ground. Submissions deal +60% damage; standing strikes deal -70%.",
    color: "#10b981",
    subMul: 1.6,
    strikeMul: 0.3,
    startRange: "GROUND",
  },
  {
    id: "TURBO_BLITZ",
    name: "Hypersonic Blitz",
    tag: "HYPER SPEED",
    desc: "Double stamina regeneration, and all technique speeds +20.",
    color: "#22d3ee",
    spdBoost: 20,
    stamRegenMul: 2.0,
  },
  {
    id: "TITAN_ARMOR",
    name: "Iron Juggernauts",
    tag: "SUPER HEAVY",
    desc: "+40% Maximum HP and 25% global defense mitigation.",
    color: "#f59e0b",
    hpMul: 1.4,
    defMul: 1.25,
  },
  {
    id: "COUNTER_KINGS",
    name: "Counter Specialists",
    tag: "READ & REACT",
    desc: "Parries and Counter-hits inflict 300% reflection damage.",
    color: "#ec4899",
    counterMul: 3.0,
  },
];

function getWeekNumber(date) {
  const d = date ? new Date(date) : new Date();
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

// The ISO week-year is the year that owns this ISO week's Thursday. It differs
// from the calendar year for the days of a Mon-Sun week that straddle Jan 1, so
// it must be used for the seed - otherwise the mutator would flip mid-week every
// New Year (e.g. Mon 2025-12-29 and Thu 2026-01-01 are the same ISO week but
// different calendar years), breaking the "same for everyone all week" guarantee.
function getIsoWeekYear(date) {
  const d = date ? new Date(date) : new Date();
  const thursday = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - dayNr + 3);
  return thursday.getUTCFullYear();
}

function getWeeklyMutator(optDate) {
  const d = optDate ? new Date(optDate) : new Date();
  const year = getIsoWeekYear(d);
  const week = getWeekNumber(d);
  const idx = Math.abs((year * 52 + week) % WEEKLY_MUTATORS.length);
  const mutator = WEEKLY_MUTATORS[idx];
  return {
    year: year,
    week: week,
    mutator: mutator,
    id: mutator.id,
    name: mutator.name,
    desc: mutator.desc,
    tag: mutator.tag,
    color: mutator.color,
  };
}

const WeeklyMutator = {
  WEEKLY_MUTATORS,
  getWeekNumber,
  getWeeklyMutator,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WeeklyMutator;
}
