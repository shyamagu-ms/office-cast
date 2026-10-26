/* Props for 「AIのハーネス入門」 – same flat, outline-free language as props.js (load after it).
 * Adds: harness (+ Props.harnessOn), ropeEnd, iconCard, gate, redButton, scanner, magnifier, stamp, stampMark,
 * target, shield, flag, card6, copilotBadge, cornerBox, icon (generic glyph).  Animation helpers in Props.anim.
 */
(function () {
  const C = window.Chars, Props = window.Props, PAL = Props.PAL, D = Props.DEFS, A = Props.anim;
  const { n, esc, R, O, P, L, rr, G, T, clip, gearD, polar, measure } = Props.util;
  const INK = C.INK, GFX = 1;
  // rounded rect + one flat shade strip (local copy of props.js SR)
  const SR = (x, y, w, h, r, fill, side = 'bottom', sw = 0.2, t = 0.16) => {
    const d = rr(x, y, w, h, Math.min(r, w / 2, h / 2)), id = C.uid('hc');
    const k = sw <= 1 ? (side === 'right' || side === 'left' ? w * sw : h * sw) : sw;
    const st = side === 'right' ? [x + w - k, y, k, h] : side === 'left' ? [x, y, k, h] : side === 'top' ? [x, y, w, k] : [x, y + h - k, w, k];
    return P(d, fill) + (side ? clip(id, d, R(st[0], st[1], st[2], st[3], 0, C.shade(fill, t))) : '');
  };
  const KIND = (Props.KIND = { doc: PAL.blue, shield: PAL.green, wrench: PAL.yellow, target: PAL.red });

  /* ICON(kind, cx, cy, s, color, bg) – flat glyph in a box of size s centred on (cx, cy).
   * kinds: doc shield shieldMinus wrench target gear bulb book check person people chart magnifier lock key cube */
  const ICON = (Props.ICON = (kind, cx, cy, s, color = INK, bg = '#fbf9f5') => {
    const k = s / 48, tr = `transform="translate(${n(cx)} ${n(cy)}) scale(${n(k)})"`;
    let g = '';
    switch (kind) {
      case 'doc':
        g = P('M-15,-22 H7 L17,-12 V22 H-15 Z', color) + P('M7,-22 V-12 H17 Z', C.shade(color, 0.25)) +
          R(-9, -6, 20, 3.5, 1.7, bg) + R(-9, 2, 20, 3.5, 1.7, bg) + R(-9, 10, 13, 3.5, 1.7, bg);
        break;
      case 'shield': case 'shieldMinus': case 'shieldCheck':
        g = P('M0,-23 L19,-15 V0 C19,12 10,19 0,24 C-10,19 -19,12 -19,0 V-15 Z', color) + P('M0,-23 L19,-15 V0 C19,12 10,19 0,24 Z', C.shade(color, 0.14));
        if (kind === 'shieldMinus') g += R(-10, -3, 20, 6, 3, bg);
        else g += L('M-8,0 L-2,7 L9,-6', bg, 4.5);
        break;
      case 'wrench':
        g = `<g transform="rotate(-45)">${R(-4.5, -6, 9, 30, 4.5, color)}${P('M-11,-22 A12,12 0 1 0 11,-22 L5,-22 L5,-12 L-5,-12 L-5,-22 Z', color)}</g>`;
        break;
      case 'target':
        g = O(0, 0, 21, color) + O(0, 0, 15, bg) + O(0, 0, 10, color) + O(0, 0, 4.5, bg) +
          L('M0,0 L18,-18', INK, 3.2) + P('M18,-18 L15,-26 L20,-21 Z M18,-18 L26,-15 L21,-20 Z', INK);
        break;
      case 'gear':
        g = P(gearD(0, 0, 21, 15, 8, 6.5), color, 'fill-rule="evenodd"');
        break;
      case 'bulb':
        g = O(0, -6, 15, color) + R(-7, 6, 14, 10, 2, color) + R(-6, 17, 12, 4, 2, C.shade(color, 0.3)) + R(-4, 22, 8, 3, 1.5, C.shade(color, 0.3)) +
          L('M-5,-6 L0,1 L5,-6', bg, 2.4) + [-60, -90, -120].map((a) => { const [x1, y1] = polar(0, -6, 19, a), [x2, y2] = polar(0, -6, 24, a); return L(`M${n(x1)},${n(y1)} L${n(x2)},${n(y2)}`, color, 2.6); }).join('');
        break;
      case 'book':
        g = P('M0,-12 C-8,-18 -16,-18 -23,-15 V17 C-16,14 -8,14 0,19 Z', color) + P('M0,-12 C8,-18 16,-18 23,-15 V17 C16,14 8,14 0,19 Z', C.shade(color, 0.15)) +
          L('M-18,-8 C-12,-10 -7,-9 -4,-7 M-18,-1 C-12,-3 -7,-2 -4,0 M18,-8 C12,-10 7,-9 4,-7 M18,-1 C12,-3 7,-2 4,0', bg, 1.8);
        break;
      case 'check':
        g = O(0, 0, 21, color) + L('M-9,0 L-2,8 L10,-7', bg, 5);
        break;
      case 'person':
        g = O(0, -11, 9, color) + P('M-16,20 C-16,4 -8,0 0,0 C8,0 16,4 16,20 Z', color);
        break;
      case 'people':
        g = O(9, -8, 6.5, C.tint(color, 0.35)) + P('M-1,18 C-1,6 4,3 9,3 C14,3 20,6 20,18 Z', C.tint(color, 0.35)) +
          O(-5, -10, 8.5, color) + P('M-20,20 C-20,5 -12,1 -5,1 C2,1 10,5 10,20 Z', color);
        break;
      case 'chart':
        g = R(-20, 2, 10, 18, 2, color) + R(-6, -8, 10, 28, 2, color) + R(8, -18, 10, 38, 2, color) + R(-22, 20, 44, 3, 1.5, C.shade(color, 0.3));
        break;
      case 'magnifier':
        g = O(-4, -4, 15, color) + O(-4, -4, 10, bg) + `<g transform="rotate(45)">${R(10, -4, 18, 8, 4, color)}</g>`;
        break;
      case 'lock':
        g = L('M-9,-4 V-11 A9,9 0 0 1 9,-11 V-4', color, 5) + R(-15, -5, 30, 25, 5, color) + O(0, 5, 3.5, bg) + R(-1.5, 6, 3, 7, 1.5, bg);
        break;
      case 'cube':
        g = P('M0,-20 L18,-10 L0,0 L-18,-10 Z', C.tint(color, 0.22)) + P('M-18,-10 L0,0 V21 L-18,11 Z', color) + P('M18,-10 L0,0 V21 L18,11 Z', C.shade(color, 0.18));
        break;
      case 'prompt':
        g = R(-22, -18, 44, 36, 6, color) + L('M-13,-6 L-6,0 L-13,6', bg, 3) + R(-2, 5, 12, 3.5, 1.7, bg);
        break;
      case 'search':
        g = R(-22, -18, 44, 36, 6, color) + O(-2, -2, 7, 'none', `stroke="${bg}" stroke-width="3"`) + L('M3,3 L9,9', bg, 3.4);
        break;
      case 'git':
        g = R(-22, -18, 44, 36, 6, color) + L('M-7,-9 V9 M-7,-2 C-7,4 7,0 7,-6', bg, 3) + O(-7, -9, 3.6, bg) + O(-7, 9, 3.6, bg) + O(7, -7, 3.6, bg);
        break;
      default:
        g = O(0, 0, 20, color);
    }
    return `<g ${tr}>${g}</g>`;
  });
  // icon – standalone glyph prop. opts: kind, color, size (64). parts: icon
  D.icon = (o) => {
    const s = o.size || 64;
    return { svg: G('icon', [0, 0], ICON(o.kind || 'doc', 0, 0, s, o.color || INK, o.bg)), box: [-s / 2, -s / 2, s, s], scale: GFX };
  };

  /* ======================= harness / rope ======================= */
  // harness – waist belt drawn in CHARACTER units (insert into a rig with Props.harnessOn).  Anchor = belt centre.
  // parts: belt (pivot centre), buckle, cards[] (tabs, hidden unless opts.cards), slots[], ring.  opts: w (156), color, cards (bool), ring ('R'|'L')
  D.harness = (o) => {
    const w = o.w || 156, h = 24, col = o.color || PAL.navy, x = -w / 2, y = -h / 2;
    const side = o.ring === 'L' ? -1 : 1, rx = side * (w / 2 + 7);
    const kinds = ['doc', 'shield', 'wrench', 'target'];
    const cx = [-0.39, -0.21, 0.21, 0.39].map((f) => f * w);
    let s = `<g class="pp-belt" data-o="0 0">`;
    s += SR(x, y, w, h, 7, col, 'bottom', 0.3, 0.2);
    s += R(x + 4, y + 4, w - 8, 2, 1, C.tint(col, 0.25), 'opacity=".7"');
    s += cx.map((c) => R(c - 11, y + 5, 22, 13, 3, C.shade(col, 0.3), 'class="pp-slot"')).join('');
    s += `<g class="pp-ring">${O(rx, 0, 9, 'none', `stroke="${PAL.metal}" stroke-width="5"`)}${R(side > 0 ? x + w - 6 : x - 2, -5, 8, 10, 2, PAL.joint)}</g>`;
    s += `<g class="pp-buckle" data-o="0 0">${R(-17, -17, 34, 34, 7, '#c9ccd1')}${R(-10, -10, 20, 20, 4, col)}${R(-3, -12, 6, 24, 3, PAL.joint)}</g>`;
    s += cx.map((c, i) => `<g class="pp-card" data-o="${n(c)} ${n(y + 14)}" ${o.cards ? '' : 'opacity="0"'}>${SR(c - 12, y - 10, 24, 28, 4, KIND[kinds[i]], 'bottom', 0.22, 0.18)}${ICON(kinds[i], c, y + 2, 15, '#fbf9f5', KIND[kinds[i]])}</g>`).join('');
    s += '</g>';
    return { svg: s, box: [x - 20, y - 14, w + 40, h + 28], points: { ring: [rx, 0] } };
  };
  // put a harness on a character (inserted right after the torso so the arms stay in front).  Returns { g, parts, ring }
  Props.harnessOn = (ch, opts = {}) => {
    const robot = ch.kind === 'robot', stout = ch.opts.build === 'stout';
    const y = opts.y ?? (robot ? 432 : stout ? 404 : 400);
    const w = opts.w ?? (robot ? 158 : stout ? 246 : 196);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'harness-on');
    g.setAttribute('transform', `translate(200 ${y})`);
    g.innerHTML = Props.svg('harness', { ...opts, w });
    const torso = ch.el.querySelector('.upper > .torso');
    torso.parentNode.insertBefore(g, torso.nextSibling);
    Props.pivots(g);
    const parts = Props.collect(g);
    return { g, parts, ring: parts.ring, y, w };
  };
  // snap the harness on: belt wraps (scaleX), buckle clicks
  A.harnessSnap = (tl, t, h, { dur = 0.35 } = {}) => {
    gsap.set(h.g, { autoAlpha: 0 });
    tl.set(h.g, { autoAlpha: 1 }, t);
    tl.fromTo(h.parts.belt, { scaleX: 0.15, scaleY: 1.4 }, { scaleX: 1, scaleY: 1, duration: dur, ease: 'back.out(2)', immediateRender: false }, t);
    tl.fromTo(h.parts.buckle, { scale: 1.6 }, { scale: 1, duration: 0.22, ease: 'power3.in', immediateRender: false }, t + dur * 0.6);
    return tl;
  };
  // slot card i into the belt
  A.harnessCard = (tl, t, h, i, { dur = 0.3 } = {}) =>
    tl.fromTo(h.parts.cards[i], { opacity: 0, y: -26, scale: 1.5 }, { opacity: 1, y: 0, scale: 1, duration: dur, ease: 'back.out(2.2)', immediateRender: true }, t);

  // ropeEnd – coiled rope end held in a hand.  parts: coil, tip (where the taut rope leaves the hand)
  D.ropeEnd = (o) => {
    const col = o.color || '#b8875a';
    let s = `<g class="pp-coil">${O(0, 6, 17, 'none', `stroke="${col}" stroke-width="6"`)}${O(4, 9, 13, 'none', `stroke="${C.shade(col, 0.12)}" stroke-width="5"`)}</g>`;
    s += `<g class="pp-tip">${O(-2, -10, 3, col)}</g>`;
    return { svg: s, box: [-22, -16, 46, 44], hold: { grip: [0, -6], angle: 0, grasp: 'fist' } };
  };

  // rope – K-independent controller: an SVG path in `svgEl` (a 1920×1080 svg) between two elements, recomputed after every seek.
  // state: { sag (px), on (0..1) } – tween it on the timeline.  Register: K.post.push(rope.update)
  Props.rope = (svgEl, fromEl, toEl, { color = '#b8875a', width = 7, sag = 60 } = {}) => {
    const NS = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', width); path.setAttribute('stroke-linecap', 'round');
    svgEl.appendChild(path);
    const state = { sag, on: 0 };
    const vis = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentNode) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; } return true; };
    const update = () => {
      if (!state.on || !vis(fromEl) || !vis(toEl) || !vis(svgEl)) { path.setAttribute('opacity', 0); return; }
      const sr = svgEl.getBoundingClientRect(), vb = svgEl.viewBox.baseVal, k = sr.width / (vb && vb.width ? vb.width : 1920);
      const c = (el) => { const r = el.getBoundingClientRect(); return [(r.left + r.width / 2 - sr.left) / k, (r.top + r.height / 2 - sr.top) / k]; };
      const [ax, ay] = c(fromEl), [bx, by] = c(toEl);
      const mx = (ax + bx) / 2, my = (ay + by) / 2 + state.sag;
      path.setAttribute('d', `M${n(ax)},${n(ay)} Q${n(mx)},${n(my)} ${n(bx)},${n(by)}`);
      path.setAttribute('opacity', state.on);
    };
    return { path, state, update };
  };

  // iconCard – rule card (doc / shield / wrench / target). anchor = centre. parts: card. opts: kind, text, color, w (250)
  D.iconCard = (o) => {
    const kind = o.kind || 'doc', col = o.color || KIND[kind] || PAL.blue, text = o.text ?? '情報・ツール';
    const size = o.size || 26, w = o.w || Math.max(200, measure(text, size, 700) + 104), h = 76, x = -w / 2, y = -h / 2;
    let s = R(x + 3, y + 5, w, h, 14, 'rgba(0,0,0,.10)');
    s += P(rr(x, y, w, h, 14), '#fbf9f5') + SR(x, y, 70, h, 14, col, 'right', 0.18, 0.12) + R(x + 56, y, 14, h, 0, col);
    s += ICON(kind, x + 36, 0, 40, '#fbf9f5', col);
    s += T(x + 70 + (w - 70) / 2, size * 0.36, text, { size, weight: 700 });
    return { svg: G('card', [0, 0], s), box: [x, y, w + 3, h + 5], scale: GFX };
  };

  /* ======================= world props (character units, anchor = bottom centre unless noted) ======================= */
  // gate – crossing barrier. parts: bar (pivot = hinge on the post top; rotation 0 = closed/horizontal), lamp.
  // opts: h (post height, 330), len (bar length, 300), dir (1 = bar points right, -1 = left), open (start raised)
  D.gate = (o) => {
    const h = o.h || 330, len = o.len || 300, dir = o.dir || 1;
    let s = R(-34, -18, 68, 18, 6, PAL.dark) + SR(-11, -h, 22, h - 10, 6, '#cfd2d6', 'right', 0.35, 0.18);
    s += `<g class="pp-lamp">${O(0, -h + 40, 14, PAL.red)}${O(0, -h + 40, 6, '#f6c1b5')}</g>`;
    const bx0 = dir > 0 ? 0 : -len, stripes = Math.round(len / 40);
    let bar = R(bx0, -h - 11, len, 22, 11, '#fbf9f5');
    for (let i = 0; i < stripes; i++) if (i % 2) bar += R(bx0 + (i * len) / stripes, -h - 11, len / stripes, 22, 0, PAL.red);
    const id = C.uid('gb');
    bar = clip(id, rr(bx0, -h - 11, len, 22, 11), bar) + O(0, -h, 17, PAL.dark) + O(0, -h, 7, PAL.metal);
    s += `<g class="pp-bar" data-o="0 ${-h}"${o.open ? ` transform="rotate(${-dir * 80} 0 ${-h})"` : ''}>${bar}</g>`;
    return { svg: s, box: [Math.min(-40, bx0 - 10), -h - 30, len + 50, h + 30], points: { hinge: [0, -h] }, state: { dir } };
  };
  A.gateTo = (tl, t, p, open = false, { dur = 0.3, ease } = {}) =>
    tl.to(p.parts.bar, { rotation: open ? -p.state.dir * 80 : 0, duration: dur, ease: ease || (open ? 'power2.out' : 'bounce.out') }, t);

  // redButton – pedestal + red push button + transparent hinged cover. parts: cover (pivot = back hinge), button, label
  // opts: text ('危険な操作'), open (cover starts open, default true)
  D.redButton = (o) => {
    const w = 170, h = 120, text = o.text ?? '危険な操作';
    let s = SR(-w / 2, -h, w, h, 12, '#d7d2c9', 'right', 0.2, 0.14);
    s += P(rr(-w / 2 + 14, -h + 40, w - 28, 50, 8), '#fbf9f5') + T(0, -h + 74, text, { size: Math.min(24, (w - 44) / Math.max(1, measure(text, 1, 700))), weight: 900, fill: PAL.red, cls: 'label' });
    s += R(-46, -h - 14, 92, 18, 6, PAL.dark);
    s += `<g class="pp-button" data-o="0 ${-h - 14}">${P(`M-36,${-h - 14} A36,26 0 0 1 36,${-h - 14} Z`, PAL.red)}${P(`M-24,${-h - 24} Q-12,${-h - 36} 6,${-h - 37}`, 'none', `stroke="#f2a493" stroke-width="5" stroke-linecap="round"`)}</g>`;
    const cov = `${P(rr(-60, -h - 66, 120, 66, 14), '#cfe3f3', 'opacity=".55"')}${R(-52, -h - 60, 34, 8, 4, '#fff', 'opacity=".8"')}${R(-60, -h - 6, 120, 6, 3, '#9fb6c8')}`;
    s += `<g class="pp-cover" data-o="${w / 2 - 22} ${-h - 4}"${o.open !== false ? ` transform="rotate(-118 ${w / 2 - 22} ${-h - 4})"` : ''}>${cov}</g>`;
    return { svg: s, box: [-w / 2 - 40, -h - 150, w + 120, h + 150], points: { button: [0, -h - 30] } };
  };
  A.coverClose = (tl, t, p, { dur = 0.22 } = {}) => tl.to(p.parts.cover, { rotation: 0, duration: dur, ease: 'power3.in' }, t);

  // scanner – arch inspection gate with a sign of 3 lamps. parts: lamps[] (lit overlay, hidden), checks[], arch
  // opts: labels (['テスト', 'Lint', 'CI'])
  D.scanner = (o) => {
    const labels = o.labels || ['テスト', 'Lint', 'CI'], W = 300, H = 270;
    let s = `<g class="pp-arch">${SR(-W / 2, -H, 34, H, 8, '#c9cdd3', 'right', 0.35)}${SR(W / 2 - 34, -H, 34, H, 8, '#c9cdd3', 'right', 0.35)}${SR(-W / 2 - 6, -H - 34, W + 12, 40, 10, PAL.dark, 'bottom', 0.25)}`;
    for (let i = 0; i < 5; i++) s += R(-W / 2 + 40, -H + 30 + i * 46, W - 80, 4, 2, '#7fd0a8', 'opacity=".35"');
    s += '</g>';
    const sw = 360, sh = 130, sy = -H - 34 - sh - 6;
    s += P(rr(-sw / 2, sy, sw, sh, 16), '#fbf9f5') + R(-sw / 2, sy + sh - 10, sw, 10, 0, '#e3ddd2', '');
    labels.forEach((lb, i) => {
      const cx = -sw / 2 + sw / 6 + (i * sw) / 3, cy = sy + 46;
      s += O(cx, cy, 28, '#cfcac1') + `<g class="pp-lamp" data-o="${n(cx)} ${n(cy)}" opacity="0">${O(cx, cy, 38, PAL.green, 'opacity=".25"')}${O(cx, cy, 28, PAL.green)}${L(`M${cx - 12},${cy} L${cx - 3},${cy + 10} L${cx + 13},${cy - 9}`, '#fbf9f5', 6)}</g>`;
      s += T(cx, sy + 108, lb, { size: 26, weight: 800 });
    });
    return { svg: s, box: [-sw / 2 - 20, sy - 20, sw + 40, -sy + 20], points: { pass: [0, -40] } };
  };
  A.scanLamp = (tl, t, p, i) => tl.fromTo(p.parts.lamps[i], { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)', immediateRender: true }, t);

  // magnifier – hand-held lens. anchor = lens centre
  D.magnifier = () => {
    let s = `<g transform="rotate(40)">${R(-8, 40, 16, 70, 8, PAL.wood)}${R(-10, 36, 20, 14, 4, PAL.dark)}</g>`;
    s += O(0, 0, 46, PAL.dark) + O(0, 0, 37, '#d8ecf6') + P('M-22,-14 A26,26 0 0 1 -6,-28', 'none', 'stroke="#fff" stroke-width="7" stroke-linecap="round"');
    return { svg: s, box: [-48, -48, 120, 140], hold: { grip: [-58, 76], angle: 0, grasp: 'fist', gripInHand: true } };
  };

  // stamp (はんこ) – hand-held. parts: body. anchor = bottom face centre
  D.stamp = (o) => {
    const col = o.color || PAL.red;
    let s = `<g class="pp-body">${R(-12, -96, 24, 54, 10, PAL.wood)}${O(0, -104, 20, C.shade(PAL.wood, 0.1))}${SR(-34, -46, 68, 34, 8, PAL.dark, 'right', 0.3)}${R(-36, -14, 72, 14, 4, col)}</g>`;
    return { svg: s, box: [-40, -126, 80, 128], hold: { grip: [0, -78], angle: 0, grasp: 'fist' } };
  };
  // stampMark – 朱 imprint (GFX). parts: mark. opts: text ('承認'), size (120), color
  D.stampMark = (o) => {
    const r = (o.size || 120) / 2, col = o.color || PAL.red, text = o.text ?? '承認';
    const fs = Math.min(r * 0.82, (r * 1.45) / Math.max(1, [...text].length) * 1.05);
    let s = O(0, 0, r, 'none', `stroke="${col}" stroke-width="${n(r * 0.1)}"`) + O(0, 0, r * 0.8, 'none', `stroke="${col}" stroke-width="${n(r * 0.04)}"`);
    s += T(0, fs * 0.36, text, { size: fs, weight: 900, fill: col });
    return { svg: G('mark', [0, 0], `<g transform="rotate(-12)" opacity=".92">${s}</g>`), box: [-r, -r, 2 * r, 2 * r], scale: GFX };
  };
  // stamp down: body presses (t = impact), mark appears
  A.stampDown = (tl, t, stampProp, mark, { dur = 0.25 } = {}) => {
    if (stampProp) tl.to(stampProp.parts ? stampProp.parts.body : stampProp, { keyframes: { y: [0, 18, 0] }, duration: dur * 2, ease: 'power2.inOut' }, t - dur);
    if (mark) tl.fromTo(mark.parts ? mark.parts.mark : mark, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.14, ease: 'power3.in', immediateRender: true }, t - 0.06);
    return tl;
  };

  // target – rings + arrow (GFX). parts: rings, arrow (pivot = tip at the centre). opts: r (70)
  D.target = (o) => {
    const r = o.r || 70;
    let s = G('rings', [0, 0], O(0, 0, r, PAL.red) + O(0, 0, r * 0.74, '#fbf9f5') + O(0, 0, r * 0.5, PAL.red) + O(0, 0, r * 0.25, '#fbf9f5') + O(0, 0, r * 0.1, PAL.red));
    const a = `${L(`M0,0 L${r * 1.15},${-r * 1.15}`, PAL.dark, 6)}${P(`M${r * 1.15},${-r * 1.15} l-6,-30 l14,10 l10,14 Z`, PAL.blue)}${P(`M${r * 1.15},${-r * 1.15} l30,6 l-10,-14 l-14,-10 Z`, C.shade(PAL.blue, 0.15))}${O(0, 0, 5, PAL.dark)}`;
    s += G('arrow', [0, 0], a);
    return { svg: s, box: [-r, -r - 44, 2 * r + 44, 2 * r + 44], scale: GFX };
  };
  A.arrowHit = (tl, t, p, { dur = 0.25 } = {}) => {
    tl.fromTo(p.parts.arrow, { x: 260, y: -260, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: dur, ease: 'power2.in', immediateRender: true }, t - dur);
    tl.to(p.parts.arrow, { keyframes: { rotation: [0, -4, 3, -1.5, 0] }, duration: 0.4, ease: 'none' }, t);
    return tl;
  };

  // shield – red shield with a white minus (GFX). parts: shield. opts: size (120), color
  D.shield = (o) => {
    const s0 = o.size || 120;
    return { svg: G('shield', [0, 0], ICON(o.check ? 'shieldCheck' : 'shieldMinus', 0, 0, s0, o.color || PAL.red)), box: [-s0 / 2, -s0 / 2, s0, s0], scale: GFX };
  };

  // flag – small flag on a pole. anchor = pole bottom. parts: cloth (pivot = pole top). opts: color, h (220), text
  D.flag = (o) => {
    const h = o.h || 220, col = o.color || PAL.accent;
    let s = R(-4, -h, 8, h, 4, PAL.dark) + O(0, -h - 4, 8, PAL.yellow);
    s += `<g class="pp-cloth" data-o="0 ${-h + 6}">${P(`M4,${-h + 6} C40,${-h - 6} 70,${-h + 16} 110,${-h + 6} L110,${-h + 76} C70,${-h + 86} 40,${-h + 64} 4,${-h + 76} Z`, col)}${o.text ? T(58, -h + 52, o.text, { size: 24, weight: 900, fill: '#fbf9f5' }) : O(56, -h + 41, 14, '#fbf9f5')}</g>`;
    return { svg: s, box: [-14, -h - 14, 130, h + 14], hold: { grip: [0, -40], angle: 0, grasp: 'fist' } };
  };

  /* ======================= UI (GFX) ======================= */
  // card6 – Harness Canvas element card. anchor = centre. parts: front, back, art, split, mech, inf
  // opts: num, color, name, desc, icons (['target', 'check']), art (svg at (0, artY) instead of icons), w (400), h (210 | 300 with split),
  //       split: [mechText, infText] (both may contain '\n')
  D.card6 = (o) => {
    const col = o.color || PAL.blue, w = o.w || 400, h = o.h || (o.split ? 300 : 210), x = -w / 2, y = -h / 2;
    const bg = C.mix(col, '#fbf9f5', 0.86), num = String(o.num ?? 1);
    let f = P(rr(x, y, w, h, 18), bg);
    f += O(x + 40, y + 40, 25, col) + T(x + 40, y + 50, num, { size: 30, weight: 800, fam: 'Inter', fill: '#fbf9f5' });
    const name = o.name || 'Goal / Acceptance', ns = Math.min(30, (w - 110) / Math.max(1, measure(name, 1, 800)));
    f += T(x + 78 + (w - 90) / 2, y + 50, name, { size: ns, weight: 800, fam: 'Inter' });
    const artY = y + 108;
    const icons = o.icons || [];
    f += `<g class="pp-art">${o.art != null ? `<g transform="translate(0 ${n(artY)})">${o.art}</g>` : icons.map((k, i) => ICON(k, (i - (icons.length - 1) / 2) * 76, artY, 58, k === 'check' || k === 'people' || k === 'person' ? col : C.shade(col, 0.05))).join('')}</g>`;
    const desc = o.desc || '目的・評価基準', ds = Math.min(24, (w - 40) / Math.max(1, measure(desc, 1, 700)));
    f += T(0, y + 172, desc, { size: ds, weight: 700 });
    if (o.split) {
      const bw = (w - 44) / 2, by = y + 192, bh = h - 192 - 14;
      const box = (bx, kind, title, text, c) => {
        let b = P(rr(bx, by, bw, bh, 12), '#fbf9f5') + ICON(kind, bx + 30, by + 28, 32, c) + T(bx + 54, by + 38, title, { size: 23, weight: 900, fill: c, anchor: 'start' });
        const lines = String(text).split('\n');
        const fs = Math.min(22, Math.min(...lines.map((l) => (bw - 18) / Math.max(1, measure(l, 1, 700)))));
        b += lines.map((l, i) => T(bx + bw / 2, by + 74 + i * fs * 1.3, l, { size: fs, weight: 700 })).join('');
        return b;
      };
      f += `<g class="pp-split"><g class="pp-mech">${box(x + 16, 'gear', '機械的', o.split[0], PAL.blue)}</g><g class="pp-inf">${box(x + 28 + bw, 'bulb', '推論的', o.split[1], PAL.purple)}</g></g>`;
    }
    let b = P(rr(x, y, w, h, 18), col) + P(rr(x + 10, y + 10, w - 20, h - 20, 12), C.shade(col, 0.08));
    for (let i = 0; i < 6; i++) b += L(`M${x + 30 + i * 70},${y + h - 20} L${x + 90 + i * 70},${y + 20}`, C.tint(col, 0.08), 10, 'opacity=".6"');
    b += O(0, 0, 44, '#fbf9f5') + T(0, 16, num, { size: 46, weight: 800, fam: 'Inter', fill: col });
    const id = C.uid('c6');
    return { svg: `<g class="pp-back">${clip(id, rr(x, y, w, h, 18), b)}</g><g class="pp-front" opacity="0">${f}</g>`, box: [x, y, w, h], scale: GFX, points: { art: [0, artY] } };
  };
  // flip a card6 (its el is scaled in X; parts swap at the mid point). t = start, dur = whole flip
  A.cardFlip = (tl, t, p, { dur = 0.5 } = {}) => {
    tl.to(p.el, { scaleX: 0, duration: dur / 2, ease: 'power2.in' }, t);
    tl.set(p.parts.back, { opacity: 0 }, t + dur / 2).set(p.parts.front, { opacity: 1 }, t + dur / 2);
    tl.to(p.el, { scaleX: 1, duration: dur / 2, ease: 'power2.out' }, t + dur / 2);
    return tl;
  };

  // Text-only by default; href explicitly adds an independently obtained icon.
  D.copilotBadge = (o) => {
    const href = o.href ?? null;
    if (href !== null && (typeof href !== 'string' || !href.trim())) {
      throw new Error('copilotBadge.href must be a nonempty image URL');
    }
    const fs = o.size || 26, text = o.text || 'GitHub Copilot', ic = fs * 1.9;
    const tw = measure(text, fs, 700, 'Inter'), w = tw + (href ? ic + fs * 1.2 : fs * 0.7), h = fs * 2.3, x = -w / 2, y = -h / 2;
    let s = R(x + 2, y + 4, w, h, h / 2.6, 'rgba(0,0,0,.12)') + P(rr(x, y, w, h, h / 2.6), '#ffffff');
    if (href) {
      s += `<image href="${esc(href)}" x="${n(x + fs * 0.35)}" y="${n(-ic / 2)}" width="${n(ic)}" height="${n(ic)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    s += T(href ? x + fs * 0.35 + ic + fs * 0.15 : 0, fs * 0.36, text, {
      size: fs, weight: 700, fam: 'Inter', anchor: href ? 'start' : 'middle', fill: '#1b1f24',
    });
    return { svg: G('badge', [0, 0], s), box: [x, y, w + 2, h + 4], scale: GFX };
  };

  // cornerBox – intro corner window frame (white + thick navy rounded border + soft shadow). anchor = top-left
  // opts: w (620), h (300), border (8)
  D.cornerBox = (o) => {
    const w = o.w || 620, h = o.h || 300, b = o.border || 8;
    let s = P(rr(6, 10, w, h, 30), 'rgba(0,0,0,.14)') + P(rr(0, 0, w, h, 30), PAL.navy) + P(rr(b, b, w - 2 * b, h - 2 * b, 30 - b), '#fbf9f5');
    s += R(b, h - b - 70, w - 2 * b, 70, 0, '#efeae2', `clip-path="inset(0 round 0 0 ${30 - b}px ${30 - b}px)"`);
    return { svg: G('frame', [w / 2, h], s), box: [0, 0, w + 6, h + 10], scale: GFX, points: { inner: [b, b, w - 2 * b, h - 2 * b] } };
  };
})();
