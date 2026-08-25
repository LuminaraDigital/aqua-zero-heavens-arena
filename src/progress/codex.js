/* =====================================================================
   Aqua Zero Heavens Arena - Martial Arts Codex & Technique Compendium
   Luminara Digital

   Tracks mastery across all 425 techniques and 20 disciplines.
   Tiers: UNSEEN -> DISCOVERED -> PRACTITIONER -> ADEPT -> EXPERT -> GRANDMASTER.
   Provides completionist statistics, mastery badges, and titles.
   ===================================================================== */

const CODEX_TIERS = [
  { tier: 0, id: "UNSEEN", label: "Unseen", needUses: 0, needKOs: 0, color: "#6b7280" },
  { tier: 1, id: "DISCOVERED", label: "Discovered", needUses: 1, needKOs: 0, color: "#9ca3af" },
  { tier: 2, id: "PRACTITIONER", label: "Practitioner (Bronze)", needUses: 5, needKOs: 1, color: "#d97706" },
  { tier: 3, id: "ADEPT", label: "Adept (Silver)", needUses: 15, needKOs: 3, color: "#cbd5e1" },
  { tier: 4, id: "EXPERT", label: "Expert (Gold)", needUses: 30, needKOs: 8, color: "#fbbf24" },
  { tier: 5, id: "GRANDMASTER", label: "Grandmaster", needUses: 50, needKOs: 15, color: "#ec4899" },
];

function DEF_CODEX() {
  return {
    v: 1,
    entries: {}, // techId: { uses, kos, maxDmg, firstUsedAt }
  };
}

function codexNormalize(raw) {
  const out = DEF_CODEX();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  if (raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries)) {
    for (const id in raw.entries) {
      if (typeof id === "string" && !id.startsWith("__")) {
        const item = raw.entries[id];
        if (item && typeof item === "object") {
          out.entries[id] = {
            uses: Math.max(0, Math.min(9999, Math.round(item.uses || 0))),
            kos: Math.max(0, Math.min(9999, Math.round(item.kos || 0))),
            maxDmg: Math.max(0, Math.min(9999, Math.round(item.maxDmg || 0))),
          };
        }
      }
    }
  }
  return out;
}

function codexTierFor(uses, kos) {
  const u = Math.max(0, uses || 0);
  const k = Math.max(0, kos || 0);
  let best = CODEX_TIERS[0];
  for (let i = 0; i < CODEX_TIERS.length; i++) {
    const t = CODEX_TIERS[i];
    if (u >= t.needUses && k >= t.needKOs) {
      best = t;
    }
  }
  return best;
}

function codexRecordUse(codex, techId, dmg, isKO) {
  if (!codex || !techId) return;
  if (!codex.entries) codex.entries = {};
  if (!codex.entries[techId]) {
    codex.entries[techId] = { uses: 0, kos: 0, maxDmg: 0 };
  }
  const entry = codex.entries[techId];
  entry.uses = (entry.uses || 0) + 1;
  if (dmg && dmg > (entry.maxDmg || 0)) entry.maxDmg = dmg;
  if (isKO) entry.kos = (entry.kos || 0) + 1;
}

function codexDisciplineStats(codex, discId) {
  const safeCodex = codexNormalize(codex);
  const techMap = (typeof TECH !== "undefined" && TECH) || (typeof global !== "undefined" && global.TECH);
  if (!techMap) return { total: 0, discovered: 0, mastered: 0, percent: 0 };

  let total = 0;
  let discovered = 0;
  let mastered = 0;

  for (const id in techMap) {
    const t = techMap[id];
    if (t && t.disc === discId) {
      total++;
      const entry = safeCodex.entries[id];
      if (entry && entry.uses > 0) {
        discovered++;
        const tier = codexTierFor(entry.uses, entry.kos);
        if (tier.tier >= 4) mastered++; // Expert or Grandmaster
      }
    }
  }

  const percent = total > 0 ? Math.round((discovered / total) * 100) : 0;
  return { total, discovered, mastered, percent };
}

function codexTotalStats(codex) {
  const safeCodex = codexNormalize(codex);
  const techMap = (typeof TECH !== "undefined" && TECH) || (typeof global !== "undefined" && global.TECH);
  if (!techMap) return { total: 425, discovered: 0, mastered: 0, percent: 0 };

  let total = 0;
  let discovered = 0;
  let mastered = 0;

  for (const id in techMap) {
    total++;
    const entry = safeCodex.entries[id];
    if (entry && entry.uses > 0) {
      discovered++;
      const tier = codexTierFor(entry.uses, entry.kos);
      if (tier.tier >= 4) mastered++;
    }
  }

  const percent = total > 0 ? Math.round((discovered / total) * 100) : 0;
  return { total, discovered, mastered, percent };
}

const Codex = {
  CODEX_TIERS,
  DEF_CODEX,
  codexNormalize,
  codexTierFor,
  codexRecordUse,
  codexDisciplineStats,
  codexTotalStats,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Codex;
}
