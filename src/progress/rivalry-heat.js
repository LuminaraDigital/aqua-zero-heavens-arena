/* =====================================================================
   Aqua Zero Heavens Arena - player callouts and rivalry heat
   Luminara Digital

   Player-initiated same-division callouts raise media heat and feed the
   next bout. Heat is stored on the save, decays slowly, and never grants
   ranked points by itself.
   ===================================================================== */

const CALLOUT_CONFIG = {
  heatGain: 2,
  heatCap: 8,
  heatDecay: 1,
  atkMulPerHeat: 0.015,
  purseBonusPerHeat: 4,
  maxStored: 48,
};

function calloutKey(a, b) {
  const x = Math.min(a | 0, b | 0);
  const y = Math.max(a | 0, b | 0);
  return x + ":" + y;
}

function ensureCallouts(save) {
  if (!save) return { heat: {}, log: [] };
  if (!save.callouts || typeof save.callouts !== "object") {
    save.callouts = { heat: {}, log: [] };
  }
  if (!save.callouts.heat || typeof save.callouts.heat !== "object") save.callouts.heat = {};
  if (!Array.isArray(save.callouts.log)) save.callouts.log = [];
  return save.callouts;
}

function rivalryHeatOf(save, a, b) {
  if (a == null || b == null || a === b) return 0;
  const bag = ensureCallouts(save);
  const n = bag.heat[calloutKey(a, b)] | 0;
  return Math.max(0, Math.min(CALLOUT_CONFIG.heatCap, n));
}

/* Issue a callout. Same division preferred; authored rivals get a bonus. */
function issueCallout(save, fromFid, toFid) {
  if (!save || fromFid == null || toFid == null || fromFid === toFid) {
    return { ok: false, reason: "bad_pair" };
  }
  const bag = ensureCallouts(save);
  const key = calloutKey(fromFid, toFid);
  let gain = CALLOUT_CONFIG.heatGain;
  if (typeof isRivalPair === "function" && isRivalPair(fromFid, toFid)) gain += 1;
  if (typeof rivalOf === "function") {
    /* soft same-card check: if either already has the other as rival, fine */
  }
  const prev = bag.heat[key] | 0;
  const next = Math.min(CALLOUT_CONFIG.heatCap, prev + gain);
  bag.heat[key] = next;
  bag.log.push({
    from: fromFid | 0,
    to: toFid | 0,
    at: Date.now(),
    heat: next,
  });
  if (bag.log.length > CALLOUT_CONFIG.maxStored) {
    bag.log = bag.log.slice(bag.log.length - CALLOUT_CONFIG.maxStored);
  }
  return { ok: true, heat: next, gained: next - prev, key: key };
}

function decayCalloutHeat(save, a, b) {
  if (!save || a == null || b == null) return 0;
  const bag = ensureCallouts(save);
  const key = calloutKey(a, b);
  const prev = bag.heat[key] | 0;
  if (prev <= 0) return 0;
  const next = Math.max(0, prev - CALLOUT_CONFIG.heatDecay);
  if (next <= 0) delete bag.heat[key];
  else bag.heat[key] = next;
  return next;
}

/* Apply heat to a duel at the bell: both corners get a little bite. */
function applyCalloutHeatToDuel(d, save) {
  if (!d || !d.p || !d.e || !save) return 0;
  const heat = rivalryHeatOf(save, d.p.fid, d.e.fid);
  if (heat <= 0) return 0;
  const mul = 1 + heat * CALLOUT_CONFIG.atkMulPerHeat;
  d.p.atkMul = (d.p.atkMul || 1) * mul;
  d.e.atkMul = (d.e.atkMul || 1) * mul;
  d.calloutHeat = heat;
  d.calloutLine = heat >= 4
    ? "THE CALLOUT MADE THIS PERSONAL"
    : "MEDIA HEAT ON THIS CARD";
  return heat;
}

function calloutPurseBonus(save, a, b) {
  const heat = rivalryHeatOf(save, a, b);
  return heat * CALLOUT_CONFIG.purseBonusPerHeat;
}
