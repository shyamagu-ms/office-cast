/* General-purpose robot rig – same flat, outline-free language as the person rig.
 *   Chars.createRobot({ color: 'blue' | '#hex', ... })
 * 400x760 viewBox, feet on y=740; a little shorter and chunkier than a person.
 * Pose conventions identical to createPerson.
 */
(function () {
  const C = window.Chars;
  const MIRROR = 'matrix(-1 0 0 1 400 0)';

  C.ROBOT_COLORS = {
    blue: '#3f6fb3',
    red: '#d0553e',
    green: '#4f9775',
    yellow: '#e3ab2c',
    purple: '#76629f',
    orange: '#e07a38',
    teal: '#2d8a8a',
    white: '#e7e3da',
  };

  const DEF = {
    name: 'ロボ',
    color: C.ROBOT_COLORS.blue,
    metal: '#a9adb3',
    joint: '#6f747c',
    dark: '#33363d',
    visor: '#1d2129',
    glow: '#e4f8ff',
    lamp: '#ffcf5a',
    panel: '#efebe4',
  };

  function arm(o) {
    return `
    <g class="arm">
      ${C.seg('M136,290 L128,378', o.metal, 20)}
      <g class="fore">
        ${C.seg('M128,378 L123,452', o.metal, 18)}
        <circle cx="128" cy="378" r="12" fill="${o.joint}"/>
        <g class="hand">
          <path d="M105,462 Q105,448 123,448 Q141,448 141,462 L141,476 Q141,494 123,494 Q105,494 105,476 Z" fill="${o.dark}"/>
          <g class="prop"></g>
        </g>
      </g>
      <circle cx="136" cy="288" r="21" fill="${C.shade(o.color, 0.18)}"/>
    </g>`;
  }

  function leg(o) {
    return `
    <g class="leg">
      ${C.seg('M174,484 L173,706', o.metal, 26)}
      <circle cx="173" cy="600" r="14" fill="${o.joint}"/>
      <path d="M136,740 C136,714 150,700 174,700 C198,700 211,714 211,740 Z" fill="${o.dark}"/>
    </g>`;
  }

  function visorFace(o) {
    const g = o.glow;
    const st = (d, w = 4) => `<path d="${d}" fill="none" stroke="${g}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const eyes = (f) => f(180) + f(220);
    return `
    <g class="face">
      <g class="eyes">
        <g class="eye-normal">${eyes((x) => `<rect x="${x - 6}" y="179" width="12" height="22" rx="6" fill="${g}"/>`)}</g>
        <g class="eye-happy" opacity="0">${eyes((x) => st(`M${x - 10},195 Q${x},181 ${x + 10},195`))}</g>
        <g class="eye-surprised" opacity="0">${eyes((x) => `<circle cx="${x}" cy="190" r="10" fill="none" stroke="${g}" stroke-width="3.8"/><circle cx="${x}" cy="190" r="3.4" fill="${g}"/>`)}</g>
        <g class="eye-think" opacity="0">${eyes((x) => st(`M${x - 9},191 L${x + 9},191`))}</g>
        <g class="eye-error" opacity="0">${eyes((x) => st(`M${x - 7},183 L${x + 7},198 M${x + 7},183 L${x - 7},198`, 3.8))}</g>
      </g>
      <g class="mouth">
        <g class="mouth-line">${st('M192,215 L208,215', 3.2)}</g>
        <g class="mouth-smile" opacity="0">${st('M191,213 Q200,220 209,213', 3.2)}</g>
        <g class="mouth-open" opacity="0"><path d="M190,210 L210,210 Q209,222 200,222 Q191,222 190,210 Z" fill="${g}"/></g>
        <g class="mouth-talk" opacity="0">${st('M191,213 L191,217 M195.5,210 L195.5,220 M200,212 L200,218 M204.5,209 L204.5,221 M209,213 L209,217', 2.8)}</g>
        <g class="mouth-o" opacity="0"><circle cx="200" cy="215" r="5" fill="none" stroke="${g}" stroke-width="3.2"/></g>
        <g class="mouth-wavy" opacity="0">${st('M190,216 L195,211 L200,217 L205,211 L210,216', 2.8)}</g>
      </g>
    </g>`;
  }

  C.createRobot = function (opts = {}) {
    const o = { ...DEF, ...opts };
    if (opts.color && C.ROBOT_COLORS[opts.color]) o.color = C.ROBOT_COLORS[opts.color];
    const id = C.uid('r');
    const col = o.color, sh = C.shade(col, 0.12);
    const HEAD = 'M162,134 L238,134 Q272,134 272,168 L272,216 Q272,250 238,250 L162,250 Q128,250 128,216 L128,168 Q128,134 162,134 Z';
    const BODY = 'M166,268 L234,268 Q270,268 270,304 L266,434 Q266,470 230,470 L170,470 Q134,470 134,434 L130,304 Q130,268 166,268 Z';

    const svg = `
    <defs>
      <filter id="${id}g" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <clipPath id="${id}h"><path d="${HEAD}"/></clipPath>
      <clipPath id="${id}b"><path d="${BODY}"/></clipPath>
    </defs>
    <ellipse class="shadow" cx="200" cy="741" rx="100" ry="10" fill="#000" opacity=".16"/>
    <g class="lift"><g class="squash">
      <g class="legL">${leg(o)}</g>
      <g transform="${MIRROR}"><g class="legR">${leg(o)}</g></g>
      <rect x="152" y="452" width="96" height="46" rx="18" fill="${o.joint}"/>
      <g class="upper">
        <rect x="184" y="242" width="32" height="34" fill="${o.joint}"/>
        <g class="torso">
          <path d="${BODY}" fill="${col}"/>
          <g clip-path="url(#${id}b)"><rect x="238" y="256" width="40" height="230" fill="${sh}"/></g>
          <rect x="160" y="302" width="80" height="64" rx="12" fill="${o.panel}"/>
          <circle class="lamp-glow" cx="220" cy="322" r="13" fill="${o.lamp}" opacity=".35"/>
          <circle class="lamp" cx="220" cy="322" r="6" fill="${o.lamp}"/>
          <path d="M175,318 L199,318 M175,331 L193,331 M175,344 L223,344" stroke="${C.mix(o.panel, o.dark, 0.35)}" stroke-width="4" stroke-linecap="round"/>
        </g>
        <g class="head">
          <g class="antenna">
            <path d="M200,136 L200,106" stroke="${o.joint}" stroke-width="4" stroke-linecap="round"/>
            <circle class="antenna-glow" cx="200" cy="99" r="13" fill="${o.lamp}" opacity=".3"/>
            <circle cx="200" cy="99" r="7" fill="${o.lamp}"/>
          </g>
          <rect x="114" y="172" width="22" height="40" rx="9" fill="${o.joint}"/>
          <rect x="264" y="172" width="22" height="40" rx="9" fill="${o.joint}"/>
          <path d="${HEAD}" fill="${col}"/>
          <g clip-path="url(#${id}h)"><rect x="248" y="124" width="40" height="140" fill="${sh}"/></g>
          <rect x="146" y="156" width="108" height="76" rx="24" fill="${o.visor}"/>
          <g filter="url(#${id}g)">${visorFace(o)}</g>
        </g>
        <g class="armL">${arm(o)}</g>
        <g transform="${MIRROR}"><g class="armR">${arm(o)}</g></g>
      </g>
    </g></g>`;

    const el = C.mount(svg, { width: opts.width, className: 'robot' });
    return C.rig(el, 'robot', o, {
      head: [200, 262], upper: [200, 470], squash: [200, 740],
      arm: [136, 288], fore: [128, 378], leg: [174, 484], eyes: [200, 190],
      antenna: [200, 136], lamp: [220, 322], antennaGlow: [200, 99],
    });
  };
})();
