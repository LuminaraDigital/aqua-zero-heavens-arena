/* =====================================================================
   Save backup / export / import tests.
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

  section("pushBackup respects limit");
  {
    let vault = { snaps: [] };
    for (let i = 0; i < 8; i++) {
      vault = A.pushBackup(vault, A.snapshotSave({ v: 4, unlocked: [i], name: "N" + i }, 1000 + i), A.BACKUP_LIMIT);
    }
    ok(vault.snaps.length === A.BACKUP_LIMIT, "vault caps at BACKUP_LIMIT", vault.snaps.length);
    ok(vault.snaps[0].save.unlocked[0] === 3, "oldest of the kept five is the third push", vault.snaps[0].save.unlocked[0]);
    ok(A.latestBackup(vault).save.unlocked[0] === 7, "latest is the last push");
  }

  section("export / import roundtrip");
  {
    const save = { v: 4, unlocked: [0, 1, 2], name: "RINGSIDE", mastery: { 0: 40 }, rec: { wins: 3 } };
    const blob = A.exportSaveBlob(save);
    const env = JSON.parse(blob);
    ok(env.format === "azha-save" && env.v === 1 && !!env.exportedAt, "envelope shape");
    const r = A.importSaveEnvelope(blob);
    ok(r.ok === true && r.save.name === "RINGSIDE", "roundtrip keeps the save");
    ok(A.importSaveEnvelope("{").ok === false, "rejects broken JSON");
    ok(A.importSaveEnvelope(JSON.stringify({ format: "other", v: 1, save: save })).ok === false, "rejects wrong format");
    ok(A.importSaveEnvelope(JSON.stringify({ format: "azha-save", v: 1, save: { name: "x" } })).ok === false,
       "rejects save without unlocked");
    ok(A.importSaveEnvelope(JSON.stringify({
      format: "azha-save", v: 1, constructor: { name: "Evil" },
      save: { unlocked: [0], name: "X" },
    })).ok === false, "rejects dangerous envelope keys");
    ok(A.importSaveEnvelope(JSON.stringify({
      format: "azha-save", v: 1,
      save: { unlocked: [0], prototype: { x: 1 }, name: "X" },
    })).ok === false, "rejects dangerous save keys");
    ok(A.importSaveEnvelope(JSON.stringify({
      format: "azha-save", v: 1,
      save: { unlocked: ["nope"], name: "X" },
    })).ok === false, "rejects non-integer unlocked ids");
    ok(A.importSaveEnvelope(JSON.stringify({
      format: "azha-save", v: 1,
      save: { unlocked: [999], name: "X" },
    })).ok === false, "rejects out-of-range unlocked ids");
    ok(A.importSaveEnvelope("x".repeat(200001)).ok === false, "rejects oversized import text");
    {
      const dirty = A.importSaveEnvelope(JSON.stringify({
        format: "azha-save", v: 1,
        save: {
          unlocked: [0, 1],
          name: "<script>alert(1)</script>",
          mastery: { 0: 12, evil: 9, "99": 1 },
          rec: { wins: 2, hack: "no" },
          sound: false,
        },
      }));
      ok(dirty.ok === true, "accepts sanitized dirty payload");
      ok(dirty.save.name === "SCRIPTALERT1SCRI", "name is stripped and capped at 16", dirty.save.name);
      ok(dirty.save.mastery["0"] === 12 && dirty.save.mastery.evil === undefined,
         "mastery keeps numeric keys only");
      ok(dirty.save.rec.wins === 2 && dirty.save.rec.hack === undefined,
         "rec keeps known numeric fields only");
      ok(dirty.save.sound === false, "boolean options survive sanitize");
    }
  }

  section("escapeHtml / a11y baseline");
  {
    A.exec("__api._esc = escapeHtml('<b>&\"\\'');");
    ok(A._esc === "&lt;b&gt;&amp;&quot;&#39;", "escapeHtml encodes markup-sensitive chars", A._esc);
    const fs = require("fs");
    const path = require("path");
    const page = fs.readFileSync(path.resolve(__dirname, "..", "aqua-zero-heavens-arena.html"), "utf8");
    ok(/id="snd"[^>]*aria-label=/.test(page) || /aria-label="[^"]*"[^>]*id="snd"/.test(page),
       "sound button exposes aria-label");
    ok(/role="group"[^>]*aria-label="Action buttons"/.test(page), "action buttons are a labeled group");
    ok(/id="kbstate"[^>]*aria-live="polite"/.test(page), "keyboard state is polite live region");
  }

  section("persist creates a backup entry");
  {
    A.localStore.delete(A.BACKUP_KEY);
    A.exec("SAVE=DEF_SAVE(); SAVE.name='BACKUPED'; SAVE.unlocked=[0,1,2,3]; persist();");
    const vault = A.readBackupVault(ls);
    ok(vault.snaps.length === 1, "first persist writes one snapshot", vault.snaps.length);
    ok(vault.snaps[0].save.name === "BACKUPED", "snapshot mirrors the save");
    A.exec("persist();");
    ok(A.readBackupVault(ls).snaps.length === 1, "identical persist does not duplicate");
    A.exec("SAVE.name='MOVED'; persist();");
    ok(A.readBackupVault(ls).snaps.length === 2, "changed save adds another snapshot");
  }

  section("restore recovers prior save");
  {
    A.localStore.delete(A.BACKUP_KEY);
    A.exec("SAVE=DEF_SAVE(); SAVE.name='KEPT'; SAVE.rec.wins=9; persist();");
    A.exec("SAVE=DEF_SAVE(); clearBackupVault(localStorage); persist(true);");
    ok(A.getSave().name === "CHALLENGER", "erase-style persist skipped backing up the wipe");
    ok(A.readBackupVault(ls).snaps.length === 0, "erase clears the backup vault", A.readBackupVault(ls).snaps.length);
    A.exec("SAVE=DEF_SAVE(); SAVE.name='KEPT'; SAVE.rec.wins=9; persist();");
    A.exec("SAVE=DEF_SAVE(); persist(true);");
    ok(A.readBackupVault(ls).snaps.length === 1, "skipBackup alone keeps prior vault when not cleared");
    A.exec("restoreLatestBackup();");
    const s = A.getSave();
    ok(s.name === "KEPT" && s.rec.wins === 9, "restore brings the prior save back", s.name);
  }

  section("multi-tab stamp adopt");
  {
    A.localStore.delete(A.STAMP_KEY);
    const a = A.nextSaveStamp(null, "tabA", 1000);
    ok(a.rev === 1 && a.tabId === "tabA", "first stamp starts at rev 1");
    const b = A.nextSaveStamp(a, "tabA", 2000);
    ok(b.rev === 2, "next stamp bumps rev");
    ok(A.shouldAdoptRemoteStamp(a, b, "tabB") === true, "newer rev is adopted by other tab");
    ok(A.shouldAdoptRemoteStamp(b, a, "tabB") === false, "older rev is rejected");
    ok(A.shouldAdoptRemoteStamp(b, b, "tabA") === false, "same tab id is not adopted");
    const tieNewer = { rev: 2, tabId: "tabC", t: 3000 };
    ok(A.shouldAdoptRemoteStamp(b, tieNewer, "tabB") === true, "same rev with later t is adopted");
    A.writeSaveStamp(ls, b);
    ok(A.readSaveStamp(ls).rev === 2, "stamp roundtrips through storage");
    A.exec("localStamp={rev:1,tabId:TAB_ID,t:1};");
    A.localStore.set("azha_save", JSON.stringify({
      v: 4, name: "OTHER", unlocked: [0, 1], defeats: {}, sound: true, music: true, diff: 1,
      motion: true, mastery: {}, titles: [], title: null, daily: null, run: null,
      rec: { duels: 0, wins: 1, losses: 0, perfect: 0, stages: 0, bestSurv: 0, ngplus: 0 }, fr: {},
    }));
    A.writeSaveStamp(ls, { rev: 9, tabId: "other-tab", t: 9999 });
    A.exec("adoptRemoteSaveIfNewer();");
    ok(A.getSave().name === "OTHER" && A.getSave().rec.wins === 1, "adopt reloads remote save into SAVE");
  }

  /* =====================================================================
     THE META BLOCKS SURVIVE THE SANITISER.

     Everything a player keeps between runs lives in three save blocks:
     meta (the renown ledger, including everything bought), discMastery
     (xp per martial art) and nem (the nemesis). sanitizeSavePayload() is
     the ONLY point common to all three paths that reach applyImportedSave()
     - the options-screen IMPORT SAVE, the cloud pull and the cloud push -
     so a whitelist that does not know these blocks does not merely fail to
     restore them: applyImportedSave normalises the hole into empty defaults
     and persist() writes the loss, permanently, in silence. These checks
     pin the blocks to the sanitiser rather than to any one caller.
     ===================================================================== */
  section("permanent-progression blocks survive sanitize and import");
  {
    const artId = A.exec("META_ITEM_IDS[0]");
    const discId = A.exec("discMasteryIds()[0]");
    const discXp = Math.min(250, A.exec("DISC_CONFIG.xpMax"));
    const owned = {};
    owned[artId] = 1;
    const discBlock = {};
    discBlock[discId] = discXp;
    const rich = {
      v: 4, unlocked: [0, 1, 2], name: "LEDGER",
      meta: { v: 1, renown: 330, earned: 480, spent: 150, runs: 7, owned: owned },
      discMastery: discBlock,
      nem: { fid: 3, losses: 2, wins: 1, runs: 4, active: true },
    };

    const cleaned = A.sanitizeSavePayload(rich);
    ok(!!cleaned, "the rich save survives sanitize at all");
    ok(!!cleaned.meta && cleaned.meta.renown === 330,
       "sanitize keeps the renown balance", cleaned.meta && cleaned.meta.renown);
    ok(!!cleaned.meta && cleaned.meta.owned[artId] === 1,
       "sanitize keeps the purchased catalogue entry", cleaned.meta && JSON.stringify(cleaned.meta.owned));
    ok(!!cleaned.discMastery && cleaned.discMastery[discId] === discXp,
       "sanitize keeps discipline mastery xp", cleaned.discMastery && JSON.stringify(cleaned.discMastery));
    ok(!!cleaned.nem && cleaned.nem.fid === 3 && cleaned.nem.losses === 2 && cleaned.nem.active === true,
       "sanitize keeps the nemesis record", JSON.stringify(cleaned.nem));

    /* the bare sanitize -> apply round trip: this is the cloud pull's shape,
       where cloudPullSave() has already sanitized before cloudSyncNow() hands
       the result to applyImportedSave(). */
    A.applyImportedSave(cleaned);
    {
      const s = A.getSave();
      ok(!!s.meta && s.meta.renown === 330, "sanitize -> apply keeps renown", s.meta && s.meta.renown);
      ok(!!s.meta && s.meta.owned[artId] === 1, "sanitize -> apply keeps the bought entry");
      ok(!!s.discMastery && s.discMastery[discId] === discXp, "sanitize -> apply keeps discipline xp");
      ok(!!s.nem && s.nem.fid === 3, "sanitize -> apply keeps the nemesis");
    }

    /* the full file round trip: export a save, import the file, apply it -
       the options-screen path, end to end. */
    const env = A.importSaveEnvelope(A.exportSaveBlob(rich));
    ok(env.ok === true, "the rich save exports and re-imports", env.error);
    A.applyImportedSave(env.save);
    {
      const s = A.getSave();
      ok(!!s.meta && s.meta.renown === 330, "export -> import -> apply keeps renown", s.meta && s.meta.renown);
      ok(!!s.meta && s.meta.owned[artId] === 1, "export -> import -> apply keeps the bought entry");
      ok(!!s.discMastery && s.discMastery[discId] === discXp, "export -> import -> apply keeps discipline xp");
      ok(!!s.nem && s.nem.fid === 3 && s.nem.wins === 1, "export -> import -> apply keeps the nemesis");
    }

    /* and the loss has to survive the write, not just the assignment */
    A.exec("persist();");
    const reloaded = A.exec("load()");
    ok(!!reloaded.meta && reloaded.meta.renown === 330, "persist -> load keeps renown", reloaded.meta && reloaded.meta.renown);
    ok(!!reloaded.discMastery && reloaded.discMastery[discId] === discXp, "persist -> load keeps discipline xp");
    ok(!!reloaded.nem && reloaded.nem.fid === 3, "persist -> load keeps the nemesis");

    /* totality: junk in each block still comes out a clean block, never a throw */
    const junk = A.sanitizeSavePayload({
      v: 4, unlocked: [0], name: "JUNK",
      meta: "not an object", discMastery: 5, nem: { fid: 9999 },
    });
    ok(!!junk, "a save with junk in all three blocks still sanitizes");
    ok(!!junk.meta && junk.meta.renown === 0 && junk.meta.owned && Object.keys(junk.meta.owned).length === 0,
       "junk meta comes out an empty ledger");
    ok(!!junk.discMastery && Object.keys(junk.discMastery).length === 0, "junk discMastery comes out an empty map");
    ok(junk.nem === null, "an unknown nemesis fighter id comes out null", junk.nem);

    A.exec("SAVE=DEF_SAVE(); persist(true);");
  }
};
