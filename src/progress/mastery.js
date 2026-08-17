/* =====================================================================
   Aqua Zero Heavens Arena - fighter mastery
   Luminary Digital

   The answer to "I lost, so that run was worth nothing".

   Every fight you take with a fighter earns them mastery, win or lose -
   a loss earns less, never zero. Mastery is permanent, per fighter, and
   pays out as small standing perks the next time you pick them. So a run
   that ends badly still moved something forward, and the roster's long
   tail is worth exploring rather than settling on one favourite.

   Deliberately modest: mastery smooths a fighter out, it does not win
   fights for you. The ceiling is roughly one good camp benefit.
   ===================================================================== */
const MASTERY_RANKS = [
  { level: 0, name: "Unranked",  need: 0,   perk: "" },
  { level: 1, name: "White",     need: 40,  perk: "+1 starting focus" },
  { level: 2, name: "Blue",      need: 110, perk: "start adventures at level 2" },
  { level: 3, name: "Purple",    need: 230, perk: "+10 stamina ceiling" },
  { level: 4, name: "Brown",     need: 400, perk: "signature meter starts at 25%" },
  { level: 5, name: "Black",     need: 640, perk: "one more technique in their kit" },
];
const MASTERY_MAX = MASTERY_RANKS.length - 1;
const MASTERY_COLORS = ["#6b7280", "#e8e6e1", "#3a8ae0", "#8b5cf6", "#a0642a", "#111318"];

/* what a single fight is worth */
const MASTERY_AWARD = { win: 18, loss: 7, perfect: 8, boss: 20, ranked: 6, survival: 4 };
function masteryFor(result) {
  let xp = result.win ? MASTERY_AWARD.win : MASTERY_AWARD.loss;
  if (result.win && result.perfect) xp += MASTERY_AWARD.perfect;
  if (result.boss && result.win) xp += MASTERY_AWARD.boss;
  if (result.matchType === "ranked") xp += MASTERY_AWARD.ranked;
  if (result.matchType === "survival") xp += MASTERY_AWARD.survival;
  return xp;
}

const masteryXp = (save, fid) => ((save.mastery || {})[fid] || 0);
function masteryRank(xp) {
  let r = MASTERY_RANKS[0];
  for (const m of MASTERY_RANKS) if (xp >= m.need) r = m;
  return r;
}
function masteryProgress(xp) {
  const r = masteryRank(xp);
  if (r.level >= MASTERY_MAX) return 1;
  const next = MASTERY_RANKS[r.level + 1];
  return Math.max(0, Math.min(1, (xp - r.need) / (next.need - r.need)));
}
function masteryToNext(xp) {
  const r = masteryRank(xp);
  return r.level >= MASTERY_MAX ? 0 : MASTERY_RANKS[r.level + 1].need - xp;
}
/* returns {gained, from, to, levelled} */
function awardMastery(save, fid, result) {
  if (!save.mastery) save.mastery = {};
  const before = masteryXp(save, fid), gained = masteryFor(result);
  const after = before + gained;
  save.mastery[fid] = after;
  const from = masteryRank(before), to = masteryRank(after);
  return { gained, from, to, levelled: to.level > from.level };
}

/* the standing perks, applied where the fighter is built */
const masteryLevel = (save, fid) => masteryRank(masteryXp(save, fid)).level;
function applyMastery(side, level) {
  if (level >= 1) { side.focusMax += 1; side.focus = Math.min(side.focusMax, side.focus + 1); }
  if (level >= 3) side.maxStam += 10;
  if (level >= 4) side.sup = Math.max(side.sup, Math.round(SUP_MAX * 0.25));
  side.stam = side.maxStam;
  return side;
}
/* level 2 starts adventures further along; level 5 widens the elite kit */
const masteryStartLevel = (save, fid) => (masteryLevel(save, fid) >= 2 ? 2 : 1);
const masteryKitBonus = (save, fid) => (masteryLevel(save, fid) >= 5 ? 1 : 0);
