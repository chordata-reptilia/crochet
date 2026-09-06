function createGrid(width, height) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    cells.push(new Array(width).fill(null));
  }
  return { width, height, cells };
}

function getCell(grid, x, y) {
  return grid.cells[y][x];
}

function cloneCells(cells) {
  return cells.map((row) => row.slice());
}

function setCell(grid, x, y, colorId) {
  const cells = cloneCells(grid.cells);
  cells[y][x] = colorId;
  return { width: grid.width, height: grid.height, cells };
}

function resizeGrid(grid, newWidth, newHeight) {
  const cells = [];
  for (let y = 0; y < newHeight; y++) {
    const row = new Array(newWidth).fill(null);
    if (y < grid.height) {
      for (let x = 0; x < Math.min(newWidth, grid.width); x++) {
        row[x] = grid.cells[y][x];
      }
    }
    cells.push(row);
  }
  return { width: newWidth, height: newHeight, cells };
}

function addRows(grid, count, side) {
  const newRows = Array.from({ length: count }, () => new Array(grid.width).fill(null));
  const cells = side === 'top' ? [...newRows, ...cloneCells(grid.cells)] : [...cloneCells(grid.cells), ...newRows];
  return { width: grid.width, height: grid.height + count, cells };
}

function addColumns(grid, count, side) {
  const cells = cloneCells(grid.cells).map((row) => {
    const newCells = new Array(count).fill(null);
    return side === 'left' ? [...newCells, ...row] : [...row, ...newCells];
  });
  return { width: grid.width + count, height: grid.height, cells };
}

function floodFill(grid, startX, startY, colorId) {
  const targetColor = getCell(grid, startX, startY);
  if (targetColor === colorId) {
    return { width: grid.width, height: grid.height, cells: cloneCells(grid.cells) };
  }

  const cells = cloneCells(grid.cells);
  const stack = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) continue;
    if (cells[y][x] !== targetColor) continue;

    cells[y][x] = colorId;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { width: grid.width, height: grid.height, cells };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGrid, getCell, setCell, resizeGrid, addRows, addColumns, floodFill };
}
