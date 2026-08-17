/* =====================================================================
   Aqua Zero Heavens Arena - rank table
   Luminara Digital

   The real kyu/dan grading used by karate, judo and Go: you climb DOWN
   through the kyu grades as a student (10th Kyu -> 1st Kyu), then cross
   into the dan grades and climb UP as a master (1st Dan -> 10th Dan).

   Every rank carries an `index` - a single ordered number across the whole
   ladder - because all the point maths cares about is the gap between two
   fighters, not which side of the kyu/dan line they sit on.

     index 0        Beginner
     index 1..10    10th Kyu .. 1st Kyu
     index 11..20   1st Dan  .. 10th Dan
   ===================================================================== */
const RANK_DIVISIONS = [
  { id: "unranked", name: "Unranked", color: "#6b7280" },
  { id: "copper",   name: "Copper",   color: "#b87333" },
  { id: "bronze",   name: "Bronze",   color: "#cd7f32" },
  { id: "silver",   name: "Silver",   color: "#c0c4cc" },
  { id: "gold",     name: "Gold",     color: "#d8a24a" },
  { id: "sapphire", name: "Sapphire", color: "#3a8ae0" },
  { id: "obsidian", name: "Obsidian", color: "#8b5cf6" },
  { id: "heavens",  name: "Heavens",  color: "#22d3ee" },
];
const DIVISION = {};
RANK_DIVISIONS.forEach((d) => (DIVISION[d.id] = d));

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

/* cumulative promotion points required to hold each rank */
const RANK_THRESHOLDS = [
  0,                                                  // Beginner
  2, 5, 9, 14, 20, 27, 35, 44, 54, 65,                // 10th Kyu .. 1st Kyu
  80, 98, 119, 143, 170, 200, 234, 272, 314, 360,     // 1st Dan .. 10th Dan
];

function buildRankTable() {
  const out = [];
  out.push({ index: 0, type: "BEGINNER", grade: 0, title: "Beginner", short: "BEG",
             division: "unranked", color: DIVISION.unranked.color, threshold: RANK_THRESHOLDS[0] });
  for (let g = 10; g >= 1; g--) {                     // kyu: numbers fall as you improve
    const index = 11 - g;
    const division = g >= 7 ? "copper" : g >= 4 ? "bronze" : "silver";
    out.push({ index, type: "KYU", grade: g, title: ORDINAL[g] + " Kyu", short: g + "K",
               division, color: DIVISION[division].color, threshold: RANK_THRESHOLDS[index] });
  }
  for (let g = 1; g <= 10; g++) {                     // dan: numbers rise as you master
    const index = 10 + g;
    const division = g <= 3 ? "gold" : g <= 6 ? "sapphire" : g <= 9 ? "obsidian" : "heavens";
    out.push({ index, type: "DAN", grade: g, title: ORDINAL[g] + " Dan", short: g + "D",
               division, color: DIVISION[division].color, threshold: RANK_THRESHOLDS[index] });
  }
  return out;
}
const RANK_TABLE = buildRankTable();
const MAX_RANK_INDEX = RANK_TABLE.length - 1;         // 10th Dan
const FIRST_DAN_INDEX = 11;

const rankByIndex = (i) => RANK_TABLE[Math.max(0, Math.min(MAX_RANK_INDEX, i | 0))];
function rankByTitle(title) {
  const t = String(title).toLowerCase();
  return RANK_TABLE.find((r) => r.title.toLowerCase() === t) || null;
}
