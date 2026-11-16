if (app.vault.getName() !== 'Canvas Scenes Review') throw new Error('Wrong vault');
const view = app.workspace.getLeavesOfType('canvas')[0].view;
const c = view.canvas;
const wait = () => new Promise(resolve => setTimeout(resolve, 180));
const source = await app.vault.read(view.file);
const history = JSON.stringify(c.history);
const selection = [...c.selection].map(n=>n.id);
const readonly = c.readonly;
const original = { x:c.x,y:c.y,zoom:c.zoom };
const frame = () => {const b=c.getViewportBBox();return {x:b.minX,y:b.minY,width:b.maxX-b.minX,height:b.maxY-b.minY}};
const restore = f => {c.zoomCenter=null;c.setViewport(f.x+f.width/2,f.y+f.height/2,Math.max(-4,Math.min(1,Math.log2(Math.min(c.canvasRect.width/f.width,c.canvasRect.height/f.height)))))};
const result = {version:document.title,methods:{setViewport:c.setViewport.toString(),getViewportBBox:c.getViewportBBox.toString(),zoomToBbox:c.zoomToBbox.toString()},tests:[]};
try {
 c.setViewport(-610.25,-145.75,Math.log2(0.8)); await wait();
 const saved=frame();
 c.setViewport(2400,700,-1.6);await wait();restore(saved);await wait();
 const returned=frame();const scale=2**c.zoom;
 const error=Math.max(...Object.keys(saved).map(k=>Math.abs(saved[k]-returned[k])*scale));
 result.tests.push({name:'same viewport',saved,returned,errorCssPixels:error,pass:error<=1});
 const style=c.wrapperEl.getAttribute('style');
 try {
  c.wrapperEl.style.width='470px';c.wrapperEl.style.height='430px';c.onResize();await wait();restore(saved);await wait();
  const r=frame();const centerError=Math.hypot(r.x+r.width/2-saved.x-saved.width/2,r.y+r.height/2-saved.y-saved.height/2);
  result.tests.push({name:'different aspect ratio',canvasRect:c.canvasRect,saved,returned:r,pass:r.x<=saved.x+1e-7&&r.y<=saved.y+1e-7&&r.x+r.width>=saved.x+saved.width-1e-7&&r.y+r.height>=saved.y+saved.height-1e-7&&centerError<1e-6});
 }finally{if(style===null)c.wrapperEl.removeAttribute('style');else c.wrapperEl.setAttribute('style',style);c.onResize();await wait()}
 for(const [name,zoom] of [['minimum native zoom',-8],['maximum native zoom',5]]){c.setViewport(0,0,0);await wait();c.tZoom=zoom;c.markViewportChanged();await wait();result.tests.push({name,target:c.tZoom,pass:c.tZoom===(zoom<0?-4:1)})}
 result.tests.push({name:'content, history, selection and read-only unchanged',pass:source===await app.vault.read(view.file)&&history===JSON.stringify(c.history)&&JSON.stringify(selection)===JSON.stringify([...c.selection].map(n=>n.id))&&readonly===c.readonly});
}finally{c.setViewport(original.x,original.y,original.zoom)}
return result;
