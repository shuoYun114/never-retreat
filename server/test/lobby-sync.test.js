'use strict';
// 大厅配置与票数同步的集成测试。Run with: node --test test/lobby-sync.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {startServer,connect,sleep}=require('./helpers/live_server');

async function lobby(srv,{campaign=0,size=0,hostTeam=0}={}){
 const a=await srv.register('h'),b=await srv.register('g');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'配置房',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'room_config',config:{campaign,size,hostTeam}});
 await sleep(150);
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(150);
 host.send({type:'start_room'});
 const hs=await host.wait('match_start'),gs=await guest.wait('match_start');
 return {a,b,host,guest,code,hs,gs};
}

test('房主的战役/规模/阵营设置会发给所有人',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {hs,gs}=await lobby(srv,{campaign:3,size:2,hostTeam:1});
 assert.equal(hs.config.campaign,3);
 assert.equal(hs.config.size,2);
 assert.deepEqual(gs.config,hs.config,'成员拿到的配置必须和房主一致');
 assert.equal(hs.team,1,'房主要拿到自己选的阵营');
 assert.equal(gs.team,0,'成员分到对面');
});
test('非法的战役/规模被忽略，不会把房间配置弄坏',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const a=await srv.register('h');
 const host=await connect(srv.port);
 host.send({type:'create_room',name:'边界房',token:a.token});
 await host.wait('room_state');
 host.send({type:'room_config',config:{campaign:99,size:-1,hostTeam:7}});
 await sleep(200);
 const st=host.last('room_state');
 assert.deepEqual({c:st.config.campaign,s:st.config.size,h:st.config.hostTeam},{c:0,s:0,h:0});
});
test('房主改配置后其他人的准备状态会被重置',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const a=await srv.register('h'),b=await srv.register('g');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'重置房',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 guest.send({type:'ready',ready:true});
 await sleep(150);
 assert.equal(guest.last('room_state').ready,true);
 host.send({type:'room_config',config:{campaign:2}});
 await sleep(200);
 assert.equal(guest.last('room_state').ready,false,'换地图后必须重新准备');
 host.send({type:'ready',ready:true});
 await sleep(120);
 host.send({type:'start_room'});
 const err=await host.wait('room_error');
 assert.match(err.error,/未准备/);
});
test('票数由房主广播，无限票(∞)也能正确转发',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await lobby(srv,{campaign:0});   // 诺曼底是攻防，守方无限票
 guest.clear();
 host.send({type:'tickets',t:[330,Infinity],time:900});   // Infinity 序列化成 null
 const t1=await guest.wait('tickets');
 assert.ok(t1,'成员应收到票数同步');
 assert.equal(t1.t[0],330);
 assert.equal(t1.t[1],null,'无限票以 null 传输，客户端还原成 Infinity');
 assert.equal(t1.time,900);
 // 非房主不能篡改票数
 guest.clear();
 guest.send({type:'tickets',t:[1,1],time:1});
 await sleep(250);
 assert.equal(host.take('tickets').length,0,'成员无权广播票数');
 // 越界数值被丢掉
 guest.clear();
 host.send({type:'tickets',t:[99999,0]});
 await sleep(250);
 assert.equal(guest.take('tickets').length,0,'越界票数应被拒');
});
test('房主宣布结束会同步给成员',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await lobby(srv);
 guest.clear();
 host.send({type:'match_over',winner:1});
 const over=await guest.wait('match_over');
 assert.ok(over&&over.winner===1);
 // 成员无权宣布
 host.clear();
 guest.send({type:'match_over',winner:0});
 await sleep(250);
 assert.equal(host.take('match_over').length,0);
});
