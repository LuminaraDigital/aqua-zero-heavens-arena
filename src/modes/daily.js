/* =====================================================================
   Aqua Zero Heavens Arena - the daily gauntlet
   Luminara Digital

   One fight a day, the same fight for everybody, decided by the date. No
   server involved: the date seeds a small deterministic generator, so two
   people on the same day get the same fighter, the same opponent and the
   same stipulations, and can compare scores honestly.

   The streak counts days you SHOWED UP, not days you won. Losing a hard
   gauntlet should not cost you a fortnight's streak - that turns a habit
   into a punishment and people quit rather than break it.
   ===================================================================== */
/* mulberry32 - tiny, fast, and identical everywhere */
function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* local calendar day, not UTC - the gauntlet should turn over at your midnight */
function dayKey(date) {
  const d = date || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
const dayBefore = (key) => {
  const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100, d = key % 100;
  const t = new Date(y, m - 1, d); t.setDate(t.getDate() - 1);
  return dayKey(t);
};

/* the stipulations that make each day feel different */
const STIPULATIONS = {
  glass:    { name: "GLASS ROUND", desc: "both fighters have half health", hpMul: 0.5 },
  ironman:  { name: "IRON MAN", desc: "both fighters have double health", hpMul: 2 },
  gassed:   { name: "DEEP WATER", desc: "everyone starts on half a tank", stamMul: 0.5 },
  brawl:    { name: "PHONE BOOTH", desc: "the fight opens in the clinch", range: "CLINCH" },
  mat:      { name: "MAT WORK", desc: "the fight opens on the ground", range: "GROUND" },
  kickers:  { name: "LONG RANGE", desc: "the fight opens at kicking distance", range: "LONG" },
  loaded:   { name: "LOADED", desc: "both signature meters start full", superStart: true },
  sharp:    { name: "SHARP", desc: "everything hits 25% harder", dmgMul: 1.25 },
  ironchin: { name: "IRON CHIN", desc: "everything hits 25% softer, so it goes long", dmgMul: 0.75 },
  hunted:   { name: "HUNTED", desc: "your opponent starts with two focus banked", foeFocus: 2 },
};
const STIP_IDS = Object.keys(STIPULATIONS);

/* everything about today's fight, derived from the date alone */
function dailySetup(key, roster) {
  const R = seededRng(key);
  const n = roster || 25;
  const hero = (R() * n) | 0;
  let opp = (R() * n) | 0;
  if (opp === hero) opp = (opp + 1 + ((R() * (n - 1)) | 0)) % n;
  const stips = [];
  const pool = STIP_IDS.slice();
  const count = 1 + ((R() * 2) | 0);                     // one or two, never a soup
  for (let i = 0; i < count && pool.length; i++) stips.push(pool.splice((R() * pool.length) | 0, 1)[0]);
  const level = 5 + ((R() * 5) | 0);
  return { key, hero, opp, stips, level };
}
const stipMul = (stips, field, dflt) =>
  (stips || []).reduce((v, id) => (STIPULATIONS[id] && STIPULATIONS[id][field] !== undefined
    ? v * STIPULATIONS[id][field] : v), dflt === undefined ? 1 : dflt);
const stipFlag = (stips, field) => {
  for (const id of stips || []) { const s = STIPULATIONS[id]; if (s && s[field] !== undefined) return s[field]; }
  return null;
};

/* score rewards finishing healthy and finishing fast */
function dailyScore(st) {
  if (!st.win) return 0;
  const health = Math.round(st.hpLeft * 1000);
  const speed = Math.max(0, 400 - st.turns * 25);
  const flair = (st.sigPerfect || 0) * 60 + (st.comboMax >= 3 ? 80 : 0) + (st.perfectGuards || 0) * 25;
  return health + speed + flair;
}

/* the save's daily block, rolled forward to today */
function dailyState(save, today) {
  if (!save.daily) save.daily = { day: 0, done: false, score: 0, streak: 0, best: 0, bestStreak: 0, plays: 0 };
  const D = save.daily;
  if (D.day !== today) {
    // showing up yesterday keeps the streak; a missed day ends it
    if (!(D.day && D.done && dayBefore(today) === D.day)) D.streak = 0;
    D.day = today; D.done = false; D.score = 0;
  }
  return D;
}
function completeDaily(save, today, score) {
  const D = dailyState(save, today);
  if (D.done) return { already: true, D };
  D.done = true; D.score = score; D.plays = (D.plays || 0) + 1;
  D.streak = (D.streak || 0) + 1;
  if (D.streak > (D.bestStreak || 0)) D.bestStreak = D.streak;
  const record = score > (D.best || 0);
  if (record) D.best = score;
  return { already: false, record, D };
}
