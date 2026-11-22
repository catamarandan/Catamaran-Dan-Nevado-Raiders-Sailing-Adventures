import { HISTORY_START, VIEWS, dataURL, parseGrid, sampleGrid, formatTemperature, colorRGB } from './thermal-data.mjs';

const root = document.querySelector('#thermal-globe');
if (root) start().catch(() => { document.querySelector('#thermal-status').textContent = 'The temperature view could not load. Use the NOAA source link below.'; });
async function start() {
  const $ = id => document.getElementById(id);
  const canvas = $('thermal-canvas'), ctx = canvas.getContext('2d');
  const N = 520, R = 232, DEG = Math.PI / 180;
  canvas.width = canvas.height = N;
  let grid, patches = [], lon0 = -25, lat0 = 10, zoom = 1, selected = [-75, 18];
  let busy = false, generation = 0, currentRequest = null, spinning = false, queued = false, lastFrame = 0;
  let mode = 'latest', requestedDate = null, lastCheck = null, sourceState = 'saved';
  const landCanvas = document.createElement('canvas'); landCanvas.width = 2048; landCanvas.height = 1024;
  const lc = landCanvas.getContext('2d', { willReadFrequently: true });
  const [snapshot, land] = await Promise.all([
    fetch(new URL('./temperature-global.json', import.meta.url)).then(r => { if (!r.ok) throw Error(); return r.json(); }),
    fetch(new URL('./land-110m.geojson', import.meta.url)).then(r => { if (!r.ok) throw Error(); return r.json(); })
  ]);
  lc.fillStyle = '#ffffff';
  for (const f of land.features) {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons) {
      lc.beginPath();
      for (const ring of polygon) ring.forEach(([lon, lat], i) => {
        const x = (lon + 180) / 360 * 2048, y = (90 - lat) / 180 * 1024;
        i ? lc.lineTo(x, y) : lc.moveTo(x, y);
      });
      lc.fill('evenodd');
    }
  }
  const mask = lc.getImageData(0, 0, 2048, 1024).data;
  function prepare(g) { g.colors = g.values.map(colorRGB); return g; }
  grid = prepare(snapshot);
  $('thermal-date').min = HISTORY_START;
  $('thermal-date').max = grid.time.slice(0, 10);
  $('thermal-date').value = grid.time.slice(0, 10);
  const stamp = time => new Date(time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  const wrap = lon => ((lon + 540) % 360) - 180;
  function setStatus(message) { $('thermal-status').textContent = message; }
  function updateMeta() {
    const age = Math.max(0, Math.floor((Date.now() - Date.parse(grid.time)) / 3600000));
    $('thermal-observed').textContent = stamp(grid.time);
    $('thermal-mode').textContent = mode === 'history' ? 'Historical observation' : age > 72 ? 'Latest available · delayed data' : 'Latest daily observation';
    $('thermal-age').textContent = `${age < 48 ? age + ' hours' : Math.floor(age / 24) + ' days'} since observation`;
    $('thermal-checked').textContent = lastCheck ? stamp(lastCheck) : 'Not checked in this visit';
    $('thermal-resolution').textContent = patches.length ? `${VIEWS[$('thermal-region').value].name}: ${patches[0].sampling_degrees.toFixed(2)}° samples. Outside this region: 1° overview.` : 'Global overview: 1° samples from NOAA’s 0.05° source grid.';
    $('thermal-count').textContent = `${grid.values.filter(v => v !== null).length.toLocaleString('en-US')} valid ocean samples in the global display`;
    $('thermal-live-state').textContent = sourceState === 'connected' ? 'Source connected' : sourceState === 'saved' ? 'Saved source snapshot' : 'Source unavailable · retained data';
    $('thermal-source-json').href = dataURL(grid.time.slice(0, 10));
    updateSelected();
  }
  function lookup(lat, lon) {
    for (const p of patches) { const s = sampleGrid(p, lat, lon); if (s) return s; }
    return sampleGrid(grid, lat, lon);
  }
  function updateSelected() {
    const s = lookup(selected[1], selected[0]);
    $('thermal-reading').textContent = s ? formatTemperature(s.value) : 'Outside sampled coverage';
    $('thermal-cell').textContent = s ? `Sample cell: ${s.latitude.toFixed(3)}°, ${s.longitude.toFixed(3)}° · ${s.spacing.toFixed(2)}° display spacing` : 'No sample at this location.';
    $('thermal-lat').value = selected[1].toFixed(3); $('thermal-lon').value = selected[0].toFixed(3);
  }
  function spherePoint(px, py) {
    const x = (px - N / 2) / (R * zoom), y = (N / 2 - py) / (R * zoom), rr = x * x + y * y;
    if (rr > 1) return null;
    const z = Math.sqrt(1 - rr), a = lat0 * DEG;
    return [wrap(lon0 + Math.atan2(x, z * Math.cos(a) - y * Math.sin(a)) / DEG), Math.asin(y * Math.cos(a) + z * Math.sin(a)) / DEG, z];
  }
  function project(lon, lat) {
    const p = lat * DEG, a = lat0 * DEG, d = (lon - lon0) * DEG;
    const z = Math.sin(a) * Math.sin(p) + Math.cos(a) * Math.cos(p) * Math.cos(d);
    return z < 0 ? null : [N / 2 + R * zoom * Math.cos(p) * Math.sin(d), N / 2 - R * zoom * (Math.cos(a) * Math.sin(p) - Math.sin(a) * Math.cos(p) * Math.cos(d))];
  }
  function indexAt(g, lat, lon) {
    const y = Math.round((g.latitude[0] - lat) / g.sampling_degrees), width = g.longitude.length;
    let x = Math.round((lon - g.longitude[0]) / g.sampling_degrees);
    if (width * g.sampling_degrees >= 359.99) x = ((x % width) + width) % width;
    return y < 0 || y >= g.latitude.length || x < 0 || x >= width ? -1 : y * width + x;
  }
  function draw() {
    queued = false;
    if (!ctx) return;
    const frame = ctx.createImageData(N, N), pixels = frame.data;
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const p = spherePoint(px, py); if (!p) continue;
      const [lon, lat, z] = p;
      const mx = Math.max(0, Math.min(2047, Math.floor((lon + 180) / 360 * 2048)));
      const my = Math.max(0, Math.min(1023, Math.floor((90 - lat) / 180 * 1024)));
      let rgb;
      if (mask[(my * 2048 + mx) * 4 + 3]) rgb = [53, 80, 79];
      else {
        let g = grid, idx = indexAt(grid, lat, lon);
        for (const patch of patches) { const pi = indexAt(patch, lat, lon); if (pi >= 0) { g = patch; idx = pi; break; } }
        rgb = idx >= 0 ? g.colors[idx] : [29, 49, 62];
      }
      const light = .55 + .45 * Math.sqrt(z), i = (py * N + px) * 4;
      pixels[i] = rgb[0] * light; pixels[i + 1] = rgb[1] * light; pixels[i + 2] = rgb[2] * light; pixels[i + 3] = 255;
    }
    ctx.clearRect(0, 0, N, N); ctx.putImageData(frame, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.arc(N / 2, N / 2, R * zoom, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(215,241,245,.15)'; ctx.lineWidth = .6;
    function line(points) { ctx.beginPath(); let open = false; for (const [lo, la] of points) { const p = project(lo, la); if (!p) { open = false; continue; } open ? ctx.lineTo(...p) : ctx.moveTo(...p); open = true; } ctx.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 181 }, (_, i) => [-180 + i * 2, lat]));
    for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 91 }, (_, i) => [lon, -90 + i * 2]));
    const point = project(...selected);
    if (point) { ctx.beginPath(); ctx.arc(...point, 6, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }
  function requestDraw() { if (!queued) { queued = true; requestAnimationFrame(draw); } }
  async function fetchGrid(date, box, step, signal) {
    const r = await fetch(dataURL(date, box, step), { signal, cache: 'no-store', credentials: 'omit' });
    if (!r.ok) throw new Error(`Source returned ${r.status}`);
    return prepare(parseGrid(await r.json(), { expectedDate: date, step }));
  }
  async function refresh({ detailOnly = false } = {}) {
    currentRequest?.abort(); const controller = new AbortController(); currentRequest = controller;
    const mine = ++generation, timer = setTimeout(() => controller.abort(), 60000); busy = true;
    let globalLoaded = false;
    const view = VIEWS[$('thermal-region').value];
    setStatus(detailOnly ? `Loading ${view.name} detail; the global overview remains visible.` : 'Checking NOAA/PacIOOS for the selected observation…');
    try {
      if (!detailOnly) {
        const next = await fetchGrid(requestedDate, null, 20, controller.signal);
        if (mine !== generation) return;
        if (mode === 'latest' && next.time < grid.time) throw new Error('Source returned an older observation');
        grid = next; patches = []; globalLoaded = true; sourceState = 'connected'; lastCheck = new Date().toISOString();
        if (mode === 'latest') { $('thermal-date').max = grid.time.slice(0, 10); $('thermal-date').value = grid.time.slice(0, 10); }
        updateMeta(); requestDraw();
      }
      if (view.boxes.length) {
        const details = await Promise.all(view.boxes.map(b => fetchGrid(grid.time.slice(0, 10), b, view.step, controller.signal)));
        if (mine !== generation) return;
        patches = details;
      }
      lastCheck = new Date().toISOString(); sourceState = 'connected';
      setStatus(mode === 'history' ? 'Historical observation loaded from the source. This is not current conditions.' : 'Connected to the daily source. Checks every 15 minutes while this page is visible; observations update daily.');
    } catch (e) {
      if (mine !== generation) return;
      if (detailOnly || globalLoaded) setStatus('Regional detail is unavailable. The displayed global overview and its date remain visible.');
      else { sourceState = 'unavailable'; $('thermal-date').value = grid.time.slice(0, 10); setStatus('Requested source refresh unavailable. Showing the retained observation and its displayed date; the requested date or latest update was not loaded.'); }
    } finally {
      clearTimeout(timer);
      if (mine === generation) { busy = false; updateMeta(); requestDraw(); }
    }
  }
  function stopSpin() { spinning = false; $('thermal-spin').textContent = 'Rotate globe'; $('thermal-spin').setAttribute('aria-pressed', 'false'); }
  function spin(now) {
    if (!spinning) return;
    if (!document.hidden && now - lastFrame > 90) { lon0 = wrap(lon0 + .7); lastFrame = now; requestDraw(); }
    requestAnimationFrame(spin);
  }
  $('thermal-spin').addEventListener('click', () => {
    if (spinning) return stopSpin();
    spinning = true; $('thermal-spin').textContent = 'Pause rotation'; $('thermal-spin').setAttribute('aria-pressed', 'true'); requestAnimationFrame(spin);
  });
  $('thermal-region').addEventListener('change', () => {
    stopSpin(); const view = VIEWS[$('thermal-region').value]; [lon0, lat0] = view.center; zoom = view.zoom;
    selected = [...view.center]; patches = []; $('thermal-zoom').value = zoom; updateMeta(); requestDraw();
    if (view.boxes.length) refresh({ detailOnly: true });
    else { currentRequest?.abort(); generation++; busy = false; setStatus('Global overview displayed. Use Refresh source to check for an update.'); }
  });
  $('thermal-zoom').addEventListener('input', () => { stopSpin(); zoom = Number($('thermal-zoom').value); requestDraw(); });
  $('thermal-home').addEventListener('click', () => { stopSpin(); [lon0, lat0] = VIEWS[$('thermal-region').value].center; zoom = VIEWS[$('thermal-region').value].zoom; $('thermal-zoom').value = zoom; requestDraw(); });
  $('thermal-refresh').addEventListener('click', () => { if (!busy) refresh(); });
  $('thermal-date').addEventListener('change', () => {
    if (!$('thermal-date').checkValidity()) return;
    mode = 'history'; requestedDate = $('thermal-date').value; refresh();
  });
  $('thermal-latest').addEventListener('click', () => { mode = 'latest'; requestedDate = null; refresh(); });
  $('thermal-inspect').addEventListener('submit', e => {
    e.preventDefault(); if (!e.target.checkValidity()) return;
    selected = [Number($('thermal-lon').value), Number($('thermal-lat').value)]; [lon0, lat0] = selected; stopSpin(); updateSelected(); requestDraw();
  });
  const pointerPosition = e => { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * N, (e.clientY - b.top) / b.height * N]; };
  let drag = null;
  canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; stopSpin(); canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0, moved: false }; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved ||= Math.abs(dx) + Math.abs(dy) > 5; lon0 = wrap(drag.lon - dx * .3 / zoom); lat0 = Math.max(-85, Math.min(85, drag.lat + dy * .3 / zoom)); requestDraw(); });
  canvas.addEventListener('pointerup', e => { if (drag && !drag.moved) { const p = spherePoint(...pointerPosition(e)); if (p) { selected = p.slice(0, 2); updateSelected(); requestDraw(); } } drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(e.key)) return;
    e.preventDefault(); stopSpin();
    if (e.key === 'ArrowLeft') lon0 = wrap(lon0 - 8 / zoom);
    if (e.key === 'ArrowRight') lon0 = wrap(lon0 + 8 / zoom);
    if (e.key === 'ArrowUp') lat0 = Math.min(85, lat0 + 8 / zoom);
    if (e.key === 'ArrowDown') lat0 = Math.max(-85, lat0 - 8 / zoom);
    if (e.key === '+') zoom = Math.min(5, zoom + .25);
    if (e.key === '-') zoom = Math.max(1, zoom - .25);
    $('thermal-zoom').value = zoom; requestDraw();
  });
  updateMeta(); requestDraw(); refresh();
  setInterval(() => { if (!document.hidden && mode === 'latest' && !busy) refresh(); }, 15 * 60 * 1000);
}
