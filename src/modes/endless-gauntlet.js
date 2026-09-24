/* =====================================================================
   Aqua Zero Heavens Arena - Endless Survival Gauntlet Mode
   Luminara Digital

   10x Rogue-lite Survival Gauntlet with state memory/persistence,
   dynamic wave affixes, 10-wave championship campaign, milestone
   boss encounters (Wave 5 Gatekeeper, Wave 10 Apex Sovereign),
   tactical draft intervals, sacred seal infusions, camp corner
   preparation, Grand Victory climax, and infinite Endless Overdrive.
   ===================================================================== */

const ENDLESS_CONFIG = {
  hpScalePerWave: 0.04,
  powScalePerWave: 0.03,
  draftInterval: 2,       // Draft technique every 2 waves
  perkInterval: 3,        // Choose Sacred Seal/Perk every 3 waves
  bossInterval: 5,        // Boss encounter every 5 waves
  climaxWave: 10,         // Wave 10 is the Apex Sovereign Grand Climax
  healPerWave: 0.30,      // Base camp health recovery ratio
  startingPurse: 100,
};

const GAUNTLET_AFFIXES = [
  { id: "standard", name: "Standard Bout", tag: "STANDARD", desc: "Pure combat rules. No arena hazards.", color: "#94a3b8" },
  { id: "clinch_pit", name: "Clinch Pit", tag: "HAZARD", desc: "Both fighters start locked in CLINCH range.", range: "CLINCH", color: "#f59e0b" },
  { id: "adrenaline", name: "Adrenaline Surge", tag: "SURGE", desc: "Fighters start the bout with 50% Super meter.", superStart: 50, color: "#ec4899" },
  { id: "counter_storm", name: "Counter Arena", tag: "PRECISION", desc: "Predictive counter strikes inflict +40% bonus damage.", counterBonus: 1.4, color: "#e6392f" },
  { id: "iron_fortress", name: "Iron Fortress", tag: "DEFENSE", desc: "Incoming damage reduced by 15% for both combatants.", defBonus: 1.15, color: "#3b82f6" },
  { id: "stamina_gale", name: "Gale Wind", tag: "FLOW", desc: "Technique stamina costs reduced by 20%.", stamMul: 0.8, color: "#22d3ee" },
  { id: "bounty_rush", name: "Gold Bounty Match", tag: "BOUNTY", desc: "Clearing this wave awards +120 bonus Purse coins.", purseBonus: 120, scoreBonus: 300, color: "#eab308" }
];

const GAUNTLET_PERKS = [
  { id: "g_vampire", name: "Vampiric Leech", type: "seal", tag: "SUSTAIN", desc: "Heal 25% of unmitigated strike damage dealt.", sealId: "SEAL_VAMPIRE", color: "#ec4899" },
  { id: "g_lightning", name: "Lightning Flow", type: "seal", tag: "TEMPO", desc: "+15 Speed priority and -25% stamina costs.", sealId: "SEAL_LIGHTNING", color: "#22d3ee" },
  { id: "g_breaker", name: "Titan Breaker", type: "seal", tag: "POWER", desc: "+25% Power and pierces 50% guard defense.", sealId: "SEAL_HEAVY", color: "#f59e0b" },
  { id: "g_viper", name: "Venom Fang", type: "seal", tag: "STATUS", desc: "Strikes have 75% chance to inflict Bleeding.", sealId: "SEAL_VIPER", color: "#10b981" },
  { id: "g_counter", name: "Counter Specialist", type: "seal", tag: "PRECISION", desc: "+45% damage on predictive counter strikes.", sealId: "SEAL_COUNTER", color: "#e6392f" },
  { id: "g_flow", name: "Wind Flow", type: "seal", tag: "FLOW", desc: "+12 Accuracy and refunds 10 Stamina on clean hits.", sealId: "SEAL_FLOW", color: "#a855f7" },
  { id: "g_second_wind", name: "Second Wind", type: "benefit", tag: "RECOVERY", desc: "Regenerate +6 Stamina at the end of each turn.", benefitId: "second_wind", color: "#38bdf8" },
  { id: "g_granite", name: "Granite Chin", type: "benefit", tag: "DEFENSE", desc: "Reduce all incoming damage taken by 12%.", benefitId: "granite_chin", color: "#64748b" },
  { id: "g_deep_water", name: "Deep Water", type: "benefit", tag: "DESPERATION", desc: "Deal +25% damage when below 50% health.", benefitId: "deep_water", color: "#0284c7" },
  { id: "g_fast_starter", name: "Fast Starter", type: "benefit", tag: "BURST", desc: "Start every combat round with a full Super meter.", benefitId: "fast_starter", color: "#f43f5e" },
  { id: "g_gas_tank", name: "Gas Tank", type: "benefit", tag: "CONDITIONING", desc: "+25 Max Stamina and start every duel full.", benefitId: "gas_tank", color: "#10b981" },
  { id: "g_fourth_link", name: "The Fourth Link", type: "benefit", tag: "EDGE", desc: "Your attack combinations may chain 4 links deep.", benefitId: "edge_fourth_link", color: "#fbbf24" },
];

function DEF_ENDLESS_STATE(heroId) {
  const baseHp = (typeof hpOf === "function" && heroId !== undefined) ? hpOf(heroId) : 100;
  return {
    hero: heroId || 0,
    wave: 1,
    stage: 1,
    score: 0,
    highWave: 1,
    draftsWon: 0,
    hp: baseHp,
    maxhp: baseHp,
    purse: ENDLESS_CONFIG.startingPurse,
    drafted: [],
    drilled: {},
    retired: [],
    seals: {},
    benefits: [],
    bag: ["salts", "ice"],
    bounties: null,
    stats: {
      wins: 0,
      kos: 0,
      bossWins: 0,
      perfects: 0,
      totalDmg: 0,
      turns: 0,
    },
    victorious: false,
    overdrive: false,
    active: true,
  };
}

function endlessOpponentForWave(wave, rosterSize) {
  const w = Math.max(1, Math.round(wave || 1));
  const isBoss = (w % ENDLESS_CONFIG.bossInterval === 0);
  const isApex = (w === ENDLESS_CONFIG.climaxWave);
  /* Roster size is FIGHTERS.length - never ORDER.length, and an opponent id is
     an index into FIGHTERS - never an entry of ORDER. ORDER holds the deck
     growth arrays, so ORDER[i] is an ARRAY of card indices: feeding one to
     hpOf / battlePool / FIGHTERS[...] threw on the way into every ordinary
     wave, which is why the gauntlet could never seat a second fight. The same
     mistake was already found and fixed in weeklyOpponentForTier. */
  const poolSize = rosterSize || (typeof FIGHTERS !== "undefined" ? FIGHTERS.length : 24);
  
  let oppId;
  let oppName;
  let bossTitle = "";
  let bossDialogue = "";

  if (isApex) {
    oppId = (typeof BOSS_ID !== "undefined") ? BOSS_ID : (poolSize - 1);
    oppName = "Supreme Sovereign of Heavens Arena";
    bossTitle = "APEX SOVEREIGN";
    bossDialogue = "You have conquered all challengers. Now face the absolute peak of the Heavens!";
  } else if (isBoss) {
    oppId = Math.floor(w / ENDLESS_CONFIG.bossInterval) % poolSize;
    oppName = "Gatekeeper of Tier " + Math.floor(w / ENDLESS_CONFIG.bossInterval);
    bossTitle = "TIER GATEKEEPER";
    bossDialogue = "None pass this milestone without proving their true martial resolve!";
  } else {
    oppId = (w * 7 + 3) % poolSize;
    oppName = (typeof FIGHTERS !== "undefined" && FIGHTERS[oppId]) ? FIGHTERS[oppId].name : ("Gladiator #" + w);
  }

  // Scaling curve: progressive scaling with boss power surges and intense Overdrive scaling
  const overdriveMul = (w > ENDLESS_CONFIG.climaxWave) ? ((w - ENDLESS_CONFIG.climaxWave) * 0.05) : 0;
  const baseStatMul = 1.0 + (w - 1) * ENDLESS_CONFIG.powScalePerWave + overdriveMul;
  const baseHpMul = 1.0 + (w - 1) * ENDLESS_CONFIG.hpScalePerWave + overdriveMul * 1.2;
  const bossBonus = isApex ? 0.35 : (isBoss ? 0.20 : 0);

  const statMul = parseFloat((baseStatMul + bossBonus).toFixed(2));
  const hpMul = parseFloat((baseHpMul + bossBonus * 1.2).toFixed(2));

  // Select dynamic wave affix (Standard on boss waves to keep fight fair and focused)
  const affix = isBoss ? GAUNTLET_AFFIXES[0] : GAUNTLET_AFFIXES[w % GAUNTLET_AFFIXES.length];

  return {
    id: oppId,
    wave: w,
    isBoss: isBoss,
    isApex: isApex,
    name: oppName,
    bossTitle: bossTitle,
    bossDialogue: bossDialogue,
    dialogue: { intro: bossDialogue, rematch: bossDialogue, win: bossDialogue },
    statMul: statMul,
    hpMul: hpMul,
    affix: affix,
  };
}

function endlessAdvanceWave(state, won, duelStats) {
  if (!state) return { active: false, wave: 1, score: 0 };
  
  if (!won) {
    state.active = false;
    return {
      active: false,
      wave: state.wave,
      score: state.score,
      highWave: Math.max(state.highWave || 1, state.wave),
      victorious: !!state.victorious,
      overdrive: !!state.overdrive,
    };
  }

  const st = duelStats || {};
  const currentWave = state.wave;
  const opp = endlessOpponentForWave(currentWave);

  // Score calculation: wave base + remaining HP ratio bonus + speed bonus
  const hpBonus = st.hpLeft ? Math.round(st.hpLeft * 150) : 50;
  const speedBonus = st.turns && st.turns <= 6 ? 200 : (st.turns && st.turns <= 10 ? 100 : 0);
  const bossBonus = opp.isApex ? 1500 : (opp.isBoss ? 600 : 0);
  const affixScore = (opp.affix && opp.affix.scoreBonus) || 0;

  const waveScore = currentWave * 150 + hpBonus + speedBonus + bossBonus + affixScore;
  state.score = (state.score || 0) + waveScore;

  // Purse earnings
  const basePurse = 40 + currentWave * 10 + (opp.isBoss ? 100 : 0) + ((opp.affix && opp.affix.purseBonus) || 0);
  state.purse = (state.purse || 0) + basePurse;

  // Track stats
  state.stats = state.stats || {};
  state.stats.wins = (state.stats.wins || 0) + 1;
  state.stats.kos = (state.stats.kos || 0) + 1;
  if (opp.isBoss) state.stats.bossWins = (state.stats.bossWins || 0) + 1;
  if (st.hpLeft && st.hpLeft >= 0.99) state.stats.perfects = (state.stats.perfects || 0) + 1;
  if (st.turns) state.stats.turns = (state.stats.turns || 0) + st.turns;

  // Camp Health Recovery (treat wounds)
  const healRatio = ENDLESS_CONFIG.healPerWave;
  const healAmount = Math.round(state.maxhp * healRatio);
  state.hp = Math.min(state.maxhp, (state.hp || state.maxhp) + healAmount);

  // Check for Wave 10 Apex Climax Victory
  let justWonApex = false;
  if (currentWave === ENDLESS_CONFIG.climaxWave && !state.overdrive) {
    state.victorious = true;
    justWonApex = true;
    state.score += 2500;
    state.purse += 500;
  }

  // Wave advancement
  state.wave++;
  state.stage = Math.min(6, Math.max(1, Math.floor((state.wave - 1) / 3) + 1));
  if (state.wave > (state.highWave || 1)) state.highWave = state.wave;

  // Feature unlock flags
  const needsDraft = (state.wave - 1) % ENDLESS_CONFIG.draftInterval === 0;
  const needsPerk = (state.wave - 1) % ENDLESS_CONFIG.perkInterval === 0 || opp.isBoss;

  return {
    active: true,
    wave: state.wave,
    score: state.score,
    purse: state.purse,
    highWave: state.highWave,
    needsDraft: needsDraft,
    needsPerk: needsPerk,
    isApexVictory: justWonApex,
    victorious: state.victorious,
    overdrive: state.overdrive,
  };
}

function gauntletPerkChoices(state, count) {
  const cnt = count || 3;
  const heldBenefits = (state && state.benefits) || [];
  const heldSeals = (state && state.seals) || {};

  // Filter out perks that grant benefits or seals already held
  const pool = GAUNTLET_PERKS.filter(p => {
    if (p.benefitId && heldBenefits.indexOf(p.benefitId) >= 0) return false;
    return true;
  });

  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, cnt);
}

function applyGauntletPerk(state, perkId, targetTechId) {
  if (!state || !perkId) return false;
  const perk = GAUNTLET_PERKS.find(p => p.id === perkId || p.sealId === perkId || p.benefitId === perkId || ("PERK_" + (p.sealId || p.benefitId)) === perkId);
  if (!perk) return false;

  if (perk.benefitId) {
    state.benefits = state.benefits || [];
    if (state.benefits.indexOf(perk.benefitId) < 0) {
      state.benefits.push(perk.benefitId);
    }
  }

  if (perk.sealId) {
    state.seals = state.seals || {};
    const techToSeal = targetTechId || (state.drafted && state.drafted[0]) || "jab";
    state.seals[techToSeal] = perk.sealId;
  }

  return true;
}

function gauntletRestActions(state) {
  const s = state || {};
  return [
    {
      id: "treat_wounds",
      name: "Medical Clinic (Heal +40% HP)",
      cost: 0,
      desc: "Bandage cuts and treat fatigue to restore vital health.",
      available: (s.hp < s.maxhp),
    },
    {
      id: "buy_salts",
      name: "Smelling Salts (Corner Item)",
      cost: 45,
      desc: "Equip smelling salts in your corner bag for +15 priority next turn.",
      available: (s.purse >= 45 && (!s.bag || s.bag.indexOf("salts") < 0)),
    },
    {
      id: "buy_syringe",
      name: "Adrenaline Syringe (Corner Item)",
      cost: 65,
      desc: "Emergency corner stim restoring +35 Stamina when winded.",
      available: (s.purse >= 65 && (!s.bag || s.bag.indexOf("syringe") < 0)),
    },
    {
      id: "drill_tech",
      name: "Sparring Drill (+15% Power)",
      cost: 80,
      desc: "Drill your best technique with your cornerman for +15% power & +5 accuracy.",
      available: (s.purse >= 80),
    },
  ];
}

gauntletRestActions.clinic = function(state) {
  if (!state || state.hp >= state.maxhp) return { ok: false, msg: "Already at full health" };
  const heal = Math.round(state.maxhp * 0.40);
  state.hp = Math.min(state.maxhp, state.hp + heal);
  return { ok: true, healed: heal, hp: state.hp };
};

gauntletRestActions.cornerSupply = function(state, itemId) {
  if (!state) return { ok: false };
  state.bag = state.bag || [];
  const cost = itemId === "syringe" ? 65 : 45;
  if (state.purse < cost) return { ok: false, msg: "Insufficient purse" };
  state.purse -= cost;
  if (!state.bag.includes(itemId)) state.bag.push(itemId);
  return { ok: true, itemId: itemId, remainingPurse: state.purse };
};

const EndlessGauntlet = {
  ENDLESS_CONFIG,
  GAUNTLET_AFFIXES,
  GAUNTLET_PERKS,
  DEF_ENDLESS_STATE,
  endlessOpponentForWave,
  endlessAdvanceWave,
  gauntletPerkChoices,
  applyGauntletPerk,
  gauntletRestActions,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = EndlessGauntlet;
}

