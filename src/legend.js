function buildLegendRows(chart) {
  const usedIds = new Set();
  for (let y = 0; y < chart.height; y++) {
    for (let x = 0; x < chart.width; x++) {
      const id = chart.cells[y][x];
      if (id) usedIds.add(id);
    }
  }

  return chart.palette
    .filter((color) => usedIds.has(color.id))
    .map((color) => ({
      hex: color.hex,
      label: color.name && color.name.trim() !== '' ? `${color.name} (${color.hex})` : color.hex,
    }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildLegendRows };
}
