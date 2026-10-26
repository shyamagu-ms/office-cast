/* Person rig – the reusable "会社員" (office worker) model.
 *   Chars.createPerson({ hairStyle, build, outfit, suit, tie, glasses, ... })
 *   Chars.createPerson(Chars.PEOPLE.tanaka)          // presets
 * Flat, outline-free, ~5.2 heads tall.  400x760 viewBox, feet on y=740, centre x=200.
 * Right limbs reuse the left markup inside a mirror, so pose values are symmetric
 * (arm rotation + = raise outward, fore + = bend up/inward).
 */
(function () {
  const C = window.Chars;
  const MIRROR = 'matrix(-1 0 0 1 400 0)';
  const INK = C.INK;

  const DEF = {
    name: '田中',
    skin: '#efc6a2',
    hair: '#2b2420',
    hairStyle: 'part',        // part | crop | thin | bob | long
    build: 'regular',         // slim | regular | stout
    outfit: 'suit',           // suit | shirt (cool-biz, short sleeves)
    suit: '#2f3a52',
    shirt: '#f3f1ec',
    tie: '#b4473a',           // null = no tie
    bottom: 'pants',          // pants | skirt
    pants: null,              // default = suit colour
    legwear: '#3a3330',       // tights under a skirt
    shoes: '#24211f',
    glasses: false,
    mustache: false,
    blush: false,
  };

  C.PEOPLE = {
    tanaka: { name: '田中', hairStyle: 'part' },
    suzuki: { name: '鈴木', hairStyle: 'crop', build: 'slim', suit: '#5b6068', tie: '#3f6f9e', glasses: true, hair: '#1f1b1a' },
    yamada: { name: '山田部長', hairStyle: 'thin', build: 'stout', suit: '#4a3f38', tie: '#7b2f3a', hair: '#77726d', glasses: true, mustache: true, skin: '#e8bc96' },
    sato: { name: '佐藤', hairStyle: 'bob', build: 'slim', suit: '#363b46', shirt: '#f6f3ee', tie: null, bottom: 'skirt', hair: '#3a2a24', skin: '#f3cfae' },
    kobayashi: { name: '小林', hairStyle: 'long', build: 'slim', outfit: 'shirt', shirt: '#dfe7ef', tie: null, pants: '#3b4150', hair: '#2a211d' },
    ito: { name: '伊藤', hairStyle: 'crop', outfit: 'shirt', shirt: '#f4f2ee', tie: '#c58a2d', pants: '#2f3a52', hair: '#3a2c24', skin: '#d9a87f' },
  };

  const BUILD = {
    slim: { hw: 84, belly: 0, legW: 44 },
    regular: { hw: 92, belly: 0, legW: 48 },
    stout: { hw: 98, belly: 22, legW: 54 },
  };

  const HEAD = 'M200,48 C236,48 255,76 255,114 C255,152 235,184 200,184 C165,184 145,152 145,114 C145,76 164,48 200,48 Z';

  function hairBack(o) {
    if (o.hairStyle === 'bob')
      return `<path d="M200,38 C252,38 273,76 273,126 L275,176 Q275,190 261,190 L246,190 L246,130 L154,130 L154,190 L139,190 Q125,190 125,176 L127,126 C127,76 148,38 200,38 Z" fill="${o.hair}"/>`;
    if (o.hairStyle === 'long')
      return `<path d="M200,38 C252,38 273,76 273,126 L278,236 Q278,252 262,252 L246,252 L246,130 L154,130 L154,252 L138,252 Q122,252 122,236 L127,126 C127,76 148,38 200,38 Z" fill="${o.hair}"/>`;
    return '';
  }

  function hairFront(o) {
    const hl = C.tint(o.hair, 0.16);
    switch (o.hairStyle) {
      case 'crop':
        return `<path d="M145,120 C141,70 168,42 200,42 C232,42 259,70 255,120 C252,104 249,94 244,86 C222,80 178,80 156,86 C151,94 148,104 145,120 Z" fill="${o.hair}"/>`;
      case 'thin':
        return `<path d="M146,134 C142,108 146,94 154,84 C158,100 157,118 156,134 Z" fill="${o.hair}"/>
          <path d="M254,134 C258,108 254,94 246,84 C242,100 243,118 244,134 Z" fill="${o.hair}"/>
          <path d="M168,66 Q200,50 234,68 M172,74 Q202,60 230,76" fill="none" stroke="${o.hair}" stroke-width="3" stroke-linecap="round"/>`;
      case 'bob':
        return `<path d="M144,130 C138,70 166,40 200,40 C236,40 264,70 256,130 C250,110 244,98 236,90 C214,97 184,97 162,90 C154,100 148,112 144,130 Z" fill="${o.hair}"/>`;
      case 'long':
        return `<path d="M144,132 C138,70 166,40 202,40 C238,40 264,72 256,132 C252,110 246,96 236,86 C214,84 186,74 172,62 C166,84 156,106 144,132 Z" fill="${o.hair}"/>`;
      default: // part (七三)
        return `<path d="M145,124 C141,72 168,42 204,42 C238,42 260,66 256,104 C256,112 255,118 254,126 C251,108 248,98 243,90 C222,90 196,84 182,70 C176,82 166,90 156,94 C151,102 147,113 145,124 Z" fill="${o.hair}"/>
          <path d="M183,69 C185,60 189,52 195,46" fill="none" stroke="${hl}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }

  function face(o) {
    const mouthC = '#5b3530', mouthIn = '#7a3530';
    const st = (d, w = 3.2, c = mouthC) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const eyes = (f) => f(181) + f(219);
    const my = o.mustache ? 160 : 156;
    return `
    <g class="face">
      ${o.blush ? `<ellipse cx="168" cy="142" rx="10" ry="5" fill="#e48a76" opacity=".32"/><ellipse cx="232" cy="142" rx="10" ry="5" fill="#e48a76" opacity=".32"/>` : ''}
      <g class="eyes">
        <g class="eye-normal">${eyes((x) => `<circle cx="${x}" cy="121" r="4.8" fill="${INK}"/>`)}</g>
        <g class="eye-happy" opacity="0">${eyes((x) => st(`M${x - 7},123 Q${x},114 ${x + 7},123`, 3.4, INK))}</g>
        <g class="eye-surprised" opacity="0">${eyes((x) => `<circle cx="${x}" cy="120" r="6.4" fill="${INK}"/><circle cx="${x + 2}" cy="118" r="1.6" fill="#fff"/>`)}</g>
        <g class="eye-flat" opacity="0">${eyes((x) => st(`M${x - 6},121 L${x + 6},121`, 3.4, INK))}</g>
        <g class="eye-closed" opacity="0">${eyes((x) => st(`M${x - 7},119 Q${x},126 ${x + 7},119`, 3.2, INK))}</g>
      </g>
      ${st('M198,137 Q201,141 205,138', 2.6, C.shade(o.skin, 0.28))}
      ${o.mustache ? `<path d="M185,151 Q193,143 200,148 Q207,143 215,151 Q207,155 200,152 Q193,155 185,151 Z" fill="${o.hair}"/>` : ''}
      <g class="mouth">
        <g class="mouth-line">${st(`M193,${my} L207,${my}`)}</g>
        <g class="mouth-smile" opacity="0">${st(`M191,${my - 2} Q200,${my + 5} 209,${my - 2}`)}</g>
        <g class="mouth-open" opacity="0"><path d="M190,${my - 3} L210,${my - 3} Q209,${my + 11} 200,${my + 11} Q191,${my + 11} 190,${my - 3} Z" fill="${mouthIn}"/></g>
        <g class="mouth-talk" opacity="0"><ellipse cx="200" cy="${my}" rx="7" ry="4.5" fill="${mouthIn}"/></g>
        <g class="mouth-o" opacity="0"><ellipse cx="200" cy="${my + 1}" rx="4.6" ry="6.4" fill="${mouthIn}"/></g>
        <g class="mouth-wavy" opacity="0">${st(`M190,${my + 1} Q195,${my - 4} 200,${my + 1} Q205,${my + 6} 210,${my + 1}`)}</g>
      </g>
      ${o.glasses ? `<g fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
        <rect x="167" y="110" width="28" height="21" rx="7"/><rect x="205" y="110" width="28" height="21" rx="7"/>
        <path d="M195,119 Q200,115 205,119 M167,117 L149,114 M233,117 L251,114" stroke-linecap="round"/></g>` : ''}
    </g>`;
  }

  function arm(o, b) {
    const ax = 200 - b.hw + 20, sy = 226, ex = ax - 10, ey = 330, wx = ax - 16, wy = 418;
    const shirtArm = o.outfit === 'shirt';
    const sleeve = shirtArm ? o.shirt : o.suit;
    const handR = o.bottom === 'skirt' ? 11 : 12;
    return `
    <g class="arm">
      ${C.seg(`M${ax},${sy} L${ex},${ey}`, sleeve, shirtArm ? 34 : 36)}
      <g class="fore">
        ${shirtArm
          ? C.seg(`M${ex},${ey} L${wx},${wy}`, o.skin, 22)
          : C.seg(`M${ex},${ey} L${wx},${wy - 6}`, sleeve, 32) + C.seg(`M${wx + 0.6},${wy - 8} L${wx},${wy + 4}`, o.shirt, 25, 'butt')}
        <g class="hand">
          <ellipse cx="${wx - 1}" cy="${wy + 20}" rx="${handR}" ry="${handR + 5}" fill="${o.skin}"/>
          <g class="prop"></g>
        </g>
      </g>
      ${shirtArm ? C.seg(`M${ax},${sy} L${ex + 1},${ey - 8}`, sleeve, 34) : ''}
    </g>`;
  }

  function leg(o, b) {
    if (o.bottom === 'skirt') {
      return `<g class="leg">
        ${C.seg('M174,470 L172,712', o.legwear, 28)}
        <path d="M152,740 C150,726 158,712 172,712 C186,712 194,722 194,734 L194,740 Z" fill="${o.shoes}"/>
      </g>`;
    }
    const pants = o.pants || o.suit;
    return `<g class="leg">
      ${C.seg('M172,436 L171,700', pants, b.legW)}
      <path d="M145,740 C142,722 152,705 172,705 C190,705 200,716 200,730 L200,740 Z" fill="${o.shoes}"/>
    </g>`;
  }

  function torso(o, b, id) {
    const L = 200 - b.hw, R = 200 + b.hw, e = b.belly, hemL = L - e * 0.35, hemR = R + e * 0.35;
    const shape = `M150,200 L250,200 C${R - 16},202 ${R},212 ${R},236 C${R + e * 1.15},300 ${R + e * 1.15},392 ${hemR + 2},430 Q${hemR + 2},442 ${hemR - 12},442 L${hemL + 12},442 Q${hemL - 2},442 ${hemL - 2},430 C${L - e * 1.15},392 ${L - e * 1.15},300 ${L},236 C${L},212 ${L + 16},202 150,200 Z`;
    const pants = o.pants || o.suit;
    const skirt = o.bottom === 'skirt'
      ? `<path d="M${L + 14},420 L${R - 14},420 L${R + 6},548 Q${R + 6},552 ${R + 2},552 L${L - 2},552 Q${L - 6},552 ${L - 6},548 Z" fill="${o.suit}"/>`
      : '';
    if (o.outfit === 'shirt') {
      return `${skirt}
      <g class="torso">
        <path d="${shape.replace(/442/g, '436')}" fill="${o.shirt}"/>
        <path d="M${L + 4},424 L${R - 4},424 L${R - 2},440 L${L + 2},440 Z" fill="${C.shade(pants, 0.25)}"/>
        <path d="M200,204 L200,422" stroke="${C.shade(o.shirt, 0.08)}" stroke-width="3"/>
        <path d="M214,262 L246,262 L246,294 Q230,298 214,294 Z" fill="${C.shade(o.shirt, 0.06)}"/>
        <path d="M188,198 L212,198 L200,214 Z" fill="${o.skin}"/>
        ${o.tie ? `<path d="M194,206 L206,206 L204,220 L196,220 Z" fill="${C.shade(o.tie, 0.15)}"/><path d="M196,220 L204,220 L211,318 L200,332 L189,318 Z" fill="${o.tie}"/>` : ''}
        <path d="M200,212 L186,196 L174,206 L182,222 Z" fill="${C.shade(o.shirt, 0.05)}"/>
        <path d="M200,212 L214,196 L226,206 L218,222 Z" fill="${C.shade(o.shirt, 0.05)}"/>
      </g>`;
    }
    const lapel = C.shade(o.suit, 0.2);
    const V = 'M178,198 L222,198 L200,318 Z';
    return `${skirt}
    <g class="torso">
      <path d="${shape}" fill="${o.suit}"/>
      <clipPath id="${id}v"><path d="${V}"/></clipPath>
      <path d="${V}" fill="${o.shirt}"/>
      ${o.tie ? `<g clip-path="url(#${id}v)"><path d="M193,206 L207,206 L205,220 L195,220 Z" fill="${C.shade(o.tie, 0.15)}"/><path d="M195,220 L205,220 L212,300 L200,314 L188,300 Z" fill="${o.tie}"/></g>` : ''}
      <path d="M180,199 L200,318 L196,320 L158,238 L170,227 L161,212 Z" fill="${lapel}"/>
      <path d="M220,199 L200,318 L204,320 L242,238 L230,227 L239,212 Z" fill="${lapel}"/>
      <path d="M181,195 L199,212 L190,230 L172,207 Z" fill="${o.shirt}"/>
      <path d="M219,195 L201,212 L210,230 L228,207 Z" fill="${o.shirt}"/>
      <path d="M200,318 L200,442" stroke="${lapel}" stroke-width="3"/>
      <circle cx="200" cy="346" r="4.5" fill="${lapel}"/>
      <path d="M${L + 22},392 L${L + 58},392 M${R - 22},392 L${R - 58},392" stroke="${lapel}" stroke-width="4" stroke-linecap="round"/>
    </g>`;
  }

  C.createPerson = function (opts = {}) {
    const o = { ...DEF, ...opts };
    const b = BUILD[o.build] || BUILD.regular;
    const id = C.uid('p');
    const pants = o.pants || o.suit;
    const ears = o.hairStyle === 'bob' || o.hairStyle === 'long' ? '' :
      `<ellipse cx="146" cy="122" rx="9" ry="14" fill="${o.skin}"/><ellipse cx="254" cy="122" rx="9" ry="14" fill="${o.skin}"/>`;
    const brow = (x, cls) => `<g class="${cls}"><path d="M${x - 9},104 Q${x},100 ${x + 9},103" fill="none" stroke="${C.mix(o.hair, INK, 0.3)}" stroke-width="3.8" stroke-linecap="round"/></g>`;
    const pelvis = o.bottom === 'skirt' ? '' : `<rect x="${172 - b.legW / 2}" y="420" width="${56 + b.legW}" height="56" rx="6" fill="${pants}"/>`;

    const svg = `
    <ellipse class="shadow" cx="200" cy="741" rx="${b.hw + 6}" ry="10" fill="#000" opacity=".16"/>
    <g class="lift"><g class="squash">
      <g class="legL">${leg(o, b)}</g>
      <g transform="${MIRROR}"><g class="legR">${leg(o, b)}</g></g>
      ${pelvis}
      <g class="upper">
        <rect x="188" y="160" width="24" height="52" fill="${o.skin}"/>
        <rect x="188" y="172" width="24" height="16" fill="${C.shade(o.skin, 0.12)}"/>
        ${torso(o, b, id)}
        <g class="head">
          ${hairBack(o)}
          ${ears}
          <path d="${HEAD}" fill="${o.skin}"/>
          ${face(o)}
          ${hairFront(o)}
          <g class="brows">${brow(181, 'browL')}${brow(219, 'browR')}</g>
        </g>
        <g class="armL">${arm(o, b)}</g>
        <g transform="${MIRROR}"><g class="armR">${arm(o, b)}</g></g>
      </g>
    </g></g>`;

    const el = C.mount(svg, { width: opts.width, className: 'person' });
    const ax = 200 - b.hw + 20;
    return C.rig(el, 'person', o, {
      head: [200, 200], upper: [200, 440], squash: [200, 740],
      arm: [ax, 226], fore: [ax - 10, 330], leg: [172, 436], eyes: [200, 121],
      brows: [200, 103], browL: [181, 103], browR: [219, 103],
    });
  };
})();
