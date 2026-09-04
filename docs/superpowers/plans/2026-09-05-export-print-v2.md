# Export & Impression v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the v1 PDF export (currently a single fixed-layout page with a bitmap image) into a configurable, correctly-paginated print export: orientation, paper size (A4/Letter), margin, instructions position, and automatic multi-page splitting for grids too large to fit one page.

**Architecture:** All new logic lives on the Node/main-process side (`src/export/`), since `pdfkit` and `fs` are unavailable in the renderer. A new pure function `computePageLayout` (no `pdfkit` dependency, fully Jest-testable) decides how many pages the grid needs and how big each printed cell is. `buildPdf` is rewritten to draw the grid vectorially (rectangles per cell, page by page) instead of embedding a single bitmap, so pagination stays crisp at any size. The renderer gains a small HTML modal (same pattern as the v1 "Nouveau motif" dialog — `window.prompt` does not work in Electron) to collect the export options before sending them over IPC.

**Tech Stack:** pdfkit (already a dependency), Jest (pagination logic tests), existing Electron IPC pattern (`ipcMain.handle` / `contextBridge` / `ipcRenderer.invoke`).

**Spec:** `docs/superpowers/specs/2026-09-05-export-print-v2-design.md`

## Global Constraints

- Paper sizes supported: only `A4` and `Letter` (spec: "Format papier").
- Margin is a single numeric value in millimeters, applied on all four sides (spec: "Marge").
- Orientation is `"portrait"` or `"landscape"` (spec: "Orientation").
- Instructions position is `"before"`, `"after"`, or `"none"`, default `"after"` (spec: "Position des instructions").
- Pagination is automatic — never a manual page-count picker — based on how many cells fit the printable area (spec: "Pagination automatique").
- PNG export is unaffected by any of this; only the PDF export changes (spec: "Hors scope").
- File/option errors must produce a clear message, never crash silently (spec: "Gestion des erreurs").
- `src/export/*.js` are Node-only modules (used only by `main.js`), never loaded via a `<script>` tag in the renderer — no UMD/browser-compat export guard needed here, unlike `src/*.js`.

---

## File Structure

```
crochet/
  src/
    export/
      page-layout.js     # NEW — pure pagination math (paper sizes, margin, cells-per-page)
      pdf.js             # MODIFIED — vectorial, paginated, positionable-instructions PDF builder
  tests/
    export-page-layout.test.js   # NEW
  main.js                 # MODIFIED — export:pdf IPC handler takes the new payload shape
  renderer/
    index.html             # MODIFIED — new "Exporter PDF" options modal
    styles.css              # MODIFIED — modal styling (reuse existing modal pattern)
    app.js                    # MODIFIED — export-pdf-btn opens the modal instead of exporting directly
```

---

### Task 1: Pure pagination logic

**Files:**
- Create: `src/export/page-layout.js`
- Test: `tests/export-page-layout.test.js`

**Interfaces:**
- Produces: `computePageLayout({ width, height, paperSize, orientation, marginMm }) -> { pagesX, pagesY, cellsPerPageX, cellsPerPageY, cellPt, pageWidthPt, pageHeightPt, marginPt }`. Throws `Error` on an unknown `paperSize` or a margin that leaves no printable area.
  - `width`/`height` are the chart's grid dimensions in cells.
  - `paperSize` is `"A4"` or `"Letter"`.
  - `orientation` is `"portrait"` or `"landscape"`.
  - `marginMm` is a positive number.

- [ ] **Step 1: Write failing tests**

Create `tests/export-page-layout.test.js`:
```js
const { computePageLayout } = require('../src/export/page-layout');

test('a grid that fits the printable area needs exactly one page', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide for one page splits into two page-columns', () => {
  const layout = computePageLayout({ width: 40, height: 20, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide and too tall splits into a 2x2 page grid', () => {
  const layout = computePageLayout({ width: 70, height: 100, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(2);
});

test('switching orientation can reduce the total page count for the same grid', () => {
  const portrait = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  const landscape = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'landscape', marginMm: 10 });
  expect(portrait.pagesX * portrait.pagesY).toBe(2);
  expect(landscape.pagesX * landscape.pagesY).toBe(1);
});

test('throws on an unknown paper size', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A3', orientation: 'portrait', marginMm: 10 }))
    .toThrow(/format papier/i);
});

test('throws when the margin leaves no printable area', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginMm: 150 }))
    .toThrow(/marge/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/export-page-layout.test.js`
Expected: FAIL — `Cannot find module '../src/export/page-layout'`.

- [ ] **Step 3: Implement `src/export/page-layout.js`**

```js
const PAPER_SIZES_PT = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

const CELL_PT = 14;
const MM_TO_PT = 72 / 25.4;

function computePageLayout({ width, height, paperSize, orientation, marginMm }) {
  const base = PAPER_SIZES_PT[paperSize];
  if (!base) {
    throw new Error(`Format papier inconnu : ${paperSize}. Formats supportés : A4, Letter.`);
  }

  const pageWidthPt = orientation === 'landscape' ? base.height : base.width;
  const pageHeightPt = orientation === 'landscape' ? base.width : base.height;
  const marginPt = marginMm * MM_TO_PT;
  const printableWidthPt = pageWidthPt - 2 * marginPt;
  const printableHeightPt = pageHeightPt - 2 * marginPt;

  if (printableWidthPt <= 0 || printableHeightPt <= 0) {
    throw new Error('La marge choisie est trop grande pour ce format de papier.');
  }

  const cellsPerPageX = Math.max(1, Math.floor(printableWidthPt / CELL_PT));
  const cellsPerPageY = Math.max(1, Math.floor(printableHeightPt / CELL_PT));

  return {
    pagesX: Math.ceil(width / cellsPerPageX),
    pagesY: Math.ceil(height / cellsPerPageY),
    cellsPerPageX,
    cellsPerPageY,
    cellPt: CELL_PT,
    pageWidthPt,
    pageHeightPt,
    marginPt,
  };
}

module.exports = { computePageLayout };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/export-page-layout.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/export/page-layout.js tests/export-page-layout.test.js
git commit -m "feat: add pure PDF pagination layout logic"
```

---

### Task 2: Rewrite `buildPdf` for vectorial, paginated, positionable-instructions output

**Files:**
- Modify: `src/export/pdf.js`

**Interfaces:**
- Consumes: `computePageLayout` from `src/export/page-layout.js`.
- Produces (replaces the v1 signature): `buildPdf({ chart, instructions, options, outputPath }) -> Promise<void>`, where:
  - `chart = { width, height, cells, palette }` (same shape as a project's grid/palette — `cells[y][x]` is a color id or `null`).
  - `instructions = string[]`.
  - `options = { orientation, paperSize, marginMm, instructionsPosition }`.
  - Rejects the promise if `computePageLayout` throws, or if the output stream errors; resolves when the file is fully written.

- [ ] **Step 1: Replace `src/export/pdf.js`**

```js
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { computePageLayout } = require('./page-layout');

function cellColorHex(chart, colorId) {
  if (!colorId) return '#ffffff';
  const color = chart.palette.find((c) => c.id === colorId);
  return color ? color.hex : '#ffffff';
}

function buildPdf({ chart, instructions, options, outputPath }) {
  return new Promise((resolve, reject) => {
    let layout;
    try {
      layout = computePageLayout({
        width: chart.width,
        height: chart.height,
        paperSize: options.paperSize,
        orientation: options.orientation,
        marginMm: options.marginMm,
      });
    } catch (err) {
      reject(err);
      return;
    }

    const pageSize = [layout.pageWidthPt, layout.pageHeightPt];
    const margins = {
      top: layout.marginPt,
      bottom: layout.marginPt,
      left: layout.marginPt,
      right: layout.marginPt,
    };

    const doc = new PDFDocument({ size: pageSize, margins });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    let firstPageUsed = false;
    function ensureFreshPage() {
      if (firstPageUsed) {
        doc.addPage({ size: pageSize, margins });
      }
      firstPageUsed = true;
    }

    function writeInstructions() {
      ensureFreshPage();
      doc.fontSize(14).text('Instructions', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      instructions.forEach((line) => doc.text(line));
    }

    if (options.instructionsPosition === 'before') {
      writeInstructions();
    }

    const totalGridPages = layout.pagesX * layout.pagesY;
    let gridPageNum = 0;

    for (let py = 0; py < layout.pagesY; py++) {
      for (let px = 0; px < layout.pagesX; px++) {
        ensureFreshPage();
        gridPageNum++;

        const startX = px * layout.cellsPerPageX;
        const startY = py * layout.cellsPerPageY;
        const endX = Math.min(startX + layout.cellsPerPageX, chart.width);
        const endY = Math.min(startY + layout.cellsPerPageY, chart.height);

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const hex = cellColorHex(chart, chart.cells[y][x]);
            doc
              .rect(
                layout.marginPt + (x - startX) * layout.cellPt,
                layout.marginPt + (y - startY) * layout.cellPt,
                layout.cellPt,
                layout.cellPt
              )
              .fillAndStroke(hex, '#dddddd');
          }
        }

        if (totalGridPages > 1) {
          doc
            .fontSize(9)
            .fillColor('#000000')
            .text(`Page ${gridPageNum}/${totalGridPages}`, 0, layout.pageHeightPt - 20, {
              width: layout.pageWidthPt,
              align: 'center',
            });
        }
      }
    }

    if (options.instructionsPosition === 'after') {
      writeInstructions();
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { buildPdf };
```

- [ ] **Step 2: Verify with a standalone script**

Run this from the project root (adjust paths if needed) to produce a real PDF and inspect it manually:
```bash
node -e "
const { buildPdf } = require('./src/export/pdf');
const chart = {
  width: 50, height: 30,
  palette: [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }, { id: 'c2', name: 'Bleu', hex: '#0000ff' }],
  cells: Array.from({ length: 30 }, (_, y) => Array.from({ length: 50 }, (_, x) => ((x + y) % 2 === 0 ? 'c1' : 'c2'))),
};
buildPdf({
  chart,
  instructions: ['Rang 1 : test', 'Rang 2 : test'],
  options: { orientation: 'portrait', paperSize: 'A4', marginMm: 10, instructionsPosition: 'after' },
  outputPath: 'test-export.pdf',
}).then(() => console.log('OK, see test-export.pdf')).catch((err) => { console.error(err); process.exit(1); });
"
```
Expected: prints `OK, see test-export.pdf`; open `test-export.pdf` and confirm it has 2 grid pages (this 50x30 grid needs `pagesX=2, pagesY=1` per Task 1's math) each labeled "Page X/2", followed by an instructions page. Delete `test-export.pdf` afterwards (it's a manual scratch file, not a fixture — do not commit it).

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

Run: `npx jest`
Expected: PASS (all suites, including Task 1's new tests).

- [ ] **Step 4: Commit**

```bash
git add src/export/pdf.js
git commit -m "feat: rewrite PDF export as vectorial, paginated, with positionable instructions"
```

---

### Task 3: Update the `export:pdf` IPC handler for the new payload shape

**Files:**
- Modify: `main.js`

**Interfaces:**
- Consumes: `buildPdf` from `src/export/pdf.js` (already required in `main.js` since v1; only the call site changes).
- Produces: `ipcMain.handle('export:pdf', ...)` now expects `(chart, instructions, options)` bundled as one payload object `{ chart, instructions, options }` instead of v1's `{ dataUrl, instructions }`. Return shape unchanged: `{ success: true, path } | { success: false, canceled: true } | { success: false, error }`.

- [ ] **Step 1: Replace the `export:pdf` handler in `main.js`**

Find the existing handler (from v1):
```js
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

Replace it with:
```js
const VALID_PAPER_SIZES = ['A4', 'Letter'];
const VALID_ORIENTATIONS = ['portrait', 'landscape'];
const VALID_INSTRUCTIONS_POSITIONS = ['before', 'after', 'none'];

ipcMain.handle('export:pdf', async (_event, { chart, instructions, options }) => {
  if (!VALID_PAPER_SIZES.includes(options.paperSize)) {
    return { success: false, error: `Format papier invalide : ${options.paperSize}` };
  }
  if (!VALID_ORIENTATIONS.includes(options.orientation)) {
    return { success: false, error: `Orientation invalide : ${options.orientation}` };
  }
  if (!VALID_INSTRUCTIONS_POSITIONS.includes(options.instructionsPosition)) {
    return { success: false, error: `Position des instructions invalide : ${options.instructionsPosition}` };
  }
  if (typeof options.marginMm !== 'number' || !Number.isFinite(options.marginMm) || options.marginMm < 0) {
    return { success: false, error: 'La marge doit être un nombre positif.' };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: 'motif.pdf',
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    await buildPdf({ chart, instructions, options, outputPath: result.filePath });
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Verify with a syntax check**

Run: `node --check main.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: accept structured export options in the export:pdf IPC handler"
```

---

### Task 4: PDF export options modal markup

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/styles.css`

**Interfaces:**
- Produces: a hidden `#pdf-export-modal` (same show/hide pattern as `#new-project-modal` from v1 — `hidden` attribute controls visibility, CSS uses `:not([hidden])` to avoid the specificity bug fixed in v1) with fields for orientation, paper size, margin, and instructions position, plus "Exporter"/"Annuler" buttons. Task 5 wires its behavior.

- [ ] **Step 1: Add the modal markup to `renderer/index.html`**

Insert immediately after the existing `</div>` that closes `#new-project-modal` (before the `<script src="../src/grid.js">` line):
```html
  <div id="pdf-export-modal" hidden>
    <div id="pdf-export-modal-box">
      <h3>Exporter en PDF</h3>
      <label>Orientation :<br />
        <div class="pdf-orientation-buttons">
          <button type="button" id="pdf-orientation-portrait" class="pdf-orientation-btn active" data-orientation="portrait">Portrait</button>
          <button type="button" id="pdf-orientation-landscape" class="pdf-orientation-btn" data-orientation="landscape">Paysage</button>
        </div>
      </label><br />
      <label>Format papier :<br />
        <select id="pdf-paper-size">
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </label><br />
      <label>Marge (mm) :<br />
        <input type="number" id="pdf-margin-mm" value="10" min="0" />
      </label><br />
      <label>Instructions :<br />
        <select id="pdf-instructions-position">
          <option value="before">Avant la grille</option>
          <option value="after" selected>Après la grille</option>
          <option value="none">Aucune</option>
        </select>
      </label><br />
      <button id="pdf-export-confirm">Exporter</button>
      <button id="pdf-export-cancel">Annuler</button>
    </div>
  </div>
```

- [ ] **Step 2: Add modal styles to `renderer/styles.css`**

Append:
```css
#pdf-export-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  align-items: center;
  justify-content: center;
  z-index: 10;
}
#pdf-export-modal:not([hidden]) { display: flex; }
#pdf-export-modal-box {
  background: #fff;
  padding: 20px;
  border-radius: 6px;
  min-width: 280px;
}
#pdf-export-modal-box label { display: block; margin-bottom: 8px; }
#pdf-export-modal-box select, #pdf-export-modal-box input { width: 100%; box-sizing: border-box; }
.pdf-orientation-buttons { display: flex; gap: 4px; }
.pdf-orientation-btn { flex: 1; }
.pdf-orientation-btn.active { font-weight: bold; outline: 2px solid #333; }
```

- [ ] **Step 3: Manually verify the markup doesn't break page load**

Run: `npm start`
Expected: window opens with no console errors (the modal stays hidden until Task 5 wires the button that shows it).

- [ ] **Step 4: Commit**

```bash
git add renderer/index.html renderer/styles.css
git commit -m "feat: add PDF export options modal markup"
```

---

### Task 5: Wire the PDF export modal and new IPC payload in the renderer

**Files:**
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: `AppState.grid`, `AppState.palette`, `AppState.mode`, `generateInstructions` (global), `window.api.exportPdf` (unchanged preload signature — it just forwards whatever payload object it's given to `ipcRenderer.invoke('export:pdf', payload)`, so `preload.js` needs no changes).
- Produces: replaces the existing `export-pdf-btn` click handler so it opens `#pdf-export-modal` instead of exporting immediately; the modal's "Exporter" button builds the new `{ chart, instructions, options }` payload and calls `window.api.exportPdf`.

- [ ] **Step 1: Replace the existing PDF export handler in `renderer/app.js`**

Find this block (from v1):
```js
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

Replace it with:
```js
const pdfExportModal = document.getElementById('pdf-export-modal');

document.getElementById('export-pdf-btn').addEventListener('click', () => {
  pdfExportModal.hidden = false;
});

document.getElementById('pdf-export-cancel').addEventListener('click', () => {
  pdfExportModal.hidden = true;
});

document.querySelectorAll('.pdf-orientation-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pdf-orientation-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('pdf-export-confirm').addEventListener('click', async () => {
  const orientation = document.querySelector('.pdf-orientation-btn.active').dataset.orientation;
  const paperSize = document.getElementById('pdf-paper-size').value;
  const marginMm = parseFloat(document.getElementById('pdf-margin-mm').value);
  const instructionsPosition = document.getElementById('pdf-instructions-position').value;

  if (!Number.isFinite(marginMm) || marginMm < 0) {
    alert('La marge doit être un nombre positif.');
    return;
  }

  const project = {
    name: '',
    mode: AppState.mode,
    width: AppState.grid.width,
    height: AppState.grid.height,
    palette: AppState.palette,
    cells: AppState.grid.cells,
  };
  const instructions = instructionsPosition === 'none' ? [] : generateInstructions(project);

  const chart = {
    width: AppState.grid.width,
    height: AppState.grid.height,
    cells: AppState.grid.cells,
    palette: AppState.palette,
  };

  const result = await window.api.exportPdf({
    chart,
    instructions,
    options: { orientation, paperSize, marginMm, instructionsPosition },
  });

  if (result.success) {
    pdfExportModal.hidden = true;
  } else if (!result.canceled) {
    alert(`Erreur lors de l'export PDF : ${result.error}`);
  }
});
```

- [ ] **Step 2: Manually verify**

Run: `npm start`
Expected: paint a small motif, click "Exporter PDF" — the modal opens (not `window.prompt`, an actual visible dialog); toggling Portrait/Paysage highlights the active button; clicking "Annuler" closes the modal without exporting; clicking "Exporter" opens the native save dialog, and the resulting PDF (opened manually) reflects the chosen orientation/margin/instructions position, with automatic pagination if the grid is large enough (test with a large grid created via "Nouveau", e.g. 60x60, to see multi-page output).

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add renderer/app.js
git commit -m "feat: wire PDF export options modal to the new export:pdf payload"
```

---

## Self-Review Notes

- **Spec coverage:** orientation (Task 4/5), paper size A4/Letter (Task 1/4/5), margin in mm (Task 1/3/4/5), instructions position before/after/none (Task 2/4/5), automatic pagination (Task 1/2), out-of-scope items (vector formats, other paper sizes, other margin units, separate legend file, selection-only export) are simply not implemented — no task references them. All spec sections have a corresponding task or an explicit exclusion.
- **No placeholders:** every step has complete, runnable code.
- **Type/interface consistency checked:** `chart` shape `{width,height,cells,palette}` is identical across `page-layout.js` (via its `width`/`height` params), `pdf.js`'s `buildPdf`, `main.js`'s handler, and `renderer/app.js`'s payload construction. `options` field names (`orientation`, `paperSize`, `marginMm`, `instructionsPosition`) match exactly between the renderer payload, the IPC handler's validation, and `buildPdf`/`computePageLayout`'s destructuring. `window.api.exportPdf` in `preload.js` is unchanged (a pure pass-through), consistent with Task 3/5 not touching it.
