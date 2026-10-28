import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(new URL('../src/core/js/loader.js',import.meta.url),'utf8');
const start=source.indexOf('SFLoaderPlugin.prototype.addStyle =');
const end=source.indexOf('SFLoaderPlugin.prototype.addScript =',start);

function fixture(event, {linked = null} = {}) {
  const listeners={};
  const nodes=[];
  const element={addEventListener:(name,fn)=>{listeners[name]=fn;},remove:()=>{nodes.splice(nodes.indexOf(element),1);}};
  const document={createElement:()=>element,getElementsByTagName:()=>[{append:node=>{
    nodes.push(node);
    assert.equal(typeof listeners.load,'function','load listener must precede attachment');
    assert.equal(typeof listeners.error,'function','error listener must precede attachment');
    listeners[event]();
  }}]};
  function SFLoaderPlugin() {}
  SFLoaderPlugin.prototype.versionAssetUrl=url=>`${url}?revision=test`;
  // The page's own <link> of the same sheet (loader.js linkedSheet), and its
  // applied state (sheetApplied): none unless the test gives one.
  const linkedSheet=()=>linked;
  const sheetApplied=link=>(link.sheet?Promise.resolve():new Promise(resolve=>{link.onload=resolve;}));
  vm.runInNewContext(source.slice(start,end),{SFLoaderPlugin,document,linkedSheet,sheetApplied});
  return {loader:new SFLoaderPlugin(),nodes,element};
}

test('failed CSS rejects and removes the failed link before a fallback retry',async()=>{
  const {loader,nodes}=fixture('error');
  await assert.rejects(loader.addStyle('/module.css'),/Failed to load styles/);
  assert.equal(nodes.length,0);
});
test('successful CSS remains attached and uses the versioned URL',async()=>{
  const {loader,nodes,element}=fixture('load');
  await loader.addStyle('/module.css');
  assert.equal(nodes.length,1);
  assert.equal(element.href,'/module.css?revision=test');
});

test('a sheet the page already links is waited for, not linked again',async()=>{
  const link={sheet:{}};
  const {loader,nodes}=fixture('load',{linked:link});
  await loader.addStyle('/module.css');
  assert.equal(nodes.length,0,'no second <link> for a sheet in <head>');
});

test('transient CSS failures do not persist across pages and legacy CSS flags are discarded',()=>{
  const begin=source.indexOf('SFLoaderPlugin.prototype.getPersistentMissingFiles =');
  const finish=source.indexOf('SFLoaderPlugin.prototype.addToMissingFiles =',begin);
  function SFLoaderPlugin() {}
  vm.runInNewContext(source.slice(begin,finish),{SFLoaderPlugin});
  const loader=new SFLoaderPlugin();
  const input={cssOnly:{css:true,missingMin:true},both:{css:true,js:true},jsOnly:{js:true},invalid:null};
  const result=loader.getPersistentMissingFiles(input);
  assert.equal(JSON.stringify(result),JSON.stringify({both:{js:true},jsOnly:{js:true}}));
  assert.equal(input.both.css,true,'must not mutate current-page suppression');
  assert.equal(JSON.stringify(loader.getPersistentMissingFiles(null)),'{}');
});

test('failure recording retains document suppression but persists only the existing JS policy',()=>{
  const begin=source.indexOf('SFLoaderPlugin.prototype.getPersistentMissingFiles =');
  const finish=source.indexOf('SFLoaderPlugin.prototype.getAssetVersion =',begin);
  function SFLoaderPlugin() {this.notFoundFiles={};}
  const writes=[];
  vm.runInNewContext(source.slice(begin,finish),{SFLoaderPlugin,encodeCacheValue:value=>value,safeSetItem:(key,value)=>writes.push({key,value})});
  const loader=new SFLoaderPlugin();
  loader.addToMissingFiles('gap/default','css',true);
  assert.equal(loader.notFoundFiles['gap/default'].missingMin,true);
  assert.equal(writes.at(-1).value,'{}');
  loader.addToMissingFiles('component','js');
  assert.equal(writes.at(-1).value,JSON.stringify({component:{js:true}}));
  assert.equal(writes.at(-1).key,'SF_MISSING_PLUGINS');
});
