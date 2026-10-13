async page => {
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error' && !event.text().includes('Access to font')) errors.push(event.text());
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
await page.goto('http://127.0.0.1:8878/ru/components/carousel/');
await page.waitForFunction(() => document.querySelectorAll('iframe').length === 3);
const handles = await page.locator('iframe').elementHandles();
const frames = (await Promise.all(handles.map(handle => handle.contentFrame()))).filter(Boolean);
await Promise.all(frames.map(frame => frame.waitForLoadState('domcontentloaded')));
await page.waitForTimeout(6000);
const data = await Promise.all(frames.map(frame => frame.evaluate(() => ({
  roots: document.querySelectorAll('.sf-carousel').length,
  sliders: document.querySelectorAll('.sf-carousel-slider.swiper').length,
  slides: document.querySelectorAll('.sf-carousel-slide').length,
  controls: document.querySelectorAll('button.sf-carousel-switch, button.sf-carousel-rotation').length,
  bound: document.querySelectorAll('[data-sf-carousel-bound="true"]').length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))));
const pass = frames.length === 3
  && data.every(frame => frame.roots === 1 && frame.sliders === 1 && frame.slides >= 2 && frame.controls >= 2 && !frame.overflow)
  && errors.length === 0;
return {pass, frames: frames.length, data, runtimeProjected: data.every(frame => frame.bound === 1), errors};
}
