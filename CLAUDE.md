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

Verification is manual in the browser: play a few pieces, clear a line, check SCORE/LINES/LEVEL update, hit `P` for pause and force a Game Over.

Controls: `←`/`→` move, `↑` or `X` rotate CW, `↓` soft drop, `Space` hard drop, `P` pause.

## Architecture (`game.js`)

Single global scope under `'use strict'`, no modules or classes. All state lives in one `let` declaration at the top (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`) and is reset by `init()`, which is also the restart handler. DOM nodes are looked up once at load time into module-level consts, so `game.js` must stay loaded after the markup (`<script>` at end of `<body>`).

Data model:
- `board` — `ROWS × COLS` array of ints; `0` = empty, `1–7` = piece type, which indexes both `PIECES` and every skin palette (`COLORS` for retro, `NEON_COLORS` for neon). Piece type doubles as the color key, so all of those arrays must stay index-aligned (each has a `null` at index 0).
- `current`/`next` — `{ type, shape, x, y }`. `shape` is a square matrix filled with the piece's own type number; rotation is a fresh matrix from `rotateCW` (transpose + row reverse), not an index into a rotation table.

Game loop: `loop(ts)` is a `requestAnimationFrame` chain accumulating `dt` into `dropAccum` and stepping down one row when it exceeds `dropInterval`. Pause/resume works by cancelling `animId` and re-entering `loop` with `lastTime` reset (skipping that gap so the piece doesn't jump). Rendering is a full redraw every frame: `drawGrid` → settled board → ghost (`SKINS[skin].ghostAlpha`) → current piece, all via the shared `drawBlock(context, x, y, colorIndex, size, alpha)` helper, which is reused for the NEXT preview canvas.

Skins: the `SKINS` table (`retro`, `neon`) holds the palette plus `glow` (canvas `shadowBlur` radius, `0` = flat blocks) and `ghostAlpha`; `drawBlock` branches on `glow`. Everything outside the canvas is CSS: `applySkin` sets `data-skin` on `<html>` and the `[data-skin="neon"]` block overrides the theme custom properties (it sits after `[data-theme="light"]` so it wins on source order). `applyTheme`/`applySkin` both re-read `--grid-line` and call `redraw()`, since the change must show while the loop is stopped (pause / game over). Neon disables the theme toggle — it replaces the whole palette. Selection persists in `localStorage` (`tetris-skin`) and is applied by the inline `<head>` script to avoid a flash.

Collision is the single gate for every movement: `collide(shape, ox, oy)` returns true on out-of-bounds or overlap, and callers check it before mutating `current`. `ny < 0` is deliberately allowed so a piece can straddle the top edge. `tryRotate` implements simplified wall kicks by retrying the rotated shape at x-offsets `[0, -1, 1, -2, 2]` — not SRS.

`clearLines` scans bottom-up, `splice`s full rows and `unshift`s empty ones, incrementing `r` to re-test the shifted row. It also owns level/speed progression: `level = floor(lines / 10) + 1`, `dropInterval = max(100, 1000 - (level - 1) * 90)`.

`lockPiece()` = `merge()` → `clearLines()` → `spawn()`; `spawn()` promotes `next` and calls `endGame()` if the new piece already collides.

## Gotchas

- Board dimensions are duplicated: `COLS`/`ROWS`/`BLOCK` in `game.js` and the hardcoded `width`/`height` on `<canvas id="board">` in `index.html` (must equal `COLS*BLOCK` × `ROWS*BLOCK`). `drawNext` also assumes a 4×4 preview at 30px, matching `#next-canvas` 120×120.
- `endGame()` can be reached from inside `loop` (via `lockPiece` → `spawn`), where its `cancelAnimationFrame(animId)` is a no-op — `animId` is the frame already executing. `loop` therefore guards on `gameOver`/`paused` both on entry and before re-scheduling, and `endGame()` is idempotent and calls `draw()` itself so the final board renders when the Game Over comes from the keydown path (`hardDrop`/`softDrop`), where the pending frame *is* really cancelled. Keep all three guards if you touch this path: dropping the re-schedule guard resurrects the bug where pieces keep spawning and merging on top of each other behind the (semi-transparent) overlay.
- `draw()` returns early after the board pass when `gameOver` is set: the piece `spawn()` produced is overlapping the stack, so neither it nor its ghost is drawn.
- Scoring is updated in several places (`clearLines`, `softDrop`, `hardDrop`, plus a blanket `updateHUD()` at the end of the `keydown` handler); there is no single mutation point.
