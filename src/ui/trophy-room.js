/* =====================================================================
   Aqua Zero Heavens Arena - Championship Trophy Room & Belts Showcase
   Luminara Digital

   Renders earned division championship belts, tournament trophies,
   and win streak rings.
   ===================================================================== */

const TrophyRoom = {
  state: {
    selectedIndex: 0,
  },

  getTrophyList: function(save) {
    const list = [];
    const pRank = (save && save.ranking && save.ranking.rankIndex) || 0;
    const peakRank = (save && save.ranking && save.ranking.peakRankIndex) || pRank;
    const streak = (save && save.streak) || 0;
    const bestStreak = (save && save.bestStreak) || streak;
    const towerMax = (save && save.tower && save.tower.unlockedFloors) || 1;
    const titles = (save && save.titles) || [];

    // Division Belts
    list.push({
      id: "BELT_COPPER",
      name: "Copper Belt (10th-7th Kyu)",
      cat: "DIVISION BELT",
      color: "#b45309",
      unlocked: peakRank >= 1,
      desc: "Earned by crossing into the Kyu competitive divisions.",
    });
    list.push({
      id: "BELT_BRONZE",
      name: "Bronze Belt (6th-4th Kyu)",
      cat: "DIVISION BELT",
      color: "#ca8a04",
      unlocked: peakRank >= 5,
      desc: "Earned by reaching the Upper Kyu bracket.",
    });
    list.push({
      id: "BELT_SILVER",
      name: "Silver Belt (3rd-1st Kyu)",
      cat: "DIVISION BELT",
      color: "#94a3b8",
      unlocked: peakRank >= 8,
      desc: "Earned by entering the Senior Kyu contender division.",
    });
    list.push({
      id: "BELT_GOLD",
      name: "Gold Belt (1st-3rd Dan)",
      cat: "DIVISION BELT",
      color: "#eab308",
      unlocked: peakRank >= 11,
      desc: "The Master's Dan belt. Permanent demotion protection earned.",
    });
    list.push({
      id: "BELT_SAPPHIRE",
      name: "Sapphire Belt (4th-6th Dan)",
      cat: "DIVISION BELT",
      color: "#0284c7",
      unlocked: peakRank >= 14,
      desc: "Earned by elite Dan masters dominating the ladder.",
    });
    list.push({
      id: "BELT_OBSIDIAN",
      name: "Obsidian Belt (7th-9th Dan)",
      cat: "DIVISION BELT",
      color: "#6366f1",
      unlocked: peakRank >= 17,
      desc: "Earned by Grandmasters on the threshold of the Heavens.",
    });
    list.push({
      id: "BELT_HEAVENS",
      name: "Heavens Arena World Championship Belt (10th Dan)",
      cat: "SUPREME TITLE",
      color: "#ec4899",
      unlocked: peakRank >= 20,
      desc: "The pinnacle of combat mastery. Champion of the Heavens Arena.",
    });

    // Streak Rings
    list.push({
      id: "RING_STREAK_5",
      name: "Iron Challenger Ring (5-Win Streak)",
      cat: "STREAK TROPHY",
      color: "#10b981",
      unlocked: bestStreak >= 5,
      desc: "Awarded for winning 5 consecutive bouts.",
    });
    list.push({
      id: "RING_STREAK_10",
      name: "Gold Dominance Ring (10-Win Streak)",
      cat: "STREAK TROPHY",
      color: "#fbbf24",
      unlocked: bestStreak >= 10,
      desc: "Awarded for winning 10 consecutive bouts.",
    });

    // Tower Badges
    list.push({
      id: "TOWER_FL50",
      name: "Tower 50th Floor Crest",
      cat: "TOWER ASCENSION",
      color: "#38bdf8",
      unlocked: towerMax >= 50,
      desc: "Defeated Floor Master 50 in the Heavens Arena Tower.",
    });
    list.push({
      id: "TOWER_FL100",
      name: "Tower 100th Floor Crest",
      cat: "TOWER ASCENSION",
      color: "#a855f7",
      unlocked: towerMax >= 100,
      desc: "Reached the century mark in the Heavens Arena Tower.",
    });
    list.push({
      id: "TOWER_FL200",
      name: "Crown of the 200th Floor",
      cat: "TOWER ASCENSION",
      color: "#f43f5e",
      unlocked: towerMax >= 200,
      desc: "Conquered all 200 floors of the Heavens Arena Tower.",
    });

    return list;
  },

  handleInput: function(action, state, save) {
    const s = state || this.state;
    const list = this.getTrophyList(save);
    if (action === "UP") {
      s.selectedIndex = Math.max(0, s.selectedIndex - 1);
    } else if (action === "DOWN") {
      s.selectedIndex = Math.min(Math.max(0, list.length - 1), s.selectedIndex + 1);
    }
    return s;
  },

  render: function(ctx, w, h, save, state) {
    if (!ctx) return;
    const s = state || this.state;
    const list = this.getTrophyList(save);
    const sel = list[s.selectedIndex] || list[0];

    ctx.save();

    // Background
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, w, h);

    // Header
    ctx.fillStyle = "#fbbf24";
    ctx.font = "italic 900 24px Bahnschrift, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("CHAMPIONSHIP TROPHY ROOM", 32, 42);

    let unlockedCount = 0;
    list.forEach(function(item) { if (item.unlocked) unlockedCount++; });
    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 12px Bahnschrift, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("TROPHIES CLAIMED: " + unlockedCount + "/" + list.length, w - 32, 42);

    // Trophy List (Left column)
    const listX = 32, listY = 64, listW = 340, rowH = 36;
    const visibleCount = 9;
    const startIdx = Math.max(0, Math.min(s.selectedIndex - 4, Math.max(0, list.length - visibleCount)));

    for (let i = 0; i < visibleCount && (startIdx + i) < list.length; i++) {
      const idx = startIdx + i;
      const it = list[idx];
      const isSel = idx === s.selectedIndex;

      ctx.fillStyle = isSel ? "rgba(245, 158, 11, 0.2)" : (i % 2 === 0 ? "#11141c" : "#141822");
      ctx.fillRect(listX, listY + i * rowH, listW, rowH - 2);

      if (isSel) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(listX, listY + i * rowH, listW, rowH - 2);
      }

      // Trophy Icon / Pip
      ctx.fillStyle = it.unlocked ? it.color : "#475569";
      ctx.fillRect(listX + 8, listY + i * rowH + 8, 6, rowH - 18);

      ctx.fillStyle = it.unlocked ? (isSel ? "#ffffff" : "#e2e8f0") : "#64748b";
      ctx.font = isSel ? "bold 12.5px Bahnschrift, sans-serif" : "12.5px Bahnschrift, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(it.name, listX + 22, listY + i * rowH + 22);

      ctx.fillStyle = it.unlocked ? it.color : "#475569";
      ctx.font = "bold 9.5px Bahnschrift, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(it.unlocked ? "CLAIMED" : "LOCKED", listX + listW - 10, listY + i * rowH + 22);
    }

    // Detail Showcase (Right Pane)
    if (sel) {
      const detailX = 390, detailY = 64, detailW = w - 422, detailH = 324;
      ctx.fillStyle = "#11141c";
      ctx.strokeStyle = sel.unlocked ? sel.color : "#374151";
      ctx.lineWidth = 1.5;
      ctx.fillRect(detailX, detailY, detailW, detailH);
      ctx.strokeRect(detailX, detailY, detailW, detailH);

      // Category Tag
      ctx.fillStyle = sel.color;
      ctx.font = "bold 11px Bahnschrift, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(sel.cat, detailX + 24, detailY + 36);

      // Trophy Name
      ctx.fillStyle = sel.unlocked ? "#ffffff" : "#94a3b8";
      ctx.font = "italic 900 20px Bahnschrift, sans-serif";
      ctx.fillText(sel.name, detailX + 24, detailY + 64);

      // Status Banner
      ctx.fillStyle = sel.unlocked ? "rgba(16, 185, 129, 0.2)" : "rgba(100, 116, 139, 0.2)";
      ctx.fillRect(detailX + 24, detailY + 84, 160, 26);
      ctx.fillStyle = sel.unlocked ? "#10b981" : "#94a3b8";
      ctx.font = "bold 11px Bahnschrift, sans-serif";
      ctx.fillText(sel.unlocked ? "[ AWARD CLAIMED ]" : "[ UNCLAIMED ]", detailX + 34, detailY + 101);

      // Description & Lore
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "13px Bahnschrift, sans-serif";
      ctx.fillText(sel.desc, detailX + 24, detailY + 144);

      // Visual Trophy Belt Graphic representation
      ctx.fillStyle = sel.unlocked ? sel.color : "#334155";
      ctx.beginPath();
      ctx.arc(detailX + detailW / 2, detailY + 230, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0a0c12";
      ctx.beginPath();
      ctx.arc(detailX + detailW / 2, detailY + 230, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = sel.unlocked ? "#fbbf24" : "#475569";
      ctx.font = "900 14px Bahnschrift, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("AZHA", detailX + detailW / 2, detailY + 235);
    }

    // Footer
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px Bahnschrift, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UP/DOWN: Browse Trophies   B: Return to Menu", w / 2, h - 20);

    ctx.restore();
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = TrophyRoom;
}
