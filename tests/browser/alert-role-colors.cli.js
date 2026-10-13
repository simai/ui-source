async page => {
  const failures = [], results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none'});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
  await page.addStyleTag({url: `${base}/component/alerts/css/alerts.css`});
  for (const name of ['icons', 'alert']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
  for (const theme of ['light', 'dark']) for (const variant of ['default', 'outlined', 'flat']) for (const [type, role] of [['clear', 'on-surface-variant'], ['info', 'info'], ['danger', 'error'], ['warning', 'warning'], ['success', 'success']]) {
    const result = await page.evaluate(async ({theme, variant, type, role}) => {
      document.documentElement.className = `theme-${theme}`;
      const main = document.querySelector('main'); main.replaceChildren();
      const base = document.createElement('div'); base.className = `sf-alert sf-alert--${type} sf-alert--${variant}`;
      const icon = document.createElement('i'); icon.className = 'sf-icon'; icon.textContent = 'info'; base.append(icon);
      const smart = document.createElement('sf-alert'); smart.setAttribute('type', type); smart.setAttribute('variant', variant); smart.setAttribute('title', type);
      main.append(base, smart);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const probe = document.createElement('span'); probe.style.color = `var(--sf-${role})`; base.append(probe);
      return {base: getComputedStyle(icon).color, smart: getComputedStyle(smart.querySelector('.sf-icon')).color, expected: getComputedStyle(probe).color};
    }, {theme, variant, type, role});
    if (result.base !== result.expected || result.smart !== result.expected || result.expected === 'rgba(0, 0, 0, 0)') failures.push({theme, variant, type, result});
    results.push({theme, variant, type, ...result});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors};
}
