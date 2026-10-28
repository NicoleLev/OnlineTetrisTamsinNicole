// Play game.js headlessly through its own move functions and check the piece-selection logging.
const assert = require("assert");
const { loadGame } = require("./load_game.js");

const clock = { t: 1000, now() { return this.t; } };
const G = loadGame({ clock });
const S = G.PieceSelector;
const logger = new G.ExperimentLogger();
logger.sessionSeed = 20261027;
const game = new G.TetrisGame(G.stubCanvas(300, 600), G.stubCanvas(120, 120), logger);
const botRng = S.mulberry32(5);

// A noisy Dellacherie player that moves the piece with rotatePiece/movePiece/softDrop.
function playPiece(tau = 2) {
    const flat = S.fromRows(game.board), type = game.currentPiece.type;
    let opts = S.placements(flat, type).filter(p => S.score(flat, type, p) > S.TOPOUT_SCORE);
    if (!opts.length) opts = S.placements(flat, type).filter(p => !p.above);
    const vals = opts.map(p => S.score(flat, type, p)), m = Math.max(...vals);
    const w = vals.map(v => Math.exp((v - m) / tau)), z = w.reduce((a, b) => a + b, 0);
    let r = botRng() * z, target = opts[opts.length - 1];
    for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r < 0) { target = opts[i]; break; } }
    for (let i = 0; i < target.rot; i++) game.rotatePiece();
    const dir = Math.sign(target.x - game.currentPiece.x);
    while (dir && game.currentPiece.x !== target.x) {
        const before = game.currentPiece.x;
        game.movePiece(dir);
        if (game.currentPiece.x === before) break;
    }
    clock.t += 1000;
    const id = game.currentPiece.piece_id;
    while (game.currentPiece.piece_id === id) game.softDrop("participant");
}

game.startPractice();
for (let k = 0; k < 15; k++) playPiece();
game.endPractice();
const PIECES_PER_CONDITION = 80;
for (let i = 0; i < G.EXPERIMENT.conditions.length; i++) {
    game.conditionIndex = i;
    game.startCondition();
    for (let k = 0; k < PIECES_PER_CONDITION; k++) playPiece();
    game.endCondition();
}

const ev = logger.events;
const play = ev.filter(e => e.phase === "play");
const dealt = ev.filter(e => e.event === "piece_dealt");

// Speed is the same everywhere in the experiment.
assert.ok(play.length > 0);
assert.deepStrictEqual([...new Set(play.map(e => e.drop_interval_ms))], [467]);
assert.deepStrictEqual([...new Set(ev.filter(e => e.phase === "practice").map(e => e.drop_interval_ms))], [467]);

// Every piece that enters the board was dealt by the selector, with the logged type.
const byId = new Map(dealt.map(e => [e.dealt_piece_id, e]));
for (const e of ev.filter(e => e.event === "piece_spawn" || e.event === "piece_placed")) {
    const d = byId.get(e.piece_id);
    assert.ok(d, `piece ${e.piece_id} (${e.event}) was not dealt by the selector`);
    assert.strictEqual(d.dealt, e.piece);
}

// Replay: rebuild every deal from the logged board, seed and beta alone.
const parseBeta = b => (typeof b === "string" ? Number(b) : b);
const streams = new Map();
for (const e of dealt) {
    const key = `${e.phase}|${e.condition}|${e.dealer_seed}`;
    if (!streams.has(key)) streams.set(key, []);
    streams.get(key).push(e);
}
let replayed = 0;
for (const events of streams.values()) {
    events.sort((a, b) => a.deal_index - b.deal_index);
    const dealer = new S.Dealer({ beta: parseBeta(events[0].beta), seed: events[0].dealer_seed });
    events.forEach((e, i) => {
        assert.strictEqual(e.deal_index, i + 1, "deal_index has a gap");
        const board = S.fromRows(e.board_before.map(row => [...row].map(Number)));
        const again = dealer.deal(board, e.played_before);
        assert.strictEqual(again.type, e.dealt, `replay differs at deal ${e.deal_index}`);
        assert.strictEqual(again.record.rng_draw, e.rng_draw);
        replayed++;
    });
}

// The dial orders how helpful the dealt pieces are (+4 > +2 > 0 > -2 > -4).
const meanHelp = G.EXPERIMENT.conditions.map(c => {
    const xs = dealt.filter(e => e.condition === c.id && e.phase === "play" && e.lookahead === "two_piece").map(e => e.dealt_helpfulness);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
});
for (let i = 1; i < meanHelp.length; i++) assert.ok(meanHelp[i] < meanHelp[i - 1], `helpfulness not ordered: ${meanHelp}`);

// decision_time_ms runs from when the piece enters the board (each piece is held 1000 ms).
const placed = ev.filter(e => e.event === "piece_placed");
assert.deepStrictEqual([...new Set(placed.map(e => e.decision_time_ms))], [1000]);

// Placement quality is logged for every placement; hard-drop spots never beat the best one.
for (const e of placed) {
    assert.strictEqual(typeof e.placement_regret, "number");
    assert.ok(e.placement_regret >= 0);
}
const agree = placed.filter(e => e.placement_regret === 0).length;
assert.ok(agree > 0 && agree < placed.length);

// Condition summaries and ratings carry beta; summaries carry the per-condition manipulation check.
assert.deepStrictEqual(Array.from(logger.conditionSummaries, s => s.beta), [4, 2, 0, -2, -4]);
for (const s of logger.conditionSummaries) {
    assert.ok(s.pieces_dealt >= PIECES_PER_CONDITION);
    assert.strictEqual(typeof s.mean_dealt_helpfulness, "number");
    assert.strictEqual(typeof s.mean_placement_regret, "number");
}

// Uploads are captured, carry the selection metadata, and never encode beta as null.
const last = JSON.parse(G.sent[G.sent.length - 1].body);
assert.deepStrictEqual(last.condition_betas, [4, 2, 0, -2, -4]);
assert.strictEqual(typeof last.session_seed, "number");
assert.strictEqual(last.selector_revision, S.SELECTOR_REVISION);
assert.strictEqual(last.difficulty_manipulation, "piece_selection");
assert.ok(!G.sent.some(s => s.body.includes('"beta":null')));

// Extremes: always the most / least helpful piece, and infinite beta survives JSON.
G.EXPERIMENT.conditions.splice(0, G.EXPERIMENT.conditions.length,
    { id: 1, beta: Infinity, eegLevel: 4, framesPerDrop: 28, dropIntervalMs: 467 },
    { id: 2, beta: -Infinity, eegLevel: 4, framesPerDrop: 28, dropIntervalMs: 467 });
const before = logger.events.length;
for (let i = 0; i < 2; i++) {
    game.conditionIndex = i;
    game.startCondition();
    for (let k = 0; k < 40; k++) playPiece();
}
const extreme = logger.events.slice(before).filter(e => e.event === "piece_dealt" && e.lookahead === "two_piece");
for (const e of extreme) {
    const scores = Object.values(e.candidate_scores);
    if (Math.max(...scores) === Math.min(...scores)) continue;
    assert.strictEqual(e.dealt_helpfulness, e.condition === 1 ? 1 : 0, JSON.stringify(e));
}
assert.deepStrictEqual([...new Set(extreme.map(e => JSON.parse(JSON.stringify(e)).beta))], ["Infinity", "-Infinity"]);

console.log(`game_integration.test.js: all passed (${placed.length} placements, ${replayed} deals replayed, ` +
    `mean helpfulness by condition ${meanHelp.map(x => x.toFixed(2)).join(" > ")}, controller agreed on ${agree} of ${placed.length})`);
