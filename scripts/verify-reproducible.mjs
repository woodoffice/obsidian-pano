import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const scratch = await mkdtemp(join(tmpdir(), 'pano-reproducible-'));
try {
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'esbuild.config.mjs', 'src', 'test']) {
    await cp(new URL(name, root), join(scratch, name), { recursive: true });
  }
  await mkdir(join(scratch, '.npm-cache'), { recursive: true });
  for (const args of [
    ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(scratch, '.npm-cache')],
    ['run', 'build'],
  ]) {
    const result = spawnSync('npm', args, { cwd: scratch, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Clean build failed');
  }
  assert.deepEqual(await readFile(join(scratch, 'main.js')), await readFile(new URL('main.js', root)));
  console.log('Fresh npm ci and production build produced an identical main.js.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}
