async(page)=>{
  const cases=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);};
  const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const kind of ['base','smart']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(async kind=>{
      const response=await fetch(`../../source/output/action-focus-browser/examples/dropdown-wrapping-${kind}.html`);
      if(!response.ok)throw new Error(`Missing example ${response.status}`);
      document.querySelector('main').innerHTML=await response.text();
    },kind);
    await page.waitForFunction(()=>document.querySelector('.sf-dropdown-field > button[aria-controls]'));
    await settle();
    const tags=page.locator('.sf-dropdown-tag-container .sf-tag');
    check(await tags.count()===2,`${kind}: initial tags`);
    const bounds=await page.locator('.sf-dropdown-field').evaluate(field=>{
      const f=field.getBoundingClientRect(),b=field.querySelector(':scope > button').getBoundingClientRect();
      return field.scrollWidth<=field.clientWidth+1&&[...field.querySelectorAll('.sf-tag')].every(e=>{
        const t=e.getBoundingClientRect();
        return t.top>=f.top-1&&t.bottom<=f.bottom+1&&t.left>=f.left-1&&t.right<=f.right+1&&!(t.right>b.left+1&&t.left<b.right-1&&t.bottom>b.top+1&&t.top<b.bottom-1);
      });
    });
    check(bounds,`${kind}: wrapping containment`);
    await tags.first().locator('button').click();await settle();
    check(await tags.count()===1,`${kind}: real remove button`);
    check(JSON.stringify(await page.locator('form').evaluate(e=>[...new FormData(e)]))===JSON.stringify([['districts','moscow']]),`${kind}: removal payload`);
    await page.locator('button[type="reset"]').click();await settle();
    check(await tags.count()===2,`${kind}: reset restores tags`);
    await page.screenshot({path:`output/playwright/dropdown-wrapping-example-${kind}-${width}.png`});
    cases.push({width,kind});
  }
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',cases:cases.length,results:cases,errors};
}
