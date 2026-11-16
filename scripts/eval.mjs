import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const code = process.argv[2] === '--file' ? readFileSync(process.argv[3], 'utf8') : process.argv[2];
if (!code) throw new Error('Pass JavaScript or --file path');
const r = spawnSync('obsidian', ['vault=Canvas Scenes Review', 'eval', `code=${code}`], { encoding: 'utf8' });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
process.exit(r.status ?? 1);
