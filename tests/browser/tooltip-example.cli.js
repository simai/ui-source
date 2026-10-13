async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser', errors=[], failures=[], results=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:800});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.addStyleTag({url:`${base}/component/tooltip/css/tooltip.css`});
    await page.addScriptTag({url:`${base}/smart/tooltip/js/tooltip.js`});
    const row=await page.evaluate(async({base,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const main=document.querySelector('main');main.innerHTML=await(await fetch(`${base}/examples/tooltip-wrapping/index.html`)).text();
      const host=document.createElement('sf-tooltip');host.setAttribute('text','Smart: короткая подсказка');host.setAttribute('arrow','none');main.append(host);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const root=host.querySelector('.sf-tooltip'), before=root.getBoundingClientRect().width;
      host.setAttribute('root-style','padding-inline:var(--sf-space-2)');
      host.setAttribute('root-class','max-w-sm');
      host.setAttribute('supporting-text','Изменённый длинный текст '.repeat(15));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const after=root.getBoundingClientRect();
      const ordinary=[...main.querySelectorAll(':scope > div .sf-tooltip')];
      const short=ordinary[0].getBoundingClientRect(), parent=ordinary[0].parentElement.getBoundingClientRect();
      return{shortIntrinsic:short.width<parent.width,smartIntrinsic:before<main.clientWidth,
        rootStable:root===host.querySelector('.sf-tooltip'),authorStyle:root.style.paddingInline==='var(--sf-space-2)',
        bounded:after.left>=0&&after.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth,
        allTextFits:[...main.querySelectorAll('.sf-tooltip-text,.sf-tooltip-supporting-text')].every(e=>e.scrollWidth<=e.clientWidth+1),
        noTabStops:!main.querySelector('button,a[href],input,[tabindex]'),
        noImplicitRole:!root.hasAttribute('role')};
    },{base,theme});
    if(Object.values(row).some(v=>v!==true))failures.push({width,theme,...row});
    results.push({width,theme,...row});
    await page.screenshot({path:`output/playwright/tooltip-wrapping-${width}-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
