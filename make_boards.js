// Write boards from sloppy simulated games, with this evaluator's features for every placement,
// for tests/evaluator_vs_simulator.py to check against Meta-T's simulator.py.
const fs = require("fs");
const path = require("path");
const S = require("../piece_selector.js");
const rng = S.mulberry32(7);
const out = [];
const stack = b => S.H - Math.min(...S.columnTops(b));
for (let g = 0; g < 40 && out.length < 300; g++) {
    let board = S.emptyBoard();
    for (let n = 0; n < 200 && stack(board) <= 15; n++) {
        if (n % 5 === 0) {
            const rows = [];
            for (let r = 0; r < S.H; r++) rows.push(Array.from(board.slice(r * S.W, (r + 1) * S.W)));
            const feats = {};
            for (const t of S.TYPES) for (const pl of S.placements(board, t)) {
                if (pl.above) continue;
                const key = S.SHAPES[t][pl.rot].cells.map(([dr, dc]) => (pl.y + dr) * S.W + pl.x + dc).sort((a, b) => a - b).join(",");
                feats[t + ":" + key] = S.features(board, t, pl);
            }
            out.push({ rows, feats });
        }
        const t = S.TYPES[Math.floor(rng() * 7)];
        const opts = S.placements(board, t).filter(p => !p.above);
        const vals = opts.map(p => S.features(board, t, p).value), m = Math.max(...vals);
        const w = vals.map(v => Math.exp((v - m) / 3)), z = w.reduce((a, b) => a + b, 0);
        let r = rng() * z, pick = opts[opts.length - 1];
        for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r < 0) { pick = opts[i]; break; } }
        board = S.apply(board, t, pick).board;
    }
}
fs.writeFileSync(path.join(__dirname, "boards.json"), JSON.stringify(out));
console.log(`make_boards.js: wrote ${out.length} boards, ${out.reduce((a, b) => a + Object.keys(b.feats).length, 0)} placements`);
