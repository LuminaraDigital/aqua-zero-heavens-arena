/* =====================================================================
   Aqua Zero Heavens Arena - discipline mastery
   Luminary Digital

   The second progression axis, and the one that always moves.

   Fighter mastery (progress/mastery.js) answers "I lost, so that run was
   worth nothing". It does not answer "I have 25 fighters and 640 XP of
   belt to earn on each of them at 18 a win". Per-fighter progress is
   diffuse by construction: pick a different fighter and you start again.

   This axis is keyed on the ART instead of the man. Every technique you
   actually throw feeds the discipline it came from, win or lose, and the
   arts overlap the roster heavily - so the boxing you did with one fighter
   is boxing you already own when you pick the next one. Whatever you play,
   something is climbing.

   Three things make it worth having rather than a second XP bar:

     IT POOLS      one art is fed by every fighter who trains it, and by
                   every cross-art technique the draft ever hands you.
     IT IS EARNED  XP comes from techniques USED, not from fights entered.
                   Lean on your kicks and your kicking art climbs; the art
                   you never throw stays where it is.
     IT FEEDS THE  a mastered art is likelier to be OFFERED. Mastery stops
     DRAFT         being a number on a menu and becomes the shape of the
                   next run's movelist.

   Ranks are plain English grades rather than belts, for two reasons: the
   belt ladder is already spoken for by fighter mastery, and these nineteen
   arts come from a dozen traditions whose own grading systems do not agree
   with each other.

   THE POWER BUDGET, stated so it can be argued with. A fully mastered art
   is worth, on that art's techniques only: +5 accuracy, +8% power, 2 less
   stamina, +5% initiative. For scale, one DRILL tier in the gym is +15%
   power and +5 accuracy and there are two of them, and the camp benefit
   ceiling is 1.35x damage. This is permanent and free, so it is
   deliberately smaller than either - it sharpens an art, it does not win
   with it. Priority is untouched on purpose: brackets are worth 1000
   initiative each, so a +1 there would quietly repeal "a sprawl always
   beats a takedown".

   Nothing here is gated behind anything. On a fresh save every bonus
   below is 0 and every multiplier is exactly 1, so wiring these into the
   resolver and the drafter changes no existing behaviour until the player
   has earned something.

   Pure logic. The save block is passed in and returned; no rendering, no
   input, no globals written.
   ===================================================================== */
const DISC_RANKS = [
  { level: 0, name: "Untrained",    need: 0,   perk: "",
    acc: 0, powMul: 1.00, stamCut: 0, spdMul: 1.00 },
  { level: 1, name: "Novice",       need: 25,  perk: "+2 accuracy with this art",
    acc: 2, powMul: 1.00, stamCut: 0, spdMul: 1.00 },
  { level: 2, name: "Practitioner", need: 80,  perk: "its techniques cost 1 less stamina",
    acc: 2, powMul: 1.00, stamCut: 1, spdMul: 1.00 },
  { level: 3, name: "Adept",        need: 180, perk: "+4% power with this art",
    acc: 3, powMul: 1.04, stamCut: 1, spdMul: 1.00 },
  { level: 4, name: "Instructor",   need: 340, perk: "+5% initiative with this art",
    acc: 4, powMul: 1.04, stamCut: 1, spdMul: 1.05 },
  { level: 5, name: "Master",       need: 560, perk: "+8% power, 2 less stamina",
    acc: 5, powMul: 1.08, stamCut: 2, spdMul: 1.05 },
];
const DISC_MASTERY_MAX = DISC_RANKS.length - 1;
const DISC_RANK_COLORS = ["#6b7280", "#c9c4bb", "#5aa860", "#3a8ae0", "#8b5cf6", "#d8b64a"];

const DISC_CONFIG = {
  /* --- what one fight is worth, per art --- */
  perUse: 2,              // each recorded technique of that art
  useCap: 7,              // uses counted per art per fight: spamming one
                          // technique is not training, so the base tops
                          // out at 14 and the flat awards carry the rest
  win: 5,                 // per art you actually used, on a win
  loss: 2,                // and on a loss, because nothing is lost on a defeat
  boss: 4,                // a won boss fight sharpens whatever won it
  finish: 3,              // the art that landed the finishing blow
  xpMax: 9999,            // a save can never carry an unbounded number

  /* --- the draft hook ---
     draft.js shades every offer by a handful of multipliers: ownMul 2.6,
     the invested ladder up to 3.4, gapMul 1.35, doorMul 2.2. This one sits
     in the same slot and is capped just under doorMul, the largest single
     shade already in that file - a mastered art is at most as loud as a
     door into a range you cannot reach. It composes multiplicatively with
     the rest, which is fine and is why the cap is where it is: draft.js
     documents that pool composition, not weight size, decides the offer
     mix (2.6 -> 9 on ownMul moved home picks 36% -> 42%). */
  draftStep: 0.20,        // per rank: level 5 lands exactly on 2.00
};

/* The arts, read at call time so this file does not care where it lands in
   MODULE_ORDER and picks up a twentieth discipline for free. Techniques
   with no discipline - the shared fundamentals - are deliberately absent:
   everyone owns them, so they would climb uniformly for every player and
   mean nothing. Same reasoning that keeps `shift` footwork out of
   draftRanges(). */
function discMasteryIds() {
  if (typeof DISCIPLINES === "undefined" || !DISCIPLINES) return [];
  return Object.keys(DISCIPLINES);
}
const discIsArt = (id) => typeof DISCIPLINES !== "undefined" && !!DISCIPLINES && !!DISCIPLINES[id];
const discXpNum = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.floor(v) : 0);

/* ---------------- reading the save ---------------- */
const discMasteryXp = (save, disc) => discXpNum(((save && save.discMastery) || {})[disc]);
function discMasteryRank(xp) {
  const n = discXpNum(xp);
  let r = DISC_RANKS[0];
  for (const d of DISC_RANKS) if (n >= d.need) r = d;
  return r;
}
const discMasteryLevel = (save, disc) => discMasteryRank(discMasteryXp(save, disc)).level;
function discMasteryProgress(xp) {
  const r = discMasteryRank(xp);
  if (r.level >= DISC_MASTERY_MAX) return 1;
  const next = DISC_RANKS[r.level + 1];
  return Math.max(0, Math.min(1, (discXpNum(xp) - r.need) / (next.need - r.need)));
}
function discMasteryToNext(xp) {
  const r = discMasteryRank(xp);
  return r.level >= DISC_MASTERY_MAX ? 0 : DISC_RANKS[r.level + 1].need - discXpNum(xp);
}

/* The save-block sanitiser. sanitizeSavePayload() whitelists the keys it knows
   and delegates this one straight to here, so import, cloud pull and cloud push
   all preserve it. Total: anything at all comes out a clean {art: xp} map with
   no ghost arts, no prototype keys and nothing above the ceiling. */
function discMasteryNormalize(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  discMasteryIds().forEach((id) => {
    if (!Object.prototype.hasOwnProperty.call(raw, id)) return;
    const xp = Math.min(DISC_CONFIG.xpMax, discXpNum(raw[id]));
    if (xp > 0) out[id] = xp;
  });
  return out;
}

/* ---------------- what a fight used ----------------
   One normaliser, because the caller should never have to know which shape
   the battle layer happens to hand over. Accepts a list of technique ids,
   a list of technique objects, a {techId: count} map, or a {disc: count}
   map - anything that is not a real art is dropped rather than guessed at.
   d.stats.discs is declared in newDuelStats() and never written to by the
   battle layer, so the count has to come from somewhere the caller owns:
   ev.tech at the moment a technique resolves. */
function discKeyToId(key) {
  if (!key) return null;
  if (typeof key === "object") return discKeyToId(key.disc || key.id || null);
  if (discIsArt(key)) return key;
  if (typeof TECH !== "undefined" && TECH && TECH[key] && discIsArt(TECH[key].disc)) return TECH[key].disc;
  return null;
}
function discTally(used) {
  const out = {};
  const bump = (key, n) => {
    const id = discKeyToId(key);
    if (!id || n <= 0) return;
    out[id] = (out[id] || 0) + n;
  };
  if (Array.isArray(used)) used.forEach((k) => bump(k, 1));
  else if (used && typeof used === "object") for (const k in used) bump(k, discXpNum(used[k]));
  return out;
}
/* Adds one use to a tally in place and returns it, so a caller can count as
   the fight happens instead of keeping a list. Total: an unknown id or a
   technique with no art is a no-op. */
function discNoteUse(tally, key, n) {
  const t = tally && typeof tally === "object" ? tally : {};
  const id = discKeyToId(key);
  const add = n === undefined ? 1 : discXpNum(n);
  if (id && add > 0) t[id] = (t[id] || 0) + add;
  return t;
}

/* what one art earns from one fight */
function discMasteryFor(uses, result) {
  const r = result || {};
  const n = Math.min(DISC_CONFIG.useCap, discXpNum(uses));
  if (n <= 0) return 0;
  let xp = DISC_CONFIG.perUse * n;
  xp += r.win ? DISC_CONFIG.win : DISC_CONFIG.loss;
  if (r.win && r.boss) xp += DISC_CONFIG.boss;
  return xp;
}

/* ---------------- earning it ----------------
   Returns {total, gained, ranks, levelled}. `ranks` carries one row per art
   that earned anything, in DISCIPLINES order so the readout is stable, and
   every row is addressed by its `disc` id rather than by position.
   result.finishDisc is optional: pass the art of the technique that ended
   the fight and it takes a small bonus. */
function awardDiscMastery(save, used, result) {
  if (!save) return { total: 0, gained: {}, ranks: [], levelled: [] };
  if (!save.discMastery) save.discMastery = {};
  const r = result || {};
  const tally = discTally(used);
  const finish = r.win ? discKeyToId(r.finishDisc) : null;
  if (finish && !tally[finish]) tally[finish] = 1;

  const gained = {}, ranks = [], levelled = [];
  discMasteryIds().forEach((id) => {
    let xp = discMasteryFor(tally[id] || 0, r);
    if (finish === id && xp > 0) xp += DISC_CONFIG.finish;
    if (xp <= 0) return;
    const before = discMasteryXp(save, id);
    const after = Math.min(DISC_CONFIG.xpMax, before + xp);
    save.discMastery[id] = after;
    const from = discMasteryRank(before), to = discMasteryRank(after);
    const row = { disc: id, gained: after - before, from, to, levelled: to.level > from.level };
    gained[id] = row.gained;
    ranks.push(row);
    if (row.levelled) levelled.push(row);
  });
  let total = 0;
  ranks.forEach((row) => (total += row.gained));
  return { total, gained, ranks, levelled };
}

/* ---------------- the perks ----------------
   Four accessors instead of one applyDiscMastery(side), because these are
   per-TECHNIQUE and not per-fighter: a Muay Thai master hits harder with
   elbows and no harder with the jab they also happen to know. Each is
   total against a null save, a null technique and a technique with no art,
   and each returns the neutral value in those cases. */
function discPerks(save, disc) {
  return DISC_RANKS[discMasteryLevel(save, discKeyToId(disc))] || DISC_RANKS[0];
}
const discAccBonus  = (save, tech) => discPerks(save, tech).acc;
const discPowerMul  = (save, tech) => discPerks(save, tech).powMul;
const discStamCut   = (save, tech) => discPerks(save, tech).stamCut;
const discSpeedMul  = (save, tech) => discPerks(save, tech).spdMul;

/* ---------------- the draft hook ----------------
   Handed to draft.js without draft.js having to know this file exists: it
   already has `t.disc` in hand where it applies ownMul and crossMul, and
   this is one more multiplier in that same expression. Exactly 1 for an
   unmastered art, so a fresh save drafts precisely as it does today. */
function discDraftMul(save, disc) {
  const id = discKeyToId(disc);
  if (!id) return 1;
  return 1 + DISC_CONFIG.draftStep * discMasteryLevel(save, id);
}

/* ---------------- readouts ----------------
   One row per art, best first, each addressed by id. Rows are data: the
   caller decides what to draw and how many to show. */
function discMasteryRows(save) {
  return discMasteryIds().map((id) => {
    const xp = discMasteryXp(save, id);
    const rank = discMasteryRank(xp);
    const d = DISCIPLINES[id];
    return {
      disc: id, name: (d && d.name) || id, color: (d && d.color) || DISC_RANK_COLORS[0],
      xp, rank: rank.name, level: rank.level, perk: rank.perk,
      progress: discMasteryProgress(xp), toNext: discMasteryToNext(xp),
      draftMul: discDraftMul(save, id),
    };
  }).sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
}
function discMasterySummary(save) {
  const rows = discMasteryRows(save).filter((r) => r.xp > 0);
  if (!rows.length) return "NO ART TRAINED YET";
  const top = rows.slice(0, 3).map((r) => r.name.toUpperCase() + " " + r.rank.toUpperCase());
  return rows.length + " ART" + (rows.length === 1 ? "" : "S") + " TRAINED - " + top.join(", ");
}
