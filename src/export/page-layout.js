const PAPER_SIZES_PT = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

const CELL_PT = 14;
const MM_TO_PT = 72 / 25.4;

function computePageLayout({ width, height, paperSize, orientation, marginMm }) {
  const base = PAPER_SIZES_PT[paperSize];
  if (!base) {
    throw new Error(`Format papier inconnu : ${paperSize}. Formats supportés : A4, Letter.`);
  }

  const pageWidthPt = orientation === 'landscape' ? base.height : base.width;
  const pageHeightPt = orientation === 'landscape' ? base.width : base.height;
  const marginPt = marginMm * MM_TO_PT;
  const printableWidthPt = pageWidthPt - 2 * marginPt;
  const printableHeightPt = pageHeightPt - 2 * marginPt;

  if (printableWidthPt <= 0 || printableHeightPt <= 0) {
    throw new Error('La marge choisie est trop grande pour ce format de papier.');
  }

  const cellsPerPageX = Math.max(1, Math.floor(printableWidthPt / CELL_PT));
  const cellsPerPageY = Math.max(1, Math.floor(printableHeightPt / CELL_PT));

  return {
    pagesX: Math.ceil(width / cellsPerPageX),
    pagesY: Math.ceil(height / cellsPerPageY),
    cellsPerPageX,
    cellsPerPageY,
    cellPt: CELL_PT,
    pageWidthPt,
    pageHeightPt,
    marginPt,
  };
}

module.exports = { computePageLayout };
