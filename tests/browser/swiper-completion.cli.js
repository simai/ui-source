async page => {
  const results = [];
  const errors = [];
  const externalRequests = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8766/')) externalRequests.push(request.url());
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.setViewportSize({width: 1024, height: 900});
  await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/swiper-method-lab.html');
  await page.waitForTimeout(200);

  check('descendant class does not load the Swiper root dependency', await page.evaluate(() => typeof window.Swiper === 'undefined'));
  await page.locator('#mount').click();
  await page.waitForFunction(() => window.__swiperInstances?.basic?.initialized === true);

  check('late canonical roots load one package-owned runtime', await page.evaluate(() => typeof window.Swiper === 'function' && Object.values(window.__swiperInstances).every(instance => instance.constructor === window.Swiper)));
  check('all named roots initialize independently', await page.evaluate(() => ['basic', 'responsive', 'lifecycle'].every(id => document.getElementById(id)?.classList.contains('swiper-initialized'))));
  check('A11y module provides a hidden live notification', await page.locator('#basic').evaluate(root => {
    const node = root.querySelector('.swiper-notification');
    return node && getComputedStyle(node).opacity === '0' && getComputedStyle(node).pointerEvents === 'none';
  }));
  check('direct pagination creates named native buttons', await page.locator('#basic').evaluate(root => {
    const bullets = [...root.querySelectorAll('.swiper-pagination-bullet')];
    return bullets.length === 3 && bullets.every(node => node.tagName === 'BUTTON' && node.getAttribute('aria-label'));
  }));
  check('pagination uses the Framework semantic primary role', await page.locator('#basic .swiper-pagination-bullet-active').evaluate(node => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--sf-primary)';
    node.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(node).backgroundColor === expected;
  }));

  const basicBox = await page.locator('#basic').boundingBox();
  await page.mouse.move(basicBox.x + basicBox.width * 0.8, basicBox.y + basicBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(basicBox.x + basicBox.width * 0.2, basicBox.y + basicBox.height * 0.5, {steps: 8});
  await page.mouse.up();
  await page.waitForTimeout(350);
  check('pointer drag changes the visible slide', await page.evaluate(() => window.__swiperInstances.basic.activeIndex > 0));
  await page.evaluate(() => window.__swiperInstances.basic.slideTo(0, 0));

  const beforeKeyboard = await page.evaluate(() => window.__swiperInstances.basic.activeIndex);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  check('opt-in keyboard control changes the visible slide', await page.evaluate(before => window.__swiperInstances.basic.activeIndex > before, beforeKeyboard));

  await page.locator('#add-slide').click();
  check('owner update synchronizes appended content and pagination', await page.evaluate(() => {
    const root = document.getElementById('lifecycle');
    return window.__swiperInstances.lifecycle.slides.length === 3 && root.querySelectorAll('.swiper-pagination-bullet').length === 3;
  }));
  await page.locator('#remove-slide').click();
  check('owner update synchronizes removed content', await page.evaluate(() => window.__swiperInstances.lifecycle.slides.length === 2));

  check('desktop breakpoint shows three responsive slides', await page.evaluate(() => window.__swiperInstances.responsive.params.slidesPerView === 3));
  check('RTL direction preserves the bounded layout', await page.evaluate(() => {
    const root = document.getElementById('responsive');
    root.dir = 'rtl';
    window.__swiperInstances.responsive.changeLanguageDirection('rtl');
    const bounded = root.scrollWidth <= Math.ceil(root.clientWidth);
    const rtl = window.__swiperInstances.responsive.rtlTranslate === true;
    root.dir = 'ltr';
    window.__swiperInstances.responsive.changeLanguageDirection('ltr');
    return rtl && bounded;
  }));
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(100);
  check('mobile breakpoint shows one slide without page overflow', await page.evaluate(() => window.__swiperInstances.responsive.params.slidesPerView === 1 && document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  await page.evaluate(() => document.documentElement.className = 'theme-dark');
  check('dark theme changes direct pagination through semantic tokens', await page.locator('#basic .swiper-pagination-bullet-active').evaluate(node => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--sf-primary)';
    node.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(node).backgroundColor === expected;
  }));
  await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
  check('forced colors preserves pagination indicators', await page.locator('#basic .swiper-pagination-bullet-active').evaluate(node => {
    const style = getComputedStyle(node);
    return style.forcedColorAdjust === 'none' && style.width !== '0px' && style.height !== '0px';
  }));
  check('explicit reduced-motion initialization uses zero speed', await page.evaluate(() => {
    const root = document.getElementById('lifecycle');
    window.__swiperInstances.lifecycle.destroy(true, true);
    window.__swiperInstances.lifecycle = new window.Swiper(root, {a11y: {enabled: true}, speed: 0});
    return window.__swiperInstances.lifecycle.params.speed === 0;
  }));
  check('destroy and reinitialize lifecycle remains available', await page.evaluate(() => window.__swiperInstances.lifecycle.initialized === true));
  check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
  check('no runtime errors', errors.length === 0, errors.join('\n'));
  return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
