const fs = require('fs');
const PDFDocument = require('pdfkit');
const { buildLegendRows } = require('../legend');
const { getPdfTheme } = require('./pdf-theme');

const SWATCH_SIZE_PT = 14;
const ROW_HEIGHT_PT = 20;
// Fixed page geometry for the standalone legend PDF (buildLegendDocument only)
// — it has no main export to inherit a paper size/orientation/margin from.
const LEGEND_PAGE_WIDTH_PT = 595.28; // A4 portrait
const LEGEND_PAGE_HEIGHT_PT = 841.89;
const LEGEND_MARGIN_PT = 40;

function drawLegendSection(doc, rows, pageCtx) {
  const { pageWidthPt, pageHeightPt, marginPt, ensureFreshPage, theme } = pageCtx;
  const pdfTheme = getPdfTheme(theme);
  const maxY = pageHeightPt - marginPt;
  const labelX = marginPt + SWATCH_SIZE_PT + 8;
  const labelWidth = pageWidthPt - marginPt - labelX;

  function writeHeading(text) {
    doc.font(pdfTheme.headingFont).fillColor(pdfTheme.accent).fontSize(14).text(text, { underline: true });
    doc.moveDown(0.5);
    doc.font(pdfTheme.bodyFont).fontSize(11);
  }

  ensureFreshPage();
  writeHeading('Légende');

  rows.forEach((row) => {
    if (doc.y + ROW_HEIGHT_PT > maxY) {
      ensureFreshPage();
      writeHeading('Légende (suite)');
    }
    const rowTop = doc.y;

    if (pdfTheme.legendStyle === 'card') {
      doc.roundedRect(marginPt, rowTop - 2, pageWidthPt - marginPt * 2, ROW_HEIGHT_PT - 2, 3).stroke(pdfTheme.gridLine);
    }

    if (pdfTheme.legendStyle === 'pelote') {
      const r = SWATCH_SIZE_PT / 2;
      doc.circle(marginPt + r, rowTop + r, r).fillAndStroke(row.hex, pdfTheme.gridLine);
    } else if (pdfTheme.cellRadius > 0) {
      doc.roundedRect(marginPt, rowTop, SWATCH_SIZE_PT, SWATCH_SIZE_PT, pdfTheme.cellRadius).fillAndStroke(row.hex, pdfTheme.gridLine);
    } else {
      doc.rect(marginPt, rowTop, SWATCH_SIZE_PT, SWATCH_SIZE_PT).fillAndStroke(row.hex, pdfTheme.gridLine);
    }

    doc.fillColor(pdfTheme.text).text(row.label, labelX, rowTop + 2, {
      width: labelWidth,
      height: SWATCH_SIZE_PT,
      lineBreak: false,
      ellipsis: true,
    });
    doc.y = rowTop + ROW_HEIGHT_PT;
  });
}

function buildLegendDocument({ chart, outputPath, theme }) {
  return new Promise((resolve, reject) => {
    const pdfTheme = getPdfTheme(theme);
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
      doc.rect(0, 0, LEGEND_PAGE_WIDTH_PT, LEGEND_PAGE_HEIGHT_PT).fill(pdfTheme.pageBg);
    }

    try {
      drawLegendSection(doc, buildLegendRows(chart), {
        pageWidthPt: LEGEND_PAGE_WIDTH_PT,
        pageHeightPt: LEGEND_PAGE_HEIGHT_PT,
        marginPt: LEGEND_MARGIN_PT,
        ensureFreshPage,
        theme,
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
