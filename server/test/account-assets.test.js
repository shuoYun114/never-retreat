'use strict';
// Run with: node --test test/account-assets.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {createStore}=require('../lib/account_store');

test('different accounts keep credits and inventory isolated',()=>{
 const s=createStore({users:{}});
 s.create('syhx','hash-a'); s.create('111','hash-b');
 s.award('syhx',1800); s.purchase('syhx','stg44');
 assert.equal(s.view('syhx').credits,1100);
 assert.equal(s.view('111').credits,0);
 assert.equal(s.view('111').owned.stg44,undefined);
});
test('a newer login invalidates the prior session',()=>{
 const s=createStore({users:{}});s.create('syhx','hash-a');
 const first=s.newSession('syhx'),second=s.newSession('syhx');
 assert.equal(s.sessionUser(first),null);
 assert.equal(s.sessionUser(second),'syhx');
});
test('only owned weapons and compatible attachments can be equipped',()=>{
 const s=createStore({users:{}});s.create('syhx','hash-a');s.award('syhx',2000);
 s.purchase('syhx','springfield');s.purchase('syhx','scope_4x');
 assert.throws(()=>s.equip('syhx',3,'stg44',[]));
 s.equip('syhx',3,'springfield',['scope_4x']);
 assert.deepEqual(s.view('syhx').loadouts['3'],{weapon:'springfield',attachments:['scope_4x']});
});
