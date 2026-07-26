'use strict';
// 聊天与累计战绩。Run with: node --test test/chat-and-stats.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {createStore}=require('../lib/account_store');
const {startServer,connect,sleep,ALIVE}=require('./helpers/live_server');

async function lobbyPair(srv){
 const a=await srv.register('h'),b=await srv.register('g');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'聊天房',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 return {a,b,host,guest,code};
}
async function startMatch(srv){
 const p=await lobbyPair(srv);
 p.host.send({type:'ready',ready:true});p.guest.send({type:'ready',ready:true});
 await sleep(150);
 p.host.send({type:'start_room'});
 await p.host.wait('match_start');await p.guest.wait('match_start');
 p.hostId=p.host.last('room_state').id;p.guestId=p.guest.last('room_state').id;
 p.host.send({type:'state',state:{...ALIVE,x:0}});
 p.guest.send({type:'state',state:{...ALIVE,x:5}});
 await sleep(200);
 return p;
}

test('大厅里的聊天会发给所有成员，自己也收到回显',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {a,host,guest}=await lobbyPair(srv);
 host.clear();guest.clear();
 host.send({type:'chat',text:'大家准备好了吗'});
 const got=await guest.wait('chat');
 assert.ok(got,'成员应收到聊天');
 assert.equal(got.txt,'大家准备好了吗');
 assert.equal(got.from,a.user);
 assert.equal(got.team,false);
 assert.equal(got.mine,false);
 const echo=host.last('chat');
 assert.ok(echo&&echo.mine===true,'发送者应收到标记为自己的回显');
});
test('局内队伍频道只发给同阵营',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await startMatch(srv);
 host.clear();guest.clear();
 host.send({type:'chat',text:'左翼包抄',team:true});
 await sleep(300);
 assert.equal(guest.take('chat').length,0,'敌方不应看到队伍消息');
 assert.ok(host.last('chat')?.team===true,'自己能看到队伍消息');
 // 全局消息双方都能看到（等过 800ms 限流）
 await sleep(900);
 guest.clear();
 host.send({type:'chat',text:'gg'});
 assert.ok(await guest.wait('chat'),'全局消息对方应收到');
});
test('聊天限流与文本清理',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest}=await lobbyPair(srv);
 guest.clear();
 host.send({type:'chat',text:'第一条'});
 await sleep(120);
 host.send({type:'chat',text:'刷屏'});          // 800ms 内
 await sleep(300);
 assert.equal(guest.take('chat').length,1,'限流内的第二条应被丢弃');
 await sleep(800);
 guest.clear();
 host.send({type:'chat',text:'  多余   空格和控制字符  '});
 const got=await guest.wait('chat');
 assert.equal(got.txt,'多余 空格 和控制字符','控制字符与连续空白被清理');
 await sleep(900);
 guest.clear();
 host.send({type:'chat',text:'x'.repeat(300)});
 const long=await guest.wait('chat');
 assert.equal(long.txt.length,120,'超长文本被截断');
 await sleep(900);
 guest.clear();
 host.send({type:'chat',text:'   '});
 await sleep(250);
 assert.equal(guest.take('chat').length,0,'空消息不广播');
});
test('不在房间里不能发聊天',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const c=await srv.register('lone');
 const lone=await connect(srv.port);
 lone.send({type:'chat',text:'有人吗'});
 await sleep(250);
 assert.equal(lone.take('chat').length,0);
});

test('真人对战的击杀与阵亡由服务端累计',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {a,b,host,guestId}=await startMatch(srv);
 for(let i=0;i<4;i++){
  host.send({type:'shot',target:guestId,w:'garand',ox:0,oy:1.15,oz:0,dx:1,dy:0,dz:0});
  await sleep(230);
 }
 assert.ok(host.take('damage').some(m=>m.killed),'应完成一次击杀');
 await sleep(2500);   // 等存档合并写入
 const hs=(await srv.post('/api/me',{},a.token)).body.account.stats;
 const gs=(await srv.post('/api/me',{},b.token)).body.account.stats;
 assert.equal(hs.kills,1);
 assert.equal(hs.deaths,0);
 assert.equal(gs.kills,0);
 assert.equal(gs.deaths,1);
});
test('太短的对局不登记场次与胜负',async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {a,host}=await startMatch(srv);
 host.send({type:'match_over',winner:0});
 await sleep(400);
 const st=(await srv.post('/api/me',{},a.token)).body.account.stats;
 assert.equal(st.matches,0,'开局即结束不应算一场');
 assert.equal(st.wins,0);
});
test('战绩累加只接受已知字段的非负增量',()=>{
 const s=createStore({users:{}});
 s.create('syhx','h');
 assert.deepEqual(s.view('syhx').stats,{matches:0,wins:0,losses:0,kills:0,deaths:0});
 s.bumpStats('syhx',{matches:1,wins:1,kills:3});
 s.bumpStats('syhx',{kills:2,deaths:1});
 assert.deepEqual(s.view('syhx').stats,{matches:1,wins:1,losses:0,kills:5,deaths:1});
 s.bumpStats('syhx',{kills:-99,credits:9999,matches:1e9});
 const st=s.view('syhx').stats;
 assert.equal(st.kills,5,'负数被忽略');
 assert.equal(st.credits,undefined,'未知字段不写入');
 assert.equal(st.matches,1001,'单次增量被限幅到 1000');
});
test('老存档没有 stats 字段也能正常读写',()=>{
 const db={users:{old:{hash:'h',credits:50,owned:{},loadouts:{}}}};
 const s=createStore(db);
 assert.deepEqual(s.view('old').stats,{matches:0,wins:0,losses:0,kills:0,deaths:0});
 s.bumpStats('old',{kills:1});
 assert.equal(s.view('old').stats.kills,1);
 assert.equal(s.view('old').credits,50,'原有战功不受影响');
});
