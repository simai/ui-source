export const DEFAULT_PRELOADER = Object.freeze({
  width: 31.68,
  height: 48,
  distance: 6,
  cycle: 1800,
  rotateAt: 1458,
  rotationStep: 90,
  transition: 300,
  easing: 'cubic-bezier(0.3, 1.85, 0.55, 1)',
});

const MOTION_HANDLE = '__sfPreloaderMotion';

// What the server printed is the first paint (standard simai.smart-component
// 1.3.8 §5.4): static markup of a Smart element (`data-sf-static`) or a core
// skeleton shape (`data-sf-skeleton`). A page that carries either is not
// covered by the boot preloader; a bare page, with nothing to show until the
// Loader is ready, still is.
export const FIRST_PAINT_SELECTOR = '[data-sf-static], [data-sf-skeleton]';

export function pageHasFirstPaint(doc = globalThis.document) {
  return Boolean(doc?.querySelector?.(FIRST_PAINT_SELECTOR));
}

export function getPreloaderColor(root = document.documentElement) {
  const fallback = root?.classList?.contains('theme-dark')
    ? '#e3e2e7'
    : '#1a1b1f';
  return `var(--sf-on-surface, ${fallback})`;
}

export function getPreloaderBackground(root = document.documentElement) {
  const fallback = root?.classList?.contains('theme-dark')
    ? '#0f1115'
    : '#ffffff';
  return `var(--sf-color--surface-highest, var(--sf-surface-0, ${fallback}))`;
}

export function createPreloaderContent(preloader = {}) {
  const config = {...DEFAULT_PRELOADER, ...preloader};

  return `<svg data-sf-preloader-mark id="sv_li_1" xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 66 100" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M0 50.0013L49.812 0L66 16.2495L32.3722 50.0051L65.9938 83.7543L49.8097 100L0 50.0013Z" fill="${config.color}"/>
</svg>
<svg data-sf-preloader-mark id="sv_li_2" xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 66 100" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M66 50.0013L16.188 0L0 16.2495L33.6278 50.0051L0.00615692 83.7543L16.1903 100L66 50.0013Z" fill="${config.color}"/>
</svg>`;
}

export function stopPreloaderMotion(container) {
  container?.[MOTION_HANDLE]?.();
}

export function startPreloaderMotion(
  container,
  isActive = () => true,
  options = {},
) {
  if (!container) return () => {};

  stopPreloaderMotion(container);
  const config = {...DEFAULT_PRELOADER, ...options};
  const marks = Array.from(
    container.querySelectorAll('[data-sf-preloader-mark]'),
  );
  if (marks.length !== 2 || typeof marks[0].animate !== 'function') {
    return () => {};
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    container.style.transition = 'none';
    container.style.transform = 'rotate(0deg)';
    marks.forEach((mark) => {
      mark.style.transform = 'none';
    });
    const stop = () => {
      if (container[MOTION_HANDLE] === stop) {
        delete container[MOTION_HANDLE];
      }
    };
    container[MOTION_HANDLE] = stop;
    return stop;
  }

  container.style.transition = `${config.transition}ms transform ease-in-out`;
  let rotationAngle = 0;
  let rotationTimer = null;
  let stopped = false;

  const animations = marks.map((mark, index) => {
    const distance = index === 0 ? -config.distance : config.distance;
    return mark.animate(
      [
        {transform: 'translateX(0)', offset: 0, easing: config.easing},
        {
          transform: `translateX(${distance}px)`,
          offset: 0.36,
          easing: config.easing,
        },
        {
          transform: `translateX(${distance}px)`,
          offset: 0.48,
          easing: config.easing,
        },
        {transform: 'translateX(0)', offset: 0.84, easing: config.easing},
        {transform: 'translateX(0)', offset: 1},
      ],
      {
        duration: config.cycle,
        iterations: Number.POSITIVE_INFINITY,
      },
    );
  });

  const rotate = () => {
    if (stopped || !isActive()) return;
    rotationAngle += config.rotationStep;
    container.style.transform = `rotate(${rotationAngle}deg)`;
    rotationTimer = window.setTimeout(rotate, config.cycle);
  };
  rotationTimer = window.setTimeout(rotate, config.rotateAt);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(rotationTimer);
    animations.forEach((animation) => animation.cancel());
    container.style.transform = 'rotate(0deg)';
    marks.forEach((mark) => {
      mark.style.transform = 'none';
    });
    if (container[MOTION_HANDLE] === stop) {
      delete container[MOTION_HANDLE];
    }
  };

  container[MOTION_HANDLE] = stop;
  return stop;
}
