async page => {
  await page.route('**/*', route => route.continue());
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const fixture = 'http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html';
  const errors = [];
  const consoleErrors = [];
  const results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    if (event.type() === 'error') consoleErrors.push(event.text());
  });

  const load = async reducedMotion => {
    await page.emulateMedia({reducedMotion});
    await page.goto(fixture);
    await page.addStyleTag({url: `${base}/component/swiper/css/swiper.css`});
    await page.addStyleTag({url: `${base}/component/slider/css/slider.css`});
    await page.addScriptTag({url: `${base}/component/swiper/js/swiper.js`});
    await page.addScriptTag({url: `${base}/component/slider/js/slider.js`});
  };

  const markup = options => `
    <section class="sf-slider sf-slider--content" ${options}>
      <div class="sf-slider-main swiper">
        <div class="swiper-wrapper">
          <div class="swiper-slide"><div class="sf-slider-slide"><a href="#one">Один</a></div></div>
          <div class="swiper-slide"><div class="sf-slider-slide"><a href="#two">Два</a></div></div>
          <div class="swiper-slide"><div class="sf-slider-slide"><a href="#three">Три</a></div></div>
        </div>
      </div>
      <div class="sf-slider-controls"><div class="sf-slider-pagination"></div></div>
    </section>
    <button id="outside-slider" type="button">Вне слайдера</button>`;

  await load('no-preference');
  await page.evaluate(html => {
    document.querySelector('main').innerHTML = html;
  }, markup('data-autoplay="true" data-autoplay-delay="5000" data-autoplay-disable-on-interaction="false"'));
  await page.waitForFunction(() => document.querySelector('.sf-slider')?._sfSlider?.initialized);

  const initial = await page.evaluate(() => {
    const root = document.querySelector('.sf-slider');
    const slider = root._sfSlider;
    const slides = [...root.querySelectorAll('.swiper-slide')];
    return {
      spaceBetween: slider.params.spaceBetween,
      expectedSpaceBetween: Number.parseFloat(getComputedStyle(root).rowGap),
      speed: slider.params.speed,
      autoplayRunning: slider.autoplay.running,
      reachable: slides.map(slide => !slide.hasAttribute('inert')),
    };
  });
  await page.locator('.swiper-slide-active a').focus();
  await page.waitForFunction(() => !document.querySelector('.sf-slider')._sfSlider.autoplay.running);
  const focusPaused = await page.evaluate(() => !document.querySelector('.sf-slider')._sfSlider.autoplay.running);
  await page.locator('#outside-slider').focus();
  await page.waitForFunction(() => document.querySelector('.sf-slider')._sfSlider.autoplay.running);
  const focusResumed = await page.evaluate(() => document.querySelector('.sf-slider')._sfSlider.autoplay.running);

  const visibility = await page.evaluate(async () => {
    const root = document.querySelector('.sf-slider');
    let hidden = false;
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => hidden});
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 20));
    const paused = !root._sfSlider.autoplay.running;
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 20));
    return {paused, resumed: root._sfSlider.autoplay.running};
  });

  await page.evaluate(() => document.querySelector('.sf-slider')._sfSlider.slideNext(0));
  await page.waitForFunction(() => document.querySelector('.sf-slider')._sfSlider.activeIndex === 1);
  const afterNavigation = await page.evaluate(() => [...document.querySelectorAll('.swiper-slide')].map(slide => ({
    active: slide.classList.contains('swiper-slide-active'),
    inert: slide.hasAttribute('inert'),
  })));
  results.push({mode: 'default', initial, focusPaused, focusResumed, visibility, afterNavigation});

  await load('reduce');
  await page.evaluate(html => {
    document.querySelector('main').innerHTML = html;
  }, markup('data-autoplay="true" data-space-between="20" data-speed="900"'));
  await page.waitForFunction(() => document.querySelector('.sf-slider')?._sfSlider?.initialized);
  const reduced = await page.evaluate(() => {
    const slider = document.querySelector('.sf-slider')._sfSlider;
    return {
      autoplayRunning: slider.autoplay?.running || false,
      spaceBetween: slider.params.spaceBetween,
      speed: slider.params.speed,
    };
  });
  results.push({mode: 'reduced', reduced});

  const pass = initial.spaceBetween === initial.expectedSpaceBetween && initial.speed === 300 &&
    initial.autoplayRunning && initial.reachable.filter(Boolean).length === 1 &&
    focusPaused && focusResumed && visibility.paused && visibility.resumed &&
    afterNavigation.every(item => item.active ? !item.inert : item.inert) &&
    reduced.spaceBetween === 20 && reduced.speed === 0 && !reduced.autoplayRunning;

  return {
    status: pass && !errors.length && !consoleErrors.length ? 'passed' : 'failed',
    results,
    errors,
    consoleErrors,
  };
}
