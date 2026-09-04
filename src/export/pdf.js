const fs = require('fs');
const PDFDocument = require('pdfkit');

function buildPdf({ imageDataUrl, instructions, outputPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64, 'base64');

    doc.image(imageBuffer, { fit: [500, 500], align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Instructions', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    instructions.forEach((line) => doc.text(line));

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { buildPdf };
