async page => {
  const results=[];
  const errors=[];
  const externalRequests=[];
  const check=(name,pass,detail='')=>results.push({name,pass:Boolean(pass),detail});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:8766/'))externalRequests.push(request.url());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.setViewportSize({width:1280,height:1000});
  await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/skeleton-method-lab.html');

  check('loading semantics belong to the host region',await page.locator('#loading-region').getAttribute('aria-busy')==='true');
  check('all placeholder geometry is decorative',await page.locator('.sf-skeleton').evaluateAll(nodes=>nodes.length>0&&nodes.every(node=>node.getAttribute('aria-hidden')==='true'&&!node.hasAttribute('tabindex'))));
  check('default text skeleton follows the body typography size',await page.locator('#lines .sf-skeleton-text').first().evaluate(node=>node.getBoundingClientRect().height===parseFloat(getComputedStyle(document.body).fontSize)));
  check('relative line widths preserve expected content geometry',await page.locator('#lines').evaluate(root=>{
    const widths=[...root.children].map(node=>node.getBoundingClientRect().width/root.getBoundingClientRect().width);
    return Math.abs(widths[0]-1)<0.02&&Math.abs(widths[1]-.75)<0.02&&Math.abs(widths[2]-.5)<0.02;
  }));
  check('icon circle is intrinsically square and circular',await page.locator('#avatar .sf-skeleton-text').evaluate(node=>{
    const box=node.getBoundingClientRect();
    return Math.abs(box.width-box.height)<1&&parseFloat(getComputedStyle(node).borderRadius)>=box.height/2;
  }));
  check('text and surface shapes use different semantic radii',await page.locator('#shapes').evaluate(root=>{
    const text=root.children[2].firstElementChild;
    const surface=root.children[3].firstElementChild;
    const textRadius=parseFloat(getComputedStyle(text).borderRadius);
    const surfaceRadius=parseFloat(getComputedStyle(surface).borderRadius);
    return textRadius>0&&surfaceRadius>textRadius;
  }));
  check('pulse, wave and static modes are distinct',await page.locator('#motion').evaluate(root=>{
    // A pulse is the group's one animation (its bars pulse with it), a wave each bar's sweep.
    const [pulse,wave,none]=[...root.children].map(group=>group.firstElementChild);
    return getComputedStyle(pulse.parentElement).animationName==='sf-skeleton-pulse'&&getComputedStyle(pulse).animationName==='none'&&getComputedStyle(wave,'::after').animationName==='sf-skeleton-wave'&&getComputedStyle(none).animationName==='none';
  }));
  await page.emulateMedia({reducedMotion:'reduce'});
  check('reduced motion keeps geometry but removes animation',await page.locator('#motion').evaluate(root=>[...root.children].every(group=>{
    const item=group.firstElementChild;
    return item.getBoundingClientRect().height>0&&getComputedStyle(group).animationName==='none'&&getComputedStyle(item).animationName==='none'&&getComputedStyle(item,'::after').animationName==='none';
  })));
  await page.evaluate(()=>document.documentElement.className='theme-dark');
  check('semantic skeleton paint remains visible in dark theme',await page.locator('#lines .sf-skeleton-text').first().evaluate(node=>getComputedStyle(node).backgroundImage!=='none'||getComputedStyle(node).backgroundColor!=='rgba(0, 0, 0, 0)'));
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
  check('forced colors preserves visible geometry without decorative wave',await page.locator('#lines .sf-skeleton-text').first().evaluate(node=>getComputedStyle(node).backgroundColor!=='rgba(0, 0, 0, 0)'&&getComputedStyle(node,'::after').display==='none'));
  await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.dir='rtl');
  check('mobile RTL layout stays inside the viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
