async(page)=>{
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-state-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider')?.noUiSlider);
  const results=[];
  const record=async(label,id,expected)=>{
    const current=await page.locator(`#${id}`).evaluate(e=>{
      const root=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
      return {actual:SF.RangeSlider.getValue(root),projected:root.dataset.value,
        attribute:e.matches('sf-range-slider')?e.getAttribute('value'):null,
        public:e.matches('sf-range-slider')?e.value:null,
        handles:root.querySelectorAll('[role="slider"]').length};
    });
    if(JSON.stringify(current.actual)!==JSON.stringify(expected))throw new Error(`${label}: ${JSON.stringify(current)}`);
    const serialized=Array.isArray(expected)?expected.join(','):String(expected);
    if(current.projected!==serialized||current.public!==null&&current.public!==serialized)throw new Error(`${label} projection`);
    if(current.attribute!==null&&current.attribute!==serialized)throw new Error(`${label} attribute`);
    results.push({label,...current});
  };
  await record('scientific initial','scientific',0.002);
  await page.locator('#scientific [role="slider"]').focus();await page.keyboard.press('ArrowRight');
  await record('scientific keyboard','scientific',0.003);
  if(await page.locator('#scientific .sf-thumb-text').textContent()!=='0.003')throw new Error('Scientific label');
  for(const [id,values,expected] of [
    ['base-multiple',[30,70],[30,70]],['base-multiple','40,60',[40,60]],
    ['smart-multiple',[30,70],[30,70]],['smart-multiple','40,60',[40,60]],
    ['smart-multiple',[-20,120],[0,100]],['smart-multiple',[32,68],[30,70]],
  ]) {
    await page.locator(`#${id}`).evaluate((e,value)=>e.matches('sf-range-slider')?e.setValue(value):SF.RangeSlider.setValue(e,value),values);
    await record(`${id} set ${JSON.stringify(values)}`,id,expected);
  }
  await page.locator('#smart-multiple').evaluate(e=>e.setAttribute('value','15,85'));
  await page.waitForFunction(()=>document.getElementById('smart-multiple').getValue().join(',')==='15,85');
  await record('attribute setter','smart-multiple',[15,85]);
  await page.locator('#smart-auto').evaluate(e=>e.value=[25,75]);
  await page.waitForFunction(()=>document.querySelectorAll('#smart-auto [role="slider"]').length===2);
  await record('automatic two handles','smart-auto',[25,75]);
  await page.locator('#smart-auto').evaluate(e=>e.value=40);
  await page.waitForFunction(()=>document.querySelectorAll('#smart-auto [role="slider"]').length===1);
  await record('automatic single handle','smart-auto',40);
  await page.locator('#smart-multiple').evaluate(e=>e.setAttribute('margin','20'));
  await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider').getAttribute('data-margin')==='20');
  await page.locator('#smart-multiple').evaluate(e=>e.setValue([40,45]));
  const constrained=await page.locator('#smart-multiple').evaluate(e=>({actual:e.getValue(),attribute:e.getAttribute('value'),public:e.value}));
  if(constrained.actual[1]-constrained.actual[0]<20||constrained.actual.join(',')!==constrained.attribute||constrained.public!==constrained.attribute)throw new Error('Margin constraint reflection');
  results.push({label:'margin reflection',...constrained});
  return {status:'passed',checks:results.length,results};
}
