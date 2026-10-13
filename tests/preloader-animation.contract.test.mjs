import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

const preloaderUrl = new URL(
  '../src/core/js/preloader.js',
  import.meta.url,
);
const preloaderSource = fs.readFileSync(preloaderUrl, 'utf8');
const preloader = await import(
  `data:text/javascript;base64,${Buffer.from(preloaderSource).toString('base64')}`
);
const bootSource = fs.readFileSync(
  new URL('../src/core/js/index.js', import.meta.url),
  'utf8',
);
const loaderSource = fs.readFileSync(
  new URL('../src/core/js/loader.js', import.meta.url),
  'utf8',
);

test('candidate v2 is the shared default for boot and Loader', () => {
  assert.deepEqual(preloader.DEFAULT_PRELOADER, {
    width: 31.68,
    height: 48,
    distance: 6,
    cycle: 1800,
    rotateAt: 1458,
    rotationStep: 90,
    transition: 300,
    easing: 'cubic-bezier(0.3, 1.85, 0.55, 1)',
  });
  assert.match(bootSource, /createPreloaderContent\(cfg\)/);
  assert.match(bootSource, /startPreloaderMotion\(preloaderWrap/);
  assert.match(loaderSource, /createPreloaderContent\(this\.preloader\)/);
  assert.match(loaderSource, /startPreloaderMotion\(/);
});

test('preloader color has an immediate theme-aware fallback', () => {
  const lightRoot = {classList: {contains: () => false}};
  const darkRoot = {
    classList: {contains: (className) => className === 'theme-dark'},
  };

  assert.equal(
    preloader.getPreloaderColor(lightRoot),
    'var(--sf-on-surface, #1a1b1f)',
  );
  assert.equal(
    preloader.getPreloaderColor(darkRoot),
    'var(--sf-on-surface, #e3e2e7)',
  );
  assert.equal(
    preloader.getPreloaderBackground(lightRoot),
    'var(--sf-color--surface-highest, var(--sf-surface-0, #ffffff))',
  );
  assert.equal(
    preloader.getPreloaderBackground(darkRoot),
    'var(--sf-color--surface-highest, var(--sf-surface-0, #0f1115))',
  );
});

test('default markup is compact, inline and keeps configuration overrides', () => {
  const markup = preloader.createPreloaderContent({
    color: '#123456',
    width: 40,
    height: 60,
  });

  assert.equal((markup.match(/data-sf-preloader-mark/g) || []).length, 2);
  assert.equal((markup.match(/width="40"/g) || []).length, 2);
  assert.equal((markup.match(/height="60"/g) || []).length, 2);
  assert.equal((markup.match(/fill="#123456"/g) || []).length, 2);
  assert.doesNotMatch(markup, /<img|\ssrc=/);
});

test('candidate v2 motion uses two opposing 6 px paths and cancels cleanly', () => {
  const timerCalls = [];
  const cancelled = [];
  const animationCalls = [];
  let nextTimer = 1;
  globalThis.window = {
    clearTimeout: (timer) => cancelled.push(['timer', timer]),
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timerCalls.push({callback, delay, id});
      return id;
    },
  };

  const marks = [0, 1].map((index) => ({
    style: {},
    animate: (keyframes, options) => {
      animationCalls.push({index, keyframes, options});
      return {cancel: () => cancelled.push(['animation', index])};
    },
  }));
  const container = {
    style: {},
    querySelectorAll: () => marks,
  };

  const stop = preloader.startPreloaderMotion(container);
  assert.equal(animationCalls.length, 2);
  assert.equal(animationCalls[0].options.duration, 1800);
  assert.equal(animationCalls[0].keyframes[1].transform, 'translateX(-6px)');
  assert.equal(animationCalls[1].keyframes[1].transform, 'translateX(6px)');
  assert.equal(timerCalls[0].delay, 1458);

  timerCalls[0].callback();
  assert.equal(container.style.transform, 'rotate(90deg)');
  assert.equal(timerCalls[1].delay, 1800);

  stop();
  assert.equal(container.style.transform, 'rotate(0deg)');
  assert.deepEqual(
    cancelled.filter(([type]) => type === 'animation'),
    [
      ['animation', 0],
      ['animation', 1],
    ],
  );
  delete globalThis.window;
});

test('reduced-motion users keep a compact static loading mark', () => {
  assert.match(
    preloaderSource,
    /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches/u,
  );
  assert.match(preloaderSource, /container\.style\.transition = 'none'/u);
  assert.match(preloaderSource, /mark\.style\.transform = 'none'/u);
});
