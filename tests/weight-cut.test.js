/* =====================================================================
   Aqua Zero Heavens Arena - fight week on the scales
   Luminara Digital

   Three ways to make weight, each a trade the profile card states in
   plain numbers. This suite holds the card to its word on a real duel
   side: the brutal cut is +12% on early strikes, +4 reach and a head
   that takes 15% less, then a 20% stamina tax once turn 6 is behind
   you. The natural weight is the mirror. The disciplined cut changes
   nothing at all, which is the point of it.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;
  const X = (src) => A.exec(src);
  const P = A.WEIGHT_CUT_PROFILES;

  section("three profiles, three trades");
  {
    const ids = X("WEIGHT_CUT_IDS");
    ok(ids.join(",") === "CHAMPIONSHIP_CUT,DISCIPLINED_CUT,NATURAL_WEIGHT", "three ways to make weight", ids.join(","));
    ok(ids.every((id) => P[id].id === id && !!P[id].name && !!P[id].desc), "each is named and explained");
    ok(X("getWeightCutProfile('nonsense').id") === "DISCIPLINED_CUT" && X("getWeightCutProfile().id") === "DISCIPLINED_CUT",
       "an unknown or missing choice is the standard cut");
    const c = P.CHAMPIONSHIP_CUT, n = P.NATURAL_WEIGHT, d = P.DISCIPLINED_CUT;
    ok(/\+12% strike power/.test(c.desc) && c.earlyPowerBonus === 0.12 &&
       /\+4 reach/.test(c.desc) && c.reachBonus === 4 &&
       /-15% head HP/.test(c.desc) && Math.abs(c.headHealthMul - 0.85) < 1e-9,
       "the brutal cut's card matches its numbers");
    // the "+20% stun defense" line is held to its number here and to an
    // actual outcome in "the chin is a real number" below
    ok(/-8% power/.test(n.desc) && n.earlyPowerBonus === -0.08 &&
       /\+25% cardio recovery/.test(n.desc) && n.lateCardioPenalty === -0.25 &&
       /\+20% stun defense/.test(n.desc) && n.chinPenalty === -0.2,
       "the natural weight's card matches its numbers");
    ok(d.earlyPowerBonus === 0 && d.reachBonus === 0 && d.headHealthMul === 1 && d.lateCardioPenalty === 0 && d.chinPenalty === 0,
       "the disciplined cut is the zero point on every axis");
    ok(n.earlyPowerBonus < d.earlyPowerBonus && d.earlyPowerBonus < c.earlyPowerBonus &&
       c.headHealthMul < d.headHealthMul && d.headHealthMul < n.headHealthMul &&
       n.chinPenalty < d.chinPenalty && d.chinPenalty < c.chinPenalty,
       "no profile is strictly best: more power always costs chin");
  }

  const fresh = () => {
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5}); beginRound(G.duel);");
    const d = A.G.duel;
    d.range = "MID";
    return d;
  };

  section("the brutal cut on a real side");
  {
    ok(A.applyWeightCut(null, "CHAMPIONSHIP_CUT").ok === false, "no side, no cut");
    const d = fresh();
    const head0 = d.p.zones.head, body0 = d.p.zones.body;
    const r = A.applyWeightCut(d.p, "CHAMPIONSHIP_CUT");
    ok(r.ok === true && r.profile.id === "CHAMPIONSHIP_CUT" && d.p.weightProfile === "CHAMPIONSHIP_CUT",
       "the side remembers which cut it made");
    ok(d.p.reach === 72 + 4, "four inches of reach on top of the 72 default", d.p.reach);
    ok(d.p.zones.head === Math.round(head0 * 0.85) && d.p.zones.body === body0,
       "the head zone loses 15% and the body keeps every point", head0 + " -> " + d.p.zones.head);
    ok(d.p.weightPowerBonus === 0.12 && d.p.weightCardioMod === 0.2,
       "the power and cardio hooks are booked for the resolver (resolve.js and order.js read them)");
    ok(d.p.weightChinMod === 0.15, "the chin hook is recorded on the side");
    /* applyWeightCut used to ADD the reach bonus and re-multiply the head
       zone every call, so changing your mind on the profile screen was
       worth +8 inches and a head at 72%. */
    const headOnce = d.p.zones.head;
    A.applyWeightCut(d.p, "CHAMPIONSHIP_CUT");
    ok(d.p.reach === 76 && d.p.zones.head === headOnce,
       "and making the same cut twice is the same cut, not two of them",
       d.p.reach + " / " + d.p.zones.head);
    A.applyWeightCut(d.p, "DISCIPLINED_CUT");
    ok(d.p.reach === 72 && d.p.zones.head === Math.round(headOnce / 0.85),
       "while changing your mind puts the reach and the head back",
       d.p.reach + " / " + d.p.zones.head);
  }
  {
    // early power: same shot, same dice, one side cut hard
    const plain = fresh();
    const ev0 = A.executeTechnique(plain, plain.p, plain.e, A.TECH.cross, null, () => 0.5);
    const cut = fresh();
    A.applyWeightCut(cut.p, "CHAMPIONSHIP_CUT");
    const ev1 = A.executeTechnique(cut, cut.p, cut.e, A.TECH.cross, null, () => 0.5);
    ok(ev0.hit && ev1.hit && ev1.weightPower === true && ev1.dmg > ev0.dmg,
       "a brutal cut hits harder in the early going", ev0.dmg + " -> " + ev1.dmg);
    const late = fresh();
    A.applyWeightCut(late.p, "CHAMPIONSHIP_CUT");
    late.turn = 7;
    const ev2 = A.executeTechnique(late, late.p, late.e, A.TECH.cross, null, () => 0.5);
    ok(ev2.hit && !ev2.weightPower, "and the power bonus is gone from turn 7");
  }
  {
    // late cardio: the tax lands after turn 6, not on it
    const d = fresh();
    A.applyWeightCut(d.p, "CHAMPIONSHIP_CUT");
    d.turn = 6;
    const on6 = A.staminaCost(d.p, A.TECH.cross, d);
    d.turn = 7;
    const on7 = A.staminaCost(d.p, A.TECH.cross, d);
    d.p.weightCardioMod = 0;
    const base7 = A.staminaCost(d.p, A.TECH.cross, d);
    ok(on6 === base7, "on turn 6 the cross costs what it always costs", on6);
    // the base is rounded before we can read it, so bound the taxed cost
    // by a fifth on either side of that rounding rather than pin it
    ok(on7 > on6 && on7 >= Math.floor((on6 - 0.5) * 1.2) && on7 <= Math.ceil((on6 + 0.5) * 1.2),
       "on turn 7 it costs a fifth more", on6 + " -> " + on7);
  }

  section("the natural weight is the mirror");
  {
    const d = fresh();
    const head0 = d.p.zones.head;
    A.applyWeightCut(d.p, "NATURAL_WEIGHT");
    ok(d.p.zones.head === Math.round(head0 * 1.15), "a full tank puts 15% on the head", head0 + " -> " + d.p.zones.head);
    ok(d.p.reach === undefined, "and adds no reach");
    d.turn = 7;
    const nat7 = A.staminaCost(d.p, A.TECH.cross, d);
    d.p.weightCardioMod = 0;
    const base7 = A.staminaCost(d.p, A.TECH.cross, d);
    ok(nat7 < base7, "late in the fight the cross costs less air", base7 + " -> " + nat7);
    const plain = fresh();
    const ev0 = A.executeTechnique(plain, plain.p, plain.e, A.TECH.cross, null, () => 0.5);
    const nat = fresh();
    A.applyWeightCut(nat.p, "NATURAL_WEIGHT");
    const ev1 = A.executeTechnique(nat, nat.p, nat.e, A.TECH.cross, null, () => 0.5);
    ok(ev0.hit && ev1.hit && ev1.dmg < ev0.dmg, "and the early shots land softer", ev0.dmg + " -> " + ev1.dmg);
  }

  section("the chin is a real number");
  {
    /* weightChinMod used to be written and read nowhere, so both halves of
       the trade the profile card sells - "compromised chin" on the brutal
       cut, "+20% stun defense" at natural weight - were text only.
       resolve.js's chinFactor() now reads it in the two places the chin
       decides anything: how big a shot has to be to rock you, and whether
       a stunning technique's effect takes. */
    const walkAround = fresh(), brutal = fresh(), standard = fresh();
    A.applyWeightCut(walkAround.p, "NATURAL_WEIGHT");
    A.applyWeightCut(brutal.p, "CHAMPIONSHIP_CUT");
    A.applyWeightCut(standard.p, "DISCIPLINED_CUT");
    ok(A.chinFactor(standard.p) === 1, "the standard cut is the zero point", A.chinFactor(standard.p));
    ok(A.chinFactor(walkAround.p) < 1 && A.chinFactor(brutal.p) > 1,
       "a full tank takes a better shot to hurt, a drained one takes less",
       A.chinFactor(walkAround.p).toFixed(2) + " vs " + A.chinFactor(brutal.p).toFixed(2));
    const soft = A.rockThreshold(walkAround.p), hard = A.rockThreshold(brutal.p);
    ok(soft > A.rockThreshold(standard.p) && hard < A.rockThreshold(standard.p),
       "so it takes more to rock the natural weight and less to rock the cut man",
       hard.toFixed(1) + " < " + A.rockThreshold(standard.p).toFixed(1) + " < " + soft.toFixed(1));
    /* the outcome a player feels: the same head kick, the same dice, and
       only the drained man goes over. A roll just inside the technique's
       own stun chance takes on a compromised chin and fails on a granite
       one - the card's twenty percent, in a fight. */
    const ch = A.TECH.mt_head_kick.eff.ch;
    const roll = () => (ch + 0.5) / 100;
    const hitWith = (d) => A.executeTechnique(d, d.e, d.p, A.TECH.mt_head_kick, null, roll);
    hitWith(brutal); hitWith(walkAround);
    ok(A.hasStatus(brutal.p, "STUNNED") && !A.hasStatus(walkAround.p, "STUNNED"),
       "same shot, same dice: the cut man is stunned and the natural weight is not");
  }

  section("the disciplined cut changes nothing");
  {
    const d = fresh();
    const before = JSON.stringify({ z: d.p.zones, r: d.p.reach, s: d.p.stam });
    A.applyWeightCut(d.p, "DISCIPLINED_CUT");
    ok(JSON.stringify({ z: d.p.zones, r: d.p.reach, s: d.p.stam }) === before,
       "zones, reach and stamina are exactly as they were");
    d.turn = 9;
    const disc9 = A.staminaCost(d.p, A.TECH.cross, d);
    d.p.weightCardioMod = 0;
    ok(disc9 === A.staminaCost(d.p, A.TECH.cross, d), "and turn 9 costs no more than it should");
    const bare = {};
    ok(A.applyWeightCut(bare, "CHAMPIONSHIP_CUT").ok && bare.reach === 76 && bare.zones === undefined,
       "a side with no zone model still gets the reach and does not throw");
  }
};
