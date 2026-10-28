# Integrated Tetris + Version A questionnaire pilot

Based on Meta-T duration pilot v0.3.1. Gameplay preserved: 1 minute practice, then five 2-minute conditions (800, 467, 300, 217, 100 ms/drop).

After each condition: the three agreed anchor questions and four Version A matrix-sampled items. One attention check is inserted at a random question position in a random condition. Assignment to one of five group rotations is random per page load. All responses are required and start blank.

Start with index.html, complete the existing consent flow, and play. At the end, export the full JSON and questionnaire CSV.

Existing Google Apps Script endpoint is retained from the original game. New questionnaire_responses and questionnaire_assignment fields are added to checkpoint payloads, but backend persistence of these new fields has NOT been verified. Download the local JSON/CSV for reliable pilot capture.

This is a local integration for pilot testing; test gameplay, uploads, and consent before deploying to participants.
