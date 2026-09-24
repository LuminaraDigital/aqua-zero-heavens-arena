# MMA Warriors inspiration - design provenance

Aqua Zero Heavens Arena borrowed **design patterns** from the MIT-licensed
[Kebabasaurus/MMA-Warriors](https://github.com/Kebabasaurus/MMA-Warriors)
promotion sim. Nothing was vendored as Python source. All systems below are
reimplemented for the single-file JS card duel.

## What landed

| Pattern | Aqua Zero module | Notes |
|---|---|---|
| Head/body/leg damage | `src/battle/effects.js`, `resolve.js` | Already present; extended with cut meter + results rows |
| Clinch / top ownership | `src/battle/control.js` | Explicit controller; no silent swaps |
| Camp focus + workload | `src/data/camp-focus.js`, shop CAMP tickets | Modest bell buffs; hard workload can injure |
| Style traits | `src/data/style-traits.js` | Derived from disciplines; biases AI + hit effects |
| Career arcs | `src/progress/career-arcs.js` | Shapes mastery XP over fight count |
| Player callouts / heat | `src/progress/rivalry-heat.js` | Exhibition toggle; duel atk + purse garnish |
| Commentary invariants | `src/battle/ai-commentary.js` | Structural lines always kept; sealed scorecards |
| Crowd cue families | `src/ui/music.js` `crowdCue` | Per-family cooldown; no immediate variant repeat |
| Competitive audit | `tools/audit-balance.js --competitive` | Same-tier pairing (gap <= 6) finish rates |

## What was deliberately not ported

- Promotion finance, contracts, PPV, child promotions, academy ages
- Real promotion brands / fighter databases (trademark risk)
- Tkinter UI / mixin megaclass architecture
- Weight-cut as a core loop (available only as camp `weight_mgmt`)

## License

MMA Warriors: MIT. Aqua Zero: AGPLv3. Pattern reuse with attribution is fine;
any future code paste must keep MIT notice and AGPL compatibility.
