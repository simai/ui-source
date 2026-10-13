async (page) => {
  const failures = [], results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({forcedColors: 'none'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    for (const kind of ['checkbox', 'radio', 'switch', 'toggle']) {
      await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/selection-controls-lab.html${theme === 'dark' ? '?dark' : ''}`);
      const selector = `#smart-choices sf-${kind}${kind === 'radio' ? ':last-of-type' : ''}`;
      const host = page.locator(selector);
      await host.locator('input').waitFor({state: 'attached'});
      await host.evaluate(async el => {
        const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const clone = document.createElement(el.localName);
        clone.setAttribute('label', 'Root customization');
        clone.setAttribute('root-class', 'max-w-sm');
        clone.setAttribute('root-style', 'padding-inline:var(--sf-space-1)');
        el.parentNode.append(clone); await wait();
        const root = clone.querySelector('label');
        el.__initialRoot = {class: root?.classList.contains('max-w-sm'), padding: root?.style.paddingInline};
        clone.remove();
        el.__input = el.querySelector('input');
        el.__root = el.querySelector('label');
        el.__default = el.__input.defaultChecked;
        el.__events = {input: 0, change: 0};
        for (const type of ['input', 'change']) el.addEventListener(type, () => el.__events[type]++);
      });
      // Use real pointer interaction, then keyboard navigation to establish focus.
      await host.locator('label').first().click();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const outcome = await host.evaluate(async el => {
        const records = [], failures = [];
        const check = (ok, name, actual) => { records.push(name); if (!ok) failures.push({name, actual}); };
        const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const input = el.querySelector('input'), root = el.querySelector('label');
        const checked = input.checked, value = input.value, name = input.name;
        const data = () => JSON.stringify([...new FormData(input.form)]);
        const initialData = data(), events = JSON.stringify(el.__events);
        check(document.activeElement === input, 'keyboard focus established', document.activeElement?.outerHTML);
        check(el.__initialRoot.class, 'root-class on first render', el.__initialRoot);
        check(el.__initialRoot.padding === 'var(--sf-space-1)', 'root-style on first render', el.__initialRoot);
        el.setAttribute('root-class', 'max-w-sm');
        el.setAttribute('style', 'padding-inline:var(--sf-space-1)'); await wait();
        check(root.classList.contains('max-w-sm'), 'live root-class', root.className);
        check(root.style.paddingInline === 'var(--sf-space-1)' && parseFloat(getComputedStyle(root).paddingInlineStart) > 0, 'style reaches visible root', root.style.cssText);
        el.style.setProperty('margin-inline-start', 'var(--sf-space-1)'); await wait();
        check(root.style.marginInlineStart === 'var(--sf-space-1)' && root.style.paddingInline === 'var(--sf-space-1)', 'CSSOM preserves both declarations', root.style.cssText);
        el.setAttribute('root-style', 'padding-inline:var(--sf-space-2)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'root-style overrides author declaration', root.style.cssText);
        el.removeAttribute('root-style'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-1)', 'remove root-style restores author declaration', root.style.cssText);
        el.setAttribute('root-class', 'max-w-md'); await wait();
        check(root.classList.contains('max-w-md') && !root.classList.contains('max-w-sm'), 'root-class replaces old class', root.className);
        el.removeAttribute('root-class'); el.removeAttribute('style'); await wait();
        check(!root.classList.contains('max-w-md') && !root.style.paddingInline && !root.style.marginInlineStart, 'remove customization restores root', root.outerHTML);
        check(root === el.querySelector('label') && input === el.querySelector('input'), 'node identities preserved', null);
        check(input.checked === checked && input.value === value && input.name === name && input.defaultChecked === el.__default, 'selection and reset default preserved', {checked: input.checked, value: input.value, default: input.defaultChecked});
        check(initialData === data(), 'form data preserved', data());
        check(events === JSON.stringify(el.__events), 'customization emits no input/change', el.__events);
        check(document.activeElement === input, 'keyboard focus survives render', document.activeElement?.outerHTML);
        check(getComputedStyle(el).display === 'contents', 'host remains boxless', getComputedStyle(el).display);
        check(!el._updateLoopBlocked, 'no update loop', el._updateLoopCount);
        input.form.reset(); await wait();
        check(input.checked === el.__default, 'native form reset restores initial selection', input.checked);
        check(events === JSON.stringify(el.__events), 'reset stays silent', el.__events);
        return {checks: records.length, failures};
      });
      results.push({kind, width, theme, checks: outcome.checks});
      failures.push(...outcome.failures.map(f => ({kind, width, theme, ...f})));
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', results, failures, errors};
}
