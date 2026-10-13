async(page)=>{
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const dir of ['ltr','rtl'])for(const placement of ['top','bottom','clamp'])for(const id of ['base','smart']){
    const height=placement==='clamp'?180:600;await page.setViewportSize({width,height});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?portal&nosearch${dir==='rtl'?'&rtl':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(({id,placement})=>{
      HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id),main=document.querySelector('main'),wrap=document.createElement('section');
      wrap.className='theme-dark';wrap.style.cssText=`position:fixed;left:0;right:0;top:${placement==='top'?innerHeight-100:40}px;transform:translateZ(0);overflow:hidden;height:90px`;
      host.parentNode.insertBefore(wrap,host);wrap.append(host);main.replaceChildren(wrap);
    },{id,placement});
    const button=page.locator(`#${id} .sf-dropdown-field > button`);await button.click();
    await page.waitForTimeout(60);
    const metrics=()=>page.locator(`#${id}`).evaluate(e=>{
      const root=e.matches('.sf-dropdown')?e:e.querySelector('.sf-dropdown');
      const list=root.__sfDropdownPortalList||e.querySelector('.sf-list'),p=list.getBoundingClientRect(),field=e.querySelector('.sf-dropdown-field').getBoundingClientRect();
      const wrap=list.querySelector('.sf-list-container-wrap');
      return {left:p.left,right:p.right,top:p.top,bottom:p.bottom,width:innerWidth,height:innerHeight,placement:list.dataset.placement,fieldBottom:field.bottom,fieldTop:field.top,scrollable:list.scrollHeight>list.clientHeight+1||(getComputedStyle(wrap).overflowY==='auto'&&wrap.scrollHeight>wrap.clientHeight+1)};
    });
    let m=await metrics();
    if(m.left<0||m.right>m.width+1||m.top<0||m.bottom>m.height+1)failures.push({id,width,dir,placement,issue:'viewport bounds',m});
    if(placement!=='clamp'&&m.placement!==placement)failures.push({id,width,dir,placement,issue:'flip',m});
    if(placement==='clamp'&&!m.scrollable)failures.push({id,width,dir,placement,issue:'bounded scroll',m});
    await page.evaluate(()=>{document.querySelector('section').style.top='0px';window.dispatchEvent(new Event('resize'));});
    await page.waitForTimeout(60);m=await metrics();
    if(m.placement!=='bottom'||m.top<m.fieldBottom||m.bottom>m.height+1)failures.push({id,width,dir,placement,issue:'reposition',m});
    results.push({id,width,dir,placement});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,results,errors};
}
