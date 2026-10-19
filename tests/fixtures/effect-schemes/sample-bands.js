// A kit fixture of simai.effect 1.1: two schemes, each drawn from palette tones
// (fixed across themes, never roles), switched through update(settings,
// context), and one continuous scene that may be seen through windows.
const TONES = {
  dark: {ground: ['--sf-neutral-5', [12, 14, 20]], band: ['--sf-primary-30', [0, 68, 148]]},
  light: {ground: ['--sf-neutral-98', [250, 249, 254]], band: ['--sf-primary-90', [215, 226, 255]]},
};

// A palette tone, resolved through a probe so var() chains settle; the fallback
// stands for a page without the Framework's sheets.
function tone(host, [name, fallback]) {
  const probe = host.ownerDocument.createElement('i');
  probe.style.cssText = `position:absolute;inline-size:0;block-size:0;color:var(${name})`;
  host.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return getComputedStyle(host).getPropertyValue(name).trim() ? value : `rgb(${fallback.join(',')})`;
}

export function mount(host, settings, context) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;inline-size:100%;block-size:100%';
  host.append(canvas);
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
  const draw2d = canvas.getContext('2d');
  let values = settings;
  let scheme = context.scheme === 'light' ? 'light' : 'dark';
  let colors = null;
  const read = () => { colors = {ground: tone(host, TONES[scheme].ground), band: tone(host, TONES[scheme].band)}; };
  let frame = 0;
  let running = false;
  let t = 0;
  const paint = () => {
    const {width, height} = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    draw2d.fillStyle = colors.ground;
    draw2d.fillRect(0, 0, canvas.width, canvas.height);
    draw2d.fillStyle = colors.band;
    draw2d.globalAlpha = 0.35;
    const step = canvas.width / values.bands;
    for (let i = 0; i < values.bands; i += 1) {
      const x = (i * step + t * values.speed) % canvas.width;
      draw2d.fillRect(x, 0, step / 3, canvas.height);
    }
    draw2d.globalAlpha = 1;
  };
  const tick = () => { t += 1; paint(); frame = requestAnimationFrame(tick); };
  const start = () => { if (running || context.reducedMotion) return; running = true; frame = requestAnimationFrame(tick); };
  const stop = () => { running = false; cancelAnimationFrame(frame); };
  read();
  paint();
  start();
  return {
    update(next, change = {}) {
      values = next;
      if (change.scheme) scheme = change.scheme;
      read();
      paint();
    },
    pause: stop,
    resume: start,
    destroy() { stop(); canvas.remove(); },
  };
}
