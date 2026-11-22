import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('archive controls have unique matching DOM targets',()=>{
  const html=readFileSync(new URL('../groan.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../groan-ui/archive-view.js',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'all page IDs must be unique');
  for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert.equal(ids.filter(x=>x===id).length,1,id);
});
