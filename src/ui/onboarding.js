// src/ui/onboarding.js
// First-run curriculum: what a player should be taught, and when
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Onboarding Director
   Luminara Digital - pure logic, no DOM, no drawing, no globals touched

   The game teaches nothing. Every combat concept lives in HOW_TOPICS.fight,
   which is only reachable from inside a live duel, and the save file has no
   first-run flag at all. This module is the missing decision layer: given the
   save and the live duel it answers three questions and nothing else -

     what should I do next?        nextGoal()
     what should I be told now?    pendingLesson()
     what should the corner say?   coachTip()

   It renders nothing. The caller owns every pixel and every keypress.

   -------------------------------------------------------------------
   PERSISTED STATE  (SAVE.onboarding - Onboarding.KEY)
   -------------------------------------------------------------------
     { v:1, seen:{ lessonId:1, ... }, greeted:bool, done:bool }

   Small, versioned, forward-compatible: normalize() keeps an unknown v and
   keeps unknown seen-ids (up to a cap), so a save written by a later build
   survives a round trip through this one. DEF_SAVE() should seat
   Onboarding.defaultState() under Onboarding.KEY.

   -------------------------------------------------------------------
   ctx - supplied by the caller, every field optional
   -------------------------------------------------------------------
     ctx.scene   string scene name, e.g. "MENU" / "DUEL" / "SELECT".
                 Only "DUEL" is treated specially (nextGoal stands down).
     ctx.duel    the live duel object (G.duel) or null. Read: .range, .turn,
                 .p, .e, .readShown.
     ctx.mode    string mode tag ("adv" / "vs" / "ranked" ...). Recorded on
                 the returned goal as goal.mode when present; never gates.
     ctx.turn    fallback turn number when duel.turn is missing.
     ctx.home    OPTIONAL array of range names the player's arts own
                 (homeRanges(side.discs) in the page). Only used by coachTip
                 to notice the fight is being held outside the player's game.
                 side.home is read the same way if present.
     ctx.tech    OPTIONAL: the technique the player's cursor is on right now
                 (the row cmdFocus points at). Read: .range. The range lesson
                 fires only when this technique's own range is not the range
                 the fight is in - the one moment the lesson is TRUE.
     ctx.keys    OPTIONAL { a, b, y } map of action -> the label to print for
                 that button, e.g. { b: "B / X" }. A lesson body never spells
                 a key itself: it writes {B} / {Y} and the caller substitutes
                 the label its own binding table produced. Without the map the
                 token is left standing - a visible {B} on screen is a caller
                 that forgot, which is a better failure than confidently
                 naming a key that does nothing.

   Nothing here reads localStorage, TECH, DISCIPLINES, SAVE or window. Junk
   in, sane value out - no function below can throw on a malformed save.
   ===================================================================== */

var Onboarding = (function () {
    var STATE_KEY = "onboarding";
    var STATE_V = 1;
    var MAX_SEEN = 48;          // cap on remembered ids, incl. future ones
    var MAX_ID = 40;            // cap on a single id's length

    /* A player stops being new after this many recorded duels, and any save
       older than the onboarding system (lots of duels, nothing seen) counts as
       graduated rather than being taught the jab in year two. */
    var NEW_PLAYER_DUELS = 3;
    var GRADUATE_DUELS = 12;
    var LADDER_DUELS = 5;

    /* the signature meter arms at HALF - SUP_MIN = SUP_MAX / 2 in the page.
       Read off the side when it carries its own ceiling, else assume 100. */
    var SUP_FULL = 100;

    /* ---------------------------------------------------------------
       tiny defensive readers - none of these throw
       --------------------------------------------------------------- */
    function isArr(v) {
        return Object.prototype.toString.call(v) === "[object Array]";
    }
    function isObj(v) {
        return !!v && typeof v === "object" && !isArr(v);
    }
    function num(v) {
        var n = Number(v);
        /* NaN and both infinities are treated as nothing, without leaning on
           a global that a stripped-down host might not have */
        return (n === n && n !== Infinity && n !== -Infinity) ? n : 0;
    }
    function count(o) {
        if (!isObj(o)) return 0;
        var n = 0, k;
        for (k in o) { if (Object.prototype.hasOwnProperty.call(o, k) && o[k]) n++; }
        return n;
    }
    function recOf(save) {
        return isObj(save) && isObj(save.rec) ? save.rec : null;
    }
    function duelsOf(save) {
        var r = recOf(save);
        return r ? Math.max(0, num(r.duels)) : 0;
    }
    function winsOf(save) {
        var r = recOf(save);
        return r ? Math.max(0, num(r.wins)) : 0;
    }
    function stagesOf(save) {
        var r = recOf(save);
        return r ? Math.max(0, num(r.stages)) : 0;
    }
    function masteredOf(save) {
        return isObj(save) ? count(save.defeats) : 0;
    }
    function hasRun(save) {
        if (!isObj(save) || !isObj(save.run)) return false;
        return !!(save.run.adv || save.run.gauntlet || save.run.weekly);
    }
    function supMaxOf(side) {
        if (!isObj(side)) return SUP_FULL;
        var m = num(side.supMax) || num(side.sigMax) || num(side.supMaxOverride);
        return m > 0 ? m : SUP_FULL;
    }
    function stamPct(side) {
        if (!isObj(side)) return 1;
        var max = num(side.maxStam);
        if (max <= 0) return 1;
        return Math.max(0, Math.min(1, num(side.stam) / max));
    }
    function hpPct(side) {
        if (!isObj(side)) return 1;
        var max = num(side.maxhp);
        if (max <= 0) return 1;
        return Math.max(0, Math.min(1, num(side.hp) / max));
    }
    function hasCond(side, key) {
        return isObj(side) && isObj(side.cond) && !!side.cond[key];
    }
    function anyCond(side) {
        return isObj(side) && count(side.cond) > 0;
    }
    function turnOf(duel, ctx) {
        if (isObj(duel) && duel.turn !== undefined) return Math.max(0, num(duel.turn));
        if (isObj(ctx) && ctx.turn !== undefined) return Math.max(0, num(ctx.turn));
        return 0;
    }
    /* which side is the pupil - "p" / "e" / the side object itself */
    function sideOf(duel, side) {
        if (isObj(side)) return side;
        if (!isObj(duel)) return null;
        if (side === "e" || side === 1) return isObj(duel.e) ? duel.e : null;
        return isObj(duel.p) ? duel.p : null;
    }
    function foeOf(duel, side) {
        if (!isObj(duel)) return null;
        var me = sideOf(duel, side);
        if (me && me === duel.e) return isObj(duel.p) ? duel.p : null;
        return isObj(duel.e) ? duel.e : null;
    }
    function homeOf(side, ctx) {
        var h = (isObj(side) && side.home) || (isObj(ctx) && ctx.home) || null;
        return (isArr(h) && h.length) ? h : null;
    }
    /* KEY TOKENS. The focus lesson used to read "PRESS B ON THE MARK": there
       is no B key - b is x / Escape / Backspace - so a keyboard player was
       told to press a dead one. Bodies carry {B} / {Y} / {A} and the caller
       expands them from the table a keypress is actually resolved through. */
    var KEY_TOKEN = /\{([ABY])\}/g;
    function expandKeys(text, keys) {
        var map = isObj(keys) ? keys : null;
        return String(text).replace(KEY_TOKEN, function (whole, letter) {
            var label = map ? map[letter.toLowerCase()] : null;
            return (typeof label === "string" && label.length) ? label : whole;
        });
    }
    function keysOf(ctx) {
        return (isObj(ctx) && isObj(ctx.keys)) ? ctx.keys : null;
    }
    /* the technique under the cursor, if the caller handed one over */
    function techOf(ctx) {
        return (isObj(ctx) && isObj(ctx.tech)) ? ctx.tech : null;
    }
    /* is the cursor on a technique that does not belong to the current
       range - "a head kick from mount is nothing" is only worth saying
       while the player is looking at exactly that */
    function outOfRange(duel, ctx) {
        var t = techOf(ctx);
        if (!t || !isObj(duel) || typeof duel.range !== "string") return false;
        var r = t.range;
        if (typeof r !== "string" || !r.length || r === "ANY") return false;
        return r !== duel.range;
    }

    /* ---------------------------------------------------------------
       persisted state
       --------------------------------------------------------------- */
    function defaultState() {
        return { v: STATE_V, seen: {}, greeted: false, done: false };
    }

    function normalize(raw) {
        var out = defaultState();
        if (!isObj(raw)) return out;
        var v = Math.round(num(raw.v));
        out.v = (v >= 1 && v <= 999) ? v : STATE_V;
        out.greeted = raw.greeted === true;
        out.done = raw.done === true;
        if (isObj(raw.seen)) {
            var n = 0, k;
            for (k in raw.seen) {
                if (!Object.prototype.hasOwnProperty.call(raw.seen, k)) continue;
                if (!raw.seen[k]) continue;
                if (typeof k !== "string" || !k.length || k.length > MAX_ID) continue;
                out.seen[k] = 1;
                n++;
                if (n >= MAX_SEEN) break;
            }
        }
        return out;
    }

    /* the state as it sits on a save - always a valid block */
    function stateOf(save) {
        if (!isObj(save)) return defaultState();
        return normalize(save[STATE_KEY]);
    }

    function markSeen(save, lessonId) {
        if (!isObj(save)) return save;
        var st = stateOf(save);
        if (typeof lessonId === "string" && lessonId.length && lessonId.length <= MAX_ID) {
            st.seen[lessonId] = 1;
        }
        st.greeted = true;
        if (allLessonsSeen(st)) st.done = true;
        save[STATE_KEY] = st;
        return save;
    }

    /* ---------------------------------------------------------------
       THE CURRICULUM
       Six concepts, in the order a player actually needs them, each tied to
       the moment in a live fight where it stops being trivia. Terse and
       declarative, in the register of HOW_TOPICS.

       A LESSON FIRES WHERE IT IS TRUE. The range lesson used to fire on
       turn 1 of any duel - on a one-exchange patrol where range never came
       into it, covering both fighters with a card about something that was
       not happening. Now it waits for the cursor to land on a technique
       whose range is not the fight's range. `anchor` names the piece of
       the HUD the card belongs beside, so the renderer can put it there
       rather than over the fighters.
       --------------------------------------------------------------- */
    var LESSONS = [
        {
            id: "l_range",
            title: "RANGE DECIDES",
            concept: "range",
            anchor: "range",
            trigger: "the cursor is on a technique whose range is not the fight's range",
            lines: [
                "KICKING - BOXING - CLINCH - GROUND.",
                "A TECHNIQUE ONLY WORKS PROPERLY",
                "AT ITS OWN RANGE. A HEAD KICK",
                "FROM MOUNT IS NOTHING."
            ],
            when: function (duel, side, turn, ctx) {
                return outOfRange(duel, ctx);
            }
        },
        {
            id: "l_initiative",
            title: "THE TURN RESOLVES",
            concept: "initiative",
            anchor: "log",
            trigger: "the first exchange has been resolved (turn 2 onward)",
            lines: [
                "BOTH FIGHTERS COMMIT AT ONCE.",
                "PRIORITY SETTLES IT FIRST - A",
                "SPRAWL ALWAYS BEATS A SHOT.",
                "SPEED ONLY SORTS THE REST."
            ],
            when: function (duel, side, turn) {
                return !!duel && turn >= 2;
            }
        },
        {
            id: "l_stamina",
            title: "STAMINA IS A BUDGET",
            concept: "stamina",
            anchor: "stamina",
            trigger: "player stamina falls to half, or WINDED / STAMINA BREAK lands",
            lines: [
                "STAMINA PAYS FOR EVERYTHING.",
                "GUARD BUYS IT BACK.",
                "EMPTY MEANS WINDED, AND WINDED",
                "MEANS LESS ON EVERY TECHNIQUE."
            ],
            when: function (duel, side, turn) {
                if (!duel || !side) return false;
                if (hasCond(side, "WINDED") || hasCond(side, "STAMINA_BREAK")) return true;
                return stamPct(side) <= 0.5;
            }
        },
        {
            id: "l_focus",
            title: "GUARD BANKS FOCUS",
            concept: "focus",
            anchor: "focus",
            trigger: "player has banked focus to spend (2, or 1 by turn 3)",
            lines: [
                "WHEN A HIT IS INBOUND A RING",
                "CLOSES - PRESS {B} ON THE MARK",
                "TO CUT IT AND BANK ONE FOCUS.",
                "{Y} SPENDS ONE - SEE THEIR PLAN."
            ],
            when: function (duel, side, turn) {
                if (!duel || !side) return false;
                var f = num(side.focus);
                var cap = num(side.focusMax);
                var need = (cap > 0 && cap < 2) ? cap : 2;
                return f >= need || (f >= 1 && turn >= 3);
            }
        },
        {
            id: "l_signature",
            title: "THE METER ARMS AT HALF",
            concept: "signature",
            anchor: "signature",
            trigger: "player signature meter reaches half of its ceiling",
            lines: [
                "THE SIGNATURE METER FILLS AS YOU",
                "DEAL AND TAKE DAMAGE.",
                "HALF A BAR ARMS THE CATEGORY.",
                "A FULL BAR IS THE FULL FINISHER."
            ],
            when: function (duel, side, turn) {
                if (!duel || !side) return false;
                return num(side.sup) >= supMaxOf(side) / 2;
            }
        },
        {
            id: "l_conditions",
            title: "CONDITIONS RUN OUT",
            concept: "status",
            anchor: "status",
            trigger: "either fighter is carrying a condition",
            lines: [
                "EVERY CONDITION CARRIES A COUNT",
                "OF TURNS AND THEN IT LAPSES.",
                "PINNED TAKES YOUR THROWS AWAY.",
                "A STAMINA BREAK TAKES YOUR GUARD."
            ],
            when: function (duel, side, turn) {
                if (!duel) return false;
                return anyCond(duel.p) || anyCond(duel.e) || anyCond(side);
            }
        }
    ];

    function copyLesson(l, keys) {
        var i, lines = [];
        for (i = 0; i < l.lines.length; i++) lines.push(expandKeys(l.lines[i], keys));
        return {
            id: l.id,
            title: l.title,
            lines: lines,
            concept: l.concept,
            anchor: l.anchor || "log",
            trigger: l.trigger
        };
    }
    function lessons(keys) {
        var out = [], i;
        for (i = 0; i < LESSONS.length; i++) out.push(copyLesson(LESSONS[i], keys));
        return out;
    }
    function allLessonsSeen(st) {
        var i;
        for (i = 0; i < LESSONS.length; i++) {
            if (!st.seen[LESSONS[i].id]) return false;
        }
        return true;
    }

    /* ---------------------------------------------------------------
       is this a new player, and is the curriculum over
       --------------------------------------------------------------- */
    function isComplete(save) {
        var st = stateOf(save);
        if (st.done) return true;
        /* a save from before this module existed: plenty of duels, nothing
           seen. It does not need to be walked through the jab. */
        if (duelsOf(save) >= GRADUATE_DUELS) return true;
        return allLessonsSeen(st);
    }

    function isNewPlayer(save) {
        if (!isObj(save)) return true;
        if (duelsOf(save) >= NEW_PLAYER_DUELS) return false;
        if (isComplete(save)) return false;
        return true;
    }

    /* ---------------------------------------------------------------
       NEXT GOAL - the one thing to do next, outside a fight.
       action is the menu key the caller should point at: "vs", "adv",
       "cont", "ranked", plus "how" for the HOW TO FIGHT topic.
       --------------------------------------------------------------- */
    var GOALS = [
        {
            id: "g_read_rules",
            title: "LEARN THE RANGES",
            line: "FOUR RANGES. YOUR ART ONLY WORKS IN ITS OWN.",
            action: "how",
            when: function (save, st) {
                return duelsOf(save) === 0 && !st.greeted && !st.seen.l_range;
            }
        },
        {
            id: "g_first_bout",
            title: "TAKE ONE BOUT",
            line: "THE FREE LAB - NOTHING ON THE LADDER.",
            action: "vs",
            when: function (save) { return duelsOf(save) === 0; }
        },
        {
            id: "g_first_win",
            title: "WIN ONE BOUT",
            line: "FIGHT WHERE YOUR ART LIVES.",
            action: "vs",
            when: function (save) { return duelsOf(save) >= 1 && winsOf(save) === 0; }
        },
        {
            id: "g_first_run",
            title: "START AN ADVENTURE",
            line: "CROSS THE FIELD. THE EXIT IS ON THE EAST EDGE.",
            action: "adv",
            when: function (save) { return winsOf(save) >= 1 && !hasRun(save); }
        },
        {
            id: "g_clear_stage",
            title: "CLEAR THE FIRST FIELD",
            line: "SIXTY STEPS. THE RUN IS WAITING.",
            action: "cont",
            when: function (save) { return hasRun(save) && stagesOf(save) === 0; }
        },
        {
            id: "g_master_one",
            title: "MASTER A FIGHTER",
            line: "BEAT ONE IN ADVENTURE AND THEY ARE YOURS.",
            action: "adv",
            when: function (save) { return masteredOf(save) === 0; }
        },
        {
            id: "g_ladder",
            title: "ENTER THE LADDER",
            line: "RANKED PUTS THE GRADE AT STAKE.",
            action: "ranked",
            when: function (save) { return duelsOf(save) >= LADDER_DUELS; }
        }
    ];

    function nextGoal(save, ctx) {
        /* inside a fight the corner talks, not the signpost */
        if (isObj(ctx) && ctx.scene === "DUEL") return null;
        if (isComplete(save)) return null;
        var st = stateOf(save), i, g;
        for (i = 0; i < GOALS.length; i++) {
            g = GOALS[i];
            if (!g.when(save, st)) continue;
            var out = { id: g.id, title: g.title, line: g.line, action: g.action };
            if (isObj(ctx) && typeof ctx.mode === "string" && ctx.mode) out.mode = ctx.mode;
            return out;
        }
        return null;
    }

    /* ---------------------------------------------------------------
       PENDING LESSON - the first unseen lesson whose moment is now.
       Scanned in curriculum order, so an early concept always wins over a
       later one, and a lesson whose trigger never fires never stalls the
       rest of the course.
       --------------------------------------------------------------- */
    function pendingLesson(save, ctx) {
        if (isComplete(save)) return null;
        var duel = (isObj(ctx) && isObj(ctx.duel)) ? ctx.duel : null;
        if (!duel) return null;
        var st = stateOf(save);
        var side = sideOf(duel, "p");
        var turn = turnOf(duel, ctx);
        var i, l;
        for (i = 0; i < LESSONS.length; i++) {
            l = LESSONS[i];
            if (st.seen[l.id]) continue;
            var fires = false;
            try { fires = !!l.when(duel, side, turn, ctx); } catch (e) { fires = false; }
            if (fires) return copyLesson(l, keysOf(ctx));
        }
        return null;
    }

    /* ---------------------------------------------------------------
       COACH TIP - one short line for the corner, or null.
       Cheap enough to call every frame: fixed comparisons, no table walks
       beyond a handful of condition lookups, no allocation until a tip
       actually fires.
       tone is one of "urgent" / "warn" / "good" / "info".
       --------------------------------------------------------------- */
    function tip(text, tone) { return { text: text, tone: tone }; }

    function coachTip(duel, side, ctx) {
        if (!isObj(duel)) return null;
        var me = sideOf(duel, side === undefined ? "p" : side);
        if (!me) return null;
        var foe = foeOf(duel, side === undefined ? "p" : side);
        var turn = turnOf(duel, ctx);

        /* 1. no air at all - everything else is academic */
        if (hasCond(me, "STAMINA_BREAK") || num(me.stam) <= 0) {
            return tip("NO AIR - GUARD BUYS IT BACK", "urgent");
        }
        /* 2. one clean shot from over */
        if (hpPct(me) <= 0.25) {
            return tip("ONE CLEAN SHOT ENDS THIS - COVER UP", "urgent");
        }
        /* 3. the conditions that take an option away */
        if (hasCond(me, "PINNED")) return tip("PINNED - NO THROWS FROM HERE", "warn");
        if (hasCond(me, "HELD")) return tip("HELD - YOU CANNOT DISENGAGE CLEAN", "warn");
        /* 4. the finisher is live */
        if (me.sig && num(me.sup) >= supMaxOf(me) / 2) {
            return tip("SIGNATURE IS ARMED - SPEND IT", "good");
        }
        /* 5. banked focus doing nothing */
        if (num(me.focus) >= 1 && !duel.readShown) {
            return tip("Y READS THEIR TECHNIQUE - ONE FOCUS", "info");
        }
        /* 6. the fight is being held outside your game */
        var home = homeOf(me, ctx);
        if (home && duel.range && home.indexOf(duel.range) < 0) {
            return tip("WRONG RANGE - MOVE THE FIGHT", "warn");
        }
        /* 7. running the tank down */
        if (stamPct(me) <= 0.35) {
            return tip("STAMINA IS LOW - GUARD TO BUY AIR", "warn");
        }
        /* 8. they are hurt - press it */
        if (foe && (hasCond(foe, "STUNNED") || hasCond(foe, "BLEEDING") ||
                    hasCond(foe, "OFF_BALANCE") || hasCond(foe, "DAZED"))) {
            return tip("THEY ARE HURT - CHAIN A COMBINATION", "good");
        }
        /* 9. the bell */
        if (turn <= 1) {
            return tip("CATEGORY FIRST, THEN THE TECHNIQUE", "info");
        }
        return null;
    }

    return {
        KEY: STATE_KEY,
        defaultState: defaultState,
        normalize: normalize,
        stateOf: stateOf,
        isNewPlayer: isNewPlayer,
        nextGoal: nextGoal,
        lessons: lessons,
        expandKeys: expandKeys,
        pendingLesson: pendingLesson,
        markSeen: markSeen,
        coachTip: coachTip,
        isComplete: isComplete
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = Onboarding;
}
