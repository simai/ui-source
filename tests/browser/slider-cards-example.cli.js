async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(async({base,theme})=>{document.documentElement.className=`theme-${theme}`;document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/slider-cards.html`)).text();},{base,theme});
    await page.waitForFunction(()=>document.querySelector('sf-slider').getSlider()?.initialized);
    const count=await page.evaluate(()=>document.querySelector('sf-slider').getSlider().slides.length);
    await page.locator('.sf-slider-pagination button').nth(1).click();
    await page.waitForFunction(()=>document.querySelector('sf-slider').getSlider().realIndex===1&&!document.querySelector('sf-slider').getSlider().animating);
    const second=await page.locator('.swiper-slide-active h3').textContent();
    await page.locator('.sf-slider-pagination button').first().focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('sf-slider').getSlider().realIndex===0&&!document.querySelector('sf-slider').getSlider().animating);
    const row=await page.evaluate(()=>({first:document.querySelector('.swiper-slide-active h3').textContent,link:!!document.querySelector('.swiper-slide-active a'),overflow:document.documentElement.scrollWidth>innerWidth}));
    results.push({width,theme,count,second,...row});if(count!==2||second!=='Вторая карточка'||row.first!=='Первая карточка'||!row.link||row.overflow)failures.push(results.at(-1));
    await page.screenshot({path:`output/playwright/slider-cards-${width}-${theme}.png`,fullPage:true});
  }return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
