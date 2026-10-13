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
  await page.goto('http://127.0.0.1:8878/ru/components/skeleton/');
  const examples=page.locator('[data-docara-example]');
  await examples.first().waitFor();

  const roots=[];
  for(let index=0;index<4;index+=1){
    const example=examples.nth(index);
    const frame=example.locator('[data-docara-example-frame]');
    roots.push(await frame.count()===0?example:frame.contentFrame().locator('body'));
  }

  check('four reusable variation examples are rendered',await examples.count()===4);
  check('automatic preview keeps every example in a supported rendering boundary',await examples.evaluateAll(nodes=>{
    const modes=nodes.map(node=>node.dataset.docaraExamplePreviewResolved);
    if(modes.every(mode=>mode===undefined))return nodes.every(node=>node.querySelector('[data-docara-example-frame]'));
    return modes[0]==='sandbox'&&modes.slice(1).every(mode=>mode==='inline');
  }));
  check('base example assigns busy state to the future content region',await roots[0].locator('[aria-busy="true"]').count()===1);
  check('base shapes are hidden as one decorative group',await roots[0].locator('[aria-hidden="true"] .sf-skeleton').count()===2);
  check('shape example covers circle, square, text and rounded surface',await roots[1].evaluate(root=>['sf-skeleton-circle','sf-skeleton-square','sf-skeleton-rounded'].every(name=>root.querySelector(`.${name}`))&&root.querySelectorAll('.sf-skeleton-text').length===4));
  check('size example covers the complete documented scale',await roots[2].locator('.sf-skeleton-text').count()===13);
  check('size scale grows monotonically',await roots[2].locator('.sf-skeleton-text').evaluateAll(nodes=>{
    const sizes=nodes.map(node=>node.getBoundingClientRect().height);
    return sizes.every((size,index)=>index===0||size>=sizes[index-1]);
  }));
  check('motion example covers pulse, wave and none',await roots[3].evaluate(root=>['pulse','wave','none'].every(value=>root.querySelector(`.sf-skeleton--animation-${value}`))));
  check('example source contains no constructor shortcode or literal dimensions',await examples.evaluateAll(nodes=>nodes.every(node=>!node.textContent.includes('[!Skeleton]')&&!/\d+(?:px|rem)/.test(node.textContent))));
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  check('documentation remains bounded on mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
