// Developer CLI fixture: verify motion without changing saved scenes or board content.
if (app.vault.getName() !== 'Canvas Scenes Review') throw new Error('Wrong vault');
let plugin=app.plugins.getPlugin('canvas-scenes');
const view=app.workspace.getLeavesOfType('canvas')[0].view;
const c=view.canvas, file=view.file, context={view,file,path:file.path,camera:c};
const scenes=plugin.store.scenes(file.path);
if(scenes.length<3)throw new Error('Need at least three scenes');
const win=c.wrapperEl.ownerDocument.defaultView;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pose=()=>({x:c.x,y:c.y,zoom:c.zoom});
const expected=scene=>({x:scene.frame.x+scene.frame.width/2,y:scene.frame.y+scene.frame.height/2,zoom:Math.max(-4,Math.min(1,Math.log2(Math.min(c.canvasRect.width/scene.frame.width,c.canvasRect.height/scene.frame.height))))});
const equal=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.zoom-b.zoom))<1e-7;
const original=pose(),content=await app.vault.read(file),history=JSON.stringify(c.history),metadata=await plugin.loadData();
const tests=[];
const check=(name,pass,details)=>{tests.push({name,pass,details});if(!pass)throw new Error(name)};
const visit=i=>plugin.visit(context,scenes[i]);
const set=i=>{const p=expected(scenes[i]);c.zoomCenter=null;c.setViewport(p.x,p.y,p.zoom)};
let samples=[];
try{
 set(0);await wait(40);const start=pose(),target=expected(scenes[2]);visit(2);
 check('navigation does not teleport at start',equal(pose(),start));
 const began=win.performance.now();
 while(win.performance.now()-began<650){samples.push({elapsed:win.performance.now()-began,...pose()});await wait(16)}
 check('camera travels through intermediate positions',samples.filter(s=>!equal(s,start)&&!equal(s,target)).length>=3);
 check('flight lands on exact saved framing',equal(pose(),target),{target,actual:pose()});
 set(0);await wait(30);visit(2);await wait(90);const interrupted=pose();visit(1);
 check('rapid navigation retargets from current camera',equal(interrupted,pose()));await wait(650);
 check('rapid navigation finishes at newest destination',equal(pose(),expected(scenes[1])));
 // A wheel gesture must hand control back, even when it carries no displacement.
 set(0);await wait(30);visit(2);await wait(90);
 c.wrapperEl.dispatchEvent(new win.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:0}));const stopped=pose();await wait(650);
 check('wheel interaction cancels flight without later snap',equal(pose(),stopped));
 // Capturing mid-flight must stop on one coherent position/zoom snapshot.
 set(0);await wait(30);visit(2);await wait(85);
 const beforeCapture=new Set(plugin.store.scenes(file.path).map(s=>s.id));
 await plugin.saveScene(context);
 const added=plugin.store.scenes(file.path).filter(s=>!beforeCapture.has(s.id));
 if(added.length!==1)throw new Error('Scene collection changed concurrently; no cleanup performed');
 try{
  await wait(650);const b=c.getViewportBBox(),f=added[0].frame;
  check('save during flight freezes the exact captured frame',Math.max(Math.abs(f.x-b.minX),Math.abs(f.y-b.minY),Math.abs(f.width-b.maxX+b.minX),Math.abs(f.height-b.maxY+b.minY))<1e-7);
 }finally{await plugin.deleteScene(context,added[0].id)}
 const matchMedia=win.matchMedia;
 try{
  win.matchMedia=query=>query==='(prefers-reduced-motion: reduce)'?{matches:true}:matchMedia.call(win,query);
  visit(1);check('reduced motion jumps immediately',equal(pose(),expected(scenes[1])));
 }finally{win.matchMedia=matchMedia}
 set(0);await wait(30);visit(2);await wait(90);await app.plugins.disablePlugin('canvas-scenes');const disabled=pose();await wait(650);
 check('disabling plugin cancels active camera frames',equal(pose(),disabled));
 await app.plugins.enablePlugin('canvas-scenes');plugin=app.plugins.getPlugin('canvas-scenes');
 check('unload and reload retain saved scene metadata',JSON.stringify(metadata)===JSON.stringify(await plugin.loadData()));
 check('motion leaves board content and undo history unchanged',content===await app.vault.read(file)&&history===JSON.stringify(c.history));
}finally{c.setViewport(original.x,original.y,original.zoom);if(!app.plugins.getPlugin('canvas-scenes'))await app.plugins.enablePlugin('canvas-scenes')}
return {version:plugin.manifest.version,tests,samples};
