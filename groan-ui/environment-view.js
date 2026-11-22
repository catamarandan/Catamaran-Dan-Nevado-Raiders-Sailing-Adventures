import {START,GIBS,LAYERS,REGIONS,availableDate,mapURL,nativeURL,parseNative,color,currentPlotURL} from './environment-data.mjs';
const root=document.querySelector('#environment-comparison');
if(root) init().catch(()=>{root.querySelector('[data-env-message]').textContent='Comparison sources could not be initialized. Source links remain available.';});
async function init(){
 const [saved,land]=await Promise.all([fetch(new URL('./environment-metadata.json',import.meta.url)).then(r=>r.json()),fetch(new URL('./land-110m.geojson',import.meta.url)).then(r=>r.json())]);
 let capabilityPromise=null;
 async function gibsMetadata(name){
  if(!capabilityPromise) capabilityPromise=fetch(GIBS+'?SERVICE=WMS&REQUEST=GetCapabilities',{signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error();return r.text();}).then(t=>new DOMParser().parseFromString(t,'application/xml')).catch(()=>null);
  const doc=await capabilityPromise;
  if(doc){
   const layer=[...doc.getElementsByTagName('Layer')].find(el=>[...el.children].find(c=>c.localName==='Name')?.textContent===name);
   const dim=layer?.getElementsByTagName('Dimension')[0],legend=layer?.getElementsByTagName('LegendURL')[0]?.getElementsByTagName('OnlineResource')[0];
   if(dim)return {latest:dim.getAttribute('default'),intervals:dim.textContent,legend:legend?.getAttributeNS('http://www.w3.org/1999/xlink','href'),fresh:true};
  }
  if(!saved.layers[name])throw Error('Missing source metadata');
  return {...saved.layers[name],fresh:false};
 }
 const state=[];
 for(const [index,panel] of [...root.querySelectorAll('[data-env-panel]')].entries()){
  const $=key=>panel.querySelector('[data-env-'+key+']'),select=$('layer'),date=$('date'),canvas=$('canvas'),ctx=canvas.getContext('2d');
  canvas.width=900;canvas.height=450;
  for(const [key,layer] of Object.entries(LAYERS)){const opt=document.createElement('option');opt.value=key;opt.textContent=layer.name;select.append(opt);}
  select.value=index?'heat':'temperature';date.min=START;date.max=new Date().toISOString().slice(0,10);date.value=new Date(Date.now()-86400000).toISOString().slice(0,10);
  let token=0,controller=null,latest=true,data=null,currentLayer=null,image=null,box=REGIONS.global.box;
  function geography(fill=true){
   ctx.strokeStyle='#9bb6b7';ctx.lineWidth=.65;ctx.fillStyle='#35504f';
   for(const feature of land.features){const polys=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const poly of polys){ctx.beginPath();for(const ring of poly)ring.forEach(([lon,lat],i)=>{const p=project(lon,lat);i?ctx.lineTo(...p):ctx.moveTo(...p);});if(fill)ctx.fill('evenodd');ctx.stroke();}}
  }
  function project(lon,lat){return [(lon-box[0])/(box[2]-box[0])*900,(box[3]-lat)/(box[3]-box[1])*450];}
  function draw(){
   ctx.fillStyle='#102632';ctx.fillRect(0,0,900,450);
   if(!currentLayer)return;
   if(image){geography();ctx.drawImage(image,0,0,900,450);geography(false);return;}
   if(data){
    const dx=currentLayer.spacing/(box[2]-box[0])*900,dy=currentLayer.spacing/(box[3]-box[1])*450;
    for(const r of data.rows){if(r.value===null||r.lon<box[0]||r.lon>box[2]||r.lat<box[1]||r.lat>box[3])continue;const [x,y]=project(r.lon,r.lat);ctx.fillStyle=color(r.value,currentLayer.min,currentLayer.max);ctx.fillRect(x-dx/2,y-dy/2,dx+.5,dy+.5);}
    geography();
    if(currentLayer.second)for(let i=0;i<data.rows.length;i+=12){const r=data.rows[i];if(r.value===null||Math.round(r.lat+64.7)%8!==0)continue;const [x,y]=project(r.lon,r.lat),angle=Math.atan2(-r.v,r.u),len=6+Math.min(r.value,1.5)*8;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-len/2,0);ctx.lineTo(len/2,0);ctx.lineTo(len/2-3,-3);ctx.moveTo(len/2,0);ctx.lineTo(len/2-3,3);ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();}
   }else geography();
  }
  async function load(){
   const mine=++token;controller?.abort();controller=new AbortController();const request=controller;const timeout=setTimeout(()=>request.abort(),90000);
   currentLayer=LAYERS[select.value];const layer=currentLayer;box=REGIONS[root.querySelector('#environment-region').value].box;
   canvas.hidden=!!layer.providerPlot;$('plot').hidden=true;data=null;image=null;draw();$('status').textContent='Loading source data…';$('value').textContent='';$('date-shown').textContent='Date pending';$('legend-image').hidden=true;$('legend-native').hidden=true;
   $('type').textContent=layer.type;$('cadence').textContent=layer.cadence;$('description').textContent=layer.description;$('question').textContent=layer.question;$('source').href=layer.source;$('source').textContent='Source and methodology';
   try{
    if(layer.providerPlot){
     const img=new Image(),url=currentPlotURL(layer,latest?null:date.value,box);
     await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Provider map unavailable'));request.signal.addEventListener('abort',()=>reject(Error('Timeout')),{once:true});img.src=url;});
     if(mine!==token)return;
     const plot=$('plot');plot.src=url;plot.alt='NOAA geostrophic-current vectors with the observation date and velocity scale printed on the map';plot.hidden=false;
     $('date-shown').textContent=latest?'Latest source map · observation date printed on map':'Requested '+date.value+' · verify the actual date printed on the source map';
     $('status').textContent='NOAA source map loaded. The provider prints its observation date and vector scale on the map; this is not a forecast.';
     $('value').textContent='Current direction and magnitude are shown by the provider’s arrows. Exact point values are not extracted in this view.';
    }else if(layer.gibs){
     const meta=await gibsMetadata(layer.gibs);if(mine!==token)return;
     const resolved=availableDate(meta.intervals,latest?[meta.latest,new Date().toISOString().slice(0,10)].sort()[0]:date.value);
     if(latest)date.value=resolved;
     $('date-shown').textContent=`Source date: ${resolved} · ${layer.units}`;
     const url=mapURL(layer,resolved,box),img=new Image();
     await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Image unavailable'));controller.signal.addEventListener('abort',()=>reject(Error('Timeout')),{once:true});img.src=url;});
     if(mine!==token)return;image=img;draw();
     $('legend-image').src=meta.legend;$('legend-image').alt=layer.name+' provider color scale in '+layer.units;$('legend-image').hidden=false;
     $('status').textContent=`Source map loaded${resolved!==date.value?' for the available date at or before your selection':''}. ${meta.fresh?'Availability checked this visit.':'Availability metadata saved '+saved.checkedAt+'.'} Blank areas may have no retrieval; they are not zero.`;
     $('value').textContent='Read this satellite/model map using its provider legend. Exact point values are not extracted in this view.';
    }else{
     const response=await fetch(nativeURL(layer,latest?null:date.value),{signal:controller.signal,credentials:'omit'});if(!response.ok)throw Error('Source unavailable');
     const parsed=parseNative(await response.json(),layer);if(mine!==token)return;
     if(!latest&&parsed.time.slice(0,10)!==date.value)throw Error('Requested date is unavailable');
     data=parsed;if(latest)date.value=data.time.slice(0,10);draw();
     $('date-shown').textContent=`Observed: ${data.time.replace('T',' ').replace('Z',' UTC')} · ${layer.units}`;
     $('status').textContent=`Numerical source loaded · ${data.rows.filter(r=>r.value!==null).length.toLocaleString()} valid samples · 1° display spacing. Blank areas have no displayed value.`;
     const legend=$('legend-native');legend.hidden=false;legend.querySelector('span').textContent=layer.min+' '+layer.units;legend.querySelector('span:last-child').textContent=layer.max+' '+layer.units+' or higher';
     $('value').textContent='Click the map to inspect a displayed source sample.';
    }
   }catch(e){if(mine!==token)return;console.warn('GROAN environmental source:',select.value,e.message);data=null;image=null;draw();$('date-shown').textContent='No observation loaded';$('status').textContent='This source or date is unavailable. Try Latest available or reload later; no replacement values have been invented.';$('value').textContent='';}
   finally{clearTimeout(timeout);}
  }
  select.addEventListener('change',()=>{latest=true;load();});date.addEventListener('change',()=>{if(date.checkValidity()){latest=false;load();}});
  $('latest').addEventListener('click',()=>{latest=true;load();});$('refresh').addEventListener('click',load);
  canvas.addEventListener('click',e=>{if(!data)return;const b=canvas.getBoundingClientRect(),lon=box[0]+(e.clientX-b.left)/b.width*(box[2]-box[0]),lat=box[3]-(e.clientY-b.top)/b.height*(box[3]-box[1]);let closest=null,d=Infinity;for(const r of data.rows){const dist=(r.lat-lat)**2+(r.lon-lon)**2;if(dist<d){closest=r;d=dist;}}if(!closest||d>2){$('value').textContent='No displayed sample here.';return;}const r=closest;$('value').textContent=`${r.lat.toFixed(3)}°, ${r.lon.toFixed(3)}°: ${r.value===null?'No reading':r.value.toFixed(2)+' '+currentLayer.units}${currentLayer.second&&r.value!==null?' · eastward '+r.u.toFixed(2)+', northward '+r.v.toFixed(2)+' m/s':''}`;});
  state.push({load,setLayer(key){select.value=key;latest=true;}});draw();
 }
 root.querySelector('#environment-region').addEventListener('change',()=>state.forEach(s=>s.load()));
 root.querySelector('#environment-amazon').addEventListener('click',()=>{root.querySelector('#environment-region').value='amazon';state[0].setLayer('landTemperature');state[1].setLayer('rainfall');state.forEach(s=>s.load());});
 root.querySelector('[data-env-message]').textContent='Choose two layers or two dates. Their sampling, units and observation periods differ; compare the labels before interpreting a pattern.';
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();state.forEach(s=>s.load());}},{rootMargin:'100px'});observer.observe(root);
}
