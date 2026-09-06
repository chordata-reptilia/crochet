const { buildLegendRows } = require('../src/legend');

test('omits palette colors never painted on the grid', () => {
  const chart = {
    width: 2,
    height: 1,
    cells: [['c1', null]],
    palette: [
      { id: 'c1', name: 'Rouge', hex: '#ff0000' },
      { id: 'c2', name: 'Bleu', hex: '#0000ff' },
    ],
  };
  const rows = buildLegendRows(chart);
  expect(rows).toEqual([{ hex: '#ff0000', label: 'Rouge (#ff0000)' }]);
});

test('uses the hex code as the label when the color has no name', () => {
  const chart = {
    width: 1,
    height: 1,
    cells: [['c1']],
    palette: [{ id: 'c1', name: '', hex: '#00ff00' }],
  };
  const rows = buildLegendRows(chart);
  expect(rows).toEqual([{ hex: '#00ff00', label: '#00ff00' }]);
});

test('returns an empty list for a fully empty grid', () => {
  const chart = {
    width: 2,
    height: 2,
    cells: [[null, null], [null, null]],
    palette: [{ id: 'c1', name: 'Rouge', hex: '#ff0000' }],
  };
  expect(buildLegendRows(chart)).toEqual([]);
});

test('keeps palette order, not usage order', () => {
  const chart = {
    width: 2,
    height: 1,
    cells: [['c2', 'c1']],
    palette: [
      { id: 'c1', name: 'Rouge', hex: '#ff0000' },
      { id: 'c2', name: 'Bleu', hex: '#0000ff' },
    ],
  };
  const rows = buildLegendRows(chart);
  expect(rows).toEqual([
    { hex: '#ff0000', label: 'Rouge (#ff0000)' },
    { hex: '#0000ff', label: 'Bleu (#0000ff)' },
  ]);
});
