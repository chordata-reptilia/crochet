# Export & impression v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the v2 PDF export system with more paper sizes (A0-A6, Legal, Ledger), margin units beyond millimeters (mm/cm/in), and a color legend (swatch + name + hex) that can be included in the main PDF and/or downloaded as a separate PDF or PNG file.

**Architecture:** Pure extension of the existing `src/export/page-layout.js` + `src/export/pdf.js` + `export:pdf` IPC pipeline (no restructuring). A new pure, UMD-style shared module `src/legend.js` (loaded both via `<script>` in the renderer and via `require()` in the main process, same pattern as `src/palette.js`/`src/instructions.js`) computes which palette colors are actually used in the grid. A new Node-only module `src/export/legend.js` draws that legend with `pdfkit`, reusable both inside the main PDF and inside a standalone legend-only PDF. The separate-legend-as-PNG path renders on a detached `<canvas>` in the renderer (same technique as the existing PNG export of the motif) and reuses the existing `export:png`-style save flow.

**Tech Stack:** pdfkit (already a dependency), Jest (pagination + legend logic tests, plus real-PDF page-count integration tests), existing Electron IPC pattern (`ipcMain.handle` / `contextBridge` / `ipcRenderer.invoke`).

**Spec:** `docs/superpowers/specs/2026-09-05-export-print-v3-design.md`

## Global Constraints

- Paper sizes supported: A0, A1, A2, A3, A4, A5, A6, Legal, Ledger, Letter — a fixed list, no custom dimensions (spec: "Formats papier étendus").
- Margin units supported: `mm`, `cm`, `in` — conversion to PDF points centralized in one table in `page-layout.js`, never duplicated (spec: "Unités de marge").
- Legend rows include only palette colors that appear at least once in `chart.cells` — colors added to the palette but never painted are omitted (spec: "Légende intégrée").
- The inline legend section, when enabled, always appears right after the last grid page and before any instructions pages, regardless of the `instructionsPosition` setting (spec: "Légende intégrée au PDF principal").
- Breaking rename (intentional, no back-compat needed — single desktop app, no external API consumers): `options.marginMm` (v2) becomes `options.marginValue` + `options.marginUnit` (v3). Every producer and consumer of this payload is updated together in this plan.
- PNG export of the full motif is unchanged; these options only affect the PDF export and the new legend exports (spec: "Export PNG du motif complet : inchangé").
- `src/export/*.js` remain Node-only modules (never loaded via `<script>` in the renderer). `src/legend.js` is the exception living outside `src/export/`: it is a shared pure-logic module loaded both via `<script>` in `renderer/index.html` and via `require()` from `src/export/legend.js` and `src/export/pdf.js`, using the same UMD guard (`if (typeof module !== 'undefined' && module.exports) { module.exports = {...} }`) already used by `src/palette.js` and `src/instructions.js`.
- Every export failure (invalid option, canceled dialog, write error) must resolve to `{success:false, ...}` — never a silent crash (carried over from v2's Global Constraints, still binding).

---

## File Structure

```
crochet/
  src/
    legend.js                      # NEW — shared/UMD: buildLegendRows(chart)
    export/
      page-layout.js                # MODIFIED — more paper sizes, marginValue+marginUnit
      legend.js                     # NEW — Node-only: drawLegendSection, buildLegendDocument (pdfkit)
      pdf.js                        # MODIFIED — consumes marginValue/marginUnit, draws legend section
  tests/
    export-page-layout.test.js       # MODIFIED — renamed params, new formats/units cases
    legend.test.js                   # NEW — buildLegendRows unit tests
    export-legend-pdf.test.js        # NEW — buildLegendDocument real-PDF page-count tests
    export-pdf.test.js               # NEW — buildPdf real-PDF page-count tests (grid+legend+instructions)
    browser-load-order.test.js       # MODIFIED — add legend.js to the simulated script load order
  main.js                            # MODIFIED — export:pdf validation extended; new export:legend-pdf / export:legend-png handlers
  preload.js                         # MODIFIED — exposes exportLegendPdf / exportLegendPng
  renderer/
    index.html                       # MODIFIED — paper size options, margin unit select, include-legend checkbox, legend download button+format select, new <script> tag
    styles.css                       # MODIFIED — layout for the new margin/legend controls
    app.js                           # MODIFIED — new options payload fields; legend download wiring; renderLegendCanvas()
```

---

### Task 1: Extend paper sizes and margin units in the pure pagination module

**Files:**
- Modify: `src/export/page-layout.js`
- Test: `tests/export-page-layout.test.js`

**Interfaces:**
- Modifies: `computePageLayout({ width, height, paperSize, orientation, marginValue, marginUnit })` — replaces v2's `marginMm` parameter with `marginValue` (number) + `marginUnit` (`'mm' | 'cm' | 'in'`). Return shape unchanged: `{ pagesX, pagesY, cellsPerPageX, cellsPerPageY, cellPt, pageWidthPt, pageHeightPt, marginPt }`.
- `paperSize` now accepts `'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'Legal' | 'Ledger' | 'Letter'`.
- Throws `Error` matching `/format papier/i` on an unknown `paperSize`, `/unité de marge/i` on an unknown `marginUnit`, `/marge/i` (via the existing "trop grande" message) when the resulting printable area is too small.

- [ ] **Step 1: Update the test file to the new parameter names and add new cases**

Replace the full contents of `tests/export-page-layout.test.js`:
```js
const { computePageLayout } = require('../src/export/page-layout');

test('a grid that fits the printable area needs exactly one page', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide for one page splits into two page-columns', () => {
  const layout = computePageLayout({ width: 40, height: 20, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide and too tall splits into a 2x2 page grid', () => {
  const layout = computePageLayout({ width: 70, height: 100, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(2);
});

test('switching orientation can reduce the total page count for the same grid', () => {
  const portrait = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  const landscape = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'landscape', marginValue: 10, marginUnit: 'mm' });
  expect(portrait.pagesX * portrait.pagesY).toBe(2);
  expect(landscape.pagesX * landscape.pagesY).toBe(1);
});

test('throws on an unknown paper size', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A7', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' }))
    .toThrow(/format papier/i);
});

test('throws when the margin leaves no printable area', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 150, marginUnit: 'mm' }))
    .toThrow(/marge/i);
});

test('throws when the margin leaves less than one full cell of printable width', () => {
  // marginValue=103mm on A4 portrait: printableWidthPt ~= 11.34pt, positive
  // but smaller than CELL_PT (14pt) -- must be rejected rather than silently
  // clamped to 1 cell per page-column.
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 103, marginUnit: 'mm' }))
    .toThrow(/marge/i);
});

test('throws on an unknown margin unit', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'furlong' }))
    .toThrow(/unité de marge/i);
});

test('mm, cm, and in margin units convert to the same point value', () => {
  const mm = computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  const cm = computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 1, marginUnit: 'cm' });
  const inch = computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 10 / 25.4, marginUnit: 'in' });
  expect(cm.marginPt).toBeCloseTo(mm.marginPt, 6);
  expect(inch.marginPt).toBeCloseTo(mm.marginPt, 6);
});

test('a 20x20 grid fits on a single A3 page at 10mm margin', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'A3', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});

test('a 20x20 grid fits on a single Legal page at 10mm margin', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'Legal', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/export-page-layout.test.js`
Expected: FAIL — `computePageLayout` still expects `marginMm` and only knows `A4`/`Letter`, so most assertions fail or throw unexpectedly.

- [ ] **Step 3: Replace `src/export/page-layout.js`**

```js
const PAPER_SIZES_PT = {
  A0: { width: 2383.94, height: 3370.39 },
  A1: { width: 1683.78, height: 2383.94 },
  A2: { width: 1190.55, height: 1683.78 },
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  A6: { width: 297.64, height: 419.53 },
  Legal: { width: 612.0, height: 1008.0 },
  Ledger: { width: 792.0, height: 1224.0 },
  Letter: { width: 612, height: 792 },
};

const CELL_PT = 14;
// Vertical space reserved on every grid page for the "Page X/Y" footer text,
// so the footer never overlaps the last row of drawn cells.
const FOOTER_HEIGHT_PT = 14;

const MARGIN_UNIT_TO_PT = {
  mm: 72 / 25.4,
  cm: 72 / 2.54,
  in: 72,
};

function computePageLayout({ width, height, paperSize, orientation, marginValue, marginUnit }) {
  const base = PAPER_SIZES_PT[paperSize];
  if (!base) {
    throw new Error(`Format papier inconnu : ${paperSize}. Formats supportés : ${Object.keys(PAPER_SIZES_PT).join(', ')}.`);
  }

  const unitToPt = MARGIN_UNIT_TO_PT[marginUnit];
  if (!unitToPt) {
    throw new Error(`Unité de marge inconnue : ${marginUnit}. Unités supportées : mm, cm, in.`);
  }

  const pageWidthPt = orientation === 'landscape' ? base.height : base.width;
  const pageHeightPt = orientation === 'landscape' ? base.width : base.height;
  const marginPt = marginValue * unitToPt;
  const printableWidthPt = pageWidthPt - 2 * marginPt;
  const printableHeightPt = pageHeightPt - 2 * marginPt - FOOTER_HEIGHT_PT;

  if (printableWidthPt <= 0 || printableHeightPt <= 0) {
    throw new Error('La marge choisie est trop grande pour ce format de papier.');
  }

  if (printableWidthPt < CELL_PT || printableHeightPt < CELL_PT) {
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
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/export/page-layout.js tests/export-page-layout.test.js
git commit -m "feat: add paper sizes A0-A6/Legal/Ledger and mm/cm/in margin units to pagination"
```

---

### Task 2: Shared pure legend-row logic (`src/legend.js`)

**Files:**
- Create: `src/legend.js`
- Test: `tests/legend.test.js`

**Interfaces:**
- Produces: `buildLegendRows(chart) -> Array<{ hex: string, label: string }>`, where `chart = { width, height, cells, palette }` (same shape used everywhere else in the export pipeline). Includes only palette colors whose `id` appears at least once in `chart.cells`, in palette order (not usage order). `label` is `` `${name} (${hex})` `` when the color has a non-empty `name`, otherwise just `hex`.
- Loaded via `<script>` in the renderer (installs a global `buildLegendRows`) and via `require('../legend')` / `require('./legend')` from Node — same UMD guard pattern as `src/palette.js`.

- [ ] **Step 1: Write failing tests**

Create `tests/legend.test.js`:
```js
const { buildLegendRows } = require('../src/legend');

test('omits palette colors never painted on the grid', () => {
  const chart = {
    width: 2,
    height: 1,
    cells: [['c1', null]],
    palette: [
      { id: 'c1', name: 'Rouge', hex: '#ff0000' },
      { id: 'c2', name: 'Bleu', hex: '#0000ff' },
    ],
  };
  const rows = buildLegendRows(chart);
  expect(rows).toEqual([{ hex: '#ff0000', label: 'Rouge (#ff0000)' }]);
});

test('uses the hex code as the label when the color has no name', () => {
  const chart = {
    width: 1,
    height: 1,
    cells: [['c1']],
    palette: [{ id: 'c1', name: '', hex: '#00ff00' }],
  };
  const rows = buildLegendRows(chart);
  expect(rows).toEqual([{ hex: '#00ff00', label: '#00ff00' }]);
});

test('returns an empty list for a fully empty grid', () => {
  const chart = {
    width: 2,
    height: 2,
    cells: [[null, null], [null, null]],
    palette: [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }],
  };
  expect(buildLegendRows(chart)).toEqual([]);
});

test('keeps palette order, not usage order', () => {
  const chart = {
    width: 2,
    height: 1,
    cells: [['c2', 'c1']],
    palette: [
      { id: 'c1', name: 'Rouge', hex: '#ff0000' },
      { id: 'c2', name: 'Bleu', hex: '#0000ff' },
    ],
  };
  const rows = buildLegendRows(chart);
  expect(rows).toEqual([
    { hex: '#ff0000', label: 'Rouge (#ff0000)' },
    { hex: '#0000ff', label: 'Bleu (#0000ff)' },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/legend.test.js`
Expected: FAIL — `Cannot find module '../src/legend'`.

- [ ] **Step 3: Implement `src/legend.js`**

```js
function buildLegendRows(chart) {
  const usedIds = new Set();
  for (let y = 0; y < chart.height; y++) {
    for (let x = 0; x < chart.width; x++) {
      const id = chart.cells[y][x];
      if (id) usedIds.add(id);
    }
  }

  return chart.palette
    .filter((color) => usedIds.has(color.id))
    .map((color) => ({
      hex: color.hex,
      label: color.name && color.name.trim() !== '' ? `${color.name} (${color.hex})` : color.hex,
    }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildLegendRows };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/legend.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/legend.js tests/legend.test.js
git commit -m "feat: add buildLegendRows shared module for the color legend"
```

---

### Task 3: PDF rendering for the legend (`src/export/legend.js`)

**Files:**
- Create: `src/export/legend.js`
- Test: `tests/export-legend-pdf.test.js`

**Interfaces:**
- Consumes: `buildLegendRows(chart)` from `src/legend.js`.
- Produces: `drawLegendSection(doc, rows, pageCtx)` — draws a "Légende" heading followed by one swatch+label row per entry of `rows` (`Array<{hex, label}>`, as returned by `buildLegendRows`) onto an already-open `pdfkit` `doc`, using `pageCtx = { pageHeightPt, marginPt, ensureFreshPage }` (`ensureFreshPage` is a zero-arg function, same contract as the closure already used internally by `buildPdf` in `src/export/pdf.js`: calling it either starts the very first page or calls `doc.addPage(...)` for a new one). Paginates automatically by calling `ensureFreshPage()` again and repeating the heading (as "Légende (suite)") whenever a row would not fit before `pageHeightPt - marginPt`.
- Produces: `buildLegendDocument({ chart, outputPath }) -> Promise<void>` — creates a **standalone** single-purpose PDF containing only the legend for `chart`, always on fixed A4-portrait pages with a 40pt margin (independent of whatever paper size/orientation/margin was chosen for the main grid export — the standalone legend file has no such choice to inherit, so a simple fixed default keeps it maximally reusable/printable). Resolves when the file is fully written; rejects on stream error.

- [ ] **Step 1: Write failing tests**

Create `tests/export-legend-pdf.test.js`:
```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLegendDocument } = require('../src/export/legend');

function countPdfPages(filePath) {
  const bytes = fs.readFileSync(filePath);
  const matches = bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

function makeChart(colorCount) {
  const palette = [];
  const cells = [[]];
  for (let i = 0; i < colorCount; i++) {
    const id = `c${i}`;
    palette.push({ id, name: `Couleur ${i}`, hex: '#ff0000' });
    cells[0].push(id);
  }
  return { width: colorCount, height: 1, cells, palette };
}

test('a legend with few colors fits on a single page', async () => {
  const outputPath = path.join(os.tmpdir(), `legend-test-${Date.now()}-small.pdf`);
  await buildLegendDocument({ chart: makeChart(3), outputPath });
  expect(countPdfPages(outputPath)).toBe(1);
  fs.unlinkSync(outputPath);
});

test('a legend with many colors spans multiple pages', async () => {
  const outputPath = path.join(os.tmpdir(), `legend-test-${Date.now()}-large.pdf`);
  await buildLegendDocument({ chart: makeChart(50), outputPath });
  expect(countPdfPages(outputPath)).toBeGreaterThan(1);
  fs.unlinkSync(outputPath);
});

test('a legend with zero used colors still produces a valid one-page PDF', async () => {
  const outputPath = path.join(os.tmpdir(), `legend-test-${Date.now()}-empty.pdf`);
  await buildLegendDocument({ chart: { width: 1, height: 1, cells: [[null]], palette: [] }, outputPath });
  expect(countPdfPages(outputPath)).toBe(1);
  fs.unlinkSync(outputPath);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/export-legend-pdf.test.js`
Expected: FAIL — `Cannot find module '../src/export/legend'`.

- [ ] **Step 3: Implement `src/export/legend.js`**

```js
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { buildLegendRows } = require('../legend');

const SWATCH_SIZE_PT = 14;
const ROW_HEIGHT_PT = 20;
// Fixed page geometry for the standalone legend PDF (buildLegendDocument only)
// — it has no main export to inherit a paper size/orientation/margin from.
const LEGEND_PAGE_WIDTH_PT = 595.28; // A4 portrait
const LEGEND_PAGE_HEIGHT_PT = 841.89;
const LEGEND_MARGIN_PT = 40;

function drawLegendSection(doc, rows, pageCtx) {
  const { pageHeightPt, marginPt, ensureFreshPage } = pageCtx;
  const maxY = pageHeightPt - marginPt;

  function writeHeading(text) {
    doc.fillColor('#000000').fontSize(14).text(text, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
  }

  ensureFreshPage();
  writeHeading('Légende');

  rows.forEach((row) => {
    if (doc.y + ROW_HEIGHT_PT > maxY) {
      ensureFreshPage();
      writeHeading('Légende (suite)');
    }
    const rowTop = doc.y;
    doc.rect(marginPt, rowTop, SWATCH_SIZE_PT, SWATCH_SIZE_PT).fillAndStroke(row.hex, '#333333');
    doc.fillColor('#000000').text(row.label, marginPt + SWATCH_SIZE_PT + 8, rowTop + 2);
    doc.y = rowTop + ROW_HEIGHT_PT;
  });
}

function buildLegendDocument({ chart, outputPath }) {
  return new Promise((resolve, reject) => {
    const pageSize = [LEGEND_PAGE_WIDTH_PT, LEGEND_PAGE_HEIGHT_PT];
    const margins = {
      top: LEGEND_MARGIN_PT,
      bottom: LEGEND_MARGIN_PT,
      left: LEGEND_MARGIN_PT,
      right: LEGEND_MARGIN_PT,
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

    drawLegendSection(doc, buildLegendRows(chart), {
      pageHeightPt: LEGEND_PAGE_HEIGHT_PT,
      marginPt: LEGEND_MARGIN_PT,
      ensureFreshPage,
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { drawLegendSection, buildLegendDocument };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/export-legend-pdf.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npx jest`
Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add src/export/legend.js tests/export-legend-pdf.test.js
git commit -m "feat: add pdfkit legend rendering and standalone legend PDF builder"
```

---

### Task 4: Wire margin units and the inline legend section into `buildPdf`

**Files:**
- Modify: `src/export/pdf.js`
- Test: `tests/export-pdf.test.js`

**Interfaces:**
- Consumes: `computePageLayout` from `src/export/page-layout.js` (now taking `marginValue`/`marginUnit`), `buildLegendRows` from `src/legend.js`, `drawLegendSection` from `src/export/legend.js`.
- Modifies: `buildPdf({ chart, instructions, options, outputPath })` — `options` gains `marginValue` (number), `marginUnit` (`'mm'|'cm'|'in'`, replacing `marginMm`), and `includeLegend` (boolean). When `includeLegend` is `true`, a legend section (same page geometry as the grid — i.e. whatever `computePageLayout` returned for the chosen paper size/orientation) is drawn right after the last grid page and before any `instructionsPosition === 'after'` instructions block; the `'before'` instructions block (if any) is unaffected and stays before the grid.

- [ ] **Step 1: Write failing tests**

Create `tests/export-pdf.test.js`:
```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPdf } = require('../src/export/pdf');

function countPdfPages(filePath) {
  const bytes = fs.readFileSync(filePath);
  const matches = bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

function makeChart(width, height) {
  const palette = [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }];
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => 'c1'));
  return { width, height, cells, palette };
}

test('a grid that fits one page produces one grid page plus one instructions page', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-single.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: ['Rang 1 : 20 mailles Rouge'],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'after', includeLegend: false },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});

test('including the legend adds exactly one extra page for a small palette', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-legend.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: true },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});

test('a grid needing two page-columns produces two grid pages with no legend/instructions', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-multipage.pdf`);
  await buildPdf({
    chart: makeChart(50, 20),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: false },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/export-pdf.test.js`
Expected: FAIL — `computePageLayout` inside `buildPdf` still reads `options.marginMm` (`undefined`), so `marginValue`/`marginUnit` are ignored and the margin math is wrong (or throws), and there is no legend handling at all yet.

- [ ] **Step 3: Modify `src/export/pdf.js`**

Add these two requires at the top, alongside the existing ones:
```js
const { buildLegendRows } = require('../legend');
const { drawLegendSection } = require('./legend');
```

Replace the `computePageLayout` call inside `buildPdf`:
```js
      layout = computePageLayout({
        width: chart.width,
        height: chart.height,
        paperSize: options.paperSize,
        orientation: options.orientation,
        marginValue: options.marginValue,
        marginUnit: options.marginUnit,
      });
```

Insert the legend section between the grid-page loop and the `'after'` instructions block — find:
```js
    if (options.instructionsPosition === 'after') {
      writeInstructions();
    }
```
and replace it with:
```js
    if (options.includeLegend) {
      drawLegendSection(doc, buildLegendRows(chart), {
        pageHeightPt: layout.pageHeightPt,
        marginPt: layout.marginPt,
        ensureFreshPage,
      });
    }

    if (options.instructionsPosition === 'after') {
      writeInstructions();
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/export-pdf.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npx jest`
Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add src/export/pdf.js tests/export-pdf.test.js
git commit -m "feat: consume marginValue/marginUnit and draw the legend section in buildPdf"
```

---

### Task 5: Update the `export:pdf` IPC handler and add legend export handlers

**Files:**
- Modify: `main.js`

**Interfaces:**
- Consumes: `buildLegendDocument` from `src/export/legend.js` (new import), `buildPdf` from `src/export/pdf.js` (already imported, only the payload passed through changes).
- Modifies: `ipcMain.handle('export:pdf', ...)` — validates `options.paperSize` against the full v3 list, validates `options.marginUnit` against `['mm','cm','in']`, validates `options.marginValue` (replacing `marginMm`) as a finite non-negative number, and validates `options.includeLegend` as a boolean. Return shape unchanged.
- Produces: `ipcMain.handle('export:legend-pdf', async (_event, chart) => ...)` — same save-dialog/try-catch/return-shape pattern as `export:pdf`, calls `buildLegendDocument({ chart, outputPath })`.
- Produces: `ipcMain.handle('export:legend-png', async (_event, dataUrl) => ...)` — identical pattern to the existing `export:png` handler (already in this file), just a different default filename and PDF/PNG-neutral generic filter name.

- [ ] **Step 1: Add the `buildLegendDocument` import**

At the top of `main.js`, alongside the existing `buildPdf` import, add:
```js
const { buildLegendDocument } = require('./src/export/legend');
```

- [ ] **Step 2: Replace the `export:pdf` handler's validation block and paper size list**

Find:
```js
const VALID_PAPER_SIZES = ['A4', 'Letter'];
const VALID_ORIENTATIONS = ['portrait', 'landscape'];
const VALID_INSTRUCTIONS_POSITIONS = ['before', 'after', 'none'];

ipcMain.handle('export:pdf', async (_event, { chart, instructions, options }) => {
  if (!options || typeof options !== 'object') {
    return { success: false, error: 'Les options d\'export sont requises.' };
  }
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

Replace it with:
```js
const VALID_PAPER_SIZES = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Legal', 'Ledger', 'Letter'];
const VALID_ORIENTATIONS = ['portrait', 'landscape'];
const VALID_INSTRUCTIONS_POSITIONS = ['before', 'after', 'none'];
const VALID_MARGIN_UNITS = ['mm', 'cm', 'in'];

ipcMain.handle('export:pdf', async (_event, { chart, instructions, options }) => {
  if (!options || typeof options !== 'object') {
    return { success: false, error: 'Les options d\'export sont requises.' };
  }
  if (!VALID_PAPER_SIZES.includes(options.paperSize)) {
    return { success: false, error: `Format papier invalide : ${options.paperSize}` };
  }
  if (!VALID_ORIENTATIONS.includes(options.orientation)) {
    return { success: false, error: `Orientation invalide : ${options.orientation}` };
  }
  if (!VALID_INSTRUCTIONS_POSITIONS.includes(options.instructionsPosition)) {
    return { success: false, error: `Position des instructions invalide : ${options.instructionsPosition}` };
  }
  if (!VALID_MARGIN_UNITS.includes(options.marginUnit)) {
    return { success: false, error: `Unité de marge invalide : ${options.marginUnit}` };
  }
  if (typeof options.marginValue !== 'number' || !Number.isFinite(options.marginValue) || options.marginValue < 0) {
    return { success: false, error: 'La marge doit être un nombre positif.' };
  }
  if (typeof options.includeLegend !== 'boolean') {
    return { success: false, error: 'L\'option "Inclure la légende" doit être un booléen.' };
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

- [ ] **Step 3: Add the two new legend export handlers**

Immediately after the `export:pdf` handler (before `app.whenReady().then(createWindow);`), add:
```js
ipcMain.handle('export:legend-pdf', async (_event, chart) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: 'legende.pdf',
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    await buildLegendDocument({ chart, outputPath: result.filePath });
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export:legend-png', async (_event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Image PNG', extensions: ['png'] }],
    defaultPath: 'legende.png',
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
```

- [ ] **Step 4: Verify with a syntax check**

Run: `node --check main.js`
Expected: no output (success).

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: PASS (all suites — `main.js` has no direct unit tests, this just guards against accidentally breaking a required module).

- [ ] **Step 6: Commit**

```bash
git add main.js
git commit -m "feat: validate v3 export options and add legend-pdf/legend-png IPC handlers"
```

---

### Task 6: Expose the new legend export APIs from the preload script

**Files:**
- Modify: `preload.js`

**Interfaces:**
- Produces: `window.api.exportLegendPdf(chart) -> Promise<{success, path?, canceled?, error?}>` (invokes `'export:legend-pdf'`), `window.api.exportLegendPng(dataUrl) -> Promise<{success, path?, canceled?, error?}>` (invokes `'export:legend-png'`).

- [ ] **Step 1: Replace `preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveProjectAs: (jsonString) => ipcRenderer.invoke('project:saveAs', jsonString),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportPng: (dataUrl) => ipcRenderer.invoke('export:png', dataUrl),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  exportLegendPdf: (chart) => ipcRenderer.invoke('export:legend-pdf', chart),
  exportLegendPng: (dataUrl) => ipcRenderer.invoke('export:legend-png', dataUrl),
});
```

- [ ] **Step 2: Verify with a syntax check**

Run: `node --check preload.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add preload.js
git commit -m "feat: expose exportLegendPdf/exportLegendPng from the preload bridge"
```

---

### Task 7: Modal markup for paper sizes, margin units, and the legend controls

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/styles.css`
- Modify: `tests/browser-load-order.test.js`

**Interfaces:**
- Produces: extended `#pdf-paper-size` `<select>` (10 options), a new `#pdf-margin-unit` `<select>` next to `#pdf-margin-mm`, a new `#pdf-include-legend` checkbox, and a new `#pdf-legend-download-btn` + `#pdf-legend-format` `<select>` pair — all inside the existing `#pdf-export-modal-box`. Also adds `<script src="../src/legend.js">` to the renderer's script load order, right after `instructions.js` and before `app.js`. Task 8 wires the new controls' behavior.

- [ ] **Step 1: Extend the paper size `<select>` in `renderer/index.html`**

Find:
```html
      <label>Format papier :<br />
        <select id="pdf-paper-size">
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </label><br />
```
Replace with:
```html
      <label>Format papier :<br />
        <select id="pdf-paper-size">
          <option value="A0">A0</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="A3">A3</option>
          <option value="A4" selected>A4</option>
          <option value="A5">A5</option>
          <option value="A6">A6</option>
          <option value="Legal">Legal</option>
          <option value="Ledger">Ledger</option>
          <option value="Letter">Letter</option>
        </select>
      </label><br />
```

- [ ] **Step 2: Add the margin unit selector next to the margin field**

Find:
```html
      <label>Marge (mm) :<br />
        <input type="number" id="pdf-margin-mm" value="10" min="0" />
      </label><br />
```
Replace with:
```html
      <label>Marge :<br />
        <div class="pdf-margin-row">
          <input type="number" id="pdf-margin-mm" value="10" min="0" />
          <select id="pdf-margin-unit">
            <option value="mm" selected>mm</option>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
      </label><br />
```

- [ ] **Step 3: Add the legend checkbox and the separate-download row**

Find:
```html
      <button id="pdf-export-confirm">Exporter</button>
      <button id="pdf-export-cancel">Annuler</button>
```
Replace with:
```html
      <label class="pdf-legend-checkbox-label">
        <input type="checkbox" id="pdf-include-legend" />
        Inclure la légende
      </label><br />
      <div class="pdf-legend-download-row">
        <button type="button" id="pdf-legend-download-btn">Télécharger la légende séparément…</button>
        <select id="pdf-legend-format">
          <option value="pdf" selected>PDF</option>
          <option value="png">PNG</option>
        </select>
      </div>
      <button id="pdf-export-confirm">Exporter</button>
      <button id="pdf-export-cancel">Annuler</button>
```

- [ ] **Step 4: Add the `legend.js` script tag**

Find:
```html
  <script src="../src/grid.js"></script>
  <script src="../src/palette.js"></script>
  <script src="../src/project.js"></script>
  <script src="../src/instructions.js"></script>
  <script src="app.js"></script>
```
Replace with:
```html
  <script src="../src/grid.js"></script>
  <script src="../src/palette.js"></script>
  <script src="../src/project.js"></script>
  <script src="../src/instructions.js"></script>
  <script src="../src/legend.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 5: Add layout CSS for the new controls**

Append to `renderer/styles.css`:
```css
.pdf-margin-row { display: flex; gap: 4px; }
.pdf-margin-row input, .pdf-margin-row select { flex: 1; width: auto; }
#pdf-export-modal-box input[type="checkbox"] { width: auto; }
.pdf-legend-checkbox-label { display: flex; align-items: center; gap: 6px; }
.pdf-legend-download-row { display: flex; gap: 4px; margin: 8px 0; }
.pdf-legend-download-row button { flex: 2; }
.pdf-legend-download-row select { flex: 1; width: auto; }
```

- [ ] **Step 6: Update the browser load-order regression test**

In `tests/browser-load-order.test.js`, find:
```js
  const files = [
    '../src/grid.js',
    '../src/palette.js',
    '../src/project.js',
    '../src/instructions.js',
  ];
```
Replace with:
```js
  const files = [
    '../src/grid.js',
    '../src/palette.js',
    '../src/project.js',
    '../src/instructions.js',
    '../src/legend.js',
  ];
```
And find:
```js
  expect(typeof context.createGrid).toBe('function');
  expect(typeof context.createPalette).toBe('function');
```
Replace with:
```js
  expect(typeof context.createGrid).toBe('function');
  expect(typeof context.createPalette).toBe('function');
  expect(typeof context.buildLegendRows).toBe('function');
```

- [ ] **Step 7: Run the full test suite**

Run: `npx jest`
Expected: PASS (all suites, including the updated `browser-load-order.test.js`).

- [ ] **Step 8: Manually verify the markup doesn't break page load**

Run: `npm start`
Expected: window opens with no console errors; the PDF export modal (still hidden until opened) now contains the extended paper size list, the margin+unit row, the legend checkbox, and the legend download row — verify by temporarily removing the `hidden` attribute in devtools or just proceeding to Task 8 where the modal becomes fully interactive again.

- [ ] **Step 9: Commit**

```bash
git add renderer/index.html renderer/styles.css tests/browser-load-order.test.js
git commit -m "feat: add v3 paper sizes, margin unit, and legend controls to the export modal markup"
```

---

### Task 8: Wire the new options and legend downloads in the renderer

**Files:**
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: `buildLegendRows` (global, from `src/legend.js`), `AppState.grid`/`AppState.palette`, `window.api.exportPdf` (unchanged preload signature, new payload shape), `window.api.exportLegendPdf`, `window.api.exportLegendPng` (new, from Task 6).
- Produces: the `pdf-export-confirm` handler now sends `{ orientation, paperSize, marginValue, marginUnit, instructionsPosition, includeLegend }` as `options`. A new `pdf-legend-download-btn` click handler exports the legend alone, in the format chosen by `#pdf-legend-format`, independently of the main "Exporter" button. A new `renderLegendCanvas(chart)` function renders the legend onto a detached `<canvas>` and returns a PNG data URL for the PNG legend path.

- [ ] **Step 1: Replace the `pdf-export-confirm` handler's option-building code**

Find:
```js
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

Replace with:
```js
document.getElementById('pdf-export-confirm').addEventListener('click', async () => {
  const orientation = document.querySelector('.pdf-orientation-btn.active').dataset.orientation;
  const paperSize = document.getElementById('pdf-paper-size').value;
  const marginValue = parseFloat(document.getElementById('pdf-margin-mm').value);
  const marginUnit = document.getElementById('pdf-margin-unit').value;
  const instructionsPosition = document.getElementById('pdf-instructions-position').value;
  const includeLegend = document.getElementById('pdf-include-legend').checked;

  if (!Number.isFinite(marginValue) || marginValue < 0) {
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
    options: { orientation, paperSize, marginValue, marginUnit, instructionsPosition, includeLegend },
  });

  if (result.success) {
    pdfExportModal.hidden = true;
  } else if (!result.canceled) {
    alert(`Erreur lors de l'export PDF : ${result.error}`);
  }
});
```

- [ ] **Step 2: Add `renderLegendCanvas` and the legend download handler**

Append at the end of `renderer/app.js`:
```js
function renderLegendCanvas(chart) {
  const rows = buildLegendRows(chart);
  const swatchSize = 24;
  const rowHeight = 32;
  const padding = 16;
  const fontSize = 16;

  const legendCanvas = document.createElement('canvas');
  const measureCtx = legendCanvas.getContext('2d');
  measureCtx.font = `${fontSize}px sans-serif`;
  let maxLabelWidth = 0;
  rows.forEach((row) => {
    const width = measureCtx.measureText(row.label).width;
    if (width > maxLabelWidth) maxLabelWidth = width;
  });

  legendCanvas.width = Math.ceil(padding * 3 + swatchSize + maxLabelWidth);
  legendCanvas.height = Math.ceil(padding * 2 + Math.max(rows.length, 1) * rowHeight);

  const ctx = legendCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, legendCanvas.width, legendCanvas.height);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';

  rows.forEach((row, index) => {
    const y = padding + index * rowHeight;
    ctx.fillStyle = row.hex;
    ctx.fillRect(padding, y, swatchSize, swatchSize);
    ctx.strokeStyle = '#333333';
    ctx.strokeRect(padding, y, swatchSize, swatchSize);
    ctx.fillStyle = '#000000';
    ctx.fillText(row.label, padding * 2 + swatchSize, y + swatchSize / 2);
  });

  return legendCanvas.toDataURL('image/png');
}

document.getElementById('pdf-legend-download-btn').addEventListener('click', async () => {
  const chart = {
    width: AppState.grid.width,
    height: AppState.grid.height,
    cells: AppState.grid.cells,
    palette: AppState.palette,
  };

  if (buildLegendRows(chart).length === 0) {
    alert('Aucune couleur n\'est utilisée dans la grille : rien à mettre dans la légende.');
    return;
  }

  const format = document.getElementById('pdf-legend-format').value;
  const result = format === 'png'
    ? await window.api.exportLegendPng(renderLegendCanvas(chart))
    : await window.api.exportLegendPdf(chart);

  if (!result.success && !result.canceled) {
    alert(`Erreur lors du téléchargement de la légende : ${result.error}`);
  }
});
```

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: PASS (all suites).

- [ ] **Step 4: Manually verify in the real app**

Run: `npm start`
Expected: paint a small motif with 2-3 colors, open "Exporter PDF" — the paper size list now shows A0-A6/Legal/Ledger/A4/Letter, the margin row has an mm/cm/in selector next to the number field, and there is an "Inclure la légende" checkbox plus a "Télécharger la légende séparément…" button with a PDF/PNG selector. Export the main PDF with the legend checkbox on and confirm the resulting PDF has a legend page (swatch + name + hex) right after the grid page(s) and before instructions. Use the separate download button to save the legend alone as PDF, then again as PNG, and open both to confirm they show the same colors/labels. Try the separate download with an empty grid (no colors painted) and confirm the alert appears instead of a broken export.

- [ ] **Step 5: Commit**

```bash
git add renderer/app.js
git commit -m "feat: wire margin units, legend checkbox, and separate legend downloads in the renderer"
```

---

## Self-Review Notes

- **Spec coverage:** paper sizes A0-A6/Legal/Ledger (Task 1, 5, 7), margin units mm/cm/in (Task 1, 4, 5, 7, 8), legend integrated in main PDF always right after the grid (Task 2, 3, 4), legend in a separate PDF or PNG file (Task 3, 5, 6, 7, 8), the intentional `marginMm` → `marginValue`+`marginUnit` breaking rename (Task 1, 4, 5, 8 — every producer/consumer updated together, no leftover reference), out-of-scope items (vector formats, custom paper dimensions, selected-area export, multiple open projects, image import, configurable legend position) are simply not implemented — no task references them.
- **No placeholders:** every step has complete, runnable code; the standalone legend PDF's fixed A4/40pt page geometry is an explicit, justified choice (documented in Task 3's Interfaces and inline code comment), not a TBD.
- **Type/interface consistency checked:** `chart` shape `{width, height, cells, palette}` is identical across `src/legend.js`, `src/export/legend.js`, `src/export/pdf.js`, `main.js`, and `renderer/app.js`. `buildLegendRows` returns `{hex, label}` consistently consumed by both `drawLegendSection` (Task 3) and `renderLegendCanvas` (Task 8). `options` field names (`orientation`, `paperSize`, `marginValue`, `marginUnit`, `instructionsPosition`, `includeLegend`) match exactly between the renderer payload (Task 8), the IPC handler's validation (Task 5), and `buildPdf`/`computePageLayout`'s destructuring (Task 1, 4) — no lingering `marginMm` anywhere after Task 8. `pageCtx = {pageHeightPt, marginPt, ensureFreshPage}` passed to `drawLegendSection` has the same three keys whether called from `buildPdf` (Task 4, using the grid's own layout) or from `buildLegendDocument` (Task 3, using the fixed standalone geometry).
