/* =====================================================================
   Aqua Zero Heavens Arena - opponent gameplans
   Luminara Digital

   One AI that always plays the percentages is one puzzle you solve once.
   A gameplan reweights what an opponent values, so the same technique
   dex produces a pressure fighter who walks you down, a counter-striker
   who waits, and a grappler who will not stay standing.

   The point is anti-degeneracy: whatever you spammed last fight, some
   gameplan punishes it. The brief screen names it before the bell, so
   losing to one is information rather than noise.
   ===================================================================== */
const ARCHETYPES = {
  pressure: {
    name: "PRESSURE FIGHTER", tell: "walks you down and never lets the range reset",
    weights: { aggression: 1.25, guard: 0.55, closeIn: 14, ground: 1, sub: 0.9, noise: 1 },
  },
  counter: {
    name: "COUNTER-STRIKER", tell: "waits for you to commit, then makes you pay",
    weights: { aggression: 0.9, guard: 1.7, closeIn: 0, ground: 0.9, sub: 1, noise: 0.8,
               counterBonus: 14 },
  },
  grappler: {
    name: "GRAPPLER", tell: "wants this on the mat and wants it there now",
    weights: { aggression: 1, guard: 0.9, closeIn: 10, ground: 1.5, sub: 1.5, noise: 1,
               preferRange: "GROUND" },
  },
  outfighter: {
    name: "OUT-FIGHTER", tell: "keeps it long and picks you apart from distance",
    weights: { aggression: 1.05, guard: 1.1, closeIn: -12, ground: 0.55, sub: 0.6, noise: 0.9,
               preferRange: "LONG" },
  },
  finisher: {
    name: "FINISHER", tell: "swings for the ending and does not pace itself",
    weights: { aggression: 1.45, guard: 0.45, closeIn: 4, ground: 1, sub: 1.15, noise: 1.3,
               ignoreStamina: true },
  },
};
const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

/* A fighter's own dossier decides their gameplan, so it is theirs rather
   than a die roll - the same opponent always fights the same way. */
function archetypeFor(fid, seed) {
  const discs = disciplinesOf(fid);
  const grap = ["bjj", "wrestling", "sambo", "judo", "grappling", "subgrap", "jiujitsu", "sumo"];
  const longr = ["taekwondo", "wushu", "kickboxing"];
  const b = bioOf(fid);
  if (discs.some((d) => grap.indexOf(d) >= 0)) {
    // a grappler who also strikes is a pressure fighter, a pure one goes to the mat
    return discs.length > 1 && discs.some((d) => grap.indexOf(d) < 0) ? "pressure" : "grappler";
  }
  if (discs.some((d) => longr.indexOf(d) >= 0)) return "outfighter";
  if (b && b.a) {
    const power = b.a[0] || 80;
    if (power >= 90) return "finisher";
  }
  return ((fid + (seed || 0)) % 2) ? "counter" : "pressure";
}
const archetypeOf = (id) => ARCHETYPES[id] || ARCHETYPES.pressure;
