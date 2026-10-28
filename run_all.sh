#!/usr/bin/env bash
# Run every check for the piece selector. Needs node (18+) and python3; no packages.
set -euo pipefail
cd "$(dirname "$0")"
node selector.test.js
node pieces_match.test.js
node game_integration.test.js
node make_boards.js
PYTHONDONTWRITEBYTECODE=1 python3 -B evaluator_vs_simulator.py
echo "All piece-selector checks passed."
