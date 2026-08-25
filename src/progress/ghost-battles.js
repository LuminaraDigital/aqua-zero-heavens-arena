/* =====================================================================
   Aqua Zero Heavens Arena - Ghost Passcode Serialization & AI Playback (AZG2)
   Luminara Digital

   Encodes victorious runs, customized fighters, and behavioral style
   vectors into compact passcodes. Enables asynchronous community
   challenges and sparring against authentic playstyle clones in the Dojo.
   Supports backward-compatible decoding of legacy AZG1 passcodes.
   ===================================================================== */

const GHOST_MAGIC_V1 = "AZG1";
const GHOST_MAGIC_V2 = "AZG2";
const GHOST_MAGIC = GHOST_MAGIC_V2;

function extractStyleVector(statsOrTracker) {
  if (!statsOrTracker) return [1.0, 1, 0.5, 0.5, 0.5, 1.0, 1.0, 1.0];
  const tr = statsOrTracker;
  const turns = Math.max(1, tr.turns || 1);

  // 1. Aggression: strike ratio
  const strikeCount = (tr.movesByClass && tr.movesByClass.STRIKE) || 0;
  const aggression = Math.max(0.4, Math.min(2.0, Number(((strikeCount / turns) * 1.6).toFixed(2))));

  // 2. Preferred Range index: 0:LONG, 1:MID, 2:CLINCH, 3:GROUND
  let rangePref = 1;
  if (tr.rangeOccupancy) {
    const ranges = ["LONG", "MID", "CLINCH", "GROUND"];
    let maxR = 0;
    ranges.forEach((r, idx) => {
      if ((tr.rangeOccupancy[r] || 0) > maxR) {
        maxR = tr.rangeOccupancy[r];
        rangePref = idx;
      }
    });
  }

  // 3. Counter Bias
  const counterBias = tr.lowStamGuards ? Math.min(2.0, Number((tr.lowStamGuards * 0.4).toFixed(2))) : 0.5;

  // 4. Chain Greed
  const chain3 = (tr.combos && tr.combos.chain3) || 0;
  const chainGreed = Math.min(2.0, Number(((chain3 / turns) * 2.5).toFixed(2)));

  // 5. Guard Threshold
  const guardCount = (tr.movesByClass && tr.movesByClass.GUARD) || 0;
  const guardThreshold = Math.min(1.0, Number(((guardCount / turns) * 1.5).toFixed(2)));

  // 6. Finish Hunger
  const finishHunger = aggression > 1.2 ? 1.5 : 1.0;

  // 7. Pressure Bias
  const pressureBias = rangePref === 2 || rangePref === 3 ? 1.4 : 1.0;

  // 8. Pace / Execution Noise
  const pace = 0.8;

  return [aggression, rangePref, counterBias, chainGreed, guardThreshold, finishHunger, pressureBias, pace];
}

function styleVectorToWeights(v) {
  if (!v || !Array.isArray(v)) return null;
  const ranges = ["LONG", "MID", "CLINCH", "GROUND"];
  const rIdx = typeof v[1] === "number" ? Math.max(0, Math.min(3, v[1])) : 1;
  const prefRange = ranges[rIdx] || "MID";

  return {
    aggression: v[0] || 1.0,
    preferRange: prefRange,
    counterBonus: Math.round((v[2] || 0.5) * 14),
    closeIn: rIdx >= 2 ? 12 : (rIdx === 0 ? -12 : 0),
    guard: Math.max(0.4, (v[4] || 0.5) * 2.0),
    ignoreStamina: (v[5] || 1.0) > 1.3,
    sub: rIdx === 3 ? 1.5 : 1.0,
    ground: rIdx === 3 ? 1.5 : 1.0,
    noise: v[7] !== undefined ? v[7] : 1.0,
  };
}

function encodeGhostBuild(build) {
  if (!build) return "";
  try {
    const payload = {
      m: GHOST_MAGIC_V2,
      f: build.hero || 0,
      t: build.techniques || build.techs || [],
      s: build.seals || {},
      d: build.drilled || {},
      b: build.benefits || [],
      v: build.styleVector || extractStyleVector(build.stats || build.tracker),
      n: (build.name || "Champion Ghost").slice(0, 16),
    };
    const json = JSON.stringify(payload);
    let b64 = "";
    if (typeof Buffer !== "undefined") {
      b64 = Buffer.from(json, "utf8").toString("base64");
    } else if (typeof btoa === "function") {
      b64 = btoa(unescape(encodeURIComponent(json)));
    }
    return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  } catch (e) {
    return "";
  }
}

function decodeGhostBuild(code) {
  if (!code || typeof code !== "string") return null;
  try {
    let raw = code.trim().replace(/-/g, "+").replace(/_/g, "/");
    while (raw.length % 4 !== 0) raw += "=";
    let json = "";
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(raw, "base64").toString("utf8");
    } else if (typeof atob === "function") {
      json = decodeURIComponent(escape(atob(raw)));
    }
    const data = JSON.parse(json);
    if (!data || (data.m !== GHOST_MAGIC_V1 && data.m !== GHOST_MAGIC_V2)) return null;
    return {
      hero: typeof data.f === "number" ? data.f : 0,
      techniques: Array.isArray(data.t) ? data.t : [],
      seals: data.s && typeof data.s === "object" ? data.s : {},
      drilled: data.d && typeof data.d === "object" ? data.d : {},
      benefits: Array.isArray(data.b) ? data.b : [],
      styleVector: Array.isArray(data.v) ? data.v : null,
      name: typeof data.n === "string" ? data.n : "Champion Ghost",
    };
  } catch (e) {
    return null;
  }
}

function createGhostCombatant(ghostBuild) {
  if (!ghostBuild) return null;
  const heroId = ghostBuild.hero || 0;
  const weights = ghostBuild.styleVector ? styleVectorToWeights(ghostBuild.styleVector) : null;
  return {
    id: heroId,
    name: ghostBuild.name || "Ghost Champion",
    isGhost: true,
    techs: ghostBuild.techniques && ghostBuild.techniques.length > 0 ? ghostBuild.techniques : null,
    seals: ghostBuild.seals || {},
    drill: ghostBuild.drilled || {},
    benefits: ghostBuild.benefits || [],
    ai: weights,
    styleVector: ghostBuild.styleVector || null,
  };
}

const GhostBattles = {
  GHOST_MAGIC_V1,
  GHOST_MAGIC_V2,
  GHOST_MAGIC,
  extractStyleVector,
  styleVectorToWeights,
  encodeGhostBuild,
  decodeGhostBuild,
  createGhostCombatant,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = GhostBattles;
}
