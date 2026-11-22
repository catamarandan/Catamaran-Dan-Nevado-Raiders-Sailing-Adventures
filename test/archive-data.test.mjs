import test from 'node:test';
import assert from 'node:assert/strict';
import {newestArchive,validateArchive,seriesFor,movingMean,recentChange,lineSegments,csvFor} from '../groan-ui/archive-data.mjs';
const payload=()=>({schema_version:1,method:'regional-sst-sampled-area-mean-v1',native_units:'degrees_Celsius',
  generated_at:'2026-11-22T12:00:00Z',retention_start:'2024-11-22',requested_end:'2024-11-24',
  regions:[{id:'a',name:'Region',sampling_degrees:1,boxes:[[0,0,1,1]]}],
  coverage:{available_days:2,expected_days:3,missing_dates:['2024-11-23']},
  days:[{date:'2024-11-22',regions:{a:{value:0,valid_cells:1}}},{date:'2024-11-24',regions:{a:{value:20,valid_cells:1}}}]});
test('valid zero remains a measurement and missing dates remain visible gaps',()=>{
  const p=validateArchive(payload()),rows=seriesFor(p,'a');
  assert.deepEqual(rows.map(r=>r.value),[0,null,20]);
  assert.deepEqual(lineSegments(rows,i=>i,v=>v),[[[0,0]],[[2,20]]]);
  assert.ok(csvFor(p,'a').includes('"2024-11-23","","0"'));
});
test('rejects misleading coverage and incompatible data',()=>{
  const p=payload();p.coverage.available_days=3;assert.throws(()=>validateArchive(p));
  const p2=payload();p2.days[0].regions.a.value=NaN;assert.throws(()=>validateArchive(p2));
});
test('moving means and changes require complete daily windows',()=>{
  const rows=Array.from({length:60},(_,i)=>({date:String(i),value:i<30?20:21,count:1}));
  assert.equal(movingMean(rows)[28].value,null);assert.equal(movingMean(rows)[29].value,20);
  assert.equal(recentChange(rows).delta,1);assert.equal(recentChange(rows).label,'Warmer');
  rows[40].value=null;assert.equal(recentChange(rows),null);assert.equal(movingMean(rows)[59].value,null);
});
test('newer coverage wins, and an equally current live endpoint is correctly identified',()=>{
  const snapshot={data:payload(),live:false}, live={data:payload(),live:true};
  assert.equal(newestArchive([snapshot,live]).live,true);
  live.data.requested_end='2024-11-23';assert.equal(newestArchive([live,snapshot]).live,false);
});
