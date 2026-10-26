/* Animation API shared by every character.  All methods *schedule* tweens on a
 * GSAP timeline at absolute time t, so the whole film stays seekable/deterministic.
 *
 *   const yui = Chars.createPerson({ ...Chars.PEOPLE.tanaka, width: 300 });
 *   stage.appendChild(yui.el); yui.place(500, 900);
 *   yui.idle(tl, 0, 20).walk(tl, 1, 2.4, 600).wave(tl, 3.6).talk(tl, 4.2, 2).expr(tl, 6, 'happy');
 */
(function () {
  const C = window.Chars;

  // brow: y offset (- = raised), tilt: + = inner ends up (worried), - = inner ends down (serious)
  const EXPR = {
    person: {
      normal: { eye: 'normal', mouth: 'line', brow: 0, tilt: 0 },
      smile: { eye: 'normal', mouth: 'smile', brow: -1, tilt: 0 },
      happy: { eye: 'happy', mouth: 'open', brow: -3, tilt: 0 },
      surprised: { eye: 'surprised', mouth: 'o', brow: -8, tilt: 0 },
      worried: { eye: 'normal', mouth: 'wavy', brow: -2, tilt: 14 },
      serious: { eye: 'normal', mouth: 'line', brow: 2, tilt: -12 },
      deadpan: { eye: 'flat', mouth: 'line', brow: 1, tilt: 0 },
      calm: { eye: 'closed', mouth: 'smile', brow: 0, tilt: 0 },
    },
    robot: {
      normal: { eye: 'normal', mouth: 'line' },
      smile: { eye: 'normal', mouth: 'smile' },
      happy: { eye: 'happy', mouth: 'open' },
      surprised: { eye: 'surprised', mouth: 'o' },
      think: { eye: 'think', mouth: 'line' },
      error: { eye: 'error', mouth: 'wavy' },
    },
  };

  C.rig = function (el, kind, o, pv) {
    const q = (s) => el.querySelector(s);
    const qa = (s) => [...el.querySelectorAll(s)];
    const P = {
      shadow: q('.shadow'), lift: q('.lift'), squash: q('.squash'), upper: q('.upper'), head: q('.head'),
      armL: q('.armL'), armR: q('.armR'), foreL: q('.armL .fore'), foreR: q('.armR .fore'),
      legL: q('.legL'), legR: q('.legR'), eyes: q('.eyes'), face: q('.face'), brows: q('.brows'),
      browL: q('.browL'), browR: q('.browR'),
      antenna: q('.antenna'), lampGlow: q('.lamp-glow'), antennaGlow: q('.antenna-glow'),
      propL: q('.armL .prop'), propR: q('.armR .prop'),
    };
    const org = (a) => `${a[0]} ${a[1]}`;
    gsap.set([P.lift, P.face].filter(Boolean), { svgOrigin: '200 400' });
    gsap.set(P.squash, { svgOrigin: org(pv.squash) });
    gsap.set(P.upper, { svgOrigin: org(pv.upper) });
    gsap.set(P.head, { svgOrigin: org(pv.head) });
    gsap.set([P.armL, P.armR], { svgOrigin: org(pv.arm) });
    gsap.set([P.foreL, P.foreR], { svgOrigin: org(pv.fore) });
    gsap.set([P.legL, P.legR], { svgOrigin: org(pv.leg) });
    gsap.set(P.eyes, { svgOrigin: org(pv.eyes) });
    gsap.set(P.shadow, { svgOrigin: '200 741' });
    if (P.antenna) gsap.set(P.antenna, { svgOrigin: org(pv.antenna) });
    if (P.lampGlow) gsap.set(P.lampGlow, { svgOrigin: org(pv.lamp) });
    if (P.antennaGlow) gsap.set(P.antennaGlow, { svgOrigin: org(pv.antennaGlow) });
    if (P.brows) gsap.set(P.brows, { svgOrigin: org(pv.brows) });
    if (P.browL) gsap.set(P.browL, { svgOrigin: org(pv.browL) });
    if (P.browR) gsap.set(P.browR, { svgOrigin: org(pv.browR) });

    const variants = (slot) => Object.fromEntries(qa(`[class^="${slot}-"]`).map((n) => [n.getAttribute('class').slice(slot.length + 1), n]));
    const EYES = variants('eye'), MOUTH = variants('mouth');
    const rand = C.rng(o.seed || [...(o.name || 'x')].reduce((a, c) => a + c.charCodeAt(0), 7));

    const ch = { el, kind, opts: o, parts: P, state: { expr: 'normal', mouth: EXPR[kind].normal.mouth } };
    const side = (s) => (s === 'L' ? ['armL', 'foreL'] : ['armR', 'foreR']);

    ch.place = (x, groundY) => {
      const w = parseFloat(el.style.width), h = parseFloat(el.style.height);
      Object.assign(el.style, { position: 'absolute', left: x - w / 2 + 'px', top: groundY - (h * C.VIEW.ground) / C.VIEW.h + 'px' });
      return ch;
    };

    ch.mouth = (tl, t, name) => {
      Object.entries(MOUTH).forEach(([k, n]) => tl.set(n, { opacity: k === name ? 1 : 0 }, t));
      return ch;
    };

    ch.expr = (tl, t, name) => {
      const e = EXPR[kind][name] || EXPR[kind].normal;
      Object.entries(EYES).forEach(([k, n]) => tl.set(n, { opacity: k === e.eye ? 1 : 0 }, t));
      ch.mouth(tl, t, e.mouth);
      if (P.brows) tl.to(P.brows, { y: e.brow, duration: 0.15, ease: 'power2.out' }, t);
      if (P.browL) tl.to(P.browL, { rotation: -e.tilt, duration: 0.15, ease: 'power2.out' }, t).to(P.browR, { rotation: e.tilt, duration: 0.15, ease: 'power2.out' }, t);
      ch.state = { expr: name, mouth: e.mouth };
      return ch;
    };

    // polite front-view bow (お辞儀): torso foreshortens, head dips, eyes close
    ch.bow = (tl, t, { depth = 1, hold = 0.5, dur = 0.45 } = {}) => {
      const prev = ch.state.expr;
      ch.rest(tl, t, 0.25);
      tl.to(P.upper, { scaleY: 1 - 0.1 * depth, duration: dur, ease: 'power2.inOut' }, t)
        .to(P.head, { y: 24 * depth, scaleY: 1 - 0.07 * depth, duration: dur, ease: 'power2.inOut' }, t)
        .to(P.upper, { scaleY: 1, duration: dur, ease: 'power2.inOut' }, t + dur + hold)
        .to(P.head, { y: 0, scaleY: 1, duration: dur, ease: 'power2.inOut' }, t + dur + hold);
      if (kind === 'person') ch.expr(tl, t + dur * 0.4, 'calm').expr(tl, t + dur * 1.6 + hold, prev);
      else tl.to(P.eyes, { scaleY: 0.25, duration: 0.15 }, t + dur * 0.4).to(P.eyes, { scaleY: 1, duration: 0.15 }, t + dur + hold);
      return ch;
    };

    ch.nod = (tl, t, { times = 2, amp = 9 } = {}) => {
      for (let i = 0; i < times; i++)
        tl.to(P.head, { y: amp, duration: 0.14, ease: 'power2.out' }, t + i * 0.32).to(P.head, { y: 0, duration: 0.18, ease: 'power2.inOut' }, t + i * 0.32 + 0.14);
      return ch;
    };

    ch.blink = (tl, t) => {
      tl.to(P.eyes, { scaleY: 0.08, duration: 0.06, ease: 'power1.in' }, t)
        .to(P.eyes, { scaleY: 1, duration: 0.1, ease: 'power1.out' }, t + 0.06);
      return ch;
    };

    ch.talk = (tl, t, dur, { rate = 0.1 } = {}) => {
      const base = ch.state.mouth;
      const seq = ['talk', 'open', 'talk', base === 'open' ? 'smile' : base, 'open', 'talk'];
      let k = 0;
      for (let u = t; u < t + dur - rate; u += rate * (0.8 + rand() * 0.6)) ch.mouth(tl, u, seq[(k++ + (rand() < 0.3 ? 1 : 0)) % seq.length]);
      ch.mouth(tl, t + dur, base);
      // talking head bob
      tl.to(P.head, { rotation: 1.5, duration: dur / 4, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t);
      return ch;
    };

    ch.look = (tl, t, dir = 0, dur = 0.25) => {
      tl.to([P.face, P.brows].filter(Boolean), { x: dir * 14, duration: dur, ease: 'power2.out' }, t)
        .to(P.head, { rotation: dir * 4, duration: dur, ease: 'power2.out' }, t);
      return ch;
    };

    // pose an arm: up = shoulder rotation (+ outward/up), fore = elbow rotation
    ch.arm = (tl, t, s, up, fore = 0, dur = 0.3, ease = 'back.out(1.6)') => {
      const [a, f] = side(s);
      tl.to(P[a], { rotation: up, duration: dur, ease }, t).to(P[f], { rotation: fore, duration: dur, ease }, t);
      return ch;
    };
    ch.rest = (tl, t, dur = 0.35) => ch.arm(tl, t, 'L', 0, 0, dur, 'power2.inOut').arm(tl, t, 'R', 0, 0, dur, 'power2.inOut');

    // named arm poses: [shoulder, elbow]
    const POSES = { present: [30, 62], point: [86, 4], wave: [36, 122], raise: [168, -4], hip: [34, -92], banzai: [160, -6], shrug: [28, 104] };
    ch.pose = (tl, t, name, s = 'R', dur = 0.35) => {
      const [u, f] = POSES[name];
      if (s === 'both') return ch.arm(tl, t, 'L', u, f, dur).arm(tl, t, 'R', u, f, dur);
      return ch.arm(tl, t, s, u, f, dur);
    };

    ch.wave = (tl, t, { s = 'R', times = 3, keep = false } = {}) => {
      const [, f] = side(s);
      ch.pose(tl, t, 'wave', s, 0.3);
      for (let i = 0; i < times; i++) {
        tl.to(P[f], { rotation: 138, duration: 0.17, ease: 'sine.inOut' }, t + 0.3 + i * 0.34)
          .to(P[f], { rotation: 104, duration: 0.17, ease: 'sine.inOut' }, t + 0.47 + i * 0.34);
      }
      if (!keep) ch.arm(tl, t + 0.32 + times * 0.34, s, 0, 0, 0.35, 'power2.inOut');
      return ch;
    };

    // front-facing "step-step" walk: alternate knee lifts + arm swing + body bob
    ch.walk = (tl, t, dur, dx, { step = 0.42, lift = 16 } = {}) => {
      tl.to(el, { x: `+=${dx}`, duration: dur, ease: 'none' }, t);
      const n = Math.max(1, Math.round(dur / step)), st = dur / n, dir = Math.sign(dx) || 1;
      for (let i = 0; i < n; i++) {
        const u = t + i * st, up = i % 2 ? P.legR : P.legL;
        tl.to(up, { y: -lift, rotation: 5, duration: st / 2, ease: 'sine.out' }, u)
          .to(up, { y: 0, rotation: 0, duration: st / 2, ease: 'sine.in' }, u + st / 2)
          .to(P.armL, { rotation: i % 2 ? 14 : -6, duration: st, ease: 'sine.inOut' }, u)
          .to(P.armR, { rotation: i % 2 ? -6 : 14, duration: st, ease: 'sine.inOut' }, u)
          .to(P.upper, { y: -5, rotation: dir * 1.2, duration: st / 2, ease: 'sine.out' }, u)
          .to(P.upper, { y: 0, duration: st / 2, ease: 'sine.in' }, u + st / 2);
      }
      tl.to([P.legL, P.legR, P.armL, P.armR, P.upper], { rotation: 0, y: 0, duration: 0.25, ease: 'power2.out' }, t + dur);
      if (P.antenna) tl.to(P.antenna, { keyframes: { rotation: [-10, 6, -3, 0] }, duration: 0.7 }, t + dur);
      return ch;
    };

    ch.hop = (tl, t, { h = 130, arms = true } = {}) => {
      tl.to(P.squash, { scaleY: 0.92, scaleX: 1.04, duration: 0.12, ease: 'power2.out' }, t)
        .to(P.squash, { scaleY: 1.03, scaleX: 0.98, duration: 0.16, ease: 'power2.out' }, t + 0.12)
        .to(P.lift, { y: -h, duration: 0.3, ease: 'power2.out' }, t + 0.12)
        .to(P.shadow, { scale: 0.6, opacity: 0.06, duration: 0.3, ease: 'power2.out' }, t + 0.12)
        .to(P.squash, { scaleY: 1, scaleX: 1, duration: 0.2 }, t + 0.3)
        .to(P.lift, { y: 0, duration: 0.27, ease: 'power2.in' }, t + 0.42)
        .to(P.shadow, { scale: 1, opacity: 0.16, duration: 0.27, ease: 'power2.in' }, t + 0.42)
        .to(P.squash, { scaleY: 0.93, scaleX: 1.04, duration: 0.07, ease: 'power1.out' }, t + 0.69)
        .to(P.squash, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'back.out(2)' }, t + 0.76);
      if (arms) ch.pose(tl, t + 0.1, 'banzai', 'both', 0.2).rest(tl, t + 0.7, 0.3);
      if (P.antenna) tl.to(P.antenna, { keyframes: { rotation: [0, 8, -14, 10, -5, 0] }, duration: 1.1, ease: 'none' }, t + 0.1);
      return ch;
    };

    // fall in from above (y<0) and land with a squash
    ch.drop = (tl, t, { from = -2200, dur = 0.55 } = {}) => {
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: true }, t);
      tl.fromTo(P.lift, { y: from }, { y: 0, duration: dur, ease: 'power2.in', immediateRender: true }, t)
        .fromTo(P.shadow, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.16, duration: dur, ease: 'power2.in', immediateRender: true }, t)
        .to(P.squash, { scaleY: 0.9, scaleX: 1.05, duration: 0.08, ease: 'power1.out' }, t + dur)
        .to(P.squash, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'back.out(2)' }, t + dur + 0.08);
      if (P.antenna) tl.to(P.antenna, { keyframes: { rotation: [0, 14, -12, 7, -3, 0] }, duration: 1, ease: 'none' }, t + dur);
      return ch;
    };

    // breathing, natural blinks, robot lamp pulse – fills [t0, t1]
    ch.idle = (tl, t0, t1, { blinkEvery = [2.2, 4.2] } = {}) => {
      const per = 1.5, n = Math.floor((t1 - t0) / per);
      if (n > 0) tl.to(P.upper, { scaleY: 1.012, scaleX: 0.995, duration: per, ease: 'sine.inOut', yoyo: true, repeat: n - 1 }, t0);
      for (let u = t0 + 0.6 + rand() * 1.5; u < t1; u += blinkEvery[0] + rand() * (blinkEvery[1] - blinkEvery[0])) ch.blink(tl, u);
      if (P.lampGlow) {
        const m = Math.floor((t1 - t0) / 0.9);
        if (m > 0) {
          tl.to(P.lampGlow, { scale: 1.25, opacity: 1, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: m - 1 }, t0);
          tl.to(P.antennaGlow, { scale: 1.3, opacity: 0.9, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: m - 1 }, t0 + 0.45);
        }
      }
      return ch;
    };

    // attach an SVG prop (string or element) to a hand: drawn in hand-local coords
    ch.hold = (s, svg) => {
      const g = s === 'L' ? P.propL : P.propR;
      g.innerHTML = typeof svg === 'string' ? svg : '';
      if (typeof svg !== 'string') g.appendChild(svg);
      return ch;
    };

    return ch;
  };
})();
