import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { ROOT } from '../tools/config.mjs';

test('all prop catalog pages and text-only badges work without a Copilot icon', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({
    channel: process.env.OFFICE_CAST_BROWSER || 'msedge',
    args: ['--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [], iconRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.url().includes('copilot-icon-black.svg')) iconRequests.push(request.url());
    });
    for (let number = 1; number <= 4; number++) {
      await page.goto(pathToFileURL(path.join(ROOT, 'catalog', 'props.html')).href + '?page=' + number);
      await page.waitForFunction(() => window.__ready || window.__error);
      assert.equal(await page.evaluate(() => window.__error), undefined);
    }
    assert.equal(await page.locator('.prop-copilotBadge').count(), 1);
    assert.ok((await page.locator('.prop-copilotBadge').textContent()).includes('GitHub Copilot'));
    assert.equal(await page.locator('.prop-copilotBadge image').count(), 0);
    const result = await page.evaluate(async () => {
      const href = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>');
      const badge = Props.create('copilotBadge', { href });
      document.getElementById('stage').appendChild(badge.el);
      const url = badge.el.querySelector('image').getAttribute('href');
      const image = new Image();
      image.src = url;
      await image.decode();
      return { href: url, naturalWidth: image.naturalWidth };
    });
    assert.ok(result.href.startsWith('data:image/svg+xml,'));
    assert.equal(result.naturalWidth, 20);
    await assert.rejects(page.evaluate(() => Props.create('copilotBadge', { href: '' })), /nonempty image URL/);
    assert.deepEqual(errors, []);
    assert.deepEqual(iconRequests, []);
  } finally {
    await browser.close();
  }
});
