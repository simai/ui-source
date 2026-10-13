async(page)=>{
  const cases=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  for(const width of [390,1280])for(const direction of ['ltr','rtl'])for(const appearance of ['outlined','filled'])for(const size of ['1/3','1/2','1','2','3']){
    await page.setViewportSize({width,height:1600});await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset&geometry&appearance=${appearance}&size=${encodeURIComponent(size)}${direction==='rtl'?'&rtl':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(()=>document.fonts.ready);
    for(const id of ['base','base-tag','smart','smart-tag']){
      const result=await page.locator(`#${id}`).evaluate(host=>{
        const field=host.querySelector('.sf-dropdown-field'),button=field.querySelector(':scope > button');
        const r=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
        const f=r(field),b=r(button),issues=[];
        if(f.left < -1 || f.right > document.documentElement.clientWidth + 1)issues.push('field outside viewport');
        if(field.scrollWidth>field.clientWidth+1)issues.push('field horizontal overflow');
        if(field.scrollHeight>field.clientHeight+1)issues.push('field vertical overflow');
        for(const tag of field.querySelectorAll('.sf-tag')){
          const t=r(tag);
          if(t.left<f.left-1||t.right>f.right+1||t.top<f.top-1||t.bottom>f.bottom+1)issues.push('tag outside field');
          if(t.right>b.left+1&&t.left<b.right-1&&t.bottom>b.top+1&&t.top<b.bottom-1)issues.push('tag overlaps toggle');
          if(tag.scrollWidth>tag.clientWidth+1)issues.push('tag horizontal overflow');
        }
        return {field:f,button:b,issues};
      });
      const host=page.locator(`#${id}`);
      await host.locator('.sf-dropdown-field > button').click();
      const popupIssues=await host.locator('.sf-list').evaluate(list=>{
        const issues=[];
        if(list.scrollWidth>list.clientWidth+1)issues.push('popup horizontal overflow');
        for(const item of list.querySelectorAll('.sf-list-item')){
          if(item.scrollWidth>item.clientWidth+1)issues.push('option horizontal overflow');
        }
        return issues;
      });
      result.issues.push(...popupIssues);
      await page.keyboard.press('Escape');
      cases.push({width,direction,appearance,size,id,...result});
    }
    if(width===390&&size==='1')await page.screenshot({path:`output/playwright/dropdown-geometry-${direction}.png`});
  }
  await page.screenshot({path:'output/playwright/dropdown-geometry.png'});
  return {status:cases.some(c=>c.issues.length)||errors.length?'failed':'passed',cases:cases.length,failures:cases.filter(c=>c.issues.length),errors};
}
