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
  await page.goto('http://127.0.0.1:8878/ru/components/placeholder/');
  const examples=page.locator('[data-docara-example]');
  await examples.first().waitFor();

  const rootFor=async index=>{
    const example=examples.nth(index);
    const mode=await example.getAttribute('data-docara-example-preview-resolved');
    if(mode==='inline') return example.locator('.sf-placeholder');
    const frame=example.locator('[data-docara-example-frame]');
    await frame.waitFor();
    return frame.contentFrame().locator('.sf-placeholder');
  };
  const roots=[];
  for(let index=0;index<3;index+=1) {
    const root=await rootFor(index);
    await root.waitFor();
    roots.push(root);
  }

  check('three reusable examples are rendered',await examples.count()===3);
  check('every example resolves through the auto preview policy',await examples.evaluateAll(nodes=>nodes.every(node=>['inline','sandbox'].includes(node.dataset.docaraExamplePreviewResolved))));
  check('all empty states use labelled semantic sections',await Promise.all(roots.map(root=>root.evaluate(node=>node.tagName==='SECTION'&&Boolean(node.getAttribute('aria-labelledby'))))).then(values=>values.every(Boolean)));
  check('canonical BEM anatomy is present in every example',await Promise.all(roots.map(root=>root.evaluate(node=>Boolean(node.querySelector('.sf-placeholder__content'))&&Boolean(node.querySelector('.sf-placeholder__header'))))).then(values=>values.every(Boolean)));
  check('visual examples hide decorative icons',await Promise.all(roots.slice(1).map(root=>root.locator('.sf-placeholder__visual').getAttribute('aria-hidden'))).then(values=>values.every(value=>value==='true')));
  check('actions use native Framework controls',await roots[1].evaluate(node=>Boolean(node.querySelector('.sf-button'))&&Boolean(node.querySelector('.sf-link'))));
  check('example source contains no private style blocks or inline styles',await examples.evaluateAll(nodes=>nodes.every(node=>!node.textContent.includes('<style')&&!node.textContent.includes('style='))));

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  check('examples remain bounded on mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
