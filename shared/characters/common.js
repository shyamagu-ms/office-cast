/* Shared helpers for the character rigs (classic script → window.Chars).
 * Style rules: no outlines, flat fills, one restrained shadow tone, muted palette. */
(function () {
  const Chars = (window.Chars = window.Chars || {});

  Chars.VIEW = { w: 400, h: 760, ground: 740 };
  Chars.INK = '#26221f';       // eyes, brows, glasses – near-black, warm

  let uidN = 0;
  Chars.uid = (p) => `${p}${++uidN}`;

  const hex2rgb = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  Chars.mix = (a, b, t) => {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  Chars.shade = (c, t = 0.14) => Chars.mix(c, '#1b1a22', t);
  Chars.tint = (c, t = 0.3) => Chars.mix(c, '#ffffff', t);

  // flat limb segment (round caps so joints overlap seamlessly)
  Chars.seg = (d, fill, w, cap = 'round') =>
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;

  Chars.mount = (svgInner, opts = {}) => {
    const el = document.createElement('div');
    el.className = 'char ' + (opts.className || '');
    const { w, h } = Chars.VIEW;
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${svgInner}</svg>`;
    el.style.width = (opts.width || 300) + 'px';
    el.style.height = ((opts.width || 300) * h) / w + 'px';
    return el;
  };

  // deterministic PRNG (mulberry32) so rendered frames are reproducible
  Chars.rng = (seed = 1) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
