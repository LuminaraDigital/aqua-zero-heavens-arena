/* =====================================================================
   Aqua Zero Heavens Arena - the tale of the tape
   Luminara Digital

   The matchup card has to survive the states nobody plays in but
   everybody reaches: a fresh save with no records, a fighter with no
   dossier, the AZX FORCE stand-in that has no id at all, and the boss
   who arrives as {boss:true} with nothing else. Every check below is
   either "the edge matches the real numbers" or "this degraded instead
   of throwing".
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section, exec } = h;

  /* the two corners of every row, as raw numbers, for cross-checking */
  const rowOf = (rows, key) => rows.filter((r) => r.key === key)[0];
  const clean = (s) => typeof s === "string" && s.length > 0 &&
    s.indexOf("undefined") < 0 && s.indexOf("NaN") < 0 && s.indexOf("null") < 0;
  /* rankTitle() is what the module calls, but rankByIndex never returns
     null, so the title off the table is the same string and costs the
     suite one fewer exported symbol to depend on */
  const gradeAt = (i) => A.rankByIndex(i).title;

  section("the rows are a real comparison");
  {
    exec("SAVE=DEF_SAVE();");
    const rows = A.tapeRows(0, 20);
    ok(Array.isArray(rows), "tapeRows returns an array");
    ok(rows.length >= 8 && rows.length <= 10, "the card is one screen of rows", rows.length);

    const keys = rows.map((r) => r.key).join(",");
    ["power", "chin", "cond", "speed", "reach", "ground", "discs", "mastery", "h2h"]
      .forEach((k) => ok(keys.indexOf(k) >= 0, "the card compares " + k, keys));

    ok(rows.every((r) => typeof r.label === "string" && r.label.length > 0), "every row is labelled");
    ok(rows.every((r) => clean(r.left) && clean(r.right)),
       "no cell prints undefined, NaN or null",
       rows.map((r) => r.left + "|" + r.right).join(" "));
    ok(rows.every((r) => r.edge === "l" || r.edge === "r" || r.edge === null),
       "edge is only ever l, r or null");
    /* the order IS the design - damage first, history last */
    ok(rows[0].key === "power", "power leads the card", rows[0].key);
    ok(rows[rows.length - 1].key === "h2h", "the record is the last word", rows[rows.length - 1].key);
  }
  {
    /* every edge must be derivable from the two numbers on the same row,
       or the highlight is decorative */
    const rows = A.tapeRows(0, 20);
    let sound = true, why = "";
    rows.forEach((r) => {
      if (r.lv === null || r.rv === null) {
        if (r.edge !== null) { sound = false; why = r.key + " claimed an edge with a missing number"; }
        return;
      }
      const want = r.lv > r.rv ? "l" : (r.lv < r.rv ? "r" : null);
      if (r.edge !== null && r.edge !== want) { sound = false; why = r.key + " " + r.lv + " vs " + r.rv + " -> " + r.edge; }
    });
    ok(sound, "every edge points at the larger of the two numbers", why);
  }
  {
    /* reach is the one row taken straight off the dossier, so it is the
       one that can be checked against the source without arithmetic.
       Read through BIOS rather than bioOf: every symbol this suite touches
       has to be one the harness already exports, or the suite dies on its
       first call and the other ninety-odd checks never run at all. */
    const a = A.BIOS[A.FIGHTERS[0].name], b = A.BIOS[A.FIGHTERS[20].name];
    ok(!!a && !!b, "both dossiers exist to check against");
    const r = rowOf(A.tapeRows(0, 20), "reach");
    ok(r.lv === a.rch && r.rv === b.rch, "reach is the dossier's own number", r.lv + " vs " + r.rv);
    ok(r.edge === (a.rch > b.rch ? "l" : a.rch < b.rch ? "r" : null),
       "and the longer man owns the row", r.edge);
    ok(r.left.indexOf('"') > 0, "reach is printed in inches", r.left);
  }
  {
    /* a one-point dossier gap is inside the roster audit's own noise, so
       it must not light a row up */
    const m = A.TAPE_METRICS.filter((x) => x.key === "power")[0];
    ok(m.tol >= 1, "attribute rows carry a deadband", m.tol);
    ok(A.tapeEdgeOf(m, 90, 90 + m.tol) === null, "a gap inside the deadband is a tie");
    ok(A.tapeEdgeOf(m, 90, 90 + m.tol + 1) === "r", "and one point past it is not");
    const reach = A.TAPE_METRICS.filter((x) => x.key === "reach")[0];
    ok(reach.tol === 0, "every inch of reach is real", reach.tol);
  }

  section("the card is symmetric");
  {
    exec("SAVE=DEF_SAVE();");
    const a = A.tapeRows(3, 9), b = A.tapeRows(9, 3);
    const flip = (e) => (e === "l" ? "r" : e === "r" ? "l" : null);
    ok(a.every((r, i) => b[i].key === r.key), "the row order does not depend on the corners");
    ok(a.every((r, i) => b[i].edge === flip(r.edge)),
       "swapping the corners mirrors every edge");
    ok(a.every((r, i) => b[i].lv === r.rv && b[i].rv === r.lv), "and mirrors every number");
  }
  {
    const l = A.tapeAdvantage(3, 9).lean, r = A.tapeAdvantage(9, 3).lean;
    ok(Math.abs(l + r - 1) < 1e-9, "the lean mirrors exactly", l + " + " + r);
  }
  {
    /* a fighter against himself is the only guaranteed dead heat */
    const rows = A.tapeRows(7, 7);
    ok(rows.every((r) => r.edge === null), "nobody has an edge on himself");
    const adv = A.tapeAdvantage(7, 7);
    ok(adv.lean === 0.5 && adv.favours === null, "and the bar sits dead centre", adv.lean);
    ok(clean(adv.reason), "with a reason that still reads", adv.reason);
  }

  section("the lean is a lean, never a verdict");
  {
    exec("SAVE=DEF_SAVE();");
    let lo = 1, hi = 0;
    for (let i = 0; i < A.FIGHTERS.length; i++) {
      for (let j = 0; j < A.FIGHTERS.length; j += 5) {
        const v = A.tapeAdvantage(i, j).lean;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    ok(lo > 0 && hi < 1, "no pairing on the roster reaches 0 or 1", lo + " .. " + hi);
    ok(hi - lo > 0.05, "and the bar actually moves across the roster", (hi - lo).toFixed(3));
  }
  {
    /* the bar has to agree with the rows it was built from */
    const adv = A.tapeAdvantage(12, 20);          // a pure grappler against the champion
    const edges = adv.rows.filter((r) => r.edge);
    const forR = edges.filter((r) => r.edge === "r").length;
    const forL = edges.filter((r) => r.edge === "l").length;
    ok(forR > forL ? adv.lean < 0.5 : true, "the bar leans the way the rows do",
       forL + "l/" + forR + "r lean " + adv.lean);
    ok(adv.favours === null || adv.reason.indexOf(" ") >= 0 || adv.reason.length > 2,
       "a leaning bar names its reason", adv.reason);
  }
  {
    /* an opponent with no dossier is not a walkover - it is an unknown,
       and one comparable row must not produce a confident bar */
    const known = A.tapeAdvantage(0, 20);
    const blind = A.tapeAdvantage(0, { tf: true }, { rightHp: 40 });
    ok(blind.confidence < known.confidence, "an unknown opponent scores low confidence",
       blind.confidence + " vs " + known.confidence);
    ok(blind.lean > 0.5 && blind.lean < 0.8,
       "and a huge HP edge over a stranger is still only a lean", blind.lean);
  }

  section("hp overrides - adventure walks in hurt");
  {
    exec("SAVE=DEF_SAVE();");
    const full = A.tapeRows(3, 3);
    ok(rowOf(full, "cond").edge === null, "at full health it is a dead heat");
    const hurt = A.tapeRows(3, 3, { leftHp: 20, leftMaxHp: 140 });
    const c = rowOf(hurt, "cond");
    ok(c.lv === 20, "the current-HP override reaches the row", c.lv);
    ok(c.left.indexOf("20") === 0 && c.left.indexOf("140") > 0,
       "and prints as current over max", c.left);
    ok(c.edge === "r", "a hurt fighter loses the conditioning row", c.edge);
    ok(A.tapeAdvantage(3, 3, { leftHp: 20, leftMaxHp: 140 }).lean < 0.5,
       "and the bar notices");
    /* the same override arriving on the side descriptor, the way the
       adventure field already carries it */
    const viaSpec = A.tapeRows({ fid: 3, hp: 20, maxhp: 140 }, 3);
    ok(rowOf(viaSpec, "cond").lv === 20, "a side descriptor may carry its own hp");
  }

  section("head to head, from a save that may have nothing in it");
  {
    exec("SAVE=DEF_SAVE();");
    const r = rowOf(A.tapeRows(0, 5), "h2h");
    ok(r.lv === 0 && r.rv === 0, "a fresh save is an honest 0-0", r.left + " / " + r.right);
    ok(r.edge === null, "and nobody leads it");
    exec("SAVE.fr[5]={w:3,l:1};");
    const r2 = rowOf(A.tapeRows(0, 5), "h2h");
    ok(r2.lv === 3 && r2.rv === 1, "the save's record reaches the row", r2.lv + "-" + r2.rv);
    ok(r2.edge === "l", "and the player's wins sit on the player's side", r2.edge);
    /* an explicit record beats the save, so a replay or a hotseat card
       can state its own history */
    const r3 = rowOf(A.tapeRows(0, 5, { record: { w: 0, l: 9 } }), "h2h");
    ok(r3.lv === 0 && r3.rv === 9, "an explicit record overrides the save", r3.right);
  }
  {
    /* no save object at all - the module must not assume it is inside a
       booted game */
    exec("SAVE=null;");
    const rows = A.tapeRows(0, 5);
    ok(rowOf(rows, "h2h").edge === null, "with no save there is no head to head");
    ok(rowOf(rows, "h2h").left === A.TAPE_BLANK, "and the cell prints the blank", rowOf(rows, "h2h").left);
    ok(rowOf(rows, "power").lv !== null, "but the dossier rows still work");
    ok(clean(A.tapeStoryline(0, 5).line), "and the storyline still speaks");
    ok(A.tapeHeader(0).name.length > 0, "and the header still names him");
    exec("SAVE=DEF_SAVE();");
  }
  {
    exec("SAVE=DEF_SAVE(); SAVE.mastery={5:700};");
    const r = rowOf(A.tapeRows(0, 5), "mastery");
    ok(r.rv === A.masteryLevel(A.getSave(), 5), "the mastery row is the real level", r.rv);
    ok(r.edge === "r", "and a black belt outranks an unranked fighter", r.edge);
    ok(r.right !== A.TAPE_BLANK && clean(r.right), "printed by belt name", r.right);
    exec("SAVE=DEF_SAVE();");
  }

  section("the pseudo-opponents - AZX FORCE and the boss");
  {
    exec("SAVE=DEF_SAVE();");
    /* the tf stand-in borrows another fighter's ARTWORK; reading stats
       off that art would print somebody else's reach under this name */
    const rows = A.tapeRows(0, { tf: true, art: 5, lv: 3 }, { rightHp: 70 });
    ok(rows.every((r) => clean(r.left) && clean(r.right)), "the AZX FORCE card still draws",
       rows.map((r) => r.right).join(" "));
    ok(rowOf(rows, "reach").rv === null && rowOf(rows, "reach").right === A.TAPE_BLANK,
       "it has no reach on file");
    ok(rowOf(rows, "reach").edge === null, "so nobody wins the reach row");
    ok(rowOf(rows, "cond").rv === 70, "but the hp it was given is real", rowOf(rows, "cond").rv);
    const hdr = A.tapeHeader({ tf: true, lv: 3 }, { side: "r", rightHp: 70 });
    ok(hdr.known === false && hdr.name === "AZX FORCE", "the header names it and admits it has nothing", hdr.name);
    ok(hdr.disciplines === "NO DOSSIER ON FILE" && hdr.ranges === "" && hdr.archetype === "",
       "it claims no art, no home range and no gameplan", hdr.disciplines + "|" + hdr.ranges);
    ok(hdr.level === "LV 3", "and still carries its level", hdr.level);
    const st = A.tapeStoryline(0, { tf: true });
    ok(st.key === "azx" && clean(st.line), "and it gets its own line", st.line);
  }
  {
    /* the champion arrives as {boss:true} with no id, exactly as the
       adventure field hands him over */
    const hdr = A.tapeHeader({ boss: true }, { side: "r" });
    ok(hdr.known === true, "the boss resolves to a real dossier");
    ok(hdr.fid === A.BOSS_ID, "and to the roster's boss index", hdr.fid);
    const rows = A.tapeRows(0, { boss: true });
    ok(rowOf(rows, "power").rv !== null, "so his rows are real numbers");
    ok(rows.every((r) => clean(r.left) && clean(r.right)), "and the card is complete");
  }
  {
    /* an index nobody has a dossier for - the roster has been cut before */
    const rows = A.tapeRows(999, 998);
    ok(rows.every((r) => clean(r.left) && clean(r.right)), "two ghosts still produce a card");
    ok(rows.every((r) => r.edge === null), "with no edges invented from nothing");
    const adv = A.tapeAdvantage(999, 998);
    ok(adv.lean === 0.5 && clean(adv.reason), "and a dead-centre bar", adv.reason);
    const hdr = A.tapeHeader(999);
    ok(hdr.known === false && clean(hdr.name), "and a header that says nothing false", hdr.name);
    /* the hard half of degrading: the globals underneath all answer for a
       fighter who does not exist, so a blank is the only honest cell */
    ok(rowOf(rows, "discs").lv === null && rowOf(rows, "discs").left === A.TAPE_BLANK,
       "a ghost is not credited with the arts disciplinesOf invents", rowOf(rows, "discs").left);
    ok(rowOf(rows, "cond").lv === null && rowOf(rows, "cond").left === A.TAPE_BLANK,
       "nor with the flat hp hpOf invents", rowOf(rows, "cond").left);
    ok(hdr.archetype === "" && hdr.tell === "" && hdr.tag === "",
       "and the header names no gameplan it cannot read off a dossier",
       hdr.archetype + "/" + hdr.tag);
    ok(hdr.disciplines === "NO DOSSIER ON FILE", "it says so instead", hdr.disciplines);
    ok(hdr.lines.every((l) => clean(l.value)), "every line it does hand over is real",
       hdr.lines.map((l) => l.value).join("|"));
    /* the same fighter with a caller-supplied hp: that number IS real,
       whatever the index is, so it must survive the gate above */
    ok(rowOf(A.tapeRows(999, 998, { leftHp: 55 }), "cond").lv === 55,
       "but an hp the caller states is still honoured");
  }
  {
    /* nothing whatsoever to compare: no dossier on either side and no hp
       to fall back on. The bar must say so rather than pick a winner */
    const adv = A.tapeAdvantage(0, { tf: true });
    ok(adv.lean === 0.5 && adv.favours === null, "an unknowable pairing is dead even", adv.lean);
    ok(adv.confidence === 0, "with zero confidence", adv.confidence);
    ok(clean(adv.reason) && adv.reason !== "EVEN ON PAPER",
       "and a reason that admits it is ignorance, not parity", adv.reason);
    ok(Array.isArray(adv.rows) && adv.rows.length > 0, "the rows still come back to draw");
  }

  section("the header is a finished identity block");
  {
    exec("SAVE=DEF_SAVE();");
    const hdr = A.tapeHeader(0, { self: true, stage: 1 });
    ok(clean(hdr.name), "it has a name", hdr.name);
    ok(hdr.disciplines.indexOf("/") > 0 || hdr.disciplines.length > 0,
       "it has the discipline line", hdr.disciplines);
    ok(hdr.ranges.length > 0, "it says where he wants the fight", hdr.ranges);
    ok(hdr.archetype.length > 0 && hdr.tell.length > 0, "it names the gameplan", hdr.archetype);
    ok(hdr.tag.length > 0, "it carries the trait tag", hdr.tag);
    ok(hdr.hp.indexOf("HP") > 0, "it states the hp", hdr.hp);
    ok(Array.isArray(hdr.lines) && hdr.lines.length > 0, "and it hands the renderer a list");
    ok(hdr.lines.every((l) => clean(l.value)), "every line of which is drawable",
       hdr.lines.map((l) => l.value).join("|"));
  }
  {
    /* the discipline line must match the fighter's real arts, not a
       guess - this is the row people cross-check against the dossier */
    const discs = A.disciplinesOf(0);
    const hdr = A.tapeHeader(0);
    ok(discs.every((d) => hdr.disciplines.indexOf(A.DISCIPLINES[d].name) >= 0),
       "every art the fighter owns is named", hdr.disciplines);
    const home = A.homeRanges(discs);
    ok(home.every((r) => hdr.ranges.indexOf(A.RANGE_LABEL[r]) >= 0),
       "and the home ranges use the range strip's own wording", hdr.ranges);
  }
  {
    /* the record means two different things and the label has to say
       which, or the player reads a career record that does not exist */
    exec("SAVE=DEF_SAVE(); SAVE.rec.wins=7; SAVE.rec.losses=2; SAVE.fr[5]={w:1,l:4};");
    const mine = A.tapeHeader(0, { self: true });
    ok(mine.record === "7-2" && mine.recordLabel === "YOUR RECORD",
       "your own corner shows your record", mine.record + " " + mine.recordLabel);
    const theirs = A.tapeHeader(5, { side: "r" });
    ok(theirs.record === "1-4" && theirs.recordLabel === "VS YOU",
       "their corner shows your history with them", theirs.record + " " + theirs.recordLabel);
    exec("SAVE=DEF_SAVE();");
  }
  {
    /* a ladder grade outranks a belt, because in a ranked match the
       grade is the thing being played for */
    const plain = A.tapeHeader(5, { side: "r" });
    ok(plain.badgeKind === "mastery", "with no grade the badge is the belt", plain.badgeKind);
    const graded = A.tapeHeader(5, { side: "r", rankIndex: 14 });
    ok(graded.badgeKind === "rank", "with a grade the badge is the grade", graded.badgeKind);
    ok(graded.badge === gradeAt(14), "and it is the real rank title", graded.badge);
    const viaOpp = A.tapeHeader(5, { side: "r", oppRankIndex: 9 });
    ok(viaOpp.badgeKind === "rank", "the ladder's own opt name works too", viaOpp.badge);
  }

  section("the storyline picks the most interesting sentence");
  {
    exec("SAVE=DEF_SAVE();");
    /* a declared rivalry should quote the reason, because the whole
       point of RIVALRIES is that you could have worked it out yourself */
    const why = A.rivalryReason(0, 20);
    ok(!!why, "the roster has a rivalry to quote");
    const st = A.tapeStoryline(0, 20);
    ok(st.key === "rival" && st.line === why, "a rivalry quotes its own reason", st.key);
    ok(st.tag.length > 0, "and gets a banner", st.tag);
  }
  {
    /* the man who beat you inside this run outranks written history */
    const st = A.tapeStoryline(0, 20, { nemesis: true });
    ok(st.key === "nemesis", "the nemesis beats the rivalry", st.key);
    ok(st.line === A.storyOf(20).grudge, "and speaks in his own grudge line");
    const byId = A.tapeStoryline(0, 5, { nemesisFid: 5 });
    ok(byId.key === "nemesis", "the nemesis may be named by id", byId.key);
    const other = A.tapeStoryline(0, 5, { nemesisFid: 8 });
    ok(other.key !== "nemesis", "and a different nemesis does not stick to this fight", other.key);
    /* G.adv.nemesis is an INDEX, d.nemesis is a boolean. A caller who
       hands over the field's own value must not get a silent false -
       index 0 is a real fighter, so that bug would hide on most of the
       roster and show up only on one man. */
    ok(A.tapeStoryline(1, 5, { nemesis: 5 }).key === "nemesis",
       "the adventure field's own index works under either opt name");
    ok(A.tapeStoryline(1, 0, { nemesis: 0 }).key === "nemesis",
       "including index 0, which is a fighter and not a falsy value");
    ok(A.tapeStoryline(1, 5, { nemesis: 8 }).key !== "nemesis",
       "and a stale index still does not stick");
    ok(A.tapeStoryline(1, 5, { nemesis: false }).key !== "nemesis",
       "an explicit false is not a nemesis either");
  }
  {
    /* 5 is not a rival of 0, so the record decides */
    ok(A.rivalryReason(0, 5) === null, "the control pairing has no rivalry");
    exec("SAVE=DEF_SAVE(); SAVE.fr[5]={w:0,l:2};");
    const g = A.tapeStoryline(0, 5);
    ok(g.key === "grudge" && g.line === A.storyOf(5).grudge,
       "a man who has beaten you says the grudge line", g.key);
    exec("SAVE.fr[5]={w:3,l:0};");
    const r = A.tapeStoryline(0, 5);
    ok(r.key === "rematch" && r.line === A.calloutFor(5, { beatenBefore: true }),
       "a man you have beaten wants it back", r.key);
    exec("SAVE.fr[5]={w:2,l:2};");
    ok(A.tapeStoryline(0, 5).key === "grudge",
       "and a loss outranks a win when the record runs both ways");
    exec("SAVE=DEF_SAVE();");
  }
  {
    const t = A.tapeStoryline(0, 5, { title: true, titleRankIndex: 14 });
    ok(t.key === "title", "a title on the line is worth saying", t.key);
    ok(t.line.indexOf(gradeAt(14)) >= 0, "and it names the grade", t.line);
    const bare = A.tapeStoryline(0, 5, { title: true });
    ok(clean(bare.line), "even with no grade to name", bare.line);
  }
  {
    const f = A.tapeStoryline(0, 5);
    ok(f.key === "first" && f.line === A.calloutFor(5, { first: true }),
       "a first meeting gets the callout", f.key);
  }
  {
    /* the priority order itself, stated once so it cannot drift */
    const order = ["nemesis", "rival", "grudge", "rematch", "title", "first"];
    exec("SAVE=DEF_SAVE(); SAVE.fr[20]={w:1,l:1}; SAVE.fr[5]={w:1,l:1};");
    ok(A.tapeStoryline(0, 20, { nemesis: true, title: true }).key === order[0], "nemesis first");
    ok(A.tapeStoryline(0, 20, { title: true }).key === order[1],
       "then the rivalry, even with a record and a title in the way");
    ok(A.tapeStoryline(0, 5, { title: true }).key === order[2], "then the history");
    exec("SAVE=DEF_SAVE();");
    ok(A.tapeStoryline(0, 5, { title: true }).key === order[4], "then what is on the line");
    ok(A.tapeStoryline(0, 5).key === order[5], "then the introduction");
  }
  {
    /* whatever happens, one sentence comes back */
    let allSpoke = true, bad = "";
    for (let i = 0; i < A.FIGHTERS.length; i++) {
      const st = A.tapeStoryline(0, i);
      if (!st || !clean(st.line) || typeof st.key !== "string") { allSpoke = false; bad = String(i); break; }
    }
    ok(allSpoke, "every opponent on the roster has something to say", bad);
    const ghost = A.tapeStoryline(999, 998);
    ok(clean(ghost.line), "and so does a pairing with no dossiers at all", ghost.line);
  }

  section("house rules");
  {
    /* the build escapes non-ASCII, but the strings this file invents
       should never need it - roster names are exempt, they come from the
       dossiers */
    const invented = [];
    A.tapeRows(0, 20).forEach((r) => { invented.push(r.label, r.left, r.right); });
    ["nemesis", "rival", "grudge", "rematch", "title", "first"].forEach(() => {});
    invented.push(A.tapeStoryline(0, { tf: true }).line);
    invented.push(A.tapeAdvantage(0, 20).reason);
    invented.push(A.tapeAdvantage(7, 7).reason);
    invented.push(A.TAPE_BLANK);
    ok(invented.every((s) => /^[\x20-\x7e]*$/.test(String(s))),
       "every string this module invents is plain ASCII",
       invented.filter((s) => !/^[\x20-\x7e]*$/.test(String(s))).join("|"));
  }
  {
    /* pure: the same two fighters and the same save always produce the
       same card, or the tests above are measuring weather */
    exec("SAVE=DEF_SAVE();");
    const a = JSON.stringify(A.tapeRows(1, 2));
    const b = JSON.stringify(A.tapeRows(1, 2));
    ok(a === b, "tapeRows is deterministic");
    ok(JSON.stringify(A.tapeHeader(1)) === JSON.stringify(A.tapeHeader(1)), "tapeHeader is deterministic");
    ok(JSON.stringify(A.tapeStoryline(1, 2)) === JSON.stringify(A.tapeStoryline(1, 2)),
       "tapeStoryline is deterministic");
  }
  {
    /* it draws nothing, and it must not start drawing later */
    const src = String(A.tapeRows) + String(A.tapeHeader) + String(A.tapeStoryline) + String(A.tapeAdvantage);
    ok(src.indexOf("cx.") < 0 && src.indexOf("document") < 0 && src.indexOf("canvas") < 0,
       "the data layer never touches the renderer");
  }
};
