/* =====================================================================
   Aqua Zero Heavens Arena - combination sequencing
   Luminara Digital

   A fighter does not throw one technique and wait. They throw a
   combination: two or three techniques committed as one action, resolving
   in order inside a single turn. Chain things that genuinely follow each
   other - jab into cross, level change into double leg, sweep into mount
   into armbar - and each link lands harder than the last, because that is
   what a drilled combination buys you.

   The price is commitment. Once the combination is thrown you are inside
   it: the opponent gets a window at every link after the first, and a
   combination broken halfway costs you the air you had already committed
   and leaves you off balance for their answer.

   So the decision is a real one. Against a fresh opponent the third link
   is a coin flip that gasses you. Against someone rocked, off balance,
   pinned or nearly out, they cannot answer at all and the long chain is
   simply free damage. Read the opponent, then commit.

   Pure logic - nothing here renders, reads input or touches the DOM. The
   caller supplies the execution function and applies the events.
   ===================================================================== */
const SEQ_CONFIG = {
  maxLen: 3,                 // no combination longer than three beats

  /* reward - damage multiplier on each link after the opener */
  linkBonus: 0.17,           // per link past the first
  linkAccel: 0.25,           // the curve steepens; the finish is the payoff
  setupBonus: 0.08,          // following a real SETUP earns the opening
  maxBonus: 1.55,            // ceiling, so nothing runs away

  /* risk - chance the defender breaks the chain at a given link */
  interruptBase: 0.10,
  interruptPerLink: 0.10,    // deeper into the chain, easier to time
  interruptPerExtraLen: 0.06,// a three-beat commitment telegraphs itself
  heavyInterrupt: 0.05,      // a heavy link is slow and readable
  fastInterrupt: -0.04,      // a snappy follow-up is not
  interruptFloor: 0.02,
  interruptCeil: 0.75,
  whiffDecay: 0.40,          // a missed link kills most of the momentum

  /* stamina */
  chainDiscount: 0.18,       // a drilled combination is efficient
  roughPenalty: 0.25,        // forcing a link that does not follow is not
  brokenStamPenalty: 0.75,   // committed air on the links you never threw
  overdraw: 0.25,            // how far past empty a fighter may commit
  brokenStatus: "OFF_BALANCE",

  /* menu bounds - validSequences must never hand the UI a wall of chains */
  openFit: 0.70,             // an opener has to be usable at this range
  openCap: 8,
  branchCap: 4,
  menuCap: 24,

  heavyPower: 40,            // at or above this it is a finisher, not a link
};

/* ------------------------------------------------------------------ */
/* small readers - every entry point takes ids or technique objects    */
function seqTechs(seq) {
  const out = [];
  (seq || []).forEach((t) => {
    const x = (typeof t === "string") ? TECH[t] : t;
    if (x) out.push(x);
  });
  return out;
}
function seqTech(t) { return (typeof t === "string") ? TECH[t] : t; }
function hasFlag(t, f) { return !!t && !!t.flags && t.flags.indexOf(f) >= 0; }

/* a finisher is a fight-ender, not a beat in a combination */
function isHeavyLink(t) {
  if (!t) return false;
  if (hasFlag(t, "finisher")) return true;
  if ((t.power || 0) >= SEQ_CONFIG.heavyPower) return true;
  return hasFlag(t, "power") && (t.power || 0) >= 34;
}
/* the only things you throw twice in a row are the cheap sharp ones */
function isRepeatable(t) {
  return !!t && t.cls === "STRIKE" && (t.power || 0) <= 22 &&
         (hasFlag(t, "fast") || hasFlag(t, "poke") || hasFlag(t, "multi"));
}
/* Where the fight stands once this technique is done. The range travels one
   step at a time unless the technique earned more, so a follow-up has to be
   reachable from where the previous link actually leaves you - not from
   where it was aiming. Mirrors applyRangeShift in resolve.js; if that rule
   changes, change it here too or the menu will offer chains the engine
   cannot physically throw. */
function linkEndRange(t, cur) {
  if (!t) return cur || null;
  /* with no current range, assume the technique is thrown from its own */
  const here = cur || ((t.range && t.range !== "ANY") ? t.range : null);
  let target = t.moves || null;
  if (t.shift && here) {
    const i = RANGE_INDEX[here] + t.shift;
    target = RANGE_ORDER[Math.max(0, Math.min(RANGE_ORDER.length - 1, i))];
  }
  if (!target) return here;
  if (!here) return target;
  const from = RANGE_INDEX[here], to = RANGE_INDEX[target];
  if (to === from) return here;
  const f = t.flags || [];
  let dest;
  if (to > from) {
    const leap = f.indexOf("takedown") >= 0 || f.indexOf("charge") >= 0;
    dest = leap ? to : Math.min(to, from + 1);
  } else {
    const leap = f.indexOf("push") >= 0 || f.indexOf("reset") >= 0;
    dest = leap ? to : Math.max(to, from - 1);
  }
  return RANGE_ORDER[dest];
}
/* how far the next technique is from where you just left the fight.
   an unknown end range is permissive - the range check is not the point */
function rangeGap(from, to) {
  if (!from || !to || to === "ANY" || from === "ANY") return 0;
  return Math.abs(RANGE_INDEX[from] - RANGE_INDEX[to]);
}

/* ------------------------------------------------------------------ */
/* canChain - does b legitimately follow a?
   Real combination logic, not a lookup table:
     a guard is a whole turn, not a beat - nothing chains off it or into it
     a SETUP flows into anything it can reach - that is what a setup is for
     a strike flows into another strike at its own or the neighbouring range
     a takedown that puts them down flows into ground work
     you enter a submission from the position, never from a distance
     two finishers do not chain, and neither do two spins                 */
function canChain(a, b) {
  a = seqTech(a); b = seqTech(b);
  if (!a || !b) return false;
  if (a.cls === "GUARD" || b.cls === "GUARD") return false;
  if (a.id === b.id && !isRepeatable(a)) return false;
  if (isHeavyLink(a) && isHeavyLink(b)) return false;
  if ((hasFlag(a, "spin") || hasFlag(a, "jump")) &&
      (hasFlag(b, "spin") || hasFlag(b, "jump"))) return false;

  const from = linkEndRange(a, null);
  const gap = rangeGap(from, b.range);

  switch (b.cls) {
    case "SUB":
      /* you finish from a position you already hold - no jab into armbar,
         and no rattling off three separate locks in one turn either */
      return gap === 0 && a.cls !== "SUB";
    case "THROW":
      /* strike them into it, set it up, or chain it off another position */
      return gap <= 1 && a.cls !== "SUB";
    case "STRIKE":
      /* bailing out of a submission to strike means letting go first */
      return a.cls === "SUB" ? gap === 0 : gap <= 1;
    case "SETUP":
      return gap <= 1;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* chainBonus - the rising payoff. The opener is worth exactly itself;
   everything after it rides the momentum of what came before, and a link
   that does not honestly follow earns nothing at all. */
function chainBonus(seq, linkIndex) {
  const s = seqTechs(seq);
  const i = linkIndex | 0;
  if (i <= 0 || i >= s.length) return 1;
  const C = SEQ_CONFIG;
  const prev = s[i - 1];
  if (!canChain(prev, s[i])) return 1;
  let m = 1 + C.linkBonus * i * (1 + C.linkAccel * (i - 1));
  if (prev.cls === "SETUP") m += C.setupBonus;
  return Math.round(Math.min(C.maxBonus, m) * 1000) / 1000;
}

/* ------------------------------------------------------------------ */
/* sequenceCost - what the whole combination costs to throw. A chain that
   actually follows is cheaper per link than the same techniques thrown
   cold; a chain forced together costs more than the sum of its parts. */
function sequenceCost(side, seq) {
  const s = seqTechs(seq);
  const C = SEQ_CONFIG;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const base = staminaCost(side, s[i]);
    if (i === 0) total += base;
    else if (canChain(s[i - 1], s[i])) total += base * (1 - C.chainDiscount);
    else total += base * (1 + C.roughPenalty);
  }
  return Math.max(0, Math.round(total));
}

/* ------------------------------------------------------------------ */
/* interruptChance - the defender's window at this link, 0..1.
   Rises with depth and with the length you committed to. Falls hard when
   they are in no state to answer: rocked, posture broken, held, pinned,
   empty, or badly hurt. This is the whole risk half of the decision. */
function interruptChance(defender, seq, linkIndex) {
  const s = seqTechs(seq);
  const i = linkIndex | 0;
  if (i <= 0 || i >= s.length) return 0;         // the opener is already thrown
  const C = SEQ_CONFIG;
  const tech = s[i];

  let p = C.interruptBase + C.interruptPerLink * i +
          C.interruptPerExtraLen * Math.max(0, s.length - 2);
  if (isHeavyLink(tech)) p += C.heavyInterrupt;
  if ((tech.prio || 0) >= 1) p += C.fastInterrupt;

  let f = 1;
  if (defender && defender.cond) {
    if (hasStatus(defender, "STUNNED")) f *= 0.25;      // rocked - no answer
    if (hasStatus(defender, "OFF_BALANCE")) f *= 0.45;  // posture gone
    if (hasStatus(defender, "PINNED")) f *= 0.30;
    if (hasStatus(defender, "HELD")) f *= 0.55;
    if (hasStatus(defender, "WINDED")) f *= 0.75;
    if (hasStatus(defender, "LEG_HURT")) f *= 0.85;
    if (hasStatus(defender, "ARM_HURT")) f *= 0.88;
  }
  if (defender && defender.maxhp) {
    const frac = Math.max(0, Math.min(1, defender.hp / defender.maxhp));
    f *= 0.60 + 0.40 * frac;                            // a hurt fighter stops answering
  }
  if (defender && defender.maxStam) {
    if (defender.stam <= 0) f *= 0.55;
    else if (defender.stam < defender.maxStam * 0.25) f *= 0.78;
  }
  p *= f;
  return Math.max(C.interruptFloor, Math.min(C.interruptCeil, p));
}

/* odds the whole combination gets through untouched - for the UI readout
   and for a brain deciding whether to commit */
function sequenceOdds(defender, seq) {
  const s = seqTechs(seq);
  let q = 1;
  for (let i = 1; i < s.length; i++) q *= (1 - interruptChance(defender, s, i));
  return Math.round(q * 1000) / 1000;
}

/* the air you burn on links you never got to throw */
function sequenceBreakCost(side, seq, at) {
  const s = seqTechs(seq);
  let n = 0;
  for (let i = at; i < s.length; i++) n += staminaCost(side, s[i]);
  return Math.max(0, Math.round(n * SEQ_CONFIG.brokenStamPenalty));
}

/* ------------------------------------------------------------------ */
/* validSequences - the combinations this fighter could actually throw
   from where the fight is standing. Bounded on purpose: openers that fit
   the range, a handful of honest follow-ups each, best ones first.
   Returns arrays of technique objects, length 2..maxLen. Ask for maxLen 1
   and you get the plain single-technique menu back, one technique per
   array, so the caller can treat everything the same way. */
function validSequences(side, techs, curRange, maxLen) {
  const C = SEQ_CONFIG;
  const cur = curRange || "MID";
  const pool = seqTechs(techs && techs.length ? techs : (side && side.techs) || []);
  const lim = Math.max(1, Math.min(C.maxLen, maxLen || C.maxLen));
  const budget = side && side.maxStam
    ? side.stam + Math.round(side.maxStam * C.overdraw) : 1e9;

  const score = (t, at) => {
    const fit = rangeFit(t.range, at);
    const eff = t.eff ? (t.eff.ch / 100) * 8 : 0;
    return (t.power || 0) * fit * ((t.acc || 90) / 100) + eff;
  };

  if (lim < 2) {
    return pool.filter((t) => staminaCost(side, t) <= budget).map((t) => [t]);
  }

  /* openers: usable where the fight actually is, best first */
  const openers = pool
    .filter((t) => t.cls !== "GUARD" && rangeFit(t.range, cur) >= C.openFit)
    .sort((x, y) => score(y, cur) - score(x, cur))
    .slice(0, C.openCap);

  const out = [];
  const seen = {};
  let front = openers.map((t) => ({ seq: [t], at: linkEndRange(t, cur) }));

  for (let depth = 2; depth <= lim; depth++) {
    const next = [];
    front.forEach((node) => {
      const last = node.seq[node.seq.length - 1];
      const follows = pool
        .filter((t) => canChain(last, t) && node.seq.indexOf(t) < 0)
        .sort((x, y) => score(y, node.at) - score(x, node.at))
        .slice(0, C.branchCap);
      follows.forEach((t) => {
        const seq = node.seq.concat([t]);
        if (sequenceCost(side, seq) > budget) return;
        const key = seq.map((q) => q.id).join(">");
        if (seen[key]) return;
        seen[key] = 1;
        out.push(seq);
        next.push({ seq, at: linkEndRange(t, node.at) });
      });
    });
    front = next;
    if (!front.length) break;
  }

  /* rank by what the chain is worth if it lands, less the air it costs and
     a flat prior for the risk of the deeper links */
  const worth = (seq) => {
    let at = cur, n = 0;
    for (let i = 0; i < seq.length; i++) {
      const risk = 1 - (C.interruptBase + C.interruptPerLink * i);
      n += score(seq[i], at) * chainBonus(seq, i) * (i ? risk : 1);
      at = linkEndRange(seq[i], at);
    }
    return n - sequenceCost(side, seq) * 0.35;
  };
  return out.sort((a, b) => worth(b) - worth(a)).slice(0, C.menuCap);
}

/* ------------------------------------------------------------------ */
/* resolveSequence - run the committed combination.

   execFn(tech, prevTech, linkIndex) is the caller's wrapper around
   executeTechnique and returns the usual event. This function decides
   what gets thrown, scales the damage by the chain bonus, and stops the
   moment the opponent breaks in or the fighter runs out of air.

   A whiff does not end the combination - you throw it through - but it
   costs most of the momentum, so the next link keeps only a fraction of
   its bonus. A break costs the air already committed to the links never
   thrown and leaves the fighter exposed. */
function resolveSequence(d, side, foe, seq, rnd, execFn) {
  const R = rnd || Math.random;
  const C = SEQ_CONFIG;
  const s = seqTechs(seq);
  const out = { links: [], broken: false, brokenAt: -1, totalDmg: 0,
                gassed: false, expose: null, stamLost: 0, stamSaved: 0, len: s.length };
  let lastWhiff = false;

  for (let i = 0; i < s.length; i++) {
    if (i > 0) {
      /* nothing left in the tank - the combination dies on its own */
      if (side.stam <= 0 && staminaCost(side, s[i]) > 0) {
        out.broken = true; out.brokenAt = i; out.gassed = true; break;
      }
      if (R() < interruptChance(foe, s, i)) {
        out.broken = true; out.brokenAt = i; break;
      }
    }

    const ev = execFn(s[i], i ? s[i - 1] : null, i);
    if (!ev) { out.broken = true; out.brokenAt = i; break; }

    let mult = chainBonus(s, i);
    if (lastWhiff && mult > 1) mult = 1 + (mult - 1) * C.whiffDecay;
    mult = Math.round(mult * 1000) / 1000;
    if (mult !== 1 && ev.dmg) {
      const base = ev.dmg;
      ev.dmg = Math.max(1, Math.round(base * mult));
      ev.chainBase = base;
    }
    /* execFn charges each technique at full price, because it does not know
       it is inside a combination. Hand back the efficiency of a drilled
       chain here, so what a fighter actually spends matches what
       sequenceCost quoted them. (This can leave WINDED on a fighter who is
       no longer empty; endTurnUpkeep clears that at the end of the turn.) */
    if (i > 0 && canChain(s[i - 1], s[i])) {
      const back = Math.round(staminaCost(side, s[i]) * C.chainDiscount);
      if (back > 0) {
        side.stam = Math.min(side.maxStam || (side.stam + back), side.stam + back);
        out.stamSaved += back;
      }
    }

    ev.link = i;
    ev.chain = mult;
    out.links.push(ev);
    out.totalDmg += ev.dmg || 0;
    lastWhiff = !ev.hit;
  }

  if (out.broken) {
    out.stamLost = sequenceBreakCost(side, s, out.brokenAt);
    const rem = side.stam - out.stamLost;
    if (rem < 0) {
      side.stam = 0;
      if (typeof addStatus === "function") {
        addStatus(side, "STAMINA_BREAK");
        addStatus(side, "WINDED");
      }
    } else {
      side.stam = rem;
      if (side.stam === 0 && typeof addStatus === "function") addStatus(side, "WINDED");
    }
    out.expose = C.brokenStatus;
    /* caught mid-combination - posture gone for their answer */
    if (typeof addStatus === "function") addStatus(side, C.brokenStatus);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* describeSequence - "JAB > CROSS > LEAD HOOK" */
function describeSequence(seq) {
  const s = seqTechs(seq);
  if (!s.length) return "";
  return s.map((t) => String(t.name || t.id).toUpperCase()).join(" > ");
}
