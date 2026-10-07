# Meta-T v0.2.1 — Consent + Data Collection

Flow:
1. index.html is Nicole's consent page.
2. It generates/displays one anonymous PPT-XXXXXXXX ID.
3. Consent + ID are stored in sessionStorage.
4. Continue opens game.html.
5. game.html refuses to run without consent and a valid PPT ID.
6. The same PPT ID is used for all telemetry and the Google Drive folder.
7. Existing Drive checkpointing is retained.

Expected Drive:
PPT-XXXXXXXX/
  SESSION-YYYYMMDDHHMMSS_UNIQUE/
    session.json
    events.jsonl
    condition_summary.csv
    ratings.csv

Nicole's consent wording is preserved. It currently mentions CORGIS/NASA-TLX and demographic
variables which are not yet implemented in this build; align these with final approved study
materials before recruitment.
