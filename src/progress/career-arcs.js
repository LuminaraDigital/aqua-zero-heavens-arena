/* =====================================================================
   Aqua Zero Heavens Arena - career arcs
   Luminara Digital

   Potential is a ceiling, not a destination. Each fighter has a permanent
   Career Arc that shapes how mastery accrues over a career:

     early_peak     fast early gains, softer late
     standard       balanced
     late_developer slow start, strong mid
     long_prime     steady gains for longer

   Fight count (save.fr wins+losses) is the age proxy - no calendar needed.
   ===================================================================== */

const CAREER_ARCS = {
  early_peak: {
    id: "early_peak", name: "EARLY PEAK",
    note: "climbs fast, then plateaus",
    /* primeStart was 0, and careerPhase asks `n < primeStart` - which is never
       true at zero, so the 1.35 early bonus was unreachable and an early peaker
       debuted on primeMul 1.05, growing SLOWER than a standard fighter's 1.10.
       The arc that says "climbs fast" was the worst opener in the game. Six
       fights of early, against standard's eight: the peak comes sooner, which
       is what the arc is for. */
    primeStart: 6, primeEnd: 18, earlyMul: 1.35, primeMul: 1.05, lateMul: 0.70,
  },
  standard: {
    id: "standard", name: "STANDARD PRIME",
    note: "textbook development curve",
    primeStart: 8, primeEnd: 40, earlyMul: 1.10, primeMul: 1.15, lateMul: 0.85,
  },
  late_developer: {
    id: "late_developer", name: "LATE DEVELOPER",
    note: "slow start, strong mid career",
    primeStart: 16, primeEnd: 55, earlyMul: 0.75, primeMul: 1.30, lateMul: 0.95,
  },
  long_prime: {
    id: "long_prime", name: "LONG PRIME",
    note: "holds form deep into the career",
    primeStart: 6, primeEnd: 70, earlyMul: 1.00, primeMul: 1.12, lateMul: 1.05,
  },
};
const CAREER_ARC_IDS = Object.keys(CAREER_ARCS);

function careerArcOf(fid) {
  const discs = (typeof disciplinesOf === "function") ? disciplinesOf(fid) : [];
  const grapple = discs.some((d) =>
    ["bjj", "wrestling", "judo", "sambo", "subgrap", "grappling", "jiujitsu"].indexOf(d) >= 0);
  let h = ((fid | 0) * 2246822519) >>> 0;
  /* Grapplers bias toward long_prime / late_developer. */
  const pool = grapple
    ? ["long_prime", "late_developer", "standard", "long_prime"]
    : ["early_peak", "standard", "late_developer", "early_peak", "standard"];
  const id = pool[h % pool.length];
  return CAREER_ARCS[id] || CAREER_ARCS.standard;
}

function careerFightCount(save, fid) {
  if (!save || !save.fr) return 0;
  const row = save.fr[fid] || save.fr[String(fid)];
  if (!row) return 0;
  return Math.max(0, (row.w | 0) + (row.l | 0));
}

function careerPhase(arc, fights) {
  const a = arc || CAREER_ARCS.standard;
  const n = Math.max(0, fights | 0);
  if (n < a.primeStart) return "early";
  if (n <= a.primeEnd) return "prime";
  return "late";
}

function careerArcGrowthMul(arc, fights) {
  const a = typeof arc === "string" ? CAREER_ARCS[arc] : (arc || CAREER_ARCS.standard);
  if (!a) return 1;
  const phase = careerPhase(a, fights);
  if (phase === "early") return a.earlyMul;
  if (phase === "prime") return a.primeMul;
  return a.lateMul;
}

/* Rare post-prime resurgence: capped, needs a win, falls off with age. */
function careerArcResurgeChance(arc, fights, won, rnd) {
  const R = rnd || Math.random;
  if (!won) return false;
  const a = arc || CAREER_ARCS.standard;
  const n = fights | 0;
  if (n <= a.primeEnd) return false;
  const yearsPast = n - a.primeEnd;
  let chance = 0.045;
  if (yearsPast > 20) chance *= 0.35;
  else if (yearsPast > 10) chance *= 0.6;
  return R() < chance;
}

function masteryForWithArc(result, save, fid) {
  const base = (typeof masteryFor === "function") ? masteryFor(result) : 10;
  const arc = careerArcOf(fid);
  const fights = careerFightCount(save, fid);
  let xp = Math.round(base * careerArcGrowthMul(arc, fights));
  if (careerArcResurgeChance(arc, fights, !!(result && result.win))) {
    xp = Math.round(xp * 1.25);
  }
  return Math.max(1, xp);
}
