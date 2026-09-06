const fs = require('fs');

function countPdfPages(filePath) {
  const bytes = fs.readFileSync(filePath);
  const matches = bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

module.exports = { countPdfPages };
