const { createProject, serializeProject, deserializeProject } = require('../src/project');

test('createProject builds a project matching the spec schema', () => {
  const project = createProject({ name: 'Mon motif', mode: 'classic', width: 4, height: 3 });
  expect(project.name).toBe('Mon motif');
  expect(project.mode).toBe('classic');
  expect(project.width).toBe(4);
  expect(project.height).toBe(3);
  expect(project.palette).toEqual([]);
  expect(project.cells).toHaveLength(3);
  expect(project.cells[0]).toHaveLength(4);
  expect(project.cells[0][0]).toBeNull();
});

test('serializeProject then deserializeProject round-trips exactly', () => {
  const project = createProject({ name: 'Mon motif', mode: 'c2c', width: 2, height: 2 });
  project.palette.push({ id: 'c1', name: 'Bleu', hex: '#0000FF' });
  project.cells[0][0] = 'c1';

  const json = serializeProject(project);
  const restored = deserializeProject(json);

  expect(restored).toEqual(project);
});

test('deserializeProject rejects invalid JSON', () => {
  expect(() => deserializeProject('not json')).toThrow(/invalid|parse/i);
});

test('deserializeProject rejects a JSON object missing required fields', () => {
  expect(() => deserializeProject(JSON.stringify({ name: 'x' }))).toThrow(/mode|width|height|palette|cells/i);
});

test('deserializeProject rejects an unknown mode', () => {
  const bad = JSON.stringify({ name: 'x', mode: 'weird', width: 1, height: 1, palette: [], cells: [[null]] });
  expect(() => deserializeProject(bad)).toThrow(/mode/i);
});
