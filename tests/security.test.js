/* =====================================================================
   Offline security controls: deep sanitize, import rate limit, security log.
   Targets api_contract in .build/ceo-gates-security.json (G6).
   ===================================================================== */
"use strict";

module.exports = function (h) {
  const { api, ok, section } = h;
  const A = api;
  const ls = {
    getItem: (k) => (A.localStore.has(k) ? A.localStore.get(k) : null),
    setItem: (k, v) => A.localStore.set(k, String(v)),
    removeItem: (k) => A.localStore.delete(k),
  };

  /* Bind contract symbols from the page sandbox even if harness EXPORTS lag. */
  const CONTRACT = [
    "SECURITY_LOG_KEY", "SECURITY_LOG_LIMIT", "appendSecurityEvent", "readSecurityLog",
    "clearSecurityLog", "IMPORT_RATE_WINDOW_MS", "IMPORT_RATE_MAX", "checkImportRateLimit",
    "noteImportAttempt", "sanitizeRun", "sanitizeDaily", "sanitizeRanking",
    "sanitizeSavePayload", "importSaveEnvelope", "exportSaveBlob", "escapeHtml",
  ];
  CONTRACT.forEach((name) => {
    A.exec("__api." + name + "=typeof " + name + "!==\"undefined\"?" + name + ":undefined;");
  });

  function baseSave(extra) {
    const s = {
      v: 4,
      unlocked: [0, 1],
      name: "SECURE",
      defeats: {},
      sound: true,
      music: true,
      diff: 1,
      motion: true,
      mastery: {},
      titles: [],
      title: null,
      daily: null,
      run: null,
      rec: { duels: 0, wins: 0, losses: 0, perfect: 0, stages: 0, bestSurv: 0, ngplus: 0 },
      fr: {},
    };
    if (extra) Object.keys(extra).forEach((k) => { s[k] = extra[k]; });
    return s;
  }

  section("api_contract symbols present");
  {
    ok(typeof A.SECURITY_LOG_KEY === "string" && A.SECURITY_LOG_KEY.length > 0,
       "SECURITY_LOG_KEY is a non-empty string", A.SECURITY_LOG_KEY);
    ok(A.SECURITY_LOG_KEY === "azha_security_log",
       "SECURITY_LOG_KEY matches contract default", A.SECURITY_LOG_KEY);
    ok(typeof A.SECURITY_LOG_LIMIT === "number" && A.SECURITY_LOG_LIMIT === 50,
       "SECURITY_LOG_LIMIT is 50", A.SECURITY_LOG_LIMIT);
    ok(typeof A.IMPORT_RATE_WINDOW_MS === "number" && A.IMPORT_RATE_WINDOW_MS === 60000,
       "IMPORT_RATE_WINDOW_MS is 60000", A.IMPORT_RATE_WINDOW_MS);
    ok(typeof A.IMPORT_RATE_MAX === "number" && A.IMPORT_RATE_MAX === 10,
       "IMPORT_RATE_MAX is 10", A.IMPORT_RATE_MAX);
    ok(typeof A.appendSecurityEvent === "function", "appendSecurityEvent is a function");
    ok(typeof A.readSecurityLog === "function", "readSecurityLog is a function");
    ok(typeof A.clearSecurityLog === "function", "clearSecurityLog is a function");
    ok(typeof A.checkImportRateLimit === "function", "checkImportRateLimit is a function");
    ok(typeof A.noteImportAttempt === "function", "noteImportAttempt is a function");
    ok(typeof A.sanitizeRun === "function", "sanitizeRun is a function");
    ok(typeof A.sanitizeDaily === "function", "sanitizeDaily is a function");
    ok(typeof A.sanitizeRanking === "function", "sanitizeRanking is a function");
    ok(typeof A.sanitizeSavePayload === "function", "sanitizeSavePayload is a function");
    ok(typeof A.importSaveEnvelope === "function", "importSaveEnvelope is a function");
    ok(typeof A.escapeHtml === "function", "escapeHtml is a function");
  }

  const hardenReady =
    typeof A.checkImportRateLimit === "function" &&
    typeof A.appendSecurityEvent === "function" &&
    typeof A.sanitizeRanking === "function";

  section("deep sanitize rejects nested __proto__ in run/daily");
  {
    if (!hardenReady) {
      ok(false, "harden APIs missing; deep sanitize checks deferred");
    } else {
      const withBadRun = A.sanitizeSavePayload(baseSave({
        run: { stage: 1, nested: { "__proto__": { polluted: true } } },
      }));
      ok(withBadRun === null, "sanitizeSavePayload rejects nested __proto__ in run", withBadRun);

      const withBadDaily = A.sanitizeSavePayload(baseSave({
        daily: { day: "2026-08-08", bag: { "__proto__": { x: 1 } } },
      }));
      ok(withBadDaily === null, "sanitizeSavePayload rejects nested __proto__ in daily", withBadDaily);

      const envBadRun = A.importSaveEnvelope(JSON.stringify({
        format: "azha-save",
        v: 1,
        save: baseSave({
          run: { stage: 2, inner: { constructor: { name: "Evil" } } },
        }),
      }));
      ok(envBadRun.ok === false, "importSaveEnvelope rejects nested dangerous key in run", envBadRun.error);

      const envBadDaily = A.importSaveEnvelope(JSON.stringify({
        format: "azha-save",
        v: 1,
        save: baseSave({
          daily: { seed: 1, meta: { prototype: { y: 2 } } },
        }),
      }));
      ok(envBadDaily.ok === false, "importSaveEnvelope rejects nested dangerous key in daily", envBadDaily.error);

      ok(A.sanitizeRun({ a: 1, nested: { "__proto__": {} } }) === null,
         "sanitizeRun rejects nested __proto__");
      ok(A.sanitizeDaily({ a: 1, nested: { "__proto__": {} } }) === null,
         "sanitizeDaily rejects nested __proto__");
    }
  }

  section("ranking roundtrips through sanitizeSavePayload / importSaveEnvelope");
  {
    if (!hardenReady) {
      ok(false, "harden APIs missing; ranking roundtrip checks deferred");
    } else {
      const ranking = {
        players: {
          you: {
            playerId: "you",
            promotionPoints: 12,
            peakRankIndex: 2,
            wins: 3,
            losses: 1,
            totalMatches: 4,
            streak: 2,
          },
        },
        audit: [{ matchId: "m1", at: 1000 }],
      };
      const cleaned = A.sanitizeSavePayload(baseSave({ ranking: ranking }));
      ok(!!cleaned && !!cleaned.ranking, "sanitizeSavePayload keeps ranking", cleaned && cleaned.ranking);
      ok(cleaned && cleaned.ranking && cleaned.ranking.players && cleaned.ranking.players.you,
         "ranking.players.you survives sanitize");
      if (cleaned && cleaned.ranking && cleaned.ranking.players && cleaned.ranking.players.you) {
        ok(cleaned.ranking.players.you.promotionPoints === 12,
           "promotionPoints roundtrip via sanitize", cleaned.ranking.players.you.promotionPoints);
      }

      const blob = A.exportSaveBlob(cleaned || baseSave({ ranking: ranking }));
      const imported = A.importSaveEnvelope(blob);
      ok(imported.ok === true, "importSaveEnvelope accepts ranking-bearing save", imported.error);
      ok(imported.ok && imported.save && imported.save.ranking,
         "imported save retains ranking");
      if (imported.ok && imported.save && imported.save.ranking && imported.save.ranking.players) {
        ok(!!imported.save.ranking.players.you, "imported ranking keeps you player");
      }

      const badRank = A.sanitizeRanking({ players: { "__proto__": { x: 1 } }, audit: [] });
      ok(badRank === null || (badRank && !Object.prototype.hasOwnProperty.call(badRank.players || {}, "__proto__")),
         "sanitizeRanking rejects or strips dangerous player keys");
    }
  }

  section("checkImportRateLimit blocks after IMPORT_RATE_MAX");
  {
    if (!hardenReady) {
      ok(false, "harden APIs missing; import rate limit checks deferred");
    } else {
      const max = A.IMPORT_RATE_MAX;
      const windowMs = A.IMPORT_RATE_WINDOW_MS;
      const t0 = 1_000_000;
      let state = null;
      let allowed = 0;
      let last = null;
      for (let i = 0; i < max; i++) {
        last = A.checkImportRateLimit(state, t0 + i);
        if (last && last.ok) {
          allowed++;
          state = A.noteImportAttempt(last.state != null ? last.state : state, t0 + i);
        } else {
          break;
        }
      }
      ok(allowed === max, "allows IMPORT_RATE_MAX attempts in the window", allowed);
      const blocked = A.checkImportRateLimit(state, t0 + max);
      ok(blocked && blocked.ok === false, "blocks the next attempt in-window", blocked && blocked.ok);
      if (blocked && blocked.ok === false) {
        ok(typeof blocked.retryAfterMs === "number" && blocked.retryAfterMs > 0,
           "blocked response includes retryAfterMs", blocked.retryAfterMs);
      }
      const later = A.checkImportRateLimit(state, t0 + windowMs + 1);
      ok(later && later.ok === true, "allows again after IMPORT_RATE_WINDOW_MS", later && later.ok);
    }
  }

  section("appendSecurityEvent caps at SECURITY_LOG_LIMIT");
  {
    if (!hardenReady) {
      ok(false, "harden APIs missing; security log checks deferred");
    } else {
      const limit = A.SECURITY_LOG_LIMIT;
      A.clearSecurityLog(ls);
      for (let i = 0; i < limit + 12; i++) {
        A.appendSecurityEvent(ls, { kind: "reject", detail: "n" + i, at: 2000 + i });
      }
      const log = A.readSecurityLog(ls);
      ok(!!log && Array.isArray(log.events), "readSecurityLog returns { events: array }");
      ok(log && log.events && log.events.length === limit,
         "security log caps at SECURITY_LOG_LIMIT", log && log.events && log.events.length);
      if (log && log.events && log.events.length) {
        const details = log.events.map((e) => e && e.detail);
        ok(details.indexOf("n" + (limit + 11)) >= 0 || details.some((d) => /n\d+/.test(String(d || ""))),
           "newest events are retained in the ring buffer");
        ok(details.indexOf("n0") < 0,
           "oldest events are dropped past the cap");
      }
      A.clearSecurityLog(ls);
      const cleared = A.readSecurityLog(ls);
      ok(cleared && Array.isArray(cleared.events) && cleared.events.length === 0,
         "clearSecurityLog empties the ring buffer");
    }
  }

  section("escapeHtml still passes");
  {
    A.exec("__api._esc = escapeHtml('<b>&\"\\'');");
    ok(A._esc === "&lt;b&gt;&amp;&quot;&#39;", "escapeHtml encodes markup-sensitive chars", A._esc);
    ok(typeof A.escapeHtml === "function" && A.escapeHtml("a<b>c") === "a&lt;b&gt;c",
       "escapeHtml via api encodes angle brackets");
  }
};
