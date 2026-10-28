// Load piece_selector.js and game.js into a sandbox with just enough browser stubs to run the
// game logic in node. Network calls are captured, never sent.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function stubElement() {
    const el = {
        classList: { add() {}, remove() {} }, style: {}, textContent: "",
        replaceChildren() {}, append() {}, reset() {}, addEventListener() {}, focus() {}
    };
    return el;
}

function stubCanvas(width, height) {
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    return { width, height, getContext: () => ctx };
}

function loadGame({ clock } = {}) {
    const root = path.join(__dirname, "..");
    const sent = [];
    const storage = () => {
        const m = new Map();
        return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
    };
    const ctx = {
        console, crypto: globalThis.crypto, Math, JSON, Date, Uint8Array, Uint32Array, Int8Array,
        performance: clock || globalThis.performance,
        setTimeout, clearTimeout, setInterval, clearInterval,
        requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
        sessionStorage: storage(), localStorage: storage(),
        navigator: { userAgent: "node-test", sendBeacon: body => { sent.push({ beacon: true, body }); return true; } },
        location: { href: "test://game.html", replace() { throw new Error("redirected to consent page"); } },
        fetch: async (url, opts) => { sent.push({ url, body: opts.body }); return { type: "opaque", ok: false }; },
        document: {
            addEventListener() {}, getElementById: () => stubElement(), querySelectorAll: () => [],
            createElement: () => stubElement(), hidden: false
        },
        Blob: class { constructor(parts) { this.parts = parts; } },
        URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} }
    };
    ctx.window = ctx;
    ctx.addEventListener = () => {};
    ctx.sessionStorage.setItem("participantId", "PPT-TEST2345");
    ctx.sessionStorage.setItem("consentGiven", "true");
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(root, "piece_selector.js"), "utf8"), ctx, { filename: "piece_selector.js" });
    const exports = "\n;globalThis.__test = { PIECES, EXPERIMENT, TetrisGame, ExperimentLogger };";
    vm.runInContext(fs.readFileSync(path.join(root, "game.js"), "utf8") + exports, ctx, { filename: "game.js" });
    return { ...ctx.__test, PieceSelector: ctx.PieceSelector, sent, stubCanvas };
}

module.exports = { loadGame, stubCanvas };
