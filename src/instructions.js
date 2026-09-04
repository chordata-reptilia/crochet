function colorLabel(palette, colorId) {
  if (colorId === null) return '(vide)';
  const color = palette.find((c) => c.id === colorId);
  if (!color) return 'Couleur inconnue';
  return color.name && color.name.trim() !== '' ? color.name : color.hex;
}

function stitchWord(count) {
  return count === 1 ? 'maille' : 'mailles';
}

function groupRun(rowIds, palette) {
  const parts = [];
  let i = 0;
  while (i < rowIds.length) {
    const colorId = rowIds[i];
    let count = 1;
    while (i + count < rowIds.length && rowIds[i + count] === colorId) count++;
    parts.push(`${count} ${stitchWord(count)} ${colorLabel(palette, colorId)}`);
    i += count;
  }
  return parts.join(', ');
}

function generateClassicInstructions(project) {
  return project.cells.map((row, index) => `Rang ${index + 1} : ${groupRun(row, project.palette)}`);
}

function generateC2CInstructions(project) {
  const { width, height, cells, palette } = project;
  const lines = [];
  const maxDiagonal = width + height - 2;

  for (let d = 0; d <= maxDiagonal; d++) {
    const runIds = [];
    const xStart = Math.max(0, d - height + 1);
    const xEnd = Math.min(d, width - 1);
    for (let x = xStart; x <= xEnd; x++) {
      const y = d - x;
      runIds.push(cells[y][x]);
    }
    lines.push(`Bloc ${d + 1} : ${groupRun(runIds, palette)}`);
  }

  return lines;
}

function generateInstructions(project) {
  if (project.mode === 'classic') return generateClassicInstructions(project);
  if (project.mode === 'c2c') return generateC2CInstructions(project);
  throw new Error(`Mode d'instructions inconnu : ${project.mode}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateInstructions, generateClassicInstructions, generateC2CInstructions };
}
