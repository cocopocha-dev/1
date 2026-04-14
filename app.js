(function () {
  "use strict";

  const GRID = 8;
  const COLORS = [
    "#ff8fab", "#a0d2db", "#ffc857", "#b8e0a0",
    "#c3a0e0", "#ffb088", "#88c8f8"
  ];
  const EMPTY = 0;
  const BONUS_ALL_CLEAR = 500;

  const SHAPES = [
    [[1]],
    [[1, 1]],
    [[1], [1]],
    [[1, 1, 1]],
    [[1], [1], [1]],
    [[1, 1], [1, 0]],
    [[1, 1], [0, 1]],
    [[0, 1], [1, 1]],
    [[1, 0], [1, 1]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
    [[1, 1, 1], [0, 1, 0]],
    [[0, 1], [1, 1], [0, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 1], [1, 0]],
    [[1, 1, 1, 1, 1]],
    [[1], [1], [1], [1], [1]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  ];

  let board = [];
  let score = 0;
  let bestScore = parseInt(localStorage.getItem("blockpuzzle_best") || "0", 10);
  let pieces = [null, null, null];
  let piecesUsed = [false, false, false];

  const scoreEl = document.getElementById("score-value");
  const bestEl = document.getElementById("best-value");
  const trayEl = document.getElementById("pieces-tray");
  const boardCanvas = document.getElementById("board-canvas");
  const boardCtx = boardCanvas.getContext("2d");
  const gameOverOverlay = document.getElementById("game-over-overlay");
  const finalScoreEl = document.getElementById("final-score");
  const restartBtn = document.getElementById("restart-btn");
  const bonusPopup = document.getElementById("bonus-popup");
  const comboPopup = document.getElementById("combo-popup");
  const comboText = document.getElementById("combo-text");

  let cellSize = 0;
  let boardPx = 0;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
  let dpr = 1;

  let dragPiece = null;
  let dragIndex = -1;
  let dragX = 0;
  let dragY = 0;
  let ghostCells = [];

  function initBoard() {
    board = [];
    for (let r = 0; r < GRID; r++) {
      board.push(new Array(GRID).fill(EMPTY));
    }
  }

  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  function randomPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return { shape, color: randomColor() };
  }

  function generatePieces() {
    for (let i = 0; i < 3; i++) {
      pieces[i] = randomPiece();
      piecesUsed[i] = false;
    }
    renderTray();
  }

  function allPiecesUsed() {
    return piecesUsed.every(Boolean);
  }

  function sizeBoardCanvas() {
    const container = document.getElementById("board-container");
    const w = container.clientWidth;
    const h = container.clientHeight;
    const sz = Math.min(w, h);
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    boardCanvas.width = sz * dpr;
    boardCanvas.height = sz * dpr;
    boardCanvas.style.width = sz + "px";
    boardCanvas.style.height = sz + "px";
    boardPx = sz;
    const padding = sz * 0.03;
    cellSize = (sz - padding * 2) / GRID;
    boardOffsetX = padding;
    boardOffsetY = padding;
  }

  function drawBoard() {
    const ctx = boardCtx;
    const s = dpr;
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    ctx.fillStyle = "#f0e6da";
    ctx.beginPath();
    roundRect(ctx, 0, 0, boardPx * s, boardPx * s, 16 * s);
    ctx.fill();

    const gap = 2 * s;

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = (boardOffsetX + c * cellSize) * s;
        const y = (boardOffsetY + r * cellSize) * s;
        const w = cellSize * s - gap;
        const h = cellSize * s - gap;
        const rad = 4 * s;

        if (board[r][c] !== EMPTY) {
          ctx.fillStyle = board[r][c];
          ctx.beginPath();
          roundRect(ctx, x + gap / 2, y + gap / 2, w, h, rad);
          ctx.fill();

          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.beginPath();
          roundRect(ctx, x + gap / 2, y + gap / 2, w, h * 0.45, rad);
          ctx.fill();
        } else {
          ctx.fillStyle = "#e8ddd1";
          ctx.beginPath();
          roundRect(ctx, x + gap / 2, y + gap / 2, w, h, rad);
          ctx.fill();
        }
      }
    }

    if (ghostCells.length > 0) {
      const valid = canPlaceShape(ghostCells[0].gr, ghostCells[0].gc, dragPiece.shape);
      for (const g of ghostCells) {
        const x = (boardOffsetX + g.gc * cellSize) * s;
        const y = (boardOffsetY + g.gr * cellSize) * s;
        const w = cellSize * s - gap;
        const h = cellSize * s - gap;
        const rad = 4 * s;

        ctx.fillStyle = valid
          ? hexToRgba(dragPiece.color, 0.4)
          : "rgba(200,80,80,0.3)";
        ctx.beginPath();
        roundRect(ctx, x + gap / 2, y + gap / 2, w, h, rad);
        ctx.fill();
      }
    }
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function renderTray() {
    trayEl.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement("div");
      slot.className = "piece-slot" + (piecesUsed[i] ? " used" : "");
      slot.dataset.index = i;

      if (pieces[i] && !piecesUsed[i]) {
        const canvas = document.createElement("canvas");
        canvas.className = "piece-canvas";
        const piece = pieces[i];
        const rows = piece.shape.length;
        const cols = piece.shape[0].length;
        const maxDim = Math.max(rows, cols);
        const pieceCellSize = 80 / maxDim;

        const cw = cols * pieceCellSize;
        const ch = rows * pieceCellSize;
        const pdpr = Math.min(window.devicePixelRatio || 1, 3);
        canvas.width = cw * pdpr;
        canvas.height = ch * pdpr;
        canvas.style.width = cw + "px";
        canvas.style.height = ch + "px";

        const pctx = canvas.getContext("2d");
        pctx.scale(pdpr, pdpr);
        const gap = 1.5;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (piece.shape[r][c]) {
              pctx.fillStyle = piece.color;
              pctx.beginPath();
              roundRect(pctx,
                c * pieceCellSize + gap / 2,
                r * pieceCellSize + gap / 2,
                pieceCellSize - gap,
                pieceCellSize - gap,
                3
              );
              pctx.fill();

              pctx.fillStyle = "rgba(255,255,255,0.25)";
              pctx.beginPath();
              roundRect(pctx,
                c * pieceCellSize + gap / 2,
                r * pieceCellSize + gap / 2,
                pieceCellSize - gap,
                (pieceCellSize - gap) * 0.45,
                3
              );
              pctx.fill();
            }
          }
        }

        slot.appendChild(canvas);
        addDragListeners(slot, i);
      }

      trayEl.appendChild(slot);
    }
  }

  function addDragListeners(el, index) {
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("mousedown", onMouseDown);

    function onTouchStart(e) {
      e.preventDefault();
      const t = e.touches[0];
      startDrag(index, t.clientX, t.clientY);
    }

    function onMouseDown(e) {
      e.preventDefault();
      startDrag(index, e.clientX, e.clientY);
    }
  }

  let dragEl = null;

  function startDrag(index, cx, cy) {
    if (piecesUsed[index]) return;
    dragPiece = pieces[index];
    dragIndex = index;
    dragX = cx;
    dragY = cy;

    const slot = trayEl.children[index];
    slot.classList.add("dragging");

    dragEl = document.createElement("canvas");
    dragEl.style.position = "fixed";
    dragEl.style.pointerEvents = "none";
    dragEl.style.zIndex = "50";
    dragEl.style.opacity = "0.85";
    document.body.appendChild(dragEl);

    drawDragPiece();
    positionDragEl(cx, cy);

    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("touchend", onDragEnd);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
  }

  function drawDragPiece() {
    if (!dragPiece || !dragEl) return;
    const rows = dragPiece.shape.length;
    const cols = dragPiece.shape[0].length;
    const cs = cellSize;
    const pdpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = cols * cs;
    const h = rows * cs;
    dragEl.width = w * pdpr;
    dragEl.height = h * pdpr;
    dragEl.style.width = w + "px";
    dragEl.style.height = h + "px";

    const ctx = dragEl.getContext("2d");
    ctx.scale(pdpr, pdpr);
    const gap = 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (dragPiece.shape[r][c]) {
          ctx.fillStyle = dragPiece.color;
          ctx.beginPath();
          roundRect(ctx, c * cs + gap / 2, r * cs + gap / 2, cs - gap, cs - gap, 4);
          ctx.fill();

          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.beginPath();
          roundRect(ctx, c * cs + gap / 2, r * cs + gap / 2, cs - gap, (cs - gap) * 0.45, 4);
          ctx.fill();
        }
      }
    }
  }

  function positionDragEl(cx, cy) {
    if (!dragEl || !dragPiece) return;
    const rows = dragPiece.shape.length;
    const cols = dragPiece.shape[0].length;
    const w = cols * cellSize;
    const h = rows * cellSize;
    const offsetY = -h / 2 - 40;
    dragEl.style.left = (cx - w / 2) + "px";
    dragEl.style.top = (cy + offsetY) + "px";
  }

  function onDragMove(e) {
    e.preventDefault();
    let cx, cy;
    if (e.touches) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    dragX = cx;
    dragY = cy;

    positionDragEl(cx, cy);
    updateGhost(cx, cy);
    drawBoard();
  }

  function updateGhost(cx, cy) {
    ghostCells = [];
    if (!dragPiece) return;

    const rect = boardCanvas.getBoundingClientRect();
    const rows = dragPiece.shape.length;
    const cols = dragPiece.shape[0].length;
    const w = cols * cellSize;
    const h = rows * cellSize;
    const offsetY = -h / 2 - 40;

    const pieceLeft = cx - w / 2;
    const pieceTop = cy + offsetY;
    const pieceCenterX = pieceLeft + w / 2;
    const pieceCenterY = pieceTop + h / 2;

    const boardLeft = rect.left + boardOffsetX;
    const boardTop = rect.top + boardOffsetY;

    const baseCol = Math.round((pieceCenterX - boardLeft - w / 2) / cellSize);
    const baseRow = Math.round((pieceCenterY - boardTop - h / 2) / cellSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (dragPiece.shape[r][c]) {
          ghostCells.push({ gr: baseRow + r, gc: baseCol + c });
        }
      }
    }
  }

  function onDragEnd(e) {
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);

    const slot = trayEl.children[dragIndex];
    if (slot) slot.classList.remove("dragging");

    if (ghostCells.length > 0) {
      const baseRow = ghostCells[0].gr;
      const baseCol = ghostCells[0].gc;
      if (canPlaceShape(baseRow, baseCol, dragPiece.shape)) {
        placeShape(baseRow, baseCol, dragPiece.shape, dragPiece.color);
        piecesUsed[dragIndex] = true;

        const linesCleared = clearLines();
        updateScore(linesCleared);
        checkAllClear();

        renderTray();

        if (allPiecesUsed()) {
          generatePieces();
        }

        if (isGameOver()) {
          endGame();
        }
      }
    }

    ghostCells = [];
    dragPiece = null;
    dragIndex = -1;

    if (dragEl) {
      dragEl.remove();
      dragEl = null;
    }

    drawBoard();
  }

  function canPlaceShape(row, col, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        if (!shape[r][c]) continue;
        const br = row + r;
        const bc = col + c;
        if (br < 0 || br >= GRID || bc < 0 || bc >= GRID) return false;
        if (board[br][bc] !== EMPTY) return false;
      }
    }
    return true;
  }

  function placeShape(row, col, shape, color) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        if (shape[r][c]) {
          board[row + r][col + c] = color;
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    let rowsToClear = [];
    let colsToClear = [];

    for (let r = 0; r < GRID; r++) {
      if (board[r].every(cell => cell !== EMPTY)) {
        rowsToClear.push(r);
      }
    }

    for (let c = 0; c < GRID; c++) {
      let full = true;
      for (let r = 0; r < GRID; r++) {
        if (board[r][c] === EMPTY) { full = false; break; }
      }
      if (full) colsToClear.push(c);
    }

    for (const r of rowsToClear) {
      for (let c = 0; c < GRID; c++) {
        board[r][c] = EMPTY;
      }
      cleared++;
    }

    for (const c of colsToClear) {
      for (let r = 0; r < GRID; r++) {
        board[r][c] = EMPTY;
      }
      cleared++;
    }

    return cleared;
  }

  function updateScore(linesCleared) {
    if (linesCleared === 0) return;
    const base = linesCleared * 10;
    const combo = linesCleared > 1 ? linesCleared * 5 : 0;
    const points = base + combo;
    score += points;

    if (linesCleared > 1) {
      showCombo(linesCleared, points);
    }

    updateScoreDisplay();
  }

  function checkAllClear() {
    const isEmpty = board.every(row => row.every(cell => cell === EMPTY));
    if (isEmpty) {
      score += BONUS_ALL_CLEAR;
      updateScoreDisplay();
      showBonus();
    }
  }

  function updateScoreDisplay() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("blockpuzzle_best", bestScore.toString());
    }
    bestEl.textContent = bestScore;
  }

  function showBonus() {
    bonusPopup.classList.remove("hidden");
    bonusPopup.classList.remove("popup-animate");
    void bonusPopup.offsetWidth;
    bonusPopup.classList.add("popup-animate");
    setTimeout(() => {
      bonusPopup.classList.add("hidden");
      bonusPopup.classList.remove("popup-animate");
    }, 1300);
  }

  function showCombo(lines, points) {
    comboText.textContent = `${lines}ライン! +${points}`;
    comboPopup.classList.remove("hidden");
    comboPopup.classList.remove("popup-animate");
    void comboPopup.offsetWidth;
    comboPopup.classList.add("popup-animate");
    setTimeout(() => {
      comboPopup.classList.add("hidden");
      comboPopup.classList.remove("popup-animate");
    }, 1300);
  }

  function canPlaceAnyPiece() {
    for (let i = 0; i < 3; i++) {
      if (piecesUsed[i]) continue;
      const shape = pieces[i].shape;
      for (let r = 0; r <= GRID - shape.length; r++) {
        for (let c = 0; c <= GRID - shape[0].length; c++) {
          if (canPlaceShape(r, c, shape)) return true;
        }
      }
    }
    return false;
  }

  function isGameOver() {
    return !canPlaceAnyPiece();
  }

  function endGame() {
    finalScoreEl.textContent = score;
    gameOverOverlay.classList.remove("hidden");
  }

  function startGame() {
    initBoard();
    score = 0;
    updateScoreDisplay();
    gameOverOverlay.classList.add("hidden");
    generatePieces();
    sizeBoardCanvas();
    drawBoard();
  }

  restartBtn.addEventListener("click", startGame);

  window.addEventListener("resize", () => {
    sizeBoardCanvas();
    drawBoard();
  });

  startGame();
})();
