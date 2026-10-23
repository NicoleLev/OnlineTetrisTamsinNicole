// Meta-T Online Challenge–Frustration Experiment v0.3.1 Duration Pilot
// Research prototype: fixed-duration difficulty conditions + ratings + telemetry.
// IMPORTANT: Candidate speeds must be piloted before data collection.


const DATA_BACKEND_URL = "https://script.google.com/macros/s/AKfycbx8J8GSpEidx-WarHNmS7_Ko4eBpFFLJMgcDq758dzrWQX83I6eor9jK8YBNWW3GhnptA/exec";
const DATA_UPLOAD_VERSION = "0.2";
const HMM_LOGGING_REVISION = "hmm-raw-telemetry-03-hold-horizontal";
const HORIZONTAL_DAS_MS = 267;
const HORIZONTAL_ARR_MS = 100;

function makeParticipantId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "PPT-" + Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}
function getParticipantId() {
  const id = sessionStorage.getItem("participantId") ||
             sessionStorage.getItem("meta_t_ppt_id_v02");
  if (!id || !/^PPT-[A-Z0-9]{8}$/.test(id)) {
    window.location.replace("index.html");
    throw new Error("No valid consent-linked participant ID.");
  }
  sessionStorage.setItem("participantId", id);
  sessionStorage.setItem("meta_t_ppt_id_v02", id);
  return id;
}
function makeSessionId() {
  const stamp=new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14);
  const rnd=crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
  return `SESSION-${stamp}_${rnd}`;
}
async function sendCheckpoint(payload) {
  const body=JSON.stringify(payload);
  localStorage.setItem("meta_t_unsent_checkpoint_v02",body);
  const response = await fetch(DATA_BACKEND_URL,{
    method:"POST", mode:"no-cors",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body
  });
  // no-cors returns an opaque response: receipt by Google Drive is NOT confirmed.
  if (response.type !== "opaque" && !response.ok) throw new Error("Upload request failed");
  localStorage.removeItem("meta_t_unsent_checkpoint_v02");
}

const EXPERIMENT = {
  version: "0.7-hmm-hold-horizontal-no-download",
  practiceDurationMs: 1 * 60 * 1000,
  conditionDurationMs: 2 * 60 * 1000,
  conditions: [
    {id:1, eegLevel:0, framesPerDrop:48, dropIntervalMs:800},
    {id:2, eegLevel:4, framesPerDrop:28, dropIntervalMs:467},
    {id:3, eegLevel:6, framesPerDrop:18, dropIntervalMs:300},
    {id:4, eegLevel:7, framesPerDrop:13, dropIntervalMs:217},
    {id:5, eegLevel:9, framesPerDrop:6, dropIntervalMs:100}
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


// Three brief post-level ratings. Falling speed manipulates objective difficulty; challenge is self-reported.
const RATING_ITEMS = [
  ['ANCHOR-C','How challenging did you find this level of Tetris?'],
  ['ANCHOR-E','How much did you enjoy this level of Tetris?'],
  ['ANCHOR-F','How frustrated did you feel during this level of Tetris?']
];
function ratingItems(){ return RATING_ITEMS; }
function showBriefRatings(){
  const container=document.getElementById('questionnaireItems');container.replaceChildren();
  RATING_ITEMS.forEach(([id,wording],position)=>{
    const field=document.createElement('fieldset');field.style.marginBottom='18px';
    const legend=document.createElement('legend');legend.textContent=(position+1)+'. '+wording;field.append(legend);
    const scale=document.createElement('div');scale.className='scale';
    const low=document.createElement('span');low.textContent='Not at all';scale.append(low);
    for(let v=1;v<=7;v++){
      const label=document.createElement('label');label.textContent=String(v);
      const input=document.createElement('input');input.type='radio';input.name=id;input.value=String(v);input.required=true;
      label.append(input);scale.append(label);
    }
    const high=document.createElement('span');high.textContent='Extremely';scale.append(high);
    field.append(scale);container.append(field);
  });
}
function questionnaireCsv(logger){
  const rows=logger.questionnaireResponses;
  const columns=['participant_id','session_id','version','level','position','item_id','question','response','timestamp_iso'];
  const csv=[columns.join(','),...rows.map(r=>columns.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tetris_three_ratings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function boardBinary(board){return board.map(row=>row.map(cell=>cell?1:0).join(''));}
class ExperimentLogger {
  constructor() {
    this.participantId = getParticipantId();
    this.sessionId = makeSessionId();
    this.sessionStartedAt = new Date().toISOString();
    this.events = [];
    this.conditionSummaries = [];
    this.ratings = [];
    this.questionnaireResponses = [];
    this.questionnaireAssignment = {version:"three-ratings",items:RATING_ITEMS.map(x=>x[0])};
  }
  event(type, game, extra={}) {
    this.events.push({
      participant_id: this.participantId,
      session_id: this.sessionId,
      timestamp_iso: new Date().toISOString(),
      timestamp_ms: Date.now(),
      monotonic_ms: performance.now(),
      phase: game.phase,
      condition: game.conditionIndex >= 0 ? game.conditionIndex + 1 : null,
      attempt: game.attempt,
      drop_interval_ms: game.dropInterval,
      event: type,
      score: game.score,
      lines: game.lines,
      active_piece_id: game.currentPiece?.piece_id ?? null,
      ...extra
    });
  }
  async checkpoint(checkpointType="checkpoint") {
    const payload = {
      upload_version: DATA_UPLOAD_VERSION,
      checkpoint_type: checkpointType,
      participant_id: this.participantId,
      session_id: this.sessionId,
      session_started_at: this.sessionStartedAt,
      sent_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
      page_url: location.href,
      telemetry_schema:"raw-hmm-v2",
      board_encoding:"20 rows of 10 binary digits, top to bottom",
      gravity_intervals_ms:EXPERIMENT.conditions.map(c=>c.dropIntervalMs),
      hmm_logging_revision: HMM_LOGGING_REVISION,
      experiment_version: EXPERIMENT.version,
      events: this.events,
      condition_summaries: this.conditionSummaries,
      ratings: this.ratings,
      questionnaire_responses: this.questionnaireResponses,
      questionnaire_assignment: this.questionnaireAssignment
    };
    try {
      await sendCheckpoint(payload);
      return true;
    } catch(err) {
      console.error("Checkpoint upload failed; local fallback retained.",err);
      return false;
    }
  }
  exportAll() {
    downloadJSON("meta_t_experiment_data.json", {
      metadata: {
        participant_id: this.participantId,
        session_id: this.sessionId,
        experiment_version: EXPERIMENT.version,
        hmm_logging_revision: HMM_LOGGING_REVISION,
        exported_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
        telemetry_schema:"raw-hmm-v2",
        board_encoding:"20 rows of 10 binary digits, top to bottom",
        gravity_intervals_ms:EXPERIMENT.conditions.map(c=>c.dropIntervalMs)
      },
      events: this.events,
      condition_summaries: this.conditionSummaries,
      ratings: this.ratings,
      questionnaire_responses: this.questionnaireResponses,
      questionnaire_assignment: this.questionnaireAssignment
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
    this.pieceSerial = 0;
    this.conditionIndex = -1;
    this.attempt = 1;
    this.conditionStartedAt = null;
    this.phaseRemainingMs = 0;
    this.lastTick = performance.now();
    this.animationId = null;
    this.keys = {};
    this.softDropHeld = false;
    this.softDropRepeatTimer = null;
    this.horizontalHeld = null;
    this.horizontalDelayTimer = null;
    this.horizontalRepeatTimer = null;
    this.resetBoard(true);
    this.setupInput();
  }

  resetBoard(resetConditionStats=false) {
    this.stopHeldSoftDrop();
    this.stopHeldHorizontal();
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
      spawnedAt: performance.now(),
      piece_id: ++this.pieceSerial
    };
  }

  stopHeldSoftDrop(logEnd=false) {
    const wasHeld = this.softDropHeld;
    this.softDropHeld = false;
    if (this.softDropRepeatTimer) {
      clearInterval(this.softDropRepeatTimer);
      this.softDropRepeatTimer = null;
    }
    if (logEnd && wasHeld && ["practice","play"].includes(this.phase)) {
      this.logger.event("soft_drop_end", this, { piece:this.currentPiece.type, y:this.currentPiece.y });
    }
  }

  stopHeldHorizontal(logEnd=false) {
    const previous = this.horizontalHeld;
    this.horizontalHeld = null;
    clearTimeout(this.horizontalDelayTimer);
    clearInterval(this.horizontalRepeatTimer);
    this.horizontalDelayTimer = null;
    this.horizontalRepeatTimer = null;
    if (logEnd && previous && ["practice","play"].includes(this.phase)) {
      this.logger.event("horizontal_hold_end", this, {key: previous});
    }
  }

  startHeldHorizontal(key) {
    if (this.horizontalHeld === key) return;
    this.stopHeldHorizontal(true);
    this.horizontalHeld = key;
    const direction = key === "ArrowLeft" ? -1 : 1;
    this.logger.event("horizontal_hold_start", this, {key, das_ms:HORIZONTAL_DAS_MS, arr_ms:HORIZONTAL_ARR_MS});
    this.movePiece(direction, "initial_press");
    this.horizontalDelayTimer = setTimeout(() => {
      if (this.horizontalHeld !== key || !["practice","play"].includes(this.phase)) return;
      this.movePiece(direction, "held_repeat");
      this.horizontalRepeatTimer = setInterval(() => {
        if (this.horizontalHeld !== key || !["practice","play"].includes(this.phase)) {
          this.stopHeldHorizontal();
          return;
        }
        this.movePiece(direction, "held_repeat");
      }, HORIZONTAL_ARR_MS);
    }, HORIZONTAL_DAS_MS);
  }

  setupInput() {
    window.addEventListener("keydown", e => {
      if (!["practice","play"].includes(this.phase)) return;
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","Spacebar"].includes(e.key) || e.code === "Space") {
        e.preventDefault();
      }

      // EEG-comparable controls: Space/hard drop is deliberately disabled.
      if (e.code === "Space" || e.key === " " || e.key === "Spacebar") {
        if (!e.repeat) this.logger.event("disabled_hard_drop_key", this, { key: "Space" });
        return;
      }

      // ArrowDown: one immediate soft drop, then controlled continuous soft drop while held.
      if (e.key === "ArrowDown") {
        if (e.repeat || this.softDropHeld) return;
        this.softDropHeld = true;
        this.keypresses++;
        this.logger.event("keypress", this, { key: e.key, piece: this.currentPiece.type });
        this.logger.event("soft_drop_start", this, { piece:this.currentPiece.type, y:this.currentPiece.y });
        this.softDrop("participant");
        this.softDropRepeatTimer = setInterval(() => {
          if (!this.softDropHeld || !["practice","play"].includes(this.phase)) {
            this.stopHeldSoftDrop();
            return;
          }
          this.softDrop("participant_held");
        }, 50);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (e.repeat || this.horizontalHeld === e.key) return;
        this.keypresses++;
        this.logger.event("keypress", this, {key:e.key, piece:this.currentPiece.type, input_mode:"physical_keydown"});
        this.startHeldHorizontal(e.key);
        return;
      }
      if (e.repeat) return;
      this.keypresses++;
      this.logger.event("keypress", this, { key: e.key, piece: this.currentPiece.type });
      if (e.key === "ArrowUp") this.rotatePiece();
    });

    window.addEventListener("keyup", e => {
      if (e.key === "ArrowDown") this.stopHeldSoftDrop(true);
      if (e.key === this.horizontalHeld) this.stopHeldHorizontal(true);
    });
    window.addEventListener("blur", () => { this.stopHeldSoftDrop(); this.stopHeldHorizontal(); });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopHeldSoftDrop();
        this.stopHeldHorizontal();
        this.logger.event("focus_lost", this);
      } else this.logger.event("focus_regained", this);
    });
  }

  startPractice() {
    this.phase = "practice";
    this.conditionIndex = -1;
    this.dropInterval = 1000;
    this.phaseRemainingMs = EXPERIMENT.practiceDurationMs;
    this.resetBoard(true);
    this.logger.event("practice_start", this);
    this.logPieceSpawn("practice_start");
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
    this.logger.event("condition_start", this, { condition_id: c.id, gravity_interval_ms:c.dropIntervalMs, board_width:this.boardWidth, board_height:this.boardHeight, controls:"left-right-DAS267-ARR100;up-clockwise;down-50ms-held;hard-drop-disabled" });
    this.logPieceSpawn("condition_start");
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
    this.stopHeldHorizontal();
    this.stopHeldSoftDrop();
    this.logger.event("practice_end", this);
    this.logger.checkpoint("practice_end");
    this.phase = "idle";
    showScreen("experimentIntro");
  }

  endCondition() {
    this.stopHeldHorizontal();
    this.stopHeldSoftDrop();
    const c = EXPERIMENT.conditions[this.conditionIndex];
    this.logger.event("condition_end", this);
    const conditionEvents = this.logger.events.filter(e => e.condition === c.id && e.phase === "play");
    const countEvent = name => conditionEvents.filter(e => e.event === name).length;
    const startedAt = this.conditionStartedAt ? new Date(this.conditionStartedAt).toISOString() : "";
    const endedAt = new Date().toISOString();
    this.logger.conditionSummaries.push({
      participant_id: this.logger.participantId,
      session_id: this.logger.sessionId,
      condition: c.id,
      drop_interval_ms: c.dropIntervalMs,
      eeg_level: c.eegLevel,
      frames_per_drop: c.framesPerDrop,
      condition_duration_ms: this.conditionStartedAt ? Date.now() - this.conditionStartedAt : EXPERIMENT.conditionDurationMs,
      score: this.score,
      lines_cleared: this.lines,
      pieces_placed: this.piecesPlaced,
      keypresses: this.keypresses,
      left_right_moves: countEvent("move_left") + countEvent("move_right"),
      rotations: countEvent("rotate"),
      soft_drops: countEvent("soft_drop"),
      game_overs: this.gameOvers,
      attempts: this.attempt,
      challenge_rating: "",
      frustration_rating: "",
      enjoyment_rating: "",
      started_at: startedAt,
      ended_at: endedAt
    });
    this.logger.checkpoint("condition_end");
    this.phase = "rating";
    showRating(c.id);
    showBriefRatings();
    this.logger.event("rating_start", this);
  }

  submitRating(challenge, frustration, enjoyment, itemResponses) {
    const level=this.conditionIndex;
    RATING_ITEMS.forEach(([id,question],position)=>{
      const response=Number(itemResponses[id]);
      this.logger.questionnaireResponses.push({participant_id:this.logger.participantId,session_id:this.logger.sessionId,version:"three-ratings",level:level+1,position:position+1,item_id:id,question,response,timestamp_iso:new Date().toISOString()});
    });
    const c = EXPERIMENT.conditions[this.conditionIndex];
    this.logger.ratings.push({
      participant_id: this.logger.participantId,
      session_id: this.logger.sessionId,
      condition: c.id,
      drop_interval_ms: c.dropIntervalMs,
      eeg_level: c.eegLevel,
      frames_per_drop: c.framesPerDrop,
      challenge_rating: Number(challenge),
      frustration_rating: Number(frustration),
      enjoyment_rating: Number(enjoyment),
      timestamp_iso: new Date().toISOString()
    });
    this.logger.event("rating_response", this, {
      challenge_rating: Number(challenge),
      frustration_rating: Number(frustration),
      enjoyment_rating: Number(enjoyment)
    });
    const summary = this.logger.conditionSummaries.find(s => s.condition === c.id);
    if (summary) {
      summary.challenge_rating = Number(challenge);
      summary.frustration_rating = Number(frustration);
      summary.enjoyment_rating = Number(enjoyment);
    }
    this.logger.checkpoint("rating_response");

    this.conditionIndex++;
    if (this.conditionIndex < EXPERIMENT.conditions.length) {
      showScreen("gameScreen");
      this.startCondition();
    } else {
      this.phase = "complete";
      showScreen("completeScreen");
      void submitFinalCheckpoint();
    }
  }

  update(dt) {
    this.dropCounter += dt;
    if (this.dropCounter >= this.dropInterval) {
      this.softDrop("gravity");
      this.dropCounter = 0;
    }
  }

  movePiece(direction, inputMode="initial_press") {
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

  logPieceSpawn(reason) {
    this.logger.event("piece_spawn", this, {
      piece: this.currentPiece.type, piece_id:this.currentPiece.piece_id, x: this.currentPiece.x,
      y: this.currentPiece.y, rotation: this.currentPiece.rotation,
      next_piece:this.nextPiece.type, board_before:boardBinary(this.board),
      reason, hmm_logging_revision: HMM_LOGGING_REVISION
    });
  }

  softDrop(source="participant") {
    this.currentPiece.y++;
    if (this.collision()) {
      this.currentPiece.y--;
      this.logger.event("downward_collision", this, { source, piece: this.currentPiece.type, y: this.currentPiece.y });
      this.placePiece();
    } else if (source === "gravity") {
      this.logger.event("gravity_step", this, { piece: this.currentPiece.type, y: this.currentPiece.y });
    } else if (source === "participant") {
      this.logger.event("soft_drop", this, { piece:this.currentPiece.type, y:this.currentPiece.y, input_mode:"initial_press" });
    } else if (source === "participant_held") {
      this.logger.event("soft_drop_repeat", this, { piece:this.currentPiece.type, y:this.currentPiece.y, input_mode:"held" });
    }
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
    const boardBeforePlacement=boardBinary(this.board);
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
      piece:this.currentPiece.type, piece_id:this.currentPiece.piece_id,
      board_before:boardBeforePlacement,
      shape:this.currentPiece.shape.map(row=>row.map(Boolean)),
      next_piece:this.nextPiece.type,
      x:this.currentPiece.x, y:this.currentPiece.y,
      rotation:this.currentPiece.rotation,
      decision_time_ms: Math.round(performance.now()-this.currentPiece.spawnedAt)
    });
    this.clearLines();
    this.logger.event("board_after_placement",this,{piece_id:this.currentPiece.piece_id,board_after:boardBinary(this.board)});

    // Robust top-out check. If blocks remain in the spawn zone after the
    // placement/line-clear step, end this attempt immediately.
    if (this.board[0].some(cell => cell !== 0) || this.board[1].some(cell => cell !== 0)) {
      this.handleGameOver();
      return;
    }

    this.currentPiece=this.nextPiece;
    this.nextPiece=this.createPiece();

    // A top-out also occurs when the newly spawned piece cannot legally occupy
    // its starting position. The previous prototype only checked for blocks
    // above the board while locking a piece, so overlapping spawn pieces
    // could continue indefinitely at the top.
    if (this.collision()) {
      this.handleGameOver();
      return;
    }

    this.logPieceSpawn("after_placement");
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
    this.logger.checkpoint("game_over");

    // Tell the participant what happened, but do not end the experimental
    // condition. The board is reset and play continues at the same speed.
    const notice = document.getElementById("gameOverNotice");
    if (notice) {
      notice.classList.remove("hidden");
      clearTimeout(this.gameOverNoticeTimer);
      this.gameOverNoticeTimer = setTimeout(() => {
        notice.classList.add("hidden");
      }, 1200);
    }

    this.attempt++;
    this.resetBoard(false);
    this.logger.event("restart", this);
    this.logPieceSpawn("restart");
  }


  draw() {
    this.ctx.fillStyle="#111827";
    this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    for (let r=0;r<this.boardHeight;r++) for (let c=0;c<this.boardWidth;c++) {
      if (this.board[r][c]) this.drawBlock(this.ctx,c,r,this.board[r][c],this.blockSize);
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
async function submitFinalCheckpoint() {
  const status=document.getElementById("uploadStatus");
  const retry=document.getElementById("retryUploadBtn");
  const finish=document.getElementById("finishBtn");
  retry.classList.add("hidden");
  finish.disabled=true;
  status.textContent="Submitting your responses…";
  const sent=await logger.checkpoint("study_complete");
  if (sent) {
    status.textContent="Your data submission has been sent. You may finish now.";
    // The Apps Script endpoint uses no-cors; this cannot confirm Drive persistence.
    finish.disabled=false;
  } else {
    status.textContent="The submission could not be sent. Please check your connection and retry.";
    retry.classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  if (sessionStorage.getItem("consentGiven") !== "true") {
    window.location.replace("index.html");
    return;
  }
  logger=new ExperimentLogger();
  game=new TetrisGame(document.getElementById("gameCanvas"),document.getElementById("nextPieceCanvas"),logger);
  setInterval(()=> {
    if (game && ["practice","play","rating"].includes(game.phase)) logger.checkpoint("periodic_30s");
  },30000);
  setText("participantId",logger.participantId);

  document.getElementById("practiceBtn").onclick=()=>{showScreen("gameScreen");game.startPractice();};
  document.getElementById("startExperimentBtn").onclick=()=>{showScreen("gameScreen");game.startExperiment();};
  document.getElementById("ratingForm").onsubmit=e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const answers={};for(const [k,v] of fd.entries())answers[k]=v;
    game.submitRating(answers["ANCHOR-C"],answers["ANCHOR-F"],answers["ANCHOR-E"],answers);
  };
  document.getElementById("retryUploadBtn").onclick=()=>{ void submitFinalCheckpoint(); };
  document.getElementById("finishBtn").onclick=()=>{
    document.getElementById("finishBtn").disabled=true;
    document.getElementById("uploadStatus").textContent="Thank you for participating. You may close this tab.";
  };
  showScreen("welcomeScreen");
});

window.addEventListener("pagehide",()=>{
  try {
    if(!logger) return;
    const payload={
      upload_version:DATA_UPLOAD_VERSION, checkpoint_type:"pagehide",
      participant_id:logger.participantId, session_id:logger.sessionId,
      session_started_at:logger.sessionStartedAt, sent_at:new Date().toISOString(),
      user_agent:navigator.userAgent, page_url:location.href,
      telemetry_schema:"raw-hmm-v2", hmm_logging_revision:HMM_LOGGING_REVISION, experiment_version:EXPERIMENT.version,
      events:logger.events, condition_summaries:logger.conditionSummaries, ratings:logger.ratings, questionnaire_responses:logger.questionnaireResponses, questionnaire_assignment:logger.questionnaireAssignment
    };
    const body=JSON.stringify(payload);
    localStorage.setItem("meta_t_unsent_checkpoint_v02",body);
    navigator.sendBeacon(DATA_BACKEND_URL,new Blob([body],{type:"text/plain;charset=UTF-8"}));
  } catch(e) {}
});
