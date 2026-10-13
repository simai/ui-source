async page => {
const pages = [
  {path: '/ru/components/tree/', expectedFrames: 3},
  {path: '/ru/components/tree-item/', expectedFrames: 1},
  {path: '/ru/smart-components/reference/tree/', expectedFrames: 2},
  {path: '/ru/smart-components/reference/tree-item/', expectedFrames: 1},
];
const results = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error') errors.push(event.text());
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

for (const entry of pages) {
  await page.goto(`http://127.0.0.1:8878${entry.path}`);
  await page.waitForFunction(expected => document.querySelectorAll('iframe').length === expected, entry.expectedFrames);
  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  await Promise.all(frames.map(frame => frame.waitForLoadState('domcontentloaded')));
  const data = await Promise.all(frames.map(frame => frame.evaluate(() => ({
    text: document.body.innerText.trim(),
    trees: document.querySelectorAll('[role="tree"]').length,
    items: document.querySelectorAll('[role="treeitem"]').length,
    groups: document.querySelectorAll('[role="group"]').length,
    upgraded: document.querySelectorAll('sf-tree > .sf-tree').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))));
  results.push({
    path: entry.path,
    frames: frames.length,
    expectedFrames: entry.expectedFrames,
    data,
    pass: frames.length === entry.expectedFrames
      && data.every(frame => frame.text && !frame.overflow)
      && data.every(frame => frame.trees >= 1 && frame.items >= 1),
  });
}

return {
  results,
  errors,
  failures: results.filter(result => !result.pass),
};
}
