export const ARCHIVE_API = 'https://cdfk.world/api/groan/archive';
const DAY = 86400000;
export function newestArchive(candidates) {
  return [...candidates].sort((a,b)=>b.data.requested_end.localeCompare(a.data.requested_end)
    || Date.parse(b.data.generated_at)-Date.parse(a.data.generated_at)
    || Number(b.live)-Number(a.live))[0];
}
// Render each successful source as it arrives; retain a newer previously loaded export.
export async function collectArchives(sources, onUpdate, previous = null) {
  const candidates = previous ? [previous] : [];
  let pending = sources.length, received = 0;
  await Promise.all(sources.map(async ({read, live}) => {
    try { candidates.push({data: await read(), live}); received++; }
    catch { /* A failed source must not hide another valid summary. */ }
    finally {
      pending--;
      onUpdate({selected: candidates.length ? newestArchive(candidates) : null, pending, received});
    }
  }));
}
export function archiveFreshness(data, now = Date.now()) {
  const latest = data.days.at(-1).date;
  const today = new Date(now).toISOString().slice(0,10);
  const age = Math.floor((Date.parse(today) - Date.parse(latest)) / DAY);
  const observed = age < 0 ? 'ahead of this device’s UTC date; check the device clock' : age === 0 ? 'today, UTC' : `${age} day${age === 1 ? '' : 's'} before today, UTC`;
  return `Newest archived observation: ${latest} (${observed}). These are daily satellite-derived observations, not an instantaneous temperature feed.`;
}
export function validateArchive(data) {
  if (data?.schema_version !== 1 || data.method !== 'regional-sst-sampled-area-mean-v1' || data.native_units !== 'degrees_Celsius'
      || !Array.isArray(data.regions) || !data.regions.length || !Array.isArray(data.days) || !data.days.length
      || !Number.isFinite(Date.parse(data.generated_at))) throw Error('Unsupported archive summary');
  const ids = new Set(data.regions.map(r => r.id));
  if (ids.size !== data.regions.length) throw Error('Duplicate region');
  let last = '';
  for (const day of data.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(Date.parse(day.date)) || new Date(day.date).toISOString().slice(0,10) !== day.date || day.date <= last || day.date < data.retention_start || day.date > data.requested_end) throw Error('Invalid archive chronology');
    for (const id of ids) {
      const r = day.regions?.[id];
      if (!r || !Number.isInteger(r.valid_cells) || r.valid_cells < 0 ||
          (r.value !== null && (!Number.isFinite(r.value) || r.value < -2 || r.value > 50)) ||
          (r.valid_cells === 0) !== (r.value === null)) throw Error('Invalid regional summary');
    }
    last = day.date;
  }
  const expected = (Date.parse(data.requested_end) - Date.parse(data.retention_start)) / DAY + 1;
  const available = new Set(data.days.map(d => d.date));
  const missing = [];
  for (let t = Date.parse(data.retention_start); t <= Date.parse(data.requested_end); t += DAY) {
    const d = new Date(t).toISOString().slice(0,10); if (!available.has(d)) missing.push(d);
  }
  if (data.coverage?.available_days !== data.days.length || data.coverage?.expected_days !== expected ||
      JSON.stringify(missing) !== JSON.stringify(data.coverage.missing_dates)) throw Error('Archive coverage mismatch');
  return data;
}
export function seriesFor(data, region, span = 'all') {
  const end = Date.parse(data.requested_end);
  const start = span === 'all' ? Date.parse(data.retention_start) : Math.max(Date.parse(data.retention_start), end - (Number(span) - 1) * DAY);
  const lookup = new Map(data.days.map(d => [d.date, d.regions[region]]));
  const rows = [];
  for (let t = start; t <= end; t += DAY) {
    const date = new Date(t).toISOString().slice(0,10), row = lookup.get(date);
    rows.push({date, value:row?.value ?? null, count:row?.valid_cells ?? 0});
  }
  return rows;
}
export function movingMean(rows, window = 30) {
  return rows.map((row,i) => {
    const chunk = rows.slice(Math.max(0,i-window+1),i+1);
    return {...row, value: chunk.length === window && chunk.every(x => Number.isFinite(x.value))
      ? chunk.reduce((sum,x)=>sum+x.value,0)/window : null};
  });
}
export function recentChange(rows) {
  const recent = rows.slice(-30), previous = rows.slice(-60,-30);
  if (recent.length !== 30 || previous.length !== 30 || [...recent,...previous].some(x=>!Number.isFinite(x.value))) return null;
  const average = a=>a.reduce((n,x)=>n+x.value,0)/a.length;
  const delta = average(recent)-average(previous);
  return {delta, label:Math.abs(delta)<=.1 ? 'Little change' : delta > 0 ? 'Warmer' : 'Cooler',
    recent:[recent[0].date,recent.at(-1).date], previous:[previous[0].date,previous.at(-1).date]};
}
export function lineSegments(rows, x, y) {
  const segments = []; let points = [];
  for (let i=0;i<rows.length;i++) {
    if (Number.isFinite(rows[i].value)) points.push([x(i),y(rows[i].value)]);
    else if(points.length) {segments.push(points);points=[];}
  }
  if(points.length) segments.push(points);
  return segments;
}
export function csvFor(data, id) {
  const r=data.regions.find(r=>r.id===id);
  const field=value=>'"'+String(value).replaceAll('"','""')+'"';
  const lines=[['Source',data.source],['Native variable',data.native_variable],['Native units',data.native_units],
    ['Derived method',data.method_description],['Region',r.name],['Region boxes west south east north',JSON.stringify(r.boxes)],
    ['Sampling degrees',r.sampling_degrees],['Export generated UTC',data.generated_at],
    ['date','regional_mean_degrees_Celsius','valid_sampled_cells','source_sha256']];
  const lookup = new Map(data.days.map(d=>[d.date,d]));
  for(const row of seriesFor(data,id)) lines.push([row.date,row.value??'',row.count,lookup.get(row.date)?.source_sha256??'']);
  return lines.map(row=>row.map(field).join(',')).join('\r\n');
}
