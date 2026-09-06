const fs = require('fs');
const PDFDocument = require('pdfkit');
const { computePageLayout } = require('./page-layout');
const { buildLegendRows } = require('../legend');
const { drawLegendSection } = require('./legend');

function cellColorHex(chart, colorId) {
  if (!colorId) return '#ffffff';
  const color = chart.palette.find((c) => c.id === colorId);
  return color ? color.hex : '#ffffff';
}

function buildPdf({ chart, instructions, options, outputPath }) {
  return new Promise((resolve, reject) => {
    let layout;
    try {
      layout = computePageLayout({
        width: chart.width,
        height: chart.height,
        paperSize: options.paperSize,
        orientation: options.orientation,
        marginValue: options.marginValue,
        marginUnit: options.marginUnit,
      });
    } catch (err) {
      reject(err);
      return;
    }

    const pageSize = [layout.pageWidthPt, layout.pageHeightPt];
    const margins = {
      top: layout.marginPt,
      bottom: layout.marginPt,
      left: layout.marginPt,
      right: layout.marginPt,
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

    function writeInstructions() {
      ensureFreshPage();
      doc.fillColor('#000000').fontSize(14).text('Instructions', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      instructions.forEach((line) => doc.text(line));
    }

    if (options.instructionsPosition === 'before') {
      writeInstructions();
    }

    const totalGridPages = layout.pagesX * layout.pagesY;
    let gridPageNum = 0;

    for (let py = 0; py < layout.pagesY; py++) {
      for (let px = 0; px < layout.pagesX; px++) {
        ensureFreshPage();
        gridPageNum++;

        const startX = px * layout.cellsPerPageX;
        const startY = py * layout.cellsPerPageY;
        const endX = Math.min(startX + layout.cellsPerPageX, chart.width);
        const endY = Math.min(startY + layout.cellsPerPageY, chart.height);

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const hex = cellColorHex(chart, chart.cells[y][x]);
            doc
              .rect(
                layout.marginPt + (x - startX) * layout.cellPt,
                layout.marginPt + (y - startY) * layout.cellPt,
                layout.cellPt,
                layout.cellPt
              )
              .fillAndStroke(hex, '#dddddd');
          }
        }

        if (totalGridPages > 1) {
          doc
            .fontSize(9)
            .fillColor('#000000')
            .text(`Page ${gridPageNum}/${totalGridPages}`, 0, layout.pageHeightPt - layout.marginPt - 14, {
              width: layout.pageWidthPt,
              align: 'center',
            });
        }
      }
    }

    if (options.includeLegend) {
      drawLegendSection(doc, buildLegendRows(chart), {
        pageHeightPt: layout.pageHeightPt,
        marginPt: layout.marginPt,
        ensureFreshPage,
      });
    }

    if (options.instructionsPosition === 'after') {
      writeInstructions();
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { buildPdf };
