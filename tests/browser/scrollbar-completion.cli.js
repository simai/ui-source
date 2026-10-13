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
  await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/scrollbar-method-lab.html');
  await page.locator('#overlay .sf-scrollbar__thumb').waitFor();

  check('default mode is managed overlay',await page.locator('#overlay').getAttribute('data-sf-scrollbar-ready')==='true'&&await page.locator('#overlay .sf-scrollbar__track').count()===1);
  check('canonical persistent mode stays visible',await page.locator('#persistent').evaluate(root=>getComputedStyle(root.querySelector('.sf-scrollbar__track')).opacity==='1'));
  check('standard and hidden modes keep native viewport ownership',await page.evaluate(()=>['standard','hidden'].every(id=>!document.querySelector(`#${id} .sf-scrollbar__track`))));
  check('legacy public attributes remain compatible',await page.locator('#legacy .sf-scrollbar__track').count()===1);
  check('managed thumb gets localized labelledby name',await page.locator('#overlay .sf-scrollbar__thumb').getAttribute('aria-labelledby')==='overlay-title');
  check('managed thumb exposes scrollbar value semantics',await page.locator('#overlay .sf-scrollbar__thumb').evaluate(node=>node.getAttribute('role')==='scrollbar'&&node.getAttribute('aria-controls')&&node.getAttribute('aria-valuemin')==='0'&&node.getAttribute('aria-valuemax')==='100'));
  check('minimum thumb geometry comes from the Framework token',await page.locator('#overlay').evaluate(root=>{
    const thumb=root.querySelector('.sf-scrollbar__thumb');
    return getComputedStyle(thumb).minBlockSize==='44px'&&thumb.getBoundingClientRect().height>=44;
  }));

  const thumb=page.locator('#overlay .sf-scrollbar__thumb');
  await thumb.focus();
  await thumb.press('End');
  await page.waitForTimeout(1000);
  check('keyboard End reaches the logical maximum',await page.locator('#overlay').evaluate(root=>{
    const viewport=root.querySelector('.sf-scrollbar__viewport');
    return Math.abs(viewport.scrollTop-(viewport.scrollHeight-viewport.clientHeight))<2&&root.querySelector('.sf-scrollbar__thumb').getAttribute('aria-valuenow')==='100';
  }));
  await thumb.press('Home');
  await page.waitForTimeout(1000);
  check('keyboard Home returns to the logical minimum',await page.locator('#overlay').evaluate(root=>root.querySelector('.sf-scrollbar__viewport').scrollTop<2));

  check('both horizontal examples overflow',await page.evaluate(()=>['horizontal-ltr','horizontal-rtl'].every(id=>document.querySelector(`#${id}`).dataset.sfScrollbarOverflow==='true')));
  await page.locator('#horizontal-ltr').scrollIntoViewIfNeeded();
  const ltrTrackBox=await page.locator('#horizontal-ltr .sf-scrollbar__track').boundingBox();
  const ltrThumbBox=await page.locator('#horizontal-ltr .sf-scrollbar__thumb').boundingBox();
  await page.mouse.move(ltrThumbBox.x+ltrThumbBox.width/2,ltrThumbBox.y+ltrThumbBox.height/2);
  await page.mouse.down();
  await page.mouse.move(ltrTrackBox.x+ltrTrackBox.width*0.7,ltrThumbBox.y+ltrThumbBox.height/2);
  await page.mouse.up();
  await page.waitForTimeout(100);
  check('pointer drag changes horizontal value',await page.locator('#horizontal-ltr').evaluate(root=>root.querySelector('.sf-scrollbar__viewport').scrollLeft>0&&Number(root.querySelector('.sf-scrollbar__thumb').getAttribute('aria-valuenow'))>0));
  const rtlThumb=page.locator('#horizontal-rtl .sf-scrollbar__thumb');
  check('RTL starts at logical minimum without a negative ARIA value',await rtlThumb.getAttribute('aria-valuenow')==='0');
  await rtlThumb.focus();
  await rtlThumb.press('End');
  await page.waitForTimeout(1000);
  check('RTL End reaches negative physical scroll and logical maximum',await page.locator('#horizontal-rtl').evaluate(root=>{
    const viewport=root.querySelector('.sf-scrollbar__viewport');
    const thumb=root.querySelector('.sf-scrollbar__thumb');
    return viewport.scrollLeft<0&&thumb.getAttribute('aria-valuenow')==='100'&&parseFloat(getComputedStyle(thumb).getPropertyValue('--sf-scrollbar-thumb-offset'))<0;
  }));
  await rtlThumb.press('Home');
  await page.waitForTimeout(1000);
  check('RTL Home returns to inline start',await page.locator('#horizontal-rtl .sf-scrollbar__viewport').evaluate(node=>Math.abs(node.scrollLeft)<2));

  const before=await page.locator('#overlay .sf-scrollbar__thumb').getAttribute('aria-valuenow');
  await page.locator('#overlay-content').evaluate(root=>{
    for(let index=5;index<=10;index+=1){const item=document.createElement('div');item.className='surface-container p-2';item.textContent=`Пункт ${index}`;root.append(item);}
  });
  await page.waitForTimeout(150);
  check('dynamic content resynchronizes overflow geometry',await page.locator('#overlay').evaluate((root,previous)=>{
    const thumb=root.querySelector('.sf-scrollbar__thumb');
    return root.dataset.sfScrollbarOverflow==='true'&&thumb.getAttribute('aria-valuenow')===previous&&thumb.offsetHeight<root.querySelector('.sf-scrollbar__viewport').clientHeight;
  },before));

  await page.locator('#standard').evaluate(root=>root.setAttribute('data-mode','persistent'));
  await page.waitForTimeout(50);
  check('canonical mode changes rebuild managed behavior',await page.locator('#standard .sf-scrollbar__track').count()===1);

  await page.setViewportSize({width:390,height:844});
  check('component stays within the mobile viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  await page.evaluate(()=>document.documentElement.className='theme-dark');
  check('thumb uses a semantic theme-dependent color',await page.locator('#persistent .sf-scrollbar__thumb').evaluate(node=>getComputedStyle(node,'::before').backgroundColor!=='rgba(0, 0, 0, 0)'));
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
  check('forced colors restores platform scrollbar ownership',await page.locator('#persistent').evaluate(root=>getComputedStyle(root.querySelector('.sf-scrollbar__track')).display==='none'&&getComputedStyle(root.querySelector('.sf-scrollbar__viewport')).scrollbarWidth==='auto'));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
