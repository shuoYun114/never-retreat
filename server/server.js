'use strict';
const http=require('http'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {createStore}=require('./lib/account_store');
const {createMatchStore}=require('./lib/match_store');
const PORT=Number(process.env.PORT||18080),HOST=process.env.HOST||'0.0.0.0';
const DATA=path.join(__dirname,'data','accounts.json'),rooms=new Map(),userSockets=new Map();
function load(){try{return JSON.parse(fs.readFileSync(DATA,'utf8'));}catch{return {users:{}};}}
let db=load();const store=createStore(db),matches=createMatchStore();
function save(){fs.mkdirSync(path.dirname(DATA),{recursive:true});const tmp=DATA+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DATA);}
function clean(v){return String(v||'').trim().replace(/[^\w\u4e00-\u9fa5-]/g,'').slice(0,16)}
function hash(p,s){return crypto.scryptSync(p,s,32).toString('hex')}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});res.end(JSON.stringify(data))}
function read(req){return new Promise((ok,no)=>{let x='';req.on('data',c=>{x+=c;if(x.length>8192)req.destroy()});req.on('end',()=>{try{ok(JSON.parse(x||'{}'))}catch{no()}})})}
function bearer(req){return (req.headers.authorization||'').replace(/^Bearer\s+/,'')}
function account(name){return store.view(name)}
async function api(req,res){
 if(req.method==='OPTIONS')return json(res,204,{});let b;try{b=await read(req)}catch{return json(res,400,{error:'请求格式错误'})}
 if(req.url==='/api/register'){
  const u=clean(b.username),p=String(b.password||'');if(u.length<3||p.length<6)return json(res,400,{error:'账号至少3位，密码至少6位'});if(db.users[u])return json(res,409,{error:'账号已存在'});
  const salt=crypto.randomBytes(16).toString('hex');store.create(u,{salt,hash:hash(p,salt)});db.users[u].salt=salt;db.users[u].hash=hash(p,salt);save();const token=store.newSession(u);kickUser(u,'账号已在另一台设备登录');return json(res,201,{token,account:account(u)});
 }
 if(req.url==='/api/login'){
  const u=clean(b.username),x=db.users[u],p=String(b.password||'');if(!x||!x.salt||!x.hash||!crypto.timingSafeEqual(Buffer.from(x.hash,'hex'),Buffer.from(hash(p,x.salt),'hex')))return json(res,401,{error:'账号或密码错误'});
  const token=store.newSession(u);kickUser(u,'账号已在另一台设备登录');return json(res,200,{token,account:account(u)});
 }
 const u=store.sessionUser(bearer(req));if(!u)return json(res,401,{error:'登录已失效，请重新登录'});
 if(req.url==='/api/me')return json(res,200,{account:account(u)});
 try{
  if(req.url==='/api/match/start'){const m=matches.start(u,{mode:String(b.mode||'solo').slice(0,12)});return json(res,201,{matchId:m.id,startedAt:m.startedAt})}
  if(req.url==='/api/match/end'){const r=matches.end(u,String(b.matchId||''),{kills:b.kills,deaths:b.deaths,score:b.score,reason:b.reason});const a=store.award(u,r.reward);save();return json(res,200,{settlement:r,account:a})}
  if(req.url==='/api/purchase'){const a=store.purchase(u,String(b.id||''));save();return json(res,200,{account:a})}
  if(req.url==='/api/equip'){const a=store.equip(u,b.classId,b.weapon,b.attachments);save();return json(res,200,{account:a})}
 }catch(e){return json(res,400,{error:e.message})}
 return json(res,404,{error:'接口不存在'});
}
function frame(o){const p=Buffer.from(JSON.stringify(o)),n=p.length;if(n<126)return Buffer.concat([Buffer.from([129,n]),p]);const h=Buffer.alloc(4);h[0]=129;h[1]=126;h.writeUInt16BE(n,2);return Buffer.concat([h,p])}function send(w,o){if(w.writable&&!w.destroyed)w.write(frame(o))}function cast(r,o,skip){for(const w of r||[])if(w!==skip)send(w,o)}
const num=(v,a,b)=>Number.isFinite(+v)&&+v>=a&&+v<=b?+v:null;
function leave(w){const r=rooms.get(w.room);if(r){r.delete(w);cast(r,{type:'leave',id:w.id},w);if(!r.size)rooms.delete(w.room)}w.room=null}
function pub(w){return{id:w.id,name:w.user,team:w.team,state:w.state,hp:w.hp,score:w.score,kills:w.kills,deaths:w.deaths}}
function kickUser(u,why){for(const w of userSockets.get(u)||[]){send(w,{type:'session_replaced',error:why});setTimeout(()=>w.destroy(),80)}userSockets.delete(u)}
function join(w,m){const u=store.sessionUser(String(m.token||''));if(!u)return send(w,{type:'auth_error',error:'登录已失效'});const old=userSockets.get(u);if(old){for(const x of old){send(x,{type:'session_replaced',error:'账号已在另一台设备登录'});setTimeout(()=>x.destroy(),80)}}userSockets.set(u,new Set([w]));leave(w);const key=String(m.room||'frontline').replace(/[^\w-]/g,'').slice(0,24)||'frontline',r=rooms.get(key)||new Set();rooms.set(key,r);w.room=key;w.user=u;w.team=m.team===1?1:0;w.hp=100;w.score=0;w.kills=0;w.deaths=0;w.state={x:0,y:0,z:0,yaw:0,pitch:0,alive:false,deployed:false,cls:0};r.add(w);send(w,{type:'welcome',id:w.id,room:key,account:account(u),players:[...r].filter(x=>x!==w).map(pub)});cast(r,{type:'join',player:pub(w)},w)}
function state(w,s){if(!w.room)return;const x=num(s.x,-260,260),y=num(s.y,-20,160),z=num(s.z,-260,260),yaw=num(s.yaw,-8,8),pitch=num(s.pitch,-3,3);if([x,y,z,yaw,pitch].includes(null))return;w.state={x,y,z,yaw,pitch,alive:!!s.alive&&w.hp>0,deployed:!!s.deployed,cls:Math.max(0,Math.min(7,+s.cls||0))};cast(rooms.get(w.room),{type:'state',id:w.id,state:w.state,hp:w.hp},w)}
function shot(w,m){const r=rooms.get(w.room);if(!r||!w.state?.alive)return;const q=[...r].find(x=>x.id===m.target);if(!q||q.team===w.team||!q.state?.alive)return;const ox=num(m.ox,-270,270),oy=num(m.oy,-20,180),oz=num(m.oz,-270,270),dx=num(m.dx,-1.1,1.1),dy=num(m.dy,-1.1,1.1),dz=num(m.dz,-1.1,1.1),dmg=num(m.dmg,1,120);if([ox,oy,oz,dx,dy,dz,dmg].includes(null)||Math.abs(Math.hypot(dx,dy,dz)-1)>.25)return;const vx=q.state.x-ox,vy=q.state.y+1.15-oy,vz=q.state.z-oz,t=vx*dx+vy*dy+vz*dz;if(t<0||t>180)return;const ex=vx-dx*t,ey=vy-dy*t,ez=vz-dz*t;if(ex*ex+ey*ey+ez*ez>2.2)return;q.hp=Math.max(0,q.hp-dmg*(m.head?1.7:1));let killed=q.hp===0,credits=0;if(killed){q.state.alive=false;q.deaths++;w.kills++;credits=m.head?125:100;w.score+=credits;store.award(w.user,credits);save()}cast(r,{type:'damage',attacker:w.id,target:q.id,hp:q.hp,killed,head:!!m.head,score:w.score,kills:w.kills,deaths:q.deaths,credits:account(w.user).credits})}
function message(w,text){let m;try{m=JSON.parse(text)}catch{return}if(m.type==='join')join(w,m);else if(m.type==='state')state(w,m.state||{});else if(m.type==='shot')shot(w,m)}
const srv=http.createServer((req,res)=>req.url.startsWith('/api/')?api(req,res):json(res,404,{error:'Steel Front API'}));
srv.on('upgrade',(q,w)=>{if((q.headers.upgrade||'').toLowerCase()!=='websocket'||!q.headers['sec-websocket-key'])return w.destroy();const a=crypto.createHash('sha1').update(q.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');w.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+a+'\r\n\r\n');w.id=crypto.randomBytes(5).toString('hex');let b=Buffer.alloc(0);w.on('data',c=>{b=Buffer.concat([b,c]);if(b.length>65536)return w.destroy();while(b.length>=2){let n=b[1]&127,o=2;if(n===126){if(b.length<4)return;n=b.readUInt16BE(2);o=4}const z=o+4+n;if(b.length<z)return;const op=b[0]&15,mask=b.subarray(o,o+4),p=Buffer.from(b.subarray(o+4,z));for(let i=0;i<p.length;i++)p[i]^=mask[i%4];b=b.subarray(z);if(op===1)message(w,p.toString())}});w.on('close',()=>leave(w));w.on('error',()=>leave(w))});
srv.listen(PORT,HOST,()=>console.log(`Steel Front server listening on ${HOST}:${PORT}`));
