/* =====================================================================
   RENOWN - the currency that outlives a run.

   Mastery already answers "I lost, so that fight was worth nothing".
   This layer answers the bigger complaint: run ten offers exactly what
   run one did. So these tests spend most of their time on the two things
   that would make it worse than shipping nothing at all -

     it must never sell a fighter (everyone is playable from a fresh
     save), and it must never sell a number (the roster balance was
     measured against the pool, so renown widens the pool instead);

   - and on the arithmetic, which has to be total. A meta-currency that
   throws on a hand-edited save takes the whole page down at load, and a
   canBuy/buy pair that can go negative is a save-file exploit.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section } = h;
  /* The harness EXPORTS list is owned by the harness, not by this module, so
     anything renown adds is reached through the page's own scope instead. exec
     returns the live binding, so `A` is the real module either way and no name
     here depends on an edit to tests/harness.js. */
  const A = Object.create(api);
  [
    "META_SAVE_VERSION", "META_CONFIG", "META_AWARD", "META_ITEMS", "META_ITEM_IDS",
    "META_OPEN_TIERS", "META_BUY_REASON", "metaItem", "DEF_META", "metaNormalize",
    "metaMigrate", "metaHasBlock", "metaRunTally", "metaAwardFor", "metaCredit",
    "metaTier", "metaPriceOf", "metaCanBuy", "metaBuy", "metaRows", "metaSummary",
    "metaRunPool", "metaOpenTier", "SHOP_CONFIG", "DISCIPLINES",
  ].forEach((n) => {
    if (A[n] === undefined) {
      A[n] = api.exec('typeof ' + n + ' !== "undefined" ? ' + n + " : undefined");
    }
  });

  section("the module is wired in");
  {
    ok(typeof A.metaAwardFor === "function", "the award calculation is reachable");
    ok(typeof A.metaBuy === "function" && typeof A.metaCanBuy === "function", "so is the canBuy/buy pair");
    ok(typeof A.metaRunPool === "function", "and the run-pool query");
    ok(A.META_ITEM_IDS.length >= 8, "there is a catalogue to spend on", A.META_ITEM_IDS.length);
    ok(A.META_SAVE_VERSION >= 1, "and the block is versioned", A.META_SAVE_VERSION);
  }

  section("every run pays, and depth is what it pays for");
  {
    const die1 = A.metaAwardFor({ stage: 1, wins: 4 });
    const die2 = A.metaAwardFor({ stage: 2, wins: 8 });
    const die3 = A.metaAwardFor({ stage: 3, wins: 13 });
    const clear = A.metaAwardFor({ stage: 4, wins: 20, cleared: true });
    ok(die1.total > 0, "a run that dies in stage one still pays", die1.total);
    ok(die2.total > die1.total && die3.total > die2.total, "deeper always pays more",
       [die1.total, die2.total, die3.total].join(" -> "));
    ok(clear.total > die3.total * 2, "and finishing the climb pays properly", clear.total);
    ok(die1.lines.length >= 1 && die1.lines.every((l) => !!l.label && l.amount > 0),
       "the award shows its arithmetic instead of one mystery number", die1.lines.length + " lines");
  }
  {
    // nothing here is allowed to depend on winning: a lost run is the
    // whole reason the currency exists
    const lost = A.metaAwardFor({ stage: 3, wins: 11, cleared: false });
    ok(lost.total > 0, "a lost run is paid, not consoled", lost.total);
    ok(A.metaAwardFor({ stage: 2, wins: 0 }).total > 0, "so is a run that won nothing");
  }
  {
    const flat = A.metaAwardFor({ stage: 4, wins: 20, cleared: true });
    const ngp = A.metaAwardFor({ stage: 4, wins: 20, cleared: true, ng: 2 });
    const hard = A.metaAwardFor({ stage: 4, wins: 20, cleared: true, openTier: 2 });
    ok(ngp.total > flat.total, "NG+ pays a premium", flat.total + " -> " + ngp.total);
    ok(hard.total > flat.total, "so does electing the harder opening", flat.total + " -> " + hard.total);
    ok(A.metaAwardFor({ stage: 4, cleared: true, ng: 99, openTier: 99 }).mult <=
       1 + A.META_AWARD.ngCap + A.META_AWARD.openCap, "and both multipliers are capped");
  }
  {
    // a.beaten is cleared at every stage clear, so the run does not carry a
    // lifetime win count - the award must not quietly depend on one
    const fromRun = A.metaAwardFor({ stage: 2, beaten: { tf0: 1, tf1: 1, rv3: 1 } });
    ok(fromRun.tally.wins === 3, "wins fall back to what the run does record", fromRun.tally.wins);
    ok(A.metaAwardFor({ stage: 2, wins: 9, beaten: { tf0: 1 } }).tally.wins === 9,
       "and an explicit count is preferred when the caller has one");
    ok(A.metaAwardFor({ stage: 5 }).total > A.metaAwardFor({ stage: 2, wins: 6 }).total,
       "depth outweighs the garnish, which is why the garnish is optional");
  }

  section("the award is total - junk in, a defined number out");
  {
    let threw = null, worst = 0;
    const junk = [null, undefined, 0, "", "x", [], {}, NaN, Infinity,
                  { stage: -99, wins: "many", ng: NaN, cleared: "yes" },
                  { stage: 1e12, wins: 1e12, cleared: true, ng: 1e9, openTier: 1e9 },
                  { stage: {}, wins: [], beaten: "nope" },
                  JSON.parse('{"stage":2,"__proto__":{"x":1}}')];
    try {
      junk.forEach((j) => {
        const r = A.metaAwardFor(j);
        if (!(r.total >= 1) || (r.total | 0) !== r.total) throw new Error("bad total for " + JSON.stringify(j));
        worst = Math.max(worst, r.total);
      });
    } catch (e) { threw = String(e.message || e); }
    ok(!threw, "thirteen junk runs, no exception and no NaN", threw || "clean");
    ok(worst <= A.META_CONFIG.awardCap, "and nothing printed money", worst);
    ok(({}).x === undefined, "a poisoned run object did not reach the prototype");
  }

  section("the save block, and the save that has never seen one");
  {
    const fresh = A.DEF_META();
    ok(fresh.renown === 0 && fresh.earned === 0 && fresh.spent === 0, "a new ledger is empty");
    ok(fresh.owned && Object.keys(fresh.owned).length === 0, "and owns nothing");
    ok(!A.metaHasBlock({}), "a save without the block is recognised as such");
    ok(A.metaHasBlock({ meta: fresh }), "and one with it too");
  }
  {
    const old = { v: 4, name: "CHALLENGER", unlocked: [1, 2], mastery: { 3: 40 } };
    const mig = A.metaMigrate(old);
    ok(!!mig.meta && mig.meta.renown === 0, "a pre-renown save migrates to an empty ledger");
    ok(old.meta === undefined, "without touching the save it was handed");
    ok(mig.name === "CHALLENGER" && mig.unlocked === old.unlocked && mig.mastery === old.mastery,
       "and everything else carries across untouched");
    const twice = A.metaMigrate(A.metaMigrate({ meta: { renown: 7, owned: { corner_slot: 1 } } }));
    ok(twice.meta.renown === 7 && twice.meta.owned.corner_slot === 1, "migrating twice changes nothing");
  }
  {
    // the real save object, whatever shape the page currently gives it
    A.exec("SAVE=DEF_SAVE(); persist();");
    const S = A.getSave();
    const mig = A.metaMigrate(S);
    ok(mig !== S, "migration returns a new save rather than editing yours");
    ok(!!mig.meta && typeof mig.meta === "object", "and the default save comes out with a ledger");
    ok(Array.isArray(mig.unlocked) && mig.unlocked.length === S.unlocked.length,
       "with the roster untouched", mig.unlocked.length);
  }
  {
    // a tampered or truncated blob must normalise, never throw
    const nasty = [null, undefined, 0, "", "nonsense", [], NaN,
                   { renown: -500 }, { renown: "1e9" }, { renown: 1e12, earned: -5 },
                   { owned: "no" }, { owned: [] }, { owned: { corner_slot: 99, nope: 4 } },
                   { owned: { corner_slot: -3 } }, JSON.parse('{"renown":5,"__proto__":{"y":1}}')];
    let threw = null, bad = [];
    try {
      nasty.forEach((n) => {
        const b = A.metaNormalize(n);
        if (b.renown < 0 || b.spent < 0 || b.earned < 0) bad.push("negative");
        if (b.renown > A.META_CONFIG.balanceCap) bad.push("uncapped");
        if ((b.renown | 0) !== b.renown) bad.push("not an integer");
        Object.keys(b.owned).forEach((id) => {
          if (!A.META_ITEMS[id]) bad.push("ghost:" + id);
          else if (b.owned[id] > A.META_ITEMS[id].tiers) bad.push("over-tier:" + id);
        });
      });
    } catch (e) { threw = String(e.message || e); }
    ok(!threw, "fifteen tampered blocks, no exception", threw || "clean");
    ok(bad.length === 0, "and every one came out inside the rules", bad.join(",") || "all clean");
    ok(({}).y === undefined, "including one carrying a prototype key");
    ok(A.metaNormalize({ renown: 100, earned: 0 }).earned >= 100, "lifetime earned is never under the wallet");
  }

  section("buying is total, and can never go negative");
  {
    const wallet = A.metaCredit(A.DEF_META(), 300);
    ok(wallet.renown === 300 && wallet.earned === 300, "renown is banked", wallet.renown);
    ok(wallet.runs === 1, "and the run is counted");
    ok(A.metaCredit(A.DEF_META(), A.metaAwardFor({ stage: 3 })).renown ===
       A.metaAwardFor({ stage: 3 }).total, "credit takes the award object directly");
    ok(A.metaCredit(null, 25).renown === 25, "crediting a missing block still works");
    ok(A.metaCredit(A.DEF_META(), -900).renown === 0, "a negative award cannot drain the wallet");
    ok(A.metaCredit(A.DEF_META(), 1e12).renown === A.META_CONFIG.balanceCap,
       "and one huge one stops at the ceiling", A.metaCredit(A.DEF_META(), 1e12).renown);
    ok(A.metaAwardFor({ stage: 9, wins: 99, cleared: true, ng: 9 }).total <= A.META_CONFIG.awardCap,
       "capping what a run pays is the award's job, and it does it");
  }
  {
    const wallet = A.metaCredit(A.DEF_META(), 300);
    const snapshot = JSON.stringify(wallet);
    const first = A.metaBuy(wallet, "corner_slot");
    ok(first.ok && first.price > 0, "a slot can be bought", first.price);
    ok(JSON.stringify(wallet) === snapshot, "and buying did not mutate the block handed in");
    ok(first.meta.renown === 300 - first.price, "the price came out of the wallet", first.meta.renown);
    ok(first.meta.spent === first.price, "and went into the ledger");
    const second = A.metaBuy(first.meta, "corner_slot");
    ok(second.ok && second.price > first.price, "the repeat costs more", first.price + " -> " + second.price);
    const third = A.metaBuy(second.meta, "corner_slot");
    ok(!third.ok && third.reason === "maxed", "and it runs out", third.reason);
    ok(third.meta.owned.corner_slot === 2, "a refusal still hands back a usable block");
    ok(A.metaPriceOf(second.meta, "corner_slot") === 0, "a maxed item has no next price");
  }
  {
    const broke = A.metaCredit(A.DEF_META(), 1);
    const no = A.metaCanBuy(broke, "camp_start");
    ok(!no.ok && no.reason === "cannot_afford", "being broke is an answer, not an exception");
    ok(no.short === no.price - 1, "and it says how short you are", no.short);
    ok(A.metaBuy(broke, "camp_start").meta.renown === 1, "a refused purchase spends nothing");
    ok(!!A.META_BUY_REASON[no.reason], "every reason has copy for the screen", no.reason);
  }
  {
    // the exploit surface: junk ids, junk blocks, and the id that is truthy
    // on every plain object
    const ids = ["", null, undefined, 0, 42, "no_such_item", "__proto__", "constructor", "toString", {}, []];
    const blocks = [null, undefined, 0, "x", [], {}, { renown: 1e12 }, { owned: null }];
    let threw = null, negative = 0, granted = 0;
    try {
      blocks.forEach((b) => {
        ids.forEach((id) => {
          const can = A.metaCanBuy(b, id);
          const buy = A.metaBuy(b, id);
          if (can.ok || buy.ok) granted++;
          if (buy.meta.renown < 0) negative++;
          Object.keys(buy.meta.owned).forEach((k) => { if (!A.META_ITEMS[k]) granted++; });
        });
        A.META_ITEM_IDS.forEach((id) => { if (A.metaBuy(b, id).meta.renown < 0) negative++; });
      });
    } catch (e) { threw = String(e.message || e); }
    ok(!threw, "eighty-eight junk buys, no exception", threw || "clean");
    ok(granted === 0, "nothing was ever granted for free", granted);
    ok(negative === 0, "and no path put a save into debt", negative);
    ok(A.metaCanBuy({ renown: 9999, owned: {} }, "__proto__").reason === "unknown_item",
       "the prototype is not a purchasable");
  }
  {
    // buy everything, in every order, from a fat wallet
    let acc = A.metaCredit(A.DEF_META(), 5000);
    let guard = 0, negative = 0;
    while (guard++ < 200) {
      let bought = false;
      for (const id of A.META_ITEM_IDS) {
        const r = A.metaBuy(acc, id);
        if (r.ok) bought = true;
        acc = r.meta;
        if (acc.renown < 0) negative++;
      }
      if (!bought) break;
    }
    ok(negative === 0, "buying the whole wall never dips below zero");
    ok(acc.spent + acc.renown === 5000, "and the books balance", acc.spent + " + " + acc.renown);
    const maxed = A.META_ITEM_IDS.every((id) => A.metaTier(acc, id) === A.META_ITEMS[id].tiers);
    ok(maxed, "with everything owned at full tier");
    ok(A.META_ITEM_IDS.every((id) => !A.metaCanBuy(acc, id).ok), "and nothing left to sell");
  }

  section("the catalogue sells breadth, never a fighter and never a number");
  {
    let bad = [];
    A.META_ITEM_IDS.forEach((id) => {
      const it = A.META_ITEMS[id];
      if (!it.name || !it.desc || !it.tag) bad.push(id + ":copy");
      if (!(it.price > 0) || !(it.tiers >= 1)) bad.push(id + ":price");
      if (["disc", "corner", "camp", "layout", "open"].indexOf(it.grant.kind) < 0) bad.push(id + ":grant");
      // a purchase that hands out a stat is the failure mode this file exists
      // to avoid - the roster spread was measured against the current numbers
      ["pow", "power", "dmg", "atk", "def", "hp", "stam", "acc", "spd", "side", "dmgOut", "dmgIn"]
        .forEach((k) => { if (it.grant[k] !== undefined || it[k] !== undefined) bad.push(id + ":" + k); });
      // and one that hands out a fighter breaks rule 3 outright
      ["fid", "fighter", "hero", "unlocked", "roster"].forEach((k) => {
        if (it.grant[k] !== undefined) bad.push(id + ":" + k);
      });
    });
    ok(bad.length === 0, "every purchase is documented, priced and structural", bad.join(",") || "all clean");
    ok(new Set(A.META_ITEM_IDS).size === A.META_ITEM_IDS.length, "no duplicate ids");
    ok(!/fighter|roster/i.test(JSON.stringify(A.META_ITEMS)),
       "and the catalogue does not so much as mention the roster");
  }
  {
    // the arts sold have to be real arts, or the drafter is handed a ghost
    const arts = A.META_ITEM_IDS
      .filter((id) => A.META_ITEMS[id].grant.kind === "disc")
      .map((id) => A.META_ITEMS[id].grant.disc);
    ok(arts.length >= 4, "several arts are for sale", arts.length);
    ok(arts.every((d) => !!A.DISCIPLINES[d]), "and every one of them is a real discipline", arts.join(","));
    const ranges = {};
    arts.forEach((d) => A.DISCIPLINES[d].ranges.forEach((r) => (ranges[r] = 1)));
    ok(Object.keys(ranges).length === 4, "between them they open all four ranges", Object.keys(ranges).join(","));
    ok(new Set(arts).size === arts.length, "and no art is sold twice");
  }
  {
    // the restated constant. This module reads no other module on purpose,
    // so the one number it copies has to be pinned or it will drift.
    ok(A.META_CONFIG.cornerBase === A.SHOP_CONFIG.cornerCarry,
       "the corner-bag base still agrees with the shop", A.META_CONFIG.cornerBase + " vs " + A.SHOP_CONFIG.cornerCarry);
  }
  {
    const t = A.META_OPEN_TIERS;
    ok(t[0].tier === 0 && t[0].stage === 1 && t[0].purseMul === 1, "the stock opening is the free one");
    let mono = true;
    for (let i = 1; i < t.length; i++) if (t[i].stage <= t[i - 1].stage || t[i].purseMul <= t[i - 1].purseMul) mono = false;
    ok(mono, "and each paid opening starts deeper AND pays more - a bet, not a buff");
    ok(t.every((o) => !!o.label), "each one is nameable on screen");
  }

  section("what the run pool should contain");
  {
    const fresh = A.metaRunPool({ meta: A.DEF_META() });
    ok(fresh.cornerSlots === A.SHOP_CONFIG.cornerCarry, "a fresh save gets the stock bag", fresh.cornerSlots);
    ok(fresh.layouts.length === 1 && fresh.layouts[0] === A.META_CONFIG.baseLayout,
       "the stock layout", fresh.layouts.join(","));
    ok(fresh.openStages.length === 1 && fresh.openStages[0].tier === 0, "and only the full card");
    ok(fresh.discs.length === 0 && fresh.startBenefits === 0, "with nothing bought yet, nothing extra");
    ok(!("unlocked" in fresh) && !("fighters" in fresh) && !("hero" in fresh),
       "and the pool has no opinion about who you may play", Object.keys(fresh).join(","));
  }
  {
    // the pool query is the one thing that runs on every single run start,
    // so a junk save must still produce a playable answer
    let threw = null, bad = [];
    [null, undefined, 0, "x", [], {}, { meta: null }, { meta: "no" }, { meta: [] },
     { meta: { owned: { nope: 3 } } }, A.DEF_META()].forEach((s) => {
      try {
        const p = A.metaRunPool(s);
        if (p.cornerSlots < A.SHOP_CONFIG.cornerCarry) bad.push("bag:" + p.cornerSlots);
        if (!p.layouts.length || p.layouts[0] !== A.META_CONFIG.baseLayout) bad.push("layouts");
        if (!p.openStages.length || p.openStages[0].tier !== 0) bad.push("openings");
        if (!Array.isArray(p.discs)) bad.push("discs");
      } catch (e) { threw = String(e.message || e); }
    });
    ok(!threw, "eleven junk saves, no exception from the pool query", threw || "clean");
    ok(bad.length === 0, "and every one yields a complete, playable pool", bad.join(",") || "all clean");
  }
  {
    let rich = A.DEF_META();
    A.META_ITEM_IDS.forEach((id) => { rich.owned[id] = A.META_ITEMS[id].tiers; });
    const p = A.metaRunPool({ meta: rich });
    ok(p.cornerSlots > A.SHOP_CONFIG.cornerCarry, "a full wall widens the corner bag", p.cornerSlots);
    ok(p.discs.length >= 4, "adds arts to the draft", p.discs.join(","));
    ok(p.startBenefits >= 1, "starts the run in camp", p.startBenefits);
    ok(p.layouts.length >= 3 && p.layouts[0] === A.META_CONFIG.baseLayout,
       "adds layouts without displacing the stock one", p.layouts.join(","));
    ok(p.openStages.length >= 2, "and offers the harder openings", p.openStages.map((o) => o.tier).join(","));
    // the whole point: every one of those is a pool, not a stat
    ok(p.cornerSlots - A.SHOP_CONFIG.cornerCarry <= 3, "and the bag stays a bag", p.cornerSlots);
    ok(p.startBenefits <= 1, "the head start is one benefit, not a camp", p.startBenefits);
  }
  {
    const rich = A.DEF_META();
    A.META_ITEM_IDS.forEach((id) => { rich.owned[id] = A.META_ITEMS[id].tiers; });
    ok(A.metaOpenTier({ meta: A.DEF_META() }, 2).tier === 0,
       "asking for an opening you never bought quietly gives you the full card");
    ok(A.metaOpenTier({ meta: rich }, 2).stage > 1, "an owned one is honoured", A.metaOpenTier({ meta: rich }, 2).stage);
    ok(A.metaOpenTier({ meta: rich }, 1e9).tier === A.META_OPEN_TIERS.length - 1, "and a silly one clamps");
    ok(A.metaOpenTier(null, 2).purseMul === 1, "a save with no ledger fights the full card for full money");
  }

  section("priced against measured reality");
  {
    // a full clear is 11-22 fights and a stage carries 5-7, so most runs die
    // in stage two or three. The first purchase has to land in about three
    // of those, and the last one must not.
    const ordinary = A.metaAwardFor({ stage: 2, wins: 8 }).total;
    const decent = A.metaAwardFor({ stage: 3, wins: 13 }).total;
    const cheapest = Math.min.apply(null, A.META_ITEM_IDS.map((id) => A.META_ITEMS[id].price));
    ok(ordinary * 3 >= cheapest, "three ordinary runs buy the first thing",
       ordinary + " x3 = " + ordinary * 3 + " vs " + cheapest);
    ok(ordinary < cheapest, "but one does not", ordinary + " vs " + cheapest);
    let total = 0;
    A.META_ITEM_IDS.forEach((id) => {
      const it = A.META_ITEMS[id];
      for (let t = 0; t < it.tiers; t++) total += Math.round(it.price * Math.pow(it.step, t));
    });
    const runsToOwnAll = total / decent;
    ok(runsToOwnAll > 12, "the whole wall is a long tail, not a weekend", Math.round(runsToOwnAll) + " runs");
    ok(runsToOwnAll < 60, "and not a second job either", Math.round(runsToOwnAll) + " runs");
  }
  {
    // the shop's own big-ticket items are the yardstick: a camp benefit is
    // priced above a stage's purse there, and renown must not undercut it
    const camp = A.META_ITEMS.camp_start;
    ok(camp.price > A.SHOP_CONFIG.benefitBase / 2,
       "a standing camp benefit is not cheaper than the gym's", camp.price + " vs " + A.SHOP_CONFIG.benefitBase);
    ok(camp.price >= A.metaAwardFor({ stage: 4, wins: 20, cleared: true }).total,
       "and a single full clear does not buy it outright", camp.price);
  }

  section("the readouts");
  {
    const rows = A.metaRows(A.metaCredit(A.DEF_META(), 70));
    ok(rows.length === A.META_ITEM_IDS.length, "one row per purchase", rows.length);
    ok(rows.every((r) => !!r.id), "every row is addressed by id, never by index");
    ok(rows.every((r) => !!r.name && !!r.desc && !!r.tag && typeof r.tier === "number"), "and carries its own copy");
    ok(rows.some((r) => r.can), "with something affordable at 70");
    ok(rows.some((r) => !r.can && r.reason === "cannot_afford"), "and something to save for");
    ok(rows.every((r) => !!r.note), "each row explains itself");
    ok(A.metaRows(null).length === A.META_ITEM_IDS.length, "a junk save still draws the whole wall");
    const ids = rows.map((r) => r.id);
    ok(JSON.stringify(ids) === JSON.stringify(A.META_ITEM_IDS), "rows come back in catalogue order");
  }
  {
    ok(typeof A.metaSummary(A.DEF_META()) === "string" && A.metaSummary(A.DEF_META()).length > 0,
       "a fresh ledger has a one-liner", A.metaSummary(A.DEF_META()));
    ok(A.metaSummary(null).length > 0, "so does no ledger at all");
    const rich = A.DEF_META();
    A.META_ITEM_IDS.forEach((id) => { rich.owned[id] = A.META_ITEMS[id].tiers; });
    ok(A.metaSummary(rich).indexOf("BARE") >= 0, "and a bought-out one says so", A.metaSummary(rich));
  }

  section("nothing here draws, reads input or touches the save");
  {
    // rule 7's spirit, applied to a progression module: the whole file has
    // to be assertable in a sandbox with no canvas and no SAVE
    const src = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "src", "progress", "meta.js"), "utf8");
    // prose is allowed to say "canvas"; code is not, so measure the code
    const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const banned = ["cx.", "canvas", "document", "localStorage", "AudioContext", "onKey", "addEventListener"];
    const found = banned.filter((b) => code.indexOf(b) >= 0);
    ok(found.length === 0, "no rendering, no DOM, no input", found.join(",") || "clean");
    ok(!/\bSAVE\b/.test(code), "and it never reaches for the global save");
    ok(!/\b(import|export|require)\b/.test(code), "it is a plain script, as the build requires");
    const nonAscii = src.split("").filter((c) => c.charCodeAt(0) > 126);
    ok(nonAscii.length === 0, "ASCII only, as the build requires", nonAscii.join(""));
  }
};
