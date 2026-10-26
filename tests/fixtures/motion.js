OfficeCast.scene('s0', (K, layer) => {
  const s = K.S('s0');
  const tanaka = K.person('tanaka', 400, layer, { width: 290 });
  const sato = K.person('sato', 800, layer, { width: 290 });
  const robot = K.robot('blue', 1300, layer, { width: 250 });
  tanaka.el.id = 'test-tanaka';
  sato.el.id = 'test-sato';
  robot.el.id = 'test-robot';
  tanaka.idle(K.tl, s.start, s.end - 1.9)
    .bow(K.tl, s.end - 1.9, { depth: 0.8, hold: 0.3, dur: 0.35 });
  sato.wave(K.tl, s.start + 2, { s: 'R', times: 2 });
  robot.hop(K.tl, s.start + 2.35, { h: 75, arms: false });
  const laptop = K.prop('laptop', { width: 240 }, 1650, 870, layer);
  K.tl.fromTo(laptop.parts.lines, { scaleX: 0 }, {
    scaleX: 1, duration: 0.35, stagger: 0.12, immediateRender: false,
  }, s.start + 0.9);
});

OfficeCast.scene('s1', (K, layer) => {
  const s = K.S('s1');
  const logo = K.div(layer, 'shu-logo', '', {
    left: 400, top: '50%', width: 1120, aspectRatio: '1321 / 444', transform: 'translateY(-50%)',
  });
  for (const [index, clip] of ['inset(0 77% 0 0)', 'inset(0 0 0 23%)'].entries()) {
    const image = document.createElement('img');
    image.src = '../../../shared/brand/shu-works-logo.png';
    image.alt = index ? 'SHU Works' : '';
    Object.assign(image.style, {
      position: 'absolute', inset: '0', width: '100%', height: 'auto', clipPath: clip,
    });
    logo.appendChild(image);
    K.preload.push(image.src);
    gsap.set(image, { autoAlpha: 0 });
    K.tl.to(image, { autoAlpha: 1, duration: 0.8 }, s.start + (index ? 0.65 : 0.2));
  }
});
