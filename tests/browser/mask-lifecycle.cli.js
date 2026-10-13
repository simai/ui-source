// Deliberately resolve real IMask instances out of order through the fixture's
// Core-shaped deferred adapter; this checks consumer ownership, not Core download.
async(page)=>{
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/text-field-reset-lab.html?delayed-mask');
  await page.waitForFunction(()=>window.maskRequests?.filter(e=>e.el.closest('sf-input,sf-textarea')).length>=2);
  await page.evaluate(()=>document.querySelectorAll('sf-input[mask],sf-textarea[mask]').forEach(e=>e.setAttribute('hint','Новая подсказка')));
  await page.waitForFunction(()=>[...document.querySelectorAll('sf-input[mask],sf-textarea[mask]')].every(e=>e.textContent.includes('Новая подсказка')));
  await page.evaluate(async()=>{
    for(const entry of [...window.maskRequests].reverse()) {
      entry.resolve(entry.instance);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  });
  const results=await page.locator('sf-input[mask],sf-textarea[mask]').evaluateAll(es=>es.map(e=>{
    const root=e.querySelector('.sf-input,.sf-textarea');
    const input=root.querySelector('input,textarea');
    const requests=window.maskRequests.filter(entry=>entry.el===input);
    return {id:e.id,requests:requests.length,currentIsNewest:(root.__sfInputMask||root.__sfTextareaMask)===requests.at(-1).instance,
      staleDestroyed:requests.slice(0,-1).every(entry=>entry.destroyed),currentAlive:!requests.at(-1).destroyed};
  }));
  return {status:results.every(r=>r.requests>=2&&r.currentIsNewest&&r.staleDestroyed&&r.currentAlive)?'passed':'failed',results};
}
