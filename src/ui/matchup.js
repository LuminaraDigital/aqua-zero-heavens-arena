/* =====================================================================
   Aqua Zero Heavens Arena - the tale of the tape
   Luminara Digital

   There has been a pre-fight brief in this game since the adventure mode
   shipped, and exactly one mode could reach it. Exhibition, ranked,
   survival, daily and two-player all cut straight from a menu to the
   bell, so five of the six ways to start a fight told the player nothing
   about who they were about to fight. The information was not missing -
   BIOS, disciplinesOf, homeRanges, masteryLevel, SAVE.fr, rivalOf and
   archetypeFor all knew the answer. It was welded into rBrief's drawing
   calls, and drawing calls cannot be reused by a mode that draws
   somewhere else.

   So this file is the DATA half of that screen, prised out and made
   mode-agnostic. It answers "what is worth saying about these two, in
   what order" and answers it with strings and numbers. There is
   deliberately no canvas, no cx, no DOM, no colour and no layout
   anywhere below - the renderer owns pixels, this owns the argument.
   That split is what lets the same four calls feed the adventure brief,
   a ranked matchup card, the daily gauntlet header and a test.

   THE ROW RULE: every row has to be a comparison a fighter would
   actually make. "Power 88 vs 79" is a row. "Nickname" is not, because
   there is no edge in it. Nine rows, because eight leaves the record off
   and eleven does not fit above the portraits at 540 high.

   THE ORDER IS THE DESIGN: rows are sorted by how much they predict this
   game's fights, not by how they read. This resolver spends HP and
   damage, so power, chin and conditioning come first; initiative decides
   who lands, so speed is fourth; range control and the mat follow; the
   soft rows (arts, mastery, history) sit at the bottom where a tie costs
   nothing. Shuffle them and the screen still draws, but the top of the
   card stops being the part worth reading.

   DEGRADING: a fighter with no dossier, a fresh save with no records, an
   unranked player and the AZX FORCE / boss stand-ins (which arrive as
   {tf:true} or {boss:true} and have no ordinary id - see how rBrief
   handles f.tf and f.boss) all have to produce a sane card. Every one of
   those paths returns "-" and edge null rather than "undefined" or a
   throw. A screen that crashes on a fresh save is worse than no screen.

   And it degrades to "-" rather than to a plausible number, which is the
   harder half. Three globals answer confidently for a fighter who does
   not exist: disciplinesOf returns ["mma"], archetypeFor coin-flips off
   the index, traitsOf returns BALANCED at 100 hp. Each is right where it
   lives and wrong here, so each is gated on there being a dossier. A save
   migrated across the roster cut can still name an index nobody wrote, and
   a card that invents an art for him is the same sin as reading the AZX
   FORCE stand-in's stats off the artwork it borrowed.

   GLOBALS: every read of FIGHTERS, BIOS/bioOf, ATTR_KEYS, DISCIPLINES,
   RANGE_LABEL, disciplinesOf, homeRanges, hpOf, traitsOf, masteryLevel,
   MASTERY_RANKS, rivalOf, rivalryReason, calloutFor, storyOf,
   archetypeFor, ARCHETYPES, rankByIndex, rankTitle, BOSS_ID, SAVE and G
   is guarded with typeof and happens INSIDE a function body. Nothing at
   the top level of this file touches anything but literals: the module
   text lands above half of those declarations, and a single top-level
   reference to one of them bricks the whole page at load.

   DETERMINISM: no Math.random, no Date. The same two fighters and the
   same save always produce the same card, which is what makes the tests
   below worth anything.
   ===================================================================== */

const TAPE_CONFIG = {
  /* How far apart two numbers must be before the line is worth calling.
     The dossiers are on a 70-97 scale and the roster audit moves people
     by a point or two, so a one-point "edge" is noise wearing a colour.
     Reach is in whole inches and every inch of it is real, so it gets no
     deadband at all. */
  tolAttr: 2,
  tolReach: 0,
  tolHp: 3,
  tolCount: 0,

  /* The gap that counts as a full swing on that row, used only by the
     advantage bar. 20 attribute points is the distance from the worst
     striker on the card to the best - anything wider is not a fight. */
  spanAttr: 20,
  spanReach: 8,
  spanHp: 30,
  spanDisc: 2,
  spanMastery: 3,
  spanH2h: 3,

  /* The bar never reaches 0 or 1. A paper edge is not a result, and a
     bar pinned to the end of its track tells a player the fight is
     already over - which is exactly the fight they are about to lose
     because they stopped reading. tanh keeps a huge gap expressive
     without ever promising certainty. */
  leanGain: 1.8,
  leanSwing: 0.46,
  /* inside this band of the centre the card says "even" rather than
     picking a winner off a rounding error */
  evenBand: 0.04,
};

/* ---------------------------------------------------------------------
   THE ROWS.

   `attrs` are ATTR_KEYS names rather than indices on purpose: the index
   list has been reordered before and a silently wrong index produces a
   plausible number, which is the worst kind of bug on a screen nobody
   cross-checks. Resolved by name at call time; an unknown name simply
   drops out of the average.
   --------------------------------------------------------------------- */
const TAPE_METRICS = [
  /* what ends fights */
  { key: "power", label: "POWER", weight: 1.00, tol: TAPE_CONFIG.tolAttr, span: TAPE_CONFIG.spanAttr,
    attrs: ["strength", "stand_off"] },
  /* what survives them - defensive striking across all three standing ranges */
  { key: "chin", label: "CHIN", weight: 0.90, tol: TAPE_CONFIG.tolAttr, span: TAPE_CONFIG.spanAttr,
    attrs: ["stand_def", "clinch_str_def", "ground_str_def"] },
  /* the HP pool itself, which is the only number the resolver spends.
     Takes the current-HP override, so an adventure hero walking in at
     half is honestly shown as walking in at half. */
  { key: "cond", label: "CONDITIONING", weight: 0.85, tol: TAPE_CONFIG.tolHp, span: TAPE_CONFIG.spanHp },
  /* initiative decides who lands first, and landing first is most of it */
  { key: "speed", label: "SPEED", weight: 0.80, tol: TAPE_CONFIG.tolAttr, span: TAPE_CONFIG.spanAttr,
    attrs: ["speed", "footwork"] },
  /* range control - the one row that comes straight off the dossier
     without arithmetic, and the one every real tale of the tape has */
  { key: "reach", label: "REACH", weight: 0.55, tol: TAPE_CONFIG.tolReach, span: TAPE_CONFIG.spanReach },
  /* a full quarter of the range line lives down here */
  { key: "ground", label: "GROUND GAME", weight: 0.55, tol: TAPE_CONFIG.tolAttr, span: TAPE_CONFIG.spanAttr,
    attrs: ["ground_str_off", "td_off", "ground_grp_off", "sub_off"] },
  /* how many ranges they are at home in - versatility, not quality */
  { key: "discs", label: "DISCIPLINES", weight: 0.30, tol: TAPE_CONFIG.tolCount, span: TAPE_CONFIG.spanDisc },
  /* permanent, earned, and it really does apply at the bell */
  { key: "mastery", label: "MASTERY", weight: 0.35, tol: TAPE_CONFIG.tolCount, span: TAPE_CONFIG.spanMastery },
  /* least predictive, most interesting. Last on purpose. */
  { key: "h2h", label: "HEAD TO HEAD", weight: 0.25, tol: TAPE_CONFIG.tolCount, span: TAPE_CONFIG.spanH2h },
];
const TAPE_METRIC_BY_KEY = {};
let TAPE_TOTAL_WEIGHT = 0;
TAPE_METRICS.forEach(function (m) { TAPE_METRIC_BY_KEY[m.key] = m; TAPE_TOTAL_WEIGHT += m.weight; });

/* the string a row prints when there is genuinely nothing to compare */
const TAPE_BLANK = "-";

/* ---------------------------------------------------------------------
   Small guarded readers. Every one of these can be called on a fresh
   save, a missing dossier or a pseudo-opponent and returns null rather
   than throwing.
   --------------------------------------------------------------------- */

/* Written out longhand rather than via isFinite(), and NOT because the
   test sandbox lacks it - vm.createContext gives the context every
   intrinsic, so isFinite and Number.isFinite are both there and
   src/ui/results.js uses the former. The difference is the coercion:
   isFinite("") is true and isFinite(null) is true, so a dossier field
   that came back as a string or a null would pass and then be averaged
   in as a number. This one answers null unless it was already a real
   finite number, which is the only answer a "-" cell can be built on.

   Note the return convention differs from resNum/entNum on purpose:
   they answer 0 for unusable input because a frame count of zero is
   meaningful, this answers null because a REACH of zero is a lie. */
function tapeNum(v) {
  if (typeof v !== "number") return null;
  if (v !== v) return null;                       /* NaN */
  if (v === Infinity || v === -Infinity) return null;
  return v;
}
function tapeClamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

/* A caller may hand us a save explicitly (tests, replays, a future
   profile screen). Only fall back to the global one, and only if it is
   actually there - the module must not assume it is running inside a
   booted game. */
function tapeSaveOf(opts) {
  if (opts && opts.save) return opts.save;
  try { return (typeof SAVE !== "undefined" && SAVE) ? SAVE : null; }
  catch (e) { return null; }
}
function tapeBioOf(fid) {
  if (fid === null) return null;
  try { return (typeof bioOf === "function" ? bioOf(fid) : null) || null; }
  catch (e) { return null; }
}
function tapeFighterName(fid) {
  if (fid === null) return null;
  try {
    if (typeof FIGHTERS !== "undefined" && FIGHTERS && FIGHTERS[fid] && FIGHTERS[fid].name) return FIGHTERS[fid].name;
  } catch (e) {}
  return null;
}
function tapeAttrIndex(name) {
  try {
    if (typeof ATTR_KEYS !== "undefined" && ATTR_KEYS) return ATTR_KEYS.indexOf(name);
  } catch (e) {}
  return -1;
}
/* the mean of a named set of dossier attributes, rounded - null unless
   at least one of them resolved, so a renamed key degrades to "-"
   instead of quietly averaging in a zero */
function tapeAttrAvg(bio, names) {
  if (!bio || !bio.a || !names) return null;
  let sum = 0, n = 0;
  for (let i = 0; i < names.length; i++) {
    const idx = tapeAttrIndex(names[i]);
    if (idx < 0) continue;
    const v = tapeNum(bio.a[idx]);
    if (v === null) continue;
    sum += v; n++;
  }
  return n ? Math.round(sum / n) : null;
}

/* ---------------------------------------------------------------------
   tapeSideOf - one corner of the card, normalised.

   Accepts a plain fighter index, or a descriptor. The descriptor shape
   is deliberately the one the adventure field already produces, so
   rBrief can pass G.brief.f straight through:

     { id | fid, tf, boss, art, lv, name, hp, maxhp, rankIndex }

   tf (the AZX FORCE stand-in) borrows another fighter's ARTWORK and has
   no dossier of its own. Reading its stats off the borrowed art would
   print somebody else's reach under a name that is not theirs, which is
   worse than printing nothing, so tf always resolves to fid null.
   --------------------------------------------------------------------- */
function tapeSideOf(spec, opts, which) {
  const o = opts || {};
  const s = (spec !== null && spec !== undefined && typeof spec === "object") ? spec : { fid: spec };
  const raw = (s.fid !== undefined && s.fid !== null) ? s.fid : s.id;
  let fid = (typeof raw === "number" && raw === (raw | 0) && raw >= 0) ? raw : null;
  const tf = !!s.tf;
  const boss = !!s.boss;

  /* the tower's champion is a real roster entry that simply arrives
     without an id attached - rBrief resolves it the same way */
  if (fid === null && boss) {
    try { if (typeof BOSS_ID !== "undefined") fid = BOSS_ID; } catch (e) {}
  }
  if (tf) fid = null;

  const bio = tapeBioOf(fid);
  const left = which !== "r";

  let hp = tapeNum(s.hp);
  if (hp === null) hp = tapeNum(left ? o.leftHp : o.rightHp);
  let maxhp = tapeNum(s.maxhp !== undefined ? s.maxhp : s.maxHp);
  if (maxhp === null) maxhp = tapeNum(left ? o.leftMaxHp : o.rightMaxHp);
  /* hpOf falls back to a flat 100 for an index with no dossier, so without
     the bio check a cut roster entry would show a confident "100 HP" that
     no fighter ever had. An hp the CALLER supplied is real whatever the
     index is, which is why only this derived fallback is gated. */
  if (maxhp === null && fid !== null && bio) {
    try { if (typeof hpOf === "function") maxhp = tapeNum(hpOf(fid)); } catch (e) {}
  }
  if (maxhp === null) maxhp = hp;
  if (hp === null) hp = maxhp;

  let rankIndex = tapeNum(s.rankIndex);
  if (rankIndex === null) rankIndex = tapeNum(left ? o.leftRankIndex : o.rightRankIndex);
  /* the ranked ladder only ever grades the opponent explicitly */
  if (rankIndex === null && !left) rankIndex = tapeNum(o.oppRankIndex);

  const name = s.name || (tf ? "AZX FORCE" : tapeFighterName(fid)) || "UNKNOWN";

  return { fid: fid, bio: bio, tf: tf, boss: boss, known: !!bio,
           name: name, hp: hp, maxhp: maxhp, lv: tapeNum(s.lv),
           rankIndex: rankIndex, side: left ? "l" : "r" };
}

/* ---------------------------------------------------------------------
   The head-to-head record.

   SAVE.fr is keyed by the OPPONENT's fighter index and written from the
   player's point of view: fr[id].w is how many times YOU beat them,
   fr[id].l is how many times they beat YOU. There is no fighter-versus-
   fighter table and inventing one would be a lie, so the convention is:
   put the player's own fighter on the LEFT and the record reads
   correctly. If the right corner has no id (AZX FORCE, or a card drawn
   the other way round) we fall back to the left id and swap, so a
   two-player or boss card still says something true.
   --------------------------------------------------------------------- */
function tapeRecord(L, R, opts) {
  const o = opts || {};
  if (o.record && (tapeNum(o.record.w) !== null || tapeNum(o.record.l) !== null)) {
    return { w: tapeNum(o.record.w) || 0, l: tapeNum(o.record.l) || 0 };
  }
  const save = tapeSaveOf(o);
  const fr = (save && save.fr) || null;
  if (!fr) return null;
  if (R && R.fid !== null && fr[R.fid]) return { w: tapeNum(fr[R.fid].w) || 0, l: tapeNum(fr[R.fid].l) || 0 };
  if (R && R.fid === null && L && L.fid !== null && fr[L.fid]) {
    const rec = fr[L.fid];
    return { w: tapeNum(rec.l) || 0, l: tapeNum(rec.w) || 0 };
  }
  /* a save exists and simply has no history with this fighter - that is
     a real 0-0, not an unknown, and the card should say so */
  if (R && R.fid !== null) return { w: 0, l: 0 };
  return null;
}

function tapeMasteryLevel(fid, opts) {
  if (fid === null) return null;
  const save = tapeSaveOf(opts);
  if (!save) return null;
  try {
    if (typeof masteryLevel === "function") return tapeNum(masteryLevel(save, fid));
  } catch (e) {}
  return null;
}
function tapeMasteryName(level) {
  if (level === null) return TAPE_BLANK;
  try {
    if (typeof MASTERY_RANKS !== "undefined" && MASTERY_RANKS && MASTERY_RANKS[level] && MASTERY_RANKS[level].name) {
      return MASTERY_RANKS[level].name;
    }
  } catch (e) {}
  return String(level);
}
/* disciplinesOf answers ["mma"] for ANY index, dossier or not - that is
   correct where it lives (a fighter with an empty movelist is unplayable)
   and a lie here. A save migrated across the roster cut can still carry an
   index nobody has a dossier for, and printing MMA under it puts an art on
   a card that no fighter on the roster claims. No dossier, no arts. */
function tapeDisciplineIds(fid) {
  if (fid === null) return null;
  if (!tapeBioOf(fid)) return null;
  try {
    if (typeof disciplinesOf === "function") {
      const d = disciplinesOf(fid);
      return (d && d.length) ? d : null;
    }
  } catch (e) {}
  return null;
}

/* ---------------------------------------------------------------------
   The value pair for one row. Computed for BOTH corners at once because
   the head-to-head row is a single record read from one side - asking
   each corner for its own number would read two different save entries
   and print a record that never happened.
   --------------------------------------------------------------------- */
function tapePairFor(m, L, R, opts) {
  if (m.attrs) return { lv: tapeAttrAvg(L.bio, m.attrs), rv: tapeAttrAvg(R.bio, m.attrs) };
  if (m.key === "cond") return { lv: L.hp, rv: R.hp };
  if (m.key === "reach") {
    return { lv: L.bio ? tapeNum(L.bio.rch) : null, rv: R.bio ? tapeNum(R.bio.rch) : null };
  }
  if (m.key === "discs") {
    const a = tapeDisciplineIds(L.fid), b = tapeDisciplineIds(R.fid);
    return { lv: a ? a.length : null, rv: b ? b.length : null };
  }
  if (m.key === "mastery") return { lv: tapeMasteryLevel(L.fid, opts), rv: tapeMasteryLevel(R.fid, opts) };
  if (m.key === "h2h") {
    const rec = tapeRecord(L, R, opts);
    return rec ? { lv: rec.w, rv: rec.l } : { lv: null, rv: null };
  }
  return { lv: null, rv: null };
}

/* Higher is better on every row in the table, which is what lets one
   comparison serve all nine. Add a row where lower wins and this is the
   function that has to learn about it. */
function tapeEdgeOf(m, lv, rv) {
  if (lv === null || rv === null) return null;
  if (Math.abs(lv - rv) <= (m.tol || 0)) return null;
  return lv > rv ? "l" : "r";
}

function tapeCellText(m, v, side) {
  if (v === null) return TAPE_BLANK;
  if (m.key === "reach") return v + '"';
  if (m.key === "cond") {
    const max = side.maxhp;
    return (max !== null && max !== v) ? (v + " / " + max + " HP") : (v + " HP");
  }
  if (m.key === "mastery") return tapeMasteryName(v);
  return String(v);
}

/* =====================================================================
   tapeRows - the heart of the card.

   Returns an ordered array of
     { key, label, left, right, edge, lv, rv }
   where `edge` is "l", "r" or null for a tie or an unknown.

   `lv`/`rv` ride along as raw numbers so the renderer can draw a bar
   without re-deriving them and without parsing the strings back. They
   are null exactly when the cell prints "-".
   ===================================================================== */
function tapeRows(leftSpec, rightSpec, opts) {
  const o = opts || {};
  const L = tapeSideOf(leftSpec, o, "l");
  const R = tapeSideOf(rightSpec, o, "r");
  const out = [];
  for (let i = 0; i < TAPE_METRICS.length; i++) {
    const m = TAPE_METRICS[i];
    const pair = tapePairFor(m, L, R, o);
    out.push({
      key: m.key,
      label: m.label,
      left: tapeCellText(m, pair.lv, L),
      right: tapeCellText(m, pair.rv, R),
      lv: pair.lv, rv: pair.rv,
      edge: tapeEdgeOf(m, pair.lv, pair.rv),
    });
  }
  return out;
}

/* =====================================================================
   tapeHeader - the identity block for ONE corner.

   Everything here is a finished string. txt() uppercases whatever it is
   given, so nothing below re-cases a string that came from the dossier or
   the rank table: fighting that would only produce a second, inconsistent
   style of capitalisation on a screen that already has one. The words this
   file invents rather than quotes ("VS YOU", "UNRANKED", "NO DOSSIER ON
   FILE") are written in caps because they are read here, in the tests,
   with no txt() anywhere near them.

   opts for this call:
     side       "l" or "r" - which hp/rank override applies (default "l")
     self       true when this corner is the fighter the player is using;
                changes what "record" means (see below)
     stage      passed to archetypeFor as its seed
     rankIndex  a ladder grade for this corner; when present the badge is
                the rank, otherwise it is the mastery belt
   ===================================================================== */
function tapeHeader(spec, opts) {
  const o = opts || {};
  const side = tapeSideOf(spec, o, o.side === "r" ? "r" : "l");
  /* a single-corner call is allowed to name its grade plainly rather
     than through the left/right opts the two-corner calls use */
  if (tapeNum(o.rankIndex) !== null) side.rankIndex = o.rankIndex;
  const bio = side.bio;
  const fid = side.fid;

  const out = {
    fid: fid, name: side.name, known: !!bio, tf: side.tf, boss: side.boss,
    nick: (bio && bio.nick) ? '"' + bio.nick + '"' : "",
    division: (bio && bio.div) ? bio.div : "",
    ovr: bio ? tapeNum(bio.ovr) : null,
    disciplines: "", ranges: "", archetype: "", tell: "", tag: "",
    record: "", recordLabel: "", rank: "", mastery: "",
    badge: "", badgeKind: "none",
    hp: "", level: side.lv === null ? "" : ("LV " + side.lv),
  };

  /* the discipline line, named the way the dossier names them */
  const discs = tapeDisciplineIds(fid);
  if (discs) {
    const names = [];
    for (let i = 0; i < discs.length; i++) {
      let n = discs[i];
      try { if (typeof DISCIPLINES !== "undefined" && DISCIPLINES && DISCIPLINES[n] && DISCIPLINES[n].name) n = DISCIPLINES[n].name; }
      catch (e) {}
      names.push(n);
    }
    out.disciplines = names.join(" / ");
    /* where those arts want the fight to be. RANGE_LABEL is the
       player-facing wording the range strip already uses - two names for
       the same four ranges on one screen would be a bug the player
       cannot report. */
    try {
      if (typeof homeRanges === "function") {
        const hr = homeRanges(discs) || [];
        const labels = [];
        for (let j = 0; j < hr.length; j++) {
          let lab = hr[j];
          try { if (typeof RANGE_LABEL !== "undefined" && RANGE_LABEL && RANGE_LABEL[lab]) lab = RANGE_LABEL[lab]; }
          catch (e) {}
          labels.push(lab);
        }
        out.ranges = labels.join(" / ");
      }
    } catch (e) {}
  } else if (!bio) {
    out.disciplines = "NO DOSSIER ON FILE";
  }

  /* the gameplan, named before the bell so losing to one is information.
     archetypeFor falls back to a coin flip on the index and traitsOf to
     BALANCED, so both answer for a fighter who does not exist - which is
     the same mistake as reading the AZX FORCE stand-in's borrowed art. */
  if (fid !== null && bio) {
    try {
      if (typeof archetypeFor === "function") {
        const aid = archetypeFor(fid, o.stage || 0);
        let a = null;
        try { if (typeof ARCHETYPES !== "undefined" && ARCHETYPES) a = ARCHETYPES[aid] || null; } catch (e) {}
        out.archetype = (a && a.name) ? a.name : String(aid || "");
        out.tell = (a && a.tell) ? a.tell : "";
      }
    } catch (e) {}
    try { if (typeof traitsOf === "function") out.tag = traitsOf(fid).tag || ""; } catch (e) {}
  }

  if (side.hp !== null) {
    out.hp = (side.maxhp !== null && side.maxhp !== side.hp)
      ? (side.hp + " / " + side.maxhp + " HP") : (side.hp + " HP");
  }

  /* RECORD. The save has no career records - only the player's own
     history. So this corner's record means one of two things and the
     label says which, rather than printing a number that looks like a
     career and is not. */
  const save = tapeSaveOf(o);
  if (save) {
    if (o.self) {
      const rec = save.rec || null;
      if (rec) { out.record = (tapeNum(rec.wins) || 0) + "-" + (tapeNum(rec.losses) || 0); out.recordLabel = "YOUR RECORD"; }
    } else if (fid !== null) {
      const fr = (save.fr && save.fr[fid]) || null;
      out.record = (fr ? ((tapeNum(fr.w) || 0) + "-" + (tapeNum(fr.l) || 0)) : "0-0");
      out.recordLabel = "VS YOU";
    }
  }

  /* BADGE. A ladder grade outranks a belt when there is one, because in
     a ranked match the grade is the thing being played for. */
  const lvl = tapeMasteryLevel(fid, o);
  if (lvl !== null) out.mastery = tapeMasteryName(lvl);
  if (side.rankIndex !== null) {
    try {
      if (typeof rankByIndex === "function") {
        const r = rankByIndex(side.rankIndex);
        out.rank = (typeof rankTitle === "function") ? rankTitle(r) : ((r && r.title) || "");
      }
    } catch (e) {}
  }
  if (out.rank) { out.badge = out.rank; out.badgeKind = "rank"; }
  else if (out.mastery && lvl > 0) { out.badge = out.mastery; out.badgeKind = "mastery"; }
  else if (lvl === 0) { out.badge = "UNRANKED"; out.badgeKind = "mastery"; }

  /* a ready-to-draw list, so the renderer is a loop rather than nine
     hand-placed calls that drift apart the first time a row is added */
  out.lines = [];
  const push = (label, value) => { if (value) out.lines.push({ label: label, value: value }); };
  push("", out.disciplines);
  push("HOME", out.ranges);
  push("STYLE", out.archetype);
  push(out.recordLabel, out.record);
  push(out.badgeKind === "rank" ? "GRADE" : "MASTERY", out.badge);
  return out;
}

/* =====================================================================
   tapeStoryline - the single most interesting sentence about THIS pair.

   Priority, and why it is this way round:
     nemesis  - a man who beat you inside the run you are playing now is
                more present than any amount of written history
     rival    - a declared rivalry you could have worked out yourself
     grudge   - they have beaten you before (their words, not ours)
     rematch  - you have beaten them before
     title    - something is on the line tonight
     first    - you have never met
   Everything below reuses prose that already exists: rivalryReason,
   storyOf().grudge and calloutFor(). Writing a tenth variant here would
   put two voices for the same fighter in the same game.

   opts:
     nemesis / nemesisFid   this run's nemesis, as either the duel's
                            boolean or the adventure field's fighter index
     title / titleOnTheLine something is on the line
     titleRankIndex         which grade, if it is not the right corner's
     record                 override for the head-to-head
   Always returns { key, tag, line } with `line` a non-empty string.
   ===================================================================== */
function tapeStoryline(leftSpec, rightSpec, opts) {
  const o = opts || {};
  const L = tapeSideOf(leftSpec, o, "l");
  const R = tapeSideOf(rightSpec, o, "r");
  const rec = tapeRecord(L, R, o) || { w: 0, l: 0 };

  /* The game carries the nemesis in two shapes: the duel has a boolean
     `d.nemesis`, the adventure field has `G.adv.nemesis` which is a fighter
     INDEX. Accepting only the boolean meant a caller who passed the field's
     own value got a silent false - and index 0 is a real fighter, so the
     bug would have been invisible for most of the roster. Both shapes now
     answer, under either opt name. */
  const nemNum = tapeNum(o.nemesis) !== null ? o.nemesis : tapeNum(o.nemesisFid);
  const isNemesis = o.nemesis === true ||
    (nemNum !== null && R.fid !== null && nemNum === R.fid);

  const story = (fid) => {
    if (fid === null) return null;
    try { return (typeof storyOf === "function") ? storyOf(fid) : null; } catch (e) { return null; }
  };
  const callout = (fid, ctx) => {
    if (fid === null) return null;
    try { return (typeof calloutFor === "function") ? calloutFor(fid, ctx) : null; } catch (e) { return null; }
  };

  if (isNemesis) {
    const s = story(R.fid);
    return { key: "nemesis", tag: "NEMESIS",
             line: (s && s.grudge) || "They beat you this run. Revenge pays." };
  }

  if (L.fid !== null && R.fid !== null) {
    let why = null;
    try { if (typeof rivalryReason === "function") why = rivalryReason(L.fid, R.fid); } catch (e) {}
    if (why) return { key: "rival", tag: "RIVAL", line: why };
  }

  /* a loss is more personal than a win, so their grudge line wins the
     tie when the record runs both ways */
  if (rec.l > 0) {
    const s = story(R.fid);
    if (s && s.grudge) return { key: "grudge", tag: "THEY HAVE BEATEN YOU", line: s.grudge };
  }
  if (rec.w > 0) {
    const line = callout(R.fid, { beatenBefore: true });
    if (line) return { key: "rematch", tag: "REMATCH", line: line };
  }

  if (o.title === true || o.titleOnTheLine === true) {
    const ri = tapeNum(o.titleRankIndex) !== null ? o.titleRankIndex : R.rankIndex;
    let grade = "";
    if (ri !== null) {
      try {
        if (typeof rankByIndex === "function") {
          const r = rankByIndex(ri);
          grade = (typeof rankTitle === "function") ? rankTitle(r) : ((r && r.title) || "");
        }
      } catch (e) {}
    }
    return { key: "title", tag: "ON THE LINE",
             line: grade ? ("The " + grade + " grade is on the line tonight.")
                         : "There is something on the line tonight." };
  }

  if (R.fid === null) {
    return { key: "azx", tag: "AZX FORCE",
             line: "No dossier, no record, no name. The league sends these when it wants something tested." };
  }

  if (!rec.w && !rec.l) {
    const line = callout(R.fid, { first: true });
    if (line) return { key: "first", tag: "FIRST MEETING", line: line };
  }
  const line = callout(R.fid, {});
  if (line) return { key: "creed", tag: "", line: line };
  return { key: "none", tag: "", line: "Two fighters, one ring. Nothing else has been decided." };
}

/* =====================================================================
   tapeAdvantage - the bar under the two portraits.

   Returns { lean, favours, reason, margin, rows }.

   `lean` is the LEFT corner's share, 0..1, with 0.5 dead even. It is a
   weighted mean of the same rows the card already shows, squashed
   through tanh so it can never claim certainty. Rows that could not be
   compared (no dossier, no record) drop out entirely rather than
   counting as a tie - a missing number is not evidence of parity.

   `reason` names the two rows that did most of the work, because a bar
   with no reason is a horoscope. It never names a fighter: the renderer
   already has both names on screen and this way one string serves both
   corners and every mode.
   ===================================================================== */
function tapeAdvantage(leftSpec, rightSpec, opts) {
  const rows = tapeRows(leftSpec, rightSpec, opts);
  let score = 0, total = 0;
  const parts = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const m = TAPE_METRIC_BY_KEY[r.key];
    if (!m || r.lv === null || r.rv === null) continue;
    const span = m.span || 1;
    const n = tapeClamp((r.lv - r.rv) / span, -1, 1);
    score += m.weight * n;
    total += m.weight;
    if (n !== 0) parts.push({ label: m.label, c: m.weight * n });
  }
  if (!total) {
    return { lean: 0.5, favours: null, reason: "NOTHING ON FILE TO COMPARE",
             margin: 0, confidence: 0, rows: rows };
  }
  /* CONFIDENCE. Against the AZX FORCE stand-in exactly one row (the HP
     pool) can be compared, and without this the bar read 0.94 off that
     single number - a screen shouting "you win" about a fighter it knows
     nothing about. Scaling the lean by how much of the card actually
     resolved pulls an unknown opponent back toward even, which is the
     honest answer: you have one edge and no information. A full dossier
     scores coverage 1 and is unaffected. */
  const confidence = tapeClamp(total / (TAPE_TOTAL_WEIGHT || 1), 0, 1);
  const raw = (score / total) * confidence;
  const lean = +(0.5 + TAPE_CONFIG.leanSwing * Math.tanh(raw * TAPE_CONFIG.leanGain)).toFixed(3);
  const off = lean - 0.5;
  const favours = Math.abs(off) < TAPE_CONFIG.evenBand ? null : (off > 0 ? "l" : "r");

  let reason = "EVEN ON PAPER";
  if (favours) {
    const sign = favours === "l" ? 1 : -1;
    const mine = parts.filter((p) => p.c * sign > 0)
                      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
                      .slice(0, 2)
                      .map((p) => p.label);
    if (mine.length) reason = mine.join(" AND ");
  }
  return { lean: lean, favours: favours, reason: reason,
           margin: +Math.abs(off * 2).toFixed(3),
           confidence: +confidence.toFixed(3), rows: rows };
}
