if (app.vault.getName() !== 'Canvas Scenes Review') throw new Error('Wrong vault');
const wait = () => new Promise(resolve => setTimeout(resolve,180));
const tests=[];
const check=(name,pass)=>{tests.push({name,pass});if(!pass)throw new Error(name)};
let p=app.plugins.getPlugin('canvas-scenes');
const original=JSON.stringify(p.store.scenes('Scenes.canvas'));
await app.plugins.disablePlugin('canvas-scenes');
check('disable removes navigator and commands',!document.querySelector('.canvas-scenes-navigator')&&!app.commands.commands['canvas-scenes:save-scene']);
await app.plugins.enablePlugin('canvas-scenes');await wait();p=app.plugins.getPlugin('canvas-scenes');
check('enable restores durable scenes without duplicate controls',JSON.stringify(p.store.scenes('Scenes.canvas'))===original&&document.querySelectorAll('.canvas-scenes-navigator').length===1);
const leaf=app.workspace.getLeavesOfType('canvas')[0];
const c=leaf.view.canvas,file=leaf.view.file;
const dataPath=p.manifest.dir+'/data.json';
const metadata=await app.vault.adapter.read(dataPath);
app.commands.executeCommandById('canvas-scenes:next-scene');await wait();
check('scene navigation does not write metadata',metadata===await app.vault.adapter.read(dataPath));
const get=c.getViewportBBox;
try{c.getViewportBBox=undefined;p.refresh();check('unsupported camera disables actions',!document.querySelector('.canvas-scenes-navigator')&&!app.commands.commands['canvas-scenes:save-scene'].checkCallback(true));check('unsupported camera retains metadata',metadata===await app.vault.adapter.read(dataPath))}finally{c.getViewportBBox=get;p.refresh()}
const board=await app.vault.read(file),history=JSON.stringify(c.history);
c.setReadonly(true);
try{
 app.commands.executeCommandById('canvas-scenes:save-scene');await wait();
 const scenes=p.store.scenes(file.path);check('read-only canvas can save a view',scenes.length===4&&c.readonly);
 await p.deleteScene({view:leaf.view,file,path:file.path,camera:c},scenes.at(-1).id);
 check('read-only canvas remains unchanged',board===await app.vault.read(file)&&history===JSON.stringify(c.history)&&c.readonly);
}finally{c.setReadonly(false)}
const backup=await app.vault.adapter.read(dataPath);
try{
 await app.plugins.disablePlugin('canvas-scenes');
 const future=JSON.stringify({version:999,settings:{showNavigator:true},canvases:{}});
 await app.vault.adapter.write(dataPath,future);
 await app.plugins.enablePlugin('canvas-scenes');await wait();p=app.plugins.getPlugin('canvas-scenes');
 check('future schema loads in protected mode',!p.store.writable&&!app.commands.commands['canvas-scenes:save-scene'].checkCallback(true));
 try{await p.store.update(d=>{d.settings.showNavigator=false})}catch{}
 check('protected mode preserves exact stored bytes',future===await app.vault.adapter.read(dataPath));
}finally{
 await app.plugins.disablePlugin('canvas-scenes');await app.vault.adapter.write(dataPath,backup);await app.plugins.enablePlugin('canvas-scenes');await wait();p=app.plugins.getPlugin('canvas-scenes');
}
check('original scenes restored after protected-mode test',JSON.stringify(p.store.scenes('Scenes.canvas'))===original);
await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath('Reference.md'));await wait();
await app.workspace.getLeaf(false).openFile(file);await wait();
check('normal canvas reopen has one working navigator',document.querySelectorAll('.canvas-scenes-navigator').length===1&&app.commands.commands['canvas-scenes:save-scene'].checkCallback(true));
const notes=[...document.querySelectorAll('.notice')].map(el=>el.textContent);
for (const name of ['Renamed folder','Rename check']) {const folder=app.vault.getAbstractFileByPath(name);if(folder?.children?.length===0)await app.vault.trash(folder,true)}
return {tests,notices:notes};
