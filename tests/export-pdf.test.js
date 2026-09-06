const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPdf } = require('../src/export/pdf');

function countPdfPages(filePath) {
  const bytes = fs.readFileSync(filePath);
  const matches = bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

function makeChart(width, height) {
  const palette = [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }];
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => 'c1'));
  return { width, height, cells, palette };
}

test('a grid that fits one page produces one grid page plus one instructions page', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-single.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: ['Rang 1 : 20 mailles Rouge'],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'after', includeLegend: false },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});

test('including the legend adds exactly one extra page for a small palette', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-legend.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: true },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});

test('a grid needing two page-columns produces two grid pages with no legend/instructions', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-multipage.pdf`);
  await buildPdf({
    chart: makeChart(50, 20),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: false },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});

test('legend appears after grid and before after-positioned instructions', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-legend-and-after.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: ['Rang 1 : 20 mailles Rouge'],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'after', includeLegend: true },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(3);
  fs.unlinkSync(outputPath);
});

test('legend appears after grid even with before-positioned instructions', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-legend-and-before.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: ['Rang 1 : 20 mailles Rouge'],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'before', includeLegend: true },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(3);
  fs.unlinkSync(outputPath);
});
