import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, readJson, validId } from './config.mjs';

const { values, positionals } = parseArgs({
  options: { title: { type: 'string' } }, allowPositionals: true,
});
const [id] = positionals;
if (positionals.length !== 1 || !validId(id)) throw new Error('Usage: npm run new -- <kebab-case-id> [--title "Title"]');
const dest = path.join(ROOT, 'productions', id);
if (fs.existsSync(dest)) throw new Error(`Production already exists: ${id}`);
fs.cpSync(path.join(ROOT, 'templates', 'production'), dest, { recursive: true, errorOnExist: true, force: false });
const config = readJson(path.join(dest, 'project.json'));
config.id = id;
config.title = values.title || id;
config.sharedVersion = readJson(path.join(ROOT, 'office-cast.json')).version;
fs.writeFileSync(path.join(dest, 'project.json'), JSON.stringify(config, null, 2) + '\n');
console.log(`Created productions\\${id}. Edit project.json, story\\narration.json and src\\scenes.js.`);
