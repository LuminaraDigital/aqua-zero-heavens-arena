/* =====================================================================
   Aqua Zero Heavens Arena - conditions
   Luminara Digital

   Real fight consequences rather than fantasy ailments. Each condition is
   data: how long it lasts, what it scales, and whether it ticks damage.
   The resolver reads these - no condition is special-cased in the maths.

     pow/acc/spd  multipliers applied to the afflicted fighter
     tick         damage per turn while it holds
     turns        duration
     blocks       technique classes this condition prevents
   ===================================================================== */
const STATUS = {
  STUNNED:     { name: "STUNNED",     turns: 1, pow: 1,    acc: 0.72, spd: 0.55, tick: 0, color: "#ffd166",
                 note: "rocked - slower and wilder for a turn" },
  WINDED:      { name: "WINDED",      turns: 3, pow: 0.80, acc: 0.94, spd: 0.86, tick: 0, color: "#9ecbff",
                 note: "gassed - less on everything you throw" },
  BLEEDING:    { name: "BLEEDING",    turns: 4, pow: 1,    acc: 0.96, spd: 1,    tick: 3, color: "#e03a2f",
                 note: "cut - loses blood every turn" },
  OFF_BALANCE: { name: "OFF BALANCE", turns: 1, pow: 0.88, acc: 0.78, spd: 0.90, tick: 0, color: "#c9a227",
                 note: "posture broken - easy to take down" },
  LEG_HURT:    { name: "LEG DAMAGE",  turns: 5, pow: 0.90, acc: 1,    spd: 0.78, tick: 0, color: "#d97b3a",
                 note: "the base is gone - slower, weaker kicks" },
  ARM_HURT:    { name: "ARM DAMAGE",  turns: 5, pow: 0.78, acc: 0.94, spd: 1,    tick: 0, color: "#d97b3a",
                 note: "a limb is compromised - power drops" },
  HELD:        { name: "HELD",        turns: 2, pow: 0.92, acc: 1,    spd: 0.70, tick: 0, color: "#9b8cff",
                 note: "tied up - cannot disengage cleanly" },
  PINNED:      { name: "PINNED",      turns: 2, pow: 0.80, acc: 0.90, spd: 0.62, tick: 1, color: "#7d6cff",
                 blocks: ["THROW"], note: "controlled on the mat - no throws from here" },
};

function newConditions() { return {}; }
function addStatus(side, key, log) {
  const s = STATUS[key]; if (!s) return false;
  const had = !!side.cond[key];
  let turns = s.turns;
  /* the cutman's kit: once the cut is closed, later cuts run half as long */
  if (key === "BLEEDING" && side.bleedMul) turns = Math.max(1, Math.round(turns * side.bleedMul));
  side.cond[key] = { turns };
  if (log && !had) log(side, s.name);
  return !had;
}
function hasStatus(side, key) { return !!side.cond[key]; }
/* multipliers from everything currently on a fighter */
function statusMods(side) {
  let pow = 1, acc = 1, spd = 1;
  for (const k in side.cond) {
    const s = STATUS[k]; if (!s) continue;
    pow *= s.pow; acc *= s.acc; spd *= s.spd;
  }
  return { pow, acc, spd };
}
function statusBlocks(side, cls) {
  for (const k in side.cond) {
    const s = STATUS[k];
    if (s && s.blocks && s.blocks.indexOf(cls) >= 0) return s.name;
  }
  return null;
}
/* end-of-turn: tick damage out, count conditions down */
function tickStatus(side) {
  let dmg = 0;
  for (const k in side.cond) {
    const s = STATUS[k];
    dmg += s.tick || 0;
    if (--side.cond[k].turns <= 0) delete side.cond[k];
  }
  return dmg;
}
