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
  const disc = DISCIPLINES[tech.disc];
  let spd = tech.speed * (disc ? disc.bias.spd : 1) * mods.spd * (side.spdMul || 1);
  if (side && side.seals && side.seals[tech.id] === "SEAL_LIGHTNING") spd += 15;
  const jitter = 0.92 + ((rnd || Math.random)() * 0.16);
  /* smelling salts: the corner buys you the first move, whatever you throw */
  return ((tech.prio || 0) + (side.prioBoost || 0)) * 1000 + spd * jitter;
}
/* the two committed actions, fastest first */
function orderTurn(actions) {
  return actions.slice().sort((a, b) => b.init - a.init);
}
/* stamina cost after discipline conditioning */
function staminaCost(side, tech, optDuel) {
  const disc = DISCIPLINES[tech.disc];
  let c = tech.stam * (disc ? disc.bias.stam : 1) * (side.stamMul || 1);
  if (side && side.seals && side.seals[tech.id] === "SEAL_LIGHTNING") c *= 0.75;
  if (optDuel && optDuel.range === "CLINCH" && typeof hasResonance === "function" && side.techs && hasResonance(side.techs, "DIRTY_BOXING")) {
    c = Math.max(0, c - 2);
  }
  return Math.max(0, Math.round(c));
}
