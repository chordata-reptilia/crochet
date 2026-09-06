const PAPER_SIZES_PT = {
  A0: { width: 2383.94, height: 3370.39 },
  A1: { width: 1683.78, height: 2383.94 },
  A2: { width: 1190.55, height: 1683.78 },
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  A6: { width: 297.64, height: 419.53 },
  Legal: { width: 612.0, height: 1008.0 },
  Ledger: { width: 792.0, height: 1224.0 },
  Letter: { width: 612, height: 792 },
};

const CELL_PT = 14;
// Vertical space reserved on every grid page for the "Page X/Y" footer text,
// so the footer never overlaps the last row of drawn cells.
const FOOTER_HEIGHT_PT = 14;

const MARGIN_UNIT_TO_PT = {
  mm: 72 / 25.4,
  cm: 72 / 2.54,
  in: 72,
};

function computePageLayout({ width, height, paperSize, orientation, marginValue, marginUnit }) {
  const base = PAPER_SIZES_PT[paperSize];
  if (!base) {
    throw new Error(`Format papier inconnu : ${paperSize}. Formats supportés : ${Object.keys(PAPER_SIZES_PT).join(', ')}.`);
  }

  const unitToPt = MARGIN_UNIT_TO_PT[marginUnit];
  if (!unitToPt) {
    throw new Error(`Unité de marge inconnue : ${marginUnit}. Unités supportées : mm, cm, in.`);
  }

  const pageWidthPt = orientation === 'landscape' ? base.height : base.width;
  const pageHeightPt = orientation === 'landscape' ? base.width : base.height;
  const marginPt = marginValue * unitToPt;
  const printableWidthPt = pageWidthPt - 2 * marginPt;
  const printableHeightPt = pageHeightPt - 2 * marginPt - FOOTER_HEIGHT_PT;

  if (printableWidthPt <= 0 || printableHeightPt <= 0) {
    throw new Error('La marge choisie est trop grande pour ce format de papier.');
  }

  if (printableWidthPt < CELL_PT || printableHeightPt < CELL_PT) {
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
