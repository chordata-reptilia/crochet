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
    pushHistory(nextGrid);
  }
  renderGrid();
  renderInstructions();
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
      renderInstructions();
    });

    const removeBtn = document.createElement('span');
    removeBtn.className = 'swatch-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      AppState.palette = removeColor(AppState.palette, color.id);
      if (AppState.activeColorId === color.id) AppState.activeColorId = null;
      renderPalette();
      renderInstructions();
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

document.getElementById('new-project-btn').addEventListener('click', () => {
  const widthInput = window.prompt('Largeur de la grille (mailles) :', '20');
  if (widthInput === null) return; // user canceled
  const heightInput = window.prompt('Hauteur de la grille (mailles) :', '20');
  if (heightInput === null) return;
  const width = parseInt(widthInput, 10);
  const height = parseInt(heightInput, 10);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    alert('Largeur et hauteur doivent être des nombres entiers positifs.');
    return;
  }
  const modeInput = window.confirm('Cliquez OK pour le mode Corner-to-Corner (C2C), ou Annuler pour le mode grille classique.');
  const mode = modeInput ? 'c2c' : 'classic';
  const nameInput = window.prompt('Nom du motif :', 'Nouveau motif') || 'Nouveau motif';
  const project = createProject({ name: nameInput, mode, width, height });
  loadProjectIntoState(project);
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
