# Online Tetris v0.6 — three ratings + HMM telemetry

Upload `index.html`, `game.html`, `game.js`, and `experiment.css` into the same folder as your existing GitHub Pages site, replacing matching files. Test on a branch first.

## Study
- 1-minute practice; five 2-minute levels, gravity intervals 800, 467, 300, 217, 100 ms.
- Three **required** 1–7 ratings after every level: perceived challenge, enjoyment, frustration. No longer-form challenge/frustration questionnaires.
- Each completed session should contain 5 rating_response events and 15 questionnaire_responses (3 per level).
- `challenge_rating`, `enjoyment_rating`, `frustration_rating` populated in ratings, condition summaries and rating_response events.
- Existing raw HMM telemetry and upload endpoint retained.

## Validation
1. Test all five levels, rating submission, held down-arrow, game-over restart and exports.
2. Export full JSON and confirm all 15 questionnaire responses and piece/board events.
3. Share dummy session export for detailed PCA/HMM compatibility assessment.

**Important:** The telemetry supports further reconstruction but does not guarantee compatibility with the original 63-input saved PCA. Review consent and ethics documentation before recruiting participants.
