import test from 'node:test';
import assert from 'node:assert/strict';
import {collectArchives,archiveFreshness} from '../groan-ui/archive-data.mjs';

const record=(end,generated='2026-11-22T23:00:00Z')=>({requested_end:end,generated_at:generated,days:[{date:end}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};

test('a usable snapshot appears before a slow connection, then a newer live export replaces it',async()=>{
 const live=deferred(),first=deferred(),states=[];
 const work=collectArchives([{read:()=>Promise.resolve(record('2026-11-20')),live:false},{read:()=>live.promise,live:true}],s=>{states.push(s);first.resolve();});
 await first.promise;
 assert.equal(states[0].selected.data.requested_end,'2026-11-20');assert.equal(states[0].pending,1);
 live.resolve(record('2026-11-21'));await work;
 assert.equal(states.at(-1).selected.data.requested_end,'2026-11-21');assert.equal(states.at(-1).selected.live,true);assert.equal(states.at(-1).pending,0);
});
test('failures and an older source cannot erase a newer loaded export',async()=>{
 const previous={data:record('2026-11-21'),live:true};let last;
 await collectArchives([{read:()=>Promise.resolve(record('2026-11-20')),live:false},{read:()=>Promise.reject(Error('unavailable')),live:true}],s=>last=s,previous);
 assert.equal(last.selected,previous);assert.equal(last.received,1);
 await collectArchives([{read:()=>Promise.reject(Error('unavailable')),live:true}],s=>last=s);
 assert.equal(last.selected,null);assert.equal(last.pending,0);assert.equal(last.received,0);
});
test('observation age follows UTC dates and does not confuse a new export with new observations',()=>{
 assert.match(archiveFreshness(record('2026-11-21'),'2026-11-22T00:01:00Z'),/1 day before today/);
 assert.match(archiveFreshness(record('2026-11-20'),'2026-11-22T23:59:00Z'),/2 days before today/);
 assert.match(archiveFreshness(record('2026-11-22'),'2026-11-22T00:01:00Z'),/today, UTC/);
 assert.match(archiveFreshness(record('2026-11-23'),'2026-11-22T00:01:00Z'),/check the device clock/);
});
