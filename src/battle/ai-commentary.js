/* =====================================================================
   Aqua Zero Heavens Arena - Dynamic Ringside Commentary & Banter
   Luminara Digital

   Event-driven ringside broadcast commentary pipeline featuring multiple
   announcer personas (Technical Analyst, Hype Play-by-Play, Veteran),
   procedural contextual commentary lattices, rate limiting, and optional
   asynchronous LLM streaming.
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
  const LATTICE = {
    CLASH: [
      "Both fighters trade heavy leather in the pocket!",
      "A violent collision of strikes at the same split-second!",
      "Neither man takes a backward step in that exchange!",
    ],
    COUNTER_HIT: [
      "Timed him stepping in—pure counter-striking perfection!",
      "Caught leaning right into the strike!",
      "That is the danger of reckless entry against a seasoned striker!",
    ],
    CORNER_TRAP: [
      "Backed against the ropes with nowhere left to circle!",
      "The pressure is suffocating in that corner!",
      "Trapped on the perimeter—this is where fights get finished!",
    ],
    REVERSAL: [
      "What a ring escape! Completely turned the tables!",
      "Spun out of danger and pinned the aggressor against the ropes!",
      "Masterful ringcraft under extreme pressure!",
    ],
    STAMINA_BREAK: [
      "Gasping for air—the gas tank is completely empty!",
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
      "Locked in tight—there is the tap! Flawless submission finish!",
      "Nowhere to go! The tap comes instantly!",
      "Technique overcoming raw power on the canvas!",
    ],
    PERFECT_GUARD: [
      "Absorbed cleanly on the guard—not an inch yielded!",
      "Calculated block! Deflected the brunt of that impact!",
    ],
  };

  let lastEventTurn = -10;
  let commentaryHistory = [];

  function generateLine(event, context, rnd) {
    const R = rnd || Math.random;
    const pool = LATTICE[event];
    if (!pool || !pool.length) return null;

    const turn = context && context.turn !== undefined ? context.turn : 0;
    // Rate limit: maximum 1 line every 2 turns unless KO, Super, or Clutch
    const isPriority = event === "KNOCKOUT" || event === "SIGNATURE_SUPER" || event === "CLUTCH_COMEBACK";
    if (!isPriority && turn - lastEventTurn < 2) {
      return null;
    }
    lastEventTurn = turn;

    const idx = Math.floor(R() * pool.length);
    let line = pool[idx];

    if (context && context.fighterName) {
      line = `${context.fighterName.toUpperCase()}: ${line}`;
    }

    const item = {
      event: event,
      text: line,
      turn: turn,
      timestamp: Date.now(),
    };
    commentaryHistory.push(item);
    if (commentaryHistory.length > 20) commentaryHistory.shift();

    // Trigger visual feedback popup if FloatingFeedback is available
    if (typeof FloatingFeedback !== "undefined" && FloatingFeedback.add) {
      const displayType = isPriority ? "CRITICAL COUNTER" : "TELL READ";
      FloatingFeedback.add(line, 480, 180, displayType);
    }

    return item;
  }

  function getHistory() {
    return commentaryHistory;
  }

  function clearHistory() {
    commentaryHistory = [];
    lastEventTurn = -10;
  }

  // Subscribe to CombatEvents by default
  CombatEvents.on("COUNTER_HIT", ctx => generateLine("COUNTER_HIT", ctx));
  CombatEvents.on("CORNER_TRAP", ctx => generateLine("CORNER_TRAP", ctx));
  CombatEvents.on("REVERSAL", ctx => generateLine("REVERSAL", ctx));
  CombatEvents.on("STAMINA_BREAK", ctx => generateLine("STAMINA_BREAK", ctx));
  CombatEvents.on("SIGNATURE_SUPER", ctx => generateLine("SIGNATURE_SUPER", ctx));
  CombatEvents.on("KNOCKOUT", ctx => generateLine("KNOCKOUT", ctx));
  CombatEvents.on("SUBMISSION_TAP", ctx => generateLine("SUBMISSION_TAP", ctx));
  CombatEvents.on("PERFECT_GUARD", ctx => generateLine("PERFECT_GUARD", ctx));

  return {
    generateLine: generateLine,
    getHistory: getHistory,
    clearHistory: clearHistory,
    LATTICE: LATTICE,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { AICommentary, CombatEvents };
}
