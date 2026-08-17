/* =====================================================================
   Aqua Zero Heavens Arena - in-run technique drafting
   Luminara Digital

   Camp benefits change how you fight. This changes WHAT you fight with.
   Win a fight, take one of three techniques from anywhere in the dex, and
   it is yours for the rest of the run. A run stops being the movelist you
   were dealt and becomes the movelist you built.

   The whole design fights two failure modes, and everything below is one
   or the other:

     USELESS  - an armbar handed to a boxer who has no way to the floor is
                not a choice, it is a wasted slot. Offers are filtered by
                where the run can actually FIGHT, not by what exists.
     RUN-WINNING - a learn-8 finisher at stage 1 ends the climb. Offers are
                capped by draftPowerBudget(stage), so the ceiling rises
                with the run instead of arriving with it.

   A third failure mode only shows up once you look at the dex: a card can
   be perfectly usable and still be nothing. 34 of the 51 guards carry no
   flag at all, which makes them the same 0.55 soak as the basic_guard
   already in every movelist. draftAdds() cuts those, and the inert setups
   with them - see the note there.

   What is left in the middle is the good part. Cross-discipline picks
   compound: each one taken from an outside art makes the next pick from
   that same art likelier, so a run drifts into a coherent second style
   rather than collecting three unrelated cards from three unrelated arts.
   And a technique that opens a range the run cannot currently reach is
   weighted up, because it is the key rather than the treasure. On the
   current roster that door bonus is quiet - 24 of 25 fighters already have
   an art covering the ground - but it is what lets a pure striker buy a way
   to the floor, and what keeps the range model honest if the roster ever
   gets more specialists.

   Pure logic. No rendering, no input, no save access - the caller owns the
   screen and decides when a win is worth a draft.
   ===================================================================== */

const DRAFT_CONFIG = {
  /* how many cards on the table, and how many a run may ever take.
     A stage carries five to seven fights, so an uncapped drafter would
     bury the command menu by stage three. Twelve roughly doubles a lean
     specialist's useful options and leaves the menus readable. */
  choices: 3,
  maxPerRun: 12,
  rerollCost: 8,          // card points; under one level's worth (10) on purpose -
                          // a reroll should cost tempo, never a level

  /* --- the power curve --- */
  powerBase: 28,          // stage 1 ceiling: solid, never your new best card
  powerStep: 3.5,         // per stage
  powerCapStage: 9,       // stage 9 lands on 56, the highest power authored
  learnReach: 2,          // an offer may sit this far above the run's level, no further
  eliteStage: 5,          // learn 7+ is not on the table before the back half

  /* --- rarity weights, lerped from stage 1 (early) to stage 9 (late) --- */
  tier: {
    core:     { early: 1.45, late: 0.40 },   // learn 1-3, the fundamentals
    seasoned: { early: 0.60, late: 1.15 },   // learn 4-6
    elite:    { early: 0.00, late: 1.00 },   // learn 7+, also gated by eliteStage
  },

  /* --- identity weights ---
     ownMul looks low for something described as "weight toward your own
     arts", and the reason is worth writing down: a fighter already KNOWS
     most of their own discipline, and everything known is filtered out
     before weighting, so their own art is only about 5% of what is left to
     draft. Pushing ownMul from 2.6 to 9 moves the share of home picks from
     36% to 42% and buys nothing but repetition inside that thin slice.
     The guaranteed home slot in draftChoices() is what actually promises a
     usable pick every time - this multiplier only shades the free roll.
     That asymmetry is correct: your own art arrives by levelling, and the
     draft is how you get everything else. */
  ownMul: 2.6,
  crossMul: 1.0,
  investedStep: 0.9,      // each pick already taken from an outside art makes
  investedCap: 3.4,       // the next one likelier - a second style, not confetti
  reachMul: 1.0,          // usable where the run already fights
  nearMul: 0.45,          // one step out; you can walk there, it just costs turns
  doorMul: 2.2,           // opens a range you cannot currently reach
  gapMul: 1.35,           // fills a hole in the movelist rather than duplicating it

  /* Guards are separated by flag, not by name. guardFactor() reads exactly
     three cases - evade 0.25, parry 0.45, everything else 0.55 - so the 34
     unflagged blocks in the dex are mechanically the same card, and all of
     them are strictly worse than the basic_guard every fighter already owns
     (ANY range, clears WINDED, prio 2). Only a guard that brings one of
     these edges is a real choice. */
  guardEdge: ["evade", "parry", "counter", "anti-takedown", "recover", "escape"],
};

const DRAFT_TIER_OF = (t) => (t.learn >= 7 ? "elite" : t.learn >= 4 ? "seasoned" : "core");

/* ---------------- the power ceiling ----------------
   28 at stage 1 up to 56 at stage 9. At stage 1 that is roughly the middle
   of a level-1 movelist: worth taking, never a fight-ender. By stage 5 the
   ceiling matches a good fighter's best strike, and only at stage 9 is the
   whole dex on the table. Guards and setups carry power 0-10 and therefore
   sail under the budget at every stage - utility is always draftable, raw
   damage has to be earned. */
function draftPowerBudget(stage) {
  const s = Math.max(1, Math.min(DRAFT_CONFIG.powerCapStage, stage || 1));
  return Math.round(DRAFT_CONFIG.powerBase + DRAFT_CONFIG.powerStep * (s - 1));
}

function draftTierWeight(key, stage) {
  const t = DRAFT_CONFIG.tier[key];
  if (!t) return 0;
  if (key === "elite" && (stage || 1) < DRAFT_CONFIG.eliteStage) return 0;
  const f = Math.max(0, Math.min(1, ((stage || 1) - 1) / 8));
  return t.early + (t.late - t.early) * f;
}

/* ---------------- what the run currently holds ---------------- */
function draftedTechs(run) {
  return (run && run.drafted) ? run.drafted.slice() : [];
}
/* every technique the run can throw right now: trained plus drafted.
   The "student" benefit teaches one level above your own, so it widens
   what the drafter is allowed to offer too. */
function draftLevel(run) {
  let lv = (run && run.level) || 1;
  if (typeof benefitFlag === "function") lv += benefitFlag(run && run.benefits, "levelBonus") || 0;
  return Math.max(1, Math.min(9, lv));
}
function draftMovelist(run) {
  const known = knownTechs(run.hero, draftLevel(run)) || [];
  const out = known.slice();
  draftedTechs(run).forEach((id) => { if (out.indexOf(id) < 0) out.push(id); });
  return out;
}

/* ---------------- where the run can actually fight ----------------
   Home ranges come from the fighter's own arts. On top of that, any
   technique in the movelist with an absolute `moves` destination is a door
   into that range - and a door you can only use if you can reach the room
   it starts in, so this runs to a fixpoint. Draft a takedown and GROUND
   becomes home; the ground game opens on the NEXT draft.

   `shift` footwork (Close Distance, Create Space) is deliberately not
   counted here. Everyone owns it, so counting it would make every range
   reachable for everybody and collapse the whole model. Instead it is why
   one-step-out offers score nearMul rather than zero: you can walk there,
   it just costs you turns you would rather spend hitting someone. */
function draftRanges(run) {
  const set = {};
  (disciplinesOf(run.hero) || []).forEach((id) => {
    const d = DISCIPLINES[id];
    if (d) d.ranges.forEach((r) => (set[r] = 1));
  });
  if (!Object.keys(set).length) set.MID = 1;
  const list = draftMovelist(run);
  for (let pass = 0; pass < 4; pass++) {
    let grew = false;
    list.forEach((id) => {
      const t = TECH[id];
      if (!t || !t.moves || set[t.moves]) return;
      if (t.range === "ANY" || set[t.range]) { set[t.moves] = 1; grew = true; }
    });
    if (!grew) break;
  }
  return set;
}

/* 1.00 where the run already lives, nearMul one step out, 0 beyond that -
   a technique two ranges from anywhere you can stand is not a choice. */
function draftReach(reachable, tech) {
  let best = 0;
  for (const r in reachable) best = Math.max(best, rangeFit(tech.range, r));
  return best >= 1 ? DRAFT_CONFIG.reachMul : best >= 0.7 ? DRAFT_CONFIG.nearMul : 0;
}

/* An offer has to let the run do something it cannot already do. Two kinds
   of card fail that test no matter how the weights fall, so they are cut
   before weighting rather than merely made unlikely:

     a plain GUARD  - identical to the basic_guard already in every movelist
     an inert SETUP - no status, no destination, no footwork, ~4 power; it
                      is a turn spent to accomplish nothing

   Without this the offer screen fills up with foreign-language names for
   the block you already own, which reads as variety and plays as a dead
   pick. */
function draftAdds(tech, have) {
  if (tech.cls === "GUARD") {
    const edge = tech.flags.filter((f) => DRAFT_CONFIG.guardEdge.indexOf(f) >= 0);
    if (!edge.length) return false;
    // and it is only an upgrade if the run does not already cover that edge
    return edge.some((f) => !have.some((id) => {
      const o = TECH[id];
      return o && o.cls === "GUARD" && o.flags.indexOf(f) >= 0;
    }));
  }
  if (tech.cls === "SETUP" && !tech.eff && !tech.moves && !tech.shift) return false;
  return true;
}

/* ---------------- the pool ---------------- */
function draftPool(run) {
  const stage = (run && run.stage) || 1;
  const budget = draftPowerBudget(stage);
  const lvCap = draftLevel(run) + DRAFT_CONFIG.learnReach;
  const have = draftMovelist(run);
  const reachable = draftRanges(run);
  const discs = disciplinesOf(run.hero) || [];

  /* what the run already covers, so a draft can prefer to fill a hole */
  const covered = {};
  have.forEach((id) => { const t = TECH[id]; if (t) covered[t.cls + "@" + t.range] = 1; });

  /* how far the run has already committed to each outside art */
  const invested = {};
  draftedTechs(run).forEach((id) => {
    const t = TECH[id];
    if (t && t.disc && discs.indexOf(t.disc) < 0) invested[t.disc] = (invested[t.disc] || 0) + 1;
  });

  const out = [];
  TECH_IDS.forEach((id) => {
    const t = TECH[id];
    if (!t || t.sig) return;
    if (have.indexOf(id) >= 0) return;                    // already known or already drafted
    if (t.learn > lvCap) return;                          // years above the run's level
    if (t.power > budget) return;                         // above this stage's ceiling
    if (!draftAdds(t, have)) return;                      // does nothing the run cannot do
    const tier = DRAFT_TIER_OF(t);
    let w = draftTierWeight(tier, stage);
    if (w <= 0) return;

    const reach = draftReach(reachable, t);
    if (reach <= 0) return;                               // unusable from anywhere it can stand
    w *= reach;

    const cross = !!t.disc && discs.indexOf(t.disc) < 0;
    if (cross) {
      const n = invested[t.disc] || 0;
      w *= Math.min(DRAFT_CONFIG.investedCap,
                    DRAFT_CONFIG.crossMul * (1 + DRAFT_CONFIG.investedStep * n));
    } else {
      w *= DRAFT_CONFIG.ownMul;
    }

    // the key is worth more than the treasure: this opens somewhere new
    if (t.moves && !reachable[t.moves]) w *= DRAFT_CONFIG.doorMul;
    if (!covered[t.cls + "@" + t.range]) w *= DRAFT_CONFIG.gapMul;

    out.push({ id, w, cross });
  });
  return out;
}

/* ---------------- the offer ---------------- */
function draftRoll(pool, rnd) {
  let total = 0;
  pool.forEach((p) => (total += p.w));
  if (total <= 0) return null;
  let r = rnd() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.id; }
  return pool[pool.length - 1].id;
}

/* Three offers, and the slots are not all the same question.
   One is drawn from the fighter's own arts so there is always a pick that
   works the moment you take it. One is drawn from an art they do not own,
   so the door to a different identity is on the table at EVERY draft and
   never has to be waited for. The third is a free roll over everything.
   Then the three are shuffled, so position tells the player nothing. */
function draftChoices(run, rnd) {
  const R = rnd || Math.random;
  let pool = draftPool(run || {});
  const want = DRAFT_CONFIG.choices;
  const out = [];
  const take = (id) => { if (id) { out.push(id); pool = pool.filter((p) => p.id !== id); } };

  take(draftRoll(pool.filter((p) => !p.cross), R));       // one you can use today
  take(draftRoll(pool.filter((p) => p.cross), R));        // one that changes who you are
  while (out.length < want) {                             // and the rest wide open
    const id = draftRoll(pool, R);
    if (!id) break;
    take(id);
  }
  for (let i = out.length - 1; i > 0; i--) {              // no slot means anything
    const j = (R() * (i + 1)) | 0;
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

/* ---------------- taking one ---------------- */
function canDraft(run) {
  if (!run) return false;
  return draftedTechs(run).length < DRAFT_CONFIG.maxPerRun;
}

/* Adds the technique to this run's movelist. Returns what was taken so the
   caller can announce it, or null if the id was junk, already held, or the
   run is full. The cap is enforced HERE and not only in canDraft: canDraft
   is the question the pick screen asks, but if it is ever miswired the cap
   still has to hold, and a double-tap must not spend a slot twice. */
function applyDraft(run, techId) {
  if (!run || !techId) return null;
  const tech = TECH[techId];
  if (!tech) return null;
  if (!run.drafted) run.drafted = [];
  if (!canDraft(run)) return null;
  if (run.drafted.indexOf(techId) >= 0) return null;
  if (draftMovelist(run).indexOf(techId) >= 0) return null;
  run.drafted.push(techId);
  return { id: techId, tech };
}

/* ---------------- one line for the UI ---------------- */
function draftSummary(run) {
  const stage = (run && run.stage) || 1;
  const taken = draftedTechs(run);
  const head = "STAGE " + stage + " DRAFT - UP TO " + draftPowerBudget(stage) + " POWER";
  if (!taken.length) return head + " - NOTHING TAKEN YET";
  const discs = disciplinesOf(run.hero) || [];
  const outside = [];
  taken.forEach((id) => {
    const t = TECH[id];
    if (!t || !t.disc || discs.indexOf(t.disc) >= 0) return;
    const d = DISCIPLINES[t.disc];
    const nm = (d && d.name) || t.disc;
    if (outside.indexOf(nm) < 0) outside.push(nm);
  });
  return head + " - " + taken.length + " OF " + DRAFT_CONFIG.maxPerRun + " TAKEN" +
         (outside.length ? " - CROSS-TRAINED IN " + outside.join(", ") : "");
}
