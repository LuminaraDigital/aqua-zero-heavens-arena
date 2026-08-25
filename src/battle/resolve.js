/* =====================================================================
   Aqua Zero Heavens Arena - technique resolution
   Luminara Digital

   One technique, executed. Everything that decides the outcome is read
   from data: the technique's own numbers, its discipline's bias, how well
   it fits the range the fight is actually in, the conditions on both
   fighters, and the guard the target chose.

   Returns an event describing what happened. The renderer and the battle
   log both read that event - neither knows anything about damage maths.
   ===================================================================== */
/* Fights were averaging 7.6 turns - about seven decisions, which is thin for
   a game whose whole pitch is technique choice. Pulling the scale down
   lengthens the fight without touching a single technique's numbers, so the
   relative balance of the dex is preserved while the decision count roughly
   doubles. Re-measure with tools/audit-balance.js after any change here. */
const TECH_DMG_SCALE = 0.42;

function accuracyOf(d, side, foe, tech) {
  const mods = statusMods(side);
  const disc = DISCIPLINES[tech.disc];
  let acc = tech.acc * (disc ? disc.bias.acc : 1) * mods.acc;
  acc *= rangeAccFit(tech.range, d.range);
  acc *= comfort(side.discs, d.range);
  if (hasStatus(foe, "OFF_BALANCE")) acc *= 1.18;
  if (hasStatus(foe, "PINNED") && tech.cls === "SUB") acc *= 1.25;
  if (hasStatus(foe, "HELD") && (tech.cls === "THROW" || tech.cls === "SUB")) acc *= 1.15;
  if (side.stam <= 0) acc *= 0.85;
  // punching range is the cleanest exchange in fighting - it should be worth
  // standing in rather than a corridor between kicks and the clinch
  if (d.range === "MID") acc *= 1.06;
  // a drilled technique has been thrown ten thousand times - it finds home
  if (side.drill && side.drill[tech.id]) acc += 5 * side.drill[tech.id];
  if (side && side.seals && side.seals[tech.id] === "SEAL_FLOW") acc += 12;
  if (d && d.range === "LONG" && typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "STRIKERS_HORIZON")) acc += 10;
  acc *= positionModsFor(d, side).acc;
  // the longer you are held down, the better your work back to the feet
  if ((tech.flags || []).indexOf("escape") >= 0) acc *= groundEscapeBonus(d);
  return Math.max(5, Math.min(99, acc));
}
function damageOf(d, side, foe, tech, foeTech) {
  if (!tech.power) return 0;
  const mods = statusMods(side), disc = DISCIPLINES[tech.disc];
  let n = tech.power * (disc ? disc.bias.pow : 1);
  n *= rangeFit(tech.range, d.range);
  n *= comfort(side.discs, d.range);
  n *= mods.pow * (side.atkMul || 1);
  n *= positionModsFor(d, side).pow;    // room to work, or backed onto the ropes
  if (side.drill && side.drill[tech.id]) n *= 1 + 0.15 * side.drill[tech.id];
  if (side && side.seals && side.seals[tech.id] === "SEAL_HEAVY") n *= 1.25;
  if (side && side.seals && side.seals[tech.id] === "SEAL_COUNTER" && foeTech && foeTech.cls === "STRIKE") n *= 1.45;
  if (d && d.range === "CLINCH" && typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "DIRTY_BOXING")) n *= 1.15;
  if (typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "RUTHLESS_COMBAT") && (hasStatus(foe, "BLEEDING") || hasStatus(foe, "STUNNED") || hasStatus(foe, "WINDED"))) n *= 1.25;
  n /= Math.max(0.6, foe.defMul || 1);
  if (hasStatus(foe, "STUNNED")) n *= 1.3;                         // punish the rocked fighter
  if (tech.cls === "SUB" && (hasStatus(foe, "PINNED") || hasStatus(foe, "HELD"))) n *= 1.4;
  if (side.stam <= 0) n *= 0.7;                                     // nothing left on it
  return Math.max(2, Math.round(n * TECH_DMG_SCALE));
}

/* The fight moves when a technique says so - but it travels, it does not
   teleport. An audit of 3,600 fights found MID at 3.6% and CLINCH at 2.6%
   of all turns: takedowns jumped straight from striking range to the mat
   and escapes jumped straight back, so the two middle ranges were skipped
   entirely and a third of the technique dex was unreachable.
   Now a shift covers one step unless the technique has earned more:
   a committed takedown genuinely does put you on the ground in one motion,
   and an explosive break genuinely does create space - everything else
   passes through the range in between, which is where the clinch lives. */
function applyRangeShift(d, tech, ev) {
  let target = tech.moves;
  if (tech.shift) {
    const i = RANGE_INDEX[d.range] + tech.shift;
    target = RANGE_ORDER[Math.max(0, Math.min(RANGE_ORDER.length - 1, i))];
  }
  if (!target || target === d.range) return;
  const from = RANGE_INDEX[d.range], to = RANGE_INDEX[target];
  const f = tech.flags || [];
  let dest;
  if (to > from) {
    // closing: only a real takedown or a charge covers more than one step
    // only a committed shot covers two ranges - you cannot hip-throw someone
    // from punching range without tying up with them first
    const leap = f.indexOf("takedown") >= 0 || f.indexOf("charge") >= 0;
    dest = leap ? to : Math.min(to, from + 1);
  } else {
    // breaking away: a push or an explosive escape covers more than one step
    const leap = f.indexOf("push") >= 0 || f.indexOf("reset") >= 0;
    dest = leap ? to : Math.max(to, from - 1);
  }
  if (dest === from) return;
  d.range = RANGE_ORDER[dest];
  ev.rangeTo = d.range;
}

/* How long the fight has been on the mat. A fight that stalls on the ground
   gets easier to stand up out of - fighters work back to their feet and
   referees stand them up. Without this the ground is a one-way door and the
   game becomes 63% mat work. */
function tickRangeClock(d) {
  if (d.range === "GROUND") d.groundTurns = (d.groundTurns || 0) + 1;
  else d.groundTurns = 0;
}
const groundEscapeBonus = (d) => 1 + Math.min(0.30, Math.max(0, (d.groundTurns || 0) - 1) * 0.10);

/* Guard: a GUARD technique soaks the next incoming hit and buys air back.
   46 of the 51 guards in the dex carry no evade/parry flag, which made them
   mechanically identical to - and strictly worse than - the basic_guard every
   fighter already owns, since that one is ANY-range and clears WINDED. That
   is 39 imported techniques of dead content.
   The fix uses data already on them: a guard built for one range beats a
   generic cover-up when the fight is actually there. A leg check is the right
   answer to a kick and useless on the mat, which is both true and enough to
   give every one of them a reason to exist. */
function guardFactor(target, targetTech, d) {
  if (!targetTech || targetTech.cls !== "GUARD") return 1;
  let f = 0.55;
  if (targetTech.flags.indexOf("evade") >= 0) f = 0.25;
  else if (targetTech.flags.indexOf("parry") >= 0) f = 0.45;
  if (d && targetTech.range && targetTech.range !== "ANY") {
    f *= targetTech.range === d.range ? 0.76      // the right guard, in the right place
       : rangeFit(targetTech.range, d.range) >= 0.7 ? 1 : 1.25;   // wrong tool entirely
  }
  return Math.min(0.95, f);
}

/* execute `tech` by `side` against `foe`. `foeTech` is what the other fighter
   committed this turn, so guards and sprawls can answer it. */
function executeTechnique(d, side, foe, tech, foeTech, rnd) {
  const R = rnd || Math.random;
  const ev = { by: side === d.p ? "p" : "e", tech, name: tech.name, hit: false, dmg: 0,
               status: null, rangeTo: null, blocked: false, guarded: false, whiff: false,
               stam: 0, launcher: false, crit: false };

  const blocked = statusBlocks(side, tech.cls);
  if (blocked) { ev.whiff = true; ev.note = blocked; return ev; }

  /* position-gated ringcraft: the menus filter these, so reaching here out
     of position means a stale commit - it whiffs rather than crashes */
  if (typeof posOk === "function" && !posOk(d, side, tech)) {
    ev.whiff = true; ev.note = "OUT OF POSITION"; return ev;
  }

  /* Circle Out IS the escape roll - the one attemptEscape() was built for.
     It charges its own air inside attemptEscape, succeeds against the
     position rather than the man, and a failure is a real turn spent. */
  if (tech.flags.indexOf("circle") >= 0) {
    const esc = attemptEscape(d, side, R);
    ev.stam = esc.stam; ev.escape = esc;
    if (esc.escaped) { ev.note = "CIRCLED OUT"; ev.posTo = d.pos; }
    else { ev.whiff = true; ev.note = "CUT OFF AT THE ROPES"; }
    return ev;
  }

  let cost = staminaCost(side, tech);
  /* Perpetual Motion: the opening technique of every turn is free air */
  if (side.freeOpener && !side._fo) { cost = 0; side._fo = true; }
  /* water break: the corner already paid for this one */
  if (side.freeNext && cost > 0) { cost = 0; side.freeNext = false; }
  side.stam = Math.max(0, side.stam - cost);
  ev.stam = cost;
  if (side.stam <= 0) {
    addStatus(side, "WINDED");
    if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
      CombatEvents.emit("STAMINA_BREAK", { turn: d ? d.turn : 0, fighterName: (typeof FIGHTERS !== "undefined" && FIGHTERS[side.fid]) ? FIGHTERS[side.fid].name.split(" ")[0] : "" });
    }
  }

  /* GUARD is not thrown at anyone - it buys stamina and sets up the soak */
  if (tech.cls === "GUARD") {
    const back = 14 + Math.round((side.maxStam || 60) * 0.08) + (side.guardBonus || 0);
    side.stam = Math.min(side.maxStam, side.stam + back);
    ev.guarded = true; ev.recovered = back;
    if (tech.flags.indexOf("recover") >= 0) delete side.cond.WINDED;
    applyRangeShift(d, tech, ev);
    return ev;
  }

  /* a sprawl beats a takedown outright - the one hard counter in the game */
  if (foeTech && foeTech.flags.indexOf("anti-takedown") >= 0 && tech.flags.indexOf("takedown") >= 0) {
    ev.whiff = true; ev.note = "SPRAWLED ON"; addStatus(side, "OFF_BALANCE");
    return ev;
  }

  const acc = accuracyOf(d, side, foe, tech);
  if (R() * 100 > acc) { ev.whiff = true; return ev; }

  ev.hit = true;
  let dmg = damageOf(d, side, foe, tech, foeTech);
  /* fresh wraps: a handful of strikes hit harder and cannot be answered */
  const wrapped = side.edge && side.edge.hits > 0 && tech.cls === "STRIKE";
  if (wrapped) { dmg = Math.round(dmg * (side.edge.mul || 1.25)); side.edge.hits--; }
  let gf = guardFactor(foe, foeTech, d);
  if (side && side.seals && side.seals[tech.id] === "SEAL_HEAVY" && gf < 1) {
    gf = 1 - (1 - gf) * 0.50; // ignores 50% guard reduction
  }
  if (gf < 1) { dmg = Math.max(1, Math.round(dmg * gf)); ev.blocked = true; }
  /* a parry answers back */
  if (foeTech && foeTech.cls === "GUARD" && foeTech.flags.indexOf("parry") >= 0 && R() < 0.5 &&
      !(wrapped && side.edge && side.edge.noParry)) {
    ev.counter = Math.max(2, Math.round(dmg * 0.5));
    if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
      CombatEvents.emit("COUNTER_HIT", { turn: d ? d.turn : 0, fighterName: (typeof FIGHTERS !== "undefined" && FIGHTERS[foe.fid]) ? FIGHTERS[foe.fid].name.split(" ")[0] : "" });
    }
  }

  // Octagon Predator resonance: extra impact on takedowns/throws
  if (typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "OCTAGON_PREDATOR") &&
      (tech.cls === "THROW" || (tech.flags && tech.flags.indexOf("takedown") >= 0))) {
    dmg += 12;
    ev.predatorBonus = 12;
  }

  // Vampiric Leech Seal
  if (side && side.seals && side.seals[tech.id] === "SEAL_VAMPIRE" && dmg > 0) {
    const leech = Math.max(1, Math.round(dmg * 0.25));
    side.hp = Math.min(side.maxhp || 100, side.hp + leech);
    ev.leech = leech;
  }

  // Wind Flow Seal
  if (side && side.seals && side.seals[tech.id] === "SEAL_FLOW") {
    side.stam = Math.min(side.maxStam || 60, side.stam + 10);
    ev.flowRefund = 10;
  }

  // Viper Venom Seal
  if (side && side.seals && side.seals[tech.id] === "SEAL_VIPER" && R() * 100 < 75) {
    const vst = tech.eff ? tech.eff.st : "BLEEDING";
    if (addStatus(foe, vst)) ev.status = STATUS[vst] ? STATUS[vst].name : vst;
  }

  ev.dmg = dmg;

  if (tech.eff && R() * 100 < tech.eff.ch) {
    if (addStatus(foe, tech.eff.st)) ev.status = STATUS[tech.eff.st].name;
  }
  if (tech.flags.indexOf("launcher") >= 0 && !ev.blocked) ev.launcher = true;
  applyRangeShift(d, tech, ev);
  /* the corner reversal: a trapped man lands it and the corner changes
     hands - the whole point of the technique, so it happens before the
     pressure ledger books anything */
  if (tech.flags.indexOf("reversal") >= 0) {
    const key = side === d.p ? "p" : "e";
    if (swapCorner(d, key)) {
      ev.reversal = true; ev.posTo = d.pos; ev.cornered = d.cornered;
      if (typeof CombatEvents !== "undefined" && typeof CombatEvents.emit === "function") {
        CombatEvents.emit("REVERSAL", { turn: d ? d.turn : 0, fighterName: (typeof FIGHTERS !== "undefined" && FIGHTERS[side.fid]) ? FIGHTERS[side.fid].name.split(" ")[0] : "" });
      }
    }
  }
  pressureShift(d, side, ev);   // sustained pressure walks them toward the ropes
  return ev;
}

/* end of turn: conditions tick, both fighters get a little air back */
function endTurnUpkeep(side) {
  const dmg = tickStatus(side);
  const regen = Math.round((side.maxStam || 60) * 0.06);
  side.stam = Math.min(side.maxStam, side.stam + regen);
  if (side.stam > 0) delete side.cond.WINDED;
  side._fo = false;                 // Perpetual Motion resets with the turn
  return dmg;
}
