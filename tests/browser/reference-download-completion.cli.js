/* global customElements, document, getComputedStyle, history, location, window */
async page => {
  const results = [];
  const failures = [];
  const errors = [];
  const requests = [];
  const check = (id, pass, detail = '') => {
    results.push({id, pass: Boolean(pass), detail});
    if (!pass) failures.push({id, detail});
  };

  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 1280, height: 900});
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce', colorScheme: 'light'});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/reference-download-method-lab.html');
  await page.waitForFunction(() => window.SF_PENDING_COMPONENTS?.some(([name]) => name === 'DownloadFile') && customElements.get('sf-reference-link') && customElements.get('sf-download-file'));

  const presentation = await page.evaluate(() => {
    const reference = document.getElementById('reference');
    const download = document.getElementById('download');
    const probe = document.createElement('span');
    probe.style.borderRadius = 'var(--sf-radius--ui)';
    document.body.append(probe);
    const result = {
      referenceDisplay: getComputedStyle(reference).display,
      referenceRadius: getComputedStyle(reference).borderRadius,
      downloadRadius: getComputedStyle(download).borderRadius,
      tokenRadius: getComputedStyle(probe).borderRadius,
      referenceSize: getComputedStyle(reference.querySelector('.sf-reference-link__link')).fontSize,
      downloadSize: getComputedStyle(download).fontSize,
      referenceWidth: reference.getBoundingClientRect().width,
      downloadWidth: download.getBoundingClientRect().width,
    };
    probe.remove();
    return result;
  });
  check('both surfaces own complete geometry', presentation.referenceDisplay === 'flex' && presentation.referenceWidth > 300 && presentation.downloadWidth > 300, presentation);
  check('surface radius uses the default surface token', presentation.referenceRadius === presentation.tokenRadius && presentation.downloadRadius === presentation.tokenRadius, presentation);
  check('default text uses normal body typography', presentation.referenceSize === '16px' && presentation.downloadSize === '16px', presentation);

  const reference = page.locator('#reference');
  const referenceLink = reference.getByRole('link', {name: /Очень подробное/});
  await page.evaluate(() => { history.replaceState(null, '', location.pathname); });
  await reference.click({position: {x: presentation.referenceWidth - 12, y: 12}});
  check('the complete reference surface activates its native destination', await page.evaluate(() => location.hash === '#destination'), await page.evaluate(() => location.hash));
  check('pointer activation leaves no keyboard ring', await reference.evaluate(node => getComputedStyle(node).outlineStyle === 'none'), await reference.evaluate(node => getComputedStyle(node).outline));
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  check('keyboard focus marks the complete reference surface', await referenceLink.evaluate(node => document.activeElement === node) && await reference.evaluate(node => getComputedStyle(node).outlineStyle !== 'none'));
  check('disabled reference has no focusable destination', await page.locator('#reference-disabled a,[id="reference-disabled"] button').count() === 0);

  const action = page.locator('#download-action');
  await action.evaluate(node => { node.__events = []; node.addEventListener('sf-download-file:click', event => node.__events.push(event.detail)); });
  await action.click();
  check('application-owned download action emits once', await action.evaluate(node => node.__events.length === 1 && node.__events[0].fileName === 'generated.pdf'), await action.evaluate(node => node.__events));
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  check('native download remains a real anchor', await page.locator('#download').evaluate(node => node.tagName === 'A' && node.hasAttribute('download')));

  const factory = await page.evaluate(() => {
    const DownloadFile = window.SF_PENDING_COMPONENTS.find(([name]) => name === 'DownloadFile')[1];
    const owner = new DownloadFile({
      id: 'factory-download',
      param: {fileName: 'Factory.pdf', fileSize: '4 МБ', href: '#factory', download: true},
    });
    document.querySelector('main').append(owner.render());
    const root = document.getElementById('factory-download');
    return {
      tag: root.tagName,
      body: Boolean(root.querySelector('.sf-download-file__body')),
      main: Boolean(root.querySelector('.sf-download-file__main')),
      iconHidden: root.querySelector('.sf-icon')?.getAttribute('aria-hidden'),
    };
  });
  check('ordinary factory matches canonical documented structure', factory.tag === 'A' && factory.body && factory.main && factory.iconHidden === 'true', factory);

  await page.evaluate(() => {
    const smartReference = document.createElement('sf-reference-link');
    smartReference.id = 'smart-reference';
    smartReference.setAttribute('label', 'Smart руководство');
    smartReference.setAttribute('text', '/smart/reference/');
    smartReference.setAttribute('href', '#smart-reference-target');
    const smartDownload = document.createElement('sf-download-file');
    smartDownload.id = 'smart-download';
    smartDownload.setAttribute('file-name', 'Smart.pdf');
    smartDownload.setAttribute('file-size', '3 МБ');
    smartDownload.setAttribute('href', '#smart-file');
    smartDownload.setAttribute('download', '');
    document.getElementById('smart').append(smartReference, smartDownload);
  });
  await page.waitForFunction(() => document.querySelector('#smart-reference .sf-reference-link__link') && document.querySelector('#smart-download .sf-download-file__body'));
  check('Smart owners preserve native link semantics', await page.locator('#smart-reference a[href="#smart-reference-target"]').count() === 1 && await page.locator('#smart-download a[download]').count() === 1);
  check('Smart owners emit canonical BEM elements', await page.locator('#smart-reference .sf-reference-link__main').count() === 1 && await page.locator('#smart-download .sf-download-file__main').count() === 1);

  const sizes = await page.evaluate(() => {
    const values = ['1/3', '1/2', '1', '2', '3'];
    return values.map(value => {
      const node = document.createElement('button');
      node.classList.add('sf-download-file', `sf-download-file--size-${value}`);
      node.innerHTML = '<span class="sf-download-file__body"><span class="sf-download-file__main"><span class="sf-download-file__name">File</span></span></span>';
      document.body.append(node);
      const result = parseFloat(getComputedStyle(node).fontSize);
      node.remove();
      return result;
    });
  });
  check('all five download sizes form a non-decreasing token scale', sizes.every((value, index) => index === 0 || value >= sizes[index - 1]) && new Set(sizes).size === 5, sizes);

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => { document.documentElement.className = 'theme-dark'; document.documentElement.dir = 'rtl'; });
  check('long localized content wraps without mobile overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('mobile reference stacks its metadata', await reference.evaluate(node => getComputedStyle(node).flexDirection === 'column'));
  await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
  await referenceLink.focus();
  check('forced colors keeps a visible reference focus boundary', await reference.evaluate(node => getComputedStyle(node).outlineStyle !== 'none'));
  check('all resources stay local', requests.every(url => url.startsWith('http://127.0.0.1:8768/')), requests.filter(url => !url.startsWith('http://127.0.0.1:8768/')));
  check('no runtime errors', errors.length === 0, errors);

  if (failures.length || errors.length) throw new Error(`Failed checks: ${failures.map(item => item.id).join(', ')}`);
  return {status: 'passed', checks: results.length, results, errors};
}
