/* =====================================================================
   Aqua Zero Heavens Arena - Custom Deck Builder & Loadout Constructor
   Luminara Digital

   Allows competitive players to construct custom technique loadouts
   subject to a 100-Point Discipline Budget for Ranked and Versus modes.
   ===================================================================== */

const DECK_BUILDER_STORAGE_KEY = "azha_custom_decks_v1";

const DeckBuilder = (function () {
  const MAX_BUDGET = 100;
  const MIN_CARDS = 12;
  const MAX_CARDS = 16;

  let customDecks = {}; // heroId -> { name, techniques: [] }

  function costOf(techId) {
    if (typeof TECH === "undefined" || !TECH[techId]) return 4;
    const t = TECH[techId];
    if (t.sig) return 18;
    const powerPart = Math.max(1, Math.round(t.power / 6));
    const learnPart = Math.max(1, Math.round(t.learn * 1.4));
    const prioPart = t.prio > 0 ? 2 : 0;
    return Math.max(2, Math.min(16, powerPart + learnPart + prioPart));
  }

  function calculateDeckCost(techniqueIds) {
    if (!Array.isArray(techniqueIds)) return 0;
    let total = 0;
    for (let i = 0; i < techniqueIds.length; i++) {
      total += costOf(techniqueIds[i]);
    }
    return total;
  }

  function validateDeck(techniqueIds) {
    if (!Array.isArray(techniqueIds)) {
      return { ok: false, error: "Deck must be an array of technique IDs" };
    }

    if (techniqueIds.length < MIN_CARDS) {
      return { ok: false, error: `Deck has ${techniqueIds.length} cards; minimum is ${MIN_CARDS}` };
    }
    if (techniqueIds.length > MAX_CARDS) {
      return { ok: false, error: `Deck has ${techniqueIds.length} cards; maximum is ${MAX_CARDS}` };
    }

    // Check duplicate cards
    const unique = new Set(techniqueIds);
    if (unique.size !== techniqueIds.length) {
      return { ok: false, error: "Duplicate techniques are not permitted in custom loadouts" };
    }

    // Check budget
    const totalCost = calculateDeckCost(techniqueIds);
    if (totalCost > MAX_BUDGET) {
      return { ok: false, error: `Total cost ${totalCost} exceeds budget limit of ${MAX_BUDGET}` };
    }

    if (typeof TECH === "undefined") {
      return { ok: true, cost: totalCost, remainingBudget: MAX_BUDGET - totalCost, count: techniqueIds.length, ranges: ["MID", "LONG"] };
    }

    // Rule 1: At least one fast opener / high initiative technique
    let hasOpener = false;
    // Rule 2: At least one defensive/guard/counter response
    let hasDefense = false;
    // Rule 3: Range coverage (at least 2 distinct ranges)
    const ranges = new Set();

    for (let i = 0; i < techniqueIds.length; i++) {
      const t = TECH[techniqueIds[i]];
      if (!t) continue;

      if (t.prio > 0 || t.speed >= 80 || (t.flags && t.flags.indexOf("fast") >= 0)) {
        hasOpener = true;
      }
      if (t.cls === "GUARD" || (t.flags && (t.flags.indexOf("parry") >= 0 || t.flags.indexOf("counter") >= 0))) {
        hasDefense = true;
      }
      if (t.range && t.range !== "ANY") {
        ranges.add(t.range);
      }
    }

    if (!hasOpener) {
      return { ok: false, error: "Deck must include at least one fast opener or initiative move" };
    }
    if (!hasDefense) {
      return { ok: false, error: "Deck must include at least one guard, parry, or counter response" };
    }
    if (ranges.size < 2) {
      return { ok: false, error: "Deck must cover at least 2 distinct combat ranges" };
    }

    return {
      ok: true,
      cost: totalCost,
      remainingBudget: MAX_BUDGET - totalCost,
      count: techniqueIds.length,
      ranges: Array.from(ranges),
    };
  }

  function exportDeckCode(heroId, deckName, techniqueIds) {
    const valid = validateDeck(techniqueIds);
    if (!valid.ok) return { ok: false, error: valid.error };

    const payload = JSON.stringify({
      h: heroId,
      n: deckName || "Custom Build",
      t: techniqueIds,
      c: valid.cost,
    });

    let b64 = "";
    if (typeof Buffer !== "undefined") {
      b64 = Buffer.from(payload, "utf8").toString("base64");
    } else if (typeof btoa === "function") {
      b64 = btoa(payload);
    } else {
      b64 = encodeURIComponent(payload);
    }

    return { ok: true, code: "AZD1-" + b64 };
  }

  function importDeckCode(deckCode) {
    if (typeof deckCode !== "string" || !deckCode.startsWith("AZD1-")) {
      return { ok: false, error: "Invalid deck code format" };
    }

    try {
      const b64 = deckCode.slice(5);
      let json = "";
      if (typeof Buffer !== "undefined") {
        json = Buffer.from(b64, "base64").toString("utf8");
      } else if (typeof atob === "function") {
        json = atob(b64);
      } else {
        json = decodeURIComponent(b64);
      }

      const parsed = JSON.parse(json);
      if (!parsed || !Array.isArray(parsed.t)) {
        return { ok: false, error: "Corrupt deck code content" };
      }

      const valid = validateDeck(parsed.t);
      if (!valid.ok) {
        return { ok: false, error: valid.error };
      }

      return {
        ok: true,
        heroId: parsed.h,
        deckName: parsed.n,
        techniques: parsed.t,
        cost: valid.cost,
      };
    } catch (e) {
      return { ok: false, error: "Failed to parse deck code" };
    }
  }

  function saveCustomDeck(heroId, deckName, techniqueIds) {
    const valid = validateDeck(techniqueIds);
    if (!valid.ok) return valid;

    // Hydrate from storage before mutating: this function may be the first
    // deck-builder call of the session, and without a prior load() the in-memory
    // customDecks is still {}, so save() below would clobber every other hero's
    // saved deck. Readers (getCustomDeck/getAllCustomDecks) load() defensively;
    // this mutator must too.
    load();

    customDecks[heroId] = {
      heroId: heroId,
      name: deckName || "Custom Deck",
      techniques: techniqueIds.slice(),
      cost: valid.cost,
      updatedAt: Date.now(),
    };

    save();
    return { ok: true, deck: customDecks[heroId] };
  }

  function getCustomDeck(heroId) {
    load();
    return customDecks[heroId] || null;
  }

  function getAllCustomDecks() {
    load();
    return Object.assign({}, customDecks);
  }

  function load() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(DECK_BUILDER_STORAGE_KEY);
        if (raw) {
          customDecks = JSON.parse(raw) || {};
        }
      }
    } catch (e) {
      console.warn("Could not load custom decks from localStorage", e);
    }
  }

  function save() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DECK_BUILDER_STORAGE_KEY, JSON.stringify(customDecks));
      }
    } catch (e) {
      console.warn("Could not save custom decks to localStorage", e);
    }
  }

  return {
    MAX_BUDGET: MAX_BUDGET,
    MIN_CARDS: MIN_CARDS,
    MAX_CARDS: MAX_CARDS,
    costOf: costOf,
    calculateDeckCost: calculateDeckCost,
    validateDeck: validateDeck,
    exportDeckCode: exportDeckCode,
    importDeckCode: importDeckCode,
    saveCustomDeck: saveCustomDeck,
    getCustomDeck: getCustomDeck,
    getAllCustomDecks: getAllCustomDecks,
    load: load,
    save: save,
  };
})();

if (typeof window !== "undefined") {
  window.DeckBuilder = DeckBuilder;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = DeckBuilder;
}
