/* =====================================================================
   Aqua Zero Heavens Arena - challenges and titles
   Luminara Digital

   Optional objectives that teach the game rather than count grind. Every
   one of these is a sentence about how to fight - "finish it on the mat",
   "win without leaving the clinch" - so chasing them pushes you into
   parts of the system you would otherwise skip.

   The reward is a TITLE and nothing else. No stat, no unlock, no power.
   That is deliberate: an achievement that pays out power quietly becomes
   the reason you play, and the fight stops being the point.

   Each challenge tests the stat block a finished fight leaves behind
   (see duelStats), so nothing has to be special-cased in the fight code.

   WEIGHT AND TIER. A first patrol fight - one committed exchange against
   a 50 HP silhouette - used to hand out six titles at once: Debutant,
   Untouchable, Quick Work, Striker, Highlight Reel, Reckless. Every one
   of them was technically true and none of them was earned. So each
   title now carries the lightest encounter it can be won on (patrol /
   rival / boss) and a rarity tier, and a patrol can award at most ONE
   title, from the "first steps" set - the titles whose weight is
   `patrol`. That set is Debutant. Everything else waits for a real bout.
   ===================================================================== */
const ENCOUNTER_WEIGHTS = ["patrol", "rival", "boss"];
const ENCOUNTER_RANK = { patrol: 0, rival: 1, boss: 2 };
const TITLE_TIERS = ["common", "rare", "epic"];
/* titles a single result may award, by the weight of the fight */
const TITLE_CAP = { patrol: 1, rival: Infinity, boss: Infinity };
const CHALLENGES = [];
function C(id, title, name, desc, test, meta) {
  const m = meta || {};
  CHALLENGES.push({
    id, title, name, desc, test,
    weight: ENCOUNTER_RANK[m.weight] !== undefined ? m.weight : "rival",
    tier: TITLE_TIERS.indexOf(m.tier) >= 0 ? m.tier : "common",
  });
}

/* st = { win, perfect, turns, dmgDealt, dmgTaken, hpLeft, subs, throws, strikes,
         guards, ranges:{}, discs:{}, conds:{}, sigHits, comboMax, koRange,
         koClass, boss, ranked, forfeit, opponentRankIndex, myRankIndex } */

/* --- the fundamentals --- */
C("first_blood", "Debutant", "First Blood", "Win your first fight.", (st) => st.win,
  { weight: "patrol", tier: "common" });
C("untouched", "Untouchable", "Untouched", "Win without taking a single point of damage.",
  (st) => st.win && st.dmgTaken === 0, { tier: "rare" });
C("quick_work", "Quick Work", "Inside The Distance", "Win in four turns or fewer.",
  (st) => st.win && st.turns <= 4);
C("comeback", "Never Out", "Comeback", "Win a fight after dropping below 15% health.",
  (st) => st.win && st.lowest <= 0.15, { tier: "rare" });

/* --- the ground game --- */
C("tap_them", "Ippon Artist", "Tap Them Out", "Finish a fight with a submission.",
  (st) => st.win && st.koClass === "SUB", { tier: "rare" });
C("mat_master", "Mat Master", "Ground Control", "Win a fight spending most of it on the ground.",
  (st) => st.win && (st.ranges.GROUND || 0) > st.turns / 2);
C("sub_hunter", "Sub Hunter", "Sub Hunter", "Land three submissions in one fight.",
  (st) => (st.subs || 0) >= 3, { tier: "rare" });
C("throw_artist", "Throw Artist", "Nage-Waza", "Land four throws or takedowns in one fight.",
  (st) => (st.throws || 0) >= 4, { tier: "rare" });

/* --- the stand-up --- */
C("striker", "Striker", "Pure Striking", "Win a fight without a single grapple.",
  (st) => st.win && (st.throws || 0) === 0 && (st.subs || 0) === 0);
C("head_kick_ko", "Highlight Reel", "Highlight Reel", "Finish a fight with a strike from kicking range.",
  (st) => st.win && st.koClass === "STRIKE" && st.koRange === "LONG", { tier: "rare" });
C("clinch_war", "Clinch Fighter", "Clinch War", "Win a fight that spent most of its time in the clinch.",
  (st) => st.win && (st.ranges.CLINCH || 0) > st.turns / 2);
C("cutman", "Bloodletter", "Bloodletter", "Open a cut and win the fight it started.",
  (st) => st.win && (st.conds.BLEEDING || 0) > 0, { tier: "rare" });

/* --- the system --- */
C("perfect_sig", "Signature Move", "Perfect Signature", "Land a signature hitting all three beats.",
  (st) => (st.sigPerfect || 0) > 0, { tier: "rare" });
C("aerial", "Air Superiority", "Aerial Rave", "Complete a full three-hit air combo.",
  (st) => (st.comboMax || 0) >= 3, { tier: "rare" });
C("perfect_guard", "Immovable", "Read And Guard", "Land three perfect guards in one fight.",
  (st) => (st.perfectGuards || 0) >= 3, { tier: "rare" });
C("no_guard", "Reckless", "Nothing But Offence", "Win a fight without ever choosing guard.",
  (st) => st.win && (st.guards || 0) === 0);

/* --- the long game --- */
C("giant_killer", "Giant Killer", "Giant Killer", "Beat someone three grades above you on the ladder.",
  (st) => st.win && st.ranked && (st.opponentRankIndex - st.myRankIndex) >= 3, { tier: "epic" });
C("champion", "Heavens Champion", "Take The Tower", "Beat the champion at the top of the tower.",
  (st) => st.win && st.boss, { weight: "boss", tier: "epic" });
C("polyglot", "Polyglot", "Many Roads", "Win with fighters from five different disciplines.",
  null, { tier: "rare" });                   // tracked across fights, see challengeSweep
C("dedicated", "Devoted", "Devoted", "Take one fighter to a black belt of mastery.", null,
  { tier: "epic" });

const CHALLENGE_BY_ID = {};
CHALLENGES.forEach((c) => (CHALLENGE_BY_ID[c.id] = c));

/* the weight a result was fought at, normalised - anything unknown is a
   full bout, so an older caller that never says loses nothing */
function encounterOf(opts) {
  const w = opts && opts.encounter;
  return ENCOUNTER_RANK[w] !== undefined ? w : "rival";
}
/* can this title be won on a fight of this weight */
function titleEligible(c, encounter) {
  if (!c) return false;
  return ENCOUNTER_RANK[encounterOf({ encounter })] >= ENCOUNTER_RANK[c.weight || "rival"];
}
/* the "first steps" set - what a patrol is allowed to hand out */
function patrolTitles() {
  return CHALLENGES.filter((c) => c.weight === "patrol").map((c) => c.id);
}
const tierOf = (id) => (CHALLENGE_BY_ID[id] ? CHALLENGE_BY_ID[id].tier : null);
const weightOf = (id) => (CHALLENGE_BY_ID[id] ? CHALLENGE_BY_ID[id].weight : null);

/* fresh stat block for a fight */
function newDuelStats() {
  return { win: false, perfect: true, turns: 0, dmgDealt: 0, dmgTaken: 0, hpLeft: 0,
           lowest: 1, subs: 0, throws: 0, strikes: 0, guards: 0, sigPerfect: 0,
           perfectGuards: 0, comboMax: 0, koClass: null, koRange: null,
           ranges: {}, discs: {}, conds: {}, boss: false, ranked: false, forfeit: false,
           opponentRankIndex: 0, myRankIndex: 0,
           zonesDealt: { head: 0, body: 0, legs: 0 },
           cutDealt: 0, controlSeconds: 0 };
}
/* run every per-fight challenge; returns the ids newly earned.
   opts.encounter is the fight's weight (patrol / rival / boss). A title
   too heavy for the fight is skipped, not consumed - it is still open the
   next time a real bout meets its terms - and a patrol stops after one. */
function evaluateChallenges(save, st, opts) {
  if (!save.titles) save.titles = [];
  const encounter = encounterOf(opts);
  const cap = TITLE_CAP[encounter] !== undefined ? TITLE_CAP[encounter] : Infinity;
  const won = [];
  CHALLENGES.forEach((c) => {
    if (!c.test) return;
    if (won.length >= cap) return;
    if (!titleEligible(c, encounter)) return;
    if (save.titles.indexOf(c.id) >= 0) return;
    let ok = false;
    try { ok = !!c.test(st); } catch (e) { ok = false; }
    if (ok) { save.titles.push(c.id); won.push(c.id); }
  });
  return won;
}
/* the two that watch the whole save rather than one fight. They are
   rival-weight titles, so a patrol defers them to the next real bout. */
function challengeSweep(save, opts) {
  if (!save.titles) save.titles = [];
  const won = [];
  if (ENCOUNTER_RANK[encounterOf(opts)] < ENCOUNTER_RANK.rival) return won;
  const add = (id) => { if (save.titles.indexOf(id) < 0) { save.titles.push(id); won.push(id); } };
  const discs = {};
  Object.keys(save.fr || {}).forEach((fid) => {
    if ((save.fr[fid].w || 0) > 0) disciplinesOf(+fid).forEach((d) => (discs[d] = 1));
  });
  if (Object.keys(discs).length >= 5) add("polyglot");
  const m = save.mastery || {};
  if (Object.keys(m).some((fid) => masteryRank(m[fid]).level >= MASTERY_MAX)) add("dedicated");
  return won;
}
const titleOf = (id) => (CHALLENGE_BY_ID[id] ? CHALLENGE_BY_ID[id].title : null);
/* the title you are wearing - the most recently earned, unless you picked one */
function activeTitle(save) {
  if (save.title && (save.titles || []).indexOf(save.title) >= 0) return titleOf(save.title);
  const t = save.titles || [];
  return t.length ? titleOf(t[t.length - 1]) : null;
}
