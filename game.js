'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#a3c9f7', // J - azul pálido
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

/* ---- Skins ----
   Cada skin tiene su propia paleta (alineada por índice con PIECES, con null en 0)
   y su propia función de dibujo de bloque. Se cambian en caliente: no hay que
   recargar, basta con repintar con las nuevas constantes. */

const NEON_COLORS = [
  null,
  '#00f0ff', // I
  '#ffe600', // O
  '#c400ff', // T
  '#00ff85', // S
  '#ff0059', // Z
  '#3d7bff', // J
  '#ff9100', // L
];

const PASTEL_COLORS = [
  null,
  '#a0e7e5', // I
  '#fdf3b4', // O
  '#dcb8f0', // T
  '#bbe6b8', // S
  '#f7b8b8', // Z
  '#b9cdf7', // J
  '#fbd6a5', // L
];

const PIXEL_COLORS = [
  null,
  '#3cc7d8', // I
  '#e8c23a', // O
  '#a259c4', // T
  '#5fbb52', // S
  '#d8483f', // Z
  '#3d6fd8', // J
  '#e08b34', // L
];

// Patrón fijo de "píxeles" sueltos dentro del bloque (4x4)
const PIXEL_PATTERN = [
  [0, 1, 0, 0],
  [0, 0, 0, 1],
  [1, 0, 1, 0],
  [0, 0, 0, 0],
];

// amt > 0 aclara hacia blanco, amt < 0 oscurece hacia negro
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = ch => Math.round(ch + (target - ch) * p);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

function roundedPath(context, px, py, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(px, py, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  context.moveTo(px + rr, py);
  context.arcTo(px + w, py, px + w, py + h, rr);
  context.arcTo(px + w, py + h, px, py + h, rr);
  context.arcTo(px, py + h, px, py, rr);
  context.arcTo(px, py, px + w, py, rr);
  context.closePath();
}

function drawBlockRetro(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawBlockNeon(context, px, py, size, color) {
  const pad = 2;
  const w = size - pad * 2;
  context.shadowColor = color;
  context.shadowBlur = size * 0.55;
  context.fillStyle = shade(color, -0.75);
  context.fillRect(px + pad, py + pad, w, w);
  context.lineWidth = 2;
  context.strokeStyle = color;
  context.strokeRect(px + pad + 1, py + pad + 1, w - 2, w - 2);
  context.shadowBlur = 0;
  // núcleo interior, algo más claro que el fondo del bloque
  const inset = Math.round(size * 0.28);
  context.fillStyle = shade(color, -0.45);
  context.fillRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
}

function drawBlockPastel(context, px, py, size, color) {
  const pad = 2;
  const w = size - pad * 2;
  const r = Math.max(3, size * 0.24);
  roundedPath(context, px + pad, py + pad, w, w, r);
  context.fillStyle = color;
  context.fill();
  // brillo superior
  roundedPath(context, px + pad + 2, py + pad + 2, w - 4, w * 0.42, r * 0.7);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
  // borde suave
  roundedPath(context, px + pad + 0.5, py + pad + 0.5, w - 1, w - 1, r);
  context.strokeStyle = shade(color, -0.22);
  context.lineWidth = 1;
  context.stroke();
}

function drawBlockPixel(context, px, py, size, color) {
  const x0 = px + 1;
  const y0 = py + 1;
  const w = size - 2;
  const u = Math.max(2, Math.round(size / 10)); // tamaño del "píxel" de textura
  context.fillStyle = color;
  context.fillRect(x0, y0, w, w);
  // bisel duro: luz arriba/izquierda, sombra abajo/derecha
  context.fillStyle = shade(color, 0.35);
  context.fillRect(x0, y0, w, u);
  context.fillRect(x0, y0, u, w);
  context.fillStyle = shade(color, -0.35);
  context.fillRect(x0, y0 + w - u, w, u);
  context.fillRect(x0 + w - u, y0, u, w);
  // textura punteada dentro del bisel
  const cell = (w - u * 2) / 4;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!PIXEL_PATTERN[r][c]) continue;
      context.fillStyle = shade(color, r % 2 ? -0.2 : 0.22);
      context.fillRect(Math.round(x0 + u + c * cell), Math.round(y0 + u + r * cell), u, u);
    }
  }
}

const SKINS = {
  retro: { colors: COLORS, draw: drawBlockRetro },
  neon: { colors: NEON_COLORS, draw: drawBlockNeon },
  pastel: { colors: PASTEL_COLORS, draw: drawBlockPastel },
  pixel: { colors: PIXEL_COLORS, draw: drawBlockPixel },
};

const DEFAULT_SKIN = 'retro';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor, skin;

function readThemeVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Repinta con los colores actuales sin esperar al siguiente frame
// (necesario en pausa y en Game Over, donde el bucle está detenido)
function repaint() {
  if (!current) return;
  draw();
  drawNext();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tetris-theme', theme);
  gridColor = readThemeVar('--grid-line');
  repaint();
}

function applySkin(name) {
  const key = SKINS[name] ? name : DEFAULT_SKIN;
  skin = SKINS[key];
  document.documentElement.setAttribute('data-skin', key);
  localStorage.setItem('tetris-skin', key);
  gridColor = readThemeVar('--grid-line'); // cada skin puede redefinir la rejilla
  repaint();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // tras el Game Over la pieza actual está solapada con la pila: no se dibuja
  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  draw(); // frame final: el tablero asentado, sin más fichas
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  // corta cualquier frame agendado antes de terminar o pausar la partida
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() puede haber terminado la partida en este mismo frame:
  // no reprogramar, o el bucle seguiría generando fichas tras el Game Over
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'light';
themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

// applySkin() deja listos skin y gridColor antes del primer draw()
applySkin(document.documentElement.getAttribute('data-skin') || DEFAULT_SKIN);
skinSelect.value = document.documentElement.getAttribute('data-skin');
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
