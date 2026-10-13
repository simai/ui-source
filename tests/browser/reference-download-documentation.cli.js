/* global document, getComputedStyle, window */
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

  await page.goto('http://127.0.0.1:8892/ru/components/reference-link/');
  await page.waitForFunction(() => document.querySelectorAll('iframe').length === 2 && [...document.querySelectorAll('iframe')].every(frame => parseFloat(frame.style.blockSize) > 0));
  await page.waitForTimeout(750);
  let frames = page.frames().filter(frame => frame !== page.mainFrame());
  check('Reference Link renders two executable examples', frames.length === 2, frames.length);
  const referenceStates = await Promise.all(frames.map(frame => frame.evaluate(() => {
    const root = document.querySelector('.sf-reference-link');
    return {
      root: Boolean(root),
      display: root ? getComputedStyle(root).display : '',
      iconsHidden: [...document.querySelectorAll('.sf-icon')].every(icon => icon.getAttribute('aria-hidden') === 'true'),
      disabledLinks: document.querySelectorAll('.sf-reference-link.disabled a').length,
      scroll: document.documentElement.scrollHeight <= window.innerHeight + 2,
    };
  })));
  check('Reference examples remain styled by the pinned compatible runtime', referenceStates.every(state => state.root && state.display === 'flex'), referenceStates);
  check('Reference examples use decorative icons and no disabled destination', referenceStates.every(state => state.iconsHidden && state.disabledLinks === 0), referenceStates);
  check('Reference frames fit their dynamic content height', referenceStates.every(state => state.scroll), referenceStates);

  await page.goto('http://127.0.0.1:8892/ru/components/download-file/');
  await page.waitForFunction(() => document.querySelectorAll('iframe').length === 3 && [...document.querySelectorAll('iframe')].every(frame => parseFloat(frame.style.blockSize) > 0));
  await page.waitForTimeout(750);
  frames = page.frames().filter(frame => frame !== page.mainFrame());
  check('Download File isolates three interactive examples', frames.length === 3, frames.length);
  check('safe disabled example renders inline without an iframe', await page.locator('.sf-download-file:disabled').count() === 1);
  const downloadStates = await Promise.all(frames.map(frame => frame.evaluate(() => ({
    roots: document.querySelectorAll('.sf-download-file').length,
    canonicalBodies: document.querySelectorAll('.sf-download-file__body').length,
    compatibleBodies: document.querySelectorAll('.sf-download-file-wrap').length,
    iconsHidden: [...document.querySelectorAll('.sf-icon')].every(icon => icon.getAttribute('aria-hidden') === 'true'),
    disabledHref: document.querySelectorAll('.sf-download-file.disabled[href], .sf-download-file:disabled[href]').length,
    scroll: document.documentElement.scrollHeight <= window.innerHeight + 2,
  }))));
  check('Download examples carry canonical and compatibility structure together', downloadStates.every(state => state.roots > 0 && state.canonicalBodies === state.roots && state.compatibleBodies === state.roots), downloadStates);
  check('Download examples use decorative icons and no disabled href', downloadStates.every(state => state.iconsHidden && state.disabledHref === 0), downloadStates);
  check('Download frames fit their dynamic content height', downloadStates.every(state => state.scroll), downloadStates);

  let interactiveFrame = null;
  for (const frame of frames) {
    if (await frame.locator('#download-file-result').count()) {
      interactiveFrame = frame;
      break;
    }
  }
  if (interactiveFrame) {
    await interactiveFrame.locator('.sf-download-file').click();
    check('application action example executes its embedded behavior', await interactiveFrame.locator('#download-file-result').textContent() === 'Приложение готовит Отчёт.pdf.');
  } else {
    check('application action example executes its embedded behavior', false, 'action frame not found');
  }

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => { document.documentElement.className = 'theme-dark'; });
  check('documentation page has no mobile horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('documentation resources stay local', requests.every(url => url.startsWith('http://127.0.0.1:8892/')), requests.filter(url => !url.startsWith('http://127.0.0.1:8892/')));
  check('documentation pages have no runtime errors', errors.length === 0, errors);

  if (failures.length || errors.length) throw new Error(`Failed checks: ${failures.map(item => item.id).join(', ')}`);
  return {status: 'passed', checks: results.length, results, errors};
}
