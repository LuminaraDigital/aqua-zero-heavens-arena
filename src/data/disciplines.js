/* =====================================================================
   Aqua Zero Heavens Arena - martial arts disciplines
   Luminara Digital

   Every discipline on the roster, with the ranges it owns and the bias it
   brings. A fighter draws their technique list from the disciplines named
   in their own dossier, so the roster's styles drive the movelists rather
   than a separate authoring pass.

   ranges  - where this art is at home: LONG (kicking), MID (punching),
             CLINCH (tie-up), GROUND (mat)
   bias    - multipliers applied to techniques of this discipline
   ===================================================================== */
const RANGES = ["LONG", "MID", "CLINCH", "GROUND"];
const RANGE_LABEL = { LONG: "KICKING", MID: "BOXING", CLINCH: "CLINCH", GROUND: "GROUND" };

const DISCIPLINES = {
  boxing:      { name: "Boxing",              ranges: ["MID"],              bias: { pow: 1.06, acc: 1.08, spd: 1.10, stam: 0.92 }, color: "#e05a3a" },
  kickboxing:  { name: "Kickboxing",          ranges: ["LONG", "MID"],      bias: { pow: 1.06, acc: 1.02, spd: 1.04, stam: 1.00 }, color: "#e08a3a" },
  muaythai:    { name: "Muay Thai",           ranges: ["LONG", "MID", "CLINCH"], bias: { pow: 1.14, acc: 1.00, spd: 0.96, stam: 1.06 }, color: "#d84a4a" },
  lethwei:     { name: "Lethwei",             ranges: ["MID", "CLINCH"],    bias: { pow: 1.20, acc: 0.92, spd: 0.96, stam: 1.10 }, color: "#c23b2f" },
  taekwondo:   { name: "Taekwondo",           ranges: ["LONG"],             bias: { pow: 1.12, acc: 0.92, spd: 1.12, stam: 1.04 }, color: "#3a8ae0" },
  shotokan:    { name: "Shotokan Karate",     ranges: ["LONG", "MID"],      bias: { pow: 1.08, acc: 1.02, spd: 1.04, stam: 0.96 }, color: "#4a7ad0" },
  kyokushin:   { name: "Kyokushin Karate",    ranges: ["MID", "CLINCH"],    bias: { pow: 1.14, acc: 1.00, spd: 0.94, stam: 1.08 }, color: "#5566c8" },
  kenpo:       { name: "Kenpo Karate",        ranges: ["MID"],              bias: { pow: 0.96, acc: 1.08, spd: 1.14, stam: 0.90 }, color: "#6a6ad0" },
  wushu:       { name: "Wushu",               ranges: ["LONG", "MID"],      bias: { pow: 1.02, acc: 0.98, spd: 1.16, stam: 0.94 }, color: "#3ac0b0" },
  sumo:        { name: "Sumo",                ranges: ["CLINCH"],           bias: { pow: 1.22, acc: 1.02, spd: 0.82, stam: 1.14 }, color: "#c08a3a" },
  judo:        { name: "Judo",                ranges: ["CLINCH"],           bias: { pow: 1.10, acc: 1.04, spd: 1.00, stam: 1.02 }, color: "#3aa06a" },
  wrestling:   { name: "Wrestling",           ranges: ["CLINCH", "GROUND"], bias: { pow: 1.06, acc: 1.08, spd: 1.02, stam: 1.08 }, color: "#4aa050" },
  grappling:   { name: "Grappling",           ranges: ["CLINCH", "GROUND"], bias: { pow: 1.02, acc: 1.08, spd: 1.02, stam: 1.04 }, color: "#5aa860" },
  sambo:       { name: "Sambo",               ranges: ["CLINCH", "GROUND"], bias: { pow: 1.08, acc: 1.02, spd: 1.02, stam: 1.04 }, color: "#7aa83a" },
  bjj:         { name: "Brazilian Jiu-Jitsu", ranges: ["GROUND"],           bias: { pow: 1.00, acc: 1.10, spd: 1.00, stam: 0.94 }, color: "#3a9ad8" },
  jiujitsu:    { name: "Jiu-Jitsu",           ranges: ["CLINCH", "GROUND"], bias: { pow: 1.00, acc: 1.06, spd: 1.02, stam: 0.96 }, color: "#4a8ad0" },
  subgrap:     { name: "Submission Grappling",ranges: ["GROUND"],           bias: { pow: 0.98, acc: 1.12, spd: 1.04, stam: 0.92 }, color: "#48a8c0" },
  mma:         { name: "MMA",                 ranges: ["MID", "CLINCH", "GROUND"], bias: { pow: 1.02, acc: 1.02, spd: 1.02, stam: 1.02 }, color: "#b0483a" },
  draka:       { name: "Draka",               ranges: ["MID", "CLINCH"],    bias: { pow: 1.08, acc: 0.98, spd: 1.04, stam: 1.04 }, color: "#9a5ac0" },
};

/* the dossiers spell these a few different ways - map every spelling onto one id */
const DISCIPLINE_ALIASES = {
  "boxing": "boxing", "kickboxing": "kickboxing", "muay thai": "muaythai", "lethwei": "lethwei",
  "taekwondo": "taekwondo", "tae kwon do": "taekwondo",
  "shotokan": "shotokan", "shotokan karate": "shotokan",
  "kyokushin karate": "kyokushin", "kyokushin": "kyokushin",
  "kenpo karate": "kenpo", "kenpo": "kenpo", "kempo": "kenpo",
  "wushu": "wushu", "sumo": "sumo", "judo": "judo",
  "wrestling": "wrestling", "freestyle wrestling": "wrestling", "greco-roman": "wrestling",
  "grappling": "grappling", "submission grappling": "subgrap",
  "sambo": "sambo", "brazilian jiu-jitsu": "bjj", "jiu-jitsu": "jiujitsu",
  "mma": "mma", "draka": "draka",
};
const disciplineId = (s) => DISCIPLINE_ALIASES[String(s || "").toLowerCase().trim()] || null;
