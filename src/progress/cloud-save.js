/* =====================================================================
   Aqua Zero Heavens Arena - optional cloud saves (Supabase)
   Luminary Digital

   Offline-first: empty CLOUD_CONFIG disables every network path.
   Auth + REST via fetch (no supabase-js). Session lives in localStorage.
   ===================================================================== */
const CLOUD_SESSION_KEY = "azha_cloud_session";
let CLOUD_CONFIG = __CLOUD_CONFIG__;
const CLOUD_PUSH_DEBOUNCE_MS = 800;

let cloudPushTimer = null;
let cloudBusy = false;
let cloudLastError = "";

function cloudConfigured() {
  return !!(
    CLOUD_CONFIG &&
    typeof CLOUD_CONFIG.url === "string" &&
    CLOUD_CONFIG.url &&
    typeof CLOUD_CONFIG.anonKey === "string" &&
    CLOUD_CONFIG.anonKey
  );
}

function cloudBaseUrl() {
  return String(CLOUD_CONFIG.url || "").replace(/\/$/, "");
}

function cloudFetchImpl() {
  if (typeof fetch === "function") return fetch.bind(typeof window !== "undefined" ? window : globalThis);
  return null;
}

function cloudReadSession(localStorageLike) {
  try {
    const raw = localStorageLike.getItem(CLOUD_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    if (typeof o.access_token !== "string" || !o.access_token) return null;
    if (typeof o.user_id !== "string" || !o.user_id) return null;
    return {
      access_token: String(o.access_token).slice(0, 4096),
      refresh_token: typeof o.refresh_token === "string" ? String(o.refresh_token).slice(0, 4096) : "",
      user_id: String(o.user_id).slice(0, 64),
      email: typeof o.email === "string" ? String(o.email).slice(0, 120) : "",
      expires_at: typeof o.expires_at === "number" ? o.expires_at | 0 : 0,
    };
  } catch (e) {
    return null;
  }
}

function cloudWriteSession(localStorageLike, session) {
  if (!session || typeof session !== "object") {
    try {
      localStorageLike.removeItem(CLOUD_SESSION_KEY);
    } catch (e) {}
    return;
  }
  localStorageLike.setItem(
    CLOUD_SESSION_KEY,
    JSON.stringify({
      access_token: String(session.access_token || "").slice(0, 4096),
      refresh_token: String(session.refresh_token || "").slice(0, 4096),
      user_id: String(session.user_id || "").slice(0, 64),
      email: String(session.email || "").slice(0, 120),
      expires_at: session.expires_at | 0,
    })
  );
}

function cloudClearSession(localStorageLike) {
  cloudWriteSession(localStorageLike, null);
}

function cloudSessionFromAuthPayload(data) {
  if (!data || typeof data !== "object") return null;
  const user = data.user || {};
  const access = data.access_token || (data.session && data.session.access_token);
  const refresh = data.refresh_token || (data.session && data.session.refresh_token) || "";
  const uid = user.id || (data.session && data.session.user && data.session.user.id);
  if (!access || !uid) return null;
  const email = user.email || (data.session && data.session.user && data.session.user.email) || "";
  const expiresIn = data.expires_in || (data.session && data.session.expires_in) || 3600;
  return {
    access_token: String(access),
    refresh_token: String(refresh || ""),
    user_id: String(uid),
    email: String(email || ""),
    expires_at: ((Date.now() / 1000) | 0) + (expiresIn | 0),
  };
}

function cloudAuthHeaders(extraBearer) {
  const key = CLOUD_CONFIG.anonKey;
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
  };
  headers.Authorization = "Bearer " + (extraBearer || key);
  return headers;
}

async function cloudParseJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

function cloudErrMessage(body, fallback) {
  if (!body || typeof body !== "object") return fallback;
  if (typeof body.msg === "string" && body.msg) return body.msg.slice(0, 120);
  if (typeof body.error_description === "string" && body.error_description) {
    return body.error_description.slice(0, 120);
  }
  if (typeof body.message === "string" && body.message) return body.message.slice(0, 120);
  if (typeof body.error === "string" && body.error) return body.error.slice(0, 120);
  return fallback;
}

async function cloudSignUp(email, password, localStorageLike, fetchImpl) {
  if (!cloudConfigured()) return { ok: false, error: "cloud not configured" };
  const f = fetchImpl || cloudFetchImpl();
  if (!f) return { ok: false, error: "fetch unavailable" };
  const em = String(email || "").trim().slice(0, 120);
  const pw = String(password || "");
  if (!em || pw.length < 6) return { ok: false, error: "email and password (6+) required" };
  cloudBusy = true;
  cloudLastError = "";
  try {
    const res = await f(cloudBaseUrl() + "/auth/v1/signup", {
      method: "POST",
      headers: cloudAuthHeaders(),
      body: JSON.stringify({ email: em, password: pw }),
    });
    const body = await cloudParseJson(res);
    if (!res.ok) {
      const err = cloudErrMessage(body, "sign up failed");
      cloudLastError = err;
      return { ok: false, error: err };
    }
    const session = cloudSessionFromAuthPayload(body);
    if (session) cloudWriteSession(localStorageLike, session);
    /* Email confirmation may leave no session until the user verifies. */
    return { ok: true, session: session, needsConfirm: !session };
  } catch (e) {
    const err = "sign up network error";
    cloudLastError = err;
    return { ok: false, error: err };
  } finally {
    cloudBusy = false;
  }
}

async function cloudSignIn(email, password, localStorageLike, fetchImpl) {
  if (!cloudConfigured()) return { ok: false, error: "cloud not configured" };
  const f = fetchImpl || cloudFetchImpl();
  if (!f) return { ok: false, error: "fetch unavailable" };
  const em = String(email || "").trim().slice(0, 120);
  const pw = String(password || "");
  if (!em || !pw) return { ok: false, error: "email and password required" };
  cloudBusy = true;
  cloudLastError = "";
  try {
    const res = await f(cloudBaseUrl() + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: cloudAuthHeaders(),
      body: JSON.stringify({ email: em, password: pw }),
    });
    const body = await cloudParseJson(res);
    if (!res.ok) {
      const err = cloudErrMessage(body, "sign in failed");
      cloudLastError = err;
      return { ok: false, error: err };
    }
    const session = cloudSessionFromAuthPayload(body);
    if (!session) {
      cloudLastError = "no session";
      return { ok: false, error: "no session" };
    }
    cloudWriteSession(localStorageLike, session);
    return { ok: true, session: session };
  } catch (e) {
    const err = "sign in network error";
    cloudLastError = err;
    return { ok: false, error: err };
  } finally {
    cloudBusy = false;
  }
}

async function cloudSignOut(localStorageLike, fetchImpl) {
  const session = cloudReadSession(localStorageLike);
  const f = fetchImpl || cloudFetchImpl();
  if (cloudConfigured() && session && f) {
    try {
      await f(cloudBaseUrl() + "/auth/v1/logout", {
        method: "POST",
        headers: cloudAuthHeaders(session.access_token),
      });
    } catch (e) {}
  }
  cloudClearSession(localStorageLike);
  return { ok: true };
}

async function cloudPullSave(localStorageLike, fetchImpl) {
  if (!cloudConfigured()) return { ok: false, error: "cloud not configured" };
  const session = cloudReadSession(localStorageLike);
  if (!session) return { ok: false, error: "not signed in" };
  const f = fetchImpl || cloudFetchImpl();
  if (!f) return { ok: false, error: "fetch unavailable" };
  cloudBusy = true;
  cloudLastError = "";
  try {
    const url =
      cloudBaseUrl() +
      "/rest/v1/cloud_saves?select=save,rev,updated_at&user_id=eq." +
      encodeURIComponent(session.user_id);
    const res = await f(url, {
      method: "GET",
      headers: Object.assign(cloudAuthHeaders(session.access_token), {
        Accept: "application/json",
      }),
    });
    const body = await cloudParseJson(res);
    if (!res.ok) {
      const err = cloudErrMessage(body, "pull failed");
      cloudLastError = err;
      return { ok: false, error: err };
    }
    if (!Array.isArray(body) || !body.length) return { ok: true, empty: true, row: null };
    const row = body[0];
    const cleaned = typeof sanitizeSavePayload === "function" ? sanitizeSavePayload(row.save) : row.save;
    if (!cleaned) return { ok: false, error: "invalid cloud save" };
    return {
      ok: true,
      empty: false,
      row: {
        save: cleaned,
        rev: row.rev | 0,
        updated_at: row.updated_at || null,
      },
    };
  } catch (e) {
    const err = "pull network error";
    cloudLastError = err;
    return { ok: false, error: err };
  } finally {
    cloudBusy = false;
  }
}

async function cloudPushSave(save, rev, localStorageLike, fetchImpl) {
  if (!cloudConfigured()) return { ok: false, error: "cloud not configured" };
  const session = cloudReadSession(localStorageLike);
  if (!session) return { ok: false, error: "not signed in" };
  const f = fetchImpl || cloudFetchImpl();
  if (!f) return { ok: false, error: "fetch unavailable" };
  const cleaned = typeof sanitizeSavePayload === "function" ? sanitizeSavePayload(save) : save;
  if (!cleaned) return { ok: false, error: "invalid save payload" };
  cloudBusy = true;
  cloudLastError = "";
  try {
    const res = await f(cloudBaseUrl() + "/rest/v1/cloud_saves", {
      method: "POST",
      headers: Object.assign(cloudAuthHeaders(session.access_token), {
        Prefer: "resolution=merge-duplicates,return=representation",
        Accept: "application/json",
      }),
      body: JSON.stringify({
        user_id: session.user_id,
        save: cleaned,
        rev: rev | 0,
        updated_at: new Date().toISOString(),
      }),
    });
    const body = await cloudParseJson(res);
    if (!res.ok) {
      const err = cloudErrMessage(body, "push failed");
      cloudLastError = err;
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    const err = "push network error";
    cloudLastError = err;
    return { ok: false, error: err };
  } finally {
    cloudBusy = false;
  }
}

/* Higher rev wins. Equal rev prefers remote when both exist. */
function cloudResolveConflict(localRev, remoteRev, localSave, remoteSave) {
  const lr = localRev | 0;
  const rr = remoteRev | 0;
  if (rr > lr) return { winner: "remote", save: remoteSave, rev: rr };
  if (lr > rr) return { winner: "local", save: localSave, rev: lr };
  return { winner: "remote", save: remoteSave || localSave, rev: rr };
}

function cloudSchedulePush(save, rev, localStorageLike, fetchImpl) {
  if (!cloudConfigured()) return;
  if (!cloudReadSession(localStorageLike || (typeof localStorage !== "undefined" ? localStorage : null))) {
    return;
  }
  if (cloudPushTimer) {
    try {
      clearTimeout(cloudPushTimer);
    } catch (e) {}
  }
  const store = localStorageLike || localStorage;
  const s = save;
  const r = rev | 0;
  cloudPushTimer = setTimeout(function () {
    cloudPushTimer = null;
    cloudPushSave(s, r, store, fetchImpl).catch(function () {});
  }, CLOUD_PUSH_DEBOUNCE_MS);
}

function cloudStatusLabel(localStorageLike) {
  if (!cloudConfigured()) return "OFF";
  if (cloudBusy) return "...";
  const session = cloudReadSession(localStorageLike || localStorage);
  if (!session) return "SIGNED OUT";
  const mail = session.email || "ON";
  return mail.length > 18 ? mail.slice(0, 16) + ".." : mail;
}
