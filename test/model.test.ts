import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destination, emptyData, fitFrame, nextSceneName, parseData, renameCanvasPaths, SceneStore, validFrame, type Scene } from '../src/model.ts';

const scene = (id: string, name = id): Scene => ({ id, name, frame: { x: -100.25, y: 200.5, width: 800, height: 400 } });

void test('frame fitting restores exact geometry and contains the saved view at a different aspect ratio', () => {
  const frame = scene('a').frame;
  const camera = fitFrame(frame, 800, 400);
  assert.deepEqual(camera, { x: 299.75, y: 400.5, zoom: 0 });
  const portrait = fitFrame(frame, 400, 800);
  const scale = 2 ** portrait.zoom;
  const visible = { width: 400 / scale, height: 800 / scale };
  assert.equal(portrait.x, camera.x);
  assert.equal(portrait.y, camera.y);
  assert.ok(visible.width >= frame.width && visible.height >= frame.height);
  assert.equal(Math.min(visible.width / frame.width, visible.height / frame.height), 1);
});

void test('camera follows the verified native zoom range and rejects hidden or invalid frames', () => {
  assert.equal(fitFrame({ x: 0, y: 0, width: 1e9, height: 1e9 }, 800, 600).zoom, -4);
  assert.equal(fitFrame({ x: 0, y: 0, width: 1, height: 1 }, 800, 600).zoom, 1);
  for (const width of [0, -1, Infinity, NaN]) assert.throws(() => fitFrame(scene('a').frame, width, 600));
  for (const patch of [{ x: NaN }, { y: Infinity }, { width: 0 }, { height: -1 }, { x: Number.MAX_VALUE, width: Number.MAX_VALUE }]) {
    assert.equal(validFrame({ ...scene('a').frame, ...patch }), false);
  }
});

void test('navigation starts from either end, stops at boundaries and follows IDs after reorder', () => {
  const scenes = [scene('a'), scene('b'), scene('c')];
  assert.equal(destination(scenes, null, 1)?.id, 'a');
  assert.equal(destination(scenes, null, -1)?.id, 'c');
  assert.equal(destination(scenes, 'a', -1), undefined);
  assert.equal(destination(scenes, 'c', 1), undefined);
  assert.equal(destination(scenes, 'b', 1)?.id, 'c');
  assert.equal(destination([scenes[1], scenes[0], scenes[2]], 'b', 1)?.id, 'a');
  assert.equal(destination([], null, 1), undefined);
  assert.equal(destination([scene('a')], 'a', 1), undefined);
  assert.equal(destination(scenes, 'deleted', 1)?.id, 'a');
});

void test('scene names avoid existing numbered names', () => {
  assert.equal(nextSceneName([scene('a', 'Scene 1'), scene('b', 'Scene 3')]), 'Scene 2');
});

void test('schema validation rejects damaged or future data without silently resetting it', () => {
  const data = emptyData();
  data.canvases['Board.canvas'] = { scenes: [scene('a')] };
  assert.deepEqual(parseData(data), data);
  assert.deepEqual(parseData(null), emptyData());
  assert.throws(() => parseData({ ...data, version: 2 }));
  assert.throws(() => parseData({}));
  assert.throws(() => parseData({ ...data, canvases: { 'Board.canvas': { scenes: [scene('a'), scene('a')] } } }));
  assert.throws(() => parseData({ ...data, canvases: { 'Board.canvas': { scenes: [{ ...scene('a'), frame: { ...scene('a').frame, width: 0 } }] } } }));
  const withExtra = { ...data, extra: 'retain me' };
  assert.deepEqual(parseData(withExtra), withExtra);
});

void test('upgrading existing scene data adds animation preferences without changing scenes', () => {
  const original = { version: 1, settings: { showNavigator: false }, canvases: { 'Board.canvas': { scenes: [scene('a')] } } };
  const upgraded = parseData(original);
  assert.deepEqual(upgraded.settings, { showNavigator: false, animateSceneChanges: true });
  assert.deepEqual(upgraded.canvases, original.canvases);
  assert.deepEqual(original.settings, { showNavigator: false });
  assert.throws(() => parseData({ ...original, settings: { showNavigator: true, animateSceneChanges: 'yes' } }));
});

void test('settings persist together with scenes, and an explicit animation preference survives reload', async () => {
  const data = emptyData();
  data.canvases['Board.canvas'] = { scenes: [scene('a')] };
  let saved = data;
  const store = new SceneStore(data, async next => { saved = next; });
  await store.update(next => { next.settings.animateSceneChanges = false; next.settings.showNavigator = false; });
  const reloaded = new SceneStore(parseData(saved), async () => {});
  assert.deepEqual(reloaded.settings, { showNavigator: false, animateSceneChanges: false });
  assert.deepEqual(reloaded.scenes('Board.canvas'), [scene('a')]);
});

void test('file and folder renames preserve frames and leave sibling paths alone', () => {
  const data = emptyData();
  data.canvases['Project/A.canvas'] = { scenes: [scene('a')] };
  data.canvases['Project/Nested/B.canvas'] = { scenes: [scene('b')] };
  data.canvases['Project-two/A.canvas'] = { scenes: [scene('c')] };
  renameCanvasPaths(data, 'Project', 'Renamed');
  assert.deepEqual(Object.keys(data.canvases).sort(), ['Project-two/A.canvas', 'Renamed/A.canvas', 'Renamed/Nested/B.canvas']);
  renameCanvasPaths(data, 'Renamed/A.canvas', 'Renamed/C.canvas');
  assert.equal(data.canvases['Renamed/C.canvas'].scenes[0].id, 'a');
});

void test('rename collisions preserve both sets and never partially remap a folder', () => {
  const data = emptyData();
  for (const path of ['Old/A.canvas', 'Old/B.canvas', 'New/B.canvas']) data.canvases[path] = { scenes: [scene(path)] };
  const original = structuredClone(data);
  assert.throws(() => renameCanvasPaths(data, 'Old', 'New'));
  assert.deepEqual(data, original);
});

void test('writes are serialized and new changes build on the last durable state', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const writes: number[] = [];
  const store = new SceneStore(emptyData(), async data => {
    writes.push(data.canvases['A.canvas'].scenes.length);
    if (writes.length === 1) await gate;
  });
  const first = store.update(data => { data.canvases['A.canvas'] = { scenes: [scene('a')] }; });
  const second = store.update(data => { data.canvases['A.canvas'].scenes.push(scene('b')); });
  await Promise.resolve();
  assert.deepEqual(writes, [1]);
  assert.equal(store.scenes('A.canvas').length, 0);
  release?.();
  await Promise.all([first, second]);
  assert.deepEqual(writes, [1, 2]);
  assert.deepEqual(store.scenes('A.canvas').map(scene => scene.id), ['a', 'b']);
});

void test('a failed save rolls back memory and the next edit can succeed', async () => {
  let fail = true;
  let notifications = 0;
  const store = new SceneStore(emptyData(), async () => { if (fail) throw new Error('disk full'); });
  store.subscribe(() => { notifications++; });
  await assert.rejects(store.update(data => { data.canvases['A.canvas'] = { scenes: [scene('a')] }; }));
  assert.equal(store.scenes('A.canvas').length, 0);
  assert.equal(notifications, 0);
  fail = false;
  await store.update(data => { data.canvases['A.canvas'] = { scenes: [scene('b')] }; });
  assert.equal(store.scenes('A.canvas')[0].id, 'b');
  assert.equal(notifications, 1);
});

void test('invalid-load mode refuses writes and never invokes persistence', async () => {
  let calls = 0;
  const store = new SceneStore(emptyData(), async () => { calls++; }, 'Invalid data preserved');
  await assert.rejects(store.update(data => { data.settings.showNavigator = false; }), /Invalid data preserved/);
  assert.equal(calls, 0);
  assert.equal(store.showNavigator, true);
});
