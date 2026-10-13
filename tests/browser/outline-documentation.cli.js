async page => {
  const results=[];
  const errors=[];
  const externalRequests=[];
  const check=(name,pass,detail='')=>results.push({name,pass:Boolean(pass),detail});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:8878/'))externalRequests.push(request.url());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:8878/ru/components/outline/');
  await page.waitForSelector('[data-docara-example-frame]');

  check('three reusable examples are rendered',await page.locator('[data-docara-example]').count()===3);
  check('anchor navigation examples resolve in isolated runtimes',await page.locator('[data-docara-example-preview-resolved="sandbox"]').count()===3);
  check('each example owns one iframe runtime',await page.locator('[data-docara-example-frame]').count()===3);
  const frames=page.locator('[data-docara-example-frame]');
  for(let index=0;index<3;index+=1) {
    await frames.nth(index).contentFrame().locator('.sf-outline').waitFor();
  }
  check('all examples use named native navigation',await Promise.all([0,1,2].map(async index=>frames.nth(index).contentFrame().locator('.sf-outline').evaluate(root=>root.tagName==='NAV'&&Boolean(root.getAttribute('aria-label'))))).then(values=>values.every(Boolean)));
  check('each example exposes exactly one current location',await Promise.all([0,1,2].map(async index=>frames.nth(index).contentFrame().locator('.sf-outline').evaluate(root=>root.querySelectorAll('[aria-current="location"]').length===1))).then(values=>values.every(Boolean)));
  check('hierarchy example contains a nested list',await frames.nth(1).contentFrame().locator('.sf-outline__list .sf-outline__list').count()===1);
  check('HTML tabs preserve Framework-only markup',await page.locator('[data-docara-example]').nth(2).evaluate(root=>{
    const source=root.textContent;
    return source.includes('sf-outline__link')&&!source.includes('<style')&&!source.includes('style=');
  }));

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  check('long labels remain inside their mobile runtime',await frames.nth(2).contentFrame().locator('.sf-outline').evaluate(root=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&root.scrollWidth<=root.clientWidth));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
