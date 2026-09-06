const AppState = {
  grid: createGrid(20, 20),
  palette: [],
  mode: 'classic',
  name: 'Nouveau motif',
  cellSize: 24,
  zoom: 1,
  activeTool: 'brush',
  activeColorId: null,
};

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
  renderInstructions();
}

function redo() {
  if (History.index === History.stack.length - 1) return;
  History.index += 1;
  AppState.grid = History.stack[History.index];
  renderGrid();
  renderInstructions();
}

const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');

function renderGrid() {
  const { grid, cellSize, zoom } = AppState;
  const size = cellSize * zoom;
  canvas.width = grid.width * size;
  canvas.height = grid.height * size;

  const themeVars = getComputedStyle(document.documentElement);
  const emptyCellBg = themeVars.getPropertyValue('--grid-empty-bg').trim() || '#ffffff';
  const gridLine = themeVars.getPropertyValue('--grid-line').trim() || '#dddddd';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const colorId = getCell(grid, x, y);
      const color = colorId ? findColor(AppState.palette || [], colorId) : null;
      ctx.fillStyle = color ? color.hex : emptyCellBg;
      ctx.fillRect(x * size, y * size, size, size);
      ctx.strokeStyle = gridLine;
      ctx.strokeRect(x * size, y * size, size, size);
    }
  }
}

function canvasEventToCell(evt) {
  const rect = canvas.getBoundingClientRect();
  const size = AppState.cellSize * AppState.zoom;
  // Scale by the ratio of the canvas's internal (backing-store) resolution to
  // its displayed CSS size, so clicks stay accurate even if CSS ever stretches
  // the canvas away from its intrinsic width/height (e.g. flexbox stretch).
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((evt.clientX - rect.left) * scaleX) / size);
  const y = Math.floor(((evt.clientY - rect.top) * scaleY) / size);
  return { x, y };
}

function applyToolAt(x, y) {
  const { grid, activeTool, activeColorId } = AppState;
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;

  let nextGrid = grid;
  if (activeTool === 'brush') {
    if (getCell(grid, x, y) === activeColorId) return;
    nextGrid = setCell(grid, x, y, activeColorId);
  } else if (activeTool === 'eraser') {
    if (getCell(grid, x, y) === null) return;
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
  }
  renderGrid();
  renderInstructions();
}

let isPointerDown = false;
let strokeStartGrid = null;

canvas.addEventListener('pointerdown', (evt) => {
  isPointerDown = true;
  strokeStartGrid = AppState.grid;
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
  // Record undo history once per whole stroke (pointerdown -> pointerup),
  // not once per cell painted along the way.
  if (isPointerDown && strokeStartGrid !== null && AppState.grid !== strokeStartGrid) {
    pushHistory(AppState.grid);
  }
  isPointerDown = false;
  strokeStartGrid = null;
});

document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    AppState.activeTool = btn.dataset.tool;
  });
});

document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);

document.getElementById('zoom-in').addEventListener('click', () => {
  AppState.zoom = Math.min(AppState.zoom + 0.25, 3);
  renderGrid();
});

document.getElementById('zoom-out').addEventListener('click', () => {
  AppState.zoom = Math.max(AppState.zoom - 0.25, 0.25);
  renderGrid();
});

canvas.addEventListener('wheel', (evt) => {
  // Ctrl+wheel zooms; plain wheel (vertical) and Shift+wheel (horizontal)
  // are left alone so the browser's native scrolling of #workspace still
  // works for panning the grid.
  if (!evt.ctrlKey) return;
  evt.preventDefault();
  if (evt.deltaY < 0) {
    AppState.zoom = Math.min(AppState.zoom + 0.25, 3);
  } else if (evt.deltaY > 0) {
    AppState.zoom = Math.max(AppState.zoom - 0.25, 0.25);
  }
  renderGrid();
}, { passive: false });

window.addEventListener('keydown', (evt) => {
  const isTypingContext = evt.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(evt.target.tagName);
  if (isTypingContext) return;

  const key = evt.key.toLowerCase();
  const primaryModifier = evt.ctrlKey || evt.metaKey;

  if (primaryModifier && key === 'z' && !evt.shiftKey) {
    evt.preventDefault();
    undo();
    return;
  }
  if (primaryModifier && (key === 'y' || (key === 'z' && evt.shiftKey))) {
    evt.preventDefault();
    redo();
    return;
  }

  const anyModalOpen = !newProjectModal.hidden || !pdfExportModal.hidden || !settingsModal.hidden || !resizeProjectModal.hidden;

  if (primaryModifier) {
    if (key === 'n') { evt.preventDefault(); if (!anyModalOpen) document.getElementById('new-project-btn').click(); }
    else if (key === 'o') { evt.preventDefault(); if (!anyModalOpen) document.getElementById('open-project-btn').click(); }
    else if (key === 's') { evt.preventDefault(); if (!anyModalOpen) document.getElementById('save-project-btn').click(); }
    else if (evt.shiftKey && key === 'p') { evt.preventDefault(); if (!anyModalOpen) document.getElementById('export-png-btn').click(); }
    else if (evt.shiftKey && key === 'd') { evt.preventDefault(); if (!anyModalOpen) document.getElementById('export-pdf-btn').click(); }
    else if (key === '=' || key === '+') { evt.preventDefault(); document.getElementById('zoom-in').click(); }
    else if (key === '-') { evt.preventDefault(); document.getElementById('zoom-out').click(); }
    return;
  }

  if (anyModalOpen) return;

  if (key === '1') document.getElementById('tool-brush').click();
  else if (key === '2') document.getElementById('tool-bucket').click();
  else if (key === '3') document.getElementById('tool-eraser').click();
  else if (key === '4') document.getElementById('tool-eyedropper').click();
});

const colorGridEl = document.getElementById('color-grid');
const colorDetailRowEl = document.getElementById('color-detail-row');
const colorDetailNameEl = document.getElementById('color-detail-name');

function renderPalette() {
  colorGridEl.innerHTML = '';
  AppState.palette.forEach((color) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-grid-swatch' + (color.id === AppState.activeColorId ? ' active' : '');
    swatch.style.backgroundColor = color.hex;
    swatch.title = color.name ? `${color.name} (${color.hex})` : color.hex;
    swatch.addEventListener('click', () => {
      AppState.activeColorId = color.id;
      renderPalette();
    });
    colorGridEl.appendChild(swatch);
  });

  const activeColor = findColor(AppState.palette, AppState.activeColorId);
  if (activeColor) {
    colorDetailRowEl.hidden = false;
    colorDetailNameEl.value = activeColor.name;
  } else {
    colorDetailRowEl.hidden = true;
  }
}

colorDetailNameEl.addEventListener('change', () => {
  if (!AppState.activeColorId) return;
  AppState.palette = renameColor(AppState.palette, AppState.activeColorId, colorDetailNameEl.value);
  renderPalette();
  renderInstructions();
});

document.getElementById('color-detail-remove').addEventListener('click', () => {
  if (!AppState.activeColorId) return;
  AppState.palette = removeColor(AppState.palette, AppState.activeColorId);
  AppState.activeColorId = null;
  renderPalette();
  renderInstructions();
});

const colorPicker = createColorPicker({
  svCanvas: document.getElementById('color-picker-sv'),
  hueCanvas: document.getElementById('color-picker-hue'),
  shadesRow: document.getElementById('color-picker-shades'),
  hexInput: document.getElementById('new-color-hex'),
  previewEl: document.getElementById('color-picker-preview'),
  initialHex: '#ff0000',
});

document.getElementById('add-color-btn').addEventListener('click', () => {
  const hex = colorPicker.getHex();

  AppState.palette = addColor(AppState.palette, hex, '');
  AppState.activeColorId = AppState.palette[AppState.palette.length - 1].id;
  renderPalette();
  renderInstructions();
});

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

window.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  renderPalette();
  renderInstructions();
});

function loadProjectIntoState(project) {
  AppState.grid = { width: project.width, height: project.height, cells: project.cells };
  AppState.palette = project.palette;
  AppState.mode = project.mode;
  AppState.name = project.name;
  AppState.activeColorId = null;
  History.stack = [AppState.grid];
  History.index = 0;
  document.getElementById('mode-select').value = project.mode;
  renderGrid();
  renderPalette();
  renderInstructions();
}

const newProjectModal = document.getElementById('new-project-modal');

document.getElementById('new-project-btn').addEventListener('click', () => {
  document.getElementById('new-project-name').value = 'Nouveau motif';
  document.getElementById('new-project-width').value = '20';
  document.getElementById('new-project-height').value = '20';
  document.getElementById('new-project-mode').value = 'classic';
  newProjectModal.hidden = false;
});

document.getElementById('new-project-cancel').addEventListener('click', () => {
  newProjectModal.hidden = true;
});

document.getElementById('new-project-confirm').addEventListener('click', () => {
  const name = document.getElementById('new-project-name').value.trim() || 'Nouveau motif';
  const width = parseInt(document.getElementById('new-project-width').value, 10);
  const height = parseInt(document.getElementById('new-project-height').value, 10);
  const mode = document.getElementById('new-project-mode').value;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    alert('Largeur et hauteur doivent être des nombres entiers positifs.');
    return;
  }
  const project = createProject({ name, mode, width, height });
  loadProjectIntoState(project);
  newProjectModal.hidden = true;
});

const resizeProjectModal = document.getElementById('resize-project-modal');

document.getElementById('resize-project-btn').addEventListener('click', () => {
  document.getElementById('resize-project-width').value = String(AppState.grid.width);
  document.getElementById('resize-project-height').value = String(AppState.grid.height);
  resizeProjectModal.hidden = false;
});

document.getElementById('resize-project-cancel').addEventListener('click', () => {
  resizeProjectModal.hidden = true;
});

document.getElementById('resize-project-confirm').addEventListener('click', () => {
  const width = parseInt(document.getElementById('resize-project-width').value, 10);
  const height = parseInt(document.getElementById('resize-project-height').value, 10);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    alert('Largeur et hauteur doivent être des nombres entiers positifs.');
    return;
  }
  pushHistory(AppState.grid);
  AppState.grid = resizeGrid(AppState.grid, width, height);
  resizeProjectModal.hidden = true;
  renderGrid();
  renderInstructions();
});

document.querySelectorAll('.grid-add-btn').forEach((btn) => {
  btn.addEventListener('click', (evt) => {
    const count = evt.ctrlKey || evt.metaKey ? 10 : 1;
    const side = btn.dataset.side;
    pushHistory(AppState.grid);
    if (side === 'top' || side === 'bottom') {
      AppState.grid = addRows(AppState.grid, count, side);
    } else {
      AppState.grid = addColumns(AppState.grid, count, side);
    }
    renderGrid();
    renderInstructions();
  });
});

document.getElementById('save-project-btn').addEventListener('click', async () => {
  const project = {
    name: AppState.name,
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

document.getElementById('export-png-btn').addEventListener('click', async () => {
  const dataUrl = canvas.toDataURL('image/png');
  const result = await window.api.exportPng(dataUrl);
  if (!result.success && !result.canceled) {
    alert(`Erreur lors de l'export PNG : ${result.error}`);
  }
});

const pdfExportModal = document.getElementById('pdf-export-modal');

document.getElementById('export-pdf-btn').addEventListener('click', () => {
  pdfExportModal.hidden = false;
  refreshPdfPreview();
});

document.getElementById('pdf-export-cancel').addEventListener('click', () => {
  pdfExportModal.hidden = true;
});

document.querySelectorAll('.pdf-orientation-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pdf-orientation-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    refreshPdfPreview();
  });
});

function readPdfExportOptions() {
  const orientation = document.querySelector('.pdf-orientation-btn.active').dataset.orientation;
  const paperSize = document.getElementById('pdf-paper-size').value;
  const marginValue = parseFloat(document.getElementById('pdf-margin-mm').value);
  const marginUnit = document.getElementById('pdf-margin-unit').value;
  const instructionsPosition = document.getElementById('pdf-instructions-position').value;
  const includeLegend = document.getElementById('pdf-include-legend').checked;

  if (!Number.isFinite(marginValue) || marginValue < 0) {
    return { error: 'La marge doit être un nombre positif.' };
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
  const chart = getCurrentChart();

  return {
    payload: {
      chart,
      instructions,
      options: { orientation, paperSize, marginValue, marginUnit, instructionsPosition, includeLegend, theme: document.documentElement.dataset.theme, name: AppState.name, mode: AppState.mode },
    },
  };
}

document.getElementById('pdf-export-confirm').addEventListener('click', async () => {
  const { payload, error } = readPdfExportOptions();
  if (error) {
    alert(error);
    return;
  }

  const result = await window.api.exportPdf(payload);

  if (result.success) {
    pdfExportModal.hidden = true;
  } else if (!result.canceled) {
    alert(`Erreur lors de l'export PDF : ${result.error}`);
  }
});

const pdfReader = createPdfReader({
  canvas: document.getElementById('pdf-preview-canvas'),
  pageLabelEl: document.getElementById('pdf-preview-page-label'),
  thumbRailEl: document.getElementById('pdf-thumb-rail'),
  prevBtn: document.getElementById('pdf-preview-prev-btn'),
  nextBtn: document.getElementById('pdf-preview-next-btn'),
  zoomInBtn: document.getElementById('pdf-preview-zoom-in-btn'),
  zoomOutBtn: document.getElementById('pdf-preview-zoom-out-btn'),
  fitBtn: document.getElementById('pdf-preview-fit-btn'),
  fullscreenBtn: document.getElementById('pdf-preview-fullscreen-btn'),
  fullscreenTarget: document.getElementById('pdf-canvas-viewport'),
});

let pdfPreviewRequestId = 0;

async function refreshPdfPreview() {
  const requestId = ++pdfPreviewRequestId;
  const previewError = document.getElementById('pdf-preview-error');
  const { payload, error } = readPdfExportOptions();

  if (error) {
    previewError.textContent = error;
    previewError.hidden = false;
    return;
  }

  const result = await window.api.previewPdf(payload);
  if (requestId !== pdfPreviewRequestId) return; // a newer change superseded this request

  if (result.success) {
    try {
      await pdfReader.load();
      if (requestId !== pdfPreviewRequestId) return;
      previewError.hidden = true;
    } catch (err) {
      if (requestId !== pdfPreviewRequestId) return;
      previewError.textContent = `Aperçu indisponible : ${err.message}`;
      previewError.hidden = false;
    }
  } else {
    previewError.textContent = `Aperçu indisponible : ${result.error}`;
    previewError.hidden = false;
  }
}

let pdfPreviewDebounceTimer = null;
function schedulePdfPreviewRefresh() {
  clearTimeout(pdfPreviewDebounceTimer);
  pdfPreviewDebounceTimer = setTimeout(refreshPdfPreview, 400);
}

document.getElementById('pdf-paper-size').addEventListener('change', refreshPdfPreview);
document.getElementById('pdf-margin-mm').addEventListener('input', schedulePdfPreviewRefresh);
document.getElementById('pdf-margin-unit').addEventListener('change', refreshPdfPreview);
document.getElementById('pdf-instructions-position').addEventListener('change', refreshPdfPreview);
document.getElementById('pdf-include-legend').addEventListener('change', refreshPdfPreview);

function getCurrentChart() {
  return {
    width: AppState.grid.width,
    height: AppState.grid.height,
    cells: AppState.grid.cells,
    palette: AppState.palette,
  };
}

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
  const chart = getCurrentChart();

  if (buildLegendRows(chart).length === 0) {
    alert('Aucune couleur n\'est utilisée dans la grille : rien à mettre dans la légende.');
    return;
  }

  const format = document.getElementById('pdf-legend-format').value;
  const theme = document.documentElement.dataset.theme;
  const result = format === 'png'
    ? await window.api.exportLegendPng(renderLegendCanvas(chart))
    : await window.api.exportLegendPdf({ chart, theme });

  if (!result.success && !result.canceled) {
    alert(`Erreur lors du téléchargement de la légende : ${result.error}`);
  }
});

const THEME_STORAGE_KEY = 'crochet-theme';
const VALID_THEMES = ['graphite', 'granny', 'lightstick', 'washi'];

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('.theme-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  renderGrid();
}

function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored)) return stored;
  } catch (err) {
    // localStorage unavailable (e.g. disabled) — fall back to the default theme.
  }
  return document.documentElement.dataset.theme;
}

applyTheme(loadStoredTheme());

document.querySelectorAll('.theme-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      // localStorage unavailable — the choice just won't persist across restarts.
    }
  });
});

const MODE_STORAGE_KEY = 'crochet-mode';
const VALID_MODES = ['light', 'dark'];

function applyMode(mode) {
  document.documentElement.dataset.mode = mode;
  document.querySelectorAll('.mode-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderGrid();
}

function loadStoredMode() {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored)) return stored;
  } catch (err) {
    // localStorage unavailable (e.g. disabled) — fall back to the default mode.
  }
  return document.documentElement.dataset.mode;
}

applyMode(loadStoredMode());

document.querySelectorAll('.mode-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    applyMode(mode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (err) {
      // localStorage unavailable — the choice just won't persist across restarts.
    }
  });
});

const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
  settingsModal.hidden = false;
});
document.getElementById('settings-close').addEventListener('click', () => {
  settingsModal.hidden = true;
});
