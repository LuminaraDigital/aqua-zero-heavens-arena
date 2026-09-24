/* =====================================================================
   Aqua Zero Heavens Arena - the score
   Luminara Digital

   The whole audio design was ten blips. Ten. A jab, a block, a KO
   jingle and eight friends, and between them nothing at all - a fight
   played in silence with occasional square waves. Pride FC shipped in
   2003 with worse graphics than this and is remembered almost entirely
   for its sound: the walkout theme, the ring bell, and a crowd that
   came up under a knockdown like weather. That is what this file is
   for.

   THIS MODULE OWNS NOTE DATA AND A CLOCK. It never touches an
   AudioContext, an oscillator, a gain node, a canvas or the DOM. It
   returns arrays of {f, d, type, v} and the page feeds them to the
   `beep` it already has. That split is the only reason the score is
   testable at all: the test sandbox has no AudioContext, so anything
   that reached for one here would be untestable by construction, which
   is exactly how the ten blips got away with never being tested.

   THE CLOCK. The game runs a fixed 60fps step loop. A track is a loop
   of STEPS; a step is `step` frames long; a layer names one note (or a
   chord) per step, or a rest. musicTick advances exactly one frame and
   returns the notes that begin on it - which is an empty array on 7
   frames out of 8. Nothing here is time-of-day dependent and nothing
   calls Math.random, so two states ticked in lockstep produce byte
   identical output forever.

   ONE KEY, ON PURPOSE. Every track is in A minor. Every pitch in the
   file comes out of MUSIC_HZ, and a test asserts that. The reason is
   not purity - it is that the game cuts between tracks constantly
   (menu -> entrance -> fight -> fight_hot -> victory) and a cut between
   two unrelated keys reads as a bug even to someone who cannot name
   what went wrong. The single accidental in the whole score is G#, the
   raised leading tone, and it appears only in fight_hot and boss, where
   the point is to sound like an unanswered question.

   GAIN BUDGET. The existing effects sit at 0.05 and below (sHit is the
   loudest thing in the game at 0.08). Music that competes with the
   punch is music that gets switched off, so no layer exceeds
   MUSIC_CONFIG.maxGain and a test enforces it. Bass carries; the lead
   sits under it.

   INTENSITY THINS THE ARRANGEMENT, IT DOES NOT TURN A KNOB. Every
   layer declares the tension window [from, to] it exists inside. At
   rest you hear bass, lead and a pad. As the fight gets desperate the
   pad drops out and a hat and a driving stab come in - fewer soft
   things, more hard ones. Riding a master volume instead would make a
   tense fight quieter or louder, which is not what tension sounds
   like. Layer gains are identical at every level; only the membership
   changes.

   MUTED IS NOT STOPPED. The page checks SAVE.sound before it calls
   beep, but a muted score that also stopped counting would resume in
   the middle of a bar the moment sound came back on. musicMute keeps
   the clock running and returns nothing, so unmuting lands on a real
   downbeat.
   ===================================================================== */

/* ---------------------------------------------------------------------
   MUSIC_HZ - equal temperament, A4 = 440. Written out rather than
   computed so the data below is greppable: if a track sounds wrong you
   can find the note by name, not by hunting a power of two.
   --------------------------------------------------------------------- */
const MUSIC_HZ = {
  E2:  82.41, F2:  87.31, G2:  98.00, A2: 110.00,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.00, GS3: 207.65, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.00, GS4: 415.30, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
  A5: 880.00, E6: 1318.51,
  /* the bell is not part of the score - it is an object in the room */
  G6: 1567.98, C7: 2093.00,
};

/* Every token musicSeq could not resolve lands here. A typo in a track
   string would otherwise become a silent rest that nobody ever notices;
   a test asserts this stays empty. Collecting instead of throwing is
   deliberate - a bad note must not brick the page at load. */
const MUSIC_BAD = [];

/* ---------------------------------------------------------------------
   musicSeq - "A2 . C3 . E3+A3 . . ." -> [110, null, 130.81, ...]

   The tracks are authored as strings because a 32-entry array of
   floats is unreadable and unreviewable, and an unreadable score is a
   score nobody will ever fix. "." is a rest, "+" builds a chord.
   --------------------------------------------------------------------- */
function musicSeq(str) {
  const out = [];
  const toks = String(str).split(" ");
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t) continue;                       // authored in 8-token groups, so spaces double up
    if (t === ".") { out.push(null); continue; }
    if (t.indexOf("+") >= 0) {
      const parts = t.split("+"), chord = [];
      for (let j = 0; j < parts.length; j++) {
        const hz = MUSIC_HZ[parts[j]];
        if (hz === undefined) MUSIC_BAD.push(parts[j]); else chord.push(hz);
      }
      out.push(chord.length ? chord : null);
      continue;
    }
    const hz = MUSIC_HZ[t];
    if (hz === undefined) { MUSIC_BAD.push(t); out.push(null); }
    else out.push(hz);
  }
  return out;
}

/* ---------------------------------------------------------------------
   MUSIC_CONFIG - every tunable in one place.

   `fade` is in frames at 60fps, matching src/ui/anim.js. hotAt/coolAt
   are deliberately NOT the same number: a single threshold at the exact
   HP fraction where the fight gets tense would swap tracks every time a
   heal or a chip tick crossed it, and the player would hear the score
   flapping. The 0.13 of hysteresis is the whole fix.
   --------------------------------------------------------------------- */
const MUSIC_CONFIG = {
  fps: 60,
  /* a musical crossfade wants most of a bar; 45 frames is 0.75s */
  fade: 45,
  /* the fight -> fight_hot swap is a gear change, not a scene change */
  swapFade: 24,
  /* nothing in the score may be louder than the quietest thing the
     fight itself makes, or the fight loses the argument */
  maxGain: 0.05,
  hotAt: 0.55,
  coolAt: 0.42,
};

/* ---------------------------------------------------------------------
   MUSIC_TRACKS.

   step  frames per step at 60fps (8 -> 112 BPM in sixteenths)
   len   steps in the loop; every layer's seq must be exactly this long
   once  play through and stop, instead of looping (stingers)
   layers
     id    what it is; the duel HUD and the tests both branch on it
     type  oscillator type handed straight to beep()
     d     note length in SECONDS (beep's second argument)
     v     gain, capped by MUSIC_CONFIG.maxGain
     from  lowest tension this layer exists at (inclusive)
     to    highest tension this layer exists at (inclusive)

   fight and fight_hot share `step` on purpose. That is what lets
   musicSwitch keep the beat across the swap; give them different
   tempos and the gear change becomes a stumble.
   --------------------------------------------------------------------- */
const MUSIC_TRACKS = {

  /* Wide and slow. The title screen is the only place in the game where
     nothing is being decided, so the score does nothing either. */
  title: {
    step: 14, len: 16,
    layers: [
      { id: "bass", type: "triangle", d: 0.50, v: 0.045, from: 0, to: 1,
        seq: musicSeq("A2 . . . E2 . . . " + "F2 . . . C3 . . . ") },
      { id: "pad", type: "sine", d: 1.20, v: 0.030, from: 0, to: 1,
        seq: musicSeq("A3+C4+E4 . . . . . . . " + "F3+A3+C4 . . . . . . . ") },
      { id: "lead", type: "triangle", d: 0.35, v: 0.035, from: 0, to: 1,
        seq: musicSeq("A4 . . C5 . . B4 . " + "A4 . . G4 . . E4 . ") },
    ],
  },

  /* Menus are a place you pass through. Steady, unhurried, and it must
     survive being heard for ten minutes while somebody reads a dossier. */
  menu: {
    step: 11, len: 16,
    layers: [
      { id: "bass", type: "triangle", d: 0.30, v: 0.040, from: 0, to: 1,
        seq: musicSeq("A2 . . . A2 . . . " + "G2 . . . G2 . . . ") },
      { id: "pad", type: "sine", d: 0.80, v: 0.028, from: 0, to: 0.8,
        seq: musicSeq("A3+E4 . . . . . . . " + "G3+D4 . . . . . . . ") },
      { id: "lead", type: "square", d: 0.12, v: 0.030, from: 0, to: 1,
        seq: musicSeq("E4 . A4 . C5 . B4 . " + "D5 . B4 . G4 . A4 . ") },
    ],
  },

  /* The walkout. A march that climbs - the melody goes up a step every
     bar and lands on the fifth, because a man walking to a ring is
     going somewhere. Never gated by intensity: nobody is hurt yet. */
  entrance: {
    step: 10, len: 32,
    layers: [
      { id: "bass", type: "sawtooth", d: 0.22, v: 0.045, from: 0, to: 1,
        seq: musicSeq("A2 . A2 . A2 . A2 . " + "F2 . F2 . F2 . F2 . " +
                      "G2 . G2 . G2 . G2 . " + "A2 . A2 . A2 . E2 . ") },
      { id: "pulse", type: "triangle", d: 0.05, v: 0.022, from: 0, to: 1,
        seq: musicSeq(". . . . E3 . . . " + ". . . . E3 . . . " +
                      ". . . . E3 . . . " + ". . . . E3 . . . ") },
      { id: "lead", type: "square", d: 0.18, v: 0.035, from: 0, to: 1,
        seq: musicSeq("A4 . . B4 . . C5 . " + "C5 . . D5 . . C5 . " +
                      "D5 . . E5 . . D5 . " + "E5 . . . C5 . A4 . ") },
    ],
  },

  /* The fight. Am - F - G - Am, two bars, sixteenths. The pad is the
     only thing here that sounds comfortable, which is why it is the
     first thing to leave. */
  fight: {
    step: 8, len: 32,
    layers: [
      { id: "bass", type: "triangle", d: 0.16, v: 0.045, from: 0, to: 1,
        seq: musicSeq("A2 . A2 . A2 . E3 . " + "F2 . F2 . F2 . C3 . " +
                      "G2 . G2 . G2 . D3 . " + "A2 . A2 . A2 . G2 . ") },
      { id: "pad", type: "sine", d: 0.55, v: 0.028, from: 0, to: 0.72,
        seq: musicSeq("A3+C4+E4 . . . . . . . " + "F3+A3+C4 . . . . . . . " +
                      "G3+B3+D4 . . . . . . . " + "A3+C4+E4 . . . . . . . ") },
      { id: "lead", type: "square", d: 0.11, v: 0.034, from: 0, to: 1,
        seq: musicSeq("A4 . C5 . B4 . A4 . " + "C5 . . A4 F4 . A4 . " +
                      "D5 . B4 . G4 . B4 . " + "C5 . B4 A4 . . E4 . ") },
      { id: "hat", type: "square", d: 0.025, v: 0.016, from: 0.35, to: 1,
        seq: musicSeq(". . E6 . . . E6 . " + ". . E6 . . . E6 . " +
                      ". . E6 . . . E6 . " + ". . E6 . . . E6 . ") },
      { id: "drive", type: "sawtooth", d: 0.10, v: 0.030, from: 0.70, to: 1,
        seq: musicSeq("A3 . A3 . A3 . A3 . " + "F3 . F3 . F3 . F3 . " +
                      "G3 . G3 . G3 . G3 . " + "A3 . A3 . A3 . A3 . ") },
    ],
  },

  /* Same tempo, same key, different question. The third chord moves
     from G to E major - that G# is the only note in the score outside A
     natural minor, and it is there so the loop never sounds settled. */
  fight_hot: {
    step: 8, len: 32,
    layers: [
      { id: "bass", type: "triangle", d: 0.13, v: 0.045, from: 0, to: 1,
        seq: musicSeq("A2 A2 . A2 A2 . A2 . " + "F2 F2 . F2 F2 . F2 . " +
                      "E2 E2 . E2 E2 . E2 . " + "A2 A2 . A2 A2 . A2 A2 ") },
      { id: "lead", type: "square", d: 0.10, v: 0.034, from: 0, to: 1,
        seq: musicSeq("A4 . B4 C5 . B4 . A4 " + "C5 . D5 . C5 . A4 . " +
                      "B4 . GS4 . B4 . E5 . " + "C5 B4 A4 . . E4 . . ") },
      { id: "hat", type: "square", d: 0.022, v: 0.018, from: 0, to: 1,
        seq: musicSeq(". . E6 . . . E6 . " + ". . E6 . . . E6 . " +
                      ". . E6 . . . E6 . " + ". . E6 . . . E6 . ") },
      { id: "drive", type: "sawtooth", d: 0.09, v: 0.030, from: 0, to: 1,
        seq: musicSeq("A3 . A3 . A3 . A3 . " + "F3 . F3 . F3 . F3 . " +
                      "E3 . E3 . E3 . E3 . " + "A3 . A3 . A3 . A3 . ") },
      { id: "stab", type: "sawtooth", d: 0.18, v: 0.030, from: 0.72, to: 1,
        seq: musicSeq("A5 . . . . . . . " + ". . . . . . . . " +
                      "E5 . . . . . . . " + ". . . . . . . . ") },
    ],
  },

  /* The tower. Am - G - F - E, the oldest descent there is, and the
     fastest step in the file so it presses. */
  boss: {
    step: 7, len: 32,
    layers: [
      { id: "bass", type: "sawtooth", d: 0.14, v: 0.045, from: 0, to: 1,
        seq: musicSeq("A2 . A2 A2 . A2 . . " + "G2 . G2 G2 . G2 . . " +
                      "F2 . F2 F2 . F2 . . " + "E2 . E2 E2 . E2 . E2 ") },
      { id: "pad", type: "sine", d: 0.50, v: 0.026, from: 0, to: 0.80,
        seq: musicSeq("A3+C4+E4 . . . . . . . " + "G3+B3+D4 . . . . . . . " +
                      "F3+A3+C4 . . . . . . . " + "E3+GS3+B3 . . . . . . . ") },
      { id: "lead", type: "square", d: 0.10, v: 0.035, from: 0, to: 1,
        seq: musicSeq("E5 . . D5 . C5 . B4 " + "D5 . . C5 . B4 . A4 " +
                      "C5 . . B4 . A4 . GS4 " + "B4 . . GS4 . B4 . E5 ") },
      { id: "hat", type: "square", d: 0.020, v: 0.016, from: 0.30, to: 1,
        seq: musicSeq(". . E6 . . . E6 . " + ". . E6 . . . E6 . " +
                      ". . E6 . . . E6 . " + ". . E6 . . . E6 . ") },
      { id: "drive", type: "triangle", d: 0.08, v: 0.028, from: 0.65, to: 1,
        seq: musicSeq("A3 . . A3 . . A3 . " + "G3 . . G3 . . G3 . " +
                      "F3 . . F3 . . F3 . " + "E3 . . E3 . . E3 . ") },
    ],
  },

  /* Stingers. `once` matters: a victory fanfare that looped would still
     be going when the player reached the draft screen. */
  victory: {
    step: 9, len: 16, once: true,
    layers: [
      { id: "bass", type: "triangle", d: 0.30, v: 0.045, from: 0, to: 1,
        seq: musicSeq("A2 . . . F2 . . . " + "G2 . . . A2 . . . ") },
      { id: "pad", type: "sine", d: 0.90, v: 0.030, from: 0, to: 1,
        seq: musicSeq("A3+C4+E4 . . . . . . . " + "A3+E4+A4 . . . . . . . ") },
      { id: "lead", type: "square", d: 0.16, v: 0.040, from: 0, to: 1,
        seq: musicSeq("A4 . C5 . E5 . A5 . " + ". . G5 . E5 . A5 . ") },
    ],
  },

  /* The slowest step in the file. Losing should take a moment. */
  defeat: {
    step: 16, len: 16, once: true,
    layers: [
      { id: "bass", type: "triangle", d: 0.60, v: 0.040, from: 0, to: 1,
        seq: musicSeq("A2 . . . . . . . " + "E2 . . . . . . . ") },
      { id: "pad", type: "sine", d: 1.40, v: 0.026, from: 0, to: 1,
        seq: musicSeq("A3+C4 . . . . . . . " + "E3+A3 . . . . . . . ") },
      { id: "lead", type: "sine", d: 0.50, v: 0.030, from: 0, to: 1,
        seq: musicSeq("E4 . . D4 . . C4 . " + "B3 . . . A3 . . . ") },
    ],
  },
};

const MUSIC_TRACK_NAMES = Object.keys(MUSIC_TRACKS);

/* ---------------------------------------------------------------------
   State and clock.
   --------------------------------------------------------------------- */
const musicClamp01 = (n) => (typeof n !== "number" || n !== n) ? 0 : (n < 0 ? 0 : (n > 1 ? 1 : n));

/* A plain object, no methods, no closures - the page keeps one of these
   in G and the tests build a dozen. An unknown name yields a stopped
   state rather than a fallback track: silence is a bug you notice, the
   wrong music playing is a bug you argue about. */
function newMusicState(trackName) {
  const tr = MUSIC_TRACKS[trackName];
  return {
    name: trackName,
    playing: !!tr,
    f: 0,            // frames into the current step
    step: 0,         // index into the loop
    loops: 0,
    level: 0,        // tension, 0..1
    muted: false,
    prev: null,      // {name, f, step} while a crossfade is running
    fade: 0, fadeLen: 0,
  };
}

/* advance one frame of a clock. Returns true on the frame it wraps. */
function musicAdvanceClock(st, tr) {
  st.f++;
  if (st.f < tr.step) return false;
  st.f = 0; st.step++;
  if (st.step < tr.len) return false;
  st.step = 0; return true;
}

/* gather everything that begins on this step, at this tension, scaled by
   the crossfade mix */
function musicCollectStep(out, tr, stepIdx, level, mix) {
  if (mix <= 0) return out;
  for (let i = 0; i < tr.layers.length; i++) {
    const L = tr.layers[i];
    if (level < L.from || level > L.to) continue;
    const n = L.seq[stepIdx];
    if (n === null || n === undefined) continue;
    const v = +(L.v * mix).toFixed(4);
    if (v <= 0) continue;
    if (typeof n === "number") out.push({ f: n, d: L.d, type: L.type, v: v });
    else for (let j = 0; j < n.length; j++) out.push({ f: n[j], d: L.d, type: L.type, v: v });
  }
  return out;
}

/* ---------------------------------------------------------------------
   musicTick - one frame. Returns the notes that START on this frame,
   which is [] on most of them. The caller does:

     musicTick(G.music).forEach(n => beep(n.f, n.d, n.type, n.v));

   and that is the entire audio integration.
   --------------------------------------------------------------------- */
function musicTick(state) {
  if (!state || !state.playing) return [];
  const tr = MUSIC_TRACKS[state.name];
  if (!tr) { state.playing = false; return []; }

  /* the fade clock moves first so the incoming track is never completely
     silent on its own first downbeat - a crossfade that begins at
     exactly zero gain swallows the note the swap was made for */
  if (state.fade > 0) {
    state.fade--;
    if (state.fade <= 0) { state.prev = null; state.fadeLen = 0; }
  }
  const mix = (state.prev && state.fadeLen > 0) ? (state.fadeLen - state.fade) / state.fadeLen : 1;

  const out = [];
  if (state.f === 0) musicCollectStep(out, tr, state.step, state.level, mix);

  if (state.prev) {
    const pt = MUSIC_TRACKS[state.prev.name];
    if (pt) {
      if (state.prev.f === 0) musicCollectStep(out, pt, state.prev.step, state.level, 1 - mix);
      musicAdvanceClock(state.prev, pt);
    } else state.prev = null;
  }

  if (musicAdvanceClock(state, tr)) {
    state.loops++;
    /* a stinger has said what it had to say */
    if (tr.once) state.playing = false;
  }

  /* muted keeps time and says nothing. See the header: a muted score
     that stopped counting resumes mid-bar. */
  return state.muted ? [] : out;
}

/* ---------------------------------------------------------------------
   musicSwitch - crossfade or hard cut.

   opts.fade     frames of crossfade (default MUSIC_CONFIG.fade)
   opts.hard     true to cut with no overlap
   opts.keepBeat false to restart the new track from step 0 even when the
                 tempos match (default is to keep it)
   opts.restart  true to restart the track you are already on

   BEAT PRESERVATION is the whole reason this is not two lines. When the
   two tracks share `step` the step index and the sub-step frame carry
   over untouched, so fight -> fight_hot lands on the same sixteenth it
   left and the player hears an arrangement change, not a stumble. When
   the tempos differ there is no honest way to carry the position, so the
   new track starts clean and the old one finishes its fade on its own
   clock.
   --------------------------------------------------------------------- */
function musicSwitch(state, trackName, opts) {
  if (!state) return state;
  const nt = MUSIC_TRACKS[trackName];
  /* an unknown name must never silence a fight that is going fine */
  if (!nt) return state;
  opts = opts || {};

  /* A stinger that has finished must stay finished. The page reselects the
     current track every frame, so a bare `playing = true` here hands a
     spent fanfare back its pulse once per frame: measured at four full
     passes of `victory` in the time one should have played, and it never
     stops on its own. Ask for the second pass with opts.restart. */
  if (trackName === state.name && !opts.restart) {
    if (!nt.once) state.playing = true;
    return state;
  }

  /* You cannot crossfade out of silence. Capturing a stopped track here
     gives it a downbeat under the incoming one at (1 - mix), which measured
     as six extra notes across a 45-frame fade - a finished fanfare quietly
     starting over underneath the menu. */
  const old = (state.playing && MUSIC_TRACKS[state.name])
    ? { name: state.name, f: state.f, step: state.step } : null;
  const fade = opts.hard ? 0 : (opts.fade === undefined ? MUSIC_CONFIG.fade : opts.fade);
  const keep = opts.keepBeat !== false && !!old && !opts.restart && old.name !== trackName &&
               MUSIC_TRACKS[old.name].step === nt.step;

  if (keep) {
    state.step = state.step % nt.len;
    /* state.f is already valid: same step length, same sub-step position */
  } else {
    state.step = 0; state.f = 0;
  }

  state.name = trackName;
  state.playing = true;
  state.loops = 0;

  if (old && fade > 0) {
    state.prev = old; state.fade = fade; state.fadeLen = fade;
  } else {
    state.prev = null; state.fade = 0; state.fadeLen = 0;
  }
  return state;
}

/* ---------------------------------------------------------------------
   musicIntensity - the tension knob, 0 (both fresh) to 1 (somebody is
   about to go). The duel screen drives it from the LOWER of the two HP
   fractions, inverted:

     musicIntensity(G.music, 1 - Math.min(p.hp/p.maxhp, e.hp/e.maxhp));

   It changes which layers exist, never how loud they are.
   --------------------------------------------------------------------- */
function musicIntensity(state, level) {
  if (!state) return 0;
  state.level = musicClamp01(level);
  return state.level;
}

/* which layers are sounding right now - for the tests, and for anything
   that wants to show the player what the score is doing */
function musicLayersOn(state) {
  const tr = state && MUSIC_TRACKS[state.name];
  if (!tr) return [];
  const lv = state.level, out = [];
  for (let i = 0; i < tr.layers.length; i++) {
    const L = tr.layers[i];
    if (lv >= L.from && lv <= L.to) out.push(L.id);
  }
  return out;
}

/* ---------------------------------------------------------------------
   musicHeat - set the tension AND make the fight/fight_hot decision in
   one call, with hysteresis so the score does not flap around a single
   threshold. Returns the track playing after the call.
   --------------------------------------------------------------------- */
function musicHeat(state, level) {
  if (!state) return "";
  const lv = musicIntensity(state, level);
  if (state.name === "fight" && lv >= MUSIC_CONFIG.hotAt) {
    musicSwitch(state, "fight_hot", { fade: MUSIC_CONFIG.swapFade });
  } else if (state.name === "fight_hot" && lv <= MUSIC_CONFIG.coolAt) {
    musicSwitch(state, "fight", { fade: MUSIC_CONFIG.swapFade });
  }
  return state.name;
}

function musicStop(state) {
  if (!state) return state;
  state.playing = false; state.prev = null; state.fade = 0; state.fadeLen = 0;
  return state;
}

function musicPlaying(state) {
  return !!(state && state.playing && MUSIC_TRACKS[state.name]);
}

/* muting is not stopping - the clock keeps running */
function musicMute(state, on) {
  if (!state) return state;
  state.muted = on !== false;
  return state;
}

/* ---------------------------------------------------------------------
   bellNotes - the ring bell.

   Pride's bell is a struck object, not a tune: a fundamental with a
   bright partial a fifth-and-an-octave above it, hit a fixed number of
   times. One strike opens a round, three end the fight. Returned as
   data so the page can either hand the frequencies to `arp` or fire
   them individually with the rounder oscillator type; the harness stubs
   setTimeout to a no-op, so the arp path is untestable by definition
   and the descriptor is the only thing worth asserting on.
   --------------------------------------------------------------------- */
function bellNotes(strikes) {
  const n = Math.max(1, Math.min(5, Math.round(strikes || 1)));
  const notes = [], freqs = [];
  for (let i = 0; i < n; i++) {
    notes.push({ f: MUSIC_HZ.G6, d: 0.55, type: "triangle", v: MUSIC_CONFIG.maxGain });
    /* the partial is what stops it reading as a whistle */
    notes.push({ f: MUSIC_HZ.C7, d: 0.30, type: "square", v: 0.02 });
    freqs.push(MUSIC_HZ.G6);
  }
  return {
    strikes: n,
    /* ms between strikes - a bell rung faster than this reads as an alarm */
    gap: 190,
    notes: notes,
    /* ONE ENTRY PER STRIKE, not per note. arp() spaces whatever it is given
       by `gap`, so listing the partial here as well would ring six
       alternating tones 190ms apart instead of three bells 190ms apart -
       double the interval and the wrong instrument. The partial only makes
       sense struck WITH the fundamental, which is the `notes` path. */
    freqs: freqs,
    dur: 0.55,
    vol: MUSIC_CONFIG.maxGain,
    type: "triangle",
  };
}

/* ---------------------------------------------------------------------
   crowdSwell - an ADSR-ish envelope for filtered noise, in frames.

   The crowd is the cheapest drama in the game and the one thing every
   memory of Pride has in common: it came up under a knockdown and it
   took a long time to go back down. That long release is the whole
   effect - a crowd that stops the instant the replay ends is a sample,
   not a room.

   attack/hold/release are frames at 60fps. `band` is the centre of the
   band-pass the renderer should push its noise through (a real crowd is
   mostly 600-1200Hz), `q` its narrowness. `mul` scales the gain for a
   partial event - a knockdown at 5% HP should not sound like one at
   80%. Returns a zeroed descriptor rather than null so a renderer can
   read the fields unconditionally.
   --------------------------------------------------------------------- */
function crowdSwell(event, mul) {
  const off = { event: "", gain: 0, attack: 0, hold: 0, release: 0, band: 0, q: 1 };
  if (!event) return off;
  const k = String(event).toLowerCase();
  let e;
  if (k === "ko")            e = { gain: 0.050, attack:  4, hold: 60, release: 150, band: 1100, q: 0.6 };
  else if (k === "knockdown") e = { gain: 0.048, attack:  6, hold: 34, release:  90, band:  950, q: 0.7 };
  else if (k === "reversal")  e = { gain: 0.040, attack:  8, hold: 22, release:  64, band: 1000, q: 0.8 };
  else if (k === "escape")    e = { gain: 0.030, attack: 10, hold: 14, release:  48, band:  820, q: 0.9 };
  else if (k === "entrance")  e = { gain: 0.036, attack: 40, hold: 70, release: 120, band:  700, q: 1.1 };
  else if (k === "bell")      e = { gain: 0.034, attack: 12, hold: 26, release:  70, band:  880, q: 0.9 };
  /* an unnamed event still gets a room tone - the arena is never empty */
  else                        e = { gain: 0.018, attack: 14, hold: 12, release:  40, band:  760, q: 1.2 };

  /* An absent or unusable multiplier means "all of it". Routing it through
     musicClamp01 instead would turn a NaN into 0, and the callers that
     compute this from hp/maxhp produce exactly one NaN: a KO landed on a
     fighter already at zero. Silencing the crowd on the knockout is the
     one failure this whole file exists to prevent. */
  const m = (typeof mul === "number" && mul === mul) ? musicClamp01(mul) : 1;
  return {
    event: k,
    gain: +Math.min(MUSIC_CONFIG.maxGain, e.gain * m).toFixed(4),
    attack: e.attack, hold: e.hold, release: e.release,
    band: e.band, q: e.q,
  };
}

/* Crowd cue families with cooldowns so reactions accent, never drown,
   commentary. Inspired by fight-night audio packs; procedural here. */
const CROWD_FAMILIES = {
  ko: { cooldown: 180, variants: ["ko", "knockdown"] },
  heat: { cooldown: 90, variants: ["reversal", "escape"] },
  room: { cooldown: 60, variants: ["entrance", "bell", "crowd"] },
};
const CROWD_FAMILY_STATE = { last: {}, lastVariant: {} };

function crowdFamilyOf(event) {
  const k = String(event || "").toLowerCase();
  const ids = Object.keys(CROWD_FAMILIES);
  for (let i = 0; i < ids.length; i++) {
    const fam = CROWD_FAMILIES[ids[i]];
    if (fam.variants.indexOf(k) >= 0 || ids[i] === k) return ids[i];
  }
  return "room";
}

function crowdCue(event, mul, frameClock) {
  const fam = crowdFamilyOf(event);
  const conf = CROWD_FAMILIES[fam] || CROWD_FAMILIES.room;
  const t = typeof frameClock === "number" ? frameClock : 0;
  const last = Object.prototype.hasOwnProperty.call(CROWD_FAMILY_STATE.last, fam)
    ? CROWD_FAMILY_STATE.last[fam]
    : -1e9;
  if (t - last < conf.cooldown) {
    return { event: "", gain: 0, attack: 0, hold: 0, release: 0, band: 0, q: 1, suppressed: true, family: fam };
  }
  const variants = conf.variants;
  let pick = String(event || variants[0]).toLowerCase();
  if (variants.indexOf(pick) < 0) pick = variants[0];
  if (pick === CROWD_FAMILY_STATE.lastVariant[fam] && variants.length > 1) {
    pick = variants[(variants.indexOf(pick) + 1) % variants.length];
  }
  CROWD_FAMILY_STATE.last[fam] = t;
  CROWD_FAMILY_STATE.lastVariant[fam] = pick;
  const swell = crowdSwell(pick, mul);
  swell.family = fam;
  swell.variant = pick;
  swell.suppressed = false;
  return swell;
}

function crowdCueReset() {
  CROWD_FAMILY_STATE.last = {};
  CROWD_FAMILY_STATE.lastVariant = {};
}
