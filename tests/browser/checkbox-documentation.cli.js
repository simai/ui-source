// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.route('**/MaterialSymbolsOutlined.woff2', async route => {
    const response = await route.fetch();
    await route.fulfill({response, headers: {...response.headers(), 'access-control-allow-origin': '*'}});
  });

  const [cssResponse, jsResponse] = await Promise.all([
    page.request.get('http://127.0.0.1:8888/_docara/candidate/checkbox.css'),
    page.request.get('http://127.0.0.1:8888/_docara/candidate/checkbox.js'),
  ]);
  if (!cssResponse.ok() || !jsResponse.ok()) throw new Error('Checkbox candidate assets unavailable');
  const candidateCss = await cssResponse.text();
  const candidateJs = await jsResponse.text();
  await page.route('**/docara-shell*.css', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: `${await response.text()}\n${candidateCss}`, contentType: 'text/css'});
  });
  await page.route(/\/component\/checkbox\/css\/checkbox(?:\.min)?\.css(?:\?.*)?$/, route => route.fulfill({status: 200, body: candidateCss, contentType: 'text/css'}));
  await page.route(/\/component\/checkbox\/js\/checkbox(?:\.min)?\.js(?:\?.*)?$/, route => route.fulfill({status: 200, body: candidateJs, contentType: 'text/javascript'}));

  const open = async (width, height) => {
    await page.setViewportSize({width, height});
    await page.goto('http://127.0.0.1:8888/ru/components/checkbox/', {waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.querySelectorAll('[data-docara-example-frame]').length === 5);
    await page.waitForFunction(() => window.frames.length === 5);
    await page.waitForTimeout(700);
  };
  await open(1440, 900);

  const frameByBase = async suffix => {
    for (const frame of page.frames().filter(frame => frame !== page.mainFrame())) {
      if ((await frame.evaluate(() => document.baseURI)).includes(suffix)) return frame;
    }
    return null;
  };
  const overview = await frameByBase('/components/checkbox/overview/');
  const group = await frameByBase('/components/checkbox/group/');
  const states = await frameByBase('/components/checkbox/states/');
  const sizes = await frameByBase('/components/checkbox/sizes/');
  const position = await frameByBase('/components/checkbox/position/');

  check('page publishes five focused runnable examples', Boolean(overview && group && states && sizes && position));
  check('overview preserves one named native choice', await overview.evaluate(() => {
    const input = document.querySelector('input[type="checkbox"]');
    return document.querySelectorAll('input[type="checkbox"]').length === 1 && input.name === 'updates';
  }));
  check('group uses fieldset legend and independent values', await group.evaluate(() => {
    const fieldset = document.querySelector('fieldset');
    const inputs = [...fieldset.querySelectorAll('input[type="checkbox"]')];
    return fieldset.querySelector('legend')?.textContent.trim() && inputs.length === 3 && new Set(inputs.map(input => input.value)).size === 3;
  }));
  check('states render checked mixed invalid and disabled semantics', await states.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="checkbox"]')];
    const mixed = inputs.find(input => input.name === 'mixed');
    const invalid = inputs.find(input => input.getAttribute('aria-invalid') === 'true');
    return inputs.length === 5 && inputs.some(input => input.checked) && mixed?.indeterminate && invalid && inputs.some(input => input.disabled);
  }));
  check('normal and compact examples have ordered square indicators', await sizes.evaluate(() => {
    const boxes = [...document.querySelectorAll('.sf-checkbox-box')].map(box => box.getBoundingClientRect());
    return boxes.length === 2 && boxes.every(box => box.width === box.height) && boxes[0].width > boxes[1].width;
  }));
  check('placement example demonstrates logical start and end', await position.evaluate(() => {
    const roots = [...document.querySelectorAll('.sf-checkbox')];
    if (roots.length !== 2) return false;
    const coordinates = roots.map(root => ({box: root.querySelector('.sf-checkbox-box').getBoundingClientRect().left, text: root.querySelector('.sf-checkbox-container').getBoundingClientRect().left}));
    return coordinates[0].box < coordinates[0].text && coordinates[1].box > coordinates[1].text;
  }));
  const desktopOuter = await page.locator('[data-docara-example-frame]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const desktopContent = await Promise.all(page.frames().filter(frame => frame !== page.mainFrame()).map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('desktop examples own intrinsic height', desktopOuter.every((height, index) => height >= desktopContent[index] && height - desktopContent[index] <= 2));

  await open(390, 844);
  const mobileOuter = await page.locator('[data-docara-example-frame]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const mobileContent = await Promise.all(page.frames().filter(frame => frame !== page.mainFrame()).map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('mobile examples own intrinsic height without nested scroll', mobileOuter.every((height, index) => height >= mobileContent[index] && height - mobileContent[index] <= 2));
  check('mobile page has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}; errors=${JSON.stringify(errors)}`);
  }
  return {results, errors};
}
