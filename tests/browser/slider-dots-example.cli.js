async page => {
  await page.route('**/*',r=>r.continue());
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],errors=[],consoleErrors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.emulateMedia({forcedColors:'none',colorScheme:theme});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['swiper','slider'])await page.addScriptTag({url:`${base}/component/${name}/js/${name}.js`});
    await page.evaluate(async({base,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`${base}/examples/slider-dots.html`);if(!response.ok)throw Error('Missing actual dot example');
      document.querySelector('main').innerHTML=await response.text();
    },{base,theme});
    await page.waitForFunction(()=>document.querySelectorAll('.sf-slider').length===16&&[...document.querySelectorAll('.sf-slider')].every(n=>n._sfSlider?.initialized));
    const variants=[];
    for(let i=0;i<16;i++){
      const root=page.locator('.sf-slider').nth(i),dots=root.locator('.sf-slider-pagination button');
      await dots.nth(2).click();
      await page.waitForFunction(i=>{const s=document.querySelectorAll('.sf-slider')[i]._sfSlider;return s.realIndex===2&&!s.animating;},i);
      await dots.first().focus();await page.keyboard.press('Enter');
      await page.waitForFunction(i=>{const s=document.querySelectorAll('.sf-slider')[i]._sfSlider;return s.realIndex===0&&!s.animating;},i);
      variants.push(await root.evaluate(n=>{
        const dots=[...n.querySelectorAll('.sf-slider-pagination button')],current=dots.filter(b=>b.classList.contains('active'));
        return{index:n._sfSlider.realIndex,count:dots.length,active:current.length,first:current[0]===dots[0],outline:getComputedStyle(dots[0]).outlineStyle,filled:getComputedStyle(dots[0]).backgroundColor!==getComputedStyle(dots[1]).backgroundColor};
      }));
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const row={width,theme,overflow,variants};results.push(row);
    if(overflow||variants.some(v=>v.index!==0||v.count!==3||v.active!==1||!v.first||!v.filled||v.outline==='none'))failures.push(row);
    await page.screenshot({path:`output/playwright/slider-dots-example-${width}-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length||consoleErrors.length?'failed':'passed',cases:results.length,variants:results.length*16,failures,errors,consoleErrors,results};
}
