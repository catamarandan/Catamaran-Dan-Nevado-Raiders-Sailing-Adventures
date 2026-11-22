export const START='2024-11-22';
export const GIBS='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const crw='https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km';
export const LAYERS={
 temperature:{name:'Sea-surface temperature',type:'Satellite-derived analysis',units:'°C',nativeUnits:'Celsius',variable:'CRW_SST',endpoint:crw,step:20,spacing:1,min:-2,max:34,range:[-2,50],source:'https://www.pacioos.hawaii.edu/metadata/dhw_5km.html',cadence:'Daily observation',description:'The ocean surface temperature, sampled every 1° in this comparison map. Use the globe above for finer local detail.',question:'How does ocean temperature differ between latitudes and seasons?'},
 landTemperature:{name:'Land-surface temperature',type:'Satellite surface-temperature estimate',units:'K (kelvin)',gibs:'MODIS_Terra_L3_Land_Surface_Temp_Daily_Day',source:'https://modis.gsfc.nasa.gov/data/dataprod/mod11.php',cadence:'Daily daytime retrieval · clear-sky observations',description:'Temperature of the ground or forest canopy surface seen by the satellite. It is not weather-station air temperature; clouds can leave gaps. The provider legend uses kelvin (K): subtract 273.15 for °C.',question:'Does a warmer land surface coincide with less rainfall, drier soils or changing vegetation?'},
 heat:{name:'Accumulated ocean heat stress',type:'Derived heat-stress indicator',units:'°C-weeks',nativeUnits:'Celsius weeks',variable:'CRW_DHW',endpoint:crw,step:20,spacing:1,min:0,max:20,range:[0,100],source:'https://coralreefwatch.noaa.gov/product/5km/index_5km_dhw.php',cadence:'Daily · accumulation over the preceding 12 weeks',description:'NOAA Degree Heating Weeks summarize accumulated coral bleaching heat stress. Elevated values indicate risk, not confirmed bleaching.',question:'Can two places have similar temperatures but different accumulated heat stress?'},
 chlorophyll:{name:'Chlorophyll',type:'Satellite estimate',units:'mg/m³',gibs:'VIIRS_NOAA20_Chlorophyll_a',source:'https://coastwatch.noaa.gov/cwn/product-families/ocean-color.html',cadence:'Daily imagery · clouds and darkness leave gaps',description:'Ocean color estimates chlorophyll associated with phytoplankton. It does not identify a harmful algal species or prove toxicity.',question:'How do patterns of chlorophyll relate to currents, coasts and temperature?'},
 salinity:{name:'Sea-surface salinity',type:'Satellite estimate',units:'Practical salinity',gibs:'SMAP_L3_Sea_Surface_Salinity_CAP_8Day_RunningMean',source:'https://smap.jpl.nasa.gov/data/',cadence:'8-day running mean',description:'SMAP estimates surface salinity over broad ocean areas. Coasts, sea ice and radio interference can limit retrievals; this is not a boat-scale sample.',question:'Where does rainfall coincide with lower surface salinity?'},
 currents:{name:'Ocean currents',providerPlot:true,type:'Altimeter-derived geostrophic estimate',units:'m/s',nativeUnits:'m/s',variable:'u_current',second:'v_current',endpoint:'https://coastwatch.pfeg.noaa.gov/erddap/griddap/miamicurrents',step:5,spacing:1,min:0,max:1,range:[-10,10],source:'https://coastwatch.pfeg.noaa.gov/erddap/griddap/miamicurrents.html',cadence:'Daily · coverage 64.7°S to 64.7°N',description:'NOAA’s source map shows geostrophic-current vectors: arrow direction and length represent flow direction and magnitude. Geostrophic flow omits parts of total water motion, including tides and wind-driven currents. It is not a navigation forecast.',question:'Where could currents help move water with different temperatures or plankton concentrations?'},
 rainfall:{name:'Precipitation',type:'Satellite-based precipitation estimate',units:'mm/hour',gibs:'IMERG_Precipitation_Rate',source:'https://gpm.nasa.gov/data/imerg',cadence:'Daily visualization · use the provider legend',description:'GPM IMERG combines satellite information to estimate precipitation. This layer shows a rate, not a monthly rainfall total.',question:'Does wet weather coincide with wetter soils or fresher coastal water?'},
 soil:{name:'Surface soil moisture',type:'Satellite-constrained model analysis',units:'m³/m³',gibs:'SMAP_L4_Analyzed_Surface_Soil_Moisture',source:'https://smap.jpl.nasa.gov/data/',cadence:'Daily visualization of the SMAP Level-4 analysis',description:'A model informed by SMAP observations estimates surface soil moisture. Frozen ground, snow and other conditions affect coverage and interpretation.',question:'How do rainfall, soil moisture and vegetation change together?'},
 vegetation:{name:'Vegetation greenness',type:'Satellite-derived index',units:'NDVI · dimensionless',gibs:'MODIS_Terra_L3_NDVI_16Day',source:'https://modis.gsfc.nasa.gov/data/dataprod/mod13.php',cadence:'16-day composite · date marks the composite start',description:'NDVI measures vegetation greenness. Season, land cover and disturbance can all affect it; greenness alone does not diagnose plant health.',question:'Is a change in greenness seasonal, or does it coincide with unusually dry conditions?'}
};
export const REGIONS={amazon:{name:'Amazon Basin · headwaters to Atlantic outlet',box:[-82,-22,-44,7]},global:{name:'Global',box:[-180,-90,180,90]},pacific:{name:'Pacific Americas',box:[-180,-59,-66,73]},atlantic:{name:'Atlantic Americas',box:[-85,-59,-30,65]},caribbean:{name:'Caribbean',box:[-90,7,-58,28]},mediterranean:{name:'Mediterranean',box:[-7,29,37,47]},redsea:{name:'Red Sea',box:[30,11,46,31]},triangle:{name:'Coral Triangle',box:[90,-12,160,22]},florida:{name:'Florida & East Coast',box:[-86,23,-60,46]}};
export function availableDate(intervals,requested) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(requested)||requested<START||!Number.isFinite(Date.parse(requested))) throw Error('Invalid date');
 let best=null; const target=Date.parse(requested);
 for(const part of intervals.split(',')) {
  const [a,b,period]=part.trim().split('/');
  if(!b){if(a>=START && a<=requested && (!best||a>best))best=a;continue;}
  const m=/^P(\d+)D$/.exec(period); if(!m)continue;
  const start=Date.parse(a),end=Math.min(Date.parse(b),target),step=Number(m[1])*86400000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||step<=0||end<start)continue;
  const date=new Date(start+Math.floor((end-start)/step)*step).toISOString().slice(0,10);
  if(date>=START&&(!best||date>best))best=date;
 }
 if(!best)throw Error('No available observation in the collection period'); return best;
}
export function mapURL(layer,date,box){
 const p=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:layer.gibs,STYLES:'',CRS:'EPSG:4326',BBOX:[box[1],box[0],box[3],box[2]].join(','),WIDTH:'900',HEIGHT:'450',FORMAT:'image/png',TRANSPARENT:'TRUE',TIME:date});
 return GIBS+'?'+p;
}
export function nativeURL(layer,date=null){
 if(date && (date<START||!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw Error('Date outside collection period');
 const time=date?`[(${date}T${layer.second?'00':'12'}:00:00Z)]`:'[last]', area=`[0:${layer.step}:last][0:${layer.step}:last]`;
 return layer.endpoint+'.json?'+encodeURIComponent([layer.variable,...(layer.second?[layer.second]:[])].map(v=>v+time+area).join(','));
}
export function parseNative(payload,layer){
 const t=payload?.table;if(!t||!Array.isArray(t.rows)||!t.rows.length||t.rows.length>100000)throw Error('Unexpected source grid');
 const fields=['time','latitude','longitude',layer.variable,...(layer.second?[layer.second]:[])],units=['UTC','degrees_north','degrees_east',layer.nativeUnits,...(layer.second?[layer.nativeUnits]:[])];
 const ix=fields.map((name,i)=>{const j=t.columnNames.indexOf(name);if(j<0||t.columnUnits[j]!==units[i])throw Error('Source schema changed');return j;});
 const time=t.rows[0][ix[0]];if(!Number.isFinite(Date.parse(time))||time.slice(0,10)<START||Date.parse(time)>Date.now()+86400000)throw Error('Source date outside collection period');
 const rows=t.rows.map(row=>{
  const [stamp,lat,lon,a,b]=ix.map(i=>row[i]);
  if(stamp!==time||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Invalid source coordinates');
  for(const v of (layer.second?[a,b]:[a]))if(v!==null&&(!Number.isFinite(v)||v<layer.range[0]||v>layer.range[1]))throw Error('Invalid source value');
  return {lat,lon,value:layer.second?(a===null||b===null?null:Math.hypot(a,b)):a,u:a,v:b};
 });return {time,rows};
}
export function color(value,min,max){const x=Math.max(0,Math.min(1,(value-min)/(max-min))),stops=[[57,102,199],[56,188,179],[237,211,98],[210,68,67]],i=Math.min(2,Math.floor(x*3)),f=x*3-i;return 'rgb('+stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f)).join(',')+')';}

export function currentPlotURL(layer,date,box) {
 const time=date?`[(${date}T00:00:00Z)]`:'[last]';
 const south=Math.max(-64.7,box[1]),north=Math.min(64.7,box[3]),west=Math.max(-179.9,box[0]),east=Math.min(179.9,box[2]);
 if(south>=north||west>=east)throw Error('Outside current coverage');
 const area=`[(${south}):10:(${north})][(${west}):10:(${east})]`;
 const q=[layer.variable,layer.second].map(v=>v+time+area).join(',');
 return layer.endpoint+'.largePng?'+encodeURIComponent(q)+'&.draw=vectors&.vars=longitude%7Clatitude%7Cu_current%7Cv_current&.size=900%7C450';
}
