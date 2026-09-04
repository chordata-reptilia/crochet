function createProject({ name, mode, width, height }) {
  const _createGrid = typeof require === 'function' ? require('./grid').createGrid : createGrid;
  const _createPalette = typeof require === 'function' ? require('./palette').createPalette : createPalette;
  const grid = _createGrid(width, height);
  return {
    name,
    mode,
    width,
    height,
    palette: _createPalette(),
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
