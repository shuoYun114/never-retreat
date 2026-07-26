'use strict';
// 爆炸物对真人玩家的伤害裁定。Run with: node --test test/explosion-damage.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {startServer,connect,sleep,ALIVE}=require('./helpers/live_server');

// 开一局两人对战：房主在原点，守方在 x=5
async function pvp(srv,cls=0){
 const a=await srv.register('host'),b=await srv.register('guest');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'爆炸测试',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(150);
 host.send({type:'start_room'});
 await host.wait('match_start');await guest.wait('match_start');
 const hostId=host.last('room_state').id,guestId=guest.last('room_state').id;
 host.send({type:'state',state:{...ALIVE,x:0,cls}});
 guest.send({type:'state',state:{...ALIVE,x:5}});
 await sleep(200);
 return {host,guest,hostId,guestId,a,b};
}

test('手雷按服务端爆炸表对真人结算伤害',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guestId}=await pvp(srv);
 host.clear();
 // 守方在 x=5，炸点 x=8 → 距离 3，半径 9 的手雷：(1-3/9)*135 = 90
 host.send({type:'boom',k:'nade',x:8,y:0.9,z:0});
 const d=await host.wait('damage');
 assert.ok(d,'应产生伤害事件');
 assert.equal(d.target,guestId);
 assert.equal(d.hp,10,'100 - 90 = 10');
 assert.equal(d.killed,false);
});

test('未登记的爆炸类型与冷却内的连续爆炸被丢弃',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host}=await pvp(srv);
 host.clear();
 host.send({type:'boom',k:'nuke',x:5,y:0.9,z:0});
 await sleep(200);
 assert.equal(host.take('damage').length,0,'未登记类型不应生效');
 host.send({type:'boom',k:'nade',x:8,y:0.9,z:0});
 await sleep(150);
 host.send({type:'boom',k:'nade',x:8,y:0.9,z:0});   // 冷却 1.2 秒内
 await sleep(300);
 assert.equal(host.take('damage').length,1,'冷却内的第二次爆炸应被丢弃');
});

test('炸点离本人过远被拒（防止远程投雷）',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host}=await pvp(srv);
 host.clear();
 host.send({type:'boom',k:'nade',x:200,y:0.9,z:200});
 await sleep(250);
 assert.equal(host.take('damage').length,0);
});

test('火箭筒只有反坦克兵能用',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await pvp(srv,0);      // 先以步枪兵身份
 host.clear();
 host.send({type:'boom',k:'at',x:6,y:0.9,z:0});
 await sleep(250);
 assert.equal(host.take('damage').length,0,'步枪兵不该能引爆火箭弹');
 // 换成反坦克兵(cls 5)后生效：距离 1，半径 5 → 95 + (10-95)*(1/5) = 78
 host.send({type:'state',state:{...ALIVE,x:0,cls:5}});
 await sleep(150);
 host.clear();
 host.send({type:'boom',k:'at',x:6,y:0.9,z:0});
 const d=await host.wait('damage');
 assert.ok(d,'反坦克兵应能造成伤害');
 assert.equal(d.hp,22,'100 - 78 = 22');
});

test('客户端上报的掩体遮挡只会降低伤害',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guestId}=await pvp(srv);
 host.clear();
 // 同样的距离 3，但声明目标被掩体挡住 → 90 * 0.25 = 22.5
 host.send({type:'boom',k:'nade',x:8,y:0.9,z:0,t:[{id:guestId,b:1}]});
 const d=await host.wait('damage');
 assert.ok(d);
 assert.equal(d.hp,77.5,'100 - 22.5 = 77.5');
});

test('爆炸击杀同样计入战功与阵亡数',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId,a}=await pvp(srv);
 host.clear();
 // 贴脸手雷：距离 0 → 满伤 135，直接击杀
 host.send({type:'boom',k:'nade',x:5,y:0.9,z:0});
 const d=await host.wait('damage');
 assert.ok(d&&d.killed,'贴脸手雷应当场击杀');
 assert.equal(d.hp,0);
 assert.equal(d.deaths,1);
 assert.equal(d.credits,100,'爆炸击杀也发战功');
 assert.equal((await srv.post('/api/me',{},a.token)).body.account.credits,100);
});

test('爆炸不会伤到自己（自伤仍由客户端本地结算）',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,hostId}=await pvp(srv);
 guest.clear();
 // 在自己脚下引爆，服务端不应给自己发伤害事件
 host.send({type:'boom',k:'nade',x:0,y:0.9,z:0});
 await sleep(300);
 assert.equal(guest.take('damage').filter(m=>m.target===hostId).length,0);
});

test('阵亡玩家不能引爆爆炸物',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId,hostId}=await pvp(srv);
 // 守方先把房主打死
 for(let i=0;i<4;i++){
  guest.send({type:'shot',target:hostId,w:'garand',ox:5,oy:1.15,oz:0,dx:-1,dy:0,dz:0});
  await sleep(230);
 }
 assert.ok(guest.take('damage').some(m=>m.killed),'房主应已阵亡');
 host.clear();
 host.send({type:'boom',k:'nade',x:5,y:0.9,z:0});
 await sleep(300);
 assert.equal(host.take('damage').length,0,'尸体不能扔雷');
});
