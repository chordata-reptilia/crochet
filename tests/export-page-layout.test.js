const { computePageLayout } = require('../src/export/page-layout');

test('a grid that fits the printable area needs exactly one page', () => {
  const layout = computePageLayout({ width: 20, height: 20, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  expect(layout.pagesX).toBe(1);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide for one page splits into two page-columns', () => {
  const layout = computePageLayout({ width: 40, height: 20, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(1);
});

test('a grid too wide and too tall splits into a 2x2 page grid', () => {
  const layout = computePageLayout({ width: 70, height: 100, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  expect(layout.pagesX).toBe(2);
  expect(layout.pagesY).toBe(2);
});

test('switching orientation can reduce the total page count for the same grid', () => {
  const portrait = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'portrait', marginMm: 10 });
  const landscape = computePageLayout({ width: 50, height: 30, paperSize: 'A4', orientation: 'landscape', marginMm: 10 });
  expect(portrait.pagesX * portrait.pagesY).toBe(2);
  expect(landscape.pagesX * landscape.pagesY).toBe(1);
});

test('throws on an unknown paper size', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A3', orientation: 'portrait', marginMm: 10 }))
    .toThrow(/format papier/i);
});

test('throws when the margin leaves no printable area', () => {
  expect(() => computePageLayout({ width: 10, height: 10, paperSize: 'A4', orientation: 'portrait', marginMm: 150 }))
    .toThrow(/marge/i);
});
