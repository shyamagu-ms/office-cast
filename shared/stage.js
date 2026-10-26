(function () {
  const scenes = new Map();
  const OfficeCast = (window.OfficeCast = {});
  OfficeCast.scene = (id, build) => {
    if (scenes.has(id)) throw new Error('Duplicate scene: ' + id);
    scenes.set(id, build);
  };
  OfficeCast.start = async () => {
    try {
      if (!window.TIMELINE || !window.PRODUCTION) throw new Error('Build the timeline before opening the production.');
      await Promise.all([document.fonts.ready, Props.ready()]);
      const render = new URLSearchParams(location.search).has('render');
      const TL = window.TIMELINE;
      document.title = window.PRODUCTION.title;
      const stage = document.getElementById('stage');
      const tl = gsap.timeline({ paused: true });
      const cues = [], post = [], preload = [];
      const sceneById = new Map(TL.scenes.map(s => [s.id, s]));
      const lineById = new Map(TL.lines.map(l => [l.id, l]));
      const K = {
        tl, TL, M: TL.markers, config: window.PRODUCTION, DURATION: TL.DURATION, GROUND: 930,
        post, preload,
        S: id => {
          if (!sceneById.has(id)) throw new Error('Unknown scene: ' + id);
          return sceneById.get(id);
        },
        L: id => {
          if (!lineById.has(id)) throw new Error('Unknown line: ' + id);
          return lineById.get(id);
        },
      };
      K.div = (parent, cls = '', text = '', css = {}) => {
        const el = document.createElement('div');
        el.className = cls;
        el.style.position = 'absolute';
        el.textContent = text;
        for (const [key, value] of Object.entries(css)) {
          el.style[key] = typeof value === 'number' && !/^(opacity|zIndex|fontWeight|lineHeight)$/.test(key)
            ? value + 'px' : String(value);
        }
        parent.appendChild(el);
        return el;
      };
      K.person = (key, x, parent, opts = {}) => {
        if (!Chars.PEOPLE[key]) throw new Error('Unknown person preset: ' + key);
        const ch = Chars.createPerson({ ...Chars.PEOPLE[key], ...opts });
        parent.appendChild(ch.el);
        ch.place(x, opts.ground ?? K.GROUND);
        gsap.set(ch.el, { transformOrigin: `50% ${740 / 760 * 100}%` });
        return ch;
      };
      K.robot = (color, x, parent, opts = {}) => {
        const ch = Chars.createRobot({ color, ...opts, name: opts.name || color });
        parent.appendChild(ch.el);
        ch.place(x, opts.ground ?? K.GROUND);
        gsap.set(ch.el, { transformOrigin: `50% ${740 / 760 * 100}%` });
        return ch;
      };
      K.prop = (name, opts, x, y, parent) => {
        const prop = Props.create(name, opts);
        parent.appendChild(prop.el);
        prop.place(x, y);
        return prop;
      };
      K.pop = (el, time, delay = 0) => {
        gsap.set(el, { autoAlpha: 0 });
        tl.fromTo(el, { autoAlpha: 0, y: 30, scale: 0.92 }, {
          autoAlpha: 1, y: 0, scale: 1, duration: 0.55,
          ease: 'power3.out', immediateRender: false,
        }, time + delay);
      };
      K.cue = (time, name, gain = 1) => {
        if (!window.PRODUCTION.sfxNames.includes(name)) throw new Error('Unknown sound effect: ' + name);
        if (!Number.isFinite(time) || time < 0 || time >= TL.DURATION) throw new Error('SFX cue is outside the timeline');
        if (!Number.isFinite(gain) || gain < 0 || gain > 4) throw new Error('SFX gain must be between 0 and 4');
        cues.push({ t: +time.toFixed(3), name, gain });
      };
      K.sequence = (img, frameAt) => {
        let current = null;
        post.push(async t => {
          const next = frameAt(t);
          if (next === null) return;
          if (typeof next !== 'string' || !next) throw new Error('Image sequence must return a URL or null');
          if (next !== current) { img.src = next; current = next; }
          await img.decode();
        });
      };
      for (const scene of TL.scenes) {
        if (!scenes.has(scene.id)) throw new Error('Scene is not implemented: ' + scene.id);
        const layer = K.div(stage, 'scene' + (scene.theme === 'dark' ? ' dark' : ''));
        layer.id = 'scene-' + scene.id;
        gsap.set(layer, { autoAlpha: 0 });
        tl.set(layer, { autoAlpha: 1 }, scene.start);
        tl.set(layer, { autoAlpha: 0 }, scene.end);
        scenes.get(scene.id)(K, layer);
      }
      const caption = document.getElementById('caption');
      const captionText = caption.querySelector('span');
      const syncCaption = t => {
        const line = TL.lines.find(l => t >= l.start && t < l.end);
        captionText.textContent = line ? line.caption : '';
        caption.style.visibility = line ? 'visible' : 'hidden';
        const scene = TL.scenes.find(s => t >= s.start && t < s.end) || TL.scenes.at(-1);
        stage.dataset.theme = scene.theme;
        caption.dataset.line = line ? line.id : '';
      };
      tl.to({}, { duration: 0.001 }, TL.DURATION - 0.001);
      window.DURATION = TL.DURATION;
      window.TL = tl;
      window.K = K;
      window.SFX_CUES = cues.sort((a, b) => a.t - b.t || a.name.localeCompare(b.name));
      window.seek = async t => {
        if (!Number.isFinite(t) || t < 0 || t > TL.DURATION) throw new Error('Seek time is outside the timeline');
        tl.seek(t, false);
        await Promise.all(post.map(fn => fn(t)));
        syncCaption(t);
        return true;
      };
      await Promise.all([...new Set(preload)].map(async url => {
        const img = new Image();
        img.src = url;
        await img.decode();
      }));
      await window.seek(0);
      if (render) {
        gsap.ticker.sleep();
      } else {
        document.body.classList.add('preview');
        const audio = document.getElementById('audio');
        const button = document.getElementById('play');
        const status = document.getElementById('status');
        const fit = () => {
          const scale = Math.min(innerWidth / 1920, (innerHeight - 48) / 1080);
          stage.style.transform = `scale(${scale})`;
          stage.style.left = (innerWidth - 1920 * scale) / 2 + 'px';
          stage.style.top = (innerHeight - 48 - 1080 * scale) / 2 + 'px';
        };
        addEventListener('resize', fit);
        fit();
        let frame = 0;
        const tick = async () => {
          try {
            await window.seek(Math.min(audio.currentTime, TL.DURATION));
            if (!audio.paused) frame = requestAnimationFrame(tick);
          } catch (error) {
            audio.pause();
            status.textContent = error.message;
          }
        };
        const toggle = async () => {
          cancelAnimationFrame(frame);
          if (!audio.paused) { audio.pause(); button.textContent = '再開 / RESUME'; return; }
          try {
            if (audio.ended) audio.currentTime = 0;
            await audio.play();
            status.textContent = '';
            button.textContent = '一時停止 / PAUSE';
            tick();
          } catch (error) { status.textContent = '音声を再生できません: ' + error.message; }
        };
        button.addEventListener('click', toggle);
        addEventListener('keydown', event => {
          if (event.code === 'Space' && event.target !== button) { event.preventDefault(); toggle(); }
        });
        audio.addEventListener('ended', () => { button.textContent = 'もう一度 / REPLAY'; });
        audio.addEventListener('error', () => { status.textContent = '音声ファイルを読み込めません。制作パイプラインを実行してください。'; });
      }
      window.__ready = true;
    } catch (error) {
      window.__error = error.message;
      document.getElementById('status').textContent = error.message;
      console.error(error);
    }
  };
})();
