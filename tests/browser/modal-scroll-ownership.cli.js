async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const lower of ['ordinary','smart'])for(const upper of ['ordinary','smart'])for(const initial of ['normal','locked','author-change'])for(const order of ['top-first','owner-first']){
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    const row=await page.evaluate(async({lower,upper,initial,order})=>{
      const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
      const main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button>';
      main.style.minHeight='200vh';document.body.style.setProperty('padding-inline-end','7px','important');
      if(initial==='locked')for(const node of [document.documentElement,document.body])node.classList.add('overflow-hidden');
      const snapshot=()=>({html:document.documentElement.classList.contains('overflow-hidden'),body:document.body.classList.contains('overflow-hidden'),padding:document.body.style.getPropertyValue('padding-inline-end'),priority:document.body.style.getPropertyPriority('padding-inline-end'),computed:parseFloat(getComputedStyle(document.body).paddingInlineEnd)});
      const before=snapshot(),gap=Math.max(0,innerWidth-document.documentElement.clientWidth);
      const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1],items=[];
      for(const [index,kind]of [lower,upper].entries()){
        let instance;
        if(kind==='ordinary')instance=new Constructor({id:`scroll-${index}`,param:{title:'Проверка прокрутки',showFooter:false}});
        else{instance=document.createElement('sf-modal');instance.setAttribute('title','Проверка прокрутки');main.append(instance);}
        items.push({instance,kind});await frames(5);instance.open({animate:false});await frames(5);
      }
      const opened=snapshot();
      if(initial==='author-change')document.body.style.setProperty('padding-inline-end','13px','important');
      const remove=item=>item.kind==='ordinary'?item.instance.destroy():item.instance.remove();
      const sequence=order==='owner-first'?[0,1]:[1,0];
      remove(items[sequence[0]]);await frames(5);const middle=snapshot();
      remove(items[sequence[1]]);await frames(5);const after=snapshot();
      const expectedPadding=initial==='author-change'?'13px':'7px';
      const ok=opened.html&&opened.body&&Math.abs(opened.computed-before.computed-gap)<0.1&&middle.html&&middle.body&&after.html===before.html&&after.body===before.body&&after.padding===expectedPadding&&after.priority==='important';
      return{ok,gap,before,opened,middle,after};
    },{lower,upper,initial,order});
    results.push({width,lower,upper,initial,order,...row});if(!row.ok)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
