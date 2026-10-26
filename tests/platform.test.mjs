import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { ROOT, projectPython } from '../tools/config.mjs';

test('rendering selects the project venv on Windows and POSIX', () => {
  assert.equal(projectPython('win32'), path.join(ROOT, '.venv', 'Scripts', 'python.exe'));
  for (const platform of ['linux', 'darwin']) {
    assert.equal(projectPython(platform), path.join(ROOT, '.venv', 'bin', 'python'));
  }
  assert.equal(projectPython(), projectPython(process.platform));
});
