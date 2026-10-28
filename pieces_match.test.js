// The selector must use exactly the rotations game.js plays, or its scores describe a different game.
const assert = require("assert");
const { loadGame } = require("./load_game.js");

const G = loadGame();
const S = G.PieceSelector;
assert.deepStrictEqual(Object.keys(G.PIECES).sort(), [...S.TYPES].sort());
for (const t of S.TYPES) {
    const game = G.PIECES[t].rotations.map(rot => rot.map(row => row.map(v => (v ? 1 : 0))));
    assert.deepStrictEqual(game, S.ROTATIONS[t], `rotations for ${t} differ between game.js and piece_selector.js`);
}
console.log("pieces_match.test.js: all passed");
