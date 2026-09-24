"use strict";

module.exports = function (h) {
  h.section("Modern UI Presentation & Input Suite");

  // 1. Keybindings Input & Glyph Engine
  const Keybindings = h.api.Keybindings || require("../src/ui/keybindings");
  h.ok(typeof Keybindings === "object", "Keybindings module should be defined");

  // Default input device
  h.ok(Keybindings.getInputDevice() === "keyboard", "Default input device is keyboard");

  // Keyboard glyphs
  h.ok(Keybindings.getGlyphForAction("attack", "combat") === "Z", "Attack maps to Z glyph");
  h.ok(Keybindings.getGlyphForAction("confirm", "menu") === "Enter", "Confirm maps to Enter glyph");
  h.ok(Keybindings.getGlyphForAction("cancel", "menu") === "Esc", "Cancel maps to Esc glyph");
  h.ok(Keybindings.getGlyphForAction("up", "combat") === "↑", "ArrowUp maps to ↑ glyph");

  // Gamepad input mode
  Keybindings.setInputDevice("gamepad");
  h.ok(Keybindings.getInputDevice() === "gamepad", "Input device switched to gamepad");
  h.ok(Keybindings.getGlyphForAction("attack") === "(A)", "Gamepad attack resolves to (A)");
  h.ok(Keybindings.getGlyphForAction("jump") === "(B)", "Gamepad jump resolves to (B)");
  h.ok(Keybindings.getGlyphForAction("special") === "(Y)", "Gamepad special resolves to (Y)");

  // Touch input mode
  Keybindings.setInputDevice("touch");
  h.ok(Keybindings.getInputDevice() === "touch", "Input device switched to touch");
  h.ok(Keybindings.getGlyphForAction("attack") === "TAP", "Touch attack resolves to TAP");
  h.ok(Keybindings.getGlyphForAction("jump") === "GUARD", "Touch jump resolves to GUARD");

  // Reset to keyboard
  Keybindings.setInputDevice("keyboard");
  h.ok(Keybindings.getInputDevice() === "keyboard", "Input device reset to keyboard");

  // 2. SettingsGUI Display Mode & Presentation Engine
  const SettingsGUI = h.api.SettingsGUI || require("../src/ui/settings-gui");
  h.ok(typeof SettingsGUI === "object", "SettingsGUI module should be defined");

  const dispSettings = SettingsGUI.getDisplaySettings();
  h.ok(typeof dispSettings === "object", "Display settings object returned");
  h.ok(dispSettings.displayMode === "modern", "Default display mode is modern");
  h.ok(dispSettings.crtScanlines === false, "Default CRT scanlines is false");
  h.ok(dispSettings.hudOpacity === 100, "Default HUD opacity is 100%");

  // Toggle display mode
  const nextMode = SettingsGUI.toggleDisplaySetting("displayMode");
  h.ok(nextMode === "theater", "Toggling display mode moves modern -> theater");
  h.ok(SettingsGUI.getDisplaySettings().displayMode === "theater", "Display mode state is theater");

  const retroMode = SettingsGUI.toggleDisplaySetting("displayMode");
  h.ok(retroMode === "retro", "Toggling display mode moves theater -> retro");
  h.ok(SettingsGUI.getDisplaySettings().displayMode === "retro", "Display mode state is retro");

  const cycleBack = SettingsGUI.toggleDisplaySetting("displayMode");
  h.ok(cycleBack === "modern", "Toggling display mode cycles retro -> modern");

  // Toggle CRT scanlines
  const scanlinesOn = SettingsGUI.toggleDisplaySetting("crtScanlines");
  h.ok(scanlinesOn === true, "CRT scanlines toggled on");
  const scanlinesOff = SettingsGUI.toggleDisplaySetting("crtScanlines");
  h.ok(scanlinesOff === false, "CRT scanlines toggled off");

  // Explicit set
  SettingsGUI.setDisplaySetting("displayMode", "theater");
  h.ok(SettingsGUI.getDisplaySettings().displayMode === "theater", "Explicit set displayMode to theater");
  SettingsGUI.setDisplaySetting("displayMode", "modern");

  // 3. VirtualGamepad Touch Controls API
  const VirtualGamepad = h.api.VirtualGamepad || require("../src/ui/virtual-gamepad");
  h.ok(typeof VirtualGamepad === "object", "VirtualGamepad module should be defined");
  h.ok(typeof VirtualGamepad.init === "function", "VirtualGamepad has init function");
  h.ok(typeof VirtualGamepad.show === "function", "VirtualGamepad has show function");
  h.ok(typeof VirtualGamepad.hide === "function", "VirtualGamepad has hide function");
  h.ok(typeof VirtualGamepad.setOpacity === "function", "VirtualGamepad has setOpacity function");

  VirtualGamepad.show();
  h.ok(VirtualGamepad.isActive() === true, "VirtualGamepad is active when shown");
  VirtualGamepad.setOpacity(0.5);
  h.ok(VirtualGamepad.getState().opacity === 0.5, "VirtualGamepad opacity updated to 0.5");
  VirtualGamepad.hide();
  h.ok(VirtualGamepad.isActive() === false, "VirtualGamepad is inactive when hidden");
};
