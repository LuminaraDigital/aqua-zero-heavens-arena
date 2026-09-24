// tests/weekly-mutator.test.js
// 10x Weekly Seeded Mutator Championship Mode Test Suite

module.exports = function (h) {
  const WeeklyMutator = h.api.WeeklyMutator || require("../src/modes/weekly-mutator.js");
  const TrophyRoom = h.api.TrophyRoom || require("../src/ui/trophy-room.js");

  h.section("10x Weekly Mutator: Deterministic Seeding & ISO Week Calculation");
  {
    h.ok(typeof WeeklyMutator === "object", "WeeklyMutator object defined");
    h.ok(typeof WeeklyMutator.getWeekNumber === "function", "getWeekNumber helper exists");
    h.ok(typeof WeeklyMutator.getIsoWeekYear === "function", "getIsoWeekYear helper exists");
    h.ok(typeof WeeklyMutator.getWeeklyMutator === "function", "getWeeklyMutator exists");

    const d1 = new Date("2026-08-24T12:00:00Z");
    const d2 = new Date("2026-08-27T18:00:00Z");
    const wm1 = WeeklyMutator.getWeeklyMutator(d1);
    const wm2 = WeeklyMutator.getWeeklyMutator(d2);

    h.ok(wm1.week === wm2.week, "Week numbers match for the same calendar week");
    h.ok(wm1.year === wm2.year, "ISO week years match");
    h.ok(wm1.id === wm2.id, "Mutator seed is deterministic for the same week");
    h.ok(typeof wm1.name === "string" && wm1.name.length > 0, "Mutator has valid name");
    h.ok(typeof wm1.tag === "string", "Mutator has tag");
    h.ok(typeof wm1.desc === "string", "Mutator has description");
    h.ok(wm1.mutator !== null, "Mutator config object attached");
  }

  h.section("10x Weekly Mutator: 16+ Mutator Presets & Secondary Wildcard Matrix");
  {
    h.ok(Array.isArray(WeeklyMutator.WEEKLY_MUTATORS), "WEEKLY_MUTATORS array exists");
    h.ok(WeeklyMutator.WEEKLY_MUTATORS.length >= 16, "Contains at least 16 distinct weekly mutators");

    const ids = WeeklyMutator.WEEKLY_MUTATORS.map(m => m.id);
    h.ok(ids.includes("GLASS_CANNON"), "Glass Cannon mutator present");
    h.ok(ids.includes("MAT_WARFARE"), "Mat Warfare mutator present");
    h.ok(ids.includes("TURBO_BLITZ"), "Turbo Blitz mutator present");
    h.ok(ids.includes("TITAN_ARMOR"), "Titan Armor mutator present");
    h.ok(ids.includes("COUNTER_KINGS"), "Counter Kings mutator present");
    h.ok(ids.includes("CHRONO_SURGE"), "Chrono Surge mutator present");
    h.ok(ids.includes("BLOODLUST_FRENZY"), "Bloodlust Frenzy mutator present");
    h.ok(ids.includes("STANDUP_PURIST"), "Standup Purist mutator present");
    h.ok(ids.includes("TITAN_GRAVITY"), "Titan Gravity Clinch mutator present");
    h.ok(ids.includes("ANOMALY_ROULETTE"), "Anomaly Roulette mutator present");
    h.ok(ids.includes("VAMPIRIC_ECLIPSE"), "Vampiric Eclipse mutator present");
    h.ok(ids.includes("PRECISION_STORM"), "Precision Storm mutator present");
    h.ok(ids.includes("IRON_CHIN_DUEL"), "Iron Chin Duel mutator present");
    h.ok(ids.includes("ADRENALINE_OVERLOAD"), "Adrenaline Overload mutator present");
    h.ok(ids.includes("GHOST_MIRAGE"), "Ghost Mirage mutator present");
    h.ok(ids.includes("PRESSURE_FURNACE"), "Pressure Furnace mutator present");

    h.ok(Array.isArray(WeeklyMutator.SECONDARY_MUTATORS), "SECONDARY_MUTATORS array exists");
    h.ok(WeeklyMutator.SECONDARY_MUTATORS.length >= 5, "Contains at least 5 secondary wildcard mutators");

    const sec = WeeklyMutator.getSecondaryMutator("GLASS_CANNON", 42);
    h.ok(sec !== null && sec.id !== "GLASS_CANNON", "Secondary wildcard mutator selected");
  }

  h.section("10x Weekly Mutator: Campaign State Initialization & Memory");
  {
    h.ok(typeof WeeklyMutator.DEF_WEEKLY_STATE === "function", "DEF_WEEKLY_STATE function exists");
    const st = WeeklyMutator.DEF_WEEKLY_STATE(2, new Date("2026-08-24T12:00:00Z"));

    h.ok(st.hero === 2, "Hero ID initialized to 2");
    h.ok(st.tier === 1, "Weekly campaign opens at Tier 1");
    h.ok(st.maxTier === 5, "Standard campaign targets 5-tier circuit");
    h.ok(st.score === 0, "Initial score is 0");
    h.ok(st.purse === 120, "Initial starting purse is 120 coins");
    h.ok(st.respitesLeft === 2, "Default campaign has 2 Corner Respite retry lives");
    h.ok(Array.isArray(st.augments) && st.augments.length === 0, "Drafted augments empty at start");
    h.ok(Array.isArray(st.bag) && st.bag.includes("salts") && st.bag.includes("syringe"), "Corner bag stocked");
    h.ok(st.victorious === false, "Not victorious at start");
    h.ok(st.overdrive === false, "Overdrive inactive at start");
    h.ok(st.active === true, "Campaign active");
    h.ok(st.mutator !== null, "Primary mutator attached to state");
  }

  h.section("10x Weekly Mutator: 5-Tier Opponent Generator & Apex Sovereign");
  {
    const st = WeeklyMutator.DEF_WEEKLY_STATE(0, new Date("2026-08-24T12:00:00Z"));

    const opp1 = WeeklyMutator.weeklyOpponentForTier(st, 1);
    h.ok(opp1.tier === 1, "Tier 1 opponent generated");
    h.ok(opp1.isApex === false, "Tier 1 is not Apex Sovereign");
    h.ok(opp1.hasSecondary === false, "Tier 1 does not activate secondary mutator");
    h.ok(opp1.statMul === 1.0, "Tier 1 base stat multiplier is 1.0");

    const opp4 = WeeklyMutator.weeklyOpponentForTier(st, 4);
    h.ok(opp4.tier === 4, "Tier 4 opponent generated");
    h.ok(opp4.hasSecondary === true, "Tier 4 activates secondary wildcard mutator");
    h.ok(opp4.secondaryMutator !== null, "Tier 4 has valid secondary wildcard");
    h.ok(opp4.statMul > opp1.statMul, "Tier 4 scales stat multiplier higher than Tier 1");

    const opp5 = WeeklyMutator.weeklyOpponentForTier(st, 5);
    h.ok(opp5.tier === 5, "Tier 5 opponent generated");
    h.ok(opp5.isApex === true, "Tier 5 is flagged as Apex Weekly Sovereign");
    h.ok(opp5.bossTitle === "APEX WEEKLY SOVEREIGN", "Tier 5 has Apex boss title");
    h.ok(typeof opp5.bossDialogue === "string" && opp5.bossDialogue.length > 10, "Apex Sovereign has intro dialog");
    h.ok(opp5.statMul >= 1.40, "Apex Sovereign possesses formidable stat multiplier");
  }

  h.section("10x Weekly Mutator: Tier Advancement, Scoring & Grand Climax Victory");
  {
    const st = WeeklyMutator.DEF_WEEKLY_STATE(1, new Date("2026-08-24T12:00:00Z"));
    st.hp = Math.round(st.maxhp * 0.5);

    const adv1 = WeeklyMutator.weeklyAdvanceTier(st, true, { hpLeft: 0.75, turns: 4, comboMax: 3 });
    h.ok(adv1.active === true, "Run remains active after Tier 1 victory");
    h.ok(st.tier === 2, "Tier advanced to 2");
    h.ok(st.score > 0, "Score accumulated from victory");
    h.ok(st.purse > 120, "Purse coins awarded");
    h.ok(st.hp > Math.round(st.maxhp * 0.5), "Corner camp restored health");
    h.ok(adv1.isGrandVictory === false, "Tier 1 is not Grand Victory");

    st.tier = 5;
    const adv5 = WeeklyMutator.weeklyAdvanceTier(st, true, { hpLeft: 0.90, turns: 5, comboMax: 4 });
    h.ok(adv5.isGrandVictory === true, "Tier 5 victory registers Grand Climax");
    h.ok(st.victorious === true, "State flagged as victorious champion");
    h.ok(adv5.score >= 4000, "Grand Victory awards massive climax score bonus");
  }

  h.section("10x Weekly Mutator: Defeat Resilience (Corner Respites)");
  {
    const st = WeeklyMutator.DEF_WEEKLY_STATE(0, new Date("2026-08-24T12:00:00Z"));
    h.ok(st.respitesLeft === 2, "Starts with 2 Corner Respite tokens");

    const loss1 = WeeklyMutator.weeklyAdvanceTier(st, false, { turns: 6 });
    h.ok(loss1.active === true, "Run remains active after defeat due to Corner Respite");
    h.ok(loss1.respiteUsed === true, "Respite used flag set");
    h.ok(st.respitesLeft === 1, "Respites decreased from 2 to 1");
    h.ok(st.hp > 0, "Corner clinic revived fighter health");

    const loss2 = WeeklyMutator.weeklyAdvanceTier(st, false, { turns: 5 });
    h.ok(loss2.active === true, "Run remains active on second defeat");
    h.ok(st.respitesLeft === 0, "Respites decreased from 1 to 0");

    const loss3 = WeeklyMutator.weeklyAdvanceTier(st, false, { turns: 4 });
    h.ok(loss3.active === false, "Run concludes when out of respites");
    h.ok(loss3.gameOver === true, "Game over registered");
  }

  h.section("10x Weekly Mutator: Anomaly Augment Drafting");
  {
    h.ok(Array.isArray(WeeklyMutator.WEEKLY_AUGMENTS), "WEEKLY_AUGMENTS array exists");
    h.ok(WeeklyMutator.WEEKLY_AUGMENTS.length >= 12, "Contains at least 12 distinct anomaly augments");

    const st = WeeklyMutator.DEF_WEEKLY_STATE(0, new Date("2026-08-24T12:00:00Z"));
    const choices = WeeklyMutator.weeklyAugmentChoices(st, 3);

    h.ok(choices.length === 3, "Offers 3 curated augment choices");
    h.ok(typeof choices[0].id === "string", "Augment has ID");
    h.ok(typeof choices[0].name === "string", "Augment has name");
    h.ok(typeof choices[0].desc === "string", "Augment has description");

    const chosenId = choices[0].id;
    const applied = WeeklyMutator.applyWeeklyAugment(st, chosenId);
    h.ok(applied === true, "Augment applied successfully");
    h.ok(st.augments.includes(chosenId), "Augment recorded in state");

    const freshSt = WeeklyMutator.DEF_WEEKLY_STATE(0, new Date("2026-08-24T12:00:00Z"));
    WeeklyMutator.applyWeeklyAugment(freshSt, "w_respite_token");
    h.ok(freshSt.respitesLeft === 3, "Emergency Medkit augment granted +1 Corner Respite token");
  }

  h.section("10x Weekly Mutator: Corner Clinic and Equipment Purchases");
  {
    const st = WeeklyMutator.DEF_WEEKLY_STATE(0, new Date("2026-08-24T12:00:00Z"));
    st.hp = 40;
    st.maxhp = 100;
    st.purse = 200;

    const actions = WeeklyMutator.weeklyCornerActions(st);
    h.ok(Array.isArray(actions) && actions.length >= 4, "Corner actions list available");

    const healRes = WeeklyMutator.weeklyCornerActions.clinic(st);
    h.ok(healRes.ok === true, "Medical clinic applied");
    h.ok(st.hp > 40, "HP restored after clinic");

    const buyRes = WeeklyMutator.weeklyCornerActions.buyItem(st, "respite");
    h.ok(buyRes.ok === true, "Purchased additional respite token");
    h.ok(st.respitesLeft === 3, "Respite count updated");
    h.ok(st.purse === 40, "Purse coins deducted");
  }

  h.section("10x Weekly Mutator: Trophy Room Unlocks");
  {
    const fakeSave = {
      weekly: { victories: 1, bestTier: 5 },
      rec: { weeklyVictories: 1, bestWeeklyTier: 5 },
    };
    const trophies = TrophyRoom.getTrophyList(fakeSave);
    const champTrophy = trophies.find(t => t.id === "WEEKLY_CHAMPION");
    h.ok(champTrophy !== undefined, "WEEKLY_CHAMPION trophy registered in Trophy Room");
    h.ok(champTrophy.unlocked === true, "Weekly Champion trophy unlocked with 1+ victory");

    const fakeOverdriveSave = {
      weekly: { victories: 1, bestTier: 9 },
      rec: { weeklyVictories: 1, bestWeeklyTier: 9 },
    };
    const trophiesOD = TrophyRoom.getTrophyList(fakeOverdriveSave);
    const odTrophy = trophiesOD.find(t => t.id === "WEEKLY_OVERDRIVE_8");
    h.ok(odTrophy !== undefined, "WEEKLY_OVERDRIVE_8 trophy registered in Trophy Room");
    h.ok(odTrophy.unlocked === true, "Weekly Overdrive Laurel unlocked with Tier 8+ reached");
  }
};