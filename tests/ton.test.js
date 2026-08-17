/* TON Connect helpers - no live wallet / network. */
module.exports = function (h) {
  const { api, ok, section } = h;

  section("ton helpers");
  ok(typeof api.tonCanConnect === "function", "tonCanConnect exported");
  ok(typeof api.tonShortAddress === "function", "tonShortAddress exported");
  ok(api.tonShortAddress("EQCabcdefghijklmnopqrstuvwxyz0123456789ABCD") === "EQCabc...ABCD", "shortens address");

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

  api.tonWriteWallet(store, {
    address: "EQCabcdefghijklmnopqrstuvwxyz0123456789ABCD",
    chain: "-239",
    name: "Tonkeeper",
  });
  const w = api.tonReadWallet(store);
  ok(w && w.address.indexOf("EQC") === 0, "wallet session roundtrips");
  ok(api.tonStatusLabel(store).indexOf("...") >= 0, "status shows short address");

  api.tonWriteWallet(store, null);
  ok(api.tonReadWallet(store) === null, "clear wallet session");

  api.exec('TON_CONFIG={manifestUrl:""};');
  ok(api.tonCanConnect() === false, "empty manifest cannot connect");
  api.exec('TON_CONFIG={manifestUrl:"https://example.github.io/repo/tonconnect-manifest.json"};');
  ok(api.tonCanConnect() === true, "https manifest allows connect path");
  ok(/tonconnect-manifest\\.json$/.test(api.tonManifestUrl()) || api.tonManifestUrl().indexOf("tonconnect-manifest.json") >= 0,
    "manifest url retained");
};
