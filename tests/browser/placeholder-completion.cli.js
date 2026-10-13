async page => {
  const results=[];
  const errors=[];
  const externalRequests=[];
  const check=(name,pass,detail='')=>results.push({name,pass:Boolean(pass),detail});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:8766/'))externalRequests.push(request.url());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.setViewportSize({width:1280,height:900});
  await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/placeholder-method-lab.html');

  check('component owns intrinsic flex layout',await page.locator('#column').evaluate(root=>getComputedStyle(root).display==='flex'));
  check('default column centers its composition',await page.locator('#column').evaluate(root=>{
    const style=getComputedStyle(root);
    return style.flexDirection==='column'&&style.alignItems==='center'&&style.textAlign==='center';
  }));
  check('row layout places visual before content',await page.evaluate(()=>document.querySelector('#row .sf-placeholder__visual').getBoundingClientRect().x<document.querySelector('#row .sf-placeholder__content').getBoundingClientRect().x));
  check('title and description keep normal body size',await page.locator('#column').evaluate(root=>{
    const body=getComputedStyle(document.body);
    const title=getComputedStyle(root.querySelector('.sf-placeholder__title'));
    const description=getComputedStyle(root.querySelector('.sf-placeholder__description'));
    return title.fontSize===body.fontSize&&description.fontSize===body.fontSize&&title.lineHeight===body.lineHeight&&description.lineHeight===body.lineHeight;
  }));
  check('hierarchy comes from weight and role color',await page.locator('#column').evaluate(root=>{
    const title=getComputedStyle(root.querySelector('.sf-placeholder__title'));
    const description=getComputedStyle(root.querySelector('.sf-placeholder__description'));
    return Number(title.fontWeight)>Number(description.fontWeight)&&title.color!==description.color;
  }));
  check('decorative visual is hidden from assistive technology',await page.locator('#column .sf-placeholder__visual').getAttribute('aria-hidden')==='true');
  check('native actions remain keyboard reachable',await page.locator('#column').evaluate(root=>[...root.querySelectorAll('button,a')].every(node=>node.tabIndex===0)));
  check('legacy anatomy retains title and description styles',await page.locator('#legacy').evaluate(root=>{
    const body=getComputedStyle(document.body);
    const nodes=root.querySelectorAll('.sf-placeholder-top-text');
    return nodes.length===2&&getComputedStyle(nodes[0]).fontSize===body.fontSize&&getComputedStyle(nodes[1]).fontSize===body.fontSize;
  }));

  await page.setViewportSize({width:390,height:844});
  check('long localized copy stays inside the mobile viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&document.querySelector('#row').scrollWidth<=document.querySelector('#row').clientWidth));
  await page.evaluate(()=>document.documentElement.dir='rtl');
  check('row composition follows logical direction in RTL',await page.evaluate(()=>{
    const root=document.querySelector('#row');
    const visual=root.querySelector('.sf-placeholder__visual').getBoundingClientRect();
    const bounds=root.getBoundingClientRect();
    return Math.abs(visual.right-bounds.right)<0.5&&getComputedStyle(root).textAlign==='right';
  }));
  await page.evaluate(()=>document.documentElement.className='theme-dark');
  check('semantic title and description remain distinct in dark theme',await page.locator('#column').evaluate(root=>getComputedStyle(root.querySelector('.sf-placeholder__title')).color!==getComputedStyle(root.querySelector('.sf-placeholder__description')).color));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
