// A foreign effect that keeps every rule, for the sandbox probe: it draws
// moving bands on a canvas in its host, a dark ground or a light one as the
// scheme says, and keeps what it was told in globalThis.__sandbox -- in the
// realm it runs in, so the probe can read it there and find it absent from
// the page.
const GROUND = {dark: '#0a0c28', light: '#f5f5fa'};
const BAND = {dark: '#5078ff', light: '#7896ff'};

export function mount(host, settings, context) {
  const state = {settings: {...settings}, scheme: context.scheme, frames: 0, paused: false, updates: 0, theme: document.documentElement.className};
  globalThis.__sandbox = state;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;inline-size:100%;block-size:100%';
  host.append(canvas);
  const draw = canvas.getContext('2d');
  let frame = 0;
  let running = false;
  let t = 0;
  const paint = () => {
    const {width, height} = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    draw.fillStyle = GROUND[state.scheme];
    draw.fillRect(0, 0, canvas.width, canvas.height);
    draw.fillStyle = BAND[state.scheme];
    const step = canvas.width / state.settings.bands;
    for (let i = 0; i < state.settings.bands; i += 1) draw.fillRect((i * step + t * 3) % canvas.width, 0, step / 3, canvas.height);
  };
  const tick = () => { t += 1; state.frames += 1; paint(); frame = requestAnimationFrame(tick); };
  const start = () => { if (running || context.reducedMotion) return; running = true; state.paused = false; frame = requestAnimationFrame(tick); };
  const stop = () => { running = false; state.paused = true; cancelAnimationFrame(frame); };
  paint();
  start();
  return {
    update(next, change) {
      state.settings = {...next};
      state.scheme = change.scheme;
      state.updates += 1;
      state.theme = document.documentElement.className;
      paint();
    },
    pause: stop,
    resume: start,
    destroy() { stop(); canvas.remove(); },
  };
}
