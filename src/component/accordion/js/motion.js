// The height motion of an accordion section (owner decision C154 (4)): the
// section grows or shrinks to its new height on the clock of the toggle and
// the check box (C66, C121) -- 200 ms, --sf-ease-move -- and its marker
// turns on the same clock. The clock is the class sheet's: the section's
// transition on block-size, which nothing else animates, so a page that
// changes --sf-accordion--duration or asks for reduced motion (the sheet
// sets it to none) changes the motion here too. Shared by the class runtime
// and sf-accordion; stateless, so each bundle may carry its own copy.

const running = new WeakMap();

function seconds(value) {
  const first = String(value || '').split(',')[0].trim();
  if (!first) return 0;
  const number = parseFloat(first);
  if (!Number.isFinite(number)) return 0;
  return first.endsWith('ms') ? number : number * 1000;
}

// The section's clock: [duration in ms, easing], or null when it does not
// move -- reduced motion, a zero duration, or no layout (a hidden page).
export function sectionClock(section) {
  if (!section || typeof getComputedStyle !== 'function' || typeof section.animate !== 'function') return null;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  const style = getComputedStyle(section);
  const properties = String(style.transitionProperty || '').split(',').map((one) => one.trim());
  const at = properties.findIndex((one) => one === 'block-size' || one === 'height' || one === 'all');
  if (at < 0) return null;
  const durations = String(style.transitionDuration || '').split(',');
  const easings = String(style.transitionTimingFunction || '').split(/,(?![^(]*\))/u);
  const duration = seconds(durations[at] ?? durations[0]);
  if (!(duration > 0)) return null;
  return [duration, (easings[at] ?? easings[0] ?? 'ease').trim()];
}

// The height the section stands at now, mid-motion included.
export function sectionHeight(section) {
  return section?.getBoundingClientRect?.().height ?? 0;
}

// Stops a motion still running on the section (a second press before the
// first ended): the next one starts from where this one stood.
export function stopSectionMotion(section) {
  const animation = running.get(section);
  if (!animation) return;
  running.delete(section);
  animation.onfinish = null;
  animation.cancel();
}

// Moves the section from the height it stood at to the one it stands at now.
// `done` runs when the motion ends (not when a newer one replaces it); it is
// how a closing section keeps its content in view until it has shrunk.
// Answers whether anything moves; without motion `done` runs at once.
export function moveSection(section, from, done) {
  const clock = sectionClock(section);
  const to = sectionHeight(section);
  if (!clock || !(from >= 0) || Math.abs(to - from) < 1) {
    done?.();
    return false;
  }
  const [duration, easing] = clock;
  const animation = section.animate(
    {blockSize: [`${from}px`, `${to}px`]},
    {duration, easing},
  );
  running.set(section, animation);
  animation.onfinish = () => {
    if (running.get(section) === animation) running.delete(section);
    done?.();
  };
  return true;
}
