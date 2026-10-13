// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the generated component/Smart/Core lab assets and the local fixture server.
async (page) => {
  const results = [];
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/selection-controls-lab.html';
  const measure = async (input) => input.evaluate((e) => {
    const root = e.closest('label');
    const track = root.querySelector('.sf-toggle-container');
    const thumb = root.querySelector('.sf-toggle-inner') || root.querySelector('.sf-toggle-inner-wrap');
    const rect = track.getBoundingClientRect();
    const tc = getComputedStyle(track), ic = getComputedStyle(thumb);
    return {
      checked: e.checked, active: root.classList.contains('active'),
      focusVisible: e.matches(':focus-visible'),
      width: rect.width, height: rect.height,
      track: tc.backgroundColor, outline: tc.outlineColor, thumb: ic.backgroundColor,
      position: thumb.getBoundingClientRect().x - rect.x,
    };
  });
  for (const forcedColors of ['none', 'active']) {
    await page.emulateMedia({ forcedColors, reducedMotion: 'reduce' });
    for (const dark of [false, true]) {
      for (const rtl of [false, true]) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${base}?${dark ? 'dark&' : ''}${rtl ? 'rtl' : ''}`);
        const variants = [];
        for (const type of ['simple', 'icon', 'short']) {
          for (const size of ['1', '2']) {
            const input = page.getByRole('switch', { name: `${type} ${size}`, exact: true });
            const off = await measure(input);
            await input.click();
            await page.mouse.move(1, 1);
            await input.evaluate(async (e) => {
              await Promise.all(e.closest('label').getAnimations({subtree: true}).map(a => a.finished.catch(() => {})));
            });
            const on = await measure(input);
            if (off.checked || off.active || !on.checked || !on.active) throw new Error(`State mismatch: ${type}/${size}`);
            if (on.focusVisible) throw new Error(`Pointer focus ring: ${type}/${size}`);
            if (off.width !== on.width || off.height !== on.height) throw new Error(`Geometry changed: ${type}/${size}`);
            if (rtl ? on.position >= off.position : on.position <= off.position) throw new Error(`Thumb direction: ${type}/${size}`);
            if (on.thumb === on.track) throw new Error(`Invisible checked thumb: ${type}/${size}`);
            variants.push({type, size, off, on});
          }
        }
        const viewport = await page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth}));
        if (viewport.scroll > viewport.width) throw new Error('Horizontal overflow');
        results.push({forcedColors, dark, rtl, viewport, variants});
      }
    }
  }
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'no-preference'});
  await page.goto(`${base}?long`);
  const long = await page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth}));
  if (long.scroll > long.width) throw new Error('Long-label horizontal overflow');
  await page.locator('#toggle-matrix').scrollIntoViewIfNeeded();
  await page.screenshot({path: 'output/playwright/selection-light-mobile.png'});
  return {status: 'passed', scenarios: results.length, variants: results.length * 6, long, results};
}
