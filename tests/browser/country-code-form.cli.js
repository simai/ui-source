async page => {
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const failures=[],results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['base','smart','markup'])for(const mask of [false,true])for(const external of [false,true]){
    const smart=mode==='smart';
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addScriptTag({url:'http://127.0.0.1:8765/ui-source/node_modules/imask/dist/imask.min.js'});
    await page.evaluate(()=>{window.SF={Mask:{create:async(e,o)=>IMask(e,o),destroy:m=>m?.destroy()}};});
    for(const layer of external?['smart','component']:['component','smart'])await page.addScriptTag({url:`${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(({mode,smart,mask,external})=>{
      const main=document.querySelector('main');main.innerHTML='<form id="phone-form"></form><form id="other-form"></form>';
      const parent=external?main:document.getElementById('phone-form');
      if(smart){const e=document.createElement('sf-country-code');for(const [k,v]of Object.entries({label:'Телефон',name:'phone',value:'+7 9991234567',iso2:'RU',required:'true','use-mask':String(mask),...(external?{form:'phone-form'}:{})}))e.setAttribute(k,v);parent.append(e);}
      else if(mode==='markup') parent.insertAdjacentHTML('beforeend',`<label class="sf-country-code" data-iso2="RU" data-use-mask="${mask}"><span class="sf-country-code-text">Телефон</span><span class="sf-country-code-field"><span class="sf-country-code-left"></span><input type="tel" name="phone" value="+7 9991234567" required ${external?'form="phone-form"':''}></span></label>`);
      else {const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode');window.instance=new C({param:{label:'Телефон',name:'phone',value:'+7 9991234567',iso2:'RU',required:true,useMask:mask,form:external?'phone-form':''}});parent.append(instance.render());}
      window.events={input:0,change:0};for(const key of ['input','change'])main.addEventListener(key,e=>{if(e.target.matches('input'))events[key]++;});
    },{mode,smart,mask,external});
    await page.waitForFunction(mask=>{const r=document.querySelector('.sf-country-code');return r?.dataset.sfCountryCodeBound==='1'&&(!mask||!!r.__sfCountryMask);},mask);
    const row=await page.evaluate(async({smart,mask})=>{
      const r=document.querySelector('.sf-country-code'),input=r.querySelector('input'),form=document.getElementById('phone-form');
      const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const initial={value:input.value,iso2:r.dataset.iso2};
      const result={type:input.type,required:input.required,name:input.name,associated:input.form===form,submitted:new FormData(form).get('phone')===input.value};
      SF.CountryCode.setState(r,{iso2:'DE',value:'+7 5555555555',open:true});await settle();
      if(smart){const e=document.querySelector('sf-country-code'),done=new Promise(resolve=>e.addEventListener('sf-after-render',resolve,{once:true}));e.setAttribute('hint','Новая подсказка');await done;await settle();}
      const edited={value:input.value,iso2:r.dataset.iso2};
      form.addEventListener('reset',e=>e.preventDefault(),{once:true});form.reset();await settle();
      result.cancelled=edited.value===input.value&&edited.iso2===r.dataset.iso2;
      const count={...events};form.reset();await settle();
      result.reset={value:input.value===initial.value,country:r.dataset.iso2===initial.iso2,closed:!r.classList.contains('open'),silent:events.input===count.input&&events.change===count.change,mask:!mask||r.__sfCountryMask?.value===input.value};
      // Native owner changes are respected; reset of the old form cannot reset this field.
      input.setAttribute('form','other-form');SF.CountryCode.setState(r,{value:'+7 2222222222'});await settle();const moved=input.value;
      form.reset();await settle();result.oldOwner=input.value===moved;
      document.getElementById('other-form').reset();await settle();result.newOwner=input.value===initial.value&&r.dataset.iso2===initial.iso2;
      result.explicitDefaults=true;
      if(smart){
        const e=document.querySelector('sf-country-code'),done=new Promise(resolve=>e.addEventListener('sf-after-render',resolve,{once:true}));
        e.setAttribute('iso2','DE');e.setAttribute('value','+49 1511234567');await done;await settle();
        const expected=input.value;SF.CountryCode.setState(r,{iso2:'RU'});await settle();input.form.reset();await settle();
        result.explicitDefaults=r.dataset.iso2==='DE'&&input.value===expected;
        // Restore RU to keep the required-prefix checks independent of country defaults.
        SF.CountryCode.setState(r,{iso2:'RU'});await settle();
      }
      input.disabled=true;result.disabledOmitted=!new FormData(document.getElementById('other-form')).has('phone');input.disabled=false;
      SF.CountryCode.setState(r,{value:'+7 '});await settle();result.prefixInvalid=!input.checkValidity();
      input.required=false;await settle();result.requiredToggle=input.checkValidity();input.required=true;await settle();result.requiredToggle&&=!input.checkValidity();
      input.setCustomValidity('Author validation');SF.CountryCode.setState(r,{value:'+7 1234567890'});await settle();result.authorError=input.validationMessage==='Author validation';
      input.setCustomValidity('');input.required=false;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));result.optionalValid=input.checkValidity();
      return result;
    },{smart,mask});
    const ok=row.type==='tel'&&row.required&&row.name==='phone'&&row.associated&&row.submitted&&row.cancelled&&Object.values(row.reset).every(Boolean)&&row.oldOwner&&row.newOwner&&row.explicitDefaults&&row.disabledOmitted&&row.prefixInvalid&&row.requiredToggle&&row.authorError&&row.optionalValid;
    results.push({mode,smart,mask,external,...row});if(!ok)failures.push({mode,smart,mask,external,...row});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
