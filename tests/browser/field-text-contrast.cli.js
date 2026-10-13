async(page)=>{
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a=>a.finished.catch(()=>{}))));
  for(const theme of ['light','dark'])for(const appearance of ['bordered','filled'])for(const state of ['enabled','readonly','invalid','disabled']){
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/field-controls-lab.html?${theme==='dark'?'dark&':''}${appearance==='filled'?'filled':''}`);
    await page.waitForFunction(()=>document.querySelector('sf-textarea textarea'));
    await page.evaluate(state=>{
      for(const host of document.querySelectorAll('sf-input,sf-textarea')){
        host.toggleAttribute('error',state==='invalid');host.setAttribute('hint','Подсказка поля');host.setAttribute('placeholder','Введите значение');
        host.toggleAttribute('disabled',state==='disabled');host.toggleAttribute('readonly',state==='readonly');
      }
      for(const selector of ['#email input','#comment textarea','#quantity input']){
        const control=document.querySelector(selector);control.disabled=state==='disabled';control.readOnly=state==='readonly';
        control.closest('.sf-input,.sf-textarea,.sf-quantity').classList.toggle('error',state==='invalid');
        control.placeholder='Введите значение';
      }
    },state);await page.waitForTimeout(90);
    await page.mouse.move(0,0);
    await settle();
    const read=()=>page.evaluate(()=>{
      const parse=value=>{
        const numbers=value.match(/[\d.]+/g)?.map(Number);
        if(!/^rgba?\(/.test(value)||!numbers||numbers.length<3)throw new Error(`Unsupported test color: ${value}`);
        return [...numbers.slice(0,3),numbers[3]??1];
      };
      const over=(front,back)=>{const a=front[3];return [0,1,2].map(i=>front[i]*a+back[i]*(1-a)).concat(1);};
      const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
      const background=node=>{
        const chain=[];for(let e=node;e;e=e.parentElement)chain.unshift(e);
        return chain.reduce((color,e)=>{
          const c=getComputedStyle(e);
          if(c.backgroundImage!=='none'||Number(c.opacity)!==1)throw new Error('Complex paint needs visual contrast audit');
          return over(parse(c.backgroundColor),color);
        },[255,255,255,1]);
      };
      const specs=[['#email','.sf-input','input'],['#comment','.sf-textarea','textarea'],['#quantity','.sf-quantity','input'],['sf-input','.sf-input','input'],['sf-textarea','.sf-textarea','textarea']];
      const rows=[];
      for(const [selector,prefix,controlTag] of specs){
        const host=document.querySelector(selector),root=host.matches(prefix)?host:host.querySelector(prefix);
        const control=root.querySelector(controlTag);
        const probe=document.createElement('span');probe.style.color='var(--sf-on-disable)';root.append(probe);
        const disabledColor=getComputedStyle(probe).color;probe.remove();
        for(const [role,node,pseudo] of [['label',root.querySelector(`${prefix}-text`)],['hint',root.querySelector(`${prefix}-hint-text-wrap`)],['value',control],['placeholder',control,'::placeholder']]){
          if(!node)continue;
          const c=getComputedStyle(node,pseudo),bg=background(node),color=parse(c.color);color[3]*=Number(c.opacity);
          const fg=over(color,bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
          rows.push({selector,role,color:c.color,background:bg,ratio,disabled:control.disabled,disabledColor,fontSize:c.fontSize});
        }
      }
      return rows;
    });
    const record=(rows,interaction)=>{for(const row of rows){const result={theme,appearance,state,interaction,...row};results.push(result);if(!row.disabled&&row.ratio<4.5)failures.push(result);if(row.disabled&&['value','placeholder'].includes(row.role)&&row.color!==row.disabledColor)failures.push({...result,reason:'disabled role changed'});}};
    record(await read(),'rest');
    for(const selector of ['#email','#comment','#quantity','sf-input','sf-textarea']){
      const control=page.locator(selector).locator('input,textarea').first();
      await control.hover();
      await settle();
      record((await read()).filter(r=>r.selector===selector),'hover');
      if(state!=='disabled'){
        await control.focus();await page.keyboard.press('ArrowLeft');
        await settle();
        record((await read()).filter(r=>r.selector===selector),'focus');
      }
      await control.evaluate(e=>e.blur());await page.mouse.move(0,0);
    }
  }
  return {status:failures.length||errors.length?'failed':'passed',checks:results.length,failures,errors,results};
}
