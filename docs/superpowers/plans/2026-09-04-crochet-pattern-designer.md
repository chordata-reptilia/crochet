# Crochet Pattern Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop Electron app that lets a single local user design crochet grid patterns (classic and Corner-to-Corner modes), generate row-by-row instructions, and export PNG/PDF, with local `.json` project files.

**Architecture:** Electron app with a thin main process (window creation, native file dialogs, filesystem I/O, PDF generation) and a vanilla-JS/Canvas renderer. Core logic (grid, palette, project serialization, instruction generation) lives in plain, dependency-free JS modules under `src/` that work identically under Jest (Node) and in the browser renderer (loaded via `<script>` tags, UMD-style export) — no bundler needed. UI state (undo/redo history, active tool, active color) lives in `renderer/app.js` and is verified manually since the spec excludes automated UI tests.

**Tech Stack:** Electron, vanilla JS + HTML5 Canvas, pdfkit (PDF export, runs in main process), Jest (unit tests for `src/`), electron-builder (Windows installer packaging).

**Spec:** `docs/superpowers/specs/2026-09-04-crochet-pattern-designer-design.md`

## Global Constraints

- 100% local, single project open at a time, no accounts/cloud/server (spec: "Contexte et objectif").
- Project file format is the exact JSON schema in the spec's "Modèle de données" section: `{ name, mode, width, height, palette: [{id,name,hex}], cells: [[colorId|null,...],...] }`.
- `mode` is either `"classic"` or `"c2c"`; it only changes how instructions are generated/displayed, never how drawing works (spec: "Modes de motif").
- No automated end-to-end UI tests; UI tasks are verified by manually running the packaged/dev app (spec: "Tests").
- File/export errors must show a clear message to the user, never fail silently (spec: "Gestion des erreurs").

---

## File Structure

```
crochet/
  package.json
  main.js                    # Electron main process: window, IPC (dialogs, fs, PDF export)
  preload.js                 # contextBridge: exposes window.api to renderer
  renderer/
    index.html
    styles.css
    app.js                   # UI state, canvas rendering, event wiring
  src/
    grid.js                  # pure grid data model (create/get/set/resize/floodFill)
    palette.js                # pure color palette model
    project.js                # project create/serialize/deserialize
    instructions.js           # instruction generation (classic + c2c)
    export/
      pdf.js                  # Node-side PDF builder (used by main.js)
  tests/
    grid.test.js
    palette.test.js
    project.test.js
    instructions.test.js
  docs/superpowers/specs/2026-09-04-crochet-pattern-designer-design.md
  docs/superpowers/plans/2026-09-04-crochet-pattern-designer.md
  .gitignore
  README.md
```

`src/*.js` files use a dual-export pattern so the exact same file is `require()`-able from Jest and loadable via a plain (non-module) `<script>` tag in the renderer, where its top-level `function` declarations become globals:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { /* ... */ };
}
```

---

### Task 1: Project scaffolding & Electron shell

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `preload.js`
- Create: `renderer/index.html`
- Create: `renderer/styles.css`
- Create: `renderer/app.js`
- Create: `.gitignore`

**Interfaces:**
- Produces: a runnable `npm start` that opens a blank-shell window loading `renderer/index.html`. `preload.js` exposes an (initially empty) `window.api` object via `contextBridge`, which later tasks extend.

- [ ] **Step 1: Initialize npm project and install dependencies**

Run:
```bash
npm init -y
npm install --save-dev electron@latest electron-builder@latest jest@latest
npm install pdfkit@latest
```

- [ ] **Step 2: Write `package.json` scripts and build config**

Edit `package.json` to add/merge:
```json
{
  "name": "crochet-pattern-designer",
  "version": "1.0.0",
  "description": "Local Windows desktop app for designing crochet grid patterns",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "jest",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.crochetpatterndesigner.app",
    "productName": "Crochet Pattern Designer",
    "files": ["main.js", "preload.js", "renderer/**/*", "src/**/*", "package.json"],
    "win": {
      "target": "nsis"
    }
  }
}
```

- [ ] **Step 3: Write `main.js`**

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 4: Write `preload.js`**

```js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Extended in later tasks (project save/open, PNG/PDF export).
});
```

- [ ] **Step 5: Write `renderer/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Crochet Pattern Designer</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="app">
    <header id="toolbar"></header>
    <main id="workspace">
      <canvas id="grid-canvas"></canvas>
    </main>
    <aside id="side-panel"></aside>
  </div>

  <script src="../src/grid.js"></script>
  <script src="../src/palette.js"></script>
  <script src="../src/project.js"></script>
  <script src="../src/instructions.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 6: Write `renderer/styles.css`**

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: sans-serif; }
#app { display: flex; flex-direction: column; height: 100vh; }
#toolbar { padding: 8px; border-bottom: 1px solid #ccc; }
#workspace { flex: 1; display: flex; overflow: auto; }
#grid-canvas { image-rendering: pixelated; }
#side-panel { width: 280px; border-left: 1px solid #ccc; overflow-y: auto; padding: 8px; }
```

- [ ] **Step 7: Write minimal `renderer/app.js`**

```js
window.addEventListener('DOMContentLoaded', () => {
  console.log('Crochet Pattern Designer renderer loaded');
});
```

- [ ] **Step 8: Write `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 9: Manually verify the window opens**

Run: `npm start`
Expected: a window titled "Crochet Pattern Designer" opens, DevTools console (if opened manually via Ctrl+Shift+I) shows "Crochet Pattern Designer renderer loaded", no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json main.js preload.js renderer .gitignore
git commit -m "chore: scaffold Electron app shell"
```

---

### Task 2: Grid data model

**Files:**
- Create: `src/grid.js`
- Test: `tests/grid.test.js`

**Interfaces:**
- Produces:
  - `createGrid(width, height) -> { width, height, cells }` (cells is a `height`-row × `width`-col 2D array, all `null`)
  - `getCell(grid, x, y) -> colorId | null`
  - `setCell(grid, x, y, colorId) -> newGrid` (does not mutate `grid`)
  - `resizeGrid(grid, newWidth, newHeight) -> newGrid` (preserves overlapping cells, new cells are `null`)
  - `floodFill(grid, x, y, colorId) -> newGrid` (replaces the contiguous region of cells sharing `getCell(grid,x,y)`'s color, 4-directionally connected)

- [ ] **Step 1: Write failing tests**

Create `tests/grid.test.js`:
```js
const { createGrid, getCell, setCell, resizeGrid, floodFill } = require('../src/grid');

test('createGrid makes a width x height grid of null cells', () => {
  const grid = createGrid(3, 2);
  expect(grid.width).toBe(3);
  expect(grid.height).toBe(2);
  expect(grid.cells).toEqual([
    [null, null, null],
    [null, null, null],
  ]);
});

test('setCell returns a new grid with the cell updated, without mutating the original', () => {
  const grid = createGrid(2, 2);
  const updated = setCell(grid, 1, 0, 'c1');
  expect(getCell(updated, 1, 0)).toBe('c1');
  expect(getCell(grid, 1, 0)).toBeNull();
});

test('resizeGrid grows the grid and preserves existing cells', () => {
  let grid = createGrid(2, 2);
  grid = setCell(grid, 0, 0, 'c1');
  const resized = resizeGrid(grid, 3, 3);
  expect(resized.width).toBe(3);
  expect(resized.height).toBe(3);
  expect(getCell(resized, 0, 0)).toBe('c1');
  expect(getCell(resized, 2, 2)).toBeNull();
});

test('resizeGrid shrinking truncates cells outside the new bounds', () => {
  let grid = createGrid(3, 3);
  grid = setCell(grid, 2, 2, 'c1');
  const resized = resizeGrid(grid, 2, 2);
  expect(resized.cells.length).toBe(2);
  expect(resized.cells[0].length).toBe(2);
});

test('floodFill replaces a contiguous region of the same color', () => {
  let grid = createGrid(3, 1);
  grid = setCell(grid, 0, 0, 'c1');
  grid = setCell(grid, 1, 0, 'c1');
  grid = setCell(grid, 2, 0, 'c2');
  const filled = floodFill(grid, 0, 0, 'c3');
  expect(getCell(filled, 0, 0)).toBe('c3');
  expect(getCell(filled, 1, 0)).toBe('c3');
  expect(getCell(filled, 2, 0)).toBe('c2');
});

test('floodFill does not spread across non-contiguous regions of the same color', () => {
  let grid = createGrid(3, 1);
  grid = setCell(grid, 0, 0, 'c1');
  grid = setCell(grid, 1, 0, 'c2');
  grid = setCell(grid, 2, 0, 'c1');
  const filled = floodFill(grid, 0, 0, 'c3');
  expect(getCell(filled, 0, 0)).toBe('c3');
  expect(getCell(filled, 2, 0)).toBe('c1');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/grid.test.js`
Expected: FAIL — `Cannot find module '../src/grid'`.

- [ ] **Step 3: Implement `src/grid.js`**

```js
function createGrid(width, height) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    cells.push(new Array(width).fill(null));
  }
  return { width, height, cells };
}

function getCell(grid, x, y) {
  return grid.cells[y][x];
}

function cloneCells(cells) {
  return cells.map((row) => row.slice());
}

function setCell(grid, x, y, colorId) {
  const cells = cloneCells(grid.cells);
  cells[y][x] = colorId;
  return { width: grid.width, height: grid.height, cells };
}

function resizeGrid(grid, newWidth, newHeight) {
  const cells = [];
  for (let y = 0; y < newHeight; y++) {
    const row = new Array(newWidth).fill(null);
    if (y < grid.height) {
      for (let x = 0; x < Math.min(newWidth, grid.width); x++) {
        row[x] = grid.cells[y][x];
      }
    }
    cells.push(row);
  }
  return { width: newWidth, height: newHeight, cells };
}

function floodFill(grid, startX, startY, colorId) {
  const targetColor = getCell(grid, startX, startY);
  if (targetColor === colorId) {
    return { width: grid.width, height: grid.height, cells: cloneCells(grid.cells) };
  }

  const cells = cloneCells(grid.cells);
  const stack = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) continue;
    if (cells[y][x] !== targetColor) continue;

    cells[y][x] = colorId;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { width: grid.width, height: grid.height, cells };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGrid, getCell, setCell, resizeGrid, floodFill };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/grid.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/grid.js tests/grid.test.js
git commit -m "feat: add pure grid data model"
```

---

### Task 3: Color palette model

**Files:**
- Create: `src/palette.js`
- Test: `tests/palette.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `createPalette() -> []`
  - `addColor(palette, hex, name = '') -> newPalette` (new color is appended last; its `id` is generated internally, read via `newPalette[newPalette.length - 1].id`)
  - `removeColor(palette, id) -> newPalette`
  - `renameColor(palette, id, newName) -> newPalette`
  - `findColor(palette, id) -> { id, name, hex } | undefined`
  - Color shape: `{ id: string, name: string, hex: string }`

- [ ] **Step 1: Write failing tests**

Create `tests/palette.test.js`:
```js
const { createPalette, addColor, removeColor, renameColor, findColor } = require('../src/palette');

test('createPalette starts empty', () => {
  expect(createPalette()).toEqual([]);
});

test('addColor appends a color with a generated id', () => {
  const palette = addColor(createPalette(), '#87CEEB', 'Bleu ciel');
  expect(palette).toHaveLength(1);
  expect(palette[0].hex).toBe('#87CEEB');
  expect(palette[0].name).toBe('Bleu ciel');
  expect(typeof palette[0].id).toBe('string');
  expect(palette[0].id.length).toBeGreaterThan(0);
});

test('addColor defaults name to empty string', () => {
  const palette = addColor(createPalette(), '#FFFFFF');
  expect(palette[0].name).toBe('');
});

test('two added colors get different ids', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111');
  palette = addColor(palette, '#222222');
  expect(palette[0].id).not.toBe(palette[1].id);
});

test('removeColor removes only the matching color', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111', 'A');
  palette = addColor(palette, '#222222', 'B');
  const idToRemove = palette[0].id;
  const result = removeColor(palette, idToRemove);
  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('B');
});

test('renameColor updates only the name of the matching color', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111', 'A');
  const id = palette[0].id;
  const result = renameColor(palette, id, 'A renamed');
  expect(result[0].name).toBe('A renamed');
  expect(result[0].hex).toBe('#111111');
});

test('findColor returns the matching color or undefined', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111', 'A');
  const id = palette[0].id;
  expect(findColor(palette, id).name).toBe('A');
  expect(findColor(palette, 'nope')).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/palette.test.js`
Expected: FAIL — `Cannot find module '../src/palette'`.

- [ ] **Step 3: Implement `src/palette.js`**

```js
function generateColorId() {
  return 'c' + Math.random().toString(36).slice(2, 9);
}

function createPalette() {
  return [];
}

function addColor(palette, hex, name = '') {
  return [...palette, { id: generateColorId(), name, hex }];
}

function removeColor(palette, id) {
  return palette.filter((color) => color.id !== id);
}

function renameColor(palette, id, newName) {
  return palette.map((color) => (color.id === id ? { ...color, name: newName } : color));
}

function findColor(palette, id) {
  return palette.find((color) => color.id === id);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPalette, addColor, removeColor, renameColor, findColor };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/palette.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/palette.js tests/palette.test.js
git commit -m "feat: add pure color palette model"
```

---

### Task 4: Project model (create, serialize, deserialize)

**Files:**
- Create: `src/project.js`
- Test: `tests/project.test.js`

**Interfaces:**
- Consumes: `createGrid` from `src/grid.js`, `createPalette` from `src/palette.js`.
- Produces:
  - `createProject({ name, mode, width, height }) -> project` where `project = { name, mode, width, height, palette, cells }` (matches the spec's JSON schema exactly — `cells` here, not nested inside a `grid` key)
  - `serializeProject(project) -> jsonString`
  - `deserializeProject(jsonString) -> project` — throws `Error` with a descriptive message if the JSON is invalid, missing required fields, or has the wrong shape/types.

- [ ] **Step 1: Write failing tests**

Create `tests/project.test.js`:
```js
const { createProject, serializeProject, deserializeProject } = require('../src/project');

test('createProject builds a project matching the spec schema', () => {
  const project = createProject({ name: 'Mon motif', mode: 'classic', width: 4, height: 3 });
  expect(project.name).toBe('Mon motif');
  expect(project.mode).toBe('classic');
  expect(project.width).toBe(4);
  expect(project.height).toBe(3);
  expect(project.palette).toEqual([]);
  expect(project.cells).toHaveLength(3);
  expect(project.cells[0]).toHaveLength(4);
  expect(project.cells[0][0]).toBeNull();
});

test('serializeProject then deserializeProject round-trips exactly', () => {
  const project = createProject({ name: 'Mon motif', mode: 'c2c', width: 2, height: 2 });
  project.palette.push({ id: 'c1', name: 'Bleu', hex: '#0000FF' });
  project.cells[0][0] = 'c1';

  const json = serializeProject(project);
  const restored = deserializeProject(json);

  expect(restored).toEqual(project);
});

test('deserializeProject rejects invalid JSON', () => {
  expect(() => deserializeProject('not json')).toThrow(/invalid|parse/i);
});

test('deserializeProject rejects a JSON object missing required fields', () => {
  expect(() => deserializeProject(JSON.stringify({ name: 'x' }))).toThrow(/mode|width|height|palette|cells/i);
});

test('deserializeProject rejects an unknown mode', () => {
  const bad = JSON.stringify({ name: 'x', mode: 'weird', width: 1, height: 1, palette: [], cells: [[null]] });
  expect(() => deserializeProject(bad)).toThrow(/mode/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/project.test.js`
Expected: FAIL — `Cannot find module '../src/project'`.

- [ ] **Step 3: Implement `src/project.js`**

```js
const { createGrid } = require('./grid');
const { createPalette } = require('./palette');

function createProject({ name, mode, width, height }) {
  const grid = createGrid(width, height);
  return {
    name,
    mode,
    width,
    height,
    palette: createPalette(),
    cells: grid.cells,
  };
}

function serializeProject(project) {
  return JSON.stringify({
    name: project.name,
    mode: project.mode,
    width: project.width,
    height: project.height,
    palette: project.palette,
    cells: project.cells,
  });
}

function deserializeProject(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Fichier projet invalide : impossible de parser le JSON.');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Fichier projet invalide : contenu inattendu.');
  }
  if (typeof data.name !== 'string') {
    throw new Error('Fichier projet invalide : champ "name" manquant ou incorrect.');
  }
  if (data.mode !== 'classic' && data.mode !== 'c2c') {
    throw new Error('Fichier projet invalide : champ "mode" doit être "classic" ou "c2c".');
  }
  if (!Number.isInteger(data.width) || data.width <= 0) {
    throw new Error('Fichier projet invalide : champ "width" manquant ou incorrect.');
  }
  if (!Number.isInteger(data.height) || data.height <= 0) {
    throw new Error('Fichier projet invalide : champ "height" manquant ou incorrect.');
  }
  if (!Array.isArray(data.palette)) {
    throw new Error('Fichier projet invalide : champ "palette" manquant ou incorrect.');
  }
  if (!Array.isArray(data.cells) || data.cells.length !== data.height) {
    throw new Error('Fichier projet invalide : champ "cells" manquant ou incorrect.');
  }

  return {
    name: data.name,
    mode: data.mode,
    width: data.width,
    height: data.height,
    palette: data.palette,
    cells: data.cells,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createProject, serializeProject, deserializeProject };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/project.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/project.js tests/project.test.js
git commit -m "feat: add project create/serialize/deserialize"
```

---

### Task 5: Instruction generator — classic mode

**Files:**
- Create: `src/instructions.js`
- Test: `tests/instructions.test.js`

**Interfaces:**
- Consumes: `findColor` from `src/palette.js`; a `project` shaped as produced by `src/project.js` (`{ name, mode, width, height, palette, cells }`).
- Produces:
  - `generateInstructions(project) -> string[]` — dispatches on `project.mode` (only `"classic"` wired in this task; `"c2c"` added in Task 6).
  - `generateClassicInstructions(project) -> string[]` — one string per row, e.g. `"Rang 1 : 3 mailles Bleu ciel, 2 mailles (vide)"`.

- [ ] **Step 1: Write failing tests**

Create `tests/instructions.test.js`:
```js
const { generateInstructions, generateClassicInstructions } = require('../src/instructions');

function projectWithCells(cells, palette) {
  return {
    name: 'Test',
    mode: 'classic',
    width: cells[0].length,
    height: cells.length,
    palette,
    cells,
  };
}

test('generateClassicInstructions groups consecutive same-color runs per row', () => {
  const palette = [
    { id: 'c1', name: 'Bleu ciel', hex: '#87CEEB' },
    { id: 'c2', name: 'Blanc', hex: '#FFFFFF' },
  ];
  const project = projectWithCells([['c1', 'c1', 'c2']], palette);
  const lines = generateClassicInstructions(project);
  expect(lines).toEqual(['Rang 1 : 2 mailles Bleu ciel, 1 maille Blanc']);
});

test('generateClassicInstructions labels null cells as (vide)', () => {
  const palette = [{ id: 'c1', name: 'Bleu ciel', hex: '#87CEEB' }];
  const project = projectWithCells([['c1', null, null]], palette);
  const lines = generateClassicInstructions(project);
  expect(lines).toEqual(['Rang 1 : 1 maille Bleu ciel, 2 mailles (vide)']);
});

test('generateClassicInstructions produces one line per row, top to bottom', () => {
  const palette = [{ id: 'c1', name: 'A', hex: '#000000' }];
  const project = projectWithCells([['c1'], ['c1']], palette);
  const lines = generateClassicInstructions(project);
  expect(lines).toEqual(['Rang 1 : 1 maille A', 'Rang 2 : 1 maille A']);
});

test('generateClassicInstructions falls back to the color hex if name is empty', () => {
  const palette = [{ id: 'c1', name: '', hex: '#123456' }];
  const project = projectWithCells([['c1']], palette);
  expect(generateClassicInstructions(project)).toEqual(['Rang 1 : 1 maille #123456']);
});

test('generateInstructions dispatches to classic mode', () => {
  const palette = [{ id: 'c1', name: 'A', hex: '#000000' }];
  const project = projectWithCells([['c1']], palette);
  expect(generateInstructions(project)).toEqual(['Rang 1 : 1 maille A']);
});

test('generateInstructions throws on an unknown mode', () => {
  const project = projectWithCells([['c1']], []);
  project.mode = 'weird';
  expect(() => generateInstructions(project)).toThrow(/mode/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/instructions.test.js`
Expected: FAIL — `Cannot find module '../src/instructions'`.

- [ ] **Step 3: Implement `src/instructions.js`**

```js
function colorLabel(palette, colorId) {
  if (colorId === null) return '(vide)';
  const color = palette.find((c) => c.id === colorId);
  if (!color) return 'Couleur inconnue';
  return color.name && color.name.trim() !== '' ? color.name : color.hex;
}

function stitchWord(count) {
  return count === 1 ? 'maille' : 'mailles';
}

function groupRun(rowIds, palette) {
  const parts = [];
  let i = 0;
  while (i < rowIds.length) {
    const colorId = rowIds[i];
    let count = 1;
    while (i + count < rowIds.length && rowIds[i + count] === colorId) count++;
    parts.push(`${count} ${stitchWord(count)} ${colorLabel(palette, colorId)}`);
    i += count;
  }
  return parts.join(', ');
}

function generateClassicInstructions(project) {
  return project.cells.map((row, index) => `Rang ${index + 1} : ${groupRun(row, project.palette)}`);
}

function generateInstructions(project) {
  if (project.mode === 'classic') return generateClassicInstructions(project);
  throw new Error(`Mode d'instructions inconnu : ${project.mode}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateInstructions, generateClassicInstructions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/instructions.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/instructions.js tests/instructions.test.js
git commit -m "feat: add classic-mode instruction generator"
```

---

### Task 6: Instruction generator — C2C mode

**Files:**
- Modify: `src/instructions.js`
- Test: `tests/instructions.test.js`

**Interfaces:**
- Produces (added): `generateC2CInstructions(project) -> string[]` — one string per diagonal block, from the corner outward. Diagonal `d` (0-indexed) contains cells where `x + y === d`, listed in increasing `x` order, grouped into runs the same way as classic mode. `generateInstructions` now also dispatches `"c2c"` to this function.

- [ ] **Step 1: Write failing tests**

Append to `tests/instructions.test.js`:
```js
const { generateC2CInstructions } = require('../src/instructions');

test('generateC2CInstructions walks diagonals from the corner outward', () => {
  const palette = [{ id: 'c1', name: 'A', hex: '#000000' }];
  const cells = [
    ['c1', 'c1'],
    ['c1', 'c1'],
  ];
  const project = { name: 'T', mode: 'c2c', width: 2, height: 2, palette, cells };
  const lines = generateC2CInstructions(project);
  // Diagonal 0: (0,0). Diagonal 1: (1,0),(0,1). Diagonal 2: (1,1).
  expect(lines).toEqual([
    'Bloc 1 : 1 maille A',
    'Bloc 2 : 2 mailles A',
    'Bloc 3 : 1 maille A',
  ]);
});

test('generateC2CInstructions groups colors within a diagonal', () => {
  const palette = [
    { id: 'c1', name: 'A', hex: '#000000' },
    { id: 'c2', name: 'B', hex: '#FFFFFF' },
  ];
  const cells = [
    ['c1', 'c2'],
    ['c2', 'c1'],
  ];
  const project = { name: 'T', mode: 'c2c', width: 2, height: 2, palette, cells };
  const lines = generateC2CInstructions(project);
  expect(lines[1]).toBe('Bloc 2 : 2 mailles B');
});

test('generateInstructions dispatches to c2c mode', () => {
  const palette = [{ id: 'c1', name: 'A', hex: '#000000' }];
  const project = { name: 'T', mode: 'c2c', width: 1, height: 1, palette, cells: [['c1']] };
  expect(generateInstructions(project)).toEqual(['Bloc 1 : 1 maille A']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/instructions.test.js`
Expected: FAIL — `generateC2CInstructions is not a function`, and the c2c dispatch test fails with the "Mode d'instructions inconnu" error.

- [ ] **Step 3: Implement C2C generation in `src/instructions.js`**

Add above the `module.exports` block, and update `generateInstructions`:
```js
function generateC2CInstructions(project) {
  const { width, height, cells, palette } = project;
  const lines = [];
  const maxDiagonal = width + height - 2;

  for (let d = 0; d <= maxDiagonal; d++) {
    const runIds = [];
    const xStart = Math.max(0, d - height + 1);
    const xEnd = Math.min(d, width - 1);
    for (let x = xStart; x <= xEnd; x++) {
      const y = d - x;
      runIds.push(cells[y][x]);
    }
    lines.push(`Bloc ${d + 1} : ${groupRun(runIds, palette)}`);
  }

  return lines;
}
```

Update `generateInstructions`:
```js
function generateInstructions(project) {
  if (project.mode === 'classic') return generateClassicInstructions(project);
  if (project.mode === 'c2c') return generateC2CInstructions(project);
  throw new Error(`Mode d'instructions inconnu : ${project.mode}`);
}
```

Update the export block:
```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateInstructions, generateClassicInstructions, generateC2CInstructions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/instructions.test.js`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/instructions.js tests/instructions.test.js
git commit -m "feat: add C2C-mode instruction generator"
```

---

### Task 7: Canvas grid renderer + drawing tools

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `createGrid`, `getCell`, `setCell`, `floodFill` (globals from `src/grid.js`, loaded via `<script>`).
- Produces: a renderer-global `AppState` object holding `{ grid, cellSize, activeTool, activeColorId }`, and a `renderGrid()` function, both used by later UI tasks (palette panel, instructions panel, undo/redo).

- [ ] **Step 1: Add toolbar markup to `renderer/index.html`**

Replace the `<header id="toolbar"></header>` line with:
```html
<header id="toolbar">
  <button id="tool-brush" class="tool-btn active" data-tool="brush">Pinceau</button>
  <button id="tool-bucket" class="tool-btn" data-tool="bucket">Seau</button>
  <button id="tool-eraser" class="tool-btn" data-tool="eraser">Gomme</button>
  <button id="tool-eyedropper" class="tool-btn" data-tool="eyedropper">Pipette</button>
  <span class="toolbar-sep"></span>
  <button id="zoom-in">Zoom +</button>
  <button id="zoom-out">Zoom -</button>
</header>
```

- [ ] **Step 2: Add toolbar/canvas styles to `renderer/styles.css`**

Append:
```css
.tool-btn { margin-right: 4px; }
.tool-btn.active { font-weight: bold; outline: 2px solid #333; }
.toolbar-sep { display: inline-block; width: 16px; }
#workspace { cursor: crosshair; }
```

- [ ] **Step 3: Implement grid state and rendering in `renderer/app.js`**

Replace the file contents:
```js
const AppState = {
  grid: createGrid(20, 20),
  cellSize: 24,
  zoom: 1,
  activeTool: 'brush',
  activeColorId: null,
};

const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');

function renderGrid() {
  const { grid, cellSize, zoom } = AppState;
  const size = cellSize * zoom;
  canvas.width = grid.width * size;
  canvas.height = grid.height * size;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const colorId = getCell(grid, x, y);
      const color = colorId ? findColor(AppState.palette || [], colorId) : null;
      ctx.fillStyle = color ? color.hex : '#ffffff';
      ctx.fillRect(x * size, y * size, size, size);
      ctx.strokeStyle = '#ddd';
      ctx.strokeRect(x * size, y * size, size, size);
    }
  }
}

function canvasEventToCell(evt) {
  const rect = canvas.getBoundingClientRect();
  const size = AppState.cellSize * AppState.zoom;
  const x = Math.floor((evt.clientX - rect.left) / size);
  const y = Math.floor((evt.clientY - rect.top) / size);
  return { x, y };
}

function applyToolAt(x, y) {
  const { grid, activeTool, activeColorId } = AppState;
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;

  if (activeTool === 'brush') {
    AppState.grid = setCell(grid, x, y, activeColorId);
  } else if (activeTool === 'eraser') {
    AppState.grid = setCell(grid, x, y, null);
  } else if (activeTool === 'bucket') {
    AppState.grid = floodFill(grid, x, y, activeColorId);
  } else if (activeTool === 'eyedropper') {
    AppState.activeColorId = getCell(grid, x, y);
  }

  renderGrid();
}

let isPointerDown = false;

canvas.addEventListener('pointerdown', (evt) => {
  isPointerDown = true;
  const { x, y } = canvasEventToCell(evt);
  applyToolAt(x, y);
});

canvas.addEventListener('pointermove', (evt) => {
  if (!isPointerDown) return;
  if (AppState.activeTool !== 'brush' && AppState.activeTool !== 'eraser') return;
  const { x, y } = canvasEventToCell(evt);
  applyToolAt(x, y);
});

window.addEventListener('pointerup', () => {
  isPointerDown = false;
});

document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    AppState.activeTool = btn.dataset.tool;
  });
});

document.getElementById('zoom-in').addEventListener('click', () => {
  AppState.zoom = Math.min(AppState.zoom + 0.25, 3);
  renderGrid();
});

document.getElementById('zoom-out').addEventListener('click', () => {
  AppState.zoom = Math.max(AppState.zoom - 0.25, 0.25);
  renderGrid();
});

window.addEventListener('DOMContentLoaded', () => {
  renderGrid();
});
```

- [ ] **Step 4: Manually verify drawing tools**

Run: `npm start`
Expected:
- A 20×20 white grid renders.
- With "Pinceau" active and `AppState.activeColorId` set via DevTools console (e.g. `AppState.palette = [{id:'c1',name:'A',hex:'#ff0000'}]; AppState.activeColorId = 'c1';`), clicking and dragging paints red cells.
- "Seau" fills the contiguous white region when clicked.
- "Gomme" clears a cell back to white.
- "Pipette" on a painted cell sets `AppState.activeColorId` to that cell's color (verify via DevTools console).
- Zoom +/- resizes the grid cells.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/app.js renderer/styles.css
git commit -m "feat: add canvas grid renderer and drawing tools"
```

---

### Task 8: Undo/redo for grid edits

**Files:**
- Modify: `renderer/app.js`
- Modify: `renderer/index.html`
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `AppState.grid`, `renderGrid()`, `applyToolAt()` from Task 7.
- Produces: `pushHistory()`, `undo()`, `redo()` — history is a simple array of grid snapshots (grids are already immutable per-edit from Task 7, so snapshots are cheap references).

- [ ] **Step 1: Add undo/redo buttons to `renderer/index.html`**

Insert into `#toolbar`, right after the `toolbar-sep` span:
```html
<button id="undo-btn">Annuler</button>
<button id="redo-btn">Rétablir</button>
```

- [ ] **Step 2: Implement history in `renderer/app.js`**

Add near the top, after `AppState` is defined:
```js
const History = {
  stack: [AppState.grid],
  index: 0,
};

function pushHistory(grid) {
  History.stack = History.stack.slice(0, History.index + 1);
  History.stack.push(grid);
  History.index = History.stack.length - 1;
}

function undo() {
  if (History.index === 0) return;
  History.index -= 1;
  AppState.grid = History.stack[History.index];
  renderGrid();
}

function redo() {
  if (History.index === History.stack.length - 1) return;
  History.index += 1;
  AppState.grid = History.stack[History.index];
  renderGrid();
}

document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);
```

Modify `applyToolAt` to record history only when the grid actually changes (append at the end of the function body, replacing the trailing `renderGrid();` call):
```js
function applyToolAt(x, y) {
  const { grid, activeTool, activeColorId } = AppState;
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;

  let nextGrid = grid;
  if (activeTool === 'brush') {
    nextGrid = setCell(grid, x, y, activeColorId);
  } else if (activeTool === 'eraser') {
    nextGrid = setCell(grid, x, y, null);
  } else if (activeTool === 'bucket') {
    nextGrid = floodFill(grid, x, y, activeColorId);
  } else if (activeTool === 'eyedropper') {
    AppState.activeColorId = getCell(grid, x, y);
    renderGrid();
    return;
  }

  if (nextGrid !== grid) {
    AppState.grid = nextGrid;
    pushHistory(nextGrid);
  }
  renderGrid();
}
```

- [ ] **Step 3: Manually verify undo/redo**

Run: `npm start`
Expected: paint a few cells, click "Annuler" repeatedly to step back to blank, click "Rétablir" to step forward again; painting after an undo discards the redo branch (clicking "Rétablir" after a new paint does nothing).

- [ ] **Step 4: Commit**

```bash
git add renderer/app.js renderer/index.html
git commit -m "feat: add undo/redo for grid edits"
```

---

### Task 9: Palette panel UI

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `addColor`, `removeColor`, `renameColor` (globals from `src/palette.js`); `AppState`, `renderGrid()` from Task 7/8.
- Produces: `AppState.palette` (array, initialized to `[]` in this task — referenced already by `renderGrid()` since Task 7), `renderPalette()` function, keeps `AppState.activeColorId` in sync with the selected swatch.

- [ ] **Step 1: Add palette panel markup to `renderer/index.html`**

Replace `<aside id="side-panel"></aside>` with:
```html
<aside id="side-panel">
  <section id="palette-panel">
    <h3>Couleurs</h3>
    <div id="color-list"></div>
    <input type="color" id="new-color-picker" value="#ff0000" />
    <button id="add-color-btn">Ajouter</button>
  </section>
</aside>
```

- [ ] **Step 2: Add palette styles to `renderer/styles.css`**

Append:
```css
.swatch-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding: 4px; border-radius: 4px; }
.swatch-row.active { background: #eee; }
.swatch { width: 20px; height: 20px; border: 1px solid #999; flex-shrink: 0; cursor: pointer; }
.swatch-name { flex: 1; border: none; background: transparent; }
.swatch-remove { cursor: pointer; }
```

- [ ] **Step 3: Implement palette UI in `renderer/app.js`**

Add `palette: []` to the `AppState` object literal (alongside `grid`, `cellSize`, etc.):
```js
const AppState = {
  grid: createGrid(20, 20),
  palette: [],
  cellSize: 24,
  zoom: 1,
  activeTool: 'brush',
  activeColorId: null,
};
```

Append at the end of the file:
```js
const colorListEl = document.getElementById('color-list');

function renderPalette() {
  colorListEl.innerHTML = '';
  AppState.palette.forEach((color) => {
    const row = document.createElement('div');
    row.className = 'swatch-row' + (color.id === AppState.activeColorId ? ' active' : '');

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = color.hex;
    swatch.addEventListener('click', () => {
      AppState.activeColorId = color.id;
      renderPalette();
    });

    const nameInput = document.createElement('input');
    nameInput.className = 'swatch-name';
    nameInput.value = color.name;
    nameInput.addEventListener('change', () => {
      AppState.palette = renameColor(AppState.palette, color.id, nameInput.value);
      renderPalette();
    });

    const removeBtn = document.createElement('span');
    removeBtn.className = 'swatch-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      AppState.palette = removeColor(AppState.palette, color.id);
      if (AppState.activeColorId === color.id) AppState.activeColorId = null;
      renderPalette();
    });

    row.appendChild(swatch);
    row.appendChild(nameInput);
    row.appendChild(removeBtn);
    colorListEl.appendChild(row);
  });
}

document.getElementById('add-color-btn').addEventListener('click', () => {
  const hex = document.getElementById('new-color-picker').value;
  AppState.palette = addColor(AppState.palette, hex, '');
  AppState.activeColorId = AppState.palette[AppState.palette.length - 1].id;
  renderPalette();
});
```

Update the `DOMContentLoaded` handler to also render the palette:
```js
window.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  renderPalette();
});
```

- [ ] **Step 4: Manually verify the palette panel**

Run: `npm start`
Expected: clicking "Ajouter" adds a swatch row with the picked color; clicking a swatch highlights it and sets it as the active paint color (paint with "Pinceau" to confirm); editing the name field updates the label; clicking "✕" removes the color from the list.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/app.js renderer/styles.css
git commit -m "feat: add color palette panel UI"
```

---

### Task 10: Mode selector + live instructions panel

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `generateInstructions` (global from `src/instructions.js`); `AppState.grid`, `AppState.palette` from earlier tasks.
- Produces: `AppState.mode` (`"classic" | "c2c"`, default `"classic"`), `renderInstructions()`, called after every grid/palette mutation.

- [ ] **Step 1: Add mode selector and instructions panel markup to `renderer/index.html`**

Insert inside `#side-panel`, after the `</section>` closing `#palette-panel`:
```html
<section id="mode-panel">
  <h3>Mode</h3>
  <select id="mode-select">
    <option value="classic">Grille classique</option>
    <option value="c2c">Corner-to-Corner (C2C)</option>
  </select>
</section>
<section id="instructions-panel">
  <h3>Instructions</h3>
  <ol id="instructions-list"></ol>
</section>
```

- [ ] **Step 2: Add instructions panel styles to `renderer/styles.css`**

Append:
```css
#instructions-list { font-size: 13px; padding-left: 20px; }
#instructions-list li { margin-bottom: 2px; }
```

- [ ] **Step 3: Implement mode + instructions rendering in `renderer/app.js`**

Add `mode: 'classic'` to the `AppState` object literal:
```js
const AppState = {
  grid: createGrid(20, 20),
  palette: [],
  mode: 'classic',
  cellSize: 24,
  zoom: 1,
  activeTool: 'brush',
  activeColorId: null,
};
```

Append at the end of the file:
```js
const instructionsListEl = document.getElementById('instructions-list');

function renderInstructions() {
  const project = {
    name: '',
    mode: AppState.mode,
    width: AppState.grid.width,
    height: AppState.grid.height,
    palette: AppState.palette,
    cells: AppState.grid.cells,
  };
  const lines = generateInstructions(project);
  instructionsListEl.innerHTML = '';
  lines.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    instructionsListEl.appendChild(li);
  });
}

document.getElementById('mode-select').addEventListener('change', (evt) => {
  AppState.mode = evt.target.value;
  renderInstructions();
});
```

Call `renderInstructions()` everywhere the grid or palette changes: at the end of `applyToolAt` (after `renderGrid();`), in `undo`/`redo` (after `renderGrid();`), and in the palette panel's `renderPalette` callers (`add-color-btn` click handler, swatch remove handler, swatch rename `change` handler — each already calls `renderPalette()`; add `renderInstructions();` immediately after each of those calls). Also add it to the initial `DOMContentLoaded` handler:
```js
window.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  renderPalette();
  renderInstructions();
});
```

- [ ] **Step 4: Manually verify live instructions**

Run: `npm start`
Expected: painting cells updates the "Instructions" panel immediately with `Rang N : ...` lines; switching the mode dropdown to "Corner-to-Corner" re-renders the same data as `Bloc N : ...` lines; undo/redo also updates the panel.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/app.js renderer/styles.css
git commit -m "feat: add mode selector and live instructions panel"
```

---

### Task 11: Project file management (New/Open/Save/Save As)

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: `serializeProject`, `deserializeProject` (globals from `src/project.js`, renderer side); `dialog`, `fs.promises` (main process side).
- Produces (`window.api`, exposed by `preload.js`):
  - `api.saveProjectAs(jsonString) -> Promise<{ success: true, path: string } | { success: false, canceled: true } | { success: false, error: string }>`
  - `api.openProject() -> Promise<{ success: true, path: string, contents: string } | { success: false, canceled: true } | { success: false, error: string }>`

- [ ] **Step 1: Add IPC handlers to `main.js`**

Add near the top, after the existing `require`s:
```js
const { ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
```

Add before `app.whenReady().then(createWindow);`:
```js
ipcMain.handle('project:saveAs', async (_event, jsonString) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Projet Crochet', extensions: ['json'] }],
    defaultPath: 'motif.json',
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  try {
    await fs.writeFile(result.filePath, jsonString, 'utf-8');
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Projet Crochet', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  try {
    const contents = await fs.readFile(result.filePaths[0], 'utf-8');
    return { success: true, path: result.filePaths[0], contents };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Expose the API in `preload.js`**

Replace the file contents:
```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveProjectAs: (jsonString) => ipcRenderer.invoke('project:saveAs', jsonString),
  openProject: () => ipcRenderer.invoke('project:open'),
});
```

- [ ] **Step 3: Add New/Open/Save buttons to `renderer/index.html`**

Insert into `#toolbar`, as the first children (before `#tool-brush`):
```html
<button id="new-project-btn">Nouveau</button>
<button id="open-project-btn">Ouvrir</button>
<button id="save-project-btn">Enregistrer</button>
```

- [ ] **Step 4: Wire project management in `renderer/app.js`**

Append at the end of the file:
```js
function loadProjectIntoState(project) {
  AppState.grid = { width: project.width, height: project.height, cells: project.cells };
  AppState.palette = project.palette;
  AppState.mode = project.mode;
  AppState.activeColorId = null;
  History.stack = [AppState.grid];
  History.index = 0;
  document.getElementById('mode-select').value = project.mode;
  renderGrid();
  renderPalette();
  renderInstructions();
}

document.getElementById('new-project-btn').addEventListener('click', () => {
  const project = createProject({ name: 'Nouveau motif', mode: 'classic', width: 20, height: 20 });
  loadProjectIntoState(project);
});

document.getElementById('save-project-btn').addEventListener('click', async () => {
  const project = {
    name: 'Motif',
    mode: AppState.mode,
    width: AppState.grid.width,
    height: AppState.grid.height,
    palette: AppState.palette,
    cells: AppState.grid.cells,
  };
  const json = serializeProject(project);
  const result = await window.api.saveProjectAs(json);
  if (!result.success && !result.canceled) {
    alert(`Erreur lors de l'enregistrement : ${result.error}`);
  }
});

document.getElementById('open-project-btn').addEventListener('click', async () => {
  const result = await window.api.openProject();
  if (!result.success) {
    if (!result.canceled) alert(`Erreur lors de l'ouverture : ${result.error}`);
    return;
  }
  try {
    const project = deserializeProject(result.contents);
    loadProjectIntoState(project);
  } catch (err) {
    alert(`Fichier projet invalide : ${err.message}`);
  }
});
```

- [ ] **Step 5: Manually verify project file management**

Run: `npm start`
Expected: "Nouveau" resets to a blank 20×20 classic-mode grid; paint some cells, add colors, click "Enregistrer", save to a `.json` file, confirm the file's content matches the spec schema; click "Ouvrir" on that file and confirm the grid/palette/mode restore exactly; opening a corrupted/non-JSON file shows an alert instead of crashing.

- [ ] **Step 6: Commit**

```bash
git add main.js preload.js renderer/index.html renderer/app.js
git commit -m "feat: add project New/Open/Save via native dialogs"
```

---

### Task 12: PNG and PDF export

**Files:**
- Create: `src/export/pdf.js`
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: `AppState.grid`, `AppState.mode`, `AppState.palette`, `generateInstructions` (renderer side); the `grid-canvas` element's `toDataURL()`.
- Produces:
  - `src/export/pdf.js`: `buildPdf({ imageDataUrl, instructions, outputPath }) -> Promise<void>` (Node-only module, used by `main.js`; not loaded in the renderer).
  - `window.api.exportPng(dataUrl) -> Promise<{ success: true, path: string } | { success: false, canceled: true } | { success: false, error: string }>`
  - `window.api.exportPdf({ dataUrl, instructions }) -> Promise<same shape as exportPng>`

- [ ] **Step 1: Implement `src/export/pdf.js`**

```js
const fs = require('fs');
const PDFDocument = require('pdfkit');

function buildPdf({ imageDataUrl, instructions, outputPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64, 'base64');

    doc.image(imageBuffer, { fit: [500, 500], align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Instructions', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    instructions.forEach((line) => doc.text(line));

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { buildPdf };
```

- [ ] **Step 2: Add IPC handlers to `main.js`**

Add near the top, after other `require`s:
```js
const { buildPdf } = require('./src/export/pdf');
```

Add before `app.whenReady().then(createWindow);`:
```js
ipcMain.handle('export:png', async (_event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Image PNG', extensions: ['png'] }],
    defaultPath: 'motif.png',
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'));
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export:pdf', async (_event, { dataUrl, instructions }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: 'motif.pdf',
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    await buildPdf({ imageDataUrl: dataUrl, instructions, outputPath: result.filePath });
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 3: Expose export API in `preload.js`**

Add to the `contextBridge.exposeInMainWorld('api', { ... })` object, alongside `saveProjectAs`/`openProject`:
```js
exportPng: (dataUrl) => ipcRenderer.invoke('export:png', dataUrl),
exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
```

- [ ] **Step 4: Add export buttons to `renderer/index.html`**

Insert into `#toolbar`, after the `save-project-btn` button:
```html
<button id="export-png-btn">Exporter PNG</button>
<button id="export-pdf-btn">Exporter PDF</button>
```

- [ ] **Step 5: Wire export buttons in `renderer/app.js`**

Append at the end of the file:
```js
document.getElementById('export-png-btn').addEventListener('click', async () => {
  const dataUrl = canvas.toDataURL('image/png');
  const result = await window.api.exportPng(dataUrl);
  if (!result.success && !result.canceled) {
    alert(`Erreur lors de l'export PNG : ${result.error}`);
  }
});

document.getElementById('export-pdf-btn').addEventListener('click', async () => {
  const dataUrl = canvas.toDataURL('image/png');
  const project = {
    name: '',
    mode: AppState.mode,
    width: AppState.grid.width,
    height: AppState.grid.height,
    palette: AppState.palette,
    cells: AppState.grid.cells,
  };
  const instructions = generateInstructions(project);
  const result = await window.api.exportPdf({ dataUrl, instructions });
  if (!result.success && !result.canceled) {
    alert(`Erreur lors de l'export PDF : ${result.error}`);
  }
});
```

- [ ] **Step 6: Manually verify export**

Run: `npm start`
Expected: paint a small motif with a couple of colors, click "Exporter PNG", save, open the resulting file and confirm it matches the on-screen grid; click "Exporter PDF", save, open the resulting file and confirm it shows the grid image followed by the instruction lines matching the side panel.

- [ ] **Step 7: Commit**

```bash
git add src/export/pdf.js main.js preload.js renderer/index.html renderer/app.js
git commit -m "feat: add PNG and PDF export"
```

---

### Task 13: Windows packaging

**Files:**
- Modify: `package.json`
- Create: `README.md`

**Interfaces:**
- Produces: `npm run dist` builds a Windows NSIS installer under `dist/`.

- [ ] **Step 1: Verify/finalize the `build` config in `package.json`**

Confirm it matches (from Task 1, Step 2) — add `"asar": true` if not already implied by defaults:
```json
"build": {
  "appId": "com.crochetpatterndesigner.app",
  "productName": "Crochet Pattern Designer",
  "asar": true,
  "files": ["main.js", "preload.js", "renderer/**/*", "src/**/*", "package.json"],
  "win": {
    "target": "nsis"
  }
}
```

- [ ] **Step 2: Write `README.md`**

```markdown
# Crochet Pattern Designer

Application de bureau Windows pour concevoir des motifs de crochet sur une
grille (mode classique ou Corner-to-Corner), générer les instructions
ligne par ligne, et exporter en PNG/PDF. 100% local, aucun compte requis.

## Développement

```bash
npm install
npm start       # lance l'app en mode développement
npm test        # lance les tests unitaires (Jest)
```

## Construire l'installateur Windows

```bash
npm run dist
```

L'installateur `.exe` est généré dans `dist/`.
```

- [ ] **Step 3: Build the installer and verify manually**

Run: `npm run dist`
Expected: `dist/Crochet Pattern Designer Setup <version>.exe` is created without errors. Run the installer on the target machine (or the dev machine), launch the installed app, and confirm it opens, draws, saves/opens a project, and exports PNG/PDF exactly as the dev build did in Tasks 7–12.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore: configure Windows installer packaging"
```

---

## Self-Review Notes

- **Spec coverage:** Éditeur de grille (Task 7), palette (Task 3, 9), modes classique/C2C (Task 5, 6, 10), générateur d'instructions (Task 5, 6, 10), export PNG/PDF (Task 12), gestion de projet (Task 4, 11), gestion des erreurs fichier/export (Tasks 11, 12 return `{success:false,error}` shapes surfaced via `alert`), tests unitaires sur logique pure (Tasks 2–6), packaging installateur (Task 13). All spec sections have a corresponding task.
- **No placeholders:** every step above has complete, runnable code — no TBD/TODO.
- **Type/interface consistency checked:** `project` shape `{name,mode,width,height,palette,cells}` is identical across `project.js`, `instructions.js`, and every `renderer/app.js` call site; `grid` shape `{width,height,cells}` is identical across `grid.js` and `renderer/app.js`; `window.api` method names match between `preload.js` (Tasks 11, 12) and their call sites in `renderer/app.js`.
