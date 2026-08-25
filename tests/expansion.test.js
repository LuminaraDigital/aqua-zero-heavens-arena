/* =====================================================================
   Aqua Zero Heavens Arena - Expansion Feature Suite
   Tests for Combat FX/SFX, 200-Floor Tower, Dojo, Create-A-Fighter,
   WebRTC P2P, Replays, TON On-Chain, Virtual Gamepad, Keybindings & i18n.
   ===================================================================== */
"use strict";

module.exports = function (h) {
    const { api, ok, section } = h;

    section("SFX module initial state and triggers");
    const SFX = api.SFX;
    ok(SFX !== undefined, "SFX object should be defined");
    ok(typeof SFX.init === "function", "SFX.init exists");
    ok(typeof SFX.impactThud === "function", "SFX.impactThud exists");
    ok(typeof SFX.strikeSwoosh === "function", "SFX.strikeSwoosh exists");
    ok(typeof SFX.matSqueak === "function", "SFX.matSqueak exists");
    ok(typeof SFX.staminaBreakBuzz === "function", "SFX.staminaBreakBuzz exists");
    ok(typeof SFX.roundBell === "function", "SFX.roundBell exists");
    
    SFX.toggle(false);
    ok(SFX.enabled === false, "SFX toggle off");
    SFX.toggle(true);
    ok(SFX.enabled === true, "SFX toggle on");

    section("CombatFX screen shake and frame state");
    const CombatFX = api.CombatFX;
    ok(CombatFX !== undefined, "CombatFX object should be defined");
    CombatFX.triggerShake(10, 5);
    const offset = CombatFX.shakeOffset;
    ok(typeof offset.x === "number" && typeof offset.y === "number", "shake returns x and y numbers");
    CombatFX.triggerFlash("white", 3);
    ok(CombatFX.flashFrames === 3, "flash frames set correctly");
    CombatFX.update();
    ok(CombatFX.shakeIntensity < 10, "shake intensity decays after update");
    CombatFX.triggerKOFinish();
    ok(CombatFX.slowMoFrames > 0, "slow-mo frames set correctly");

    section("FloatingFeedback system popups");
    const FloatingFeedback = api.FloatingFeedback;
    ok(FloatingFeedback !== undefined, "FloatingFeedback object should be defined");
    FloatingFeedback.add("UPSET!", 100, 100, "UPSET");
    ok(FloatingFeedback.texts.length === 1, "popup added to queue");
    ok(FloatingFeedback.texts[0].message === "UPSET!", "popup message matches");
    FloatingFeedback.update();
    ok(FloatingFeedback.texts[0].life === 89, "popup life decays");
    FloatingFeedback.texts = [];
    ok(FloatingFeedback.texts.length === 0, "popup list cleared");

    section("TowerMode 200-floor progression");
    const TowerMode = api.TowerMode;
    ok(TowerMode !== undefined, "TowerMode should be defined");
    TowerMode.init();
    ok(TowerMode.getState().maxFloor === 200, "max floors is 200");
    ok(TowerMode.getState().unlockedFloors === 1, "floor 1 unlocked initially");
    ok(TowerMode.startFloor(1) === true, "start floor 1 succeeds");
    ok(TowerMode.startFloor(5) === false, "start locked floor 5 fails");
    TowerMode.winFloor();
    ok(TowerMode.getState().unlockedFloors === 2, "floor 2 unlocked after floor 1 complete");

    section("DojoMode practice sandbox and dummy configuration");
    const DojoMode = api.DojoMode;
    ok(DojoMode !== undefined, "DojoMode should be defined");
    DojoMode.setDummyBehavior("BLOCK");
    ok(DojoMode.getConfig().aiDummy.behavior === "BLOCK", "dummy behavior updated to BLOCK");
    DojoMode.toggleOverlay(true);
    DojoMode.updateFrameData({ startup: 5, active: 3, recovery: 12, advantage: 2 });
    ok(DojoMode.getConfig().frameData.startup === 5, "frame data startup set");

    section("CreateFighterMode custom character allocation");
    const CreateFighterMode = api.CreateFighterMode;
    ok(CreateFighterMode !== undefined, "CreateFighterMode should be defined");
    ok(CreateFighterMode.allocatePoint("strength", 10) === true, "allocate strength point");
    ok(CreateFighterMode.draft.availablePoints === 190, "points remaining updated");
    CreateFighterMode.setDiscipline("boxing");
    ok(CreateFighterMode.draft.discipline === "boxing", "discipline selected");
    CreateFighterMode.setName("Custom Strike Master");
    const profile = CreateFighterMode.finishFighter();
    ok(profile.name === "Custom Strike Master", "profile generated with custom name");

    section("P2PNetwork state handling");
    const P2PNetwork = api.P2PNetwork;
    ok(P2PNetwork !== undefined, "P2PNetwork should be defined");
    ok(P2PNetwork.getState() === "DISCONNECTED", "initial P2P state disconnected");
    ok(typeof P2PNetwork.createRoom === "function", "createRoom method exists");
    ok(typeof P2PNetwork.joinRoom === "function", "joinRoom method exists");

    section("ReplayEngine match serialization and ReplayViewer playback");
    const ReplayEngine = api.ReplayEngine;
    const ReplayViewer = api.ReplayViewer;
    ok(ReplayEngine !== undefined, "ReplayEngine should be defined");
    ok(ReplayViewer !== undefined, "ReplayViewer should be defined");

    const replay = ReplayEngine.createReplay({ id: "ken", name: "Ken" }, { id: "ryu", name: "Ryu" }, 12345);
    ReplayEngine.recordTurn(replay, { turnNum: 1, p1Tech: "jab", p2Tech: "cross", p1Hp: 100, p2Hp: 90, range: "MID", position: "CENTRE" });
    ok(replay.turns.length === 1, "turn recorded in replay");

    const wsEncoded = ReplayEngine.exportToWS(replay);
    ok(typeof wsEncoded === "string" && wsEncoded.startsWith("AZHA_REPLAY_WS_v1:"), "export to WS format");

    const imported = ReplayEngine.importFromWS(wsEncoded);
    ok(imported.p1.name === "Ken" && imported.turns.length === 1, "imported replay matches original");

    const loaded = ReplayViewer.loadReplay(imported);
    ok(loaded === true, "ReplayViewer loaded replay successfully");
    ok(ReplayViewer.getCurrentTurn().turn.p1Tech === "jab", "ReplayViewer step 0 turn matches");

    section("TonOnchain smart contract integration state");
    const TonOnchain = api.TonOnchain;
    ok(TonOnchain !== undefined, "TonOnchain should be defined");
    ok(TonOnchain.isConnected() === false, "initial TonOnchain state disconnected");
    ok(typeof TonOnchain.recordPromotionOnchain === "function", "recordPromotionOnchain exists");
    ok(typeof TonOnchain.mintSoulboundBelt === "function", "mintSoulboundBelt exists");
    ok(typeof TonOnchain.enterWagerPool === "function", "enterWagerPool exists");

    section("VirtualGamepad touch overlay and haptic state");
    const VirtualGamepad = api.VirtualGamepad;
    ok(VirtualGamepad !== undefined, "VirtualGamepad should be defined");
    VirtualGamepad.show();
    ok(VirtualGamepad.isActive() === true, "VirtualGamepad set active");
    VirtualGamepad.hide();
    ok(VirtualGamepad.isActive() === false, "VirtualGamepad set inactive");

    section("Keybindings customization and localStorage persistence");
    const Keybindings = api.Keybindings;
    ok(Keybindings !== undefined, "Keybindings should be defined");
    Keybindings.remap("combat", "up", "KeyW");
    ok(Keybindings.getBindings().combat.up === "KeyW", "combat up remapped to KeyW");
    Keybindings.reset();
    ok(Keybindings.getBindings().combat.up === "ArrowUp", "keybindings reset to default ArrowUp");

    section("i18n multi-language translation engine");
    const i18n = api.i18n;
    ok(i18n !== undefined, "i18n should be defined");
    ok(i18n.getLanguage() === "en", "default language is English");
    ok(i18n.t("ui", "start") === "Start Game", "English translation key");
    i18n.setLanguage("ja");
    ok(i18n.getLanguage() === "ja", "language switched to Japanese");
    ok(i18n.t("ui", "start") === "\u30b2\u30fc\u30e0\u958b\u59cb", "Japanese translation key");
    i18n.setLanguage("en");
};
