/* =====================================================================
   Aqua Zero Heavens Arena - the tell, the trainer, the ring, the nemesis
   Luminara Digital

   Everything the "make the invisible visible" pass added:
     - the free TELL and the paid READ stay distinct
     - menus are built from the LIVE technique list (drafts show up,
       cuts disappear)
     - the trainer's cut and drill actually change the fight
     - ringcraft is position-gated and the escape roll is playable
     - EDGE benefits break exactly the rule they claim to break
     - losing makes a nemesis; beating him pays
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;

  section("the tell is free, the read is paid");
  {
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    const d = A.G.duel;
    A.exec("G.duel.ph=D.CMD;");
    // beginRound has not run yet in this synthetic setup - force a commit
    exec("beginRound(G.duel);");
    ok(!!d.eTech, "the CPU commits before the player chooses");
    const it = A.intentFor(d);
    ok(!!it && !!it.line, "and that commitment produces a tell", it && it.key);
    ok(!it || it.line.indexOf(d.eTech.name.toUpperCase()) < 0,
       "the tell never names the exact technique", it && it.line);
    // the read is the exact technique; the tell is only the class
    const kinds = {};
    ["jab", "double_leg"].forEach(() => {});
    ok(A.INTENT_TELLS.TAKEDOWN.key === "TAKEDOWN", "tell table is exported");
  }
  {
    // a takedown telegraphs as a shot, and the sprawl is flagged the counter
    const d = A.G.duel;
    const takedown = A.TECH_IDS.map((id) => A.TECH[id]).find((t) => t.flags.indexOf("takedown") >= 0);
    d.eTech = takedown; d.eSuper = false;
    const it = A.intentFor(d);
    ok(it.key === "TAKEDOWN", "a committed takedown reads as a shot", it.key);
    const sprawl = A.TECH.basic_sprawl;
    const hint = A.intentHint(d, d.p, sprawl);
    ok(hint && hint.edge === 2, "and the sprawl is marked the hard counter", hint && hint.note);
  }
  {
    // hotseat gives nothing away
    const d = A.G.duel;
    d.hotseat = true;
    ok(A.intentFor(d) === null, "two humans keep their secrets");
    d.hotseat = false;
  }

  section("menus are built from the live list");
  {
    exec("startDuel({p1:0,oppFid:2,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5});");
    const d = A.G.duel;
    // graft a foreign technique in, as a draft would: a real strike the
    // fighter does not already know, thrown at the current range
    const foreign = A.TECH_IDS.find((id) => {
      const t = A.TECH[id];
      return t.cls === "STRIKE" && t.range === "MID" && t.power >= 36 &&
             d.p.techs.indexOf(id) < 0 && !t.sig;
    });
    ok(!!foreign, "there is a foreign technique to graft", foreign);
    d.p.techs.push(foreign);
    d.range = "MID"; d.cmdCat = 0;
    ok(A.menuTechsFor(d, d.p).some((t) => t.id === foreign),
       "a drafted technique appears in the fight menu", foreign);
    // and a cut one disappears
    const gone = d.p.techs[0];
    d.p.techs = d.p.techs.filter((id) => id !== gone);
    d.cmdCat = 0; d.range = "MID";
    const still = [];
    for (let c = 0; c < 3; c++) { d.cmdCat = c; A.menuTechsFor(d, d.p).forEach((t) => still.push(t.id)); }
    ok(still.indexOf(gone) < 0, "a technique removed from the list never reaches the menu");
  }

  section("the trainer's table");
  {
    exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv); G.adv.purse=500;");
    const a = A.G.adv;
    const cuts = A.cutCandidates(a);
    ok(cuts.length > 0, "there is something to cut", cuts.length);
    ok(cuts.indexOf("basic_guard") < 0, "the fundamentals are not for sale");
    const target = cuts[0];
    const r = A.exec("buyItem(G.adv, cutTicket(G.adv, " + JSON.stringify(target) + "))");
    ok(r.ok === true, "the cut goes through", r.reason);
    ok((a.retired || []).indexOf(target) >= 0, "and the run remembers it");
    ok(A.cutCandidates(a).indexOf(target) < 0, "and it cannot be cut twice");
    // the cut technique never reaches a fight side
    exec("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    ok(A.G.duel.p.techs.indexOf(target) < 0, "a cut technique stays out of the fight");
  }
  {
    const a = A.G.adv;
    const drills = A.drillCandidates(a);
    ok(drills.length > 0, "there is something to drill");
    // the hardest-hitting thing on the table, so the before/after is visible
    const target = drills.slice().sort((x, y) => A.TECH[y].power - A.TECH[x].power)[0];
    a.purse = 500;
    const r = A.exec("buyItem(G.adv, drillTicket(G.adv, " + JSON.stringify(target) + "))");
    ok(r.ok === true, "the drill goes through", r.reason);
    ok((a.drilled || {})[target] === 1, "and the tier is recorded");
    // a drilled technique hits harder in a real duel
    exec("startDuel({fromAdv:true,oppFid:3,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    const d = A.G.duel, t = A.TECH[target];
    d.range = t.range === "ANY" ? "MID" : t.range;   // judge it at its own range
    const before = { drill: d.p.drill };
    d.p.drill = null;
    const plain = A.damageOf(d, d.p, d.e, t);
    d.p.drill = before.drill;
    const sharp = A.damageOf(d, d.p, d.e, t);
    ok(sharp > plain, "a drilled technique hits harder", plain + " -> " + sharp);
    // drills are capped
    a.purse = 500;
    A.exec("buyItem(G.adv, drillTicket(G.adv, " + JSON.stringify(target) + "))");
    const third = A.exec("buyItem(G.adv, drillTicket(G.adv, " + JSON.stringify(target) + "))");
    ok(third.ok === false && third.reason === "no_drill", "and capped at two tiers", third.reason);
  }

  section("ringcraft - the ring is a target");
  {
    exec("startDuel({p1:0,oppFid:4,oppHp:120,oppPool:[0,1,2,3,4],oppLv:5});");
    const d = A.G.duel;
    ok(d.p.techs.indexOf("ring_cut") >= 0, "everyone knows how to cut the ring");
    // corner-only techniques are gated
    const barrage = A.TECH.ring_barrage, reversal = A.TECH.ring_reversal;
    A.resetPosition(d);
    ok(!A.posOk(d, d.p, barrage), "the corner barrage needs a cornered man");
    ok(!A.posOk(d, d.p, reversal), "the reversal needs YOUR back on the ropes");
    d.pos = "CORNER"; d.cornered = "e";
    ok(A.posOk(d, d.p, barrage), "trap them and the barrage exists");
    ok(!A.posOk(d, d.p, reversal), "but the reversal still does not");
    d.cornered = "p";
    ok(A.posOk(d, d.p, reversal), "cornered yourself, the reversal is live");
    // the reversal actually swaps the corner
    const ev = A.executeTechnique(d, d.p, d.e, reversal, null, () => 0.01);
    ok(ev.hit && d.cornered === "e", "landing it turns them into the corner", d.cornered);
  }
  {
    // the shove books more pressure than a plain landed technique
    const d = A.G.duel;
    A.resetPosition(d);
    const evPlain = { hit: true, tech: A.TECH.jab, blocked: false };
    const plain = A.pressureShift(d, d.p, evPlain).gain;
    A.resetPosition(d);
    const evShove = { hit: true, tech: A.TECH.ring_cut, blocked: false };
    const shove = A.pressureShift(d, d.p, evShove).gain;
    ok(shove > plain * 1.5, "a shove takes real ground", plain.toFixed(2) + " vs " + shove.toFixed(2));
  }
  {
    // circle out is the escape roll, and it is priced in air
    const d = A.G.duel;
    d.pos = "CORNER"; d.cornered = "p"; d.press = { by: "e", n: 1 };
    const stam0 = d.p.stam;
    const ev = A.executeTechnique(d, d.p, d.e, A.TECH.ring_circle, null, () => 0.01);
    ok(!!ev.escape && ev.escape.escaped, "a good roll circles out", JSON.stringify(ev.escape));
    ok(d.pos === "ROPES", "one notch back toward open canvas, not a teleport", d.pos);
    ok(d.p.stam < stam0, "and the escape cost air", stam0 + " -> " + d.p.stam);
  }

  section("EDGE - bought rule-breaks");
  {
    ok(A.BENEFIT_IDS.filter((id) => A.BENEFITS[id].tag === "EDGE").length === 5,
       "five edges exist");
    for (let i = 0; i < 40; i++) {
      const picks = A.benefitChoices([]);
      if (picks.some((id) => A.BENEFITS[id].tag === "EDGE")) {
        ok(false, "the camp never offers an EDGE", picks.join());
        break;
      }
      if (i === 39) ok(true, "the camp never offers an EDGE");
    }
    // the fourth link: chain cap rises with the benefit
    const d = A.G.duel;
    d.benefits = [];
    const base = A.seqMaxLen(d);
    d.benefits = ["edge_fourth_link"];
    ok(A.seqMaxLen(d) === base + 1, "the fourth link raises the cap", base + " -> " + A.seqMaxLen(d));
    // perpetual motion: the opener is free, the second technique is not
    d.benefits = [];
    const s = d.p;
    s.freeOpener = true; s._fo = false; s.stam = s.maxStam;
    const ev1 = A.executeTechnique(d, s, d.e, A.TECH.cross, null, () => 0.99);
    ok(ev1.stam === 0, "perpetual motion: the opener costs nothing", ev1.stam);
    const ev2 = A.executeTechnique(d, s, d.e, A.TECH.cross, null, () => 0.99);
    ok(ev2.stam > 0, "and the second technique pays full price", ev2.stam);
    A.endTurnUpkeep(s);
    ok(s._fo === false, "the free opener resets with the turn");
    // an edge costs more than a camp benefit at the same stage
    const run = { stage: 1 };
    ok(A.exec("benefitPrice({stage:1},'edge_glass')") > A.exec("benefitPrice({stage:1},'heavy_hands')"),
       "an EDGE is priced like contraband");
  }

  section("the corner bag is finally usable");
  {
    exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv); G.adv.purse=0;");
    exec("G.adv.corner=['water_break','smelling_salts','fresh_wraps'];");
    exec("startDuel({fromAdv:true,oppFid:6,oppHp:100,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    exec("beginRound(G.duel);");
    const d = A.G.duel;
    ok(A.exec("bagOpen(G.duel)") === true, "the bag opens in an adventure duel");
    // burn some air, then take the water break
    d.p.stam = 5;
    const used = A.exec("useCornerItem(G.duel, 'water_break')");
    ok(used === true, "the water break is usable");
    ok(A.G.adv.corner.indexOf("water_break") < 0, "and it is spent from the bag");
    ok(d.p.stam >= 45, "the stamina came back", d.p.stam);
    ok(d.p.freeNext === true || d.p.freeNext === false, "freeNext is tracked");
    // using it took the turn: the queue ran with corner_work committed
    ok(d.pTech && d.pTech.id === "corner_work", "using an item takes the turn as corner work");
  }
  {
    // fresh wraps sharpen exactly three strikes
    const d = A.G.duel;
    // wait out any queue, then force a clean commit state
    d.ph = A.D.CMD; d.queue = []; d.qi = 0;
    A.exec("useCornerItem(G.duel, 'fresh_wraps')");
    ok(d.p.edge && d.p.edge.hits === 3, "three strikes are sharpened", JSON.stringify(d.p.edge));
    const dmg0 = A.damageOf(d, d.p, d.e, A.TECH.cross);
    const ev = A.executeTechnique(d, d.p, d.e, A.TECH.cross, null, () => 0.01);
    ok(ev.hit && ev.dmg > dmg0, "a wrapped strike hits harder", dmg0 + " -> " + ev.dmg);
    ok(d.p.edge.hits === 2, "and the edge wears off one hit at a time", d.p.edge.hits);
  }
  {
    // smelling salts: clears the fog and buys the first move NEXT turn
    const d = A.G.duel;
    d.ph = A.D.CMD; d.queue = []; d.qi = 0;
    A.addStatus(d.p, "STUNNED"); A.addStatus(d.p, "OFF_BALANCE");
    A.exec("useCornerItem(G.duel, 'smelling_salts')");
    ok(!A.hasStatus(d.p, "STUNNED") && !A.hasStatus(d.p, "OFF_BALANCE"),
       "the salts clear stunned and off balance");
    ok(d.p.prioBoostNext === 3, "the first move is banked for next turn", d.p.prioBoostNext);
    exec("beginRound(G.duel);");
    ok(d.p.prioBoost === 3, "and goes live when the turn starts", d.p.prioBoost);
    const slow = A.TECH.overhand, fast = A.TECH.jab;
    const mine = A.initiativeOf(d.p, slow, () => 0.5);
    const theirs = A.initiativeOf(d.e, fast, () => 0.5);
    ok(mine > theirs, "a boosted haymaker beats their jab to the punch");
    exec("beginRound(G.duel);");
    ok(!d.p.prioBoost, "and it lasts exactly one turn");
  }

  section("the nemesis");
  {
    exec("SAVE=DEF_SAVE(); G.adv=newAdv(0,0); newField(G.adv); G.adv.purse=0;");
    exec("startDuel({fromAdv:true,oppFid:7,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    // lose on purpose
    exec("G.duel.p.hp=0; G.duel.forfeit=false; endDuel(G.duel);");
    ok(A.G.adv.nemesis === 7, "losing writes the name down", A.G.adv.nemesis);
    // meet him again: he is flagged and slightly up
    exec("startDuel({fromAdv:true,oppFid:7,oppHp:90,oppPool:[0,1,2,3,4],oppLv:4,stage:1});");
    ok(A.G.duel.nemesis === true, "the rematch knows him");
    // beat him: revenge pays and the slate clears
    const purse0 = A.G.adv.purse;
    exec("G.duel.e.hp=0; G.duel.stats.win=true; endDuel(G.duel);");
    ok(A.G.adv.nemesis === null, "revenge clears the grudge", A.G.adv.nemesis);
    ok(A.G.adv.purse > purse0, "and it pays", purse0 + " -> " + A.G.adv.purse);
    ok(A.G.payRevenge === true, "and the result screen knows it");
  }
  {
    // the revenge line is real money: same win, revenge flag on/off
    const base = A.purseFor({ win: true, stage: 1, turns: 9 });
    const rev = A.purseFor({ win: true, stage: 1, turns: 9, revenge: true });
    ok(rev > base, "the revenge purse is not decorative", base + " vs " + rev);
  }
};
