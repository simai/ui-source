async page=>{
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // This local lab swaps built candidates at stable URLs. Always execute the
  // current bytes rather than a prior candidate cached by this owned browser.
  await page.route('**/*', route=>route.continue());
  for(const smart of [false,true])for(const reverse of [false,true]){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.evaluate(()=>{
      window.clickListeners=new Set();const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
      document.addEventListener=(type,fn,options)=>{if(type==='click')clickListeners.add(fn);return add(type,fn,options);};
      document.removeEventListener=(type,fn,options)=>{if(type==='click')clickListeners.delete(fn);return remove(type,fn,options);};
    });
    for(const layer of reverse?['smart','component']:['component','smart'])await page.addScriptTag({url:`${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(smart=>{const main=document.querySelector('main');main.innerHTML='<p id="external-help">Внешняя подсказка</p>';if(smart){const e=document.createElement('sf-country-code');e.setAttribute('label','Телефон');e.setAttribute('hint','Исходная подсказка');e.setAttribute('iso2','RU');main.append(e);}else{const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode');window.instance=new C({param:{label:'Телефон',hint:'Исходная подсказка',iso2:'RU'}});main.append(instance.render());}},smart);
    await page.waitForFunction(()=>typeof document.querySelector('.sf-country-code')?.__sfCountryCodeInput==='function');
    const row=await page.evaluate(async smart=>{
      const root=document.querySelector('.sf-country-code'),input=root.querySelector('input'),host=smart?root.closest('sf-country-code'):root,main=document.querySelector('main');
      const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const update=async(attribute,value)=>{if(smart){const done=new Promise(r=>host.addEventListener('sf-after-render',r,{once:true}));host.setAttribute(attribute,value);await done;}else{let node=root.querySelector(attribute==='hint'?'.sf-country-code-hint':'.sf-country-code-text');if(attribute==='hint'&&!value){node?.remove();}else{if(!node){node=document.createElement('span');node.className='sf-country-code-hint';root.append(node);}node.textContent=value;}}await settle();};
      const links=attr=>(input.getAttribute(attr)||'').split(/\s+/).filter(Boolean);
      const result={};await update('hint','');result.removedHint=links('aria-describedby').length===0;
      await update('hint','Новая подсказка');result.newHint=links('aria-describedby').every(id=>root.contains(document.getElementById(id)))&&links('aria-describedby').length===1;
      input.setAttribute('aria-describedby',[...links('aria-describedby'),'external-help'].join(' '));await settle();await update('hint','');result.externalPreserved=input.getAttribute('aria-describedby')==='external-help';
      await update('hint','Ещё подсказка');result.mergedHint=links('aria-describedby').length===2&&links('aria-describedby').includes('external-help')&&links('aria-describedby').every(id=>document.getElementById(id));
      await update('label','');result.emptyLabel=input.getAttribute('aria-label')==='Телефон'&&!input.hasAttribute('aria-labelledby');
      await update('label','Рабочий телефон');result.restoredLabel=!input.hasAttribute('aria-label')&&links('aria-labelledby').length===1&&document.getElementById(links('aria-labelledby')[0])?.textContent==='Рабочий телефон';
      input.setAttribute('aria-label','Авторское имя');await update('label','Новая подпись');result.authorName=input.getAttribute('aria-label')==='Авторское имя'&&!input.hasAttribute('aria-labelledby');
      input.removeAttribute('aria-label');await settle();result.nameRecovered=links('aria-labelledby').length===1;
      input.setAttribute('aria-labelledby','external-help');await settle();result.authorReference=input.getAttribute('aria-labelledby')==='external-help';input.removeAttribute('aria-labelledby');await settle();
      const clone=root.cloneNode(true);main.append(clone);await settle();const cloneInput=clone.querySelector('input');
      result.cloneBound=typeof clone.__sfCountryCodeInput==='function';
      result.cloneName=clone.contains(document.getElementById(cloneInput.getAttribute('aria-labelledby')));
      result.cloneHint=(cloneInput.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id!=='external-help').every(id=>clone.contains(document.getElementById(id)));
      result.uniqueIds=[...main.querySelectorAll('[id]')].every((node,i,all)=>all.findIndex(n=>n.id===node.id)===i);
      const oldClick=root.__sfCountryCodeDocClick;host.remove();await settle();result.removedBinding=!root.__sfCountryCodeInput&&!clickListeners.has(oldClick);
      main.append(host);await settle();let changes=0;root.addEventListener('change',()=>changes++);
      root.querySelector('[data-iso2="DE"].sf-country-code-item').click();await settle();result.rebound=typeof root.__sfCountryCodeInput==='function'&&root.dataset.iso2==='DE'&&changes===1;
      let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(root,{subtree:true,attributes:true,childList:true,characterData:true});await settle();observer.disconnect();result.idle=mutations===0;
      clone.remove();await settle();return result;
    },smart);
    results.push({smart,reverse,...row});if(!Object.values(row).every(Boolean))failures.push({smart,reverse,...row});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
