// Meta-T Online Challenge–Frustration Experiment v0.1
// Research prototype: fixed-duration difficulty conditions + ratings + telemetry.
// IMPORTANT: Candidate speeds must be piloted before data collection.

const EXPERIMENT = {
  conditionDurationMs: 5 * 60 * 1000,
  practiceDurationMs: 2 * 60 * 1000,
  // Candidate values only. Pilot and replace before the study.
  conditions: [
    { id: 1, dropIntervalMs: 1000 },
    { id: 2, dropIntervalMs: 850 },
    { id: 3, dropIntervalMs: 700 },
    { id: 4, dropIntervalMs: 550 },
    { id: 5, dropIntervalMs: 400 },
    { id: 6, dropIntervalMs: 300 },
    { id: 7, dropIntervalMs: 225 },
    { id: 8, dropIntervalMs: 150 },
    { id: 9, dropIntervalMs: 100 }
  ]
};

const PIECES = {
  I: { rotations: [[[1,1,1,1]], [[1],[1],[1],[1]]], color: [49,198,239] },
  O: { rotations: [[[2,2],[2,2]]], color: [247,211,48] },
  T: { rotations: [[[3,3,3],[0,3,0]], [[0,3,0],[3,3,0],[0,3,0]], [[0,3,0],[3,3,3]], [[0,3,0],[0,3,3],[0,3,0]]], color: [173,77,156] },
  S: { rotations: [[[0,4,4],[4,4,0]], [[0,4,0],[0,4,4],[0,0,4]]], color: [41,253,46] },
  Z: { rotations: [[[5,5,0],[0,5,5]], [[0,0,5],[0,5,5],[0,5,0]]], color: [252,13,27] },
  J: { rotations: [[[6,6,6],[0,0,6]], [[0,6,0],[0,6,0],[6,6,0]], [[6,0,0],[6,6,6]], [[0,6,6],[0,6,0],[0,6,0]]], color: [11,36,251] },
  L: { rotations: [[[7,7,7],[7,0,0]], [[7,7,0],[0,7,0],[0,7,0]], [[0,0,7],[7,7,7]], [[0,7,0],[0,7,0],[0,7,7]]], color: [239,121,33] }
};

class ExperimentLogger {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.participantId = params.get("PROLIFIC_PID") || params.get("participant") || crypto.randomUUID();
    this.sessionId = crypto.randomUUID();
    this.events = [];
    this.conditionSummaries = [];
    this.ratings = [];
  }
  event(type, game, extra={}) {
    this.events.push({
      participant_id: this.participantId,
      session_id: this.sessionId,
      timestamp_iso: new Date().toISOString(),
      timestamp_ms: Date.now(),
      phase: game.phase,
      condition: game.conditionIndex >= 0 ? game.conditionIndex + 1 : null,
      attempt: game.attempt,
      drop_interval_ms: game.dropInterval,
      event: type,
      score: game.score,
      lines: game.lines,
      ...extra
    });
  }
  exportAll() {
    downloadJSON("meta_t_experiment_data.json", {
      metadata: {
        participant_id: this.participantId,
        session_id: this.sessionId,
        experiment_version: "0.1",
        exported_at: new Date().toISOString(),
        user_agent: navigator.userAgent
      },
      events: this.events,
      condition_summaries: this.conditionSummaries,
      ratings: this.ratings
    });
  }
}

class TetrisGame {
  constructor(canvas, nextCanvas, logger) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext("2d");
    this.logger = logger;
    this.boardWidth = 10;
    this.boardHeight = 20;
    this.blockSize = canvas.width / this.boardWidth;

    this.phase = "idle"; // idle, practice, play, rating, complete
    this.conditionIndex = -1;
    this.attempt = 1;
    this.conditionStartedAt = null;
    this.phaseRemainingMs = 0;
    this.lastTick = performance.now();
    this.animationId = null;
    this.keys = {};
    this.showGhost = true;
    this.resetBoard(true);
    this.setupInput();
  }

  resetBoard(resetConditionStats=false) {
    this.board = Array.from({length:this.boardHeight}, () => Array(this.boardWidth).fill(0));
    this.currentPiece = this.createPiece();
    this.nextPiece = this.createPiece();
    this.dropCounter = 0;
    if (resetConditionStats) {
      this.score = 0;
      this.lines = 0;
      this.piecesPlaced = 0;
      this.gameOvers = 0;
      this.keypresses = 0;
      this.attempt = 1;
    }
    this.updateStats();
  }

  createPiece() {
    const types = Object.keys(PIECES);
    const type = types[Math.floor(Math.random() * types.length)];
    const p = PIECES[type];
    return {
      type, rotation: 0,
      x: Math.floor(this.boardWidth / 2) - 1,
      y: 0,
      shape: p.rotations[0],
      colorData: p.color,
      spawnedAt: performance.now()
    };
  }

  setupInput() {
    window.addEventListener("keydown", e => {
      if (!["practice","play"].includes(this.phase)) return;
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.keypresses++;
      this.logger.event("keypress", this, { key: e.key, piece: this.currentPiece.type });
      if (e.key === "ArrowLeft") this.movePiece(-1);
      else if (e.key === "ArrowRight") this.movePiece(1);
      else if (e.key === "ArrowUp") this.rotatePiece();
      else if (e.key === "ArrowDown") this.softDrop("participant");
      else if (e.key === " ") this.hardDrop();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.logger.event("focus_lost", this);
      else this.logger.event("focus_regained", this);
    });
  }

  startPractice() {
    this.phase = "practice";
    this.conditionIndex = -1;
    this.dropInterval = 1000;
    this.phaseRemainingMs = EXPERIMENT.practiceDurationMs;
    this.resetBoard(true);
    this.logger.event("practice_start", this);
    this.startLoop();
  }

  startExperiment() {
    this.conditionIndex = 0;
    this.startCondition();
  }

  startCondition() {
    const c = EXPERIMENT.conditions[this.conditionIndex];
    this.phase = "play";
    this.dropInterval = c.dropIntervalMs;
    this.phaseRemainingMs = EXPERIMENT.conditionDurationMs;
    this.conditionStartedAt = Date.now();
    this.resetBoard(true);
    this.logger.event("condition_start", this, { condition_id: c.id });
    this.startLoop();
  }

  startLoop() {
    cancelAnimationFrame(this.animationId);
    this.lastTick = performance.now();
    const loop = now => {
      const dt = Math.min(now - this.lastTick, 250);
      this.lastTick = now;
      if (["practice","play"].includes(this.phase)) {
        this.phaseRemainingMs -= dt;
        this.update(dt);
        this.draw();
        this.updateTimer();
        if (this.phaseRemainingMs <= 0) {
          if (this.phase === "practice") this.endPractice();
          else this.endCondition();
          return;
        }
        this.animationId = requestAnimationFrame(loop);
      }
    };
    this.animationId = requestAnimationFrame(loop);
  }

  endPractice() {
    this.logger.event("practice_end", this);
    this.phase = "idle";
    showScreen("experimentIntro");
  }

  endCondition() {
    const c = EXPERIMENT.conditions[this.conditionIndex];
    this.logger.event("condition_end", this);
    this.logger.conditionSummaries.push({
      participant_id: this.logger.participantId,
      session_id: this.logger.sessionId,
      condition: c.id,
      drop_interval_ms: c.dropIntervalMs,
      score: this.score,
      lines_cleared: this.lines,
      pieces_placed: this.piecesPlaced,
      keypresses: this.keypresses,
      game_overs: this.gameOvers,
      attempts: this.attempt
    });
    this.phase = "rating";
    showRating(c.id);
    this.logger.event("rating_start", this);
  }

  submitRating(challenge, frustration) {
    const c = EXPERIMENT.conditions[this.conditionIndex];
    this.logger.ratings.push({
      participant_id: this.logger.participantId,
      session_id: this.logger.sessionId,
      condition: c.id,
      drop_interval_ms: c.dropIntervalMs,
      challenge_rating: Number(challenge),
      frustration_rating: Number(frustration),
      timestamp_iso: new Date().toISOString()
    });
    this.logger.event("rating_response", this, {
      challenge_rating: Number(challenge),
      frustration_rating: Number(frustration)
    });

    this.conditionIndex++;
    if (this.conditionIndex < EXPERIMENT.conditions.length) {
      showScreen("gameScreen");
      this.startCondition();
    } else {
      this.phase = "complete";
      showScreen("completeScreen");
    }
  }

  update(dt) {
    this.dropCounter += dt;
    if (this.dropCounter >= this.dropInterval) {
      this.softDrop("gravity");
      this.dropCounter = 0;
    }
  }

  movePiece(direction) {
    const before = this.currentPiece.x;
    this.currentPiece.x += direction;
    let success = true;
    if (this.collision()) {
      this.currentPiece.x = before;
      success = false;
    }
    this.logger.event(direction < 0 ? "move_left" : "move_right", this, {
      success, piece: this.currentPiece.type, x: this.currentPiece.x, y: this.currentPiece.y
    });
  }

  rotatePiece() {
    const p = PIECES[this.currentPiece.type];
    const old = this.currentPiece.rotation;
    const next = (old + 1) % p.rotations.length;
    this.currentPiece.rotation = next;
    this.currentPiece.shape = p.rotations[next];
    let success = true;
    if (this.collision()) {
      this.currentPiece.rotation = old;
      this.currentPiece.shape = p.rotations[old];
      success = false;
    }
    this.logger.event("rotate", this, { success, piece:this.currentPiece.type, rotation:this.currentPiece.rotation });
  }

  softDrop(source="participant") {
    this.currentPiece.y++;
    if (this.collision()) {
      this.currentPiece.y--;
      this.placePiece();
    } else if (source === "participant") {
      this.logger.event("soft_drop", this, { piece:this.currentPiece.type, y:this.currentPiece.y });
    }
  }

  hardDrop() {
    let cells = 0;
    while (!this.collision()) { this.currentPiece.y++; cells++; }
    this.currentPiece.y--; cells--;
    this.logger.event("hard_drop", this, { piece:this.currentPiece.type, cells:Math.max(0,cells) });
    this.placePiece();
  }

  collision() {
    const {shape,x,y} = this.currentPiece;
    for (let r=0; r<shape.length; r++) for (let c=0; c<shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const bx=x+c, by=y+r;
      if (bx<0 || bx>=this.boardWidth || by>=this.boardHeight) return true;
      if (by>=0 && this.board[by][bx]) return true;
    }
    return false;
  }

  placePiece() {
    const {shape,colorData} = this.currentPiece;
    for (let r=0; r<shape.length; r++) for (let c=0; c<shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const by=this.currentPiece.y+r, bx=this.currentPiece.x+c;
      if (by < 0) {
        this.handleGameOver();
        return;
      }
      this.board[by][bx]=colorData;
    }
    this.piecesPlaced++;
    this.logger.event("piece_placed", this, {
      piece:this.currentPiece.type,
      x:this.currentPiece.x, y:this.currentPiece.y,
      rotation:this.currentPiece.rotation,
      decision_time_ms: Math.round(performance.now()-this.currentPiece.spawnedAt)
    });
    this.clearLines();
    this.currentPiece=this.nextPiece;
    this.nextPiece=this.createPiece();
    this.logger.event("piece_spawn", this, { piece:this.currentPiece.type });
  }

  clearLines() {
    let n=0;
    for (let r=this.boardHeight-1; r>=0; r--) {
      if (this.board[r].every(cell=>cell!==0)) {
        this.board.splice(r,1);
        this.board.unshift(Array(this.boardWidth).fill(0));
        n++; r++;
      }
    }
    if (n) {
      this.lines += n;
      // Score deliberately does NOT change difficulty.
      this.score += n * 100;
      this.logger.event("line_clear", this, { lines_cleared:n });
      this.updateStats();
    }
  }

  handleGameOver() {
    this.gameOvers++;
    this.logger.event("game_over", this);
    this.attempt++;
    this.resetBoard(false);
    this.logger.event("restart", this);
  }

  wouldCollide(piece) {
    const saved=this.currentPiece;
    this.currentPiece=piece;
    const result=this.collision();
    this.currentPiece=saved;
    return result;
  }

  getGhostPiece() {
    const g=JSON.parse(JSON.stringify(this.currentPiece));
    while (!this.wouldCollide(g)) g.y++;
    g.y--;
    return g;
  }

  draw() {
    this.ctx.fillStyle="#111827";
    this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    for (let r=0;r<this.boardHeight;r++) for (let c=0;c<this.boardWidth;c++) {
      if (this.board[r][c]) this.drawBlock(this.ctx,c,r,this.board[r][c],this.blockSize);
    }
    this.ctx.strokeStyle="rgba(255,255,255,.08)";
    this.ctx.lineWidth=.5;
    for(let i=0;i<=this.boardWidth;i++){this.ctx.beginPath();this.ctx.moveTo(i*this.blockSize,0);this.ctx.lineTo(i*this.blockSize,this.canvas.height);this.ctx.stroke();}
    for(let i=0;i<=this.boardHeight;i++){this.ctx.beginPath();this.ctx.moveTo(0,i*this.blockSize);this.ctx.lineTo(this.canvas.width,i*this.blockSize);this.ctx.stroke();}
    if (this.showGhost) {
      const g=this.getGhostPiece();
      this.ctx.globalAlpha=.2; this.drawPiece(g); this.ctx.globalAlpha=1;
    }
    this.drawPiece(this.currentPiece);
    this.drawNext();
  }

  drawPiece(piece) {
    piece.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)this.drawBlock(this.ctx,piece.x+c,piece.y+r,piece.colorData,this.blockSize);}));
  }
  drawBlock(ctx,col,row,color,size) {
    ctx.fillStyle=`rgb(${color.join(",")})`;
    ctx.fillRect(col*size+1,row*size+1,size-2,size-2);
  }
  drawNext() {
    this.nextCtx.fillStyle="#0b1020";
    this.nextCtx.fillRect(0,0,this.nextCanvas.width,this.nextCanvas.height);
    const s=20, p=this.nextPiece;
    const ox=(this.nextCanvas.width-p.shape[0].length*s)/2, oy=(this.nextCanvas.height-p.shape.length*s)/2;
    p.shape.forEach((row,r)=>row.forEach((v,c)=>{
      if(v){this.nextCtx.fillStyle=`rgb(${p.colorData.join(",")})`;this.nextCtx.fillRect(ox+c*s+1,oy+r*s+1,s-2,s-2);}
    }));
  }
  updateStats() {
    setText("score",this.score);
    setText("lines",this.lines);
    setText("attempt",this.attempt);
    setText("condition", this.phase==="practice" ? "Practice" : (this.conditionIndex>=0 ? `${this.conditionIndex+1} / ${EXPERIMENT.conditions.length}` : "—"));
    setText("speed", this.dropInterval ? `${this.dropInterval} ms` : "—");
  }
  updateTimer() {
    const sec=Math.max(0,Math.ceil(this.phaseRemainingMs/1000));
    setText("timer",`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`);
    this.updateStats();
  }
}

function setText(id,value){ const el=document.getElementById(id); if(el) el.textContent=value; }
function showScreen(id){
  document.querySelectorAll(".screen").forEach(x=>x.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}
function showRating(condition){
  setText("ratingCondition",condition);
  document.getElementById("ratingForm").reset();
  showScreen("ratingScreen");
}
function downloadJSON(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

let game, logger;
document.addEventListener("DOMContentLoaded",()=>{
  logger=new ExperimentLogger();
  game=new TetrisGame(document.getElementById("gameCanvas"),document.getElementById("nextPieceCanvas"),logger);
  setText("participantId",logger.participantId);

  document.getElementById("practiceBtn").onclick=()=>{showScreen("gameScreen");game.startPractice();};
  document.getElementById("startExperimentBtn").onclick=()=>{showScreen("gameScreen");game.startExperiment();};
  document.getElementById("ratingForm").onsubmit=e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    game.submitRating(fd.get("challenge"),fd.get("frustration"));
  };
  document.getElementById("downloadBtn").onclick=()=>logger.exportAll();
  showScreen("welcomeScreen");
});
