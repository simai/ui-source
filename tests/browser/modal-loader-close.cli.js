async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const results=[],errors=[],failures=[],requests=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
  page.on('request',r=>requests.push(r.url()));
  await page.route('**/*',r=>{
    const url=r.request().url();
    if(!url.startsWith('http://127.0.0.1:8766/')){external.push(url);return r.abort();}
    if(url.endsWith('/favicon.ico'))return r.fulfill({status:204,body:''});
    if(url.includes('/ui-source/source/output/action-focus-browser/utility/'))return r.continue({url:url.replace('/ui-source/source/output/action-focus-browser/utility/','/ui/distr/utility/')});
    return r.continue();
  });
  for(const width of [390,1280])for(const theme of ['theme-light','theme-dark'])for(const kind of ['ordinary','smart','gallery']){
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.evaluate(({base,kind,theme})=>{
      document.documentElement.className=theme;
      window.sfPath=base+'/';window.sfSmartPath=base+'/';
      window.SF_BOOT_CONFIG={theme:false,cacheVersion:'modal-close-local',preloader:{preloaderActive:false}};
      document.querySelector('main').innerHTML=kind==='ordinary'?'<button id="opener" data-sf-modal-open="close-test">Открыть</button>':kind==='smart'?'<sf-modal title="Проверка закрытия" show-footer="false"><p slot="content">Содержимое окна</p></sf-modal>':'<sf-gallery title="Проверка закрытия" thumbs="false" arrows="false"><p slot="slide">Изображение с описанием</p></sf-gallery>';
    },{base,kind,theme});
    await page.addScriptTag({url:`${base}/core/js/core.js`});
    await page.waitForFunction(()=>!!window.SF?.Loader);
    if(kind==='ordinary'){
      await page.waitForFunction(()=>!!SF.Loader.ComponentRegistry?.Modal);
      await page.evaluate(()=>{window.subject=new SF.Loader.ComponentRegistry.Modal({id:'close-test',param:{title:'Проверка закрытия',showFooter:false}});window.root=()=>subject.template;subject.open({animate:false});});
    } else {
      await page.waitForFunction(kind=>typeof document.querySelector(kind==='smart'?'sf-modal':'sf-gallery')?.open==='function',kind);
      await page.evaluate(kind=>{window.subject=document.querySelector(kind==='smart'?'sf-modal':'sf-gallery');window.root=()=>kind==='smart'?subject.getModalRoot():subject.getModal().getModalRoot();},kind);
      await page.waitForFunction(kind=>kind!=='gallery'||subject.getInlineSlider()?.getSlider()?.initialized,kind);
      await page.waitForFunction(()=>!!root()?.isConnected);
      await page.evaluate(()=>subject.open());
    }
    await page.waitForFunction(()=>root()?.getAttribute('data-sf-modal-state')==='open');
    // Wait for dynamic Loader discovery, not a manually injected close stylesheet.
    await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes('/close/css/close.css')),{},{timeout:3000}).catch(()=>{});
    const state=await page.evaluate(async()=>{
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
      const button=root().querySelector('[data-sf-modal-close]'),icon=button?.querySelector('.sf-close-icon'),b=button?.getBoundingClientRect(),i=icon?.getBoundingClientRect();
      return{buttonSize:[b?.width||0,b?.height||0],iconSize:[i?.width||0,i?.height||0],hit:!!b&&button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),mask:icon?getComputedStyle(icon).maskImage:'none',sheets:[...document.styleSheets].map(s=>s.href).filter(Boolean).filter(s=>/close|icon-buttons|modal/.test(s))};
    });
    if(state.iconSize.some(n=>n<=0)||state.mask==='none'||state.buttonSize.some(n=>n<24)||!state.hit)failures.push({width,theme,kind,...state});
    if(kind==='gallery'&&width===390)await page.screenshot({path:`output/playwright/modal-close-loader-${theme}.png`,fullPage:true});
    if(state.hit){
      await page.evaluate(()=>root().querySelector('[data-sf-modal-close]').focus());
      await page.keyboard.press('Enter');
      await page.waitForFunction(()=>root().getAttribute('data-sf-modal-state')==='closed');
      await page.evaluate(()=>subject.open());
      await page.waitForFunction(()=>root().getAttribute('data-sf-modal-state')==='open');
      await page.locator('.sf-modal[aria-hidden="false"] [data-sf-modal-close]').click();
      await page.waitForFunction(()=>root().getAttribute('data-sf-modal-state')==='closed');
    }
    results.push({width,theme,kind,...state});
  }
  return{status:failures.length||errors.length||external.length?'failed':'passed',cases:results.length,errors,failures,external,requests,results};
}
