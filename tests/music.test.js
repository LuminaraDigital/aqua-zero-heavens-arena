/* =====================================================================
   Aqua Zero Heavens Arena - the score
   Luminara Digital

   The score is the one system in the game that a human being cannot
   check by looking at the screen, so it is checked here instead:

     - the data is well formed and in ONE key
     - nothing is louder than the fight
     - the clock is exact: N frames per step, N*len frames per loop
     - intensity changes WHICH layers exist, not how loud they are
     - fight -> fight_hot keeps the beat; a tempo change does not fake it
     - muted keeps time, so unmuting lands on a downbeat
     - it all works in a sandbox with no AudioContext at all, which is
       the entire point of the module owning data instead of nodes
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api: A, ok, section } = h;

  /* run a state for n frames, returning every note that came out */
  const runFrames = (st, n) => {
    const all = [];
    for (let i = 0; i < n; i++) A.musicTick(st).forEach((x) => all.push(x));
    return all;
  };
  const frameCounts = (st, n) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(A.musicTick(st).length);
    return out;
  };

  section("the score is well formed");
  {
    ok(A.MUSIC_BAD.length === 0, "every note token in every track resolved", A.MUSIC_BAD.join());
    const need = ["title", "menu", "entrance", "fight", "fight_hot", "victory", "defeat", "boss"];
    ok(need.every((n) => !!A.MUSIC_TRACKS[n]), "every named track exists",
       need.filter((n) => !A.MUSIC_TRACKS[n]).join());
    ok(A.MUSIC_TRACK_NAMES.length === need.length, "and there are no strays",
       A.MUSIC_TRACK_NAMES.join());

    let lenBad = 0, layerBad = 0, gainBad = 0, mix = 0;
    A.MUSIC_TRACK_NAMES.forEach((n) => {
      const t = A.MUSIC_TRACKS[n];
      if (!(t.step > 0) || !(t.len > 0) || !t.layers.length) layerBad++;
      const ids = t.layers.map((L) => L.id);
      // a bass and a lead in every track is what makes the layers mutable
      // independently - a track that is one blob cannot be thinned
      if (ids.indexOf("bass") < 0 || ids.indexOf("lead") < 0) mix++;
      t.layers.forEach((L) => {
        if (L.seq.length !== t.len) lenBad++;
        if (!(L.v > 0) || L.v > A.MUSIC_CONFIG.maxGain) gainBad++;
      });
    });
    ok(layerBad === 0, "every track has a tempo, a length and layers", layerBad);
    ok(lenBad === 0, "every layer is exactly as long as its loop", lenBad);
    ok(gainBad === 0, "nothing in the score is louder than the fight effects", gainBad);
    ok(mix === 0, "every track carries a bass and a lead", mix);
  }
  {
    // one key, checked rather than asserted: every pitch in every track
    // has to come out of the frequency table
    const known = {};
    for (const k in A.MUSIC_HZ) known[A.MUSIC_HZ[k]] = k;
    let off = 0, notes = 0, lo = 1e9, hi = 0;
    A.MUSIC_TRACK_NAMES.forEach((n) => {
      A.MUSIC_TRACKS[n].layers.forEach((L) => {
        L.seq.forEach((v) => {
          if (v === null || v === undefined) return;
          (typeof v === "number" ? [v] : v).forEach((f) => {
            notes++;
            if (!known[f]) off++;
            if (f < lo) lo = f;
            if (f > hi) hi = f;
          });
        });
      });
    });
    ok(notes > 200, "there is actually a score in here", notes);
    ok(off === 0, "every pitch in the game comes out of one key", off);
    ok(lo >= 60 && hi <= 1500, "and it all sits in a range a laptop can play", lo + " - " + hi);
  }
  {
    // the only chromatic note in the file is the raised leading tone,
    // and it lives only where the arrangement is asking a question
    const usesGS = (n) => A.MUSIC_TRACKS[n].layers.some((L) =>
      L.seq.some((v) => v !== null && v !== undefined &&
        (typeof v === "number" ? [v] : v).some((f) => f === A.MUSIC_HZ.GS3 || f === A.MUSIC_HZ.GS4)));
    ok(usesGS("fight_hot") && usesGS("boss"), "the tense tracks raise the leading tone");
    ok(!usesGS("fight") && !usesGS("menu") && !usesGS("title"),
       "and the settled tracks never do");
  }

  section("the clock");
  {
    const s = A.newMusicState("fight");
    ok(A.musicPlaying(s), "a new state on a real track is playing");
    ok(s.step === 0 && s.f === 0 && s.loops === 0, "and starts at the top of the bar");

    const first = A.musicTick(s);
    ok(first.length > 0, "the very first frame fires the downbeat", first.length);
    ok(first.every((n) => typeof n.f === "number" && typeof n.d === "number" &&
                          typeof n.type === "string" && typeof n.v === "number"),
       "and every note is {f, d, type, v}", JSON.stringify(first[0]));

    const step = A.MUSIC_TRACKS.fight.step;
    let quiet = 0;
    for (let i = 1; i < step; i++) if (A.musicTick(s).length === 0) quiet++;
    ok(quiet === step - 1, "nothing fires between steps", quiet + "/" + (step - 1));
  }
  {
    // the real invariant: over a whole loop, every frame that makes a
    // sound is a step boundary. A note that drifted off the grid would
    // be inaudible as an error and unbearable as music.
    const t = A.MUSIC_TRACKS.fight, s = A.newMusicState("fight");
    const counts = frameCounts(s, t.step * t.len);
    const offGrid = counts.filter((n, i) => n > 0 && i % t.step !== 0).length;
    const sounded = counts.filter((n) => n > 0).length;
    ok(offGrid === 0, "nothing ever fires off the grid", offGrid);
    ok(sounded > 0 && sounded <= t.len, "and only steps fire", sounded + "/" + t.len);
    // rests are real - a track where every step speaks is a drone
    ok(sounded < t.len, "the loop breathes: some steps are rests", sounded + "/" + t.len);
  }
  {
    // the loop is exact: step*len frames and you are back where you began
    const t = A.MUSIC_TRACKS.boss, s = A.newMusicState("boss");
    runFrames(s, t.step * t.len);
    ok(s.loops === 1 && s.step === 0 && s.f === 0,
       "a loop is exactly step*len frames", t.step * t.len + " -> loops " + s.loops);
  }
  {
    // pure with respect to everything but the state handed in
    const a = A.newMusicState("fight_hot"), b = A.newMusicState("fight_hot");
    A.musicIntensity(a, 0.5); A.musicIntensity(b, 0.5);
    let same = true;
    for (let i = 0; i < 300; i++) {
      if (JSON.stringify(A.musicTick(a)) !== JSON.stringify(A.musicTick(b))) { same = false; break; }
    }
    ok(same, "two states in lockstep produce identical output - no clock, no rng");
  }
  {
    // The fight must never be buried. Measuring only `fight` at level 1 is
    // the trap here: that is the THINNEST the arrangement ever gets, so it
    // reports 0.125 and hides the real peak. The loud frames live in the
    // overlap bands where a layer on its way out (pad, to:0.72) is still
    // sounding under one on its way in (drive, from:0.70). Sweep every
    // track at every level that sits on a window edge.
    const LV = [0, 0.2, 0.3, 0.35, 0.5, 0.65, 0.7, 0.72, 0.8, 1];
    const worst = (name, lv, frames, sw) => {
      const s = A.newMusicState(name);
      A.musicIntensity(s, lv);
      let wn = 0, wg = 0;
      for (let i = 0; i < frames; i++) {
        if (sw && i === 13) A.musicSwitch(s, sw, { fade: 45 });
        const n = A.musicTick(s);
        wn = Math.max(wn, n.length);
        wg = Math.max(wg, n.reduce((acc, x) => acc + x.v, 0));
      }
      return { n: wn, g: wg, where: name + (sw ? "->" + sw : "") + " @" + lv };
    };
    let solo = { n: 0, g: 0, where: "" };
    A.MUSIC_TRACK_NAMES.forEach((name) => LV.forEach((lv) => {
      const t = A.MUSIC_TRACKS[name], w = worst(name, lv, t.step * t.len);
      if (w.n > solo.n) solo.n = w.n;
      if (w.g > solo.g) { solo.g = w.g; solo.where = w.where; }
    }));
    ok(solo.n <= 8, "never more than a handful of voices at once", solo.n);
    // four layers at the cap is the budget; it is a stated number rather
    // than a measured one so that retuning a layer upward has to argue
    ok(solo.g <= A.MUSIC_CONFIG.maxGain * 4,
       "and no frame in the score sums past four layers at the cap",
       solo.g.toFixed(4) + " at " + solo.where);

    // a crossfade sounds two tracks at once, so it is the obvious place to
    // blow the budget. mix + (1-mix) is 1, so it must not.
    let cross = { n: 0, g: 0, where: "" };
    A.MUSIC_TRACK_NAMES.forEach((a) => A.MUSIC_TRACK_NAMES.forEach((b) => {
      if (a === b) return;
      LV.forEach((lv) => {
        const w = worst(a, lv, 60, b);
        if (w.n > cross.n) cross.n = w.n;
        if (w.g > cross.g) { cross.g = w.g; cross.where = w.where; }
      });
    }));
    ok(cross.g <= solo.g, "and a crossfade is never louder than either track alone",
       cross.g.toFixed(4) + " at " + cross.where + " vs " + solo.g.toFixed(4));
    ok(cross.n <= 8, "nor does it stack more voices than the budget", cross.n);
  }

  section("intensity thins the arrangement, it does not ride a fader");
  {
    const s = A.newMusicState("fight");
    ok(A.musicIntensity(s, 0.5) === 0.5, "the knob stores what it is given");
    ok(A.musicIntensity(s, 4) === 1 && A.musicIntensity(s, -2) === 0, "and clamps to 0..1");

    A.musicIntensity(s, 0);
    const calm = A.musicLayersOn(s);
    A.musicIntensity(s, 1);
    const hot = A.musicLayersOn(s);
    ok(calm.indexOf("pad") >= 0 && hot.indexOf("pad") < 0,
       "the comfortable layer leaves when the fight gets serious", calm.join() + " -> " + hot.join());
    ok(hot.indexOf("hat") >= 0 && hot.indexOf("drive") >= 0,
       "and the hard ones arrive", hot.join());
    ok(calm.indexOf("bass") >= 0 && hot.indexOf("bass") >= 0,
       "the bass never leaves - it is the track");
  }
  {
    // the proof that it is arrangement and not volume: a layer present at
    // both levels comes out at exactly the same gain
    const loop = A.MUSIC_TRACKS.fight.step * A.MUSIC_TRACKS.fight.len;
    const at = (lv) => {
      const s = A.newMusicState("fight");
      A.musicIntensity(s, lv);
      return runFrames(s, loop);
    };
    const calm = at(0), hot = at(1);
    ok(hot.length > calm.length, "a desperate fight has MORE happening in it",
       calm.length + " -> " + hot.length);
    const bassOf = (arr) => arr.filter((n) => n.type === "triangle" && n.d === 0.16);
    const cb = bassOf(calm), hb = bassOf(hot);
    ok(cb.length === hb.length && cb.length > 0 &&
       cb.every((n, i) => n.v === hb[i].v && n.f === hb[i].f),
       "and the bass line is note-for-note and gain-for-gain identical",
       cb.length + " notes");
  }
  {
    // an unknown state must not throw when the duel screen drives it
    ok(A.musicIntensity(null, 0.5) === 0, "the knob survives a missing state");
    ok(A.musicLayersOn(null).length === 0, "so does the layer readout");
  }

  section("switching tracks");
  {
    // fight and fight_hot exist at the same tempo ON PURPOSE
    ok(A.MUSIC_TRACKS.fight.step === A.MUSIC_TRACKS.fight_hot.step,
       "the fight and its hot variant share a tempo");
    const s = A.newMusicState("fight");
    runFrames(s, 19);                       // land mid-step, mid-bar
    const step = s.step, f = s.f;
    ok(f !== 0, "we are mid-step before the swap", f);
    A.musicSwitch(s, "fight_hot", { fade: 24 });
    ok(s.name === "fight_hot", "the swap took");
    ok(s.step === step && s.f === f, "and the beat position carried over untouched",
       step + "/" + f + " -> " + s.step + "/" + s.f);
    ok(s.prev && s.prev.name === "fight" && s.fade === 24, "the old track is fading out",
       s.fade);
  }
  {
    // the crossfade actually mixes, and then it ends
    const s = A.newMusicState("fight");
    runFrames(s, 8);
    A.musicSwitch(s, "fight_hot", { fade: 20 });
    const during = runFrames(s, 18);
    ok(during.length > 0, "notes still come out during the fade", during.length);
    // a mixed note carries a gain that no layer in either track declares -
    // that is the proof the crossfade is a fade and not a hard cut
    const declared = {};
    ["fight", "fight_hot"].forEach((n) =>
      A.MUSIC_TRACKS[n].layers.forEach((L) => { declared[L.v] = 1; }));
    ok(during.some((n) => !declared[n.v]), "and their gains are mixed, not declared",
       during.map((n) => n.v).join());
    // "every note is under maxGain" would pass on a hard cut too, since mix
    // is never above 1 - it proves nothing. What has to be true is that the
    // mix RISES: the incoming track's downbeat is quiet, and a later one is
    // louder, and the last one before the fade ends is louder still.
    const bass = during.filter((n) => n.type === "triangle" && n.d === 0.13);
    ok(bass.length >= 2, "the incoming bass speaks more than once during the fade", bass.length);
    ok(bass[bass.length - 1].v > bass[0].v, "and it gets louder as the fade runs",
       bass.map((n) => n.v).join(" -> "));
    ok(bass[0].v > 0, "but it is audible on its own first downbeat, not silent", bass[0].v);
    runFrames(s, 20);
    ok(s.prev === null && s.fade === 0 && s.fadeLen === 0, "the fade cleans itself up");
  }
  {
    // a hard cut has no overlap at all
    const s = A.newMusicState("fight");
    runFrames(s, 30);
    A.musicSwitch(s, "boss", { hard: true });
    ok(s.prev === null && s.fade === 0, "a hard cut drops the old track immediately");
    ok(s.step === 0 && s.f === 0, "and starts the new one clean", s.step + "/" + s.f);
  }
  {
    // different tempos cannot honestly share a beat, so they do not pretend
    const s = A.newMusicState("fight");
    runFrames(s, 19);
    ok(A.MUSIC_TRACKS.title.step !== A.MUSIC_TRACKS.fight.step, "title runs at another tempo");
    A.musicSwitch(s, "title", { fade: 30 });
    ok(s.step === 0 && s.f === 0, "a tempo change restarts the bar rather than faking it",
       s.step + "/" + s.f);
    ok(s.prev && s.prev.name === "fight", "and the old track still fades on its own clock");
  }
  {
    // beat preservation can be refused
    const s = A.newMusicState("fight");
    runFrames(s, 19);
    A.musicSwitch(s, "fight_hot", { fade: 0, keepBeat: false });
    ok(s.step === 0 && s.f === 0, "keepBeat:false restarts a matched tempo too");
  }
  {
    const s = A.newMusicState("fight");
    runFrames(s, 19);
    const step = s.step, f = s.f;
    A.musicSwitch(s, "no_such_track");
    ok(s.name === "fight" && s.step === step && s.f === f,
       "an unknown track name never silences a fight that is going fine");
    A.musicSwitch(s, "fight");
    ok(s.name === "fight" && s.step === step, "switching to the track you are on is a no-op");
    A.musicSwitch(s, "fight", { restart: true });
    ok(s.step === 0 && s.f === 0, "unless you ask for a restart");
    ok(A.musicSwitch(null, "fight") === null, "and a missing state does not throw");
  }

  section("the fight/fight_hot decision has hysteresis");
  {
    const s = A.newMusicState("fight");
    ok(A.MUSIC_CONFIG.coolAt < A.MUSIC_CONFIG.hotAt,
       "the two thresholds are not the same number",
       A.MUSIC_CONFIG.coolAt + " / " + A.MUSIC_CONFIG.hotAt);
    ok(A.musicHeat(s, A.MUSIC_CONFIG.hotAt - 0.01) === "fight", "under the line it stays cool");
    ok(A.musicHeat(s, A.MUSIC_CONFIG.hotAt) === "fight_hot", "over it the arrangement swaps");
    // the dead band: a heal, a chip tick or a rounding wobble must not flap it
    const mid = (A.MUSIC_CONFIG.hotAt + A.MUSIC_CONFIG.coolAt) / 2;
    ok(A.musicHeat(s, mid) === "fight_hot", "and it does not fall straight back out");
    ok(A.musicHeat(s, A.MUSIC_CONFIG.coolAt) === "fight", "it takes real recovery to cool off");
    ok(s.level === A.MUSIC_CONFIG.coolAt, "the knob was set on the way through", s.level);
    ok(A.musicHeat(null, 1) === "", "a missing state does not throw");
  }
  {
    // and the swap that matters keeps its place in the bar
    const s = A.newMusicState("fight");
    runFrames(s, 37);
    const step = s.step, f = s.f;
    A.musicHeat(s, 1);
    ok(s.name === "fight_hot" && s.step === step && s.f === f,
       "the heat swap does not stutter the beat", step + "/" + f);
  }

  section("stop, mute and stingers");
  {
    const s = A.newMusicState("fight");
    runFrames(s, 40);
    A.musicStop(s);
    ok(!A.musicPlaying(s), "a stopped track is not playing");
    ok(A.musicTick(s).length === 0, "and it emits nothing");
    ok(s.prev === null && s.fade === 0, "a stop cancels any fade in flight");
    ok(A.musicStop(null) === null, "stopping nothing is safe");
  }
  {
    ok(!A.musicPlaying(A.newMusicState("no_such_track")),
       "an unknown track yields silence, not a surprise substitute");
    ok(A.musicTick(A.newMusicState("no_such_track")).length === 0, "and it ticks harmlessly");
    ok(A.musicTick(null).length === 0, "a null state ticks harmlessly too");
    ok(!A.musicPlaying(null), "and reports as not playing");
  }
  {
    // MUTED IS NOT STOPPED - the whole reason musicTick is called even
    // with SAVE.sound off. Two twins, one muted, run in lockstep.
    const muted = A.newMusicState("fight"), heard = A.newMusicState("fight");
    A.musicMute(muted, true);
    ok(muted.muted === true, "mute is recorded on the state");
    let saidAnything = 0;
    for (let i = 0; i < 137; i++) { saidAnything += A.musicTick(muted).length; A.musicTick(heard); }
    ok(saidAnything === 0, "a muted score says nothing at all", saidAnything);
    ok(muted.step === heard.step && muted.f === heard.f && muted.loops === heard.loops,
       "but it kept perfect time", muted.step + "/" + muted.f);
    A.musicMute(muted, false);
    let inPhase = true;
    for (let i = 0; i < 96; i++) {
      if (JSON.stringify(A.musicTick(muted)) !== JSON.stringify(A.musicTick(heard))) { inPhase = false; break; }
    }
    ok(inPhase, "so unmuting resumes on the beat instead of mid-bar");
    ok(A.musicMute(null, true) === null, "muting nothing is safe");
  }
  {
    // stingers play once and get out of the way
    ["victory", "defeat"].forEach((name) => {
      const t = A.MUSIC_TRACKS[name], s = A.newMusicState(name);
      ok(t.once === true, name + " is a stinger, not a loop");
      const played = runFrames(s, t.step * t.len);
      ok(played.length > 0, "it plays", played.length);
      ok(!A.musicPlaying(s), "and stops itself after exactly one pass");
      ok(runFrames(s, 600).length === 0, "and never comes back on its own");
    });
    const fight = A.newMusicState("fight");
    runFrames(fight, A.MUSIC_TRACKS.fight.step * A.MUSIC_TRACKS.fight.len * 3);
    ok(A.musicPlaying(fight) && fight.loops === 3, "a fight track loops forever", fight.loops);
  }
  {
    // THE FANFARE THAT NEVER ENDS. The page picks a track from the scene
    // every frame, which means musicSwitch is called with the name it is
    // already on sixty times a second. If that call hands a spent stinger
    // its pulse back, victory replays for as long as the result screen is
    // up - four full passes in the span one should have taken.
    const t = A.MUSIC_TRACKS.victory;
    const alone = A.newMusicState("victory");
    let once = 0;
    for (let i = 0; i < t.step * t.len * 4; i++) once += A.musicTick(alone).length;

    const nagged = A.newMusicState("victory");
    let reselected = 0;
    for (let i = 0; i < t.step * t.len * 4; i++) {
      A.musicSwitch(nagged, "victory");     // what a per-frame scene pick does
      reselected += A.musicTick(nagged).length;
    }
    ok(reselected === once, "reselecting a finished stinger every frame does not replay it",
       reselected + " vs " + once);
    ok(nagged.loops === 1, "it went round exactly once", nagged.loops);
    // and a loop, which has no natural end, DOES resume from a reselect
    const loop = A.newMusicState("fight");
    runFrames(loop, 12);
    A.musicStop(loop);
    A.musicSwitch(loop, "fight");
    ok(A.musicPlaying(loop), "but a stopped loop still resumes when it is reselected");
    // a stinger takes an explicit ask
    A.musicSwitch(nagged, "victory", { restart: true });
    ok(A.musicPlaying(nagged), "and a stinger replays only when you ask for it by name");
  }
  {
    // you cannot crossfade out of silence: a track that has stopped must
    // not get a downbeat under the incoming one at (1 - mix)
    const ghost = A.newMusicState("fight");
    runFrames(ghost, 10);
    A.musicStop(ghost);
    A.musicSwitch(ghost, "menu", { fade: 45 });
    ok(ghost.prev === null, "a stopped track is not dragged into the next crossfade",
       JSON.stringify(ghost.prev));
    let heard = 0;
    for (let i = 0; i < 45; i++) heard += A.musicTick(ghost).length;
    const clean = A.newMusicState("menu");
    let expect = 0;
    for (let i = 0; i < 45; i++) expect += A.musicTick(clean).length;
    ok(heard === expect, "so the incoming track is all you hear", heard + " vs " + expect);
    // the live case still fades, or the crossfade would be pointless
    const live = A.newMusicState("fight");
    runFrames(live, 10);
    A.musicSwitch(live, "menu", { fade: 45 });
    ok(live.prev !== null && live.prev.name === "fight",
       "a track that was actually playing still fades out under it");
  }

  section("the ring bell");
  {
    const one = A.bellNotes(1), three = A.bellNotes(3);
    ok(one.strikes === 1 && three.strikes === 3, "you ask for strikes and you get them");
    ok(three.notes.length === one.notes.length * 3, "three strikes is three times the notes",
       three.notes.length);
    // arp() spaces whatever list it is handed by `gap`, so this list has to
    // be one entry per STRIKE. Putting the partial in it too rings six
    // alternating tones 190ms apart - double the interval, and an alarm
    // rather than a bell.
    ok(three.freqs.length === 3 && one.freqs.length === 1,
       "the arp-ready list is one frequency per strike, not per note",
       three.freqs.join());
    ok(three.freqs.every((f) => f === A.MUSIC_HZ.G6),
       "and every strike is the fundamental", three.freqs.join());
    ok(three.gap > 0 && three.dur > 0, "there is a gap and a length to hand arp()");
    ok(three.notes.every((n) => n.v <= A.MUSIC_CONFIG.maxGain), "the bell respects the gain cap");
    ok(three.notes.some((n) => n.f === A.MUSIC_HZ.G6) && three.notes.some((n) => n.f === A.MUSIC_HZ.C7),
       "a fundamental and a partial - a bell, not a whistle");
    ok(A.bellNotes(0).strikes === 1 && A.bellNotes(99).strikes === 5,
       "the strike count is clamped to something a referee would do",
       A.bellNotes(0).strikes + " / " + A.bellNotes(99).strikes);
    ok(A.bellNotes().strikes === 1, "and defaults to a single ring");
  }

  section("the crowd");
  {
    const ko = A.crowdSwell("ko"), kd = A.crowdSwell("knockdown");
    const rev = A.crowdSwell("reversal"), esc = A.crowdSwell("escape");
    ok(ko.gain >= kd.gain && kd.gain >= rev.gain && rev.gain >= esc.gain,
       "the crowd reacts in proportion to what it saw",
       [ko.gain, kd.gain, rev.gain, esc.gain].join(" > "));
    ok(ko.release > kd.release && kd.release > esc.release,
       "and a knockout takes the longest to come back down",
       ko.release + " / " + kd.release + " / " + esc.release);
    ok([ko, kd, rev, esc].every((c) => c.attack > 0 && c.hold > 0 && c.release > 0 && c.band > 0),
       "every swell is a real envelope with a filter band");
    ok([ko, kd, rev, esc].every((c) => c.gain <= A.MUSIC_CONFIG.maxGain),
       "and none of them shout over the fight");
    ok(ko.attack < esc.attack, "a knockout hits the room faster than a scramble does",
       ko.attack + " vs " + esc.attack);
  }
  {
    const room = A.crowdSwell("something_new");
    ok(room.gain > 0 && room.gain < A.crowdSwell("ko").gain,
       "an unnamed event still gets room tone - the arena is never empty", room.gain);
    const off = A.crowdSwell(null);
    ok(off.gain === 0 && off.attack === 0 && off.release === 0 && off.event === "",
       "and nothing at all returns a zeroed descriptor the renderer can still read");
    ok(A.crowdSwell("KO").event === "ko", "the event name is case-insensitive");
    const half = A.crowdSwell("ko", 0.5), none = A.crowdSwell("ko", 0);
    ok(half.gain < A.crowdSwell("ko").gain && half.gain > 0, "a partial event swells less", half.gain);
    ok(none.gain === 0, "and a zero multiplier is silence", none.gain);
    ok(A.crowdSwell("ko", 9).gain === A.crowdSwell("ko").gain, "the multiplier cannot amplify");
    ok(half.hold === A.crowdSwell("ko").hold,
       "but the SHAPE of the reaction does not change - only how much of it there is");
    // the callers compute this from hp/maxhp, and the one arithmetic that
    // produces a NaN is a knockout landed on a fighter already at zero.
    // Clamping that to 0 would kill the crowd on the only moment that matters.
    const full = A.crowdSwell("ko").gain;
    ok(A.crowdSwell("ko", 0 / 0).gain === full, "a NaN multiplier means all of it, not none");
    ok(A.crowdSwell("ko", undefined).gain === full, "so does an absent one");
    ok(A.crowdSwell("ko", null).gain === full, "and a null one");
    ok(A.crowdSwell("ko", 0).gain === 0, "but a real zero is still silence");
  }
  {
    // the parser, directly. MUSIC_BAD being empty proves the shipped tracks
    // are clean; this proves the collector would have caught them.
    const before = A.MUSIC_BAD.length;
    const seq = A.musicSeq("A4 . E4+A4  not_a_note");
    ok(seq.length === 4, "a token is a step and a double space is not", seq.length);
    ok(seq[0] === A.MUSIC_HZ.A4, "a name becomes its frequency", seq[0]);
    ok(seq[1] === null, "a dot is a rest", JSON.stringify(seq[1]));
    ok(Array.isArray(seq[2]) && seq[2].length === 2 && seq[2][0] === A.MUSIC_HZ.E4,
       "a plus builds a chord", JSON.stringify(seq[2]));
    ok(seq[3] === null && A.MUSIC_BAD[A.MUSIC_BAD.length - 1] === "not_a_note",
       "and a typo is collected rather than silently swallowed", A.MUSIC_BAD.join());
    A.MUSIC_BAD.length = before;   // the typo was ours; do not leave it lying there
  }

  section("no audio anywhere near this module");
  {
    // the sandbox has no AudioContext and setTimeout never fires. If any
    // of this needed either one, none of the above could have run.
    ok(typeof A.exec("typeof window.AudioContext") === "string" &&
       A.exec("typeof window.AudioContext") === "undefined",
       "the sandbox genuinely has no AudioContext");
    const fns = ["musicSeq", "newMusicState", "musicTick", "musicCollectStep", "musicAdvanceClock",
                 "musicSwitch", "musicHeat", "musicIntensity", "musicLayersOn", "musicStop",
                 "musicMute", "bellNotes", "crowdSwell"];
    const raw = A.exec(fns.map((f) => f + ".toString()").join("+"));
    // strip comments before looking. Scanning the prose instead of the code
    // means a comment that NAMES the thing the module must not call fails
    // the check - which is exactly what happened the first time bellNotes
    // explained why it does not hand the partial to the arp helper.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    ["AudioContext", "createOscillator", "createGain", "document", "window.",
     "cx.", "beep(", "arp(", "Math.random", "Date."].forEach((bad) => {
      ok(src.indexOf(bad) < 0, "the score never reaches for " + bad, bad);
    });
    ok(raw.length > src.length, "and the module explains itself while doing it");
  }
};
