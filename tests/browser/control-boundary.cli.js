// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr, the published Smart
// runtime in ../ui-smart and the local fixture server.
//
// The resting boundary of every input control holds WCAG 1.4.11's 3:1 against
// its surface in both themes, and is the --sf-outline role itself: the third
// neutral role that used to carry this value was removed on 2026-10-08, and
// its value moved into --sf-outline. Hovering a field or a choice makes the
// boundary stronger, never weaker. Colours are measured as rendered, the
// role's transparency composited over the panel.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/control-boundary-lab.html';
  const boxes = {
    input: '.sf-input-field', textarea: 'textarea', dropdown: '.sf-dropdown-field',
    'country-code': '.sf-country-code-field', checkbox: '.sf-checkbox-box', radio: '.sf-radio-button-box',
    switch: '.sf-switch-toggler', 'outline button': '.sf-button',
  };
  const hoverable = new Set(['input', 'textarea', 'dropdown', 'checkbox', 'radio', 'switch']);
  const failures = [];
  let measured = 0;
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const measure = (selector) => page.evaluate((selector) => {
    const parse = (c) => {
      const m = c.match(/[\d.]+/g).map(Number);
      if (c.startsWith('color(srgb')) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1];
      if (c.startsWith('rgb')) return [m[0], m[1], m[2], m[3] ?? 1];
      throw new Error(`unexpected colour ${c}: a transition still running?`);
    };
    const lum = (rgb) => rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const element = document.querySelector(selector);
    const panel = element.closest('.panel');
    const bg = parse(getComputedStyle(panel).backgroundColor);
    const line = parse(getComputedStyle(element).borderTopColor);
    const shown = [0, 1, 2].map((i) => line[i] * line[3] + bg[i] * (1 - line[3]));
    const probe = document.createElement('i');
    probe.style.color = 'var(--sf-outline)';
    panel.append(probe);
    const outline = ratio(parse(getComputedStyle(probe).color), bg);
    probe.remove();
    return { ratio: Math.round(ratio(shown, bg) * 100) / 100, outline: Math.round(outline * 100) / 100, width: parseFloat(getComputedStyle(element).borderTopWidth) };
  }, selector);
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const [lab, inner] of Object.entries(boxes)) {
      const selector = `[data-theme="${theme}"] [data-lab="${lab}"] ${inner}`;
      const fallback = `[data-theme="${theme}"] ${inner}[data-lab="${lab}"]`;
      const target = await page.$(selector) ? selector : fallback;
      if (!(await page.$(target))) { failures.push(`${theme} ${lab}: not rendered`); continue; }
      const rest = await measure(target);
      measured += 1;
      const where = `${theme} ${lab}`;
      if (!(rest.width > 0)) failures.push(`${where}: no boundary drawn`);
      if (rest.ratio < 3) failures.push(`${where}: resting boundary ${rest.ratio}:1, under 3:1`);
      if (Math.abs(rest.ratio - rest.outline) > 0.05) failures.push(`${where}: resting boundary ${rest.ratio}:1 is not the --sf-outline role ${rest.outline}:1`);
      if (hoverable.has(lab)) {
        await page.hover(target);
        // past the longest state transition (0.3s), which reports oklab midway
        await page.waitForTimeout(700);
        const hover = await measure(target);
        if (hover.ratio < rest.ratio) failures.push(`${where}: hover ${hover.ratio}:1 is weaker than rest ${rest.ratio}:1`);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(700);
      }
    }
  }
  return { measured, failures };
}
