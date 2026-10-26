/* Props (小物) library – same flat, outline-free language as the character rigs.
 * Classic script → window.Props.  Load after characters/common.js (uses Chars.mix/shade/tint/uid/rng).
 *
 *   const clock = Props.create('clock', { time: { h: 10, m: 10 } });   // default size = character scale
 *   stage.appendChild(clock.el); clock.place(1400, 300);                // place(x, y) puts the ANCHOR at (x, y)
 *   Props.anim.clockTick(tl, 2, clock, { minutes: 5 });
 *   const memo = Props.hand('memo', tanaka, 'R', { text: '2分くらいで、たのむよ' });
 *   memo.pose(tl, 1, 'present');                                         // arm pose + keep the prop upright
 *
 * Units: world props are drawn in CHARACTER units (the 400x760 rig viewBox), so by default they are
 * scaled by 0.75 → in proportion with a 300px-wide character.  UI/graphic props use 1 unit = 1px.
 * Anchors: standing objects = bottom-centre, handheld / floating = centre, speechBubble = tail tip.
 * Animatable sub-parts carry class "pp-<name>"; their pivot is stored in data-o="x y" and applied
 * as GSAP svgOrigin by create()/hand()/Props.pivots(root).
 */
(function () {
  const C = window.Chars;
  const Props = (window.Props = window.Props || {});
  const INK = C.INK;
  const PAL = (Props.PAL = {
    ink: INK, navy: '#2e3a56', paper: '#efebe4', sheet: '#fbf9f5', bg: '#ece8e1', muted: '#8c867d',
    accent: '#d0553e', blue: '#3f6fb3', red: '#d0553e', green: '#4f9775', yellow: '#e3ab2c',
    purple: '#76629f', orange: '#e07a38', teal: '#2d8a8a', metal: '#a9adb3', joint: '#6f747c',
    dark: '#3a3f4a', screen: '#1d2027', wood: '#c49a6c', warm: '#d9d3c8',
    synBlue: '#7aa3e0', synRed: '#e98a74', synYellow: '#e9c15a', synGreen: '#80c09d', synMuted: '#6f747c',
  });

  /* ---------------- small SVG helpers ---------------- */
  const n = (v) => +(+v).toFixed(2);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isCJK = (s) => /[\u2e80-\uffef]/.test(s);
  const famOf = (s, f) => f || (isCJK(s) ? 'Zen' : 'Inter');
  const R = (x, y, w, h, r, fill, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ''} fill="${fill}" ${extra}/>`;
  const O = (cx, cy, r, fill, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" ${extra}/>`;
  const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const L = (d, stroke, w, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const rr = (x, y, w, h, r) => `M${n(x + r)},${n(y)} H${n(x + w - r)} A${n(r)},${n(r)} 0 0 1 ${n(x + w)},${n(y + r)} V${n(y + h - r)} A${n(r)},${n(r)} 0 0 1 ${n(x + w - r)},${n(y + h)} H${n(x + r)} A${n(r)},${n(r)} 0 0 1 ${n(x)},${n(y + h - r)} V${n(y + r)} A${n(r)},${n(r)} 0 0 1 ${n(x + r)},${n(y)} Z`;
  const G = (name, o, inner, extra = '') => `<g class="pp-${name}"${o ? ` data-o="${n(o[0])} ${n(o[1])}"` : ''} ${extra}>${inner}</g>`;
  const T = (x, y, s, { size = 16, weight = 700, fam, fill = INK, anchor = 'middle', ls = 0, cls = '', extra = '' } = {}) =>
    `<text x="${n(x)}" y="${n(y)}" font-family="${famOf(s, fam)}" font-size="${n(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''}${cls ? ` class="pp-${cls}"` : ''} ${extra}>${esc(s)}</text>`;
  const clip = (id, shapeD, inner) => `<clipPath id="${id}"><path d="${shapeD}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;
  const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  // rounded rect with ONE flat shade strip on a side ('right' | 'left' | 'bottom' | 'top'), clipped to the shape
  const SR = (x, y, w, h, r, fill, side = 'right', sw = 0.2, t = 0.16) => {
    const d = rr(x, y, w, h, Math.min(r, w / 2, h / 2)), id = C.uid('pc');
    const k = sw <= 1 ? (side === 'right' || side === 'left' ? w * sw : h * sw) : sw;
    const st = side === 'right' ? [x + w - k, y, k, h] : side === 'left' ? [x, y, k, h] : side === 'top' ? [x, y, w, k] : [x, y + h - k, w, k];
    return P(d, fill) + (side ? clip(id, d, R(st[0], st[1], st[2], st[3], 0, C.shade(fill, t))) : '');
  };

  // closed smooth path through points (Catmull-Rom → cubic Bézier)
  const smooth = (pts) => {
    const k = pts.length; let d = `M${n(pts[0][0])},${n(pts[0][1])}`;
    for (let i = 0; i < k; i++) {
      const p0 = pts[(i - 1 + k) % k], p1 = pts[i], p2 = pts[(i + 1) % k], p3 = pts[(i + 2) % k];
      d += ` C${n(p1[0] + (p2[0] - p0[0]) / 6)},${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)},${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])},${n(p2[1])}`;
    }
    return d + ' Z';
  };
  // gear outline with trapezoid teeth (+ centre hole; use fill-rule evenodd)
  const gearD = (cx, cy, ro, ri, teeth, hole) => {
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * 360, s = 360 / teeth;
      [[ri, a - s * 0.3], [ro, a - s * 0.16], [ro, a + s * 0.16], [ri, a + s * 0.3]].forEach(([r, g], j) => {
        const [x, y] = polar(cx, cy, r, g); d += `${i === 0 && j === 0 ? 'M' : 'L'}${n(x)},${n(y)} `;
      });
    }
    d += 'Z';
    if (hole) d += ` M${n(cx - hole)},${n(cy)} a${hole},${hole} 0 1 0 ${n(hole * 2)},0 a${hole},${hole} 0 1 0 ${n(-hole * 2)},0 Z`;
    return d;
  };

  /* ---------------- text measuring (canvas when the font is loaded, else estimate) ---------------- */
  let ctx2d;
  const measure = (Props.measure = (s, size = 16, weight = 700, fam) => {
    s = String(s); fam = famOf(s, fam);
    const font = `${weight} ${size}px ${fam}`;
    try {
      if (document.fonts && document.fonts.check(font, s)) {
        ctx2d = ctx2d || document.createElement('canvas').getContext('2d');
        ctx2d.font = font; return ctx2d.measureText(s).width;
      }
    } catch (e) { /* estimate below */ }
    let w = 0;
    for (const ch of s) {
      if (isCJK(ch)) w += 1;
      else if (/[A-Z]/.test(ch)) w += /[MW]/.test(ch) ? 0.86 : 0.68;
      else if (/[a-z]/.test(ch)) w += /[mw]/.test(ch) ? 0.84 : /[ijlft r]/.test(ch) ? 0.34 : 0.56;
      else if (/[0-9]/.test(ch)) w += 0.6;
      else if (ch === ' ') w += 0.28;
      else w += /[.,:;'|!()[\]{}]/.test(ch) ? 0.32 : 0.6;
    }
    return w * size;
  });
  // resolves once the fonts used by props are loaded (build after this for exact text widths)
  Props.ready = () => Promise.all(['500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter',
    '500 20px Zen', '700 20px Zen', '900 20px Zen'].map((f) => document.fonts.load(f, f.includes('Zen') ? 'あ' : 'A'))).then(() => document.fonts.ready);

  // per-character tspans (for typeCode); colour fn(i) optional
  const charSpans = (s, colorAt) => [...s].map((c, i) => `<tspan class="pp-ch"${colorAt ? ` fill="${colorAt(i)}"` : ''}>${esc(c)}</tspan>`).join('');

  const D = (Props.DEFS = {});
  Props.util = { n, esc, R, O, P, L, rr, G, T, clip, smooth, gearD, polar, charSpans, measure };

  /* ======================= HAND-HELD (character units, anchor = centre unless noted) ======================= */

  // split text into lines: explicit \n, else after 、/。 when long
  const splitLines = (s) => String(s).split('\n').flatMap((l) => (l.length > 7 ? l.replace(/([、。])/g, '$1\n').split('\n').filter(Boolean) : [l]));

  // memo – A4 sheet. opts: text, title, stamp, color. hold: lower-left corner + thumb
  D.memo = (o, id) => {
    const w = 86, h = 120, x = -w / 2, y = -h / 2, f = 15, paper = o.color || PAL.sheet;
    const body = `M${x},${y} H${x + w - f} L${x + w},${y + f} V${y + h} H${x} Z`;
    let s = P(body, paper) + P(`M${x + w - f},${y} V${y + f} H${x + w} Z`, C.shade(paper, 0.14));
    let ty = y + 16;
    if (o.title) {
      s += T(x + 9, y + 21, o.title, { size: 10, weight: 900, anchor: 'start' }) + R(x + 9, y + 27, 34, 2, 1, PAL.accent);
      ty = y + 34;
    }
    const scribble = (y0, count) => {
      const r = C.rng(o.seed || 7);
      let lines = '';
      for (let i = 0; i < count; i++) {
        const yy = y0 + i * 11.5, len = i === count - 1 ? 22 + r() * 16 : 46 + r() * 20;
        let d = `M${x + 10},${n(yy)}`;
        for (let k = 0; k < len; k += 6) d += ` q1.5,${n(-2 - r() * 1.5)} 3,0 t3,0`;
        lines += L(d, '#bdb6ab', 1.8);
      }
      return lines;
    };
    if (o.text) {
      const lines = splitLines(o.text);
      const maxW = Math.max(...lines.map((l) => measure(l, 10, 700)));
      const size = o.size || Math.min(13, ((w - 16) / maxW) * 10);
      const end = ty + size * 1.15 + (lines.length - 1) * size * 1.55;
      s += `<g class="pp-text">` + lines.map((l, i) => T(x + 9, ty + size * 1.15 + i * size * 1.55, l, { size, weight: 700, anchor: 'start' })).join('') + '</g>';
      const rest = Math.floor((y + h - 14 - (end + 16)) / 11.5) + 1;
      if (o.scribble !== false && rest > 0) s += `<g class="pp-scribble">${scribble(end + 16, Math.min(4, rest))}</g>`;
    } else {
      s += `<g class="pp-text">${scribble(ty + 8, 7)}</g>`;
    }
    if (o.stamp) s += `<g transform="translate(${x + w - 22} ${y + h - 22}) rotate(-12)">${O(0, 0, 12, 'none', `stroke="${PAL.accent}" stroke-width="2"`)}${T(0, 4.2, o.stamp, { size: 11, weight: 900, fill: PAL.accent })}</g>`;
    return { svg: s, box: [x, y, w, h], hold: { grip: [x + 8, y + h - 12], angle: -4, grasp: 'thumb' } };
  };

  // script (台本) – stapled stack with taped spine. opts: title (vertical), sub, color
  D.script = (o) => {
    const w = 80, h = 110, x = -w / 2, y = -h / 2, cover = o.color || '#f3eee4';
    let s = R(x + 6, y + 4, w, h, 3, C.shade(PAL.paper, 0.2)) + R(x + 3, y + 2, w, h, 3, C.shade(PAL.paper, 0.1));
    s += R(x, y, w, h, 3, cover) + R(x, y, 14, h, 3, o.spine || PAL.navy) + R(x + 10, y, 4, h, 0, o.spine || PAL.navy);
    s += R(x + 4, y + 16, 6, 10, 1, PAL.metal) + R(x + 4, y + h - 26, 6, 10, 1, PAL.metal);
    const title = [...(o.title || '台本')];
    const size = Math.min(17, 78 / title.length);
    const lw = size + 12, lx = x + 14 + (w - 14) / 2 - lw / 2 + (o.sub ? 7 : 0), lh = title.length * size * 1.08 + 16;
    s += R(lx, y + 12, lw, lh, 2, '#fffdf9');
    s += title.map((c, i) => T(lx + lw / 2, y + 20 + size * 0.88 + i * size * 1.08, c, { size, weight: 900 })).join('');
    if (o.sub) s += [...o.sub].map((c, i) => T(lx - 8, y + 20 + 8 + i * 9.6, c, { size: 8.5, weight: 700, fill: PAL.muted })).join('');
    return { svg: s, box: [x, y, w + 6, h + 4], hold: { grip: [x + 20, y + h - 10], angle: -4, grasp: 'thumb' } };
  };

  // yenSign – hand-held placard on a stick. anchor = stick bottom. opts: text ('¥0'), color
  D.yenSign = (o) => {
    const text = o.text ?? '¥0', board = o.color || PAL.sheet;
    const size = 62, tw = measure(text, size, 800), w = Math.max(128, tw + 44), x = -w / 2;
    let s = R(-5, -92, 10, 92, 3, PAL.wood) + R(0, -92, 5, 92, 0, C.shade(PAL.wood, 0.16));
    s += SR(x, -176, w, 90, 8, board, 'bottom', 9, 0.12);
    const yen = text.startsWith('¥');
    s += `<text x="0" y="${n(-135 + size * 0.36)}" font-family="Inter" font-size="${size}" font-weight="800" fill="${INK}" text-anchor="middle" letter-spacing="-1.5">` +
      (yen ? `<tspan fill="${PAL.accent}">¥</tspan>${esc(text.slice(1))}` : esc(text)) + '</text>';
    return { svg: s, box: [x, -176, w, 176], hold: { grip: [0, -26], angle: 0, grasp: 'fist' } };
  };

  // priceTag – tag hanging from a string. anchor = top of the string. opts: text, sub, subSize (9), color
  D.priceTag = (o) => {
    const color = o.color || PAL.yellow, text = o.text ?? '¥0';
    const tw = measure(text, 28, 800), hw = Math.max(36, tw / 2 + 12);
    const body = `M0,40 L${hw},62 V${n(144)} Q${hw},150 ${hw - 6},150 H${-hw + 6} Q${-hw},150 ${-hw},144 V62 Z`;
    let s = P(body + ' M-5,58 a5,5 0 1 0 10,0 a5,5 0 1 0 -10,0 Z', color, 'fill-rule="evenodd"');
    s += P(`M${hw - 8},${n(40 + (22 * (hw - 8)) / hw)} L${hw},62 V144 Q${hw},150 ${hw - 6},150 H${hw - 8} Z`, C.shade(color, 0.14));
    s += L('M0,0 C-7,18 7,36 0,55', '#8f857a', 1.8);
    if (o.sub !== '') s += T(0, 88, o.sub || 'PRICE', { size: o.subSize || 9, weight: 700, fill: C.shade(color, 0.5), ls: o.subSize ? 0.5 : 2 });
    s += T(0, 124, text, { size: 28, weight: 800, ls: -0.5 });
    return { svg: s, box: [-hw, 0, hw * 2, 150], hold: { grip: [0, 2], angle: 6, grasp: 'fist' } };
  };

  // calculator. parts: display (text), keys[]. opts: text, color
  D.calculator = (o) => {
    const w = 78, h = 112, x = -w / 2, y = -h / 2, body = o.color || PAL.navy;
    let s = SR(x, y, w, h, 9, body, 'right', 10, 0.2);
    s += R(x + 8, y + 9, w - 18, 26, 4, '#cdd5c6');
    const dt = String(o.text ?? '0'), ds = Math.min(17, (w - 34) / Math.max(0.1, measure(dt, 1, 700)));
    s += T(x + w - 16, y + 22 + ds * 0.36, dt, { size: ds, weight: 700, anchor: 'end', cls: 'display', extra: 'style="font-variant-numeric:tabular-nums"' });
    const kw = 13, gap = 4.6, cols = ['#e7e2d9', '#e7e2d9', '#e7e2d9', PAL.orange];
    let keys = '';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const kx = x + 8 + c * (kw + gap), ky = y + 44 + r * (kw + gap);
      const col = r === 3 && c === 3 ? PAL.accent : cols[c];
      keys += R(kx, ky, kw, kw, 3, col, `class="pp-key" data-o="${n(kx + kw / 2)} ${n(ky + kw / 2)}"`);
    }
    s += keys;
    return { svg: s, box: [x, y, w, h], hold: { grip: [x + 6, y + h - 22], angle: -4, grasp: 'thumb' } };
  };

  // key – big symbolic key. anchor = centre of the bow. opts: text ('GPU'), color
  D.key = (o) => {
    const c = o.color || PAL.yellow, sh = C.shade(c, 0.18);
    let s = R(18, -6, 98, 12, 3, c) + R(18, 0, 98, 6, 0, sh);
    s += P('M96,6 h8 v14 h-8 Z M108,6 h8 v20 h-8 Z', c) + P('M96,13 h8 v7 h-8 Z M108,16 h8 v10 h-8 Z', sh);
    s += O(0, 0, 26, c) + P('M0,26 A26,26 0 0 0 26,0 L18,0 A18,18 0 0 1 0,18 Z', sh);
    s += O(-14, -14, 4.2, PAL.bg);
    const t = o.text ?? 'GPU';
    if (t) s += T(1, 4.5, t, { size: Math.min(13, 40 / Math.max(1, measure(t, 1, 800))), weight: 800, fill: INK });
    return { svg: s, box: [-26, -26, 142, 52], hold: { grip: [30, 0], angle: -16, grasp: 'fist' } };
  };

  // camera – compact camera. parts: flash (burst, opacity 0), button, lens. anchor = centre
  D.camera = (o) => {
    const body = o.color || PAL.dark, sh = C.shade(body, 0.22);
    let s = R(-20, -42, 34, 16, 4, body) + R(26, -36, 14, 10, 2, PAL.accent, 'class="pp-button" data-o="33 -26"');
    s += SR(-50, -30, 100, 62, 9, body, 'left', 20, 0.22);
    s += R(-44, -24, 15, 9, 2, '#e9e4da');
    s += `<g class="pp-lens" data-o="8 2">${O(8, 2, 24, '#5b6068')}${O(8, 2, 17, INK)}${O(8, 2, 9, '#353a44')}${O(2, -4, 4, '#ffffff', 'opacity=".45"')}</g>`;
    s += R(30, -24, 12, 6, 2, '#5b6068');
    const burst = Array.from({ length: 8 }, (_, i) => {
      const a = i * 45, [x1, y1] = polar(0, 0, 14, a), [x2, y2] = polar(0, 0, i % 2 ? 30 : 42, a);
      return `M${n(x1)},${n(y1)} L${n(x2)},${n(y2)}`;
    }).join(' ');
    s += `<g class="pp-flash" data-o="-36.5 -19.5" opacity="0"><g transform="translate(-36.5 -19.5)">${O(0, 0, 13, '#fff7d6')}${L(burst, '#ffe9a0', 4)}</g></g>`;
    return { svg: s, box: [-50, -42, 100, 74], hold: { grip: [-46, 18], angle: -4, grasp: 'thumb' } };
  };

  // ball – flat sphere with one shade crescent. anchor = bottom-centre (sits on the ground). part: body (pivot = contact point)
  D.ball = (o, id) => {
    const r = o.r || 22, c = o.color || PAL.accent;
    const cd = `M${-r},${-r} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0 Z`;
    const inner = o.flat ? O(0, -r, r, c) : O(0, -r, r, C.shade(c, 0.18)) + clip(id + 'c', cd, O(-r * 0.2, -r * 1.2, r * 1.04, c));
    return { svg: G('body', [0, 0], inner), box: [-r, -2 * r, 2 * r, 2 * r], hold: { grip: [0, -r + 6], angle: 0, grasp: 'none' }, points: { center: [0, -r] }, state: { r } };
  };

  /* ======================= OBJECTS (character units, anchor = bottom-centre unless noted) ======================= */

  // deterministic code-line layout: [[x, w, colour], ...] per row
  const codeRows = (count, width, seed, colors) => {
    const r = C.rng(seed), rows = [];
    let indent = 0;
    for (let i = 0; i < count; i++) {
      const row = []; let x = indent * 8;
      const segs = 1 + Math.floor(r() * 3);
      for (let k = 0; k < segs && x < width - 14; k++) {
        const w = Math.min(width - x, 10 + r() * 26);
        row.push([x, w, colors[Math.floor(r() * colors.length)]]); x += w + 4;
      }
      rows.push(row);
      indent = Math.max(0, Math.min(3, indent + (r() < 0.4 ? 1 : r() < 0.6 ? -1 : 0)));
    }
    return rows;
  };
  Props.util.codeRows = codeRows;

  // laptop – front view (screen faces the viewer). parts: screen, lines[] (pivot = line start). opts: lines, code:false, view:'back', screen
  D.laptop = (o, id) => {
    const lid = o.view === 'back' ? '#c5c8cc' : PAL.dark;
    let s = R(-72, -104, 144, 98, 7, lid);
    if (o.view === 'back') {
      s += P('M-72,-24 H72 V-13 A7,7 0 0 1 65,-6 H-65 A7,7 0 0 1 -72,-13 Z', C.shade(lid, 0.1)) + O(0, -58, 9, C.tint(lid, 0.4));
    } else {
      const sx = -64, sy = -96, sw = 128, sh = 80;
      let inner = R(sx, sy, sw, sh, 2, o.screen || PAL.screen);
      if (o.code !== false) {
        const rows = codeRows(o.lines || 8, sw - 20, o.seed || 3, [PAL.synBlue, PAL.synRed, PAL.synYellow, PAL.synGreen, PAL.synMuted]);
        inner += rows.map((row, i) => {
          const y = sy + 10 + i * 8.6, x0 = sx + 10 + (row[0] ? row[0][0] : 0);
          return G('line', [x0, y + 2], row.map(([x, w, c]) => R(sx + 10 + x, y, w, 4, 2, c)).join(''));
        }).join('');
      }
      s += G('screen', [0, sy + sh / 2], clip(id + 's', rr(sx, sy, sw, sh, 2), inner));
      s += O(0, -100, 1.6, '#5b6068');
    }
    s += P('M-84,-6 H84 L80,0 H-80 Z', '#c5c8cc') + R(-84, -8, 168, 3, 1.5, '#d6d9dc') + R(-14, -8, 28, 3, 1.5, '#9da2a8');
    return { svg: s, box: [-84, -104, 168, 104], hold: { grip: [-60, -6], grasp: 'none' }, points: { screen: [-64, -96, 128, 80] } };
  };

  // desk – simple office desk. opts: w (340), color. points.surface = desk-top centre
  D.desk = (o) => {
    const w = o.w || 340, c = o.color || PAL.wood, top = -296;
    let s = R(-w / 2 + 22, top + 10, 12, -top - 10, 0, PAL.dark) + R(w / 2 - 34, top + 10, 12, -top - 10, 0, PAL.dark);
    s += R(-w / 2 + 22, top + 40, w - 44, 8, 0, C.shade(PAL.dark, 0.1));
    s += R(-w / 2, top, w, 16, 3, c) + R(-w / 2, top + 10, w, 6, 0, C.shade(c, 0.16));
    return { svg: s, box: [-w / 2, top, w, -top], points: { surface: [0, top] } };
  };

  // monitor – desktop display. parts: screen (content group), video (if opts.video). opts: src (image), video, content (svg string in screen coords 0..216 x 0..121.5), color
  D.monitor = (o, id) => {
    const bz = o.color || PAL.dark, sx = -108, sy = -168, sw = 216, sh = 121.5;
    let s = R(-12, -46, 24, 40, 0, '#a2a6ac') + R(0, -46, 12, 40, 0, C.shade('#a2a6ac', 0.14));
    s += R(-52, -10, 104, 10, 4, '#b4b8bd') + R(-52, -4, 104, 4, 0, C.shade('#b4b8bd', 0.14));
    s += R(-116, -176, 232, 138, 8, bz) + O(0, -42, 1.8, '#5b6068');
    let inner = R(0, 0, sw, sh, 0, o.background || PAL.screen);
    if (o.src) inner += `<image href="${esc(o.src)}" x="0" y="0" width="${sw}" height="${sh}" preserveAspectRatio="xMidYMid slice"/>`;
    if (o.video) inner += `<foreignObject x="0" y="0" width="${sw}" height="${sh}"><video xmlns="http://www.w3.org/1999/xhtml" class="pp-video" src="${esc(o.video)}" muted="" playsinline="" style="width:100%;height:100%;object-fit:cover;display:block"></video></foreignObject>`;
    if (o.content) inner += typeof o.content === 'function' ? o.content(sw, sh) : o.content;
    if (!o.src && !o.video && !o.content) inner += `<radialGradient id="${id}g" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#3a4256"/><stop offset="1" stop-color="${PAL.screen}"/></radialGradient>` + R(0, 0, sw, sh, 0, `url(#${id}g)`);
    s += clip(id + 'c', rr(sx, sy, sw, sh, 2), `<g class="pp-screen" transform="translate(${sx} ${sy})">${inner}</g>`);
    return { svg: s, box: [-116, -176, 232, 176], points: { screen: [sx, sy, sw, sh] } };
  };

  // clock – wall clock. anchor = centre. parts: hour, minute, second (pivot 0 0, rotation in degrees). opts: time:{h,m}, second:true, color
  D.clock = (o, id) => {
    const rim = o.color || PAL.navy, R0 = 60, Rf = 51;
    const t = o.time || { h: 10, m: 10 }, M = ((t.h % 12) * 60 + t.m) % 720;
    let s = O(0, 0, R0, rim) + P(`M${R0},0 A${R0},${R0} 0 0 1 ${-R0},0 H${-Rf} A${Rf},${Rf} 0 0 0 ${Rf},0 Z`, C.shade(rim, 0.18));
    s += O(0, 0, Rf, PAL.sheet);
    for (let i = 0; i < 12; i++) {
      const big = i % 3 === 0, [x1, y1] = polar(0, 0, Rf - 5, i * 30 - 90), [x2, y2] = polar(0, 0, Rf - (big ? 15 : 10), i * 30 - 90);
      s += L(`M${n(x1)},${n(y1)} L${n(x2)},${n(y2)}`, big ? INK : '#9a948b', big ? 4 : 2.4);
    }
    s += `<g class="pp-hour" data-o="0 0" transform="rotate(${n(M * 0.5)})">${L('M0,6 L0,-27', INK, 6.5)}</g>`;
    s += `<g class="pp-minute" data-o="0 0" transform="rotate(${n((M % 60) * 6)})">${L('M0,8 L0,-41', INK, 4.4)}</g>`;
    if (o.second) s += `<g class="pp-second" data-o="0 0">${L('M0,12 L0,-44', PAL.accent, 1.8)}</g>`;
    s += O(0, 0, 5, PAL.accent);
    return { svg: s, box: [-R0, -R0, 2 * R0, 2 * R0], state: { min: (t.h % 12) * 60 + t.m } };
  };

  // mp4Box – the finished video as a box. parts: lid. opts: text ('MP4'), color
  D.mp4Box = (o) => {
    const c = o.color || PAL.red, text = o.text ?? 'MP4';
    let s = SR(-58, -80, 116, 80, 6, c, 'bottom', 10);
    s += G('lid', [-62, -78], R(-62, -94, 124, 18, 4, C.shade(c, 0.1)));
    s += R(-40, -66, 80, 44, 5, PAL.sheet);
    s += P('M-30,-52 L-16,-44 L-30,-36 Z', c);
    s += T(10, -36, text, { size: 21, weight: 800, ls: -0.5 });
    return { svg: s, box: [-62, -94, 124, 94], hold: { grip: [-50, -40], grasp: 'thumb' } };
  };

  // giftBox – parts: lid (pivot = left hinge), bow, ribbon, glow (opacity 0). opts: text (label), sub, color, ribbon
  D.giftBox = (o) => {
    const c = o.color || PAL.blue, rb = o.ribbon || PAL.yellow, sh = C.shade(c, 0.16);
    let s = G('glow', [0, -112], `${O(0, -112, 62, '#fff3c9', 'opacity=".9"')}${[-56, -28, 0, 28, 56].map((a) => { const [x0, y0] = polar(0, -112, 74, a - 90), [x, y] = polar(0, -112, 112, a - 90); return L(`M${n(x0)},${n(y0)} L${n(x)},${n(y)}`, '#f2cf6e', 7); }).join('')}`, 'opacity="0"');
    s += SR(-80, -112, 160, 112, 4, c, 'right', 26) + R(-12, -112, 24, 112, 0, rb);
    if (o.text) {
      const tw = measure(o.text, 20, 800), w = Math.max(88, tw + 28);
      s += R(-w / 2, -82, w, o.sub ? 52 : 40, 5, PAL.sheet) + T(0, -55, o.text, { size: 20, weight: 800, ls: -0.3 });
      if (o.sub) s += T(0, -38, o.sub, { size: 11, weight: 700, fill: PAL.muted });
    }
    const bow = `<path d="M0,-136 C-30,-170 -52,-150 -36,-138 C-26,-132 -10,-134 0,-136 Z M0,-136 C30,-170 52,-150 36,-138 C26,-132 10,-134 0,-136 Z" fill="${rb}"/>` +
      P('M0,-136 C-10,-128 -18,-118 -22,-112 L-12,-110 Z M0,-136 C10,-128 18,-118 22,-112 L12,-110 Z', C.shade(rb, 0.14)) + O(0, -136, 8, C.shade(rb, 0.14));
    s += G('lid', [-88, -108], SR(-88, -136, 176, 30, 4, C.tint(c, 0.06), 'right', 32) + R(-12, -136, 24, 30, 0, rb) + G('bow', [0, -136], bow));
    return { svg: s, box: [-88, -170, 176, 170], hold: { grip: [-70, -40], grasp: 'thumb' } };
  };

  // frameMachine – eats frames (top funnel) and drops an MP4 (right tray). parts: gear, gear2, lamps[], body.
  // points.in = funnel mouth, points.out = tray (where to place an mp4Box). opts: label ('ENCODER'), color
  D.frameMachine = (o, id) => {
    const c = o.color || PAL.navy;
    let s = R(-128, -26, 26, 26, 3, PAL.dark) + R(84, -26, 26, 26, 3, PAL.dark);
    s += P('M-138,-330 H-46 L-66,-232 H-118 Z', '#b4b8bd') + P('M-62,-330 H-46 L-66,-232 H-78 Z', C.shade('#b4b8bd', 0.14)) + R(-144, -338, 104, 12, 4, '#c5c8cc');
    s += P('M146,-104 H186 L196,-30 H146 Z', PAL.dark) + P('M146,-36 L226,-24 V-14 L146,-24 Z', '#b4b8bd');
    s += G('body', [0, -24], SR(-150, -240, 300, 216, 14, c, 'right', 34));
    s += O(-8, -142, 62, C.shade(c, 0.24)) + O(-8, -142, 54, '#1f2533');
    const gear = P(gearD(-20, -156, 40, 31, 10, 9), PAL.yellow, 'fill-rule="evenodd"');
    const gear2 = P(gearD(24, -108, 25, 18, 8, 6), PAL.accent, 'fill-rule="evenodd"');
    s += clip(id + 'w', `M-62,-142 a54,54 0 1 0 108,0 a54,54 0 1 0 -108,0 Z`, G('gear2', [24, -108], gear2) + G('gear', [-20, -156], gear));
    s += [PAL.green, PAL.yellow, PAL.accent].map((col, i) => O(76 + i * 22, -212, 7, col, `class="pp-lamp" data-o="${76 + i * 22} -212"`)).join('');
    s += R(68, -186, 58, 8, 4, C.shade(c, 0.28)) + R(68, -170, 40, 8, 4, C.shade(c, 0.28));
    const label = o.label ?? 'ENCODER';
    if (label) { const w = measure(label, 12, 800) + 24; s += R(-126, -62, w, 24, 4, PAL.sheet) + T(-126 + w / 2, -45.5, label, { size: 12, weight: 800, ls: 1.2 }); }
    return { svg: s, box: [-150, -338, 376, 338], points: { in: [-92, -338], out: [196, -30] } };
  };

  // door – frame + swinging door. parts: door (pivot = hinge, open with scaleX), inside (light, opacity 0), keyhole, plate.
  // opts: label (name plate), color, light
  D.door = (o) => {
    const c = o.color || PAL.navy, fr = '#cfc8bc';
    let s = SR(-120, -836, 240, 836, 4, fr, 'top', 14, 0.1) + R(-102, -818, 204, 818, 0, '#24242b');
    s += `<g class="pp-inside" opacity="0">${R(-102, -818, 204, 818, 0, o.light || '#f6e7b8')}${P('M-102,0 L-150,40 H150 L102,0 Z', o.light || '#f6e7b8', 'opacity=".55"')}</g>`;
    let d = SR(-102, -818, 204, 818, 2, c, 'right', 14, 0.2);
    d += R(-74, -780, 144, 300, 4, C.tint(c, 0.07)) + R(-74, -440, 144, 380, 4, C.tint(c, 0.07));
    d += O(70, -410, 11, PAL.yellow) + R(58, -411, 24, 4, 2, C.shade(PAL.yellow, 0.18));
    d += G('keyhole', [70, -360], R(60, -380, 20, 40, 5, PAL.yellow) + O(70, -366, 4.2, INK) + P('M68,-366 L66.5,-352 H73.5 L72,-366 Z', INK));
    if (o.label) { const w = Math.max(90, measure(o.label, 20, 800) + 30); d += G('plate', [0, -700], R(-w / 2, -718, w, 36, 4, PAL.sheet) + T(0, -693, o.label, { size: 20, weight: 800, ls: 1 })); }
    s += G('door', [-102, 0], d);
    return { svg: s, box: [-120, -836, 240, 836], points: { keyhole: [70, -362], knob: [70, -410] } };
  };

  // gpuChip – graphics card. anchor = centre. parts: fan (pivot = fan hub), chip. opts: text ('GPU'), color
  D.gpuChip = (o) => {
    const c = o.color || PAL.dark, text = o.text ?? 'GPU';
    let s = R(-92, 36, 184, 12, 2, PAL.green) + R(-60, 48, 92, 8, 1, PAL.yellow) + R(40, 48, 22, 8, 1, PAL.yellow);
    s += R(96, -50, 10, 98, 2, '#b4b8bd') + R(94, -50, 4, 98, 0, C.shade('#b4b8bd', 0.14));
    s += SR(-100, -44, 196, 82, 9, c, 'bottom', 12, 0.24);
    s += O(-48, -3, 33, '#22252c');
    const blades = Array.from({ length: 7 }, (_, i) => `<path d="M0,-6 C10,-14 22,-14 27,-6 C18,-6 8,-2 2,4 Z" fill="#8b9097" transform="rotate(${i * (360 / 7)})"/>`).join('');
    s += G('fan', [-48, -3], `<g transform="translate(-48 -3)">${blades}${O(0, 0, 8, '#5b6068')}</g>`);
    let chip = R(20, -27, 52, 48, 5, PAL.green);
    for (let i = 0; i < 5; i++) chip += R(26 + i * 9.5, -32, 3, 5, 1, PAL.yellow) + R(26 + i * 9.5, 21, 3, 5, 1, PAL.yellow);
    chip += R(28, -19, 36, 32, 3, INK) + T(46, 1.5, text, { size: Math.min(13, 30 / Math.max(1, measure(text, 1, 800))), weight: 800, fill: PAL.sheet, ls: 0.5 });
    s += G('chip', [46, -3], chip);
    return { svg: s, box: [-100, -50, 206, 106], hold: { grip: [-92, 20], angle: -4, grasp: 'thumb' } };
  };

  // blenderDisc – ORIGINAL abstract "3D software" emblem (planet + wireframe + tilted orbit). anchor = centre.
  // parts: sat (satellite dot, use anim.orbit), sphere, emblem. opts: color, ring
  D.blenderDisc = (o, id) => {
    const bg = o.color || PAL.navy, sp = o.sphere || PAL.orange, ring = o.ring || PAL.yellow, tilt = -18;
    const ring1 = (back) => `<path d="M-50,0 A50,15 0 0 ${back ? 1 : 0} 50,0" fill="none" stroke="${ring}" stroke-width="5" stroke-linecap="round" transform="rotate(${tilt})"/>`;
    let s = O(0, 0, 64, bg) + P('M64,0 A64,64 0 0 1 -64,0 H-58 A58,58 0 0 0 58,0 Z', C.shade(bg, 0.18));
    s += ring1(false);
    let sph = O(0, 0, 30, C.shade(sp, 0.18)) + clip(id + 'k', 'M-30,0 a30,30 0 1 0 60,0 a30,30 0 1 0 -60,0 Z',
      O(-5, -5, 31, sp) +
      `<g fill="none" stroke="${C.tint(sp, 0.45)}" stroke-width="1.6" opacity=".7"><ellipse cx="0" cy="0" rx="12" ry="30"/><ellipse cx="0" cy="0" rx="30" ry="10"/><path d="M0,-30 V30"/></g>`);
    s += G('sphere', [0, 0], sph);
    s += ring1(true);
    const [sx, sy] = polar(0, 0, 1, 0);
    s += `<g transform="rotate(${tilt})"><g class="pp-sat" data-o="0 0">${O(50 * sx, 15 * sy, 7, PAL.sheet)}</g></g>`;
    return { svg: G('emblem', [0, 0], s), box: [-64, -64, 128, 128], state: { tilt, rx: 50, ry: 15 } };
  };

  // snail – flat, elegant. parts: body, shell, stalks (pivot = head). anchor = bottom-centre (foot)
  D.snail = (o) => {
    const bc = o.color || '#cdbfa8', sc = o.shell || '#c07a4f';
    let s = G('stalks', [76, -50], L('M72,-50 L66,-80', bc, 5) + L('M82,-50 L88,-80', bc, 5) + O(66, -81, 4.6, INK) + O(88, -81, 4.6, INK));
    s += G('body', [0, 0], P('M-70,0 Q-74,-12 -50,-14 L36,-16 Q56,-18 62,-38 Q66,-56 79,-56 Q94,-56 92,-34 Q90,-6 68,0 Z', bc) + P('M-70,0 Q-72,-6 -60,-7 L66,-7 Q72,-4 68,0 Z', C.shade(bc, 0.14)));
    const spiral = Array.from({ length: 60 }, (_, i) => { const a = i * 0.19 + 0.6, r = 3 + i * 0.47; return `${i ? 'L' : 'M'}${n(-4 + r * Math.cos(a))},${n(-48 + r * Math.sin(a))}`; }).join(' ');
    s += G('shell', [-6, -50], O(-6, -50, 40, sc) + L(spiral, C.shade(sc, 0.2), 6));
    return { svg: s, box: [-74, -90, 168, 90] };
  };

  // ttsMachine (音声合成マシン) – text in at the top slot, voice out of the horn.
  // parts: slot, grille (pulse with scale), lamp, display (text), horn. points.in / points.out. opts: label, text, color
  D.ttsMachine = (o) => {
    const c = o.color || PAL.teal;
    let s = R(-96, -22, 24, 22, 3, PAL.dark) + R(72, -22, 24, 22, 3, PAL.dark);
    s += G('horn', [112, -110], P('M108,-128 L158,-152 V-68 L108,-92 Z', '#b4b8bd') + P('M150,-148 L158,-152 V-68 L150,-72 Z', C.shade('#b4b8bd', 0.16)));
    s += SR(-112, -214, 224, 194, 14, c, 'right', 28);
    s += G('slot', [0, -214], R(-56, -222, 112, 14, 5, C.shade(c, 0.3)) + R(-46, -217, 92, 4, 2, INK));
    let dots = '';
    for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) dots += O(-80 + k * 12.4, -138 + r * 12.4, 3, '#4b505b');
    s += G('grille', [-49, -107], R(-92, -152, 86, 90, 10, INK) + dots);
    s += R(6, -152, 84, 34, 5, PAL.screen) + T(48, -129, o.text ?? 'TTS', { size: 15, weight: 800, fill: PAL.synGreen, ls: 1.5, cls: 'display' });
    s += [26, 70].map((x) => O(x, -88, 13, PAL.sheet) + R(x - 1.8, -100, 3.6, 10, 1.8, INK)).join('');
    s += O(92, -194, 6, PAL.yellow, 'class="pp-lamp" data-o="92 -194"');
    const label = o.label ?? '音声合成';
    if (label) { const w = measure(label, 13, 700) + 22; s += R(-92, -52, w, 22, 4, PAL.sheet) + T(-92 + w / 2, -36.5, label, { size: 13, weight: 700 }); }
    return { svg: s, box: [-112, -222, 270, 222], points: { in: [0, -222], out: [160, -110] } };
  };

  // volumeMeter – vertical LED meter. parts: level (clip rect: animate with anim.meterLevel), lit. opts: level (0..1), label ('VOICE')
  D.volumeMeter = (o, id) => {
    const segs = 10, sh = 18, gap = 4, bottom = -42, span = segs * (sh + gap) - gap, lvl = o.level ?? 0.6;
    const col = (i) => (i >= 8 ? PAL.accent : i >= 6 ? PAL.yellow : PAL.green);
    let off = '', lit = '';
    for (let i = 0; i < segs; i++) {
      const y = bottom - (i + 1) * sh - i * gap;
      off += R(-16, y, 32, sh, 3, '#3a3f4a'); lit += R(-16, y, 32, sh, 3, col(i));
    }
    let s = P(rr(-28, bottom - span - 16, 56, span + 30, 9), INK) + off;
    s += `<clipPath id="${id}l"><rect class="pp-level" x="-20" y="${n(bottom - span * lvl)}" width="40" height="${n(span * lvl)}"/></clipPath>`;
    s += `<g class="pp-lit" clip-path="url(#${id}l)">${lit}</g>`;
    const label = o.label ?? 'VOICE';
    if (label) { const w = Math.max(56, measure(label, 12, 800) + 18); s += R(-w / 2, -24, w, 24, 4, o.labelColor || PAL.navy) + T(0, -7.5, label, { size: 12, weight: 800, fill: PAL.sheet, ls: 1.2 }); }
    return { svg: s, box: [-28, bottom - span - 16, 56, span + 16 - bottom], state: { bottom, span, level: lvl } };
  };

  // bell – hanging bell on a small gallows. parts: bell (pivot = hanger), waves (arcs, opacity 0). opts: color
  D.bell = (o) => {
    const c = o.color || PAL.yellow, f = o.frame || PAL.navy;
    let s = SR(-84, -16, 168, 16, 4, f, 'bottom', 5) + R(-74, -206, 12, 192, 0, f) + R(62, -206, 12, 192, 0, C.shade(f, 0.16)) + R(-84, -218, 168, 16, 4, f);
    const bell = R(-3, -204, 6, 18, 2, '#8b9097') + P('M-38,-110 C-38,-150 -28,-188 0,-188 C28,-188 38,-150 38,-110 Z', c) +
      P('M14,-185 C30,-176 38,-148 38,-110 H24 C24,-146 20,-170 14,-185 Z', C.shade(c, 0.12)) +
      R(-46, -116, 92, 11, 5.5, C.shade(c, 0.2)) + O(0, -98, 7, PAL.dark);
    s += G('bell', [0, -204], bell);
    const arc = (sx) => L(`M${sx * 56},-172 Q${sx * 70},-148 ${sx * 56},-124 M${sx * 70},-182 Q${sx * 88},-148 ${sx * 70},-114`, PAL.accent, 4);
    s += `<g class="pp-waves" opacity="0">${arc(-1)}${arc(1)}</g>`;
    return { svg: s, box: [-84, -218, 168, 218] };
  };

  // chainTrack – ramp/rail segment for a ピタゴラ-style chain. opts: length (320), angle (deg, 14), low (40 = height of low end), dir (1: down to the right, -1: left)
  // points.start / points.end = rail-top at the high / low end (stage: prop.at(...))
  D.chainTrack = (o) => {
    const len = o.length || 320, a = ((o.angle ?? 14) * Math.PI) / 180, low = o.low ?? 40, dir = o.dir || 1, c = o.color || PAL.wood;
    const dx = (len / 2) * Math.cos(a), hi = low + len * Math.sin(a);
    const x0 = -dx * dir, y0 = -hi, x1 = dx * dir, y1 = -low, deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    const post = (x, top) => R(x - 6, top + 4, 12, -top - 4, 0, PAL.dark) + R(x - 16, -8, 32, 8, 3, PAL.dark);
    let s = post(x0 * 0.82, y0 + (y1 - y0) * 0.09) + post(x1 * 0.82, y1 - (y1 - y0) * 0.09);
    const rail = SR(0, -2, len, 14, 3, c, 'bottom', 5) + R(0, -8, 8, 8, 2, C.shade(c, 0.1)) + R(len - 8, -8, 8, 8, 2, C.shade(c, 0.1));
    s += `<g transform="translate(${n(x0)} ${n(y0)}) rotate(${n(deg)})">${dir < 0 ? `<g transform="translate(0 ${12}) scale(1 -1)">${rail}</g>` : rail}</g>`;
    const top = [Math.min(x0, x1) - 8, Math.min(y0, y1) - 12];
    return { svg: s, box: [top[0], top[1], Math.abs(x1 - x0) + 24, -top[1]], points: { start: [n(x0), n(y0 - 2)], end: [n(x1), n(y1 - 2)], angle: deg } };
  };

  // domino – toppling block. parts: body (pivot = bottom corner on the falling side). opts: color, dir (1 falls right)
  D.domino = (o) => {
    const c = o.color || PAL.navy, w = o.w || 24, h = o.h || 70, dir = o.dir || 1;
    return { svg: G('body', [(dir * w) / 2, 0], SR(-w / 2, -h, w, h, 3, c, 'right', 0.3)), box: [-w / 2, -h, w, h] };
  };

  // cube – isometric block (3D-ish building block). opts: size (44), color
  D.cube = (o) => {
    const s0 = o.size || 44, c = o.color || PAL.blue, hx = s0 * 0.866, hy = s0 * 0.5;
    const top = `M0,${-2 * s0} L${hx},${-2 * s0 + hy} L0,${-2 * s0 + 2 * hy} L${-hx},${-2 * s0 + hy} Z`;
    const left = `M${-hx},${-2 * s0 + hy} L0,${-s0} L0,0 L${-hx},${-hy} Z`;
    const right = `M${hx},${-2 * s0 + hy} L0,${-s0} L0,0 L${hx},${-hy} Z`;
    return { svg: G('body', [0, 0], P(top, C.tint(c, 0.22)) + P(left, c) + P(right, C.shade(c, 0.16))), box: [-hx, -2 * s0, 2 * hx, 2 * s0] };
  };

  // timer – digital readout. anchor = centre. parts: display (text), rec (dot). opts: text ('2:13'), label ('TIME'), color
  D.timer = (o) => {
    const c = o.color || INK, text = o.text ?? '2:13';
    const w = Math.max(220, measure(text, 54, 700) + 70), x = -w / 2;
    let s = SR(x, -54, w, 108, 12, c, 'bottom', 9, 0.3);
    s += T(x + 18, -30, o.label ?? 'TIME', { size: 11, weight: 700, fill: '#8b8f98', anchor: 'start', ls: 2.4 });
    s += O(-x - 20, -34, 5.5, PAL.accent, 'class="pp-rec"');
    s += T(0, 30, text, { size: 54, weight: 700, fill: '#f4f1ea', cls: 'display', extra: 'style="font-variant-numeric:tabular-nums"' });
    return { svg: s, box: [x, -54, w, 108] };
  };

  // soundIcon – speaker with waves; opts.muted shows the red cross. parts: speaker, waves[] (3 arcs, inner→outer), cross
  D.soundIcon = (o) => {
    const c = o.color || INK;
    let s = G('speaker', [-14, 0], R(-38, -15, 18, 30, 3, c) + P('M-22,-15 L4,-36 Q8,-38 8,-34 V34 Q8,38 4,36 L-22,15 Z', c));
    s += [16, 29, 42].map((r, i) => `<g class="pp-wave" data-o="8 0"${o.muted ? ' opacity="0"' : ''}>${L(`M${n(8 + r * Math.cos(0.8))},${n(-r * Math.sin(0.8))} A${r},${r} 0 0 1 ${n(8 + r * Math.cos(0.8))},${n(r * Math.sin(0.8))}`, c, 6)}</g>`).join('');
    s += `<g class="pp-cross" data-o="34 0"${o.muted ? '' : ' opacity="0"'}>${L('M22,-12 L46,12 M46,-12 L22,12', o.crossColor || PAL.accent, 6.5)}</g>`;
    return { svg: s, box: [-38, -38, 92, 76] };
  };

  /* ======================= GRAPHICS / UI (1 unit = 1px, anchor = centre unless noted) ======================= */
  const GFX = 1;

  // speechBubble – anchor = TAIL TIP. parts: bubble (pivot = tail tip, pop with scale), lines[], chs[] (per character).
  // opts: text ('\n' for lines), size (28), side ('left' tail on the left → bubble extends right | 'right'), dark, color, maxWidth
  D.speechBubble = (o) => {
    const size = o.size || 28, lines = String(o.text ?? 'こんにちは').split('\n');
    const lh = size * 1.42, px = size * 0.95, py = size * 0.62;
    const tw = Math.max(...lines.map((l) => measure(l, size, 700)));
    const w = Math.max(tw + px * 2, size * 3), h = lines.length * lh + py * 2 - (lh - size * 1.1);
    const sx = o.side === 'right' ? -1 : 1, x0 = o.side === 'right' ? -w + 30 : -30, y0 = -h - 26;
    const fill = o.color || (o.dark ? INK : '#fbf9f5'), tc = o.dark ? '#f4f1ea' : INK;
    const b1 = 20 * sx, b2 = 62 * sx;
    let s = P(rr(x0, y0, w, h, Math.min(26, h / 2)), fill) + P(`M${b1 - 2 * sx},${y0 + h - 2} L0,0 L${b2},${y0 + h - 2} Z`, fill);
    s += lines.map((l, i) => `<text class="pp-line" x="${n(x0 + w / 2)}" y="${n(y0 + py + size * 0.9 + i * lh)}" font-family="${famOf(l)}" font-size="${size}" font-weight="700" fill="${tc}" text-anchor="middle">${charSpans(l)}</text>`).join('');
    return { svg: G('bubble', [0, 0], s), box: [Math.min(x0, 0), y0, w + Math.abs(Math.min(x0, 0) - x0), -y0], scale: GFX, points: { body: [x0, y0, w, h] } };
  };

  // browserWindow – parts: content (group translated to the content area's top-left), bar, dots[]
  // opts: w (720), h (450), url, title, content (svg string or fn(w,h)), dark
  D.browserWindow = (o, id) => {
    const w = o.w || 720, h = o.h || 450, x = -w / 2, y = -h / 2, bar = Math.round(Math.max(34, Math.min(46, h * 0.1)));
    const bg = o.dark ? PAL.screen : '#fbf9f5', barC = o.dark ? '#2a2e37' : '#ddd7cc';
    let s = P(rr(x, y, w, h, 12), bg);
    s += G('bar', null, clip(id + 'b', rr(x, y, w, h, 12), R(x, y, w, bar, 0, barC)) +
      [PAL.accent, PAL.yellow, PAL.green].map((c, i) => O(x + 22 + i * 20, y + bar / 2, 6.5, c, 'class="pp-dot"')).join(''));
    const ux = x + 96, uw = w - 96 - 22, uh = bar - 18;
    s += R(ux, y + 9, uw, uh, uh / 2, o.dark ? '#1d2027' : '#efebe4');
    s += T(ux + 14, y + bar / 2 + 4.6, o.url ?? 'https://example.com', { size: 13, weight: 500, fill: o.dark ? '#8b8f98' : PAL.muted, anchor: 'start' });
    const cw = w, ch = h - bar;
    let content = typeof o.content === 'function' ? o.content(cw, ch) : o.content;
    if (content == null) {
      const m = Math.round(cw * 0.06), c2 = o.dark ? '#3a3f4a' : '#e2ddd3';
      content = R(m, m * 0.8, cw * 0.42, 22, 6, o.dark ? '#6f747c' : '#3a3f4a') + R(m, m * 0.8 + 38, cw * 0.56, 10, 5, c2) + R(m, m * 0.8 + 58, cw * 0.48, 10, 5, c2) +
        R(m, m * 0.8 + 92, cw - 2 * m, ch - m * 1.6 - 92, 10, o.dark ? '#2a2e37' : '#e9e4db') + O(cw * 0.5, m * 0.8 + 92 + (ch - m * 1.6 - 92) / 2, 22, o.dark ? '#3a3f4a' : '#d6d0c5');
    }
    s += clip(id + 'c', rr(x, y + bar, w, h - bar, 0) , `<g class="pp-content" transform="translate(${x} ${y + bar})">${content}</g>`);
    return { svg: s, box: [x, y, w, h], scale: GFX, points: { content: [x, y + bar, cw, ch] } };
  };

  // tiny syntax colouring: returns colour per character
  const synColors = (code) => {
    const cols = Array([...code].length).fill('#e8e4dc');
    const re = /(<\/?[\w-]*|\/?>)|("[^"]*"|'[^']*'|`[^`]*`)|(#[0-9a-fA-F]{3,6}\b|\b\d+(?:\.\d+)?(?:px|s|%)?)|(\b(?:gsap|to|from|fromTo|timeline|const|let|function|return|new)\b)|([{}()[\];:,.=])/g;
    let m;
    while ((m = re.exec(code))) {
      const c = m[1] ? PAL.synBlue : m[2] ? PAL.synGreen : m[3] ? PAL.synYellow : m[4] ? PAL.synRed : '#8b8f98';
      for (let i = m.index; i < m.index + m[0].length; i++) cols[i] = c;
    }
    return cols;
  };
  const LANG = { HTML: PAL.orange, CSS: PAL.blue, GSAP: PAL.green, JS: PAL.yellow, SVG: PAL.purple };

  // codeSnippet – dark editor panel with labelled, syntax-coloured lines. parts: lines[] (text, per-char tspans .pp-ch), labels[], caret
  // opts: lines: [{label:'HTML', code:'<div>'}, 'plain code', ...], file ('index.html'), size (20), w (auto)
  D.codeSnippet = (o) => {
    const size = o.size || 20, lh = size * 1.75;
    const lines = (o.lines || [{ label: 'HTML', code: '<div class="robot"></div>' }, { label: 'CSS', code: '.robot { color: #3f6fb3; }' }, { label: 'GSAP', code: 'gsap.to(".robot", { x: 300 })' }])
      .map((l) => (typeof l === 'string' ? { code: l } : l));
    const hasLab = lines.some((l) => l.label), labW = hasLab ? size * 3.6 : 0;
    const cw = Math.max(...lines.map((l) => measure(l.code, size, 500)));
    const head = o.file === '' ? 0 : 40, w = o.w || Math.max(300, labW + cw + 56), h = head + lines.length * lh + 26, x = -w / 2, y = -h / 2;
    let s = P(rr(x, y, w, h, 12), PAL.screen);
    if (head) s += P(rr(x, y, w, head, 12) + ' ', '#262a33') + R(x, y + head - 12, w, 12, 0, '#262a33') + [PAL.accent, PAL.yellow, PAL.green].map((c, i) => O(x + 20 + i * 17, y + 20, 5, c)).join('') +
      T(x + 82, y + 25, o.file ?? 'index.html', { size: 13, weight: 600, fill: '#8b8f98', anchor: 'start' });
    lines.forEach((l, i) => {
      const by = y + head + 14 + i * lh, ty = by + lh / 2 + size * 0.36;
      if (l.label) {
        const c = l.color || LANG[l.label] || PAL.muted, lw = measure(l.label, size * 0.6, 800) + 16;
        s += `<g class="pp-label">${R(x + 20, by + lh / 2 - size * 0.55, lw, size * 1.1, size * 0.3, c)}${T(x + 20 + lw / 2, by + lh / 2 + size * 0.21, l.label, { size: size * 0.6, weight: 800, fill: '#fbf9f5', ls: 0.6 })}</g>`;
      }
      const cols = synColors(l.code);
      s += `<text class="pp-line" x="${n(x + 28 + labW)}" y="${n(ty)}" font-family="Inter" font-size="${size}" font-weight="500" xml:space="preserve">${charSpans(l.code, (k) => cols[k])}</text>`;
    });
    s += R(x + 28 + labW, y + head + 14 + lh / 2 - size * 0.6, 2.5, size * 1.2, 1, PAL.accent, 'class="pp-caret" opacity="0"');
    return { svg: s, box: [x, y, w, h], scale: GFX, state: { lh } };
  };

  // codeTag – small pill showing a tag / keyword, e.g. '<svg>', 'CSS', 'gsap.to()'. opts: text, color (pill), size
  D.codeTag = (o) => {
    const text = o.text ?? '<svg>', size = o.size || 22, w = measure(text, size, 700) + size * 1.4, h = size * 1.8;
    const cols = o.color ? null : synColors(text);
    let s = P(rr(-w / 2, -h / 2, w, h, h * 0.3), o.color || PAL.screen);
    s += `<text x="0" y="${n(size * 0.36)}" font-family="Inter" font-size="${size}" font-weight="700" text-anchor="middle" fill="#fbf9f5">${cols ? charSpans(text, (k) => cols[k]) : esc(text)}</text>`;
    return { svg: s, box: [-w / 2, -h / 2, w, h], scale: GFX };
  };

  // timelineBars – GSAP-like track editor. parts: bars[] (pivot = bar start), playhead, rows[]. points: x0, x1 (track x at t=0 / t=D)
  // opts: rows [{label, bars:[[start,dur],...], color}], D (seconds, 4), w (760)
  D.timelineBars = (o) => {
    const rows = o.rows || [
      { label: 'robot', bars: [[0, 1.3], [1.8, 1.4]], color: PAL.blue },
      { label: 'text', bars: [[0.5, 1.6]], color: PAL.accent },
      { label: 'camera', bars: [[0.2, 3.1]], color: PAL.green },
      { label: 'sound', bars: [[1.2, 2.4]], color: PAL.yellow },
    ];
    const Dd = o.D || 4, w = o.w || 760, lab = 120, rh = 34, top = 52, h = top + rows.length * (rh + 8) + 18, x = -w / 2, y = -h / 2;
    const x0 = x + lab + 16, x1 = x + w - 22, sc = (x1 - x0) / Dd;
    let s = P(rr(x, y, w, h, 12), PAL.screen);
    for (let i = 0; i <= Dd * 2; i++) {
      const tx = x0 + (i / 2) * sc;
      s += R(tx - 1, y + 30, 2, i % 2 ? 6 : 10, 1, '#5b6068');
      if (i % 2 === 0) s += T(tx, y + 24, i / 2 + 's', { size: 12, weight: 600, fill: '#8b8f98' });
    }
    rows.forEach((r, i) => {
      const ry = y + top + i * (rh + 8);
      s += `<g class="pp-row">${R(x0 - 6, ry, x1 - x0 + 12, rh, 6, '#262a33')}${T(x + 22, ry + rh / 2 + 5, r.label, { size: 15, weight: 600, fill: '#c9c5bd', anchor: 'start' })}` +
        r.bars.map(([st, du]) => R(x0 + st * sc, ry + 5, du * sc, rh - 10, 6, r.color || PAL.blue, `class="pp-bar" data-o="${n(x0 + st * sc)} ${n(ry + rh / 2)}"`)).join('') + '</g>';
    });
    s += `<g class="pp-playhead">${R(x0 - 1.5, y + 34, 3, h - 44, 1.5, PAL.accent)}${P(`M${x0 - 8},${y + 30} H${x0 + 8} V${y + 38} L${x0},${y + 46} L${x0 - 8},${y + 38} Z`, PAL.accent)}</g>`;
    return { svg: s, box: [x, y, w, h], scale: GFX, points: { x0, x1 }, state: { D: Dd } };
  };

  // filmstrip – parts: frames[] (group per frame, pivot = frame centre), strip. opts: n (8), fw (120), fh (90), content fn(i, fw, fh) → svg, color
  D.filmstrip = (o) => {
    const N = o.n || 8, fw = o.fw || 120, fh = o.fh || 90, gap = 14, band = Math.round(fh * 0.3);
    const w = N * fw + (N + 1) * gap, h = fh + band * 2, x = -w / 2, y = -h / 2;
    let s = R(x, y, w, h, 6, o.color || '#2b2826', 'class="pp-strip"');
    const holes = Math.round(w / 26);
    for (let i = 0; i < holes; i++) {
      const hx = x + 9 + i * ((w - 18) / holes) + 2;
      s += R(hx, y + band / 2 - 5, 13, 10, 3, PAL.bg) + R(hx, y + h - band / 2 - 5, 13, 10, 3, PAL.bg);
    }
    const def = (i) => {
      const t = i / Math.max(1, N - 1), bx = fw * (0.18 + 0.64 * t), by = fh * 0.78 - Math.abs(Math.sin(t * Math.PI * 2)) * fh * 0.5;
      return R(0, fh * 0.84, fw, fh * 0.16, 0, '#ddd6ca') + O(bx, by, fh * 0.11, PAL.accent);
    };
    for (let i = 0; i < N; i++) {
      const fx = x + gap + i * (fw + gap), fy = y + band;
      s += `<g class="pp-frame" data-o="${n(fx + fw / 2)} ${n(fy + fh / 2)}"><g transform="translate(${n(fx)} ${n(fy)})">${R(0, 0, fw, fh, 3, '#f3efe7')}${(o.content || def)(i, fw, fh)}</g></g>`;
    }
    return { svg: s, box: [x, y, w, h], scale: GFX };
  };

  // waveform – audio bars. parts: bars[] (rects centred on y=0; animate with anim.waveform). opts: n (32), w (8), gap (5), h (90), color, seed
  D.waveform = (o) => {
    const N = o.n || 32, bw = o.w || 8, gap = o.gap ?? 5, H = o.h || 90, r = C.rng(o.seed || 11);
    const W = N * bw + (N - 1) * gap, x = -W / 2, hs = [];
    let s = '';
    for (let i = 0; i < N; i++) {
      const env = Math.sin(((i + 0.5) / N) * Math.PI) ** 0.7, v = Math.max(0.12, env * (0.35 + 0.65 * r()));
      const bh = Math.max(bw, H * v); hs.push(bh);
      s += R(x + i * (bw + gap), -bh / 2, bw, bh, bw / 2, o.color || PAL.blue, 'class="pp-bar"');
    }
    return { svg: s, box: [x, -H / 2, W, H], scale: GFX, state: { heights: hs, H, w: bw } };
  };

  // magicBlob – the vague "AI-generated video" on the text→video side: soft blob frame with blurry content.
  // parts: blob (inner content, slowly drift), shape (outline), sparks[], warp (filter: anim.warp), text. opts: r (150), text, seed
  D.magicBlob = (o, id) => {
    const R0 = o.r || 150, rnd = C.rng(o.seed || 5), N = 9;
    const pts = Array.from({ length: N }, (_, i) => polar(0, 0, R0 * (0.86 + rnd() * 0.22), (i / N) * 360 - 90));
    const d = smooth(pts);
    let s = `<defs><radialGradient id="${id}g" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#9b8ac0"/><stop offset=".6" stop-color="#76629f"/><stop offset="1" stop-color="#5c4e86"/></radialGradient>
      <filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(R0 * 0.07)}"/></filter>
      <filter id="${id}w" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence class="pp-turb" type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="${o.seed || 5}"/><feDisplacementMap in="SourceGraphic" scale="${o.warp ?? 10}" class="pp-warp"/></filter></defs>`;
    const blur = `<g filter="url(#${id}b)">${O(R0 * 0.3, -R0 * 0.32, R0 * 0.24, '#f1b56a')}${P(`M${-R0 * 1.2},${R0 * 0.35} Q${-R0 * 0.3},${R0 * 0.02} ${R0 * 0.4},${R0 * 0.3} T${R0 * 1.3},${R0 * 0.25} V${R0 * 1.3} H${-R0 * 1.2} Z`, '#5f9f86')}` +
      `${R(-R0 * 0.36, -R0 * 0.28, R0 * 0.2, R0 * 0.5, R0 * 0.1, '#f0e2cf')}${O(-R0 * 0.26, -R0 * 0.38, R0 * 0.1, '#f0e2cf')}</g>`;
    s += `<g filter="url(#${id}w)">` + G('shape', [0, 0], P(d, `url(#${id}g)`)) + clip(id + 'c', d, G('blob', [0, 0], blur)) + '</g>';
    const star = (x, y, k) => `<path class="pp-spark" data-o="${n(x)} ${n(y)}" d="M${n(x)},${n(y - k)} Q${n(x + k * 0.16)},${n(y - k * 0.16)} ${n(x + k)},${n(y)} Q${n(x + k * 0.16)},${n(y + k * 0.16)} ${n(x)},${n(y + k)} Q${n(x - k * 0.16)},${n(y + k * 0.16)} ${n(x - k)},${n(y)} Q${n(x - k * 0.16)},${n(y - k * 0.16)} ${n(x)},${n(y - k)} Z" fill="${PAL.yellow}"/>`;
    s += star(R0 * 0.95, -R0 * 0.82, R0 * 0.13) + star(-R0 * 1.02, -R0 * 0.5, R0 * 0.09) + star(R0 * 1.08, R0 * 0.42, R0 * 0.08);
    if (o.text) s += T(0, R0 * 1.32, o.text, { size: Math.max(18, R0 * 0.16), weight: 700, fill: PAL.purple, cls: 'text' });
    return { svg: s, box: [-R0 * 1.15, -R0 * 1.15, R0 * 2.3, R0 * 2.3 + (o.text ? R0 * 0.3 : 0)], scale: GFX };
  };

  // toolChips – row (or grid) of pill labels. parts: chips[] (pivot = chip centre). opts: items (['Sora','Veo','Kling','Runway']), colors, size (22), cols
  D.toolChips = (o) => {
    const items = o.items || ['Sora', 'Veo', 'Kling', 'Runway'], size = o.size || 22, h = size * 1.9, gap = size * 0.6;
    const colors = o.colors || [PAL.navy, PAL.purple, PAL.teal, PAL.orange, PAL.blue, PAL.green];
    const ws = items.map((t) => measure(t, size, 700) + size * 1.5), cols = o.cols || items.length;
    const rowsW = [];
    items.forEach((_, i) => { const r = Math.floor(i / cols); rowsW[r] = (rowsW[r] || -gap) + ws[i] + gap; });
    const W = Math.max(...rowsW), H = rowsW.length * h + (rowsW.length - 1) * gap;
    let s = '', cx = 0;
    items.forEach((t, i) => {
      const r = Math.floor(i / cols); if (i % cols === 0) cx = -rowsW[r] / 2;
      const y = -H / 2 + r * (h + gap), c = o.color || colors[i % colors.length];
      s += `<g class="pp-chip" data-o="${n(cx + ws[i] / 2)} ${n(y + h / 2)}">${R(cx, y, ws[i], h, h / 2, c)}${T(cx + ws[i] / 2, y + h / 2 + size * 0.36, t, { size, weight: 700, fill: '#fbf9f5' })}</g>`;
      cx += ws[i] + gap;
    });
    return { svg: s, box: [-W / 2, -H / 2, W, H], scale: GFX };
  };

  // yRoad – a road that forks into a Y. anchor = bottom of the stem. parts: stem, left, right (stroke paths, pathLength=1 → anim.draw),
  // dashes, labelL, labelR. points: fork, left, right (branch ends). opts: left/right (label text), leftColor/rightColor, w (56), spread (300), height (440)
  D.yRoad = (o) => {
    const rw = o.w || 56, sp = o.spread || 300, H = o.height || 440, fy = -H * 0.36, road = o.color || PAL.dark;
    const stem = `M0,0 L0,${n(fy)}`, left = `M0,${n(fy)} C0,${n(fy - H * 0.22)} ${-sp},${n(-H * 0.7)} ${-sp},${-H}`, right = `M0,${n(fy)} C0,${n(fy - H * 0.22)} ${sp},${n(-H * 0.7)} ${sp},${-H}`;
    const rd = (d, cls) => `<path class="pp-${cls}" d="${d}" pathLength="1" fill="none" stroke="${road}" stroke-width="${rw}" stroke-linecap="butt" stroke-dasharray="1 1" stroke-dashoffset="0"/>`;
    let s = rd(stem + ' L0,' + n(fy - 2), 'stem') + rd(left, 'left') + rd(right, 'right') + O(0, fy, rw / 2, road, 'class="pp-joint"');
    s += `<g class="pp-dashes">${[stem, left, right].map((d) => L(d, '#efebe4', 4, 'stroke-dasharray="16 16" stroke-linecap="butt"')).join('')}</g>`;
    const lab = (t, x, c, cls) => {
      if (!t) return '';
      const w = measure(t, 22, 700) + 36;
      return `<g class="pp-${cls}" data-o="${x} ${-H - 44}">${R(x - w / 2, -H - 70, w, 48, 24, c)}${T(x, -H - 38, t, { size: 22, weight: 700, fill: '#fbf9f5' })}</g>`;
    };
    s += lab(o.left, -sp, o.leftColor || PAL.purple, 'labelL') + lab(o.right, sp, o.rightColor || PAL.blue, 'labelR');
    const top = o.left || o.right ? -H - 72 : -H;
    return { svg: s, box: [-sp - rw / 2 - 60, top, sp * 2 + rw + 120, -top], scale: GFX, points: { fork: [0, fy], left: [-sp, -H], right: [sp, -H] } };
  };

  // arrow – flat block arrow. anchor = tail (0,0), pointing +x. parts: arrow (pivot = tail; use scaleX to grow). opts: length (160), w (16), color, angle
  D.arrow = (o) => {
    const len = o.length || 160, w = o.w || 16, hd = w * 2.1, hl = w * 1.9;
    const d = `M0,${-w / 2} H${len - hl} V${-hd / 2} L${len},0 L${len - hl},${hd / 2} V${w / 2} H0 Z`;
    return { svg: G('arrow', [0, 0], P(d, o.color || INK), o.angle ? `transform="rotate(${o.angle})"` : ''), box: [0, -hd / 2, len, hd], scale: GFX };
  };

  // progressBar – parts: bar (rect; animate attr width via anim.progress), pct (text). opts: w (400), h (22), value (0..1), label, color
  D.progressBar = (o) => {
    const w = o.w || 400, h = o.h || 22, v = o.value ?? 0.6, x = -w / 2;
    let s = R(x, -h / 2, w, h, h / 2, '#d8d2c8') + R(x, -h / 2, Math.max(h, w * v), h, h / 2, o.color || PAL.accent, 'class="pp-bar"');
    if (o.label) s += T(x, -h / 2 - 12, o.label, { size: 18, weight: 700, anchor: 'start' });
    if (o.pct !== false) s += T(-x, -h / 2 - 12, Math.round(v * 100) + '%', { size: 18, weight: 700, anchor: 'end', cls: 'pct', extra: 'style="font-variant-numeric:tabular-nums"' });
    return { svg: s, box: [x, -h / 2 - 34, w, h + 34], scale: GFX, state: { w, h, value: v } };
  };

  

  /* ---------------- build / create ---------------- */
  const build = (name, opts = {}) => {
    const def = D[name];
    if (!def) throw new Error('Props: unknown prop "' + name + '"');
    const d = def({ ...opts }, C.uid('pp'));
    d.name = name;
    return d;
  };
  Props.list = () => Object.keys(D);
  Props.info = (name, opts) => { const d = build(name, opts); return { box: d.box, scale: d.scale ?? 0.75, hold: d.hold, points: d.points }; };
  Props.svg = (name, opts) => build(name, opts).svg;

  // apply data-o pivots to every part under root (needed when you insert Props.svg() markup yourself)
  const pivots = (Props.pivots = (root) => {
    if (!window.gsap) return root;
    root.querySelectorAll('[data-o]').forEach((e) => gsap.set(e, { svgOrigin: e.getAttribute('data-o') }));
    return root;
  });
  // parts.foo = first .pp-foo, parts.foos = array of all
  const collect = (Props.collect = (root) => {
    const parts = {};
    root.querySelectorAll('[class*="pp-"]').forEach((e) => {
      (e.getAttribute('class') || '').split(/\s+/).filter((c) => c.startsWith('pp-')).forEach((c) => {
        const k = c.slice(3);
        if (!parts[k]) parts[k] = e;
        (parts[k + 's'] = parts[k + 's'] || []).push(e);
      });
    });
    return parts;
  });

  Props.create = (name, opts = {}) => {
    const d = build(name, opts);
    const [bx, by, bw, bh] = d.box;
    const k = opts.width ? opts.width / bw : opts.height ? opts.height / bh : (d.scale ?? 0.75) * (opts.scale ?? 1);
    const el = document.createElement('div');
    el.className = 'prop prop-' + name + (opts.className ? ' ' + opts.className : '');
    el.innerHTML = `<svg viewBox="${n(bx)} ${n(by)} ${n(bw)} ${n(bh)}" xmlns="http://www.w3.org/2000/svg" overflow="visible" style="display:block;width:100%;height:100%;overflow:visible">${d.svg}</svg>`;
    Object.assign(el.style, { position: 'absolute', left: '0px', top: '0px', width: bw * k + 'px', height: bh * k + 'px', transformOrigin: `${-bx * k}px ${-by * k}px` });
    const svg = el.firstChild;
    pivots(svg);
    const prop = { name, el, svg, parts: collect(svg), size: { w: bw * k, h: bh * k }, k, box: d.box, points: d.points || {}, state: d.state || {}, opts, def: d };
    // anchor-based placement (like a character's place); transform-origin = anchor
    prop.place = (x, y) => { prop.ax = x; prop.ay = y; el.style.left = x + bx * k + 'px'; el.style.top = y + by * k + 'px'; return prop; };
    // local prop coords → stage px (ignores GSAP transforms on el)
    prop.at = (x, y) => [(prop.ax || 0) + x * k, (prop.ay || 0) + y * k];
    prop.place(-bx * k, -by * k);
    if (d.init) d.init(prop);
    return prop;
  };

  /* ---------------- hand-held props ---------------- */
  const BUILD_HW = { slim: 84, regular: 92, stout: 98 };
  const POSES = (Props.POSES = { present: [30, 62], point: [86, 4], wave: [36, 122], raise: [168, -4], hip: [34, -92], banzai: [160, -6], shrug: [28, 104] });
  Props.handCenter = (ch) => {
    if (ch.kind === 'robot') return [123, 471];
    const hw = BUILD_HW[ch.opts.build] || 92;
    return [200 - hw + 20 - 17, 438];
  };

  /* Props.hand(name, ch, side = 'R', opts) – attach a prop to a character's hand via ch.hold().
   *  opts: prop options + { grip:[x,y] (prop-local point that sits in the hand), angle, scale,
   *         thumb:'thumb'|'fist'|'none', upright:false (prop follows the arm instead of staying upright),
   *         outward (art drawn extending to the right; keep the grip in the hand and point the prop away
   *         from the body in either hand, e.g. the magnifier lens) }
   *  Returns { g, parts, pose(tl,t,name,dur), arm(tl,t,up,fore,dur,ease), rest(tl,t,dur), turn(tl,t,deg,dur), remove() } */
  Props.hand = (name, ch, side = 'R', opts = {}) => {
    const d = build(name, opts);
    const h = { grip: [0, 0], angle: 0, grasp: 'none', ...(d.hold || {}) };
    const grip = opts.grip || h.grip, ang = opts.angle ?? h.angle, s = (opts.scale ?? 1) * (h.scale ?? 1);
    const grasp = opts.thumb ?? h.grasp;
    const [hx, hy] = Props.handCenter(ch);
    const robot = ch.kind === 'robot';
    const skin = robot ? ch.opts.dark || '#33363d' : ch.opts.skin;
    const hr = ch.opts.bottom === 'skirt' ? 11 : 12;
    // The rig mirrors the right arm.  Pre-mirror the artwork once so text reads correctly, and offset
    // by +grip.x so the prop still extends towards the body (mirror-symmetric placement).
    // That moves the grip 2*grip.x away from the hand.  hold.outward / opts.outward instead keeps the grip in the
    // hand and mirrors the left-hand art, so a prop drawn extending to the right points away from the body in both hands.
    const outward = opts.outward ?? h.outward ?? false;
    const place = `<g transform="scale(${s}) translate(${n(-grip[0])} ${n(-grip[1])})">${d.svg}</g>`;
    const inner = outward
      ? `<g transform="scale(-1 1)">${place}</g>`
      : side === 'R'
        ? `<g transform="scale(-1 1)"><g transform="scale(${s}) translate(${n(grip[0])} ${n(-grip[1])})">${d.svg}</g></g>`
        : place;
    const thumb = grasp === 'thumb'
      ? (robot ? R(-4, -14, 12, 20, 6, skin, 'transform="rotate(-30)"') : `<ellipse cx="3" cy="-5" rx="5.6" ry="9" fill="${skin}" transform="rotate(-34)"/>`)
      : '';
    const fist = grasp === 'fist'
      ? (robot ? `<path d="M-18,-9 Q-18,-23 0,-23 Q18,-23 18,-9 L18,5 Q18,23 0,23 Q-18,23 -18,5 Z" fill="${skin}"/>` : `<ellipse cx="0" cy="0" rx="${hr}" ry="${hr + 5}" fill="${skin}"/>`)
      : '';
    const svg = `<g class="pp-held pp-held-${name}" transform="translate(${hx} ${hy})"><g class="pp-heldrot" data-o="0 0"><g transform="rotate(${ang})">${inner}${thumb}</g></g>${fist}</g>`;
    ch.hold(side, svg);
    const g = (side === 'L' ? ch.parts.propL : ch.parts.propR).querySelector('.pp-held');
    pivots(g);
    const rot = g.querySelector('.pp-heldrot');
    const held = { name, g, side, ch, parts: collect(g), points: d.points || {}, state: d.state || {}, def: d, tilt: 0 };
    held.turn = (tl, t, deg, dur = 0.3, ease = 'power2.inOut') => { held.tilt = deg; tl.to(rot, { rotation: deg, duration: dur, ease }, t); return held; };
    held.arm = (tl, t, up, fore = 0, dur = 0.3, ease = 'back.out(1.6)') => {
      ch.arm(tl, t, side, up, fore, dur, ease);
      tl.to(rot, { rotation: opts.upright === false ? held.tilt : -(up + fore) + held.tilt, duration: dur, ease }, t);
      return held;
    };
    held.pose = (tl, t, pose, dur = 0.35) => { const [u, f] = POSES[pose]; return held.arm(tl, t, u, f, dur); };
    held.rest = (tl, t, dur = 0.35) => held.arm(tl, t, 0, 0, dur, 'power2.inOut');
    held.remove = () => { g.remove(); return ch; };
    if (d.init) d.init(held);
    return held;
  };

  /* ---------------- animation helpers (absolute timeline time t, deterministic, seekable) ----------------
   * Call them in chronological order per prop (they track absolute state such as clock minutes). */
  const A = (Props.anim = {});
  const parts = (p) => p.parts || collect(p);
  const lastText = new WeakMap();

  // swap the text of an SVG/HTML element at time t (seek-safe)
  A.setText = (tl, t, el, text) => {
    if (!el) return tl;
    const prev = lastText.has(el) ? lastText.get(el) : el.textContent;
    lastText.set(el, String(text));
    return tl.to({ v: 0 }, { v: 1, duration: 0.001, ease: 'none', onUpdate() { el.textContent = this.progress() > 0 ? text : prev; } }, t);
  };

  // clock: go to {h, m} (or +minutes) – hands keep turning forwards
  A.clockTo = (tl, t, p, { h, m = 0, minutes, dur = 1, ease = 'power2.inOut' } = {}) => {
    const st = p.state; if (st.min0 == null) st.min0 = st.min;
    let M = minutes != null ? st.min + minutes : (h % 12) * 60 + m;
    if (minutes == null) while (M < st.min) M += 720;
    const P_ = parts(p);
    tl.to(P_.minute, { rotation: (M - st.min0) * 6 + (st.min0 % 60) * 6, duration: dur, ease }, t)
      .to(P_.hour, { rotation: M * 0.5, duration: dur, ease }, t);
    if (P_.second) tl.to(P_.second, { rotation: `+=${360 * Math.max(1, Math.round(dur))}`, duration: dur, ease: 'none' }, t);
    st.min = M;
    return tl;
  };
  // clock: fast-forward (time passing). minutes = how far, dur = seconds of video
  A.clockTick = (tl, t, p, { minutes = 60, dur = 2, ease = 'none' } = {}) => A.clockTo(tl, t, p, { minutes, dur, ease });

  // camera: press + flash burst (+ optional full-screen overlay element)
  A.cameraFlash = (tl, t, p, { overlay } = {}) => {
    const P_ = parts(p);
    // t = シャッターの瞬間（効果音の時刻）。ボタンは t に押し切り、フラッシュは t の直後に最大
    if (P_.button) tl.to(P_.button, { y: 3, duration: 0.06, yoyo: true, repeat: 1, ease: 'power1.inOut' }, Math.max(0, t - 0.06));
    if (P_.flash) {
      tl.fromTo(P_.flash, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1.15, duration: 0.04, ease: 'power2.out', immediateRender: false }, t);
      tl.to(P_.flash, { keyframes: { opacity: [1, 1, 0], scale: [1.15, 1.1, 1.3] }, duration: 0.36, ease: 'none' }, t + 0.04);
    }
    if (overlay) {
      tl.fromTo(overlay, { opacity: 0 }, { opacity: 0.85, duration: 0.03, ease: 'none', immediateRender: false }, t);
      tl.to(overlay, { opacity: 0, duration: 0.3, ease: 'power1.out' }, t + 0.03);
    }
    return tl;
  };

  // gift box: lid pops up and hovers tilted, glow appears
  A.giftOpen = (tl, t, p, { dur = 0.7 } = {}) => {
    const P_ = parts(p);
    tl.to(P_.lid, { keyframes: [{ x: -8, y: -64, rotation: -20, duration: dur * 0.45, ease: 'power3.out' }, { x: -6, y: -50, rotation: -13, duration: dur * 0.55, ease: 'sine.inOut' }] }, t);
    if (P_.glow) tl.to(P_.glow, { opacity: 1, duration: dur * 0.6, ease: 'power2.out' }, t + dur * 0.25);
    return tl;
  };

  // door: unlock (keyhole wiggle) + swing open (scaleX on the hinge) + light from inside
  A.doorOpen = (tl, t, p, { dur = 0.8, amount = 0.86, unlock = true } = {}) => {
    const P_ = parts(p); let t0 = t;
    if (unlock && P_.keyhole) { tl.to(P_.keyhole, { keyframes: { rotation: [0, -14, 10, 0] }, duration: 0.35, ease: 'none' }, t); t0 += 0.3; }
    tl.to(P_.door, { scaleX: 1 - amount, duration: dur, ease: 'power2.inOut' }, t0);
    if (P_.inside) tl.to(P_.inside, { opacity: 1, duration: dur * 0.8, ease: 'power1.out' }, t0 + 0.05);
    return tl;
  };
  A.doorClose = (tl, t, p, { dur = 0.6 } = {}) => {
    const P_ = parts(p);
    tl.to(P_.door, { scaleX: 1, duration: dur, ease: 'power2.inOut' }, t);
    if (P_.inside) tl.to(P_.inside, { opacity: 0, duration: dur, ease: 'power1.in' }, t);
    return tl;
  };

  // volume meter: tween to level (0..1)
  A.meterLevel = (tl, t, p, level, { dur = 0.25, ease = 'power2.out' } = {}) => {
    const st = p.state, lv = Math.max(0, Math.min(1, level));
    tl.to(parts(p).level, { attr: { y: st.bottom - st.span * lv, height: st.span * lv }, duration: dur, ease }, t);
    st.level = lv; return tl;
  };
  // volume meter: lively bouncing around base ± amp for dur seconds
  A.meterJitter = (tl, t, p, { dur = 2, base = 0.6, amp = 0.25, rate = 9, seed = 3, end } = {}) => {
    const r = C.rng(seed), steps = Math.max(1, Math.round(dur * rate));
    for (let i = 0; i < steps; i++) A.meterLevel(tl, t + i / rate, p, base + (r() * 2 - 1) * amp, { dur: 1 / rate, ease: 'sine.inOut' });
    if (end != null) A.meterLevel(tl, t + dur, p, end, { dur: 0.3 });
    return tl;
  };

  // waveform: bars dance for dur seconds, then settle (to rest heights, or `settle` factor)
  A.waveform = (tl, t, p, { dur = 2, rate = 10, amp = 1, seed = 9, settle = 1 } = {}) => {
    const st = p.state, bars = parts(p).bars, r = C.rng(seed), steps = Math.max(1, Math.round(dur * rate));
    bars.forEach((b, i) => {
      const base = st.heights[i];
      for (let k = 0; k < steps; k++) {
        const h = Math.max(st.w, Math.min(st.H, base * (1 + (r() * 2 - 1) * 0.75 * amp)));
        tl.to(b, { attr: { y: -h / 2, height: h }, duration: 1 / rate, ease: 'sine.inOut' }, t + k / rate);
      }
      const h = Math.max(st.w, base * settle);
      tl.to(b, { attr: { y: -h / 2, height: h }, duration: 0.25, ease: 'power2.out' }, t + dur);
    });
    return tl;
  };

  // bell: swing + sound arcs
  A.bellRing = (tl, t, p, { amp = 16, dur = 1 } = {}) => {
    const P_ = parts(p);
    tl.to(P_.bell, { keyframes: { rotation: [0, amp, -amp * 0.8, amp * 0.55, -amp * 0.3, amp * 0.12, 0] }, duration: dur, ease: 'none' }, t);
    if (P_.waves) tl.fromTo(P_.waves, { opacity: 0, scale: 0.85, svgOrigin: '0 -150' }, { keyframes: { opacity: [0, 1, 1, 0], scale: [0.85, 1, 1.08, 1.15] }, duration: dur * 0.8, ease: 'none', immediateRender: false }, t + 0.05);
    return tl;
  };

  // filmstrip: frames pop in one by one
  A.filmIn = (tl, t, p, { stagger = 0.08, dur = 0.3 } = {}) =>
    tl.fromTo(parts(p).frames, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: dur, stagger, ease: 'back.out(1.8)', immediateRender: true }, t);
  // filmstrip: highlight frame i (scale up then back)
  A.frameFlash = (tl, t, p, i, { dur = 0.35 } = {}) => tl.to(parts(p).frames[i], { keyframes: { scale: [1, 1.12, 1] }, duration: dur, ease: 'none' }, t);

  // typing: codeSnippet / speechBubble (per-character), laptop (code bars grow). cps = characters per second
  A.typeCode = (tl, t, p, { cps = 28, caret = true, lines } = {}) => {
    const P_ = parts(p);
    let k = 0;
    if (P_.chs) {
      const texts = P_.lines.filter((_, i) => !lines || lines.includes(i));
      const cr = caret ? P_.caret : null;
      const chs = texts.flatMap((tx) => [...tx.querySelectorAll('.pp-ch')]);
      gsap.set(chs, { opacity: 0 });
      if (cr) tl.set(cr, { opacity: 1 }, t);
      texts.forEach((tx) => {
        const li = P_.lines.indexOf(tx), x0 = +tx.getAttribute('x');
        tx.querySelectorAll('.pp-ch').forEach((ch, j) => {
          const tt = t + k++ / cps;
          tl.set(ch, { opacity: 1 }, tt);
          if (cr) tl.set(cr, { x: () => tx.getEndPositionOfChar(j).x - x0 + 2, y: () => li * (p.state.lh || 0) }, tt);
        });
      });
      if (cr) tl.to(cr, { keyframes: { opacity: [1, 0, 1, 0, 1, 0] }, duration: 1.5, ease: 'steps(1)' }, t + k / cps);
      return tl;
    }
    if (P_.lines) {
      gsap.set(P_.lines, { scaleX: 0 });
      P_.lines.forEach((l, i) => tl.to(l, { scaleX: 1, duration: 0.18, ease: 'none' }, t + (i * 6) / cps));
    }
    return tl;
  };

  // timelineBars: move the playhead from → to (seconds of the drawn timeline)
  A.playhead = (tl, t, p, { from = 0, to, dur, ease = 'none' } = {}) => {
    const st = p.state, sc = (p.points.x1 - p.points.x0) / st.D;
    to = to ?? st.D;
    return tl.fromTo(parts(p).playhead, { x: from * sc }, { x: to * sc, duration: dur ?? to - from, ease, immediateRender: false }, t);
  };
  // timelineBars: bars grow in from their start
  A.barsIn = (tl, t, p, { stagger = 0.08, dur = 0.35 } = {}) =>
    tl.fromTo(parts(p).bars, { scaleX: 0 }, { scaleX: 1, duration: dur, stagger, ease: 'power3.out', immediateRender: true }, t);

  // draw stroke paths that use pathLength="1" (yRoad stem/left/right, or any such path)
  A.draw = (tl, t, els, { dur = 0.6, ease = 'power2.inOut', stagger = 0 } = {}) =>
    tl.fromTo(els, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, ease, stagger, immediateRender: true }, t);
  // yRoad: stem then both branches, dashes and labels
  A.roadIn = (tl, t, p, { dur = 0.5 } = {}) => {
    const P_ = parts(p);
    A.draw(tl, t, P_.stem, { dur, ease: 'power1.in' });
    tl.fromTo(P_.joint, { opacity: 0 }, { opacity: 1, duration: 0.01, immediateRender: true }, t + dur * 0.95);
    A.draw(tl, t + dur, [P_.left, P_.right], { dur: dur * 1.3, ease: 'power2.out' });
    tl.fromTo(P_.dashes, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: true }, t + dur * 2.2);
    [P_.labelL, P_.labelR].filter(Boolean).forEach((l, i) => tl.fromTo(l, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)', immediateRender: true }, t + dur * 2.2 + i * 0.12));
    return tl;
  };

  // frameMachine gears / gpu fan / emblem satellite
  A.gearSpin = (tl, t, p, { dur = 2, turns = 1, ease = 'none' } = {}) => {
    const P_ = parts(p);
    tl.to(P_.gear, { rotation: `+=${360 * turns}`, duration: dur, ease }, t);
    if (P_.gear2) tl.to(P_.gear2, { rotation: `-=${360 * turns * 1.25}`, duration: dur, ease }, t);
    if (P_.lamps) P_.lamps.forEach((l, i) => tl.to(l, { keyframes: { opacity: [1, 0.25, 1] }, duration: 0.5, repeat: Math.max(0, Math.round(dur / 0.5) - 1), ease: 'steps(1)' }, t + i * 0.16));
    return tl;
  };
  A.fanSpin = (tl, t, p, { dur = 2, turns = 4, ease = 'power1.inOut' } = {}) => tl.to(parts(p).fan, { rotation: `+=${360 * turns}`, duration: dur, ease }, t);
  A.orbit = (tl, t, p, { dur = 2, turns = 1, ease = 'none' } = {}) => {
    const st = p.state, sat = parts(p).sat, o = { a: st.a || 0 }, to = (st.a || 0) + 360 * turns; st.a = to;
    return tl.to(o, { a: to, duration: dur, ease, onUpdate() { const r = (o.a * Math.PI) / 180; gsap.set(sat, { x: st.rx * Math.cos(r) - st.rx, y: st.ry * Math.sin(r) }); } }, t);
  };

  // timer: count from → to seconds (display m:ss)
  A.timerRun = (tl, t, p, { from = 0, to = 133, dur = 2, ease = 'power1.inOut', format } = {}) => {
    const el = parts(p).display, o = { v: from };
    const fmt = format || ((v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`);
    if (parts(p).rec) tl.to(parts(p).rec, { keyframes: { opacity: [1, 0.2, 1] }, duration: 0.8, repeat: Math.max(0, Math.round(dur / 0.8) - 1), ease: 'steps(1)' }, t);
    lastText.set(el, fmt(to));
    return tl.fromTo(o, { v: from }, { v: to, duration: dur, ease, immediateRender: false, onUpdate() { el.textContent = fmt(o.v); } }, t);
  };

  // calculator: tap keys (indices 0..15) and show results
  A.calcTap = (tl, t, p, { keys = [5, 9, 15], texts = [], gap = 0.22 } = {}) => {
    const P_ = parts(p);
    keys.forEach((k, i) => {
      tl.to(P_.keys[k], { keyframes: { scale: [1, 0.8, 1] }, duration: 0.16, ease: 'none' }, t + i * gap);
      if (texts[i] != null) A.setText(tl, t + i * gap + 0.05, P_.display, texts[i]);
    });
    return tl;
  };

  // progressBar: to value (0..1)
  A.progress = (tl, t, p, value, { dur = 0.8, ease = 'power2.inOut' } = {}) => {
    const st = p.state, P_ = parts(p), o = { v: st.value };
    tl.fromTo(o, { v: st.value }, { v: value, duration: dur, ease, immediateRender: false, onUpdate() {
      P_.bar.setAttribute('width', Math.max(st.h, st.w * o.v)); if (P_.pct) P_.pct.textContent = Math.round(o.v * 100) + '%';
    } }, t);
    st.value = value; return tl;
  };

  // ball: roll along a chainTrack (stage coordinates via prop.at) – moves ball.el
  A.roll = (tl, t, ball, track, { dur = 1, ease = 'power1.in' } = {}) => {
    const [x0, y0] = track.at(...track.points.start), [x1, y1] = track.at(...track.points.end);
    tl.fromTo(ball.el, { x: x0 - (ball.ax || 0), y: y0 - (ball.ay || 0) }, { x: x1 - (ball.ax || 0), y: y1 - (ball.ay || 0), duration: dur, ease, immediateRender: false }, t);
    return tl;
  };
  // domino: topple (dir 1 → right)
  A.topple = (tl, t, p, { dir = 1, dur = 0.45, angle = 78 } = {}) => tl.to(parts(p).body, { rotation: dir * angle, duration: dur, ease: 'power2.in' }, t);

  // snail: slow crawl dx px (moves el) with stalk wiggle
  A.snailCrawl = (tl, t, p, { dx = 120, dur = 3 } = {}) => {
    const P_ = parts(p), steps = Math.max(1, Math.round(dur / 0.6));
    tl.to(p.el, { x: `+=${dx}`, duration: dur, ease: 'none' }, t);
    for (let i = 0; i < steps; i++) tl.to(P_.body, { keyframes: { scaleX: [1, 1.05, 1] }, duration: 0.6, ease: 'sine.inOut', svgOrigin: '-70 0' }, t + i * 0.6)
      .to(P_.stalks, { keyframes: { rotation: [0, 6, -4, 0] }, duration: 0.6, ease: 'sine.inOut' }, t + i * 0.6);
    return tl;
  };

  // magicBlob: soft drifting content + gentle wobble (+ sparkle twinkle)
  A.blobWobble = (tl, t, p, { dur = 3 } = {}) => {
    const P_ = parts(p);
    tl.to(P_.blob, { keyframes: { x: [0, 14, -8, 0], y: [0, -6, 10, 0], rotation: [0, 4, -3, 0] }, duration: dur, ease: 'sine.inOut' }, t)
      .to(P_.shape, { keyframes: { scaleX: [1, 1.04, 0.97, 1], scaleY: [1, 0.96, 1.03, 1] }, duration: dur, ease: 'sine.inOut' }, t);
    (P_.sparks || []).forEach((s, i) => tl.to(s, { keyframes: { scale: [1, 0.4, 1.15, 1], rotation: [0, 45, 90] }, duration: 1.2, ease: 'sine.inOut', repeat: Math.max(0, Math.round(dur / 1.2) - 1) }, t + i * 0.3));
    if (P_.turb) { const o = { f: 0.012 }; tl.to(o, { f: 0.02, duration: dur, ease: 'sine.inOut', yoyo: true, onUpdate() { P_.turb.setAttribute('baseFrequency', o.f.toFixed(4)); } }, t); }
    return tl;
  };

  // chips / any list of parts: pop in with stagger
  A.popIn = (tl, t, els, { stagger = 0.08, dur = 0.35, from = 0.5 } = {}) =>
    tl.fromTo(els, { opacity: 0, scale: from }, { opacity: 1, scale: 1, duration: dur, stagger, ease: 'back.out(2)', immediateRender: true }, t);
  A.chipsIn = (tl, t, p, o) => A.popIn(tl, t, parts(p).chips, o);
  // speech bubble pop (pivot = tail tip)
  A.bubbleIn = (tl, t, p, { dur = 0.35 } = {}) => tl.fromTo(parts(p).bubble, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: dur, ease: 'back.out(2.2)', immediateRender: true }, t);
  // sound icon: toggle muted state
  A.mute = (tl, t, p, muted = true, { dur = 0.2 } = {}) => {
    const P_ = parts(p);
    tl.to(P_.waves, { opacity: muted ? 0 : 1, duration: dur, stagger: muted ? -0.05 : 0.05 }, t).to(P_.cross, { opacity: muted ? 1 : 0, scale: muted ? 1 : 0.5, duration: dur, ease: 'back.out(2)' }, t);
    return tl;
  };
  // sound icon: waves pulse outward
  A.soundPulse = (tl, t, p, { dur = 1.2, beat = 0.4 } = {}) => {
    const P_ = parts(p), n_ = Math.max(1, Math.round(dur / beat));
    for (let i = 0; i < n_; i++) P_.waves.forEach((w, k) => tl.to(w, { keyframes: { opacity: [1, 0.25, 1] }, duration: beat, ease: 'none' }, t + i * beat + k * 0.07));
    return tl;
  };
  // tts machine: grille pulses while talking
  A.speak = (tl, t, p, { dur = 1.5, rate = 7 } = {}) => {
    const P_ = parts(p), steps = Math.max(1, Math.round(dur * rate));
    for (let i = 0; i < steps; i++) tl.to(P_.grille, { scale: i % 2 ? 1 : 1.05, duration: 1 / rate, ease: 'sine.inOut' }, t + i / rate);
    tl.to(P_.grille, { scale: 1, duration: 0.15 }, t + dur);
    if (P_.lamp) tl.to(P_.lamp, { keyframes: { opacity: [1, 0.3, 1] }, duration: 0.4, repeat: Math.max(0, Math.round(dur / 0.4) - 1), ease: 'steps(1)' }, t);
    return tl;
  };
})();
