async(page)=>{
  await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown'));
  const result=[];
  for(const id of ['base','smart']){
    const button=page.locator(`#${id} .sf-dropdown-field > button`);await button.focus();
    await page.keyboard.press('ArrowDown');
    result.push(await page.locator(`#${id}`).evaluate(e=>({id:e.id,expanded:e.querySelector('.sf-dropdown-field > button').getAttribute('aria-expanded'),
      open:(e.matches('.sf-dropdown')?e:e.querySelector('.sf-dropdown')).classList.contains('sf-dropdown--open'),
      labelledBy:e.querySelector('.sf-dropdown-field > button').getAttribute('aria-labelledby'),
      listRole:e.querySelector('.sf-list-container').getAttribute('role'),optionRole:e.querySelector('.sf-list-item').getAttribute('role')})));
  }
  return result;
}
