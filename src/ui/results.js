/* =====================================================================
   Aqua Zero Heavens Arena - the post-fight ceremony
   Luminara Digital

   The battle model has been filling in newDuelStats() on every single
   fight since the challenge system landed - damage both ways, landed
   strikes, throws, submissions, guards held, perfect guards, the best
   air combo, the range tally, and what class of technique finished it -
   and then throwing all of it away. The result screen said "K.O." on a
   black field and moved on. Nineteen recorded numbers, one word shown.

   This file turns that stat block into the three things a fight report
   owes the player:

     methodOfVictory   what ended it, where, and on which turn
     fightStatRows     the readout, one labelled row at a time
     fightGrade        a defensible letter, from ratios not vibes
     ceremonyBeats     when each of those lands on screen

   There is deliberately no canvas, no ctx, no DOM and no drawing below.
   Same split as src/ui/anim.js: this owns intent, the renderer in
   page.template.html owns pixels. That is what lets a test assert that a
   ground-and-pound finish reads as a TECHNICAL KNOCKOUT without booting
   a screen.

   WHAT THE STAT BLOCK ACTUALLY HOLDS - checked against the battle layer,
   not against the comment on newDuelStats:

     dmgDealt/strikes/throws/subs   PLAYER side only, and only on a LANDED
                                    hit (commitEvent, page.template ~923).
                                    There is no attempt counter anywhere,
                                    so no row here can be an accuracy
                                    percentage - "significant strikes" is
                                    strikes that CONNECTED.
     guards                         turns the player chose a GUARD class
                                    technique (ev.guarded is set by the
                                    thrower's own class in resolve.js).
     koClass/koRange                set in turnEnd ONLY when the opponent
                                    is the one who hit zero, so on a
                                    DEFEAT both are null and the method
                                    has to be inferred from hpLeft and
                                    turns. koClass is a technique class:
                                    STRIKE | THROW | SUB | GUARD | SETUP.
                                    koRange is the technique's OWN range,
                                    which can be "ANY".
     discs                          declared, never written to by anything
                                    in the battle layer. Do not build a
                                    row on it; it is always empty.
     hpLeft/lowest                  fractions 0..1, not hit points.

   Globals assumed: RANGE_LABEL, RANGE_ORDER. Both are read from inside
   function bodies only - this module's text lands well above them in the
   bundle and a top-level reference would be a load-time ReferenceError.
   ===================================================================== */

/* ---------------------------------------------------------------------
   RESULT_CONFIG - every tunable in one place, literals only.

   Nothing here may reference W, H, a colour or a game global: this
   object is built at load time, long before any of them exist.
   --------------------------------------------------------------------- */
const RESULT_CONFIG = {
  /* Stated, not read - the same declaration MUSIC_CONFIG and
     ENTRANCE_CONFIG carry. Every frame count in this file, in the
     walkout and in the score is 60ths of a second, and the one way that
     stops being obvious is if a module quietly stops saying so. */
  fps: 60,

  method: {
    /* A loss inside this many turns reads as one shot; past it the man
       was worn down, which is a stoppage and not a knockout. The split
       has to come from turns because a defeat records no koClass at
       all - the battle layer only writes it when the OTHER corner
       falls. */
    fastFinish: 6,
  },

  stats: {
    comboFull: 3,        // three beats is the whole air-combo ladder
    longFight: 16,       // turns; the turn bar is full at a long fight
    /* rows that are honestly zero most fights - a striker's fight has no
       submissions and saying "0" nine times is noise, not a readout */
    droppable: ["throws", "subs", "combo"],
  },

  grade: {
    /* A win starts above the best possible loss and a forfeit starts at
       nothing. This is the whole ordering guarantee: winBase alone
       (50) already outscores lossCap (33), so no amount of heroic
       losing ever out-grades winning, and no grade argument can be won
       by pointing at damage numbers. */
    winBase: 50, lossBase: 16, lossEarnMul: 0.6, lossCap: 33, forfeitScore: 0,
    dmgShare: 18,        // share of the fight's total damage that was theirs
    health: 14,          // what you walked out with
    speed: 10,           // finishing early is worth something
    perfect: 8,          // untouched
    fast: 2, slow: 16,   // turns: full speed credit at 2, none at 16
    sigPerfect: 3, sigCap: 6,
    combo: 4,
    perfectGuard: 1.5, guardCap: 6,
    /* thresholds, high to low - the first one the score clears wins */
    table: [[92, "S"], [82, "A"], [70, "B"], [58, "C"], [44, "D"], [30, "E"], [0, "F"]],
    /* the clauses, in the order they are tested. First true one is the
       justification, so the most specific claim has to come first. */
    brink: 0.15, thin: 0.25, quick: 4, oneSided: 0.65, outworked: 0.4,
  },

  ceremony: {
    /* The result screen is the one place the game is allowed to be slow,
       and the one place a player is definitely holding A. Everything
       lands inside two seconds: 120 frames at 60fps, hard ceiling 150.

       `lead` is frames after the PREVIOUS SHOWN beat starts, not an
       absolute time. That is the whole trick - when a screen has no
       fighter art and no stat line (the field simply ran out of steps)
       the remaining beats close the gap instead of waiting out a hole
       for something that is never drawn. */
    order: ["art", "method", "grade", "stats", "payout", "prompt"],
    lead: { art: 0, method: 20, grade: 18, stats: 12, payout: 36, prompt: 18 },
    dur: { art: 26, method: 18, grade: 14, stats: 34, payout: 16, prompt: 10 },
    tail: 6,             // a beat of quiet after the last thing moves
    reduced: 6,          // reduced motion: everything is already there
    /* Result kinds that already own their screen - the daily's score
       block and the ladder's grade panel both live at y 206-310. There
       is no spare room for a nine-row panel, so those screens carry the
       stat page on a tab instead. The timeline is the same either way;
       this flag only tells the renderer where to put it. */
    dense: ["dailywin", "dailyloss", "rankwin", "rankloss"],
    /* no fight happened - no art to raise, no stat line to read */
    noFight: ["steps"],
  },
};

/* the method tokens, so nothing downstream has to spell them */
const RESULT_METHODS = {
  KO: "KNOCKOUT",
  TKO: "TECHNICAL KNOCKOUT",
  SUB: "SUBMISSION",
  DEC: "DECISION",
  FF: "FORFEIT",
  TIME: "TIME",
};

/* One clause of colour per method, in three voices. The hotseat voice
   exists because "you" is a lie when two people are sharing a keyboard -
   neither of them is the player. */
const RESULT_DETAIL = {
  KNOCKOUT: { win: "ONE SHOT ENDED IT", loss: "YOU NEVER SAW IT COMING",
              flat: "IT ONLY TOOK ONE" },
  "TECHNICAL KNOCKOUT": { win: "THEY STOPPED ANSWERING BACK", loss: "YOU WERE WORN DOWN",
                          flat: "THE ANSWERS RAN OUT" },
  SUBMISSION: { win: "THEY HAD NOWHERE LEFT TO GO", loss: "THERE WAS NO WAY OUT OF IT",
                flat: "THE HOLD WAS FINISHED" },
  DECISION: { win: "IT WENT THE DISTANCE AND THE WORK WAS YOURS",
              loss: "IT WENT THE DISTANCE AND IT WENT AGAINST YOU",
              flat: "IT WENT THE DISTANCE" },
  FORFEIT: { win: "THE OTHER CORNER PULLED THEM OUT", loss: "YOU GAVE THE FIGHT UP",
             flat: "ONE CORNER GAVE IT UP" },
  TIME: { win: "THE CLOCK RAN OUT ON THEM", loss: "THE CLOCK RAN OUT ON YOU",
          flat: "THE CLOCK BEAT BOTH OF THEM" },
};

/* ---------------------------------------------------------------------
   Small shared arithmetic.

   Named apart on purpose: `clamp` is already declared in src/ui/anim.js
   and `clamp01` in src/battle/position.js, both at top level, both in
   this same script scope. A third one would be a redeclaration crash on
   load, not a subtle bug.
   --------------------------------------------------------------------- */
const resNum = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const resClamp = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
/* a bar with no denominator is NOT a zero bar - it is no bar at all.
   Returning 0 here would draw an empty rail on every stat the fight
   never had a chance to measure, which reads as a failure rather than
   as an absence. */
const resShare = (a, b) => (b > 0 ? resClamp(a / b) : null);
const resPct = (f) => Math.round(resClamp(resNum(f)) * 100);
/* smoothstep. Local rather than EASE.easeInOut so the ceremony keeps
   working if the animation module is ever reordered or dropped. */
const resEase = (p) => { const t = resClamp(p); return t * t * (3 - 2 * t); };

/* ---------------------------------------------------------------------
   dominantRange - where the fight actually lived.

   The tally is written once per turn in turnEnd() against d.range, so
   it is a count of turns and its total IS the turn count. Ties break
   toward the CLOSER range (later in RANGE_ORDER): a fight split evenly
   between boxing range and the mat is a mat fight, because getting it
   there is the thing that had to be earned.
   --------------------------------------------------------------------- */
function dominantRange(ranges, turns) {
  const order = (typeof RANGE_ORDER !== "undefined" && RANGE_ORDER)
    ? RANGE_ORDER : ["LONG", "MID", "CLINCH", "GROUND"];
  const labels = (typeof RANGE_LABEL !== "undefined" && RANGE_LABEL) ? RANGE_LABEL : null;
  const t = ranges || {};
  let total = 0;
  for (const k in t) total += resNum(t[k]);
  let key = null, best = 0;
  for (let i = 0; i < order.length; i++) {
    const n = resNum(t[order[i]]);
    if (n > 0 && n >= best) { best = n; key = order[i]; }
  }
  const denom = total > 0 ? total : (resNum(turns) > 0 ? resNum(turns) : 0);
  if (!key) return { key: null, label: "", turns: 0, share: 0 };
  return {
    key,
    label: (labels && labels[key]) || key,
    turns: best,
    share: denom > 0 ? resClamp(best / denom) : 0,
  };
}

/* ---------------------------------------------------------------------
   methodOfVictory - what ended it, said the way the sport says it.

   Order matters and is not arbitrary:

     1. a forfeit is a forfeit whatever else the stat block says. It is
        the one outcome the player chose rather than earned, and burying
        it under a "TECHNICAL KNOCKOUT" would be a lie the fight menu
        already warned them about.
     2. a fight that reached the clock was never finished, so no koClass
        can describe it.
     3. a win reads its finish off koClass and koRange.
     4. a DEFEAT has neither - the battle layer only records the finish
        when the opponent falls - so it is inferred from hpLeft (were
        you dropped at all) and turns (one shot, or an accumulation).

   Never returns undefined. Every branch below terminates in a token
   from RESULT_METHODS, including for stats === null.
   --------------------------------------------------------------------- */
function methodOfVictory(stats, opts) {
  const st = stats || {};
  const o = opts || {};
  const M = RESULT_METHODS;
  const turns = Math.max(0, Math.round(resNum(st.turns)));
  const win = !!st.win;
  const forfeit = !!st.forfeit;
  const hpLeft = typeof st.hpLeft === "number" ? st.hpLeft : (win ? 1 : 0);
  const cls = st.koClass || null;
  /* the caller owns the clock - nothing in the duel model counts rounds,
     so "it went the distance" has to be declared, never guessed */
  const distance = !!o.distance || (resNum(o.limit) > 0 && turns >= resNum(o.limit));

  let method;
  if (forfeit) method = M.FF;
  else if (distance) method = win || hpLeft > 0 ? M.DEC : M.TKO;
  else if (win) {
    if (cls === "SUB") method = M.SUB;
    else if (cls === "STRIKE") {
      /* punches on a man who is already down is a stoppage, not a
         knockout - the referee ends it, the shot does not */
      method = st.koRange === "GROUND" ? M.TKO : M.KO;
    } else if (cls === "THROW") method = M.TKO;
    /* GUARD, SETUP, or nothing recorded: the fight was not ended by the
       last technique thrown, it was ended by everything before it */
    else method = M.TKO;
  } else if (hpLeft > 0) {
    /* still standing and the fight is over anyway */
    method = M.TIME;
  } else {
    method = turns <= RESULT_CONFIG.method.fastFinish ? M.KO : M.TKO;
  }

  /* Where it ended. A finish has a location - the range the finishing
     technique belongs to. A decision does not, so it borrows the range
     the fight spent its life in, which is the more honest claim anyway.
     A forfeit has no location at all. */
  let rangeKey = null;
  if (method === M.FF) rangeKey = null;
  else if (win && st.koRange && st.koRange !== "ANY") rangeKey = st.koRange;
  else rangeKey = dominantRange(st.ranges, turns).key;
  const labels = (typeof RANGE_LABEL !== "undefined" && RANGE_LABEL) ? RANGE_LABEL : null;
  const rangeLabel = rangeKey ? ((labels && labels[rangeKey]) || rangeKey) : "";

  const parts = [method];
  if (rangeLabel) parts.push(rangeLabel);
  if (turns > 0) parts.push("TURN " + turns);

  const voice = o.hotseat ? "flat" : (win ? "win" : "loss");
  const detailRow = RESULT_DETAIL[method] || RESULT_DETAIL[M.TKO];

  return {
    method,
    line: parts.join(" - "),
    detail: detailRow[voice] || detailRow.flat,
    /* the renderer needs to pick a colour and should not have to
       re-derive the outcome to do it */
    tone: forfeit ? "bad" : win ? "good" : "bad",
    win, forfeit, turns,
    range: rangeKey,
    rangeLabel,
    finish: method !== M.DEC && method !== M.TIME && method !== M.FF,
  };
}

/* ---------------------------------------------------------------------
   fightStatRows - the readout.

   `bar` is the row's share of something real or it is null. Nothing here
   invents a denominator: damage bars are each side's share of the total
   damage in the fight, offence bars are each category's share of what
   actually landed, and a fight with no damage and no landed work gets
   nulls rather than a wall of empty rails.

   There is no attempts counter in the battle model, so none of these is
   an accuracy figure and none of them claims to be.
   --------------------------------------------------------------------- */
function fightStatRows(stats, opts) {
  const st = stats || {};
  const o = opts || {};
  const C = RESULT_CONFIG.stats;

  const dealt = Math.round(resNum(st.dmgDealt));
  const taken = Math.round(resNum(st.dmgTaken));
  const dmgTotal = dealt + taken;

  const strikes = Math.round(resNum(st.strikes));
  const throws = Math.round(resNum(st.throws));
  const subs = Math.round(resNum(st.subs));
  const landed = strikes + throws + subs;

  const turns = Math.max(0, Math.round(resNum(st.turns)));
  const guards = Math.round(resNum(st.guards));
  const perfectGuards = Math.round(resNum(st.perfectGuards));
  const combo = Math.round(resNum(st.comboMax));
  const dom = dominantRange(st.ranges, turns);

  const rows = [
    { key: "dealt", label: "DAMAGE DEALT", n: dealt, value: String(dealt),
      bar: resShare(dealt, dmgTotal) },
    { key: "taken", label: "DAMAGE TAKEN", n: taken, value: String(taken),
      bar: resShare(taken, dmgTotal) },
    { key: "strikes", label: "SIGNIFICANT STRIKES", n: strikes, value: String(strikes),
      bar: resShare(strikes, landed) },
    { key: "throws", label: "TAKEDOWNS AND THROWS", n: throws, value: String(throws),
      bar: resShare(throws, landed) },
    { key: "subs", label: "SUBMISSIONS", n: subs, value: String(subs),
      bar: resShare(subs, landed) },
    { key: "combo", label: "BEST COMBO", n: combo,
      value: combo > 0 ? combo + (combo === 1 ? " HIT" : " HITS") : "NONE",
      bar: resShare(combo, C.comboFull) },
    /* guards are shown against the turn count because that is the real
       question - how much of the fight was spent behind the shell */
    { key: "guards", label: "GUARDS HELD", n: guards,
      value: perfectGuards > 0 ? guards + " (" + perfectGuards + " PERFECT)" : String(guards),
      bar: resShare(guards, turns) },
    { key: "turns", label: "TURNS", n: turns, value: String(turns),
      bar: resShare(turns, C.longFight) },
    { key: "range", label: "FOUGHT AT", n: dom.turns,
      value: dom.key ? dom.label + "  " + resPct(dom.share) + "%" : "-",
      bar: dom.key ? dom.share : null },
  ];

  /* a striker's fight has no submissions and a boxing match has no air
     combo - on a compact panel those rows are three lines of nothing */
  const out = o.compact
    ? rows.filter((r) => !(r.n === 0 && C.droppable.indexOf(r.key) >= 0))
    : rows;
  const max = Math.round(resNum(o.max));
  return max > 0 ? out.slice(0, max) : out;
}

/* ---------------------------------------------------------------------
   fightGrade - a letter you can argue with.

   Built so the ordering is a property of the scale rather than an
   accident of the weights:

     a win starts at winBase 50 and is only ever clamped by the 100 ceiling
     a loss starts at lossBase 16, earns at lossEarnMul 0.6, and is capped
       at lossCap 33
     a forfeit scores forfeitScore 0

   Those five names are the contract - read them off RESULT_CONFIG.grade
   rather than off this paragraph, because a comment that drifts from the
   table is how an ordering guarantee quietly stops being one.

   which means the WORST possible win outscores the BEST possible loss,
   every time, and a decision win taken while soaking damage lands
   around D while a first-turn untouched finish lands S. That is the
   test the design has to pass; the rest of the weights are just how
   fights get sorted inside their own outcome.
   --------------------------------------------------------------------- */
function fightGrade(stats) {
  const st = stats || {};
  const C = RESULT_CONFIG.grade;
  const win = !!st.win;
  const forfeit = !!st.forfeit;

  const dealt = resNum(st.dmgDealt), taken = resNum(st.dmgTaken);
  const total = dealt + taken;
  /* an even fight is 0.5 - so the credit is for the half you took OFF
     them, not for the damage you happened to do in a long fight */
  const share = total > 0 ? dealt / total : (win ? 1 : 0);
  const hpLeft = resClamp(typeof st.hpLeft === "number" ? st.hpLeft : (win ? 1 : 0));
  const turns = Math.max(0, Math.round(resNum(st.turns)));
  const lowest = typeof st.lowest === "number" ? resClamp(st.lowest) : hpLeft;

  let earned = 0;
  earned += resClamp((share - 0.5) * 2) * C.dmgShare;
  earned += hpLeft * C.health;
  earned += resClamp((C.slow - turns) / Math.max(1, C.slow - C.fast)) * C.speed;

  let flair = Math.min(C.sigCap, resNum(st.sigPerfect) * C.sigPerfect);
  if (resNum(st.comboMax) >= RESULT_CONFIG.stats.comboFull) flair += C.combo;
  flair += Math.min(C.guardCap, resNum(st.perfectGuards) * C.perfectGuard);
  earned += flair;

  const untouched = win && taken === 0 && turns > 0;
  if (untouched) earned += C.perfect;

  let score;
  if (forfeit) score = C.forfeitScore;
  else if (win) score = C.winBase + earned;
  else score = Math.min(C.lossCap, C.lossBase + earned * C.lossEarnMul);
  score = Math.max(0, Math.min(100, score));

  let grade = "F";
  for (let i = 0; i < C.table.length; i++) {
    if (score >= C.table[i][0]) { grade = C.table[i][1]; break; }
  }

  /* one clause, and it has to name the number that moved the grade */
  let note;
  if (forfeit) note = "NO GRADE FOR A FIGHT YOU DID NOT FINISH";
  else if (untouched) note = "NOT ONE POINT OF DAMAGE TAKEN";
  else if (win && lowest <= C.brink) note = "WON IT FROM " + resPct(lowest) + "% HEALTH";
  else if (win && turns > 0 && turns <= C.quick) note = "FINISHED IT INSIDE " + turns + " TURNS";
  else if (share >= C.oneSided) note = "DEALT " + resPct(share) + "% OF THE DAMAGE IN THE FIGHT";
  else if (share > 0 && share <= C.outworked) note = "OUT-DAMAGED " + resPct(1 - share) + "% TO " + resPct(share) + "%";
  else if (win && hpLeft <= C.thin) note = "CAME HOME ON " + resPct(hpLeft) + "% HEALTH";
  else if (win) note = "SCORED IT ON WORK RATE OVER " + turns + " TURNS";
  else note = "OUTWORKED OVER " + turns + " TURNS";

  return { grade, note, score: Math.round(score * 10) / 10, share: Math.round(share * 100) / 100 };
}

/* ---------------------------------------------------------------------
   ceremonyBeats - when each of the above lands.

   Frame counts, as literal data, the way the animation layer does it.
   Nothing here starts a timer, and nothing here knows what a second is:
   the caller advances it one step() at a time.

   THE LATCH IS THE POINT. mainLoop() runs up to EIGHT step() calls
   between two renders when the tab has been backgrounded or the machine
   stalls, so a cue written as `if (f === 40) sWin()` either fires never
   or fires on a frame nobody saw. Every cue here is stored in `fired`
   the first time the clock passes it and can never fire twice, whatever
   size the step is - catch up 90 frames in one call and the art, the
   method line and the stat wipe all announce themselves exactly once,
   in order, in that single call.
   --------------------------------------------------------------------- */
function ceremonyBeats(result, stats, opts) {
  const C = RESULT_CONFIG.ceremony;
  const o = opts || {};
  const kind = typeof result === "string" ? result : ((result && result.kind) || "");
  const st = stats || null;

  const fought = C.noFight.indexOf(kind) < 0;
  /* a stat line is worth showing only if a fight actually generated one -
     a zero-turn block is a synthetic result, not a quiet fight */
  const hasStats = fought && !!st && Math.round(resNum(st.turns)) > 0;

  const show = {
    art: fought && o.art !== false,
    method: true,
    grade: hasStats && o.grade !== false,
    stats: hasStats && o.stats !== false,
    payout: fought && o.payout !== false,
    prompt: true,
  };

  const reduced = o.motion === false;
  const list = [], at = {}, dur = {};
  let clock = 0, first = true;
  for (let i = 0; i < C.order.length; i++) {
    const id = C.order[i];
    if (!show[id]) continue;
    if (reduced) { at[id] = 0; dur[id] = 1; list.push({ id, at: 0, dur: 1, end: 1 }); continue; }
    /* the first beat shown always starts at zero, whichever one it is -
       otherwise dropping the art beat leaves twenty frames of black */
    clock += first ? 0 : C.lead[id];
    first = false;
    at[id] = clock; dur[id] = C.dur[id];
    list.push({ id, at: clock, dur: C.dur[id], end: clock + C.dur[id] });
  }

  let total = C.tail;
  for (let i = 0; i < list.length; i++) if (list[i].end + C.tail > total) total = list[i].end + C.tail;
  /* reduced motion is not a faster ceremony, it is no ceremony: every cue
     is already true on the first step and the screen is simply drawn */
  if (reduced) total = C.reduced;

  return {
    kind, total, list, at, dur,
    /* the daily and the ladder already own their screen - the renderer
       reads this to decide whether the panel goes inline or on a tab */
    dense: C.dense.indexOf(kind) >= 0,
    hasStats,
    f: 0, fired: {}, done: false,
  };
}

/* advance the ceremony. `dt` defaults to one frame; pass a bigger number
   and every cue it steps over still fires exactly once, in order.
   Returns the cue ids that fired on THIS call - an empty array on every
   other frame, which is what makes it safe to call from step(). */
function ceremonyStep(cer, dt) {
  if (!cer || !cer.list) return [];
  const n = dt === undefined ? 1 : resNum(dt);
  if (n > 0) cer.f += n;
  const out = [];
  for (let i = 0; i < cer.list.length; i++) {
    const b = cer.list[i];
    if (cer.f >= b.at && !cer.fired[b.id]) { cer.fired[b.id] = true; out.push(b.id); }
  }
  cer.done = cer.f >= cer.total;
  return out;
}

/* The same latch, driven by an ABSOLUTE frame count instead of a delta -
   the shape src/ui/entrance.js uses, for a caller that already owns a
   clock (G.t minus the frame the scene was entered on). Only ever moves
   forward: a clock that went backwards must not rewind into a cue and
   announce it a second time. Safe to mix with ceremonyStep - both write
   the one `fired` map. */
function ceremonyCues(cer, t) {
  if (!cer || !cer.list) return [];
  const n = resNum(t);
  return ceremonyStep(cer, n > cer.f ? n - cer.f : 0);
}

/* jump to the end - a player who pressed a button is not waiting for a
   wipe. Still returns the cues that had not fired yet, so a skipped
   ceremony makes its sounds once rather than swallowing them.

   The clamp is not decoration. The result screen keeps stepping for as
   long as the player leaves it up, so `f` is normally far PAST `total` by
   the time anyone presses anything - a bare `cer.f = cer.total` would
   drag the clock BACKWARDS by however long they sat there. ceremonyCues()
   is documented to only ever move forward and computes its delta as
   `t - cer.f`; hand it a rewound `f` and the next absolute-clock call
   replays hundreds of frames in one step. Nothing fires twice (the latch
   holds), but the invariant every other function here relies on would be
   false, and the next thing built on `f` would inherit the bug. */
function ceremonySkip(cer) {
  if (!cer || !cer.list) return [];
  if (cer.f < cer.total) cer.f = cer.total;
  return ceremonyStep(cer, 0);
}

/* has this beat been reached at all */
function ceremonyHas(cer, id) { return !!(cer && cer.at && cer.at[id] !== undefined); }

/* 0..1, eased, for the renderer to drive a rise, a wipe or a fade.
   A beat this ceremony does not include returns 0 forever, so a renderer
   that multiplies by it simply draws nothing. */
function ceremonyPhase(cer, id) {
  if (!ceremonyHas(cer, id)) return 0;
  return resEase((cer.f - cer.at[id]) / Math.max(1, cer.dur[id]));
}
