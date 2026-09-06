const { HEX_COLOR_PATTERN, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hexToHsv, hsvToHex } = require('../src/color-convert');

test('HEX_COLOR_PATTERN matches a well-formed 6-digit hex code', () => {
  expect(HEX_COLOR_PATTERN.test('#87CEEB')).toBe(true);
});

test('HEX_COLOR_PATTERN rejects malformed input', () => {
  expect(HEX_COLOR_PATTERN.test('87CEEB')).toBe(false);
  expect(HEX_COLOR_PATTERN.test('#87CEE')).toBe(false);
  expect(HEX_COLOR_PATTERN.test('#87ZZEB')).toBe(false);
});

test('hexToRgb parses a 6-digit hex code into its RGB components', () => {
  expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
});

test('hexToRgb is case-insensitive', () => {
  expect(hexToRgb('#FF9900')).toEqual({ r: 255, g: 153, b: 0 });
});

test('rgbToHex formats RGB components as a lowercase zero-padded hex code', () => {
  expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
  expect(rgbToHex({ r: 0, g: 5, b: 0 })).toBe('#000500');
});

test('rgbToHsv converts pure red to hue 0, full saturation and value', () => {
  expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
});

test('rgbToHsv converts pure green to hue 120', () => {
  expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, v: 1 });
});

test('rgbToHsv converts pure blue to hue 240', () => {
  expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, v: 1 });
});

test('rgbToHsv converts black to zero saturation and value', () => {
  expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
});

test('rgbToHsv converts white to zero saturation and full value', () => {
  expect(rgbToHsv({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, v: 1 });
});

test('rgbToHsv converts a mid gray to zero saturation and partial value', () => {
  const { h, s, v } = rgbToHsv({ r: 128, g: 128, b: 128 });
  expect(h).toBe(0);
  expect(s).toBe(0);
  expect(v).toBeCloseTo(128 / 255, 5);
});

test('hsvToRgb converts hue 0, full saturation and value back to pure red', () => {
  expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
});

test('hsvToRgb converts hue 120, full saturation and value back to pure green', () => {
  expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
});

test('hsvToRgb converts hue 240, full saturation and value back to pure blue', () => {
  expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
});

test('hsvToRgb converts zero saturation and value to black regardless of hue', () => {
  expect(hsvToRgb({ h: 200, s: 0, v: 0 })).toEqual({ r: 0, g: 0, b: 0 });
});

test('hexToHsv and hsvToHex round-trip a set of sample colors', () => {
  const samples = ['#ff0000', '#00ff00', '#0000ff', '#87ceeb', '#ffffff', '#000000', '#808080'];
  samples.forEach((hex) => {
    expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });
});
