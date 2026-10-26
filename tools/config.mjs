import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const validId = (id) => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function projectPython(platform = process.platform) {
  return platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python');
}

export function loadProduction(id) {
  if (!validId(id)) throw new Error('Production ID must be lowercase kebab-case.');
  const dir = path.join(ROOT, 'productions', id);
  const config = readJson(path.join(dir, 'project.json'));
  const studio = readJson(path.join(ROOT, 'office-cast.json'));
  if (config.id !== id) throw new Error('project.json ID does not match its folder.');
  if (config.sharedVersion !== studio.version) throw new Error('Shared version mismatch; review the production before updating it.');
  return { dir, config, studio };
}
