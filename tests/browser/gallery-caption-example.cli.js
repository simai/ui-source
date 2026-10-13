async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  let scenario='setup';
  page.on('pageerror',e=>errors.push({scenario,message:e.message,stack:e.stack}));
  for(const width of [390,1280])for(const delegated of [false,true]) {
    scenario=`${width}/${delegated?'delegated':'inline'}`;
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(async({base,delegated})=>{
      document.documentElement.className=delegated?'theme-dark':'theme-light';
      document.querySelector('main').innerHTML=delegated?`<a href="${base}/examples/assets/color-study.jpg" data-sf-gallery="caption" data-sf-slider-thumbs="false" data-title="Цветовая композиция"><img src="${base}/examples/assets/color-study.jpg" alt="Цветовая композиция с подписью"></a>`:(await(await fetch(`${base}/examples/gallery-caption.html`)).text()).replace('assets/color-study.jpg',`${base}/examples/assets/color-study.jpg`);
    },{base,delegated});
    if(delegated)await page.locator('a[data-sf-gallery]').click();
    else {
      await page.waitForFunction(()=>document.querySelector('sf-gallery')?.getInlineSlider()?.getSlider()?.initialized);
      await page.locator('[data-sf-gallery-slider="inline"] [data-sf-gallery-open]').click();
    }
    await page.waitForFunction(()=>document.querySelector('sf-gallery')?.getLightboxSlider()?.getSlider()?.initialized);
    await page.evaluate(async()=>{const s=document.querySelector('sf-gallery').getLightboxSlider();await Promise.all([...s.querySelectorAll('img')].map(i=>i.decode()));for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
    const state=await page.evaluate(()=>{
      const g=document.querySelector('sf-gallery'),s=g.getLightboxSlider(),img=s.querySelector('img'),caption=s.querySelector('figcaption'),link=caption.querySelector('a');
      if(link){link.focus();link.scrollIntoView({behavior:'instant',block:'nearest'});}else caption.scrollIntoView({behavior:'instant',block:'nearest'});
      const b=(link||caption).getBoundingClientRect(),p=s.closest('.sf-modal').querySelector('[data-sf-modal-panel]').getBoundingClientRect();
      return {captionReachable:b.top>=0&&b.bottom<=innerHeight,panelFits:p.left>=-1&&p.right<=innerWidth+1,nonzero:img.getBoundingClientRect().height>0,fit:getComputedStyle(img).objectFit,current:g.current,open:g.openState,authorStyles:img.getAttribute('style')};
    });
    if(!state.captionReachable||!state.panelFits||!state.nonzero||state.fit!=='contain'||!state.open||state.current!==1)failures.push({width,delegated,...state});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('sf-gallery').openState);
    await page.waitForFunction(()=>document.querySelector('sf-gallery').getModal().getModalRoot()?.getAttribute('aria-hidden')==='true');
    const documentSize=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    if(!delegated&&documentSize.scrollWidth>documentSize.viewport)failures.push({width,delegated,scope:'inline-document',documentSize});
    results.push({width,delegated,...state,closed:true,documentSize});
    if(width===390&&!delegated){await page.evaluate(()=>document.querySelector('sf-gallery').open(1));await page.waitForFunction(()=>document.querySelector('sf-gallery').getLightboxSlider()?.getSlider()?.initialized);await page.screenshot({path:'output/playwright/gallery-caption-example-390.png',fullPage:true});}
  }return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
