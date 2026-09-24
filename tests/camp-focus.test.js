/* =====================================================================
   Aqua Zero Heavens Arena - camp focus
   Luminara Digital

   One pick before the bell, modest, readable, never fight-winning on
   its own. The player sees a pitch line on the menu and a number in the
   fight: striking is +8% and +3 accuracy, conditioning is a 12% lighter
   stamina bill and 8 more in the tank, a hard camp turns those up by a
   fifth and breaks arms 12% of the time. The workload dice are driven
   by hand here so the injury branch is proven, not sampled.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;
  const F = A.CAMP_FOCI, W = A.CAMP_WORKLOADS;
  const safe = () => 0.99;   // never rolls the injury
  const side = (extra) => Object.assign({ atkMul: 1, stamMul: 1, maxStam: 84, stam: 84 }, extra || {});

  section("the menu");
  {
    ok(A.CAMP_FOCUS_IDS.length === 6 && A.CAMP_FOCUS_IDS.every((id) => F[id].id === id),
       "six foci to pick from", A.CAMP_FOCUS_IDS.join(","));
    ok(A.CAMP_WORKLOAD_IDS.join(",") === "light,standard,hard" && W.light.mul < W.standard.mul && W.standard.mul < W.hard.mul &&
       W.light.injuryRisk < W.standard.injuryRisk && W.standard.injuryRisk < W.hard.injuryRisk,
       "three workloads: the harder the camp, the more it gives and the more it breaks");
    const choices = A.campFocusChoices();
    ok(choices.length === 6 && choices.every((c) => c.id && c.name && c.tag && c.blurb),
       "the menu shows a name, a tag and a pitch for every focus");
    ok(choices.every((c) => Object.keys(c).sort().join(",") === "blurb,id,name,tag"),
       "and only those - the math stays off the menu");
    ok(A.campFocusOf("striking") === F.striking && A.campFocusOf("yoga") === null, "a focus is looked up by id, or not at all");
    ok(A.campWorkloadOf("hard") === W.hard && A.campWorkloadOf("insane") === W.standard,
       "an unknown workload is a standard week");
  }
  {
    ok(JSON.stringify(A.normalizeCampPlan(null)) === JSON.stringify({ focus: null, workload: "standard" }),
       "no plan is no focus at a standard workload");
    ok(JSON.stringify(A.normalizeCampPlan({ focus: "grappling", workload: "hard" })) ===
       JSON.stringify({ focus: "grappling", workload: "hard" }), "a real plan passes through");
    ok(JSON.stringify(A.normalizeCampPlan({ focus: "yoga", workload: "insane" })) ===
       JSON.stringify({ focus: null, workload: "standard" }), "and a made-up one is dropped rather than trusted");
  }

  section("what each focus does at the bell");
  {
    const none = side();
    const r = A.applyCampFocus(none, { focus: null }, safe);
    ok(r.ok === false && !r.injured && none.atkMul === 1 && none.campFocus === undefined, "no focus, nothing happens");
    ok(A.applyCampFocus(null, { focus: "striking" }, safe).ok === false, "no side, nothing happens");
    const st = side();
    const rs = A.applyCampFocus(st, { focus: "striking", workload: "standard" }, safe);
    ok(rs.ok && rs.focus === "striking" && rs.workload === "standard" && !rs.injured, "a striking camp goes through");
    ok(Math.abs(st.atkMul - 1.08) < 1e-9 && st.accBonus === 3, "striking is +8% attack and +3 accuracy", st.atkMul + "/" + st.accBonus);
    ok(st.campFocus === "striking" && st.campWorkload === "standard", "and the side remembers the plan");
    const wr = side();
    A.applyCampFocus(wr, { focus: "wrestling" }, safe);
    ok(Math.abs(wr.throwMul - 1.12) < 1e-9 && Math.abs(wr.atkMul - 1.04) < 1e-9, "wrestling is +12% on throws and +4% attack");
    const gr = side();
    A.applyCampFocus(gr, { focus: "grappling" }, safe);
    ok(Math.abs(gr.subMul - 1.14) < 1e-9, "grappling is +14% on submissions", gr.subMul);
    const cd = side();
    A.applyCampFocus(cd, { focus: "conditioning" }, safe);
    ok(Math.abs(cd.stamMul - 0.88) < 1e-9 && cd.maxStam === 92 && cd.stam === 92,
       "conditioning is a 12% lighter stamina bill and 8 more in a full tank", cd.stamMul + "/" + cd.maxStam + "/" + cd.stam);
    const gp = side();
    A.applyCampFocus(gp, { focus: "game_plan" }, safe);
    ok(gp.prioBoost === 1 && gp.accBonus === 2 && Math.abs(gp.atkMul - 1.03) < 1e-9, "a game plan buys the first move and +2 accuracy");
    const wm = side();
    A.applyCampFocus(wm, { focus: "weight_mgmt" }, safe);
    ok(wm.cutResist === 0.5 && Math.abs(wm.stamMul - 0.94) < 1e-9 && wm.maxStam === 88, "weight management is half the cut damage and a 6% lighter bill");
    const tough = side({ cutResist: 0.8 });
    A.applyCampFocus(tough, { focus: "weight_mgmt" }, safe);
    ok(tough.cutResist === 0.9, "cut resistance never passes 90%", tough.cutResist);
  }

  section("the workload turns it up or down");
  {
    const hard = side(), light = side();
    A.applyCampFocus(hard, { focus: "striking", workload: "hard" }, safe);
    A.applyCampFocus(light, { focus: "striking", workload: "light" }, safe);
    ok(Math.abs(hard.atkMul - 1.096) < 1e-9 && hard.accBonus === 4, "a hard striking camp is +9.6% and +4", hard.atkMul + "/" + hard.accBonus);
    ok(Math.abs(light.atkMul - 1.056) < 1e-9 && light.accBonus === 2, "a light one is +5.6% and +2", light.atkMul + "/" + light.accBonus);
    const hgp = side();
    A.applyCampFocus(hgp, { focus: "game_plan", workload: "hard" }, safe);
    ok(hgp.prioBoost === 1, "but the first-move edge does not scale - it is one move, not one and a fifth");
    let worst = 1;
    A.CAMP_FOCUS_IDS.forEach((id) => {
      const s = side();
      A.applyCampFocus(s, { focus: id, workload: "hard" }, safe);
      worst = Math.max(worst, s.atkMul);
    });
    ok(worst <= 1.10, "no camp, however hard, multiplies attack past 1.10x", worst.toFixed(3));
  }

  section("a hard camp breaks more");
  {
    const hurt = side();
    const r = A.applyCampFocus(hurt, { focus: "striking", workload: "standard" }, () => 0);
    ok(r.injured === true, "a bad roll comes out of camp injured");
    ok(A.hasStatus(hurt, "ARM_HURT"), "with the arm damage status on the side");
    ok(Math.abs(hurt.atkMul - 1.08 * 0.92) < 1e-9, "and 8% off the attack the camp just bought", hurt.atkMul);
    const l = A.applyCampFocus(side(), { focus: "striking", workload: "light" }, () => 0.03);
    const hd = A.applyCampFocus(side(), { focus: "striking", workload: "hard" }, () => 0.03);
    ok(!l.injured && hd.injured, "the same roll walks out of a light camp and limps out of a hard one");
    const edge = A.applyCampFocus(side(), { focus: "striking", workload: "standard" }, () => W.standard.injuryRisk);
    ok(!edge.injured, "a roll exactly at the risk line is safe");
  }

  section("it reaches the fight");
  {
    A.exec("globalThis.__rnd0=Math.random; Math.random=()=>0.99;");
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    const plain = A.G.duel;
    plain.range = "MID";
    // the overhand, not the cross: at +8% a 9-point cross rounds back to 9,
    // a 14-point overhand does not
    const dmg0 = A.damageOf(plain, plain.p, plain.e, A.TECH.overhand);
    const atk0 = plain.p.atkMul;
    exec("startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5,camp:{focus:'striking',workload:'standard'}});");
    const camp = A.G.duel;
    camp.range = "MID";
    ok(camp.p.campFocus === "striking" && camp.e.campFocus === undefined, "the plan lands on the player's side only");
    ok(Math.abs(camp.p.atkMul / atk0 - 1.08) < 1e-9, "the side walks in hitting 8% harder", (camp.p.atkMul / atk0).toFixed(3));
    ok(A.damageOf(camp, camp.p, camp.e, A.TECH.overhand) > dmg0, "and the overhand shows it on the damage line",
       dmg0 + " -> " + A.damageOf(camp, camp.p, camp.e, A.TECH.overhand));
    exec("startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5,camp:{focus:'weight_mgmt',workload:'standard'}});");
    const cut = A.G.duel;
    ok(A.hurtCut(cut.p, 40) === 20, "a weight-managed face takes half the cut", A.cutSnapshot(cut.p).amount);
    A.exec("Math.random=globalThis.__rnd0; delete globalThis.__rnd0;");
  }
};
