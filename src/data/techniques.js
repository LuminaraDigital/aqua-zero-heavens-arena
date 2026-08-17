/* =====================================================================
   Aqua Zero Heavens Arena - technique dex
   Luminara Digital

   Real named techniques from the twenty disciplines on the roster. Each
   entry is plain data - the resolver reads it, nothing is hardcoded per
   move - so adding a technique is a one-line change.

     T(id, name, discipline, class, range, power, acc, speed, stamina, learn, opts)

   class    STRIKE | THROW | SUB | GUARD | SETUP
   range    where it can be thrown: LONG | MID | CLINCH | GROUND | ANY
   power    base damage before discipline bias, traits and range fit
   acc      base hit chance, 0-100
   speed    initiative contribution - faster techniques resolve first
   stamina  cost to throw it; running empty leaves you WINDED
   learn    fighter level it becomes available at (1-9)
   opts     prio   initiative bracket, beats raw speed (jabs, sprawls)
            moves  the range the fight moves to when it lands
            eff    {st: status, ch: chance %} applied on hit
            req    range the fight must already be in for full effect
            flags  tags for the codex UI
   ===================================================================== */
const TECH = {};
function T(id, name, disc, cls, range, power, acc, speed, stam, learn, opts) {
  opts = opts || {};
  TECH[id] = {
    id, name, disc, cls, range, power, acc, speed, stam, learn,
    prio: opts.prio || 0, moves: opts.moves || null, eff: opts.eff || null,
    /* shift: relative range movement (+1 closer, -1 further). Used by
       footwork that steps in or out from wherever the fight currently is,
       as opposed to `moves`, which names an absolute destination. */
    shift: opts.shift || 0,
    /* pos: ring-position gate. "PRESSING" needs the other man trapped on
       the ropes or in the corner; "TRAPPED" needs it to be you. Null for
       almost the whole dex - see posOk() in battle/intent.js. */
    pos: opts.pos || null,
    flags: opts.flags || [], sig: false,
  };
  return TECH[id];
}

/* ---------------- Boxing ---------------- */
T("jab",          "Jab",                 "boxing", "STRIKE", "MID", 12, 96, 95,  4, 1, { prio: 1, flags: ["fast", "poke"] });
T("cross",        "Cross",               "boxing", "STRIKE", "MID", 24, 90, 78,  7, 1, { flags: ["power"] });
T("lead_hook",    "Lead Hook",           "boxing", "STRIKE", "MID", 26, 86, 74,  8, 2, { eff: { st: "STUNNED", ch: 12 } });
T("rear_hook",    "Rear Hook",           "boxing", "STRIKE", "MID", 30, 82, 68,  9, 3, { eff: { st: "STUNNED", ch: 16 } });
T("lead_upper",   "Lead Uppercut",       "boxing", "STRIKE", "MID", 27, 84, 72,  8, 3, { flags: ["inside"] });
T("rear_upper",   "Rear Uppercut",       "boxing", "STRIKE", "MID", 34, 78, 64, 10, 5, { eff: { st: "STUNNED", ch: 20 }, flags: ["launcher"] });
T("overhand",     "Overhand Right",      "boxing", "STRIKE", "MID", 38, 72, 60, 11, 6, { eff: { st: "STUNNED", ch: 24 }, flags: ["power"] });
T("liver_shot",   "Liver Shot",          "boxing", "STRIKE", "MID", 29, 84, 70,  9, 4, { eff: { st: "WINDED", ch: 40 }, flags: ["body"] });
T("check_hook",   "Check Hook",          "boxing", "STRIKE", "MID", 22, 88, 88,  7, 5, { prio: 1, flags: ["counter"] });
T("shoulder_roll","Shoulder Roll",       "boxing", "GUARD",  "MID",  0, 100, 90, 0, 2, { prio: 2, flags: ["parry"] });

/* ---------------- Kickboxing ---------------- */
T("switch_kick",  "Switch Kick",         "kickboxing", "STRIKE", "LONG", 32, 82, 72, 10, 3, {});
T("question_mark","Question Mark Kick",  "kickboxing", "STRIKE", "LONG", 36, 74, 66, 11, 6, { eff: { st: "STUNNED", ch: 18 }, flags: ["feint"] });
T("low_kick",     "Low Kick",            "kickboxing", "STRIKE", "LONG", 22, 92, 80,  6, 1, { eff: { st: "LEG_HURT", ch: 30 }, flags: ["leg"] });
T("cut_kick",     "Cut Kick",            "kickboxing", "STRIKE", "LONG", 19, 94, 86,  5, 2, { prio: 1, eff: { st: "OFF_BALANCE", ch: 30 } });
T("spin_backfist","Spinning Back Fist",  "kickboxing", "STRIKE", "MID",  35, 70, 62, 10, 6, { eff: { st: "STUNNED", ch: 26 }, flags: ["spin"] });
T("lead_teep",    "Lead Teep",           "kickboxing", "STRIKE", "LONG", 16, 94, 90,  5, 1, { prio: 1, moves: "LONG", flags: ["push"] });
T("combination",  "Three-Punch Combination", "kickboxing", "STRIKE", "MID", 30, 84, 70, 11, 4, { flags: ["multi"] });
T("high_guard",   "High Guard",          "kickboxing", "GUARD",  "ANY",   0, 100, 85, 0, 1, { prio: 2, flags: ["block"] });

/* ---------------- Muay Thai ---------------- */
T("teep",         "Teep",                "muaythai", "STRIKE", "LONG", 18, 94, 88,  5, 1, { prio: 1, moves: "LONG", flags: ["push"] });
T("mt_low_kick",  "Low Roundhouse",      "muaythai", "STRIKE", "LONG", 26, 90, 76,  7, 1, { eff: { st: "LEG_HURT", ch: 35 }, flags: ["leg"] });
T("mt_body_kick", "Body Roundhouse",     "muaythai", "STRIKE", "LONG", 32, 84, 70,  9, 3, { eff: { st: "WINDED", ch: 30 }, flags: ["body"] });
T("mt_head_kick", "Head Kick",           "muaythai", "STRIKE", "LONG", 42, 68, 62, 12, 7, { eff: { st: "STUNNED", ch: 34 }, flags: ["power"] });
T("horiz_elbow",  "Horizontal Elbow",    "muaythai", "STRIKE", "CLINCH", 30, 88, 78,  7, 3, { eff: { st: "BLEEDING", ch: 35 }, flags: ["cut"] });
T("spin_elbow",   "Spinning Elbow",      "muaythai", "STRIKE", "CLINCH", 40, 68, 60, 11, 7, { eff: { st: "BLEEDING", ch: 45 }, flags: ["cut", "power", "spin"] });
T("straight_knee","Straight Knee",       "muaythai", "STRIKE", "CLINCH", 28, 90, 74,  8, 2, { eff: { st: "WINDED", ch: 28 } });
T("flying_knee",  "Flying Knee",         "muaythai", "STRIKE", "MID",  44, 62, 58, 13, 8, { eff: { st: "STUNNED", ch: 38 }, flags: ["launcher", "power", "jump"] });
T("plum_clinch",  "Plum Clinch",         "muaythai", "SETUP",  "MID",   0, 92, 72,  6, 2, { moves: "CLINCH", eff: { st: "HELD", ch: 60 }, flags: ["tie-up"] });
T("clinch_knee",  "Clinch Knee",         "muaythai", "STRIKE", "CLINCH", 24, 94, 80,  6, 1, { prio: 1 });
T("leg_check",    "Leg Check",           "muaythai", "GUARD",  "ANY",   0, 100, 88, 0, 2, { prio: 2, flags: ["parry", "leg"] });

/* ---------------- Lethwei ---------------- */
T("lw_headbutt",  "Lethwei Headbutt",    "lethwei", "STRIKE", "CLINCH", 36, 74, 66, 10, 5, { eff: { st: "BLEEDING", ch: 50 }, flags: ["cut"] });
T("lw_elbow",     "Downward Elbow",      "lethwei", "STRIKE", "CLINCH", 33, 84, 72,  9, 4, { eff: { st: "BLEEDING", ch: 40 }, flags: ["cut"] });
T("lw_jump_knee", "Jumping Knee",        "lethwei", "STRIKE", "MID",  40, 66, 60, 12, 7, { eff: { st: "STUNNED", ch: 32 }, flags: ["launcher"] });
T("lw_cross",     "Lethwei Cross",       "lethwei", "STRIKE", "MID",  28, 86, 74,  8, 2, {});
T("lw_clinch",    "Clinch Break",        "lethwei", "SETUP",  "CLINCH", 8, 92, 82,  5, 3, { moves: "MID", flags: ["reset"] });
T("lw_shell",     "Defensive Shell",     "lethwei", "GUARD",  "ANY",   0, 100, 80, 0, 1, { prio: 2, flags: ["block"] });

/* ---------------- Taekwondo ---------------- */
T("ap_chagi",     "Ap Chagi",            "taekwondo", "STRIKE", "LONG", 20, 94, 90,  5, 1, { prio: 1 });
T("dollyo",       "Dollyo Chagi",        "taekwondo", "STRIKE", "LONG", 30, 86, 82,  8, 1, {});
T("yeop_chagi",   "Yeop Chagi",          "taekwondo", "STRIKE", "LONG", 34, 80, 74,  9, 3, { moves: "LONG", flags: ["push"] });
T("dwi_chagi",    "Dwi Chagi",           "taekwondo", "STRIKE", "LONG", 40, 68, 66, 11, 6, { eff: { st: "STUNNED", ch: 28 } });
T("naeryo",       "Naeryo Chagi",        "taekwondo", "STRIKE", "LONG", 36, 72, 70, 10, 5, { eff: { st: "STUNNED", ch: 24 }, flags: ["axe"] });
T("dwi_huryeo",   "Dwi Huryeo Chagi",    "taekwondo", "STRIKE", "LONG", 44, 62, 64, 12, 8, { eff: { st: "STUNNED", ch: 36 }, flags: ["power", "spin"] });
T("narae",        "Narae Chagi",         "taekwondo", "STRIKE", "LONG", 28, 88, 92,  8, 4, { prio: 1, flags: ["multi"] });
T("tornado_kick", "Tornado Kick",        "taekwondo", "STRIKE", "LONG", 42, 64, 68, 12, 7, { eff: { st: "STUNNED", ch: 30 }, flags: ["launcher", "spin"] });
T("miro_chagi",   "Miro Chagi",          "taekwondo", "STRIKE", "LONG", 15, 96, 94,  4, 2, { prio: 2, moves: "LONG", flags: ["push"] });
T("twio_dwi",     "Twio Dwi Chagi",      "taekwondo", "STRIKE", "LONG", 48, 56, 60, 14, 9, { eff: { st: "STUNNED", ch: 42 }, flags: ["power", "jump"] });

/* ---------------- Shotokan ---------------- */
T("oi_zuki",      "Oi-Zuki",             "shotokan", "STRIKE", "MID", 26, 90, 78,  7, 1, {});
T("gyaku_zuki",   "Gyaku-Zuki",          "shotokan", "STRIKE", "MID", 32, 84, 72,  9, 2, { flags: ["power"] });
T("kizami_zuki",  "Kizami-Zuki",         "shotokan", "STRIKE", "MID", 14, 96, 94,  4, 1, { prio: 1, flags: ["fast"] });
T("mae_geri",     "Mae-Geri",            "shotokan", "STRIKE", "LONG", 24, 90, 84,  6, 1, { prio: 1 });
T("mawashi_geri", "Mawashi-Geri",        "shotokan", "STRIKE", "LONG", 33, 82, 74,  9, 3, {});
T("yoko_geri",    "Yoko-Geri",           "shotokan", "STRIKE", "LONG", 30, 84, 76,  8, 3, { moves: "LONG" });
T("ushiro_geri",  "Ushiro-Geri",         "shotokan", "STRIKE", "LONG", 41, 66, 64, 12, 7, { eff: { st: "STUNNED", ch: 30 }, flags: ["spin"] });
T("gedan_barai",  "Gedan-Barai",         "shotokan", "GUARD",  "ANY",   0, 100, 86, 0, 2, { prio: 2, flags: ["parry"] });

/* ---------------- Kyokushin ---------------- */
T("seiken",       "Seiken Chudan-Zuki",  "kyokushin", "STRIKE", "MID", 30, 88, 74,  8, 1, { flags: ["body"] });
T("ky_low",       "Mawashi-Geri Gedan",  "kyokushin", "STRIKE", "LONG", 27, 90, 76,  7, 1, { eff: { st: "LEG_HURT", ch: 38 }, flags: ["leg"] });
T("hiza_geri",    "Hiza-Geri",           "kyokushin", "STRIKE", "CLINCH", 29, 90, 76,  8, 2, { eff: { st: "WINDED", ch: 26 } });
T("shita_zuki",   "Shita-Zuki",          "kyokushin", "STRIKE", "CLINCH", 31, 86, 72,  9, 4, { eff: { st: "WINDED", ch: 34 }, flags: ["body"] });
T("ura_mawashi",  "Ura-Mawashi-Geri",    "kyokushin", "STRIKE", "LONG", 43, 62, 62, 12, 8, { eff: { st: "STUNNED", ch: 34 }, flags: ["spin", "power"] });
T("sune_uke",     "Sune-Uke",            "kyokushin", "GUARD",  "ANY",   0, 100, 84, 0, 1, { prio: 2, flags: ["block", "leg"] });

/* ---------------- Kenpo ---------------- */
T("five_swords",  "Five Swords",         "kenpo", "STRIKE", "MID", 30, 86, 88,  9, 4, { flags: ["multi"] });
T("thunder_hammer","Thundering Hammers", "kenpo", "STRIKE", "MID", 27, 88, 84,  8, 3, { flags: ["multi"] });
T("chain_punch",  "Chain Punch",         "kenpo", "STRIKE", "MID", 20, 94, 96,  6, 1, { prio: 1, flags: ["multi", "fast"] });
T("sword_hand",   "Sword Hand",          "kenpo", "STRIKE", "MID", 24, 90, 86,  6, 1, { prio: 1 });
T("crashing_wings","Crashing Wings",     "kenpo", "STRIKE", "CLINCH", 32, 80, 78,  9, 5, { eff: { st: "OFF_BALANCE", ch: 32 } });
T("twirling_wings","Twirling Wings",     "kenpo", "GUARD",  "ANY",   0, 100, 92, 0, 3, { prio: 2, flags: ["parry"] });

/* ---------------- Wushu ---------------- */
T("butterfly",    "Butterfly Kick",      "wushu", "STRIKE", "LONG", 34, 74, 88, 10, 5, { flags: ["jump"] });
T("whirlwind",    "Whirlwind Kick",      "wushu", "STRIKE", "LONG", 38, 70, 84, 11, 6, { eff: { st: "STUNNED", ch: 24 }, flags: ["spin"] });
T("palm_strike",  "Palm Strike",         "wushu", "STRIKE", "MID", 22, 92, 90,  6, 1, { prio: 1 });
T("low_sweep",    "Low Sweep",           "wushu", "THROW",  "LONG", 18, 84, 86,  6, 2, { eff: { st: "OFF_BALANCE", ch: 55 }, moves: "GROUND", flags: ["sweep"] });
T("cannon_fist",  "Cannon Fist",         "wushu", "STRIKE", "MID", 33, 80, 76,  9, 4, {});
T("wu_tornado",   "Xuanfengjiao",        "wushu", "STRIKE", "LONG", 40, 66, 80, 11, 7, { eff: { st: "STUNNED", ch: 26 }, flags: ["spin", "jump"] });
T("crane_stance", "Crane Stance",        "wushu", "GUARD",  "ANY",   0, 100, 94, 0, 2, { prio: 2, flags: ["evade"] });

/* ---------------- Sumo ---------------- */
T("tsuppari",     "Tsuppari",            "sumo", "STRIKE", "CLINCH", 26, 92, 66,  7, 1, { flags: ["multi"] });
T("harite",       "Harite",              "sumo", "STRIKE", "CLINCH", 24, 90, 70,  6, 1, { eff: { st: "STUNNED", ch: 18 } });
T("yorikiri",     "Yorikiri",            "sumo", "THROW",  "CLINCH", 34, 86, 58,  9, 3, { moves: "CLINCH", eff: { st: "WINDED", ch: 30 } });
T("uwatenage",    "Uwatenage",           "sumo", "THROW",  "CLINCH", 42, 76, 54, 11, 6, { moves: "GROUND", eff: { st: "OFF_BALANCE", ch: 50 } });
T("hatakikomi",   "Hatakikomi",          "sumo", "THROW",  "CLINCH", 22, 88, 74,  6, 4, { moves: "GROUND", eff: { st: "OFF_BALANCE", ch: 65 }, flags: ["slap-down"] });
T("tachiai",      "Tachi-Ai",            "sumo", "SETUP",  "MID",   10, 90, 60,  7, 2, { moves: "CLINCH", flags: ["charge"] });
T("oshidashi",    "Oshidashi",           "sumo", "THROW",  "CLINCH", 30, 88, 62,  8, 2, { moves: "MID", flags: ["push"] });

/* ---------------- Judo ---------------- */
T("kuzushi",      "Kuzushi",             "judo", "SETUP",  "CLINCH",  6, 94, 80,  4, 1, { eff: { st: "OFF_BALANCE", ch: 70 }, flags: ["setup"] });
T("o_soto_gari",  "O-Soto-Gari",         "judo", "THROW",  "CLINCH", 36, 86, 66,  9, 1, { moves: "GROUND", eff: { st: "OFF_BALANCE", ch: 40 } });
T("o_uchi_gari",  "O-Uchi-Gari",         "judo", "THROW",  "CLINCH", 30, 88, 70,  8, 2, { moves: "GROUND" });
T("ko_uchi_gari", "Ko-Uchi-Gari",        "judo", "THROW",  "CLINCH", 26, 90, 76,  7, 2, { moves: "GROUND", prio: 1 });
T("seoi_nage",    "Seoi-Nage",           "judo", "THROW",  "CLINCH", 42, 78, 62, 11, 4, { moves: "GROUND", eff: { st: "STUNNED", ch: 22 } });
T("ippon_seoi",   "Ippon Seoi-Nage",     "judo", "THROW",  "CLINCH", 48, 70, 58, 13, 7, { moves: "GROUND", eff: { st: "STUNNED", ch: 32 }, flags: ["power"] });
T("uchi_mata",    "Uchi-Mata",           "judo", "THROW",  "CLINCH", 46, 72, 60, 12, 6, { moves: "GROUND", eff: { st: "STUNNED", ch: 26 } });
T("harai_goshi",  "Harai-Goshi",         "judo", "THROW",  "CLINCH", 44, 74, 62, 12, 5, { moves: "GROUND" });
T("tai_otoshi",   "Tai-Otoshi",          "judo", "THROW",  "CLINCH", 38, 82, 68, 10, 3, { moves: "GROUND" });
T("tomoe_nage",   "Tomoe-Nage",          "judo", "THROW",  "CLINCH", 34, 80, 72,  9, 5, { moves: "GROUND", flags: ["sacrifice"] });
T("kesa_gatame",  "Kesa-Gatame",         "judo", "SUB",    "GROUND", 20, 92, 64,  7, 3, { eff: { st: "PINNED", ch: 55 }, flags: ["pin"] });
/* judo does not end at the throw - ne-waza is half the art */
T("yoko_shiho",   "Yoko-Shiho-Gatame",   "judo", "SETUP",  "GROUND", 10, 92, 66,  6, 3, { eff: { st: "PINNED", ch: 55 }, flags: ["pin"] });
T("tate_shiho",   "Tate-Shiho-Gatame",   "judo", "SETUP",  "GROUND", 12, 90, 64,  6, 4, { eff: { st: "PINNED", ch: 60 }, flags: ["pin"] });
T("kami_shiho",   "Kami-Shiho-Gatame",   "judo", "SETUP",  "GROUND", 10, 92, 64,  6, 3, { eff: { st: "PINNED", ch: 55 }, flags: ["pin"] });
T("okuri_eri",    "Okuri-Eri-Jime",      "judo", "SUB",    "GROUND", 46, 78, 62, 11, 6, { eff: { st: "WINDED", ch: 60 }, flags: ["choke"] });
T("hadaka_jime",  "Hadaka-Jime",         "judo", "SUB",    "GROUND", 50, 74, 60, 12, 7, { eff: { st: "WINDED", ch: 65 }, flags: ["choke", "finisher"] });
T("sankaku_jime", "Sankaku-Jime",        "judo", "SUB",    "GROUND", 48, 74, 62, 12, 7, { eff: { st: "WINDED", ch: 60 }, flags: ["choke"] });
T("judo_juji",    "Ude-Hishigi-Juji-Gatame", "judo", "SUB", "GROUND", 47, 78, 64, 11, 5, { eff: { st: "ARM_HURT", ch: 62 }, flags: ["finisher"] });

/* ---------------- Wrestling ---------------- */
T("double_leg",   "Double Leg",          "wrestling", "THROW", "MID", 32, 84, 70,  9, 1, { moves: "GROUND", flags: ["takedown"] });
T("single_leg",   "Single Leg",          "wrestling", "THROW", "MID", 28, 88, 74,  8, 1, { moves: "GROUND", flags: ["takedown"] });
T("blast_double", "Blast Double",        "wrestling", "THROW", "MID", 42, 74, 62, 12, 6, { moves: "GROUND", eff: { st: "STUNNED", ch: 26 }, flags: ["takedown", "power"] });
T("ankle_pick",   "Ankle Pick",          "wrestling", "THROW", "CLINCH", 24, 90, 80,  7, 3, { moves: "GROUND", prio: 1 });
T("duck_under",   "Duck Under",          "wrestling", "SETUP", "CLINCH", 8, 92, 86,  5, 2, { eff: { st: "OFF_BALANCE", ch: 55 }, prio: 1 });
T("arm_drag",     "Arm Drag",            "wrestling", "SETUP", "CLINCH", 10, 90, 88,  5, 2, { eff: { st: "OFF_BALANCE", ch: 50 }, prio: 1 });
T("front_headlock","Front Headlock",     "wrestling", "SUB",   "CLINCH", 22, 88, 72,  7, 4, { eff: { st: "HELD", ch: 55 } });
T("suplex",       "Suplex",              "wrestling", "THROW", "CLINCH", 46, 70, 58, 13, 7, { moves: "GROUND", eff: { st: "STUNNED", ch: 34 }, flags: ["power"] });
T("whizzer",      "Whizzer",             "wrestling", "GUARD", "CLINCH",  0, 100, 82, 0, 3, { prio: 2, flags: ["counter"] });
T("sprawl",       "Sprawl",              "wrestling", "GUARD", "ANY",     0, 100, 96, 0, 1, { prio: 3, flags: ["anti-takedown"] });
/* the elite end of freestyle - kit material, learned late */
T("gut_wrench",   "Gut-Wrench Suplex",   "wrestling", "THROW", "GROUND", 44, 74, 60, 12, 8, { eff: { st: "STUNNED", ch: 30 }, flags: ["power", "elite"] });
T("lat_drop",     "Lat Drop",            "wrestling", "THROW", "CLINCH", 45, 72, 62, 12, 7, { moves: "GROUND", eff: { st: "STUNNED", ch: 28 }, flags: ["elite"] });
T("high_crotch",  "High-Crotch Blast",   "wrestling", "THROW", "MID",    43, 76, 64, 12, 7, { moves: "GROUND", flags: ["takedown", "elite"] });
T("ride",         "Positional Ride",     "wrestling", "SETUP", "GROUND",  8, 94, 70,  5, 3, { eff: { st: "PINNED", ch: 45 }, flags: ["control"] });

/* ---------------- Grappling / Sambo / Submission ---------------- */
T("body_lock",    "Body Lock",           "grappling", "SETUP", "CLINCH", 10, 92, 74,  6, 2, { eff: { st: "HELD", ch: 55 } });
T("chain_wrestle","Chain Wrestling",     "grappling", "SETUP", "CLINCH",  8, 94, 80,  5, 3, { eff: { st: "OFF_BALANCE", ch: 45 }, prio: 1 });
T("pummel",       "Pummel",              "grappling", "SETUP", "CLINCH",  6, 96, 84,  4, 1, { prio: 1, flags: ["position"] });
T("underhook",    "Underhook",           "grappling", "SETUP", "CLINCH",  8, 94, 78,  5, 2, { eff: { st: "HELD", ch: 40 } });
T("gr_ground_esc","Technical Stand-Up",  "grappling", "SETUP", "GROUND",  4, 92, 86,  6, 2, { moves: "MID", prio: 1, flags: ["escape"] });

T("sambo_throw",  "Sambo Throw",         "sambo", "THROW", "CLINCH", 40, 80, 66, 11, 4, { moves: "GROUND" });
T("hip_throw",    "Hip Throw",           "sambo", "THROW", "CLINCH", 34, 84, 70,  9, 2, { moves: "GROUND" });
T("heel_hook",    "Heel Hook",           "sambo", "SUB",   "GROUND", 52, 74, 62, 12, 7, { eff: { st: "LEG_HURT", ch: 70 }, flags: ["leglock", "finisher"] });
T("kneebar",      "Kneebar",             "sambo", "SUB",   "GROUND", 46, 78, 64, 11, 5, { eff: { st: "LEG_HURT", ch: 60 }, flags: ["leglock"] });
T("ankle_lock",   "Straight Ankle Lock", "sambo", "SUB",   "GROUND", 38, 84, 70,  9, 3, { eff: { st: "LEG_HURT", ch: 50 }, flags: ["leglock"] });
T("scarf_hold",   "Scarf Hold",          "sambo", "SETUP", "GROUND",  8, 92, 68,  5, 2, { eff: { st: "PINNED", ch: 50 }, flags: ["pin"] });
T("flying_armbar","Flying Armbar",       "sambo", "SUB",   "CLINCH", 50, 62, 60, 13, 8, { moves: "GROUND", eff: { st: "ARM_HURT", ch: 65 }, flags: ["finisher"] });
T("leg_entangle", "Leg Entanglement",    "sambo", "SETUP", "GROUND",  6, 94, 72,  5, 4, { eff: { st: "HELD", ch: 55 } });

T("leg_drag",     "Leg Drag",            "subgrap", "SETUP", "GROUND",  8, 94, 76,  5, 3, { eff: { st: "PINNED", ch: 50 } });
T("back_control", "Back Control",        "subgrap", "SETUP", "GROUND", 10, 90, 72,  6, 4, { eff: { st: "HELD", ch: 65 }, flags: ["dominant"] });
T("darce",        "D'Arce Choke",        "subgrap", "SUB",   "GROUND", 48, 76, 64, 11, 6, { eff: { st: "WINDED", ch: 60 }, flags: ["choke", "finisher"] });
T("anaconda",     "Anaconda Choke",      "subgrap", "SUB",   "GROUND", 46, 78, 66, 11, 6, { eff: { st: "WINDED", ch: 55 }, flags: ["choke"] });
T("north_south",  "North-South Choke",   "subgrap", "SUB",   "GROUND", 44, 80, 66, 10, 5, { eff: { st: "WINDED", ch: 55 }, flags: ["choke"] });

/* ---------------- Brazilian Jiu-Jitsu ---------------- */
T("guard_pull",   "Guard Pull",          "bjj", "SETUP", "CLINCH",  4, 94, 78,  5, 1, { moves: "GROUND", flags: ["position"] });
T("scissor_sweep","Scissor Sweep",       "bjj", "THROW", "GROUND", 24, 88, 76,  7, 2, { eff: { st: "OFF_BALANCE", ch: 50 }, flags: ["sweep"] });
T("hip_bump",     "Hip Bump Sweep",      "bjj", "THROW", "GROUND", 26, 86, 74,  7, 3, { eff: { st: "OFF_BALANCE", ch: 45 }, flags: ["sweep"] });
T("triangle",     "Triangle Choke",      "bjj", "SUB",   "GROUND", 50, 74, 64, 12, 5, { eff: { st: "WINDED", ch: 60 }, flags: ["choke", "finisher"] });
T("armbar",       "Juji-Gatame",         "bjj", "SUB",   "GROUND", 48, 78, 66, 11, 4, { eff: { st: "ARM_HURT", ch: 65 }, flags: ["finisher"] });
T("rnc",          "Rear Naked Choke",    "bjj", "SUB",   "GROUND", 56, 72, 60, 13, 7, { eff: { st: "WINDED", ch: 70 }, flags: ["choke", "finisher"] });
T("kimura",       "Kimura",              "bjj", "SUB",   "GROUND", 42, 82, 68, 10, 3, { eff: { st: "ARM_HURT", ch: 60 } });
T("guillotine",   "Guillotine",          "bjj", "SUB",   "CLINCH", 44, 78, 68, 11, 4, { moves: "GROUND", eff: { st: "WINDED", ch: 55 }, flags: ["choke"] });
T("omoplata",     "Omoplata",            "bjj", "SUB",   "GROUND", 40, 80, 66, 10, 5, { eff: { st: "ARM_HURT", ch: 55 } });
T("mount",        "Mount",               "bjj", "SETUP", "GROUND",  8, 92, 70,  6, 2, { eff: { st: "PINNED", ch: 60 }, flags: ["dominant"] });
T("back_take",    "Back Take",           "bjj", "SETUP", "GROUND", 10, 88, 72,  6, 4, { eff: { st: "HELD", ch: 60 }, flags: ["dominant"] });
T("americana",    "Americana",           "bjj", "SUB",   "GROUND", 38, 84, 68,  9, 2, { eff: { st: "ARM_HURT", ch: 50 } });

T("jj_wristlock", "Wrist Lock",          "jiujitsu", "SUB",   "CLINCH", 30, 86, 76,  8, 3, { eff: { st: "ARM_HURT", ch: 45 } });
T("jj_throw",     "Kote-Gaeshi",         "jiujitsu", "THROW", "CLINCH", 32, 84, 72,  9, 3, { moves: "GROUND", eff: { st: "ARM_HURT", ch: 35 } });
T("jj_break",     "Posture Break",       "jiujitsu", "SETUP", "GROUND",  6, 94, 78,  5, 2, { eff: { st: "OFF_BALANCE", ch: 50 } });

/* ---------------- MMA ---------------- */
T("gnp",          "Ground and Pound",    "mma", "STRIKE", "GROUND", 30, 88, 70,  9, 2, { eff: { st: "BLEEDING", ch: 30 } });
T("hammerfist",   "Hammerfist",          "mma", "STRIKE", "GROUND", 24, 92, 78,  7, 1, { prio: 1 });
T("elbow_guard",  "Elbow From Guard",    "mma", "STRIKE", "GROUND", 27, 86, 74,  8, 3, { eff: { st: "BLEEDING", ch: 40 }, flags: ["cut"] });
T("cage_press",   "Cage Press",          "mma", "SETUP",  "CLINCH", 10, 90, 68,  7, 3, { eff: { st: "WINDED", ch: 35 }, flags: ["control"] });
T("dirty_boxing", "Dirty Boxing",        "mma", "STRIKE", "CLINCH", 26, 90, 76,  7, 2, {});
T("superman",     "Superman Punch",      "mma", "STRIKE", "MID",  38, 72, 66, 11, 6, { eff: { st: "STUNNED", ch: 26 }, flags: ["launcher"] });
T("level_change", "Level Change",        "mma", "SETUP",  "MID",    4, 96, 88,  4, 1, { prio: 2, eff: { st: "OFF_BALANCE", ch: 40 }, flags: ["feint"] });
T("scramble",     "Scramble",            "mma", "SETUP",  "GROUND", 4, 90, 90,  6, 2, { moves: "MID", prio: 2, flags: ["escape"] });
T("wall_walk",    "Wall Walk",           "mma", "SETUP",  "GROUND", 4, 92, 84,  6, 3, { moves: "CLINCH", prio: 1, flags: ["escape"] });

/* ---------------- Draka ---------------- */
T("dr_throw",     "Draka Throw",         "draka", "THROW",  "CLINCH", 36, 82, 68, 10, 3, { moves: "GROUND" });
T("dr_combo",     "Draka Combination",   "draka", "STRIKE", "MID",  30, 84, 78,  9, 2, { flags: ["multi"] });
T("dr_takedown",  "Draka Takedown",      "draka", "THROW",  "MID",  30, 84, 72,  9, 2, { moves: "GROUND", flags: ["takedown"] });
T("dr_ground",    "Ground Strike",       "draka", "STRIKE", "GROUND", 28, 88, 72,  8, 3, {});
T("dr_break",     "Break Clinch",        "draka", "SETUP",  "CLINCH", 6, 92, 84,  5, 2, { moves: "MID", prio: 1, flags: ["reset"] });

/* ---------------- universal basics every fighter knows ---------------- */
T("basic_guard",  "Guard",               null, "GUARD",  "ANY",   0, 100, 82, 0, 1, { prio: 2, flags: ["block", "recover"] });
/* These two were inert for a long time: they had no `moves`, so "Close
   Distance" and "Create Space" cost stamina and did nothing. `shift` moves
   the fight one step along LONG-MID-CLINCH-GROUND relative to where it is,
   which is what a step in or a step out actually does. */
T("basic_close",  "Close Distance",      null, "SETUP",  "ANY",   4, 94, 80,  5, 1, { shift: 1, flags: ["reposition"] });
T("basic_break",  "Create Space",        null, "SETUP",  "ANY",   4, 94, 84,  5, 1, { prio: 1, shift: -1, flags: ["reposition"] });
T("basic_stand",  "Stand Up",            null, "SETUP",  "GROUND", 4, 92, 84,  6, 1, { moves: "MID", prio: 1, flags: ["escape"] });

/* ---------------- ringcraft ----------------
   The ring itself as a weapon. Every professional knows these four - they
   are how position play stops being weather that happens to you and
   becomes something you aim at.

     Cut The Ring     books heavy pressure - the walk-them-down button
     Circle Out       the escape roll (attemptEscape), finally on the menu
     Corner Barrage   only exists while THEY are trapped - the payoff
     Corner Reversal  only exists while YOU are trapped - swaps the corner */
T("ring_cut",     "Cut The Ring",        null, "SETUP",  "ANY",    5, 92, 78,  6, 2, { flags: ["shove", "reposition"] });
T("ring_circle",  "Circle Out",          null, "SETUP",  "ANY",    0, 100, 92, 0, 1, { prio: 1, pos: "TRAPPED", flags: ["circle", "reposition"] });
T("ring_barrage", "Corner Barrage",      null, "STRIKE", "MID",   31, 88, 70, 11, 3, { pos: "PRESSING", eff: { st: "STUNNED", ch: 22 }, flags: ["corner", "multi"] });
T("ring_reversal","Corner Reversal",     null, "THROW",  "CLINCH",16, 84, 76,  9, 2, { pos: "TRAPPED", eff: { st: "OFF_BALANCE", ch: 45 }, flags: ["reversal"] });

const BASIC_TECHS = ["basic_guard", "basic_close", "basic_break", "basic_stand",
                     "basic_punch", "basic_kick", "basic_tieup", "basic_sprawl",
                     "ring_cut", "ring_circle", "ring_barrage", "ring_reversal"];

/* What a fighter is doing while the corner works on them: covering up.
   Marked sig so it can never be drafted, sold or listed - the bag is the
   only door to it. */
T("corner_work", "Corner Work", null, "GUARD", "ANY", 0, 100, 60, 0, 1, { prio: 2, flags: ["block"] });
TECH.corner_work.sig = true;

/* ---------------- depth pass ----------------
   Single-discipline fighters were walking in with too few options, and a
   professional can throw a basic punch and defend a shot whatever their art.
   These fill out the thinner disciplines and widen the universal baseline. */
T("arm_triangle",  "Arm Triangle",        "subgrap", "SUB",   "GROUND", 46, 78, 64, 11, 5, { eff: { st: "WINDED", ch: 58 }, flags: ["choke"] });
T("ezekiel",       "Ezekiel Choke",       "subgrap", "SUB",   "GROUND", 40, 82, 68,  9, 4, { eff: { st: "WINDED", ch: 48 }, flags: ["choke"] });
T("bow_and_arrow", "Bow and Arrow Choke", "subgrap", "SUB",   "GROUND", 52, 72, 60, 12, 7, { eff: { st: "WINDED", ch: 65 }, flags: ["choke", "finisher"] });
T("crucifix",      "Crucifix",            "subgrap", "SETUP", "GROUND", 10, 90, 70,  6, 3, { eff: { st: "PINNED", ch: 58 }, flags: ["dominant"] });
T("sg_pass",       "Guard Pass",          "subgrap", "SETUP", "GROUND",  8, 92, 74,  5, 2, { eff: { st: "OFF_BALANCE", ch: 45 } });
T("sg_sweep",      "Butterfly Sweep",     "subgrap", "THROW", "GROUND", 24, 86, 76,  7, 2, { eff: { st: "OFF_BALANCE", ch: 50 }, flags: ["sweep"] });

T("snap_down",     "Snap Down",           "grappling", "SETUP", "CLINCH", 10, 92, 82,  5, 2, { eff: { st: "OFF_BALANCE", ch: 55 }, prio: 1 });
T("head_control",  "Collar Tie",          "grappling", "SETUP", "CLINCH",  8, 94, 78,  5, 1, { eff: { st: "HELD", ch: 45 } });
T("gr_lift",       "Body Lock Lift",      "grappling", "THROW", "CLINCH", 34, 82, 64,  9, 4, { moves: "GROUND" });

T("dr_knee",       "Draka Knee",          "draka", "STRIKE", "CLINCH", 27, 88, 76,  8, 3, { eff: { st: "WINDED", ch: 26 } });
T("dr_stance",     "Draka Stance",        "draka", "GUARD",  "ANY",     0, 100, 84, 0, 1, { prio: 2, flags: ["block"] });

T("jj_atemi",      "Atemi",               "jiujitsu", "STRIKE", "MID", 22, 90, 82,  6, 1, { prio: 1 });
T("jj_ude_garami", "Ude-Garami",          "jiujitsu", "SUB",   "GROUND", 40, 82, 68, 10, 4, { eff: { st: "ARM_HURT", ch: 55 } });
T("jj_shime",      "Shime-Waza",          "jiujitsu", "SUB",   "GROUND", 44, 78, 66, 11, 5, { eff: { st: "WINDED", ch: 55 }, flags: ["choke"] });

T("lw_upper",      "Lethwei Uppercut",    "lethwei", "STRIKE", "MID", 30, 84, 74,  8, 3, {});
T("lw_teep",       "Lethwei Teep",        "lethwei", "STRIKE", "LONG", 17, 94, 88,  5, 1, { prio: 1, moves: "LONG" });
T("ky_mae_geri",   "Mae-Geri Chudan",     "kyokushin", "STRIKE", "LONG", 25, 90, 82,  6, 1, { prio: 1 });
T("ky_gyaku",      "Gyaku-Zuki Chudan",   "kyokushin", "STRIKE", "MID", 32, 86, 74,  9, 3, { flags: ["body"] });
T("kp_claw",       "Raining Claw",        "kenpo", "STRIKE", "MID", 26, 88, 86,  7, 2, { flags: ["multi"] });
T("kp_twig",       "Snapping Twig",       "kenpo", "SUB",   "CLINCH", 28, 86, 80,  7, 4, { eff: { st: "ARM_HURT", ch: 45 } });

/* every professional can do these, whatever their art */
T("basic_punch",   "Lead Punch",          null, "STRIKE", "MID", 13, 94, 90,  4, 1, { prio: 1, flags: ["fundamental"] });
T("basic_kick",    "Front Kick",          null, "STRIKE", "LONG", 18, 90, 84,  5, 1, { flags: ["fundamental"] });
T("basic_tieup",   "Tie Up",              null, "SETUP",  "MID",   4, 92, 78,  5, 1, { moves: "CLINCH", flags: ["fundamental"] });
T("basic_sprawl",  "Takedown Defence",    null, "GUARD",  "ANY",   0, 100, 94, 0, 1, { prio: 3, flags: ["anti-takedown", "fundamental"] });

/* ==== imported from the training library - do not edit by hand, re-run tools/import-techniques.js ==== */
T("strangle_hold_from_the_bac", "Strangle Hold from the Back", "jiujitsu", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "WINDED", ch: 62}, flags: ["elite", "choke"] });   // rear stranglehold applied after getting behind
T("front_strangle_hold", "Front Strangle Hold", "jiujitsu", "SUB", "CLINCH", 32, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 54}, flags: ["choke"] });   // two-handed front stranglehold at the collar
T("closed_guard", "Closed Guard", "bjj", "SETUP", "GROUND", 4, 93, 86, 5, 2, { eff: {st: "HELD", ch: 28} });   // controls opponent between the legs from bottom
T("open_guard", "Open Guard", "bjj", "SETUP", "GROUND", 4, 93, 86, 5, 2, {});   // long-range guard with feet on hips or biceps
T("butterfly_guard", "Butterfly Guard", "bjj", "SETUP", "GROUND", 4, 93, 86, 5, 2, {});   // seated guard with instep hooks inside the thighs
T("half_guard", "Half Guard", "bjj", "SETUP", "GROUND", 4, 93, 86, 5, 2, { eff: {st: "OFF_BALANCE", ch: 33} });   // traps one leg to stall the pass and sweep
T("knee_mount", "Knee Mount", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "HELD", ch: 32} });   // drives knee onto belly for crushing control
T("rear_mount", "Rear Mount", "bjj", "SETUP", "GROUND", 8, 86, 78, 8, 4, { eff: {st: "HELD", ch: 36} });   // back control with both hooks sunk in
T("north_south_position", "North-South Position", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "HELD", ch: 32} });   // head-to-head control over the shoulders
T("spinning_armbar", "Spinning Armbar", "bjj", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "LEG_HURT", ch: 62}, flags: ["spin", "elite"] });   // spins over the trapped arm from knee mount
T("helicopter_armbar", "Helicopter Armbar", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "ARM_HURT", ch: 58}, flags: ["launcher"] });   // flips a lifting opponent overhead into an armbar
T("cross_collar_choke", "Cross Collar Choke", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "WINDED", ch: 58}, flags: ["choke"] });   // deep lapel grips strangle from guard or mount
T("sliding_collar_choke", "Sliding Collar Choke", "bjj", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "WINDED", ch: 62}, flags: ["elite", "choke"] });   // collar strangle slid in from rear mount
T("sleeve_choke", "Sleeve Choke", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "WINDED", ch: 58}, flags: ["choke"] });   // forearm-and-sleeve strangle across the throat
T("clock_choke", "Clock Choke", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "WINDED", ch: 58}, flags: ["choke"] });   // collar choke walking around a turtled opponent
T("achilles_lock", "Achilles Lock", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "LEG_HURT", ch: 58} });   // forearm crushes the Achilles to hyperextend the ankle
T("rolling_kneebar", "Rolling Kneebar", "bjj", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "LEG_HURT", ch: 62}, flags: ["elite"] });   // rolls over a turtled opponent into a kneebar
T("toehold", "Toehold", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "LEG_HURT", ch: 58} });   // figure-four foot twist attacking ankle and knee
T("knee_slide_pass", "Knee Slide Pass", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "BLEEDING", ch: 32} });   // cuts the knee across the thigh to pass guard
T("matador_pass", "Matador Pass", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, {});   // throws the legs aside and steps to knee mount
T("standing_guard_pass", "Standing Guard Pass", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, { moves: "MID" });   // stands up to open and pass the closed guard
T("sprawl_pass", "Sprawl Pass", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, { prio: 3 });   // sprawls hips to free the leg from half guard
T("flower_sweep", "Flower Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // pendulum leg swing dumps opponent to mount
T("push_sweep", "Push Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // pushes the knee to topple from closed guard
T("elevator_sweep", "Elevator Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { flags: ["launcher", "sweep"] });   // inside hook lifts and flips opponent overhead
T("double_ankle_grab_sweep", "Double Ankle Grab Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // grabs both ankles and topples opponent backward
T("handstand_sweep", "Handstand Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // bases on hands to off-balance a standing passer
T("sickle_sweep", "Sickle Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { flags: ["sweep"] });   // reaps the heel while pushing the hip
T("tripod_sweep", "Tripod Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // heel grip plus foot on hip fells standing opponent
T("overhead_balloon_sweep", "Overhead Balloon Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { flags: ["launcher", "sweep"] });   // feet on hips launch opponent overhead
T("spider_guard_sweep", "Spider Guard Sweep", "bjj", "THROW", "GROUND", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // bicep hooks off-balance opponent into a roll
T("upa_escape", "Upa Escape", "bjj", "GUARD", "GROUND", 0, 100, 86, 0, 2, { prio: 2 });   // bridges and rolls a mounted opponent over
T("elbow_knee_escape", "Elbow-Knee Escape", "bjj", "GUARD", "GROUND", 0, 100, 86, 0, 2, { prio: 2 });   // shrimps a knee inside to recover guard from mount
T("underhook_bridge_escape", "Underhook Bridge Escape", "bjj", "GUARD", "GROUND", 0, 100, 86, 0, 2, { prio: 2, flags: ["escape"] });   // escapes side mount to knees with an underhook
T("granby_roll", "Granby Roll", "bjj", "GUARD", "GROUND", 0, 100, 86, 0, 2, { prio: 2, flags: ["escape"] });   // inverted shoulder roll from turtle back to guard
T("sitout_to_the_back", "Sitout to the Back", "bjj", "GUARD", "GROUND", 0, 100, 82, 0, 3, { prio: 2 });   // sits through from turtle to take opponent's back
T("trap_arm_and_roll", "Trap Arm and Roll", "bjj", "GUARD", "GROUND", 0, 100, 82, 0, 3, { prio: 2 });   // traps the attacker's arm from turtle and rolls to top
T("giftwrap_back_take", "Giftwrap Back Take", "bjj", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "PINNED", ch: 32} });   // pins arm across the face and climbs to the back
T("flying_mare", "Flying Mare", "wrestling", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND", flags: ["jump"] });   // throws opponent over the shoulder by the arm
T("cross_buttock_throw", "Cross-Buttock Throw", "wrestling", "THROW", "CLINCH", 28, 83, 74, 9, 5, { flags: ["spin"] });   // hip toss with a waist lock
T("side_chancery", "Side Chancery", "wrestling", "THROW", "CLINCH", 24, 86, 78, 8, 4, {});   // cranks head under the arm and drags down
T("back_heel_trip", "Back Heel Trip", "wrestling", "THROW", "CLINCH", 24, 86, 78, 8, 4, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 41} });   // trips opponent backward over a blocking heel
T("standing_crotch_and_half_n", "Standing Crotch and Half Nelson", "wrestling", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 45} });   // crotch lift with half nelson dumps to the mat
T("half_nelson", "Half Nelson", "wrestling", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "PINNED", ch: 32} });   // arm under armpit levers opponent flat for the pin
T("quarter_nelson", "Quarter Nelson", "wrestling", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "PINNED", ch: 32} });   // head-pressing nelson turns opponent onto the back
T("hammerlock", "Hammerlock", "wrestling", "SUB", "GROUND", 28, 83, 74, 9, 5, { eff: {st: "ARM_HURT", ch: 50} });   // wrenches the arm up behind the back
T("double_wrist_lock", "Double Wrist Lock", "wrestling", "SUB", "GROUND", 36, 76, 66, 11, 7, { moves: "MID", eff: {st: "ARM_HURT", ch: 58} });   // figure-four wrist lock, standing or on the mat
T("body_scissors", "Body Scissors", "wrestling", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "PINNED", ch: 32} });   // legs squeeze the torso to ride and wear down
T("cradle_hold", "Cradle Hold", "wrestling", "SETUP", "GROUND", 8, 86, 78, 8, 4, { eff: {st: "PINNED", ch: 36} });   // links head and knee to pin shoulders to the mat
T("inside_grapevine", "Inside Grapevine", "wrestling", "SETUP", "GROUND", 6, 90, 82, 7, 3, { eff: {st: "PINNED", ch: 32} });   // leg-laces from top to flatten and stretch opponent
T("front_trip", "Front Trip", "sambo", "THROW", "CLINCH", 24, 86, 78, 8, 4, { moves: "GROUND", eff: {st: "LEG_HURT", ch: 46} });   // blocks the leg in front and throws forward over it
T("rear_trip", "Rear Trip", "sambo", "THROW", "CLINCH", 24, 86, 78, 8, 4, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 41} });   // steps behind the far leg and topples backward
T("inside_leg_hook_throw", "Inside Leg Hook Throw", "sambo", "THROW", "CLINCH", 24, 86, 78, 8, 4, { moves: "LONG" });   // hooks the leg from inside and pushes down over it
T("outside_leg_hook_throw", "Outside Leg Hook Throw", "sambo", "THROW", "CLINCH", 24, 86, 78, 8, 4, { moves: "GROUND" });   // hooks the leg from outside-behind to throw
T("front_foot_sweep", "Front Foot Sweep", "sambo", "THROW", "CLINCH", 20, 90, 82, 7, 3, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // sweeps the sole against the shin mid-step
T("side_foot_sweep", "Side Foot Sweep", "sambo", "THROW", "CLINCH", 20, 90, 82, 7, 3, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 37}, flags: ["sweep"] });   // sweeps the unweighted leg sideways in rhythm with steps
T("podkhvat", "Podkhvat", "sambo", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 45}, flags: ["sweep"] });   // sweeps the thigh from under while pulling over the hip
T("overhead_stomach_throw", "Overhead Stomach Throw", "sambo", "THROW", "CLINCH", 28, 83, 74, 9, 5, { flags: ["launcher"] });   // foot in the belly rolls attacker overhead
T("sambo_suplex", "Sambo Suplex", "sambo", "THROW", "CLINCH", 32, 79, 70, 10, 6, { moves: "GROUND" });   // arches backward to throw over the chest
T("fireman_s_carry", "Fireman's Carry", "sambo", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 45} });   // loads opponent across the shoulders and dumps
T("flying_scissors", "Flying Scissors", "sambo", "THROW", "MID", 28, 83, 74, 9, 5, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 45}, flags: ["jump"] });   // leaps and scissors the legs around the body to topple
T("grapevine_throw", "Grapevine Throw", "sambo", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND" });   // winds a leg around the opponent's leg and throws
T("snap_down_sambo", "Snap-Down", "sambo", "THROW", "MID", 20, 90, 82, 7, 3, { eff: {st: "OFF_BALANCE", ch: 37} });   // jerks opponent down past the point of balance
T("mount_with_leg_hooks", "Mount with Leg Hooks", "sambo", "SETUP", "GROUND", 8, 86, 78, 8, 4, {});   // top retention with feet grapevined in the legs
T("elbow_lever_over_thigh", "Elbow Lever over Thigh", "sambo", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "LEG_HURT", ch: 58} });   // straightens the arm across the thigh from side hold
T("cross_body_elbow_lever", "Cross-Body Elbow Lever", "sambo", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "LEG_HURT", ch: 62}, flags: ["elite"] });   // legs over chest, arm between thighs, straight armbar
T("hip_lever", "Hip Lever", "sambo", "SUB", "GROUND", 32, 79, 70, 10, 6, { eff: {st: "LEG_HURT", ch: 54} });   // shin seized under arm, foot braced, separates the thighs
T("foot_knot_keylock", "Foot Knot Keylock", "sambo", "SUB", "GROUND", 32, 79, 70, 10, 6, { eff: {st: "ARM_HURT", ch: 54} });   // shin pins the forearm to twist the shoulder
T("achilles_tendon_jam", "Achilles Tendon Jam", "sambo", "SUB", "GROUND", 36, 76, 66, 11, 7, { prio: 1, eff: {st: "LEG_HURT", ch: 58} });   // bodyweight jams forearm into the Achilles for the tap
T("neck_lever_turnover", "Neck Lever Turnover", "sambo", "SETUP", "GROUND", 4, 93, 86, 5, 2, {});   // levers head and arm to flip a turtled opponent
T("arm_and_leg_turnover", "Arm-and-Leg Turnover", "sambo", "SETUP", "GROUND", 4, 93, 86, 5, 2, {});   // grabs far arm and leg to roll opponent to the back
T("side_hold_sit_up_escape", "Side Hold Sit-Up Escape", "sambo", "GUARD", "GROUND", 0, 100, 86, 0, 2, { prio: 2 });   // swings legs and sits up sharply to reverse the side hold
T("jab_to_double_leg", "Jab to Double-Leg", "mma", "THROW", "MID", 28, 83, 74, 9, 5, {});   // jab blinds the eyes to mask the level change into a double
T("fake_single_to_overhand", "Fake Single to Overhand", "mma", "STRIKE", "MID", 36, 76, 66, 11, 7, {});   // faked shot drags his hands down and eats an overhand
T("failed_shot_to_hook", "Failed Shot to Hook", "mma", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // denied takedown flows straight into a hook on the break
T("countering_kick_to_takedow", "Countering Kick to Takedown", "mma", "THROW", "LONG", 32, 79, 70, 10, 6, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 49} });   // catch the round kick and dump him off one leg
T("sweep_kick_takedown", "Sweep-Kick Takedown", "mma", "THROW", "LONG", 28, 83, 74, 9, 5, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 45}, flags: ["sweep"] });   // caught kick plus leg sweep drops him flat
T("check_to_overhand", "Check to Overhand", "mma", "STRIKE", "MID", 32, 79, 70, 10, 6, { prio: 1 });   // check the leg kick and counter over the top instantly
T("push_away_to_knee", "Push Away to Knee", "mma", "STRIKE", "MID", 32, 79, 70, 10, 6, { eff: {st: "STUNNED", ch: 24} });   // stiff-arm the shot and drive a knee into the ducking head
T("high_knees_from_sprawl", "High Knees from Sprawl", "mma", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, { prio: 3, eff: {st: "STUNNED", ch: 24} });   // hold the sprawled head down and feed knees to it
T("sprawl_to_side_control", "Sprawl to Side Control", "wrestling", "SETUP", "GROUND", 8, 86, 78, 8, 4, { eff: {st: "PINNED", ch: 36} });   // ride the flattened shot around to dominant side control
T("hand_clasp_guillotine", "Hand-Clasp Guillotine", "bjj", "SUB", "CLINCH", 40, 72, 62, 13, 8, { eff: {st: "WINDED", ch: 62}, flags: ["elite"] });   // snap the neck under the arm as his shot comes in
T("body_lock_takedown", "Body-Lock Takedown", "wrestling", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND" });   // locked waist and hip pressure put him on the mat
T("catch_knee_to_takedown", "Catch Knee to Takedown", "mma", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 45} });   // caught clinch knee becomes an instant dump
T("whizzer_hip_toss", "Whizzer Hip Toss", "wrestling", "THROW", "CLINCH", 32, 79, 70, 10, 6, { moves: "GROUND" });   // whizzer throw lands you on top ready to punch
T("plum_to_knees", "Plum to Knees", "mma", "STRIKE", "CLINCH", 36, 76, 66, 11, 7, {});   // win the Thai plum and pull his face into knees
T("head_clinch_snap_down", "Head Clinch Snap-Down", "mma", "THROW", "CLINCH", 28, 83, 74, 9, 5, {});   // snap the plum down and run him past you
T("dirty_boxing_uppercuts", "Dirty Boxing Uppercuts", "mma", "STRIKE", "CLINCH", 24, 86, 78, 8, 4, { eff: {st: "BLEEDING", ch: 36} });   // collar tie controls the head while short uppercuts land
T("arm_drag_to_back", "Arm-Drag to Back", "wrestling", "SETUP", "CLINCH", 10, 83, 74, 9, 5, { moves: "MID", eff: {st: "PINNED", ch: 40}, flags: ["spin"] });   // arm-drag bump spins you to back control standing
T("body_lock_to_back", "Body-Lock to Back", "wrestling", "THROW", "CLINCH", 32, 79, 70, 10, 6, {});   // rear body lock drags him down with back taken
T("front_headlock_knees", "Front Headlock Knees", "mma", "STRIKE", "CLINCH", 36, 76, 66, 11, 7, { eff: {st: "LEG_HURT", ch: 58} });   // front headlock feeds knees to a trapped head
T("cage_double_leg", "Cage Double-Leg", "wrestling", "THROW", "CLINCH", 32, 79, 70, 10, 6, { eff: {st: "BLEEDING", ch: 44} });   // pin him to the fence, wrap the legs, cut the corner
T("foot_stomps", "Foot Stomps", "mma", "STRIKE", "CLINCH", 16, 93, 86, 5, 2, { prio: 1 });   // stomp the feet to sap and distract a pinned opponent
T("cage_knees", "Cage Knees", "mma", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, {});   // fence holds him upright for repeated knees
T("underhook_switch", "Underhook Switch", "wrestling", "SETUP", "CLINCH", 8, 86, 78, 8, 4, { eff: {st: "PINNED", ch: 36} });   // pummel for underhooks and reverse the cage pin
T("cage_mount_escape", "Cage Mount Escape", "mma", "GUARD", "GROUND", 0, 100, 74, 0, 5, { prio: 2 });   // walk feet up the cage to buck the mounted man off
T("the_shell", "The Shell", "mma", "GUARD", "GROUND", 0, 100, 86, 0, 2, { prio: 2 });   // downed defensive frame that blocks kicks and stomps
T("up_kick", "Up-Kick", "mma", "STRIKE", "GROUND", 32, 79, 70, 10, 6, {});   // piston up-kick punishes anyone diving into the downed guard
T("leg_toss_overhand", "Leg Toss Overhand", "mma", "STRIKE", "GROUND", 36, 76, 66, 11, 7, {});   // toss the downed man's legs aside and dive in with an overhand
T("punch_to_pass", "Punch to Pass", "mma", "SETUP", "GROUND", 10, 83, 74, 9, 5, {});   // ground strikes force the guard open so you can pass
T("body_body_head", "Body-Body-Head", "mma", "STRIKE", "GROUND", 32, 79, 70, 10, 6, {});   // ground-and-pound rhythm combo from inside the guard
T("over_the_top_elbow", "Over the Top Elbow", "mma", "STRIKE", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "BLEEDING", ch: 48} });   // elbow arcs over the guard player's frames to cut him open
T("grinding_elbow", "Grinding Elbow", "mma", "STRIKE", "GROUND", 28, 83, 74, 9, 5, {});   // grinding elbow pressure softens the half guard from top
T("no_hand_pass", "No Hand Pass", "bjj", "SETUP", "GROUND", 8, 86, 78, 8, 4, { eff: {st: "PINNED", ch: 36} });   // posture-and-knee slide passes half guard without gripping
T("striking_to_arm_bar", "Striking to Arm Bar", "mma", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "ARM_HURT", ch: 62}, flags: ["elite"] });   // mounted punches make him reach, arm bar the extended arm
T("striking_to_americana", "Striking to Americana", "mma", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "ARM_HURT", ch: 58} });   // blocked ground strike gets bent into an americana
T("kata_gatame_arm_triangle", "Kata-Gatame Arm Triangle", "bjj", "SUB", "GROUND", 40, 72, 62, 13, 8, { moves: "LONG", eff: {st: "WINDED", ch: 62}, flags: ["elite", "choke"] });   // pushed-across arm becomes a mounted arm-triangle choke
T("double_attack_mount", "Double Attack Mount", "mma", "SETUP", "GROUND", 12, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 54}, flags: ["choke"] });   // high mount threatening strikes, back take, and choke at once
T("knee_punch_arm_bar", "Knee Punch Arm Bar", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "ARM_HURT", ch: 58} });   // trap the punching arm from guard and swing into an arm bar
T("arm_trap_triangle", "Arm Trap Triangle", "bjj", "SUB", "GROUND", 40, 72, 62, 13, 8, { eff: {st: "ARM_HURT", ch: 62}, flags: ["elite"] });   // blocked ground-and-pound arm gets triangled from guard
T("posture_up_guillotine", "Posture Up Guillotine", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, {});   // sit-up guard snatches the neck as he postures to punch
T("sit_up_kimura", "Sit-Up Kimura", "bjj", "SUB", "GROUND", 36, 76, 66, 11, 7, { eff: {st: "ARM_HURT", ch: 58} });   // sit up to the wrist and crank the shoulder
T("turtle_to_back", "Turtle to Back", "bjj", "SETUP", "GROUND", 12, 79, 70, 10, 6, { eff: {st: "PINNED", ch: 44} });   // hooks in on the turtled opponent and flatten him out
T("kick_out_to_standing", "Kick Out to Standing", "mma", "GUARD", "GROUND", 0, 100, 82, 0, 3, { prio: 2, moves: "LONG" });   // kick the top man away and scramble back to the feet
T("choke_defense", "Choke Defense", "bjj", "GUARD", "GROUND", 0, 100, 82, 0, 3, { prio: 2, eff: {st: "WINDED", ch: 42}, flags: ["choke"] });   // chin tuck and hand fighting stall the choke from back control
T("bridge_escape", "Bridge Escape", "bjj", "GUARD", "GROUND", 0, 100, 82, 0, 3, { prio: 2, flags: ["escape"] });   // bridge and roll reverses the mounted position
T("yaeb", "Yaeb (Jab)", "muaythai", "STRIKE", "MID", 16, 93, 86, 5, 2, { prio: 1 });   // range-finding lead punch that opens combinations
T("mat_drong", "Mat Drong (Straight Punch)", "muaythai", "STRIKE", "MID", 28, 83, 74, 9, 5, { prio: 1 });   // hip-twisting rear straight that stops opponents in their tracks
T("mat_wieng", "Mat Wieng (Swing Punch)", "muaythai", "STRIKE", "MID", 24, 86, 78, 8, 4, { eff: {st: "WINDED", ch: 31} });   // wide transverse punch to the jaw or ribs
T("lead_hook_to_the_liver", "Lead Hook to the Liver", "boxing", "STRIKE", "MID", 36, 76, 66, 11, 7, { eff: {st: "WINDED", ch: 43} });   // digs up under the ribs to fold the body
T("mat_at", "Mat At (Uppercut)", "muaythai", "STRIKE", "MID", 28, 83, 74, 9, 5, { eff: {st: "STUNNED", ch: 20} });   // leg-driven punch lifted through the chin from inside
T("mud_soi_dao", "Mud Soi Dao (Double Uppercut)", "muaythai", "STRIKE", "MID", 32, 79, 70, 10, 6, { eff: {st: "BLEEDING", ch: 44} });   // slips inside and fires both uppercuts to the chin
T("jump_fly_cross", "Jump Fly Cross", "muaythai", "STRIKE", "MID", 32, 79, 70, 10, 6, { flags: ["jump"] });   // leaping cross thrown over the guard while closing distance
T("the_unreal_fists", "The Unreal Fists", "muaythai", "SETUP", "MID", 6, 90, 82, 7, 3, {});   // feints the rear hand to land the hidden lead punch
T("sok_fan_nah", "Sok Fan Nah (Elbow Chop)", "muaythai", "STRIKE", "MID", 36, 76, 66, 11, 7, {});   // diagonal downward chop swung like a sickle
T("sawk_hud", "Sawk Hud (Up Elbow)", "muaythai", "STRIKE", "MID", 36, 76, 66, 11, 7, { eff: {st: "STUNNED", ch: 28} });   // levers the point up under the chin
T("sawk_tong", "Sawk Tong (Smashing Down Elbow)", "muaythai", "STRIKE", "MID", 36, 76, 66, 11, 7, { eff: {st: "STUNNED", ch: 28} });   // drops the point onto the nose bridge or forehead
T("sawk_chieng", "Sawk Chieng (Diagonal Elbow)", "muaythai", "STRIKE", "MID", 36, 76, 66, 11, 7, {});   // chops through the seam of the guard on a diagonal
T("sawk_sob", "Sawk Sob (Double Elbow)", "muaythai", "STRIKE", "MID", 32, 79, 70, 10, 6, {});   // beats alternately with both elbows while advancing
T("sok_chieng_lang", "Sok Chieng Lang (Skew Back Elbow)", "muaythai", "STRIKE", "MID", 36, 76, 66, 11, 7, { eff: {st: "STUNNED", ch: 28} });   // swings back into the chin when the opponent rushes in
T("sawk_klab", "Sawk Klab (Spinning Back Elbow)", "muaythai", "STRIKE", "MID", 40, 72, 62, 13, 8, { eff: {st: "STUNNED", ch: 32}, flags: ["spin", "power", "elite"] });   // turns the body to whip the elbow point into the jaw
T("sok_salad", "Sok Salad (Shaking Elbow)", "muaythai", "STRIKE", "CLINCH", 28, 83, 74, 9, 5, { flags: ["escape"] });   // twists free of armpit control with a rear elbow
T("snap_elbow", "Snap Elbow", "muaythai", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, {});   // short inside elbow fired from the plum
T("jump_fly_elbow", "Jump Fly Elbow", "muaythai", "STRIKE", "MID", 40, 72, 62, 13, 8, { flags: ["jump", "power", "elite"] });   // leaping elbow dropped over the top of the guard
T("elbow_jam", "Elbow Jam", "muaythai", "GUARD", "MID", 0, 100, 82, 0, 3, { prio: 2 });   // spikes a raised elbow into incoming punches
T("kao_drong", "Kao Drong (Straight Knee)", "muaythai", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 39} });   // drives the knee straight through the midsection
T("kao_kong", "Kao Kong (Curve Knee)", "muaythai", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 39} });   // arcs the knee around the guard into the ribs
T("skip_knees", "Skip Knees", "muaythai", "STRIKE", "CLINCH", 28, 83, 74, 9, 5, {});   // alternating skipping knees thrown inside the plum
T("kao_noi", "Kao Noi (Small Knee)", "muaythai", "STRIKE", "CLINCH", 20, 90, 82, 7, 3, {});   // chips at the thighs to wear the legs down
T("kao_la", "Kao La (Farewell Knee)", "muaythai", "STRIKE", "CLINCH", 28, 83, 74, 9, 5, {});   // parting knee thrown while breaking the clinch
T("long_knee", "Long Knee", "muaythai", "STRIKE", "MID", 32, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 39} });   // lunging lead knee that spears the body at range
T("kao_loi", "Kao Loi (Flying Knee)", "muaythai", "STRIKE", "LONG", 44, 69, 58, 14, 9, { eff: {st: "STUNNED", ch: 36}, flags: ["jump", "power", "elite", "launcher"] });   // leaping knee launched at the chin
T("kao_dode", "Kao Dode (Jumping Knee)", "muaythai", "STRIKE", "MID", 40, 72, 62, 13, 8, { eff: {st: "STUNNED", ch: 32}, flags: ["jump", "power", "elite"] });   // springs off both feet to knee the chest or chin
T("neck_pull_knee", "Neck-Pull Knee", "muaythai", "STRIKE", "CLINCH", 40, 72, 62, 13, 8, { flags: ["power", "elite"] });   // jerks the neck down into a rising knee to the face
T("tae_wiang", "Tae Wiang (Roundhouse Kick)", "muaythai", "STRIKE", "LONG", 40, 72, 62, 13, 8, { eff: {st: "STUNNED", ch: 32}, flags: ["power", "elite"] });   // dead-leg shin swung like a bat through ribs or skull
T("angle_kick", "Angle Kick", "muaythai", "STRIKE", "LONG", 32, 79, 70, 10, 6, {});   // steps offline to slash the shin in on a diagonal
T("teep_drong", "Teep Drong (Long Foot Jab)", "muaythai", "STRIKE", "LONG", 20, 90, 82, 7, 3, { prio: 1, moves: "LONG" });   // rear-leg push kick that stops advances cold
T("teep_dan_lang", "Teep Dan Lang (Rear Foot Thrust)", "muaythai", "STRIKE", "LONG", 24, 86, 78, 8, 4, {});   // thrusts the foot backward into a pursuer
T("teep_dueh_son", "Teep Dueh Son (Heel Push)", "muaythai", "STRIKE", "LONG", 24, 86, 78, 8, 4, {});   // rams the heel into the hip or abdomen
T("bata_loob_pak", "Bata Loob Pak (Foot Brushes the Face)", "muaythai", "STRIKE", "LONG", 32, 79, 70, 10, 6, {});   // snaps the sole of the foot up into the face
T("chaoraked_faad", "Chaoraked Faad (Turning Kick)", "muaythai", "STRIKE", "LONG", 40, 72, 62, 13, 8, { eff: {st: "STUNNED", ch: 32}, flags: ["spin", "power", "elite"] });   // spinning back kick whipping the heel to jaw or ribs
T("kradot_tae", "Kradot Tae (Jumping Kick)", "muaythai", "STRIKE", "LONG", 36, 76, 66, 11, 7, { flags: ["jump"] });   // leaping round kick thrown over the opponent's timing
T("neb", "Neb (Stop Kick)", "muaythai", "GUARD", "LONG", 0, 100, 82, 0, 3, { prio: 2 });   // jams the foot into the hip to kill a kick as it starts
T("cup_catch", "Cup Catch", "boxing", "GUARD", "MID", 0, 100, 90, 0, 1, { prio: 2 });   // catches the jab in the rear glove
T("slip", "Slip", "boxing", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // moves the head off the punch line for counters
T("bob_and_weave", "Bob and Weave", "boxing", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // rolls under hooks and exits on an angle
T("shoulder_stop", "Shoulder Stop", "muaythai", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // jams the shoulder to smother punches before they start
T("lead_leg_shield", "Lead Leg Shield", "muaythai", "GUARD", "LONG", 0, 100, 86, 0, 2, { prio: 2 });   // raises the shin to check round kicks
T("cross_shield", "Cross Shield", "muaythai", "GUARD", "LONG", 0, 100, 86, 0, 2, { prio: 2 });   // crosses the shin over to block kicks to the far side
T("catch_kick", "Catch Kick", "muaythai", "GUARD", "LONG", 0, 100, 82, 0, 3, { prio: 2, eff: {st: "OFF_BALANCE", ch: 37} });   // traps the kicking leg for a counter or dump
T("tad_mara", "Tad Mara", "muaythai", "GUARD", "LONG", 0, 100, 78, 0, 4, { prio: 2 });   // ducks the high kick and traps the leg to throw the kicker
T("elbow_to_the_thigh", "Elbow to the Thigh", "muaythai", "GUARD", "LONG", 0, 100, 74, 0, 5, { prio: 2 });   // catches the kick and drops the elbow onto the raised thigh
T("ta_then_kham_fak", "Ta Then Kham Fak", "muaythai", "STRIKE", "MID", 28, 83, 74, 9, 5, { moves: "LONG", eff: {st: "BLEEDING", ch: 40} });   // pushes the punch aside and drives an uppercut to the chin
T("cross_face", "Cross-face", "muaythai", "GUARD", "CLINCH", 0, 100, 86, 0, 2, { prio: 2 });   // drives the forearm across the face to break head control
T("pull_off_balance", "Pull Off Balance", "muaythai", "SETUP", "CLINCH", 4, 93, 86, 5, 2, {});   // breaks posture sideways to open knee strikes
T("switch_step", "Switch Step", "muaythai", "SETUP", "MID", 2, 97, 90, 4, 1, {});   // hops into the opposite stance to load the lead-side weapon
T("jab_cross_roundhouse", "Jab-Cross-Roundhouse", "muaythai", "STRIKE", "LONG", 36, 76, 66, 11, 7, {});   // the cross blinds for the kick
T("roundhouse_spinning_elbow", "Roundhouse-Spinning Elbow", "muaythai", "STRIKE", "MID", 40, 72, 62, 13, 8, { flags: ["spin", "power", "elite"] });   // missed kick spins into an elbow as the opponent steps in
T("yop_chagi", "Yop Chagi (Side Kick)", "taekwondo", "STRIKE", "LONG", 32, 79, 70, 10, 6, {});   // piercing heel/foot-blade kick driven with spiral hip twist
T("momdollyo_chagi", "Momdollyo Chagi (Body-Turning Kick)", "taekwondo", "STRIKE", "LONG", 36, 76, 66, 11, 7, { flags: ["spin"] });   // full 360-degree spin into a kick, often mislabeled back kick
T("bandal_chagi", "Bandal Chagi (Half-Moon Kick)", "taekwondo", "STRIKE", "LONG", 28, 83, 74, 9, 5, {});   // 45-degree slant-circle kick between front and roundhouse
T("bitureo_chagi", "Bitureo Chagi (Twist Kick)", "taekwondo", "STRIKE", "LONG", 28, 83, 74, 9, 5, { eff: {st: "LEG_HURT", ch: 50} });   // knee chambers across body then snaps outward on a twist
T("huryo_chagi", "Huryo Chagi (Thrashing Whip Kick)", "taekwondo", "STRIKE", "LONG", 36, 76, 66, 11, 7, { eff: {st: "STUNNED", ch: 28}, flags: ["spin"] });   // high whipping heel kick brought down through the head
T("nakka_chagi", "Nakka Chagi (Hooking Kick)", "taekwondo", "STRIKE", "LONG", 32, 79, 70, 10, 6, { eff: {st: "STUNNED", ch: 24} });   // missed kick folds back to hook the head with the heel
T("an_chagi", "An Chagi (Inner Crescent Kick)", "taekwondo", "STRIKE", "LONG", 24, 86, 78, 8, 4, {});   // foot arcs outside-to-inside striking with sole edge
T("bakkat_chagi", "Bakkat Chagi (Outer Crescent Kick)", "taekwondo", "STRIKE", "LONG", 24, 86, 78, 8, 4, {});   // inside-to-outside arc with foot blade, doubles as a block
T("ppodeo_chagi", "Ppodeo Chagi (Stretch Kick)", "taekwondo", "STRIKE", "LONG", 24, 86, 78, 8, 4, { prio: 1 });   // low straight stretch kick to jam an advancing opponent
T("mireo_chagi", "Mireo Chagi (Pushing Kick)", "taekwondo", "STRIKE", "LONG", 20, 90, 82, 7, 3, { moves: "LONG" });   // sole-of-foot push to shove opponent away or down
T("twio_ap_chagi", "Twio Ap Chagi (Jump Front Kick)", "taekwondo", "STRIKE", "LONG", 32, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 39}, flags: ["jump"] });   // front kick delivered mid-air off a two-foot jump
T("twio_yop_chagi", "Twio Yop Chagi (Flying Side Kick)", "taekwondo", "STRIKE", "LONG", 40, 72, 62, 13, 8, { flags: ["jump", "power", "elite"] });   // airborne side kick after a running leap
T("twio_momdollyo_huryo_chagi", "Twio Momdollyo Huryo Chagi (Jump Spin Whip Kick)", "taekwondo", "STRIKE", "LONG", 40, 72, 62, 13, 8, { eff: {st: "STUNNED", ch: 32}, flags: ["jump", "spin", "power", "elite"] });   // jumping full-spin thrashing kick to the head
T("dubal_dangseong_chagi", "Dubal Dangseong Chagi (Double Alternate Jump Kick)", "taekwondo", "STRIKE", "LONG", 32, 79, 70, 10, 6, { flags: ["jump"] });   // both feet kick in sequence during one jump, first is a feint
T("kawi_chagi", "Kawi Chagi (Scissors Kick)", "taekwondo", "STRIKE", "LONG", 32, 79, 70, 10, 6, { flags: ["jump"] });   // airborne split kick hitting two targets at once
T("kodeup_chagi", "Kodeup Chagi (Repeated Kick)", "taekwondo", "STRIKE", "LONG", 28, 83, 74, 9, 5, {});   // same leg kicks twice, low feint then high finish
T("kullo_chagi", "Kullo Chagi (Stamping Kick)", "taekwondo", "STRIKE", "LONG", 24, 86, 78, 8, 4, {});   // deceptive foot-stamp advance before the real kick
T("japko_chagi", "Japko Chagi (Holding Kick)", "taekwondo", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, {});   // grab clothing or limb then kick the held opponent
T("baro_jireugi", "Baro Jireugi (Regular Punch)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, {});   // rear-hand straight punch driven by waist recoil
T("bandae_jireugi", "Bandae Jireugi (Reverse Punch)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // lead-side straight punch off the front foot
T("chi_jireugi", "Chi Jireugi (Upward Punch)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, { eff: {st: "BLEEDING", ch: 40} });   // uppercut from the waist targeting the jaw
T("sewo_jireugi", "Sewo Jireugi (Vertical-Fist Punch)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, {});   // thumb-up fist punch for close range with bent elbow
T("jeocho_jireugi", "Jeocho Jireugi (Inverted Close Punch)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, { eff: {st: "WINDED", ch: 31} });   // palm-up fist punch to the body inside 120-degree elbow
T("dollyo_jireugi", "Dollyo Jireugi (Spiral Hook Punch)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // fist half-spirals to the target at close quarters
T("yop_jireugi", "Yop Jireugi (Side Punch)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, { eff: {st: "WINDED", ch: 31} });   // punch delivered sideways from horse-riding stance
T("u_ja_jireugi", "U Ja Jireugi (U-Shape Double Punch)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // simultaneous punches to face and trunk forming a U
T("dangkyo_teok_jireugi", "Dangkyo Teok Jireugi (Pulling Jaw Punch)", "taekwondo", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, { eff: {st: "BLEEDING", ch: 44} });   // one hand yanks the jaw while the other uppercuts it
T("deungjumeok_ap_chigi", "Deungjumeok Ap Chigi (Back-Fist Front Strike)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, {});   // back-fist snapped straight at the philtrum
T("mejumeok_naeryo_chigi", "Mejumeok Naeryo Chigi (Hammer-Fist Downward Strike)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, {});   // clubbing downward blow to the head, used in breaking
T("sonnal_mok_chigi", "Sonnal Mok Chigi (Knife-Hand Neck Strike)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // curved hand-blade chop to the side of the neck
T("sonnaldeung_chigi", "Sonnaldeung Chigi (Ridge-Hand Strike)", "taekwondo", "STRIKE", "MID", 24, 86, 78, 8, 4, { flags: ["spin"] });   // inner hand-blade back whipped into face or temple
T("batangson_teok_chigi", "Batangson Teok Chigi (Palm-Heel Jaw Strike)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, { eff: {st: "STUNNED", ch: 20} });   // heel of palm rammed up under the chin
T("khaljaebi", "Khaljaebi (Arc-Hand Throat Strike)", "taekwondo", "STRIKE", "MID", 32, 79, 70, 10, 6, { eff: {st: "WINDED", ch: 54} });   // straight arc-hand thrust into the gullet
T("pyonsonkkeut_sewo_tzireugi", "Pyonsonkkeut Sewo Tzireugi (Vertical Spear-Hand Thrust)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, { eff: {st: "WINDED", ch: 35} });   // fingertip spear driven into the solar plexus
T("kawisonkkeut_tzireugi", "Kawisonkkeut Tzireugi (Scissors-Fingertip Thrust)", "taekwondo", "STRIKE", "MID", 32, 79, 70, 10, 6, {});   // two spread fingers thrust at both eyes
T("palkup_dollyo_chigi", "Palkup Dollyo Chigi (Turning Elbow Strike)", "taekwondo", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, { flags: ["spin"] });   // elbow whipped horizontally with full waist twist
T("palkup_ollyo_chigi", "Palkup Ollyo Chigi (Rising Elbow Strike)", "taekwondo", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, {});   // elbow driven upward skimming past the armpit
T("mureup_ollyo_chigi", "Mureup Ollyo Chigi (Rising Knee Strike)", "taekwondo", "STRIKE", "CLINCH", 32, 79, 70, 10, 6, { eff: {st: "STUNNED", ch: 24} });   // knee lifted into groin or dragged-down head
T("jebi_poom_mok_chigi", "Jebi Poom Mok Chigi (Swallow-Form Neck Strike)", "taekwondo", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // high knife-hand block and neck chop in one twisting motion
T("arae_makki", "Arae Makki (Low Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2, eff: {st: "OFF_BALANCE", ch: 33} });   // forearm sweeps down to deflect low attacks
T("olgul_makki", "Olgul Makki (Rising Face Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // forearm lifts to deflect strikes at the head
T("momtong_an_makki", "Momtong An Makki (Inner Trunk Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2, eff: {st: "OFF_BALANCE", ch: 33} });   // outer wrist sweeps outside-to-inside across the body
T("momtong_bakkat_makki", "Momtong Bakkat Makki (Outer Trunk Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // forearm knocks attacks outward from centerline
T("sonnal_momtong_makki", "Sonnal Momtong Makki (Knife-Hand Guarding Block)", "taekwondo", "GUARD", "MID", 0, 100, 82, 0, 3, { prio: 2 });   // double hand-blade guard blocking the trunk
T("hecho_makki", "Hecho Makki (Spreading Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // both forearms wedge outward from crossed wrists
T("otgoreo_makki", "Otgoreo Makki (X-Cross Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // wrists crossed to trap descending or rising attacks
T("kodureo_makki", "Kodureo Makki (Assisted Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // second fist reinforces the blocking forearm
T("kawi_makki", "Kawi Makki (Scissors Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // low block and inner block crossing simultaneously
T("santeul_makki", "Santeul Makki (Mountain Block)", "taekwondo", "GUARD", "MID", 0, 100, 82, 0, 3, { prio: 2 });   // both fists raised to temple height blocking both sides
T("keumgang_makki", "Keumgang Makki (Diamond Block)", "taekwondo", "GUARD", "MID", 0, 100, 82, 0, 3, { prio: 2, eff: {st: "BLEEDING", ch: 32} });   // low block and face block executed as one motion
T("bitureo_makki", "Bitureo Makki (Twist Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // shoulder-height block powered by twisting the waist
T("batangson_nullo_makki", "Batangson Nullo Makki (Palm Pressing Block)", "taekwondo", "GUARD", "MID", 0, 100, 86, 0, 2, { prio: 2 });   // palm heel presses attack down in front of the stomach
T("apkubi", "Apkubi (Forward Stance)", "taekwondo", "SETUP", "MID", 2, 97, 90, 4, 1, {});   // long bent-front-knee stance driving weight forward
T("dwitkubi", "Dwitkubi (Back Stance)", "taekwondo", "SETUP", "MID", 2, 97, 90, 4, 1, { prio: 1 });   // weight loaded on rear leg ready to counter-kick
T("juchum_seogi", "Juchum Seogi (Horse-Riding Stance)", "taekwondo", "SETUP", "MID", 2, 97, 90, 4, 1, {});   // wide low straddle base for side punches and blocks
T("beom_seogi", "Beom Seogi (Tiger Stance)", "taekwondo", "SETUP", "MID", 4, 93, 86, 5, 2, {});   // weight fully rear so the lead foot can kick instantly
T("hakdari_seogi", "Hakdari Seogi (Crane Stance)", "taekwondo", "SETUP", "MID", 4, 93, 86, 5, 2, { eff: {st: "LEG_HURT", ch: 38} });   // one-legged balance stance for evasions and diamond blocks
T("kkoa_seogi", "Kkoa Seogi (Cross Stance)", "taekwondo", "SETUP", "MID", 2, 97, 90, 4, 1, {});   // legs crossed to cover ground before a side kick
T("koshi_nage", "Koshi Nage (Full Waist Throw)", "judo", "THROW", "CLINCH", 32, 79, 70, 10, 6, { moves: "GROUND" });   // opponent loaded over the hip and thrown to the ground
T("ushiro_goshi", "Ushiro Goshi (Rear Hip Throw)", "judo", "THROW", "CLINCH", 36, 76, 66, 11, 7, { prio: 1, moves: "GROUND" });   // lifting counter-throw from behind the opponent's hip
T("uchi_mata_judo", "Uchi Mata (Inner Thigh Throw)", "judo", "THROW", "CLINCH", 36, 76, 66, 11, 7, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 53}, flags: ["sweep"] });   // leg sweeps up between opponent's thighs to rotate them over
T("katame_waza", "Katame-waza (Grappling Hold)", "judo", "THROW", "CLINCH", 28, 83, 74, 9, 5, { moves: "GROUND" });   // pin immobilizing opponent's back to the mat for ippon
T("sumo_force_out", "Sumo Force-Out", "sumo", "THROW", "CLINCH", 32, 79, 70, 10, 6, {});   // drive opponent backward out of the ring
T("sumo_tripping", "Sumo Tripping", "sumo", "THROW", "CLINCH", 32, 79, 70, 10, 6, { moves: "GROUND", eff: {st: "OFF_BALANCE", ch: 49} });   // foot trip flooring the opponent
T("hung_gar_tiger_claw", "Hung Gar Tiger Claw", "wushu", "STRIKE", "MID", 28, 83, 74, 9, 5, {});   // southern raking claw to vital points with iron hand conditioning
T("hung_gar_attacking_block", "Hung Gar Attacking Block", "wushu", "GUARD", "MID", 0, 100, 78, 0, 4, { prio: 2 });   // block delivered hard enough to injure the punching arm
T("baguazhang_circle_walking", "Baguazhang Circle Walking", "wushu", "SETUP", "MID", 6, 90, 82, 7, 3, {});   // circling footwork with eight palm changes concealing throws
/* ==== end imported ==== */

const TECH_IDS = Object.keys(TECH);
