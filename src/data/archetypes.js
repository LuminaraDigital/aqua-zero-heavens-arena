/* =====================================================================
   Aqua Zero Heavens Arena - opponent gameplans & MMA fighting styles
   Luminara Digital

   Adapted from MMA fighter combat engines: 19 granular martial arts
   behavioral profiles and tactical gameplans. A gameplan reweights
   what an opponent values, producing authentic fight dynamics across
   striking, clinch, and mat engagements.
   ===================================================================== */
const ARCHETYPES = {
  power_puncher: {
    name: "POWER PUNCHER", tell: "heavy punches, knockout-focused, forward pressure",
    weights: { aggression: 1.40, guard: 0.50, closeIn: 8, ground: 0.8, sub: 0.6, noise: 1.1, punchBias: 1.4, kickBias: 0.7 },
  },
  counter_puncher: {
    name: "COUNTER-PUNCHER", tell: "waits for mistakes, counterattacks with precision",
    weights: { aggression: 0.85, guard: 1.75, closeIn: 0, ground: 0.8, sub: 0.7, noise: 0.7, counterBonus: 16, punchBias: 1.3 },
  },
  volume_striker: {
    name: "VOLUME STRIKER", tell: "high strike output, relentless combinations wearing you down",
    weights: { aggression: 1.35, guard: 0.65, closeIn: 6, ground: 0.7, sub: 0.6, noise: 0.9, punchBias: 1.2, kickBias: 1.1 },
  },
  pressure_fighter: {
    name: "PRESSURE FIGHTER", tell: "walks you down and never lets the range reset",
    weights: { aggression: 1.30, guard: 0.55, closeIn: 14, ground: 1.0, sub: 0.9, noise: 1.0, clinchBias: 1.2 },
  },
  swarmer: {
    name: "SWARMER", tell: "smothers inside range with body shots and hooks",
    weights: { aggression: 1.35, guard: 0.60, closeIn: 12, ground: 0.9, sub: 0.7, noise: 1.0, preferRange: "MID" },
  },
  out_boxer: {
    name: "OUT-BOXER", tell: "maintains distance with long range footwork and jabs",
    weights: { aggression: 0.95, guard: 1.20, closeIn: -12, ground: 0.5, sub: 0.5, noise: 0.8, preferRange: "LONG" },
  },
  defensive_boxer: {
    name: "DEFENSIVE BOXER", tell: "slips, rolls, and counters from a tight guard",
    weights: { aggression: 0.80, guard: 1.85, closeIn: -6, ground: 0.6, sub: 0.6, noise: 0.7, counterBonus: 18 },
  },
  switch_hitter: {
    name: "SWITCH HITTER", tell: "shifts angles unpredictably between punches and kicks",
    weights: { aggression: 1.15, guard: 0.85, closeIn: 4, ground: 0.8, sub: 0.8, noise: 1.2, punchBias: 1.1, kickBias: 1.2 },
  },
  kickboxer: {
    name: "KICKBOXER", tell: "punishing low kicks and high roundhouses from kicking range",
    weights: { aggression: 1.15, guard: 0.85, closeIn: -8, ground: 0.6, sub: 0.5, noise: 0.9, preferRange: "LONG", kickBias: 1.5 },
  },
  muay_thai: {
    name: "MUAY THAI", tell: "vicious elbows, knees, and brutal plum clinching",
    weights: { aggression: 1.25, guard: 0.80, closeIn: 8, ground: 0.7, sub: 0.6, noise: 0.9, preferRange: "CLINCH", clinchBias: 1.6 },
  },
  wrestler: {
    name: "WRESTLER", tell: "relentless takedowns and dominant top mat control",
    weights: { aggression: 1.20, guard: 0.80, closeIn: 12, ground: 1.5, sub: 1.1, noise: 0.9, preferRange: "GROUND", takedownBias: 1.6 },
  },
  bjj: {
    name: "BRAZILIAN JIU-JITSU", tell: "guard sweeps, positional transitions, and lethal submissions",
    weights: { aggression: 1.05, guard: 0.90, closeIn: 10, ground: 1.6, sub: 1.7, noise: 0.9, preferRange: "GROUND" },
  },
  judo: {
    name: "JUDO SPECIALIST", tell: "dynamic throws, off-balancing trips, and instant pins",
    weights: { aggression: 1.10, guard: 0.85, closeIn: 10, ground: 1.3, sub: 1.3, noise: 0.9, preferRange: "CLINCH" },
  },
  karate: {
    name: "KARATEKA", tell: "blitzing linear strikes with rapid in-and-out distancing",
    weights: { aggression: 1.10, guard: 0.95, closeIn: -4, ground: 0.5, sub: 0.5, noise: 0.9, preferRange: "LONG" },
  },
  sambo: {
    name: "SAMBO FIGHTER", tell: "violent upper-body throws transitioning straight into leg locks",
    weights: { aggression: 1.25, guard: 0.75, closeIn: 12, ground: 1.5, sub: 1.6, noise: 1.0, preferRange: "GROUND" },
  },
  taekwondo: {
    name: "TAEKWONDO MASTER", tell: "rapid spinning kicks and long-range acrobatic volleys",
    weights: { aggression: 1.10, guard: 0.90, closeIn: -14, ground: 0.4, sub: 0.4, noise: 1.0, preferRange: "LONG", kickBias: 1.6 },
  },
  greco_roman: {
    name: "GRECO-ROMAN WRESTLER", tell: "crushing upper body clinch, suplexes, and cage pressure",
    weights: { aggression: 1.25, guard: 0.80, closeIn: 12, ground: 1.3, sub: 1.0, noise: 0.9, preferRange: "CLINCH", clinchBias: 1.5 },
  },
  catch_wrestler: {
    name: "CATCH WRESTLER", tell: "brutal rides, neck cranks, and aggressive submission hunting",
    weights: { aggression: 1.30, guard: 0.70, closeIn: 10, ground: 1.5, sub: 1.5, noise: 1.1, preferRange: "GROUND" },
  },
  freestyle_wrestler: {
    name: "FREESTYLE WRESTLER", tell: "explosive level changes, chain wrestling, and mat scrambles",
    weights: { aggression: 1.20, guard: 0.75, closeIn: 14, ground: 1.4, sub: 1.2, noise: 0.9, preferRange: "GROUND", takedownBias: 1.5 },
  },
  finisher: {
    name: "FINISHER", tell: "swings for the ending and does not pace itself",
    weights: { aggression: 1.45, guard: 0.45, closeIn: 4, ground: 1.0, sub: 1.15, noise: 1.3, ignoreStamina: true },
  },
};

/* Core legacy aliases for 100% backward compatibility with save files & tests */
ARCHETYPES.pressure = ARCHETYPES.pressure_fighter;
ARCHETYPES.counter = ARCHETYPES.counter_puncher;
ARCHETYPES.grappler = ARCHETYPES.wrestler;
ARCHETYPES.outfighter = ARCHETYPES.out_boxer;

const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

/* A fighter's own dossier decides their gameplan, so it is theirs rather
   than a die roll - the same opponent always fights the same way. */
function archetypeFor(fid, seed) {
  const discs = (typeof disciplinesOf === "function") ? disciplinesOf(fid) : [];
  const b = (typeof bioOf === "function") ? bioOf(fid) : null;
  if (b && b.a) {
    const power = b.a[0] || 80;
    if (power >= 92) return "finisher";
  }
  if (discs.indexOf("bjj") >= 0) return "bjj";
  if (discs.indexOf("sambo") >= 0) return "sambo";
  if (discs.indexOf("judo") >= 0) return "judo";
  if (discs.indexOf("wrestling") >= 0) return "wrestler";
  if (discs.indexOf("muaythai") >= 0 || discs.indexOf("lethwei") >= 0) return "muay_thai";
  if (discs.indexOf("taekwondo") >= 0) return "taekwondo";
  if (discs.indexOf("shotokan") >= 0) return "karate";
  if (discs.indexOf("kickboxing") >= 0) return "kickboxer";
  if (discs.indexOf("boxing") >= 0) return ((fid + (seed || 0)) % 2) ? "counter_puncher" : "power_puncher";

  const grap = ["bjj", "wrestling", "sambo", "judo", "grappling", "subgrap", "jiujitsu", "sumo"];
  if (discs.some((d) => grap.indexOf(d) >= 0)) {
    return discs.length > 1 && discs.some((d) => grap.indexOf(d) < 0) ? "pressure_fighter" : "wrestler";
  }
  const longr = ["taekwondo", "wushu", "kickboxing"];
  if (discs.some((d) => longr.indexOf(d) >= 0)) return "out_boxer";

  return ((fid + (seed || 0)) % 2) ? "counter_puncher" : "pressure_fighter";
}

const archetypeOf = (id) => ARCHETYPES[id] || ARCHETYPES.pressure_fighter;
