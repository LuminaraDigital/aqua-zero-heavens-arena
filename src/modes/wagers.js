/* =====================================================================
   Aqua Zero Heavens Arena - Underworld Wagers & Pre-Bout Bounties
   Luminara Digital

   High-stakes optional contracts accepted before entering the ring.
   Pushes players out of comfort zones in exchange for lucrative payouts.
   ===================================================================== */

const BOUNTY_TEMPLATES = [
  {
    id: "NO_GUARD",
    title: "Reckless Aggression",
    desc: "Win the bout without selecting Guard a single time",
    purseMul: 1.25,
    renownReward: 12,
    check: (st) => st.win && (st.guards || 0) === 0,
  },
  {
    id: "FAST_KO",
    title: "5-Turn Blitz",
    desc: "Achieve victory within 5 turns or fewer",
    purseMul: 1.50,
    renownReward: 15,
    sealReward: "SEAL_LIGHTNING",
    check: (st) => st.win && (st.turns || 99) <= 5,
  },
  {
    id: "SUBMISSION_ONLY",
    title: "Tap-Out Bounty",
    desc: "Finish the fight decisively with a Submission",
    purseMul: 1.40,
    renownReward: 14,
    sealReward: "SEAL_VIPER",
    check: (st) => st.win && st.koClass === "SUB",
  },
  {
    id: "HIGH_STYLE",
    title: "Sensational Showman",
    desc: "Finish the fight holding an 'A' Style Grade or higher",
    purseMul: 1.35,
    renownReward: 10,
    check: (st, style) => st.win && style && (style.grade === "A" || style.grade === "S" || style.grade === "SSS"),
  },
  {
    id: "FLAWLESS_AIR",
    title: "Iron Conditioning",
    desc: "Win without ever running out of stamina (no Winded status)",
    purseMul: 1.20,
    renownReward: 8,
    check: (st) => st.win && !(st.conds && st.conds.WINDED),
  },
];

function generateBountiesForFight(seed) {
  const s = seed || Math.floor(Math.random() * 10000);
  const shuffled = BOUNTY_TEMPLATES.slice().sort((a, b) => {
    const ha = ((s * 31 + a.id.charCodeAt(0)) % 100);
    const hb = ((s * 31 + b.id.charCodeAt(0)) % 100);
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

function evaluateBountyResult(bounty, duelStats, styleState) {
  if (!bounty || !duelStats) return { ok: false, payout: 0, renown: 0 };
  const passed = !!bounty.check(duelStats, styleState);
  return {
    ok: passed,
    bountyId: bounty.id,
    title: bounty.title,
    purseMul: passed ? bounty.purseMul : 1.0,
    renown: passed ? bounty.renownReward : 0,
    seal: passed ? bounty.sealReward : null,
  };
}

const Wagers = {
  BOUNTY_TEMPLATES,
  generateBountiesForFight,
  evaluateBountyResult,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Wagers;
}
