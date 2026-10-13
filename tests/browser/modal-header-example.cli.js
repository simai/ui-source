async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close','buttons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/modal/js/modal.js`});
    await page.evaluate(async base=>{document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/modal-long-title/index.html`)).text();},base);
    await page.addScriptTag({url:`${base}/examples/modal-long-title/index.js`});
    await page.locator('#modal-long-title-open').click();
    await page.waitForFunction(()=>document.querySelector('.sf-modal')?.dataset.sfModalState==='open');
    // The open state starts the CSS transition; measure the settled surface.
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sf-modal [data-sf-modal-panel]')).opacity==='1');
    const state=await page.evaluate(()=>{
      const modal=document.querySelector('.sf-modal'),header=modal.querySelector('header'),title=header.querySelector('h2'),button=header.querySelector('[data-sf-modal-close]');
      const range=document.createRange();range.selectNodeContents(title);const text=[...range.getClientRects()],b=button.getBoundingClientRect();
      return{lines:text.length,title:title.textContent,overlap:text.some(t=>Math.min(t.right,b.right)>Math.max(t.left,b.left)&&Math.min(t.bottom,b.bottom)>Math.max(t.top,b.top)),fits:document.documentElement.scrollWidth<=innerWidth,hit:button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};
    });
    results.push({width,...state});if(state.overlap||!state.fits||!state.hit||(width===390&&state.lines<2))failures.push({width,...state});
    if(width===390)await page.screenshot({path:'output/playwright/modal-header-long-example.png',fullPage:true});
    await page.locator('.sf-modal [data-sf-modal-close]').click();
    await page.waitForFunction(()=>document.querySelector('.sf-modal')?.dataset.sfModalState==='closed');
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
