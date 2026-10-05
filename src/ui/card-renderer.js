/* =====================================================================
   Aqua Zero Heavens Arena - Tangible Card Renderer & HUD Badges
   Luminara Digital

   Provides high-contrast, tangible physical card rendering for combat hands,
   card vault deck builder, stat stage chevron badges, and live status badges.
   ===================================================================== */

var CardRenderer = (function () {
  "use strict";

  var TYPE_BADGES = {
    STRIKE: { name: "STRIKE", badge: "STR", color: "#ef4444", glyph: "[S]" },
    THROW:  { name: "THROW",  badge: "THR", color: "#f59e0b", glyph: "[T]" },
    GUARD:  { name: "GUARD",  badge: "GRD", color: "#22d3ee", glyph: "[G]" },
    SETUP:  { name: "SETUP",  badge: "SET", color: "#10b981", glyph: "[F]" },
    SUB:    { name: "SUB",    badge: "SUB", color: "#a855f7", glyph: "[U]" },
  };

  var STATUS_LABELS = {
    BLEEDING:    { name: "BLEED",   color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)" },
    STUNNED:     { name: "STUN",    color: "#fbbf24", bg: "rgba(251, 191, 36, 0.2)" },
    OFF_BALANCE: { name: "OFF-BAL", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.2)" },
    WINDED:      { name: "WIND",    color: "#38bdf8", bg: "rgba(56, 189, 248, 0.2)" },
    LEG_HURT:    { name: "LEG",     color: "#fb923c", bg: "rgba(251, 146, 60, 0.2)" },
    ARM_HURT:    { name: "ARM",     color: "#fb923c", bg: "rgba(251, 146, 60, 0.2)" },
    HELD:        { name: "HELD",    color: "#c084fc", bg: "rgba(192, 132, 252, 0.2)" },
    PINNED:      { name: "PINNED",  color: "#a855f7", bg: "rgba(168, 85, 247, 0.2)" },
    DAZED:         { name: "DAZED",   color: "#e5c07b", bg: "rgba(229, 192, 123, 0.2)" },
    STAMINA_BREAK: { name: "STAM-BRK",color: "#ff4444", bg: "rgba(255, 68, 68, 0.25)" },
    DESPERATION: { name: "DESP",    color: "#ef4444", bg: "rgba(239, 68, 68, 0.25)" },
  };

  var COMBO_GLYPHS = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465", "\u2466", "\u2467", "\u2468"];

  /* ---------------------------------------------------------------
     LIVE FORECAST FACE
     The dex numbers a technique carries (power/acc/speed) are the raw
     table values; what the fighter actually needs is what THIS throw
     does from where the fight is standing right now. When the caller
     hands us a `live` block we drop the static grid entirely and print
     the forecast instead - same figures the old techRow() computed.
     --------------------------------------------------------------- */
  var FIT_STYLES = {
    good: { fg: "#10b981", bg: "rgba(16, 185, 129, 0.18)" },
    ok:   { fg: "#f59e0b", bg: "rgba(245, 158, 11, 0.18)" },
    bad:  { fg: "#8b5a4a", bg: "rgba(139, 90, 74, 0.24)" },
  };
  var LIVE_INK = "#f3f4f6";
  var LIVE_DIM = "#d1d5db";
  var LIVE_RED = "#e6392f";
  var LIVE_AQUA = "#22d3ee";

  function fitStyle(fit) {
    var key = String(fit === undefined || fit === null ? "ok" : fit).toLowerCase();
    return FIT_STYLES[key] || FIT_STYLES.ok;
  }

  // Same thresholds techRow() draws its accuracy bar with.
  function accColor(acc) {
    return acc >= 80 ? "#10b981" : (acc >= 60 ? "#f59e0b" : LIVE_RED);
  }

  function firstChip(first) {
    var n = Number(first) || 0;
    if (n > 0) return { text: "1ST", fg: "#10b981", bg: "rgba(16, 185, 129, 0.18)" };
    if (n < 0) return { text: "2ND", fg: "#8b5a4a", bg: "rgba(139, 90, 74, 0.24)" };
    return { text: "EVEN", fg: "#6b7280", bg: "rgba(107, 114, 128, 0.18)" };
  }

  function isNum(v) {
    return typeof v === "number" && isFinite(v);
  }

  // Trim a string until it fits `maxW` at `font`, appending an ASCII ellipsis.
  function clipText(cx, str, maxW, font) {
    var out = String(str === undefined || str === null ? "" : str);
    if (!out) return "";
    cx.font = font;
    if (cx.measureText(out).width <= maxW) return out;
    while (out.length > 2 && cx.measureText(out + "..").width > maxW) {
      out = out.slice(0, -1);
    }
    return out + "..";
  }

  function chipBox(cx, bx, by, bw, bh, label, fg, bg) {
    cx.fillStyle = bg;
    cx.fillRect(bx, by, bw, bh);
    cx.strokeStyle = fg;
    cx.lineWidth = 1;
    cx.strokeRect(bx, by, bw, bh);
    cx.fillStyle = fg;
    cx.font = "bold 10px 'Trebuchet MS', Bahnschrift, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(clipText(cx, label, bw - 4, "bold 10px 'Trebuchet MS', Bahnschrift, sans-serif"), bx + bw / 2, by + bh / 2);
  }

  /* Draws the whole lower half of a combat card from the live forecast.
     `rowY` is the top of the badge strip; everything below is anchored to
     the bottom edge so the face stays legible at the 124x98 hand size and
     at the taller vault size. */
  function paintLiveFace(cx, x, y, w, h, tech, live, selected, rowY) {
    var rowH = 14;
    var noteH = 16;
    var noteY = y + h - noteH - 3;
    var bigH = 30;
    var bigY = Math.max(rowY + rowH + 2, noteY - bigH - 2);
    var affordable = live.affordable !== false;

    // --- badge strip: range fit, initiative forecast, stamina gem ---
    var fs = fitStyle(live.fit);
    var rangeStr = String(tech.range || "ANY").toUpperCase();
    chipBox(cx, x + 5, rowY, 42, rowH, rangeStr, fs.fg, fs.bg);

    var fc = firstChip(live.first);
    chipBox(cx, x + 50, rowY, 32, rowH, fc.text, fc.fg, fc.bg);

    var gemX = x + w - 16;
    var gemY = rowY + rowH / 2;
    cx.fillStyle = affordable ? "#0284c7" : "#2a0b0f";
    cx.strokeStyle = affordable ? "#38bdf8" : LIVE_RED;
    cx.lineWidth = affordable ? 1 : 1.5;
    cx.beginPath();
    cx.moveTo(gemX, gemY - 8);
    cx.lineTo(gemX + 8, gemY);
    cx.lineTo(gemX, gemY + 8);
    cx.lineTo(gemX - 8, gemY);
    cx.closePath();
    cx.fill();
    cx.stroke();
    cx.fillStyle = affordable ? "#ffffff" : LIVE_RED;
    cx.font = "bold 9px 'Trebuchet MS', Bahnschrift, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(isNum(live.stam) ? Math.round(live.stam) : "-", gemX, gemY);

    // --- the two figures that decide the turn: damage and hit chance ---
    cx.fillStyle = "rgba(8, 11, 16, 0.88)";
    cx.fillRect(x + 4, bigY, w - 8, bigH);
    cx.strokeStyle = "#252b3b";
    cx.lineWidth = 1;
    cx.strokeRect(x + 4, bigY, w - 8, bigH);

    var isGuard = tech.cls === "GUARD";
    var escaping = isNum(live.escape);
    var dmgLabel = isGuard ? "GUARD" : (escaping ? "ESC" : "DMG");
    var dmgText, dmgColor;
    if (isGuard) {
      dmgText = "58% CUT";
      dmgColor = LIVE_AQUA;
    } else if (escaping) {
      dmgText = Math.round(live.escape) + "%";
      dmgColor = LIVE_AQUA;
    } else if (isNum(live.dmg) && live.dmg > 0) {
      dmgText = "~" + Math.round(live.dmg);
      dmgColor = LIVE_INK;
    } else {
      dmgText = "-";
      dmgColor = "#5d626c";
    }

    cx.fillStyle = LIVE_DIM;
      cx.font = "bold 10px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "left";
      cx.textBaseline = "top";
      cx.fillText(dmgLabel, x + 9, bigY + 3);

    cx.fillStyle = dmgColor;
    cx.textBaseline = "middle";
    var dmgFont = isGuard ? "bold 15px 'Trebuchet MS', Bahnschrift, sans-serif" : "bold 19px 'Trebuchet MS', Bahnschrift, sans-serif";
    cx.fillText(clipText(cx, dmgText, w / 2 - 10, dmgFont), x + 8, bigY + 18);

    if (isGuard) {
      cx.fillStyle = LIVE_DIM;
      cx.font = "bold 10px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "right";
      cx.textBaseline = "top";
      cx.fillText("EFFECT", x + w - 9, bigY + 3);

      cx.fillStyle = "#fbbf24";
      cx.font = "bold 13px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "right";
      cx.textBaseline = "middle";
      cx.fillText("+FOCUS", x + w - 9, bigY + 16);
    } else {
      cx.fillStyle = LIVE_DIM;
      cx.font = "bold 10px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "right";
      cx.textBaseline = "top";
      cx.fillText("HIT", x + w - 9, bigY + 3);

      var barW = Math.max(24, Math.min(46, w / 2 - 14));
      var barX = x + w - 9 - barW;
      var barY = bigY + 23;
      if (isNum(live.acc)) {
        var accVal = Math.max(0, Math.min(100, Math.round(live.acc)));
        cx.fillStyle = accColor(accVal);
        cx.font = "bold 15px 'Trebuchet MS', Bahnschrift, sans-serif";
        cx.textAlign = "right";
        cx.textBaseline = "middle";
        cx.fillText(accVal + "%", x + w - 9, bigY + 15);

        cx.fillStyle = "#0a0b0e";
        cx.fillRect(barX, barY, barW, 5);
        cx.strokeStyle = "#2a2d35";
        cx.lineWidth = 1;
        cx.strokeRect(barX, barY, barW, 5);
        cx.fillStyle = accColor(accVal);
        cx.fillRect(barX + 1, barY + 1, Math.max(1, (barW - 2) * accVal / 100), 3);
      } else {
        cx.fillStyle = "#5d626c";
        cx.font = "bold 15px 'Trebuchet MS', Bahnschrift, sans-serif";
        cx.textAlign = "right";
        cx.textBaseline = "middle";
        cx.fillText("-", x + w - 9, bigY + 15);
      }
    }

    // --- counter-play note: only the selected card has room for words ---
    if (selected && live.note) {
      cx.fillStyle = "rgba(15, 23, 42, 0.92)";
      cx.fillRect(x + 5, noteY, w - 10, noteH);
      cx.strokeStyle = "rgba(245, 158, 11, 0.5)";
      cx.lineWidth = 1;
      cx.strokeRect(x + 5, noteY, w - 10, noteH);
      cx.fillStyle = live.noteColor || "#f0b849";
      cx.fillRect(x + 5, noteY, 3, noteH);

      var noteFont = "bold 10px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillStyle = live.noteColor || "#f0b849";
      cx.font = noteFont;
      cx.textAlign = "left";
      cx.textBaseline = "middle";
      cx.fillText(clipText(cx, live.note, w - 20, noteFont), x + 11, noteY + noteH / 2);
    }
  }

  function getTech(techId) {
    if (!techId) return null;
    if (typeof techId === "object") return techId;
    if (typeof TECH !== "undefined" && TECH[techId]) return TECH[techId];
    return {
      id: String(techId),
      name: String(techId).replace(/_/g, " ").toUpperCase(),
      disc: "boxing",
      cls: "STRIKE",
      range: "MID",
      power: 20,
      acc: 90,
      speed: 75,
      stam: 6,
      prio: 0,
      flags: [],
    };
  }

  function getDisciplineInfo(discKey) {
    var key = String(discKey || "boxing").toLowerCase();
    if (typeof DISCIPLINES !== "undefined" && DISCIPLINES[key]) {
      return DISCIPLINES[key];
    }
    return { name: key.toUpperCase(), color: "#38bdf8" };
  }

  function getAttackHeight(tech, opts) {
    if (opts && opts.height) return opts.height;
    if (!tech) return "MID";
    var cls = (tech.cls || "STRIKE").toUpperCase();
    var range = (tech.range || "MID").toUpperCase();
    var flags = tech.flags || [];
    var name = (tech.name || "").toLowerCase();
    var id = (tech.id || "").toLowerCase();

    if (cls === "GUARD" || cls === "SETUP" || cls === "SUB" || range === "GROUND") {
      return "SPECIAL";
    }
    if (
      flags.indexOf("leg") >= 0 ||
      flags.indexOf("low") >= 0 ||
      id.indexOf("low") >= 0 ||
      name.indexOf("low") >= 0 ||
      name.indexOf("cut kick") >= 0
    ) {
      return "LOW";
    }
    if (
      flags.indexOf("head") >= 0 ||
      flags.indexOf("axe") >= 0 ||
      flags.indexOf("launcher") >= 0 ||
      flags.indexOf("jump") >= 0 ||
      name.indexOf("head") >= 0 ||
      name.indexOf("upper") >= 0 ||
      name.indexOf("flying") >= 0 ||
      name.indexOf("high") >= 0
    ) {
      return "HIGH";
    }
    if (range === "LONG") {
      return "HIGH";
    }
    return "MID";
  }

  function getKeywords(tech) {
    if (!tech) return [];
    var keywords = [];
    var flags = tech.flags || [];
    var name = (tech.name || "").toLowerCase();
    var cls = (tech.cls || "STRIKE").toUpperCase();
    var eff = tech.eff || null;

    if (flags.indexOf("counter") >= 0 || (tech.prio > 0 && flags.indexOf("counter") >= 0)) {
      keywords.push({ label: "Counter", color: "#38bdf8" });
    }
    if (cls === "THROW" || flags.indexOf("break") >= 0 || flags.indexOf("guard_break") >= 0) {
      keywords.push({ label: "Guard Break", color: "#f59e0b" });
    }
    if (flags.indexOf("armor") >= 0 || flags.indexOf("super") >= 0 || tech.sig) {
      keywords.push({ label: "Armor", color: "#fbbf24" });
    }
    if (flags.indexOf("power") >= 0 || flags.indexOf("crit") >= 0 || tech.power >= 35) {
      keywords.push({ label: "Critical", color: "#ef4444" });
    }
    if (flags.indexOf("launcher") >= 0 || name.indexOf("upper") >= 0 || name.indexOf("flying") >= 0) {
      keywords.push({ label: "Launcher", color: "#22d3ee" });
    }
    if (flags.indexOf("parry") >= 0 || flags.indexOf("reversal") >= 0) {
      keywords.push({ label: "Reversal", color: "#a855f7" });
    }
    if ((eff && eff.st === "BLEEDING") || flags.indexOf("cut") >= 0) {
      keywords.push({ label: "Bleed", color: "#e11d48" });
    }
    if ((eff && eff.st === "STUNNED") || (eff && eff.st === "WINDED")) {
      keywords.push({ label: eff.st === "STUNNED" ? "Stun" : "Winded", color: "#fbbf24" });
    }
    return keywords;
  }

  function paintCard(cx, x, y, width, height, techId, opts) {
    if (!cx) return;
    opts = opts || {};
    var tech = getTech(techId);
    if (!tech) return;

    var w = width || 120;
    var h = height || 168;
    var selected = !!opts.selected;
    var hovered = !!opts.hovered;
    var disabled = !!opts.disabled;
    /* A `live` block replaces the static dex grid with this turn's forecast.
       Absent (or handed the whole parallel array by mistake) it is ignored
       and the card renders exactly as it always did. */
    var live = (opts.live && typeof opts.live === "object" && !Array.isArray(opts.live)) ? opts.live : null;
    var unaffordable = !!(live && live.affordable === false);

    var discInfo = getDisciplineInfo(tech.disc);
    var discColor = discInfo.color || "#38bdf8";
    var discName = (discInfo.name || tech.disc || "MARTIAL ARTS").toUpperCase();

    var typeInfo = TYPE_BADGES[tech.cls] || TYPE_BADGES.STRIKE;
    var heightTag = getAttackHeight(tech, opts);
    var keywords = getKeywords(tech);
    var power = tech.power !== undefined ? tech.power : 20;
    var acc = tech.acc !== undefined ? tech.acc : 90;
    var speed = tech.speed !== undefined ? tech.speed : 70;
    var stam = tech.stam !== undefined ? tech.stam : 6;
    var pointCost = opts.pointCost !== undefined ? opts.pointCost : (typeof DeckBuilder !== "undefined" ? DeckBuilder.costOf(tech.id) : 4);

    var heightColors = {
      HIGH: "#ef4444",
      MID: "#f59e0b",
      LOW: "#10b981",
      SPECIAL: "#a855f7",
    };
    var heightColor = heightColors[heightTag] || "#f59e0b";

    cx.save();

    if (disabled) {
      cx.globalAlpha = 0.45;
    } else if (unaffordable) {
      // Not enough stamina to throw it - the card must read as unusable.
      cx.globalAlpha = 0.42;
    }

    // 3D Perspective Pitch/Roll/Yaw & Fan Angle on Hover & Selection
    var angle = opts.fanAngle || 0;
    var pitch = opts.pitch || 0;
    var roll = opts.roll || 0;
    var tiltSkew = (opts.tiltSkew || 0) + (hovered ? -0.015 : 0);
    var tiltScale = opts.scale || (selected ? 1.08 : (hovered ? 1.04 : 1.0));
    var midX = x + w / 2;
    var midY = y + h / 2;

    if (typeof cx.translate === "function") {
      cx.translate(midX, midY);
      if (angle !== 0 && typeof cx.rotate === "function") cx.rotate(angle);
      if ((pitch !== 0 || roll !== 0 || tiltSkew !== 0) && typeof cx.transform === "function") {
        cx.transform(1, pitch + roll, tiltSkew, 1, 0, 0);
      }
      if (tiltScale !== 1.0 && typeof cx.scale === "function") {
        cx.scale(tiltScale, tiltScale);
      }
      cx.translate(-midX, -midY);
    }

    // Archetype categorization
    var isSig = !!(tech.sig || tech.cls === "SIGNATURE");
    var isGuard = tech.cls === "GUARD";
    var isGrapple = (tech.cls === "THROW" || tech.cls === "SUB");
    var isMastered = false;
    if (typeof SAVE !== "undefined" && typeof discMasteryLevel === "function" && tech.disc) {
      isMastered = discMasteryLevel(SAVE, tech.disc) >= 5;
    }

    // 1. High-contrast tangible metallic card background & outer border
    var borderGrad = cx.createLinearGradient(x, y, x + w, y + h);
    if (selected) {
      if (isSig) {
        cx.shadowColor = "#fbbf24";
        cx.shadowBlur = 20;
        borderGrad.addColorStop(0, "#fef08a");
        borderGrad.addColorStop(0.3, "#f59e0b");
        borderGrad.addColorStop(0.7, "#fbbf24");
        borderGrad.addColorStop(1, "#b45309");
      } else if (isGuard) {
        cx.shadowColor = "#22d3ee";
        cx.shadowBlur = 20;
        borderGrad.addColorStop(0, "#a5f3fc");
        borderGrad.addColorStop(0.3, "#06b6d4");
        borderGrad.addColorStop(0.7, "#22d3ee");
        borderGrad.addColorStop(1, "#0e7490");
      } else if (isGrapple) {
        cx.shadowColor = "#c084fc";
        cx.shadowBlur = 20;
        borderGrad.addColorStop(0, "#e9d5ff");
        borderGrad.addColorStop(0.3, "#a855f7");
        borderGrad.addColorStop(0.7, "#c084fc");
        borderGrad.addColorStop(1, "#6b21a8");
      } else {
        cx.shadowColor = "#ef4444";
        cx.shadowBlur = 20;
        borderGrad.addColorStop(0, "#fca5a5");
        borderGrad.addColorStop(0.3, "#dc2626");
        borderGrad.addColorStop(0.7, "#ef4444");
        borderGrad.addColorStop(1, "#991b1b");
      }
      cx.strokeStyle = borderGrad;
      cx.lineWidth = 2.8;
    } else if (hovered) {
      cx.shadowColor = isMastered ? "#f59e0b" : (isSig ? "#fbbf24" : (isGuard ? "#22d3ee" : (isGrapple ? "#c084fc" : "#ef4444")));
      cx.shadowBlur = 16;
      borderGrad.addColorStop(0, isMastered ? "#fffbeb" : "#fde68a");
      borderGrad.addColorStop(0.3, isMastered ? "#f59e0b" : (isSig ? "#d97706" : (isGuard ? "#0891b2" : (isGrapple ? "#9333ea" : "#dc2626"))));
      borderGrad.addColorStop(0.7, isMastered ? "#fbbf24" : (isSig ? "#fbbf24" : (isGuard ? "#22d3ee" : (isGrapple ? "#c084fc" : "#ef4444"))));
      borderGrad.addColorStop(1, isMastered ? "#b45309" : "#1e293b");
      cx.strokeStyle = borderGrad;
      cx.lineWidth = 2.4;
    } else if (isMastered) {
      cx.shadowColor = "rgba(245, 158, 11, 0.45)";
      cx.shadowBlur = 10;
      borderGrad.addColorStop(0, "#fffbeb");
      borderGrad.addColorStop(0.25, "#fef08a");
      borderGrad.addColorStop(0.65, "#f59e0b");
      borderGrad.addColorStop(1, "#b45309");
      cx.strokeStyle = borderGrad;
      cx.lineWidth = 2.0;
    } else {
      if (isSig) {
        cx.shadowColor = "rgba(245, 158, 11, 0.4)";
        cx.shadowBlur = 8;
        borderGrad.addColorStop(0, "#fbbf24");
        borderGrad.addColorStop(0.4, "#92400e");
        borderGrad.addColorStop(0.7, "#78350f");
        borderGrad.addColorStop(1, "#451a03");
        cx.strokeStyle = borderGrad;
        cx.lineWidth = 2.0;
      } else if (isGuard) {
        cx.shadowColor = "rgba(34, 211, 238, 0.35)";
        cx.shadowBlur = 7;
        borderGrad.addColorStop(0, "#38bdf8");
        borderGrad.addColorStop(0.4, "#0e7490");
        borderGrad.addColorStop(0.7, "#155e75");
        borderGrad.addColorStop(1, "#082f49");
        cx.strokeStyle = borderGrad;
        cx.lineWidth = 1.8;
      } else if (isGrapple) {
        cx.shadowColor = "rgba(168, 85, 247, 0.35)";
        cx.shadowBlur = 7;
        borderGrad.addColorStop(0, "#c084fc");
        borderGrad.addColorStop(0.4, "#7e22ce");
        borderGrad.addColorStop(0.7, "#581c87");
        borderGrad.addColorStop(1, "#2e1065");
        cx.strokeStyle = borderGrad;
        cx.lineWidth = 1.8;
      } else {
        cx.shadowColor = "rgba(239, 68, 68, 0.35)";
        cx.shadowBlur = 7;
        borderGrad.addColorStop(0, "#f87171");
        borderGrad.addColorStop(0.4, "#991b1b");
        borderGrad.addColorStop(0.7, "#7f1d1d");
        borderGrad.addColorStop(1, "#450a0a");
        cx.strokeStyle = borderGrad;
        cx.lineWidth = 1.8;
      }
    }

    var cardGrad = cx.createLinearGradient(x, y, x + w, y + h);
    cardGrad.addColorStop(0, "#0c0f17");
    cardGrad.addColorStop(0.5, "#121622");
    cardGrad.addColorStop(1, "#080a10");

    cx.fillStyle = cardGrad;

    if (typeof cx.roundRect === "function") {
      cx.beginPath();
      cx.roundRect(x, y, w, h, 6);
      cx.fill();
      cx.stroke();
    } else {
      cx.fillRect(x, y, w, h);
      cx.strokeRect(x, y, w, h);
    }
    cx.shadowBlur = 0;

    // Cyber-Energy Circuit Lines (Subtle background etchings)
    cx.save();
    cx.globalAlpha = (selected ? 0.25 : (hovered ? 0.18 : 0.10));
    cx.strokeStyle = selected ? "#38bdf8" : (hovered ? "#fbbf24" : discColor);
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(x + 10, y + h - 30);
    cx.lineTo(x + 28, y + h - 12);
    cx.lineTo(x + w - 16, y + h - 12);
    cx.moveTo(x + w - 24, y + 28);
    cx.lineTo(x + w - 12, y + 40);
    cx.lineTo(x + w - 12, y + h - 35);
    cx.stroke();
    cx.restore();

    // Holographic Foil Sheen (Iridescent diagonal shimmering overlay)
    cx.save();
    var holoSpeed = isMastered ? 26 : 45;
    var holoShift = ((Date.now ? Date.now() : 0) / holoSpeed) % (w + h + 80) - 40;
    var holoGrad = cx.createLinearGradient(x + holoShift - 30, y + holoShift - 30, x + holoShift + 30, y + holoShift + 30);
    var baseAlpha = isMastered ? 0.32 : (selected ? 0.22 : (hovered ? 0.16 : 0.08));
    holoGrad.addColorStop(0, "rgba(255, 0, 128, 0)");
    holoGrad.addColorStop(0.25, "rgba(0, 240, 255, " + baseAlpha + ")");
    holoGrad.addColorStop(0.5, "rgba(255, 230, 0, " + (baseAlpha * 1.15) + ")");
    holoGrad.addColorStop(0.75, "rgba(160, 0, 255, " + baseAlpha + ")");
    holoGrad.addColorStop(1, "rgba(255, 0, 128, 0)");
    if (isMastered) cx.globalCompositeOperation = "lighter";
    cx.fillStyle = holoGrad;
    cx.fillRect(x + 2, y + 2, w - 4, h - 4);
    cx.restore();

    // Hotkey badge (e.g. [1]..[5])
    if (opts.hotkeyBadge) {
      cx.fillStyle = selected ? "#38bdf8" : (hovered ? "#fbbf24" : "rgba(15, 23, 42, 0.92)");
      cx.fillRect(x + 5, y - 9, 24, 13);
      cx.strokeStyle = selected ? "#7dd3fc" : (hovered ? "#fde68a" : "#475569");
      cx.lineWidth = 1;
      cx.strokeRect(x + 5, y - 9, 24, 13);
      cx.fillStyle = selected ? "#0a0c12" : (hovered ? "#0a0c12" : "#ffffff");
      cx.font = "bold 9px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(opts.hotkeyBadge, x + 17, y - 2.5);
    }

    // Inner bevel border
    cx.strokeStyle = "rgba(255, 255, 255, 0.10)";
    cx.lineWidth = 1;
    if (typeof cx.roundRect === "function") {
      cx.beginPath();
      cx.roundRect(x + 2, y + 2, w - 4, h - 4, 4);
      cx.stroke();
    } else {
      cx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    }

    // 2. Discipline Header Banner & Category Icon
    var bannerH = Math.max(20, Math.round(h * 0.15));
    var bannerColor = isSig ? "#d97706" : (isGuard ? "#0284c7" : (isGrapple ? "#7c3aed" : discColor));
    cx.fillStyle = bannerColor;
    cx.fillRect(x + 3, y + 3, w - 6, bannerH);

    // Left category icon chip
    var catChipBadge = isSig ? "★" : (isGuard ? "GRD" : typeInfo.badge);
    cx.fillStyle = isSig ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.4)";
    cx.fillRect(x + 5, y + 5, 22, bannerH - 4);
    cx.fillStyle = isSig ? "#fbbf24" : (isGuard ? "#a5f3fc" : "#ffffff");
    cx.font = "bold " + (isSig ? "12px" : "9px") + " 'Trebuchet MS', Bahnschrift, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(catChipBadge, x + 16, y + 3 + bannerH / 2);

    // Discipline / Archetype Name in Header
    cx.fillStyle = "#ffffff";
    cx.font = "bold 9.5px 'Trebuchet MS', Bahnschrift, sans-serif";
    cx.textAlign = "left";
    var maxDiscW = w - 40;
    var fittedDisc = isSig ? "★ SPECIAL MOVE" : (isGuard ? "DEFENSE / GUARD" : discName);
    if (cx.measureText(fittedDisc).width > maxDiscW) {
      fittedDisc = fittedDisc.slice(0, 11) + "..";
    }
    cx.fillText(fittedDisc, x + 30, y + 3 + bannerH / 2);

    // 3. Technique Name
    cx.fillStyle = "#f8fafc";
    // The live face needs the vertical room, so its name sits a touch tighter.
    var nameFontSize = live ? (w < 130 ? 10.5 : 12) : (w < 110 ? 10.5 : 12);
    cx.font = "bold " + nameFontSize + "px 'Trebuchet MS', Bahnschrift, sans-serif";
    cx.textAlign = "left";
    cx.textBaseline = "top";
    var nameY = y + bannerH + (live ? 4 : 6);
    var fittedName = (tech.name || "Technique").toUpperCase();
    if (cx.measureText(fittedName).width > w - 12) {
      var words = fittedName.split(" ");
      if (words.length > 1) {
        fittedName = words[0] + " " + words[1].slice(0, 4) + "..";
      } else {
        fittedName = fittedName.slice(0, 11) + "..";
      }
    }
    cx.fillText(fittedName, x + 6, nameY);

    if (live) {
      /* 4L. The live forecast face. The static dex numbers are actively
         misleading once range, comfort, position and guard are in play,
         so they are not drawn at all alongside it. */
      paintLiveFace(cx, x, y, w, h, tech, live, selected, nameY + nameFontSize + 3);
    } else {
      // 4. Attack Height & Range Badges
      var badgeY = nameY + nameFontSize + 5;
      var badgeH = 14;

      // Height badge (HIGH, MID, LOW, SPECIAL)
      cx.fillStyle = heightColor;
      cx.fillRect(x + 6, badgeY, 38, badgeH);
      cx.fillStyle = "#ffffff";
      cx.font = "bold 8px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(heightTag, x + 25, badgeY + badgeH / 2);

      // Range badge (LONG, MID, CLINCH, GROUND, ANY)
      var rangeStr = tech.range || "MID";
      cx.fillStyle = "rgba(255, 255, 255, 0.12)";
      cx.fillRect(x + 48, badgeY, 38, badgeH);
      cx.fillStyle = "#cbd5e1";
      cx.font = "bold 8px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillText(rangeStr, x + 67, badgeY + badgeH / 2);

      // 5. Stamina Cost Gem
      var gemX = x + w - 16;
      var gemY = badgeY + badgeH / 2;
      cx.fillStyle = "#0284c7";
      cx.strokeStyle = "#38bdf8";
      cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(gemX, gemY - 7);
      cx.lineTo(gemX + 7, gemY);
      cx.lineTo(gemX, gemY + 7);
      cx.lineTo(gemX - 7, gemY);
      cx.closePath();
      cx.fill();
      cx.stroke();

      cx.fillStyle = "#ffffff";
      cx.font = "bold 8.5px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(stam, gemX, gemY);

      // 6. Stats Grid (Power, Accuracy, Speed)
      var statBoxY = badgeY + badgeH + 6;
      var statBoxH = 26;
      cx.fillStyle = "rgba(10, 14, 20, 0.85)";
      cx.fillRect(x + 5, statBoxY, w - 10, statBoxH);
      cx.strokeStyle = "#252b3b";
      cx.lineWidth = 1;
      cx.strokeRect(x + 5, statBoxY, w - 10, statBoxH);

      // Power
      cx.fillStyle = "#ef4444";
      cx.font = "bold 8px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.fillText("POW", x + 20, statBoxY + 7);
      cx.fillStyle = "#ffffff";
      cx.font = "bold 11px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillText(power, x + 20, statBoxY + 18);

      // Accuracy
      cx.fillStyle = "#10b981";
      cx.font = "bold 8px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillText("ACC", x + w / 2, statBoxY + 7);
      cx.fillStyle = "#ffffff";
      cx.font = "bold 11px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillText(acc + "%", x + w / 2, statBoxY + 18);

      // Speed / Priority Initiative
      cx.fillStyle = tech.prio > 0 ? "#fbbf24" : "#38bdf8";
      cx.font = "bold 8px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillText(tech.prio > 0 ? "PRIO" : "SPD", x + w - 20, statBoxY + 7);
      cx.fillStyle = tech.prio > 0 ? "#fbbf24" : "#ffffff";
      cx.font = "bold 11px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.fillText(tech.prio > 0 ? "+" + tech.prio : speed, x + w - 20, statBoxY + 18);

      // 7. Keyword Tags
      var tagY = statBoxY + statBoxH + 6;
      var curTagX = x + 6;
      var tagCount = Math.min(2, keywords.length);

      for (var k = 0; k < tagCount; k++) {
        var kw = keywords[k];
        var kwW = kw.label.length * 5.2 + 8;
        if (curTagX + kwW > x + w - 4) break;
        cx.fillStyle = "rgba(15, 23, 42, 0.85)";
        cx.fillRect(curTagX, tagY, kwW, 14);
        cx.strokeStyle = kw.color;
        cx.lineWidth = 1;
        cx.strokeRect(curTagX, tagY, kwW, 14);

        cx.fillStyle = kw.color;
        cx.font = "bold 7.5px 'Trebuchet MS', Bahnschrift, sans-serif";
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText(kw.label, curTagX + kwW / 2, tagY + 7);
        curTagX += kwW + 4;
      }
    }

    // 8. Point Cost Badge or Combo Sequence Badge
    // The live note strip owns the foot of the card when it is drawn.
    if ((opts.showCost || opts.pointCost !== undefined) && !(live && selected && live.note)) {
      var pcY = y + h - 16;
      cx.fillStyle = "rgba(245, 158, 11, 0.15)";
      cx.fillRect(x + 5, pcY, w - 10, 13);
      cx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      cx.lineWidth = 1;
      cx.strokeRect(x + 5, pcY, w - 10, 13);

      cx.fillStyle = "#fbbf24";
      cx.font = "bold 8.5px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(pointCost + " PTS", x + w / 2, pcY + 6.5);
    }

    if (opts.comboIndex) {
      var glyph = COMBO_GLYPHS[opts.comboIndex - 1] || String(opts.comboIndex);
      var comboR = 10;
      var comboCx = x + w - comboR - 2;
      var comboCy = y + comboR + 2;

      cx.fillStyle = "#f59e0b";
      cx.shadowColor = "#f59e0b";
      cx.shadowBlur = 6;
      cx.beginPath();
      cx.arc(comboCx, comboCy, comboR, 0, Math.PI * 2);
      cx.fill();
      cx.shadowBlur = 0;

      cx.fillStyle = "#0a0c12";
      cx.font = "bold 11px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(glyph, comboCx, comboCy + 0.5);
    }

    cx.restore();
  }

  function paintCardHand(cx, x, y, cardIds, selectedIndex, opts) {
    if (!cx || !Array.isArray(cardIds)) return [];
    opts = opts || {};

    var count = cardIds.length;
    if (count === 0) return [];

    var cardW = opts.cardWidth || 120;
    var cardH = opts.cardHeight || 170;
    var gap = opts.gap !== undefined ? opts.gap : 14;
    var hoveredIdx = opts.hoveredIndex !== undefined ? opts.hoveredIndex : -1;
    var comboSeq = opts.comboSequence || [];
    var comboIndices = opts.comboIndices || {};
    var dealProg = opts.dealProgress !== undefined ? opts.dealProgress : 1.0;
    var isCurved = opts.curved !== false;
    /* Parallel to cardIds; entries may be null. Anything else (or nothing)
       leaves every card on the static dex face it has always drawn. */
    var liveArr = Array.isArray(opts.live) ? opts.live : null;
    /* The selected card used to lift a fixed 38px, which walks it into
       whatever banner sits above the hand. Callers can cap it now. */
    var liftPx = opts.liftPx !== undefined ? opts.liftPx : 38;
    var hoverLiftPx = opts.hoverLiftPx !== undefined ? opts.hoverLiftPx : Math.min(26, liftPx);
    var cardBoxes = [];

    var totalW = count * cardW + (count - 1) * gap;
    var startX = x !== undefined ? x : (960 - totalW) / 2;

    for (var i = 0; i < count; i++) {
      var norm = count > 1 ? (i - (count - 1) / 2) / ((count - 1) / 2) : 0;
      var cardX = startX + i * (cardW + gap);
      var cardY = y;
      var isSelected = (i === selectedIndex);
      var isHovered = (i === hoveredIdx);

      var fanAngle = isCurved ? norm * 0.07 : 0;
      var archY = isCurved ? Math.abs(norm) * Math.abs(norm) * 12 : 0;
      var pitch = isCurved ? (-0.04 + Math.abs(norm) * 0.02) : 0;
      var roll = isCurved ? (norm * 0.05) : 0;

      cardY += archY;

      // Dynamic dealing slide-in with spring curve
      if (dealProg < 1.0) {
        var cardDealDelay = i * 0.08;
        var cardProg = Math.max(0, Math.min(1, (dealProg - cardDealDelay) / 0.45));
        var springY = (1 - cardProg) * 60;
        cardY += springY;
      }

      // Spring elevation curves for selected & hovered states
      if (isSelected) {
        cardY -= liftPx;
        fanAngle = 0;
      } else if (isHovered) {
        cardY -= hoverLiftPx;
        fanAngle = fanAngle * 0.35;
      }

      var comboNum = 0;
      if (comboIndices[i] !== undefined) {
        comboNum = comboIndices[i];
      } else if (Array.isArray(comboSeq)) {
        var pos = comboSeq.indexOf(i);
        if (pos >= 0) comboNum = pos + 1;
      }

      var cardOpts = Object.assign({}, opts, {
        selected: isSelected,
        hovered: isHovered,
        comboIndex: comboNum,
        fanAngle: fanAngle,
        pitch: pitch,
        roll: roll,
        scale: isSelected ? 1.08 : (isHovered ? 1.04 : 1.0),
        hotkeyBadge: opts.hotkeys !== false ? ("[" + (i + 1) + "]") : null,
        live: liveArr ? (liveArr[i] || null) : null,
      });

      paintCard(cx, cardX, cardY, cardW, cardH, cardIds[i], cardOpts);

      cardBoxes.push({
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
        index: i,
        id: cardIds[i]
      });
    }

    return cardBoxes;
  }

  function paintStatStages(cx, x, y, statStages, opts) {
    if (!cx || !statStages) return;
    opts = opts || {};

    var stages = {
      ATK: statStages.atk !== undefined ? statStages.atk : (statStages.ATK || 0),
      DEF: statStages.def !== undefined ? statStages.def : (statStages.DEF || 0),
      SPD: statStages.spd !== undefined ? statStages.spd : (statStages.SPD || 0),
      ACC: statStages.acc !== undefined ? statStages.acc : (statStages.ACC || 0),
    };

    var statKeys = ["ATK", "DEF", "SPD", "ACC"];
    var curX = x;
    var badgeH = 16;
    var alignRight = !!opts.alignRight;

    cx.save();

    statKeys.forEach(function (statKey) {
      var val = stages[statKey];
      if (val === 0 && !opts.showZero) return;

      var isPos = val > 0;
      var isNeg = val < 0;
      var color = isPos ? "#10b981" : (isNeg ? "#ef4444" : "#64748b");
      var bg = isPos ? "rgba(16, 185, 129, 0.15)" : (isNeg ? "rgba(239, 68, 68, 0.15)" : "rgba(100, 116, 139, 0.15)");
      var chev = isPos ? "\u25B2" : (isNeg ? "\u25BC" : "-");
      var text = statKey + " " + (isPos ? "+" : "") + val + chev;
      var badgeW = statKey.length * 6 + 28;

      var drawX = alignRight ? curX - badgeW : curX;

      cx.fillStyle = bg;
      cx.fillRect(drawX, y, badgeW, badgeH);
      cx.strokeStyle = color;
      cx.lineWidth = 1;
      cx.strokeRect(drawX, y, badgeW, badgeH);

      cx.fillStyle = color;
      cx.font = "bold 9px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(text, drawX + badgeW / 2, y + badgeH / 2);

      curX = alignRight ? drawX - 4 : drawX + badgeW + 4;
    });

    cx.restore();
  }

  function paintStatusBadges(cx, x, y, conditions, opts) {
    if (!cx || !conditions) return;
    opts = opts || {};
    var alignRight = !!opts.alignRight || !!opts.alignR;
    var curX = x;
    var badgeH = 16;

    var condList = [];
    if (Array.isArray(conditions)) {
      condList = conditions.map(function (c) {
        return typeof c === "string" ? { key: c, turns: 1 } : { key: c.id || c.key, turns: c.turns || 1 };
      });
    } else if (typeof conditions === "object") {
      Object.keys(conditions).forEach(function (k) {
        var v = conditions[k];
        condList.push({
          key: k,
          turns: typeof v === "object" ? (v.turns !== undefined ? v.turns : 1) : (typeof v === "number" ? v : 1),
        });
      });
    }

    cx.save();

    condList.forEach(function (item) {
      var meta = STATUS_LABELS[item.key] || {
        name: String(item.key).replace(/_/g, " ").slice(0, 6).toUpperCase(),
        color: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.2)",
      };

      var label = meta.name + " " + item.turns + "T";
      var badgeW = label.length * 6.2 + 10;
      var drawX = alignRight ? curX - badgeW : curX;

      // Dark chassis
      cx.fillStyle = "rgba(11, 14, 20, 0.92)";
      cx.fillRect(drawX, y, badgeW, badgeH);
      cx.strokeStyle = meta.color;
      cx.lineWidth = 1;
      cx.strokeRect(drawX, y, badgeW, badgeH);

      // Left color accent notch
      cx.fillStyle = meta.color;
      cx.fillRect(drawX, y, 3, badgeH);

      // Text label
      cx.fillStyle = meta.color;
      cx.font = "bold 9px 'Trebuchet MS', Bahnschrift, sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(label, drawX + badgeW / 2 + 1, y + badgeH / 2);

      curX = alignRight ? drawX - 5 : drawX + badgeW + 5;
    });

    cx.restore();
  }

  return {
    paintCard: paintCard,
    paintCardHand: paintCardHand,
    paintStatStages: paintStatStages,
    paintStatusBadges: paintStatusBadges,
    getAttackHeight: getAttackHeight,
    getKeywords: getKeywords,
  };
})();

if (typeof window !== "undefined") {
  window.CardRenderer = CardRenderer;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = CardRenderer;
}
