// Meta-T piece selector: sets difficulty by choosing how helpful the next piece is,
// so the falling speed can stay fixed across conditions.
//
// Each deal scores all seven piece types with Meta-T's Dellacherie controller and draws one
// with P(piece) proportional to exp(beta * helpfulness). beta = +Infinity always deals the most
// helpful piece, -Infinity the least helpful, and 0 is uniform random (the original game).
//
// Runs in the browser (window.PieceSelector) and in node (module.exports) for tests.
(function (root) {
    const SELECTOR_REVISION = "piece-selector-01";
    const W = 10, H = 20;
    const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

    // Must match PIECES in game.js (tests/pieces_match.test.js checks this).
    const ROTATIONS = {
        I: [[[1,1,1,1]], [[1],[1],[1],[1]]],
        O: [[[1,1],[1,1]]],
        T: [[[1,1,1],[0,1,0]], [[0,1,0],[1,1,0],[0,1,0]], [[0,1,0],[1,1,1]], [[0,1,0],[0,1,1],[0,1,0]]],
        S: [[[0,1,1],[1,1,0]], [[0,1,0],[0,1,1],[0,0,1]]],
        Z: [[[1,1,0],[0,1,1]], [[0,0,1],[0,1,1],[0,1,0]]],
        J: [[[1,1,1],[0,0,1]], [[0,1,0],[0,1,0],[1,1,0]], [[1,0,0],[1,1,1]], [[0,1,1],[0,1,0],[0,1,0]]],
        L: [[[1,1,1],[1,0,0]], [[1,1,0],[0,1,0],[0,1,0]], [[0,0,1],[1,1,1]], [[0,1,0],[0,1,0],[0,1,1]]]
    };

    // Meta-T simulator.py default controller ("dellacherie").
    const WEIGHTS = { landing_height: -1, eroded_cells: 1, row_trans: -1, col_trans: -1, pits: -4, cuml_wells: -1 };
    // game.js ends the attempt if any block is left in the top two rows after a piece locks.
    const TOPOUT_ROWS = 2;
    const TOPOUT_SCORE = -1000;

    const SHAPES = {};
    for (const t of TYPES) {
        SHAPES[t] = ROTATIONS[t].map(mat => {
            const cells = [];
            for (let r = 0; r < mat.length; r++)
                for (let c = 0; c < mat[r].length; c++)
                    if (mat[r][c]) cells.push([r, c]);
            const bottom = {};
            for (const [r, c] of cells) bottom[c] = Math.max(bottom[c] ?? -1, r);
            const cols = Object.keys(bottom).map(Number).sort((a, b) => a - b);
            return {
                cells, cols, bottom: cols.map(c => bottom[c]),
                minDc: cols[0], maxDc: cols[cols.length - 1],
                minDr: Math.min(...cells.map(x => x[0]))
            };
        });
    }

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const emptyBoard = () => new Int8Array(W * H);

    // game.js board (rows of 0 or colour arrays) -> flat Int8Array of 0/1, top row first.
    function fromRows(rows) {
        const b = emptyBoard();
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++)
                if (rows[r][c]) b[r * W + c] = 1;
        return b;
    }

    function columnTops(board) {
        const tops = new Int8Array(W).fill(H);
        for (let c = 0; c < W; c++)
            for (let r = 0; r < H; r++)
                if (board[r * W + c]) { tops[c] = r; break; }
        return tops;
    }

    // Hard-drop placements reachable from above: one per (rotation, column).
    function placements(board, type, tops) {
        tops = tops || columnTops(board);
        const out = [];
        SHAPES[type].forEach((s, rot) => {
            for (let x = -s.minDc; x <= W - 1 - s.maxDc; x++) {
                let y = Infinity;
                for (let i = 0; i < s.cols.length; i++)
                    y = Math.min(y, tops[x + s.cols[i]] - 1 - s.bottom[i]);
                out.push({ rot, x, y, above: y + s.minDr < 0 });
            }
        });
        return out;
    }

    const stamped = new Int8Array(W * H);
    const compact = new Int8Array(W * H);
    const full = new Uint8Array(H);

    // Meta-T definitions (simulator.py get_features): landing height = rows below the piece's
    // lowest cell; eroded cells = piece cells in cleared rows; transitions ignore walls and floor;
    // wells come from column heights. pl must lie inside the board.
    function features(board, type, pl) {
        const s = SHAPES[type][pl.rot];
        stamped.set(board);
        let lowest = -1;
        for (const [dr, dc] of s.cells) {
            const r = pl.y + dr;
            stamped[r * W + pl.x + dc] = -1;
            if (r > lowest) lowest = r;
        }
        let lines = 0, eroded = 0;
        for (let r = 0; r < H; r++) {
            let f = 1;
            for (let c = 0; c < W; c++) if (!stamped[r * W + c]) { f = 0; break; }
            full[r] = f;
            if (f) {
                lines++;
                for (let c = 0; c < W; c++) if (stamped[r * W + c] === -1) eroded++;
            }
        }
        compact.fill(0);
        let dst = H - 1;
        for (let r = H - 1; r >= 0; r--) {
            if (full[r]) continue;
            for (let c = 0; c < W; c++) compact[dst * W + c] = stamped[r * W + c];
            dst--;
        }
        let rowT = 0, colT = 0, pits = 0, wells = 0, topout = false;
        for (let i = 0; i < TOPOUT_ROWS * W; i++) if (compact[i]) { topout = true; break; }
        for (let r = 0; r < H; r++)
            for (let c = 1; c < W; c++)
                if ((compact[r * W + c] !== 0) !== (compact[r * W + c - 1] !== 0)) rowT++;
        const heights = new Int8Array(W);
        for (let c = 0; c < W; c++) {
            let seen = false;
            for (let r = 0; r < H; r++) {
                const v = compact[r * W + c] !== 0;
                if (r > 0 && v !== (compact[(r - 1) * W + c] !== 0)) colT++;
                if (v && !seen) { seen = true; heights[c] = H - r; }
                else if (!v && seen) pits++;
            }
        }
        for (let c = 0; c < W; c++) {
            const l = c === 0 ? H : heights[c - 1], rr = c === W - 1 ? H : heights[c + 1];
            const ld = l - heights[c], rd = rr - heights[c];
            if (ld >= 0 && rd >= 0) { const w = Math.min(ld, rd); wells += w * (w + 1) / 2; }
        }
        const f = {
            landing_height: H - 1 - lowest, eroded_cells: eroded,
            row_trans: rowT, col_trans: colT, pits, cuml_wells: wells, lines, topout
        };
        f.value = WEIGHTS.landing_height * f.landing_height + WEIGHTS.eroded_cells * eroded
            + WEIGHTS.row_trans * rowT + WEIGHTS.col_trans * colT + WEIGHTS.pits * pits
            + WEIGHTS.cuml_wells * wells;
        return f;
    }

    function score(board, type, pl) {
        if (pl.above) return TOPOUT_SCORE;
        const f = features(board, type, pl);
        return f.topout ? TOPOUT_SCORE : f.value;
    }

    // Board after a placement, with full rows removed (cells become 1).
    function apply(board, type, pl) {
        const b = board.slice();
        for (const [dr, dc] of SHAPES[type][pl.rot].cells) {
            const r = pl.y + dr;
            if (r >= 0) b[r * W + pl.x + dc] = 1;
        }
        const out = emptyBoard();
        let dst = H - 1, lines = 0;
        for (let r = H - 1; r >= 0; r--) {
            let f = true;
            for (let c = 0; c < W; c++) if (!b[r * W + c]) { f = false; break; }
            if (f) { lines++; continue; }
            for (let c = 0; c < W; c++) out[dst * W + c] = b[r * W + c];
            dst--;
        }
        return { board: out, lines };
    }

    // Best single placement of each type on this board (used for the first piece of a board).
    function onePlyValues(board) {
        const tops = columnTops(board);
        return TYPES.map(t => {
            let best = -Infinity;
            for (const pl of placements(board, t, tops)) best = Math.max(best, score(board, t, pl));
            return { type: t, value: best };
        });
    }

    // Value of each type as the NEXT piece when the current piece is placed first: the best
    // (current placement, candidate placement) pair, with landing-height and eroded-cell terms
    // summed over both moves and board terms taken from the final board.
    function twoPlyValues(board, current) {
        const tops = columnTops(board);
        const best = TYPES.map(t => ({ type: t, value: -Infinity, first: null, second: null }));
        for (const a of placements(board, current, tops)) {
            if (a.above) continue;
            const fa = features(board, current, a);
            if (fa.topout) continue;
            const moveA = WEIGHTS.landing_height * fa.landing_height + WEIGHTS.eroded_cells * fa.eroded_cells;
            const b1 = apply(board, current, a).board;
            const tops1 = columnTops(b1);
            for (let i = 0; i < TYPES.length; i++) {
                for (const b of placements(b1, TYPES[i], tops1)) {
                    const v = moveA + score(b1, TYPES[i], b);
                    if (v > best[i].value) { best[i].value = v; best[i].first = a; best[i].second = b; }
                }
            }
        }
        for (const c of best) if (c.value === -Infinity) c.value = TOPOUT_SCORE;
        return best;
    }

    // P(piece) proportional to exp(beta * u), u = value rescaled to 0..1 on this board.
    // Exact ties at beta = +/-Infinity are split evenly.
    function choose(cands, beta, draw) {
        const vals = cands.map(c => c.value);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const u = vals.map(v => hi > lo ? (v - lo) / (hi - lo) : 0.5);
        let probs;
        if (beta === Infinity || beta === -Infinity) {
            const target = beta > 0 ? Math.max(...u) : Math.min(...u);
            const hits = u.map(x => (x === target ? 1 : 0));
            const n = hits.reduce((a, b) => a + b, 0);
            probs = hits.map(h => h / n);
        } else {
            const m = Math.max(...u.map(x => beta * x));
            const e = u.map(x => Math.exp(beta * x - m));
            const z = e.reduce((a, b) => a + b, 0);
            probs = e.map(x => x / z);
        }
        let r = draw, index = probs.length - 1;
        for (let i = 0; i < probs.length; i++) { r -= probs[i]; if (r < 0) { index = i; break; } }
        const rank = 1 + vals.filter(v => v > vals[index]).length;
        return { index, type: cands[index].type, probs, u, rank, helpfulness: u[index] };
    }

    // JSON has no Infinity: log infinite beta as a string.
    const betaForLog = b => (Number.isFinite(b) ? b : String(b));

    // One dealer per condition. deal() takes the board the piece will be played on and the
    // piece that will be played before it (null for the first piece of a board).
    class Dealer {
        constructor({ beta, seed }) {
            this.beta = beta;
            this.seed = seed >>> 0;
            this.rng = mulberry32(this.seed);
            this.dealIndex = 0;
        }
        deal(board, currentType) {
            const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
            const cands = currentType ? twoPlyValues(board, currentType) : onePlyValues(board);
            const draw = this.rng();
            const pick = choose(cands, this.beta, draw);
            const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
            this.dealIndex++;
            return {
                type: pick.type,
                record: {
                    selector_revision: SELECTOR_REVISION,
                    deal_index: this.dealIndex,
                    beta: betaForLog(this.beta),
                    dealer_seed: this.seed,
                    lookahead: currentType ? "two_piece" : "one_piece",
                    played_before: currentType,
                    dealt: pick.type,
                    dealt_rank: pick.rank,
                    dealt_helpfulness: +pick.helpfulness.toFixed(4),
                    rng_draw: draw,
                    candidate_scores: Object.fromEntries(cands.map(c => [c.type, c.value])),
                    candidate_chances: Object.fromEntries(cands.map((c, i) => [c.type, +pick.probs[i].toFixed(6)])),
                    selector_ms: +ms.toFixed(2)
                }
            };
        }
    }

    // Dellacherie score of the participant's actual placement against the best hard-drop
    // placement on the same board. regret = best - actual (0 means the controller agrees).
    function placementQuality(board, type, pl) {
        const above = pl.y + SHAPES[type][pl.rot].minDr < 0;
        const actual = score(board, type, { rot: pl.rot, x: pl.x, y: pl.y, above });
        let best = -Infinity;
        for (const p of placements(board, type)) best = Math.max(best, score(board, type, p));
        return { placement_score: actual, best_placement_score: best, placement_regret: best - actual };
    }

    const api = {
        SELECTOR_REVISION, W, H, TYPES, ROTATIONS, SHAPES, WEIGHTS, TOPOUT_ROWS, TOPOUT_SCORE,
        mulberry32, emptyBoard, fromRows, columnTops, placements, features, score, apply,
        onePlyValues, twoPlyValues, choose, betaForLog, Dealer, placementQuality
    };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.PieceSelector = api;
})(typeof window !== "undefined" ? window : globalThis);
