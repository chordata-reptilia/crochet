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
