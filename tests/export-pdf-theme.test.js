const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { buildPdf } = require('../src/export/pdf');

// pdfkit compresses content streams (FlateDecode) by default, so a raw byte
// search for theme colors doesn't work — decompress every stream we can and
// concatenate them, skipping any that aren't valid Flate (e.g. embedded fonts).
function extractDecompressedStreams(filePath) {
  const bytes = fs.readFileSync(filePath);
  const text = bytes.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  const decoded = [];
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    const raw = Buffer.from(match[1], 'latin1');
    try {
      decoded.push(zlib.inflateSync(raw).toString('latin1'));
    } catch (err) {
      // Not Flate-compressed (or not valid Flate) — not page content, skip it.
    }
  }
  return decoded.join('\n');
}

function makeChart(width, height) {
  const palette = [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }];
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => 'c1'));
  return { width, height, cells, palette };
}

test('buildPdf output actually changes when the theme option changes', async () => {
  const basePath = path.join(os.tmpdir(), `pdf-theme-test-${Date.now()}`);
  const graphitePath = `${basePath}-graphite.pdf`;
  const washiPath = `${basePath}-washi.pdf`;

  const commonArgs = {
    chart: makeChart(10, 10),
    instructions: ['Rang 1 : 10 mailles Rouge'],
  };

  await buildPdf({
    ...commonArgs,
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'after', includeLegend: false, theme: 'graphite' },
    outputPath: graphitePath,
  });
  await buildPdf({
    ...commonArgs,
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'after', includeLegend: false, theme: 'washi' },
    outputPath: washiPath,
  });

  const graphiteContent = extractDecompressedStreams(graphitePath);
  const washiContent = extractDecompressedStreams(washiPath);

  expect(graphiteContent.length).toBeGreaterThan(0);
  expect(washiContent.length).toBeGreaterThan(0);
  expect(graphiteContent).not.toBe(washiContent);

  fs.unlinkSync(graphitePath);
  fs.unlinkSync(washiPath);
});

test('buildPdf still succeeds when no theme option is given (falls back to the default theme)', async () => {
  const outputPath = path.join(os.tmpdir(), `pdf-theme-test-${Date.now()}-default.pdf`);
  await buildPdf({
    chart: makeChart(10, 10),
    instructions: [],
    options: { orientation: 'portrait', paperSize: 'A4', marginValue: 10, marginUnit: 'mm', instructionsPosition: 'none', includeLegend: false },
    outputPath,
  });
  expect(fs.existsSync(outputPath)).toBe(true);
  fs.unlinkSync(outputPath);
});
