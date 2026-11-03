async page => {
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
  await page.addStyleTag({url:`${base}/component/country-code/css/country-code.css`});
  await page.addScriptTag({url:`${base}/smart/input-country/js/input-country.js`});
  await page.evaluate(() => {document.querySelector('main').innerHTML='<sf-input-country label="Телефон" iso2="RU" max-items="3"></sf-input-country>';});
  const toggle=page.locator('.sf-country-code-left'); await toggle.focus(); await page.keyboard.press('Enter');
  const open=await page.locator('sf-input-country').evaluate(e=>e.state.open);
  await page.keyboard.press('ArrowDown');
  const result=await page.locator('sf-input-country').evaluate(e=>{
    const t=e.querySelector('.sf-country-code-left'),input=e.querySelector('input');
    return {expanded:t.getAttribute('aria-expanded'),controls:t.getAttribute('aria-controls'),toggleName:t.getAttribute('aria-label'),
      focusOnToggle:document.activeElement===t,options:e.querySelectorAll('[role="option"]').length,
      tabbableItems:[...e.querySelectorAll('.sf-country-code-item')].filter(i=>i.tabIndex>=0).length,
      inputLabel:input.getAttribute('aria-labelledby'),nativeRequired:input.required};
  });
  await page.keyboard.press('Escape');
  return {status:'audit',openWithEnter:open,closedWithEscape:await page.locator('sf-input-country').evaluate(e=>!e.state.open),...result};
}
