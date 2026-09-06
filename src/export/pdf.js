const fs = require('fs');
const PDFDocument = require('pdfkit');
const { computePageLayout } = require('./page-layout');
const { buildLegendRows } = require('../legend');
const { drawLegendSection } = require('./legend');
const { getPdfTheme } = require('./pdf-theme');

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

    const pdfTheme = getPdfTheme(options.theme);

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

    // Corner marks — a small mitered bracket at each page corner, adapted from
    // the "planche imprimée" (specimen plate) reference layout: every page
    // reads as one consistent framed object, not a plain printout.
    function drawCornerMarks() {
      const inset = 14;
      const size = 12;
      doc.save().lineWidth(1.1).strokeColor(pdfTheme.accent);
      doc.moveTo(inset, inset + size).lineTo(inset, inset).lineTo(inset + size, inset).stroke();
      doc.moveTo(layout.pageWidthPt - inset - size, inset).lineTo(layout.pageWidthPt - inset, inset).lineTo(layout.pageWidthPt - inset, inset + size).stroke();
      doc.moveTo(inset, layout.pageHeightPt - inset - size).lineTo(inset, layout.pageHeightPt - inset).lineTo(inset + size, layout.pageHeightPt - inset).stroke();
      doc.moveTo(layout.pageWidthPt - inset - size, layout.pageHeightPt - inset).lineTo(layout.pageWidthPt - inset, layout.pageHeightPt - inset).lineTo(layout.pageWidthPt - inset, layout.pageHeightPt - inset - size).stroke();
      doc.restore();
    }

    let firstPageUsed = false;
    function ensureFreshPage() {
      if (firstPageUsed) {
        doc.addPage({ size: pageSize, margins });
      }
      firstPageUsed = true;
      doc.rect(0, 0, layout.pageWidthPt, layout.pageHeightPt).fill(pdfTheme.pageBg);
      drawCornerMarks();
    }

    // Cartouche — a small bordered specimen-label card, adapted from the same
    // reference: key/value rows instead of a plain sentence.
    function drawCartouche(rows) {
      const cartoucheWidth = 220;
      const rowHeight = 16;
      const padding = 10;
      const cartoucheHeight = padding * 2 + rows.length * rowHeight;
      const x = (layout.pageWidthPt - cartoucheWidth) / 2;
      const y = doc.y;

      doc.rect(x, y, cartoucheWidth, cartoucheHeight).fillAndStroke(pdfTheme.pageBg, pdfTheme.gridLine);
      doc.rect(x, y, cartoucheWidth, 3).fill(pdfTheme.accent);

      doc.font(pdfTheme.bodyFont).fontSize(9);
      rows.forEach(([label, value], i) => {
        const rowY = y + padding + i * rowHeight + 3;
        doc.fillColor(pdfTheme.gridLine).text(label.toUpperCase(), x + padding, rowY, { width: 90, characterSpacing: 0.5 });
        doc.fillColor(pdfTheme.text).text(value, x + padding + 90, rowY, { width: cartoucheWidth - padding * 2 - 90, align: 'right' });
      });

      doc.y = y + cartoucheHeight;
    }

    function drawCoverPage() {
      ensureFreshPage();
      const title = options.name && options.name.trim() !== '' ? options.name.trim() : 'Motif crochet';
      const usedColors = buildLegendRows(chart);

      doc.font(pdfTheme.headingFont).fillColor(pdfTheme.accent).fontSize(28).text(title, { align: 'center' });
      doc.moveDown(0.4);
      const ruleWidth = 60;
      doc.moveTo((layout.pageWidthPt - ruleWidth) / 2, doc.y)
        .lineTo((layout.pageWidthPt + ruleWidth) / 2, doc.y)
        .lineWidth(1.4)
        .strokeColor(pdfTheme.accent)
        .stroke();
      doc.moveDown(1.2);

      const modeLabel = options.mode === 'c2c' ? 'Corner-to-Corner' : 'Grille classique';
      drawCartouche([
        ['Dimensions', `${chart.width} x ${chart.height} mailles`],
        ['Couleurs', String(usedColors.length)],
        ['Mode', modeLabel],
      ]);
      doc.moveDown(1.5);

      if (usedColors.length > 0) {
        const swatchSize = 18;
        const gap = 6;
        const maxSwatches = Math.min(usedColors.length, 24);
        const totalWidth = maxSwatches * (swatchSize + gap) - gap;
        const startX = (layout.pageWidthPt - totalWidth) / 2;
        const y = doc.y;
        usedColors.slice(0, maxSwatches).forEach((row, i) => {
          doc.rect(startX + i * (swatchSize + gap), y, swatchSize, swatchSize).fillAndStroke(row.hex, pdfTheme.gridLine);
        });
      }
    }

    function writeInstructions() {
      ensureFreshPage();
      doc.font(pdfTheme.headingFont).fillColor(pdfTheme.accent).fontSize(14).text('Instructions', { underline: true });
      doc.moveDown(0.5);
      doc.font(pdfTheme.bodyFont).fillColor(pdfTheme.text).fontSize(11);
      instructions.forEach((line) => doc.text(line));
    }

    drawCoverPage();

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
              .fillAndStroke(hex, pdfTheme.gridLine);
          }
        }

        // Frame the drawn cells like a specimen plate, echoing the corner marks.
        doc
          .rect(
            layout.marginPt - 2,
            layout.marginPt - 2,
            (endX - startX) * layout.cellPt + 4,
            (endY - startY) * layout.cellPt + 4
          )
          .lineWidth(1.2)
          .strokeColor(pdfTheme.accent)
          .stroke();

        if (totalGridPages > 1) {
          doc
            .font(pdfTheme.bodyFont)
            .fontSize(9)
            .fillColor(pdfTheme.text)
            .text(`Page ${gridPageNum}/${totalGridPages}`, 0, layout.pageHeightPt - layout.marginPt - 14, {
              width: layout.pageWidthPt,
              align: 'center',
            });
        }
      }
    }

    if (options.includeLegend) {
      drawLegendSection(doc, buildLegendRows(chart), {
        pageWidthPt: layout.pageWidthPt,
        pageHeightPt: layout.pageHeightPt,
        marginPt: layout.marginPt,
        ensureFreshPage,
        theme: options.theme,
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
