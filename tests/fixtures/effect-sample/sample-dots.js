// A kit fixture: the smallest effect that keeps every rule of simai.effect 1.0.0.
export function mount(host, settings, context) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;inline-size:100%;block-size:100%';
  host.append(canvas);
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
  const draw2d = canvas.getContext('2d');
  let values = settings;
  let frame = 0;
  let running = false;
  let t = 0;
  const paint = () => {
    const {width, height} = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    draw2d.clearRect(0, 0, canvas.width, canvas.height);
    draw2d.fillStyle = values.color;
    for (let i = 0; i < values.count; i += 1) {
      const x = ((i * 97 + t * values.speed * 20) % canvas.width);
      const y = ((i * 53) % canvas.height);
      if (values.shape === 'square') draw2d.fillRect(x, y, 4 * ratio, 4 * ratio);
      else { draw2d.beginPath(); draw2d.arc(x, y, 2 * ratio, 0, Math.PI * 2); draw2d.fill(); }
    }
  };
  const tick = () => { t += 1; paint(); frame = requestAnimationFrame(tick); };
  const start = () => { if (running || context.reducedMotion) return; running = true; frame = requestAnimationFrame(tick); };
  const stop = () => { running = false; cancelAnimationFrame(frame); };
  paint();
  start();
  return {
    update(next) { values = next; paint(); },
    pause: stop,
    resume: start,
    destroy() { stop(); canvas.remove(); },
  };
}
