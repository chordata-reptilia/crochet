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
    }));
  });
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
