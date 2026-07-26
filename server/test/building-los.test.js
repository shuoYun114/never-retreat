'use strict';
// 服务端建筑遮挡（房主上传几何 + 摘要交叉校验）。Run with: node --test test/building-los.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
const {createTerrain}=require('../lib/terrain');
const {startServer,connect,sleep}=require('./helpers/live_server');

const MAP=1;                       // 斯大林格勒：地形近乎平坦，把地形遮挡排除在外
const T=createTerrain(MAP);
// 一面 10m 长、6m 高、0.5m 厚的墙，横在 z=-10 处（取自诺曼底实际几何的尺寸）
const WALL=[-2,0.29,-10.25,8,6.29,-9.75];
const SOUTH=[3,-14],NORTH=[3,-6],FAR_SOUTH=[3,-20];

// 把盒子按 Int16(0.1m) 量化成 base64，并算出与服务端一致的 FNV-1a 摘要
function packGeometry(boxes){
 const buf=Buffer.alloc(boxes.length*12);
 boxes.forEach((b,bi)=>b.forEach((v,i)=>buf.writeInt16LE(Math.round(v*10),bi*12+i*2)));
 let h=0x811c9dc5;
 for(const byte of buf){h^=byte;h=Math.imul(h,0x01000193)>>>0;}
 return {n:boxes.length,d:buf.toString('base64'),h:h.toString(16).padStart(8,'0')};
}

async function match(srv){
 const a=await srv.register('host'),b=await srv.register('guest');
 const host=await connect(srv.port),guest=await connect(srv.port);
 host.send({type:'create_room',name:'建筑遮挡',token:a.token});
 const code=(await host.wait('room_state')).room;
 guest.send({type:'join_room',room:code,token:b.token});
 await guest.wait('room_state');
 host.send({type:'room_config',config:{campaign:MAP}});
 await sleep(150);
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await sleep(150);
 host.send({type:'start_room'});
 await host.wait('match_start');await guest.wait('match_start');
 return {host,guest,guestId:guest.last('room_state').id,a,b};
}
const st=(x,z)=>({x,y:T.heightAt(x,z),z,yaw:0,pitch:0,alive:true,deployed:true,cls:0});
async function place(host,guest,from,to){
 host.send({type:'state',state:st(from[0],from[1])});
 guest.send({type:'state',state:st(to[0],to[1])});
 await sleep(240);
}
function shoot(sock,targetId,from,to){
 const oy=T.heightAt(from[0],from[1])+1.15,ty=T.heightAt(to[0],to[1])+1.15;
 const vx=to[0]-from[0],vy=ty-oy,vz=to[1]-from[1],len=Math.hypot(vx,vy,vz);
 sock.send({type:'shot',target:targetId,w:'garand',ox:from[0],oy,oz:from[1],dx:vx/len,dy:vy/len,dz:vz/len});
}

test('摘要一致时，隔着不可摧毁的墙打不中', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await match(srv);
 const g=packGeometry([WALL]);
 host.send({type:'geo',n:g.n,d:g.d});
 host.send({type:'geohash',h:g.h});
 guest.send({type:'geohash',h:g.h});
 await sleep(300);
 // 墙的两侧对射
 await place(host,guest,SOUTH,NORTH);
 host.clear();
 shoot(host,guestId,SOUTH,NORTH);
 await sleep(350);
 assert.equal(host.take('damage').length,0,'墙应挡住子弹');
 // 同侧、不经过墙 → 正常命中
 await place(host,guest,SOUTH,FAR_SOUTH);
 host.clear();
 shoot(host,guestId,SOUTH,FAR_SOUTH);
 const d=await host.wait('damage');
 assert.ok(d,'没有遮挡时应命中');
 assert.equal(d.hp,64);
});

test('有客户端摘要不一致时退回只判地形（不误伤正常射击）', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await match(srv);
 const g=packGeometry([WALL]);
 host.send({type:'geo',n:g.n,d:g.d});
 host.send({type:'geohash',h:g.h});
 guest.send({type:'geohash',h:'deadbeef'});      // 与房主不符
 await sleep(300);
 await place(host,guest,SOUTH,NORTH);
 host.clear();
 shoot(host,guestId,SOUTH,NORTH);
 const d=await host.wait('damage');
 assert.ok(d,'几何不可信时应放弃建筑判定，正常射击必须照常生效');
});

test('非房主上传的几何不被采用', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await match(srv);
 const g=packGeometry([WALL]);
 guest.send({type:'geo',n:g.n,d:g.d});           // 成员冒充上传
 guest.send({type:'geohash',h:g.h});
 host.send({type:'geohash',h:g.h});
 await sleep(300);
 await place(host,guest,SOUTH,NORTH);
 host.clear();
 shoot(host,guestId,SOUTH,NORTH);
 const d=await host.wait('damage');
 assert.ok(d,'成员上传的几何应被忽略，因此这一枪照常命中');
});

test('畸形几何数据被丢弃', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await match(srv);
 const g=packGeometry([WALL]);
 host.send({type:'geo',n:99,d:g.d});             // 声明的盒子数与数据长度不符
 host.send({type:'geohash',h:g.h});
 guest.send({type:'geohash',h:g.h});
 await sleep(300);
 await place(host,guest,SOUTH,NORTH);
 host.clear();
 shoot(host,guestId,SOUTH,NORTH);
 const d=await host.wait('damage');
 assert.ok(d,'数据被丢弃后应退回只判地形');
 // 补一条：盒子数超上限
 host.send({type:'geo',n:99999,d:g.d});
 await sleep(200);
 const health=await fetch(srv.base+'/api/health');
 assert.equal(health.status,200,'畸形数据不应影响服务端存活');
});

test('一局只接受一次几何上传', async t=>{
 const srv=await startServer();
 t.after(()=>srv.stop());
 const {host,guest,guestId}=await match(srv);
 const wall=packGeometry([WALL]);
 host.send({type:'geo',n:wall.n,d:wall.d});
 host.send({type:'geohash',h:wall.h});
 guest.send({type:'geohash',h:wall.h});
 await sleep(300);
 // 再传一份"空几何"想把墙抹掉——应该被拒
 const empty=packGeometry([[999,999,999,999.1,999.1,999.1]]);
 host.send({type:'geo',n:empty.n,d:empty.d});
 await sleep(250);
 await place(host,guest,SOUTH,NORTH);
 host.clear();
 shoot(host,guestId,SOUTH,NORTH);
 await sleep(350);
 assert.equal(host.take('damage').length,0,'第二次上传应被忽略，墙依然挡子弹');
});
