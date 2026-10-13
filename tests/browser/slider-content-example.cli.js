async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['swiper','slider'])await page.addScriptTag({url:`${base}/component/${name}/js/${name}.js`});
    await page.evaluate(async({base,theme})=>{document.documentElement.className=`theme-${theme}`;document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/slider-content.html`)).text();},{base,theme});
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider?.initialized);
    const row=await page.evaluate(()=>{
      const root=document.querySelector('.sf-slider'),p=root.querySelector('.sf-slider-pagination').getBoundingClientRect(),m=root.querySelector('.sf-slider-main').getBoundingClientRect(),a=root.querySelector('a'),r=a.getBoundingClientRect();
      return{noOverlap:p.top>=m.bottom,linkUnobscured:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===a,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    await page.locator('.sf-slider-pagination button').nth(2).click();
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider.realIndex===2&&!document.querySelector('.sf-slider')._sfSlider.animating);
    await page.locator('.sf-slider-pagination button').first().focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider.realIndex===0&&!document.querySelector('.sf-slider')._sfSlider.animating);
    await page.screenshot({path:`output/playwright/slider-content-example-${width}-${theme}.png`,fullPage:true});
    results.push({width,theme,...row});if(!row.noOverlap||!row.linkUnobscured||row.overflow)failures.push(results.at(-1));
  }return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
