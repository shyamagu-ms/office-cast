import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT, loadProduction, projectPython, readJson } from './config.mjs';

const { values } = parseArgs({
  options: {
    production: { type: 'string' }, catalog: { type: 'string' }, page: { type: 'string' },
    cues: { type: 'boolean' }, video: { type: 'boolean' }, png: { type: 'boolean' },
    stills: { type: 'string' }, workers: { type: 'string', default: '4' },
  },
});
if ([values.cues, values.video, values.png, Boolean(values.stills)].filter(Boolean).length !== 1) {
  throw new Error('Choose exactly one of --cues, --video, --png, --stills <seconds>.');
}
const workers = Number(values.workers);
if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('--workers must be an integer from 1 to 8.');
if (Boolean(values.production) === Boolean(values.catalog)) throw new Error('Choose --production <id> or --catalog characters|props.');
if (values.catalog && (!['characters', 'props'].includes(values.catalog) || !values.png)) {
  throw new Error('Catalog rendering supports characters|props with --png.');
}
const catalogPage = Number(values.page || 1);
if (values.page && (values.catalog !== 'props' || !Number.isInteger(catalogPage) || catalogPage < 1 || catalogPage > 4)) {
  throw new Error('--page 1|2|3|4 is available only for the props catalog.');
}
const production = values.production ? loadProduction(values.production) : null;
const source = production ? path.join(production.dir, 'src', 'index.html') : path.join(ROOT, 'catalog', values.catalog + '.html');
if (production) {
  const timing = readJson(path.join(production.dir, 'build', 'timeline.json'));
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const expected = {
    narration: hash(path.join(production.dir, 'story', 'narration.json')),
    project: hash(path.join(production.dir, 'project.json')),
    studio: hash(path.join(ROOT, 'office-cast.json')),
  };
  if (JSON.stringify(timing.inputHashes) !== JSON.stringify(expected)) {
    throw new Error('Production inputs changed; rebuild the timeline first.');
  }
}
const out = production ? path.join(production.dir, 'out') : path.join(ROOT, 'catalog', 'out');
const build = production ? path.join(production.dir, 'build') : null;
const url = pathToFileURL(source).href + '?render' + (values.catalog === 'props' ? `&page=${catalogPage}` : '');
const browserErrors = [];
const processes = new Set();
let temporary;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.OFFICE_CAST_BROWSER || 'msedge',
  args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
});
const openPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('requestfailed', request => browserErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true || Boolean(window.__error), null, { timeout: 60000 });
  const error = await page.evaluate(() => window.__error);
  if (error) throw new Error(error);
  return page;
};
const shot = async (page, time, type = 'jpeg') => {
  await page.evaluate(t => window.seek(t), time);
  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  return page.screenshot({ type, ...(type === 'jpeg' ? { quality: 94 } : {}), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
};
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(getFFmpeg(), args, { stdio: 'inherit' });
  processes.add(child);
  child.once('error', reject);
  child.once('close', code => { processes.delete(child); code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}`)); });
});
let executable;
function getFFmpeg() {
  if (!executable) {
    executable = process.env.FFMPEG || execFileSync(
      projectPython(),
      ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
      { encoding: 'utf8' },
    ).trim();
  }
  return executable;
}

try {
  const page = await openPage();
  if (values.cues) {
    fs.writeFileSync(path.join(build, 'sfx_cues.json'), JSON.stringify(await page.evaluate(() => window.SFX_CUES), null, 2) + '\n');
    console.log('[render] Wrote production-specific SFX cues.');
  } else if (values.png) {
    const filename = values.catalog === 'props' && catalogPage > 1 ? `props-${catalogPage}.png` : values.catalog ? values.catalog + '.png' : 'poster.png';
    fs.writeFileSync(path.join(out, filename), await shot(page, 0, 'png'));
  } else if (values.stills) {
    const times = values.stills.split(',').map(Number);
    const duration = await page.evaluate(() => window.DURATION);
    if (!times.length || times.some(t => !Number.isFinite(t) || t < 0 || t >= duration)) throw new Error('Invalid still times.');
    const stills = path.join(out, 'stills');
    fs.mkdirSync(stills, { recursive: true });
    for (const time of times) fs.writeFileSync(path.join(stills, `t${time.toFixed(3)}.jpg`), await shot(page, time));
  } else {
    const timing = readJson(path.join(build, 'timeline.json'));
    const duration = await page.evaluate(() => window.DURATION);
    if (duration !== timing.DURATION) throw new Error('Page duration differs from the production timeline.');
    const captions = [];
    for (const line of timing.lines) {
      await page.evaluate(t => window.seek(t), (line.start + line.end) / 2);
      captions.push(await page.evaluate(line => {
        const el = document.querySelector('#caption span');
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        return {
          id: line.id, text: el.textContent,
          fits: el.textContent === line.caption && rect.left >= 95 && rect.right <= 1825
            && rect.top >= 54 && rect.bottom <= 1027,
        };
      }, line));
    }
    const probe = Math.min(duration - 1 / timing.fps, (timing.scenes[0].start + timing.scenes[0].end) / 2);
    const probes = [];
    for (const scene of timing.scenes) {
      for (const fraction of [0.25, 0.5, 0.75]) {
        const time = scene.start + (scene.end - scene.start) * fraction;
        probes.push({ scene: scene.id, time, hash: createHash('sha256').update(await shot(page, time)).digest('hex') });
      }
    }
    await shot(page, duration - 1 / timing.fps);
    for (const { scene, time, hash } of probes.toReversed()) {
      const replay = createHash('sha256').update(await shot(page, time)).digest('hex');
      if (hash !== replay) throw new Error(`Forward/backward seek produced different pixels in ${scene}.`);
    }
    if (captions.some(c => !c.fits)) throw new Error('Caption safe-area check failed: ' + captions.filter(c => !c.fits).map(c => c.id).join(', '));
    const stills = path.join(out, 'stills');
    fs.mkdirSync(stills, { recursive: true });
    for (const scene of timing.scenes) {
      const time = (scene.start + scene.end) / 2;
      fs.writeFileSync(path.join(stills, scene.id + '.jpg'), await shot(page, time));
    }
    fs.writeFileSync(path.join(out, 'poster.png'), await shot(page, probe, 'png'));
    await page.close();
    temporary = fs.mkdtempSync(path.join(build, 'render-'));
    const frameCount = timing.frames;
    const workerCount = Math.min(workers, frameCount);
    const per = Math.ceil(frameCount / workerCount);
    let done = 0;
    const worker = async index => {
      const start = index * per, end = Math.min(frameCount, start + per);
      if (start >= end) return null;
      const file = path.join(temporary, `part-${index}.mp4`);
      const child = spawn(getFFmpeg(), [
        '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(timing.fps),
        '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
        '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(timing.fps), file,
      ], { stdio: ['pipe', 'ignore', 'inherit'] });
      processes.add(child);
      const closed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.stdin.once('error', reject);
        child.once('close', code => { processes.delete(child); code === 0 ? resolve() : reject(new Error(`FFmpeg worker exited ${code}`)); });
      });
      closed.catch(() => {});
      const workerPage = await openPage();
      try {
        for (let f = start; f < end; f++) {
          const data = await shot(workerPage, f / timing.fps);
          if (!child.stdin.write(data)) {
            await Promise.race([new Promise(resolve => child.stdin.once('drain', resolve)), closed.then(() => { throw new Error('Encoder stopped before input completed'); })]);
          }
          if (++done % 150 === 0) console.log(`[render] ${done}/${frameCount} frames`);
        }
        child.stdin.end();
        await closed;
        return file;
      } finally {
        await workerPage.close();
      }
    };
    const files = (await Promise.all(Array.from({ length: workerCount }, (_, i) => worker(i)))).filter(Boolean);
    const list = path.join(temporary, 'concat.txt');
    fs.writeFileSync(list, files.map(file => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    await run([
      '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
      '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(build, 'video_noaudio.mp4'),
    ]);
    fs.writeFileSync(path.join(build, 'render_checks.json'), JSON.stringify({
      captions, deterministicSeek: true, seekProbes: probes, browserErrors,
      browserVersion: browser.version(), frames: frameCount,
    }, null, 2) + '\n');
    console.log(`[render] Wrote ${duration}s / ${frameCount} frames.`);
  }
  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
} finally {
  for (const child of processes) child.kill();
  await browser.close();
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
}
