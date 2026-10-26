import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { loadProduction, readJson, ROOT, validId } from '../tools/config.mjs';

test('production IDs cannot escape the productions directory', () => {
  for (const value of ['../example-production', '..\\example-production', '/absolute', '', 'Bad ID']) {
    assert.equal(validId(value), false);
    assert.throws(() => loadProduction(value));
  }
  assert.equal(validId('example-production'), true);
});

test('template pins the shared version', () => {
  const config = readJson(path.join(ROOT, 'templates', 'production', 'project.json'));
  const studio = readJson(path.join(ROOT, 'office-cast.json'));
  assert.equal(config.sharedVersion, studio.version);
  assert.equal(studio.brand, 'SHU WORKS');
});

test('HTML references resolve inside Office Cast without legacy dependencies', () => {
  for (const relative of ['templates/production/src/index.html', 'catalog/characters.html', 'catalog/props.html']) {
    const file = path.resolve(ROOT, relative);
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
      if (match[1].startsWith('http') || match[1].includes('/build/') || match[1].includes('/audio/')) continue;
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(!path.relative(ROOT, target).startsWith('..') && !path.isAbsolute(path.relative(ROOT, target)), `${relative}: ${match[1]}`);
      assert.ok(fs.existsSync(target), `${relative}: ${match[1]}`);
    }
  }
});

test('archived SHU Works vector drafts remain self-contained outlines', () => {
  for (const name of ['shu-works-logo.svg', 'shu-works-logo-ink.svg']) {
    const svg = fs.readFileSync(path.join(ROOT, 'shared', 'brand', name), 'utf8');
    assert.match(svg, /<title id="title">SHU Works<\/title>/);
    assert.match(svg, /viewBox="0 0 1075 196"/);
    assert.match(svg, /<g id="mark">/);
    assert.match(svg, /<g id="wordmark"/);
    assert.doesNotMatch(svg, /<text\b|<image\b|<script\b|(?:href|src)=|@font-face/);
  }
});
