/* Cloud auth/sync helpers - mocked fetch; no live network. */
module.exports = function (h) {
  const { api, ok, section } = h;

  section("cloud config and session");
  ok(typeof api.cloudConfigured === "function", "cloudConfigured exported");
  ok(typeof api.cloudResolveConflict === "function", "cloudResolveConflict exported");

  const store = {
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
  };

  api.cloudWriteSession(store, {
    access_token: "tok",
    refresh_token: "ref",
    user_id: "11111111-1111-1111-1111-111111111111",
    email: "fighter@example.com",
    expires_at: 9999999999,
  });
  const sess = api.cloudReadSession(store);
  ok(sess && sess.access_token === "tok", "session roundtrips");
  ok(sess.email === "fighter@example.com", "session keeps email");
  api.cloudClearSession(store);
  ok(api.cloudReadSession(store) === null, "clear removes session");

  section("conflict resolution");
  const local = { v: 4, name: "LOCAL", unlocked: [0], defeats: {}, sound: true, music: true, diff: 1, motion: true, mastery: {}, titles: [], title: null, daily: null, run: null, rec: {}, fr: {} };
  const remote = { v: 4, name: "REMOTE", unlocked: [0], defeats: {}, sound: true, music: true, diff: 1, motion: true, mastery: {}, titles: [], title: null, daily: null, run: null, rec: {}, fr: {} };
  ok(api.cloudResolveConflict(1, 2, local, remote).winner === "remote", "higher remote rev wins");
  ok(api.cloudResolveConflict(5, 2, local, remote).winner === "local", "higher local rev wins");
  ok(api.cloudResolveConflict(3, 3, local, remote).winner === "remote", "tie prefers remote");

  section("sign in / push / pull with mock fetch");
  /* Force configured for this suite if build had empty keys. */
  api.exec(
    'CLOUD_CONFIG={url:"https://example.supabase.co",anonKey:"anon-test"};'
  );
  ok(api.cloudConfigured() === true, "configured after override");

  let lastUrl = "";
  let lastBody = null;
  const fetchMock = async (url, opts) => {
    lastUrl = String(url);
    lastBody = opts && opts.body ? JSON.parse(opts.body) : null;
    if (/\/auth\/v1\/token/.test(url)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-1",
          refresh_token: "refresh-1",
          expires_in: 3600,
          user: { id: "22222222-2222-2222-2222-222222222222", email: "a@b.co" },
        }),
      };
    }
    if (/\/auth\/v1\/signup/.test(url)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-2",
          refresh_token: "refresh-2",
          expires_in: 3600,
          user: { id: "33333333-3333-3333-3333-333333333333", email: "c@d.co" },
        }),
      };
    }
    if (/\/rest\/v1\/cloud_saves/.test(url) && opts && opts.method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            save: local,
            rev: 4,
            updated_at: "2026-08-08T00:00:00Z",
          },
        ],
      };
    }
    if (/\/rest\/v1\/cloud_saves/.test(url) && opts && opts.method === "POST") {
      return { ok: true, status: 201, json: async () => [lastBody] };
    }
    if (/\/auth\/v1\/logout/.test(url)) {
      return { ok: true, status: 204, json: async () => ({}) };
    }
    return { ok: false, status: 500, json: async () => ({ message: "unexpected " + url }) };
  };

  return (async () => {
    const up = await api.cloudSignUp("c@d.co", "secret12", store, fetchMock);
    ok(up.ok === true, "sign up ok");
    ok(api.cloudReadSession(store) && api.cloudReadSession(store).email === "c@d.co", "sign up stores session");

    api.cloudClearSession(store);
    const inn = await api.cloudSignIn("a@b.co", "secret12", store, fetchMock);
    ok(inn.ok === true, "sign in ok");
    ok(/grant_type=password/.test(lastUrl), "password grant used");

    const pulled = await api.cloudPullSave(store, fetchMock);
    ok(pulled.ok && pulled.row && pulled.row.rev === 4, "pull returns row");
    ok(pulled.row.save.name === "LOCAL", "pull keeps save name");

    const pushed = await api.cloudPushSave(remote, 7, store, fetchMock);
    ok(pushed.ok === true, "push ok");
    ok(lastBody && lastBody.rev === 7, "push sends rev");
    ok(lastBody && lastBody.user_id === "22222222-2222-2222-2222-222222222222", "push binds user");

    const out = await api.cloudSignOut(store, fetchMock);
    ok(out.ok === true, "sign out ok");
    ok(api.cloudReadSession(store) === null, "sign out clears session");

    const denied = await api.cloudPullSave(store, fetchMock);
    ok(denied.ok === false && /not signed in/.test(denied.error), "pull requires session");
  })();
};
