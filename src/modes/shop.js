/* =====================================================================
   Aqua Zero Heavens Arena - the gym shop and the purse
   Luminara Digital

   Where the money goes. Every fight pays a purse; between stages you walk
   into the gym and the purse is gone again. That loop - earn a little,
   want a lot, choose - is the whole point of this file.

   Two rules held the numbers in place:

     1. You are never rich. A stage pays for roughly ONE thing that
        matters plus a bit of tape. If a stage ever pays for the whole
        shop, the shop stops being a decision and becomes a checklist.
     2. You are never broke. Losing still pays a show-up cheque, so a bad
        night costs you the difference, not the economy. A player who
        cannot buy anything for two stages has quit the run in their head
        long before the health bar agrees.

   The tuning target, written down so the next person can argue with it:
   a player winning two fights in three, over five stages of three fights,
   earns about 790 and makes about 7-8 purchases. Prices climb per stage
   at 0.30 while purses climb at 0.35, so buying power creeps up about 4%
   a stage - you feel a little richer late, never solvent. Big-ticket
   items (benefits, tier-2 conditioning) cost more than a single stage
   earns on purpose: the only way to own one is to walk past the small
   fixes for a stage and hope nothing bleeds.

   Pure logic. Nothing here draws, reads input or persists - the shop
   screen calls in, gets data, and does its own presenting.

   Assumed globals: TECH, TECH_IDS, BENEFITS, BENEFIT_IDS, DISCIPLINES,
   disciplinesOf(fid).
   Run shape: { hero, level, stage, hp, maxhp, purse, benefits[], drafted[],
                conditioning{}, corner[] }
   ===================================================================== */

/* ---------------------------------------------------------------------
   THE PURSE
   --------------------------------------------------------------------- */
const PURSE = {
  start: 40,          // walking-around money, so stage one is a real choice
  show: 9,            // the loser's cheque - you got paid to show up
  win: 30,            // the honest baseline
  perfect: 14,        // untouched: the crowd pays for a clinic
  submission: 11,     // tapping someone is worth more than out-pointing them
  ko: 7,              // a knockout pays, but the mat pays better in this league
  speed: 10,          // finishing early
  fastTurns: 8,       // ...means inside this many turns
  upset: 9,           // per level of underdog you were
  upsetCap: 3,        // and no more than three levels of it
  boss: 22,           // the fight at the top of a stage
  ranked: 6,          // ladder fights carry a small side purse
  survival: 4,
  revenge: 16,        // settling a grudge with the man who beat you this run
  winStreak: 15,      // 3+ win streak contract performance bonus
  stageStep: 0.35,    // each stage up is a bigger gate
  stageMax: 6,        // beyond which the money stops running away
};

/* stages are 1-based; clamped both ends so a bad stage number cannot
   silently print money */
function stageIndex(stage) {
  return Math.max(1, Math.min(PURSE.stageMax, Math.round(stage || 1)));
}
const purseScale = (stage) => 1 + PURSE.stageStep * (stageIndex(stage) - 1);

/* What one fight pays.
   result is the duelStats block a finished fight leaves behind, plus the
   stage it happened on:
     { win, perfect, turns, hpLeft, koClass, boss, ranked, matchType,
       stage, level, oppLevel, streak }
   Bonuses are deliberately additive rather than multiplied together - a
   perfect fast submission upset should pay very well, not absurdly. */
function purseFor(result) {
  const r = result || {};
  let show = PURSE.show;
  let winBonus = r.win ? PURSE.win : 0;
  let finish = 0;
  let speed = 0;
  let upset = 0;
  let boss = 0;
  let revenge = 0;
  let streak = 0;

  if (r.win) {
    if (r.streak >= 3 || r.winStreak) streak = PURSE.winStreak;
    if (r.perfect || r.dmgTaken === 0) finish += PURSE.perfect;
    if (r.koClass === "SUB") finish += PURSE.submission;
    else if (r.koClass === "STRIKE") finish += PURSE.ko;
    if (r.turns && r.turns <= PURSE.fastTurns) {
      speed = Math.round(PURSE.speed * ((PURSE.fastTurns - r.turns + 1) / PURSE.fastTurns));
    }
    const gap = Math.max(0, Math.min(PURSE.upsetCap, (r.oppLevel || 0) - (r.level || 0)));
    if (gap > 0) upset = PURSE.upset * gap;
    if (r.boss) boss = PURSE.boss;
    if (r.revenge) revenge = PURSE.revenge;
  }
  let modeBonus = 0;
  if (r.matchType === "ranked" || r.ranked) modeBonus += PURSE.ranked;
  if (r.matchType === "survival") modeBonus += PURSE.survival;

  const scale = purseScale(r.stage);
  const gross = Math.max(1, Math.round((show + winBonus + finish + speed + upset + boss + revenge + streak + modeBonus) * scale));

  // If detailed breakdown requested (or via AIPromoter), return full breakdown object
  if (r.detailed) {
    const campFee = Math.round(gross * 0.10);
    const cornerFee = Math.round(gross * 0.10);
    const net = Math.max(1, gross - (campFee + cornerFee));
    return {
      gross: gross,
      show: Math.round(show * scale),
      win: Math.round(winBonus * scale),
      finish: Math.round(finish * scale),
      speed: Math.round(speed * scale),
      upset: Math.round(upset * scale),
      boss: Math.round(boss * scale),
      revenge: Math.round(revenge * scale),
      campFee: campFee,
      cornerFee: cornerFee,
      net: net,
    };
  }

  return gross;
}

/* ---------------------------------------------------------------------
   FIGHT WEEK & EVENT TOKEN STORE (Fight Week Token Pattern)
   --------------------------------------------------------------------- */
const EVENT_TOKEN_STORE = [
  {
    id: "SKIN_GOLDEN_GIS",
    name: "Golden Master Gi",
    desc: "Cosmetic championship attire for the arena",
    costTokens: 5,
    costGlory: 100,
    category: "COSMETIC"
  },
  {
    id: "WALKOUT_HEAVENS_HORN",
    name: "Heavens Horn Stinger",
    desc: "Custom brass orchestral walkout stinger",
    costTokens: 3,
    costGlory: 60,
    category: "AUDIO"
  },
  {
    id: "EDGE_SMUGGLER_PASS",
    name: "Contraband Pass",
    desc: "Guarantees an EDGE benefit appears in next Gym",
    costTokens: 4,
    costGlory: 80,
    category: "RELIC"
  }
];


/* ---------------------------------------------------------------------
   CONDITIONING - permanent for the run
   Bought at the gym, kept until the run ends. Each one is a stat you can
   feel but not a strategy you can skip the fight with: the whole set,
   fully bought, is worth about two good camp benefits and costs about
   three runs' worth of purse, which is to say you will never own it all.

   tiers  how many times it can be bought
   step   what each repeat multiplies the price by - the second Roadwork
          costs 1.55x the first. This is the money sink that stops a
          player who found one good stat from just mashing it.
   side(s, n)  fold into the fight-side stat block, n = tiers owned
   run(run, n) fold into the run itself (health pool lives on the run)
   --------------------------------------------------------------------- */
const CONDITIONING = {};
function CD(id, name, desc, tag, price, tiers, step, hooks) {
  CONDITIONING[id] = Object.assign(
    { id, name, desc, tag, price, tiers, step: step || 1.55 }, hooks || {});
}

CD("roadwork", "Roadwork", "+8 stamina ceiling", "WIND", 46, 4, 1.55,
  { side: (s, n) => { s.maxStam += 8 * n; } });
CD("altitude_camp", "Altitude Camp", "+22 stamina ceiling, and you start every fight full", "WIND", 118, 2, 1.7,
  { side: (s, n) => { s.maxStam += 22 * n; s.stam = s.maxStam; } });

/* health is stored as a fraction of the pool so this file never has to
   know what a full health bar is worth in this build */
CD("weight_room", "Weight Room", "+6% health pool, healed to match", "FRAME", 58, 4, 1.55,
  { run: (run) => bumpPool(run, 0.06) });
CD("neck_and_core", "Neck And Core", "+14% health pool, healed to match", "FRAME", 132, 2, 1.7,
  { run: (run) => bumpPool(run, 0.14) });

CD("mitt_work", "Mitt Work", "+1 focus ceiling", "MIND", 70, 3, 1.6,
  { side: (s, n) => { s.focusMax += n; } });
CD("film_study", "Film Study", "+1 focus ceiling, and one banked at the bell", "MIND", 105, 2, 1.8,
  { side: (s, n) => { s.focusMax += n; s.focus = Math.min(s.focusMax, s.focus + n); } });

/* supRate is a multiplier on signature meter gain - the resolver reads it
   the same way it reads stamMul */
CD("shadowbox", "Shadow Boxing", "signature meter fills 10% faster", "TEMPO", 62, 3, 1.6,
  { side: (s, n) => { s.supRate = (s.supRate || 1) * (1 + 0.10 * n); } });
CD("sparring_camp", "Sparring Camp", "signature fills 15% faster and starts a fifth charged", "TEMPO", 126, 2, 1.7,
  { side: (s, n) => {
      s.supRate = (s.supRate || 1) * (1 + 0.15 * n);
      s.sup = Math.max(s.sup || 0, Math.round(SUP_MAX * 0.2));
    } });

const CONDITIONING_IDS = Object.keys(CONDITIONING);

/* growing the pool heals you by exactly what it added - conditioning makes
   you bigger, it does not make you hurt */
function bumpPool(run, frac) {
  const add = Math.max(1, Math.round(run.maxhp * frac));
  run.maxhp += add;
  run.hp = Math.min(run.maxhp, run.hp + add);
}

const conditioningTier = (run, id) => ((run && run.conditioning) || {})[id] || 0;
/* price of the NEXT one of these, at this stage */
function conditioningPrice(run, id) {
  const c = CONDITIONING[id];
  if (!c) return 0;
  const owned = conditioningTier(run, id);
  return Math.round(c.price * Math.pow(c.step, owned) * priceScale(run && run.stage));
}
/* fold everything bought into a fight-side stat block, mastery-style */
function applyConditioning(side, run) {
  const held = (run && run.conditioning) || {};
  CONDITIONING_IDS.forEach((id) => {
    const n = held[id] || 0;
    if (n > 0 && CONDITIONING[id].side) CONDITIONING[id].side(side, n);
  });
  return side;
}

/* ---------------------------------------------------------------------
   CORNER ITEMS - one shot, used mid-fight
   These are the interesting ones. A corner item that only heals is a
   worse heal, so none of these are only a heal: each one answers a
   specific way a fight goes wrong, which means the right buy depends on
   what beat you last time rather than on a price list.

   fx is a declarative effect the fight resolver reads; `when` is the
   condition the use button should light up on.
   --------------------------------------------------------------------- */
const CORNER_ITEMS = {};
function CK(id, name, desc, price, when, fx) {
  CORNER_ITEMS[id] = { id, name, desc, price, when, fx };
}

CK("cutman_kit", "Cutman's Kit", "close the cut - stops bleeding now, and cuts opened later run half as long",
  32, "BLEEDING", { clear: ["BLEEDING"], bleedMul: 0.5 });

CK("smelling_salts", "Smelling Salts", "clears stunned and off-balance, and you move first next turn whatever they throw",
  36, "STUNNED", { clear: ["STUNNED", "OFF_BALANCE"], prio: 3, turns: 1 });

CK("water_break", "Water Break", "45 stamina back, clears winded, and your next technique costs nothing",
  26, "ANY", { stam: 45, clear: ["WINDED"], freeNext: true });

/* the towel is the panic button and it is priced like one - it buys you a
   whole reset, and hands them a round and a full meter for the privilege */
CK("throw_towel", "Throw In The Towel", "concede the round - the fight resets to open range, everything clears, you get 18% back, they get the round and a full meter",
  58, "ROUND", { concede: 1, range: "MID", clearAll: true, heal: 0.18, foeSup: 1 });

CK("fresh_wraps", "Fresh Wraps", "retape between rounds - your next three strikes hit 25% harder and cannot be parried",
  46, "ANY", { edge: { hits: 3, dmgMul: 1.25, noParry: true } });

CK("corner_read", "Corner Read", "your corner calls it - see their next two techniques and bank two focus",
  40, "ANY", { peek: 2, focus: 2 });

const CORNER_IDS = Object.keys(CORNER_ITEMS);

/* pull one out of the bag mid-fight; the fight code applies fx itself */
function takeCorner(run, id) {
  const ix = (run.corner || []).indexOf(id);
  if (ix < 0) return null;
  run.corner.splice(ix, 1);
  return CORNER_ITEMS[id];
}

/* ---------------------------------------------------------------------
   SHOP CONFIG
   --------------------------------------------------------------------- */
const SHOP_CONFIG = {
  stockMin: 4,
  stockMax: 6,
  reroll: 9,           // first reroll is pocket change
  rerollStep: 7,       // the fourth one costs a corner item - reroll is a
                       // pressure valve, not a search algorithm
  priceStep: 0.30,     // per stage, against the purse's 0.35
  cornerCarry: 3,      // corner items you can have in the bag at once

  healTenth: 11,       // cost of restoring a tenth of the pool
  healMin: 12,
  healSmall: 0.25,     // the two packages on offer
  healBig: 0.55,
  hurtEnough: 0.85,    // below this the shop guarantees a heal in stock
  // Heals climb slower than everything else. They already get quietly more
  // expensive as conditioning grows the pool, and a late-run heal priced on
  // the full curve costs three quarters of a stage - at which point being
  // hurt is not a decision, it is a tax, and the shop has nothing left to
  // offer you. Half the slope keeps patching a real choice against saving.
  healStageStep: 0.18,

  techBase: 16,        // technique price = base + worth + level tax
  techWorth: 0.85,
  techLearn: 6,
  crossTax: 1.35,      // learning outside your own arts costs more
  techFloor: 28,

  // The big-ticket item, wobbled per id so the same benefit is always worth
  // the same to every player. Priced above a full stage's income on purpose:
  // a benefit is camp-tier power, and the camp hands one out free every
  // stage. Buying one has to mean going without everything else for two
  // stages, or the shop quietly doubles the run's power curve.
  benefitBase: 110,
  benefitSpread: 50,

  // EDGE benefits break a rule of the game outright, and the price says
  // so: roughly two stages of walking past everything else
  edgeBase: 185,
  edgeSpread: 60,

  // the trainer's services - neither is stock, both are always on the wall
  cutPrice: 44,        // retire a technique for the run: subtraction is power
  drillPrice: 78,      // drill one: +15% power, +5 accuracy, per tier
  drillMax: 2,         // twice per technique, then it is as sharp as it gets

  // what fills the free slots once the guaranteed ones are placed
  weights: { TECHNIQUE: 38, CONDITIONING: 26, CORNER: 18, BENEFIT: 18 },
  benefitsPerStock: 1, // never two - two big-tickets in one window just
                       // splits the saving and neither gets bought
  cornerPerStock: 2,   // you can only carry three; a rack of consumables is
                       // a rack of things you cannot use
};

const priceScale = (stage) => 1 + SHOP_CONFIG.priceStep * (stageIndex(stage) - 1);
const healScale = (stage) => 1 + SHOP_CONFIG.healStageStep * (stageIndex(stage) - 1);

/* ---------------------------------------------------------------------
   PRICING
   --------------------------------------------------------------------- */
/* stable per-id wobble, so a benefit costs the same every run and a
   player can learn "the good one is about 130" */
function idHash(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}

function techPrice(run, id) {
  const t = TECH[id];
  if (!t) return 0;
  // guards and setups have no power but plenty of worth - price them off
  // their numbers instead so a Shoulder Roll is not free
  const worth = Math.max(t.power, (t.acc + t.speed) / 8);
  let p = SHOP_CONFIG.techBase + worth * SHOP_CONFIG.techWorth + t.learn * SHOP_CONFIG.techLearn;
  const mine = disciplinesOf(run.hero);
  if (t.disc && mine.indexOf(t.disc) < 0) p *= SHOP_CONFIG.crossTax;
  return Math.round(Math.max(SHOP_CONFIG.techFloor, p) * priceScale(run.stage));
}
function benefitPrice(run, id) {
  const wobble = (idHash(id) % 1000) / 1000;
  const edge = BENEFITS[id] && BENEFITS[id].tag === "EDGE";
  const base = edge ? SHOP_CONFIG.edgeBase : SHOP_CONFIG.benefitBase;
  const spread = edge ? SHOP_CONFIG.edgeSpread : SHOP_CONFIG.benefitSpread;
  const p = base + Math.round(spread * wobble);
  return Math.round(p * priceScale(run.stage));
}
/* heals are priced by what they actually restore, so buying one at 90%
   health is cheap rather than a con */
function healPrice(run, amount) {
  const frac = Math.max(0, amount) / Math.max(1, run.maxhp);
  return Math.round(Math.max(SHOP_CONFIG.healMin,
    frac * 10 * SHOP_CONFIG.healTenth * healScale(run.stage)));
}

/* Rerolls escalate within a stage and reset when you walk into the next
   gym. Escalation is the only thing stopping a patient player from
   rerolling until the shop hands them exactly what they wanted. */
function rerollCost(run) {
  const n = (run && run.rerolls) || 0;
  return Math.round((SHOP_CONFIG.reroll + SHOP_CONFIG.rerollStep * n) * priceScale(run && run.stage));
}
/* a reroll is bought like anything else - see buyItem's note on why */
function rerollTicket(run) {
  return { kind: "REROLL", id: "reroll", name: "Reroll The Rack",
           desc: "new stock on the shelf", price: rerollCost(run), tag: "GYM" };
}

/* ---------------------------------------------------------------------
   THE TRAINER'S SERVICES

   Not stock - always on the wall. Both are the same lesson the deck
   games learned years ago: what you TAKE OUT of a movelist matters as
   much as what goes in. A menu is a probability distribution over your
   own attention; every card you will never throw is noise on the cards
   you will. The cut buys signal. The drill buys depth on a card you
   have already committed to.

   Both go through buyItem like everything else, carrying the chosen
   technique as `target`, so the purse still has exactly one hole in it.
   --------------------------------------------------------------------- */
const CUT_FLOOR = 12;      /* a movelist never shrinks below this */

function cutCandidates(run) {
  const retired = (run && run.retired) || [];
  const live = draftMovelist(run).filter((id) => retired.indexOf(id) < 0);
  if (live.length <= CUT_FLOOR) return [];
  /* the universal fundamentals are how the game guarantees a fighter is
     never without an answer - they are not for sale */
  return live.filter((id) => BASIC_TECHS.indexOf(id) < 0 && !TECH[id].sig);
}
function drillCandidates(run) {
  const retired = (run && run.retired) || [];
  const drilled = (run && run.drilled) || {};
  return draftMovelist(run).filter((id) =>
    retired.indexOf(id) < 0 && !TECH[id].sig && (drilled[id] || 0) < SHOP_CONFIG.drillMax);
}
function cutTicket(run, techId) {
  const t = TECH[techId];
  return { kind: "CUT", id: "svc_cut", target: techId, tag: "TRAINER",
           name: "Cut: " + (t ? t.name : "?"),
           desc: "retire it for the run - a shorter list is a sharper list",
           price: Math.round(SHOP_CONFIG.cutPrice * priceScale(run && run.stage)) };
}
function drillTicket(run, techId) {
  const t = TECH[techId];
  const owned = ((run && run.drilled) || {})[techId] || 0;
  return { kind: "DRILL", id: "svc_drill", target: techId, tag: "TRAINER",
           name: "Drill: " + (t ? t.name : "?"),
           desc: "+15% power, +5 accuracy" + (owned ? " (tier " + (owned + 1) + ")" : ""),
           price: Math.round(SHOP_CONFIG.drillPrice * (1 + 0.55 * owned) * priceScale(run && run.stage)) };
}
function sealTicket(run, techId, sealId) {
  const t = (typeof TECH !== "undefined" && TECH[techId]) || { name: techId };
  const s = (typeof SEALS !== "undefined" && SEALS[sealId]) || { name: sealId, price: 70 };
  return { kind: "SEAL", id: "svc_seal_" + sealId, target: techId, sealId: sealId, tag: "SEAL",
           name: s.name + ": " + t.name,
           desc: s.desc,
           price: Math.round(s.price * priceScale(run && run.stage)) };
}

/* ---------------------------------------------------------------------
   STOCK
   --------------------------------------------------------------------- */
const pick = (arr, R) => arr[(R() * arr.length) | 0];

function cornerItem(run, id) {
  const c = CORNER_ITEMS[id];
  return { kind: "CORNER", id: c.id, name: c.name, desc: c.desc,
           price: Math.round(c.price * priceScale(run.stage)), tag: "CORNER" };
}
function conditioningItem(run, id) {
  const c = CONDITIONING[id];
  const owned = conditioningTier(run, id);
  return { kind: "CONDITIONING", id: c.id, name: c.name,
           desc: c.desc + (c.tiers > 1 ? " (" + (owned + 1) + "/" + c.tiers + ")" : ""),
           price: conditioningPrice(run, id), tag: c.tag };
}
function techniqueItem(run, id) {
  const t = TECH[id];
  const d = t.disc && DISCIPLINES[t.disc];
  return { kind: "TECHNIQUE", id: t.id, name: t.name,
           desc: t.cls + " at " + t.range + ", " + t.power + " power",
           price: techPrice(run, id), tag: d ? d.name.toUpperCase() : "BASIC" };
}
function benefitItem(run, id) {
  const b = BENEFITS[id];
  return { kind: "BENEFIT", id: b.id, name: b.name, desc: b.desc,
           price: benefitPrice(run, id), tag: b.tag };
}
function relicItem(run, id) {
  const r = typeof RELICS !== "undefined" && RELICS[id];
  if (!r) return null;
  const tierPrices = { COMMON: 75, UNCOMMON: 140, RARE: 220, TRANSCENDENT: 320 };
  const base = tierPrices[r.tier] || 100;
  return { kind: "RELIC", id: r.id, name: r.name, desc: r.desc,
           price: Math.round(base * priceScale(run.stage)), tag: r.tier + " RELIC" };
}
function healItem(run, frac, name) {
  const amount = Math.min(run.maxhp - run.hp, Math.round(run.maxhp * frac));
  return { kind: "HEAL", id: "heal_" + Math.round(frac * 100), name,
           desc: "recover " + amount + " health", price: healPrice(run, amount),
           tag: "CORNER", amount };
}

function campFocusItem(run, focusId) {
  const f = (typeof campFocusOf === "function") ? campFocusOf(focusId) : null;
  if (!f) return null;
  const owned = run.camp && run.camp.focus === focusId;
  return {
    kind: "CAMP", id: "camp_" + f.id, focusId: f.id, name: "CAMP: " + f.name,
    desc: f.blurb + (owned ? " (active)" : ""),
    price: Math.round(18 * priceScale(run.stage)), tag: "CAMP",
  };
}

/* what is still worth offering this player */
function openConditioning(run) {
  return CONDITIONING_IDS.filter((id) => conditioningTier(run, id) < CONDITIONING[id].tiers);
}
function openCorner(run) {
  return CORNER_IDS.slice();                  // consumables are always restocked
}
function openBenefits(run) {
  return BENEFIT_IDS.filter((id) => (run.benefits || []).indexOf(id) < 0);
}
/* techniques you could plausibly be taught: at or just above your level,
   from any art, not already drafted. One level of reach is deliberate -
   the gym is where you buy the thing you have not earned yet. */
function openTechs(run) {
  const lv = (run.level || 1) + 1;
  return TECH_IDS.filter((id) => {
    const t = TECH[id];
    return !t.sig && t.learn <= lv && (run.drafted || []).indexOf(id) < 0;
  });
}

function weightedKind(R, allow) {
  const w = SHOP_CONFIG.weights;
  let total = 0;
  allow.forEach((k) => (total += w[k] || 0));
  if (total <= 0) return allow[0] || "CORNER";
  let roll = R() * total;
  for (const k of allow) { roll -= w[k] || 0; if (roll <= 0) return k; }
  return allow[allow.length - 1];
}

/* Four to six items. The shape of the rack is fixed even though the
   contents are not: one consumable, one piece of conditioning, and a heal
   whenever you are actually hurt. That guarantee is what keeps a bad roll
   from being a wasted stage - there is always something worth the money,
   even if it is not the thing you wanted. */
function shopStock(run, rnd) {
  const R = rnd || Math.random;
  // new stage, new gym: rerolls get cheap again
  if (run.shopStage !== run.stage) { run.shopStage = run.stage; run.rerolls = 0; }

  const size = Math.max(SHOP_CONFIG.stockMin, Math.min(SHOP_CONFIG.stockMax,
    SHOP_CONFIG.stockMin + (run.stage >= 2 ? 1 : 0) + (run.stage >= 4 ? 1 : 0)));

  const out = [], used = {};
  const add = (item) => {
    if (!item || used[item.kind + ":" + item.id]) return false;
    used[item.kind + ":" + item.id] = 1;
    out.push(item);
    return true;
  };

  const cond = openConditioning(run), bens = openBenefits(run), techs = openTechs(run);

  add(cornerItem(run, pick(openCorner(run), R)));
  if (cond.length) add(conditioningItem(run, pick(cond, R)));
  if (run.hp < run.maxhp * SHOP_CONFIG.hurtEnough) {
    add(healItem(run, run.hp < run.maxhp * 0.5 ? SHOP_CONFIG.healBig : SHOP_CONFIG.healSmall,
      run.hp < run.maxhp * 0.5 ? "Full Corner Work" : "Corner Work"));
  }
  if (typeof CAMP_FOCUS_IDS !== "undefined" && CAMP_FOCUS_IDS.length) {
    add(campFocusItem(run, pick(CAMP_FOCUS_IDS, R)));
  }

  // Relic Cabinet: offer 1 relic if available
  if (typeof RELICS !== "undefined" && typeof RELIC_IDS !== "undefined") {
    const unownedRelics = RELIC_IDS.filter((id) => (run.relics || []).indexOf(id) < 0);
    if (unownedRelics.length > 0) {
      add(relicItem(run, pick(unownedRelics, R)));
    }
  }

  let benefits = 0, corners = 1, guard = 0;      // the guaranteed slot counts
  while (out.length < size && guard++ < 60) {
    const allow = ["TECHNIQUE", "CONDITIONING", "CORNER", "BENEFIT"].filter((k) => {
      if (k === "TECHNIQUE") return techs.length > 0;
      if (k === "CONDITIONING") return cond.length > 0;
      if (k === "CORNER") return corners < SHOP_CONFIG.cornerPerStock;
      return bens.length > 0 && benefits < SHOP_CONFIG.benefitsPerStock;
    });
    if (!allow.length) break;
    const kind = weightedKind(R, allow);
    if (kind === "TECHNIQUE") add(techniqueItem(run, pick(techs, R)));
    else if (kind === "CONDITIONING") add(conditioningItem(run, pick(cond, R)));
    else if (kind === "CORNER") { if (add(cornerItem(run, pick(openCorner(run), R)))) corners++; }
    else if (add(benefitItem(run, pick(bens, R)))) benefits++;
  }

  /* A late run can own every benefit, max every conditioning and have
     drafted the whole dex - at which point the caps above would hand back
     a half-empty rack. Consumables never run out, so top up with those:
     a shelf of corner items is a worse shop than usual, but it is still a
     shop, and the stock size the UI was promised is the stock size it gets. */
  const spare = openCorner(run);
  for (let i = 0; out.length < SHOP_CONFIG.stockMin && i < spare.length; i++) add(cornerItem(run, spare[i]));
  return out;
}

/* ---------------------------------------------------------------------
   BUYING
   --------------------------------------------------------------------- */
const canAfford = (run, item) => !!item && (run.purse || 0) >= item.price;

/* Why the reroll is an item: the purse must have exactly one hole in it.
   The moment two functions can both subtract from run.purse, some future
   screen forgets to check canAfford and the player buys a benefit with
   money they spent on rerolls. So the shop screen charges a reroll by
   calling buyItem(run, rerollTicket(run)) and then asking for new stock. */
function buyItem(run, item) {
  if (!run || !item) return { ok: false, reason: "no_item" };
  if (item.sold) return { ok: false, reason: "sold" };

  // check everything BEFORE a single coin moves, so a rejected buy can
  // never leave the run half-charged
  switch (item.kind) {
    case "TECHNIQUE":
      if ((run.drafted || []).indexOf(item.id) >= 0) return { ok: false, reason: "owned" };
      if (!TECH[item.id]) return { ok: false, reason: "no_item" };
      break;
    case "BENEFIT":
      if ((run.benefits || []).indexOf(item.id) >= 0) return { ok: false, reason: "owned" };
      if (!BENEFITS[item.id]) return { ok: false, reason: "no_item" };
      break;
    case "RELIC":
      if ((run.relics || []).indexOf(item.id) >= 0) return { ok: false, reason: "owned" };
      if (typeof RELICS === "undefined" || !RELICS[item.id]) return { ok: false, reason: "no_item" };
      break;
    case "CONDITIONING": {
      const c = CONDITIONING[item.id];
      if (!c) return { ok: false, reason: "no_item" };
      if (conditioningTier(run, item.id) >= c.tiers) return { ok: false, reason: "maxed" };
      break;
    }
    case "CORNER":
      if (!CORNER_ITEMS[item.id]) return { ok: false, reason: "no_item" };
      if ((run.corner || []).length >= SHOP_CONFIG.cornerCarry) return { ok: false, reason: "corner_full" };
      break;
    case "HEAL":
      if (run.hp >= run.maxhp) return { ok: false, reason: "healthy" };
      break;
    case "CAMP":
      if (!item.focusId || (typeof campFocusOf === "function" && !campFocusOf(item.focusId))) {
        return { ok: false, reason: "no_item" };
      }
      break;
    case "REROLL":
      break;
    case "CUT":
      if (cutCandidates(run).indexOf(item.target) < 0) return { ok: false, reason: "no_cut" };
      break;
    case "DRILL":
      if (drillCandidates(run).indexOf(item.target) < 0) return { ok: false, reason: "no_drill" };
      break;
    case "SEAL":
      if (!item.target || (typeof TECH !== "undefined" && !TECH[item.target])) return { ok: false, reason: "no_item" };
      if (!item.sealId || (typeof SEALS !== "undefined" && !SEALS[item.sealId])) return { ok: false, reason: "no_item" };
      break;
    default:
      return { ok: false, reason: "unknown_kind" };
  }
  if (!canAfford(run, item)) return { ok: false, reason: "broke" };

  run.purse -= item.price;
  run.spent = (run.spent || 0) + item.price;

  switch (item.kind) {
    case "TECHNIQUE":
      (run.drafted = run.drafted || []).push(item.id);
      break;
    case "BENEFIT": {
      (run.benefits = run.benefits || []).push(item.id);
      // benefits with an onPick hook expect to fire the moment they are
      // taken, exactly as they do at the camp screen
      const b = BENEFITS[item.id];
      if (b && b.onPick) b.onPick(run);
      break;
    }
    case "RELIC": {
      (run.relics = run.relics || []).push(item.id);
      break;
    }
    case "CONDITIONING": {
      if (!run.conditioning) run.conditioning = {};
      run.conditioning[item.id] = conditioningTier(run, item.id) + 1;
      const c = CONDITIONING[item.id];
      if (c.run) c.run(run, run.conditioning[item.id]);
      break;
    }
    case "CORNER":
      (run.corner = run.corner || []).push(item.id);
      break;
    case "HEAL":
      run.hp = Math.min(run.maxhp, run.hp + (item.amount || Math.round(run.maxhp * SHOP_CONFIG.healSmall)));
      break;
    case "CAMP":
      run.camp = normalizeCampPlan
        ? normalizeCampPlan({ focus: item.focusId, workload: (run.camp && run.camp.workload) || "standard" })
        : { focus: item.focusId, workload: "standard" };
      break;
    case "REROLL":
      run.rerolls = ((run.rerolls || 0) + 1);
      break;
    case "CUT":
      (run.retired = run.retired || []).push(item.target);
      break;
    case "DRILL":
      if (!run.drilled) run.drilled = {};
      run.drilled[item.target] = (run.drilled[item.target] || 0) + 1;
      break;
    case "SEAL":
      if (!run.seals) run.seals = {};
      run.seals[item.target] = item.sealId;
      break;
  }
  item.sold = true;
  return { ok: true, reason: null, spent: item.price, purse: run.purse, item };
}

/* the line the shop screen prints when a buy bounces */
const BUY_REASON = {
  no_item: "not for sale",
  sold: "already bought",
  broke: "not enough in the purse",
  owned: "you already know that",
  maxed: "nothing left to gain there",
  corner_full: "your corner cannot carry any more",
  healthy: "you are not hurt",
  no_cut: "the trainer will not cut that",
  no_drill: "nothing left to sharpen there",
  unknown_kind: "not for sale",
};
