async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[];
  for(const theme of ['theme-light','theme-dark']){
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.evaluate(theme=>document.documentElement.className=theme,theme);
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/smart/modal/js/modal.js`});
    const result=await page.evaluate(async()=>{
      document.querySelector('main').innerHTML='<sf-modal title="Цвет действий" hide="true"></sf-modal>';
      const modal=document.querySelector('sf-modal');for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);modal.open({animate:false});for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);
      const root=modal.getModalRoot(),hide=root.querySelector('.sf-modal-hide-icon'),close=root.querySelector('.sf-close-icon'),surface=root.querySelector('[data-sf-modal-surface]');
      return{hide:getComputedStyle(hide).backgroundColor,close:getComputedStyle(close).backgroundColor,surface:getComputedStyle(surface).backgroundColor,role:getComputedStyle(hide).getPropertyValue('--sf-icon--color').trim()};
    });results.push({theme,...result});
  }
  return{status:results.some(row=>row.hide!==row.close)?'failed':'passed',results};
}
