const { createPalette, addColor, removeColor, renameColor, findColor } = require('../src/palette');

test('createPalette starts empty', () => {
  expect(createPalette()).toEqual([]);
});

test('addColor appends a color with a generated id', () => {
  const palette = addColor(createPalette(), '#87CEEB', 'Bleu ciel');
  expect(palette).toHaveLength(1);
  expect(palette[0].hex).toBe('#87CEEB');
  expect(palette[0].name).toBe('Bleu ciel');
  expect(typeof palette[0].id).toBe('string');
  expect(palette[0].id.length).toBeGreaterThan(0);
});

test('addColor defaults name to empty string', () => {
  const palette = addColor(createPalette(), '#FFFFFF');
  expect(palette[0].name).toBe('');
});

test('two added colors get different ids', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111');
  palette = addColor(palette, '#222222');
  expect(palette[0].id).not.toBe(palette[1].id);
});

test('removeColor removes only the matching color', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111', 'A');
  palette = addColor(palette, '#222222', 'B');
  const idToRemove = palette[0].id;
  const result = removeColor(palette, idToRemove);
  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('B');
});

test('renameColor updates only the name of the matching color', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111', 'A');
  const id = palette[0].id;
  const result = renameColor(palette, id, 'A renamed');
  expect(result[0].name).toBe('A renamed');
  expect(result[0].hex).toBe('#111111');
});

test('findColor returns the matching color or undefined', () => {
  let palette = createPalette();
  palette = addColor(palette, '#111111', 'A');
  const id = palette[0].id;
  expect(findColor(palette, id).name).toBe('A');
  expect(findColor(palette, 'nope')).toBeUndefined();
});
