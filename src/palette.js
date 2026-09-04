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
