async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(async base=>{document.querySelector('main').innerHTML=(await(await fetch(`${base}/examples/gallery-caption.html`)).text()).replace('assets/color-study.jpg',`${base}/examples/assets/color-study.jpg`);},base);
    await page.waitForFunction(()=>document.querySelector('sf-gallery')?.getInlineSlider()?.getSlider()?.initialized);
    await page.locator('[data-sf-gallery-slider="inline"] [data-sf-gallery-open]').focus();
    await page.evaluate(()=>window.openerElement=document.activeElement);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('sf-gallery').getLightboxSlider()?.getSlider()?.initialized);
    await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
    const states=[];
    for(const key of ['Shift+Tab','Tab','Tab','Tab','Shift+Tab','Shift+Tab']){
      await page.keyboard.press(key);
      const state=await page.evaluate(()=>{const root=document.querySelector('sf-gallery').getModal().getModalRoot();return{inside:root.contains(document.activeElement),tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label')||document.activeElement.textContent.trim().slice(0,60)};});
      states.push({key,...state});if(!state.inside)failures.push({width,key,...state});
    }
    const close=await page.evaluate(()=>{
      const root=document.querySelector('sf-gallery').getModal().getModalRoot(),button=root.querySelector('[data-sf-modal-close]'),icon=button?.querySelector('.sf-close-icon'),r=icon?.getBoundingClientRect();
      return{button:!!button,width:r?.width||0,height:r?.height||0,mask:icon?getComputedStyle(icon).maskImage:'none'};
    });
    if(!close.button||close.width<=0||close.height<=0||close.mask==='none')failures.push({width,action:'close-glyph',close});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('sf-gallery').getModal().getModalRoot()?.getAttribute('data-sf-modal-state')==='closed');
    const restored=await page.evaluate(()=>document.activeElement===openerElement);
    if(!restored)failures.push({width,action:'restore'});
    results.push({width,states,close,restored});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
