'use strict';
// 起真实服务端进程跑的集成测试，覆盖之前被利用的几个口子。
// Run with: node --test test/combat-authority.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {startServer,connect,sleep,ALIVE}=require('./helpers/live_server');

// 开一局两人对战，返回 {srv,host,guest,code,hostId,guestId}
async function pvpMatch(srv){
 const a=await srv.register('host'),b=await srv.register('guest');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'测试房',token:a.token});
 const created=await host.wait('room_state');
 const code=created.room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(120);
 host.send({type:'start_room'});
 const hs=await host.wait('match_start'),gs=await guest.wait('match_start');
 assert.ok(hs&&gs,'双方都应收到开局');
 const hostId=host.last('room_state').id,guestId=guest.last('room_state').id;
 // 双方进场存活
 host.send({type:'state',state:{...ALIVE,x:0}});
 guest.send({type:'state',state:{...ALIVE,x:5}});
 await sleep(150);
 return {a,b,host,guest,code,hostId,guestId};
}
const shoot=(w,targetId,weapon,extra={})=>w.send({type:'shot',target:targetId,w:weapon,ox:0,oy:1.15,oz:0,dx:1,dy:0,dz:0,...extra});

test('伤害由服务端武器表裁定，客户端说了不算',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await pvpMatch(srv);
 host.clear();

 // 1) 伪造的武器 id 一律不认
 shoot(host,guestId,'railgun',{dmg:9999,head:true});
 await sleep(200);
 assert.equal(host.take('damage').length,0,'未登记的武器不应造成伤害');

 // 2) 客户端自报的 dmg/head 被忽略，按 M1 加兰德的 36 伤扣血
 shoot(host,guestId,'garand',{dmg:120,head:true});
 const d=await host.wait('damage');
 assert.ok(d,'合法开火应有伤害事件');
 assert.equal(d.hp,64,'应按服务端表 36 伤，而不是客户端的 120');
 assert.equal(d.killed,false);
 assert.equal(d.head,false,'爆头由服务端几何判定');

 // 3) 射速：加兰德 300rpm(间隔 170ms)，紧接着的连发要被丢掉
 await sleep(250);
 host.clear();
 shoot(host,guestId,'garand');
 await sleep(30);
 shoot(host,guestId,'garand');
 await sleep(250);
 assert.equal(host.take('damage').length,1,'射速内的连发只应生效一发');

 // 4) 这个兵种拿不到的枪不认（cls0 步枪兵用冲锋枪手的 MP40）
 host.clear();
 await sleep(400);
 shoot(host,guestId,'mp40');
 await sleep(200);
 assert.equal(host.take('damage').length,0,'兵种不可用的武器不应生效');
});

test('隔图开枪与超远射击被拒',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await pvpMatch(srv);
 host.clear();
 // 开枪点离本人上报位置 100 米
 host.send({type:'shot',target:guestId,w:'garand',ox:100,oy:1.15,oz:0,dx:1,dy:0,dz:0});
 await sleep(200);
 assert.equal(host.take('damage').length,0,'开枪点必须贴近本人位置');
 // 方向不是单位向量
 host.send({type:'shot',target:guestId,w:'garand',ox:0,oy:1.15,oz:0,dx:9,dy:0,dz:0});
 await sleep(200);
 assert.equal(host.take('damage').length,0,'非单位方向向量应被拒');
});

test('阵亡后可以重新进场，不再永久变尸体',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,hostId,guestId}=await pvpMatch(srv);
 // 加兰德 36 伤，连开几枪打死
 for(let i=0;i<4;i++){shoot(host,guestId,'garand');await sleep(230);}
 const dead=host.take('damage').find(x=>x.killed);
 assert.ok(dead,'应该打死一次');
 host.clear();
 // 受害者按真实客户端流程重新部署：阵亡 → 部署界面 → 过了复活冷却再进场
 guest.send({type:'state',state:{...ALIVE,alive:false,deployed:false}});
 await sleep(500);
 guest.send({type:'state',state:{...ALIVE,x:5}});
 await sleep(200);
 assert.equal(host.take('state').filter(m=>m.id===guestId).pop().hp,0,'冷却没过不能复活');
 await sleep(3000);
 guest.send({type:'state',state:{...ALIVE,x:5}});
 await sleep(300);
 const st=host.take('state').filter(m=>m.id===guestId).pop();
 assert.ok(st,'房主应收到对方状态');
 assert.equal(st.hp,100,'复活后应满血');
 assert.equal(st.state.alive,true,'复活后应存活');
 // 复活后本人也能重新造成伤害
 guest.clear();
 // 守方在 x=5，朝 -x 方向打房主，开枪点取自己的位置
 guest.send({type:'shot',target:hostId,w:'garand',ox:5,oy:1.15,oz:0,dx:-1,dy:0,dz:0});
 const back=await guest.wait('damage');
 assert.ok(back&&back.hp<100,'复活后应能重新开火');
});

test('非成员拿到 6 位房号也进不了已开始的对局',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {code}=await pvpMatch(srv);
 const spy=await connect(srv.port),c=await srv.register('spy');
 // 旧版的 join 入口可以直接落进战局，现在协议里已经没有这个入口
 spy.send({type:'join',room:code,team:0,token:c.token});
 await sleep(300);
 assert.equal(spy.take('welcome').length,0,'旧的 join 入口必须失效');
 assert.equal(spy.take('match_start').length,0);
 spy.send({type:'join_room',room:code,token:c.token});
 const err=await spy.wait('room_error');
 assert.ok(err&&/已经开始/.test(err.error),'非成员应被挡在门外');
});

test('原成员切战役重载后能回到自己的对局',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {b,guest,code,guestId}=await pvpMatch(srv);
 guest.close();                       // 模拟重载页面：连接断开
 await sleep(200);
 const again=await connect(srv.port); // 重载后用同一账号重新加入
 again.send({type:'join_room',room:code,token:b.token});
 const start=await again.wait('match_start');
 assert.ok(start,'原成员应能重新入场');
 assert.equal(start.rejoin,true);
 assert.ok(start.team===0||start.team===1,'应拿回自己的阵营');
});

test('战功刷不动：无效开火不发钱，击杀按服务端记账',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {a,host,guestId}=await pvpMatch(srv);
 // 疯狂刷伪造武器
 for(let i=0;i<40;i++)shoot(host,guestId,'railgun',{dmg:999,head:true});
 await sleep(400);
 assert.equal((await srv.post('/api/me',{},a.token)).body.account.credits,0,'无效开火不应产生战功');
 // 正常击杀发 100
 for(let i=0;i<4;i++){shoot(host,guestId,'garand');await sleep(230);}
 assert.equal((await srv.post('/api/me',{},a.token)).body.account.credits,100);
});

test('消息洪水会被断开',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guestId}=await pvpMatch(srv);
 for(let i=0;i<400;i++)shoot(host,guestId,'garand');
 await sleep(500);
 // 被断开后再发就收不到任何回应了
 host.clear();
 host.send({type:'state',state:ALIVE});
 await sleep(200);
 assert.equal(host.take('state').length,0,'洪水攻击应导致连接被回收');
});

test('接口异常不会带走整个进程',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const a=await srv.register('rob');
 // 各种畸形请求
 await fetch(srv.base+'/api/login',{method:'POST',body:'{'}).catch(()=>{});
 await fetch(srv.base+'/api/login',{method:'POST',body:'x'.repeat(20000)}).catch(()=>{});
 await srv.post('/api/equip',{classId:99,weapon:{},attachments:[1,2,3,4,5,6]},a.token);
 await srv.post('/api/match/end',{matchId:'nope'},a.token);
 await srv.post('/api/purchase',{id:'__proto__'},a.token);
 await srv.post('/api/nonexistent',{},a.token);
 const health=await fetch(srv.base+'/api/health');
 assert.equal(health.status,200,'服务端应还活着');
 assert.equal((await srv.post('/api/me',{},a.token)).status,200,'会话应还有效');
});
