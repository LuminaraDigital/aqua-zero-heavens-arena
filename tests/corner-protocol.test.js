/* =====================================================================
   Aqua Zero Heavens Arena - the cutman's minute
   Luminara Digital

   Four things a corner can do between rounds, and one thing the doctor
   can do to end the night. The player-facing promises are all numbers:
   the enswell takes forty off the swelling, the coagulant takes forty
   off the cut and stops the bleeding, the ice sponge is twenty-five
   stamina, the coach's read is a fifth more on the next landed shot.
   The doctor warns at 75 and stops it at 95. Every one of those is
   pinned below against the protocol's own contract (numeric swelling,
   cuts and stamina fields on the side it is handed).

   FIXED (was a KNOWN DEFECT): the protocol used to read `side.cuts`,
   `side.stamina` and `side.maxStamina` as numbers, while the engine's
   side (mkSide, effects.js hurtCut/cutSnapshot, resolve.js) carries
   `cuts: {amount, max}` and `stam` / `maxStam`. On a live duel side the
   cutman therefore read every cut as 0 and the doctor never intervened,
   COAGULANT overwrote the cut object with the number 0 - a silent full
   heal rather than the forty points on the card - and ICE_STAMINA wrote
   a field nothing reads. corner-protocol.js now reads and writes either
   shape, and the "on a real duel side" checks below hold it to the SAME
   numbers as the plain-object ones above. Swelling was always consistent
   with effects.js and is unchanged.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;
  const X = (src) => A.exec(src);

  section("the kit");
  {
    const ids = X("CORNER_ACTION_IDS");
    ok(ids.length === 4 && ids.join(",") === "ENSWELL,COAGULANT,COACH_READ,ICE_STAMINA",
       "four tools in the bag", ids.join(","));
    ok(ids.every((id) => A.CORNER_ACTIONS[id].id === id && !!A.CORNER_ACTIONS[id].name && !!A.CORNER_ACTIONS[id].desc),
       "each is named and explained");
    ok(ids.every((id) => A.CORNER_ACTIONS[id].cost === 1), "and each costs exactly one action of the minute");
  }

  section("reading the fighter");
  {
    ok(A.getCornerStatus(null) === null, "no fighter, no reading");
    const fresh = A.getCornerStatus({});
    ok(fresh.swelling === 0 && fresh.cuts === 0 && !fresh.eyeOccluded && !fresh.doctorStoppageRisk &&
       !fresh.hasBleeding && !fresh.hasWinded && !fresh.coachReadActive,
       "a fresh face reads clean on every line");
    const beaten = A.getCornerStatus({
      swelling: 80, cuts: 80, stamina: 30, coachRead: true,
      cond: { BLEEDING: { turns: 2 }, WINDED: { turns: 1 } },
    });
    ok(beaten.eyeOccluded === true, "swelling at 80 has closed the eye");
    ok(beaten.doctorStoppageRisk === true, "a cut at 80 has the doctor watching");
    ok(beaten.hasBleeding && beaten.hasWinded && beaten.coachReadActive && beaten.stamina === 30,
       "and the bleeding, the wind and the coach's read all show");
    ok(A.getCornerStatus({ swelling: 10, cond: { SWELLING_BLIND: { turns: 3 } } }).eyeOccluded === true,
       "the EYE SHUT status closes the eye whatever the number says");
    ok(A.getCornerStatus({ swelling: 74 }).eyeOccluded === false && A.getCornerStatus({ cuts: 74 }).doctorStoppageRisk === false,
       "and 74 is still under both lines");
  }

  section("the enswell");
  {
    const s = { swelling: 90, cond: { SWELLING_BLIND: { turns: 3 } } };
    const r = A.applyCornerAction(s, "ENSWELL");
    ok(r.ok === true && r.actionId === "ENSWELL", "the iron goes on");
    ok(s.swelling === 50, "and takes forty points of swelling off", s.swelling);
    ok(!s.cond.SWELLING_BLIND, "which opens the eye");
    ok(/90% to 50%/.test(r.note), "the note tells the player the before and after", r.note);
    const low = { swelling: 20 };
    A.applyCornerAction(low, "ENSWELL");
    ok(low.swelling === 0, "it cannot swell you negative", low.swelling);
  }

  section("the coagulant");
  {
    const s = { cuts: 80, cond: { BLEEDING: { turns: 4 } } };
    ok(A.checkDoctorStoppage(s).warning === true, "before the minute the doctor is warning");
    const r = A.applyCornerAction(s, "COAGULANT");
    ok(r.ok && s.cuts === 40, "the coagulant takes forty off the cut", s.cuts);
    ok(!s.cond.BLEEDING, "and stops the bleeding");
    ok(A.checkDoctorStoppage(s).warning === false, "so the doctor loses interest");
    const none = {};
    ok(A.applyCornerAction(none, "COAGULANT").ok && none.cuts === 0, "a face with no cut stays at zero, never negative");
  }
  {
    // on a real duel side: the engine's cut lives in cuts.amount, and the
    // cutman has to read it there. Forty points off a live face, and the
    // {amount, max} object survives the treatment.
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5}); beginRound(G.duel);");
    const d = A.G.duel;
    A.hurtCut(d.p, 80);
    ok(A.cutSnapshot(d.p).amount === 80 && A.getCornerStatus(d.p).cuts === 80,
       "the cutman reads a live 80-point cut as 80", A.getCornerStatus(d.p).cuts);
    ok(A.checkDoctorStoppage(d.p).warning === true,
       "so the doctor is called in on a live fighter too");
    A.applyCornerAction(d.p, "COAGULANT");
    ok(A.cutSnapshot(d.p).amount === 40,
       "sealing a live 80-point cut takes forty off it, not all of it", A.cutSnapshot(d.p).amount);
    ok(d.p.cuts && typeof d.p.cuts === "object" && typeof d.p.cuts.max === "number",
       "and the engine's {amount, max} cut object survives the treatment");
  }

  section("the coach's read");
  {
    const s = {};
    const r = A.applyCornerAction(s, "COACH_READ");
    ok(r.ok && s.coachRead === true && s.coachReadBonus === 0.2 && s.coachEvasionBonus === 0.1,
       "the read is booked as a fifth more counter and a tenth more evasion");
    ok(A.getCornerStatus(s).coachReadActive === true, "and the status line shows it");
  }
  {
    // the promise the player can feel: the next landed shot hits harder,
    // and only the next one. Two fresh duels, same dice, one with the read.
    const swing = () => {
      exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5}); beginRound(G.duel);");
      const d = A.G.duel;
      d.range = "MID";
      return d;
    };
    const plain = swing();
    const ev0 = A.executeTechnique(plain, plain.p, plain.e, A.TECH.cross, null, () => 0.5);
    const read = swing();
    A.applyCornerAction(read.p, "COACH_READ");
    const ev1 = A.executeTechnique(read, read.p, read.e, A.TECH.cross, null, () => 0.5);
    ok(ev0.hit && ev1.hit && ev1.coachReadBonus === true && ev1.dmg > ev0.dmg,
       "a read shot lands harder than the same shot without it", ev0.dmg + " -> " + ev1.dmg);
    ok(!read.p.coachRead, "and the read is spent on that one shot");
  }

  section("the ice sponge");
  {
    const s = { stamina: 40, maxStamina: 100, cond: { WINDED: { turns: 2 } } };
    const r = A.applyCornerAction(s, "ICE_STAMINA");
    ok(r.ok && s.stamina === 65, "twenty-five stamina comes back", s.stamina);
    ok(!s.cond.WINDED, "and the wind clears");
    ok(/40 to 65/.test(r.note), "the note shows the recovery", r.note);
    const full = { stamina: 90, maxStamina: 100 };
    A.applyCornerAction(full, "ICE_STAMINA");
    ok(full.stamina === 100, "capped at the tank", full.stamina);
    const noMax = { stamina: 90 };
    A.applyCornerAction(noMax, "ICE_STAMINA");
    ok(noMax.stamina === 100, "a side with no stated tank is assumed to hold 100", noMax.stamina);
  }
  {
    // on a real duel side: the engine's tank is stam / maxStam, so that is
    // where the twenty-five has to land.
    exec("SAVE=DEF_SAVE(); startDuel({p1:0,oppFid:1,oppHp:100,oppPool:[0,1,2,3,4],oppLv:5}); beginRound(G.duel);");
    const d = A.G.duel;
    d.p.stam = 20;
    A.applyCornerAction(d.p, "ICE_STAMINA");
    ok(d.p.stam === 45, "the ice sponge puts twenty-five into a live side's stam", d.p.stam);
  }

  section("bad requests");
  {
    const bad = A.applyCornerAction({}, "HUG");
    ok(bad.ok === false && /HUG/.test(bad.note), "an unknown tool is refused by name", bad.note);
    ok(A.applyCornerAction(null, "ENSWELL").ok === false, "and no fighter is refused too");
  }

  section("the ringside doctor");
  {
    const stop = A.checkDoctorStoppage({ cuts: 95 });
    ok(stop.stoppage === true && stop.warning === true && /physician/i.test(stop.reason),
       "a catastrophic cut stops the fight", stop.reason);
    const warn = A.checkDoctorStoppage({ cuts: 75 });
    ok(warn.stoppage === false && warn.warning === true && /physician/i.test(warn.reason),
       "a severe cut only brings the doctor in to look", warn.reason);
    const fine = A.checkDoctorStoppage({ cuts: 74 });
    ok(fine.stoppage === false && fine.warning === false && !fine.reason, "one under the line and nobody looks");
    ok(A.checkDoctorStoppage(null).stoppage === false, "no fighter, no stoppage");
    let ordered = true, seenWarn = false, seenStop = false;
    for (let c = 0; c <= 100; c++) {
      const r = A.checkDoctorStoppage({ cuts: c });
      if (r.stoppage && !r.warning) ordered = false;
      if (seenWarn && !r.warning) ordered = false;
      if (seenStop && !r.stoppage) ordered = false;
      seenWarn = seenWarn || r.warning; seenStop = seenStop || r.stoppage;
    }
    ok(ordered && seenWarn && seenStop, "the doctor never stops a fight he has not first warned about");
  }
};
