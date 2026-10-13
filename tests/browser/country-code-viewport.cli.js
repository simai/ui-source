async page => {
  await page.route('**/*', route=>route.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const mode of ['base','smart'])for(const dir of ['ltr','rtl'])for(const place of ['top','middle','bottom']){
    await page.setViewportSize({width:390,height:600});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/country-code/css/country-code.css`});
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(({mode,dir,place})=>{
      document.documentElement.dir=dir;const main=document.querySelector('main');main.replaceChildren();
      main.style.cssText=`position:fixed;left:24px;right:24px;padding:0;${place==='bottom'?'bottom:24px':`top:${place==='top'?24:240}px`}`;
      if(mode==='smart'){const host=document.createElement('sf-country-code');host.setAttribute('label','Телефон');host.setAttribute('hint','Выберите страну');host.setAttribute('iso2','RU');main.append(host);}
      else{const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode');main.append(new C({param:{label:'Телефон',hint:'Выберите страну',iso2:'RU'}}).render());}
    },{mode,dir,place});
    await page.locator('.sf-country-code-left').focus();await page.keyboard.press('Enter');await page.keyboard.press('End');
    const measure=()=>page.evaluate(()=>{
      const root=document.querySelector('.sf-country-code'),list=root.querySelector('.sf-country-code-list'),wrap=root.querySelector('.sf-country-code-items');
      const r=list.getBoundingClientRect(),b=root.getBoundingClientRect(),w=wrap.getBoundingClientRect(),a=document.activeElement,ar=a.getBoundingClientRect();
      return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,viewport:innerHeight,rootTop:b.top,rootBottom:b.bottom,
        visible:r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1,
        last:a===root.querySelector('.sf-country-code-item:last-child'),optionVisible:ar.top>=w.top-1&&ar.bottom<=w.bottom+1,
        ownerWidth:Math.abs(r.width-b.width)<1,pageOverflow:document.documentElement.scrollWidth>innerWidth};
    });
    const initial=await measure();
    if(!initial.visible||!initial.last||!initial.optionVisible||!initial.ownerWidth||initial.pageOverflow)failures.push({mode,dir,place,stage:'open',...initial});
    // Keep the owner visible while simulating a shorter visual area.
    await page.evaluate(()=>{const m=document.querySelector('main');m.style.top='';m.style.bottom='24px';});
    await page.setViewportSize({width:390,height:320});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.keyboard.press('Home');await page.keyboard.press('End');const resized=await measure();
    if(!resized.visible||!resized.last||!resized.optionVisible||resized.pageOverflow)failures.push({mode,dir,place,stage:'resize',...resized});
    if(place==='bottom' && ((mode==='base'&&dir==='ltr')||(mode==='smart'&&dir==='rtl'))){
      await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('main .sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
      await page.screenshot({path:`output/playwright/country-code-viewport-${mode}-${dir}.png`,fullPage:true});
    }
    await page.keyboard.press('Escape');
    const closed=await page.locator('.sf-country-code').evaluate(e=>!e.classList.contains('open')&&getComputedStyle(e.querySelector('.sf-country-code-list')).display==='none');
    if(!closed)failures.push({mode,dir,place,stage:'close'});
    await page.keyboard.press('Enter');
    await page.evaluate(()=>{const main=document.querySelector('main');main.style.bottom='';main.style.top='-2000px';window.dispatchEvent(new Event('resize'));});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const offscreenClosed=await page.locator('.sf-country-code').evaluate(e=>!e.classList.contains('open'));
    if(!offscreenClosed)failures.push({mode,dir,place,stage:'owner-offscreen'});
    results.push({mode,dir,place,initial,resized,closed,offscreenClosed});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
