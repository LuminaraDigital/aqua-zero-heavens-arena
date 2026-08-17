/* =====================================================================
   Aqua Zero Heavens Arena - range matchups
   Luminara Digital

   The fight lives at one of four ranges, and that range is the real
   matchup layer: a head kick is useless from mount, an armbar is useless
   at kicking distance. Techniques land at full value in their own range
   and fall off sharply outside it, and a fighter whose disciplines do not
   cover the current range fights at a disadvantage until they change it.

   This is the effectiveness matrix - it just happens to be honest about
   how fighting actually works rather than an invented element chart.
   ===================================================================== */
const RANGE_INDEX = { LONG: 0, MID: 1, CLINCH: 2, GROUND: 3 };
const RANGE_ORDER = ["LONG", "MID", "CLINCH", "GROUND"];

/* how well a technique works at the range the fight is actually in */
const RANGE_FALLOFF = [1, 0.70, 0.40, 0.20];
function rangeFit(techRange, current) {
  if (!techRange || techRange === "ANY") return 1;
  const d = Math.abs(RANGE_INDEX[techRange] - RANGE_INDEX[current]);
  return RANGE_FALLOFF[Math.min(3, d)];
}
/* accuracy suffers less than power when you are out of position */
function rangeAccFit(techRange, current) {
  if (!techRange || techRange === "ANY") return 1;
  const d = Math.abs(RANGE_INDEX[techRange] - RANGE_INDEX[current]);
  return [1, 0.86, 0.68, 0.52][Math.min(3, d)];
}

/* a fighter is at home in a range if any of their disciplines owns it */
function comfort(discIds, current) {
  for (const id of discIds || []) {
    const d = DISCIPLINES[id];
    if (d && d.ranges.indexOf(current) >= 0) return 1;
  }
  return 0.86;
}
/* the ranges a fighter actually wants the fight to be in */
function homeRanges(discIds) {
  const set = {};
  (discIds || []).forEach((id) => { const d = DISCIPLINES[id]; if (d) d.ranges.forEach((r) => (set[r] = 1)); });
  const out = RANGE_ORDER.filter((r) => set[r]);
  return out.length ? out : ["MID"];
}
