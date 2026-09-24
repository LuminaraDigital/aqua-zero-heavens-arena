"use strict";

module.exports = function (h) {
  const { api, ok, section } = h;
  const A = api;

  section("Survival Gauntlet: State Initialization & Memory");

  // 1. Initial state structure
  const st1 = A.DEF_ENDLESS_STATE(3);
  ok(st1 && typeof st1 === "object", "DEF_ENDLESS_STATE returns valid object");
  ok(st1.hero === 3, "Hero ID initialized correctly");
  ok(st1.wave === 1, "Gauntlet starts at Wave 1");
  ok(st1.score === 0, "Initial score is 0");
  ok(st1.purse === 100, "Initial starting purse is 100 coins");
  ok(Array.isArray(st1.drafted) && st1.drafted.length === 0, "Drafted techniques list empty at start");
  ok(Array.isArray(st1.benefits) && st1.benefits.length === 0, "Active benefits list empty at start");
  ok(typeof st1.seals === "object", "Seals mapping initialized");
  ok(Array.isArray(st1.bag) && st1.bag.includes("salts"), "Corner bag stocked with default smelling salts");

  // 2. Persistent Save Memory Integration
  A.run("SAVE = DEF_SAVE(); G.adv = null; G.endless = DEF_ENDLESS_STATE(1); G.endless.wave = 4; G.endless.score = 850; G.endless.purse = 240; saveRun();");
  const save = A.getSave();
  ok(save.run && save.run.gauntlet, "Gauntlet state stored in SAVE.run.gauntlet");
  ok(save.run.gauntlet.wave === 4, "Saved wave matches current progress");
  ok(save.run.gauntlet.score === 850, "Saved score matches state");

  // Verify memory resume
  A.run("G.endless = null; const resumed = resumeRun();");
  ok(A.G.endless && A.G.endless.wave === 4, "resumeRun restores active gauntlet state");
  ok(A.G.endless.score === 850, "resumeRun restores gauntlet score");
  ok(A.G.endless.purse === 240, "resumeRun restores purse coins");

  // Clear run
  A.run("clearRun();");
  const clearedSave = A.getSave();
  ok(!clearedSave.run || !clearedSave.run.gauntlet, "clearRun wipes gauntlet run memory");

  section("Survival Gauntlet: Opponent Scaling & Milestone Bosses");

  // 3. Normal wave opponent
  const opp1 = A.endlessOpponentForWave(1, 24);
  ok(opp1.wave === 1, "Wave 1 opponent correctly tagged");
  ok(!opp1.isBoss && !opp1.isApex, "Wave 1 is not a boss");
  ok(opp1.affix && typeof opp1.affix.name === "string", "Opponent has dynamic arena affix");

  // 4. Wave 5 Gatekeeper boss
  const opp5 = A.endlessOpponentForWave(5, 24);
  ok((opp5.wave === 5), "Wave 5 tagged correctly");
  ok(opp5.isBoss === true, "Wave 5 is flagged as Gatekeeper Boss");
  ok(!opp5.isApex, "Wave 5 is not Apex Sovereign");
  ok(opp5.statMul > opp1.statMul, "Boss stat multiplier scales higher than wave 1");

  // 5. Wave 10 Apex Sovereign climax boss
  const opp10 = A.endlessOpponentForWave(10, 24);
  ok((opp10.wave === 10), "Wave 10 tagged correctly");
  ok(opp10.isBoss === true && opp10.isApex === true, "Wave 10 is the Apex Sovereign Climax Boss");
  ok(opp10.dialogue && opp10.dialogue.intro, "Apex Sovereign features epic boss intro dialogue");
  ok((opp10.statMul >= 1.35), "Apex Sovereign possesses formidable stat multiplier");

  section("Survival Gauntlet: Wave Advancement, Scoring & Rogue-lite Intervals");

  const run = A.DEF_ENDLESS_STATE(0);
  run.hp = 120;
  run.maxhp = 120;

  // Wave 1 victory
  const r1 = A.endlessAdvanceWave(run, true, { turns: 3, hp: 100, maxhp: 120 });
  ok(r1.active === true, "Run remains active after wave win");
  ok(run.wave === 2, "Wave advanced to 2");
  ok(run.score > 0, "Score accumulated from victory");
  ok(run.purse > 100, "Purse coins awarded");

  // Wave 2 victory (Draft Interval)
  const r2 = A.endlessAdvanceWave(run, true, { turns: 4, hp: 90, maxhp: 120 });
  ok(run.wave === 3, "Wave advanced to 3");
  ok(r2.needsDraft === true, "Draft reward offered on wave 2 transition (draft interval)");

  // Wave 3 victory (Perk Interval)
  const r3 = A.endlessAdvanceWave(run, true, { turns: 4, hp: 80, maxhp: 120 });
  ok(run.wave === 4, "Wave advanced to 4");
  ok(r3.needsPerk === true, "Perk reward offered on wave 3 transition (perk interval)");

  // Fast forward to Wave 10 Apex Sovereign Cleared
  run.wave = 10;
  const r10 = A.endlessAdvanceWave(run, true, { turns: 6, hp: 60, maxhp: 120 });
  ok(r10.isApexVictory === true, "Apex Sovereign victory registered");
  ok(run.victorious === true, "Run flagged as victorious champion");
  ok(run.score >= 5000, "Grand victory awards massive climax score bonus");

  section("Survival Gauntlet: Sacred Seals & Perk Choices");

  const perks = A.gauntletPerkChoices(run, 3);
  ok(Array.isArray(perks) && perks.length === 3, "Offers 3 curated perk choices");
  ok(perks[0].id && perks[0].name && perks[0].desc, "Perk choices contain full descriptive metadata");

  const sealPerk = perks.find(p => p.type === "seal") || { id: "PERK_SEAL_LIGHTNING", name: "Lightning Seal", type: "seal", seal: "SEAL_LIGHTNING" };
  const applied = A.applyGauntletPerk(run, sealPerk.id);
  ok(applied === true, "Perk applied successfully");
  if (sealPerk.type === "seal") {
    ok(Object.keys(run.seals).length > 0, "Sacred seal infused onto fighter techniques");
  }

  section("Survival Gauntlet: Camp Clinic & Corner Bag");

  run.hp = 50;
  run.maxhp = 120;
  const clinicAction = A.gauntletRestActions.clinic(run);
  ok(clinicAction.ok === true, "Camp clinic restores fighter health");
  ok(run.hp > 50, "HP increased after clinic treatment");

  const bagAction = A.gauntletRestActions.cornerSupply(run, "syringe");
  ok(bagAction.ok === true, "Purchased adrenaline syringe for corner bag");
  ok(run.bag.includes("syringe"), "Syringe present in corner bag inventory");

  section("Survival Gauntlet: Endless Overdrive & Trophies");

  // Endless Overdrive (Waves 11+)
  run.wave = 11;
  run.overdrive = true;
  const opp15 = A.endlessOpponentForWave(15, 24);
  ok(opp15.statMul > opp10.statMul, "Overdrive wave 15 scales progressively higher");

  // Trophy Room Integration
  const mockSave = { rec: { gauntletVictories: 1, bestEndless: 22 } };
  const trophies = A.TrophyRoom.getTrophyList(mockSave);
  const apexTrophy = trophies.find(t => t.id === "GAUNTLET_APEX");
  const overTrophy = trophies.find(t => t.id === "GAUNTLET_OVERDRIVE_20");
  ok(apexTrophy && apexTrophy.unlocked === true, "Apex Gauntlet Champion Trophy unlocked on 1+ victories");
  ok(overTrophy && overTrophy.unlocked === true, "Overdrive Gladiator Laurel unlocked on wave 20+ reached");
};
