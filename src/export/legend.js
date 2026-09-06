const fs = require('fs');
const PDFDocument = require('pdfkit');
const { buildLegendRows } = require('../legend');

const SWATCH_SIZE_PT = 14;
const ROW_HEIGHT_PT = 20;
// Fixed page geometry for the standalone legend PDF (buildLegendDocument only)
// — it has no main export to inherit a paper size/orientation/margin from.
const LEGEND_PAGE_WIDTH_PT = 595.28; // A4 portrait
const LEGEND_PAGE_HEIGHT_PT = 841.89;
const LEGEND_MARGIN_PT = 40;

function drawLegendSection(doc, rows, pageCtx) {
  const { pageWidthPt, pageHeightPt, marginPt, ensureFreshPage } = pageCtx;
  const maxY = pageHeightPt - marginPt;
  const labelX = marginPt + SWATCH_SIZE_PT + 8;
  const labelWidth = pageWidthPt - marginPt - labelX;

  function writeHeading(text) {
    doc.fillColor('#000000').fontSize(14).text(text, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
  }

  ensureFreshPage();
  writeHeading('Légende');

  rows.forEach((row) => {
    if (doc.y + ROW_HEIGHT_PT > maxY) {
      ensureFreshPage();
      writeHeading('Légende (suite)');
    }
    const rowTop = doc.y;
    doc.rect(marginPt, rowTop, SWATCH_SIZE_PT, SWATCH_SIZE_PT).fillAndStroke(row.hex, '#333333');
    doc.fillColor('#000000').text(row.label, labelX, rowTop + 2, {
      width: labelWidth,
      height: SWATCH_SIZE_PT,
      lineBreak: false,
      ellipsis: true,
    });
    doc.y = rowTop + ROW_HEIGHT_PT;
  });
}

function buildLegendDocument({ chart, outputPath }) {
  return new Promise((resolve, reject) => {
    const pageSize = [LEGEND_PAGE_WIDTH_PT, LEGEND_PAGE_HEIGHT_PT];
    const margins = {
      top: LEGEND_MARGIN_PT,
      bottom: LEGEND_MARGIN_PT,
      left: LEGEND_MARGIN_PT,
      right: LEGEND_MARGIN_PT,
    };

    const doc = new PDFDocument({ size: pageSize, margins });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    let firstPageUsed = false;
    function ensureFreshPage() {
      if (firstPageUsed) {
        doc.addPage({ size: pageSize, margins });
      }
      firstPageUsed = true;
    }

    try {
      drawLegendSection(doc, buildLegendRows(chart), {
        pageWidthPt: LEGEND_PAGE_WIDTH_PT,
        pageHeightPt: LEGEND_PAGE_HEIGHT_PT,
        marginPt: LEGEND_MARGIN_PT,
        ensureFreshPage,
      });
    } catch (err) {
      stream.destroy();
      reject(err);
      return;
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { drawLegendSection, buildLegendDocument };
