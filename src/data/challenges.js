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
   ===================================================================== */
const CHALLENGES = [];
function C(id, title, name, desc, test) { CHALLENGES.push({ id, title, name, desc, test }); }

/* st = { win, perfect, turns, dmgDealt, dmgTaken, hpLeft, subs, throws, strikes,
         guards, ranges:{}, discs:{}, conds:{}, sigHits, comboMax, koRange,
         koClass, boss, ranked, forfeit, opponentRankIndex, myRankIndex } */

/* --- the fundamentals --- */
C("first_blood", "Debutant", "First Blood", "Win your first fight.", (st) => st.win);
C("untouched", "Untouchable", "Untouched", "Win without taking a single point of damage.",
  (st) => st.win && st.dmgTaken === 0);
C("quick_work", "Quick Work", "Inside The Distance", "Win in four turns or fewer.",
  (st) => st.win && st.turns <= 4);
C("comeback", "Never Out", "Comeback", "Win a fight after dropping below 15% health.",
  (st) => st.win && st.lowest <= 0.15);

/* --- the ground game --- */
C("tap_them", "Ippon Artist", "Tap Them Out", "Finish a fight with a submission.",
  (st) => st.win && st.koClass === "SUB");
C("mat_master", "Mat Master", "Ground Control", "Win a fight spending most of it on the ground.",
  (st) => st.win && (st.ranges.GROUND || 0) > st.turns / 2);
C("sub_hunter", "Sub Hunter", "Sub Hunter", "Land three submissions in one fight.",
  (st) => (st.subs || 0) >= 3);
C("throw_artist", "Throw Artist", "Nage-Waza", "Land four throws or takedowns in one fight.",
  (st) => (st.throws || 0) >= 4);

/* --- the stand-up --- */
C("striker", "Striker", "Pure Striking", "Win a fight without a single grapple.",
  (st) => st.win && (st.throws || 0) === 0 && (st.subs || 0) === 0);
C("head_kick_ko", "Highlight Reel", "Highlight Reel", "Finish a fight with a strike from kicking range.",
  (st) => st.win && st.koClass === "STRIKE" && st.koRange === "LONG");
C("clinch_war", "Clinch Fighter", "Clinch War", "Win a fight that spent most of its time in the clinch.",
  (st) => st.win && (st.ranges.CLINCH || 0) > st.turns / 2);
C("cutman", "Bloodletter", "Bloodletter", "Open a cut and win the fight it started.",
  (st) => st.win && (st.conds.BLEEDING || 0) > 0);

/* --- the system --- */
C("perfect_sig", "Signature Move", "Perfect Signature", "Land a signature hitting all three beats.",
  (st) => (st.sigPerfect || 0) > 0);
C("aerial", "Air Superiority", "Aerial Rave", "Complete a full three-hit air combo.",
  (st) => (st.comboMax || 0) >= 3);
C("perfect_guard", "Immovable", "Read And Guard", "Land three perfect guards in one fight.",
  (st) => (st.perfectGuards || 0) >= 3);
C("no_guard", "Reckless", "Nothing But Offence", "Win a fight without ever choosing guard.",
  (st) => st.win && (st.guards || 0) === 0);

/* --- the long game --- */
C("giant_killer", "Giant Killer", "Giant Killer", "Beat someone three grades above you on the ladder.",
  (st) => st.win && st.ranked && (st.opponentRankIndex - st.myRankIndex) >= 3);
C("champion", "Heavens Champion", "Take The Tower", "Beat the champion at the top of the tower.",
  (st) => st.win && st.boss);
C("polyglot", "Polyglot", "Many Roads", "Win with fighters from five different disciplines.",
  null);                                     // tracked across fights, see challengeSweep
C("dedicated", "Devoted", "Devoted", "Take one fighter to a black belt of mastery.", null);

const CHALLENGE_BY_ID = {};
CHALLENGES.forEach((c) => (CHALLENGE_BY_ID[c.id] = c));

/* fresh stat block for a fight */
function newDuelStats() {
  return { win: false, perfect: true, turns: 0, dmgDealt: 0, dmgTaken: 0, hpLeft: 0,
           lowest: 1, subs: 0, throws: 0, strikes: 0, guards: 0, sigPerfect: 0,
           perfectGuards: 0, comboMax: 0, koClass: null, koRange: null,
           ranges: {}, discs: {}, conds: {}, boss: false, ranked: false, forfeit: false,
           opponentRankIndex: 0, myRankIndex: 0 };
}
/* run every per-fight challenge; returns the ids newly earned */
function evaluateChallenges(save, st) {
  if (!save.titles) save.titles = [];
  const won = [];
  CHALLENGES.forEach((c) => {
    if (!c.test) return;
    if (save.titles.indexOf(c.id) >= 0) return;
    let ok = false;
    try { ok = !!c.test(st); } catch (e) { ok = false; }
    if (ok) { save.titles.push(c.id); won.push(c.id); }
  });
  return won;
}
/* the two that watch the whole save rather than one fight */
function challengeSweep(save) {
  if (!save.titles) save.titles = [];
  const won = [];
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
