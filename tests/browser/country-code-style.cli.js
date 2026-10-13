async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const theme of ['light', 'dark']) for (const mask of [false, true]) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url: `${base}/component/country-code/css/country-code.css`});
    await page.addScriptTag({url: 'http://127.0.0.1:8765/ui-source/node_modules/imask/dist/imask.min.js'});
    await page.evaluate(({theme}) => {
      document.documentElement.className = `theme-${theme}`;
      window.SF = {Mask: {create: async (e, options) => IMask(e, options), destroy: instance => instance?.destroy()}};
    }, {theme});
    await page.addScriptTag({url: `${base}/smart/country-code/js/country-code.js`});
    await page.evaluate(({mask}) => {
      const main = document.querySelector('main'); main.replaceChildren();
      const host = document.createElement('sf-country-code'); host.id = 'country';
      host.setAttribute('iso2', 'RU'); host.setAttribute('label', 'Телефон');
      host.setAttribute('value', '+7 9991234567'); host.setAttribute('use-mask', String(mask));
      host.countries = [{iso2:'RU',dialCode:'+7',label:'Россия',maskPattern:'+7 000 000-00-00'}, {iso2:'DE',dialCode:'+49',label:'Германия',maskPattern:'+49 0000 0000000'}];
      main.append(host);
    }, {mask});
    await page.waitForFunction(mask => {
      const r = document.querySelector('#country .sf-country-code');
      return r?.dataset.sfCountryCodeBound === '1' && (!mask || !!r.__sfCountryMask);
    }, mask);
    await page.locator('.sf-country-code-left').click();
    await page.locator('.sf-country-code-item[data-iso2="DE"]').click();
    const pointerFocus = await page.locator('#country input').evaluate(input => document.activeElement === input);
    await page.locator('#country input').fill('+49 1511234567');
    await page.locator('.sf-country-code-left').click();
    const before = await page.locator('#country').evaluate(e => ({...e.state}));
    if (!pointerFocus || !before.value.replace(/\D/g, '').startsWith('4915')) failures.push({theme,mask,pointerFocus,value:before.value,reason:'pointer selection must continue phone entry without a duplicated country prefix'});
    const after = await page.locator('#country').evaluate(async host => {
      const input = host.querySelector('input'); input.focus(); input.setSelectionRange(input.value.length, input.value.length);
      const oldInput = input, position = input.selectionStart;
      const updated = new Promise(resolve => host.addEventListener('sf-after-render', resolve, {once: true}));
      host.style.padding = 'var(--sf-space-2)'; host.setAttribute('root-class', 'bg-surface-container');
      await updated;
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      const root = host.querySelector('.sf-country-code');
      return {...host.state, padding: getComputedStyle(root).paddingTop, rootClass: root.classList.contains('bg-surface-container'), sameInput: oldInput === root.querySelector('input'), focused: document.activeElement === input, position, nextPosition: input.selectionStart, maskValue: root.__sfCountryMask?.value};
    });
    const row = {theme, mask, before, after}; results.push(row);
    if (after.padding === '0px' || !after.rootClass || !after.sameInput || !after.focused || after.position !== after.nextPosition || before.value !== after.value || before.iso2 !== after.iso2 || before.open !== after.open || (mask && after.maskValue !== after.value)) failures.push(row);
    const extra = await page.locator('#country').evaluate(async host => {
      const update = async action => {const done = new Promise(r => host.addEventListener('sf-after-render', r, {once: true})); action(); await done;};
      const root = host.querySelector('.sf-country-code'), input = root.querySelector('input');
      const value = input.value, iso2 = root.dataset.iso2, maskBeforeCallback = root.__sfCountryMask;
      let calls = 0; await host.afterRender(() => {calls++;});
      const callbackStable = calls === 1 && root.__sfCountryMask === maskBeforeCallback;
      await update(() => host.setAttribute('root-style', 'padding:var(--sf-space-3)'));
      const rootStyle = getComputedStyle(root).paddingTop;
      const probe = document.createElement('span'); probe.style.padding = 'var(--sf-space-3)'; root.append(probe);
      const expected = getComputedStyle(probe).paddingTop; probe.remove();
      await update(() => host.setAttribute('open', 'false'));
      const closed = !host.state.open;
      host.setState({disabled: true});
      await update(() => host.setAttribute('hint', 'Новая подсказка'));
      const disabledKept = host.state.disabled && input.disabled;
      await update(() => host.setAttribute('disabled', 'false'));
      return {callbackStable, rootStyle, expected, closed, disabledKept, enabled: !host.state.disabled && !input.disabled,
        valueKept: input.value === value, countryKept: root.dataset.iso2 === iso2};
    });
    if (!extra.callbackStable || extra.rootStyle !== extra.expected || !extra.closed || !extra.disabledKept || !extra.enabled || !extra.valueKept || !extra.countryKept) failures.push({theme, mask, extra});
    results[results.length - 1].extra = extra;
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
