/* =====================================================================
   Aqua Zero Heavens Arena - the walkout
   Luminara Digital

   What this suite is actually defending:

     - the ceremony has a published price. 214 frames exhibition, 280
       for the title bout, and both numbers are the sum of the literals
       in ENTRANCE_CONFIG. If a beat grows, a check here says so.
     - the descriptor is weights, never pixels. Every progress value
       stays inside 0..1 on every frame of every flavour.
     - the cues fire EXACTLY once each, whether the loop steps one frame
       at a time, eight at a time (mainLoop's catch-up guard), or jumps
       the whole show in a single call. An equality test on t would pass
       the first of those three and fail the other two.
     - the skip is instant, idempotent, safe cold, safe twice, and never
       rewinds into a bell it already rang.
     - motion off keeps the structure and every cue, and moves nothing.
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;

  const C = A.ENTRANCE_CONFIG;
  const mk = (o) => A.newEntrance(o);
  const inUnit = (n) => typeof n === "number" && n === n && n >= 0 && n <= 1;

  /* walk a whole entrance and hand every frame to fn */
  function sweep(st, fn, motion) {
    for (let t = 0; t <= st.total + 4; t++) fn(A.entranceBeat(st, t, motion), t);
  }
  /* collect the cue schedule a given stepping pattern produces */
  function collect(st, stride) {
    const out = [];
    for (let t = 0; t <= st.total + stride; t += stride) {
      A.entranceCues(st, t).forEach((k) => out.push(k));
    }
    return out;
  }

  section("the ceremony has a published price");
  {
    ok(!!C && !!C.walk && !!C.card, "ENTRANCE_CONFIG is exported");
    ["slide", "plate", "sting", "hold"].forEach((k) => {
      ok(typeof C.walk[k] === "number" && C.walk[k] > 0, "the " + k + " beat is a literal budget", C.walk[k]);
    });
    const ex = mk({ pFid: 0, eFid: 1 });
    const walk = C.walk.slide + C.walk.plate + C.walk.sting + C.walk.hold;
    ok(ex.walkLen === walk, "one walkout is slide+plate+sting+hold", ex.walkLen);
    ok(ex.total === walk * 2 + C.card.vs + C.card.bell,
       "the total is two walkouts, a card and a bell", ex.total);
    ok(ex.total === 214, "an exhibition costs 214 frames - 3.57s", ex.total);
    ok(ex.total <= 300, "and stays under the five-second ceiling", ex.total);

    const boss = mk({ pFid: 0, eFid: 1, boss: true });
    ok(boss.total === 280, "a title bout costs 280 frames - 4.67s", boss.total);
    ok(boss.total <= 300, "and still stays under the ceiling", boss.total);
    ok(boss.total > ex.total, "the tower is allowed to take longer than an exhibition",
       ex.total + " -> " + boss.total);
    ok(boss.beats.slide > ex.beats.slide && boss.beats.hold > ex.beats.hold,
       "and it buys the extra frames on both walkouts, not one",
       JSON.stringify(boss.beats));
  }

  section("six nameable beats, in order");
  {
    const st = mk({ pFid: 0, eFid: 1 });
    const seen = [];
    let last = "";
    sweep(st, (d) => {
      const key = d.stage + "/" + d.part;
      if (key !== last) { seen.push(key); last = key; }
    });
    ok(seen.join(" ") ===
       "p1/slide p1/plate p1/sting p1/hold p2/slide p2/plate p2/sting p2/hold vs/card bell/bell done/done",
       "art in, plate builds, sting, hold - twice - then the card and the bell", seen.join(" "));

    const count = {};
    sweep(st, (d) => { const k = d.stage + "/" + d.part; count[k] = (count[k] || 0) + 1; });
    ok(count["p1/slide"] === st.beats.slide, "the slide owns exactly its budget", count["p1/slide"]);
    ok(count["p1/plate"] === st.beats.plate, "so does the plate", count["p1/plate"]);
    ok(count["p1/sting"] === st.beats.sting, "so does the sting", count["p1/sting"]);
    ok(count["p1/hold"] === st.beats.hold, "so does the hold", count["p1/hold"]);
    ok(count["vs/card"] === st.beats.vs, "so does the vs card", count["vs/card"]);
    ok(count["bell/bell"] === st.beats.bell, "so does the bell", count["bell/bell"]);
    ok(count["p2/slide"] === count["p1/slide"] && count["p2/hold"] === count["p1/hold"],
       "both men get the same walk - an uneven card reads as a production fault");
  }

  section("weights, never pixels");
  {
    /* every flavour, not a sample of them: the boss is the only one that
       moves the frame budget, but a new entry in `flavours` with a bad
       `add` would only ever show up on its own sweep */
    Object.keys(C.flavours).forEach((flavour) => {
      const o = { pFid: 0, eFid: 1 };
      if (flavour !== "exhibition") o[flavour] = true;
      const st = mk(o);
      let bad = "", travelBad = "", pulseBad = "", roleBad = "";
      sweep(st, (d, t) => {
        ["p", "overall", "slide", "alpha", "spot", "plate", "sting", "flash", "vs", "bell", "dim"]
          .forEach((k) => { if (!bad && !inUnit(d[k])) bad = k + "=" + d[k] + "@" + t; });
        if (!travelBad && !(Math.abs(d.travel) <= 1)) travelBad = d.travel + "@" + t;
        if (!pulseBad && !(Math.abs(d.pulse) <= C.spot.pulseAmp + 1e-12)) pulseBad = d.pulse + "@" + t;
        /* the one failure the player actually reads: a descriptor string
           the renderer prints straight onto the card */
        if (!roleBad && (String(d.role).indexOf("undefined") >= 0 ||
                         String(d.banner).indexOf("undefined") >= 0)) {
          roleBad = d.role + "/" + d.banner + "@" + t;
        }
      });
      ok(!bad, "every progress value stays in 0..1 (" + flavour + ")", bad);
      ok(!travelBad, "and travel stays a unit offset (" + flavour + ")", travelBad);
      ok(!pulseBad, "and the pulse stays inside its own amplitude (" + flavour + ")", pulseBad);
      ok(!roleBad, "and no descriptor string carries the word undefined (" + flavour + ")", roleBad);
    });

    const st = mk({ pFid: 0, eFid: 1 });
    const d0 = A.entranceBeat(st, 0);
    ok(d0.slide === 0 && d0.alpha === 0 && d0.spot === 0 && d0.plate === 0 && d0.rows === 0,
       "frame 0 is a dark stage - nothing has arrived yet");
    ok(d0.travel === -1, "and the left corner starts a full unit off its own side", d0.travel);
    ok(A.entranceBeat(st, st.beats.slide).slide === 1,
       "the slide is complete on the frame the slide beat ends");

    let mono = true, prev = -1;
    for (let t = 0; t < st.walkLen; t++) {
      const s = A.entranceBeat(st, t).slide;
      if (s < prev - 1e-9) mono = false;
      prev = s;
    }
    ok(mono, "a fighter never walks backwards during his own beat");
  }

  section("the nameplate builds a row at a time");
  {
    const st = mk({ pFid: 0, eFid: 1, rec: { w: 3, l: 1 } });
    const rows = [];
    for (let t = 0; t < st.walkLen; t++) {
      const r = A.entranceBeat(st, t).rows;
      if (!rows.length || rows[rows.length - 1] !== r) rows.push(r);
    }
    ok(rows.join(",") === "0,1,2,3", "rows appear one at a time: name, discipline, record", rows.join(","));
    ok(A.entranceBeat(st, st.beats.slide + st.beats.plate).rows === C.reveal.rows.length,
       "and the plate is fully built before the sting lands");
    ok(A.entranceBeat(st, st.beats.slide - 1).rows === 0,
       "nothing is written while the man is still walking in");
  }

  section("one light, one man, and it is the opponent who closes the card");
  {
    const st = mk({ pFid: 4, eFid: 9, human: "p" });
    const p1 = A.entranceBeat(st, 10), p2 = A.entranceBeat(st, st.walkLen + 10);
    ok(p1.lit === "p" && p1.fid === 4, "the human's corner walks first", p1.lit + "/" + p1.fid);
    ok(p2.lit === "e" && p2.fid === 9, "the man you have to beat walks last", p2.lit + "/" + p2.fid);
    ok(p1.you === true && p2.you === false, "and the descriptor says which one is yours");
    ok(A.entranceBeat(st, st.bellAt - 5).lit === "both", "the vs card lights both");
    ok(A.entranceBeat(st, st.bellAt + 2).lit === "both", "so does the bell");
    ok(A.entranceBeat(st, st.total).lit === "none", "and nothing is lit once it is over");

    const flip = mk({ pFid: 4, eFid: 9, human: "e" });
    ok(A.entranceBeat(flip, 10).lit === "e" && A.entranceBeat(flip, flip.walkLen + 10).lit === "p",
       "put the human in the right corner and the order follows him");

    ok(A.entranceBeat(st, 10).dir === -1 && A.entranceBeat(st, st.walkLen + 10).dir === 1,
       "each man arrives from his own side of the ring");
  }

  section("the lights hand over instead of cutting");
  {
    /* the spotlight close used to be measured against walkLen while the
       last frame a walk is ever asked about is walkLen-1, so it finished
       at 0.30 and the next man's slide reset it to 0 - a visible step,
       twice a walkout, in the one beat whose whole job is the handoff */
    ["exhibition", "boss"].forEach((flavour) => {
      const st = mk(flavour === "boss" ? { pFid: 0, eFid: 1, boss: true } : { pFid: 0, eFid: 1 });
      [1, 2].forEach((n) => {
        const last = A.entranceBeat(st, n * st.walkLen - 1).spot;
        ok(last < 1e-9, "the light is out on the last frame of walk " + n +
           " (" + flavour + ")", last);
      });
      ok(A.entranceBeat(st, 0).spot === 0 && A.entranceBeat(st, st.walkLen).spot === 0,
         "and each man opens his own light from dark (" + flavour + ")");
    });

    /* the house dims ONCE. Tying dim to the travelling spotlight put a
       one-frame flash of full arena light between the two walkouts. */
    const st = mk({ pFid: 0, eFid: 1 });
    let dipped = "";
    let peak = 0;
    for (let t = 0; t < 2 * st.walkLen; t++) {
      const dim = A.entranceBeat(st, t).dim;
      if (dim + 1e-9 < peak) dipped = peak + " -> " + dim + "@" + t;
      if (dim > peak) peak = dim;
    }
    ok(!dipped, "the house never comes back up between the two walkouts", dipped);
    ok(Math.abs(peak - C.spot.dimMax) < 1e-9, "and it reaches the darkness config asked for", peak);
  }

  section("the head-to-head is told from the lit corner");
  {
    const st = mk({ pFid: 0, eFid: 1, human: "p", rec: { w: 3, l: 1 } });
    const mine = A.entranceBeat(st, 60).rec, theirs = A.entranceBeat(st, st.walkLen + 60).rec;
    ok(mine.w === 3 && mine.l === 1, "your plate shows your record", JSON.stringify(mine));
    ok(theirs.w === 1 && theirs.l === 3, "his plate shows the same fights from his side",
       JSON.stringify(theirs));
    ok(mine.known === true, "a fought record is flagged known");
    const fresh = mk({ pFid: 0, eFid: 1 });
    ok(A.entranceBeat(fresh, 60).rec.known === false,
       "and a first meeting is flagged so the renderer can drop the row");
  }

  section("a boss does not read like an exhibition");
  {
    const ex = mk({ pFid: 0, eFid: 1 });
    const boss = mk({ pFid: 0, eFid: 1, boss: true });
    ok(ex.flavour === "exhibition" && boss.flavour === "boss", "the flag picks the billing");
    ok(boss.billing > ex.billing, "the title bout is billed higher", ex.billing + " -> " + boss.billing);
    ok(boss.banner !== ex.banner && boss.banner.length > 0, "and carries its own banner", boss.banner);
    ok(A.entranceBeat(boss, boss.walkLen + 60).role === "champion",
       "the man across the ring is billed as the champion");
    ok(A.entranceBeat(boss, 60).role === "you", "you are never billed as the opponent");

    /* priority: the flags overlap constantly - a ranked boss is a boss */
    ok(mk({ boss: true, ranked: true, nemesis: true, daily: true }).flavour === "boss",
       "boss outranks everything else on the card");
    ok(mk({ nemesis: true, grudge: true, ranked: true }).flavour === "nemesis",
       "the nemesis outranks a plain grudge");
    ok(mk({ grudge: true, ranked: true }).flavour === "grudge", "a grudge outranks the ladder");
    ok(mk({ survival: true, ranked: true }).flavour === "survival", "survival outranks the ladder");
    ok(mk({ ranked: true }).flavour === "ranked", "and the ladder gets its own line");
    ok(mk({ hotseat: true }).flavour === "hotseat", "so does two players");

    const hs = mk({ pFid: 0, eFid: 1, hotseat: true });
    ok(A.entranceBeat(hs, 10).role === "player_one" &&
       A.entranceBeat(hs, hs.walkLen + 10).role === "player_two",
       "hotseat bills two players, not a hero and a villain");
  }

  section("cues latch - an equality test on t would be a bug");
  {
    const st = mk({ pFid: 0, eFid: 1 });
    const at = {};
    for (let t = 0; t <= st.total + 4; t++) {
      A.entranceCues(st, t).forEach((k) => { if (at[k] === undefined) at[k] = t; else at[k] = "TWICE"; });
    }
    /* the opening cue is named "entrance" because that is the key
       crowdSwell() in src/ui/music.js authors an envelope under - the id
       IS the mixer call, so a rename on either side fails here */
    ok(at.entrance === 0, "the crowd comes up with the lights", at.entrance);
    ok(at.sting_p1 === st.beats.slide + st.beats.plate,
       "the first sting lands the frame his plate finishes", at.sting_p1);
    ok(at.sting_p2 === st.walkLen + st.beats.slide + st.beats.plate,
       "and the second lands on the same beat of the second walkout", at.sting_p2);
    ok(at.bell === st.bellAt, "the bell rings when the card is done", at.bell);
    ok(Object.keys(at).length === 4, "four cues, no more", Object.keys(at).join(","));

    /* mainLoop runs up to 8 step() calls inside one animation frame. Every
       cue must survive being stepped over. */
    [1, 2, 3, 5, 8].forEach((stride) => {
      const s2 = mk({ pFid: 0, eFid: 1 });
      const got = collect(s2, stride);
      ok(got.join(",") === "entrance,sting_p1,sting_p2,bell",
         "stepping " + stride + " frames at a time still fires all four, in order", got.join(","));
    });

    /* the pathological catch-up: the whole show in one call */
    const s3 = mk({});
    const burst = A.entranceCues(s3, 9999);
    ok(burst.join(",") === "entrance,sting_p1,sting_p2,bell",
       "a single jump past the end still emits every cue once, in frame order", burst.join(","));
    ok(A.entranceCues(s3, 9999).length === 0, "and never emits them again", "second call");

    const s4 = mk({});
    A.entranceCues(s4, 0);
    ok(A.entranceCues(s4, 0).length === 0, "polling the same frame twice is silent");
  }

  section("the skip is instant, and it leaves the state consistent");
  {
    const st = mk({ pFid: 0, eFid: 1 });
    for (let t = 0; t < 30; t++) A.entranceCues(st, t);
    A.entranceSkip(st, 30);
    const d = A.entranceBeat(st, 30);
    ok(d.stage === "bell" && d.p === 0,
       "A during the first walkout puts the bell beat on that exact frame", d.stage + " p=" + d.p);
    ok(d.skipped === true, "and the descriptor says the ceremony was cut short");

    const after = [];
    for (let t = 30; t <= 30 + st.beats.bell + 4; t++) A.entranceCues(st, t).forEach((k) => after.push(k));
    ok(after.join(",") === "bell",
       "the two stings are latched without firing - a skip must not dump them into the mixer",
       after.join(","));
    ok(A.entranceDone(st, 30 + st.beats.bell - 1) === false, "the bell beat plays in full");
    ok(A.entranceDone(st, 30 + st.beats.bell) === true, "and then the duel takes the screen back");
    ok(st.total === 214 && st.beats.bell === C.card.bell,
       "and the timeline itself was never rewritten", st.total);
  }
  {
    /* idempotent, twice, and with no frame argument at all */
    const st = mk({});
    for (let t = 0; t < 40; t++) A.entranceCues(st, t);
    A.entranceSkip(st, 39);
    const warp = st.warp;
    A.entranceSkip(st, 39);
    A.entranceSkip(st);
    A.entranceSkip(st, 0);
    ok(st.warp === warp, "skipping again never moves the bell a second time", warp + " vs " + st.warp);
    ok(A.entranceBeat(st, 39).stage === "bell", "and the bell is still where it was put");
  }
  {
    /* cold: skipped before the entrance ever drew a frame */
    const st = mk({});
    A.entranceSkip(st);
    ok(A.entranceBeat(st, 0).stage === "bell", "skipping before it starts is safe");
    const c = A.entranceCues(st, 0);
    ok(c.join(",") === "entrance,bell",
       "the crowd still comes up with the bell - a bell in a silent room is worse", c.join(","));
    ok(A.entranceDone(st, st.beats.bell) === true, "and it ends a bell beat later");
  }
  {
    /* pressing A during the bell must not rewind into a bell already rung */
    const st = mk({});
    for (let t = 0; t <= 200; t++) A.entranceCues(st, t);
    A.entranceSkip(st, 200);
    ok(st.warp === 0, "a late skip does not drag the timeline backwards", st.warp);
    ok(A.entranceCues(st, 205).length === 0, "and the bell does not ring twice");
    ok(A.entranceDone(st, st.total) === true, "the entrance still ends when it was going to");
  }

  section("motion off keeps the ceremony and loses the movement");
  {
    const on = mk({ pFid: 0, eFid: 1 });
    const off = mk({ pFid: 0, eFid: 1, motion: false });
    let struct = true, moved = "", travelled = false;
    for (let t = 0; t <= on.total + 4; t++) {
      const a = A.entranceBeat(on, t), b = A.entranceBeat(off, t);
      if (a.stage !== b.stage || a.part !== b.part || a.lit !== b.lit || a.rows !== b.rows ||
          a.p !== b.p || a.plate !== b.plate || a.spot !== b.spot) struct = false;
      if (!moved && (b.travel !== 0 || b.pulse !== 0 || b.flash !== 0)) {
        moved = "travel=" + b.travel + " pulse=" + b.pulse + " flash=" + b.flash + "@" + t;
      }
      if (a.travel !== 0) travelled = true;
    }
    ok(struct, "every beat, every reveal and every spotlight survives motion off");
    ok(!moved, "and nothing slides, breathes or flashes", moved);
    ok(travelled, "while motion on genuinely travels");

    const ca = collect(mk({ pFid: 0, eFid: 1 }), 1);
    const cb = collect(mk({ pFid: 0, eFid: 1, motion: false }), 1);
    ok(ca.join(",") === cb.join(","), "and the cues are identical - the show is heard either way",
       cb.join(","));

    /* the page passes motionOn() per frame, so the option must work without
       rebuilding the timeline */
    ok(A.entranceBeat(on, 4, false).travel === 0, "the motion argument overrides the state");
    ok(A.entranceBeat(off, 4, true).travel !== 0, "in both directions");
  }

  section("pure, deterministic and null-safe");
  {
    const st = mk({ pFid: 0, eFid: 1, boss: true, rec: { w: 1, l: 2 } });
    const before = JSON.stringify(st);
    for (let t = 0; t <= st.total; t++) A.entranceBeat(st, t);
    ok(JSON.stringify(st) === before, "entranceBeat never writes the state - render may call it twice");

    const x = A.entranceBeat(st, 77), y = A.entranceBeat(st, 77);
    ok(JSON.stringify(x) === JSON.stringify(y), "the same frame is the same descriptor, forever");

    const shell = A.entranceBeat(null, 5);
    ok(shell && shell.stage === "done" && shell.done === true && shell.travel === 0,
       "a missing entrance draws as an empty stage rather than throwing");
    ok(A.entranceCues(null, 5).length === 0, "and asks for no cues");
    ok(A.entranceDone(null, 0) === true, "and never strands the duel in the intro");
    A.entranceSkip(null);
    ok(true, "and survives being skipped");

    const end = A.entranceBeat(st, st.total + 50);
    ok(end.stage === "done" && end.overall === 1 && end.spot === 0 && end.dim === 0,
       "past the end is a clean, drawable nothing", end.stage);
  }

  section("a half-built entrance is no entrance, not a crash");
  {
    /* null was always handled; `{}` was not, and `{}` is the likelier
       accident - a duel object assembled by hand gets an empty ent, not
       an undefined one. It matters more than it looks: entranceCues and
       entranceDone run inside step(), and mainLoop wraps only render()
       in a try/catch, so a throw out of step() ends the animation frame
       chain for the whole session. A hang is the other half of it -
       entranceDone must never answer false forever. */
    const junk = [
      ["an empty object", {}],
      ["a total with no timeline", { total: 10 }],
      ["segs but no cues", { total: 10, segs: [], rec: { w: 0, l: 0 } }],
      ["a zero-length timeline", { total: 0, segs: [], cues: [], fired: {}, rec: { w: 0, l: 0 } }],
      ["a number", 7],
      ["a string", "entrance"],
    ];
    junk.forEach(([label, bad]) => {
      let threw = "";
      let d = null, cues = null, done = null;
      try {
        d = A.entranceBeat(bad, 5);
        cues = A.entranceCues(bad, 5);
        done = A.entranceDone(bad, 5);
        A.entranceSkip(bad, 5);
        A.entranceSkip(bad);
      } catch (err) { threw = err.message; }
      ok(!threw, "nothing throws on " + label + " - step() is not inside mainLoop's catch", threw);
      ok(!threw && d && d.stage === "done" && d.done === true,
         "and it draws as an empty stage (" + label + ")", d && d.stage);
      ok(!threw && cues && cues.length === 0, "and asks for no cues (" + label + ")");
      ok(done === true, "and the duel starts instead of hanging in the intro (" + label + ")", done);
    });

    /* the guard must not have cost the real thing anything */
    const live = mk({ pFid: 0, eFid: 1 });
    ok(A.entranceDone(live, 0) === false && A.entranceBeat(live, 0).stage === "p1",
       "a properly built entrance is still played in full");
  }
};
