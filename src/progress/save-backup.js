/* =====================================================================
   Aqua Zero Heavens Arena - automatic save backups
   Luminary Digital

   localStorage is one key away from loss. This module keeps a short
   vault of recent snapshots beside the live save, and shapes export /
   import so a player can carry progress as a JSON file.

   Pure helpers: no DOM. The page wires download / file-picker around them.
   Multi-tab: a stamp key (rev + tabId + time) lets other tabs adopt a newer
   write via the storage event. Same-tab saveGen stays in-memory for tests.

   Offline security: deep sanitize for run/daily/ranking, client import
   rate limit, and a local security event ring buffer.
   ===================================================================== */
const BACKUP_KEY = "azha_save_backups";
const STAMP_KEY = "azha_save_stamp";
const BACKUP_LIMIT = 5;
const IMPORT_MAX_CHARS = 200000;
const UNLOCKED_MAX = 64;
const UNLOCKED_ID_MAX = 63;
const NAME_MAX = 16;

const SECURITY_LOG_KEY = "azha_security_log";
const SECURITY_LOG_LIMIT = 50;
const IMPORT_RATE_WINDOW_MS = 60000;
const IMPORT_RATE_MAX = 10;
const DEEP_MAX_DEPTH = 8;
const DEEP_MAX_KEYS = 200;
const DEEP_STR_MAX = 64;
const DETAIL_MAX = 120;
const PLAYER_ID_MAX = 32;

let saveGen = 0;

function bumpSaveGen() {
  saveGen = (saveGen + 1) | 0;
  return saveGen;
}

function makeTabId() {
  return "t" + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}

function readSaveStamp(localStorageLike) {
  try {
    const raw = localStorageLike.getItem(STAMP_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    if (typeof o.rev !== "number" || !isFinite(o.rev) || o.rev < 0) return null;
    if (typeof o.tabId !== "string" || !o.tabId) return null;
    if (typeof o.t !== "number" || !isFinite(o.t)) return null;
    return { rev: o.rev | 0, tabId: String(o.tabId).slice(0, 64), t: o.t | 0 };
  } catch (e) {
    return null;
  }
}

function writeSaveStamp(localStorageLike, stamp) {
  if (!stamp || typeof stamp !== "object") return;
  localStorageLike.setItem(
    STAMP_KEY,
    JSON.stringify({
      rev: stamp.rev | 0,
      tabId: String(stamp.tabId || "").slice(0, 64),
      t: stamp.t | 0,
    })
  );
}

function nextSaveStamp(prevStamp, tabId, nowMs) {
  const prevRev = prevStamp && typeof prevStamp.rev === "number" ? prevStamp.rev | 0 : 0;
  return {
    rev: (prevRev + 1) | 0,
    tabId: String(tabId || "unknown").slice(0, 64),
    t: nowMs | 0,
  };
}

/* Adopt when another tab wrote a strictly newer rev, or same rev with a later timestamp. */
function shouldAdoptRemoteStamp(localStamp, remoteStamp, myTabId) {
  if (!remoteStamp) return false;
  if (myTabId && remoteStamp.tabId === myTabId) return false;
  const lr = localStamp && typeof localStamp.rev === "number" ? localStamp.rev | 0 : 0;
  const rr = remoteStamp.rev | 0;
  if (rr > lr) return true;
  if (rr < lr) return false;
  const lt = localStamp && typeof localStamp.t === "number" ? localStamp.t | 0 : 0;
  return (remoteStamp.t | 0) > lt;
}

function clearBackupVault(localStorageLike) {
  try {
    localStorageLike.removeItem(BACKUP_KEY);
  } catch (e) {}
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFighterName(raw) {
  return String(raw == null ? "" : raw)
    .replace(/[^A-Za-z0-9 .'-]/g, "")
    .trim()
    .slice(0, NAME_MAX)
    .toUpperCase();
}

function isPlainObject(o) {
  return !!o && typeof o === "object" && !Array.isArray(o);
}

function isDangerousName(k) {
  return k === "__proto__" || k === "constructor" || k === "prototype";
}

/* Detect prototype pollution without comparing Object.prototype (vm harness is cross-realm). */
function hasPollutedProto(o) {
  if (o == null || typeof o !== "object" || Array.isArray(o)) return false;
  if (Object.prototype.hasOwnProperty.call(o, "__proto__")) return true;
  const p = Object.getPrototypeOf(o);
  if (p == null) return false;
  /* Pollution targets are plain data objects. Intrinsic Object.prototype has many own names. */
  if (Object.keys(p).length > 0) return true;
  return Object.getOwnPropertyNames(p).length === 0;
}

function hasDangerousKey(o) {
  if (!isPlainObject(o)) return false;
  if (hasPollutedProto(o)) return true;
  const keys = Object.getOwnPropertyNames(o);
  for (let i = 0; i < keys.length; i++) {
    if (isDangerousName(keys[i])) return true;
  }
  return false;
}

/* Recursively detect dangerous key names / polluted prototypes.
   Depth and key budgets stop the scan; oversize alone is not "dangerous". */
function deepHasDangerous(node, depth, counter) {
  if (node == null) return false;
  const t = typeof node;
  if (t === "number" || t === "boolean" || t === "string") return false;
  if (t !== "object") return true;
  if (depth > DEEP_MAX_DEPTH) return false;
  if (hasPollutedProto(node)) return true;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      counter.n++;
      if (counter.n > DEEP_MAX_KEYS) return false;
      if (deepHasDangerous(node[i], depth + 1, counter)) return true;
    }
    return false;
  }
  if (!isPlainObject(node)) return true;
  const keys = Object.getOwnPropertyNames(node);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (isDangerousName(k)) return true;
    counter.n++;
    if (counter.n > DEEP_MAX_KEYS) return false;
    if (deepHasDangerous(node[k], depth + 1, counter)) return true;
  }
  return false;
}

/* Rebuild JSON-ish values. Strips dangerous keys; truncates when over budget. */
function deepCleanValue(node, depth, counter) {
  if (node === null) return null;
  const t = typeof node;
  if (t === "boolean") return node;
  if (t === "number") return isFinite(node) ? node : undefined;
  if (t === "string") return String(node).slice(0, DEEP_STR_MAX);
  if (t !== "object") return undefined;
  if (depth > DEEP_MAX_DEPTH) return undefined;
  if (hasPollutedProto(node)) return undefined;
  if (Array.isArray(node)) {
    const out = [];
    for (let i = 0; i < node.length; i++) {
      counter.n++;
      if (counter.n > DEEP_MAX_KEYS) break;
      const v = deepCleanValue(node[i], depth + 1, counter);
      if (v === undefined) continue;
      out.push(v);
    }
    return out;
  }
  if (!isPlainObject(node)) return undefined;
  const out = {};
  const keys = Object.getOwnPropertyNames(node);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (isDangerousName(k)) continue;
    counter.n++;
    if (counter.n > DEEP_MAX_KEYS) break;
    const v = deepCleanValue(node[k], depth + 1, counter);
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function sanitizeRun(raw) {
  if (raw == null) return null;
  if (!isPlainObject(raw) || hasDangerousKey(raw)) return null;
  /* Drop map before deep scan: field is rebuilt on resume from stage/reroll. */
  const probe = Object.assign({}, raw);
  if (isPlainObject(probe.adv)) {
    probe.adv = Object.assign({}, probe.adv, { map: null });
  }
  const counter = { n: 0 };
  if (deepHasDangerous(probe, 0, counter)) return null;
  const cleaned = deepCleanValue(probe, 0, { n: 0 });
  if (!isPlainObject(cleaned)) return null;
  if (isPlainObject(cleaned.adv)) cleaned.adv.map = null;
  return cleaned;
}

function sanitizeDaily(raw) {
  if (raw == null) return null;
  if (!isPlainObject(raw) || hasDangerousKey(raw)) return null;
  const counter = { n: 0 };
  if (deepHasDangerous(raw, 0, counter)) return null;
  const cleaned = deepCleanValue(raw, 0, { n: 0 });
  if (!isPlainObject(cleaned)) return null;
  const out = {};
  const numKeys = ["day", "score", "streak", "best", "bestStreak", "plays"];
  for (let i = 0; i < numKeys.length; i++) {
    const k = numKeys[i];
    if (typeof cleaned[k] === "number" && isFinite(cleaned[k])) out[k] = cleaned[k];
  }
  if (typeof cleaned.done === "boolean") out.done = cleaned.done;
  /* keep any other safe cleaned fields without reintroducing danger */
  for (const k of Object.keys(cleaned)) {
    if (out[k] !== undefined) continue;
    if (isDangerousName(k)) continue;
    out[k] = cleaned[k];
  }
  return out;
}

function sanitizePlayerRanking(raw) {
  if (!isPlainObject(raw) || hasDangerousKey(raw)) return null;
  const out = {};
  if (typeof raw.playerId === "string") out.playerId = String(raw.playerId).slice(0, PLAYER_ID_MAX);
  const nums = [
    "promotionPoints", "rankIndex", "peakRankIndex",
    "wins", "losses", "totalMatches", "lastRankChangeAt", "streak",
  ];
  for (let i = 0; i < nums.length; i++) {
    const k = nums[i];
    if (typeof raw[k] === "number" && isFinite(raw[k])) out[k] = raw[k];
  }
  return out;
}

function sanitizeRanking(raw) {
  if (raw == null) return { players: {}, audit: [] };
  if (!isPlainObject(raw) || hasDangerousKey(raw)) return null;
  const playersIn = isPlainObject(raw.players) && !hasDangerousKey(raw.players) ? raw.players : null;
  if (raw.players != null && playersIn == null) return null;
  const players = {};
  if (playersIn) {
    const ids = Object.keys(playersIn);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (isDangerousName(id)) continue;
      const pid = String(id).slice(0, PLAYER_ID_MAX);
      if (!pid) continue;
      const pr = sanitizePlayerRanking(playersIn[id]);
      if (pr) players[pid] = pr;
    }
  }
  const auditLimit =
    (typeof RANK_CONFIG !== "undefined" && RANK_CONFIG && typeof RANK_CONFIG.auditLimit === "number")
      ? RANK_CONFIG.auditLimit
      : 40;
  const audit = [];
  if (Array.isArray(raw.audit)) {
    for (let i = 0; i < raw.audit.length && audit.length < auditLimit; i++) {
      const e = raw.audit[i];
      if (!isPlainObject(e) || hasDangerousKey(e)) continue;
      const entry = {};
      for (const k of Object.keys(e)) {
        if (isDangerousName(k)) continue;
        const v = e[k];
        const t = typeof v;
        if (t === "number" && isFinite(v)) entry[k] = v;
        else if (t === "string") entry[k] = String(v).slice(0, DEEP_STR_MAX);
        else if (t === "boolean") entry[k] = v;
      }
      audit.push(entry);
    }
  }
  return { players: players, audit: audit };
}

function sanitizeIntMap(raw, maxEntries) {
  if (!isPlainObject(raw) || hasDangerousKey(raw)) return {};
  const out = {};
  let n = 0;
  for (const k of Object.keys(raw)) {
    if (!/^\d{1,3}$/.test(k)) continue;
    const ki = +k;
    if (ki < 0 || ki > UNLOCKED_ID_MAX) continue;
    const v = raw[k];
    if (typeof v !== "number" || !isFinite(v)) continue;
    out[k] = v;
    n++;
    if (n >= maxEntries) break;
  }
  return out;
}

/* per-fighter history is { w, l } (or similar), not a bare integer */
function sanitizeFighterRecords(raw) {
  if (!isPlainObject(raw) || hasDangerousKey(raw)) return {};
  const out = {};
  let n = 0;
  for (const k of Object.keys(raw)) {
    if (!/^\d{1,3}$/.test(k)) continue;
    const ki = +k;
    if (ki < 0 || ki > UNLOCKED_ID_MAX) continue;
    const v = raw[k];
    if (typeof v === "number" && isFinite(v)) {
      out[k] = v | 0;
    } else if (isPlainObject(v) && !hasDangerousKey(v)) {
      const rec = {};
      ["w", "l", "wins", "losses", "perfect"].forEach((fk) => {
        if (typeof v[fk] === "number" && isFinite(v[fk]) && v[fk] >= 0) rec[fk] = v[fk] | 0;
      });
      out[k] = rec;
    } else {
      continue;
    }
    n++;
    if (n >= UNLOCKED_MAX) break;
  }
  return out;
}

function sanitizeSavePayload(save) {
  if (!isPlainObject(save) || hasDangerousKey(save)) return null;
  if (!Array.isArray(save.unlocked)) return null;
  if (save.unlocked.length > UNLOCKED_MAX) return null;
  const unlocked = [];
  for (let i = 0; i < save.unlocked.length; i++) {
    const x = save.unlocked[i];
    if (typeof x !== "number" || !isFinite(x) || (x | 0) !== x) return null;
    if (x < 0 || x > UNLOCKED_ID_MAX) return null;
    unlocked.push(x);
  }

  /* Nested danger in run/daily/ranking rejects the whole payload (G2 / security tests). */
  let run = null;
  if (save.run != null) {
    run = sanitizeRun(save.run);
    if (run === null) return null;
  }
  let daily = null;
  if (save.daily != null) {
    daily = sanitizeDaily(save.daily);
    if (daily === null) return null;
  }
  let ranking = { players: {}, audit: [] };
  if (save.ranking != null) {
    ranking = sanitizeRanking(save.ranking);
    if (ranking === null) return null;
  }

  const name = sanitizeFighterName(save.name);
  const out = {
    v: typeof save.v === "number" && isFinite(save.v) ? (save.v | 0) : 4,
    name: name || "CHALLENGER",
    unlocked: unlocked,
    defeats: sanitizeIntMap(save.defeats, UNLOCKED_MAX),
    sound: save.sound !== false,
    music: save.music !== false,
    diff: typeof save.diff === "number" && isFinite(save.diff)
      ? Math.max(0, Math.min(2, save.diff | 0))
      : 1,
    motion: save.motion !== false,
    mastery: sanitizeIntMap(save.mastery, UNLOCKED_MAX),
    titles: Array.isArray(save.titles)
      ? save.titles.filter((t) => typeof t === "string").slice(0, 64).map((t) => String(t).slice(0, 48))
      : [],
    title: typeof save.title === "string" ? String(save.title).slice(0, 48) : null,
    daily: daily,
    run: run,
    ranking: ranking,
    rec: {},
    fr: sanitizeFighterRecords(save.fr),
  };

  if (isPlainObject(save.rec) && !hasDangerousKey(save.rec)) {
    const rec = {};
    for (const k of ["duels", "wins", "losses", "perfect", "stages", "bestSurv", "ngplus"]) {
      const v = save.rec[k];
      if (typeof v === "number" && isFinite(v) && v >= 0) rec[k] = v | 0;
    }
    out.rec = rec;
  }

  return out;
}

/* ---------- security event log (localStorage ring buffer) ---------- */
function readSecurityLog(localStorageLike) {
  try {
    const raw = localStorageLike.getItem(SECURITY_LOG_KEY);
    if (!raw) return { events: [] };
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.events)) return { events: [] };
    return { events: o.events };
  } catch (e) {
    return { events: [] };
  }
}

function clearSecurityLog(localStorageLike) {
  try {
    localStorageLike.removeItem(SECURITY_LOG_KEY);
  } catch (e) {}
}

function appendSecurityEvent(localStorageLike, event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return;
  if (hasDangerousKey(event)) return;
  const kind = String(event.kind == null ? "" : event.kind).slice(0, 64);
  const detail = String(event.detail == null ? "" : event.detail).slice(0, DETAIL_MAX);
  if (!kind) return;
  const at = typeof event.at === "number" && isFinite(event.at) ? event.at : Date.now();
  const entry = { at: at, kind: kind, detail: detail };
  const log = readSecurityLog(localStorageLike);
  const events = (log.events || []).slice();
  events.push(entry);
  while (events.length > SECURITY_LOG_LIMIT) events.shift();
  try {
    localStorageLike.setItem(SECURITY_LOG_KEY, JSON.stringify({ events: events }));
  } catch (e) {}
}

/* ---------- client import rate limit ---------- */
function pruneImportTimes(times, nowMs) {
  const windowStart = nowMs - IMPORT_RATE_WINDOW_MS;
  const out = [];
  const src = Array.isArray(times) ? times : [];
  for (let i = 0; i < src.length; i++) {
    const t = src[i];
    if (typeof t === "number" && isFinite(t) && t >= windowStart) out.push(t);
  }
  return out;
}

function checkImportRateLimit(state, nowMs) {
  const times = pruneImportTimes(state && state.times, nowMs);
  const next = { times: times };
  if (times.length >= IMPORT_RATE_MAX) {
    const oldest = times[0];
    const retryAfterMs = Math.max(1, (oldest + IMPORT_RATE_WINDOW_MS) - nowMs);
    return { ok: false, retryAfterMs: retryAfterMs, state: next };
  }
  return { ok: true, retryAfterMs: 0, state: next };
}

function noteImportAttempt(state, nowMs) {
  const times = pruneImportTimes(state && state.times, nowMs);
  times.push(nowMs);
  return { times: times };
}

function readBackupVault(localStorageLike) {
  try {
    const raw = localStorageLike.getItem(BACKUP_KEY);
    if (!raw) return { snaps: [] };
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.snaps)) return { snaps: [] };
    return { snaps: o.snaps };
  } catch (e) {
    return { snaps: [] };
  }
}

function writeBackupVault(localStorageLike, vault) {
  localStorageLike.setItem(BACKUP_KEY, JSON.stringify(vault && vault.snaps ? vault : { snaps: [] }));
}

function clearSaveStamp(localStorageLike) {
  try {
    localStorageLike.removeItem(STAMP_KEY);
  } catch (e) {}
}

/* deep-clone via JSON so the vault never shares references with SAVE */
function snapshotSave(saveObj, nowMs) {
  return {
    t: nowMs | 0,
    v: (saveObj && saveObj.v) || 0,
    save: JSON.parse(JSON.stringify(saveObj)),
  };
}

function pushBackup(vault, snapshot, limit) {
  const lim = limit == null ? BACKUP_LIMIT : limit;
  const snaps = ((vault && vault.snaps) || []).slice();
  snaps.push(snapshot);
  while (snaps.length > lim) snaps.shift();
  return { snaps: snaps };
}

function latestBackup(vault) {
  const snaps = (vault && vault.snaps) || [];
  return snaps.length ? snaps[snaps.length - 1] : null;
}

function exportSaveBlob(saveObj) {
  return JSON.stringify({
    format: "azha-save",
    v: 1,
    exportedAt: Date.now(),
    save: saveObj,
  });
}

function importSaveEnvelope(text) {
  const raw = String(text == null ? "" : text);
  if (raw.length > IMPORT_MAX_CHARS) {
    return { ok: false, error: "file too large" };
  }
  let o;
  try {
    o = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: "invalid JSON" };
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) {
    return { ok: false, error: "not an object" };
  }
  if (hasDangerousKey(o)) {
    return { ok: false, error: "unsafe keys" };
  }
  if (o.format !== "azha-save") {
    return { ok: false, error: "not an azha-save file" };
  }
  if (o.v !== 1) {
    return { ok: false, error: "unsupported version" };
  }
  const cleaned = sanitizeSavePayload(o.save);
  if (!cleaned) {
    return { ok: false, error: "invalid save payload" };
  }
  return { ok: true, save: cleaned };
}
