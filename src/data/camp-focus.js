/* =====================================================================
   Aqua Zero Heavens Arena - camp focus
   Luminara Digital

   One pick before the bell. Modest, readable, never fight-winning alone.
   Workload (light / standard / hard) trades preparation for injury risk.
   ===================================================================== */

const CAMP_FOCI = {
  striking: {
    id: "striking", name: "STRIKING", tag: "STRIKE",
    blurb: "sharper hands and kicks for this bout",
    atkMul: 1.08, accBonus: 3, stamMul: 1, prioBoost: 0,
  },
  wrestling: {
    id: "wrestling", name: "WRESTLING", tag: "WREST",
    blurb: "better shots and sprawls",
    atkMul: 1.04, throwMul: 1.12, stamMul: 1, prioBoost: 0,
  },
  grappling: {
    id: "grappling", name: "GRAPPLING", tag: "GRAPPLE",
    blurb: "submissions and mat control",
    atkMul: 1.04, subMul: 1.14, stamMul: 1, prioBoost: 0,
  },
  conditioning: {
    id: "conditioning", name: "CONDITIONING", tag: "GAS",
    blurb: "deeper tank and slower fade",
    atkMul: 1, stamMul: 0.88, maxStamBonus: 8, prioBoost: 0,
  },
  game_plan: {
    id: "game_plan", name: "GAME PLAN", tag: "PLAN",
    blurb: "faster reads and first-move edge",
    atkMul: 1.03, accBonus: 2, stamMul: 1, prioBoost: 1,
  },
  weight_mgmt: {
    id: "weight_mgmt", name: "WEIGHT MGMT", tag: "CUT",
    blurb: "cleaner cut: less early-round gas tax",
    atkMul: 1, stamMul: 0.94, maxStamBonus: 4, cutResist: 0.5, prioBoost: 0,
  },
};
const CAMP_FOCUS_IDS = Object.keys(CAMP_FOCI);

const CAMP_WORKLOADS = {
  light:    { id: "light", name: "LIGHT", mul: 0.7, injuryRisk: 0.02 },
  standard: { id: "standard", name: "STANDARD", mul: 1.0, injuryRisk: 0.05 },
  hard:     { id: "hard", name: "HARD", mul: 1.2, injuryRisk: 0.12 },
};
const CAMP_WORKLOAD_IDS = Object.keys(CAMP_WORKLOADS);

function campFocusOf(id) {
  return CAMP_FOCI[id] || null;
}

function campWorkloadOf(id) {
  return CAMP_WORKLOADS[id] || CAMP_WORKLOADS.standard;
}

function campFocusChoices() {
  return CAMP_FOCUS_IDS.map((id) => {
    const f = CAMP_FOCI[id];
    return { id: f.id, name: f.name, tag: f.tag, blurb: f.blurb };
  });
}

function normalizeCampPlan(raw) {
  const focus = raw && CAMP_FOCI[raw.focus] ? raw.focus : null;
  const workload = raw && CAMP_WORKLOADS[raw.workload] ? raw.workload : "standard";
  return { focus: focus, workload: workload };
}

/* Apply to a side at the bell. Returns { ok, injured } for workload risk. */
function applyCampFocus(side, plan, rnd) {
  const R = rnd || Math.random;
  const p = normalizeCampPlan(plan);
  if (!side || !p.focus) return { ok: false, injured: false };
  const f = CAMP_FOCI[p.focus];
  const w = campWorkloadOf(p.workload);
  const m = w.mul;

  if (f.atkMul && f.atkMul !== 1) side.atkMul = (side.atkMul || 1) * (1 + (f.atkMul - 1) * m);
  if (f.stamMul && f.stamMul !== 1) {
    const tax = 1 + (f.stamMul - 1) * m;
    side.stamMul = (side.stamMul || 1) * tax;
  }
  if (f.maxStamBonus) {
    side.maxStam = (side.maxStam || 60) + Math.round(f.maxStamBonus * m);
    side.stam = Math.min(side.maxStam, (side.stam || 0) + Math.round(f.maxStamBonus * m));
  }
  if (f.accBonus) side.accBonus = (side.accBonus || 0) + Math.round(f.accBonus * m);
  if (f.prioBoost) side.prioBoost = (side.prioBoost || 0) + f.prioBoost;
  if (f.throwMul) side.throwMul = (side.throwMul || 1) * (1 + (f.throwMul - 1) * m);
  if (f.subMul) side.subMul = (side.subMul || 1) * (1 + (f.subMul - 1) * m);
  if (f.cutResist) side.cutResist = Math.min(0.9, (side.cutResist || 0) + f.cutResist * m);

  side.campFocus = p.focus;
  side.campWorkload = p.workload;

  let injured = false;
  if (R() < w.injuryRisk) {
    injured = true;
    if (typeof addStatus === "function") addStatus(side, "ARM_HURT");
    side.atkMul = (side.atkMul || 1) * 0.92;
  }
  return { ok: true, injured: injured, focus: p.focus, workload: p.workload };
}
