/* =====================================================================
   Aqua Zero Heavens Arena - Exhibition / versus contracts
   Luminara Digital

   Exhibition is the free duel lab: any fighter, tale of the tape, no
   ladder points, rematch / best-of-3, CPU controls, rule chips, handicap,
   venue, bout codes, practice overlay, and a career ledger.
   ===================================================================== */
module.exports = function (h) {
  const { api: A, ok, section, frames, press, scene, phase } = h;

  section("exhibition is on the menu and picks anyone");
  {
    A.exec("SAVE=DEF_SAVE(); persist(); G.scene=S.MENU; G.menuSel=0;");
    const items = A.menuItems();
    const vs = items.find((it) => it[2] === "vs");
    ok(!!vs, "exhibition is listed");
    ok(/lab duel|no rank/i.test(vs[1]), "tagline still promises a free lab", vs[1]);
    A.exec("G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=10;");
    press("a");
    ok(A.G.selMode === "vs2" && A.G.vsP1 === 10, "first pick seats player one");
    A.exec("G.sel=17;");
    press("a");
    ok(scene() === "DUEL" && phase() === "TAPE", "second pick opens the tale of the tape", scene() + "/" + phase());
    ok(A.G.duel.p.fid === 10 && A.G.duel.e.fid === 17, "both chosen fighters are seated");
    ok(!!A.G.duel.exhibition && !A.G.duel.ranked && !A.G.duel.hotseat,
      "it is a plain exhibition, not ranked or hot-seat");
  }

  section("nothing on the ladder moves");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    if (A.ExhibitionMode) A.ExhibitionMode.clearSeries();
    const before = A.myRanking().promotionPoints;
    A.exec("startExhibitionBout(0,1,{});");
    A.exec("G.duel.e.hp=0; G.duel.ph=D.END; endDuel(G.duel);");
    ok(A.G.result && A.G.result.kind === "vswin" && A.G.result.exhibition,
      "a win records as an exhibition result");
    ok(A.myRanking().promotionPoints === before, "and the ladder does not move", A.myRanking().promotionPoints);
    ok((A.getSave().rec.wins || 0) >= 1, "career wins still count");
    ok(A.masteryXp(A.getSave(), 0) >= 18, "fighter mastery still accrues", A.masteryXp(A.getSave(), 0));
    ok((A.getSave().exhib && A.getSave().exhib.bouts) >= 1, "exhibition career ledger moves");
  }

  section("difficulty reaches the opponent");
  {
    A.exec("SAVE=DEF_SAVE(); SAVE.diff=0; persist(); G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=0;");
    press("a");
    A.exec("G.sel=1;");
    press("a");
    const soft = A.G.duel.e.atkMul;
    A.exec("SAVE=DEF_SAVE(); SAVE.diff=2; persist(); G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=0;");
    press("a");
    A.exec("G.sel=1;");
    press("a");
    const hard = A.G.duel.e.atkMul;
    ok(hard > soft, "MAIN EVENT hits harder than ROOKIE in exhibition", soft.toFixed(3) + " -> " + hard.toFixed(3));
  }

  section("a saved Deck Builder loadout is what you fight with");
  {
    A.exec("SAVE=DEF_SAVE(); persist();");
    const db = A.DeckBuilder;
    ok(!!db, "DeckBuilder is in the page");
    const sample = db.getDefaultDeck(0).slice(0, 12);
    while (sample.length < 12) sample.push("jab");
    const legal = db.validateDeck(sample);
    ok(legal && legal.ok, "test loadout is within budget", legal && legal.error);
    const saved = db.saveCustomDeck(0, "EXHIB LOADOUT", sample);
    ok(saved && saved.ok, "loadout saves", saved && saved.error);
    A.exec("startExhibitionBout(0,1,{});");
    const ids = A.G.duel.p.techs.map((t) => (t && t.id) || t);
    const covered = sample.every((id) => ids.indexOf(id) >= 0);
    ok(covered, "every card in the custom loadout is in the fight kit", ids.slice(0, 6).join(","));
    ok(ids.length === sample.length, "stock techniques are not mixed back in", ids.length);
    db.deleteCustomDeck(0);
  }

  section("CPU level, archetype, venue, rules and handicap");
  {
    const EM = A.ExhibitionMode;
    ok(!!EM, "ExhibitionMode ships");
    EM.setSettings({ cpuLv: 3, arch: "grappler", venue: "heavens", rule: "sudden", handicap: "under", overlay: true });
    const opts = EM.duelOpts(0, 1, {});
    ok(opts.oppLv === 3, "CPU level reaches duel opts", opts.oppLv);
    ok(opts.arch === "grappler", "archetype is forced", opts.arch);
    ok(opts.venueId === "heavens", "venue is forced", opts.venueId);
    ok(opts.exhib && opts.exhib.rule === "sudden", "sudden death rule is set");
    ok(opts.p1hp < A.hpOf(0), "sudden death cuts player HP", opts.p1hp + " < " + A.hpOf(0));
    ok(opts.exhib.overlay === true, "overlay flag rides along");
    A.exec("SAVE=DEF_SAVE(); persist();");
    EM.setSettings({ cpuLv: 3, arch: "grappler", venue: "heavens", rule: "nosig", handicap: "even", overlay: false });
    A.exec("startExhibitionBout(0,1,{});");
    ok(A.G.duel.venue && A.G.duel.venue.id === "heavens", "forced venue seats the room", A.G.duel.venue && A.G.duel.venue.id);
    ok(A.G.duel.arch === "grappler", "forced archetype seats the AI");
    ok(A.G.duel.p.sig == null, "no-signature rule locks the hero finisher");
    EM.setSettings({ rule: "long", cpuLv: 9, arch: "auto", venue: "auto", handicap: "even" });
    A.exec("startExhibitionBout(0,1,{});");
    const ranges = A.G.duel.p.techs.map((id) => {
      const t = A.TECH[id]; return t && t.range;
    }).filter((r) => r && r !== "ANY");
    ok(ranges.every((r) => r !== "CLINCH" && r !== "GROUND"),
      "long-range rule strips clinch and ground techs", ranges.slice(0, 6).join(","));
  }

  section("bout codes round-trip");
  {
    const EM = A.ExhibitionMode;
    EM.setSettings({ cpuLv: 4, arch: "counter", venue: "gym", rule: "standard", handicap: "favor", series: "bo3" });
    const code = EM.encodeBout(2, 5);
    ok(!!code && code.indexOf("AZX1-") === 0, "bout code is prefixed", code && code.slice(0, 12));
    const decoded = EM.decodeBout(code);
    ok(!!decoded && decoded.p1 === 2 && decoded.p2 === 5, "fighters survive the code");
    ok(decoded.settings.cpuLv === 4 && decoded.settings.arch === "counter",
      "settings survive the code", JSON.stringify(decoded.settings));
    ok(EM.decodeBout("garbage") === null, "junk codes are rejected");
    A.exec("SAVE=DEF_SAVE(); persist(); G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=0;");
    A.exec("window.__boutCode=" + JSON.stringify(code) + "; window.prompt=function(){return window.__boutCode;};");
    press("code");
    ok(scene() === "DUEL" && A.G.duel.p.fid === 2 && A.G.duel.e.fid === 5,
      "O imports a bout code straight into a duel", scene() + " " + (A.G.duel && A.G.duel.p.fid));
    ok(A.G.duel.oppLv === 4, "imported CPU level sticks", A.G.duel.oppLv);
    A.exec("delete window.prompt; delete window.__boutCode;");
  }

  section("rematch and best of 3");
  {
    const EM = A.ExhibitionMode;
    A.exec("SAVE=DEF_SAVE(); persist();");
    EM.setSettings(EM.defSettings());
    EM.setSettings({ series: "bo3" });
    A.exec("startExhibitionBout(0,1,{});");
    A.exec("G.duel.e.hp=0; G.duel.ph=D.END; endDuel(G.duel);");
    ok(A.G.result.series && A.G.result.series.format === "bo3", "series snapshot lands on the result");
    ok(A.G.result.series.score[0] === 1 && !A.G.result.series.done, "first win is not the series yet");
    press("a");
    ok(scene() === "DUEL" && !!A.G.duel.exhibition, "A continues the series into the next bout", scene());
    A.exec("G.duel.e.hp=0; G.duel.ph=D.END; endDuel(G.duel);");
    ok(A.G.result.series && A.G.result.series.done && A.G.result.series.winner === "p",
      "two wins close a best of 3");
    press("b");
    ok(scene() === "MENU", "B returns to the menu after a series", scene());

    A.exec("SAVE=DEF_SAVE(); persist();");
    EM.setSettings({ series: "single" });
    A.exec("startExhibitionBout(3,4,{});");
    A.exec("G.duel.e.hp=0; G.duel.ph=D.END; endDuel(G.duel);");
    press("a");
    ok(scene() === "DUEL" && A.G.duel.p.fid === 3 && A.G.duel.e.fid === 4,
      "single-bout A rematches the same pair");
    ok(!!A.G.duel.exhibRematch, "rematch is flagged for the career ledger");
  }

  section("random select and mirror badge path");
  {
    A.exec("SAVE=DEF_SAVE(); persist(); G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=0;");
    press("rand");
    ok(A.G.sel >= 0 && A.G.sel < A.FIGHTERS.length, "R picks a fighter on vs1", A.G.sel);
    const pick = A.exec("selList()")[A.G.sel];
    press("a");
    press("rand");
    ok(A.G.selMode === "vs2", "still choosing the opponent");
    A.exec("G.sel=selList().indexOf(" + pick + ");");
    ok(A.exec("selList()")[A.G.sel] === pick, "mirror pairing is selectable");
  }

  section("back out and forfeit behave");
  {
    A.exec("SAVE=DEF_SAVE(); persist(); G.selMode='vs1'; G.vsHotseat=false; G.scene=S.SELECT; G.sel=0;");
    press("a");
    ok(A.G.selMode === "vs2", "second pick is waiting");
    press("b");
    ok(A.G.selMode === "vs1" && scene() === "SELECT", "B returns to player one", A.G.selMode + "/" + scene());
    press("b");
    ok(scene() === "MENU", "B again returns to the menu");

    A.exec("startExhibitionBout(2,3,{});");
    frames(700);
    press("b");
    A.exec("G.duel.menuSel=2;");
    press("a"); press("a");
    ok(scene() === "RESULT" && A.G.result.kind === "vsloss" && A.G.result.exhibition,
      "forfeit resolves as an exhibition loss");
    press("b");
    ok(scene() === "MENU", "B drops you back on the menu after a forfeit");
  }
};
