# v0.2 Data Collection
Uses the confirmed-working v0.1.2-hotfix gameplay.

Backend endpoint:
https://script.google.com/macros/s/AKfycbx8J8GSpEidx-WarHNmS7_Ko4eBpFFLJMgcDq758dzrWQX83I6eor9jK8YBNWW3GhnptA/exec

Automatic data:
- anonymous PPT-XXXXXXXX ID
- dated/timed unique SESSION ID
- raw events
- condition summaries
- challenge/frustration ratings
- checkpoints after practice, each condition, each rating, game over, every 30 seconds, completion
- best-effort page-close checkpoint
- latest unsent payload retained locally if fetch fails

Expected Drive:
PPT-XXXXXXXX/
  SESSION-YYYYMMDDHHMMSS_UNIQUE/
    session.json
    events.jsonl
    condition_summary.csv
    ratings.csv

Run a dummy session before pilot recruitment and inspect all four files.
