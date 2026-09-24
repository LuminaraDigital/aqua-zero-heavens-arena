/* =====================================================================
   Aqua Zero Heavens Arena - Exhibition Mode
   Luminara Digital

   Free duel lab: rematch / best-of-3, CPU level & archetype, venue and
   rule chips, handicap, random / mirror select, shareable bout codes,
   optional practice overlay, and a small career ledger. Ranked points
   stay at zero - this module never talks to RankingService.

   Pure helpers stay pure (no canvas). Page owns drawing and keybinds.
   ===================================================================== */

const EXHIBITION_MAGIC = "AZX1";
const EXHIBITION_STORAGE_HINT = "exhib";

const EXHIBITION_RULES = {
  standard: {
    id: "standard", name: "STANDARD", tag: "STD",
    hpMul: 1, atkMul: 1, noSig: false, banRanges: null, blurb: "full rules"
  },
  sudden: {
    id: "sudden", name: "SUDDEN DEATH", tag: "SUDDEN",
    hpMul: 0.55, atkMul: 1.1, noSig: false, banRanges: null, blurb: "half HP, sharper hands"
  },
  nosig: {
    id: "nosig", name: "NO SIGNATURES", tag: "NO-SIG",
    hpMul: 1, atkMul: 1, noSig: true, banRanges: null, blurb: "signatures locked"
  },
  long: {
    id: "long", name: "LONG RANGE", tag: "LONG",
    hpMul: 1, atkMul: 1, noSig: false, banRanges: ["CLINCH", "GROUND"], blurb: "kick & mid only"
  },
  clinch: {
    id: "clinch", name: "CLINCH WAR", tag: "CLINCH",
    hpMul: 1, atkMul: 1, noSig: false, banRanges: ["LONG"], blurb: "close quarters"
  }
};
const EXHIBITION_RULE_IDS = Object.keys(EXHIBITION_RULES);

const EXHIBITION_HANDICAPS = {
  even:    { id: "even", name: "EVEN", tag: "EVEN", pHp: 1, eHp: 1, pAtk: 1, eAtk: 1 },
  under:   { id: "under", name: "UNDERDOG", tag: "UNDER", pHp: 0.85, eHp: 1.15, pAtk: 0.9, eAtk: 1.15 },
  favor:   { id: "favor", name: "FAVORED", tag: "FAVOR", pHp: 1.15, eHp: 0.85, pAtk: 1.15, eAtk: 0.9 },
  glass:   { id: "glass", name: "GLASS CANNON", tag: "GLASS", pHp: 0.7, eHp: 1, pAtk: 1.35, eAtk: 1 }
};
const EXHIBITION_HANDICAP_IDS = Object.keys(EXHIBITION_HANDICAPS);

const EXHIBITION_VENUE_IDS = ["auto", "club", "gym", "outdoor", "broadcast", "heavens"];
const EXHIBITION_SERIES_IDS = ["single", "bo3"];

function exhibClampInt(n, lo, hi, fallback) {
  const x = Math.round(Number(n));
  if (!isFinite(x)) return fallback;
  return Math.max(lo, Math.min(hi, x));
}

function exhibDefSettings() {
  return {
    cpuLv: 9,
    arch: "auto",
    venue: "auto",
    rule: "standard",
    handicap: "even",
    series: "single",
    overlay: false,
    swapSides: false,
    campFocus: null,
    campWorkload: "standard",
    callout: false
  };
}

function exhibNormalizeSettings(raw) {
  const d = exhibDefSettings();
  if (!raw || typeof raw !== "object") return d;
  const archIds = (typeof ARCHETYPE_IDS !== "undefined" && Array.isArray(ARCHETYPE_IDS))
    ? ARCHETYPE_IDS : ["pressure", "counter", "grappler", "outfighter", "finisher"];
  let arch = raw.arch == null ? "auto" : String(raw.arch);
  if (arch !== "auto" && archIds.indexOf(arch) < 0) arch = "auto";
  let venue = raw.venue == null ? "auto" : String(raw.venue);
  if (EXHIBITION_VENUE_IDS.indexOf(venue) < 0) venue = "auto";
  let rule = raw.rule == null ? "standard" : String(raw.rule);
  if (!EXHIBITION_RULES[rule]) rule = "standard";
  let handicap = raw.handicap == null ? "even" : String(raw.handicap);
  if (!EXHIBITION_HANDICAPS[handicap]) handicap = "even";
  let series = raw.series == null ? "single" : String(raw.series);
  if (EXHIBITION_SERIES_IDS.indexOf(series) < 0) series = "single";
  let campFocus = raw.campFocus == null ? null : String(raw.campFocus);
  if (campFocus && typeof CAMP_FOCI !== "undefined" && !CAMP_FOCI[campFocus]) campFocus = null;
  let campWorkload = raw.campWorkload == null ? "standard" : String(raw.campWorkload);
  if (typeof CAMP_WORKLOADS !== "undefined" && !CAMP_WORKLOADS[campWorkload]) campWorkload = "standard";
  return {
    cpuLv: exhibClampInt(raw.cpuLv, 1, 9, d.cpuLv),
    arch: arch,
    venue: venue,
    rule: rule,
    handicap: handicap,
    series: series,
    overlay: !!raw.overlay,
    swapSides: !!raw.swapSides,
    campFocus: campFocus,
    campWorkload: campWorkload,
    callout: !!raw.callout
  };
}

function exhibCycle(list, cur, dir) {
  const arr = list || [];
  if (!arr.length) return cur;
  let i = arr.indexOf(cur);
  if (i < 0) i = 0;
  const step = dir < 0 ? -1 : 1;
  return arr[(i + step + arr.length) % arr.length];
}

function exhibDefCareer() {
  return {
    v: 1,
    bouts: 0,
    wins: 0,
    losses: 0,
    rematches: 0,
    seriesWon: 0,
    bestCombo: 0,
    finishes: {},
    h2h: {}
  };
}

function exhibNormalizeCareer(raw) {
  const d = exhibDefCareer();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const n = (v) => {
    const x = Math.round(Number(v));
    return (isFinite(x) && x >= 0) ? x : 0;
  };
  const finishes = {};
  if (raw.finishes && typeof raw.finishes === "object" && !Array.isArray(raw.finishes)) {
    Object.keys(raw.finishes).slice(0, 32).forEach((k) => {
      const key = String(k).slice(0, 24);
      finishes[key] = n(raw.finishes[k]);
    });
  }
  const h2h = {};
  if (raw.h2h && typeof raw.h2h === "object" && !Array.isArray(raw.h2h)) {
    Object.keys(raw.h2h).slice(0, 128).forEach((k) => {
      const row = raw.h2h[k];
      if (!row || typeof row !== "object") return;
      h2h[String(k).slice(0, 24)] = { w: n(row.w), l: n(row.l) };
    });
  }
  return {
    v: 1,
    bouts: n(raw.bouts),
    wins: n(raw.wins),
    losses: n(raw.losses),
    rematches: n(raw.rematches),
    seriesWon: n(raw.seriesWon),
    bestCombo: n(raw.bestCombo),
    finishes: finishes,
    h2h: h2h
  };
}

function exhibH2hKey(a, b) {
  const x = Math.min(a | 0, b | 0);
  const y = Math.max(a | 0, b | 0);
  return x + ":" + y;
}

function exhibNoteCareer(save, bout) {
  if (!save) return null;
  save.exhib = exhibNormalizeCareer(save.exhib);
  const c = save.exhib;
  const win = !!bout.win;
  c.bouts++;
  if (win) c.wins++; else c.losses++;
  if (bout.rematch) c.rematches++;
  if (bout.seriesWon) c.seriesWon++;
  const combo = Math.round(Number(bout.bestCombo) || 0);
  if (combo > c.bestCombo) c.bestCombo = combo;
  const method = bout.method ? String(bout.method).slice(0, 24) : "";
  if (method && win) c.finishes[method] = (c.finishes[method] || 0) + 1;
  if (bout.pFid != null && bout.eFid != null && bout.pFid !== bout.eFid) {
    const key = exhibH2hKey(bout.pFid, bout.eFid);
    if (!c.h2h[key]) c.h2h[key] = { w: 0, l: 0 };
    /* wins are from the lower-id seat's perspective only when pFid < eFid;
       otherwise flip so the ledger stays stable across side swaps. */
    const pLower = (bout.pFid | 0) <= (bout.eFid | 0);
    if ((win && pLower) || (!win && !pLower)) c.h2h[key].w++;
    else c.h2h[key].l++;
  }
  return c;
}

function exhibCareerLine(save) {
  const c = exhibNormalizeCareer(save && save.exhib);
  if (!c.bouts) return "NO EXHIBITION RECORD";
  return "EXHIB " + c.wins + "-" + c.losses
    + (c.bestCombo ? ("  ·  BEST COMBO " + c.bestCombo) : "")
    + (c.seriesWon ? ("  ·  SERIES " + c.seriesWon) : "");
}

function exhibH2hLine(save, a, b) {
  if (a == null || b == null || a === b) return "";
  const c = exhibNormalizeCareer(save && save.exhib);
  const row = c.h2h[exhibH2hKey(a, b)];
  if (!row || (!(row.w) && !(row.l))) return "FIRST MEETING";
  return "H2H " + row.w + "-" + row.l;
}

/* ---- series / rematch bookkeeping ---- */
const ExhibitionMode = (function () {
  let settings = exhibDefSettings();
  let series = null;
  let lastBout = null;

  function getSettings() { return exhibNormalizeSettings(settings); }
  function setSettings(next) {
    settings = exhibNormalizeSettings(Object.assign({}, settings, next || {}));
    return settings;
  }
  function cycleSetting(key, dir) {
    const s = getSettings();
    const d = dir < 0 ? -1 : 1;
    if (key === "cpuLv") s.cpuLv = ((s.cpuLv - 1 + d + 9) % 9) + 1;
    else if (key === "arch") {
      const ids = ["auto"].concat(
        (typeof ARCHETYPE_IDS !== "undefined" && ARCHETYPE_IDS.slice()) ||
        ["pressure", "counter", "grappler", "outfighter", "finisher"]
      );
      s.arch = exhibCycle(ids, s.arch, d);
    }
    else if (key === "venue") s.venue = exhibCycle(EXHIBITION_VENUE_IDS, s.venue, d);
    else if (key === "rule") s.rule = exhibCycle(EXHIBITION_RULE_IDS, s.rule, d);
    else if (key === "handicap") s.handicap = exhibCycle(EXHIBITION_HANDICAP_IDS, s.handicap, d);
    else if (key === "series") s.series = exhibCycle(EXHIBITION_SERIES_IDS, s.series, d);
    else if (key === "overlay") s.overlay = !s.overlay;
    else if (key === "swapSides") s.swapSides = !s.swapSides;
    else if (key === "callout") s.callout = !s.callout;
    else if (key === "campFocus") {
      const ids = [null].concat(
        (typeof CAMP_FOCUS_IDS !== "undefined" && CAMP_FOCUS_IDS.slice()) || []
      );
      s.campFocus = exhibCycle(ids, s.campFocus, d);
    }
    else if (key === "campWorkload") {
      const ids = (typeof CAMP_WORKLOAD_IDS !== "undefined" && CAMP_WORKLOAD_IDS.slice())
        || ["light", "standard", "hard"];
      s.campWorkload = exhibCycle(ids, s.campWorkload, d);
    }
    return setSettings(s);
  }

  function issueExhibitionCallout(save, pFid, eFid) {
    if (typeof issueCallout !== "function") return { ok: false, reason: "no_system" };
    return issueCallout(save, pFid, eFid);
  }

  function campPlanFromSettings() {
    const s = getSettings();
    if (!s.campFocus) return null;
    return { focus: s.campFocus, workload: s.campWorkload || "standard" };
  }

  function beginSeries(p1, p2, opts) {
    const s = getSettings();
    const hotseat = !!(opts && opts.hotseat);
    const format = (opts && opts.series) || s.series;
    series = {
      active: true,
      format: format === "bo3" ? "bo3" : "single",
      need: format === "bo3" ? 2 : 1,
      p1: p1 | 0,
      p2: p2 | 0,
      score: [0, 0],
      bout: 1,
      hotseat: hotseat,
      settings: getSettings(),
      rematch: !!(opts && opts.rematch)
    };
    lastBout = { p1: series.p1, p2: series.p2, hotseat: hotseat, settings: series.settings };
    return series;
  }

  function clearSeries() { series = null; }
  function getSeries() { return series; }
  function seriesSnapshot() {
    if (!series) return null;
    return {
      format: series.format,
      need: series.need,
      score: series.score.slice(),
      bout: series.bout,
      done: seriesDone(),
      winner: seriesWinner()
    };
  }
  function seriesDone() {
    if (!series) return true;
    return series.score[0] >= series.need || series.score[1] >= series.need;
  }
  function seriesWinner() {
    if (!series || !seriesDone()) return null;
    return series.score[0] >= series.need ? "p" : "e";
  }
  function scoreBout(pWon) {
    if (!series || !series.active) return seriesSnapshot();
    if (pWon) series.score[0]++; else series.score[1]++;
    series.bout++;
    return seriesSnapshot();
  }

  function rememberBout(p1, p2, hotseat) {
    lastBout = {
      p1: p1 | 0,
      p2: p2 | 0,
      hotseat: !!hotseat,
      settings: getSettings()
    };
    return lastBout;
  }
  function getLastBout() { return lastBout; }

  function randomFighter(list, avoid) {
    const pool = (list || []).filter((id) => id !== avoid);
    const src = pool.length ? pool : (list || [0]);
    return src[Math.floor(Math.random() * src.length)] | 0;
  }

  function optionRows() {
    const s = getSettings();
    const rule = EXHIBITION_RULES[s.rule] || EXHIBITION_RULES.standard;
    const hc = EXHIBITION_HANDICAPS[s.handicap] || EXHIBITION_HANDICAPS.even;
    const archName = s.arch === "auto"
      ? "AUTO"
      : ((typeof ARCHETYPES !== "undefined" && ARCHETYPES[s.arch] && ARCHETYPES[s.arch].name) || s.arch);
    return [
      { key: "cpuLv", label: "CPU LV", value: String(s.cpuLv), hint: "1" },
      { key: "arch", label: "AI PLAN", value: String(archName).slice(0, 14), hint: "2" },
      { key: "venue", label: "VENUE", value: s.venue.toUpperCase(), hint: "3" },
      { key: "rule", label: "RULES", value: rule.tag, hint: "4" },
      { key: "handicap", label: "HANDICAP", value: hc.tag, hint: "5" },
      { key: "series", label: "SERIES", value: s.series === "bo3" ? "BEST OF 3" : "SINGLE", hint: "6" },
      { key: "overlay", label: "OVERLAY", value: s.overlay ? "ON" : "OFF", hint: "7" },
      { key: "swapSides", label: "SIDES", value: s.swapSides ? "SWAPPED" : "NORMAL", hint: "8" },
      { key: "campFocus", label: "CAMP", value: s.campFocus ? String(s.campFocus).toUpperCase() : "NONE", hint: "9" },
      { key: "campWorkload", label: "WORKLOAD", value: String(s.campWorkload || "standard").toUpperCase(), hint: "0" },
      { key: "callout", label: "CALLOUT", value: s.callout ? "ON" : "OFF", hint: "C" }
    ];
  }

  /* Build startDuel opts. Relies on page globals hpOf / battlePool / diff. */
  function duelOpts(p1, p2, extra) {
    extra = extra || {};
    const s = exhibNormalizeSettings(extra.settings || settings);
    let a = p1 | 0, b = p2 | 0;
    if (s.swapSides) { const t = a; a = b; b = t; }
    const rule = EXHIBITION_RULES[s.rule] || EXHIBITION_RULES.standard;
    const hc = EXHIBITION_HANDICAPS[s.handicap] || EXHIBITION_HANDICAPS.even;
    const dm = (typeof diff === "function") ? diff() : { dmg: 1 };
    const hotseat = !!extra.hotseat;
    const cpuLv = hotseat ? 9 : s.cpuLv;
    const pHp = Math.max(1, Math.round((typeof hpOf === "function" ? hpOf(a) : 100) * rule.hpMul * hc.pHp));
    const eHp = Math.max(1, Math.round((typeof hpOf === "function" ? hpOf(b) : 100) * rule.hpMul * hc.eHp));
    const pool = (fid, lv) => (typeof battlePool === "function" ? battlePool(fid, lv) : [0, 1, 2, 3, 4]);
    const camp = s.campFocus
      ? { focus: s.campFocus, workload: s.campWorkload || "standard" }
      : null;
    return {
      p1: a,
      p1hp: pHp,
      p1pool: pool(a, 9),
      p1level: 9,
      oppFid: b,
      oppHp: eHp,
      oppPool: pool(b, cpuLv),
      oppLv: cpuLv,
      oppAtk: (dm.dmg || 1) * rule.atkMul * hc.eAtk,
      pAtkMul: hc.pAtk,
      fromAdv: false,
      hotseat: hotseat,
      stage: 5,
      exhibition: true,
      camp: camp,
      exhib: {
        rule: rule.id,
        handicap: hc.id,
        venue: s.venue,
        overlay: !!s.overlay,
        series: s.series,
        arch: s.arch,
        noSig: !!rule.noSig,
        banRanges: rule.banRanges ? rule.banRanges.slice() : null,
        callout: !!s.callout,
        campFocus: s.campFocus,
        campWorkload: s.campWorkload
      },
      arch: (!hotseat && s.arch !== "auto") ? s.arch : null,
      venueId: s.venue !== "auto" ? s.venue : null
    };
  }

  function encodeBout(p1, p2, s) {
    try {
      const payload = {
        m: EXHIBITION_MAGIC,
        a: p1 | 0,
        b: p2 | 0,
        s: exhibNormalizeSettings(s || settings)
      };
      const json = JSON.stringify(payload);
      let b64 = "";
      if (typeof Buffer !== "undefined") b64 = Buffer.from(json, "utf8").toString("base64");
      else if (typeof btoa === "function") b64 = btoa(unescape(encodeURIComponent(json)));
      return EXHIBITION_MAGIC + "-" + b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    } catch (e) {
      return "";
    }
  }

  function decodeBout(code) {
    if (!code || typeof code !== "string") return null;
    try {
      let raw = code.trim();
      if (raw.indexOf(EXHIBITION_MAGIC + "-") === 0) raw = raw.slice(EXHIBITION_MAGIC.length + 1);
      raw = raw.replace(/-/g, "+").replace(/_/g, "/");
      while (raw.length % 4 !== 0) raw += "=";
      let json = "";
      if (typeof Buffer !== "undefined") json = Buffer.from(raw, "base64").toString("utf8");
      else if (typeof atob === "function") json = decodeURIComponent(escape(atob(raw)));
      const data = JSON.parse(json);
      if (!data || data.m !== EXHIBITION_MAGIC) return null;
      const rosterN = (typeof FIGHTERS !== "undefined" && FIGHTERS.length) ? FIGHTERS.length : 64;
      const a = exhibClampInt(data.a, 0, rosterN - 1, 0);
      const b = exhibClampInt(data.b, 0, rosterN - 1, 1);
      return { p1: a, p2: b, settings: exhibNormalizeSettings(data.s) };
    } catch (e) {
      return null;
    }
  }

  function applyToDuel(d) {
    if (!d || !d.exhib) return d;
    const ex = d.exhib;
    if (ex.noSig) {
      if (d.p) d.p.sig = null;
      if (d.e && !d.hotseat) d.e.sig = null;
    }
    if (ex.banRanges && ex.banRanges.length) {
      const ban = ex.banRanges;
      const filter = (side) => {
        if (!side || !Array.isArray(side.techs)) return;
        side.techs = side.techs.filter((id) => {
          const t = (typeof TECH !== "undefined") ? TECH[id] : null;
          if (!t) return true;
          if (!t.range || t.range === "ANY") return true;
          return ban.indexOf(t.range) < 0;
        });
      };
      filter(d.p);
      filter(d.e);
    }
    if (ex.overlay && typeof DojoMode !== "undefined" && DojoMode.toggleOverlay) {
      DojoMode.toggleOverlay(true);
    }
    return d;
  }

  return {
    EXHIBITION_RULES: EXHIBITION_RULES,
    EXHIBITION_HANDICAPS: EXHIBITION_HANDICAPS,
    EXHIBITION_VENUE_IDS: EXHIBITION_VENUE_IDS,
    getSettings: getSettings,
    setSettings: setSettings,
    cycleSetting: cycleSetting,
    optionRows: optionRows,
    beginSeries: beginSeries,
    clearSeries: clearSeries,
    issueExhibitionCallout: issueExhibitionCallout,
    campPlanFromSettings: campPlanFromSettings,
    getSeries: getSeries,
    seriesSnapshot: seriesSnapshot,
    seriesDone: seriesDone,
    seriesWinner: seriesWinner,
    scoreBout: scoreBout,
    rememberBout: rememberBout,
    getLastBout: getLastBout,
    randomFighter: randomFighter,
    duelOpts: duelOpts,
    encodeBout: encodeBout,
    decodeBout: decodeBout,
    applyToDuel: applyToDuel,
    noteCareer: exhibNoteCareer,
    careerLine: exhibCareerLine,
    h2hLine: exhibH2hLine,
    normalizeCareer: exhibNormalizeCareer,
    normalizeSettings: exhibNormalizeSettings,
    defSettings: exhibDefSettings
  };
})();

if (typeof window !== "undefined") {
  window.ExhibitionMode = ExhibitionMode;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = ExhibitionMode;
}
