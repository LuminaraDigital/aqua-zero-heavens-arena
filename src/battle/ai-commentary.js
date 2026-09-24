/* =====================================================================
   Aqua Zero Heavens Arena - Dynamic Ringside Commentary & Banter
   Luminara Digital

   Event-driven ringside broadcast commentary pipeline featuring multiple
   announcer personas (Technical Analyst, Hype Play-by-Play, Veteran),
   procedural contextual commentary lattices, rate limiting, and optional
   asynchronous LLM streaming.

   Structural invariants (fight-night presentation rules):
   - Opening tape, round open, round summary, finish, and official result
     lines always survive; rate limits never drop them.
   - Judge scorecards stay sealed until revealScorecards() is called.
   ===================================================================== */

const CombatEvents = (function() {
  const listeners = {};

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }

  function emit(event, context) {
    if (listeners[event]) {
      listeners[event].forEach(cb => {
        try { cb(context); } catch (e) { console.error("CombatEvent error", e); }
      });
    }
  }

  return { on, off, emit };
})();

const AICommentary = (function() {
  const STRUCTURAL = {
    TAPE: true,
    ROUND_OPEN: true,
    ROUND_SUMMARY: true,
    FINISH: true,
    OFFICIAL_RESULT: true,
    SCORECARD_REVEAL: true,
  };

  const LATTICE = {
    TAPE: [
      "Tale of the tape is set. Both corners look locked in.",
      "Weights made. Records read. The cage is waiting.",
    ],
    ROUND_OPEN: [
      "Here we go - the round is live!",
      "The referee waves them in. Fight!",
    ],
    ROUND_SUMMARY: [
      "That round goes in the books. Corners reset.",
      "A hard round either way - the cards will have an opinion.",
    ],
    CLASH: [
      "Both fighters trade heavy leather in the pocket!",
      "A violent collision of strikes at the same split-second!",
      "Neither man takes a backward step in that exchange!",
    ],
    COUNTER_HIT: [
      "Timed him stepping in - pure counter-striking perfection!",
      "Caught leaning right into the strike!",
      "That is the danger of reckless entry against a seasoned striker!",
    ],
    CORNER_TRAP: [
      "Backed against the ropes with nowhere left to circle!",
      "The pressure is suffocating in that corner!",
      "Trapped on the perimeter - this is where fights get finished!",
    ],
    REVERSAL: [
      "What a ring escape! Completely turned the tables!",
      "Spun out of danger and pinned the aggressor against the ropes!",
      "Masterful ringcraft under extreme pressure!",
    ],
    STAMINA_BREAK: [
      "Gasping for air - the gas tank is completely empty!",
      "Winded and vulnerable! That missed swing cost everything!",
      "Stamina broken! The guard is dropping!",
    ],
    SIGNATURE_SUPER: [
      "Uncorking the signature technique with maximum torque!",
      "Here comes the finisher! Everything behind this shot!",
      "A career-defining blow unleashed!",
    ],
    CLUTCH_COMEBACK: [
      "Surviving on pure heart and instinct at single-digit health!",
      "Refusing to go down! What unbelievable resilience!",
      "Incredible grit inside the championship minutes!",
    ],
    KNOCKOUT: [
      "IT IS ALL OVER! A spectacular knockout finish!",
      "Down and out cold! What an emphatic statement!",
      "Clean off the feet! The referee waves it off immediately!",
    ],
    SUBMISSION_TAP: [
      "Locked in tight - there is the tap! Flawless submission finish!",
      "Nowhere to go! The tap comes instantly!",
      "Technique overcoming raw power on the canvas!",
    ],
    PERFECT_GUARD: [
      "Absorbed cleanly on the guard - not an inch yielded!",
      "Calculated block! Deflected the brunt of that impact!",
    ],
    CONTROL: [
      "Clear control in the clinch - short shots landing upstairs.",
      "Top position locked in. Ground strikes are coming.",
    ],
    CUT: [
      "That cut is opening up - the doctor will want a look.",
      "Blood in the eye now. Accuracy is going to suffer.",
    ],
    FINISH: [
      "And that is the finish!",
      "The fight is over!",
    ],
    OFFICIAL_RESULT: [
      "The official decision is in.",
      "Result confirmed by the commission desk.",
    ],
    SCORECARD_REVEAL: [
      "The judges' scorecards are now open.",
      "Cards revealed - here is how they saw it.",
    ],
  };

  let lastEventTurn = -10;
  let commentaryHistory = [];
  let scorecardsSealed = true;
  let sealedCards = null;
  /* WHO IS BEING TALKED ABOUT. Emitters hand over fighterName as the roster
     first name of whoever is in that corner, and for an AZX Force patrol the
     corner is a BORROWED roster fighter wearing a silhouette - so the HUD
     said AZX FORCE while the broadcast said MIKE. The page installs a
     resolver that maps a context back to the name the HUD prints; until one
     is installed the emitter's name is used as given. */
  let nameResolver = null;

  function setNameResolver(fn) {
    nameResolver = typeof fn === "function" ? fn : null;
  }
  function displayNameFor(context) {
    if (!context) return "";
    let name = context.fighterName || "";
    if (nameResolver) {
      try { name = nameResolver(context) || name; } catch (e) { /* the emitter's name stands */ }
    }
    return name ? String(name) : "";
  }

  function isStructural(event) {
    return !!STRUCTURAL[event];
  }

  function generateLine(event, context, rnd) {
    const R = rnd || Math.random;
    const pool = LATTICE[event];
    if (!pool || !pool.length) return null;

    const turn = context && context.turn !== undefined ? context.turn : 0;
    const structural = isStructural(event);
    const isPriority = event === "KNOCKOUT" || event === "SIGNATURE_SUPER"
      || event === "CLUTCH_COMEBACK" || event === "FINISH" || event === "OFFICIAL_RESULT"
      || event === "SCORECARD_REVEAL" || structural;
    if (!isPriority && turn - lastEventTurn < 2) {
      return null;
    }
    lastEventTurn = turn;

    const idx = Math.floor(R() * pool.length);
    let line = pool[idx];

    const who = displayNameFor(context);
    if (who) {
      line = who.toUpperCase() + ": " + line;
    }

    const item = {
      event: event,
      text: line,
      turn: turn,
      timestamp: Date.now(),
      structural: structural,
    };
    commentaryHistory.push(item);
    if (commentaryHistory.length > 40) commentaryHistory.shift();

    if (typeof FloatingFeedback !== "undefined" && FloatingFeedback.add) {
      const displayType = isPriority ? "CRITICAL COUNTER" : "TELL READ";
      FloatingFeedback.add(line, 480, 180, displayType);
    }

    return item;
  }

  /* Seal judge cards until the official result. */
  function sealScorecards(cards) {
    scorecardsSealed = true;
    sealedCards = cards || { judgeA: null, judgeB: null, judgeC: null };
    return { sealed: true };
  }

  function revealScorecards(rnd) {
    scorecardsSealed = false;
    const cards = sealedCards || { judgeA: "29-28", judgeB: "29-28", judgeC: "28-29" };
    const line = generateLine("SCORECARD_REVEAL", { turn: 999 }, rnd);
    return { sealed: false, cards: cards, line: line };
  }

  function scorecardsAreSealed() {
    return scorecardsSealed;
  }

  function getHistory() {
    return commentaryHistory.slice();
  }

  function structuralLines() {
    return commentaryHistory.filter((h) => h.structural);
  }

  function clearHistory() {
    commentaryHistory = [];
    lastEventTurn = -10;
    scorecardsSealed = true;
    sealedCards = null;
  }

  function assertStructuralPresent(required) {
    const need = required || ["TAPE", "ROUND_OPEN", "FINISH", "OFFICIAL_RESULT"];
    const have = {};
    commentaryHistory.forEach((h) => { have[h.event] = true; });
    const missing = need.filter((e) => !have[e]);
    return { ok: missing.length === 0, missing: missing };
  }

  CombatEvents.on("COUNTER_HIT", ctx => generateLine("COUNTER_HIT", ctx));
  CombatEvents.on("CORNER_TRAP", ctx => generateLine("CORNER_TRAP", ctx));
  CombatEvents.on("REVERSAL", ctx => generateLine("REVERSAL", ctx));
  CombatEvents.on("STAMINA_BREAK", ctx => generateLine("STAMINA_BREAK", ctx));
  CombatEvents.on("SIGNATURE_SUPER", ctx => generateLine("SIGNATURE_SUPER", ctx));
  CombatEvents.on("KNOCKOUT", ctx => generateLine("KNOCKOUT", ctx));
  CombatEvents.on("SUBMISSION_TAP", ctx => generateLine("SUBMISSION_TAP", ctx));
  CombatEvents.on("PERFECT_GUARD", ctx => generateLine("PERFECT_GUARD", ctx));
  CombatEvents.on("CONTROL", ctx => generateLine("CONTROL", ctx));
  CombatEvents.on("CUT", ctx => generateLine("CUT", ctx));

  return {
    generateLine: generateLine,
    getHistory: getHistory,
    clearHistory: clearHistory,
    LATTICE: LATTICE,
    STRUCTURAL: STRUCTURAL,
    isStructural: isStructural,
    sealScorecards: sealScorecards,
    revealScorecards: revealScorecards,
    scorecardsAreSealed: scorecardsAreSealed,
    structuralLines: structuralLines,
    assertStructuralPresent: assertStructuralPresent,
    setNameResolver: setNameResolver,
    displayNameFor: displayNameFor,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { AICommentary, CombatEvents };
}
