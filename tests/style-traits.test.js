/* =====================================================================
   Aqua Zero Heavens Arena - style traits
   Luminara Digital

   Shot-selection biases derived from the dossier, so a Muay Thai man
   hunts the leg and a boxer hunts the body without anyone authoring a
   table. Two places a player notices it: the AI's choice of technique
   (a leg kicker throws low kicks, a cage specialist steps up on the
   ropes) and the hit itself (a body hunter's liver shot drains three
   extra stamina, a knockout artist's head shot lands a little heavier).
   Both are pinned here, on synthetic sides for the arithmetic and on a
   real duel for the wiring.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;
  const T = A.STYLE_TRAITS;

  section("eight traits");
  {
    ok(A.STYLE_TRAIT_IDS.length === 8 && A.STYLE_TRAIT_IDS.every((id) => T[id].id === id && !!T[id].name && !!T[id].note),
       "eight named traits, each with a note", A.STYLE_TRAIT_IDS.join(","));
    ok(A.styleTraitDefs(["leg_kicker", "nonsense", "body_hunter"]).map((t) => t.id).join(",") === "leg_kicker,body_hunter",
       "looking traits up drops the ones that do not exist and keeps the order");
    ok(A.styleTraitDefs(null).length === 0, "and nothing is nothing");
  }

  section("who has what");
  {
    // spot checks against the dossier rather than a copy of the eligibility
    // table: a copy would pass whenever both copies agreed
    const n = A.FIGHTERS.length;
    const legArts = ["muaythai", "lethwei", "kickboxing"];
    let shape = true, stable = true, twoSeen = false, boxerLegKicker = false, boxers = 0;
    for (let i = 0; i < n; i++) {
      const tr = A.styleTraitsOf(i), d = A.disciplinesOf(i);
      if (tr.length < 1 || tr.length > 2 || new Set(tr).size !== tr.length || !tr.every((id) => !!T[id])) shape = false;
      if (A.styleTraitsOf(i).join() !== tr.join()) stable = false;
      if (tr.length === 2) twoSeen = true;
      if (d.indexOf("boxing") >= 0 && !d.some((a) => legArts.indexOf(a) >= 0)) {
        boxers++;
        if (tr.indexOf("leg_kicker") >= 0) boxerLegKicker = true;
      }
    }
    ok(shape, "every fighter has one or two real, distinct traits");
    ok(stable && twoSeen, "the same fighter always gets the same traits, and some carry two");
    ok(boxers > 0 && !boxerLegKicker, "no boxer without a kicking art is ever a leg kicker", boxers + " boxers checked");
    const wr = A.FIGHTERS.map((f, i) => i).find((i) => A.disciplinesOf(i).join() === "wrestling");
    ok(wr !== undefined && A.styleTraitsOf(wr).join() === "pressure_fighter", "a pure wrestler is a pressure fighter and nothing else",
       wr + ":" + A.styleTraitsOf(wr).join());
    const kb = A.FIGHTERS.map((f, i) => i).find((i) => A.disciplinesOf(i).join() === "kickboxing");
    ok(kb !== undefined && A.styleTraitsOf(kb).join() === "leg_kicker", "a pure kickboxer is a leg kicker and nothing else",
       kb + ":" + A.styleTraitsOf(kb).join());
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    ok(A.G.duel.p.styleTraits.join() === A.styleTraitsOf(0).join() && A.G.duel.e.styleTraits.join() === A.styleTraitsOf(1).join(),
       "both sides walk into the duel carrying their traits");
  }

  section("traits fold into the AI's weights");
  {
    const base = { aggression: 1.1, closeIn: -14, ground: 0.4, sub: 0.4 };
    const w = A.applyStyleTraitWeights(base, ["counter_specialist", "pressure_fighter", "submission_ace", "knockout_artist"]);
    ok(base.counterBonus === undefined && base.closeIn === -14, "the caller's weights are not touched");
    ok(w.counterBonus === 10, "a counter specialist earns 10 for answering a whiff", w.counterBonus);
    ok(w.closeIn === -8, "a pressure fighter wants to close 6 more than his archetype does", w.closeIn);
    ok(Math.abs(w.sub - 0.48) < 1e-9 && Math.abs(w.ground - 0.44) < 1e-9, "a submission ace values subs 20% and the mat 10% more");
    ok(Math.abs(w.aggression - 1.1 * 1.08) < 1e-9, "a knockout artist is 8% more aggressive");
    ok(JSON.stringify(A.applyStyleTraitWeights(base, ["leg_kicker", "nope"])) === JSON.stringify(base),
       "traits with no weight hook, and traits that do not exist, leave the weights alone");
    ok(A.applyStyleTraitWeights(undefined, ["counter_specialist"]).counterBonus === 10, "and no weights at all is a fresh sheet");
  }

  section("traits steer the shot");
  {
    const d = { pos: "CENTRE", range: "LONG" };
    const me = (traits) => ({ styleTraits: traits });
    ok(A.styleTraitScore(d, null, {}, A.TECH.jab) === 0 && A.styleTraitScore(d, me(["leg_kicker"]), {}, null) === 0 &&
       A.styleTraitScore(d, me([]), {}, A.TECH.jab) === 0, "no side, no technique or no traits scores nothing");
    const lk = me(["leg_kicker"]);
    ok(A.styleTraitScore(d, lk, {}, A.TECH.mt_low_kick) > A.styleTraitScore(d, lk, {}, A.TECH.jab) &&
       A.styleTraitScore(d, lk, {}, A.TECH.jab) === 0,
       "a leg kicker reaches for the low kick over the jab", A.styleTraitScore(d, lk, {}, A.TECH.mt_low_kick));
    const bh = me(["body_hunter"]);
    ok(A.styleTraitScore(d, bh, {}, A.TECH.liver_shot) > 0 && A.styleTraitScore(d, bh, {}, A.TECH.jab) === 0,
       "a body hunter reaches for the liver shot");
    const ko = me(["knockout_artist"]);
    ok(A.styleTraitScore(d, ko, {}, A.TECH.jab) > 0 && A.styleTraitScore(d, ko, {}, A.TECH.liver_shot) === 0,
       "a knockout artist reaches for the head");
    const cs = me(["cage_specialist"]);
    ok(A.styleTraitScore({ pos: "CENTRE" }, cs, {}, A.TECH.cross) === 0 &&
       A.styleTraitScore({ pos: "ROPES" }, cs, {}, A.TECH.cross) > 0 &&
       A.styleTraitScore({ pos: "CORNER" }, cs, {}, A.TECH.cross) > 0,
       "a cage specialist only lights up on the ropes or in the corner");
    const pf = me(["pressure_fighter"]);
    ok(A.styleTraitScore(d, pf, {}, A.TECH.ring_cut) === T.pressure_fighter.shoveBonus, "a pressure fighter rates the shove");
    const sa = me(["scramble_artist"]);
    ok(A.styleTraitScore(d, sa, {}, A.TECH.ring_reversal) === T.scramble_artist.reverseBonus &&
       A.styleTraitScore(d, sa, {}, A.TECH.scramble) > 0,
       "a scramble artist rates the reversal and the escape");
    const sub = me(["submission_ace"]);
    ok(A.styleTraitScore(d, sub, {}, A.TECH.kesa_gatame) === 5 && A.styleTraitScore(d, sub, {}, A.TECH.cross) === 0,
       "a submission ace rates the submission and not the punch");
  }
  {
    // through the real chooser: same duel, same dice, trait on and off
    exec("startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5}); beginRound(G.duel);");
    const d = A.G.duel;
    d.range = "LONG";
    d.e.styleTraits = [];
    const cold = A.scoreTechnique(d, d.e, d.p, A.TECH.mt_low_kick, 0, () => 0.5);
    d.e.styleTraits = ["leg_kicker"];
    const hot = A.scoreTechnique(d, d.e, d.p, A.TECH.mt_low_kick, 0, () => 0.5);
    ok(hot > cold, "the AI's own scorer rates the low kick higher for a leg kicker", cold.toFixed(1) + " -> " + hot.toFixed(1));
  }

  section("traits land on the hit");
  {
    const bh = { styleTraits: ["body_hunter"] };
    const miss = { hit: false, dmg: 30 };
    const foe = { stam: 50 };
    A.applyStyleTraitOnHit(bh, foe, A.TECH.liver_shot, miss);
    ok(foe.stam === 50 && miss.dmg === 30 && miss.traitStamDrain === undefined, "a miss does nothing");
    const hit = { hit: true, dmg: 30 };
    A.applyStyleTraitOnHit(bh, foe, A.TECH.liver_shot, hit);
    ok(foe.stam === 47 && hit.traitStamDrain === 3, "a body hunter's liver shot takes three extra stamina", foe.stam);
    ok(hit.dmg === 30 + Math.round(30 * 0.25 * 0.35) && hit.traitZoneBonus === hit.dmg - 30,
       "and lands a little heavier to the body", 30 + " -> " + hit.dmg);
    const head = { hit: true, dmg: 30 };
    const foe2 = { stam: 50 };
    A.applyStyleTraitOnHit(bh, foe2, A.TECH.jab, head);
    ok(foe2.stam === 50 && head.dmg === 30, "his jab to the head is just a jab");
    const empty = { stam: 1 };
    A.applyStyleTraitOnHit(bh, empty, A.TECH.liver_shot, { hit: true, dmg: 10 });
    ok(empty.stam === 0, "the tank never goes negative");
    const ko = { styleTraits: ["knockout_artist"] };
    const hs = { hit: true, dmg: 40 };
    A.applyStyleTraitOnHit(ko, { stam: 50 }, A.TECH.jab, hs);
    ok(hs.dmg === 42 && hs.traitZoneBonus === 2, "a knockout artist's head shot is 40 -> 42", hs.dmg);
    const lk = { styleTraits: ["leg_kicker"] };
    const lkEv = { hit: true, dmg: 40 };
    A.applyStyleTraitOnHit(lk, { stam: 50 }, A.TECH.mt_low_kick, lkEv);
    ok(lkEv.dmg === 44, "a leg kicker's low kick is 40 -> 44", lkEv.dmg);
    const routed = { hit: true, dmg: 40, targetZone: "body" };
    A.applyStyleTraitOnHit(lk, { stam: 50 }, A.TECH.mt_low_kick, routed);
    ok(routed.dmg === 40, "the hit's own target zone wins over the technique's default");
    const tiny = { hit: true, dmg: 2 };
    A.applyStyleTraitOnHit(ko, { stam: 50 }, A.TECH.jab, tiny);
    ok(tiny.dmg === 2 && tiny.traitZoneBonus === undefined, "a glancing shot gets no bonus rather than a rounding crumb");
  }
  {
    // on a real duel: the resolver calls the hook and the stamina drain shows
    exec("startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5}); beginRound(G.duel);");
    const d = A.G.duel;
    d.range = "MID";
    d.p.styleTraits = ["body_hunter"];
    const stam0 = d.e.stam;
    const ev = A.executeTechnique(d, d.p, d.e, A.TECH.liver_shot, null, () => 0.5);
    ok(ev.hit && ev.traitStamDrain === 3 && d.e.stam <= stam0 - 3,
       "a body hunter's landed liver shot drains the extra three in a live fight", stam0 + " -> " + d.e.stam);
  }
};
