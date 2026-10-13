async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const variants=[['default','primary'],['default','on-surface'],['tonal','secondary'],['tonal','on-surface'],['outline','primary'],['outline','on-surface'],['link','primary'],['link','on-surface']];
  for(const theme of ['theme-light','theme-dark']){
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.evaluate(theme=>document.documentElement.className=theme,theme);
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const [type,scheme] of variants)for(const state of ['rest','hover','active','focus','disabled']){
      await page.evaluate(({type,scheme,state})=>{
        const classes=`sf-icon-button sf-icon-button--${type} sf-icon-button--${scheme} sf-icon-button--size-1/3 ${state==='active'?'active':''}`;
        document.querySelector('main').innerHTML=`<button id="normal" class="${classes} sf-icon-button--icon"><span class="sf-icon">remove</span></button><button id="custom" class="${classes} sf-icon-button--icon sf-modal-header-action"><span class="sf-modal-hide-icon"></span></button><button id="close" class="${classes} sf-icon-button--close"><span class="sf-close sf-close--size-1/3"><span class="sf-close-icon"></span></span></button>`;
        if(state==='disabled')document.querySelectorAll('button').forEach(b=>b.disabled=true);
      },{type,scheme,state});
      const paints={};
      for(const id of ['normal','custom','close']){
        if(state==='hover')await page.locator(`#${id}`).hover();
        else if(state==='focus')await page.locator(`#${id}`).focus();
        else await page.mouse.move(1,1);
        paints[id]=await page.evaluate(id=>{const b=document.getElementById(id),g=b.querySelector('span:last-child'),s=getComputedStyle(g),r=g.getBoundingClientRect();return{color:id==='normal'?s.color:id==='close'?getComputedStyle(b.querySelector('.sf-close-icon')).backgroundColor:s.backgroundColor,background:getComputedStyle(b).backgroundColor,width:r.width,height:r.height};},id);
      }
      const row={theme,type,scheme,state,...paints};results.push(row);
      if(paints.custom.color!==paints.normal.color||paints.close.color!==paints.normal.color||paints.custom.width<=0||paints.custom.height<=0||paints.custom.height>=paints.custom.width)failures.push(row);
    }
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
