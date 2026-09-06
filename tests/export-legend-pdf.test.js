const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLegendDocument } = require('../src/export/legend');

function countPdfPages(filePath) {
  const bytes = fs.readFileSync(filePath);
  const matches = bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

function makeChart(colorCount) {
  const palette = [];
  const cells = [[]];
  for (let i = 0; i < colorCount; i++) {
    const id = `c${i}`;
    palette.push({ id, name: `Couleur ${i}`, hex: '#ff0000' });
    cells[0].push(id);
  }
  return { width: colorCount, height: 1, cells, palette };
}

test('a legend with few colors fits on a single page', async () => {
  const outputPath = path.join(os.tmpdir(), `legend-test-${Date.now()}-small.pdf`);
  await buildLegendDocument({ chart: makeChart(3), outputPath });
  expect(countPdfPages(outputPath)).toBe(1);
  fs.unlinkSync(outputPath);
});

test('a legend with many colors spans multiple pages', async () => {
  const outputPath = path.join(os.tmpdir(), `legend-test-${Date.now()}-large.pdf`);
  await buildLegendDocument({ chart: makeChart(50), outputPath });
  expect(countPdfPages(outputPath)).toBeGreaterThan(1);
  fs.unlinkSync(outputPath);
});

test('a legend with zero used colors still produces a valid one-page PDF', async () => {
  const outputPath = path.join(os.tmpdir(), `legend-test-${Date.now()}-empty.pdf`);
  await buildLegendDocument({ chart: { width: 1, height: 1, cells: [[null]], palette: [] }, outputPath });
  expect(countPdfPages(outputPath)).toBe(1);
  fs.unlinkSync(outputPath);
});
