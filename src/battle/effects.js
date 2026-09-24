/* =====================================================================
   Aqua Zero Heavens Arena - conditions, stat stages & combat mechanics
   Luminara Digital

   Real fight consequences rather than fantasy ailments. Each condition is
   data: how long it lasts, what it scales, and whether it ticks damage.
   The resolver reads these - no condition is special-cased in the maths.

     pow/acc/spd/def  multipliers applied to the afflicted fighter
     tick             damage per turn while it holds
     turns            duration
     blocks           technique classes this condition prevents
     stageMods        stat stage debuffs applied by the condition
   ===================================================================== */
const STATUS = {
  STUNNED:     { name: "STUNNED",     turns: 1, pow: 1.0,  acc: 0.72, spd: 0.55, def: 0.85, tick: 0,
                 stageMods: { spd: -2, acc: -1 }, color: "#ffd166",
                 note: "rocked - slower and wilder for a turn" },
  WINDED:      { name: "WINDED",      turns: 3, pow: 0.80, acc: 0.94, spd: 0.86, def: 0.90, tick: 0,
                 stageMods: { atk: -1, spd: -1 }, color: "#9ecbff",
                 note: "gassed - less on everything you throw" },
  BLEEDING:    { name: "BLEEDING",    turns: 4, pow: 1.0,  acc: 0.96, spd: 1.00, def: 0.95, tick: 3,
                 stageMods: { def: -1 }, color: "#e03a2f",
                 note: "cut - loses blood every turn" },
  OFF_BALANCE: { name: "OFF BALANCE", turns: 1, pow: 0.88, acc: 0.78, spd: 0.90, def: 0.80, tick: 0,
                 stageMods: { def: -1, acc: -1 }, color: "#c9a227",
                 note: "posture broken - easy to take down" },
  DAZED:       { name: "DAZED",       turns: 2, pow: 0.85, acc: 0.75, spd: 0.80, def: 0.88, tick: 0,
                 stageMods: { acc: -1, atk: -1 }, color: "#e5c07b",
                 note: "disoriented - impaired accuracy and reaction" },
  STAMINA_BREAK: { name: "STAMINA BREAK", turns: 1, pow: 0.75, acc: 0.80, spd: 0.55, def: 1 / 1.35, tick: 0,
                 blocks: ["GUARD"], stageMods: { def: -2, spd: -2 }, color: "#ff4444",
                 note: "stamina depleted - defense disabled, takes +35% damage" },
  LEG_HURT:    { name: "LEG DAMAGE",  turns: 5, pow: 0.90, acc: 1.00, spd: 0.78, def: 0.95, tick: 0,
                 stageMods: { spd: -1 }, color: "#d97b3a",
                 note: "the base is gone - slower, weaker kicks" },
  ARM_HURT:    { name: "ARM DAMAGE",  turns: 5, pow: 0.78, acc: 0.94, spd: 1.00, def: 0.95, tick: 0,
                 stageMods: { atk: -1 }, color: "#d97b3a",
                 note: "a limb is compromised - power drops" },
  HELD:        { name: "HELD",        turns: 2, pow: 0.92, acc: 1.00, spd: 0.70, def: 0.90, tick: 0,
                 stageMods: { spd: -1, def: -1 }, color: "#9b8cff",
                 note: "tied up - cannot disengage cleanly" },
  PINNED:      { name: "PINNED",      turns: 2, pow: 0.80, acc: 0.90, spd: 0.62, def: 0.75, tick: 1,
                 blocks: ["THROW"], stageMods: { def: -2, spd: -2 }, color: "#7d6cff",
                 note: "controlled on the mat - no throws from here" },
  SUB_TRAPPED: { name: "SUB TRAPPED", turns: 2, pow: 0.85, acc: 0.85, spd: 0.60, def: 0.80, tick: 0,
                 stageMods: { def: -1, spd: -1 }, color: "#a855f7",
                 note: "submission initiated - arm or head trapped" },
  SUB_LOCKED:  { name: "SUB LOCKED",  turns: 2, pow: 0.70, acc: 0.70, spd: 0.40, def: 0.65, tick: 3,
                 blocks: ["STRIKE"], stageMods: { def: -2, spd: -2 }, color: "#9333ea",
                 note: "figure-four locked - defense compromised, escaping is urgent" },
  SUB_SUBMITTED: { name: "SUBMITTED", turns: 1, pow: 0.50, acc: 0.50, spd: 0.20, def: 0.50, tick: 10,
                 color: "#7e22ce", note: "deep submission - tapout imminent" },
  SEEK_FINISH: { name: "SEEK FINISH", turns: 1, pow: 1.25, acc: 1.15, spd: 1.30, def: 1.00, tick: 0,
                 stageMods: { atk: 1, spd: 1 }, color: "#ef4444",
                 note: "opponent rocked - hunting the stoppage" },
  DEAD_LEG:    { name: "DEAD LEG",    turns: 3, pow: 0.85, acc: 0.85, spd: 0.70, def: 0.85, tick: 0,
                 stageMods: { spd: -2 }, color: "#f97316",
                 note: "peroneal nerve trauma - foot drops, forced stance switch, high trip risk" },
  WALL_PINNED: { name: "WALL PINNED", turns: 2, pow: 0.82, acc: 0.88, spd: 0.65, def: 0.78, tick: 0,
                 stageMods: { def: -1, spd: -2 }, color: "#64748b",
                 note: "pressed against cage fence - dirty boxing target, wall-walk required" },
  SWELLING_BLIND: { name: "EYE SHUT", turns: 4, pow: 0.95, acc: 0.68, spd: 0.85, def: 0.80, tick: 0,
                 stageMods: { acc: -2 }, color: "#eab308",
                 note: "severe periorbital hematoma - vision occluded on lead side" },
};

/* Aliases */
STATUS.BLEED = STATUS.BLEEDING;
STATUS.STUN = STATUS.STUNNED;
STATUS.DAZE = STATUS.DAZED;
STATUS.STAM_BREAK = STATUS.STAMINA_BREAK;
STATUS.TRAPPED = STATUS.SUB_TRAPPED;
STATUS.LOCKED = STATUS.SUB_LOCKED;
STATUS.SUBMITTED = STATUS.SUB_SUBMITTED;
STATUS.PERONEAL = STATUS.DEAD_LEG;
STATUS.CAGED = STATUS.WALL_PINNED;

/* =====================================================================
   Pokemon-Style Stat Stages (-3 to +3)
   6 stages: -3 to +3 for Atk, Def, Spd, Acc
   Standard multipliers:
     Atk/Def/Spd:
       +3: 5/2 = 2.50
       +2: 4/2 = 2.00
       +1: 3/2 = 1.50
        0: 2/2 = 1.00
       -1: 2/3 = 0.667
       -2: 2/4 = 0.50
       -3: 2/5 = 0.40
     Acc:
       +3: 6/3 = 2.00
       +2: 5/3 = 1.667
       +1: 4/3 = 1.333
        0: 3/3 = 1.00
       -1: 3/4 = 0.75
       -2: 3/5 = 0.60
       -3: 3/6 = 0.50
   ===================================================================== */
const STAT_STAGES = {
  MIN: -3,
  MAX: 3,
  STATS: ["atk", "def", "spd", "acc"]
};

function statStageMultiplier(stat, stage) {
  const s = Math.max(STAT_STAGES.MIN, Math.min(STAT_STAGES.MAX, stage | 0));
  if (stat === "acc") {
    return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
  }
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

function newStatStages() {
  return { atk: 0, def: 0, spd: 0, acc: 0 };
}

function getStatStage(side, stat) {
  if (!side || !side.stages) return 0;
  const key = stat === "pow" ? "atk" : stat;
  const v = side.stages[key];
  return typeof v === "number" ? Math.max(STAT_STAGES.MIN, Math.min(STAT_STAGES.MAX, v)) : 0;
}

function setStatStage(side, stat, stage) {
  if (!side) return 0;
  if (!side.stages) side.stages = newStatStages();
  const key = stat === "pow" ? "atk" : stat;
  const clamped = Math.max(STAT_STAGES.MIN, Math.min(STAT_STAGES.MAX, stage | 0));
  side.stages[key] = clamped;
  return clamped;
}

function modifyStatStage(side, stat, delta, log) {
  if (!side) return 0;
  if (!side.stages) side.stages = newStatStages();
  const key = stat === "pow" ? "atk" : stat;
  const current = getStatStage(side, key);
  const target = Math.max(STAT_STAGES.MIN, Math.min(STAT_STAGES.MAX, current + (delta | 0)));
  const diff = target - current;
  side.stages[key] = target;
  if (log && diff !== 0) {
    const statName = key.toUpperCase();
    const direction = diff > 0 ? (diff >= 2 ? "rose sharply!" : "rose!") : (diff <= -2 ? "fell harshly!" : "fell!");
    log(side, statName + " " + direction);
  }
  return diff;
}

function resetStatStages(side) {
  if (side) side.stages = newStatStages();
}

function statStageMods(side) {
  if (!side || !side.stages) {
    return { atk: 1, pow: 1, def: 1, spd: 1, acc: 1 };
  }
  const atk = statStageMultiplier("atk", getStatStage(side, "atk"));
  const def = statStageMultiplier("def", getStatStage(side, "def"));
  const spd = statStageMultiplier("spd", getStatStage(side, "spd"));
  const acc = statStageMultiplier("acc", getStatStage(side, "acc"));
  return { atk, pow: atk, def, spd, acc };
}

/* =====================================================================
   Conditions & Status Helpers
   ===================================================================== */
function newConditions() { return {}; }

function normalizeStatusKey(key) {
  if (!key) return null;
  if (key === "BLEED") return "BLEEDING";
  if (key === "STUN") return "STUNNED";
  if (key === "DAZE") return "DAZED";
  if (key === "STAMINA_BREAK" || key === "STAM_BREAK") return "STAMINA_BREAK";
  return key;
}

function addStatus(side, rawKey, log, customTurns) {
  if (!side) return false;
  if (!side.cond) side.cond = newConditions();
  const key = normalizeStatusKey(rawKey);
  const s = STATUS[key]; if (!s) return false;
  const had = !!side.cond[key];
  let turns = typeof customTurns === "number" && customTurns > 0 ? customTurns : s.turns;
  /* the cutman's kit: once the cut is closed, later cuts run half as long */
  if (key === "BLEEDING" && side.bleedMul) turns = Math.max(1, Math.round(turns * side.bleedMul));

  /* wire onStatus benefit hooks and relic hooks */
  if (typeof G !== "undefined" && G.duel) {
    const d = G.duel;
    const attacker = d.p === side ? d.e : d.p;
    if (d.benefits && typeof BENEFITS !== "undefined") {
      for (let i = 0; i < d.benefits.length; i++) {
        const b = BENEFITS[d.benefits[i]];
        if (b && typeof b.onStatus === "function") {
          const res = b.onStatus(attacker, side, key);
          if (res && typeof res.turns === "number") turns = res.turns;
        }
      }
    }
    if (d.relics && typeof relicHook === "function") {
      relicHook(d.relics, "onStatusApplied", null, { d, side: attacker, foe: side, target: side, key });
    }
  }

  side.cond[key] = { turns, maxTurns: turns, name: s.name };
  if (log && !had) log(side, s.name);
  return !had;
}

function hasStatus(side, rawKey) {
  if (!side || !side.cond) return false;
  const key = normalizeStatusKey(rawKey);
  return !!side.cond[key];
}

function getStatusDuration(side, rawKey) {
  if (!side || !side.cond) return 0;
  const key = normalizeStatusKey(rawKey);
  return side.cond[key] ? (side.cond[key].turns || 0) : 0;
}

function setStatusDuration(side, rawKey, turns) {
  if (!side || !side.cond) return false;
  const key = normalizeStatusKey(rawKey);
  if (!side.cond[key]) return false;
  side.cond[key].turns = Math.max(0, turns | 0);
  if (side.cond[key].turns <= 0) delete side.cond[key];
  return true;
}

function clearStatus(side, rawKey) {
  if (!side || !side.cond) return false;
  const key = normalizeStatusKey(rawKey);
  if (side.cond[key]) {
    delete side.cond[key];
    return true;
  }
  return false;
}

function clearAllStatuses(side) {
  if (!side) return;
  side.cond = newConditions();
}

/* multipliers from everything currently on a fighter */
function statusMods(side) {
  let pow = 1, acc = 1, spd = 1, def = 1;
  if (side && side.cond) {
    for (const k in side.cond) {
      const s = STATUS[k]; if (!s) continue;
      if (s.pow !== undefined) pow *= s.pow;
      if (s.acc !== undefined) acc *= s.acc;
      if (s.spd !== undefined) spd *= s.spd;
      if (s.def !== undefined) def *= s.def;
    }
  }
  if (side && side.stages) {
    const sm = statStageMods(side);
    pow *= sm.atk;
    def *= sm.def;
    spd *= sm.spd;
    acc *= sm.acc;
  }
  return { pow, acc, spd, def, atk: pow };
}

function statusBlocks(side, cls) {
  if (!side || !side.cond) return null;
  for (const k in side.cond) {
    const s = STATUS[k];
    if (s && s.blocks && s.blocks.indexOf(cls) >= 0) return s.name;
  }
  return null;
}

/* end-of-turn: tick damage out, count conditions down */
function tickStatus(side) {
  let dmg = 0;
  if (!side || !side.cond) return dmg;
  for (const k in side.cond) {
    const s = STATUS[k];
    dmg += (s && s.tick) || 0;
    if (--side.cond[k].turns <= 0) delete side.cond[k];
  }
  return dmg;
}

/* =====================================================================
   Attack Heights ('HIGH', 'MID', 'LOW', 'SPECIAL')
   ===================================================================== */
const ATTACK_HEIGHTS = {
  HIGH: "HIGH",
  MID: "MID",
  LOW: "LOW",
  SPECIAL: "SPECIAL"
};
const HEIGHT_ORDER = ["HIGH", "MID", "LOW", "SPECIAL"];

function attackHeightOf(tech) {
  if (!tech) return "MID";
  if (tech.height && typeof tech.height === "string") {
    const h = tech.height.toUpperCase();
    if (ATTACK_HEIGHTS[h]) return h;
  }
  if (tech.sig || tech.cls === "THROW" || tech.cls === "SUB") return "SPECIAL";

  const flags = tech.flags || [];
  const id = (tech.id || "").toLowerCase();
  const name = (tech.name || "").toLowerCase();

  if (flags.indexOf("takedown") >= 0 || flags.indexOf("super") >= 0 ||
      flags.indexOf("signature") >= 0 || flags.indexOf("finisher") >= 0 ||
      flags.indexOf("unblockable") >= 0 || flags.indexOf("tie-up") >= 0 ||
      flags.indexOf("escape") >= 0 || tech.cls === "SETUP") {
    return "SPECIAL";
  }

  // Low checks
  if (flags.indexOf("low") >= 0 || flags.indexOf("sweep") >= 0 ||
      flags.indexOf("trip") >= 0 || flags.indexOf("leg") >= 0 ||
      id.indexOf("low") >= 0 || id.indexOf("sweep") >= 0 || id.indexOf("leg") >= 0 ||
      id.indexOf("trip") >= 0 || id.indexOf("ankle") >= 0 || id.indexOf("foot") >= 0 ||
      id.indexOf("calf") >= 0 || id.indexOf("shin") >= 0 || id.indexOf("gedan") >= 0 ||
      id.indexOf("ashihara") >= 0 || id.indexOf("harai") >= 0 ||
      name.indexOf("low") >= 0 || name.indexOf("sweep") >= 0 || name.indexOf("trip") >= 0) {
    return "LOW";
  }

  // High checks
  if (flags.indexOf("high") >= 0 || flags.indexOf("head") >= 0 ||
      flags.indexOf("jump") >= 0 || flags.indexOf("flying") >= 0 ||
      flags.indexOf("axe") >= 0 || flags.indexOf("spin") >= 0 ||
      flags.indexOf("launcher") >= 0 || flags.indexOf("poke") >= 0 ||
      flags.indexOf("fast") >= 0 || id.indexOf("high") >= 0 ||
      id.indexOf("head") >= 0 || id.indexOf("headbutt") >= 0 || id.indexOf("jab") >= 0 ||
      id.indexOf("overhand") >= 0 || id.indexOf("hook") >= 0 || id.indexOf("flying") >= 0 ||
      id.indexOf("jump") >= 0 || id.indexOf("axe") >= 0 || id.indexOf("tornado") >= 0 ||
      id.indexOf("naeryo") >= 0 || id.indexOf("jodan") >= 0 || id.indexOf("face") >= 0 ||
      name.indexOf("high") >= 0 || name.indexOf("head") >= 0 || name.indexOf("jab") >= 0 ||
      name.indexOf("overhand") >= 0 || name.indexOf("hook") >= 0 || name.indexOf("flying") >= 0 ||
      name.indexOf("axe") >= 0 || name.indexOf("face") >= 0) {
    return "HIGH";
  }

  // Mid checks
  if (flags.indexOf("mid") >= 0 || flags.indexOf("body") >= 0 ||
      flags.indexOf("inside") >= 0 || flags.indexOf("counter") >= 0 ||
      flags.indexOf("power") >= 0 || flags.indexOf("straight") >= 0 ||
      id.indexOf("cross") >= 0 || id.indexOf("body") >= 0 || id.indexOf("liver") >= 0 ||
      id.indexOf("upper") >= 0 || id.indexOf("straight") >= 0 || id.indexOf("teep") >= 0 ||
      id.indexOf("chudan") >= 0 || id.indexOf("knee") >= 0 || id.indexOf("elbow") >= 0 ||
      name.indexOf("cross") >= 0 || name.indexOf("body") >= 0 || name.indexOf("liver") >= 0 ||
      name.indexOf("upper") >= 0 || name.indexOf("knee") >= 0 || name.indexOf("elbow") >= 0) {
    return "MID";
  }

  if (tech.cls === "GUARD") {
    if (flags.indexOf("leg") >= 0 || id.indexOf("low") >= 0 || id.indexOf("leg") >= 0) return "LOW";
    if (flags.indexOf("head") >= 0 || id.indexOf("high") >= 0 || id.indexOf("face") >= 0 || name.indexOf("high") >= 0) return "HIGH";
    return "MID";
  }

  return "MID";
}

function heightAdvantage(atkHeight, defHeight) {
  if (!atkHeight || !defHeight) return 0;
  const a = atkHeight.toUpperCase(), d = defHeight.toUpperCase();
  if (a === d) return 0;
  if (a === "HIGH" && d === "MID") return 1;
  if (a === "MID" && d === "LOW") return 1;
  if (a === "LOW" && (d === "HIGH" || d === "MID")) return 1;
  return 0;
}

/* =====================================================================
   3-Choice Dynamic (FOCUS, STRIKE, BLOCK)
   ===================================================================== */
const CHOICES = {
  FOCUS: "FOCUS",
  STRIKE: "STRIKE",
  BLOCK: "BLOCK"
};

function classifyTechniqueChoice(tech) {
  if (!tech) return CHOICES.FOCUS;
  if (tech.cls === "GUARD") return CHOICES.BLOCK;
  if (tech.id === "basic_focus" || tech.id === "focus" ||
      (tech.flags && tech.flags.indexOf("focus") >= 0) ||
      tech.isFocus) {
    return CHOICES.FOCUS;
  }
  if (tech.cls === "SETUP") {
    if (tech.flags && (tech.flags.indexOf("reposition") >= 0 || tech.flags.indexOf("circle") >= 0 || tech.flags.indexOf("escape") >= 0)) {
      return CHOICES.FOCUS;
    }
  }
  return CHOICES.STRIKE;
}

function resolve3WayDynamic(atkChoice, defChoice) {
  const a = atkChoice ? atkChoice.toUpperCase() : CHOICES.STRIKE;
  const b = defChoice ? defChoice.toUpperCase() : CHOICES.BLOCK;
  if (a === b) return { advantage: "NEUTRAL", winner: null, note: "EVEN EXCHANGE" };
  if (a === CHOICES.STRIKE && b === CHOICES.FOCUS) {
    return { advantage: "STRIKE", winner: "atk", note: "STRIKE PUNISHED FOCUS" };
  }
  if (a === CHOICES.FOCUS && b === CHOICES.BLOCK) {
    return { advantage: "FOCUS", winner: "atk", note: "FOCUS OUT-VALUED BLOCK" };
  }
  if (a === CHOICES.BLOCK && b === CHOICES.STRIKE) {
    return { advantage: "BLOCK", winner: "atk", note: "BLOCK MITIGATED STRIKE" };
  }
  if (a === CHOICES.STRIKE && b === CHOICES.BLOCK) {
    return { advantage: "BLOCK", winner: "def", note: "GUARD SOAKED STRIKE" };
  }
  if (a === CHOICES.FOCUS && b === CHOICES.STRIKE) {
    return { advantage: "STRIKE", winner: "def", note: "STRUCK WHILE FOCUSING" };
  }
  if (a === CHOICES.BLOCK && b === CHOICES.FOCUS) {
    return { advantage: "FOCUS", winner: "def", note: "BLOCK WASTED AGAINST FOCUS" };
  }
  return { advantage: "NEUTRAL", winner: null, note: "EXCHANGE" };
}

function focusAction(side, d, foeTech) {
  if (!side) return { gainedFocus: 0, gainedStam: 0, outResourced: false };
  const isVsGuard = !!(foeTech && typeof classifyTechniqueChoice === "function" && classifyTechniqueChoice(foeTech) === "BLOCK");
  const gainedFocus = isVsGuard ? 2 : 1;
  const stamAmount = isVsGuard ? 24 : 18;

  if (typeof gainFocus === "function") gainFocus(side, gainedFocus);
  else side.focus = Math.min(side.focusMax || 3, (side.focus || 0) + gainedFocus);

  const maxStam = side.maxStam || 60;
  const gainedStam = Math.min(maxStam - (side.stam || 0), stamAmount);
  side.stam = Math.min(maxStam, (side.stam || 0) + stamAmount);
  if (side.cond && side.cond.WINDED && side.stam > 0) delete side.cond.WINDED;

  return { gainedFocus, gainedStam, outResourced: isVsGuard };
}

/* =====================================================================
   Tri-Zone Health and Combat Modeling (Head / Body / Legs)
   Adapted from MMA damage engines: discrete target zone attrition.
   ===================================================================== */
function newZones(maxhp) {
  const hp = typeof maxhp === "number" ? maxhp : 100;
  return { head: hp, body: hp, legs: hp, max: hp };
}

function getZoneDamageTarget(tech) {
  if (!tech) return "head";
  const f = tech.flags || [];
  if (f.indexOf("leg") >= 0 || f.indexOf("leglock") >= 0 || tech.height === "LOW") return "legs";
  if (f.indexOf("body") >= 0) return "body";
  if (tech.height === "HIGH" || f.indexOf("cut") >= 0 || f.indexOf("choke") >= 0 || f.indexOf("head") >= 0) return "head";
  return "head";
}

function hurtZone(side, zone, dmg) {
  if (!side) return 0;
  if (!side.zones) side.zones = newZones(side.maxhp || 100);
  const z = (zone === "legs" || zone === "body" || zone === "head") ? zone : "head";
  side.zones[z] = Math.max(0, (side.zones[z] || side.maxhp || 100) - dmg);

  // Peroneal nerve trauma: critical leg depletion triggers Dead Leg and forces stance switch
  if (z === "legs" && side.zones.legs < (side.zones.max * 0.35)) {
    if (typeof addStatus === "function") {
      addStatus(side, "DEAD_LEG");
      side.stance = (side.stance === "southpaw") ? "orthodox" : "southpaw";
    }
  }

  // Head trauma accumulates periorbital swelling
  if (z === "head" && dmgShare(side, dmg) >= SWELL_SHARE) {
    side.swelling = Math.min(100, (side.swelling || 0) + Math.round(dmg * 0.7));
    if (side.swelling >= 75 && typeof addStatus === "function") {
      addStatus(side, "SWELLING_BLIND");
    }
  }

  return side.zones[z];
}

/* ---------------------------------------------------------------------
   A THRESHOLD ON DAMAGE IS A SHARE OF A HEALTH BAR, NEVER A NUMBER.

   `dmg >= 22` decided whether a shot rocked a man and `dmg >= 10` decided
   whether it marked his face. Both were absolute HP figures written
   against a TECH_DMG_SCALE that has since moved twice, and neither
   carried a record of which scale it was written for - so every time the
   balance audit turned the one knob it has for fight length, these
   silently became a different share of a health bar. The rocking one had
   stopped firing at all: the heaviest kick in the dex landed for 19
   against a threshold of 22, and nothing was a severe impact any more.

   As a share of the bar they mean the same thing at any scale: "about a
   fifth of him, in one shot". Note what this does NOT fix - how OFTEN a
   share is reached still moves with TECH_DMG_SCALE, because the scale
   decides how big hits are. What it fixes is a threshold quietly meaning
   something different from what its own line says.

   Measured over 1,473 landed techniques in played fights at scale 0.37:
   the median hit is 7.6% of the bar, p90 16.2%, p99 26.3%, largest 34.1%.
   Any new threshold on damage belongs here, expressed the same way.
   --------------------------------------------------------------------- */
function dmgShare(side, dmg) {
  const max = (side && ((side.zones && side.zones.max) || side.maxhp)) || 100;
  return max > 0 ? (dmg || 0) / max : 0;
}
/* enough of a head shot to start marking the face. Fires on ~33% of
   landed techniques, which is what the flat `dmg >= 10` did on a
   100-point bar - the same behaviour, made scale-proof rather than
   re-balanced. */
const SWELL_SHARE = 0.10;
/* the shot that visibly takes a man's legs from under him - ~1% of landed
   techniques, and the largest hit measured is 34% of a bar. Shared by the
   reaction animation and the style meter so the stagger on screen and the
   flourish in the meter are the same shot. The style meter's old `dmg >=
   35` was unreachable at scale 0.37: HEAVY IMPACT fired on 0.00% of
   1,473 landed techniques, i.e. it was dead content. */
const STAGGER_SHARE = 0.26;
/* what the animation layer calls a heavy swing - was a flat `dmg >= 30` */
const HEAVY_SWING_SHARE = 0.30;

function zoneRatio(side, zone) {
  if (!side) return 1;
  if (!side.zones) side.zones = newZones(side.maxhp || 100);
  const max = side.zones.max || side.maxhp || 100;
  if (max <= 0) return 0;
  const z = (zone === "legs" || zone === "body" || zone === "head") ? zone : "head";
  return Math.max(0, Math.min(1, (side.zones[z] || 0) / max));
}

function zoneSnapshot(side) {
  if (!side) return { head: 0, body: 0, legs: 0, max: 100, cut: 0 };
  if (!side.zones) side.zones = newZones(side.maxhp || 100);
  return {
    head: Math.round(side.zones.head || 0),
    body: Math.round(side.zones.body || 0),
    legs: Math.round(side.zones.legs || 0),
    max: Math.round(side.zones.max || side.maxhp || 100),
    cut: Math.round((side.cuts && side.cuts.amount) || 0),
  };
}

/* Cut meter: accumulates separately from BLEEDING tick damage.
   High cuts raise stoppage risk and accuracy tax; cutResist (camp) softens. */
function newCuts() {
  return { amount: 0, max: 100 };
}

function hurtCut(side, amount) {
  if (!side || !(amount > 0)) return 0;
  if (!side.cuts) side.cuts = newCuts();
  const resist = Math.max(0, Math.min(0.9, side.cutResist || 0));
  const applied = Math.max(0, Math.round(amount * (1 - resist)));
  side.cuts.amount = Math.min(side.cuts.max, (side.cuts.amount || 0) + applied);
  if (side.cuts.amount >= 35 && typeof addStatus === "function") {
    addStatus(side, "BLEEDING");
  }
  return side.cuts.amount;
}

function cutPenalty(side) {
  if (!side || !side.cuts) return { acc: 1, stopRisk: 0 };
  const a = side.cuts.amount || 0;
  const max = side.cuts.max || 100;
  const t = Math.max(0, Math.min(1, a / max));
  return {
    acc: 1 - t * 0.18,
    stopRisk: t >= 0.7 ? 0.08 + (t - 0.7) * 0.4 : 0,
  };
}

function cutSnapshot(side) {
  if (!side || !side.cuts) return { amount: 0, max: 100 };
  return { amount: Math.round(side.cuts.amount || 0), max: Math.round(side.cuts.max || 100) };
}

