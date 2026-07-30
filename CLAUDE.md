# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris (HTML5 Canvas + CSS). Three source files, no dependencies, no `package.json`, no bundler, no transpiler, no tests. All UI text and comments are in Spanish — keep new user-facing strings in Spanish.

## Running

There is nothing to build or install. Open the page directly:

```powershell
start index.html
```

Or serve statically (any server works): `python -m http.server 8000`, `npx serve .`.

Verification is manual in the browser: press Jugar on the start screen, play a few pieces, clear a line, check SCORE/LINES/LEVEL update, hit `P` for pause and force a Game Over — then save a name into the top 5 and reload to confirm the table persists.

Controls: `←`/`→` move, `↑` or `X` rotate CW, `↓` soft drop, `Space` hard drop, `P` pause.

## Architecture (`game.js`)

Single global scope under `'use strict'`, no modules or classes. Per-game state lives in one `let` declaration at the top (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`) plus `combo, maxCombo`, and is reset by `resetState()`. `init()` = `resetState()` + start the loop, and is the handler for the single overlay button (both "Jugar" and "Reiniciar"). `started` is the fourth mode flag alongside `paused`/`gameOver`: false only on the start screen shown by `showStart()` at load, where there is no `current` piece and no `rAF` chain. DOM nodes are looked up once at load time into module-level consts, so `game.js` must stay loaded after the markup (`<script>` at end of `<body>`).

Data model:
- `board` — `ROWS × COLS` array of ints; `0` = empty, `1–7` = piece type, which indexes both `PIECES` and the active skin's palette. Piece type doubles as the color key, so every palette must stay index-aligned with `PIECES` (all have a `null` at index 0).
- `current`/`next` — `{ type, shape, x, y }`. `shape` is a square matrix filled with the piece's own type number; rotation is a fresh matrix from `rotateCW` (transpose + row reverse), not an index into a rotation table.

Game loop: `loop(ts)` is a `requestAnimationFrame` chain accumulating `dt` into `dropAccum` and stepping down one row when it exceeds `dropInterval`. Pause/resume works by cancelling `animId` and re-entering `loop` with `lastTime` reset (skipping that gap so the piece doesn't jump). Rendering is a full redraw every frame: `drawGrid` → settled board → ghost (`globalAlpha = 0.2`) → current piece, all via the shared `drawBlock(context, x, y, colorIndex, size, alpha)` helper, which is reused for the NEXT preview canvas.

Collision is the single gate for every movement: `collide(shape, ox, oy)` returns true on out-of-bounds or overlap, and callers check it before mutating `current`. `ny < 0` is deliberately allowed so a piece can straddle the top edge. `tryRotate` implements simplified wall kicks by retrying the rotated shape at x-offsets `[0, -1, 1, -2, 2]` — not SRS.

`clearLines` scans bottom-up, `splice`s full rows and `unshift`s empty ones, incrementing `r` to re-test the shifted row. It also owns level/speed progression: `level = floor(lines / 10) + 1`, `dropInterval = max(100, 1000 - (level - 1) * 90)`.

`lockPiece()` = `merge()` → `clearLines()` → `spawn()`; `spawn()` promotes `next` and calls `endGame()` if the new piece already collides. `clearLines()` returns the cleared count so `lockPiece` can drive `combo` — consecutive locks that cleared at least one line; anything else resets it to 0. A combo only "counts" from 2 up, which `comboText()` centralises (`x3`, or `—` below 2). Combos affect no scoring, only the HUD and the stored `bestCombo`.

Records live in `localStorage` under `tetris-records` as `{ top: [{name, score, lines}], bestCombo, maxLines }`, mirrored in the `records` object. `loadRecords()` is defensive (bad JSON or malformed rows → empty records) because the value is user-editable. The overlay is the only surface: `showStart()`, `endGame()` and `togglePause()` each fully configure title/subtitle/button label plus the visibility of `#records` and `#name-form`, so add any new mode by writing all of those, not by relying on leftovers. `renderRecords()` renders `records.top` with one row optionally marked `.is-new` — either `highlightIndex` (a just-saved record) or the un-saved `pending` candidate spliced in at its rank, which is what makes the name field update the table live.

Skins: `SKINS` maps a key (`retro`/`neon`/`pastel`/`pixel`) to `{ colors, draw }` — its own palette plus a `draw(context, px, py, size, color)` that paints one block at *pixel* origin. `drawBlock` is only the dispatcher: it resolves `skin.colors[colorIndex]`, sets/resets `globalAlpha`, and delegates. Any per-block canvas state a skin sets (`shadowBlur`, `lineWidth`, paths) must be reset inside that skin's own `draw` — `drawBlock` only manages alpha. Board background and grid line are *not* in JS: each skin overrides `--board-bg`/`--board-border`/`--grid-line` under `[data-skin="…"]` in `style.css` (after the theme blocks so it wins; `[data-theme="light"][data-skin="…"]` for per-theme variants), and `applySkin` re-reads `--grid-line`. Changing skin or theme never reloads — both call `repaint()`, which redraws board and NEXT immediately so the change is visible while paused, on the start screen or after Game Over.

## Gotchas

- Board dimensions are duplicated: `COLS`/`ROWS`/`BLOCK` in `game.js` and the hardcoded `width`/`height` on `<canvas id="board">` in `index.html` (must equal `COLS*BLOCK` × `ROWS*BLOCK`). `drawNext` also assumes a 4×4 preview at 30px, matching `#next-canvas` 120×120.
- `endGame()` can be reached from inside `loop` (via `lockPiece` → `spawn`), where its `cancelAnimationFrame(animId)` is a no-op — `animId` is the frame already executing. `loop` therefore guards on `gameOver`/`paused` both on entry and before re-scheduling, and `endGame()` is idempotent and calls `draw()` itself so the final board renders when the Game Over comes from the keydown path (`hardDrop`/`softDrop`), where the pending frame *is* really cancelled. Keep all three guards if you touch this path: dropping the re-schedule guard resurrects the bug where pieces keep spawning and merging on top of each other behind the (semi-transparent) overlay.
- `draw()` returns early after the board pass when `gameOver || !started`: at Game Over the piece `spawn()` produced is overlapping the stack, and on the start screen there is no `current` at all (`ghostY()` would throw). The same `!started` guard is in `loop` (entry and re-schedule), `togglePause` and the `keydown` handler.
- The `keydown` handler bails out when `e.target` is the name input, so typing a record name doesn't drive the game (`P` in particular would otherwise pause).
- A top-5 score left unsaved is not silently dropped: `init()` commits any `pending` candidate (as `ANÓNIMO` if the field is empty) before resetting, so "Reiniciar" can't lose a record.
- The inline `<script>` in `<head>` sets `data-theme` *and* `data-skin` from `localStorage` before the stylesheet paints, avoiding a flash of the wrong skin. `applySkin` normalises an unknown/absent key back to `DEFAULT_SKIN` and writes the attribute, so `#skin-select` can be initialised straight from `data-skin`. It runs at load, *before* `showStart()` builds the first board, so `repaint()` guards on `board` (nothing to paint yet) and on `started` (the NEXT preview is deliberately empty on the start screen).
- Scoring is updated in several places (`clearLines`, `softDrop`, `hardDrop`, plus a blanket `updateHUD()` at the end of the `keydown` handler); there is no single mutation point.
