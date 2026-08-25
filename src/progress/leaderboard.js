/* =====================================================================
   Aqua Zero Heavens Arena - the daily leaderboard (optional, Supabase)
   Luminara Digital

   The daily gauntlet is already the same fight for everybody: dayKey()
   seeds it, so two people on the same date meet the same opponent under
   the same stipulations and dailyScore() grades them on the same curve.
   That is a leaderboard without a server. This module adds the server
   part, and nothing else changes.

   The posture is the one ADR 0005 set for cloud saves:

     - Unconfigured and offline are the NORMAL case, not an error. With no
       CLOUD_CONFIG every call here returns a quiet, shaped result -
       rows are always an array, nothing throws, nothing awaits forever.
     - Reads are anonymous. You can look at the board without an account.
       Writes need a signed-in session, because the row is owned.
     - The payload is four fields: day, score, fighter, name. No save
       contents, no email, no tokens in the body, no PII. `user_id` is
       NOT sent - Postgres fills it from auth.uid() (see DDL below), so
       the request body cannot carry an identity we did not intend.
     - The streak stays attendance, not wins. Nothing in this file reads
       or writes save.daily; submitting a score is a separate act from
       completing the gauntlet.

   No canvas, no DOM, no rendering: a scene reads lbBoardNow() (which is
   synchronous and cache-only) and asks lbRefreshBoard() to fill it in
   the background. Latch anything you show in step(), never in render().

   Expected table (RLS on, owner-only writes, public read):

     create table public.daily_scores (
       user_id uuid  not null default auth.uid()
                     references auth.users(id) on delete cascade,
       day     int   not null,
       score   int   not null default 0,
       fighter smallint not null default 0,
       name    text  not null default 'CHALLENGER',
       created_at timestamptz not null default now(),
       primary key (user_id, day)
     );

   ===================================================================== */
const LB_TABLE = "daily_scores";
const LB_TOP_N = 10;                 /* what a board shows by default */
const LB_TOP_MAX = 50;               /* the most we will ever ask for */
const LB_NAME_MAX = 16;              /* matches SAVE.name */
const LB_NAME_FALLBACK = "CHALLENGER";
const LB_SCORE_MAX = 1000000;        /* dailyScore cannot reach this */
const LB_FIGHTER_MAX = 255;
const LB_TIMEOUT_MS = 6000;          /* a dead host must not hang a scene */
const LB_CACHE_MS = 60000;
const LB_SHARE_TAG = "AZHA";

let lbBusy = false;
let lbLastError = "";
let lbCache = {};                    /* day -> { rows, at } */
let lbInflight = {};                 /* day -> promise, so a polling scene cannot spam */

/* ---------------------------------------------------------------- config */

/* The leaderboard rides on the cloud-save config. If those helpers are not
   in the bundle, or the keys were never embedded, we are simply off. */
function lbHelpersReady() {
  return (
    typeof cloudConfigured === "function" &&
    typeof cloudBaseUrl === "function" &&
    typeof cloudAuthHeaders === "function" &&
    typeof cloudReadSession === "function"
  );
}

function lbConfigured() {
  try {
    return !!(lbHelpersReady() && cloudConfigured());
  } catch (e) {
    return false;
  }
}

function lbFetchImpl(fetchImpl) {
  if (typeof fetchImpl === "function") return fetchImpl;
  try {
    if (typeof cloudFetchImpl === "function") {
      const f = cloudFetchImpl();
      if (typeof f === "function") return f;
    }
  } catch (e) {}
  if (typeof fetch === "function") return fetch;
  return null;
}

function lbStore(localStorageLike) {
  if (localStorageLike) return localStorageLike;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function lbSession(localStorageLike) {
  const store = lbStore(localStorageLike);
  if (!store || typeof cloudReadSession !== "function") return null;
  try {
    return cloudReadSession(store);
  } catch (e) {
    return null;
  }
}

function lbEndpoint(query) {
  const base = typeof cloudBaseUrl === "function" ? String(cloudBaseUrl() || "") : "";
  return base + "/rest/v1/" + LB_TABLE + (query ? "?" + query : "");
}

function lbHeaders(bearer, extra) {
  let h = {};
  try {
    if (typeof cloudAuthHeaders === "function") h = cloudAuthHeaders(bearer) || {};
  } catch (e) {
    h = {};
  }
  return Object.assign({ Accept: "application/json" }, h, extra || {});
}

/* ------------------------------------------------------- tiny net helpers */

async function lbJson(res) {
  if (typeof cloudParseJson === "function") return cloudParseJson(res);
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

function lbErr(body, fallback) {
  if (typeof cloudErrMessage === "function") {
    try {
      return cloudErrMessage(body, fallback);
    } catch (e) {}
  }
  if (body && typeof body === "object") {
    if (typeof body.message === "string" && body.message) return body.message.slice(0, 120);
    if (typeof body.error === "string" && body.error) return body.error.slice(0, 120);
  }
  return fallback;
}

/* A timeout is the difference between "offline" and "the scene is stuck". */
function lbRace(promise, ms) {
  if (!(ms > 0) || typeof setTimeout !== "function") return promise;
  return Promise.race([
    promise,
    new Promise(function (resolve) {
      setTimeout(function () {
        resolve({ lbTimedOut: true });
      }, ms);
    }),
  ]);
}

function lbFail(error) {
  lbLastError = String(error || "").slice(0, 120);
  return lbLastError;
}

/* --------------------------------------------------------------- the seed */

function lbClampInt(v, lo, hi) {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  if (!isFinite(n)) return lo;
  const i = Math.round(n);
  if (i < lo) return lo;
  if (i > hi) return hi;
  return i;
}

/* YYYYMMDD, the shape dayKey() produces */
function lbValidDay(day) {
  const n = typeof day === "number" ? day : parseInt(day, 10);
  if (!isFinite(n) || Math.round(n) !== n) return false;
  if (n < 19700101 || n > 99991231) return false;
  const m = Math.floor(n / 100) % 100;
  const d = n % 100;
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function lbToday(date) {
  if (typeof dayKey === "function") return dayKey(date);
  const d = date || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/* The seed IS the day key - daily.js feeds it straight to seededRng, so
   sharing the key is sharing the fight. Nothing derived, nothing secret. */
function lbSeed(day) {
  return lbValidDay(day) ? Math.round(Number(day)) : 0;
}

function lbPad2(n) {
  const s = String(lbClampInt(n, 0, 99));
  return s.length < 2 ? "0" + s : s;
}

function lbDateLabel(day) {
  if (!lbValidDay(day)) return "";
  const n = Math.round(Number(day));
  return Math.floor(n / 10000) + "-" + lbPad2(Math.floor(n / 100) % 100) + "-" + lbPad2(n % 100);
}

function lbSeedLabel(day) {
  const seed = lbSeed(day);
  return seed ? LB_SHARE_TAG + "-" + seed : "";
}

/* Plain ASCII, no name, no account, nothing that identifies anybody. */
function lbShareLine(day, score, placement) {
  if (!lbValidDay(day)) return "";
  const parts = [LB_SHARE_TAG + " DAILY " + lbDateLabel(day)];
  parts.push("SEED " + lbSeedLabel(day));
  parts.push(lbClampInt(score, 0, LB_SCORE_MAX) + " PTS");
  const p = placement && typeof placement === "object" ? placement : null;
  const rank = p ? lbClampInt(p.rank, 0, 999999) : 0;
  if (rank > 0) {
    const total = p && p.total > 0 ? lbClampInt(p.total, rank, 999999) : 0;
    parts.push((p && p.outside ? "RANK " + rank + "+" : "RANK " + rank) + (total ? " OF " + total : ""));
  }
  return parts.join(" / ");
}

/* ------------------------------------------------------------- the payload */

function lbSanitizeName(raw) {
  let n = "";
  if (typeof sanitizeFighterName === "function") {
    try {
      n = sanitizeFighterName(raw);
    } catch (e) {
      n = "";
    }
  }
  if (!n) {
    n = String(raw == null ? "" : raw)
      .replace(/[^A-Za-z0-9 .'-]/g, "")
      .trim()
      .slice(0, LB_NAME_MAX)
      .toUpperCase();
  }
  return n ? n.slice(0, LB_NAME_MAX) : LB_NAME_FALLBACK;
}

/* Read-only. This never touches save.daily, the streak or anything else. */
function lbNameFromSave(save) {
  return lbSanitizeName(save && typeof save === "object" ? save.name : "");
}

function lbFighterId(fid) {
  let hi = LB_FIGHTER_MAX;
  if (typeof FIGHTERS !== "undefined" && FIGHTERS && FIGHTERS.length) hi = FIGHTERS.length - 1;
  return lbClampInt(fid, 0, hi);
}

/* Exactly four fields leave this machine. */
function lbBuildEntry(day, score, fighter, name) {
  if (!lbValidDay(day)) return null;
  return {
    day: Math.round(Number(day)),
    score: lbClampInt(score, 0, LB_SCORE_MAX),
    fighter: lbFighterId(fighter),
    name: lbSanitizeName(name),
  };
}

function lbEntryFromSave(save, day, score, fighter) {
  return lbBuildEntry(day, score, fighter, lbNameFromSave(save));
}

/* ---------------------------------------------------------------- writing */

async function lbSubmitScore(entry, localStorageLike, fetchImpl) {
  const clean = entry && typeof entry === "object"
    ? lbBuildEntry(entry.day, entry.score, entry.fighter, entry.name)
    : null;
  if (!clean) return { ok: false, skipped: true, reason: "invalid entry" };
  if (!lbConfigured()) return { ok: false, skipped: true, reason: "not configured" };
  const session = lbSession(localStorageLike);
  if (!session) return { ok: false, skipped: true, reason: "not signed in" };
  const f = lbFetchImpl(fetchImpl);
  if (!f) return { ok: false, skipped: true, reason: "fetch unavailable" };

  lbBusy = true;
  lbLastError = "";
  try {
    const res = await lbRace(
      f(lbEndpoint("on_conflict=user_id,day"), {
        method: "POST",
        headers: lbHeaders(session.access_token, {
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(clean),
      }),
      LB_TIMEOUT_MS
    );
    if (!res || res.lbTimedOut) return { ok: false, error: lbFail("leaderboard timeout") };
    if (!res.ok) {
      const body = await lbJson(res);
      return { ok: false, error: lbFail(lbErr(body, "submit failed")) };
    }
    lbCacheClear(clean.day);
    return { ok: true, entry: clean };
  } catch (e) {
    return { ok: false, error: lbFail("submit network error") };
  } finally {
    lbBusy = false;
  }
}

/* What the results screen calls. Builds the payload from the save's display
   name, submits, and swallows everything - a dead board never blocks a win. */
function lbSubmitDaily(save, day, score, fighter, localStorageLike, fetchImpl) {
  const entry = lbEntryFromSave(save, day, score, fighter);
  if (!entry) return Promise.resolve({ ok: false, skipped: true, reason: "invalid entry" });
  return lbSubmitScore(entry, localStorageLike, fetchImpl).catch(function () {
    return { ok: false, error: lbFail("submit network error") };
  });
}

/* ---------------------------------------------------------------- reading */

function lbNormalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const score = lbClampInt(raw.score, 0, LB_SCORE_MAX);
  return {
    name: lbSanitizeName(raw.name),
    score: score,
    fighter: lbFighterId(raw.fighter),
  };
}

/* Highest score first, name as the tiebreak so two clients agree. */
function lbSortRows(rows) {
  const out = (Array.isArray(rows) ? rows : []).map(lbNormalizeRow).filter(function (r) {
    return !!r;
  });
  out.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  let rank = 0;
  let prev = null;
  for (let i = 0; i < out.length; i++) {
    if (prev === null || out[i].score !== prev) rank = i + 1;   /* ties share a rank */
    prev = out[i].score;
    out[i].rank = rank;
  }
  return out;
}

/* Where a score sits in a board we already hold. Pure. */
function lbPlacement(rows, score) {
  const list = lbSortRows(rows);
  const s = lbClampInt(score, 0, LB_SCORE_MAX);
  let above = 0;
  for (let i = 0; i < list.length; i++) if (list[i].score > s) above++;
  const mine = list.some(function (r) {
    return r.score === s;
  });
  return {
    rank: above + 1,
    total: list.length + (mine ? 0 : 1),
    outside: list.length > 0 && s < list[list.length - 1].score,
  };
}

async function lbFetchTop(day, limit, localStorageLike, fetchImpl) {
  const n = lbClampInt(limit === undefined ? LB_TOP_N : limit, 1, LB_TOP_MAX);
  if (!lbValidDay(day)) return { ok: false, skipped: true, reason: "invalid day", rows: [] };
  if (!lbConfigured()) return { ok: true, skipped: true, reason: "not configured", rows: [] };
  const f = lbFetchImpl(fetchImpl);
  if (!f) return { ok: true, skipped: true, reason: "fetch unavailable", rows: [] };
  const session = lbSession(localStorageLike);   /* optional - the board reads anonymously */

  lbBusy = true;
  lbLastError = "";
  try {
    const query =
      "select=name,score,fighter&day=eq." +
      encodeURIComponent(Math.round(Number(day))) +
      "&order=score.desc&limit=" +
      n;
    const res = await lbRace(
      f(lbEndpoint(query), {
        method: "GET",
        headers: lbHeaders(session ? session.access_token : null),
      }),
      LB_TIMEOUT_MS
    );
    if (!res || res.lbTimedOut) return { ok: false, error: lbFail("leaderboard timeout"), rows: [] };
    const body = await lbJson(res);
    if (!res.ok) return { ok: false, error: lbFail(lbErr(body, "board fetch failed")), rows: [] };
    const rows = lbSortRows(Array.isArray(body) ? body : []);
    lbCachePut(day, rows);
    return { ok: true, rows: rows, limit: n, full: rows.length >= n };
  } catch (e) {
    return { ok: false, error: lbFail("board network error"), rows: [] };
  } finally {
    lbBusy = false;
  }
}

/* The local player's placement for today. Derived from the board we can see,
   so a truncated board reports rank as a lower bound (`outside`) and refuses
   to invent a total. Unknown is 0, never a flattering guess. */
async function lbFetchPlacement(day, score, localStorageLike, fetchImpl) {
  const got = await lbFetchTop(day, LB_TOP_MAX, localStorageLike, fetchImpl);
  const known = !!got.ok && !got.skipped;
  const place = known ? lbPlacement(got.rows, score) : { rank: 0, total: 0, outside: false };
  if (known && got.full) {
    place.outside = true;
    place.total = 0;                 /* the board was cut off - we do not know */
  }
  return {
    ok: !!got.ok,
    skipped: !!got.skipped,
    reason: got.reason,
    error: got.error,
    rows: got.rows,
    rank: place.rank,
    total: place.total,
    outside: place.outside,
  };
}

/* ------------------------------------------------------------- the cache */

function lbCacheGet(day, maxAgeMs) {
  if (!lbValidDay(day)) return null;
  const hit = lbCache[Math.round(Number(day))];
  if (!hit) return null;
  const age = maxAgeMs === undefined ? LB_CACHE_MS : maxAgeMs;
  if (age >= 0 && Date.now() - hit.at > age) return null;
  return hit.rows;
}

function lbCachePut(day, rows) {
  if (!lbValidDay(day)) return;
  lbCache[Math.round(Number(day))] = { rows: lbSortRows(rows), at: Date.now() };
}

function lbCacheClear(day) {
  if (day === undefined) {
    lbCache = {};
    lbInflight = {};
    return;
  }
  if (!lbValidDay(day)) return;
  delete lbCache[Math.round(Number(day))];
  delete lbInflight[Math.round(Number(day))];
}

/* Synchronous and network-free: safe to call from step() every frame. */
function lbBoardNow(day) {
  const rows = lbCacheGet(day, -1);
  return rows ? rows.slice() : [];
}

/* Fire-and-forget refresh. Deduped per day, never throws, never returns a
   rejected promise, so a scene can call it on entry and forget about it. */
function lbRefreshBoard(day, limit, localStorageLike, fetchImpl) {
  if (!lbValidDay(day)) return Promise.resolve({ ok: false, skipped: true, reason: "invalid day", rows: [] });
  const key = Math.round(Number(day));
  if (lbInflight[key]) return lbInflight[key];
  const p = lbFetchTop(day, limit, localStorageLike, fetchImpl)
    .catch(function () {
      return { ok: false, error: lbFail("board network error"), rows: [] };
    })
    .then(function (r) {
      delete lbInflight[key];
      return r;
    });
  lbInflight[key] = p;
  return p;
}

/* --------------------------------------------------------------- readouts */

function lbStatusLabel(localStorageLike) {
  if (!lbConfigured()) return "OFF";
  if (lbBusy) return "...";
  return lbSession(localStorageLike) ? "ON" : "READ ONLY";
}

function lbLastErrorText() {
  return lbLastError;
}
