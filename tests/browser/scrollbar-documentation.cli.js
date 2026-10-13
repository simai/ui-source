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
  await page.goto('http://127.0.0.1:8878/ru/components/scrollbar/');
  const examples=page.locator('[data-docara-example]');
  await examples.first().waitFor();

  const roots=[];
  for(let index=0;index<5;index+=1){
    const example=examples.nth(index);
    const mode=await example.getAttribute('data-docara-example-preview-resolved');
    const root=mode==='inline'
      ? example.locator('.sf-scrollbar')
      : example.locator('[data-docara-example-frame]').contentFrame().locator('.sf-scrollbar');
    await root.waitFor();
    roots.push(root);
  }

  check('five reusable variation examples are rendered',await examples.count()===5);
  check('safe HTML examples resolve through the automatic inline policy',await examples.evaluateAll(nodes=>nodes.every(node=>node.dataset.docaraExamplePreviewResolved==='inline')));
  check('overview uses the default overlay mode',await roots[0].evaluate(root=>!root.hasAttribute('data-mode')&&Boolean(root.querySelector('.sf-scrollbar__track'))));
  check('persistent mode keeps a managed track',await roots[1].evaluate(root=>root.dataset.mode==='persistent'&&getComputedStyle(root.querySelector('.sf-scrollbar__track')).opacity==='1'));
  check('standard and hidden examples keep native viewport ownership',await Promise.all(roots.slice(2,4).map(root=>root.evaluate(node=>!node.querySelector('.sf-scrollbar__track')))).then(values=>values.every(Boolean)));
  check('horizontal example uses the canonical axis and RTL direction',await roots[4].evaluate(root=>root.dataset.axis==='horizontal'&&root.dir==='rtl'&&root.dataset.sfScrollbarOverflow==='true'));
  check('every viewport provides a localized accessible name',await Promise.all(roots.map(root=>root.locator('.sf-scrollbar__viewport').getAttribute('aria-label'))).then(values=>values.every(Boolean)));
  check('example source uses only canonical public data settings',await examples.evaluateAll(nodes=>nodes.every(node=>!node.textContent.includes('data-sf-scrollbar=')&&!node.textContent.includes('data-sf-scrollbar-axis='))));

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  check('documentation remains bounded on mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
