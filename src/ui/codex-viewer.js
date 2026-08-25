/* =====================================================================
   Aqua Zero Heavens Arena - Martial Arts Codex UI Viewer
   Luminara Digital

   Renders the 425-card interactive Pokédex/Codex.
   Supports discipline filtering, card mastery inspection, and completion stats.
   ===================================================================== */

const CodexViewer = {
  state: {
    discIndex: 0,
    itemIndex: 0,
    scrollOffset: 0,
  },

  getDisciplineList: function() {
    const discMap = (typeof DISCIPLINES !== "undefined" && DISCIPLINES) || (typeof global !== "undefined" && global.DISCIPLINES);
    if (discMap) {
      return Object.keys(discMap);
    }
    return ["boxing", "muaythai", "judo", "bjj", "karate", "taekwondo", "sambo", "wrestling"];
  },

  getFilteredTechs: function(discId) {
    const techMap = (typeof TECH !== "undefined" && TECH) || (typeof global !== "undefined" && global.TECH);
    if (!techMap) return [];
    const list = [];
    for (const id in techMap) {
      const t = techMap[id];
      if (!discId || t.disc === discId) {
        list.push(t);
      }
    }
    return list;
  },

  handleInput: function(action, state) {
    const s = state || this.state;
    const discs = this.getDisciplineList();
    const currentDisc = discs[s.discIndex] || discs[0];
    const techs = this.getFilteredTechs(currentDisc);

    if (action === "UP") {
      s.itemIndex = Math.max(0, s.itemIndex - 1);
    } else if (action === "DOWN") {
      s.itemIndex = Math.min(Math.max(0, techs.length - 1), s.itemIndex + 1);
    } else if (action === "LEFT") {
      s.discIndex = (s.discIndex - 1 + discs.length) % discs.length;
      s.itemIndex = 0;
    } else if (action === "RIGHT") {
      s.discIndex = (s.discIndex + 1) % discs.length;
      s.itemIndex = 0;
    }
    return s;
  },

  render: function(ctx, w, h, save, state) {
    if (!ctx) return;
    const s = state || this.state;
    const discs = this.getDisciplineList();
    const currentDisc = discs[s.discIndex] || discs[0];
    const discMap = (typeof DISCIPLINES !== "undefined" && DISCIPLINES) || (typeof global !== "undefined" && global.DISCIPLINES) || {};
    const discObj = discMap[currentDisc] || { name: currentDisc.toUpperCase() };
    const techs = this.getFilteredTechs(currentDisc);
    const codexData = (save && save.codex) || (typeof DEF_CODEX === "function" ? DEF_CODEX() : { v: 1, entries: {} });
    const stats = typeof codexDisciplineStats === "function" ? codexDisciplineStats(codexData, currentDisc) : { total: 0, discovered: 0, percent: 0 };
    const totalStats = typeof codexTotalStats === "function" ? codexTotalStats(codexData) : { total: 425, discovered: 0, percent: 0 };

    ctx.save();

    // Background Panel
    ctx.fillStyle = "#0a0c12";
    ctx.fillRect(0, 0, w, h);

    // Header
    ctx.fillStyle = "#22d3ee";
    ctx.font = "italic 900 24px Bahnschrift, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("MARTIAL ARTS CODEX", 32, 42);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 12px Bahnschrift, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("TOTAL DEX MASTERY: " + totalStats.discovered + "/" + totalStats.total + " (" + totalStats.percent + "%)", w - 32, 42);

    // Discipline Tabs
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(32, 58, w - 64, 34);

    ctx.font = "bold 13px Bahnschrift, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("<  " + (discObj.name || currentDisc).toUpperCase() + "  (" + stats.discovered + "/" + stats.total + " MASTERED)  >", w / 2, 80);

    // Tech List (Left Column)
    const listX = 32, listY = 104, listW = 320, rowH = 34;
    const visibleCount = 10;
    const startIdx = Math.max(0, Math.min(s.itemIndex - 4, Math.max(0, techs.length - visibleCount)));

    for (let i = 0; i < visibleCount && (startIdx + i) < techs.length; i++) {
      const idx = startIdx + i;
      const t = techs[idx];
      const entry = (codexData.entries && codexData.entries[t.id]) || { uses: 0, kos: 0, maxDmg: 0 };
      const tier = typeof codexTierFor === "function" ? codexTierFor(entry.uses, entry.kos) : { id: "UNSEEN", color: "#6b7280" };
      const isSel = idx === s.itemIndex;

      ctx.fillStyle = isSel ? "rgba(34, 211, 238, 0.2)" : (i % 2 === 0 ? "#11141c" : "#141822");
      ctx.fillRect(listX, listY + i * rowH, listW, rowH - 2);

      if (isSel) {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(listX, listY + i * rowH, listW, rowH - 2);
      }

      // Tier Badge Pip
      ctx.fillStyle = tier.color;
      ctx.fillRect(listX + 6, listY + i * rowH + 8, 4, rowH - 18);

      ctx.fillStyle = entry.uses > 0 ? (isSel ? "#ffffff" : "#e2e8f0") : "#64748b";
      ctx.font = isSel ? "bold 13px Bahnschrift, sans-serif" : "13px Bahnschrift, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(t.name || t.id, listX + 16, listY + i * rowH + 21);

      ctx.fillStyle = tier.color;
      ctx.font = "bold 10px Bahnschrift, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(tier.id, listX + listW - 12, listY + i * rowH + 21);
    }

    // Selected Card Details (Right Pane)
    const card = techs[s.itemIndex];
    if (card) {
      const detailX = 370, detailY = 104, detailW = w - 402, detailH = 340;
      ctx.fillStyle = "#111827";
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 1;
      ctx.fillRect(detailX, detailY, detailW, detailH);
      ctx.strokeRect(detailX, detailY, detailW, detailH);

      const entry = (codexData.entries && codexData.entries[card.id]) || { uses: 0, kos: 0, maxDmg: 0 };
      const tier = typeof codexTierFor === "function" ? codexTierFor(entry.uses, entry.kos) : { label: "Unseen", color: "#6b7280" };

      // Card Title & Tier
      ctx.fillStyle = "#ffffff";
      ctx.font = "italic 900 20px Bahnschrift, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(card.name || card.id, detailX + 20, detailY + 34);

      ctx.fillStyle = tier.color;
      ctx.font = "bold 12px Bahnschrift, sans-serif";
      ctx.fillText("MASTERY: " + (tier.label || "UNSEEN").toUpperCase(), detailX + 20, detailY + 56);

      // Stats Grid
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px Bahnschrift, sans-serif";
      ctx.fillText("CLASS: " + (card.cls || "STRIKE"), detailX + 20, detailY + 88);
      ctx.fillText("RANGE: " + (card.range || "MID"), detailX + 160, detailY + 88);
      ctx.fillText("POWER: " + (card.power || 0), detailX + 20, detailY + 114);
      ctx.fillText("ACCURACY: " + (card.acc || 0) + "%", detailX + 160, detailY + 114);
      ctx.fillText("SPEED: " + (card.speed || 0), detailX + 20, detailY + 140);
      ctx.fillText("STAMINA COST: " + (card.stam || 0), detailX + 160, detailY + 140);

      // Career Stats with this technique
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 12px Bahnschrift, sans-serif";
      ctx.fillText("TECHNIQUE RECORD", detailX + 20, detailY + 180);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px Bahnschrift, sans-serif";
      ctx.fillText("Times Executed: " + entry.uses, detailX + 20, detailY + 204);
      ctx.fillText("KOs Landed: " + entry.kos, detailX + 20, detailY + 226);
      ctx.fillText("Record Damage Hit: " + entry.maxDmg + " pts", detailX + 20, detailY + 248);

      // Flavor / Flags
      if (card.desc) {
        ctx.fillStyle = "#67e8f9";
        ctx.font = "italic 11.5px Bahnschrift, sans-serif";
        ctx.fillText('"' + card.desc + '"', detailX + 20, detailY + 290);
      }
    }

    // Footer prompt
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px Bahnschrift, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UP/DOWN: Select Technique   LEFT/RIGHT: Change Discipline   B: Return to Menu", w / 2, h - 20);

    ctx.restore();
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CodexViewer;
}
