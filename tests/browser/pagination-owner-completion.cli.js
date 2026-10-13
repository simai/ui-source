/* global document, getComputedStyle, innerWidth, requestAnimationFrame, window */
async page => {
  const failures = [], errors = [], cases = [];
  const check = (ok, name, actual, context = {}) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  page.on('pageerror', error => errors.push(error.message));

  const workspace = 'http://127.0.0.1:8765/ui-source';
  const candidate = `${workspace}/source/output/pagination-owner-browser`;
  const dependencyStyles = ['buttons', 'checkbox', 'dropdown', 'icon-buttons', 'icons', 'inputs'];
  const dependencyScripts = ['icons', 'buttons', 'checkbox', 'list-item', 'dropdown', 'pagination'];

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const forcedColors of ['none', 'active']) {
          const context = { width, theme, dir, forcedColors };
          await page.setViewportSize({ width, height: 1000 });
          await page.emulateMedia({ reducedMotion: 'reduce', forcedColors });
          await page.goto(`${workspace}/tests/fixtures/action-focus-lab.html`);
          for (const component of dependencyStyles) {
            await page.addStyleTag({ url: `${candidate}/component/${component}/css/${component}.css` });
          }
          await page.addStyleTag({ url: `${candidate}/component/pagination/css/pagination.css` });
          for (const component of dependencyScripts) {
            await page.addScriptTag({ url: `${candidate}/smart/${component}/js/${component}.js` });
          }

          await page.evaluate(({ theme, dir }) => {
            document.documentElement.className = `theme-${theme}`;
            document.documentElement.dir = dir;
            document.querySelector('main').innerHTML = `
              <a id="before-pagination" href="#after-pagination">До пагинации</a>
              <sf-pagination
                id="pager"
                aria-label="Страницы результатов поиска"
                current="5"
                total="240"
                page-size="10"
                selected-count="3"
                top="false"
                bottom="false"
              ></sf-pagination>
              <sf-pagination
                id="empty"
                aria-label="Пустые результаты"
                total="0"
                top="false"
                bottom="false"
                show-page-size="false"
              ></sf-pagination>
              <a id="after-pagination" href="#before-pagination">После пагинации</a>`;
            window.__paginationEvents = [];
            document.getElementById('pager').addEventListener('sf-page-change', event => {
              window.__paginationEvents.push(event.detail);
            });
          }, { theme, dir });

          await page.waitForFunction(() => document.querySelector('#pager nav') && document.querySelector('#empty nav'));
          await page.evaluate(async () => {
            await document.fonts.load('24px "Material Symbols Outlined"');
            document.querySelectorAll('.sf-icon').forEach(icon => icon.classList.add('sf-icon-loaded'));
          });
          const semantic = await page.locator('#pager').evaluate(host => {
            const nav = host.querySelector('nav');
            const current = nav.querySelectorAll('[aria-current="page"]');
            const ellipses = [...nav.querySelectorAll('.sf-page-number--ellipsis')];
            return {
              navName: nav.getAttribute('aria-label'),
              listTag: nav.querySelector('.sf-pagination-list')?.tagName,
              listItems: nav.querySelectorAll('.sf-pagination-list > li').length,
              currentCount: current.length,
              currentText: current[0]?.textContent.trim(),
              ellipsisCount: ellipses.length,
              ellipsisStatic: ellipses.every(item => item.tagName === 'SPAN' && !item.closest('button,a')),
              summary: nav.querySelector('.sf-pagination-marked')?.textContent.replace(/\s+/g, ' ').trim(),
              total: nav.querySelector('.sf-pagination-total')?.textContent.replace(/\s+/g, ' ').trim(),
              previousLabel: nav.querySelector('.sf-pagination-direction--prev')?.getAttribute('aria-label'),
              nextLabel: nav.querySelector('.sf-pagination-direction--next')?.getAttribute('aria-label'),
            };
          });
          check(semantic.navName === 'Страницы результатов поиска', 'Navigation has a source-driven accessible name', semantic, context);
          check(semantic.listTag === 'OL' && semantic.listItems > 4, 'Page controls form an ordered list', semantic, context);
          check(semantic.currentCount === 1 && semantic.currentText === '5', 'Exactly one page is current', semantic, context);
          check(semantic.ellipsisCount === 2 && semantic.ellipsisStatic, 'Omitted ranges are static indicators', semantic, context);
          check(semantic.summary === 'Отмечено: 3/240' && semantic.total === 'Всего: 240', 'Summary reflects source values without fake actions', semantic, context);
          check(semantic.previousLabel === 'Предыдущая страница' && semantic.nextLabel === 'Следующая страница', 'Directional actions have localized names', semantic, context);

          await page.locator('#pager button[data-page="6"]').click();
          await page.waitForFunction(() => document.querySelector('#pager')?.getAttribute('current') === '6');
          const changed = await page.evaluate(() => ({
            current: document.querySelector('#pager [aria-current="page"]')?.textContent.trim(),
            attr: document.getElementById('pager').getAttribute('current'),
            events: window.__paginationEvents,
          }));
          check(changed.current === '6' && changed.attr === '6', 'Page action updates the current source and rendered state', changed, context);
          check(changed.events.length === 1 && changed.events[0].previous === 5 && changed.events[0].current === 6, 'Page action emits one exact change event', changed, context);

          const resized = await page.locator('#pager').evaluate(async host => {
            const events = [];
            host.addEventListener('sf-page-size-change', event => events.push(event.detail));
            host.goToPage(24);
            host.setPageSize(40);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return {
              current: host.current,
              pageSize: host.pageSize,
              pageCount: host.pageCount,
              events,
            };
          });
          check(resized.current === 6 && resized.pageSize === 40 && resized.pageCount === 6, 'Page-size change clamps the current page', resized, context);
          check(resized.events.length === 1 && resized.events[0].previous === 10 && resized.events[0].pageSize === 40, 'Page-size change emits one exact event', resized, context);
          await page.locator('#pager').evaluate(host => host.setPageSize(10));

          const empty = await page.locator('#empty').evaluate(host => ({
            pageActions: host.querySelectorAll('button[data-page]').length,
            current: host.querySelectorAll('[aria-current="page"]').length,
            directions: host.querySelectorAll('.sf-pagination-direction').length,
          }));
          check(empty.pageActions === 0 && empty.current === 0 && empty.directions === 0, 'Empty collection exposes no fake page control', empty, context);

          await page.locator('#pager button[data-page="6"]').click();
          const mouseFocus = await page.locator('#pager button[data-page="6"]').evaluate(node => node.matches(':focus-visible'));
          check(!mouseFocus, 'Pointer focus does not show the keyboard indicator', mouseFocus, context);
          await page.locator('#before-pagination').focus();
          await page.keyboard.press('Tab');
          const keyboardFocus = await page.locator('#pager').evaluate(host => {
            const focused = host.ownerDocument.activeElement;
            const style = getComputedStyle(focused);
            return {
              visible: focused?.matches(':focus-visible'),
              page: focused?.dataset.page || null,
              shadow: style.boxShadow,
              outline: style.outlineStyle,
            };
          });
          check(keyboardFocus.visible, 'Tab produces a visible focus state', keyboardFocus, context);
          check(forcedColors === 'active' ? keyboardFocus.outline !== 'none' : keyboardFocus.shadow !== 'none', 'Focus remains visible in the active color mode', keyboardFocus, context);

          const geometry = await page.locator('#pager').evaluate((host, width) => {
            const nav = host.querySelector('nav');
            const list = host.querySelector('.sf-pagination-list');
            const ellipsisItem = host.querySelector('.sf-pagination-item--ellipsis');
            const prevIcon = host.querySelector('.sf-pagination-direction--prev .sf-icon') || host.querySelector('.sf-pagination-direction--prev sf-icon');
            const page = host.querySelector('.sf-page-number.selected');
            return {
              pageOverflow: document.documentElement.scrollWidth > innerWidth,
              navOverflow: nav.scrollWidth > nav.clientWidth + 1,
              listLines: Math.round(list.getBoundingClientRect().height / page.getBoundingClientRect().height),
              ellipsisDisplay: getComputedStyle(ellipsisItem).display,
              previousTransform: prevIcon ? getComputedStyle(prevIcon).transform : null,
              transitionDuration: getComputedStyle(page).transitionDuration,
              width,
            };
          }, width);
          check(!geometry.pageOverflow && !geometry.navOverflow && geometry.listLines === 1, 'Pagination remains one line without page overflow', geometry, context);
          check(width === 390 ? geometry.ellipsisDisplay === 'none' : geometry.ellipsisDisplay !== 'none', 'Responsive density follows the Framework breakpoint', geometry, context);
          check(dir === 'rtl' ? geometry.previousTransform !== 'none' : geometry.previousTransform === 'none', 'Only directional icons reverse in RTL', geometry, context);
          check(geometry.transitionDuration.split(',').every(value => value.trim() === '0s'), 'Reduced motion removes page transitions', geometry, context);

          cases.push(context);
          if (width === 390 && theme === 'dark' && dir === 'rtl' && forcedColors === 'none') {
            await page.screenshot({ path: 'output/playwright/pagination-owner-mobile-rtl.png', fullPage: true });
          }
          if (width === 390 && theme === 'light' && dir === 'ltr' && forcedColors === 'none') {
            await page.screenshot({ path: 'output/playwright/pagination-owner-mobile-ltr.png', fullPage: true });
          }
        }
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: cases.length,
    checks: cases.length * 19,
    failures,
    errors,
  };
}
