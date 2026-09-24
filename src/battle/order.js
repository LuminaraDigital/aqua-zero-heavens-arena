/* =====================================================================
   Aqua Zero Heavens Arena - initiative
   Luminara Digital

   Both fighters commit a technique, then the turn resolves in initiative
   order. Priority brackets come first - a sprawl always beats a takedown
   attempt, a jab always beats a spinning kick - and raw speed settles
   everything inside a bracket. A small random band keeps mirror matches
   from being decided by a coin that never flips.
   ===================================================================== */
function initiativeOf(side, tech, rnd) {
  const mods = statusMods(side);
  const disc = (tech && tech.disc) ? DISCIPLINES[tech.disc] : null;
  let spd = (tech ? tech.speed : 50) * (disc ? disc.bias.spd : 1) * mods.spd * (side.spdMul || 1);
  if (side && side.seals && tech && side.seals[tech.id] === "SEAL_LIGHTNING") spd += 15;
  // Seek Finish: hunting a rocked opponent confers rapid initiative surge
  if (side && side.seekFinish) spd += 15;
  // Leg zone damage compromises base mobility and footwork speed
  if (side && side.zones && side.zones.max && side.zones.legs < (side.zones.max * 0.4)) spd *= 0.85;
  // Dead leg peroneal nerve damage slows footwork and initiative
  if (side && side.cond && side.cond.DEAD_LEG) spd *= 0.78;
  // Wall-pinned target suffers defensive movement drag
  if (side && side.cond && side.cond.WALL_PINNED) spd *= 0.82;
  // High speed advantage
  const height = tech ? (tech.height || (typeof attackHeightOf === "function" ? attackHeightOf(tech) : "MID")) : "MID";
  if (height === "HIGH") spd += 8;
  const jitter = 0.92 + ((rnd || Math.random)() * 0.16);
  /* smelling salts: the corner buys you the first move, whatever you throw */
  return (((tech && tech.prio) || 0) + (side.prioBoost || 0)) * 1000 + spd * jitter;
}
/* the two committed actions, fastest first */
function orderTurn(actions) {
  return actions.slice().sort((a, b) => b.init - a.init);
}
/* stamina cost after discipline conditioning */
function staminaCost(side, tech, optDuel) {
  const disc = DISCIPLINES[tech.disc];
  let c = tech.stam * (disc ? disc.bias.stam : 1) * (side.stamMul || 1);
  /* changing levels is the most expensive thing in the sport. Nothing
     charged for it, so the mat was a 2.45-entries-per-fight door and
     GROUND took 39-48% of all turns against a 25-35% band: a shot was
     priced like the strike it replaced. +5 is about half a jab's worth of
     air on top, enough that a fighter picks his shots rather than throwing
     one every other turn, and it bites hardest late, which is when a
     wrestler's takedowns really do stop landing. */
  if (tech.moves === "GROUND" || (tech.flags || []).indexOf("takedown") >= 0) c += 8;
  /* a shot from further out than it was built for covers more ground: the
     LONG-range double leg costs a sprint on top of the technique */
  if (optDuel && optDuel.range && tech.range && tech.range !== "ANY" && (tech.flags || []).indexOf("takedown") >= 0 &&
      RANGE_INDEX[optDuel.range] < RANGE_INDEX[tech.range]) c += 4;
  if (side && side.seals && side.seals[tech.id] === "SEAL_LIGHTNING") c *= 0.75;
  // Body trauma taxes breathing and stamina expenditure
  if (side && side.zones && side.zones.max && side.zones.body < (side.zones.max * 0.4)) c *= 1.15;
  // Dead leg footwork tax on movement/strikes
  if (side && side.cond && side.cond.DEAD_LEG) c += 3;
  // Weight cut late cardio modifier after round 1 / turn 6
  if (side && side.weightCardioMod && optDuel && optDuel.turn > 6) {
    c *= (1 + side.weightCardioMod);
  }
  if (optDuel && optDuel.range === "CLINCH" && typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "DIRTY_BOXING")) {
    c = Math.max(0, c - 2);
  }
  return Math.max(0, Math.round(c));
}
