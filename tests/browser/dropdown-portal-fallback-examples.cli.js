async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const kind of ['base','smart']){
    await page.setViewportSize({width,height:600});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(async({theme,kind})=>{
      HTMLElement.prototype.showPopover=undefined;
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`../../source/output/action-focus-browser/examples/dropdown-portal-${kind}.html`);
      if(!response.ok)throw new Error('Missing portal example');document.querySelector('main').innerHTML=await response.text();
    },{theme,kind});
    await page.waitForFunction(()=>document.querySelector('.sf-dropdown-field > button[aria-controls]'));
    await page.locator('.sf-dropdown-field > button').click();
    await page.waitForFunction(()=>document.querySelector('.sf-list').parentElement.parentElement===document.body);
    const visible=await page.locator('.sf-list').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.bottom-5));});
    if(!visible)throw new Error('Example panel clipped');
    await page.screenshot({path:`output/playwright/dropdown-portal-fallback-example-${kind}-${width}-${theme}.png`});
    await page.locator('.sf-list-item[data-value="moscow"]').click();
    await page.waitForFunction(()=>document.querySelector('.sf-dropdown-hidden-input').value==='moscow');
    await page.waitForFunction(()=>document.querySelector('main').contains(document.querySelector('.sf-list')));
    results.push({kind,width,theme});
  }
  return {status:errors.length?'failed':'passed',cases:results.length,results,errors};
}
