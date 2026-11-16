import { mkdir, writeFile } from 'node:fs/promises';

const vault = new URL('../work/Canvas%20Scenes%20Review/', import.meta.url);
await mkdir(new URL('.obsidian/', vault), { recursive: true });

async function create(path, content) {
  try {
    await writeFile(new URL(path, vault), content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

await create('.obsidian/app.json', '{}\n');
await create('.obsidian/core-plugins.json', JSON.stringify(['file-explorer', 'global-search', 'switcher', 'command-palette', 'canvas', 'outline']));
await create('.obsidian/community-plugins.json', '[]\n');
await create('Reference.md', '# Reference note\n\nA disposable note for testing scenes and card editing.\n');
await create('Palette.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" fill="#e8e1d3"/><rect x="40" y="40" width="120" height="220" fill="#b55c43"/><rect x="180" y="40" width="120" height="220" fill="#7c8975"/><rect x="320" y="40" width="120" height="220" fill="#3e515d"/></svg>');
await create('Scenes.canvas', JSON.stringify({
  nodes: [
    { id: 'intro', type: 'text', x: -900, y: -350, width: 380, height: 240, text: '# A place to begin\n\nPan, zoom and save this view. Scenes remember the framing of your board.' },
    { id: 'detail', type: 'text', x: 550, y: 100, width: 380, height: 240, text: '# The details\n\nA second scene, away from the first. Edits stay live when you return.' },
    { id: 'ref', type: 'file', file: 'Reference.md', x: 1150, y: -500, width: 400, height: 250 },
    { id: 'palette', type: 'file', file: 'Palette.svg', x: 1050, y: 150, width: 400, height: 250 },
    { id: 'last', type: 'text', x: 2200, y: 600, width: 400, height: 250, text: '# Room to explore\n\nA third scene for moving through the board.' },
  ],
  edges: [
    { id: 'a-b', fromNode: 'intro', fromSide: 'right', toNode: 'detail', toSide: 'left' },
    { id: 'b-c', fromNode: 'detail', fromSide: 'right', toNode: 'last', toSide: 'left' },
  ],
}, null, 2) + '\n');
console.log('Review vault ready. Existing files and scene data were preserved.');
