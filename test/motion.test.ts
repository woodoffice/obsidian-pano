import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sceneFlight } from '../src/motion.ts';

void test('flight starts at the current frame and lands exactly on the destination', () => {
  const start = { x: -400, y: -200, width: 800, height: 400 };
  const target = { x: 2400, y: 900, zoom: -1 };
  const flight = sceneFlight(start, target, 800);
  assert.deepEqual(flight.at(0), { x: 0, y: 0, zoom: 0 });
  assert.deepEqual(flight.at(1), target);
  assert.deepEqual(flight.at(2), target);
  assert.deepEqual(flight.at(0.5), { x: 1200, y: 450, zoom: Math.log2(800 / (1200 + Math.hypot(2400, 900) * 0.04)) });
});

void test('travel gently pulls back while keeping native zoom limits', () => {
  const flight = sceneFlight({ x: -400, y: -200, width: 800, height: 400 }, { x: 4000, y: 0, zoom: 0 }, 800);
  assert.ok(flight.at(0.5).zoom < 0);
  assert.equal(flight.at(0.5).zoom, Math.log2(800 / 896));
  for (const zoom of [-4, 1]) {
    const bounded = sceneFlight({ x: 0, y: 0, width: 800 / 2 ** zoom, height: 600 / 2 ** zoom }, { x: 10000, y: -10000, zoom }, 800);
    for (let step = 0; step <= 100; step++) {
      const pose = bounded.at(step / 100);
      assert.ok(pose.zoom >= -4 && pose.zoom <= 1);
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
  }
});

void test('duration grows with distance and stays bounded; camera position has no overshoot', () => {
  const start = { x: -400, y: -200, width: 800, height: 400 };
  const short = sceneFlight(start, { x: 80, y: 0, zoom: 0 }, 800);
  const long = sceneFlight(start, { x: 80000, y: 0, zoom: 0 }, 800);
  assert.ok(short.duration >= 280 && short.duration < long.duration);
  assert.equal(long.duration, 550);
  let previous = 0;
  for (let step = 0; step <= 100; step++) {
    const pose = long.at(step / 100);
    assert.ok(pose.x >= previous && pose.x <= 80000);
    previous = pose.x;
  }
});
