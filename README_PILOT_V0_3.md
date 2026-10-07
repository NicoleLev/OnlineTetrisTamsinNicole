# Meta-T Range-Finding Pilot v0.3

Purpose
-------
Range-find useful objective-difficulty conditions before the main study.

Mechanics/data baseline
-----------------------
Built directly from validated v0.2.4. Consent, anonymous PPT IDs, Google Drive
checkpointing, no grid, next-piece preview, no ghost, disabled hard drop,
continuous held soft drop, explicit soft-drop telemetry, automatic top-out
restart, challenge/frustration ratings, and expanded summaries are preserved.

Pilot timing
------------
Practice: 2 minutes.
Conditions: 9 x 60 seconds.
Challenge and frustration ratings follow every condition.

EEG-derived gravity conditions
------------------------------
The original EEG Meta-T progression uses 10 lines per level and gravity intervals
in frames. This pilot samples selected levels while making condition duration,
rather than performance, determine progression:

Condition 1: EEG L0, 48 frames/drop, 800 ms/drop
Condition 2: EEG L2, 38 frames/drop, 633 ms/drop
Condition 3: EEG L3, 33 frames/drop, 550 ms/drop
Condition 4: EEG L4, 28 frames/drop, 467 ms/drop
Condition 5: EEG L5, 23 frames/drop, 383 ms/drop
Condition 6: EEG L6, 18 frames/drop, 300 ms/drop
Condition 7: EEG L7, 13 frames/drop, 217 ms/drop
Condition 8: EEG L8, 8 frames/drop, 133 ms/drop
Condition 9: EEG L9, 6 frames/drop, 100 ms/drop

The browser implementation uses millisecond approximations of the ~60 Hz EEG
frame intervals. Line clears DO NOT change gravity in this pilot.

New metadata
------------
condition_summary.csv and ratings.csv include eeg_level and frames_per_drop.
Raw play events also include these fields, alongside drop_interval_ms.

Pilot goal
----------
Use challenge/frustration ratings plus telemetry to identify redundant speeds
and the region where perceived challenge/frustration changes most sharply.
Do not treat the 60-second duration or nine-condition set as the final study
design; they are range-finding parameters.
