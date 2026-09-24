/* =====================================================================
   Aqua Zero Heavens Arena - the docs cannot lie again
   Luminara Digital

   ARCHITECTURE.md used to claim a 19.1-point roster spread while
   `node tools/audit-balance.js 4` printed 58.3 and the word BROKEN, and
   it claimed the two middle ranges held 28% of turns while MID alone
   held 14.2. Nobody caught it because prose does not fail CI. It does
   now: tools/gen-docs.js generates the numbers and this suite holds the
   shape of that arrangement.

   This suite deliberately does NOT use the harness api. The claims are
   about files on disk, not about the game, so booting the built page
   would only couple a docs failure to whatever else is mid-rebuild. It
   still takes `h` because run-tests.js hands one to every suite - it
   uses `ok` and `section` from it and nothing else.

   What this suite is NOT: it does not re-run the audit (that is ~25s and
   it is `node tools/gen-docs.js --check`'s job in CI). It checks that the
   generated artefacts exist, parse, are complete, and that no hand-typed
   measurement has crept back into the prose around them.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BEGIN = "<!-- BEGIN GENERATED BALANCE -->";
const END = "<!-- END GENERATED BALANCE -->";

module.exports = function (h) {
  const { ok, section } = h;

  const arch = fs.readFileSync(path.join(ROOT, "ARCHITECTURE.md"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const reportPath = path.join(ROOT, "docs", "balance-report.json");

  const count = (hay, needle) => hay.split(needle).length - 1;

  /* `x.indexOf(y) > x.indexOf(z)` is a trap: a missing z returns -1 and
     every real index beats it, so the check passes for the wrong reason
     and can never fail. This suite had one - the heading anchor below -
     and it stayed green when the heading was renamed. Every ordering
     check now proves both operands exist first. */
  const at = (hay, needle) => { const i = hay.indexOf(needle); return i < 0 ? null : i; };
  const before = (hay, a, b) => {
    const i = at(hay, a), j = at(hay, b);
    return i !== null && j !== null && i < j;
  };

  const HEADING = "## Balance is measured, not asserted";

  section("the markers - generated content has a home");
  {
    ok(count(arch, BEGIN) === 1, "exactly one BEGIN marker in ARCHITECTURE.md", count(arch, BEGIN));
    ok(count(arch, END) === 1, "exactly one END marker in ARCHITECTURE.md", count(arch, END));
    ok(before(arch, BEGIN, END), "BEGIN exists, END exists, and BEGIN comes first");

    /* criterion 2 says the numbers live under this heading. Assert the
       heading is there before asserting anything about its position, or
       renaming it silently satisfies the anchor. */
    const headAt = at(arch, HEADING);
    ok(headAt !== null, "ARCHITECTURE.md still has the '" + HEADING + "' heading");
    ok(before(arch, HEADING, BEGIN), "the block comes after that heading");

    /* ...and before the next top-level heading, so it is inside the
       section rather than merely somewhere below it */
    const nextHead = headAt === null ? -1 : arch.indexOf("\n## ", headAt + HEADING.length);
    ok(headAt !== null && at(arch, END) !== null &&
       (nextHead < 0 || arch.indexOf(END) < nextHead),
       "the block closes before the next '## ' heading - it is inside the section, not after it");
  }

  const bStart = at(arch, BEGIN), bEnd = at(arch, END);
  const block = (bStart === null || bEnd === null || bEnd < bStart)
    ? "" : arch.slice(bStart, bEnd + END.length);

  section("the block - gen-docs has actually run");
  {
    ok(/\|\s*Metric\s*\|\s*Measured\s*\|/.test(block),
       "the block holds the generated metric table, not just the empty marker pair");
    ok(/tools\/gen-docs\.js/.test(block), "the block names the tool that wrote it");
    ["Roster win rate", "Discipline win rate", "Share of turns by range",
     "How fights end", "Fight length", "Techniques the AI ever throws",
    ].forEach((row) => ok(block.indexOf("| " + row + " |") >= 0, "the block has a '" + row + "' row"));
    ok(/\d+(\.\d+)?%/.test(block), "the block contains real measured percentages");
  }

  section("docs/balance-report.json - parses and is complete");
  {
    ok(fs.existsSync(reportPath), "docs/balance-report.json exists");

    /* This suite reads gen-docs' own output, and a full run once failed
       here - "the roster gap is best minus worst [12]" - because a
       gen-docs run was rewriting the file while the test was reading it.
       gen-docs now renames a temp file into place, which is atomic on
       NTFS and POSIX, so that window is closed at the source. Read
       defensively anyway: a torn or truncated read must say so plainly,
       not produce a confusing arithmetic failure against half a file.
       Read ONCE into memory and validate that snapshot - re-reading per
       check would let the file change underneath the suite. */
    let report = null, parseErr = "", raw = "";
    for (let tryN = 0; tryN < 3 && report === null; tryN++) {
      try {
        raw = fs.readFileSync(reportPath, "utf8");
        report = JSON.parse(raw);
      } catch (e) { parseErr = e.message; report = null; }
    }
    ok(report !== null, "docs/balance-report.json parses as JSON" +
       (report === null ? " (read " + raw.length + " bytes; if a gen-docs run is in " +
        "flight this is a torn read - re-run; if not, the file is corrupt)" : ""), parseErr);

    /* every key the plan's baseline table needs, by path. A missing key
       here means gen-docs stopped reporting a metric the gate and the
       plan still argue about. */
    const KEYS = [
      "generatedAt", "generator", "git.shortSha",
      "audit.command", "audit.repsPerMatchup", "audit.fights",
      "roster.fighters", "roster.best.name", "roster.best.ratePct",
      "roster.worst.name", "roster.worst.ratePct", "roster.gapPts",
      "roster.atBestRate", "roster.atWorstRate", "roster.identicalAtExtreme", "roster.verdict",
      "discipline.count", "discipline.best.name", "discipline.best.ratePct",
      "discipline.worst.name", "discipline.worst.ratePct", "discipline.gapPts",
      "rangeSharePct.LONG", "rangeSharePct.MID", "rangeSharePct.CLINCH", "rangeSharePct.GROUND",
      "finishSharePct.submission", "finishSharePct.strike",
      "fightLength.avgTurns", "fightLength.turnCap", "fightLength.hitCapPct",
      "techniques.thrown", "techniques.total", "techniques.coveragePct",
    ];
    const dig = (o, p) => p.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
    if (report === null) {
      /* one honest failure beats thirty derived ones. Say what went
         wrong and stop, rather than asserting arithmetic against a file
         we could not read. */
      ok(false, "report validation skipped - the JSON did not parse, so the " +
         "key manifest and the arithmetic checks below cannot mean anything", parseErr);
    } else {
      const missing = KEYS.filter((k) => dig(report, k) === undefined);
      ok(missing.length === 0, "every expected metric key is present", missing.join(", "));
    }

    if (report) {
      const r = report;
      const pcts = [r.roster.best.ratePct, r.roster.worst.ratePct,
                    r.discipline.best.ratePct, r.discipline.worst.ratePct,
                    r.rangeSharePct.LONG, r.rangeSharePct.MID, r.rangeSharePct.CLINCH,
                    r.rangeSharePct.GROUND, r.finishSharePct.submission,
                    r.finishSharePct.strike, r.techniques.coveragePct];
      ok(pcts.every((p) => typeof p === "number" && p >= 0 && p <= 100),
         "every percentage is a number between 0 and 100", pcts.join(","));
      ok(Math.abs(r.roster.gapPts - (r.roster.best.ratePct - r.roster.worst.ratePct)) < 0.05,
         "the roster gap is best minus worst, the same arithmetic check-balance-gate.js does",
         r.roster.gapPts);
      ok(Math.abs(r.discipline.gapPts - (r.discipline.best.ratePct - r.discipline.worst.ratePct)) < 0.05,
         "the discipline gap is best minus worst", r.discipline.gapPts);
      const rangeSum = r.rangeSharePct.LONG + r.rangeSharePct.MID +
                       r.rangeSharePct.CLINCH + r.rangeSharePct.GROUND;
      ok(Math.abs(rangeSum - 100) < 0.5, "the four range shares account for every turn", rangeSum);
      ok(r.techniques.thrown > 0 && r.techniques.thrown <= r.techniques.total,
         "techniques thrown is a real subset of the dex",
         r.techniques.thrown + "/" + r.techniques.total);
      ok(r.roster.best.ratePct >= r.roster.worst.ratePct && r.roster.best.name !== "",
         "the best fighter is named and is not below the worst", r.roster.best.name);
      ok(/^\d{4}-\d{2}-\d{2}T/.test(String(r.generatedAt)), "generatedAt is an ISO stamp", r.generatedAt);
      ok(String(r.audit.command).indexOf("audit-balance.js") >= 0 && r.audit.repsPerMatchup > 0,
         "the report records the exact audit command and rep count", r.audit.command);
    }
  }

  section("no hand-written measurement survives in the prose");
  {
    /* guarded: with a marker missing these slices would scan nonsense
       and the scanner would report on text that is not the prose */
    const outside = (bStart === null || bEnd === null)
      ? arch : arch.slice(0, bStart) + arch.slice(bEnd + END.length);
    ok(bStart !== null && bEnd !== null,
       "the prose scan below is running against a real inside/outside split");

    /* a measurement, not any number. `+15% power` and `a 1.3x swing` are
       designed constants that live in src (shop.js drillPrice comment,
       cornerDamageBonus) - they describe a rule, not a sample, and a
       reader can go read the rule. What rots is a percentage or a
       point-spread that came out of a run. */
    const MEASUREMENT = /\d+(\.\d+)?\s*(%|-?\s*point|pts\b)/g;
    /* the one surviving hit, with the reason it is allowed to survive */
    const ALLOWED = ["+15% power, +5 acc per tier"];

    const offenders = [];
    outside.split("\n").forEach((line, i) => {
      if (!MEASUREMENT.test(line)) return;
      MEASUREMENT.lastIndex = 0;
      if (ALLOWED.some((a) => line.indexOf(a) >= 0)) return;
      offenders.push((i + 1) + ": " + line.trim());
    });
    ok(offenders.length === 0,
       "no percentage or point-spread outside the generated block", offenders.join(" | "));

    /* prove the scanner is not just permissive: it must fire on the exact
       sentence this document used to carry, and stay quiet on the prose
       that is meant to stay */
    const fires = (s) => { MEASUREMENT.lastIndex = 0; return MEASUREMENT.test(s); };
    ok(fires("Current: 60.4% -> 41.3%, a 19.1-point spread across 25 fighters"),
       "the scanner catches the old false spread claim");
    ok(fires("the two middle ranges held 6.2% of all turns"),
       "the scanner catches the old range claim");
    ok(!fires("worth roughly a 1.3x swing - a win condition, never the win"),
       "the scanner leaves 'a 1.3x swing' alone - a designed constant, not a sample");
    ok(!fires("cornering is earned over 2-3 turns of landed work"),
       "the scanner leaves turn counts in rule prose alone");
  }

  section("the specific lies are gone");
  {
    /* Scoped to the prose, not the whole document. Several of these needles
       are bare percentages, and the generated block is made of percentages:
       when a re-tune happened to measure 41.3% strike finishes, this scan
       failed on a CORRECT measurement, and a later re-tune moved the number
       and the failure vanished on its own. A gate whose result depends on
       which way the dice fell teaches people to ignore gates. The retired
       strings were hand-typed prose, so the prose is where they must not
       come back. */
    const prose = (bStart === null || bEnd === null)
      ? arch : arch.slice(0, bStart) + arch.slice(bEnd + END.length);

    /* each of these was in ARCHITECTURE.md on 2026-09-21 and each was
       either false or about to be */
    const RETIRED = [
      ["19.1-point spread", "the roster spread the audit disagreed with"],
      ["60.4%", "the hand-typed best win rate"],
      ["41.3%", "the hand-typed worst win rate"],
      ["6.2%", "the pre-fix middle-range share"],
      ["They now hold **28%**", "the middle-range claim that measured 33.2"],
      ["1,238 checks", "a check count that moves every time a suite is added"],
      ["3,600 simulated fights", "a fight count that is an argument, not a fact"],
      ["17 suites", "a suite count that was already wrong"],
      ["techniques (425)", "a dex size that was already wrong"],
      ["disciplines (20)", "a discipline count that was already wrong"],
      ["26 stacking camp modifiers", "a benefit count that was already wrong"],
      ["four\ntests press A", "a test count nobody would maintain"],
    ];
    RETIRED.forEach(([needle, why]) =>
      ok(prose.indexOf(needle) < 0, "ARCHITECTURE.md's prose no longer says '" +
         needle.replace(/\n/g, " ") + "' - " + why));

    /* the scoping is the fix, so prove it both ways on a synthetic document:
       a retired number the AUDIT legitimately measured must not fire, and the
       same number typed into the prose must still fire. Without the first the
       gate is a coin flip on the audit's output; without the second the scan
       is decoration. */
    const proseOf = (doc) => {
      const s = at(doc, BEGIN), e = at(doc, END);
      return (s === null || e === null) ? doc : doc.slice(0, s) + doc.slice(e + END.length);
    };
    const measured = "intro\n" + BEGIN + "\n| strike finishes | 41.3% |\n" + END + "\ntail\n";
    ok(measured.indexOf("41.3%") >= 0,
       "the synthetic doc really does carry 41.3% inside the generated block");
    ok(proseOf(measured).indexOf("41.3%") < 0,
       "a retired number the audit legitimately measured does not fire the scan");
    ok(proseOf("the roster ran 41.3% at worst\n" + BEGIN + "\n" + END + "\n").indexOf("41.3%") >= 0,
       "the same number typed back into the prose still fires it");
  }

  section("README - shelved is described as shelved");
  {
    ok(readme.indexOf("Primary product direction") < 0,
       "README no longer calls TON the primary product direction");
    ok(/shelved/i.test(readme), "README says shelved in as many words");
    ["TON", "Supabase", "WebRTC"].forEach((what) =>
      ok(readme.indexOf(what) >= 0, "README still accounts for " + what + " rather than deleting it"));
    ok(/AZHA_SHELVED|build flag/i.test(readme),
       "README names the build flag that brings them back");
    ok(readme.indexOf("1,238") < 0 && !/\d,\d{3} checks/.test(readme),
       "README carries no hand-counted check total");

    /* the two things that must survive every rewrite of that section */
    ok(/GNU Affero General Public License/.test(readme) && /\[LICENSE\]\(LICENSE\)/.test(readme),
       "AGPLv3 and the LICENSE link are intact");
    ok(/## Play from GitHub/.test(readme) && /git clone/.test(readme) &&
       /npm run build/.test(readme) && /aqua-zero-heavens-arena\.html/.test(readme),
       "the play-from-GitHub instructions are intact and still name the built page");
  }

  section("the mechanism is wired to something");
  {
    const gen = path.join(ROOT, "tools", "gen-docs.js");
    ok(fs.existsSync(gen), "tools/gen-docs.js exists");
    const src = fs.readFileSync(gen, "utf8");
    ok(src.indexOf("--check") >= 0, "gen-docs.js supports --check, which is what CI calls");
    ok(src.indexOf(BEGIN) >= 0 && src.indexOf(END) >= 0,
       "gen-docs.js and this suite agree on the marker strings");
    ok(fs.existsSync(path.join(ROOT, "tools", "lib", "parse-audit.js")),
       "tools/lib/parse-audit.js exists - the gate and the docs share one parser");
    ok(/require\(["']\.\/lib\/parse-audit["']\)/.test(src),
       "gen-docs.js requires the shared parser instead of carrying its own copy");
    ok(!/spread: \(\[\\d\.\]\+\)% down to/.test(src) && src.indexOf("-- DISCIPLINE WIN RATES --") < 0,
       "no audit regex has crept back into gen-docs.js");
  }

  /* ---------------------------------------------------------------------
     The parser is shared with tools/check-balance-gate.js (A's file), so
     a divergence here means the gate and the docs report different
     numbers for the same build with neither of them erroring. That
     already happened twice, and both are pinned below against a
     hand-built fixture. Living in the docs suite because gen-docs.js is
     the consumer this workstream owns; if A would rather these sat in a
     balance suite, they move wholesale.
     --------------------------------------------------------------------- */
  section("the shared parser - the two divergences that caused this");
  {
    const { parseAudit } = require("../tools/lib/parse-audit");

    /* deliberately hostile: discipline rows OUT of order, a category
       row whose name starts with GROUND, and ties at both roster
       extremes */
    const FIXTURE = [
      "=========================================================",
      "  BALANCE AUDIT - 1,200 fights, 2 per matchup",
      "=========================================================",
      "",
      "-- ROSTER SPREAD (AI vs AI, level 9, no benefits) --",
      "   1. Alpha Fighter          70.0%  ############",
      "   2. Beta Fighter           70.0%  ############",
      "      ... 1 more ...",
      "   4. Gamma Fighter          30.0%  #####",
      "   5. Delta Fighter          30.0%  #####",
      "",
      "  spread: 70.0% down to 30.0%  (gap 40.0%)",
      "  verdict: LOOSE - noticeable tiers",
      "",
      "-- FIGHT LENGTH --",
      "  average 9.5 turns",
      "  hit the 60-turn cap: 1.5%   (fights resolve)",
      "",
      "-- WHAT THE AI ACTUALLY THROWS --",
      "    8.3%  Juji-Gatame               SUB/GROUND      Brazilian Jiu-Jitsu",
      "",
      "  100 of 400 techniques ever thrown (25.0% of the dex)",
      "  top technique is 8.3% of all actions   (no single dominant move)",
      "",
      "-- CATEGORY MIX --",
      "   12.0%  GROUND_POUND",
      "",
      "-- DOES RANGE ACTUALLY MOVE? --",
      "   10.0%  LONG",
      "   20.0%  MID",
      "   30.0%  CLINCH",
      "   40.0%  GROUND",
      "",
      "  average range changes per fight: 3.00   (range is live)",
      "",
      "-- HOW FIGHTS END --",
      "  submission finishes: 20.0%",
      "  strike finishes    : 60.0%",
      "",
      "-- DISCIPLINE WIN RATES --",
      "   45.0%  Judo",
      "   62.0%  Sambo",
      "   38.0%  Sumo",
    ].join("\n");

    const p = parseAudit(FIXTURE);
    ok(p.missing.length === 0, "the fixture parses clean - no label went unfound",
       p.missing.join(", "));

    /* divergence (a): positional would read best=Judo 45.0, worst=Sumo
       38.0, gap 7.0. By value it is Sambo 62.0 down to Sumo 38.0. */
    ok(p.discipline.best.name === "Sambo" && p.discipline.best.ratePct === 62,
       "discipline best is the highest rate, not the first row printed",
       p.discipline.best.name + " " + p.discipline.best.ratePct);
    ok(p.discipline.worst.name === "Sumo" && p.discipline.worst.ratePct === 38,
       "discipline worst is the lowest rate, not the last row printed",
       p.discipline.worst.name + " " + p.discipline.worst.ratePct);
    ok(p.discipline.gapPts === 24, "discipline gap is max minus min on unsorted rows",
       p.discipline.gapPts);
    ok(p.discipline.gapPts === p.gate.discGap,
       "the gate alias and the report agree on the discipline gap");

    /* divergence (b): an unscoped /([\d.]+)%  GROUND/ matches the
       CATEGORY MIX row "12.0%  GROUND_POUND" first and reports 12.0 */
    ok(p.rangeSharePct.GROUND === 40,
       "GROUND share comes from the range section, not from a category row that starts with GROUND",
       p.rangeSharePct.GROUND);
    ok(p.rangeSharePct.MID === 20 && p.rangeSharePct.LONG === 10 && p.rangeSharePct.CLINCH === 30,
       "the other three range shares are section-scoped too");
    ok(p.gate.groundShare === 40 && p.gate.midShare === 20,
       "the gate aliases read the same section-scoped numbers");

    /* ties at both extremes are the clamp signature the plan gates on */
    ok(p.roster.atBestRate === 2 && p.roster.atWorstRate === 2 && p.roster.identicalAtExtreme === 2,
       "ties at a printed extreme are counted at both ends", p.roster.identicalAtExtreme);
    ok(p.roster.best.name === "Alpha Fighter" && p.roster.worst.name === "Delta Fighter",
       "under a tie the parser picks the first at the top and the last at the bottom",
       p.roster.best.name + " / " + p.roster.worst.name);
    ok(p.roster.fighters === 5, "roster size comes from the highest printed rank", p.roster.fighters);
    ok(p.roster.gapPts === 40 && p.gate.rosterGap === 40,
       "roster gap is best minus worst in both shapes", p.roster.gapPts);

    /* a half-written page produces truncated stdout - that must report
       missing labels, never a confident wrong answer */
    const torn = parseAudit(FIXTURE.slice(0, FIXTURE.indexOf("-- HOW FIGHTS END --")));
    ok(torn.missing.length > 0, "truncated audit output reports missing labels rather than parsing",
       torn.missing.length);
    ok(parseAudit("").missing.length > 0, "empty stdout is missing labels, not a valid parse");
  }
};
