# Tetris pilot v0.8 — difficulty from piece selection, not speed

Based on v0.7 (`experimental-study-v0`). The five conditions now differ in **which pieces are
dealt**, and every condition falls at the **same speed**. Changing speed changes how often people
press keys and how much moves on screen, which are inputs to the HMM; changing the pieces leaves
those settings alone.

Background, demo and simulations: https://claude.ai/artifact/57nQgVb2to8ZVfhTTCP4mt (a private page; ask Alex to share it).

## How a piece is chosen

When a piece locks, `piece_selector.js` picks the piece for the preview slot:

1. For each of the seven pieces, it tries every spot for the current piece followed by every spot
   for the candidate. The candidate's score is the best Meta-T Dellacherie total over those pairs.
   This is the same six-feature controller as `simulator.py`, checked against it in `tests/`.
2. Scores are rescaled on the current board: helpfulness `u` = 1 for the best candidate and 0 for
   the worst.
3. The piece is drawn with probability ∝ exp(β·u) from a seeded generator. β = 0 is uniform random
   (the v0.7 deal), β > 0 favours helpful pieces and β < 0 unhelpful ones. At β = 4 the best piece
   is e⁴ ≈ 55 times as likely as the worst.

The first piece of each board uses a one-piece version of step 1. A placement that leaves blocks in
the top two rows counts as a top-out, matching the game-over rule in `game.js`.

## Conditions (placeholders to pilot)

Set in `EXPERIMENT` at the top of `game.js`:

| Condition | β | Drop interval |
|---|---|---|
| Practice | 0 | 467 ms |
| 1 | +4 | 467 ms |
| 2 | +2 | 467 ms |
| 3 | 0 | 467 ms |
| 4 | −2 | 467 ms |
| 5 | −4 | 467 ms |

The fixed speed is `FIXED_GRAVITY` (EEG level 4, 28 frames per drop). Practice now runs at the
experiment speed, not 1000 ms. The order runs from easiest to hardest, as the speed version did;
it is not counterbalanced. Participant-facing text no longer mentions falling speed.

## New and changed telemetry

`hmm_logging_revision` is now `hmm-raw-telemetry-04-piece-selection`.

- **`piece_dealt`** (new, one per dealt piece): `dealt`, `dealt_piece_id`, `played_before` (the piece
  played before it, or null for a board's first piece), `lookahead` (`two_piece` or `one_piece`),
  `board_before`, `beta`, `dealer_seed`, `deal_index`, `rng_draw`, `candidate_scores` and
  `candidate_chances` for all seven pieces, `dealt_rank` (1 = best), `dealt_helpfulness` (0–1),
  `selector_ms` and `selector_revision`. The two deals for a new board come just before that board's
  `condition_start`, `practice_start` or `restart` event.
- **`piece_placed`** adds `placement_score` (Dellacherie score of where the participant put the piece),
  `best_placement_score` and `placement_regret` (best minus actual; 0 means the controller agrees).
- **`condition_start` / `practice_start`** add `beta`, `dealer_seed` and `selector_revision`.
- **Condition summaries** add `beta`, `pieces_dealt`, `mean_dealt_helpfulness` (the manipulation
  check) and `mean_placement_regret`. **Ratings** add `beta`.
- **Upload payload and export metadata** add `difficulty_manipulation`, `condition_betas`,
  `practice_beta`, `selector_revision` and `session_seed`.
- β = ±∞ is written as the string `"Infinity"` / `"-Infinity"`, because JSON would turn it into null.

Every deal can be rebuilt offline from `board_before`, `played_before`, `beta` and `dealer_seed`,
taking each condition's deals in `deal_index` order. The tests do this for every deal.

## Bug fix: `decision_time_ms`

In v0.7 a piece was timed from when it entered the **preview**, so `decision_time_ms` for every
piece after the first on a board also included the previous piece's time. A piece held for 1 s was
logged as about 2 s. It is now timed from when it enters the board. In v0.7 data, the true value is
the `piece_placed` time minus that piece's `piece_spawn` time.

## Checks

```bash
tests/run_all.sh          # node 18+ and python3, no packages
```

- `selector.test.js`: β = ±∞ deals the best/worst piece; ties split evenly; β = 0 is uniform (χ²);
  same seed gives the same deals; the top-out rule matches `game.js`; infinite β survives JSON.
- `pieces_match.test.js`: the selector's rotations are identical to `PIECES` in `game.js`.
- `game_integration.test.js`: plays `game.js` in node through its own move functions. Checks that
  every piece comes from the selector, every deal replays from the log, the speed never changes,
  helpfulness falls from condition 1 to 5, and `decision_time_ms` is right.
- `evaluator_vs_simulator.py`: the six features agree with `simulator.py` on about 49,000
  placements (0 mismatches).
- `tests/browser_check.html`: serve the folder (`python3 -m http.server 8000`), then open
  `http://localhost:8000/tests/browser_check.html`. It plays the whole study in the real page with
  uploads intercepted, and reports PASS or FAIL.

`node tools/calibrate.js` reruns the simulated players under these rules and writes
`tools/calibration_summary.json`. Rerun it after changing β, the evaluator or the rules.

## Calibration (simulated players, 30 games per cell, games stop at 500 pieces)

| β | Skilled bot: lost / median pieces | Novice bot: lost / median pieces | Mean helpfulness | Moves per piece | Seconds to land at 467 ms |
|---|---|---|---|---|---|
| −∞ | 30/30 / 44.5 | 30/30 / 41 | 0.00 | 3.1 | 4.5 |
| −4 | 30/30 / 65 | 30/30 / 48 | 0.13–0.14 | 3.2 | 4.4–4.5 |
| −2 | 30/30 / 117 | 30/30 / 66 | 0.27 | 3.3–3.4 | 4.5–4.6 |
| 0 | 0/30 / 500 | 30/30 / 125.5 | 0.48–0.49 | 3.5 | 4.0–6.8 |
| +2 | 0/30 / 500 | 5/30 / 500 | 0.71–0.72 | 3.4–3.5 | 6.2–7.9 |
| +4 | 0/30 / 500 | 1/30 / 500 | 0.86–0.87 | 3.3–3.5 | 7.4–8.1 |
| +∞ | 0/30 / 500 | 0/30 / 500 | 1.00 | 3.1–3.4 | 7.8–8.3 |

Moves (turns plus sideways steps) barely change. The time a piece takes to land on its own does
change: harder settings build a taller stack, so pieces fall about 9.5 rows instead of about 16–17.

## Decide before piloting

1. **The fixed speed.** 467 ms is a placeholder; choose it from the v0.3 speed-pilot ratings.
2. **The β values and order.** The simulations suggest ±2 and ±4 span the useful range. Consider
   counterbalancing the order.
3. **Time per piece.** With hard drop disabled, a piece in a hard condition lands on its own after
   about 4.5 s, against 7.5–8 s in an easy one. Keep `rows fallen` and `decision_time_ms` as HMM
   covariates, or change the rule (for example, a fixed time per piece).
4. **Players may notice.** At β = −4, about two thirds of pieces are S, Z or O (three sevenths, 43%,
   under random dealing). Ask at debrief whether the pieces seemed random.
5. **Consent and ethics.** The information sheet does not say pieces are random. Consider adding
   "the difficulty of the game will vary between games" and a debrief sentence, and confirm with
   the ethics committee.
6. **Backend.** Check that the Google Apps Script writes the new summary columns and
   `piece_dealt` events. Uploads still use `no-cors`, so delivery to Drive cannot be confirmed
   from the page.

## Note on `simulator.py`

The web game does not use `simulator.py`; it belongs to the desktop Meta-T (`meta-t.py`, `world.py`).
Under Python 3 its `get_cols()` returns a `zip` iterator that is used up after the first read, so
`pits`, `pit_rows`, `lumped_pits`, `pit_depth`, `mean_pit_depth`, `col_trans`, `all_trans`,
`pattern_div` and `d_pits` silently come out wrong (mostly zero). This affects the board features
in the desktop Meta-T logs and the controller behind its hints, after-action review and auto-solve.
Python 2 is unaffected. The fix is `return list(zip(*space))`; it is not applied in this branch.
