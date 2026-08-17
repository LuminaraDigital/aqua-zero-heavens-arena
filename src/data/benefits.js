/* =====================================================================
   Aqua Zero Heavens Arena - camp benefits
   Luminara Digital

   What a run remembers. Clear a stage and you pick one of three benefits
   from your camp; they stack for the rest of the run, so no two climbs
   play the same. This is the variety layer - the thing that makes run
   four feel different from run one rather than longer.

   Every benefit is data with optional hooks:
     side(s,d)      mutate your fighter as the bell rings
     dmgOut(n,ctx)  change damage you deal      -> returns n
     dmgIn(n,ctx)   change damage you take      -> returns n
     turnEnd(d,s)   end of every turn
   ctx = { d, side, foe, tech, ev }

   Keep them honest: a benefit should change how you fight, not delete the
   fight. Nothing here multiplies damage past 1.35 or heals more than a
   guard would.
   ===================================================================== */
const BENEFITS = {};
function B(id, name, desc, tag, hooks) {
  BENEFITS[id] = Object.assign({ id, name, desc, tag }, hooks || {});
}
const inRange = (ctx, r) => ctx.d.range === r;

/* ---------------- conditioning ---------------- */
B("gas_tank", "Gas Tank", "+25 stamina ceiling, and you start every fight full", "CONDITIONING",
  { side: (s) => { s.maxStam += 25; s.stam = s.maxStam; } });
B("second_wind", "Second Wind", "recover 6 stamina at the end of every turn", "CONDITIONING",
  { turnEnd: (d, s) => { s.stam = Math.min(s.maxStam, s.stam + 6); } });
B("iron_lungs", "Iron Lungs", "every technique costs 25% less air", "CONDITIONING",
  { side: (s) => { s.stamMul = (s.stamMul || 1) * 0.75; } });
B("granite_chin", "Granite Chin", "you take 12% less of everything", "CONDITIONING",
  { dmgIn: (n) => Math.round(n * 0.88) });
B("deep_water", "Deep Water", "below half health you hit 25% harder", "CONDITIONING",
  { dmgOut: (n, ctx) => (ctx.side.hp < ctx.side.maxhp * 0.5 ? Math.round(n * 1.25) : n) });

/* ---------------- striking ---------------- */
B("heavy_hands", "Heavy Hands", "+12% on every strike", "STRIKING",
  { dmgOut: (n, ctx) => (ctx.tech.cls === "STRIKE" ? Math.round(n * 1.12) : n) });
B("southpaw", "Southpaw Switch", "+30% on counters - anything you land after they miss", "STRIKING",
  { dmgOut: (n, ctx) => (ctx.d.lastWhiffBy === (ctx.side === ctx.d.p ? "e" : "p") ? Math.round(n * 1.3) : n) });
B("cutman", "Cutman's Nightmare", "your cuts bleed twice as long", "STRIKING",
  { onStatus: (side, foe, key) => (key === "BLEEDING" ? { turns: 8 } : null) });
B("leg_kicker", "Leg Kicker", "leg damage you inflict also drains 8 of their stamina", "STRIKING",
  { onStatus: (side, foe, key) => { if (key === "LEG_HURT") foe.stam = Math.max(0, foe.stam - 8); return null; } });
B("range_finder", "Range Finder", "+18% on anything thrown at its own range", "STRIKING",
  { dmgOut: (n, ctx) => (rangeFit(ctx.tech.range, ctx.d.range) >= 1 ? Math.round(n * 1.18) : n) });
B("killer_instinct", "Killer Instinct", "+35% against an opponent under 30% health", "STRIKING",
  { dmgOut: (n, ctx) => (ctx.foe.hp < ctx.foe.maxhp * 0.3 ? Math.round(n * 1.35) : n) });

/* ---------------- grappling ---------------- */
B("mat_returner", "Mat Returner", "+20% on the ground, either way", "GRAPPLING",
  { dmgOut: (n, ctx) => (inRange(ctx, "GROUND") ? Math.round(n * 1.2) : n) });
B("chain_wrestler", "Chain Wrestler", "throws and takedowns never miss by more than a hair", "GRAPPLING",
  { accOut: (a, ctx) => (ctx.tech.cls === "THROW" ? Math.min(97, a + 18) : a) });
B("submission_hunter", "Submission Hunter", "+25% on submissions, and they land more often", "GRAPPLING",
  { dmgOut: (n, ctx) => (ctx.tech.cls === "SUB" ? Math.round(n * 1.25) : n),
    accOut: (a, ctx) => (ctx.tech.cls === "SUB" ? Math.min(96, a + 10) : a) });
B("sprawl_king", "Sprawl King", "you take 30% less at clinch range", "GRAPPLING",
  { dmgIn: (n, ctx) => (inRange(ctx, "CLINCH") ? Math.round(n * 0.7) : n) });
B("top_control", "Top Control", "pins and holds you apply last two turns longer", "GRAPPLING",
  { onStatus: (side, foe, key) => (key === "PINNED" || key === "HELD" ? { turns: 4 } : null) });

/* ---------------- defence ---------------- */
B("shell", "Tight Shell", "guarding gives back 8 more stamina than usual", "DEFENCE",
  { side: (s) => { s.guardBonus = (s.guardBonus || 0) + 8; } });
B("ring_general", "Ring General", "the guard ring opens on every incoming hit, however small", "DEFENCE",
  { guardAll: true });
B("counter_puncher", "Counter Puncher", "a perfect guard banks two focus, not one", "DEFENCE",
  { perfectFocus: 2 });
B("veteran_corner", "Veteran Corner", "heal 10 between stages, on top of the usual", "DEFENCE",
  { stageHeal: 10 });
B("read_the_room", "Read The Room", "your first READ each fight is free", "DEFENCE",
  { freeRead: true });

/* ---------------- tactical ---------------- */
B("fast_starter", "Fast Starter", "start every fight with a full signature meter", "TACTICAL",
  { side: (s) => { s.sup = SUP_MAX; } });
B("focused", "Focused", "+2 focus, and a bigger focus ceiling", "TACTICAL",
  { side: (s) => { s.focusMax += 2; s.focus = Math.min(s.focusMax, s.focus + 2); } });
B("cornerman", "Cornerman", "one extra continue for the rest of the run", "TACTICAL",
  { onPick: (a) => { a.continues++; } });
B("student", "Eternal Student", "learn one technique above your level", "TACTICAL",
  { levelBonus: 1 });
B("gym_rat", "Gym Rat", "+15 card points immediately", "TACTICAL",
  { onPick: (a) => { a.points += 15; } });

/* ---------------- the edge ----------------
   Everything above bends a number. These five break a rule, and that is
   the whole reason to want one: the game has a stated law - three links,
   every technique costs air, escapes are paid for, purses are what they
   are - and an EDGE benefit voids exactly one line of it.

   They never appear at the camp. The camp is the fair track; an edge is
   bought at the gym, at a price that means going without everything else
   for two stages. Corrupting the rules is a purchase, not a reward. */
B("edge_fourth_link", "The Fourth Link", "your combinations may run four links deep", "EDGE",
  { chainPlus: 1 });
B("edge_perpetual", "Perpetual Motion", "the first technique you throw each turn costs no air", "EDGE",
  { side: (s) => { s.freeOpener = true; } });
B("edge_houdini", "Houdini's Hips", "escaping the ropes or the corner costs nothing, and your feet count half again", "EDGE",
  { side: (s) => { s.escapeFree = true; s.escapeMul = (s.escapeMul || 1) * 1.5; } });
B("edge_glass", "Glass Cannon", "half again on everything you throw - and a quarter more on everything you take", "EDGE",
  { dmgOut: (n) => Math.round(n * 1.5), dmgIn: (n) => Math.round(n * 1.25) });
B("edge_promoter", "The Promoter's Cut", "every purse this run pays double", "EDGE",
  { purseMul: 2 });

const BENEFIT_IDS = Object.keys(BENEFITS);

/* three choices you do not already hold - the camp never offers an EDGE;
   rule-breakers are shop stock, priced like the contraband they are */
function benefitChoices(held, rnd) {
  const R = rnd || Math.random;
  const pool = BENEFIT_IDS.filter((id) =>
    (held || []).indexOf(id) < 0 && BENEFITS[id].tag !== "EDGE");
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice((R() * pool.length) | 0, 1)[0]);
  return out;
}
/* fold every held benefit through one hook */
function benefitHook(held, name, value, ctx) {
  (held || []).forEach((id) => {
    const b = BENEFITS[id];
    if (b && b[name]) value = b[name](value, ctx);
  });
  return value;
}
function benefitFlag(held, name) {
  for (const id of held || []) { const b = BENEFITS[id]; if (b && b[name]) return b[name]; }
  return null;
}
