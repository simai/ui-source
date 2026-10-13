async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280]) for(const kind of ['ordinary','smart','gallery']) for(const variant of ['normal','hidden','empty']) {
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','component/modal','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(async kind=>{
      document.querySelector('main').innerHTML='<button id="opener">Открыть</button><a href="#after" id="after">После окна</a>';
      document.getElementById('opener').focus();
      if(kind==='ordinary') {
        const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
        window.subject=new Constructor({id:'focus-modal',param:{title:'Фокус',showFooter:false}});
        window.root=()=>subject.template;subject.open({animate:false});
      } else {
        window.subject=document.createElement(kind==='smart'?'sf-modal':'sf-gallery');
        subject.setAttribute('title','Фокус');subject.setAttribute('show-footer','false');
        if(kind==='gallery'){subject.setAttribute('thumbs','false');subject.setAttribute('arrows','false');subject.innerHTML='<div slot="slide">Изображение с описанием</div>';}
        document.querySelector('main').append(subject);
        for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
        window.root=()=>kind==='smart'?subject.getModalRoot():subject.getModal().getModalRoot();
        subject.open();
      }
    },kind);
    await page.waitForFunction(()=>window.root()?.getAttribute('aria-hidden')==='false');
    await page.evaluate(async variant=>{
      for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);
      const panel=root().querySelector('[data-sf-modal-panel]');
      // Focus-only fixture: preserve the real Modal/stack lifecycle but replace
      // descendants after projection settles, independent of slot serialization.
      panel.innerHTML=variant==='empty'?'<p>Только текст</p>':`${variant==='hidden'?'<button hidden>Скрыто</button><button disabled>Недоступно</button>':''}<button id="first">Первое</button><a id="last" href="#last">Последнее</a>${variant==='hidden'?'<a href="#hidden" style="display:none">Скрытая ссылка</a><div inert><button>Инертно</button></div>':''}`;
      panel.focus();
    },variant);
    const states=[];
    for(const action of ['from-panel-back','from-panel-forward','from-first-back','from-last-forward','from-outside']) {
      await page.evaluate(action=>{
        const panel=root().querySelector('[data-sf-modal-panel]');
        (action==='from-outside'?document.getElementById('after'):action==='from-first-back'?panel.querySelector('#first')||panel:action==='from-last-forward'?panel.querySelector('#last')||panel:panel).focus();
      },action);
      await page.keyboard.press(action.endsWith('back')?'Shift+Tab':'Tab');
      const state=await page.evaluate(()=>({inside:root().querySelector('[data-sf-modal-panel]').contains(document.activeElement),id:document.activeElement.id,tag:document.activeElement.tagName}));
      states.push({action,...state});
      const expected=variant==='empty'?'':action.endsWith('back')?'last':'first';
      if(!state.inside||state.id!==expected)failures.push({width,kind,variant,action,expected,...state});
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>root().getAttribute('aria-hidden')==='true'&&root().getAttribute('data-sf-modal-state')==='closed');
    const restored=await page.evaluate(()=>document.activeElement.id==='opener');
    if(!restored)failures.push({width,kind,variant,action:'restore'});
    results.push({width,kind,variant,states,restored});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
