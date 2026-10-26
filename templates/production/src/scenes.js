OfficeCast.scene('s0', (K, layer) => {
  const scene = K.S('s0');
  const title = K.div(layer, 'heading', K.config.title, { left: 120, top: 140 });
  K.pop(title, scene.start + 0.1);
  const tanaka = K.person('tanaka', 780, layer, { width: 300 });
  const robot = K.robot('blue', 1200, layer, { width: 280 });
  K.pop(tanaka.el, scene.start + 0.3);
  K.pop(robot.el, scene.start + 0.5);
  tanaka.idle(K.tl, scene.start, scene.end).wave(K.tl, scene.start + 1.1, { s: 'L', times: 1 });
  robot.idle(K.tl, scene.start, scene.end).expr(K.tl, scene.start + 0.5, 'smile');
  K.cue(scene.start + 0.5, 'pon', 0.4);
});
