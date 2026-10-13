async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const dir of ['ltr','rtl']){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['swiper','slider'])await page.addScriptTag({url:`${base}/component/${name}/js/${name}.js`});
    await page.evaluate(async({base,dir})=>{document.documentElement.dir=dir;const response=await fetch(`${base}/examples/slider-overview.html`);if(!response.ok)throw Error('Missing actual overview');document.querySelector('main').innerHTML=await response.text();},{base,dir});
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider?.initialized);
    const labels=await page.locator('.sf-slider-arrows button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
    await page.locator('.sf-slider-button-next').click();
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider.realIndex===1&&!document.querySelector('.sf-slider')._sfSlider.animating);
    await page.locator('.sf-slider-button-prev').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider.realIndex===0&&!document.querySelector('.sf-slider')._sfSlider.animating);
    await page.locator('.sf-slider-pagination button').nth(2).click();
    await page.waitForFunction(()=>document.querySelector('.sf-slider')._sfSlider.realIndex===2&&!document.querySelector('.sf-slider')._sfSlider.animating);
    const row=await page.evaluate(()=>({index:document.querySelector('.sf-slider')._sfSlider.realIndex,dots:document.querySelectorAll('.sf-slider-pagination button').length,overflow:document.documentElement.scrollWidth>innerWidth}));
    const navigation=row.index===2&&row.dots===3&&!row.overflow;
    const authoredNames=labels[0]==='Предыдущий слайд'&&labels[1]==='Следующий слайд';
    results.push({width,dir,...row,labels,navigation,authoredNames});if(!navigation||!authoredNames)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
