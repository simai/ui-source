/* global document, getComputedStyle, innerWidth */
// Run with playwright-cli against the exact Range Slider candidate fixture.
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.emulateMedia({reducedMotion: 'reduce', forcedColors: 'none'});
  await page.setViewportSize({width: 390, height: 900});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-semantics-lab.html');
  await page.waitForFunction(() => document.querySelector('#smart-pair .sf-range-slider')?.noUiSlider);

  await page.evaluate(() => {
    const configurations = [
      ['reversed', {'data-min': '10', 'data-max': '0', 'data-start': '20,-5', 'data-multiple': 'true'}],
      ['false-connect', {'data-connect': 'false'}],
      ['unknown-connect', {'data-connect': 'unknown'}],
      ['negative-step', {'data-step': '-1'}],
      ['bounded-margin', {'data-multiple': 'true', 'data-start': '20,80', 'data-margin': '500'}],
    ];
    configurations.forEach(([id, attributes]) => {
      const root = document.createElement('div');
      root.id = id;
      root.className = 'sf-range-slider';
      root.setAttribute('aria-label', id);
      Object.entries(attributes).forEach(([name, value]) => root.setAttribute(name, value));
      document.querySelector('main').append(root);
    });
  });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#reversed, #false-connect, #unknown-connect, #negative-step, #bounded-margin')).every(root => root.noUiSlider));

  const state = await page.evaluate(() => {
    const read = id => {
      const root = document.getElementById(id);
      return {
        value: root.noUiSlider.get(true),
        range: root.noUiSlider.options.range,
        connect: root.noUiSlider.options.connect,
        step: root.noUiSlider.options.step,
        margin: root.noUiSlider.options.margin,
        aria: Array.from(root.querySelectorAll('[role="slider"]')).map(handle => ({
          min: Number(handle.getAttribute('aria-valuemin')),
          max: Number(handle.getAttribute('aria-valuemax')),
          now: Number(handle.getAttribute('aria-valuenow')),
        })),
      };
    };
    const smartNames = Array.from(document.querySelectorAll('#smart-pair [role="slider"]'))
      .map(handle => handle.getAttribute('aria-label'));
    const thumb = document.querySelector('#reversed .sf-thumb-handle');
    const inner = document.querySelector('#reversed .sf-thumb-inner');
    return {
      reversed: read('reversed'),
      falseConnect: read('false-connect'),
      unknownConnect: read('unknown-connect'),
      negativeStep: read('negative-step'),
      boundedMargin: read('bounded-margin'),
      smartNames,
      motion: [getComputedStyle(thumb).transitionDuration, getComputedStyle(inner).transitionDuration],
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });

  const checks = [];
  const check = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  check(state.reversed.range.min === 0 && state.reversed.range.max === 10, 'reversed bounds normalize');
  check(state.reversed.value[0] === 0 && state.reversed.value[1] === 10, 'reversed starts clamp and order');
  check(state.reversed.aria.every(item => Number.isFinite(item.now) && item.min <= item.max), 'normalized ARIA is finite');
  check(state.falseConnect.connect === false, 'false connect is boolean');
  check(state.unknownConnect.connect === 'lower', 'unknown connect uses single fallback');
  check(state.negativeStep.step === undefined, 'negative step is omitted');
  check(state.boundedMargin.margin === 100, 'margin is bounded to range');
  check(state.boundedMargin.aria.every(item => item.min <= item.max), 'bounded margin keeps ARIA ordered');
  check(state.smartNames.join('|') === 'Минимальная цена|Максимальная цена', 'two handles have distinct names');
  check(state.motion.every(value => value === '0s'), 'reduced motion removes thumb transitions');
  check(!state.overflow, 'mobile has no horizontal overflow');
  check(errors.length === 0, 'runtime has no errors');
  await page.screenshot({path: 'output/playwright/range-slider-owner-mobile.png', fullPage: true});
  return {status: 'passed', checks: checks.length, results: checks, errors, state};
}
