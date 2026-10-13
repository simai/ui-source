import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

for(const [family,name] of [['inputs','Input'],['textarea','Textarea'],['quantity','Quantity']]) {
  test(`${name}: a late mask cannot replace the mask of a newer binding`,async()=>{
    const source=await readFile(new URL(`../src/component/${family}/js/_${family}.js`,import.meta.url),'utf8');
    const pending=[],destroyed=[];
    const native={value:'12',defaultValue:'12',min:'',max:'',step:'1',dataset:{mask:'true',maskPattern:'0000'},
      required:false,classList:{contains:()=>false},addEventListener(){},removeEventListener(){},dispatchEvent(){}};
    const root={dataset:{},classList:{contains:()=>false,add(){},remove(){}},addEventListener(){},removeEventListener(){},querySelector:selector=>[
      '.sf-input-field input, input','textarea','.sf-quantity-wrap input',
    ].includes(selector)?native:null,querySelectorAll:()=>[]};
    // The number's locale comes from the page's language now, not the
    // browser's, so the sandbox carries the rule: a slice of real source
    // without it would be testing a function the component does not have.
    const context=vm.createContext({console,Event,navigator:{language:'en-US'},
      pageLocale:()=>'en-US',
      // The fields ask component/mask-service for SF.Mask, which waits for a
      // Core that runs after them; here Core is already there.
      maskService:async()=>context.window.SF.Mask,
      window:{SF:{Mask:{create:()=>new Promise(resolve=>pending.push(resolve)),destroy:instance=>destroyed.push(instance.id)}}},
      syncFieldContract(){},retireFieldSizeClass(){},bindFormReset:()=>()=>{},HTMLButtonElement:class{},
      MutationObserver:class{observe(){}disconnect(){}},
    });
    const className=name==='Input'?'Inputs':name;
    vm.runInContext(source.slice(source.indexOf('const '),source.indexOf(`\nclass ${className}`)),context);
    context[`bind${name}`](root);
    await new Promise(setImmediate);
    assert.equal(pending.length,1);
    context[`unbind${name}`](root);
    context[`bind${name}`](root);
    await new Promise(setImmediate);
    assert.equal(pending.length,2);
    const newest={id:'new',value:'12',typedValue:12};
    pending[1](newest);await new Promise(setImmediate);
    assert.equal(root[`__sf${name}Mask`],newest);
    pending[0]({id:'old',value:'12',typedValue:12});await new Promise(setImmediate);
    assert.equal(root[`__sf${name}Mask`],newest,'old completion must not replace current owner');
    assert.deepEqual(destroyed,['old']);
    context[`unbind${name}`](root);
    assert.deepEqual(destroyed,['old','new']);
  });
}
