/* =====================================================================
   Aqua Zero Heavens Arena - learnsets
   Luminara Digital

   A fighter's movelist is not authored - it is derived from the two or
   three disciplines named in their own dossier, gated by their level.
   Level 1 opens the fundamentals of their arts; level 9 opens everything,
   including the techniques that take years to earn.

   Signatures come from the dossier's own finisher line, so every fighter
   has a named ultimate without a separate content pass.
   ===================================================================== */
function disciplinesOf(fid) {
  const b = bioOf(fid);
  const out = [];
  ((b && b.sty) || []).forEach((s) => { const id = disciplineId(s); if (id && out.indexOf(id) < 0) out.push(id); });
  return out.length ? out : ["mma"];
}

/* every technique this fighter could ever learn, in the order they learn it.
   AZX is an MMA league: a specialist whose own art runs thin cross-trains the
   league fundamentals, so nobody walks in with a half-empty movelist. */
const CROSS_TRAIN_FLOOR = 26;
function learnsetOf(fid) {
  const discs = disciplinesOf(fid);
  const list = TECH_IDS.filter((id) => {
    const t = TECH[id];
    return t.disc === null ? BASIC_TECHS.indexOf(id) >= 0 : discs.indexOf(t.disc) >= 0;
  });
  if (list.length < CROSS_TRAIN_FLOOR && discs.indexOf("mma") < 0) {
    const supplement = TECH_IDS.filter((id) => TECH[id].disc === "mma" && list.indexOf(id) < 0)
      .sort((a, b) => TECH[a].learn - TECH[b].learn);
    while (list.length < CROSS_TRAIN_FLOOR && supplement.length) list.push(supplement.shift());
  }
  return list.sort((a, b) => TECH[a].learn - TECH[b].learn || TECH[a].name.localeCompare(TECH[b].name));
}

/* ---------------- unique kits ----------------
   Elite techniques (the fight-enders, learn 7+) are not shared knowledge.
   Each fighter deterministically owns a personal handful from their own
   arts, so two fighters of the same discipline share the fundamentals but
   finish fights in completely different ways. */
const ELITE_LEARN = 7;
const KIT_SIZE = 4;
const isElite = (id) => TECH[id].learn >= ELITE_LEARN;
function exclusiveOf(fid, bonus) {
  const elite = learnsetOf(fid).filter(isElite);
  // never hand one fighter the whole elite pool - a rival of the same style
  // must always finish differently
  const size = Math.min(KIT_SIZE + (bonus || 0), Math.max(1, elite.length - 1));
  if (elite.length <= 1) return elite.slice();
  const out = [], n = elite.length;
  let h = (fid * 2654435761) >>> 0;                      // Knuth hash, stable per fighter
  for (let i = 0; i < size; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    let ix = h % n, guard = 0;
    while (out.indexOf(elite[ix]) >= 0 && guard++ < n) ix = (ix + 1) % n;
    out.push(elite[ix]);
  }
  return out.sort((a, b) => TECH[a].learn - TECH[b].learn);
}
/* what they actually walk into the arena with at this level */
function knownTechs(fid, level, kitBonus) {
  const lv = Math.max(1, Math.min(9, level || 1));
  const kit = exclusiveOf(fid, kitBonus || 0);
  return learnsetOf(fid).filter((id) =>
    TECH[id].learn <= lv && (!isElite(id) || kit.indexOf(id) >= 0));
}
/* what the next level would add - drives the level-up readout */
function techsGainedAt(fid, level) {
  return learnsetOf(fid).filter((id) => TECH[id].learn === level);
}

/* ---------------- the signature ---------------- */
/* "Daemon's Verdict - spinning back kick to the liver" -> name + description */
function signatureOf(fid) {
  const b = bioOf(fid);
  if (!b || !b.sig) return null;
  const split = b.sig.split(/\s+[-–]\s+/);
  const name = (split[0] || b.sig).trim();
  const desc = (split[1] || "").trim();
  const discs = disciplinesOf(fid);
  const primary = discs[0] || "mma";
  const home = homeRanges(discs);
  // the finisher lands where the fighter is strongest, and hits like it
  const ovr = b.ovr || 85;
  const power = Math.round(58 + (ovr - 83) * 2.4);
  const grapple = ["judo", "bjj", "wrestling", "sambo", "subgrap", "grappling", "jiujitsu", "sumo"].indexOf(primary) >= 0;
  return {
    id: "sig_" + fid, name, disc: primary, cls: grapple ? "SUB" : "STRIKE",
    range: home[home.length - 1], power, acc: 84, speed: 70, stam: 0, learn: 1,
    prio: 0, moves: null, eff: { st: grapple ? "HELD" : "STUNNED", ch: 55 },
    flags: ["signature", "finisher"], sig: true, desc,
  };
}

/* the four command categories the menu is built from */
const CATEGORIES = [
  { key: "STRIKE", label: "STRIKE", hint: "punches, kicks, elbows, knees" },
  { key: "GRAPPLE", label: "GRAPPLE", hint: "throws, takedowns, submissions" },
  { key: "GUARD", label: "GUARD", hint: "block, parry, recover stamina" },
  { key: "SIGNATURE", label: "SIGNATURE", hint: "your finisher - needs a full meter" },
];
const CATEGORY_OF = { STRIKE: "STRIKE", THROW: "GRAPPLE", SUB: "GRAPPLE", SETUP: "GRAPPLE", GUARD: "GUARD" };

/* Techniques in one category, best-first, for the submenu.
   A level-9 three-discipline fighter knows 163 techniques, 80 of them
   strikes. Handing a player an 80-row list they scroll five at a time is
   not depth, it is an inventory - so the menu shows the ones that are
   actually worth throwing from where the fight is standing. Nothing is
   lost: the full movelist is still there when the range changes, and it
   always keeps a couple of out-of-range options so repositioning stays a
   visible choice rather than a hidden one. */
const MENU_CAP = 12;
/* The sort-and-cap that turns a movelist into a menu, split out so the
   duel can feed it the fighter's LIVE technique list. For most of this
   game's life the fight menu rebuilt itself from knownTechs(fid, level) -
   which silently dropped everything the run had drafted or bought, and
   ignored everything the gym had cut. side.techs is the truth; this just
   makes it readable. */
function techMenuFromList(ids, cat, curRange, all) {
  const list = (ids || []).filter((id) => TECH[id] && CATEGORY_OF[TECH[id].cls] === cat);
  const sorted = list.sort((a, b) => {
    const A = TECH[a], B = TECH[b];
    const fa = rangeFit(A.range, curRange), fb = rangeFit(B.range, curRange);
    if (fb !== fa) return fb - fa;                       // in-range first
    return (B.power * fb) - (A.power * fa);              // then by what it is worth here
  });
  if (all || sorted.length <= MENU_CAP) return sorted;
  const head = sorted.slice(0, MENU_CAP - 2);
  // two that move the fight somewhere else, so the exit is always on screen
  const movers = sorted.slice(MENU_CAP - 2).filter((id) => TECH[id].moves || TECH[id].shift);
  return head.concat(movers.slice(0, 2).length ? movers.slice(0, 2) : sorted.slice(MENU_CAP - 2, MENU_CAP));
}
function techsInCategory(fid, level, cat, curRange, all) {
  return techMenuFromList(knownTechs(fid, level), cat, curRange, all);
}
