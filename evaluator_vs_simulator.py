"""Check piece_selector.js's six Dellacherie features against Meta-T's simulator.py, placement by placement.

Run tests/make_boards.js first. simulator.py is Python 2 code: under Python 3 its get_cols()
returns a one-shot zip iterator, so every feature read after column heights (holes, column
transitions, pit depth, pattern diversity) silently comes out as zero. The patch below restores
the Python 2 behaviour for this comparison only.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import simulator  # noqa: E402

simulator.TetrisSimulator.get_cols = lambda self, space: list(zip(*space))

KEYS = ["landing_height", "eroded_cells", "row_trans", "col_trans", "pits", "cuml_wells"]
boards = json.load(open(os.path.join(HERE, "boards.json")))
n = bad = unmatched = 0
for b in boards:
    sim = simulator.TetrisSimulator(board=b["rows"], curr="T", next="I", show_result=False)
    seen = set()
    for z in sim.pieces:
        for col, rot, row, simboard, feats, ends in sim.possible_moves(zoid=z, space=sim.space):
            if ends:
                continue
            cells = sorted(r * 10 + c for r in range(20) for c in range(10) if simboard[r][c] == 2)
            key = z + ":" + ",".join(map(str, cells))
            seen.add(key)
            n += 1
            js = b["feats"].get(key)
            if js is None:
                unmatched += 1
                continue
            diff = {k: (feats[k], js[k]) for k in KEYS if feats[k] != js[k]}
            if diff:
                bad += 1
                if bad <= 5:
                    print("MISMATCH", key, diff)
    unmatched += len(set(b["feats"]) - seen)
print(f"evaluator_vs_simulator.py: {n} placements on {len(boards)} boards, {bad} feature mismatches, {unmatched} unmatched placements")
sys.exit(1 if bad or unmatched or n == 0 else 0)
