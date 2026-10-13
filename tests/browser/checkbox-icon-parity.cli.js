async page => {
  const failures = [], results = [];
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/selection-controls-lab.html');
  await page.waitForFunction(() => document.querySelector('sf-checkbox input'));
  for (const forcedColors of ['none', 'active']) for (const theme of ['light', 'dark']) {
    await page.emulateMedia({forcedColors, reducedMotion: 'reduce'});
    await page.evaluate(theme => document.documentElement.className = `theme-${theme}`, theme);
    for (const size of ['1', '1/3']) for (const state of ['unchecked', 'checked', 'mixed']) for (const disabled of [false, true]) for (const error of [false, true]) {
      const result = await page.evaluate(async ({size, state, disabled, error, forcedColors}) => {
        const base = document.querySelector('#checkbox .sf-checkbox'), smart = document.querySelector('#smart-choices sf-checkbox');
        base.className = `sf-checkbox sf-checkbox--size-${size} flex${error ? ' error' : ''}`;
        smart.setAttribute('size', size); smart.toggleAttribute('error', error);
        const checked = state === 'checked', indeterminate = state === 'mixed';
        window.SF.Checkbox.setState(base.querySelector('input'), {checked, indeterminate, disabled});
        smart.setState({checked, indeterminate, disabled});
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const faces = await document.fonts.load('24px "Material Symbols Outlined"', 'check');
        if (!faces.length) throw new Error('Local fixture font missing');
        for (const root of [base, smart]) root.querySelectorAll('.sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        const read = root => {
          const icon = root.querySelector('.sf-checkbox-box .sf-icon'), box = root.querySelector('.sf-checkbox-box');
          const c = getComputedStyle(icon), b = getComputedStyle(box);
          const probe = document.createElement('span'); probe.style.color = 'var(--sf-on-primary)'; box.append(probe);
          const onPrimary = getComputedStyle(probe).color; probe.remove();
          return {color: c.color, width: c.width, height: c.height, font: c.fontSize, text: icon.textContent.trim(), background: b.backgroundColor, onPrimary};
        };
        return {base: read(base), smart: read(smart)};
      }, {size, state, disabled, error, forcedColors});
      const identity = {forcedColors, theme, size, state, disabled, error};
      if (JSON.stringify(result.base) !== JSON.stringify(result.smart)) failures.push({...identity, issue: 'base/Smart indicator parity', ...result});
      if (forcedColors === 'none' && !error && !disabled && state !== 'unchecked' && result.base.color !== result.base.onPrimary) failures.push({...identity, issue: 'selected indicator uses on-primary role', ...result});
      results.push(identity);
    }
  }
  return {status: failures.length ? 'failed' : 'passed', cases: results.length, failures};
}
