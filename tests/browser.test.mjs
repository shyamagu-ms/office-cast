import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { ROOT, projectPython, readJson } from '../tools/config.mjs';

test('new production, cached narration, silent scenes and awaited image decoding', { timeout: 120000 }, async () => {
  const id = 'smoke-test-' + randomBytes(6).toString('hex');
  const dest = path.join(ROOT, 'productions', id);
  const python = projectPython();
  const pipeline = command => execFileSync(python, [path.join('tools', 'pipeline.py'), command, '--production', id, '--offline'], { cwd: ROOT, stdio: 'pipe' });
  let browser;
  try {
    execFileSync(process.execPath, [path.join('tools', 'new.mjs'), id, '--title', 'Template smoke test'], { cwd: ROOT });
    const narrationPath = path.join(dest, 'story', 'narration.json');
    const narration = readJson(narrationPath);
    narration.scenes.push({ id: 'silent', title: 'Silent', hold: 0.4, theme: 'dark', music: 'none', lines: [] });
    const original = JSON.stringify(narration, null, 2) + '\n';
    fs.writeFileSync(narrationPath, original);
    execFileSync(python, [path.join('tests', 'make_test_voice.py'), id], { cwd: ROOT });
    for (const [name, color] of [['a', 'red'], ['b', 'blue']]) {
      fs.writeFileSync(path.join(dest, 'src', `frame-${name}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${color}"/></svg>`);
    }
    fs.appendFileSync(path.join(dest, 'src', 'scenes.js'), `
OfficeCast.scene('silent', (K, layer) => {
  const start = K.S('silent').start;
  const img = document.createElement('img');
  img.id = 'sequence-check';
  Object.assign(img.style, { position: 'absolute', left: '300px', top: '300px' });
  layer.appendChild(img);
  K.sequence(img, t => t < start ? null : t < start + 0.2 ? 'frame-a.svg' : 'frame-b.svg');
});
`);
    pipeline('tts');
    pipeline('timeline');
    execFileSync(process.execPath, [path.join('tools', 'render.mjs'), '--production', id, '--cues'], { cwd: ROOT });
    pipeline('audio');
    pipeline('mix');
    const timing = readJson(path.join(dest, 'build', 'timeline.json'));
    assert.equal(timing.scenes[1].lines.length, 0);
    assert.equal(timing.scenes[1].music, 'none');
    assert.equal(readJson(path.join(dest, 'audio', 'bgm_info.json')).sections[1].preset, 'none');
    assert.ok(fs.statSync(path.join(dest, 'audio', 'mix.wav')).size > 44);
    browser = await chromium.launch({
      channel: process.env.OFFICE_CAST_BROWSER || 'msedge',
      args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
    });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(dest, 'src', 'index.html')).href + '?render');
    await page.waitForFunction(() => window.__ready || window.__error);
    assert.equal(await page.evaluate(() => window.__error), undefined);
    const a = timing.scenes[1].start + 0.05, b = timing.scenes[1].start + 0.25;
    const frame = async t => {
      await page.evaluate(time => window.seek(time), t);
      const image = await page.evaluate(() => {
        const img = document.getElementById('sequence-check');
        return { complete: img.complete, width: img.naturalWidth, src: img.src, caption: document.getElementById('caption').style.visibility };
      });
      assert.equal(image.complete, true);
      assert.equal(image.width, 100);
      assert.equal(image.caption, 'hidden');
      return { image, bytes: await page.screenshot() };
    };
    const first = await frame(a);
    const second = await frame(b);
    const replay = await frame(a);
    assert.ok(first.image.src.endsWith('frame-a.svg'));
    assert.ok(second.image.src.endsWith('frame-b.svg'));
    assert.notDeepEqual(first.bytes, second.bytes);
    assert.deepEqual(first.bytes, replay.bytes);
    assert.deepEqual(errors, []);
    await assert.rejects(page.evaluate(() => window.seek(-1)), /outside the timeline/);
    narration.scenes[0].lines[0].caption = 'Changed caption';
    fs.writeFileSync(narrationPath, JSON.stringify(narration));
    assert.throws(() => pipeline('audio'), /Production inputs changed/);
    assert.throws(() => execFileSync(process.execPath, [path.join('tools', 'render.mjs'), '--production', id, '--cues'], { cwd: ROOT, stdio: 'pipe' }), /Production inputs changed/);
    fs.writeFileSync(narrationPath, original);
    await page.evaluate(() => window.K.sequence(document.createElement('img'), () => 'missing-sequence-frame.svg'));
    await assert.rejects(page.evaluate(time => window.seek(time), a), /decode|image/i);
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  }
});

test('isolated gestures, prop animation, bow and logo survive reverse seeking', { timeout: 60000 }, async () => {
  const id = 'smoke-test-' + randomBytes(6).toString('hex');
  const dest = path.join(ROOT, 'productions', id);
  const python = projectPython();
  let browser;
  try {
    execFileSync(process.execPath, [path.join('tools', 'new.mjs'), id], { cwd: ROOT });
    const narrationPath = path.join(dest, 'story', 'narration.json');
    const narration = readJson(narrationPath);
    narration.scenes = [
      { id: 's0', title: 'Motion test', theme: 'light', hold: 8, lines: [] },
      { id: 's1', title: 'Logo test', theme: 'dark', hold: 4.5, lines: [] },
    ];
    narration.markers = {};
    fs.writeFileSync(narrationPath, JSON.stringify(narration));
    fs.copyFileSync(path.join(ROOT, 'tests', 'fixtures', 'motion.js'), path.join(dest, 'src', 'scenes.js'));
    execFileSync(python, [path.join('tests', 'make_test_voice.py'), id], { cwd: ROOT });
    execFileSync(python, [path.join('tools', 'pipeline.py'), 'timeline', '--production', id], { cwd: ROOT });
    browser = await chromium.launch({
      channel: process.env.OFFICE_CAST_BROWSER || 'msedge',
      args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
    });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(dest, 'src', 'index.html')).href + '?render');
    await page.waitForFunction(() => window.__ready || window.__error);
    assert.equal(await page.evaluate(() => window.__error), undefined);
    const timing = readJson(path.join(dest, 'build', 'timeline.json'));
    const castEnd = timing.scenes[0].end;
    const at = async (time, fn) => {
      await page.evaluate(t => window.seek(t), time);
      return page.evaluate(fn);
    };
    const robotY = () => document.querySelector('#test-robot .lift').getBoundingClientRect().y;
    const resting = await at(2.2, robotY);
    const hopping = await at(2.77, robotY);
    assert.ok(resting - hopping > 30, 'Opening robot must visibly leave the ground');
    const s1 = 0;
    const forearm = () => getComputedStyle(document.querySelector('#test-sato .armR .fore')).transform;
    assert.notEqual(await at(s1 + 0.8, forearm), await at(s1 + 2.55, forearm), 'Sato must visibly wave');
    const s2 = 0;
    const codeWidth = () => document.querySelector('#scene-s0 .prop-laptop .pp-line').getBoundingClientRect().width;
    assert.ok(await at(s2 + 1.6, codeWidth) > await at(s2 + 0.95, codeWidth) + 2, 'Laptop code must draw progressively');
    const upperScale = () => {
      const upper = document.querySelector('#test-tanaka .upper');
      return new DOMMatrixReadOnly(getComputedStyle(upper).transform).d;
    };
    assert.ok(await at(castEnd - 1.4, upperScale) < 0.95, 'Final cast must bow');
    const ending = timing.scenes[1];
    const logo = await at(ending.start + 2.5, () => {
      const el = document.querySelector('#scene-s1 .shu-logo');
      const image = el.querySelector('img[alt="SHU Works"]'), rect = el.getBoundingClientRect();
      return {
        alt: image.alt, decoded: image.complete && image.naturalWidth > 0,
        src: image.src, width: image.naturalWidth, height: image.naturalHeight,
        opacity: Number(getComputedStyle(image).opacity), clip: getComputedStyle(image).clipPath,
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        caption: document.getElementById('caption').style.visibility,
      };
    });
    assert.equal(logo.alt, 'SHU Works');
    assert.equal(logo.decoded, true);
    assert.ok(logo.src.endsWith('/shared/brand/shu-works-logo.png'));
    assert.equal(logo.width, 1321);
    assert.equal(logo.height, 444);
    assert.equal(logo.opacity, 1);
    assert.equal(logo.clip, 'inset(0px 0px 0px 23%)');
    assert.ok(logo.left >= 96 && logo.right <= 1824 && logo.top >= 54 && logo.bottom <= 1026);
    assert.ok(Math.abs((logo.left + logo.right) / 2 - 960) < 0.5);
    assert.ok(Math.abs((logo.top + logo.bottom) / 2 - 540) < 0.5);
    assert.ok(Math.abs((logo.right - logo.left) / (logo.bottom - logo.top) - logo.width / logo.height) < 0.01);
    assert.equal(logo.caption, 'hidden');
    const firstReveal = await at(ending.start + 0.5, () => {
      const images = document.querySelectorAll('#scene-s1 .shu-logo img');
      return [...images].map(image => Number(getComputedStyle(image).opacity));
    });
    assert.ok(firstReveal[0] > 0);
    assert.equal(firstReveal[1], 0, 'The wordmark follows the symbol instead of appearing all at once');
    assert.equal(await at(timing.DURATION - 1 / 30, () => (
      Number(getComputedStyle(document.querySelector('#scene-s1 img[alt="SHU Works"]')).opacity)
    )), 1, 'The logo must remain on the last frame');
    const probes = [2.77, s1 + 2.55, s2 + 3.42, castEnd - 1.4, ending.start + 0.8, ending.start + 2.5];
    const frames = [];
    for (const t of probes) {
      await page.evaluate(time => window.seek(time), t);
      frames.push(createHash('sha256').update(await page.screenshot()).digest('hex'));
    }
    await page.evaluate(time => window.seek(time), timing.DURATION - 1 / 30);
    for (let i = probes.length - 1; i >= 0; i--) {
      await page.evaluate(time => window.seek(time), probes[i]);
      assert.equal(createHash('sha256').update(await page.screenshot()).digest('hex'), frames[i], `Motion at ${probes[i]} must remain deterministic`);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  }
});

test('held props stay in either hand while the arm moves', { timeout: 60000 }, async () => {
  const file = path.join(ROOT, 'tests', `hand-test-${randomBytes(6).toString('hex')}.html`);
  const scripts = ['node_modules/gsap/dist/gsap.min.js', 'shared/characters/common.js', 'shared/characters/rig.js',
    'shared/characters/person.js', 'shared/characters/robot.js', 'shared/props/props.js', 'shared/props/props_harness.js'];
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><div id="stage" style="position:relative;width:1920px;height:1080px"></div>
${scripts.map(src => `<script src="../${src}"></script>`).join('\n')}`);
  let browser;
  try {
    browser = await chromium.launch({
      channel: process.env.OFFICE_CAST_BROWSER || 'msedge',
      args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
    });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(file).href);
    const gaps = await page.evaluate(() => {
      const stage = document.getElementById('stage');
      const result = {};
      for (const kind of ['person', 'robot']) {
        for (const side of ['L', 'R']) {
          for (const pose of [null, 'present', 'raise']) {
            const ch = kind === 'robot' ? Chars.createRobot({ color: 'blue', width: 200 }) : Chars.createPerson({ ...Chars.PEOPLE.yamada, width: 200 });
            stage.appendChild(ch.el); ch.place(960, 900);
            const tl = gsap.timeline({ paused: true });
            const held = Props.hand('magnifier', ch, side);
            if (pose) held.pose(tl, 0, pose, 0.01);
            tl.seek(1);
            const grip = Props.info('magnifier').hold.grip;
            const art = held.g.querySelector('.pp-heldrot g[transform*="translate("]');
            const fist = held.g.querySelector(':scope > ellipse, :scope > path');
            const point = new DOMPoint(grip[0], grip[1]).matrixTransform(art.getScreenCTM());
            const box = fist.getBoundingClientRect();
            result[`${kind} ${side} ${pose || 'rest'}`] = Math.hypot(point.x - (box.left + box.width / 2), point.y - (box.top + box.height / 2));
            ch.el.remove();
          }
        }
      }
      return result;
    });
    for (const [name, gap] of Object.entries(gaps)) assert.ok(gap < 1, `Magnifier grip must sit in the fist (${name}: ${gap.toFixed(1)}px)`);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    fs.rmSync(file, { force: true });
  }
});

test('offline build produces MP4, stills, QC and a matching dependency manifest', { timeout: 180000 }, () => {
  const id = 'smoke-test-' + randomBytes(6).toString('hex');
  const dest = path.join(ROOT, 'productions', id);
  const python = projectPython();
  try {
    execFileSync(process.execPath, [path.join('tools', 'new.mjs'), id], { cwd: ROOT });
    execFileSync(python, [path.join('tests', 'make_test_voice.py'), id], { cwd: ROOT });
    execFileSync(python, [
      path.join('tools', 'pipeline.py'), 'build', '--production', id, '--offline',
    ], { cwd: ROOT, stdio: 'pipe' });
    for (const file of [id + '.mp4', 'poster.png', 'ending.png', 'contact-sheet.jpg', path.join('stills', 's0.jpg')]) {
      assert.ok(fs.statSync(path.join(dest, 'out', file)).size > 0, `Missing build artifact: ${file}`);
    }
    const qc = readJson(path.join(dest, 'out', 'qc_final.json'));
    assert.equal(qc.passed, true);
    assert.ok(Object.values(qc.checks).every(value => value === true));
    const manifest = readJson(path.join(dest, 'out', 'manifest.json'));
    assert.equal(manifest.sharedVersion, readJson(path.join(ROOT, 'office-cast.json')).version);
    assert.equal(manifest.node, process.version);
    assert.deepEqual(manifest.nodeDependencies, readJson(path.join(ROOT, 'package.json')).dependencies);
    for (const requirement of fs.readFileSync(path.join(ROOT, 'requirements.txt'), 'utf8').trim().split(/\r?\n/)) {
      const [name, version] = requirement.split('==');
      assert.equal(manifest.pythonDependencies[name], version);
    }
    const video = path.join('out', id + '.mp4');
    assert.equal(manifest.generatedHashes[video],
      createHash('sha256').update(fs.readFileSync(path.join(dest, video))).digest('hex'));
  } finally {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  }
});
