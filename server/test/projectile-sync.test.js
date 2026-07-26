'use strict';
// 投掷物弹道同步。Run with: node --test test/projectile-sync.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {startServer,connect,sleep,ALIVE}=require('./helpers/live_server');

async function pvp(srv){
 const a=await srv.register('host'),b=await srv.register('guest');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'弹道测试',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(150);
 host.send({type:'start_room'});
 await host.wait('match_start');await guest.wait('match_start');
 const hostId=host.last('room_state').id;
 host.send({type:'state',state:{...ALIVE,x:0}});
 guest.send({type:'state',state:{...ALIVE,x:5}});
 await sleep(200);
 return {host,guest,hostId};
}
const THROW={type:'proj',k:'nade',x:0,y:1.6,z:0,vx:6,vy:8,vz:2,f:3.4};

test('投掷物弹道会转发给房间里的其他人', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,hostId}=await pvp(srv);
 guest.clear();
 host.send(THROW);
 const p=await guest.wait('proj');
 assert.ok(p,'对方应收到弹道');
 assert.equal(p.id,hostId,'带上投掷者 id，客户端据此取阵营');
 assert.equal(p.k,'nade');
 assert.deepEqual([p.x,p.y,p.z],[0,1.6,0]);
 assert.deepEqual([p.vx,p.vy,p.vz],[6,8,2]);
 assert.equal(p.f,3.4);
 assert.equal(host.take('proj').length,0,'不回弹给投掷者自己');
});
test('三种手投武器都能同步，未知类型被丢弃', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await pvp(srv);
 for(const k of ['nade','at','smoke']){
  guest.clear();
  host.send({...THROW,k});
  const p=await guest.wait('proj');
  assert.ok(p&&p.k===k,k+' 应被转发');
  await sleep(950);
 }
 guest.clear();
 host.send({...THROW,k:'nuke'});
 await sleep(250);
 assert.equal(guest.take('proj').length,0,'未登记类型不转发');
});
test('数值越界或离手过远的弹道被拒', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await pvp(srv);
 const bad=[
  {...THROW,x:200,z:200},        // 离本人 200 米
  {...THROW,vx:999},             // 速度越界
  {...THROW,f:99},               // 引信越界
  {...THROW,y:9999},             // 高度越界
  {...THROW,vy:'x'}              // 非数字
 ];
 for(const b of bad){
  guest.clear();
  host.send(b);
  await sleep(220);
  assert.equal(guest.take('proj').length,0,'应拒收: '+JSON.stringify(b).slice(0,60));
  await sleep(750);
 }
});
test('投掷频率受限，阵亡后不能再扔', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,hostId}=await pvp(srv);
 guest.clear();
 host.send(THROW);
 await sleep(120);
 host.send(THROW);                 // 700ms 冷却内
 await sleep(300);
 assert.equal(guest.take('proj').length,1,'冷却内的第二颗应被丢弃');
 // 把房主打死后不能再扔
 for(let i=0;i<4;i++){
  guest.send({type:'shot',target:hostId,w:'garand',ox:5,oy:1.15,oz:0,dx:-1,dy:0,dz:0});
  await sleep(230);
 }
 assert.ok(guest.take('damage').some(m=>m.killed),'房主应已阵亡');
 guest.clear();
 host.send(THROW);
 await sleep(300);
 assert.equal(guest.take('proj').length,0,'尸体不能扔雷');
});
