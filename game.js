// Meta-T Tetris Game Engine (JavaScript)

// Piece Definitions
const PIECES = {
    standard: {
        'I': { rotations: [[[1,1,1,1]], [[1],[1],[1],[1]]], color: [49, 198, 239] },
        'O': { rotations: [[[2,2], [2,2]]], color: [247, 211, 48] },
        'T': { rotations: [[[3,3,3], [0,3,0]], [[0,3,0], [3,3,0], [0,3,0]], [[0,3,0], [3,3,3]], [[0,3,0], [0,3,3], [0,3,0]]], color: [173, 77, 156] },
        'S': { rotations: [[[0,4,4], [4,4,0]], [[0,4,0], [0,4,4], [0,0,4]]], color: [41, 253, 46] },
        'Z': { rotations: [[[5,5,0], [0,5,5]], [[0,0,5], [0,5,5], [0,5,0]]], color: [252, 13, 27] },
        'J': { rotations: [[[6,6,6], [0,0,6]], [[0,6,0], [0,6,0], [6,6,0]], [[6,0,0], [6,6,6]], [[0,6,6], [0,6,0], [0,6,0]]], color: [11, 36, 251] },
        'L': { rotations: [[[7,7,7], [7,0,0]], [[7,7,0], [0,7,0], [0,7,0]], [[0,0,7], [7,7,7]], [[0,7,0], [0,7,0], [0,7,7]]], color: [239, 121, 33] }
    }
};

class TetrisGame {
    constructor(canvas, nextPieceCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nextCanvas = nextPieceCanvas;
        this.nextCtx = nextPieceCanvas.getContext('2d');
        
        // Game dimensions
        this.boardWidth = 10;
        this.boardHeight = 20;
        this.blockSize = this.canvas.width / this.boardWidth;
        
        // Initialize game state
        this.reset();
        
        // Input handling
        this.keys = {};
        this.setupInput();
        
        // Game loop
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = Date.now();
        
        // Settings
        this.showGhost = true;
        this.gravityMode = 'normal';
    }
    
    reset() {
        this.board = Array(this.boardHeight).fill(null).map(() => Array(this.boardWidth).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        
        this.currentPiece = this.createPiece();
        this.nextPiece = this.createPiece();
        this.dropCounter = 0;
    }
    
    createPiece() {
        const types = Object.keys(PIECES.standard);
        const type = types[Math.floor(Math.random() * types.length)];
        const piece = PIECES.standard[type];
        
        return {
            type: type,
            rotation: 0,
            x: Math.floor(this.boardWidth / 2) - 1,
            y: 0,
            shape: piece.rotations[0],
            color: piece.rotations,
            colorData: piece.color
        };
    }
    
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            if (e.key === ' ') {
                e.preventDefault();
                this.hardDrop();
            }
            if (e.key === 'p' || e.key === 'P') {
                this.togglePause();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }
    
    togglePause() {
        this.paused = !this.paused;
        this.updatePauseUI();
    }
    
    updatePauseUI() {
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (this.paused) {
            pauseOverlay.classList.remove('hidden');
        } else {
            pauseOverlay.classList.add('hidden');
        }
    }
    
    update(deltaTime) {
        if (this.paused || this.gameOver) return;
        
        this.handleInput();
        
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.softDrop();
            this.dropCounter = 0;
        }
    }
    
    handleInput() {
        if (this.keys['ArrowLeft']) {
            this.movePiece(-1);
            this.keys['ArrowLeft'] = false;
        }
        if (this.keys['ArrowRight']) {
            this.movePiece(1);
            this.keys['ArrowRight'] = false;
        }
        if (this.keys['ArrowUp']) {
            this.rotatePiece();
            this.keys['ArrowUp'] = false;
        }
        if (this.keys['ArrowDown']) {
            this.softDrop();
            this.keys['ArrowDown'] = false;
        }
    }
    
    movePiece(direction) {
        this.currentPiece.x += direction;
        if (this.collision()) {
            this.currentPiece.x -= direction;
        }
    }
    
    rotatePiece() {
        const piece = PIECES.standard[this.currentPiece.type];
        const nextRotation = (this.currentPiece.rotation + 1) % piece.rotations.length;
        const oldRotation = this.currentPiece.rotation;
        
        this.currentPiece.rotation = nextRotation;
        this.currentPiece.shape = piece.rotations[nextRotation];
        
        if (this.collision()) {
            this.currentPiece.rotation = oldRotation;
            this.currentPiece.shape = piece.rotations[oldRotation];
        }
    }
    
    softDrop() {
        this.currentPiece.y++;
        if (this.collision()) {
            this.currentPiece.y--;
            this.placePiece();
        }
    }
    
    hardDrop() {
        while (!this.collision()) {
            this.currentPiece.y++;
        }
        this.currentPiece.y--;
        this.placePiece();
    }
    
    collision() {
        const shape = this.currentPiece.shape;
        const x = this.currentPiece.x;
        const y = this.currentPiece.y;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = x + col;
                    const boardY = y + row;
                    
                    if (boardX < 0 || boardX >= this.boardWidth || 
                        boardY >= this.boardHeight) {
                        return true;
                    }
                    
                    if (boardY >= 0 && this.board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    placePiece() {
        const shape = this.currentPiece.shape;
        const color = this.currentPiece.colorData;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardY = this.currentPiece.y + row;
                    const boardX = this.currentPiece.x + col;
                    
                    if (boardY < 0) {
                        this.gameOver = true;
                        this.showGameOverModal();
                        return;
                    }
                    
                    this.board[boardY][boardX] = color;
                }
            }
        }
        
        this.clearLines();
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let row = this.boardHeight - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== 0)) {
                this.board.splice(row, 1);
                this.board.unshift(Array(this.boardWidth).fill(0));
                linesCleared++;
                row++;
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += linesCleared * 100 * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 50);
            this.updateStats();
        }
    }
    
    getGhostPiece() {
        const ghost = JSON.parse(JSON.stringify(this.currentPiece));
        while (!this.wouldCollide(ghost)) {
            ghost.y++;
        }
        ghost.y--;
        return ghost;
    }
    
    wouldCollide(piece) {
        const shape = piece.shape;
        const x = piece.x;
        const y = piece.y;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = x + col;
                    const boardY = y + row;
                    
                    if (boardX < 0 || boardX >= this.boardWidth || 
                        boardY >= this.boardHeight) {
                        return true;
                    }
                    
                    if (boardY >= 0 && this.board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw board
        this.drawBoard();
        
        // Draw ghost piece
        if (this.showGhost && !this.gameOver) {
            this.drawGhostPiece();
        }
        
        // Draw current piece
        this.drawPiece(this.currentPiece);
        
        // Draw next piece preview
        this.drawNextPiecePreview();
    }
    
    drawBoard() {
        for (let row = 0; row < this.boardHeight; row++) {
            for (let col = 0; col < this.boardWidth; col++) {
                if (this.board[row][col]) {
                    this.drawBlock(col, row, this.board[row][col]);
                }
            }
        }
        
        // Draw grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.boardWidth; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.blockSize, 0);
            this.ctx.lineTo(i * this.blockSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= this.boardHeight; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.blockSize);
            this.ctx.lineTo(this.canvas.width, i * this.blockSize);
            this.ctx.stroke();
        }
    }
    
    drawPiece(piece) {
        const shape = piece.shape;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    this.drawBlock(piece.x + col, piece.y + row, piece.colorData);
                }
            }
        }
    }
    
    drawGhostPiece() {
        const ghost = this.getGhostPiece();
        const shape = ghost.shape;
        const rgb = ghost.colorData;
        
        this.ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`;
        this.ctx.strokeStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        this.ctx.lineWidth = 2;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = (ghost.x + col) * this.blockSize;
                    const y = (ghost.y + row) * this.blockSize;
                    this.ctx.fillRect(x + 1, y + 1, this.blockSize - 2, this.blockSize - 2);
                    this.ctx.strokeRect(x + 1, y + 1, this.blockSize - 2, this.blockSize - 2);
                }
            }
        }
    }
    
    drawBlock(col, row, color) {
        const rgb = Array.isArray(color) ? color : [200, 200, 200];
        const x = col * this.blockSize;
        const y = row * this.blockSize;
        
        this.ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        this.ctx.fillRect(x + 1, y + 1, this.blockSize - 2, this.blockSize - 2);
        
        // Add shading
        this.ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x + 1, y + 1, this.blockSize - 2, this.blockSize - 2);
    }
    
    drawNextPiecePreview() {
        this.nextCtx.fillStyle = '#0a0a0e';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        const piece = this.nextPiece;
        const shape = piece.shape;
        const blockSize = 20;
        
        const offsetX = (this.nextCanvas.width - (shape[0].length * blockSize)) / 2;
        const offsetY = (this.nextCanvas.height - (shape.length * blockSize)) / 2;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = offsetX + col * blockSize;
                    const y = offsetY + row * blockSize;
                    
                    const rgb = piece.colorData;
                    this.nextCtx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                    this.nextCtx.fillRect(x + 1, y + 1, blockSize - 2, blockSize - 2);
                    
                    this.nextCtx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
                    this.nextCtx.lineWidth = 1;
                    this.nextCtx.strokeRect(x + 1, y + 1, blockSize - 2, blockSize - 2);
                }
            }
        }
    }
    
    updateStats() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }
    
    showGameOverModal() {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLines').textContent = this.lines;
        document.getElementById('finalLevel').textContent = this.level;
        document.getElementById('gameOverModal').classList.remove('hidden');
    }
}

// Initialize Game
let game = null;

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const nextCanvas = document.getElementById('nextPieceCanvas');
    
    game = new TetrisGame(canvas, nextCanvas);
    
    // UI Event Listeners
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('restartBtn').addEventListener('click', () => {
        document.getElementById('gameOverModal').classList.add('hidden');
        resetGame();
        startGame();
    });
    
    document.getElementById('ghostPiece').addEventListener('change', (e) => {
        game.showGhost = e.target.checked;
    });
    
    document.getElementById('gravitySelect').addEventListener('change', (e) => {
        game.gravityMode = e.target.value;
    });
    
    game.updateStats();
    game.draw();
});

function startGame() {
    game.gameOver = false;
    game.paused = false;
    document.getElementById('pauseOverlay').classList.add('hidden');
    gameLoop();
}

function resetGame() {
    game.reset();
    game.updateStats();
    game.draw();
}

let lastFrameTime = Date.now();

function gameLoop() {
    const now = Date.now();
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;
    
    game.update(deltaTime);
    game.draw();
    
    if (!game.gameOver) {
        requestAnimationFrame(gameLoop);
    }
}
