const { getPdfTheme, DEFAULT_PDF_THEME } = require('../src/export/pdf-theme');

test('returns a full style token set for each of the 4 validated themes', () => {
  ['graphite', 'granny', 'lightstick', 'washi'].forEach((theme) => {
    const style = getPdfTheme(theme);
    expect(style).toEqual(expect.objectContaining({
      pageBg: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      text: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      accent: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      gridLine: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      headingFont: expect.any(String),
      bodyFont: expect.any(String),
      frameStyle: expect.stringMatching(/^(solid|triple-dashed|gradient|ink)$/),
      cellRadius: expect.any(Number),
      legendStyle: expect.stringMatching(/^(swatch|pelote|card)$/),
    }));
  });
});

test('graphite shows the margin guide and row/column numbers, with no per-cell symbols', () => {
  const style = getPdfTheme('graphite');
  expect(style.showMarginGuide).toBe(true);
  expect(style.showRowColNumbers).toBe(true);
  expect(style.cellSymbols).toBeUndefined();
});

test('granny uses a triple-dashed frame with a 3-color round sequence', () => {
  const style = getPdfTheme('granny');
  expect(style.frameStyle).toBe('triple-dashed');
  expect(style.roundColors).toHaveLength(3);
  style.roundColors.forEach((c) => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
});

test('lightstick uses a banner cover and gradient frame', () => {
  const style = getPdfTheme('lightstick');
  expect(style.bannerCover).toBe(true);
  expect(style.frameStyle).toBe('gradient');
});

test('washi uses a vertical title and a hanko seal', () => {
  const style = getPdfTheme('washi');
  expect(style.verticalTitle).toBe(true);
  expect(style.showHanko).toBe(true);
  expect(typeof style.hankoChar).toBe('string');
  expect(style.hankoChar.length).toBeGreaterThan(0);
});

test('each theme has visually distinct tokens (no two themes share the same accent)', () => {
  const accents = ['graphite', 'granny', 'lightstick', 'washi'].map((theme) => getPdfTheme(theme).accent);
  expect(new Set(accents).size).toBe(accents.length);
});

test('falls back to the default theme for an unknown theme name', () => {
  expect(getPdfTheme('does-not-exist')).toEqual(getPdfTheme(DEFAULT_PDF_THEME));
});

test('falls back to the default theme when no theme is given', () => {
  expect(getPdfTheme(undefined)).toEqual(getPdfTheme(DEFAULT_PDF_THEME));
});

test('the default theme is one of the 4 validated themes', () => {
  expect(['graphite', 'granny', 'lightstick', 'washi']).toContain(DEFAULT_PDF_THEME);
});
