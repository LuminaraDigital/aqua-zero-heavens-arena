/* =====================================================================
   The second progression axis: mastery of the ART rather than the man.

   These tests care about three things in this order. That it always
   progresses - every technique you throw feeds something, win or lose, and
   the arts pool across the roster instead of resetting with each fighter.
   That the perks stay small, because this axis is permanent and free and
   therefore has to be cheaper than a gym drill or a camp benefit. And that
   it reaches the drafter, which is the whole reason it is worth having.

   Everything is reached through exec(), so this suite passes whether or
   not the module's names have been added to the harness EXPORTS list.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section } = h;
  const A = api;
  const X = (src) => A.exec(src);
  const J = (src) => JSON.parse(A.exec("JSON.stringify(" + src + ")"));

  section("discipline mastery is wired into the page");
  const live = X('typeof awardDiscMastery==="function" && typeof DISC_RANKS!=="undefined"');
  ok(live, "the discipline mastery module is in the build");
  if (!live) return;

  {
    ok(X("discMasteryIds().length") >= 19, "every art on the roster can be trained",
       X("discMasteryIds().length"));
    ok(X("discMasteryIds().every(id=>!!DISCIPLINES[id])"), "and they are all real disciplines");
    ok(X("DISC_MASTERY_MAX") === X("DISC_RANKS.length-1"), "the ladder max matches the ladder");
    ok(X("DISC_RANK_COLORS.length===DISC_RANKS.length"), "there is a colour for every rank");
    let last = -1, mono = true;
    J("DISC_RANKS").forEach((r) => { if (r.need < last) mono = false; last = r.need; });
    ok(mono, "the grade thresholds only go up");
    ok(X('DISC_RANKS.every(r=>r.level===0||(!!r.name&&!!r.perk))'),
       "every grade above untrained is named and states its perk");
    ok(X('DISC_RANKS[0].name==="Untrained"') && X("DISC_RANKS[0].need===0"), "everyone starts untrained");
  }

  section("a fresh save is exactly neutral");
  {
    // this matters more than it looks: it is what lets the resolver and the
    // drafter be wired up without moving any existing behaviour
    A.exec("SAVE=DEF_SAVE(); persist();");
    ok(X("discMasteryIds().every(id=>discMasteryXp(SAVE,id)===0)"), "no art carries any xp");
    ok(X("discMasteryIds().every(id=>discMasteryLevel(SAVE,id)===0)"), "no art carries a grade");
    ok(X("discMasteryIds().every(id=>discDraftMul(SAVE,id)===1)"),
       "and every draft multiplier is exactly 1, so drafting is unchanged");
    ok(X("TECH_IDS.every(id=>discPowerMul(SAVE,TECH[id])===1&&discAccBonus(SAVE,TECH[id])===0" +
         "&&discStamCut(SAVE,TECH[id])===0&&discSpeedMul(SAVE,TECH[id])===1)"),
       "and not one technique in the dex is altered");
  }
  {
    // total against every kind of rubbish a caller can hand it
    const junk = '[null,undefined,0,"",{},[],"nonsense",{disc:"nope"}]';
    ok(X(junk + ".every(j=>discDraftMul(j,j)===1)"), "junk never changes a draft weight");
    ok(X(junk + ".every(j=>discPowerMul(j,j)===1&&discAccBonus(j,j)===0)"), "junk never grants a perk");
    ok(X("awardDiscMastery(null,['jab'],{win:true}).total===0"), "no save, no award, no throw");
    ok(X("awardDiscMastery({},['nonsense_id'],{win:true}).total===0"), "an unknown technique earns nothing");
    ok(X("discMasteryXp({discMastery:{boxing:-50}},'boxing')===0"), "a corrupt negative reads as zero");
    ok(X("discMasteryXp({discMastery:{boxing:'9'}},'boxing')===0"), "so does a corrupt string");
  }

  section("xp comes from the techniques you actually threw");
  {
    // one normaliser, four shapes - the caller should not have to know
    // which one the battle layer happens to hand over
    const list = J("discTally(['jab','cross','jab','low_kick'])");
    ok(list.boxing === 3 && list.kickboxing === 1, "a list of technique ids", JSON.stringify(list));
    ok(X("JSON.stringify(discTally({jab:3,low_kick:1}))===JSON.stringify(discTally(['jab','cross','jab','low_kick']))"),
       "a map of technique to count agrees with the list");
    ok(X("JSON.stringify(discTally({boxing:3,kickboxing:1}))===JSON.stringify(discTally(['jab','jab','jab','low_kick']))"),
       "and so does a map of art to count");
    ok(X("JSON.stringify(discTally([TECH.jab,TECH.cross,TECH.jab,TECH.low_kick]))===" +
         "JSON.stringify(discTally(['jab','cross','jab','low_kick']))"),
       "technique objects work too, because ev.tech is what the resolver holds");
    ok(X("TECH.basic_guard.disc===null&&Object.keys(discTally(['basic_guard'])).length===0"),
       "the shared fundamentals belong to no art and train none");
    ok(X("Object.keys(discNoteUse(discNoteUse(discNoteUse(null,'jab'),TECH.cross),'nonsense')).length===1&&" +
         "discNoteUse(discNoteUse(null,'jab'),'cross').boxing===2"),
       "and a caller can count as the fight happens");
  }
  {
    ok(X("discMasteryFor(0,{win:true})===0"), "an art you never threw earns nothing");
    ok(X("discMasteryFor(3,{win:false})>0"), "losing still trains what you threw");
    ok(X("discMasteryFor(3,{win:true})>discMasteryFor(3,{win:false})"), "winning trains it more");
    ok(X("discMasteryFor(6,{win:true})>discMasteryFor(2,{win:true})"), "leaning on an art earns more");
    ok(X("discMasteryFor(99,{win:true})===discMasteryFor(DISC_CONFIG.useCap,{win:true})"),
       "but spamming one technique caps out - that is not training",
       X("discMasteryFor(99,{win:true})"));
    ok(X("discMasteryFor(3,{win:true,boss:true})>discMasteryFor(3,{win:true})"), "a won boss fight pays extra");
    ok(X("discMasteryFor(3,{win:false,boss:true})===discMasteryFor(3,{win:false})"),
       "losing to the boss does not");
  }

  section("it pools across the roster instead of resetting");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const one = J("awardDiscMastery(SAVE,['jab','cross','jab'],{win:true})");
    ok(one.total > 0 && one.gained.boxing === one.total, "a boxer's fight trains boxing", one.total);
    const two = J("awardDiscMastery(SAVE,['jab','low_kick'],{win:false})");
    ok(X("discMasteryXp(SAVE,'boxing')") === one.gained.boxing + two.gained.boxing,
       "the next fighter's boxing lands on the same pile", X("discMasteryXp(SAVE,'boxing')"));
    ok(X("discMasteryXp(SAVE,'kickboxing')") === two.gained.kickboxing,
       "while a new art starts from nothing");
    ok(X("discMasteryXp(SAVE,'sumo')===0"), "and an art you have never thrown stays at zero");
    ok(two.ranks.every((r) => !!r.disc), "every row that comes back is addressed by its art id");
    const order = J("discMasteryIds()");
    let sorted = true, prev = -1;
    two.ranks.forEach((r) => { const i = order.indexOf(r.disc); if (i < prev) sorted = false; prev = i; });
    ok(sorted, "rows arrive in a stable order, not in hash order");
  }
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const plain = J("awardDiscMastery(SAVE,['jab','jab'],{win:true})");
    A.exec("SAVE=DEF_SAVE(); persist();");
    const fin = J("awardDiscMastery(SAVE,['jab','jab'],{win:true,finishDisc:'boxing'})");
    ok(fin.gained.boxing === plain.gained.boxing + X("DISC_CONFIG.finish"),
       "the art that finished the fight takes a small bonus",
       plain.gained.boxing + " -> " + fin.gained.boxing);
    A.exec("SAVE=DEF_SAVE(); persist();");
    ok(X("awardDiscMastery(SAVE,[],{win:true,finishDisc:'judo'}).gained.judo>0"),
       "a finish counts as having used the art");
    A.exec("SAVE=DEF_SAVE(); persist();");
    ok(X("awardDiscMastery(SAVE,[],{win:false,finishDisc:'judo'}).total===0"),
       "and there is no finish to credit on a defeat");
  }
  {
    ok(X("discMasteryRank(0).level===0"), "the grade readout starts at the bottom");
    ok(X("discMasteryRank(1e9).level===DISC_MASTERY_MAX"), "and tops out at master",
       X("discMasteryRank(1e9).name"));
    ok(X("discMasteryProgress(0)===0&&discMasteryProgress(1e9)===1"), "progress spans zero to one");
    ok(X("DISC_RANKS.every(r=>{const p=discMasteryProgress(r.need);return p>=0&&p<=1;})"),
       "and never leaves that range at a threshold");
    ok(X("discMasteryToNext(0)===DISC_RANKS[1].need"), "to-next at zero is the first threshold");
    ok(X("discMasteryToNext(1e9)===0"), "with nothing left to earn at master");
    A.exec("SAVE=DEF_SAVE(); SAVE.discMastery={boxing:DISC_CONFIG.xpMax}; persist();");
    A.exec("awardDiscMastery(SAVE,['jab','jab','jab'],{win:true});");
    ok(X("discMasteryXp(SAVE,'boxing')===DISC_CONFIG.xpMax"), "stored xp is bounded",
       X("discMasteryXp(SAVE,'boxing')"));
  }
  {
    // a save that lost the block entirely - which is what an old save, or a
    // sanitiser that does not know this key yet, hands over
    A.exec("SAVE=DEF_SAVE(); delete SAVE.discMastery; persist();");
    ok(X("discMasteryXp(SAVE,'boxing')===0&&discMasteryLevel(SAVE,'boxing')===0"),
       "a save with no block reads as untrained rather than throwing");
    ok(X("awardDiscMastery(SAVE,['jab'],{win:true}).total>0"), "and the next fight rebuilds it");
    ok(X("typeof SAVE.discMastery==='object'"), "as a plain object on the save");
  }

  section("the perks are real, small, and belong to the art");
  {
    A.exec("SAVE=DEF_SAVE(); SAVE.discMastery={boxing:9999}; persist();");
    ok(X("discMasteryLevel(SAVE,'boxing')===DISC_MASTERY_MAX"), "a mastered art is at the top");
    ok(X("discPowerMul(SAVE,TECH.jab)>1&&discAccBonus(SAVE,TECH.jab)>0&&" +
         "discStamCut(SAVE,TECH.jab)>0&&discSpeedMul(SAVE,TECH.jab)>1"),
       "and its techniques are sharper in all four ways");
    ok(X("discPowerMul(SAVE,TECH.low_kick)===1&&discAccBonus(SAVE,TECH.low_kick)===0"),
       "the art next door is untouched - this is not a global buff");
    ok(X("discPowerMul(SAVE,TECH.basic_guard)===1"),
       "and the fundamentals everyone owns are untouched too");
  }
  {
    // the budget. Permanent and free, so it must cost less than anything
    // the run has to pay for: one DRILL tier is +15% power and +5 acc, and
    // no camp benefit may multiply damage past 1.35x.
    const ranks = J("DISC_RANKS");
    const worstPow = Math.max.apply(null, ranks.map((r) => r.powMul));
    const worstSpd = Math.max.apply(null, ranks.map((r) => r.spdMul));
    ok(worstPow <= 1.1, "a mastered art never multiplies power past 1.10x", worstPow.toFixed(2) + "x");
    ok(worstSpd <= 1.06, "nor initiative past 1.06x", worstSpd.toFixed(2) + "x");
    ok(ranks.every((r) => r.acc <= 5), "accuracy tops out at one drill tier's worth",
       Math.max.apply(null, ranks.map((r) => r.acc)));
    ok(ranks.every((r) => r.stamCut <= 2), "and stamina relief stays inside a couple of points");
    ok(ranks.every((r) => r.prio === undefined), "priority is deliberately untouched");
    let mono = true, lastAcc = -1, lastPow = 0, lastCut = -1, lastSpd = 0;
    ranks.forEach((r) => {
      if (r.acc < lastAcc || r.powMul < lastPow || r.stamCut < lastCut || r.spdMul < lastSpd) mono = false;
      lastAcc = r.acc; lastPow = r.powMul; lastCut = r.stamCut; lastSpd = r.spdMul;
    });
    ok(mono, "and no grade is ever a downgrade");
  }

  section("mastering an art makes the draft offer it");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    ok(X("discDraftMul(SAVE,'judo')===1"), "an untrained art gets no help");
    A.exec("SAVE.discMastery={judo:9999}; persist();");
    ok(X("discDraftMul(SAVE,'judo')>1"), "a mastered one does", X("discDraftMul(SAVE,'judo')"));
    ok(X("discDraftMul(SAVE,TECH.o_soto_gari)===discDraftMul(SAVE,'judo')"),
       "and the hook takes a technique as readily as an art id");
    let mono = true, prev = 0, top = 0;
    J("DISC_RANKS").forEach((r) => {
      A.exec("SAVE.discMastery={judo:" + r.need + "};");
      const m = X("discDraftMul(SAVE,'judo')");
      if (m < prev) mono = false;
      prev = m; top = m;
    });
    ok(mono, "the multiplier only rises with the grade");
    // draft.js's own shades: ownMul 2.6, invested cap 3.4, gapMul 1.35,
    // doorMul 2.2. This one sits in the same expression, so it is capped
    // under the loudest single shade already there.
    ok(top <= X("DRAFT_CONFIG.doorMul"),
       "and never shouts louder than doorMul, the biggest shade in draft.js",
       top + " vs " + X("DRAFT_CONFIG.doorMul"));
    ok(X("discMasteryIds().every(id=>discDraftMul({discMastery:{}},id)===1)"),
       "so a fresh save's offers are bit-for-bit what they were before this existed");
  }

  section("the readout is addressable and honest");
  {
    A.exec("SAVE=DEF_SAVE(); SAVE.discMastery={boxing:9999,judo:100}; persist();");
    const rows = J("discMasteryRows(SAVE)");
    ok(rows.length === X("discMasteryIds().length"), "one row per art", rows.length);
    ok(rows.every((r) => !!r.disc && !!r.name && !!r.rank), "every row carries an id, a name and a grade");
    ok(new Set(rows.map((r) => r.disc)).size === rows.length, "and no art appears twice");
    ok(rows[0].disc === "boxing" && rows[1].disc === "judo", "best first",
       rows.slice(0, 2).map((r) => r.disc).join(","));
    ok(rows[0].level > rows[1].level, "and the grades agree with the order");
    ok(X("discMasterySummary(DEF_SAVE())").indexOf("NO ART") >= 0, "a fresh save says so",
       X("discMasterySummary(DEF_SAVE())"));
    ok(/BOXING/.test(X("discMasterySummary(SAVE)")), "and a trained one names the art",
       X("discMasterySummary(SAVE)"));
  }
  {
    // pacing: the complaint this axis exists to answer is that a black belt
    // is 36 fights with ONE fighter. The first grade here has to arrive fast
    // and the last one has to stay a long climb.
    const perFight = X("discMasteryFor(DISC_CONFIG.useCap,{win:true})");
    const first = Math.ceil(X("DISC_RANKS[1].need") / perFight);
    const last = Math.ceil(X("DISC_RANKS[DISC_MASTERY_MAX].need") / perFight);
    ok(first <= 3, "the first grade in an art arrives inside three fights", first + " fights");
    ok(last >= 20 && last <= 60, "and mastering one is a real climb", last + " fights");
    A.exec("SAVE=DEF_SAVE(); persist();");
    let n = 0;
    while (X("discMasteryLevel(SAVE,'boxing')") < X("DISC_MASTERY_MAX") && n < 500) {
      A.exec("awardDiscMastery(SAVE,{boxing:DISC_CONFIG.useCap},{win:true});");
      n++;
    }
    ok(n === last, "and the ladder actually pays out at that rate", n + " fights to master");
  }

  section("nothing about it gates a fighter or a fight");
  {
    // rule 3: everyone is playable from a fresh save. A second progression
    // axis is exactly the kind of thing that quietly breaks that.
    A.exec("SAVE=DEF_SAVE(); persist();");
    const openFresh = X("FIGHTERS.length");
    const kitFresh = X("knownTechs(0,1).join(',')");
    A.exec("SAVE=DEF_SAVE(); SAVE.discMastery={boxing:9999,bjj:9999}; persist();");
    ok(X("FIGHTERS.length") === openFresh, "the roster does not change size with mastery");
    ok(X("knownTechs(0,1).join(',')") === kitFresh,
       "and a level-1 movelist is the same trained or untrained");
    A.exec("SAVE=DEF_SAVE(); persist();");
    ok(X("DISC_RANKS.every(r=>!r.unlock&&!r.gate&&!r.requires)"),
       "no grade unlocks, gates or requires anything");
  }
};
