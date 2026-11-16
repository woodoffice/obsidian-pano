import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const pkg = JSON.parse(await read('package.json'));
const lock = JSON.parse(await read('package-lock.json'));
const versions = JSON.parse(await read('versions.json'));
assert.match(manifest.id, /^[a-z][a-z-]*$/);
assert.ok(!manifest.id.includes('obsidian') && !manifest.id.endsWith('plugin'));
assert.equal(manifest.name, 'Pano');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.match(manifest.minAppVersion, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.version, lock.version);
assert.equal(manifest.version, lock.packages[''].version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.equal(manifest.isDesktopOnly, true);
assert.equal(manifest.author, 'WOOD OFFICE');
assert.ok(manifest.description.length > 0 && manifest.description.length <= 250);
assert.ok(manifest.description.endsWith('.') && /^[\x20-\x7e]+$/.test(manifest.description));
if (process.env.RELEASE_VERSION) assert.equal(process.env.RELEASE_VERSION, manifest.version, 'Tag must match the manifest version without a v prefix');

const css = await read('styles.css');
assert.doesNotMatch(css, /!\s*important\b/i, 'CSS override repeats the Minimo scorecard issue');
assert.doesNotMatch(css, /@import\b|url\(\s*['"]?https?:/i, 'Ship local styling without remote assets');
assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i, 'Use theme variables for colors');

const bundle = await read('main.js');
const runtimeImports = [...bundle.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(match => match[1]);
assert.deepEqual([...new Set(runtimeImports)], ['obsidian'], 'Only the Obsidian host module is external at runtime');
assert.doesNotMatch(bundle, /\beval\s*\(|\bnew\s+Function\s*\(/, 'Do not use dynamic code evaluation');
assert.doesNotMatch(bundle, /\bconsole\.(?:log|debug|info)\s*\(/, 'No production debug logging');
const syntax = spawnSync(process.execPath, ['--check', new URL('../main.js', import.meta.url).pathname], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr);

assert.match(await read('LICENSE'), /MIT License/);
const readme = await read('README.md');
assert.match(readme, /Settings/);
assert.match(readme, /internal Canvas camera/);
assert.match(readme, /network requests/i);
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  const file = new URL(`../${name}`, import.meta.url);
  assert.ok((await stat(file)).size > 0);
  const hash = createHash('sha256').update(await readFile(file)).digest('hex');
  console.log(`${name}: ${hash}`);
}
console.log(`Local release checks passed for ${manifest.name} ${manifest.version}. Obsidian's hosted preview scan is a separate check.`);
