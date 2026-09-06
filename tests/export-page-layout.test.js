const { computePageLayout } = require('../src/export/page-layout');

test('a grid that fits the printable area needs exactly one page', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide for one page splits into two page-columns', () => {
  const layout = computePageLayout({ width: 40, height: 20, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide and too tall splits into a 2x2 page grid', () => {
  const layout = computePageLayout({ width: 70, height: 100, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(2);
});

test('switching orientation can reduce the total page count for the same grid', () => {
  const portrait = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  const landscape = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'landscape', marginValue: 10, marginUnit: 'mm' });
  expect(portrait.pagesX * portrait.pagesY).toBe(2);
  expect(landscape.pagesX * landscape.pagesY).toBe(1);
});

test('throws on an unknown paper size', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A7', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' }))
    .toThrow(/format papier/i);
});

test('throws when the margin leaves no printable area', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 150, marginUnit: 'mm' }))
    .toThrow(/marge/i);
});

test('throws when the margin leaves less than one full cell of printable width', () => {
  // marginValue=103mm on A4 portrait: printableWidthPt ~= 11.34pt, positive
  // but smaller than CELL_PT (14pt) -- must be rejected rather than silently
  // clamped to 1 cell per page-column.
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 103, marginUnit: 'mm' }))
    .toThrow(/marge/i);
});

test('throws on an unknown margin unit', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'furlong' }))
    .toThrow(/unité de marge/i);
});

test('mm, cm, and in margin units convert to the same point value', () => {
  const mm = computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  const cm = computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 1, marginUnit: 'cm' });
  const inch = computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginValue: 10 / 25.4, marginUnit: 'in' });
  expect(cm.marginPt).toBeCloseTo(mm.marginPt, 6);
  expect(inch.marginPt).toBeCloseTo(mm.marginPt, 6);
});

test('a 20x20 grid fits on a single A3 page at 10mm margin', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'A3', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});

test('a 20x20 grid fits on a single Legal page at 10mm margin', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'Legal', orientation: 'portrait', marginValue: 10, marginUnit: 'mm' });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});
