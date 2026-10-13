/* global document, getComputedStyle, innerWidth, requestAnimationFrame */
async page => {
  const failures = [], errors = [], cases = [];
  const check = (ok, name, actual, context = {}) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  page.on('pageerror', error => errors.push(error.message));

  const workspace = 'http://127.0.0.1:8765/ui-source';
  const released = `${workspace}/source/output/action-focus-browser`;
  const candidate = `${workspace}/source/output/list-item-owner-browser`;
  const dependencyStyles = ['inputs', 'icon-buttons', 'icons', 'tags', 'checkbox', 'avatars', 'close', 'buttons'];

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const forcedColors of ['none', 'active']) {
        const context = { width, theme, dir, forcedColors };
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({ reducedMotion: 'reduce', forcedColors });
        await page.goto(`${workspace}/tests/fixtures/action-focus-lab.html`);
        for (const component of dependencyStyles) {
          await page.addStyleTag({ url: `${released}/component/${component}/css/${component}.css` });
        }
        await page.addStyleTag({ url: `${candidate}/component/dropdown/css/dropdown.css` });
        await page.addScriptTag({ url: `${candidate}/smart/list-item/js/list-item.js` });
        await page.addScriptTag({ url: `${candidate}/smart/dropdown/js/dropdown.js` });

        await page.evaluate(({ theme, dir }) => {
          document.documentElement.className = `theme-${theme}`;
          document.documentElement.dir = dir;
          document.querySelector('main').innerHTML = `
            <a id="before-list" href="#after-list">Перед коллекцией</a>
            <section id="standalone" class="grid gap-2" aria-label="Статические представления">
              <sf-list-item id="static-text" value="plain" size="1" text="Статическая строка"></sf-list-item>
              <sf-list-item value="icon" type="icon" size="1/2" icon="home" text="Строка с иконкой"></sf-list-item>
              <sf-list-item value="check" type="checkbox" size="1" text="Визуальная отметка" selected></sf-list-item>
              <sf-list-item value="avatar" type="avatar" size="2" text="Команда" avatar-title="Команда проекта"></sf-list-item>
              <sf-list-item value="color" type="color" size="3" text="Основной цвет" color-class="bg-primary"></sf-list-item>
            </section>
            <sf-dropdown id="owned" name="team" label="Команда" placeholder="Выберите команду" search="false">
              <sf-list-item value="plain" text="Обычный пункт"></sf-list-item>
              <sf-list-item value="icon" type="icon" icon="home" text="Домашняя команда"></sf-list-item>
              <sf-list-item value="check" type="checkbox" text="Команда с отметкой"></sf-list-item>
              <sf-list-item value="avatar" type="avatar" text="Команда проекта" avatar-title="Команда проекта"></sf-list-item>
              <sf-list-item value="color" type="color" text="Основной цвет" color-class="bg-primary" disabled></sf-list-item>
            </sf-dropdown>
            <sf-list-item id="long-item" size="1" text="ОченьДлинноеНазваниеПунктаБезПробеловКотороеДолжноПереноситьсяБезПереполнения"></sf-list-item>
            <a id="after-list" href="#before-list">После коллекции</a>`;
        }, { theme, dir });

        await page.waitForFunction(() => document.querySelectorAll('#standalone .sf-list-item').length === 5 && document.querySelectorAll('#owned .sf-list-item').length === 5);
        const standalone = page.locator('#standalone .sf-list-item');
        const options = page.locator('#owned .sf-list-item');

        check(await standalone.evaluateAll(nodes => nodes.every(node => !node.hasAttribute('role') && !node.hasAttribute('tabindex') && !node.classList.contains('cursor-pointer'))), 'Standalone rows expose no fake interaction', await standalone.evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);
        check(await standalone.locator('input').evaluateAll(nodes => nodes.every(node => node.tabIndex === -1 && node.closest('.sf-checkbox')?.getAttribute('aria-hidden') === 'true')), 'Standalone visual checks are not focus targets', await standalone.locator('input').evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);
        check(await options.evaluateAll(nodes => nodes.every(node => node.getAttribute('role') === 'option' && node.tabIndex === -1 && node.dataset.value)), 'Owned rows expose option semantics and machine values', await options.evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);
        check(await options.evaluateAll(nodes => nodes.every(node => ![...node.querySelectorAll('input,button,a[href],[tabindex]')].some(child => child.tabIndex >= 0))), 'Owned options have one composite focus owner', await options.evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);
        check(await options.locator('.sf-icon, .sf-avatar, .sf-tag-color-icon').evaluateAll(nodes => nodes.every(node => node.getAttribute('aria-hidden') === 'true')), 'Owned option decorations are hidden from accessibility tree', await options.locator('.sf-icon, .sf-avatar, .sf-tag-color-icon').evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);

        const staticBefore = await page.locator('#static-text').evaluate(node => getComputedStyle(node.querySelector('.sf-list-item')).backgroundColor);
        await page.locator('#static-text .sf-list-item').hover();
        const staticAfter = await page.locator('#static-text').evaluate(node => getComputedStyle(node.querySelector('.sf-list-item')).backgroundColor);
        await page.locator('#owned .sf-dropdown-field').click();
        await options.nth(0).hover();
        const optionHover = await options.nth(0).evaluate(node => getComputedStyle(node).backgroundColor);
        check(staticBefore === staticAfter, 'Standalone row has no misleading hover affordance', { staticBefore, staticAfter }, context);
        check(forcedColors === 'active' || optionHover !== staticAfter, 'Owned option has hover affordance', { optionHover, staticAfter }, context);

        await page.keyboard.press('Escape');
        await page.locator('#owned .sf-dropdown-field').focus();
        await page.keyboard.press('ArrowDown');
        const focusState = await options.nth(0).evaluate(node => {
          const style = getComputedStyle(node);
          return {
            active: node === document.activeElement,
            visible: node.matches(':focus-visible'),
            shadow: style.boxShadow,
            outline: style.outlineStyle,
          };
        });
        check(focusState.active && focusState.visible, 'Dropdown keyboard places visible focus on its option', focusState, context);
        check(forcedColors === 'active' ? focusState.outline !== 'none' : focusState.shadow !== 'none', 'Option focus remains visible in the active color mode', focusState, context);
        await page.keyboard.press('End');
        check(await options.nth(3).evaluate(node => node === document.activeElement), 'End skips the disabled final option', await page.evaluate(() => document.activeElement?.dataset.value), context);
        await page.keyboard.press('Home');
        await page.keyboard.press('Enter');
        check(await page.locator('#owned input[type="hidden"]').inputValue() === 'plain', 'Parent selection writes the machine value', await page.locator('#owned input[type="hidden"]').inputValue(), context);
        check(await options.nth(0).getAttribute('aria-selected') === 'true', 'Parent selection synchronizes aria-selected', await options.nth(0).getAttribute('aria-selected'), context);

        const update = await page.locator('#static-text').evaluate(async host => {
          host.setAttribute('text', 'Обновлённая строка');
          host.setAttribute('selected', '');
          host.setAttribute('disabled', '');
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const root = host.querySelector('.sf-list-item');
          return {
            text: root.querySelector('.sf-list-item-container')?.textContent,
            selected: root.classList.contains('selected'),
            disabled: root.classList.contains('disabled'),
            role: root.getAttribute('role'),
            tabIndex: root.getAttribute('tabindex'),
          };
        });
        check(JSON.stringify(update) === JSON.stringify({ text: 'Обновлённая строка', selected: true, disabled: true, role: null, tabIndex: null }), 'Live visual state stays static and source-driven', update, context);

        const geometry = await page.evaluate(() => {
          const longRoot = document.querySelector('#long-item .sf-list-item');
          const label = longRoot.querySelector('.sf-list-item-container');
          const selectedCheck = document.querySelector('#standalone sf-list-item[type="checkbox"] input');
          return {
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            labelOverflow: label.scrollWidth > label.clientWidth + 1,
            checkSelected: selectedCheck.checked,
            transitionDuration: getComputedStyle(longRoot).transitionDuration,
            borderWidth: getComputedStyle(longRoot).borderBottomWidth,
          };
        });
        check(!geometry.pageOverflow && !geometry.labelOverflow, 'Long labels wrap without page overflow', geometry, context);
        check(geometry.checkSelected, 'Selected visual checkbox reflects the selected state', geometry, context);
        check(geometry.transitionDuration.split(',').every(value => value.trim() === '0s'), 'Reduced motion removes row transitions', geometry, context);
        check(parseFloat(geometry.borderWidth) > 0, 'Row separator uses a rendered semantic hairline', geometry, context);

        cases.push(context);
        if (width === 390 && theme === 'dark' && dir === 'rtl' && forcedColors === 'none') {
          await page.screenshot({ path: 'output/playwright/list-item-owner-mobile-rtl.png', fullPage: true });
        }
        }
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: cases.length,
    checks: cases.length * 17,
    failures,
    errors,
  };
}
