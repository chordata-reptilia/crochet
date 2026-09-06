const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Simulates the actual browser <script> load order from renderer/index.html:
//   grid.js -> palette.js -> color-convert.js -> project.js -> instructions.js
//   -> legend.js -> color-picker.js
// All files are loaded as plain (non-module) scripts into ONE shared
// global context, exactly like the browser does. This guards against
// regressions like project.js using top-level `const createGrid = require(...)`
// which collides with the global `function createGrid` already installed by
// grid.js and throws a SyntaxError/ReferenceError that silently aborts the
// whole script, leaving createProject/serializeProject/deserializeProject
// undefined in the renderer.
test('renderer script load order defines createProject/serializeProject/deserializeProject with no errors', () => {
  const files = [
    '../src/grid.js',
    '../src/palette.js',
    '../src/color-convert.js',
    '../src/project.js',
    '../src/instructions.js',
    '../src/legend.js',
    '../renderer/color-picker.js',
  ];

  const context = {};
  vm.createContext(context);

  for (const relPath of files) {
    const filePath = path.join(__dirname, relPath);
    const source = fs.readFileSync(filePath, 'utf8');
    expect(() => {
      vm.runInContext(source, context, { filename: filePath });
    }).not.toThrow();
  }

  expect(typeof context.createProject).toBe('function');
  expect(typeof context.serializeProject).toBe('function');
  expect(typeof context.deserializeProject).toBe('function');
  expect(typeof context.createGrid).toBe('function');
  expect(typeof context.createPalette).toBe('function');
  expect(typeof context.buildLegendRows).toBe('function');
  expect(typeof context.hexToHsv).toBe('function');
  expect(typeof context.createColorPicker).toBe('function');
});
