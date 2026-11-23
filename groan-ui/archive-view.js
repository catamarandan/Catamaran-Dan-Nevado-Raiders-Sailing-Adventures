import {ARCHIVE_API, collectArchives, archiveFreshness, validateArchive, seriesFor, movingMean, recentChange, lineSegments, csvFor} from './archive-data.mjs';
const $=id=>document.getElementById(id);
const root=$('archive-history');
let data, selectedArchive, loadVersion=0;
if(root) start().catch(()=>{$('archive-status').textContent='Archive summaries could not be loaded. No observations have been invented. Please try Refresh archive.';});
async function request(url) {
  const controller = new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
  try {const r=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});if(!r.ok)throw Error('Unavailable');return validateArchive(await r.json());}
  finally {clearTimeout(timeout);}
}
async function load() {
  const version=++loadVersion;
  $('archive-refresh').disabled=true;
  $('archive-status').textContent='Checking the archive summary…';
  try {
    await collectArchives([
      {read:()=>request(new URL('./archive-dashboard.json',import.meta.url)),live:false},
      {read:()=>request(ARCHIVE_API),live:true}
    ], ({selected,pending,received})=>{
      if(version!==loadVersion)return;
      if(!selected) {
        if(!pending){
          $('archive-status').textContent='Archive summaries unavailable. Please try Refresh archive.';
          for(const id of ['archive-days','archive-dates','archive-storage','archive-latest','archive-direction']) $(id).textContent='Unavailable';
        }
        return;
      }
      if(data!==selected.data) {
        const classroomPreset=!data && new URLSearchParams(location.search).get('activity')==='caribbean-mediterranean';
        data=selected.data;
        const region=$('archive-region').value, comparison=$('archive-comparison').value;
        $('archive-region').replaceChildren();$('archive-comparison').replaceChildren(new Option('No second region',''));
        for(const r of data.regions) {$('archive-region').add(new Option(r.name,r.id));$('archive-comparison').add(new Option(r.name,r.id));}
        $('archive-region').value=data.regions.some(r=>r.id===region)?region:'caribbean';
        $('archive-comparison').value=data.regions.some(r=>r.id===comparison)?comparison:'';
        if(classroomPreset) {
          $('archive-region').value='caribbean';
          $('archive-comparison').value='mediterranean';
          $('archive-span').value='365';
        }
        render();
      }
      selectedArchive=selected;
      const source=selected.live?'Showing a summary retrieved from the archive connection. ':'Showing the published archive snapshot. ';
      const check=pending?'Checking for a newer summary… ':received?'Archive check finished; showing the newest available export. ':'Refresh unavailable; retaining the previously loaded export. ';
      $('archive-status').textContent=source+check+`Summary generated ${new Date(data.generated_at).toLocaleString(undefined,{timeZone:'UTC'})} UTC.`;
      $('archive-freshness').textContent=archiveFreshness(data);
    }, selectedArchive);
  } finally {if(version===loadVersion)$('archive-refresh').disabled=false;}
}

async function start(){
  $('archive-refresh').addEventListener('click',load);
  for(const id of ['archive-region','archive-comparison','archive-span','archive-inspect-date']) $(id).addEventListener('change',()=>{if(data)render();});
  $('archive-download').addEventListener('click',()=>{
    if(!data)return;const id=$('archive-region').value;
    const url=URL.createObjectURL(new Blob([csvFor(data,id)],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`groan-${id}-${data.requested_end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('archive-globe-link').addEventListener('click',()=>{if(!data)return;const select=$('thermal-region');select.value=$('archive-region').value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  await load();
}
function render(){
  const id=$('archive-region').value, second=$('archive-comparison').value, span=$('archive-span').value;
  const region=data.regions.find(r=>r.id===id), rows=seriesFor(data,id,span), all=seriesFor(data,id), change=recentChange(all);
  const avgAll=movingMean(all), smooth=avgAll.filter(r=>r.date>=rows[0].date);
  const others=second&&second!==id?seriesFor(data,second,span):[];
  const region2=data.regions.find(r=>r.id===second);
  const input=$('archive-inspect-date');input.min=rows[0].date;input.max=rows.at(-1).date;
  if(!input.value || input.value<input.min || input.value>input.max)input.value=input.max;
  const inspected=rows.find(r=>r.date===input.value);const inspected2=others.find(r=>r.date===input.value);
  const reading=(r,name)=>`${name}: ${!r||r.value===null?'No reading':r.value.toFixed(2)+'°C · '+r.count.toLocaleString()+' valid sampled cells'}`;
  $('archive-inspection').textContent=input.value+' · '+reading(inspected,region.name)+(others.length?' · '+reading(inspected2,region2.name):'');
  $('archive-days').textContent=`${data.coverage.available_days.toLocaleString()} / ${data.coverage.expected_days.toLocaleString()} days`;
  $('archive-dates').textContent=`${data.retention_start} to ${data.requested_end}`;
  $('archive-storage').textContent=(data.coverage.original_bytes/1e9).toFixed(2)+' GB of originals';
  $('archive-coverage').textContent=data.coverage.missing_dates.length ? `${data.coverage.missing_dates.length} dates missing from this export: ${data.coverage.missing_dates.slice(0,12).join(', ')}${data.coverage.missing_dates.length>12?'…':''}`:'Every date in this export is represented by a verified archived original.';
  $('archive-region-detail').textContent=`${region.name} · ${region.sampling_degrees}° sample spacing. Comparison extent (west, south, east, north): ${region.boxes.map(b=>b.join(', ')).join(' / ')}. Extents include neighboring waters and overlap; these are not exact sea or coastal boundaries.`;
  const last=all.at(-1);
  $('archive-latest').textContent=last.value===null?'No regional reading':`${last.value.toFixed(2)}°C`;
  $('archive-latest-date').textContent=`${last.date} · ${last.count.toLocaleString()} valid sampled cells`;
  $('archive-direction').textContent=change?`${change.label} · ${change.delta>=0?'+':''}${change.delta.toFixed(2)}°C`:'Not enough complete data';
  $('archive-direction-detail').textContent=change?`Average for ${change.recent.join(' to ')} compared with ${change.previous.join(' to ')}.`:'Two complete consecutive 30-day windows are required. Missing readings are not estimated.';
  $('archive-method').textContent=data.method_description;
  $('archive-chart-caption').textContent=`${region.name}${others.length?' and '+region2.name:''} · ${rows[0].date} to ${rows.at(-1).date}. Daily regional means and a 30-day moving average for ${region.name}.`;
  drawChart(rows,smooth,others,region,region2);
  const body=$('archive-table-body');body.replaceChildren();
  for(const row of rows.slice(-30).reverse()){
    const tr=document.createElement('tr');for(const value of [row.date,row.value===null?'No reading':row.value.toFixed(2),row.count.toLocaleString()]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
  }
  $('archive-table-caption').textContent=`Most recent ${Math.min(30,rows.length)} days shown for ${region.name}. CSV includes the full archive period.`;
}
function drawChart(rows,smooth,others,region,region2){
  const svg=$('archive-chart'), ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const node=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
  node('title',{},'Archived sea-surface temperature history');node('desc',{},$('archive-chart-caption').textContent+' Gaps indicate missing observations. The table and CSV provide numeric values.');
  const values=[...rows,...others].map(r=>r.value).filter(Number.isFinite);if(!values.length){node('text',{x:60,y:100},'No readings for this selection');return;}
  const min=Math.floor(Math.min(...values)-.5),max=Math.ceil(Math.max(...values)+.5);
  const x=i=>64+i/Math.max(1,rows.length-1)*776,y=v=>38+(max-v)/(max-min)*282;
  for(let i=0;i<=4;i++){const v=min+(max-min)*i/4,py=y(v);node('line',{x1:64,x2:840,y1:py,y2:py,stroke:'#314855'});node('text',{x:52,y:py+5,'text-anchor':'end',fill:'#d3e0e7'},v.toFixed(1));}
  node('text',{x:16,y:20,fill:'#d3e0e7'},'°C');
  for(const i of [0,Math.floor((rows.length-1)/2),rows.length-1])node('text',{x:x(i),y:350,'text-anchor':i===0?'start':i===rows.length-1?'end':'middle',fill:'#d3e0e7'},rows[i].date);
  const line=(r,color,width)=>{for(const segment of lineSegments(r,x,y)){if(segment.length===1)node('circle',{cx:segment[0][0],cy:segment[0][1],r:2,fill:color});else node('polyline',{points:segment.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round'});}};
  line(rows,'#4ad7ec',1.6);line(smooth,'#f5cd76',3);if(others.length)line(others,'#e2a3eb',1.8);
  const selected=rows.findIndex(r=>r.date===$('archive-inspect-date').value);
  if(selected>=0)node('line',{x1:x(selected),x2:x(selected),y1:38,y2:320,stroke:'#f3f7fa','stroke-dasharray':'4 5','stroke-width':1});
  $('archive-legend').textContent=`Cyan: ${region.name} daily mean · Gold: its 30-day moving average${others.length?' · Lilac: '+region2.name+' daily mean':''}`;
}
