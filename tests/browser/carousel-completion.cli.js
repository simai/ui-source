async page => {
const results = [];
const errors = [];
const externalRequests = [];
const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
page.on('request', request => {
  if (!request.url().startsWith('http://127.0.0.1:8766/')) externalRequests.push(request.url());
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
await page.emulateMedia({reducedMotion: 'no-preference'});
await page.setViewportSize({width: 1024, height: 768});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/carousel-method-lab.html');
await page.waitForFunction(() => ['manual', 'automatic', 'fail-closed'].every(id =>
  document.getElementById(id)?.dataset.sfCarouselBound === 'true'));

check('named root exposes carousel semantics', await page.evaluate(() => {
  const root = document.querySelector('#manual');
  return root.getAttribute('role') === 'region'
    && root.getAttribute('aria-roledescription') === 'carousel'
    && root.getAttribute('aria-label') === 'Новости';
}));
check('only the current slide is exposed and interactive', await page.evaluate(() => {
  const slides = [...document.querySelectorAll('#manual .swiper-slide')];
  return slides.filter(slide => slide.getAttribute('aria-hidden') === 'false').length === 1
    && slides.filter(slide => !slide.hasAttribute('inert')).length === 1
    && slides.every(slide => slide.getAttribute('role') === 'group' && slide.getAttribute('aria-roledescription') === 'slide');
}));
check('manual carousel defaults to polite and paused', await page.evaluate(() => {
  const root = document.querySelector('#manual');
  return root.dataset.rotation === 'paused'
    && root.querySelector('.swiper')?.getAttribute('aria-live') === 'polite';
}));
check('next control changes only its own carousel', await page.evaluate(async () => {
  const manual = document.querySelector('#manual');
  const automatic = document.querySelector('#automatic');
  const before = automatic._sfCarousel.activeIndex;
  manual.querySelector('.sf-carousel-switch--right').click();
  await new Promise(resolve => setTimeout(resolve, 550));
  return manual._sfCarousel.activeIndex === 1 && automatic._sfCarousel.activeIndex === before;
}));
check('pagination controls are native buttons with names', await page.evaluate(() => {
  const bullets = [...document.querySelectorAll('#manual .sf-carousel-pagination-item')];
  return bullets.length === 3 && bullets.every(button => button.tagName === 'BUTTON' && button.getAttribute('aria-label'));
}));
check('autoplay requires a complete visible control', await page.evaluate(() => {
  return document.querySelector('#automatic')._sfCarouselAutoplayAllowed === true
    && document.querySelector('#fail-closed')._sfCarouselAutoplayAllowed === false
    && !document.querySelector('#fail-closed')._sfCarousel.autoplay?.running;
}));
check('focus stops rotation without moving focus', await page.evaluate(async () => {
  const root = document.querySelector('#automatic');
  window.SF.Carousel.play(root, 'test');
  root.querySelector('.sf-carousel-rotation').focus();
  await new Promise(resolve => setTimeout(resolve, 50));
  return !root._sfCarousel.autoplay.running
    && root.dataset.pauseReason === 'focus'
    && document.activeElement === root.querySelector('.sf-carousel-rotation');
}));
check('public API updates and reports state', await page.evaluate(async () => {
  const root = document.querySelector('#manual');
  window.SF.Carousel.goTo(root, 2);
  await new Promise(resolve => setTimeout(resolve, 550));
  return window.SF.Carousel.getState(root).index === 2;
}));
await page.locator('#add-carousel').click();
await page.waitForFunction(() => document.querySelector('#dynamic-carousel')?.dataset.sfCarouselBound === 'true');
check('late carousel initializes through Loader-compatible lifecycle', await page.locator('#dynamic-carousel [aria-roledescription="slide"]').count() === 2);
await page.emulateMedia({reducedMotion: 'reduce'});
await page.evaluate(() => {
  const dynamic = document.querySelector('#dynamic-carousel');
  window.SF.Carousel.unbind(dynamic);
  window.SF.Carousel.bind(dynamic);
});
check('reduced motion binds with zero transition speed', await page.evaluate(() => document.querySelector('#dynamic-carousel')._sfCarousel.params.speed === 0));
await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme keeps controls visible', await page.evaluate(() => {
  const button = document.querySelector('#manual .sf-carousel-switch');
  const style = getComputedStyle(button);
  return style.backgroundColor !== style.color && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
}));
await page.setViewportSize({width: 390, height: 844});
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));
return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
