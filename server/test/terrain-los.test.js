'use strict';
// 服务端地形遮挡判定。Run with: node --test test/terrain-los.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {createTerrain,CAMPAIGNS}=require('../lib/terrain');
const {startServer,connect,sleep}=require('./helpers/live_server');

const MOSCOW=6;                 // 莫斯科：山岭地形，起伏最大
const T=createTerrain(MOSCOW);
// 由 lib/terrain 实算得到的两组站位（见 CHANGELOG 说明）
const BLOCKED={a:[-120,-120],b:[-90,-120]};   // 中间隔着山脊
const CLEAR={a:[-120,-120],b:[-120,-90]};     // 视野通畅

// 在指定战役开一局，把两人放到给定坐标（贴地）
async function pvpAt(srv,pos){
 const a=await srv.register('host'),b=await srv.register('guest');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'地形测试',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'room_config',config:{campaign:MOSCOW}});
 await sleep(150);
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(150);
 host.send({type:'start_room'});
 await host.wait('match_start');await guest.wait('match_start');
 const hostId=host.last('room_state').id,guestId=guest.last('room_state').id;
 const st=(x,z)=>({x,y:T.heightAt(x,z),z,yaw:0,pitch:0,alive:true,deployed:true,cls:0});
 host.send({type:'state',state:st(pos.a[0],pos.a[1])});
 guest.send({type:'state',state:st(pos.b[0],pos.b[1])});
 await sleep(200);
 return {host,guest,hostId,guestId,a,b};
}
// 从 a 向 b 开一枪（弹道贴着两人的眼高，方向按三维归一化，与真实客户端一致）
function shootAt(sock,targetId,from,to){
 const oy=T.heightAt(from[0],from[1])+1.15, ty=T.heightAt(to[0],to[1])+1.15;
 const vx=to[0]-from[0],vy=ty-oy,vz=to[1]-from[1];
 const len=Math.hypot(vx,vy,vz);
 sock.send({type:'shot',target:targetId,w:'garand',
  ox:from[0],oy,oz:from[1],
  dx:vx/len,dy:vy/len,dz:vz/len});
}

test('地形数据覆盖全部战役且可复现', ()=>{
 assert.equal(CAMPAIGNS.length,7);
 for(let i=0;i<7;i++){
  const t=createTerrain(i);
  assert.equal(typeof t.heightAt(12,-34),'number');
  assert.equal(t.heightAt(12,-34),createTerrain(i).heightAt(12,-34),'同一战役两次构造必须给出相同高度');
 }
});
test('视野通畅时正常命中', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guestId}=await pvpAt(srv,CLEAR);
 host.clear();
 shootAt(host,guestId,CLEAR.a,CLEAR.b);
 const d=await host.wait('damage');
 assert.ok(d,'无遮挡应命中');
 assert.equal(d.hp,64,'加兰德 36 伤');
});
test('隔着山脊开枪打不中', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guestId}=await pvpAt(srv,BLOCKED);
 host.clear();
 shootAt(host,guestId,BLOCKED.a,BLOCKED.b);
 await sleep(300);
 assert.equal(host.take('damage').length,0,'山体应挡住子弹');
});
// 最需要防的是"误判"：把老实玩家的正常射击当成穿墙。平坦地图上必须一枪都不误伤。
test('平坦城区地图不会误判遮挡', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const flat=createTerrain(1);          // 斯大林格勒：城区，地形近乎平坦
 const a=await srv.register('host'),b=await srv.register('guest');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'平地测试',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'room_config',config:{campaign:1}});
 await sleep(150);
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(150);
 host.send({type:'start_room'});
 await host.wait('match_start');await guest.wait('match_start');
 const guestId=guest.last('room_state').id;
 // 在图上多处、多个距离各打一枪，全部都应命中
 const shots=[[[0,0],[0,25]],[[-60,20],[-60,60]],[[40,-30],[80,-30]],[[10,10],[-30,50]],[[100,0],[100,-90]]];
 const st=(x,z)=>({x,y:flat.heightAt(x,z),z,yaw:0,pitch:0,alive:true,deployed:true,cls:0});
 let hits=0,missed=[];
 for(let i=0;i<shots.length;i++){
  const [from,to]=shots[i];
  host.send({type:'state',state:st(from[0],from[1])});
  guest.send({type:'state',state:st(to[0],to[1])});
  await sleep(240);
  host.clear();
  const oy=flat.heightAt(from[0],from[1])+1.15,ty=flat.heightAt(to[0],to[1])+1.15;
  const vx=to[0]-from[0],vy=ty-oy,vz=to[1]-from[1],len=Math.hypot(vx,vy,vz);
  host.send({type:'shot',target:guestId,w:'garand',ox:from[0],oy,oz:from[1],dx:vx/len,dy:vy/len,dz:vz/len});
  const ev=await host.wait('damage',900);
  if(ev)hits++;else missed.push(from+'→'+to);
  // 打死了就走完整复活流程（服务端只在 hp<=0 时恢复满血），保证下一枪的目标是活的
  if(ev&&ev.killed){
   guest.send({type:'state',state:{...st(to[0],to[1]),alive:false,deployed:false}});
   await sleep(3200);
  }
 }
 assert.equal(hits,shots.length,'平坦地图上 '+shots.length+' 枪应全部命中，未命中：'+missed.join(' , '));
});
