// src/progress/create-fighter.js
// Register a Fighter: AZX Fighting League custom dossier builder
// Allocates the same 18 ATTR_KEYS ratings the roster dossiers use.

var CreateFighterMode = (function () {
  var PRESET_TWEAK_BUDGET = 30;
  var CUSTOM_POINT_BUDGET = 200;
  var STAT_MIN = 30;
  var STAT_MAX = 99;

  // Wizard names match in-game ceremony language (dossier, ratings, register).
  var WIZARD_STEPS = [
    { id: "gameplan", title: "GAMEPLAN", hint: "Choose how this contender enters the AZX league" },
    { id: "dossier", title: "DOSSIER", hint: "Name, nick, division, and primary discipline" },
    { id: "ratings", title: "RATINGS", hint: "Spend rating points across the 18 dossier attributes" },
    { id: "palette", title: "CORNER COLORS", hint: "Primary, secondary, and accent palette for roster art" },
    { id: "register", title: "REGISTER", hint: "Confirm the dossier and write them into your roster" }
  ];

  // Same keys and labels as ATTR_KEYS / ATTR_GROUPS in page.template.html
  var ATTR_KEYS = [
    "strength", "speed", "cardio", "footwork",
    "stand_off", "stand_def", "clinch_str_off", "clinch_str_def",
    "ground_str_off", "ground_str_def", "td_off", "td_def",
    "clinch_grp_off", "clinch_grp_def", "ground_grp_off", "ground_grp_def",
    "sub_off", "sub_def"
  ];

  var ATTR_LABELS = {
    strength: "Strength", speed: "Speed", cardio: "Cardio", footwork: "Footwork",
    stand_off: "Standing Offense", stand_def: "Standing Defense",
    clinch_str_off: "Clinch Strike Offense", clinch_str_def: "Clinch Strike Defense",
    ground_str_off: "Ground Strike Offense", ground_str_def: "Ground Strike Defense",
    td_off: "Takedown Offense", td_def: "Takedown Defense",
    clinch_grp_off: "Clinch Grapple Offense", clinch_grp_def: "Clinch Grapple Defense",
    ground_grp_off: "Ground Grapple Offense", ground_grp_def: "Ground Grapple Defense",
    sub_off: "Submission Offense", sub_def: "Submission Defense"
  };

  var ATTR_TOOLTIPS = {
    strength: "Physical power that feeds pressure traits",
    speed: "Initiative and focus meter growth",
    cardio: "Stamina pool and late-fight gas",
    footwork: "Range control and aerial traits",
    stand_off: "Mid-range striking output",
    stand_def: "Guard and standing shell",
    clinch_str_off: "Knees and elbows in the clinch",
    clinch_str_def: "Clinch damage resistance",
    ground_str_off: "Damage from top position",
    ground_str_def: "Defense under ground strikes",
    td_off: "Shoot and chain takedown success",
    td_def: "Sprawl and takedown denial",
    clinch_grp_off: "Clinch control and trips",
    clinch_grp_def: "Clinch scramble defense",
    ground_grp_off: "Positional control on the mat",
    ground_grp_def: "Escapes and bottom defense",
    sub_off: "Lock speed and finish threat",
    sub_def: "Submission awareness and escapes"
  };

  var ATTR_GROUPS = [
    { label: "PHYSICAL", keys: ["strength", "speed", "cardio", "footwork"] },
    { label: "STRIKING", keys: ["stand_off", "stand_def", "clinch_str_off", "clinch_str_def", "ground_str_off", "ground_str_def"] },
    { label: "GRAPPLING", keys: ["td_off", "td_def", "clinch_grp_off", "clinch_grp_def", "ground_grp_off", "ground_grp_def"] },
    { label: "SUBMISSION", keys: ["sub_off", "sub_def"] }
  ];

  function flatAttrs(v) {
    var o = {};
    for (var i = 0; i < ATTR_KEYS.length; i++) o[ATTR_KEYS[i]] = v;
    return o;
  }

  function mergeAttrs(base, patch) {
    var o = flatAttrs(50);
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) o[k] = base[k];
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) o[k] = patch[k];
    return o;
  }

  // Starters mirror ARCHETYPES + discipline specialties already in the league.
  var PRESETS = {
    pressure: {
      name: "Pressure Fighter", tag: "Walks you down and never resets the range",
      attrs: mergeAttrs(flatAttrs(52), {
        strength: 68, speed: 55, cardio: 60, footwork: 48,
        stand_off: 66, stand_def: 48, clinch_str_off: 62, clinch_str_def: 50,
        ground_str_off: 55, td_off: 58, td_def: 52
      }),
      discipline: "mma", stance: "orthodox", gameplan: "pressure"
    },
    counter: {
      name: "Counter-Striker", tag: "Waits for the commit, then makes you pay",
      attrs: mergeAttrs(flatAttrs(52), {
        strength: 52, speed: 62, cardio: 55, footwork: 64,
        stand_off: 62, stand_def: 72, clinch_str_def: 58,
        td_def: 58, sub_def: 55
      }),
      discipline: "boxing", stance: "southpaw", gameplan: "counter"
    },
    grappler: {
      name: "Grappler", tag: "Wants this on the mat and wants it there now",
      attrs: mergeAttrs(flatAttrs(50), {
        strength: 66, speed: 48, cardio: 62, footwork: 45,
        stand_off: 42, stand_def: 48, td_off: 78, td_def: 70,
        clinch_grp_off: 72, ground_grp_off: 74, sub_off: 68, sub_def: 62,
        ground_str_off: 60
      }),
      discipline: "wrestling", stance: "orthodox", gameplan: "grappler"
    },
    outfighter: {
      name: "Out-Fighter", tag: "Keeps it long and picks you apart from distance",
      attrs: mergeAttrs(flatAttrs(52), {
        strength: 50, speed: 66, cardio: 58, footwork: 72,
        stand_off: 68, stand_def: 60, clinch_str_off: 40, td_off: 38, td_def: 55,
        ground_str_off: 40, sub_off: 35
      }),
      discipline: "kickboxing", stance: "orthodox", gameplan: "outfighter"
    },
    finisher: {
      name: "Finisher", tag: "Swings for the ending and does not pace itself",
      attrs: mergeAttrs(flatAttrs(48), {
        strength: 78, speed: 50, cardio: 42, footwork: 44,
        stand_off: 78, stand_def: 40, clinch_str_off: 65, ground_str_off: 58,
        td_off: 45, td_def: 42, sub_off: 40, sub_def: 40
      }),
      discipline: "muaythai", stance: "orthodox", gameplan: "finisher"
    },
    boxing: {
      name: "Boxing Specialist", tag: "Hands-first pressure drawn from the dossier arts",
      attrs: mergeAttrs(flatAttrs(50), {
        strength: 58, speed: 64, cardio: 60, footwork: 68,
        stand_off: 74, stand_def: 68, clinch_str_off: 55, clinch_str_def: 58,
        td_off: 35, td_def: 55, sub_off: 30, sub_def: 45, ground_str_off: 40
      }),
      discipline: "boxing", stance: "orthodox", gameplan: "pressure"
    },
    bjj: {
      name: "Submission Artist", tag: "Guard pulls, sweeps, and fight-ending locks",
      attrs: mergeAttrs(flatAttrs(48), {
        strength: 48, speed: 52, cardio: 58, footwork: 48,
        stand_off: 40, stand_def: 48, td_off: 55, td_def: 55,
        ground_grp_off: 72, ground_grp_def: 68, sub_off: 80, sub_def: 74,
        ground_str_off: 50
      }),
      discipline: "bjj", stance: "orthodox", gameplan: "grappler"
    },
    balanced: {
      name: "League Contender", tag: "Well-rounded AZX entry with no glaring hole",
      attrs: mergeAttrs(flatAttrs(54), {
        strength: 54, speed: 54, cardio: 56, footwork: 54,
        stand_off: 54, stand_def: 54, td_off: 52, td_def: 52,
        sub_off: 50, sub_def: 52
      }),
      discipline: "mma", stance: "orthodox", gameplan: "pressure"
    }
  };

  var DISCIPLINES = [
    "boxing", "kickboxing", "muaythai", "taekwondo", "shotokan",
    "wrestling", "bjj", "judo", "sambo", "mma"
  ];

  var DISC_DISPLAY = {
    boxing: "Boxing", kickboxing: "Kickboxing", muaythai: "Muay Thai",
    taekwondo: "Taekwondo", shotokan: "Shotokan Karate", wrestling: "Wrestling",
    bjj: "Brazilian Jiu-Jitsu", judo: "Judo", sambo: "Sambo", mma: "MMA"
  };

  var STANCES = ["orthodox", "southpaw", "switch"];

  var WEIGHT_CLASSES = [
    { id: "Flyweight", ht: 66, wt: 125, rch: 67 },
    { id: "Bantamweight", ht: 67, wt: 135, rch: 68 },
    { id: "Featherweight", ht: 68, wt: 145, rch: 69 },
    { id: "Lightweight", ht: 69, wt: 155, rch: 70 },
    { id: "Welterweight", ht: 70, wt: 170, rch: 72 },
    { id: "Middleweight", ht: 72, wt: 185, rch: 74 },
    { id: "Light Heavyweight", ht: 74, wt: 205, rch: 78 },
    { id: "Heavyweight", ht: 76, wt: 240, rch: 80 }
  ];

  var COLOR_SWATCHES = ["#e03a2f", "#22d3ee", "#d8a24a", "#16a34a", "#7c3aed", "#f97316", "#ec4899", "#111318", "#f5f5f5"];

  // Shared data-deck indices already used by the roster for each art.
  var DISC_TO_DECK = {
    boxing: 0, kickboxing: 2, muaythai: 4, taekwondo: 1, shotokan: 3,
    wrestling: 7, bjj: 9, judo: 6, sambo: 13, mma: 18
  };

  var DISC_TO_STY = {
    boxing: ["Boxing"], kickboxing: ["Kickboxing"], muaythai: ["Muay Thai"],
    taekwondo: ["Taekwondo"], shotokan: ["Shotokan Karate"], wrestling: ["Wrestling"],
    bjj: ["Brazilian Jiu-Jitsu"], judo: ["Judo"], sambo: ["Sambo"], mma: ["MMA", "Boxing"]
  };

  function DEFAULT_DRAFT() {
    return {
      name: "New Contender",
      nickname: "League Entry",
      discipline: "mma",
      preset: "blank",
      buildMode: "custom",
      gameplan: "pressure",
      stance: "orthodox",
      weightClass: "Welterweight",
      heightIn: 70,
      reachIn: 72,
      age: 24,
      nationality: "American",
      colorPalette: { primary: "#e03a2f", secondary: "#111318", accent: "#22d3ee" },
      attributes: flatAttrs(50),
      availablePoints: CUSTOM_POINT_BUDGET,
      presetBaseline: null
    };
  }

  var fighterDraft = DEFAULT_DRAFT();

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function resetDraft() {
    var fresh = DEFAULT_DRAFT();
    var keys = Object.keys(fresh);
    for (var i = 0; i < keys.length; i++) fighterDraft[keys[i]] = fresh[keys[i]];
  }

  function init() { resetDraft(); }

  function getAllStatKeys() {
    var out = [];
    for (var g = 0; g < ATTR_GROUPS.length; g++) {
      for (var k = 0; k < ATTR_GROUPS[g].keys.length; k++) out.push(ATTR_GROUPS[g].keys[k]);
    }
    return out;
  }

  function getStatLabel(key) { return ATTR_LABELS[key] || key; }
  function getStatTooltip(key) { return ATTR_TOOLTIPS[key] || ""; }
  function getGroupForStat(key) {
    for (var g = 0; g < ATTR_GROUPS.length; g++) {
      if (ATTR_GROUPS[g].keys.indexOf(key) >= 0) return ATTR_GROUPS[g].label;
    }
    return "";
  }
  function getDisciplineName(id) { return DISC_DISPLAY[id] || id; }

  function setName(name) {
    fighterDraft.name = String(name || "New Contender").slice(0, 28);
  }
  function setNickname(nick) {
    fighterDraft.nickname = String(nick || "League Entry").slice(0, 32);
  }
  function setDiscipline(disc) {
    if (DISCIPLINES.indexOf(disc) > -1) fighterDraft.discipline = disc;
  }
  function setStance(stance) {
    if (STANCES.indexOf(stance) > -1) fighterDraft.stance = stance;
  }
  function setWeightClass(wc) {
    for (var i = 0; i < WEIGHT_CLASSES.length; i++) {
      if (WEIGHT_CLASSES[i].id === wc) {
        fighterDraft.weightClass = wc;
        fighterDraft.heightIn = WEIGHT_CLASSES[i].ht;
        fighterDraft.reachIn = WEIGHT_CLASSES[i].rch;
        return;
      }
    }
  }
  function setColor(type, hex) {
    if (fighterDraft.colorPalette[type] !== undefined) fighterDraft.colorPalette[type] = hex;
  }

  function applyBlankSlate() {
    fighterDraft.preset = "blank";
    fighterDraft.buildMode = "custom";
    fighterDraft.gameplan = "pressure";
    fighterDraft.attributes = flatAttrs(50);
    fighterDraft.availablePoints = CUSTOM_POINT_BUDGET;
    fighterDraft.presetBaseline = null;
    return true;
  }

  function applyPreset(presetId) {
    var p = PRESETS[presetId];
    if (!p) return false;
    fighterDraft.preset = presetId;
    fighterDraft.buildMode = "preset";
    fighterDraft.discipline = p.discipline;
    fighterDraft.stance = p.stance;
    fighterDraft.gameplan = p.gameplan || "pressure";
    fighterDraft.attributes = clone(p.attrs);
    // Strip accidental foreign keys from older drafts
    var clean = flatAttrs(50);
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      var key = ATTR_KEYS[i];
      if (typeof fighterDraft.attributes[key] === "number") clean[key] = fighterDraft.attributes[key];
    }
    fighterDraft.attributes = clean;
    fighterDraft.presetBaseline = clone(clean);
    fighterDraft.availablePoints = PRESET_TWEAK_BUDGET;
    return true;
  }

  function resetStatsToPreset() {
    if (!fighterDraft.presetBaseline) return false;
    fighterDraft.attributes = clone(fighterDraft.presetBaseline);
    fighterDraft.availablePoints = PRESET_TWEAK_BUDGET;
    return true;
  }

  function allocatePoint(attribute, amount) {
    if (fighterDraft.attributes[attribute] === undefined) return false;
    var newVal = fighterDraft.attributes[attribute] + amount;
    if (fighterDraft.availablePoints >= amount && newVal <= STAT_MAX && newVal >= STAT_MIN) {
      fighterDraft.attributes[attribute] = newVal;
      fighterDraft.availablePoints -= amount;
      if (fighterDraft.preset !== "blank") fighterDraft.preset = "custom";
      return true;
    }
    return false;
  }

  function toBioArray(attrs) {
    var a = attrs || fighterDraft.attributes;
    var out = [];
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      out.push(Math.max(STAT_MIN, Math.min(STAT_MAX, a[ATTR_KEYS[i]] || 50)));
    }
    return out;
  }

  function computeOvr(bioArr) {
    var sum = 0;
    for (var i = 0; i < bioArr.length; i++) sum += bioArr[i];
    return Math.round(sum / bioArr.length);
  }

  function weightForClass(wc) {
    for (var i = 0; i < WEIGHT_CLASSES.length; i++) {
      if (WEIGHT_CLASSES[i].id === wc) return WEIGHT_CLASSES[i].wt;
    }
    return 170;
  }

  function buildBio(attrsOverride) {
    var a = toBioArray(attrsOverride);
    var ovr = computeOvr(a);
    var wc = fighterDraft.weightClass || "Welterweight";
    var sty = DISC_TO_STY[fighterDraft.discipline] || ["MMA"];
    var presetLabel = fighterDraft.preset === "blank" ? "Custom Contender"
      : (PRESETS[fighterDraft.preset] ? PRESETS[fighterDraft.preset].name : "Custom Contender");
    return {
      ovr: ovr,
      div: wc,
      nick: fighterDraft.nickname,
      ht: fighterDraft.heightIn,
      wt: weightForClass(wc),
      rch: fighterDraft.reachIn,
      age: fighterDraft.age,
      nat: fighterDraft.nationality,
      sty: sty.slice(),
      str: [presetLabel, fighterDraft.stance.toUpperCase() + " STANCE", "OVR " + ovr],
      sig: (fighterDraft.nickname || "League Entry") + " - signature technique",
      born: fighterDraft.name + " - AZX League Entry - " + wc,
      a: a,
      custom: true,
      palette: clone(fighterDraft.colorPalette),
      preset: fighterDraft.preset,
      stance: fighterDraft.stance,
      gameplan: fighterDraft.gameplan
    };
  }

  function previewPresetBio(presetId) {
    var saved = clone(fighterDraft.attributes);
    var savedPreset = fighterDraft.preset;
    if (presetId && PRESETS[presetId]) fighterDraft.attributes = clone(PRESETS[presetId].attrs);
    var bio = buildBio();
    fighterDraft.attributes = saved;
    fighterDraft.preset = savedPreset;
    return bio;
  }

  function pointsSpent() {
    var budget = fighterDraft.buildMode === "custom" ? CUSTOM_POINT_BUDGET : PRESET_TWEAK_BUDGET;
    return budget - fighterDraft.availablePoints;
  }
  function pointBudget() {
    return fighterDraft.buildMode === "custom" ? CUSTOM_POINT_BUDGET : PRESET_TWEAK_BUDGET;
  }

  function canAdvanceFromStep(stepId) {
    if (stepId === "dossier") return fighterDraft.name && fighterDraft.name.length >= 2;
    if (stepId === "ratings") return fighterDraft.availablePoints === 0;
    return true;
  }

  function stepBlockReason(stepId) {
    if (stepId === "dossier" && (!fighterDraft.name || fighterDraft.name.length < 2)) {
      return "Enter a fighter name (2+ characters)";
    }
    if (stepId === "ratings" && fighterDraft.availablePoints > 0) {
      return "Spend " + fighterDraft.availablePoints + " remaining rating points";
    }
    return "";
  }

  function validate() {
    if (!fighterDraft.name || fighterDraft.name.length < 2) {
      return { ok: false, error: "Fighter name must be at least 2 characters" };
    }
    if (fighterDraft.availablePoints > 0) {
      return { ok: false, error: "Spend all " + fighterDraft.availablePoints + " remaining rating points" };
    }
    return { ok: true };
  }

  function finishFighter() {
    var check = validate();
    if (!check.ok) return check;
    var bio = buildBio();
    var deck = DISC_TO_DECK[fighterDraft.discipline];
    if (deck === undefined) deck = 0;
    return {
      ok: true,
      id: "entry_" + Date.now(),
      name: fighterDraft.name,
      nickname: fighterDraft.nickname,
      discipline: fighterDraft.discipline,
      deck: deck,
      role: "custom",
      colorPalette: clone(fighterDraft.colorPalette),
      attributes: clone(fighterDraft.attributes),
      bio: bio,
      preset: fighterDraft.preset,
      stance: fighterDraft.stance,
      gameplan: fighterDraft.gameplan,
      createdAt: Date.now()
    };
  }

  function loadDraft(saved) {
    if (!saved || typeof saved !== "object") return;
    resetDraft();
    if (saved.name) fighterDraft.name = saved.name;
    if (saved.nickname) fighterDraft.nickname = saved.nickname;
    if (saved.discipline) fighterDraft.discipline = saved.discipline;
    if (saved.stance) fighterDraft.stance = saved.stance;
    if (saved.preset) fighterDraft.preset = saved.preset;
    if (saved.gameplan) fighterDraft.gameplan = saved.gameplan;
    if (saved.colorPalette) fighterDraft.colorPalette = clone(saved.colorPalette);
    if (saved.attributes) {
      var clean = flatAttrs(50);
      for (var i = 0; i < ATTR_KEYS.length; i++) {
        var key = ATTR_KEYS[i];
        if (typeof saved.attributes[key] === "number") clean[key] = saved.attributes[key];
      }
      fighterDraft.attributes = clean;
    }
    if (saved.bio && saved.bio.div) fighterDraft.weightClass = saved.bio.div;
    if (saved.bio && saved.bio.ht) fighterDraft.heightIn = saved.bio.ht;
    if (saved.bio && saved.bio.rch) fighterDraft.reachIn = saved.bio.rch;
    fighterDraft.availablePoints = 0;
    fighterDraft.buildMode = saved.preset && saved.preset !== "blank" ? "preset" : "custom";
  }

  return {
    init: init,
    draft: fighterDraft,
    setName: setName,
    setNickname: setNickname,
    setDiscipline: setDiscipline,
    setStance: setStance,
    setWeightClass: setWeightClass,
    setColor: setColor,
    applyPreset: applyPreset,
    applyBlankSlate: applyBlankSlate,
    resetStatsToPreset: resetStatsToPreset,
    allocatePoint: allocatePoint,
    finishFighter: finishFighter,
    buildBio: buildBio,
    toBioArray: toBioArray,
    validate: validate,
    loadDraft: loadDraft,
    canAdvanceFromStep: canAdvanceFromStep,
    stepBlockReason: stepBlockReason,
    getAllStatKeys: getAllStatKeys,
    getStatLabel: getStatLabel,
    getStatTooltip: getStatTooltip,
    getGroupForStat: getGroupForStat,
    getDisciplineName: getDisciplineName,
    previewPresetBio: previewPresetBio,
    pointsSpent: pointsSpent,
    pointBudget: pointBudget,
    DISCIPLINES: DISCIPLINES,
    STANCES: STANCES,
    WEIGHT_CLASSES: WEIGHT_CLASSES,
    ATTR_GROUPS: ATTR_GROUPS,
    ATTR_KEYS: ATTR_KEYS,
    PRESETS: PRESETS,
    COLOR_SWATCHES: COLOR_SWATCHES,
    PRESET_IDS: Object.keys(PRESETS),
    WIZARD_STEPS: WIZARD_STEPS,
    PRESET_TWEAK_BUDGET: PRESET_TWEAK_BUDGET,
    CUSTOM_POINT_BUDGET: CUSTOM_POINT_BUDGET
  };
})();
