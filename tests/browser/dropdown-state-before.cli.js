async(page)=>{
  await page.setViewportSize({width:900,height:1000});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown'));
  await page.locator('#base .sf-dropdown-field').click();
  await page.locator('#base [data-value="kazan"]').click();
  const display=await page.locator('#base .sf-dropdown-field input:not([type="hidden"])').inputValue();
  await page.locator('#base .sf-dropdown-field').click();
  await page.locator('#base .sf-list .sf-input input').fill('Каз');
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const base=await page.locator('#base').evaluate(r=>({disabled:r.classList.contains('disabled'),open:r.classList.contains('sf-dropdown--open'),query:r.querySelector('.sf-list input').value}));
  const smart=await page.locator('#smart-tag').evaluate(async e=>{
    const before=e.hiddenValue;e.setAttribute('value','');await new Promise(requestAnimationFrame);
    return {before,after:e.hiddenValue,form:[...new FormData(e.closest('form'))]};
  });
  return {display,base,oneDisabled:await page.locator('#one .sf-dropdown-field input:not([type="hidden"])').isDisabled(),smart};
}
