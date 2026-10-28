// Simulated players under each beta, with game.js v0.8 rules: blocks left in the top two rows
// end the board, hard drop is disabled, and the falling speed is fixed.
// Usage: node tools/calibrate.js [games per cell, default 30]
// Writes tools/calibration_summary.json and prints a table. Uses up to 8 worker threads.
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const path = require("path");
const S = require("../piece_selector.js");

const BETAS = [-Infinity, -4, -2, 0, 2, 4, Infinity];
const PLAYERS = { skilled: 1, novice: 3 };   // softmax temperature over Dellacherie scores
const MAX_PIECES = 500;
const DROP_INTERVAL_MS = 467;

function play(beta, tau, seed) {
    const dealer = new S.Dealer({ beta, seed }), bot = S.mulberry32(seed + 1e6);
    let board = S.emptyBoard(), cur = dealer.deal(board, null).type, pick = dealer.deal(board, cur);
    const g = { pieces: 0, lines: 0, toppedOut: false, help: [], moves: [], fall: [], types: {} };
    while (g.pieces < MAX_PIECES) {
        const opts = S.placements(board, cur).filter(p => S.score(board, cur, p) > S.TOPOUT_SCORE);
        if (!opts.length) { g.toppedOut = true; break; }
        const vals = opts.map(p => S.score(board, cur, p)), m = Math.max(...vals);
        const w = vals.map(v => Math.exp((v - m) / tau)), z = w.reduce((a, b) => a + b, 0);
        let r = bot() * z, pl = opts[opts.length - 1];
        for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r < 0) { pl = opts[i]; break; } }
        g.moves.push(pl.rot + Math.abs(pl.x - (Math.floor(S.W / 2) - 1)));
        g.fall.push(pl.y);
        const res = S.apply(board, cur, pl);
        board = res.board; g.lines += res.lines; g.pieces++;
        g.help.push(pick.record.dealt_helpfulness);
        g.types[pick.type] = (g.types[pick.type] || 0) + 1;
        cur = pick.type;
        pick = dealer.deal(board, cur);
    }
    return g;
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length / 2; return s.length % 2 ? s[h - 0.5] : (s[h - 1] + s[h]) / 2; };

if (isMainThread) {
    const games = Number(process.argv[2] || 30);
    const jobs = [];
    for (const [player, tau] of Object.entries(PLAYERS)) for (const beta of BETAS) jobs.push({ player, tau, beta: String(beta), games });
    const out = { rules: { max_pieces: MAX_PIECES, drop_interval_ms: DROP_INTERVAL_MS, topout_rows: S.TOPOUT_ROWS, selector_revision: S.SELECTOR_REVISION, games_per_cell: games, players: PLAYERS }, results: [] };
    let next = 0, running = 0;
    const launch = () => {
        while (running < 8 && next < jobs.length) {
            const job = jobs[next++]; running++;
            new Worker(__filename, { workerData: job })
                .on("message", m => out.results.push({ player: job.player, beta: job.beta, ...m }))
                .on("error", e => { console.error(e); process.exit(1); })
                .on("exit", () => { running--; if (out.results.length === jobs.length) finish(); else launch(); });
        }
    };
    const finish = () => {
        out.results.sort((a, b) => a.player.localeCompare(b.player) || Number(a.beta) - Number(b.beta));
        require("fs").writeFileSync(path.join(__dirname, "calibration_summary.json"), JSON.stringify(out, null, 1));
        console.log(`player   beta       topped out  median pieces  lines/100  helpfulness  moves/piece  rows fallen  time to land (s)  S+Z+O share`);
        for (const r of out.results)
            console.log(`${r.player.padEnd(8)} ${r.beta.padEnd(10)} ${(r.topped_out + "/" + r.games).padEnd(11)} ${String(r.median_pieces).padEnd(14)} ${r.lines_per_100.toFixed(1).padEnd(10)} ${r.mean_helpfulness.toFixed(2).padEnd(12)} ${r.moves_per_piece.toFixed(2).padEnd(12)} ${r.rows_fallen.toFixed(1).padEnd(12)} ${(r.rows_fallen * DROP_INTERVAL_MS / 1000).toFixed(1).padEnd(17)} ${(100 * r.szo_share).toFixed(0)}%`);
    };
    launch();
} else {
    const { tau, beta, games } = workerData;
    const gs = [];
    for (let s = 1; s <= games; s++) gs.push(play(Number(beta), tau, s));
    const types = {};
    for (const g of gs) for (const [t, n] of Object.entries(g.types)) types[t] = (types[t] || 0) + n;
    const dealt = Object.values(types).reduce((a, b) => a + b, 0);
    parentPort.postMessage({
        games, topped_out: gs.filter(g => g.toppedOut).length,
        median_pieces: median(gs.map(g => g.pieces)),
        lines_per_100: mean(gs.map(g => 100 * g.lines / Math.max(1, g.pieces))),
        mean_helpfulness: mean(gs.flatMap(g => g.help)),
        moves_per_piece: mean(gs.flatMap(g => g.moves)),
        rows_fallen: mean(gs.flatMap(g => g.fall)),
        szo_share: ((types.S || 0) + (types.Z || 0) + (types.O || 0)) / dealt,
        type_counts: types
    });
}
