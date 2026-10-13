async(page)=>{
  const cases=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const id of ['base','smart']){
    await page.setViewportSize({width,height:600});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?portal&nosearch');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(id=>{
      const host=document.getElementById(id),main=document.querySelector('main');
      const wrap=document.createElement('section');wrap.className='theme-dark';
      wrap.style.cssText='transform:translateZ(0);overflow:hidden;height:100px;margin-top:100px;--sf-radius--surface:var(--sf-radius-3);--sf-space-1:24px';
      host.parentNode.insertBefore(wrap,host);wrap.append(host);main.replaceChildren(wrap);
    },id);
    const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button');await button.click();
    await page.waitForTimeout(100);
    const actual=await host.evaluate(e=>{
      const root=e.matches('.sf-dropdown')?e:e.querySelector('.sf-dropdown');
      const panel=root.__sfDropdownPortalList||e.querySelector('.sf-list'),field=root.querySelector('.sf-dropdown-field');
      const p=panel.getBoundingClientRect(),f=field.getBoundingClientRect(),s=getComputedStyle(panel);
      const probe=document.createElement('span');probe.style.cssText='background:var(--sf-surface-0);border-radius:var(--sf-radius--surface)';root.append(probe);
      const expected={background:getComputedStyle(probe).backgroundColor,radius:getComputedStyle(probe).borderRadius};probe.remove();
      const hit=document.elementFromPoint(p.x+p.width/2,Math.min(p.bottom-5,innerHeight-5));
      return {background:s.backgroundColor,radius:s.borderRadius,expected,panel:{top:p.top,bottom:p.bottom,left:p.left,width:p.width},field:{bottom:f.bottom,left:f.left,width:f.width},visible:panel.contains(hit),height:innerHeight};
    });
    if(actual.background!==actual.expected.background||actual.radius!==actual.expected.radius)failures.push({id,width,issue:'inherited theme/radius',actual});
    if(!actual.visible||actual.panel.top<actual.field.bottom||actual.panel.bottom>actual.height)failures.push({id,width,issue:'viewport geometry/clipping',actual});
    cases.push({id,width,actual});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:cases.length,failures,results:cases,errors};
}
