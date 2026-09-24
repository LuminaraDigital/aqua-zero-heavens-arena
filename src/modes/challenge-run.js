/* =====================================================================
   Aqua Zero Heavens Arena - Challenge Run mode layer
   Luminara Digital

   Standing objectives from data/challenges.js become a real run mode here:
   coach tips, light mutators that shape the climb, live progress / fail
   feedback, meet eligibility (no stage-1 mook cheese), scaled renown, and
   mastery replays once every title is already on the shelf.

   Titles stay cosmetic. Renown is the only purse this mode adds.
   ===================================================================== */

const CHALLENGE_RUN_DEFAULT = {
  tip: "Meet the terms in a real bout. Patrol silhouettes do not count.",
  meet: "bout",
  needHits: 1,
  renownMul: 1,
  mutator: null,
};

/* meet:
     any  - every fromAdv fight, including AZX Force one-shots
     bout - full rivals only (!tf)
     boss - tower champion only
   needHits: qualifying meets required before challengeDone latches
   renownMul: scales META_AWARD.clear (or 40) at run payout
   mutator: light run/duel shaping - never a power unlock */
const CHALLENGE_RUN_META = {
  first_blood: {
    tip: "Win any fight on the field. Even a patrol clash counts for Debutant.",
    meet: "any", needHits: 1, renownMul: 0.6,
    mutator: null,
  },
  untouched: {
    tip: "Do not take damage. Guard, range control, and reads keep the bar green.",
    meet: "bout", needHits: 1, renownMul: 1.35,
    mutator: { healMul: 0.55, label: "THINNER CORNER HEALS" },
  },
  quick_work: {
    tip: "End it by turn 4. Commit early and finish - do not grind.",
    meet: "bout", needHits: 1, renownMul: 1.15,
    mutator: { oppAtkMul: 1.08, label: "FASTER RIVALS" },
  },
  comeback: {
    tip: "Drop below 15% HP, then still win. Survive the brink.",
    meet: "bout", needHits: 1, renownMul: 1.4,
    mutator: { healMul: 0.7, label: "LEANER RECOVERY" },
  },
  tap_them: {
    tip: "Close to clinch or ground, then finish with a submission.",
    meet: "bout", needHits: 1, renownMul: 1.2,
    mutator: { startRange: "CLINCH", label: "OPENS IN THE CLINCH" },
  },
  mat_master: {
    tip: "Spend more than half the fight on the ground, then win.",
    meet: "bout", needHits: 1, renownMul: 1.2,
    mutator: { startRange: "GROUND", label: "OPENS ON THE MAT" },
  },
  sub_hunter: {
    tip: "Land three submission attempts in one bout - success counts, finish optional.",
    meet: "bout", needHits: 1, renownMul: 1.25,
    mutator: { startRange: "CLINCH", label: "OPENS IN THE CLINCH" },
  },
  throw_artist: {
    tip: "Chain four throws or takedowns in a single bout.",
    meet: "bout", needHits: 1, renownMul: 1.15,
    mutator: { startRange: "MID", label: "STAND-UP ENTRIES" },
  },
  striker: {
    tip: "Win without a throw or submission. Stay upright and strike.",
    meet: "bout", needHits: 1, renownMul: 1.1,
    mutator: { startRange: "LONG", banGroundStart: true, label: "KICKING RANGE BIAS" },
  },
  head_kick_ko: {
    tip: "Finish with a strike while at kicking range.",
    meet: "bout", needHits: 1, renownMul: 1.35,
    mutator: { startRange: "LONG", label: "OPENS AT KICKING RANGE" },
  },
  clinch_war: {
    tip: "Spend more than half the fight in the clinch, then win.",
    meet: "bout", needHits: 1, renownMul: 1.2,
    mutator: { startRange: "CLINCH", label: "OPENS IN THE CLINCH" },
  },
  cutman: {
    tip: "Open a cut (BLEEDING) on them, then win that same fight.",
    meet: "bout", needHits: 1, renownMul: 1.25,
    mutator: { oppAtkMul: 1.05, label: "MEANER RIVALS" },
  },
  perfect_sig: {
    tip: "Bank signature meter, fire it, and land all three beats.",
    meet: "bout", needHits: 1, renownMul: 1.3,
    mutator: null,
  },
  aerial: {
    tip: "Launch and complete a three-hit air combo.",
    meet: "bout", needHits: 1, renownMul: 1.3,
    mutator: { startRange: "MID", label: "LAUNCH RANGE" },
  },
  perfect_guard: {
    tip: "Time three perfect guards in one bout.",
    meet: "bout", needHits: 1, renownMul: 1.2,
    mutator: { oppAtkMul: 1.1, label: "HEAVIER PRESSURE" },
  },
  no_guard: {
    tip: "Win without ever choosing Guard. Offence only.",
    meet: "bout", needHits: 1, renownMul: 1.25,
    mutator: { healMul: 0.65, label: "THINNER HEALS" },
  },
  giant_killer: {
    tip: "Beat a rival three ladder grades above you. Hunt tougher names.",
    meet: "bout", needHits: 1, renownMul: 1.6,
    mutator: { oppAtkMul: 1.12, label: "HARDER RIVALS" },
  },
  champion: {
    tip: "Reach the tower and beat the champion. Nothing else counts.",
    meet: "boss", needHits: 1, renownMul: 2,
    mutator: { healMul: 0.75, label: "CHAMPION CLIMB" },
  },
};

/* NOT OFFERED AS A RUN OBJECTIVE.

   An objective is only worth offering if it can latch, and challengeNoteMeet
   only ever runs on a fromAdv fight - so a test that needs st.ranked can
   never be met from inside a run. giant_killer needs exactly that, and it was
   offered, selectable, and impossible: you could pick "Beat a rival three
   ladder grades above you", clear the run, and never complete it.

   It is not weakened to suit this mode - it stays fully earnable as an epic
   title on the ladder, which is where a ladder achievement belongs. Its META
   entry below stays so a run already carrying it keeps its tip and mutator
   rather than falling back to the default. */
const CHALLENGE_RUN_EXCLUDED = { giant_killer: 1 };

function challengeRunOffered(c) {
  return !!(c && c.test && !CHALLENGE_RUN_EXCLUDED[c.id]);
}

function challengeRunMeta(id) {
  if (!id || !CHALLENGE_RUN_META[id]) return CHALLENGE_RUN_DEFAULT;
  return CHALLENGE_RUN_META[id];
}

function challengeCoachTip(id) {
  const c = typeof CHALLENGE_BY_ID !== "undefined" ? CHALLENGE_BY_ID[id] : null;
  const m = challengeRunMeta(id);
  if (!c) return m.tip;
  return m.tip;
}

function challengeMutatorLabel(id) {
  const mut = challengeRunMeta(id).mutator;
  return mut && mut.label ? mut.label : null;
}

function challengeRenownBonus(id, opts) {
  const base = (typeof META_AWARD !== "undefined" && META_AWARD.clear) ? META_AWARD.clear : 40;
  const mul = challengeRunMeta(id).renownMul || 1;
  let amt = Math.round(base * mul);
  if (opts && opts.mastery) amt = Math.round(amt * 0.75);
  return Math.max(8, amt);
}

function challengeMeetEligible(id, d) {
  if (!d || !d.fromAdv) return false;
  const meet = challengeRunMeta(id).meet || "bout";
  if (meet === "boss") return !!d.boss;
  if (meet === "bout") return !d.tf && !d.oneShot;
  return true;
}

function challengeNeedHits(id) {
  return Math.max(1, challengeRunMeta(id).needHits || 1);
}

/* Live meter for the duel HUD. Returns null if unknown. */
function challengeProgress(id, st, d) {
  if (!id || !st) return null;
  const turns = st.turns || 0;
  const ranges = st.ranges || {};
  switch (id) {
    case "untouched":
      return {
        label: st.dmgTaken > 0 ? ("BROKEN - " + Math.round(st.dmgTaken) + " DMG") : "CLEAN - 0 DMG",
        frac: st.dmgTaken > 0 ? 0 : 1,
        broken: st.dmgTaken > 0,
        ok: false,
      };
    case "quick_work":
      return {
        label: "TURN " + turns + " / 4",
        frac: Math.max(0, Math.min(1, (4 - turns) / 4)),
        broken: turns > 4,
        ok: false,
      };
    case "comeback":
      return {
        label: st.lowest <= 0.15 ? "BRINK HIT - NOW WIN" : ("LOWEST " + Math.round((st.lowest || 1) * 100) + "%"),
        frac: st.lowest <= 0.15 ? 1 : Math.max(0, 1 - (st.lowest || 1)),
        broken: false,
        ok: st.lowest <= 0.15,
      };
    case "tap_them":
      return {
        label: "NEED SUB FINISH" + (st.subs ? (" - " + st.subs + " SUB ATTEMPTS") : ""),
        frac: st.koClass === "SUB" ? 1 : Math.min(1, (st.subs || 0) / 3),
        broken: false,
        ok: st.koClass === "SUB",
      };
    case "mat_master": {
      const g = ranges.GROUND || 0;
      const need = Math.floor(turns / 2) + 1;
      return {
        label: "GROUND " + g + " / " + Math.max(need, 1) + " TURNS",
        frac: turns ? Math.min(1, g / Math.max(turns * 0.5 + 0.01, 1)) : 0,
        broken: false,
        ok: turns > 0 && g > turns / 2,
      };
    }
    case "clinch_war": {
      const c = ranges.CLINCH || 0;
      return {
        label: "CLINCH " + c + (turns ? (" / " + Math.floor(turns / 2) + "+") : ""),
        frac: turns ? Math.min(1, c / Math.max(turns * 0.5 + 0.01, 1)) : 0,
        broken: false,
        ok: turns > 0 && c > turns / 2,
      };
    }
    case "sub_hunter":
      return {
        label: "SUBS " + (st.subs || 0) + " / 3",
        frac: Math.min(1, (st.subs || 0) / 3),
        broken: false,
        ok: (st.subs || 0) >= 3,
      };
    case "throw_artist":
      return {
        label: "THROWS " + (st.throws || 0) + " / 4",
        frac: Math.min(1, (st.throws || 0) / 4),
        broken: false,
        ok: (st.throws || 0) >= 4,
      };
    case "striker":
      return {
        label: ((st.throws || 0) + (st.subs || 0)) > 0 ? "BROKEN - GRAPPLED" : "PURE STRIKING",
        frac: ((st.throws || 0) + (st.subs || 0)) > 0 ? 0 : 1,
        broken: ((st.throws || 0) + (st.subs || 0)) > 0,
        ok: false,
      };
    case "head_kick_ko":
      return {
        label: d && d.range === "LONG" ? "AT KICKING RANGE - FINISH IT" : "GET TO KICKING RANGE",
        frac: d && d.range === "LONG" ? 0.7 : 0.2,
        broken: false,
        ok: st.koClass === "STRIKE" && st.koRange === "LONG",
      };
    case "cutman":
      return {
        label: (st.conds && st.conds.BLEEDING) ? "CUT OPEN - NOW WIN" : "OPEN A CUT",
        frac: (st.conds && st.conds.BLEEDING) ? 0.8 : 0.15,
        broken: false,
        ok: !!(st.conds && st.conds.BLEEDING),
      };
    case "perfect_sig":
      return {
        label: "PERFECT SIG " + (st.sigPerfect || 0),
        frac: (st.sigPerfect || 0) > 0 ? 1 : 0.2,
        broken: false,
        ok: (st.sigPerfect || 0) > 0,
      };
    case "aerial":
      return {
        label: "AIR COMBO " + (st.comboMax || 0) + " / 3",
        frac: Math.min(1, (st.comboMax || 0) / 3),
        broken: false,
        ok: (st.comboMax || 0) >= 3,
      };
    case "perfect_guard":
      return {
        label: "PERFECT GUARDS " + (st.perfectGuards || 0) + " / 3",
        frac: Math.min(1, (st.perfectGuards || 0) / 3),
        broken: false,
        ok: (st.perfectGuards || 0) >= 3,
      };
    case "no_guard":
      return {
        label: (st.guards || 0) > 0 ? "BROKEN - GUARDED" : "NO GUARD",
        frac: (st.guards || 0) > 0 ? 0 : 1,
        broken: (st.guards || 0) > 0,
        ok: false,
      };
    case "giant_killer": {
      const gap = (st.opponentRankIndex || 0) - (st.myRankIndex || 0);
      return {
        label: "GRADE GAP " + gap + " / 3",
        frac: Math.min(1, Math.max(0, gap) / 3),
        broken: false,
        ok: gap >= 3,
      };
    }
    case "champion":
      return {
        label: (d && d.boss) ? "THE CHAMPION - WIN IT" : "REACH THE TOWER BOSS",
        frac: d && d.boss ? 0.85 : 0.1,
        broken: false,
        ok: !!(st.boss && st.win),
      };
    case "first_blood":
      return {
        label: "WIN THIS FIGHT",
        frac: 0.5,
        broken: false,
        ok: !!st.win,
      };
    default:
      return {
        label: "IN PROGRESS",
        frac: 0.35,
        broken: false,
        ok: false,
      };
  }
}

/* Returns a fail message the first time a challenge breaks mid-fight, else null. */
function challengeCheckBreak(id, st, track) {
  const prog = challengeProgress(id, st, null);
  if (!prog || !prog.broken) return null;
  if (track && track.broken) return null;
  if (track) track.broken = true;
  switch (id) {
    case "untouched": return "CHALLENGE BROKEN - TOOK DAMAGE";
    case "quick_work": return "CHALLENGE BROKEN - TOO SLOW";
    case "striker": return "CHALLENGE BROKEN - GRAPPLED";
    case "no_guard": return "CHALLENGE BROKEN - GUARDED";
    default: return "CHALLENGE BROKEN";
  }
}

function challengeApplyToAdv(a) {
  if (!a || !a.challenge) return a;
  const mut = challengeRunMeta(a.challenge).mutator;
  a.chalMut = mut ? Object.assign({}, mut) : null;
  a.challengeHits = a.challengeHits || 0;
  return a;
}

function challengeApplyToDuel(d, a) {
  if (!d || !a || !a.challenge) return d;
  const mut = a.chalMut || challengeRunMeta(a.challenge).mutator;
  if (!mut) {
    d.challengeTrack = { broken: false };
    return d;
  }
  if (mut.startRange && !d.boss && !d.tf) {
    if (!(mut.banGroundStart && mut.startRange === "GROUND")) d.range = mut.startRange;
  }
  if (mut.oppAtkMul && d.e && !d.boss) {
    d.e.atkMul = (d.e.atkMul || 1) * mut.oppAtkMul;
  }
  d.chalHealMul = (mut.healMul != null) ? mut.healMul : 1;
  d.challengeTrack = { broken: false };
  return d;
}

function challengeScaleHeal(a, amount) {
  const n = Math.round(Number(amount) || 0);
  if (!a || !a.chalMut || a.chalMut.healMul == null) return n;
  return Math.max(0, Math.round(n * a.chalMut.healMul));
}

/* Latch challengeDone when terms are met on an eligible fight enough times. */
function challengeNoteMeet(a, d, st) {
  if (!a || !a.challenge || a.challengeDone || !d || !d.fromAdv) return false;
  const c = typeof CHALLENGE_BY_ID !== "undefined" ? CHALLENGE_BY_ID[a.challenge] : null;
  if (!c || !c.test) return false;
  if (!challengeMeetEligible(a.challenge, d)) return false;
  let met = false;
  try { met = !!c.test(st); } catch (e) { met = false; }
  if (!met) return false;
  a.challengeHits = (a.challengeHits || 0) + 1;
  if (a.challengeHits < challengeNeedHits(a.challenge)) return false;
  a.challengeDone = true;
  return true;
}

function challengeBuildRows(save) {
  const owned = (save && save.titles) || [];
  const rows = [{
    id: "none",
    name: "NO STANDING OBJECTIVE",
    desc: "the ordinary run - fight it however you like.",
    title: null,
    tip: "No mutator, no extra renown, no standing objective.",
    mastery: false,
    earned: false,
    mutLabel: null,
    renown: 0,
  }];
  const playable = (typeof CHALLENGES !== "undefined" ? CHALLENGES : []).filter(challengeRunOffered);
  const open = playable.filter((c) => owned.indexOf(c.id) < 0);
  const done = playable.filter((c) => owned.indexOf(c.id) >= 0);
  const pushRow = (c, mastery) => {
    const tip = challengeCoachTip(c.id);
    const mutLabel = challengeMutatorLabel(c.id);
    const renown = challengeRenownBonus(c.id, { mastery: !!mastery });
    rows.push({
      id: c.id,
      name: mastery ? ("MASTERY - " + c.name) : c.name,
      desc: mastery
        ? (c.desc + " Renown only - title already owned.")
        : c.desc,
      title: c.title,
      tip: tip,
      mastery: !!mastery,
      earned: !!mastery,
      mutLabel: mutLabel,
      renown: renown,
    });
  };
  open.forEach((c) => pushRow(c, false));
  if (open.length === 0) done.forEach((c) => pushRow(c, true));
  return rows;
}

const ChallengeRun = {
  META: CHALLENGE_RUN_META,
  DEFAULT: CHALLENGE_RUN_DEFAULT,
  EXCLUDED: CHALLENGE_RUN_EXCLUDED,
  offered: challengeRunOffered,
  meta: challengeRunMeta,
  coachTip: challengeCoachTip,
  mutatorLabel: challengeMutatorLabel,
  renownBonus: challengeRenownBonus,
  meetEligible: challengeMeetEligible,
  needHits: challengeNeedHits,
  progress: challengeProgress,
  checkBreak: challengeCheckBreak,
  applyToAdv: challengeApplyToAdv,
  applyToDuel: challengeApplyToDuel,
  scaleHeal: challengeScaleHeal,
  noteMeet: challengeNoteMeet,
  buildRows: challengeBuildRows,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ChallengeRun;
}
