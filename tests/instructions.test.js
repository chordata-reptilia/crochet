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
