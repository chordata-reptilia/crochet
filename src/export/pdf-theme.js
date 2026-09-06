const DEFAULT_PDF_THEME = 'graphite';

// Printable, light-background counterparts of the 4 screen themes
// (renderer/styles.css) — a PDF meant to be printed should not waste ink
// on a dark page background regardless of which on-screen mode is active,
// so these always use each theme's light palette.
const PDF_THEMES = {
  graphite: {
    pageBg: '#FFFFFF',
    text: '#1A1B1E',
    accent: '#1A1B1E',
    gridLine: '#B5B7BB',
    headingFont: 'Courier-Bold',
    bodyFont: 'Courier',
    frameStyle: 'solid',
    cellRadius: 0,
    legendStyle: 'swatch',
    showMarginGuide: true,
    showRowColNumbers: true,
  },
  granny: {
    pageBg: '#FBF6EC',
    text: '#2E2A22',
    accent: '#2BB3A3',
    gridLine: '#C9B79A',
    headingFont: 'Helvetica-Bold',
    bodyFont: 'Helvetica',
    frameStyle: 'triple-dashed',
    roundColors: ['#2BB3A3', '#F2C14E', '#FF6B57'],
    cellRadius: 2,
    legendStyle: 'pelote',
  },
  lightstick: {
    pageBg: '#FFFFFF',
    text: '#221B3D',
    accent: '#0FBBDA',
    accent2: '#D6299B',
    gridLine: '#D9D2F5',
    headingFont: 'Helvetica-Bold',
    bodyFont: 'Helvetica',
    frameStyle: 'gradient',
    cellRadius: 0,
    legendStyle: 'card',
    bannerCover: true,
  },
  washi: {
    pageBg: '#F4EFE6',
    text: '#2A2623',
    accent: '#C8462E',
    gridLine: '#2A2623',
    headingFont: 'Times-Bold',
    bodyFont: 'Times-Roman',
    frameStyle: 'ink',
    cellRadius: 0,
    legendStyle: 'swatch',
    verticalTitle: true,
    showHanko: true,
    hankoChar: '心',
  },
};

function getPdfTheme(theme) {
  return PDF_THEMES[theme] || PDF_THEMES[DEFAULT_PDF_THEME];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getPdfTheme, PDF_THEMES, DEFAULT_PDF_THEME };
}
