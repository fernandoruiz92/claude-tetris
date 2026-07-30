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

const RECORDS_KEY = 'tetris-records';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_RECORDS = 5;
const MAX_NAME = 8;
const MAX_LEVEL = 15;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level-select');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const overRecords = document.getElementById('over-records');
const overResetBtn = document.getElementById('over-reset-btn');
const startOverlay = document.getElementById('start-overlay');
const startRecords = document.getElementById('start-records');
const startResetBtn = document.getElementById('start-reset-btn');
const levelSelect = document.getElementById('level-select');
const playBtn = document.getElementById('play-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor;
let combo, bestCombo;
// true mientras hay una partida en curso; con la pantalla de inicio visible
// `current` todavía no existe, así que el teclado tiene que quedar inerte
let started = false;
let records = [];
// record a la espera de que el jugador escriba su nombre (null si no aplica)
let pendingRecord = null;

let startLevel = loadStartLevel(); // 1..MAX_LEVEL, default 1

function loadStartLevel() {
  try {
    const n = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
    return n >= 1 && n <= MAX_LEVEL ? n : 1;
  } catch { return 1; }
}

function setStartLevel(n) {
  startLevel = n >= 1 && n <= MAX_LEVEL ? n : 1;
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch {}
  // el ajuste se expone en dos sitios: hay que reflejar el valor normalizado
  // en ambos selectores, no sólo en el que disparó el cambio
  syncLevelSelects();
}

function syncLevelSelects() {
  levelSelect.value = String(startLevel);
  startLevelSelect.value = String(startLevel);
}

function readThemeVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('tetris-theme', theme); } catch {}
  gridColor = readThemeVar('--grid-line');
}

/* ---------- Tabla de records (localStorage) ---------- */

// Un record válido necesita al menos nombre y puntuación con el tipo correcto;
// el resto de campos se normalizan para tolerar datos de versiones anteriores.
function isValidRecord(r) {
  return !!r && typeof r === 'object' && !Array.isArray(r) &&
    typeof r.name === 'string' && Number.isFinite(r.score);
}

function toCount(v, min) {
  return Number.isFinite(v) ? Math.max(min, Math.floor(v)) : min;
}

function normalizeRecord(r) {
  return {
    name: String(r.name).trim().slice(0, MAX_NAME) || 'ANÓNIMO',
    score: toCount(r.score, 0),
    lines: toCount(r.lines, 0),
    level: toCount(r.level, 1),
    combo: toCount(r.combo, 0),
    date: typeof r.date === 'string' ? r.date.slice(0, 10) : '',
  };
}

// Defensivo a propósito: storage deshabilitado, JSON roto o datos de otra
// versión no deben impedir que el juego arranque — se tratan como lista vacía.
function loadRecords() {
  let raw;
  try {
    raw = localStorage.getItem(RECORDS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(isValidRecord)
    .map(normalizeRecord)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {}
}

function qualifies(value) {
  if (value <= 0) return false;
  return records.length < MAX_RECORDS || value > records[records.length - 1].score;
}

function bestOf(field) {
  if (!records.length) return null;
  return records.reduce((max, r) => Math.max(max, r[field]), 0);
}

function makeSpan(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text; // textContent, nunca innerHTML: el nombre lo escribe el jugador
  return el;
}

function makeStat(label, value) {
  const group = document.createElement('div');
  group.className = 'records-stat';
  group.appendChild(makeSpan('records-stat-label', label));
  group.appendChild(makeSpan('records-stat-value', value === null ? '—' : String(value)));
  return group;
}

function renderRecords(container, highlight) {
  container.textContent = '';
  container.appendChild(makeSpan('label', 'MEJORES PUNTUACIONES'));

  if (!records.length) {
    container.appendChild(makeSpan('records-empty', 'Todavía no hay records'));
  } else {
    const list = document.createElement('ol');
    list.className = 'records-list';
    records.forEach((r, i) => {
      const row = document.createElement('li');
      row.className = i === highlight ? 'record-row record-new' : 'record-row';
      if (r.date) row.title = r.date;
      row.appendChild(makeSpan('record-pos', `${i + 1}.`));
      row.appendChild(makeSpan('record-name', r.name));
      row.appendChild(makeSpan('record-meta', `Nv${r.level} · ${r.lines}L`));
      row.appendChild(makeSpan('record-score', r.score.toLocaleString()));
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  // combo y líneas máximas se derivan de los propios records (null si no hay)
  const stats = document.createElement('div');
  stats.className = 'records-stats';
  stats.appendChild(makeStat('Mejor combo', bestOf('combo')));
  stats.appendChild(makeStat('Máx. líneas', bestOf('lines')));
  container.appendChild(stats);
}

function renderAllRecords(highlight) {
  renderRecords(startRecords, -1);
  renderRecords(overRecords, typeof highlight === 'number' ? highlight : -1);
}

// Guarda el record pendiente con el nombre escrito y resalta su fila.
function saveRecord() {
  if (!pendingRecord) return;
  const entry = pendingRecord;
  pendingRecord = null;
  entry.name = nameInput.value.trim().slice(0, MAX_NAME) || 'ANÓNIMO';
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  records = records.slice(0, MAX_RECORDS);
  saveRecords();
  nameForm.classList.add('hidden');
  renderAllRecords(records.indexOf(entry));
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records? Esta acción no se puede deshacer.')) return;
  records = [];
  saveRecords();
  // si había un record a la espera de nombre, el formulario sigue abierto:
  // la lista queda vacía, así que la puntuación entra igual
  renderAllRecords(-1);
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
    // cadena de jugadas consecutivas que limpian línea
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    // bonus a partir de la segunda limpieza consecutiva
    if (combo >= 2) score += 50 * combo * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    flashCombo();
  } else {
    // la pieza asienta sin limpiar nada: se rompe la cadena
    combo = 0;
  }
  updateHUD();
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
  comboEl.textContent = combo;
  // se destaca sólo cuando el combo ya otorga bonus
  comboEl.classList.toggle('combo-active', combo >= 2);
}

// reinicia la animación de rebote cada vez que sube el combo
function flashCombo() {
  comboEl.classList.remove('combo-hit');
  void comboEl.offsetWidth; // fuerza el reflow para relanzar la animación
  comboEl.classList.add('combo-hit');
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
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

  if (qualifies(score)) {
    pendingRecord = {
      name: '',
      score,
      lines,
      level,
      combo: bestCombo,
      date: new Date().toISOString().slice(0, 10),
    };
    nameInput.value = '';
    nameForm.classList.remove('hidden');
  } else {
    pendingRecord = null;
    nameForm.classList.add('hidden');
  }
  renderAllRecords(-1);
  overlay.classList.remove('hidden');
  if (pendingRecord) nameInput.focus();
}

/* ---- Menú de pausa ---- */

// Quita el foco del elemento activo: si un botón del menú se queda enfocado,
// al volver al juego la barra espaciadora (o Enter) lo volvería a activar.
function blurActive() {
  const el = document.activeElement;
  if (el && typeof el.blur === 'function') el.blur();
}

function menuOpen() {
  return !pauseMenu.classList.contains('hidden');
}

function showMenuMain() {
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
}

function showMenuControls() {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
}

function openPauseMenu() {
  showMenuMain(); // el menú siempre se abre en la vista principal
  startLevelSelect.value = String(startLevel);
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  blurActive();
}

function togglePause() {
  // único punto de salida: no hay pausa antes de empezar ni tras el Game Over
  if (!started || gameOver) return;
  paused = !paused;
  if (paused) {
    cancelAnimationFrame(animId);
    animId = null;
    openPauseMenu();
  } else {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime); // sincrónico, no vía rAF: primer dt === 0, la pieza no salta
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
  // si había un record pendiente de nombre, no se pierde al reiniciar
  if (pendingRecord) saveRecord();
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  started = true;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  combo = 0;
  bestCombo = 0;
  comboEl.classList.remove('combo-hit');
  next = randomPiece();
  spawn();
  updateHUD();
  nameForm.classList.add('hidden');
  overlay.classList.add('hidden');
  closePauseMenu();
  startOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// Estado previo a la partida: tablero vacío detrás de la pantalla de inicio.
// `current`/`next` siguen sin existir, así que no se puede llamar a draw().
function showStartScreen() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  started = false;
  pendingRecord = null;
  // updateHUD() lee combo: sin inicializar mostraría "undefined" en el panel
  combo = 0;
  bestCombo = 0;
  comboEl.classList.remove('combo-hit');
  updateHUD();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  renderAllRecords(-1);
  nameForm.classList.add('hidden');
  overlay.classList.add('hidden');
  startOverlay.classList.remove('hidden');
}

function startGame() {
  setStartLevel(parseInt(levelSelect.value, 10));
  init();
}

function fillLevelSelect() {
  for (const select of [levelSelect, startLevelSelect]) {
    for (let n = 1; n <= MAX_LEVEL; n++) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = String(n);
      select.appendChild(opt);
    }
  }
  syncLevelSelects();
}

themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'light';
gridColor = readThemeVar('--grid-line');
themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
  // sin frames en marcha (inicio, pausa o game over) hay que repintar a mano
  if (!started) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
  } else if (paused || gameOver) {
    draw();
  }
});

document.addEventListener('keydown', e => {
  // pantalla de inicio: no hay pieza actual todavía, solo Enter arranca
  // (el menú de pausa no puede estar abierto aquí, así que va primero)
  if (!started) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') startGame();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  // Menú abierto: se bloquean los inputs del juego. Space/Enter además se
  // anulan para que no activen ningún botón (y no lleguen al juego al volver).
  if (menuOpen()) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
    return;
  }
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

/* ---- Cableado de records ---- */

saveRecordBtn.addEventListener('click', saveRecord);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveRecord();
});
overResetBtn.addEventListener('click', resetRecords);
startResetBtn.addEventListener('click', resetRecords);

playBtn.addEventListener('click', startGame);

/* ---- Cableado del nivel inicial ---- */

// Hay dos selectores para el mismo ajuste (pantalla de inicio y menú de pausa);
// setStartLevel() los deja a ambos en el valor ya normalizado.
levelSelect.addEventListener('change', () => {
  setStartLevel(parseInt(levelSelect.value, 10));
  if (!started) {
    level = startLevel;
    updateHUD();
  }
});

startLevelSelect.addEventListener('change', () => {
  setStartLevel(parseInt(startLevelSelect.value, 10));
  blurActive();
});

/* ---- Cableado del menú de pausa ---- */

resumeBtn.addEventListener('click', () => {
  blurActive();
  if (paused) togglePause();
});

menuRestartBtn.addEventListener('click', init); // init() también cierra el menú

showControlsBtn.addEventListener('click', () => {
  showMenuControls();
  blurActive();
});

controlsBackBtn.addEventListener('click', () => {
  showMenuMain();
  blurActive();
});

records = loadRecords();
fillLevelSelect();
showStartScreen();
