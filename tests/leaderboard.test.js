/* =====================================================================
   The daily leaderboard: submit today's score, read today's top N, find
   your placement, and share the day's seed.

   The daily gauntlet was already deterministic from the date, so these
   tests care most about the two things that could ruin it: a board that
   blocks or breaks the game when there is no server (the normal case),
   and a payload that carries more than it should. Mocked fetch only -
   no live network.
   ===================================================================== */
"use strict";
module.exports = function (h) {
  const { api, ok, section } = h;
  const A = api;

  /* The module's names may or may not be listed in the harness EXPORTS yet;
     reach into the page's scope either way so this suite does not depend on
     that edit. */
  const fn = (name) =>
    A[name] !== undefined ? A[name] : A.exec('typeof ' + name + ' !== "undefined" ? ' + name + " : undefined");
  const live = (expr) => A.exec(expr);

  const lbConfigured = fn("lbConfigured");
  const lbSeed = fn("lbSeed");
  const lbSeedLabel = fn("lbSeedLabel");
  const lbDateLabel = fn("lbDateLabel");
  const lbShareLine = fn("lbShareLine");
  const lbToday = fn("lbToday");
  const lbBuildEntry = fn("lbBuildEntry");
  const lbEntryFromSave = fn("lbEntryFromSave");
  const lbSanitizeName = fn("lbSanitizeName");
  const lbSortRows = fn("lbSortRows");
  const lbPlacement = fn("lbPlacement");
  const lbSubmitScore = fn("lbSubmitScore");
  const lbSubmitDaily = fn("lbSubmitDaily");
  const lbFetchTop = fn("lbFetchTop");
  const lbFetchPlacement = fn("lbFetchPlacement");
  const lbRefreshBoard = fn("lbRefreshBoard");
  const lbBoardNow = fn("lbBoardNow");
  const lbCacheGet = fn("lbCacheGet");
  const lbCachePut = fn("lbCachePut");
  const lbCacheClear = fn("lbCacheClear");
  const lbStatusLabel = fn("lbStatusLabel");
  const lbLastErrorText = fn("lbLastErrorText");
  const lbRace = fn("lbRace");

  const DAY = 20260817;
  const store = () => ({
    _d: {},
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null;
    },
    setItem(k, v) {
      this._d[k] = String(v);
    },
    removeItem(k) {
      delete this._d[k];
    },
  });
  const signedIn = () => {
    const s = store();
    A.cloudWriteSession(s, {
      access_token: "tok-1",
      refresh_token: "ref-1",
      user_id: "44444444-4444-4444-4444-444444444444",
      email: "fighter@example.com",
      expires_at: 9999999999,
    });
    return s;
  };

  section("the module is wired into the page");
  ok(typeof lbConfigured === "function", "lbConfigured is in scope");
  ok(typeof lbFetchTop === "function", "lbFetchTop is in scope");
  ok(typeof lbSubmitScore === "function", "lbSubmitScore is in scope");
  ok(typeof lbFetchPlacement === "function", "lbFetchPlacement is in scope");
  ok(typeof lbSeedLabel === "function", "lbSeedLabel is in scope");
  ok(live("typeof LB_TOP_N") === "number" && live("LB_TOP_N") > 0, "a default board size exists", live("LB_TOP_N"));
  ok(live("LB_TOP_MAX") >= live("LB_TOP_N"), "and a hard ceiling on what we ask for", live("LB_TOP_MAX"));
  ok(live("LB_TIMEOUT_MS") > 0, "a request budget so a dead host cannot hang a scene", live("LB_TIMEOUT_MS"));

  section("the day's seed is the daily's seed, and it is shareable");
  {
    ok(lbSeed(DAY) === DAY, "the seed is the day key itself", lbSeed(DAY));
    const viaSeed = A.dailySetup(lbSeed(DAY), 25);
    const viaKey = A.dailySetup(DAY, 25);
    ok(JSON.stringify(viaSeed) === JSON.stringify(viaKey),
       "so sharing the seed shares the exact fight", JSON.stringify(viaKey));
    ok(lbSeed(A.dayKey(new Date(2026, 7, 17))) === DAY, "and it agrees with dayKey()", lbSeed(A.dayKey(new Date(2026, 7, 17))));
    ok(lbToday(new Date(2026, 7, 17)) === DAY, "today is the local calendar day", lbToday(new Date(2026, 7, 17)));
    ok(lbSeed("../etc") === 0 && lbSeed(7) === 0 && lbSeed(null) === 0, "junk is not a seed");
    ok(lbDateLabel(20260807) === "2026-08-07", "the date reads back padded", lbDateLabel(20260807));
    ok(lbSeedLabel(DAY) === "AZHA-" + DAY, "the seed label is tagged", lbSeedLabel(DAY));
  }
  {
    const line = lbShareLine(DAY, 1284, { rank: 4, total: 12 });
    ok(/AZHA DAILY 2026-08-17/.test(line), "the share line names the day", line);
    ok(/SEED AZHA-20260817/.test(line), "and carries the seed", line);
    ok(/1284 PTS/.test(line) && /RANK 4 OF 12/.test(line), "and the score and placement", line);
    ok(!/[^\x00-\x7F]/.test(line), "it is ASCII, like everything else here");
    ok(line.indexOf("@") < 0 && !/fighter@example/.test(line), "and it carries no address");
    ok(lbShareLine(DAY, 900, null).indexOf("RANK") < 0, "no placement is claimed when none is known",
       lbShareLine(DAY, 900, null));
    ok(/RANK 51\+/.test(lbShareLine(DAY, 10, { rank: 51, outside: true })),
       "a rank off the end of the board is marked a floor", lbShareLine(DAY, 10, { rank: 51, outside: true }));
    ok(lbShareLine(0, 10, null) === "", "and a junk day shares nothing");
  }

  section("nothing but score, day, fighter and a display name leaves the machine");
  {
    const e = lbBuildEntry(DAY, 1284.6, 999, "  aqua<script>zero  ");
    ok(JSON.stringify(Object.keys(e).sort()) === '["day","fighter","name","score"]',
       "the entry has exactly four fields", Object.keys(e).join(","));
    ok(e.day === DAY, "the day key rides along", e.day);
    ok(e.score === 1285, "the score is a whole number", e.score);
    ok(e.fighter >= 0 && e.fighter < A.FIGHTERS.length, "the fighter id is clamped to the roster", e.fighter);
    ok(e.name === "AQUASCRIPTZERO", "the name is sanitised like SAVE.name", e.name);
    ok(lbBuildEntry(DAY, -50, 0, "X").score === 0, "a loss submits zero, never a negative");
    ok(lbBuildEntry(DAY, 1e12, 0, "X").score === live("LB_SCORE_MAX"), "and an impossible score is capped");
    ok(lbBuildEntry(DAY, 0, 0, "").name === "CHALLENGER", "an unnamed player gets a placeholder, not an empty row");
    ok(lbBuildEntry(0, 10, 0, "X") === null, "an invalid day builds no entry at all");
    ok(lbSanitizeName("<img src=x>") === "IMG SRCX", "markup cannot survive the name field", lbSanitizeName("<img src=x>"));
    ok(lbSanitizeName("ABCDEFGHIJKLMNOPQRSTUVWXYZ").length <= 16, "and it is length-capped",
       lbSanitizeName("ABCDEFGHIJKLMNOPQRSTUVWXYZ").length);
  }
  {
    A.exec("SAVE=DEF_SAVE(); SAVE.name='Kai'; SAVE.mastery={3:640}; persist();");
    const S = A.getSave();
    const e = lbEntryFromSave(S, DAY, 700, 3);
    ok(JSON.stringify(Object.keys(e).sort()) === '["day","fighter","name","score"]',
       "building from the save still yields four fields", Object.keys(e).join(","));
    ok(e.name === "KAI", "the save contributes its display name", e.name);
    const blob = JSON.stringify(e);
    ok(blob.indexOf("mastery") < 0 && blob.indexOf("unlocked") < 0 && blob.indexOf("run") < 0,
       "and nothing else from the save", blob);
  }

  section("with no Supabase config the board is a quiet no-op");
  {
    A.exec('CLOUD_CONFIG={url:"",anonKey:""};');
    lbCacheClear();
    ok(lbConfigured() === false, "unconfigured");
    ok(lbStatusLabel(store()) === "OFF", "the status line says OFF, not an error", lbStatusLabel(store()));
    ok(Array.isArray(lbBoardNow(DAY)) && lbBoardNow(DAY).length === 0, "the board reads as empty, never null");
    ok(lbBoardNow(0).length === 0, "even for a junk day");
  }

  section("offline and unconfigured are the normal case");
  const boom = async () => {
    throw new Error("offline");
  };
  const http500 = async () => ({ ok: false, status: 500, json: async () => ({ message: "boom" }) });

  let lastUrl = "";
  let lastOpts = null;
  let lastBody = null;
  const board = [
    { name: "AY", score: 1400, fighter: 2 },
    { name: "BEE", score: 900, fighter: 5 },
    { name: "CEE", score: 900, fighter: 7 },
  ];
  const fetchMock = async (url, opts) => {
    lastUrl = String(url);
    lastOpts = opts || null;
    lastBody = opts && opts.body ? JSON.parse(opts.body) : null;
    if (opts && opts.method === "GET") return { ok: true, status: 200, json: async () => board };
    if (opts && opts.method === "POST") return { ok: true, status: 201, json: async () => ({}) };
    return { ok: false, status: 405, json: async () => ({ message: "unexpected " + url }) };
  };

  return (async () => {
    /* --- unconfigured --- */
    const offTop = await lbFetchTop(DAY, 10, store(), fetchMock);
    ok(offTop.ok === true && offTop.skipped === true, "an unconfigured fetch is skipped, not failed",
       JSON.stringify(offTop));
    ok(Array.isArray(offTop.rows) && offTop.rows.length === 0, "and rows is still an array a scene can render");
    const offSub = await lbSubmitScore({ day: DAY, score: 900, fighter: 1, name: "KAI" }, signedIn(), fetchMock);
    ok(offSub.ok === false && offSub.skipped === true && offSub.reason === "not configured",
       "an unconfigured submit is skipped with a reason", JSON.stringify(offSub));
    const offPlace = await lbFetchPlacement(DAY, 900, store(), fetchMock);
    ok(offPlace.skipped === true && offPlace.rank === 0 && offPlace.total === 0,
       "and placement is honestly unknown, not a flattering number one", JSON.stringify(offPlace));
    const offRefresh = await lbRefreshBoard(DAY, 10, store(), fetchMock);
    ok(offRefresh && Array.isArray(offRefresh.rows), "refresh always resolves with a shaped result");
    ok(lastUrl === "", "and no request was made at all", lastUrl || "none");

    /* --- configured, but nothing answering --- */
    A.exec('CLOUD_CONFIG={url:"https://example.supabase.co",anonKey:"anon-test"};');
    lbCacheClear();
    ok(lbConfigured() === true, "configured once keys are embedded");
    ok(lbStatusLabel(store()) === "READ ONLY", "signed out, the board is readable but not writable",
       lbStatusLabel(store()));
    ok(lbStatusLabel(signedIn()) === "ON", "signed in, it is both", lbStatusLabel(signedIn()));

    const noFetch = await lbFetchTop(DAY, 10, store(), null);
    ok(noFetch.ok === true && noFetch.skipped === true && noFetch.rows.length === 0,
       "no fetch in the environment is a skip, not a throw", JSON.stringify(noFetch));

    const deadTop = await lbFetchTop(DAY, 10, store(), boom);
    ok(deadTop.ok === false && deadTop.rows.length === 0 && !!deadTop.error,
       "a thrown request returns an empty board and a message", JSON.stringify(deadTop));
    const deadSub = await lbSubmitScore({ day: DAY, score: 1, fighter: 0, name: "KAI" }, signedIn(), boom);
    ok(deadSub.ok === false && !!deadSub.error, "a thrown submit reports instead of throwing", JSON.stringify(deadSub));
    const errTop = await lbFetchTop(DAY, 10, store(), http500);
    ok(errTop.ok === false && errTop.error === "boom", "an HTTP error surfaces as text", errTop.error);
    ok(lbLastErrorText() === "boom", "and is remembered for a status line", lbLastErrorText());
    const safe = await lbSubmitDaily(A.getSave(), DAY, 500, 1, signedIn(), boom);
    ok(safe.ok === false && !safe.rejected, "lbSubmitDaily resolves even when the network explodes",
       JSON.stringify(safe));
    ok(typeof lbRace === "function" && (await lbRace(Promise.resolve("v"), 5000)) === "v",
       "a real answer passes through the timeout guard untouched");

    /* --- reading the board --- */
    lbCacheClear();
    const top = await lbFetchTop(DAY, 5, store(), fetchMock);
    ok(top.ok === true && top.rows.length === 3, "the board comes back", JSON.stringify(top.rows.map((r) => r.name)));
    ok(/\/rest\/v1\/daily_scores\?/.test(lastUrl), "from the leaderboard table", lastUrl);
    ok(/day=eq\.20260817/.test(lastUrl), "filtered to the day", lastUrl);
    ok(/order=score\.desc/.test(lastUrl) && /limit=5/.test(lastUrl), "ordered and limited server-side", lastUrl);
    ok(/select=name,score,fighter/.test(lastUrl), "and it asks for three columns, not the row", lastUrl);
    ok(lastOpts.method === "GET", "a read is a GET", lastOpts.method);
    ok(top.rows[0].name === "AY" && top.rows[0].rank === 1, "the leader is ranked first", JSON.stringify(top.rows[0]));
    ok(top.rows[1].rank === 2 && top.rows[2].rank === 2, "and a tie shares a rank",
       top.rows.map((r) => r.rank).join(","));
    const capped = await lbFetchTop(DAY, 100000, store(), fetchMock);
    ok(capped.ok === true && /limit=/.test(lastUrl) && !/limit=100000/.test(lastUrl),
       "an absurd limit is capped before it is sent", lastUrl);

    /* --- the cache keeps a polling scene off the wire --- */
    lbCacheClear();
    lbCachePut(DAY, board);
    ok(lbBoardNow(DAY).length === 3, "a cached board reads synchronously for step()", lbBoardNow(DAY).length);
    ok(lbBoardNow(DAY)[0].rank === 1, "already sorted and ranked");
    ok(lbCacheGet(DAY) !== null, "and it reports fresh");
    lbBoardNow(DAY).push({ name: "SPOOF", score: 99999, fighter: 0 });
    ok(lbBoardNow(DAY).length === 3, "the caller gets a copy, so it cannot corrupt the cache",
       lbBoardNow(DAY).length);
    lbCacheClear(DAY);
    ok(lbBoardNow(DAY).length === 0, "clearing one day empties it");

    let calls = 0;
    const counting = async (u, o) => {
      calls++;
      await null;
      return { ok: true, status: 200, json: async () => board };
    };
    const p1 = lbRefreshBoard(20260818, 5, store(), counting);
    const p2 = lbRefreshBoard(20260818, 5, store(), counting);
    ok(p1 === p2, "two refreshes in one frame share a single request");
    await p1;
    ok(calls === 1, "so a scene polling every frame cannot flood the host", calls);
    ok(lbBoardNow(20260818).length === 3, "and the refresh filled the cache for the renderer");
    ok(live("lbBusy") === false, "the busy flag is always released", live("lbBusy"));

    /* --- placement --- */
    const rows = lbSortRows(board.concat([null, "junk", { name: "DEE", score: 50, fighter: 1 }]));
    ok(rows.length === 4, "junk rows never reach a menu", rows.length);
    ok(lbPlacement(rows, 1400).rank === 1, "matching the best score is first");
    ok(lbPlacement(rows, 950).rank === 2, "a good score slots in above the ties", lbPlacement(rows, 950).rank);
    ok(lbPlacement(rows, 900).rank === 2, "a tie shares the rank rather than losing it", lbPlacement(rows, 900).rank);
    ok(lbPlacement(rows, 10).outside === true, "under the last row is outside the window");
    ok(lbPlacement([], 10).rank === 1, "an empty board leaves you first");

    const place = await lbFetchPlacement(DAY, 950, store(), fetchMock);
    ok(place.ok === true && place.rank === 2, "the player's placement is fetched", place.rank);
    ok(place.total === 4, "counting the player themselves", place.total);
    ok(place.outside === false, "and a score on the board is not flagged outside");
    ok(Array.isArray(place.rows) && place.rows.length === 3, "the board comes back with it, so one call fills a screen");

    /* --- writing --- */
    lastUrl = "";
    lastBody = null;
    const anon = await lbSubmitScore({ day: DAY, score: 1000, fighter: 1, name: "KAI" }, store(), fetchMock);
    ok(anon.ok === false && anon.skipped === true && anon.reason === "not signed in",
       "an unauthenticated submit is skipped", JSON.stringify(anon));
    ok(lastUrl === "", "and never reaches the network", lastUrl || "none");

    const sess = signedIn();
    const sub = await lbSubmitScore({ day: DAY, score: 1000.6, fighter: 1, name: "kai" }, sess, fetchMock);
    ok(sub.ok === true, "a signed-in submit lands", JSON.stringify(sub));
    ok(lastOpts.method === "POST", "as a POST", lastOpts.method);
    ok(JSON.stringify(Object.keys(lastBody).sort()) === '["day","fighter","name","score"]',
       "the body is exactly four fields", Object.keys(lastBody).join(","));
    ok(lastBody.user_id === undefined, "no user id in the body - Postgres fills it from auth.uid()");
    ok(lastBody.score === 1001 && lastBody.name === "KAI" && lastBody.day === DAY,
       "with the values sanitised on the way out", JSON.stringify(lastBody));
    ok(/on_conflict=user_id,day/.test(lastUrl), "the upsert targets one row per player per day", lastUrl);
    ok(/merge-duplicates/.test(lastOpts.headers.Prefer), "so a resubmit replaces rather than piles up",
       lastOpts.headers.Prefer);
    ok(lastOpts.headers.Authorization === "Bearer tok-1", "the session token authorises it");
    const wire = JSON.stringify(lastBody) + JSON.stringify(lastOpts.headers);
    ok(wire.indexOf("fighter@example.com") < 0, "and the account email is nowhere in the request", wire.length);

    /* --- the payload never carries the save, and the streak is not ours --- */
    A.exec("SAVE=DEF_SAVE(); SAVE.name='Kai'; persist(); SAVE.daily=null;");
    A.exec("dailyState(SAVE, " + DAY + "); completeDaily(SAVE, " + DAY + ", 0);");
    const before = JSON.stringify(A.getSave().daily);
    ok(A.getSave().daily.streak === 1, "a loss already counted as showing up", A.getSave().daily.streak);
    const posted = await lbSubmitDaily(A.getSave(), DAY, 0, 4, sess, fetchMock);
    ok(posted.ok === true, "a zero-score day is still submitted - attendance is the point", JSON.stringify(posted));
    ok(lastBody.score === 0, "with an honest zero", lastBody.score);
    ok(JSON.stringify(A.getSave().daily) === before,
       "and the leaderboard never touched the streak", JSON.stringify(A.getSave().daily));
    const body = JSON.stringify(lastBody);
    ok(body.indexOf("streak") < 0 && body.indexOf("mastery") < 0 && body.indexOf("unlocked") < 0,
       "no save contents on the wire", body);
    ok(body.indexOf("access_token") < 0 && body.indexOf("tok-1") < 0, "and no tokens in the body", body);

    /* --- a fresh save with the board on is still a playable game --- */
    A.exec('CLOUD_CONFIG={url:"",anonKey:""};');
    lbCacheClear();
    A.exec("SAVE=DEF_SAVE(); persist(); G.duel=null; G.adv=null; G.scene=S.DAILY;");
    let threw = null;
    try {
      for (let i = 0; i < 400; i++) {
        A.step();
        A.render();
      }
      A.onKey("a");
      A.step();
      A.render();
      const dayNow = lbToday();
      lbBoardNow(dayNow);
      await lbRefreshBoard(dayNow, 10, store(), null);
      await lbSubmitDaily(A.getSave(), dayNow, 1200, 0, store(), null);
      A.exec("G.duel && (G.duel.e.hp=0, endDuel(G.duel));");
      for (let i = 0; i < 200; i++) {
        A.step();
        A.render();
      }
    } catch (e) {
      threw = String((e && e.message) || e);
    }
    ok(!threw, "the daily runs start to finish with an unconfigured board, no exception", threw || "clean");
    ok(A.getSave().daily && A.getSave().daily.done === true, "and the gauntlet still recorded locally",
       JSON.stringify(A.getSave().daily));
    ok(A.getSave().daily.streak >= 1, "with the streak intact", A.getSave().daily.streak);
    A.exec("G.duel=null;");
  })();
};
