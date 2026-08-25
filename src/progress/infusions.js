/* =====================================================================
   Aqua Zero Heavens Arena - Technique Infusion Seals
   Luminara Digital

   Allows players to forge elemental / tactical seals onto individual cards
   in their deck at the Gym or via high-stakes bounties.
   Creates emergent build synergies and game-breaking deck combos.
   ===================================================================== */

const SEALS = {
  SEAL_LIGHTNING: {
    id: "SEAL_LIGHTNING",
    name: "Lightning Seal",
    desc: "-25% stamina cost and +15 speed priority",
    tag: "TEMPO",
    price: 65,
    color: "#22d3ee",
    stamMul: 0.75,
    spdBoost: 15,
  },
  SEAL_HEAVY: {
    id: "SEAL_HEAVY",
    name: "Heavy Breaker Seal",
    desc: "+25% power and ignores 50% of guard mitigation",
    tag: "BREAKER",
    price: 75,
    color: "#f59e0b",
    powMul: 1.25,
    guardPen: 0.50,
  },
  SEAL_VIPER: {
    id: "SEAL_VIPER",
    name: "Viper Venom Seal",
    desc: "Inflicts bleeding on hit (75% chance)",
    tag: "STATUS",
    price: 70,
    color: "#10b981",
    statusEffect: "BLEEDING",
    statusChance: 75,
  },
  SEAL_VAMPIRE: {
    id: "SEAL_VAMPIRE",
    name: "Vampiric Leech Seal",
    desc: "Siphons 25% of unmitigated damage dealt as health",
    tag: "SUSTAIN",
    price: 85,
    color: "#ec4899",
    leechRatio: 0.25,
  },
  SEAL_COUNTER: {
    id: "SEAL_COUNTER",
    name: "Counter Specialist Seal",
    desc: "+45% damage when thrown as a predictive counter",
    tag: "PRECISION",
    price: 70,
    color: "#e6392f",
    counterMul: 1.45,
  },
  SEAL_FLOW: {
    id: "SEAL_FLOW",
    name: "Wind Flow Seal",
    desc: "+12 accuracy and refunds 10 stamina on clean contact",
    tag: "FLOW",
    price: 60,
    color: "#a855f7",
    accBoost: 12,
    stamRefund: 10,
  },
};

const SEAL_IDS = Object.keys(SEALS);

function getTechSeal(runOrSide, techId) {
  if (!runOrSide || !techId) return null;
  const seals = runOrSide.seals || (runOrSide.run && runOrSide.run.seals) || {};
  const sealId = seals[techId];
  return sealId && SEALS[sealId] ? SEALS[sealId] : null;
}

function applySealToTech(run, techId, sealId) {
  if (!run || !techId || !sealId) return false;
  if (!SEALS[sealId]) return false;
  const techMap = (typeof TECH !== "undefined" && TECH) || (typeof global !== "undefined" && global.TECH);
  if (techMap && !techMap[techId]) return false;
  if (!run.seals) run.seals = {};
  run.seals[techId] = sealId;
  return true;
}

function removeSealFromTech(run, techId) {
  if (!run || !run.seals || !run.seals[techId]) return false;
  delete run.seals[techId];
  return true;
}

function sealCandidates(run) {
  if (!run) return [];
  const list = typeof draftMovelist === "function" ? draftMovelist(run) : [];
  const retired = run.retired || [];
  const techMap = (typeof TECH !== "undefined" && TECH) || (typeof global !== "undefined" && global.TECH);
  return list.filter((id) => retired.indexOf(id) < 0 && (!techMap || techMap[id]));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SEALS,
    SEAL_IDS,
    getTechSeal,
    applySealToTech,
    removeSealFromTech,
    sealCandidates,
  };
}
