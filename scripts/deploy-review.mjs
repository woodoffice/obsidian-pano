import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const target = new URL('work/Canvas%20Scenes%20Review/.obsidian/plugins/canvas-scenes/', root);
await mkdir(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  await copyFile(new URL(file, root), new URL(file, target));
}
console.log(`Installed review assets: ${fileURLToPath(target)}`);
