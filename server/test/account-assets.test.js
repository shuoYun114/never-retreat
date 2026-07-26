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
 const s=createStore({users:{},sessions:{}});s.create('syhx','hash-a');
 const first=s.newSession('syhx'),second=s.newSession('syhx');
 assert.equal(s.sessionUser(first),null);
 assert.equal(s.sessionUser(second),'syhx');
});
test('session tokens are unguessable and never stored in the clear',()=>{
 const db={users:{},sessions:{}};
 const s=createStore(db);s.create('syhx','hash-a');
 const t=s.newSession('syhx');
 assert.match(t,/^[0-9a-f]{48}$/);                      // crypto 随机，不是 Math.random
 assert.equal(Object.keys(db.sessions).length,1);
 assert.ok(!JSON.stringify(db.sessions).includes(t));    // 存档里只有 token 的哈希
 assert.equal(s.sessionUser(t),'syhx');
 s.dropSession(t);
 assert.equal(s.sessionUser(t),null);
});
test('sessions survive a restart because they live in the save file',()=>{
 const db={users:{},sessions:{}};
 const t=(()=>{const s=createStore(db);s.create('syhx','hash-a');return s.newSession('syhx')})();
 const reloaded=createStore(JSON.parse(JSON.stringify(db)));   // 模拟重启后重新读档
 assert.equal(reloaded.sessionUser(t),'syhx');
});
test('expired sessions are rejected and pruned',()=>{
 let now=1_000_000;
 const db={users:{},sessions:{}};
 const s=createStore(db,()=>now);
 s.create('syhx','hash-a');
 const t=s.newSession('syhx');
 now+=31*24*3600*1000;
 assert.equal(s.sessionUser(t),null);
 s.pruneSessions();
 assert.equal(Object.keys(db.sessions).length,0);
});
test('only owned weapons and compatible attachments can be equipped',()=>{
 const s=createStore({users:{}});s.create('syhx','hash-a');s.award('syhx',2000);
 s.purchase('syhx','springfield');s.purchase('syhx','scope_4x');
 assert.throws(()=>s.equip('syhx',3,'stg44',[]),/不能使用/);               // 没买 STG44
 assert.throws(()=>s.equip('syhx',3,'springfield',['scope_4x']),/不兼容/);  // 春田自带 4×镜
 assert.throws(()=>s.equip('syhx',0,'kar98',['silencer']),/未拥有/);        // 消音器没买
 s.equip('syhx',0,'kar98',['scope_4x']);                                   // 兵种自带枪 + 已购镜
 assert.deepEqual(s.view('syhx').loadouts['0'],{weapon:'kar98',attachments:['scope_4x']});
 s.equip('syhx',3,'springfield',[]);
 assert.deepEqual(s.view('syhx').loadouts['3'],{weapon:'springfield',attachments:[]});
 assert.deepEqual(s.loadout('syhx',3),{weapon:'springfield',attachments:[]});
});
test('class-issued weapons need no purchase but foreign ones do',()=>{
 const s=createStore({users:{}});s.create('syhx','hash-a');
 assert.equal(s.canUse('syhx',1,'mp40'),true);          // 冲锋枪手自带
 assert.equal(s.canUse('syhx',0,'mp40'),false);         // 步枪兵不能拿
 assert.equal(s.canUse('syhx',3,'springfield'),true);   // 商店枪的兵种表含狙击兵
 assert.equal(s.canUse('syhx',0,'springfield'),false);
 assert.equal(s.canUse('syhx',0,'nosuchgun'),false);
});
test('admin accounts neither earn nor spend credits',()=>{
 const db={users:{}};
 const s=createStore(db);s.create('root','h');db.users.root.isAdmin=true;
 s.award('root',900);
 assert.equal(s.view('root').credits,0);
 s.purchase('root','kar98zf');
 assert.equal(s.view('root').credits,0);
 assert.equal(s.view('root').owned.kar98zf,true);
});
