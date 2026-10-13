import { pageText } from '../../../core/js/page-language';

const SCROLLBAR_TEXT = { en: { scroll: 'Scroll' }, ru: { scroll: 'Прокрутка' } };
const ROOT_SELECTOR = '.sf-scrollbar';
const VIEWPORT_SELECTOR = '.sf-scrollbar__viewport';
const TRACK_CLASS = 'sf-scrollbar__track';
const THUMB_CLASS = 'sf-scrollbar__thumb';
const MANAGED_PRESETS = new Set(['overlay', 'persistent']);
const VALID_PRESETS = new Set(['overlay', 'standard', 'persistent', 'hidden']);
const VALID_AXES = new Set(['vertical', 'horizontal']);
const IDLE_DELAY = 900;
const controllers = new WeakMap();

let viewportId = 0;

function getPreset(root) {
  const value = String(
    root.getAttribute('data-mode') ||
    root.getAttribute('data-sf-scrollbar') ||
    'overlay',
  )
    .trim()
    .toLowerCase();

  return VALID_PRESETS.has(value) ? value : 'overlay';
}

function getAxis(root) {
  const value = String(
    root.getAttribute('data-axis') ||
    root.getAttribute('data-sf-scrollbar-axis') ||
    'vertical',
  )
    .trim()
    .toLowerCase();

  return VALID_AXES.has(value) ? value : 'vertical';
}

function createTrack(viewport, axis) {
  const track = document.createElement('div');
  const thumb = document.createElement('button');

  track.className = `${TRACK_CLASS} ${TRACK_CLASS}--${axis}`;

  thumb.className = `${THUMB_CLASS} ${THUMB_CLASS}--${axis}`;
  thumb.type = 'button';
  thumb.setAttribute('role', 'scrollbar');
  thumb.setAttribute('aria-orientation', axis);
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', '100');
  thumb.setAttribute('aria-valuenow', '0');
  const labelledBy = viewport.getAttribute('aria-labelledby');
  const label = viewport.getAttribute('aria-label');

  if (labelledBy) thumb.setAttribute('aria-labelledby', labelledBy);
  else thumb.setAttribute('aria-label', label || pageText(SCROLLBAR_TEXT, 'scroll', viewport));

  if (!viewport.id) {
    viewportId += 1;
    viewport.id = `sf-scrollbar-viewport-${viewportId}`;
  }

  thumb.setAttribute('aria-controls', viewport.id);
  track.append(thumb);

  return {track, thumb};
}

function measureTokenLength(root, propertyName) {
  const probe = document.createElement('span');

  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.blockSize = `var(${propertyName})`;
  probe.style.pointerEvents = 'none';
  probe.style.visibility = 'hidden';
  root.append(probe);

  const value = probe.offsetHeight;
  probe.remove();

  return value;
}

class ScrollbarController {
  constructor(root, viewport, preset, axis) {
    this.root = root;
    this.viewport = viewport;
    this.preset = preset;
    this.axis = axis;
    this.idleTimer = 0;
    this.dragging = false;
    this.pointerOverTrack = false;
    this.dragPointerOffset = 0;
    this.cleanup = [];
    this.keyboardStep = measureTokenLength(root, '--sf-scrollbar-keyboard-step');

    const {track, thumb} = createTrack(viewport, axis);
    this.track = track;
    this.thumb = thumb;
    root.append(track);

    // The keyboard stop is the scrolling area, not the thumb: a focused region
    // scrolls with the arrow keys natively, the way every scrolling area in a
    // browser does, and one stop per area is enough. The thumb stays for the
    // pointer. A labelled area becomes a region so its label is announced.
    thumb.tabIndex = -1;
    if (!viewport.hasAttribute('tabindex')) viewport.tabIndex = 0;
    if (!viewport.hasAttribute('role')
      && (viewport.hasAttribute('aria-label') || viewport.hasAttribute('aria-labelledby'))) {
      viewport.setAttribute('role', 'region');
    }

    this.bind();
    this.sync();
    this.setIdle();
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.cleanup.push(() => target.removeEventListener(type, listener, options));
  }

  isHorizontalRtl() {
    return this.axis === 'horizontal' && getComputedStyle(this.viewport).direction === 'rtl';
  }

  getLogicalScrollPosition(maxScroll) {
    if (this.axis === 'vertical') return this.viewport.scrollTop;

    const position = this.isHorizontalRtl()
      ? -this.viewport.scrollLeft
      : this.viewport.scrollLeft;

    return Math.min(maxScroll, Math.max(0, position));
  }

  setLogicalScrollPosition(position, maxScroll) {
    const boundedPosition = Math.min(maxScroll, Math.max(0, position));

    if (this.axis === 'vertical') {
      this.viewport.scrollTop = boundedPosition;
      return;
    }

    this.viewport.scrollLeft = this.isHorizontalRtl()
      ? -boundedPosition
      : boundedPosition;
  }

  getKeyboardStep() {
    return this.keyboardStep > 0 ? this.keyboardStep : this.thumb.offsetHeight;
  }

  bind() {
    this.listen(
      this.viewport,
      'scroll',
      () => {
        this.sync();
        this.activate();
      },
      {passive: true},
    );

    this.listen(this.track, 'pointerenter', () => {
      this.pointerOverTrack = true;
      this.activate();
    });

    this.listen(this.track, 'pointerleave', () => {
      this.pointerOverTrack = false;
      this.scheduleIdle();
    });

    this.listen(this.track, 'pointerdown', (event) => {
      if (event.target !== this.track) return;

      event.preventDefault();
      const thumbRect = this.thumb.getBoundingClientRect();
      const pointer = this.axis === 'horizontal' ? event.clientX : event.clientY;
      const thumbStart = this.axis === 'horizontal' ? thumbRect.left : thumbRect.top;
      const direction = pointer < thumbStart ? -1 : 1;
      const viewportSize = this.axis === 'horizontal'
        ? this.viewport.clientWidth
        : this.viewport.clientHeight;
      const step = this.getKeyboardStep();
      const page = Math.max(step, viewportSize - step);
      this.viewport.scrollBy(
        this.axis === 'horizontal'
          ? {left: direction * page}
          : {top: direction * page},
      );
      this.activate();
    });

    this.listen(this.thumb, 'pointerdown', (event) => {
      event.preventDefault();
      const thumbRect = this.thumb.getBoundingClientRect();

      this.dragging = true;
      this.dragPointerOffset = this.axis === 'horizontal'
        ? event.clientX - thumbRect.left
        : event.clientY - thumbRect.top;
      this.root.dataset.sfScrollbarDragging = 'true';
      this.thumb.setPointerCapture?.(event.pointerId);
      this.activate();
    });

    this.listen(this.thumb, 'pointermove', (event) => {
      if (!this.dragging) return;

      const trackRect = this.track.getBoundingClientRect();
      const trackSize = this.axis === 'horizontal'
        ? this.track.clientWidth
        : this.track.clientHeight;
      const thumbSize = this.axis === 'horizontal'
        ? this.thumb.offsetWidth
        : this.thumb.offsetHeight;
      const viewportSize = this.axis === 'horizontal'
        ? this.viewport.clientWidth
        : this.viewport.clientHeight;
      const contentSize = this.axis === 'horizontal'
        ? this.viewport.scrollWidth
        : this.viewport.scrollHeight;
      const pointer = this.axis === 'horizontal' ? event.clientX : event.clientY;
      const trackStart = this.axis === 'horizontal' ? trackRect.left : trackRect.top;
      const maxThumbOffset = Math.max(1, trackSize - thumbSize);
      const maxScroll = Math.max(0, contentSize - viewportSize);
      const pointerOffset = pointer - trackStart - this.dragPointerOffset;
      const thumbOffset = Math.min(maxThumbOffset, Math.max(0, pointerOffset));

      const ratio = this.isHorizontalRtl()
        ? 1 - thumbOffset / maxThumbOffset
        : thumbOffset / maxThumbOffset;

      this.setLogicalScrollPosition(ratio * maxScroll, maxScroll);
    });

    const endDrag = (event) => {
      if (!this.dragging) return;

      this.dragging = false;
      this.root.dataset.sfScrollbarDragging = 'false';

      if (this.thumb.hasPointerCapture?.(event.pointerId)) {
        this.thumb.releasePointerCapture(event.pointerId);
      }

      this.scheduleIdle();
    };

    this.listen(this.thumb, 'pointerup', endDrag);
    this.listen(this.thumb, 'pointercancel', endDrag);
    this.listen(this.thumb, 'lostpointercapture', endDrag);

    this.listen(this.thumb, 'focus', () => this.activate());
    this.listen(this.thumb, 'blur', () => this.scheduleIdle());
    this.listen(this.viewport, 'focus', () => this.activate());
    this.listen(this.viewport, 'blur', () => this.scheduleIdle());

    this.listen(this.thumb, 'keydown', (event) => {
      const line = this.getKeyboardStep();
      const viewportSize = this.axis === 'horizontal'
        ? this.viewport.clientWidth
        : this.viewport.clientHeight;
      const page = Math.max(line, viewportSize - line);
      const verticalCommands = {
        ArrowUp: () => this.viewport.scrollBy({top: -line}),
        ArrowDown: () => this.viewport.scrollBy({top: line}),
        PageUp: () => this.viewport.scrollBy({top: -page}),
        PageDown: () => this.viewport.scrollBy({top: page}),
      };
      const horizontalCommands = {
        ArrowLeft: () => this.viewport.scrollBy({left: -line}),
        ArrowRight: () => this.viewport.scrollBy({left: line}),
        PageUp: () => this.viewport.scrollBy({left: -page}),
        PageDown: () => this.viewport.scrollBy({left: page}),
      };
      const commands = {
        ...(this.axis === 'horizontal' ? horizontalCommands : verticalCommands),
        Home: () => {
          const contentSize = this.axis === 'horizontal'
            ? this.viewport.scrollWidth
            : this.viewport.scrollHeight;
          this.setLogicalScrollPosition(0, Math.max(0, contentSize - viewportSize));
        },
        End: () => {
          const contentSize = this.axis === 'horizontal'
            ? this.viewport.scrollWidth
            : this.viewport.scrollHeight;
          const maxScroll = Math.max(0, contentSize - viewportSize);
          this.setLogicalScrollPosition(maxScroll, maxScroll);
        },
      };

      if (!commands[event.key]) return;

      event.preventDefault();
      commands[event.key]();
      this.activate();
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.sync());
      this.resizeObserver.observe(this.viewport);
      Array.from(this.viewport.children).forEach((child) => {
        if (child instanceof HTMLElement) this.resizeObserver.observe(child);
      });
    } else {
      this.listen(window, 'resize', () => this.sync(), {passive: true});
    }

    if (typeof MutationObserver !== 'undefined') {
      this.contentObserver = new MutationObserver(() => {
        if (this.resizeObserver) {
          Array.from(this.viewport.children).forEach((child) => {
            if (child instanceof HTMLElement) this.resizeObserver.observe(child);
          });
        }
        this.sync();
      });
      this.contentObserver.observe(this.viewport, {
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style'],
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  sync() {
    const viewportSize = this.axis === 'horizontal'
      ? this.viewport.clientWidth
      : this.viewport.clientHeight;
    const contentSize = this.axis === 'horizontal'
      ? this.viewport.scrollWidth
      : this.viewport.scrollHeight;
    const maxScroll = Math.max(0, contentSize - viewportSize);
    const hasOverflow = maxScroll > 1;
    const requestedThumbSize = hasOverflow
      ? Math.round((viewportSize * viewportSize) / contentSize)
      : viewportSize;

    this.root.dataset.sfScrollbarOverflow = String(hasOverflow);
    if (this.axis === 'horizontal') {
      this.thumb.style.inlineSize = `${requestedThumbSize}px`;
    } else {
      this.thumb.style.blockSize = `${requestedThumbSize}px`;
    }

    const thumbSize = this.axis === 'horizontal'
      ? this.thumb.offsetWidth
      : this.thumb.offsetHeight;
    const maxThumbOffset = Math.max(0, viewportSize - thumbSize);
    const ratio = maxScroll ? this.getLogicalScrollPosition(maxScroll) / maxScroll : 0;
    const physicalOffset = Math.round(maxThumbOffset * ratio) *
      (this.isHorizontalRtl() ? -1 : 1);

    this.thumb.style.setProperty(
      '--sf-scrollbar-thumb-offset',
      `${physicalOffset}px`,
    );
    this.thumb.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    this.thumb.disabled = !hasOverflow;
  }

  activate() {
    window.clearTimeout(this.idleTimer);
    this.root.dataset.sfScrollbarState = 'active';

    if (this.preset === 'overlay') {
      this.scheduleIdle();
    }
  }

  scheduleIdle() {
    window.clearTimeout(this.idleTimer);

    if (
      this.preset === 'persistent' ||
      this.dragging ||
      this.pointerOverTrack ||
      document.activeElement === this.thumb
    ) {
      return;
    }

    this.idleTimer = window.setTimeout(() => this.setIdle(), IDLE_DELAY);
  }

  setIdle() {
    this.root.dataset.sfScrollbarState =
      this.preset === 'persistent' ? 'active' : 'idle';
  }

  destroy() {
    window.clearTimeout(this.idleTimer);
    this.resizeObserver?.disconnect();
    this.contentObserver?.disconnect();
    this.cleanup.forEach((remove) => remove());
    this.track.remove();
    delete this.root.dataset.sfScrollbarState;
    delete this.root.dataset.sfScrollbarDragging;
    delete this.root.dataset.sfScrollbarOverflow;
    delete this.root.dataset.sfScrollbarReady;
  }
}

function destroyScrollbar(root) {
  const controller = controllers.get(root);

  if (!controller) return;

  controller.destroy();
  controllers.delete(root);
}

function initScrollbar(root) {
  if (!(root instanceof HTMLElement) || !root.matches(ROOT_SELECTOR)) return;

  const preset = getPreset(root);
  const axis = getAxis(root);
  const canonicalPreset = root.getAttribute('data-mode');
  const legacyPreset = root.getAttribute('data-sf-scrollbar');
  const requestedPreset = String(canonicalPreset || legacyPreset || '')
    .trim()
    .toLowerCase();

  if (requestedPreset && !VALID_PRESETS.has(requestedPreset)) {
    root.setAttribute(canonicalPreset !== null ? 'data-mode' : 'data-sf-scrollbar', preset);
  }

  const existing = controllers.get(root);

  if (existing?.preset === preset && existing?.axis === axis) return;
  if (existing) destroyScrollbar(root);

  root.dataset.sfScrollbarReady = 'true';

  if (!MANAGED_PRESETS.has(preset)) return;

  const viewport = root.querySelector(`:scope > ${VIEWPORT_SELECTOR}`);
  if (!(viewport instanceof HTMLElement)) return;

  controllers.set(root, new ScrollbarController(root, viewport, preset, axis));
}

function initScrollbars(target = document) {
  if (target instanceof HTMLElement && target.matches(ROOT_SELECTOR)) {
    initScrollbar(target);
  }

  target.querySelectorAll?.(ROOT_SELECTOR).forEach(initScrollbar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initScrollbars(document));
} else {
  initScrollbars(document);
}

if (typeof MutationObserver !== 'undefined') {
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === 'attributes' &&
        mutation.target instanceof HTMLElement &&
        mutation.target.matches(ROOT_SELECTOR)
      ) {
        initScrollbar(mutation.target);
        return;
      }

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.matches(ROOT_SELECTOR)) destroyScrollbar(node);
        node.querySelectorAll?.(ROOT_SELECTOR).forEach(destroyScrollbar);
      });

      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) initScrollbars(node);
      });
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      'data-mode',
      'data-axis',
      'data-sf-scrollbar',
      'data-sf-scrollbar-axis',
    ],
    childList: true,
    subtree: true,
  });
}

globalThis.SF = globalThis.SF || {};
globalThis.SF.Scrollbar = {
  destroy: destroyScrollbar,
  init: initScrollbars,
};
