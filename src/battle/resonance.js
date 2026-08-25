/* =====================================================================
   Aqua Zero Heavens Arena - Martial Arts Discipline Resonance
   Luminara Digital

   Emergent dual-discipline synergy perks activated when holding 3+
   techniques from complementary martial arts in an active deck.
   ===================================================================== */

const RESONANCE_PAIRS = [
  {
    id: "DIRTY_BOXING",
    name: "Dirty Boxing",
    discs: ["boxing", "judo"],
    desc: "+15% power in Clinch, strikes cost 2 less stamina in Clinch",
    color: "#f59e0b",
    check: (counts) => (counts.boxing || 0) >= 3 && (counts.judo || 0) >= 3,
  },
  {
    id: "OCTAGON_PREDATOR",
    name: "Octagon Predator",
    discs: ["muaythai", "bjj"],
    desc: "Takedowns deal 12 blunt impact damage upon establishing ground control",
    color: "#10b981",
    check: (counts) => (counts.muaythai || 0) >= 3 && (counts.bjj || 0) >= 3,
  },
  {
    id: "STRIKERS_HORIZON",
    name: "Striker's Horizon",
    discs: ["taekwondo", "karate"],
    desc: "Long-range kicks gain +10 accuracy and +20% corner pressure",
    color: "#22d3ee",
    check: (counts) => (counts.taekwondo || 0) >= 3 && (counts.karate || 0) >= 3,
  },
  {
    id: "IRON_FORTRESS",
    name: "Iron Mat Fortress",
    discs: ["sambo", "wrestling"],
    desc: "+20% defense when grounded or tied up in the Clinch",
    color: "#8b5cf6",
    check: (counts) => (counts.sambo || 0) >= 3 && (counts.wrestling || 0) >= 3,
  },
  {
    id: "RAPID_FLURRY",
    name: "Rapid Flurry",
    discs: ["kickboxing", "wingchun"],
    desc: "Fast combo strikes gain +8 speed and +10 accuracy",
    color: "#ec4899",
    check: (counts) => (counts.kickboxing || 0) >= 3 && (counts.wingchun || 0) >= 3,
  },
  {
    id: "RUTHLESS_COMBAT",
    name: "Ruthless Execution",
    discs: ["kravmaga", "lethwei"],
    desc: "+25% damage against opponents suffering from Bleed, Stun or Winded",
    color: "#e6392f",
    check: (counts) => (counts.kravmaga || 0) >= 3 && (counts.lethwei || 0) >= 3,
  },
];

function countDeckDisciplines(techIds) {
  const counts = {};
  const techMap = (typeof TECH !== "undefined" && TECH) || (typeof global !== "undefined" && global.TECH);
  if (!Array.isArray(techIds) || !techMap) return counts;
  for (let i = 0; i < techIds.length; i++) {
    const t = techMap[techIds[i]];
    if (t && t.disc) {
      counts[t.disc] = (counts[t.disc] || 0) + 1;
    }
  }
  return counts;
}

function getActiveResonances(techIds) {
  const counts = countDeckDisciplines(techIds);
  const active = [];
  for (let i = 0; i < RESONANCE_PAIRS.length; i++) {
    const pair = RESONANCE_PAIRS[i];
    if (pair.check(counts)) {
      active.push(pair);
    }
  }
  return active;
}

function hasResonance(techIds, pairId) {
  const active = getActiveResonances(techIds);
  for (let i = 0; i < active.length; i++) {
    if (active[i].id === pairId) return true;
  }
  return false;
}

const Resonance = {
  RESONANCE_PAIRS,
  countDeckDisciplines,
  getActiveResonances,
  hasResonance,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Resonance;
}
