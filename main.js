const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { buildPdf } = require('./src/export/pdf');

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
