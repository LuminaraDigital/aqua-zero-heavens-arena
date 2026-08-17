# Ranking System

**Aqua Zero Heavens Arena — Luminara Digital**

The ladder uses the real kyu/dan grading that karate, judo and Go have used for
over a century. You climb *down* through the kyu grades as a student, cross into
the dan grades, then climb *up* as a master.

```
Beginner  →  10th Kyu → 9th → 8th → … → 1st Kyu  →  1st Dan → 2nd → … → 10th Dan
             ←──────── numbers fall ────────→        ←──── numbers rise ────→
```

---

## Rank table

Every grade carries an `index` — one ordered number across the whole ladder — because
all the point maths cares about is the *gap* between two fighters, not which side of
the kyu/dan line they sit on.

| Index | Grade | Division | Points to hold |
|---|---|---|---|
| 0 | Beginner | Unranked | 0 |
| 1–4 | 10th – 7th Kyu | Copper | 2, 5, 9, 14 |
| 5–7 | 6th – 4th Kyu | Bronze | 20, 27, 35 |
| 8–10 | 3rd – 1st Kyu | Silver | 44, 54, 65 |
| 11–13 | 1st – 3rd Dan | Gold | 80, 98, 119 |
| 14–16 | 4th – 6th Dan | Sapphire | 143, 170, 200 |
| 17–19 | 7th – 9th Dan | Obsidian | 234, 272, 314 |
| 20 | 10th Dan | Heavens | 360 |

Print it any time with:

```bash
node tests/simulate-ladder.js --table
```

---

## How points work

Promotion points are **exchanged** between the two fighters. How many depends on the
gap between their grades, and on who was expected to win.

| Rank gap | Winner is higher-graded (expected) | Winner is lower-graded (upset) |
|---|---|---|
| Same grade | 1.0 | 1.0 |
| 1 apart | 0.5 | 1.75 |
| 2 apart | 0.25 | 2.5 |
| 3 or more | 0.125 | 3.25 |

Beating fighters far below you is worth almost nothing. Beating fighters above you is
worth a great deal. That is the entire anti-grind mechanism, and it is why the
matchmaker pairs you with your own grade.

**The exchange is zero-sum.** What the winner banks, the loser drops. This matters more
than it looks: at `lossRatio: 0.9` a fighter who wins exactly half their matches still
drifts all the way to 10th Dan, which makes the grade meaningless. There is exactly one
deliberate exception — the **novice shield** — where fighters at 8th Kyu and below lose
only 40% of the normal amount, so new players are not punished for learning.

Two more guards:

- **Caps.** No single match can move more than `maxGain` / `maxLoss` points.
- **Demotion protection.** Once you have earned a dan grade you cannot be demoted out
  of it, however long you lose.

```bash
node tests/simulate-ladder.js --gaps   # the exchange at every gap
```

### Match types

Not every fight is worth the same:

| Mode | Multiplier |
|---|---|
| `ranked` | 1.0 |
| `survival` | 0.6 |
| `adventure` | 0.5 |
| `exhibition`, `hotseat` | 0 |

Only **Ranked Match** is wired to the ladder today. The others are configured and ready.

---

## What the climb actually costs

Matched against your own grade every time, from Beginner to 10th Dan:

| Win rate | Matches to 10th Dan |
|---|---|
| 50% | never (plateaus around 6th Dan) |
| 55% | ~3,700 |
| 60% | ~1,700 |
| 70% | ~880 |
| 85% | ~510 |

A coin-flip fighter stalls. That is the ladder working.

```bash
node tests/simulate-ladder.js 200   # watch two fighters converge
```

---

## Architecture

```
src/progress/ranking/
  rank-table.js       the 21 grades, divisions, colours, thresholds
  ranking-service.js  point exchange, applyMatchResult, rank lookups — pure except one writer
  ranking-store.js    persistence adapter + request layer + UI helpers
```

The service never touches storage. It takes a store with three methods:

```js
{ get(playerId), put(playerId, ranking), log(entry) }
```

`makeSaveStore(SAVE)` backs it with the save file today. Swapping in an HTTP adapter is
the entire job of taking this online — nothing above that line changes.

### Entities

```js
Rank = { index, type: "BEGINNER"|"KYU"|"DAN", grade, title, short, division, color, threshold }

PlayerRanking = {
  playerId, promotionPoints, rankIndex, peakRankIndex,
  wins, losses, totalMatches, streak, lastRankChangeAt
}
```

### Service API

```js
const svc = RankingService(store, clock);

svc.calculatePointsExchange(winnerRank, loserRank, matchType)
   // -> { winnerGain, loserLoss, gap, upset, modeMult }

svc.applyMatchResult(winnerId, loserId, { matchId, matchType })
   // -> { exchange, audit, winner: {ranking, before, after, promoted},
   //                        loser:  {ranking, before, after, demoted} }

getRankForPoints(points)   getNextRank(rank)   getPreviousRank(rank)
rankProgress(points)       pointsToNextRank(points)
```

`applyMatchResult` reads both rankings, computes the exchange from the grades **as they
were before the match**, then writes both. The order of the two writes cannot change the
result, so there is no read-modify-write race even if two matches settle together.

### Request layer

Shaped like the routes it would become:

| Call | Route it maps to |
|---|---|
| `rankingApi.getPlayerRanking(id)` | `GET /players/:id/ranking` |
| `rankingApi.applyMatchRanking(matchId, body)` | `POST /matches/:id/ranking/apply` |
| `rankingApi.getLeaderboard(limit)` | `GET /leaderboard` |
| `rankingApi.getAuditLog(limit)` | `GET /admin/ranking/audit` |

Every call returns `{ ok, data }` or `{ ok: false, error }`. Writes go through a single
`commit()` so persistence happens exactly once per mutation — a half-applied match cannot
be saved. Every applied match appends an audit entry (both grades before and after, the
exchange, whether it was an upset); the log keeps the last `auditLimit` entries.

---

## In the game

**Menu → RANKED MATCH.** Pick your fighter and the matchmaker finds a CPU near your
grade. Your grade, points and record show on the menu row, the title screen and the
Records screen; the result screen shows the exchange, a progress bar toward the next
grade, and any promotion or demotion.

One single-player-specific decision worth knowing about: **a CPU's grade is assigned for
the match, not carried between matches.** If it persisted, beating the same opponents
would grind their grades into the floor, every win would pay 0.125, and you would plateau
against a pool you had personally demoted. The simulation models it the same way.

Opponent grade comes from `cpuRankIndexFor(fighterId, level)`, derived from the fighter's
dossier overall and their level.

---

## Example scenarios

**A beginner upsets a 3rd Kyu.** Gap of 8 → capped at 3 → upset factor 3.25. The beginner
banks 3.25 points and jumps straight from Beginner to 9th Kyu. The 3rd Kyu drops 3.25.

**A 5th Dan beats a 2nd Kyu.** Gap of 6 → expected → 0.125 points. Barely moves. The 2nd
Kyu is above the novice shield so drops the same 0.125.

**A 10th Kyu loses to a 1st Dan.** The novice shield applies: 0.125 × 0.4 = 0.05 points.
Effectively free.

**Two 4th Dans trade wins all night.** ±1.0 each time, zero-sum, neither moves far. To
climb, one of them has to actually be better.

---

## Tuning

Everything lives in `RANK_CONFIG` in `src/progress/ranking/ranking-service.js`:

| Key | Effect |
|---|---|
| `base` | points at stake in an even match |
| `gapFactor` | payout when the favourite wins — lower = harsher anti-grind |
| `upsetFactor` | payout when the underdog wins — higher = more volatile ladder |
| `maxGain` / `maxLoss` | per-match caps |
| `lossRatio` | **leave at 1.0** unless you want deliberate inflation |
| `demotionFloorIndex` | the grade you can never fall out of (default 1st Dan) |
| `noviceShieldIndex` / `noviceLossRatio` | how much new players are protected |
| `matchTypeMultiplier` | what each mode is worth |
| `auditLimit` | audit entries kept |

Rank thresholds live in `RANK_THRESHOLDS` in `rank-table.js`. Raising the later values
lengthens the dan climb without touching the kyu grades.

After any change:

```bash
node tests/run-tests.js ranking
node tests/simulate-ladder.js
```

The suite covers the exchange at every gap and direction, boundary transitions
(1st Kyu → 1st Dan), demotion protection, the novice shield, malformed requests,
unknown players, and the full climb.
