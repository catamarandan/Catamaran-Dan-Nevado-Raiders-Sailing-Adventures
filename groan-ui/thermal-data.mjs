export const HISTORY_START = '2024-11-22';
export const ENDPOINT = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.json';
export const VIEWS = {
  global: { name: 'Global ocean', center: [-25, 10], zoom: 1, step: 20, boxes: [] },
  redsea: { name: 'Red Sea', center: [38, 21], zoom: 4, step: 1, boxes: [[31, 11, 30, 46]] },
  triangle: { name: 'Coral Triangle', center: [126, 2], zoom: 2.8, step: 4, boxes: [[22, -12, 90, 160]] },
  pacific: { name: 'Pacific Ocean', center: [-165, 5], zoom: 1.5, step: 10, boxes: [[55, -55, 120, 179.975], [55, -55, -179.975, -70]] },
  americasPacific: { name: 'Pacific Americas · Alaska to Tierra del Fuego', center: [-104, 8], zoom: 1.1, step: 10, boxes: [[73, -59, -179.975, -66], [73, 48, 170, 179.975]] },
  americasAtlantic: { name: 'Atlantic Americas · Tierra del Fuego to Newfoundland', center: [-53, 2], zoom: 1.1, step: 10, boxes: [[65, -59, -85, -30]] },
  mediterranean: { name: 'Mediterranean', center: [16, 38], zoom: 3.8, step: 2, boxes: [[47, 29, -7, 37]] },
  florida: { name: 'Florida & US East Coast', center: [-76, 33], zoom: 4, step: 2, boxes: [[46, 23, -86, -60]] },
  caribbean: { name: 'Caribbean', center: [-75, 18], zoom: 3.5, step: 2, boxes: [[28, 7, -90, -58]] }
};
export function dataURL(date = null, box = null, step = 20) {
  if (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < HISTORY_START || date > new Date().toISOString().slice(0, 10) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Date outside collection period');
  if (![1, 2, 4, 10, 20].includes(step)) throw new Error('Invalid sampling');
  const time = date ? `[(${date}T12:00:00Z)]` : '[last]';
  const point = box && box[0] === box[1] && box[2] === box[3];
  const area = point ? `[(${box[0]})][(${box[2]})]` : box ? `[(${box[0]}):${step}:(${box[1]})][(${box[2]}):${step}:(${box[3]})]` : `[0:${step}:last][0:${step}:last]`;
  return ENDPOINT + '?' + encodeURIComponent('CRW_SST' + time + area);
}
export function parseGrid(payload, { expectedDate = null, step = 20, now = Date.now() } = {}) {
  const t = payload?.table;
  if (!t || !Array.isArray(t.rows) || !t.rows.length || t.rows.length > 300000) throw new Error('Unexpected grid response');
  const names = ['time', 'latitude', 'longitude', 'CRW_SST'], units = ['UTC', 'degrees_north', 'degrees_east', 'Celsius'];
  const ix = names.map((n, i) => {
    const j = t.columnNames?.indexOf(n);
    if (!(j >= 0) || t.columnUnits?.[j] !== units[i]) throw new Error('Source names or units changed');
    return j;
  });
  const latitude = [], longitude = [], seenLat = new Set(), seenLon = new Set(), values = [];
  const time = t.rows[0][ix[0]], stamp = Date.parse(time);
  if (typeof time !== 'string' || !Number.isFinite(stamp) || stamp > now + 86400000 || time.slice(0, 10) < HISTORY_START || (expectedDate && time.slice(0, 10) !== expectedDate)) throw new Error('Unexpected observation date');
  for (const row of t.rows) {
    const [at, lat, lon, value] = ix.map(i => row[i]);
    if (at !== time || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Invalid grid coordinates or dates');
    if (value !== null && (!Number.isFinite(value) || value < -2 || value > 50)) throw new Error('Invalid source temperature');
    if (!seenLat.has(lat)) { seenLat.add(lat); latitude.push(lat); }
    if (!seenLon.has(lon)) { seenLon.add(lon); longitude.push(lon); }
    values.push(value);
  }
  if (values.length !== latitude.length * longitude.length) throw new Error('Incomplete rectangular grid');
  const spacing = step * .05;
  if (latitude.slice(1).some((v, i) => Math.abs(latitude[i] - v - spacing) > .0001) || longitude.slice(1).some((v, i) => Math.abs(v - longitude[i] - spacing) > .0001)) throw new Error('Unexpected grid spacing');
  t.rows.forEach((row, i) => {
    if (row[ix[1]] !== latitude[Math.floor(i / longitude.length)] || row[ix[2]] !== longitude[i % longitude.length]) throw new Error('Unexpected grid order');
  });
  return { native_dataset_id: 'dhw_5km', native_variable: 'CRW_SST', native_units: 'Celsius', time, latitude, longitude, values, sampling_degrees: spacing, native_grid_degrees: .05 };
}
export function sampleGrid(grid, lat, lon) {
  if (!grid) return null;
  const step = grid.sampling_degrees, rows = grid.latitude.length, cols = grid.longitude.length;
  const y = Math.round((grid.latitude[0] - lat) / step);
  let x = Math.round((lon - grid.longitude[0]) / step);
  if (cols * step >= 359.99) x = ((x % cols) + cols) % cols;
  if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
  return { value: grid.values[y * cols + x], latitude: grid.latitude[y], longitude: grid.longitude[x], index: y * cols + x, time: grid.time, spacing: step };
}
export function formatTemperature(value) { return value === null || !Number.isFinite(value) ? 'No reading' : `${value.toFixed(2)}°C`; }
export function colorRGB(value) {
  if (value === null || !Number.isFinite(value)) return [29, 49, 62];
  const stops = [[-2, [75, 96, 222]], [10, [38, 186, 209]], [20, [128, 211, 152]], [26, [250, 209, 92]], [30, [245, 127, 62]], [34, [201, 57, 70]]];
  const v = Math.max(-2, Math.min(34, value)); let i = 1;
  while (v > stops[i][0]) i++;
  const a = stops[i - 1], b = stops[i], f = (v - a[0]) / (b[0] - a[0]);
  return a[1].map((n, k) => Math.round(n + (b[1][k] - n) * f));
}

export function comparisonDates(date) {
  const base = new Date(date + 'T12:00:00Z');
  if (!Number.isFinite(base.getTime())) throw Error('Invalid comparison date');
  const minus = days => new Date(base.getTime() - days * 86400000).toISOString().slice(0,10);
  const year = new Date(base); year.setUTCFullYear(year.getUTCFullYear() - 1);
  if (year.getUTCMonth() !== base.getUTCMonth()) year.setUTCDate(0);
  return [{ label:'7 days earlier', date:minus(7) }, { label:'30 days earlier', date:minus(30) }, { label:'One year earlier', date:year.toISOString().slice(0,10) }];
}
export function temperatureChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return {label:'No comparison', delta:null};
  const delta = Math.round((current - previous) * 100) / 100;
  return {delta, label:Math.abs(delta) <= .1 ? 'Little change' : delta > 0 ? 'Warmer' : 'Cooler'};
}
export function localBoxes(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw Error('Invalid location');
  const north=Math.min(89.975,lat+4),south=Math.max(-89.975,lat-4),west=lon-4,east=lon+4;
  if(west < -180) return [[north,south,west+360,179.975],[north,south,-179.975,east]].filter(b=>b[2]<=b[3]);
  if(east > 180) return [[north,south,west,179.975],[north,south,-179.975,east-360]].filter(b=>b[2]<=b[3]);
  return [[north,south,Math.max(-179.975,west),Math.min(179.975,east)]];
}
