# Meta-T Challenge–Frustration Online Experiment — v0.1

This folder is a first research prototype based on the browser `game.js` supplied in `OnlineTetrisTamsinNicole-main`.

## What v0.1 changes

- Difficulty is **not** increased by clearing 10 lines.
- Nine experimental conditions are defined explicitly by tetromino drop interval.
- Each condition has a fixed duration (currently 5 minutes).
- Game over resets the board and starts another attempt **within the same condition**.
- Challenge and frustration are rated from 1–7 after every condition.
- Timestamped telemetry is recorded for gameplay events.
- A condition-level summary is produced.
- Development data can be downloaded as JSON at the end.
- A short practice period is included.

## Important: speeds are placeholders

The nine drop intervals in `EXPERIMENT.conditions` are candidate values only. They should be piloted before the study and should not be described as validated difficulty levels.

## Important: post-play questionnaire

CORGIS and NASA-TLX are **not implemented in v0.1**. Their exact validated wording, response format, scoring and usage requirements should be confirmed before they are added. The final screen is currently a placeholder.

## Current data

The JSON export contains:

- `metadata`
- `events`
- `condition_summaries`
- `ratings`

Events include condition start/end, keypresses, moves, rotations, drops, piece placements, line clears, game overs, restarts, rating events, and focus changes.

## Development use

Open `index.html` in a browser. For more reliable browser behaviour, serve the directory locally, e.g. with VS Code Live Server or:

```bash
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Before real online deployment

v0.1 is a local prototype, **not yet a deployable participant study**. Before data collection it still needs:

1. final/piloted condition speeds and durations;
2. final instructions and consent/ethics flow;
3. validated CORGIS/NASA-TLX implementation;
4. demographics / Tetris and gaming experience measures;
5. secure server-side data submission (participants should not download/send JSON);
6. seeded/reproducible tetromino generation if required;
7. handling of focus loss and interrupted sessions according to the study protocol;
8. browser/device compatibility testing;
9. final telemetry decisions and analysis-ready field definitions.

## Files

- `index.html` — study screens and rating UI
- `experiment.css` — presentation
- `game.js` — Tetris, experiment controller and telemetry
