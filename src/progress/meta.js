/* =====================================================================
   Aqua Zero Heavens Arena - RENOWN, the currency that outlives a run
   Luminara Digital

   The measured problem this file exists to fix: the only thing surviving
   a loss today is per-fighter mastery, spread thin across 25 fighters and
   deliberately modest by its own documentation (ranks at 40/110/230/400/
   640 XP, 18 per win). Nothing a player owns after ten runs changes what
   run eleven OFFERS them. Run ten is run one with better hands.

   RENOWN is the fix. It is earned by EVERY run, win or lose, scaled by
   how deep the run got, and it is spent on permanent additions to the RUN
   POOL - the set of things a future run can be dealt.

   Two hard lines, both of them rules of the game rather than taste:

     1. RENOWN NEVER BUYS A FIGHTER. Everyone is playable from a fresh
        save; SAVE.unlocked means "mastered", not "selectable". Nothing in
        this catalogue touches fighter selection, and nothing in it should
        ever be allowed to.
     2. RENOWN NEVER BUYS RAW NUMBERS. It buys BREADTH - one more art the
        drafter may reach into, one more slot in the corner bag, one more
        map layout, the option of a harder opening that pays more. A
        player who owns everything here has a wider pool to be dealt
        from, not a bigger hitting stat.

   Why breadth and not power: the run already has three tuned economies
   (draft budget, camp benefits, the purse) and every one of them was
   balanced against the pool it draws from. Widening the pool changes what
   a run can BECOME without moving a single damage number, so none of the
   measured balance work has to be redone.

   PRICED AGAINST MEASURED REALITY
   A full clear is roughly 11-22 fights and a stage carries 5-7, so most
   runs die in stage two or three having won eight to fourteen fights.
   That run pays about 23-40 renown. The cheapest meaningful purchase is
   55, so the first one lands in two or three runs - not thirty. Owning
   the whole catalogue is around 1,350, which is a long tail on purpose:
   the first purchase must be soon, the last one must be far.

   PURE LOGIC. This module renders nothing, reads no input, touches no
   canvas and never looks at SAVE. Every function here takes the save
   block as an argument and RETURNS A NEW ONE - nothing below is allowed
   to mutate what it was handed, so a caller can price a purchase, show
   it, and only then commit it. It also reads no other module, by design:
   the numbers it needs to agree with (the corner bag's base of three)
   are restated here as constants and pinned by a test, so this file has
   no load-order dependency of any kind.

   Assumed globals: none.
   Save block: SAVE.meta, shape below, created by DEF_META().
   ===================================================================== */

const META_SAVE_VERSION = 1;

const META_CONFIG = {
  /* the currency, in copy */
  name: "RENOWN",
  unit: "RN",

  /* the corner bag starts at three (SHOP_CONFIG.cornerCarry). Restated
     rather than read so this module has no load order; meta.test.js
     asserts the two agree, which is what keeps the restatement honest. */
  cornerBase: 3,

  /* every save carries at least the stock map layout */
  baseLayout: "standard",

  /* hard ceilings, so a corrupt or hand-edited save cannot print money
     and no arithmetic below can run away */
  balanceCap: 99999,
  awardCap: 400,
};

/* ---------------------------------------------------------------------
   WHAT A FINISHED RUN PAYS

   Depth is the driver, because depth is what the run actually records.
   `stage` is tracked on every run; a lifetime win counter is not (a.beaten
   is cleared at every stage clear - see the BENEFIT handler), so wins are
   an optional refinement the caller may pass and the award never depends
   on them.

   The clear bonus is large and the per-stage step is not, because the
   thing worth rewarding is getting further than last time, and the thing
   worth NOT rewarding is farming stage one.
   --------------------------------------------------------------------- */
const META_AWARD = {
  base: 6,             // you turned up. A run that dies in stage one still pays.
  perStage: 9,         // per stage actually cleared (stage reached, minus the one you died in)
  perWin: 1,           // a small hand on top, when the caller can count them
  clear: 40,           // the Daemon King put away
  ngStep: 0.15,        // NG+ pays more because everyone hits harder
  ngCap: 0.45,
  openStep: 0.12,      // and so does electing to start on a harder card
  openCap: 0.24,
  stageCap: 9,         // clamps, so a junk stage number cannot pay out
  winCap: 40,
  ngLevelCap: 9,
};

/* ---------------------------------------------------------------------
   THE CATALOGUE

   kind      what buying it adds to the run pool
     disc    one more discipline the drafter may offer from
     corner  one more slot in the corner bag
     camp    the run starts holding one rolled camp benefit
     layout  one more map layout the field generator may pick
     open    one more opening tier: start deeper, get paid more

   price     the first purchase
   tiers     how many times it can be bought
   step      what each repeat multiplies the price by
   --------------------------------------------------------------------- */
const META_ITEMS = {};
const META_ITEM_IDS = [];
function MI(id, name, desc, tag, price, tiers, step, grant) {
  META_ITEMS[id] = { id, name, desc, tag, price, tiers: tiers || 1, step: step || 1, grant: grant || {} };
  META_ITEM_IDS.push(id);
}

/* --- the arts ---
   Six passes, one price. There is no best buy here on purpose: they cost
   the same and differ only in which ranges they open, so the decision is
   "what do I want my runs to be able to become", not "which is bigger".
   Between them they cover all four ranges twice over. */
const META_ART_PRICE = 70;
MI("art_boxing", "Boxing Pass", "the drafter may offer boxing - punching range, fast and accurate",
   "ART", META_ART_PRICE, 1, 1, { kind: "disc", disc: "boxing" });
MI("art_taekwondo", "Taekwondo Pass", "the drafter may offer taekwondo - kicking range, long and quick",
   "ART", META_ART_PRICE, 1, 1, { kind: "disc", disc: "taekwondo" });
MI("art_muaythai", "Muay Thai Pass", "the drafter may offer muay thai - long, punching and the tie-up",
   "ART", META_ART_PRICE, 1, 1, { kind: "disc", disc: "muaythai" });
MI("art_judo", "Judo Pass", "the drafter may offer judo - the tie-up, and the throw out of it",
   "ART", META_ART_PRICE, 1, 1, { kind: "disc", disc: "judo" });
MI("art_bjj", "Jiu-Jitsu Pass", "the drafter may offer Brazilian jiu-jitsu - the mat, and the finish on it",
   "ART", META_ART_PRICE, 1, 1, { kind: "disc", disc: "bjj" });
MI("art_sambo", "Sambo Pass", "the drafter may offer sambo - the tie-up and the mat together",
   "ART", META_ART_PRICE, 1, 1, { kind: "disc", disc: "sambo" });

/* --- the corner ---
   Three is the stock bag and the shop already refuses a fourth item
   (corner_full). A fourth and fifth slot is the cheapest thing here
   because it is the smallest thing here: more consumables carried, none
   of them stronger. */
MI("corner_slot", "Corner Bag", "one more corner item in the bag, carried into every fight",
   "CORNER", 55, 2, 1.8, { kind: "corner", slots: 1 });

/* --- the camp ---
   The camp hands out one benefit per stage clear, so starting with one is
   worth roughly a stage's head start and is priced at four ordinary runs.
   The benefit is ROLLED from the normal camp pool, never chosen: this buys
   a head start, not the pick of the best modifier in the game. */
MI("camp_start", "Standing Camp", "every run begins holding one camp benefit, rolled the usual way",
   "CAMP", 150, 1, 1, { kind: "camp", benefits: 1 });

/* --- the map ---
   Alternate field layouts. Neither is easier; both change what a stage
   asks of you, which is the only thing the field has ever asked. */
MI("map_gauntlet", "Gauntlet Layout", "an alternate field: open ground, more men on it",
   "MAP", 85, 1, 1, { kind: "layout", layout: "gauntlet" });
MI("map_labyrinth", "Labyrinth Layout", "an alternate field: tight walls, fewer ways past",
   "MAP", 85, 1, 1, { kind: "layout", layout: "labyrinth" });

/* --- the opening ---
   The one purchase that can make a run harder. It UNLOCKS an option; it
   never forces it. Starting on the main card skips the easy money and
   pays a premium for the whole run, which is a bet, not a buff - and the
   award below pays a little more for having taken it. */
const META_OPEN_TIERS = [
  { tier: 0, stage: 1, purseMul: 1.00, label: "FULL CARD" },
  { tier: 1, stage: 2, purseMul: 1.15, label: "UNDERCARD SKIPPED" },
  { tier: 2, stage: 3, purseMul: 1.30, label: "MAIN CARD ONLY" },
];
MI("open_stage", "Hard Opening", "opens a deeper starting stage that pays a premium all run",
   "OPENING", 60, 2, 2, { kind: "open", tiers: 1 });

/* --- adventure permanent perks --- */
const ADV_PERKS = {};
const ADV_PERK_IDS = [];
function defineAdvPerk(id, name, desc, tag, price, tiers, step, grant) {
  ADV_PERKS[id] = { id, name, desc, tag: tag || "CAMP", price, tiers: tiers || 1, step: step || 1, grant: grant || {} };
  ADV_PERK_IDS.push(id);
}
defineAdvPerk("adv_focus", "Starting Focus", "Adventure: start every combat with +1 Focus point",
   "CAMP", 85, 2, 1.6, { focus: 1 });
defineAdvPerk("adv_grit", "Iron Grit", "Adventure: +10% maximum health ceiling",
   "CAMP", 95, 2, 1.5, { hpMul: 0.10 });
defineAdvPerk("adv_second_wind", "Second Wind", "Adventure: survive a fatal blow once per run at 20% health",
   "CORNER", 150, 1, 1, { revives: 1 });
defineAdvPerk("adv_corner", "Field Bag Slot", "Adventure: carry +1 extra corner consumable into every fight",
   "CORNER", 70, 2, 1.6, { slots: 1 });

const META_BUY_REASON = {
  ok: "bought",
  bad_save: "no renown ledger on this save",
  unknown_item: "no such purchase",
  maxed: "already fully bought",
  cannot_afford: "not enough renown yet",
};

/* ---------------------------------------------------------------------
   ARITHMETIC THAT CANNOT THROW

   Every entry point below is total. Junk in gives a defined answer out:
   no exceptions, no NaN, no negative balance, ever. A meta-currency that
   can throw on a hand-edited save takes the whole page down on load.
   --------------------------------------------------------------------- */
function metaInt(n, lo, hi) {
  const v = Math.round(+n);
  if (!(v === v) || v === Infinity || v === -Infinity) return lo;
  return v < lo ? lo : (v > hi ? hi : v);
}
const metaSafeKey = (k) => (k === "__proto__" || k === "constructor" || k === "prototype");

/* Catalogue lookup, and the reason it is a function rather than an index:
   META_ITEMS["__proto__"] is TRUTHY on a plain object, so a naive lookup
   answers "yes, that is an item" for an id no one authored and then reads
   tiers and prices off Object.prototype. Every id that arrives from
   outside this file goes through here. */
function metaItem(id) {
  if (typeof id !== "string" || metaSafeKey(id)) return null;
  return Object.prototype.hasOwnProperty.call(META_ITEMS, id) ? META_ITEMS[id] : null;
}

/* ---------------------------------------------------------------------
   THE SAVE BLOCK
     { v, renown, earned, spent, runs, owned:{ itemId: tiersOwned } }
   renown is what you can spend. earned is lifetime, for the readout, and
   is never decreased - the two are separate numbers because "you have 12"
   and "you have won 340 across 19 runs" are different sentences.
   --------------------------------------------------------------------- */
function DEF_META() {
  return { v: META_SAVE_VERSION, renown: 0, earned: 0, spent: 0, runs: 0, owned: {} };
}

/* Takes anything at all and returns a clean block. Unknown item ids are
   dropped rather than kept, so a catalogue entry retired later cannot
   leave a ghost in the pool query. */
function metaNormalize(block) {
  const out = DEF_META();
  if (!block || typeof block !== "object" || Array.isArray(block)) return out;
  out.v = metaInt(block.v, 1, 999) || META_SAVE_VERSION;
  out.renown = metaInt(block.renown, 0, META_CONFIG.balanceCap);
  out.earned = metaInt(block.earned, 0, META_CONFIG.balanceCap * 10);
  out.spent = metaInt(block.spent, 0, META_CONFIG.balanceCap * 10);
  out.runs = metaInt(block.runs, 0, 999999);
  const owned = block.owned;
  if (owned && typeof owned === "object" && !Array.isArray(owned)) {
    META_ITEM_IDS.forEach((id) => {
      if (metaSafeKey(id)) return;
      if (!Object.prototype.hasOwnProperty.call(owned, id)) return;
      const t = metaInt(owned[id], 0, META_ITEMS[id].tiers);
      if (t > 0) out.owned[id] = t;
    });
    ADV_PERK_IDS.forEach((id) => {
      if (metaSafeKey(id)) return;
      if (!Object.prototype.hasOwnProperty.call(owned, id)) return;
      const t = metaInt(owned[id], 0, ADV_PERKS[id].tiers);
      if (t > 0) out.owned[id] = t;
    });
  }
  if (out.earned < out.renown) out.earned = out.renown;   // lifetime cannot be under the wallet
  return out;
}

const metaHasBlock = (save) =>
  !!save && typeof save === "object" && !!save.meta && typeof save.meta === "object" && !Array.isArray(save.meta);

/* The migration. A save from before renown existed has no `meta` key at
   all; one from a tampered blob may have garbage there. Both come out the
   same way, and the save handed in is not touched. */
function metaMigrate(save) {
  if (!save || typeof save !== "object" || Array.isArray(save)) return { meta: DEF_META() };
  const out = {};
  for (const k in save) {
    if (!Object.prototype.hasOwnProperty.call(save, k) || metaSafeKey(k)) continue;
    out[k] = save[k];
  }
  out.meta = metaHasBlock(save) ? metaNormalize(save.meta) : DEF_META();
  return out;
}

/* ---------------------------------------------------------------------
   THE AWARD

   Accepts a run object (G.adv shaped) or a plain summary. Reads, all
   optional:
     stage      how deep it got, 1-based. The whole award leans on this.
     wins       fights won across the run, if the caller counts them
     cleared    the run was finished (the boss went down)
     ng         new game + tier
     openTier   which opening tier the run elected to start on
   Returns { total, lines:[{ label, amount }], mult } so a results screen
   can show the arithmetic instead of a number nobody trusts.
   --------------------------------------------------------------------- */
function metaRunTally(run) {
  const r = (run && typeof run === "object") ? run : {};
  let wins = null;
  if (r.wins !== undefined && r.wins !== null) wins = metaInt(r.wins, 0, META_AWARD.winCap);
  else if (r.beaten && typeof r.beaten === "object") {
    // a.beaten is cleared at every stage clear, so this is this stage's
    // work only - depth carries the award, this is the garnish
    let n = 0;
    for (const k in r.beaten) if (Object.prototype.hasOwnProperty.call(r.beaten, k) && r.beaten[k]) n++;
    wins = metaInt(n, 0, META_AWARD.winCap);
  }
  return {
    stage: metaInt(r.stage, 1, META_AWARD.stageCap),
    wins: wins === null ? 0 : wins,
    cleared: !!(r.cleared || r.bossBeaten),
    ng: metaInt(r.ng, 0, META_AWARD.ngLevelCap),
    openTier: metaInt(r.openTier, 0, META_OPEN_TIERS.length - 1),
    renownMul: (typeof r.renownMul === "number" && r.renownMul > 0) ? r.renownMul : 1,
  };
}

function metaAwardFor(run) {
  const t = metaRunTally(run);
  const lines = [];
  const push = (label, amount) => { if (amount > 0) lines.push({ label, amount }); };

  let sub = META_AWARD.base;
  push("SHOWED UP", META_AWARD.base);

  const stagesDone = Math.max(0, t.stage - 1);
  const depth = stagesDone * META_AWARD.perStage;
  sub += depth;
  push("STAGES CLEARED x" + stagesDone, depth);

  const won = t.wins * META_AWARD.perWin;
  sub += won;
  push("FIGHTS WON x" + t.wins, won);

  if (t.cleared) { sub += META_AWARD.clear; push("THE CLIMB FINISHED", META_AWARD.clear); }

  const ngMul = Math.min(META_AWARD.ngCap, META_AWARD.ngStep * t.ng);
  const openMul = Math.min(META_AWARD.openCap, META_AWARD.openStep * t.openTier);
  const rMul = (t.renownMul && t.renownMul !== 1) ? t.renownMul : 1;
  const mult = (1 + ngMul + openMul) * rMul;

  const total = metaInt(sub * mult, 1, META_CONFIG.awardCap);
  return { total, lines, mult, ngMul, openMul, subtotal: sub, tally: t };
}

/* Banks an award. Returns a NEW block; the one handed in is untouched.
   `amount` may be a number or the object metaAwardFor() returned. The
   amount is clamped to the wallet ceiling rather than to awardCap: capping
   what a RUN can pay is metaAwardFor's job, and doing it twice here would
   silently swallow a legitimate grant (a restored save, a test fixture)
   without anyone being able to tell which cap bit. */
function metaCredit(block, amount) {
  const meta = metaNormalize(block);
  const n = metaInt((amount && typeof amount === "object") ? amount.total : amount,
                    0, META_CONFIG.balanceCap);
  meta.renown = metaInt(meta.renown + n, 0, META_CONFIG.balanceCap);
  meta.earned = metaInt(meta.earned + n, 0, META_CONFIG.balanceCap * 10);
  meta.runs = metaInt(meta.runs + 1, 0, 999999);
  return meta;
}

/* ---------------------------------------------------------------------
   BUYING
   --------------------------------------------------------------------- */
const metaTier = (block, id) => {
  const it = metaItem(id) || (typeof ADV_PERKS !== "undefined" && ADV_PERKS[id]);
  if (!it) return 0;
  const owned = (block && block.owned) || {};
  return metaInt(Object.prototype.hasOwnProperty.call(owned, id) ? owned[id] : 0, 0, it.tiers);
};

/* the price of the NEXT one. 0 when there is no next one. */
function metaPriceOf(block, id) {
  const it = metaItem(id);
  if (!it) return 0;
  const have = metaTier(block, id);
  if (have >= it.tiers) return 0;
  return Math.round(it.price * Math.pow(it.step, have));
}

/* Never throws. Always answers with a reason, so a shop row can be drawn
   greyed out with the reason under it rather than simply missing. */
function metaCanBuy(block, id) {
  const it = metaItem(id);
  if (!it) return { ok: false, reason: "unknown_item", price: 0, tier: 0 };
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return { ok: false, reason: "bad_save", price: it.price, tier: 0 };
  }
  const have = metaTier(block, id);
  if (have >= it.tiers) return { ok: false, reason: "maxed", price: 0, tier: have };
  const price = metaPriceOf(block, id);
  const purse = metaInt(block.renown, 0, META_CONFIG.balanceCap);
  if (purse < price) return { ok: false, reason: "cannot_afford", price, tier: have, short: price - purse };
  return { ok: true, reason: "ok", price, tier: have };
}

/* Buys one tier. Returns { ok, reason, meta, price, tier } where `meta` is
   always a usable block - the normalised original when the purchase was
   refused, a new one with the tier added when it went through. The balance
   is spent through metaInt with a floor of zero, so no path here can put a
   save into debt even if the catalogue is edited badly. */
function metaBuy(block, id) {
  const check = metaCanBuy(block, id);
  const base = metaNormalize(block);
  if (!check.ok) return { ok: false, reason: check.reason, meta: base, price: check.price, tier: check.tier };
  base.renown = metaInt(base.renown - check.price, 0, META_CONFIG.balanceCap);
  base.spent = metaInt(base.spent + check.price, 0, META_CONFIG.balanceCap * 10);
  base.owned[id] = check.tier + 1;
  return { ok: true, reason: "ok", meta: base, price: check.price, tier: base.owned[id] };
}

/* One row per catalogue entry, keyed by id - a screen picks rows by id and
   never by index, so inserting an entry cannot re-point its neighbour. */
function metaRows(block) {
  const meta = metaNormalize(block);
  return META_ITEM_IDS.map((id) => {
    const it = META_ITEMS[id], can = metaCanBuy(meta, id);
    return {
      id, name: it.name, desc: it.desc, tag: it.tag,
      tier: metaTier(meta, id), tiers: it.tiers,
      price: metaPriceOf(meta, id),
      can: can.ok, reason: can.reason,
      note: META_BUY_REASON[can.reason] || "",
    };
  });
}

function metaSummary(block) {
  const meta = metaNormalize(block);
  let owned = 0, maxed = 0;
  META_ITEM_IDS.forEach((id) => {
    const t = metaTier(meta, id);
    owned += t;
    if (t >= META_ITEMS[id].tiers) maxed++;
  });
  let total = 0;
  META_ITEM_IDS.forEach((id) => (total += META_ITEMS[id].tiers));
  return meta.renown + " " + META_CONFIG.unit + " - " + owned + " OF " + total + " BOUGHT" +
         (meta.runs ? " OVER " + meta.runs + (meta.runs === 1 ? " RUN" : " RUNS") : "") +
         (maxed >= META_ITEM_IDS.length ? " - THE WALL IS BARE" : "");
}

/* ---------------------------------------------------------------------
   WHAT A RUN POOL SHOULD CONTAIN

   The single query the run builder asks. Everything is ADDITIVE and
   absolute: `discs` are extra arts on top of the fighter's own, never a
   replacement for them; `cornerSlots` is the whole capacity, not a delta;
   `layouts` and `openStages` always contain the stock option, so a save
   that has bought nothing still gets a complete, playable answer. There is
   no branch in here that can return a pool a fresh save cannot use.

   Note what is NOT in it: no fighter list, no stat, no damage number.
   --------------------------------------------------------------------- */
function metaRunPool(save) {
  const block = metaHasBlock(save) ? save.meta
              : (save && typeof save === "object" && !Array.isArray(save) && save.owned !== undefined ? save : null);
  const meta = metaNormalize(block);
  const pool = {
    renown: meta.renown,
    discs: [],
    cornerSlots: META_CONFIG.cornerBase,
    startBenefits: 0,
    layouts: [META_CONFIG.baseLayout],
    openStages: [META_OPEN_TIERS[0]],
    owned: {},
  };
  META_ITEM_IDS.forEach((id) => {
    const tier = metaTier(meta, id);
    if (tier <= 0) return;
    pool.owned[id] = tier;
    const g = META_ITEMS[id].grant || {};
    if (g.kind === "disc" && g.disc && pool.discs.indexOf(g.disc) < 0) pool.discs.push(g.disc);
    else if (g.kind === "corner") pool.cornerSlots += (g.slots || 1) * tier;
    else if (g.kind === "camp") pool.startBenefits += (g.benefits || 1) * tier;
    else if (g.kind === "layout" && g.layout && pool.layouts.indexOf(g.layout) < 0) pool.layouts.push(g.layout);
    else if (g.kind === "open") {
      const top = Math.min(META_OPEN_TIERS.length - 1, (g.tiers || 1) * tier);
      for (let i = 1; i <= top; i++) if (pool.openStages.indexOf(META_OPEN_TIERS[i]) < 0) pool.openStages.push(META_OPEN_TIERS[i]);
    }
  });
  ADV_PERK_IDS.forEach((id) => {
    const tier = metaTier(meta, id);
    if (tier <= 0) return;
    pool.owned[id] = tier;
    const g = ADV_PERKS[id].grant || {};
    if (g.focus) pool.startFocus = (pool.startFocus || 0) + (g.focus * tier);
    if (g.hpMul) pool.ironGritMul = (pool.ironGritMul || 0) + (g.hpMul * tier);
    if (g.revives) pool.revives = (pool.revives || 0) + (g.revives * tier);
    if (g.slots) pool.cornerSlots += (g.slots * tier);
  });
  return pool;
}

function buyAdvPerk(save, id) {
  if (!metaHasBlock(save)) return { ok: false, reason: "bad_save" };
  const p = ADV_PERKS[id];
  if (!p) return { ok: false, reason: "unknown_item" };
  const meta = save.meta;
  if (!meta.owned || typeof meta.owned !== "object") meta.owned = {};
  const cur = meta.owned[id] || 0;
  if (cur >= p.tiers) return { ok: false, reason: "maxed" };
  const cost = Math.round(p.price * Math.pow(p.step, cur));
  if (meta.renown < cost) return { ok: false, reason: "cannot_afford" };
  meta.renown -= cost;
  meta.spent += cost;
  meta.owned[id] = cur + 1;
  return { ok: true, reason: "bought", tier: cur + 1, cost };
}

/* the opening the run elected to take, resolved against what is owned -
   an unowned tier silently falls back to the full card rather than
   handing the run a premium it never paid for */
function metaOpenTier(save, want) {
  const allowed = metaRunPool(save).openStages;
  const w = metaInt(want, 0, META_OPEN_TIERS.length - 1);
  for (let i = allowed.length - 1; i >= 0; i--) if (allowed[i].tier <= w) return allowed[i];
  return META_OPEN_TIERS[0];
}
