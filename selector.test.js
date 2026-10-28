// Unit tests for the piece selector's choice rule, seeding and top-out rule.
const assert = require("assert");
const S = require("../piece_selector.js");

const rng = S.mulberry32(42);
const cands = vals => vals.map((v, i) => ({ type: S.TYPES[i], value: v }));

// beta = +Infinity deals the arg-max and -Infinity the arg-min.
for (let k = 0; k < 2000; k++) {
    const v = S.TYPES.map(() => Math.round(-100 * rng()));
    assert.strictEqual(v[S.choose(cands(v), Infinity, rng()).index], Math.max(...v));
    assert.strictEqual(v[S.choose(cands(v), -Infinity, rng()).index], Math.min(...v));
}

// Exact ties at the extreme split evenly.
const tie = cands([-5, -1, -1, -9, -3, -9, -2]), counts = Array(7).fill(0);
for (let k = 0; k < 20000; k++) counts[S.choose(tie, Infinity, rng()).index]++;
assert.deepStrictEqual(counts.map((c, i) => (c > 0 ? i : -1)).filter(i => i >= 0), [1, 2]);
assert.ok(Math.abs(counts[1] - counts[2]) < 600, `tie split ${counts}`);

// beta = 0 is uniform: chi-square over 70,000 draws, 6 df, 1% critical value 16.81.
const n = Array(7).fill(0), N = 70000;
for (let k = 0; k < N; k++) n[S.choose(cands(S.TYPES.map(() => -100 * rng())), 0, rng()).index]++;
const chi = n.reduce((s, x) => s + (x - N / 7) ** 2 / (N / 7), 0);
assert.ok(chi < 16.81, `beta=0 not uniform: chi2 ${chi.toFixed(2)} counts ${n}`);

// beta = 4: the best piece is e^4 times as likely as the worst.
const p = S.choose(cands([0, -10, -5, -5, -5, -5, -5]), 4, 0.5).probs;
assert.ok(Math.abs(p[0] / p[1] - Math.exp(4)) < 1e-9);

// All seven tied: every piece equally likely whatever beta is.
for (const beta of [-Infinity, -4, 0, 4, Infinity]) {
    const q = S.choose(cands(Array(7).fill(-20)), beta, 0.5).probs;
    q.forEach(x => assert.ok(Math.abs(x - 1 / 7) < 1e-12));
}

// Same seed, same board, same deals; the logged draw reproduces the choice.
const board = S.emptyBoard();
for (let c = 0; c < 9; c++) for (let r = 15; r < 20; r++) board[r * 10 + c] = 1;
const a = new S.Dealer({ beta: 2, seed: 99 }), b = new S.Dealer({ beta: 2, seed: 99 });
for (let k = 0; k < 20; k++) {
    const da = a.deal(board, "T"), db = b.deal(board, "T");
    assert.strictEqual(da.type, db.type);
    assert.strictEqual(da.record.rng_draw, db.record.rng_draw);
    const values = S.TYPES.map(t => ({ type: t, value: da.record.candidate_scores[t] }));
    assert.strictEqual(S.choose(values, 2, da.record.rng_draw).type, da.type);
}

// A well one column wide and five deep: the I piece is the most helpful, S/Z among the least.
const best = a.deal(board, "O").record;
assert.strictEqual(best.played_before, "O");
const ranked = Object.entries(S.twoPlyValues(board, "O").reduce((o, c) => ({ ...o, [c.type]: c.value }), {})).sort((x, y) => y[1] - x[1]);
assert.strictEqual(ranked[0][0], "I", `expected I best, got ${ranked.map(r => r[0])}`);

// Infinite beta is logged as a string, because JSON turns Infinity into null.
const inf = new S.Dealer({ beta: -Infinity, seed: 1 }).deal(board, "T").record;
assert.strictEqual(JSON.parse(JSON.stringify(inf)).beta, "-Infinity");

// Top-out rule matches game.js: a placement leaving blocks in rows 0-1 after clearing loses.
const tall = S.emptyBoard();
for (let r = 3; r < 20; r++) tall[r * 10 + 0] = 1;            // column 0 filled up to row 3
const pl = { rot: 1, x: 0, y: -1, above: true };              // vertical I on top pokes above the board
assert.strictEqual(S.score(tall, "I", pl), S.TOPOUT_SCORE);
const flatO = { rot: 0, x: 0, y: 1, above: false };           // O resting on column 0 occupies rows 1-2
assert.strictEqual(S.features(tall, "O", flatO).topout, true);
assert.strictEqual(S.score(tall, "O", flatO), S.TOPOUT_SCORE);
const lowO = { rot: 0, x: 4, y: 18, above: false };
assert.strictEqual(S.features(tall, "O", lowO).topout, false);

// Placement quality: the controller's own best move has zero regret.
const q0 = S.placementQuality(board, "I", { rot: 1, x: 9, y: 16 });
assert.strictEqual(q0.placement_regret, 0, JSON.stringify(q0));
const q1 = S.placementQuality(board, "I", { rot: 0, x: 0, y: 14 });
assert.ok(q1.placement_regret > 0);

console.log("selector.test.js: all passed (beta=0 chi2 " + chi.toFixed(2) + ")");
