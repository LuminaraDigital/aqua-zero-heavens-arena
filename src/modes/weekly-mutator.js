/* =====================================================================
   Aqua Zero Heavens Arena - 10x Weekly Seeded Mutator Championship Mode
   Luminara Digital

   10x Weekly Tournament Gauntlet with full state memory/persistence,
   16+ distinct weekly anomaly mutators, dual-mutator wildcard matrix,
   5-tier championship circuit culminating in the Apex Weekly Sovereign,
   tactical in-run anomaly augment drafting, corner clinic preparation,
   defeat resilience (Corner Respites / Second Wind continues),
   Grand Weekly Crown Victory, and infinite Weekly Overdrive.
   ===================================================================== */

const WEEKLY_CONFIG = {
  maxTier: 5,               // 5-Tier Championship Circuit (Qualifiers -> Quarters -> Semis -> Finals -> Apex Sovereign)
  defaultRespites: 2,       // 2 Corner Respite retry tokens per campaign
  healPerTier: 0.35,        // Camp health recovery ratio between tiers
  overdriveScale: 0.10,     // Scaling per tier beyond Tier 5
  climaxBonusScore: 3000,   // Grand Weekly Champion score bonus
  climaxBonusPurse: 500,    // Grand Weekly Champion purse bonus
  startingPurse: 120,       // Starting purse for corner supplies
};

const WEEKLY_MUTATORS = [
  {
    id: "GLASS_CANNON",
    name: "Glass Cannon Arena",
    tag: "HIGH LETHALITY",
    desc: "Damage dealt & taken is increased by 250%. Maximum HP is halved.",
    color: "#e6392f",
    powMul: 2.5,
    hpMul: 0.5,
    stamMul: 1.0,
  },
  {
    id: "MAT_WARFARE",
    name: "Submissions & Mat Warfare",
    tag: "GRAPPLING ONLY",
    desc: "Bouts begin on the Ground. Submissions deal +75% damage; ground strikes +50%; standing strikes deal -70%.",
    color: "#10b981",
    subMul: 1.75,
    groundStrikeMul: 1.5,
    strikeMul: 0.3,
    startRange: "GROUND",
  },
  {
    id: "TURBO_BLITZ",
    name: "Hypersonic Blitz",
    tag: "HYPER SPEED",
    desc: "Stamina regeneration increased by +150%, and all technique speeds +25.",
    color: "#22d3ee",
    spdBoost: 25,
    stamRegenMul: 2.5,
  },
  {
    id: "TITAN_ARMOR",
    name: "Iron Juggernauts",
    tag: "SUPER HEAVY",
    desc: "+50% Maximum HP and 30% global defense mitigation against all attacks.",
    color: "#f59e0b",
    hpMul: 1.5,
    defMul: 1.3,
  },
  {
    id: "COUNTER_KINGS",
    name: "Counter Specialists",
    tag: "READ & REACT",
    desc: "Parries and Predictive Counter-hits inflict +350% reflection damage.",
    color: "#ec4899",
    counterMul: 3.5,
  },
  {
    id: "CHRONO_SURGE",
    name: "Temporal Flux",
    tag: "TIME DISTORTION",
    desc: "Attack chains chain +1 link deeper; +20 Speed priority; stamina costs reduced by 25%.",
    color: "#8b5cf6",
    spdBoost: 20,
    stamMul: 0.75,
    chainBonus: 1,
  },
  {
    id: "BLOODLUST_FRENZY",
    name: "Desperation Bloodlust",
    tag: "DESPERATION",
    desc: "Deal up to +80% bonus damage as health drops; gain 20% lifesteal when below 40% HP.",
    color: "#ef4444",
    desperationPow: 1.8,
    lifestealLowHp: 0.20,
  },
  {
    id: "STANDUP_PURIST",
    name: "K-1 Standup Arena",
    tag: "PURE STRIKING",
    desc: "Takedowns & submissions disabled. All standing strikes gain +45% Power and +25% Stun impact.",
    color: "#f97316",
    strikeMul: 1.45,
    stunMul: 1.25,
    noGrapple: true,
  },
  {
    id: "TITAN_GRAVITY",
    name: "Heavy Clinch Pit",
    tag: "CLINCH ONLY",
    desc: "Bouts begin in CLINCH range. Escapes cost double stamina; knees & throws deal +65% damage.",
    color: "#d97706",
    startRange: "CLINCH",
    clinchMul: 1.65,
    escapeCostMul: 2.0,
  },
  {
    id: "ANOMALY_ROULETTE",
    name: "Chaotic Anomaly",
    tag: "CHAOS SURGE",
    desc: "Both combatants start with 100% Super meter; Super attacks deal +40% bonus damage.",
    color: "#a855f7",
    superStart: 100,
    superMul: 1.4,
  },
  {
    id: "VAMPIRIC_ECLIPSE",
    name: "Vampiric Eclipse",
    tag: "LIFESTEAL",
    desc: "Strikes heal 30% of damage dealt, but combatants suffer 3% bleed degeneration per turn.",
    color: "#be185d",
    lifesteal: 0.30,
    bleedTick: 0.03,
  },
  {
    id: "PRECISION_STORM",
    name: "Critical Focus Surge",
    tag: "PRECISION",
    desc: "Guard breaks immediately inflict Stun; completing 3+ hit combos charges 100% Super meter.",
    color: "#06b6d4",
    critStun: true,
    comboSuperBonus: true,
  },
  {
    id: "IRON_CHIN_DUEL",
    name: "Deep Water Marathon",
    tag: "ENDURANCE",
    desc: "All incoming damage reduced by 40%; stamina costs increased by 25%. Tests pure conditioning.",
    color: "#475569",
    defMul: 1.4,
    stamMul: 1.25,
  },
  {
    id: "ADRENALINE_OVERLOAD",
    name: "Maximum Velocity",
    tag: "BURST TEMPO",
    desc: "Both fighters start with 100% Super meter; Speed priority +30; first hit deals +50% damage.",
    color: "#fbbf24",
    superStart: 100,
    spdBoost: 30,
    firstHitMul: 1.5,
  },
  {
    id: "GHOST_MIRAGE",
    name: "Phantom Mirage",
    tag: "EVASION",
    desc: "Dodges and sways refund 25 Stamina and grant +50% counter bonus on the subsequent turn.",
    color: "#6366f1",
    dodgeRefund: 25,
    counterBonus: 1.5,
  },
  {
    id: "PRESSURE_FURNACE",
    name: "Relentless Pressure",
    tag: "MOMENTUM",
    desc: "Consecutive forward strikes gain a cumulative +12% damage bonus per hit.",
    color: "#dc2626",
    pressureStack: 1.12,
  },
];

const SECONDARY_MUTATORS = [
  { id: "WILDCARD_ADRENALINE", name: "Adrenaline Surge", tag: "SURGE", desc: "Both fighters start with 50% Super meter.", superStart: 50, color: "#ec4899" },
  { id: "WILDCARD_STAMINA", name: "Endless Lungs", tag: "TEMPO", desc: "Double stamina regeneration rate.", stamRegenMul: 2.0, color: "#22d3ee" },
  { id: "WILDCARD_COUNTER", name: "Reflex Sharpener", tag: "PRECISION", desc: "Counter strikes inflict +50% bonus damage.", counterMul: 1.5, color: "#e6392f" },
  { id: "WILDCARD_FORTRESS", name: "Reinforced Guard", tag: "DEFENSE", desc: "Guard absorbs +20% additional damage.", defMul: 1.2, color: "#3b82f6" },
  { id: "WILDCARD_HASTE", name: "Quickstep", tag: "SPEED", desc: "+15 Speed priority on all techniques.", spdBoost: 15, color: "#a855f7" },
  { id: "WILDCARD_LEECH", name: "Vampiric Touch", tag: "SUSTAIN", desc: "Heal 15% of strike damage dealt.", lifesteal: 0.15, color: "#10b981" },
];

const WEEKLY_AUGMENTS = [
  { id: "w_chrono_cap", name: "Chrono Capacitor", tag: "TEMPO", desc: "+15 Speed priority and +10% faster initiative recovery.", spdBoost: 15, color: "#8b5cf6" },
  { id: "w_vamp_fang", name: "Vampiric Infusion", tag: "SUSTAIN", desc: "Restore 20% of unmitigated strike damage as Health.", lifesteal: 0.20, color: "#ec4899" },
  { id: "w_titan_hide", name: "Titan Fortitude", tag: "DEFENSE", desc: "+25% Max HP and reduce all incoming damage taken by 12%.", hpMul: 1.25, defMul: 1.12, color: "#f59e0b" },
  { id: "w_counter_reflex", name: "Counter Reflex", tag: "PRECISION", desc: "+50% damage on predictive Counter strikes.", counterBonus: 1.5, color: "#e6392f" },
  { id: "w_ground_dominance", name: "Mat Dominance", tag: "GRAPPLING", desc: "+40% Submission and Ground strike damage.", subBonus: 1.4, color: "#10b981" },
  { id: "w_kinetic_surge", name: "Kinetic Conduit", tag: "POWER", desc: "Strikes deal +25% damage when Stamina is above 70%.", highStamBonus: 1.25, color: "#22d3ee" },
  { id: "w_desperation_spark", name: "Desperation Spark", tag: "DESPERATION", desc: "Deal +35% damage when below 50% health.", desperationBonus: 1.35, color: "#ef4444" },
  { id: "w_super_catalyst", name: "Super Catalyst", tag: "BURST", desc: "Start every combat round with +50% Super meter.", superStart: 50, color: "#fbbf24" },
  { id: "w_gas_tank", name: "Iron Lungs", tag: "STAMINA", desc: "+30 Max Stamina and start every duel full.", stamMaxBonus: 30, color: "#38bdf8" },
  { id: "w_fourth_chain", name: "The Fourth Link", tag: "COMBO", desc: "Your attack combinations may chain 4 links deep.", chainDepth: 4, color: "#a855f7" },
  { id: "w_second_wind", name: "Second Wind", tag: "RECOVERY", desc: "Regenerate +8 Stamina at the end of each turn.", stamTurnBonus: 8, color: "#06b6d4" },
  { id: "w_guard_breaker", name: "Guard Piercer", tag: "BREAKER", desc: "Strikes pierce 40% of enemy guard defense.", guardPierce: 0.40, color: "#f97316" },
  { id: "w_bleed_edge", name: "Serrated Edge", tag: "STATUS", desc: "Clean strikes have 60% chance to inflict Bleeding.", bleedChance: 0.60, color: "#e11d48" },
  { id: "w_apex_killer", name: "Apex Breaker", tag: "BOSS SLAYER", desc: "Deal +30% bonus damage against Bosses and Tier Sovereigns.", bossBonus: 1.30, color: "#eab308" },
  { id: "w_clinch_snare", name: "Clinch Lock", tag: "CLINCH", desc: "+35% Clinch strike damage and opponent cannot easily escape.", clinchBonus: 1.35, color: "#d97706" },
  { id: "w_respite_token", name: "Emergency Medkit", tag: "RESILIENCE", desc: "Grants +1 extra Corner Respite retry token.", respiteBonus: 1, color: "#10b981" },
];

function getWeekNumber(date) {
  const d = date ? new Date(date) : new Date();
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function getIsoWeekYear(date) {
  const d = date ? new Date(date) : new Date();
  const thursday = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - dayNr + 3);
  return thursday.getUTCFullYear();
}

function getSecondaryMutator(primaryId, seed) {
  const s = (typeof seed === "number" && !isNaN(seed)) ? Math.abs(seed) : 0;
  const filtered = SECONDARY_MUTATORS.filter(m => m.id !== primaryId);
  const idx = s % filtered.length;
  return filtered[idx];
}

function getWeeklyMutator(optDate) {
  const d = optDate ? new Date(optDate) : new Date();
  const year = getIsoWeekYear(d);
  const week = getWeekNumber(d);
  const seed = Math.abs(year * 52 + week);
  const idx = seed % WEEKLY_MUTATORS.length;
  const mutator = WEEKLY_MUTATORS[idx];
  const secondary = getSecondaryMutator(mutator.id, seed + 7);

  return {
    year: year,
    week: week,
    mutator: mutator,
    secondaryMutator: secondary,
    id: mutator.id,
    name: mutator.name,
    desc: mutator.desc,
    tag: mutator.tag,
    color: mutator.color,
  };
}

function formatWeeklyCountdown(optDate) {
  const d = optDate ? new Date(optDate) : new Date();
  // Next Monday 00:00 UTC
  const nextMonday = new Date(d.valueOf());
  const dayNr = (nextMonday.getUTCDay() + 6) % 7;
  const daysUntilMonday = 7 - dayNr;
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);

  const diffMs = Math.max(0, nextMonday.getTime() - d.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${days}D ${hours}H ${mins}M`;
}

function DEF_WEEKLY_STATE(heroId, optDate) {
  const d = optDate ? new Date(optDate) : new Date();
  const year = getIsoWeekYear(d);
  const week = getWeekNumber(d);
  const wm = getWeeklyMutator(d);
  const baseHp = (typeof hpOf === "function" && heroId !== undefined) ? hpOf(heroId) : 100;
  const modHp = Math.round(baseHp * (wm.mutator.hpMul || 1.0));

  return {
    hero: heroId || 0,
    year: year,
    week: week,
    tier: 1,
    maxTier: WEEKLY_CONFIG.maxTier,
    hp: modHp,
    maxhp: modHp,
    baseHp: baseHp,
    score: 0,
    purse: WEEKLY_CONFIG.startingPurse,
    respitesLeft: WEEKLY_CONFIG.defaultRespites,
    augments: [],
    bag: ["salts", "syringe"],
    seals: {},
    drilled: {},
    stats: {
      wins: 0,
      kos: 0,
      perfects: 0,
      turns: 0,
      totalDmg: 0,
      respitesUsed: 0,
    },
    victorious: false,
    overdrive: false,
    active: true,
    mutator: wm.mutator,
    secondaryMutator: wm.secondaryMutator,
  };
}

function weeklyOpponentForTier(state, tier, rosterSize) {
  const t = Math.max(1, Math.round(tier || (state && state.tier) || 1));
  /* Roster size is FIGHTERS.length - never ORDER.length. ORDER holds deck
     growth arrays, and using those as fighter ids throws in mkSide/battlePool. */
  const poolSize = rosterSize || (typeof FIGHTERS !== "undefined" ? FIGHTERS.length : 24);
  const isApex = (t === WEEKLY_CONFIG.maxTier && !(state && state.overdrive));
  const isOverdrive = (t > WEEKLY_CONFIG.maxTier || (state && state.overdrive));
  const seed = Math.abs(((state && state.year) || 2026) * 52 + ((state && state.week) || 1));
  const heroId = (state && state.hero !== undefined && state.hero !== null) ? state.hero : -1;

  let oppId;
  let oppName;
  let tierTitle = "";
  let bossDialogue = "";

  if (isApex) {
    oppId = (typeof BOSS_ID !== "undefined") ? BOSS_ID : (poolSize - 1);
    oppName = (typeof FIGHTERS !== "undefined" && FIGHTERS[oppId]) ? FIGHTERS[oppId].name : "Supreme Weekly Sovereign";
    tierTitle = "APEX WEEKLY SOVEREIGN";
    bossDialogue = "You have dominated the tournament. Now face the absolute master of " + ((state && state.mutator && state.mutator.name) || "this Arena") + "!";
  } else if (isOverdrive) {
    oppId = (seed + t * 9 + 5) % poolSize;
    if (oppId === heroId) oppId = (oppId + 1) % poolSize;
    oppName = (typeof FIGHTERS !== "undefined" && FIGHTERS[oppId]) ? FIGHTERS[oppId].name : ("Overdrive Titan #" + t);
    tierTitle = "OVERDRIVE TIER " + t;
    bossDialogue = "The weekly arena has unlocked its infinite overdrive. Test your limits!";
  } else {
    oppId = (seed + t * 7 + 3) % poolSize;
    if (oppId === heroId) oppId = (oppId + 1) % poolSize;
    oppName = (typeof FIGHTERS !== "undefined" && FIGHTERS[oppId]) ? FIGHTERS[oppId].name : ("Contender Tier " + t);
    const tierTitles = ["", "PRELIMINARY QUALIFIER", "QUARTER-FINAL CONTENDER", "SEMI-FINAL CHAMPION", "DIVISION FINAL MASTER"];
    tierTitle = tierTitles[t] || ("TOURNAMENT TIER " + t);
    bossDialogue = "Let us see if you can survive the weekly ruleset!";
  }

  // Progressive stat scaling curve
  let statMul = 1.0;
  let hpMul = 1.0;

  if (isOverdrive) {
    const odTiers = t - WEEKLY_CONFIG.maxTier;
    statMul = 1.40 + odTiers * WEEKLY_CONFIG.overdriveScale;
    hpMul = 1.35 + odTiers * (WEEKLY_CONFIG.overdriveScale * 1.2);
  } else if (isApex) {
    statMul = 1.45;
    hpMul = 1.35;
  } else {
    // Tiers 1 to 4
    const scale = [1.0, 1.0, 1.10, 1.20, 1.30][t] || 1.0;
    statMul = scale;
    hpMul = 1.0 + (t - 1) * 0.08;
  }

  // Secondary Wildcard Mutator activates in Tiers 4, 5, and Overdrive
  const hasSecondary = (t >= 4);
  const secondary = hasSecondary ? ((state && state.secondaryMutator) || getSecondaryMutator((state && state.mutator && state.mutator.id) || "GLASS_CANNON", seed + 7)) : null;

  return {
    id: oppId,
    tier: t,
    name: oppName,
    tierTitle: tierTitle,
    bossTitle: isApex ? "APEX WEEKLY SOVEREIGN" : (isOverdrive ? "OVERDRIVE TITAN" : tierTitle),
    bossDialogue: bossDialogue,
    dialogue: { intro: bossDialogue, rematch: bossDialogue, win: bossDialogue },
    isApex: isApex,
    isOverdrive: isOverdrive,
    hasSecondary: hasSecondary,
    secondaryMutator: secondary,
    statMul: parseFloat(statMul.toFixed(2)),
    hpMul: parseFloat(hpMul.toFixed(2)),
  };
}

function weeklyAdvanceTier(state, won, duelStats) {
  if (!state) return { active: false, tier: 1, score: 0 };

  const st = duelStats || {};
  const currentTier = state.tier || 1;
  const opp = weeklyOpponentForTier(state, currentTier);

  if (!won) {
    // Check Corner Respite retry lives
    if (state.respitesLeft > 0) {
      state.respitesLeft--;
      state.stats = state.stats || {};
      state.stats.respitesUsed = (state.stats.respitesUsed || 0) + 1;
      // Revive fighter at 60% HP
      state.hp = Math.round(state.maxhp * 0.60);
      return {
        active: true,
        tier: state.tier,
        score: state.score,
        respiteUsed: true,
        respitesLeft: state.respitesLeft,
        victorious: false,
        overdrive: state.overdrive,
      };
    } else {
      state.active = false;
      return {
        active: false,
        tier: state.tier,
        score: state.score,
        gameOver: true,
        respitesLeft: 0,
        victorious: !!state.victorious,
        overdrive: !!state.overdrive,
      };
    }
  }

  // Tier Victory Scoring
  const hpRatio = (typeof st.hpLeft === "number") ? st.hpLeft : 0.5;
  const hpBonus = Math.round(hpRatio * 200);
  const speedBonus = st.turns && st.turns <= 5 ? 300 : (st.turns && st.turns <= 8 ? 150 : 50);
  const bossBonus = opp.isApex ? 2000 : (opp.isOverdrive ? 600 : (currentTier === 4 ? 400 : 0));
  const flairBonus = (st.comboMax >= 3 ? 100 : 0) + (st.perfectGuards ? st.perfectGuards * 30 : 0);

  const tierScore = currentTier * 350 + hpBonus + speedBonus + bossBonus + flairBonus;
  state.score = (state.score || 0) + tierScore;

  // Purse earnings
  const basePurse = 50 + currentTier * 20 + (opp.isApex ? 250 : 0);
  state.purse = (state.purse || 0) + basePurse;

  // Track stats
  state.stats = state.stats || {};
  state.stats.wins = (state.stats.wins || 0) + 1;
  state.stats.kos = (state.stats.kos || 0) + 1;
  if (st.hpLeft && st.hpLeft >= 0.99) state.stats.perfects = (state.stats.perfects || 0) + 1;
  if (st.turns) state.stats.turns = (state.stats.turns || 0) + st.turns;
  if (st.dmgDealt) state.stats.totalDmg = (state.stats.totalDmg || 0) + st.dmgDealt;

  // Camp Health Recovery
  const healAmount = Math.round(state.maxhp * WEEKLY_CONFIG.healPerTier);
  state.hp = Math.min(state.maxhp, (state.hp || state.maxhp) + healAmount);

  // Check for Tier 5 Grand Victory
  let justWonGrandClimax = false;
  if (currentTier === WEEKLY_CONFIG.maxTier && !state.overdrive) {
    state.victorious = true;
    justWonGrandClimax = true;
    state.score += WEEKLY_CONFIG.climaxBonusScore;
    state.purse += WEEKLY_CONFIG.climaxBonusPurse;
  }

  // Advance Tier
  state.tier++;

  return {
    active: true,
    tier: state.tier,
    score: state.score,
    purse: state.purse,
    hp: state.hp,
    maxhp: state.maxhp,
    respitesLeft: state.respitesLeft,
    needsAugment: true,
    isGrandVictory: justWonGrandClimax,
    victorious: state.victorious,
    overdrive: state.overdrive,
  };
}

function weeklyAugmentChoices(state, count) {
  const cnt = count || 3;
  const heldAugments = (state && state.augments) || [];

  const pool = WEEKLY_AUGMENTS.filter(a => heldAugments.indexOf(a.id) < 0);
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, cnt);
}

function applyWeeklyAugment(state, augmentId) {
  if (!state || !augmentId) return false;
  const aug = WEEKLY_AUGMENTS.find(a => a.id === augmentId);
  if (!aug) return false;

  state.augments = state.augments || [];
  if (state.augments.indexOf(aug.id) < 0) {
    state.augments.push(aug.id);
  }

  // Handle immediate stat modifiers
  if (aug.hpMul && aug.hpMul > 1.0) {
    const oldMax = state.maxhp;
    state.maxhp = Math.round(state.maxhp * aug.hpMul);
    state.hp = state.hp + (state.maxhp - oldMax);
  }
  if (aug.respiteBonus) {
    state.respitesLeft = (state.respitesLeft || 0) + aug.respiteBonus;
  }

  return true;
}

function weeklyCornerActions(state) {
  const s = state || {};
  return [
    {
      id: "clinic_heal",
      name: "Medical Clinic (Heal +45% HP)",
      cost: 0,
      desc: "Emergency bandage treatment and ice compression restoring +45% HP.",
      available: (s.hp < s.maxhp),
    },
    {
      id: "buy_salts",
      name: "Smelling Salts (Corner Item)",
      cost: 50,
      desc: "Instant corner awakening restoring +15 priority on next turn.",
      available: (s.purse >= 50 && (!s.bag || s.bag.indexOf("salts") < 0)),
    },
    {
      id: "buy_syringe",
      name: "Adrenaline Stim (Corner Item)",
      cost: 75,
      desc: "Emergency corner stim restoring +40 Stamina when winded.",
      available: (s.purse >= 75 && (!s.bag || s.bag.indexOf("syringe") < 0)),
    },
    {
      id: "buy_respite",
      name: "Corner Respite Token (+1 Life)",
      cost: 160,
      desc: "Second wind reserve: allows retrying a defeated tier.",
      available: (s.purse >= 160 && s.respitesLeft < 3),
    },
    {
      id: "spar_drill",
      name: "Sparring Drill (+15% Power)",
      cost: 90,
      desc: "Focus mitts training with cornerman for +15% technique impact.",
      available: (s.purse >= 90),
    },
  ];
}

weeklyCornerActions.clinic = function(state) {
  if (!state || state.hp >= state.maxhp) return { ok: false, msg: "Already at full health" };
  const heal = Math.round(state.maxhp * 0.45);
  state.hp = Math.min(state.maxhp, state.hp + heal);
  return { ok: true, healed: heal, hp: state.hp };
};

weeklyCornerActions.buyItem = function(state, itemId) {
  if (!state) return { ok: false };
  state.bag = state.bag || [];
  let cost = 50;
  if (itemId === "syringe") cost = 75;
  if (itemId === "respite") cost = 160;
  if (itemId === "drill") cost = 90;

  if (state.purse < cost) return { ok: false, msg: "Insufficient purse coins" };
  state.purse -= cost;

  if (itemId === "respite") {
    state.respitesLeft = (state.respitesLeft || 0) + 1;
  } else if (itemId === "drill") {
    state.drilledTier = (state.drilledTier || 0) + 1;
  } else {
    if (!state.bag.includes(itemId)) state.bag.push(itemId);
  }

  return { ok: true, itemId: itemId, remainingPurse: state.purse };
};

const WeeklyMutator = {
  WEEKLY_CONFIG,
  WEEKLY_MUTATORS,
  SECONDARY_MUTATORS,
  WEEKLY_AUGMENTS,
  getWeekNumber,
  getIsoWeekYear,
  getSecondaryMutator,
  getWeeklyMutator,
  formatWeeklyCountdown,
  DEF_WEEKLY_STATE,
  weeklyOpponentForTier,
  weeklyAdvanceTier,
  weeklyAugmentChoices,
  applyWeeklyAugment,
  weeklyCornerActions,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WeeklyMutator;
}
