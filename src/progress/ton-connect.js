/* =====================================================================
   Aqua Zero Heavens Arena - optional TON Connect (vanilla)
   Luminary Digital

   Offline play never needs this. Wallet connect needs a public HTTPS
   tonconnect-manifest.json (GitHub Pages). See docs/adr/0006.
   ===================================================================== */
const TON_SESSION_KEY = "azha_ton_wallet";
const TON_UI_CDN = "https://unpkg.com/@tonconnect/ui@2.0.11/dist/tonconnect-ui.min.js";
let TON_CONFIG = __TON_CONFIG__;

let tonConnectUi = null;
let tonScriptPromise = null;
let tonBusy = false;
let tonLastError = "";

function tonManifestUrl() {
  if (TON_CONFIG && typeof TON_CONFIG.manifestUrl === "string" && TON_CONFIG.manifestUrl) {
    return String(TON_CONFIG.manifestUrl);
  }
  try {
    if (typeof location !== "undefined" && location.protocol === "https:") {
      return String(location.origin).replace(/\/$/, "") + "/tonconnect-manifest.json";
    }
  } catch (e) {}
  return "";
}

function tonCanConnect() {
  const m = tonManifestUrl();
  return !!(m && /^https:\/\//i.test(m));
}

function tonReadWallet(localStorageLike) {
  try {
    const raw = (localStorageLike || localStorage).getItem(TON_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || typeof o.address !== "string" || !o.address) return null;
    return {
      address: String(o.address).slice(0, 128),
      chain: typeof o.chain === "string" ? String(o.chain).slice(0, 32) : "",
      name: typeof o.name === "string" ? String(o.name).slice(0, 64) : "",
    };
  } catch (e) {
    return null;
  }
}

function tonWriteWallet(localStorageLike, wallet) {
  const store = localStorageLike || localStorage;
  if (!wallet || !wallet.address) {
    try {
      store.removeItem(TON_SESSION_KEY);
    } catch (e) {}
    return;
  }
  store.setItem(
    TON_SESSION_KEY,
    JSON.stringify({
      address: String(wallet.address).slice(0, 128),
      chain: String(wallet.chain || "").slice(0, 32),
      name: String(wallet.name || "").slice(0, 64),
    })
  );
}

function tonShortAddress(addr) {
  const a = String(addr || "");
  if (a.length < 12) return a || "NONE";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function tonStatusLabel(localStorageLike) {
  if (tonBusy) return "...";
  const w = tonReadWallet(localStorageLike || localStorage);
  if (!w) return tonCanConnect() ? "CONNECT" : "NEED HTTPS";
  return tonShortAddress(w.address);
}

function tonLoadScript(src) {
  if (tonScriptPromise) return tonScriptPromise;
  tonScriptPromise = new Promise(function (resolve, reject) {
    try {
      if (typeof document === "undefined") {
        reject(new Error("no document"));
        return;
      }
      if (typeof window !== "undefined" && window.TON_CONNECT_UI) {
        resolve(window.TON_CONNECT_UI);
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        if (window.TON_CONNECT_UI) resolve(window.TON_CONNECT_UI);
        else reject(new Error("TON_CONNECT_UI missing after load"));
      };
      s.onerror = function () {
        reject(new Error("failed to load TonConnect UI"));
      };
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
  return tonScriptPromise;
}

function tonApplyAccount(account) {
  if (!account || !account.address) {
    tonWriteWallet(localStorage, null);
    return null;
  }
  const w = {
    address: account.address,
    chain: account.chain != null ? String(account.chain) : "",
    name: "",
  };
  tonWriteWallet(localStorage, w);
  return w;
}

async function tonEnsureUi() {
  if (!tonCanConnect()) {
    return { ok: false, error: "TON Connect needs an https:// manifest URL (GitHub Pages)" };
  }
  const lib = await tonLoadScript(TON_UI_CDN);
  if (!tonConnectUi) {
    tonConnectUi = new lib.TonConnectUI({
      manifestUrl: tonManifestUrl(),
    });
    tonConnectUi.onStatusChange(function (wallet) {
      if (!wallet || !wallet.account) {
        tonWriteWallet(localStorage, null);
        return;
      }
      tonApplyAccount(wallet.account);
    });
    try {
      const existing = tonConnectUi.account || (tonConnectUi.wallet && tonConnectUi.wallet.account);
      if (existing) tonApplyAccount(existing);
    } catch (e) {}
  }
  return { ok: true, ui: tonConnectUi };
}

async function tonConnect() {
  tonBusy = true;
  tonLastError = "";
  try {
    const ready = await tonEnsureUi();
    if (!ready.ok) {
      tonLastError = ready.error;
      return ready;
    }
    await ready.ui.openModal();
    const account = ready.ui.account || (ready.ui.wallet && ready.ui.wallet.account);
    if (account) {
      tonApplyAccount(account);
      return { ok: true, wallet: tonReadWallet(localStorage) };
    }
    return { ok: true, wallet: tonReadWallet(localStorage) };
  } catch (e) {
    const err = (e && e.message) || "connect failed";
    tonLastError = String(err).slice(0, 120);
    return { ok: false, error: tonLastError };
  } finally {
    tonBusy = false;
  }
}

async function tonDisconnect() {
  tonBusy = true;
  tonLastError = "";
  try {
    const ready = await tonEnsureUi();
    if (ready.ok && ready.ui && typeof ready.ui.disconnect === "function") {
      await ready.ui.disconnect();
    }
    tonWriteWallet(localStorage, null);
    return { ok: true };
  } catch (e) {
    tonWriteWallet(localStorage, null);
    const err = (e && e.message) || "disconnect failed";
    tonLastError = String(err).slice(0, 120);
    return { ok: false, error: tonLastError };
  } finally {
    tonBusy = false;
  }
}
