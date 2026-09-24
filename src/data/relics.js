/* =====================================================================
   Aqua Zero Heavens Arena - Synergistic Relics & Artifact Engine
   Luminara Digital

   The Balatro / Slay the Spire synergy layer for Adventure & Gauntlet runs.
   Unlike baseline benefits (which are strictly conservative and additive),
   Relics introduce exponential multi-tier synergies, resource conversions,
   and game-breaking combo loops.

   Rarity Tiers:
     COMMON        Foundational building blocks (bleed on hits, momentum banks)
     UNCOMMON      Resource converters (bleed to stamina, wall-bounce momentum)
     RARE          Exponential multipliers (xMult based on Style, conditions)
     TRANSCENDENT  Rule breakers (unlimited combo chains, unblockable setups)

   Lifecycle Hooks:
     onFightStart(ctx)          As the opening bell rings
     onTurnStart(ctx)           Beginning of turn decision phase
     onPreStrike(ctx)           Before accuracy & stamina checks
     onHit(ctx)                 When an attack connects
     onDmgCalc(dmg, ctx)        During damage calculation (xMult phase)
     onGuard(ctx)               When defending or parrying
     onCounter(ctx)             When landing a parry/reversal counter
     onStatusApplied(ctx)       When Bleed, Stun, Winded, etc. is inflicted
     onComboLink(ctx)           When advancing combinations
     onTurnEnd(ctx)             End of round upkeep
   ===================================================================== */

const RELICS = {};
const RELIC_IDS = [];
const RELIC_TIERS = ["COMMON", "UNCOMMON", "RARE", "TRANSCENDENT"];

function defineRelic(id, name, desc, tier, tag, hooks) {
  RELICS[id] = Object.assign({ id, name, desc, tier: tier || "COMMON", tag: tag || "GENERAL" }, hooks || {});
  RELIC_IDS.push(id);
}

/* =====================================================================
   1. COMMON RELICS - Tactical Foundations
   ===================================================================== */
defineRelic("serrated_tape", "Serrated Wraps", "Every landed strike builds 1 Bleed stack (inflicts BLEEDING at 3 stacks).", "COMMON", "STRIKE", {
  onHit: (ctx) => {
    if (ctx.tech && ctx.tech.cls === "STRIKE" && ctx.side === ctx.d.p) {
      ctx.state.serratedHits = (ctx.state.serratedHits || 0) + 1;
      if (ctx.state.serratedHits >= 3) {
        if (typeof addStatus === "function") addStatus(ctx.foe, "BLEEDING");
        ctx.state.serratedHits = 0;
        if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("LACERATED!", sideX(ctx.d, ctx.foe), 240, "LACERATED");
      }
    }
  }
});

defineRelic("rubber_soles", "Pugilist Grip", "+10 accuracy on all attacks, and footwork costs 3 less stamina.", "COMMON", "FOOTWORK", {
  onPreStrike: (ctx) => {
    if (ctx.side === ctx.d.p) {
      ctx.side.accBonus = (ctx.side.accBonus || 0) + 10;
    }
  }
});

/* "a fifth of them", not "20 damage": the flat number was written against
   a TECH_DMG_SCALE that has moved twice since, so the card's promise drifted
   every time fight length was tuned. See dmgShare() in battle/effects.js. */
defineRelic("hydrazine_salts", "Adrenaline Sniff", "Gain 1 Focus point whenever one exchange takes a fifth of the opponent's health.", "COMMON", "MOMENTUM", {
  onHit: (ctx) => {
    if (ctx.side === ctx.d.p && ctx.ev && dmgShare(ctx.foe, ctx.ev.dmg) >= 0.20) {
      if (typeof gainFocus === "function") gainFocus(ctx.side, 1);
      if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("+1 FOCUS", sideX(ctx.d, ctx.side), 210, "FOCUS");
    }
  }
});

defineRelic("weighted_gloves", "Iron Plating", "Strikes deal +15% damage and push opponent 15 position pressure toward the ropes.", "COMMON", "PRESSURE", {
  onDmgCalc: (dmg, ctx) => {
    if (ctx.side === ctx.d.p && ctx.tech && ctx.tech.cls === "STRIKE") return Math.round(dmg * 1.15);
    return dmg;
  },
  onHit: (ctx) => {
    if (ctx.side === ctx.d.p && typeof pushPosition === "function") {
      pushPosition(ctx.d, 15);
    }
  }
});

defineRelic("ankle_locks", "Mat Anchor", "Takedowns and throws cannot be countered by sprawls.", "COMMON", "GRAPPLE", {
  preventSprawl: true
});

/* =====================================================================
   2. UNCOMMON RELICS - Resource Converters & Catalysts
   ===================================================================== */
defineRelic("crimson_valve", "Crimson Valve", "Whenever Bleed deals damage, refund 8 stamina to you and double the tick.", "UNCOMMON", "STATUS", {
  onStatusApplied: (ctx) => {
    if (ctx.key === "BLEEDING" && ctx.target === ctx.foe && ctx.side === ctx.d.p) {
      ctx.side.stam = Math.min(ctx.side.maxStam, ctx.side.stam + 8);
    }
  },
  onTurnEnd: (ctx) => {
    if (ctx.side === ctx.d.p && ctx.foe && ctx.foe.cond && ctx.foe.cond.BLEEDING) {
      ctx.side.stam = Math.min(ctx.side.maxStam, ctx.side.stam + 8);
      ctx.foe.hp = Math.max(0, ctx.foe.hp - 4);
      if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("HEMO DRAIN", sideX(ctx.d, ctx.foe), 230, "BLEED");
    }
  }
});

defineRelic("counter_prism", "Viper Shard", "Parry and reversal counters deal 2.0x critical damage and stun the opponent.", "UNCOMMON", "COUNTER", {
  onCounter: (ctx) => {
    if (ctx.side === ctx.d.p && ctx.ev && ctx.ev.counter) {
      ctx.ev.counter = Math.round(ctx.ev.counter * 2.0);
      if (typeof addStatus === "function") addStatus(ctx.foe, "STUNNED");
      if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("VIPER STUN!", sideX(ctx.d, ctx.foe), 250, "COUNTER");
    }
  }
});

defineRelic("hydraulic_piston", "Kinetic Battery", "Each landed strike stores kinetic charge (+4 flat damage on your next hit, stacks up to 5).", "UNCOMMON", "MOMENTUM", {
  onHit: (ctx) => {
    if (ctx.side === ctx.d.p) {
      ctx.state.charge = Math.min(5, (ctx.state.charge || 0) + 1);
    }
  },
  onDmgCalc: (dmg, ctx) => {
    if (ctx.side === ctx.d.p && ctx.state.charge) {
      const bonus = ctx.state.charge * 4;
      ctx.state.charge = 0;
      return dmg + bonus;
    }
    return dmg;
  }
});

defineRelic("mat_tyrant", "Mat Tyrant", "Takedowns against OFF_BALANCE or DAZED targets bypass guard completely and transition immediately to PINNED.", "UNCOMMON", "GRAPPLE", {
  onHit: (ctx) => {
    if (ctx.side === ctx.d.p && ctx.tech && ctx.tech.cls === "THROW" && ctx.foe.cond && (ctx.foe.cond.OFF_BALANCE || ctx.foe.cond.DAZED)) {
      if (typeof addStatus === "function") addStatus(ctx.foe, "PINNED");
      if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("PINNED SLAM!", sideX(ctx.d, ctx.foe), 260, "SUBMISSION");
    }
  }
});

/* =====================================================================
   3. RARE RELICS - Exponential Multipliers (Balatro xMult)
   ===================================================================== */
defineRelic("neon_spotlight", "Neon Spotlight", "Your damage is multiplied by your Style Grade: D=1.0x, C=1.2x, B=1.45x, A=1.75x, S=2.25x, SSS=3.20x.", "RARE", "STYLE", {
  onDmgCalc: (dmg, ctx) => {
    if (ctx.side === ctx.d.p) {
      const grade = (ctx.d.styleState && ctx.d.styleState.lastGrade) || "D";
      const mults = { D: 1.0, C: 1.20, B: 1.45, A: 1.75, S: 2.25, SSS: 3.20 };
      const mult = mults[grade] || 1.0;
      if (mult > 1.0 && typeof FloatingFeedback !== "undefined") {
        FloatingFeedback.add("x" + mult.toFixed(1) + " STYLE MULT!", sideX(ctx.d, ctx.side), 190, "STYLE");
      }
      return Math.round(dmg * mult);
    }
    return dmg;
  }
});

defineRelic("iron_maiden", "Retaliation Core", "Guarding or perfect guarding against an attack reflects 100% of the mitigated damage back at the attacker.", "RARE", "DEFENCE", {
  onGuard: (ctx) => {
    if (ctx.side === ctx.d.p && ctx.ev && ctx.mitigatedDmg > 0) {
      const reflect = Math.round(ctx.mitigatedDmg * 1.0);
      if (typeof hurt === "function") hurt(ctx.foe, reflect, ctx.d, ctx.side);
      if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("REFLECTED " + reflect, sideX(ctx.d, ctx.foe), 230, "COUNTER");
    }
  }
});

defineRelic("apex_predator", "Apex Executioner", "Deal 2.5x critical damage against any opponent afflicted with 2 or more conditions.", "RARE", "STATUS", {
  onDmgCalc: (dmg, ctx) => {
    if (ctx.side === ctx.d.p && ctx.foe && ctx.foe.cond) {
      let activeConds = 0;
      for (const k in ctx.foe.cond) if (ctx.foe.cond[k]) activeConds++;
      if (activeConds >= 2) {
        if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("2.5x EXECUTION!", sideX(ctx.d, ctx.side), 190, "CRITICAL");
        return Math.round(dmg * 2.5);
      }
    }
    return dmg;
  }
});

defineRelic("glass_katana", "Berserker Drive", "+80% damage dealt on all attacks, but you take +30% damage.", "RARE", "GLASS", {
  onDmgCalc: (dmg, ctx) => (ctx.side === ctx.d.p ? Math.round(dmg * 1.80) : dmg),
  dmgIn: (dmg, ctx) => (ctx.side === ctx.d.p ? Math.round(dmg * 1.30) : dmg)
});

/* =====================================================================
   4. TRANSCENDENT RELICS - Game-Breaking Rule Benders
   ===================================================================== */
defineRelic("ouroboros_chain", "Ouroboros Flurry", "Combinations have no link cap. Each link past the 2nd gains 1.35x exponential damage and refunds 50% stamina.", "TRANSCENDENT", "CHAIN", {
  chainCapOverride: 99,
  onComboLink: (ctx) => {
    if ((!ctx.d || ctx.side === ctx.d.p) && ctx.linkIndex >= 2) {
      ctx.chainMult = Math.pow(1.35, ctx.linkIndex - 1);
      if (ctx.cost) ctx.side.stam = Math.min(ctx.side.maxStam, ctx.side.stam + Math.round(ctx.cost * 0.5));
    }
  }
});

defineRelic("shadow_stance", "All-Seeing Stance", "The opponent's exact technique is ALWAYS revealed without spending Focus, and your attacks gain +1 Priority bracket.", "TRANSCENDENT", "INTENT", {
  alwaysTell: true,
  onPreStrike: (ctx) => {
    if (ctx.side === ctx.d.p) {
      ctx.side.prioBoost = (ctx.side.prioBoost || 0) + 1;
    }
  }
});

defineRelic("phoenix_ember", "Phoenix Ember", "Surviving on under 15% HP triggers Awakening: full stamina recovery, +100% damage, and invulnerability for 1 turn.", "TRANSCENDENT", "DESPERATION", {
  onTurnStart: (ctx) => {
    if (ctx.side === ctx.d.p && ctx.side.hp <= ctx.side.maxhp * 0.15 && !ctx.state.awakened) {
      ctx.state.awakened = true;
      ctx.side.stam = ctx.side.maxStam;
      ctx.side.atkMul = (ctx.side.atkMul || 1) * 2.0;
      ctx.side.invulnerable = 1;
      if (typeof FloatingFeedback !== "undefined") FloatingFeedback.add("PHOENIX AWAKENING!", sideX(ctx.d, ctx.side), 180, "CRITICAL");
      if (typeof spectacleBurst === "function") spectacleBurst(ctx.d.fx, sideX(ctx.d, ctx.side), 300, "#f59e0b", 40, 5.0);
    }
  }
});

/* =====================================================================
   RELIC ENGINE DISPATCHER & REWARD GENERATION
   ===================================================================== */
const _relicStateCache = new WeakMap();

function getRelicState(relicList) {
  if (!relicList || typeof relicList !== "object") return {};
  if (!_relicStateCache.has(relicList)) _relicStateCache.set(relicList, {});
  return _relicStateCache.get(relicList);
}

function relicHook(heldList, hookName, value, ctx) {
  if (!heldList || !Array.isArray(heldList) || !heldList.length) return value;
  const state = getRelicState(heldList);
  let cur = value;
  const context = (ctx && typeof ctx === "object") ? ctx : (typeof value === "object" && value !== null ? value : {});
  if (!context.state) context.state = state;

  for (let i = 0; i < heldList.length; i++) {
    const id = typeof heldList[i] === "string" ? heldList[i] : (heldList[i] && heldList[i].id);
    const r = RELICS[id];
    if (r && typeof r[hookName] === "function") {
      try {
        let ret;
        if (r[hookName].length === 1) {
          ret = r[hookName](context);
        } else {
          ret = r[hookName](cur, context);
        }
        if (typeof ret === "number") cur = ret;
      } catch (err) {
        console.error("relicHook error in " + id + "." + hookName, err);
      }
    }
  }
  return cur;
}

function relicFlag(heldList, flagName) {
  if (!heldList || !Array.isArray(heldList)) return false;
  for (let i = 0; i < heldList.length; i++) {
    const id = typeof heldList[i] === "string" ? heldList[i] : (heldList[i] && heldList[i].id);
    const r = RELICS[id];
    if (r && r[flagName]) return r[flagName];
  }
  return false;
}

function relicChoices(heldList, targetTier, rnd) {
  const R = rnd || Math.random;
  const held = new Set((heldList || []).map((x) => (typeof x === "string" ? x : x.id)));
  
  let pool = RELIC_IDS.filter((id) => !held.has(id));
  if (targetTier) {
    const tierPool = pool.filter((id) => RELICS[id].tier === targetTier);
    if (tierPool.length >= 3) pool = tierPool;
  }

  // Shuffle & pick 3
  const out = [];
  const copy = pool.slice();
  while (out.length < 3 && copy.length > 0) {
    const idx = Math.floor(R() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RELICS,
    RELIC_IDS,
    RELIC_TIERS,
    relicHook,
    relicFlag,
    relicChoices
  };
}
