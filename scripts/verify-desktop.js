// Run only in the disposable review vault: node scripts/eval.mjs --file scripts/verify-desktop.js
if (app.vault.getName() !== 'Canvas Scenes Review') throw new Error('Wrong vault');
const p = app.plugins.getPlugin('canvas-scenes');
const wait = () => new Promise(resolve => setTimeout(resolve, 650));
const tests = [];
const check = (name, pass, details) => { tests.push({name, pass, details}); if(!pass) throw new Error(name + ': ' + JSON.stringify(details)); };
const command = async id => {app.commands.executeCommandById('canvas-scenes:' + id);await wait()};
const cameraFrame = c => {const b=c.getViewportBBox();return {x:b.minX,y:b.minY,width:b.maxX-b.minX,height:b.maxY-b.minY}};
const nearFrame = (a,b,c) => Math.max(...Object.keys(a).map(k=>Math.abs(a[k]-b[k])*(2**c.zoom)))<=1;
const file=app.vault.getAbstractFileByPath('Scenes.canvas');
await app.workspace.getLeaf(false).openFile(file);await wait();
let leaf=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file===file);
for(const other of app.workspace.getLeavesOfType('canvas'))if(other!==leaf)other.detach();
await wait();
app.workspace.setActiveLeaf(leaf,{focus:true});
const c=leaf.view.canvas;
const source=await app.vault.read(file),history=JSON.stringify(c.history),selection=JSON.stringify([...c.selection].map(n=>n.id)),readonly=c.readonly;
check('plugin loaded and one navigator',!!p&&document.querySelectorAll('.canvas-scenes-navigator').length===1);
if(!p.store.scenes(file.path).length)for(const [x,y,z] of [[-710.25,-180.5,-0.4],[780,240,-0.2],[2350,725,-0.6]]){
 c.setViewport(x,y,z);await wait();const expected=cameraFrame(c);await command('save-scene');const saved=p.store.scenes(file.path).at(-1);check('save frame '+saved.name,nearFrame(expected,saved.frame,c));
}
const scenes=[...p.store.scenes(file.path)];
p.visit({view:leaf.view,file,path:file.path,camera:c},scenes[2]);await wait();
check('next stops at final scene',!app.commands.commands['canvas-scenes:next-scene'].checkCallback(true));
await command('previous-scene');check('previous returns to scene two',nearFrame(cameraFrame(c),scenes[1].frame,c));
await command('previous-scene');check('previous returns to scene one',nearFrame(cameraFrame(c),scenes[0].frame,c));
check('previous stops at first scene',!app.commands.commands['canvas-scenes:previous-scene'].checkCallback(true));
c.setViewport(3000,2000,-1);await wait();await command('next-scene');check('manual pan retains navigation anchor',nearFrame(cameraFrame(c),scenes[1].frame,c));
// Sidebar width changes must contain the saved rectangle.
app.workspace.leftSplit.collapse();await wait();await command('previous-scene');
const resized=cameraFrame(c),saved=scenes[0].frame;
check('sidebar resize contains frame',resized.x<=saved.x+1e-6&&resized.y<=saved.y+1e-6&&resized.x+resized.width>=saved.x+saved.width-1e-6&&resized.y+resized.height>=saved.y+saved.height-1e-6);
app.workspace.leftSplit.expand();await wait();
const originalPose={x:c.x,y:c.y,zoom:c.zoom};
const second=app.workspace.getLeaf('split');await second.openFile(file);await wait();
app.workspace.setActiveLeaf(second,{focus:true});await command('next-scene');
const secondCamera=second.view.canvas,secondFrame=cameraFrame(secondCamera),firstFrame=scenes[0].frame;
check('second pane starts from first scene with frame contained',Math.abs(secondCamera.x-(firstFrame.x+firstFrame.width/2))<1e-6&&Math.abs(secondCamera.y-(firstFrame.y+firstFrame.height/2))<1e-6&&secondFrame.width>=firstFrame.width-1e-6&&secondFrame.height>=firstFrame.height-1e-6);
check('second pane does not move first pane',JSON.stringify(originalPose)===JSON.stringify({x:c.x,y:c.y,zoom:c.zoom}));
check('two panes have separate navigators',document.querySelectorAll('.canvas-scenes-navigator').length===2);
second.detach();app.workspace.setActiveLeaf(leaf,{focus:true});await wait();
check('closing pane cleans its navigator',document.querySelectorAll('.canvas-scenes-navigator').length===1);
await command('toggle-navigator');check('hide navigator leaves commands usable',!document.querySelector('.canvas-scenes-navigator')&&app.commands.commands['canvas-scenes:save-scene'].checkCallback(true));
await command('toggle-navigator');
// The saved list must follow both file and folder renames.
if(!app.vault.getAbstractFileByPath('Rename check'))await app.vault.createFolder('Rename check');
await app.vault.rename(file,'Rename check/Moved.canvas');await wait();
check('file move retains scenes',p.store.scenes(file.path).length===3);
await app.vault.rename(app.vault.getAbstractFileByPath('Rename check'),'Renamed folder');await wait();
check('folder rename retains scenes',p.store.scenes(file.path).length===3);
await app.vault.rename(file,'Scenes.canvas');await wait();
// Simulate a write failure through the real command, retaining durable state.
const write=p.store.save;p.store.save=async()=>{throw new Error('Verification: simulated write failure')};
try{await command('save-scene');check('failed save does not add scene',p.store.scenes(file.path).length===3)}finally{p.store.save=write}
check('scene operations preserve content and undo history',source===await app.vault.read(file)&&history===JSON.stringify(c.history)&&selection===JSON.stringify([...c.selection].map(n=>n.id))&&readonly===c.readonly);
await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath('Reference.md'));await wait();
check('scene save unavailable in Markdown',!app.commands.commands['canvas-scenes:save-scene'].checkCallback(true));
check('navigator absent in Markdown',!document.querySelector('.canvas-scenes-navigator'));
await app.workspace.getLeaf(false).openFile(file);await wait();
leaf=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file===file);app.workspace.setActiveLeaf(leaf,{focus:true});
await command('next-scene');
for(const [id,key,modifiers] of [['save-scene','S',['Mod','Shift']],['previous-scene','ArrowLeft',['Mod','Alt']],['next-scene','ArrowRight',['Mod','Alt']]])app.hotkeyManager.setHotkeys('canvas-scenes:'+id,[{modifiers,key}]);
await app.hotkeyManager.save();
return {title:document.title,tests,scenes:p.store.scenes(file.path),hotkeys:app.hotkeyManager.getHotkeys('canvas-scenes:save-scene')};
