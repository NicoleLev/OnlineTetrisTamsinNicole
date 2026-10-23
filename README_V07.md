# Tetris pilot v0.7 — hold-to-move and participant finish screen

Based on `tetris_github_hmm_three_ratings_v06.zip`.

- Left/right: immediate movement, then 267 ms DAS, then one movement every 100 ms (ARR) while held.
- Stops on keyup, blur, phase transitions, and board resets. New movement events include `input_mode` (`initial_press` or `held_repeat`), while `keypress` counts physical keydown only. Hold start/end events are logged.
- Down/rotation/hard-drop behaviour and level durations are unchanged.
- Removed participant-facing JSON/CSV download buttons. Research-only export helpers remain in source, not shown in the UI.
- At completion, submits a `study_complete` checkpoint and displays a Finish button and retry option.

**Important backend limitation:** the existing Google Apps Script endpoint uses `fetch(..., mode:'no-cors')`, which yields an opaque response. The page can confirm a submission request was sent but **cannot verify that Google Drive persisted it**. Verify the final checkpoint in Drive during deployment testing. The existing pagehide beacon may also run after Finish/closing; the backend should deduplicate checkpoints by session ID.

**Deployment:** replace the existing site files with `index.html`, `game.html`, `game.js`, and `experiment.css` together. Test on a staging GitHub Pages site before using with participants.
