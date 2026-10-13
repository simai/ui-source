async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const variant of ['checked','unchecked','different-forms','unnamed','disabled-checked','dynamic']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({kind,variant})=>{
      document.querySelector('main').innerHTML='<button id="opener">Открыть</button><button id="outside">После окна</button>';
      document.getElementById('opener').focus();
      if(kind==='ordinary'){const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];window.subject=new Constructor({id:'radio-modal',param:{title:'Выбор',showFooter:false}});window.root=()=>subject.template;}
      else{window.subject=document.createElement('sf-modal');subject.setAttribute('title','Выбор');document.querySelector('main').append(subject);window.root=()=>subject.getModalRoot();}
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);subject.open({animate:false});for(let i=0;i<10;i++)await new Promise(requestAnimationFrame);
      window.panel=root().querySelector('[data-sf-modal-panel]');
      const name=variant==='unnamed'?'':'name="delivery"';
      const first=`<label><input id="one" type="radio" ${name}>Первый</label>`;
      const second=`<label><input id="two" type="radio" ${name} ${['checked','dynamic','disabled-checked'].includes(variant)?'checked':''} ${variant==='disabled-checked'?'disabled':''}>Второй</label>`;
      const third=`<label><input id="three" type="radio" ${name}>Третий</label>`;
      panel.innerHTML=variant==='different-forms'?`<form>${first}</form><form>${second}</form><form>${third}</form>`:first+second+third;
      panel.focus();
    },{kind,variant});
    const first=variant==='checked'||variant==='dynamic'?'two':'one',last=variant==='checked'||variant==='dynamic'?'two':'three';
    const row={width,kind,variant,states:[]};
    for(const [action,key,target,expected] of [['entry','Tab',null,first],['reverse-entry','Shift+Tab',null,last],['forward-wrap','Tab',last,first],['backward-wrap','Shift+Tab',first,last]]){
      await page.evaluate(id=>(id?document.getElementById(id):panel).focus(),target);await page.keyboard.press(key);
      const state=await page.evaluate(()=>({id:document.activeElement.id,inside:panel.contains(document.activeElement)}));row.states.push({action,...state});if(!state.inside||state.id!==expected)failures.push({width,kind,variant,action,expected,...state});
    }
    if(variant==='dynamic'){
      await page.evaluate(()=>document.getElementById('two').focus());await page.keyboard.press('ArrowRight');
      const arrow=await page.evaluate(()=>({id:document.activeElement.id,checked:document.querySelector('input:checked').id}));
      await page.keyboard.press('Tab');const after=await page.evaluate(()=>document.activeElement.id);
      row.arrow={...arrow,after};if(arrow.id!=='three'||arrow.checked!=='three'||after!=='three')failures.push({width,kind,variant,action:'arrow-and-wrap',...row.arrow});
    }
    results.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
