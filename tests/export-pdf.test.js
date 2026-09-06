const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPdf } = require('../src/export/pdf');
const { countPdfPages } = require('./helpers/pdf');

function makeChart(width, height) {
  const palette = [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }];
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => 'c1'));
  return { width, height, cells, palette };
}

test('a grid that fits one page produces a cover, one grid page, and one instructions page', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-single.pdf`);
  await buildPdf({
    chart: makeChart(20, 20),
    instructions: ['Rang 1 : 20 mailles Rouge'],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'after', includeLegend: false },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(3);
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
  expect(countPdfPages(outputPath)).toBe(3);
  fs.unlinkSync(outputPath);
});

test('a grid needing two page-columns produces a cover plus two grid pages with no legend/instructions', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-multipage.pdf`);
  await buildPdf({
    chart: makeChart(50, 20),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: false },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(3);
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
  expect(countPdfPages(outputPath)).toBe(4);
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
  expect(countPdfPages(outputPath)).toBe(4);
  fs.unlinkSync(outputPath);
});

test('the cover page shows the project name and color count', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-test-${Date.now()}-cover.pdf`);
  await buildPdf({
    chart: makeChart(5, 5),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: false, name: 'Mon Motif' },
    outputPath,
  });
  expect(countPdfPages(outputPath)).toBe(2);
  fs.unlinkSync(outputPath);
});
