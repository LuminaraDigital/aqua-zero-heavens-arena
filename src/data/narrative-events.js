/* =====================================================================
   Aqua Zero Heavens Arena - Narrative Events & Dynamic Combat Banter
   Luminara Digital

   Adds interactive roguelike encounter nodes to Adventure Mode and
   situational in-ring dialogue for grudges, styles, and critical counters.
   ===================================================================== */

const NARRATIVE_EVENTS = {
  EVENT_CUTMAN: {
    id: "EVENT_CUTMAN",
    title: "The Back-Alley Cutman",
    desc: "A veteran cutman with scarred knuckles flags you down behind the locker rooms. 'You look like you've been in a war, kid. I can fix you up... for a price.'",
    choices: [
      {
        id: "clean_stitch",
        title: "Clean Stitches (30 Purse)",
        desc: "Heal 25% max HP and gain 50% cut resistance for the next fight.",
        cost: 30,
        effect: function (run) {
          if (!run) return;
          const heal = Math.round((run.maxhp || 100) * 0.25);
          run.hp = Math.min(run.maxhp || 100, (run.hp || 0) + heal);
          run.purse = Math.max(0, (run.purse || 0) - 30);
          return { ok: true, msg: "Stitched up tight. Restored " + heal + " HP." };
        },
      },
      {
        id: "black_market_salts",
        title: "Experimental Smelling Salts (Free)",
        desc: "+20% strike damage for 2 bouts, but start next fight slightly winded.",
        cost: 0,
        effect: function (run) {
          if (!run) return;
          run.experimentalBuff = 2; // 2 bouts
          return { ok: true, msg: "Your eyes burn with raw adrenaline. +20% damage primed." };
        },
      },
      {
        id: "walk_away",
        title: "Decline and Walk Away",
        desc: "Save your coin and focus on the upcoming bout.",
        cost: 0,
        effect: function () {
          return { ok: true, msg: "You keep moving toward the arena tunnel." };
        },
      },
    ],
  },

  EVENT_BOOKIE: {
    id: "EVENT_BOOKIE",
    title: "The Syndicate Bookmaker",
    desc: "A shadowy figure in a tailored suit leans against the ring barrier with a briefcase of arena credits. 'The syndicate is looking for a showman. Make it entertaining, and we'll multiply your stake.'",
    choices: [
      {
        id: "blitz_wager",
        title: "Under-6 Turns Knockout Wager (50 Purse)",
        desc: "Lock 50 purse. Win by KO in <= 6 turns for a 3.0x payout (150 Purse).",
        cost: 50,
        effect: function (run) {
          if (!run || (run.purse || 0) < 50) return { ok: false, error: "Not enough purse" };
          run.purse -= 50;
          run.activeWager = { type: "FAST_KO", turns: 6, stake: 50, payoutMul: 3.0 };
          return { ok: true, msg: "Wager booked: 50 purse locked on a 6-turn blitz." };
        },
      },
      {
        id: "flawless_defense",
        title: "Iron Wall Wager (40 Purse)",
        desc: "Lock 40 purse. Win while taking under 40 total damage for a 2.5x payout (100 Purse).",
        cost: 40,
        effect: function (run) {
          if (!run || (run.purse || 0) < 40) return { ok: false, error: "Not enough purse" };
          run.purse -= 40;
          run.activeWager = { type: "LOW_DAMAGE", maxDmg: 40, stake: 40, payoutMul: 2.5 };
          return { ok: true, msg: "Wager booked: 40 purse locked on flawless defense." };
        },
      },
      {
        id: "refuse_wager",
        title: "Refuse the Syndicate",
        desc: "Fight on your own honest terms.",
        cost: 0,
        effect: function () {
          return { ok: true, msg: "You ignore the bookmaker's offers." };
        },
      },
    ],
  },

  EVENT_SENSEI: {
    id: "EVENT_SENSEI",
    title: "The Wandering Grandmaster",
    desc: "An elderly practitioner in an unbleached gi sits meditating on the canvas. He opens one eye as you approach. 'Your form is eager, but your fundamentals are loud. Shall we spar?'",
    choices: [
      {
        id: "hard_sparring",
        title: "Full-Contact Sparring (-15 HP)",
        desc: "Take 15 sparring damage to instantly bank +40 Discipline Mastery XP.",
        cost: 0,
        effect: function (run) {
          if (!run) return;
          run.hp = Math.max(1, (run.hp || 100) - 15);
          run.sparringXp = (run.sparringXp || 0) + 40;
          return { ok: true, msg: "Bruised ribs, but your timing is honed. +40 Mastery XP." };
        },
      },
      {
        id: "secret_manual",
        title: "Study the Footwork Scrolls (50 Purse)",
        desc: "Learn the rare 'Phantom Pivot' counter movement technique.",
        cost: 50,
        effect: function (run) {
          if (!run || (run.purse || 0) < 50) return { ok: false, error: "Not enough purse" };
          run.purse -= 50;
          run.drafted = run.drafted || [];
          if (run.drafted.indexOf("check_hook") < 0) {
            run.drafted.push("check_hook");
          }
          return { ok: true, msg: "Mastered the Pivot Check Hook technique." };
        },
      },
      {
        id: "bow_depart",
        title: "Bow and Depart",
        desc: "Show respect and continue your ascent.",
        cost: 0,
        effect: function () {
          return { ok: true, msg: "The Grandmaster nods in silent approval." };
        },
      },
    ],
  },
};

const BANTER_DATABASE = {
  INTRO: [
    "Let's see if your chin is as strong as your record.",
    "No judges needed tonight. One of us is leaving on the canvas.",
    "Don't blink. You might miss the opening bell.",
    "I've studied your tape. You have a habit of leaving your left open.",
  ],
  GRUDGE: [
    "You got lucky last time. Tonight, the score gets settled.",
    "I've been waiting for this rematch since the moment I woke up on the mat.",
    "You think you own this division? Step into my range and prove it.",
  ],
  COUNTER: [
    "Telegraphed from a mile away!",
    "Too slow on the reset!",
    "Walked right into that one!",
    "Clean interception!",
  ],
  DESPERATION: [
    "I'm not going down that easily!",
    "Heart over technique... let's finish this!",
    "You'll have to put me to sleep to stop me!",
  ],
  KNOCKOUT: [
    "And stay down.",
    "Clinic concluded.",
    "That is the power of precision.",
  ],
};

function getRandomNarrativeEvent(seed) {
  const keys = Object.keys(NARRATIVE_EVENTS);
  const s = typeof seed === "number" ? Math.abs(seed) : Math.floor(Math.random() * keys.length);
  const selectedKey = keys[s % keys.length];
  return NARRATIVE_EVENTS[selectedKey];
}

function generateDynamicBanter(speaker, situation, isGrudge) {
  let pool = BANTER_DATABASE.INTRO;
  if (isGrudge && situation === "INTRO") {
    pool = BANTER_DATABASE.GRUDGE;
  } else if (situation === "COUNTER") {
    pool = BANTER_DATABASE.COUNTER;
  } else if (situation === "DESPERATION") {
    pool = BANTER_DATABASE.DESPERATION;
  } else if (situation === "KNOCKOUT") {
    pool = BANTER_DATABASE.KNOCKOUT;
  }

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || pool[0];
}

const NarrativeEvents = {
  NARRATIVE_EVENTS: NARRATIVE_EVENTS,
  BANTER_DATABASE: BANTER_DATABASE,
  getRandomNarrativeEvent: getRandomNarrativeEvent,
  generateDynamicBanter: generateDynamicBanter,
};

if (typeof window !== "undefined") {
  window.NarrativeEvents = NarrativeEvents;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = NarrativeEvents;
}
