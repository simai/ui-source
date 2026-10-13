async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const dir of ['ltr','rtl'])for(const kind of ['ordinary','smart','smart-actions'])for(const variant of ['short','long','unbroken','custom']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({dir,kind,variant})=>{
      document.documentElement.dir=dir;
      const title=variant==='short'?'Окно 1':variant==='unbroken'?'ДлинныйЗаголовокБезПробелов'.repeat(6):'Подробная информация о настройках проекта и параметрах отображения интерфейса';
      if(kind==='ordinary'){
        const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
        const params={title,showFooter:false};
        if(variant==='custom'){const header=document.createElement('div');header.innerHTML='<h2>Авторская шапка</h2><p>Подзаголовок</p>';params.headerNodes=[header];}
        window.subject=new Constructor({id:'header-test',param:params});window.root=()=>subject.template;
      }else{
        window.subject=document.createElement('sf-modal');subject.setAttribute('title',title);subject.setAttribute('show-footer','false');
        if(kind==='smart-actions')subject.setAttribute('hide','true');
        if(variant==='custom')subject.innerHTML='<div slot="header"><h2>Авторская шапка</h2><p>Подзаголовок</p></div>';
        document.querySelector('main').append(subject);window.root=()=>subject.getModalRoot();
        for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
      }
      subject.open({animate:false});
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
    },{dir,kind,variant});
    const state=await page.evaluate(()=>{
      const modal=root(),panel=modal.querySelector('[data-sf-modal-panel]'),header=modal.querySelector('header'),heading=header.querySelector('h2');
      const range=document.createRange();range.selectNodeContents(heading);
      const text=[...range.getClientRects()];
      const controls=[...header.querySelectorAll('[data-sf-modal-close],[data-sf-modal-hide]')].map(button=>{
        const r=button.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
      });
      const intersects=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
      const p=panel.getBoundingClientRect(),h=header.getBoundingClientRect();
      return{panel:{left:p.left,right:p.right,width:p.width},controls,overlap:controls.some((c,i)=>text.some(t=>intersects(c,t))||controls.slice(i+1).some(other=>intersects(c,other))),textFits:text.every(t=>t.left>=p.left-1&&t.right<=p.right+1),controlsFit:controls.every(c=>c.left>=h.left-1&&c.right<=h.right+1&&c.top>=h.top-1&&c.bottom<=h.bottom+1),documentFits:document.documentElement.scrollWidth<=innerWidth};
    });
    const row={width,dir,kind,variant,...state};results.push(row);
    const expected=kind==='ordinary'&&variant==='custom'?0:kind==='smart-actions'?2:1;
    if(state.overlap||!state.textFits||!state.controlsFit||!state.documentFits||state.panel.left<0||state.panel.right>width||state.controls.length!==expected||state.controls.some(c=>!c.hit||c.width<24||c.height<24))failures.push(row);
    if(width===390&&variant==='short'&&kind==='smart-actions')await page.screenshot({path:`output/playwright/modal-header-${dir}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
