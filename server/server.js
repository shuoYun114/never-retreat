'use strict';
/* 权威联机服务：房间大厅、真人位置、伤害/击杀裁定与战功发放全部由服务端决定。
   客户端只上报"我用哪把枪、从哪往哪打"，伤害数值一律取服务端武器表。 */
const http=require('http'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {createStore}=require('./lib/account_store');
const {createMatchStore}=require('./lib/match_store');
const {WEAPON_META,minShotInterval}=require('./lib/weapon_meta');
const {createTerrain}=require('./lib/terrain');

const PORT=Number(process.env.PORT||18080),HOST=process.env.HOST||'0.0.0.0';
const ALLOW_ORIGIN=process.env.ALLOW_ORIGIN||'*';
const DATA=process.env.DATA_FILE||path.join(__dirname,'data','accounts.json');
const rooms=new Map(),lobbies=new Map(),userSockets=new Map(),sockets=new Set();

const CAMPAIGN_COUNT=7,SIZE_COUNT=3;   // 与 client/js/01_data.js 的 CAMPAIGNS / SIZE_OPTS 对应
const ROOM_MAX=8;
const RESPAWN_MS=3000;                 // 服务端复活闸门(客户端是 8 秒，这里只拦异常快刷)
const LOBBY_GRACE_MS=120000;           // 开局后掉线/切战役重载的重连宽限
const HIT_RADIUS2=0.85;                // 命中判据半径²(≈0.92m)，比客户端 0.69m 略松以吸收延迟
const HEAD_TOL=0.4,ORIGIN_TOL=4,ORIGIN_TOL_VEH=14,MAX_RANGE=200;
const KILL_CREDIT=100,HEADSHOT_CREDIT=125,MAX_CREDITED_PER_VICTIM=10;
// 爆炸物威力表：数值与客户端 18_ballistics.js / 20_tank.js 的爆炸调用一一对应。
// linear=true 用 (1-d/r)*dmg（手雷），否则用 dmg→10 的线性插值（溅射）。
// maxRange 是落点相对开火者的最大距离，gap 是该类爆炸物的最小间隔(ms)。
const EXPLOSION={
 nade:    {r:9,  dmg:135,linear:true, maxRange:80, gap:1200},
 nade_top:{r:4,  dmg:80,               maxRange:80, gap:1200},
 mortar:  {r:7.5,dmg:135,              maxRange:270,gap:1500},
 at:      {r:5,  dmg:95,               maxRange:220,gap:1000,cls:5},
 bomb:    {r:9.5,dmg:170,              maxRange:240,gap:1200},
 shell:   {r:5,  dmg:95,               maxRange:270,gap:2200},
 shell_at:{r:5,  dmg:70,               maxRange:270,gap:2200}
};
const MIN_RANKED_MS=120000;            // 对局至少打这么久，才登记场次与胜负
// 地形遮挡判定：沿射线步进比对地形高度。容差取得比较宽松，
// 宁可漏判也不能误判——把老实玩家的正常射击判成穿墙比放过一个外挂更糟。
const LOS_STEP=2,LOS_TOL=0.6,LOS_SKIP_NEAR=3;
// 建筑遮挡：房主在开局时上传"永不会被摧毁"的碰撞盒（可摧毁的墙不参与，
// 否则打穿已炸开的墙会被误判）。所有客户端另外上报同一份数据的摘要，
// 只有全部摘要一致才启用——世界生成已按战役播种，各客户端几何本应逐字节相同。
const GEO_MAX_BOXES=4000,GEO_MAX_B64=64000,GEO_SKIP_NEAR=1.2;
const MSG_PER_SEC=90,PING_MS=25000,IDLE_MS=70000,SWEEP_MS=30000;
const log=(...a)=>console.log(new Date().toISOString(),...a);

// ---------------- 存档 ----------------
function load(){
 let raw='';
 try{raw=fs.readFileSync(DATA,'utf8');}catch{return {users:{},sessions:{}};}
 try{const j=JSON.parse(raw);j.users||={};j.sessions||={};return j;}
 catch(e){
  // 存档损坏时绝不能当空档覆盖回去，先备份再起空档，让运维能救回来
  const bak=DATA+'.broken-'+Date.now();
  try{fs.copyFileSync(DATA,bak);log('存档解析失败，已备份到',bak);}catch{}
  log('!! accounts.json 无法解析，本次以空存档启动：',e.message);
  return {users:{},sessions:{}};
 }
}
let db=load();
const store=createStore(db),matches=createMatchStore();
store.pruneSessions();
let flushT=null;
function save(){
 try{
  fs.mkdirSync(path.dirname(DATA),{recursive:true});
  const tmp=DATA+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(db,null,2));
  fs.renameSync(tmp,DATA);
  if(flushT){clearTimeout(flushT);flushT=null;}
  return true;
 }catch(e){log('存档写入失败：',e.message);return false;}
}
// 击杀发功这类高频写入合并到 2 秒一次，避免每次击杀都同步重写整个存档
function markDirty(){if(!flushT)flushT=setTimeout(()=>{flushT=null;save();},2000);}
function flush(){if(flushT){clearTimeout(flushT);flushT=null;}save();}

// ---------------- 兜底 ----------------
process.on('uncaughtException',e=>log('!! uncaughtException',e&&e.stack||e));
process.on('unhandledRejection',e=>log('!! unhandledRejection',e&&e.stack||e));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{log('收到',sig,'，保存存档后退出');flush();process.exit(0);});
process.on('beforeExit',()=>flush());
function guard(tag,fn){try{return fn();}catch(e){log('!!',tag,e&&e.message||e);}}

// ---------------- 工具 ----------------
function clean(v){return String(v||'').trim().replace(/[^\w一-龥-]/g,'').slice(0,16)}
const num=(v,a,b)=>Number.isFinite(+v)&&+v>=a&&+v<=b?+v:null;
const scrypt=(p,s)=>new Promise((ok,no)=>crypto.scrypt(String(p),String(s),32,(e,k)=>e?no(e):ok(k.toString('hex'))));
function samePass(stored,computed){
 try{
  const a=Buffer.from(String(stored||''),'hex'),b=Buffer.from(String(computed||''),'hex');
  return a.length>0&&a.length===b.length&&crypto.timingSafeEqual(a,b);
 }catch{return false;}
}
function account(name){return store.view(name)}
// 账号可能被运维从存档里删掉，这类调用一律不能把整个进程带走
function safeAccount(name){try{return store.view(name)}catch{return null}}
function safeCanUse(name,cls,id){try{return store.canUse(name,cls,id)}catch{return false}}
// 改装件对伤害的修正要和客户端 34_progression.js modifyWeapon 一致（目前只有消音器降伤）
function attachDamageMul(name,cls){
 try{return store.loadout(name,cls)?.attachments?.includes('silencer')?0.92:1}catch{return 1}
}

// 简易限速：登录/注册按 IP 与账号分别计数
const hits=new Map();
function limited(key,max,windowMs){
 const now=Date.now(),h=hits.get(key);
 if(!h||now>h.reset){hits.set(key,{n:1,reset:now+windowMs});return false;}
 h.n++;return h.n>max;
}
function ipOf(req){return String(req.socket?.remoteAddress||'?')}

function json(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':ALLOW_ORIGIN,
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}
function read(req){
 return new Promise((ok,no)=>{
  let x='',done=false;
  const fail=e=>{if(!done){done=true;no(e||Error('请求中断'))}};
  req.on('data',c=>{x+=c;if(x.length>8192){fail(Error('请求过大'));req.destroy();}});
  req.on('end',()=>{if(done)return;done=true;try{ok(JSON.parse(x||'{}'))}catch{no(Error('请求格式错误'))}});
  req.on('aborted',fail);req.on('error',fail);req.on('close',()=>fail());
 });
}
function bearer(req){return (req.headers.authorization||'').replace(/^Bearer\s+/,'')}

// ---------------- HTTP API ----------------
async function api(req,res){
 if(req.method==='OPTIONS')return json(res,204,{});
 let url='/';
 try{url=new URL(req.url,'http://x').pathname}catch{}
 if(url==='/api/health')return json(res,200,{ok:true,lobbies:lobbies.size,rooms:rooms.size,online:sockets.size});
 let b;
 try{b=await read(req)}catch(e){return json(res,400,{error:e.message||'请求格式错误'})}
 const ip=ipOf(req);

 if(url==='/api/register'){
  const u=clean(b.username),p=String(b.password||'');
  if(limited('reg:'+ip,5,600000))return json(res,429,{error:'注册过于频繁，请稍后再试'});
  if(u.length<3||p.length<6)return json(res,400,{error:'账号至少3位，密码至少6位'});
  if(db.users[u])return json(res,409,{error:'账号已存在'});
  const salt=crypto.randomBytes(16).toString('hex');
  store.create(u,{salt,hash:await scrypt(p,salt)});
  const token=store.newSession(u);
  save();
  kickUser(u,'账号已在另一台设备登录');
  return json(res,201,{token,account:account(u)});
 }
 if(url==='/api/login'){
  const u=clean(b.username),p=String(b.password||'');
  if(limited('login:'+ip,20,60000)||limited('login:u:'+u,8,60000))
   return json(res,429,{error:'登录尝试过多，请稍后再试'});
  const x=db.users[u];
  const ok=!!x&&samePass(x.hash,x.salt?await scrypt(p,x.salt):'');
  if(!ok)return json(res,401,{error:'账号或密码错误'});
  const token=store.newSession(u);
  save();
  kickUser(u,'账号已在另一台设备登录');
  return json(res,200,{token,account:account(u)});
 }

 const u=store.sessionUser(bearer(req));
 if(!u)return json(res,401,{error:'登录已失效，请重新登录'});
 try{
  if(url==='/api/me')return json(res,200,{account:account(u),dailyLeft:matches.dailyLeft(u)});
  if(url==='/api/logout'){store.dropSession(bearer(req));save();return json(res,200,{ok:true})}
  if(url==='/api/match/start'){const m=matches.start(u,{mode:String(b.mode||'solo').slice(0,12)});return json(res,201,{matchId:m.id,startedAt:m.startedAt})}
  if(url==='/api/match/end'){
   const r=matches.end(u,String(b.matchId||''),{kills:b.kills,deaths:b.deaths,score:b.score,reason:b.reason});
   const a=r.reward>0?store.award(u,r.reward):account(u);
   if(r.reward>0)save();
   return json(res,200,{settlement:r,account:a});
  }
  if(url==='/api/purchase'){const a=store.purchase(u,String(b.id||''));save();return json(res,200,{account:a})}
  if(url==='/api/equip'){const a=store.equip(u,b.classId,b.weapon,b.attachments);save();return json(res,200,{account:a})}
 }catch(e){return json(res,400,{error:e.message||'请求失败'})}
 return json(res,404,{error:'接口不存在'});
}

// ---------------- WebSocket ----------------
function frame(payload,op=1){
 const p=Buffer.isBuffer(payload)?payload:Buffer.from(JSON.stringify(payload)),n=p.length;
 let h;
 if(n<126){h=Buffer.from([128|op,n]);}
 else if(n<65536){h=Buffer.alloc(4);h[0]=128|op;h[1]=126;h.writeUInt16BE(n,2);}
 else {h=Buffer.alloc(10);h[0]=128|op;h[1]=127;h.writeBigUInt64BE(BigInt(n),2);}
 return Buffer.concat([h,p]);
}
function send(w,o){if(w.writable&&!w.destroyed)guard('send',()=>w.write(frame(o)))}
function cast(r,o,skip){for(const w of r||[])if(w!==skip)send(w,o)}
function rateOk(w){
 const now=Date.now();
 if(now-(w.winAt||0)>1000){w.winAt=now;w.winN=0;}
 return ++w.winN<=MSG_PER_SEC;
}

function pub(w){return{id:w.id,name:w.user,team:w.team,state:w.state,hp:w.hp,score:w.score,kills:w.kills,deaths:w.deaths,ready:!!w.ready,ping:w.rtt||0}}
function blankState(){return{x:0,y:0,z:0,yaw:0,pitch:0,alive:false,deployed:false,cls:0}}
function resetCombat(w,team){w.team=team;w.hp=100;w.score=0;w.kills=0;w.deaths=0;w.deadAt=0;w.shotAt=0;w.credited=new Map();w.state=blankState();}

function leaveCombat(w){
 const r=rooms.get(w.room);
 if(r){r.delete(w);cast(r,{type:'leave',id:w.id},w);if(!r.size)rooms.delete(w.room);}
 w.room=null;
}
// keepAlive=true 表示"掉线/重载"，房间留一段宽限等人回来；
// 主动退出/换房则立刻回收，不占着 6 位房号。
function leaveLobby(w,keepAlive){
 const l=lobbies.get(w.lobby);
 if(l){
  l.members.delete(w);
  if(l.host===w){l.host=[...l.members][0]||null;if(l.host){l.host.isHost=true;l.hostUser=l.host.user;}}
  if(!l.members.size){
   if(keepAlive)l.emptyAt=Date.now();
   else {lobbies.delete(l.id);rooms.delete(l.id);}
  }else lobbyState(l);
 }
 w.lobby=null;w.isHost=false;w.ready=false;
}
function dropSocket(w){
 leaveCombat(w);leaveLobby(w,true);sockets.delete(w);
 const set=userSockets.get(w.user);
 if(set){set.delete(w);if(!set.size)userSockets.delete(w.user);}
}
function kickUser(u,why){
 for(const w of userSockets.get(u)||[]){send(w,{type:'session_replaced',error:why});setTimeout(()=>w.destroy(),80);}
}
function auth(w,m){
 const u=store.sessionUser(String(m.token||''));
 if(!u){send(w,{type:'auth_error',error:'登录已失效，请重新登录'});return false;}
 if(w.user&&w.user!==u){const old=userSockets.get(w.user);if(old){old.delete(w);if(!old.size)userSockets.delete(w.user);}}
 for(const x of userSockets.get(u)||[]){if(x!==w){send(x,{type:'session_replaced',error:'账号已在另一台设备登录'});setTimeout(()=>x.destroy(),80);}}
 if(!userSockets.has(u))userSockets.set(u,new Set());
 userSockets.get(u).add(w);
 w.user=u;
 return true;
}
function code(){let x;do{x=String(crypto.randomInt(100000,1000000));}while(lobbies.has(x));return x;}
function lobbyState(l){
 for(const w of l.members)
  send(w,{type:'room_state',id:w.id,room:l.id,host:w===l.host,team:w.team,ready:!!w.ready,started:l.started,
   config:l.config,players:[...l.members].filter(x=>x!==w).map(pub)});
}

function createRoom(w,m){
 if(!auth(w,m))return;
 leaveCombat(w);leaveLobby(w);
 const id=code(),l={id,host:w,hostUser:w.user,members:new Set([w]),roster:{},started:false,emptyAt:0,
  config:{campaign:0,size:0,hostTeam:0,name:clean(m.name).slice(0,16)||'未命名房间'}};
 lobbies.set(id,l);
 w.lobby=id;w.isHost=true;w.ready=false;
 lobbyState(l);
}
function joinRoom(w,m){
 if(!auth(w,m))return;
 const id=String(m.room||'').replace(/\D/g,'').slice(0,6);
 if(!/^\d{6}$/.test(id))return send(w,{type:'room_error',error:'加入代码必须是 6 位数字'});
 const l=lobbies.get(id);
 if(!l)return send(w,{type:'room_error',error:'房间不存在或已关闭'});
 if(l.started){
  // 已开局：只有原成员能回来(切战役重载、掉线重连)，其余人一律挡在门外
  const slot=l.roster[w.user];
  if(!slot)return send(w,{type:'room_error',error:'对局已经开始'});
  leaveCombat(w);leaveLobby(w);
  l.members.add(w);l.emptyAt=0;
  if(l.hostUser===w.user||!l.host||l.host.destroyed){l.host=w;l.hostUser=w.user;}
  w.lobby=id;w.ready=true;w.isHost=l.host===w;
  resetCombat(w,slot.team);
  w.score=slot.score||0;w.kills=slot.kills||0;w.deaths=slot.deaths||0;
  w.room=id;
  const combat=rooms.get(id)||new Set();rooms.set(id,combat);combat.add(w);
  lobbyState(l);
  send(w,{type:'match_start',team:w.team,config:l.config,rejoin:true,players:[...combat].filter(x=>x!==w).map(pub)});
  cast(combat,{type:'join',player:pub(w)},w);
  return;
 }
 if(l.members.size>=ROOM_MAX)return send(w,{type:'room_error',error:'房间已满'});
 leaveCombat(w);leaveLobby(w);
 l.members.add(w);l.emptyAt=0;w.lobby=id;w.ready=false;
 // 房主重载回来时把主机身份还给他，房间配置也还在
 if(l.hostUser===w.user||!l.host||l.host.destroyed){l.host=w;l.hostUser=w.user;w.isHost=true;}
 lobbyState(l);
}
function ready(w,m){const l=lobbies.get(w.lobby);if(!l||l.started)return;w.ready=!!m.ready;lobbyState(l);}
function configRoom(w,m){
 const l=lobbies.get(w.lobby);
 if(!l||l.host!==w||l.started)return;
 const c=m.config||{};
 if(Number.isInteger(+c.campaign)&&+c.campaign>=0&&+c.campaign<CAMPAIGN_COUNT)l.config.campaign=+c.campaign;
 if(Number.isInteger(+c.size)&&+c.size>=0&&+c.size<SIZE_COUNT)l.config.size=+c.size;
 if(c.hostTeam===0||c.hostTeam===1)l.config.hostTeam=c.hostTeam;
 if(typeof c.name==='string')l.config.name=clean(c.name).slice(0,16)||l.config.name;
 // 换战役/换规模要让所有人重新准备，避免有人还在旧地图上点了准备
 for(const x of l.members)if(x!==w)x.ready=false;
 lobbyState(l);
}
function startRoom(w){
 const l=lobbies.get(w.lobby);
 if(!l||l.host!==w||l.started)return;
 if(l.members.size<2)return send(w,{type:'room_error',error:'至少需要两名玩家'});
 if([...l.members].some(x=>!x.ready))return send(w,{type:'room_error',error:'还有成员未准备'});
 l.started=true;l.emptyAt=0;l.roster={};l.startedAt=Date.now();l.ended=false;
 l.terrain=null;l.geo=null;                     // 换地图要重新收几何
 const combat=new Set();rooms.set(l.id,combat);
 // 房主必须先分配，保证"房主阵营"这个设置落在房主身上（重连过的房主在 Set 里不一定排第一）
 const order=[l.host,...[...l.members].filter(x=>x!==l.host)];
 let n=0;
 for(const x of order){
  if(!x)continue;
  resetCombat(x,n++%2===0?l.config.hostTeam:1-l.config.hostTeam);
  x.room=l.id;
  l.roster[x.user]={team:x.team,score:0,kills:0,deaths:0};
  combat.add(x);
 }
 for(const x of combat)send(x,{type:'match_start',team:x.team,config:l.config,players:[...combat].filter(y=>y!==x).map(pub)});
 lobbyState(l);
}
function syncRoster(w){
 const l=lobbies.get(w.room);
 if(l&&l.roster[w.user])l.roster[w.user]={team:w.team,score:w.score,kills:w.kills,deaths:w.deaths};
}

function state(w,s){
 if(!w.room||!rooms.has(w.room))return;
 const x=num(s.x,-260,260),y=num(s.y,-20,160),z=num(s.z,-260,260),yaw=num(s.yaw,-8,8),pitch=num(s.pitch,-3,3);
 if([x,y,z,yaw,pitch].includes(null))return;
 const now=Date.now();
 // 复活：阵亡冷却过后，客户端一旦重新进场就恢复满血。
 // 不要求"未部署→已部署"的跳变——标签页被挂起时那一帧可能根本没上报，
 // 那样就会永远停在 hp=0，别人眼里是尸体、自己也打不出伤害。
 if(w.hp<=0&&s.deployed&&s.alive&&now-(w.deadAt||0)>=RESPAWN_MS)w.hp=100;
 w.state={x,y,z,yaw,pitch,alive:!!s.alive&&w.hp>0,deployed:!!s.deployed,cls:Math.max(0,Math.min(7,+s.cls||0))};
 cast(rooms.get(w.room),{type:'state',id:w.id,state:w.state,hp:w.hp},w);
}
// 房间对应的地形：战役由大厅配置决定，服务端自己复现高度场，不依赖客户端上报
function terrainOf(w){
 const l=lobbies.get(w.room);
 if(!l)return null;
 if(!l.terrain)l.terrain=guard('terrain',()=>createTerrain(l.config.campaign))||null;
 return l.terrain;
}
// ---- 建筑遮挡 ----
// FNV-1a，与客户端 33_network.js 的摘要算法一致
function fnv1a(buf){
 let h=0x811c9dc5;
 for(let i=0;i<buf.length;i++){h^=buf[i];h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(16).padStart(8,'0');
}
// 房主上传几何：Int16 量化(0.1m) 的 [minX,minY,minZ,maxX,maxY,maxZ] × n，base64
function geoUpload(w,m){
 const l=lobbies.get(w.room);
 if(!l||l.host!==w||!l.started)return;
 if(l.geo&&l.geo.boxes)return;                                  // 一局只接受一次
 const n=num(m.n,0,GEO_MAX_BOXES),b64=String(m.d||'');
 if(n===null||!n||b64.length>GEO_MAX_B64)return;
 const raw=guard('geo-decode',()=>Buffer.from(b64,'base64'));
 if(!raw||raw.length!==n*12)return;                             // 6 个 int16 = 12 字节
 const boxes=new Float64Array(n*6);
 for(let i=0;i<n*6;i++)boxes[i]=raw.readInt16LE(i*2)/10;
 l.geo=l.geo||{digests:new Map()};
 l.geo.boxes=boxes;l.geo.n=n;l.geo.digest=fnv1a(raw);
 log('几何上传',l.id,n+'个盒子',l.geo.digest);
}
// 各客户端上报自己那份几何的摘要，用于交叉校验房主有没有做手脚
function geoDigest(w,m){
 const l=lobbies.get(w.room);
 if(!l||!l.started||!w.user)return;
 l.geo=l.geo||{digests:new Map()};
 l.geo.digests.set(w.user,String(m.h||'').slice(0,16));
}
// 只有拿到几何且所有上报的摘要都与之相符，才允许用建筑做遮挡判定
function geoUsable(l){
 const g=l&&l.geo;
 if(!g||!g.boxes)return null;
 if(g.ok===undefined||g.checked!==g.digests.size){
  g.checked=g.digests.size;
  g.ok=[...g.digests.values()].every(h=>h===g.digest);
  if(!g.ok)log('!! 几何摘要不一致，本局仅按地形判定遮挡',l.id,g.digest,[...g.digests.values()].join(','));
 }
 return g.ok?g:null;
}
// 射线与 AABB 求交（slab 法），命中且在射程内即视为被建筑挡住
function boxesBlock(g,ox,oy,oz,dx,dy,dz,dist){
 if(!g)return false;
 const far=dist-GEO_SKIP_NEAR,B=g.boxes;
 if(far<=GEO_SKIP_NEAR)return false;
 const ix=dx!==0?1/dx:Infinity,iy=dy!==0?1/dy:Infinity,iz=dz!==0?1/dz:Infinity;
 for(let k=0;k<B.length;k+=6){
  let t0=GEO_SKIP_NEAR,t1=far;
  let a=(B[k]-ox)*ix,b=(B[k+3]-ox)*ix;
  if(a>b){const s=a;a=b;b=s;}
  if(a>t0)t0=a; if(b<t1)t1=b;
  if(t0>t1)continue;
  a=(B[k+1]-oy)*iy;b=(B[k+4]-oy)*iy;
  if(a>b){const s=a;a=b;b=s;}
  if(a>t0)t0=a; if(b<t1)t1=b;
  if(t0>t1)continue;
  a=(B[k+2]-oz)*iz;b=(B[k+5]-oz)*iz;
  if(a>b){const s=a;a=b;b=s;}
  if(a>t0)t0=a; if(b<t1)t1=b;
  if(t0<=t1)return true;
 }
 return false;
}
// 射线是否被山体/地形挡住。
function terrainBlocks(t,ox,oy,oz,dx,dy,dz,dist){
 if(!t)return false;
 for(let s=LOS_SKIP_NEAR;s<dist-LOS_SKIP_NEAR;s+=LOS_STEP){
  const y=oy+dy*s;
  if(t.heightAt(ox+dx*s,oz+dz*s)>y+LOS_TOL)return true;
 }
 return false;
}
// 扣血 / 击杀 / 发功：子弹与爆炸共用同一套记账，返回要广播的事件
function hurt(w,q,dmg,head,r){
 if(!(dmg>0))return null;
 const now=Date.now();
 // 保留一位小数，避免浮点噪声（0.1 的血量差不影响击杀判定）被广播到血条上
 q.hp=Math.max(0,Math.round((q.hp-dmg)*10)/10);
 const killed=q.hp===0;
 let credits=null;
 if(killed){
  q.state.alive=false;q.deadAt=now;q.deaths++;w.kills++;
  const gain=head?HEADSHOT_CREDIT:KILL_CREDIT;
  w.score+=gain;
  // 同一个受害者反复送人头只计前 N 次，堵住两号对刷
  const n=w.credited.get(q.user)||0;
  if(n<MAX_CREDITED_PER_VICTIM&&q.user!==w.user){
   w.credited.set(q.user,n+1);
   guard('award',()=>{store.award(w.user,gain);markDirty();});
  }
  credits=safeAccount(w.user)?.credits??0;
  // 真人对战的累计战绩由服务端记账，不采信客户端上报
  guard('stats',()=>{store.bumpStats(w.user,{kills:1});store.bumpStats(q.user,{deaths:1});markDirty();});
  syncRoster(w);syncRoster(q);
 }
 return {type:'damage',attacker:w.id,target:q.id,hp:q.hp,killed,head,score:w.score,kills:w.kills,deaths:q.deaths,credits};
}
function shot(w,m){
 const r=rooms.get(w.room);
 if(!r||!w.state?.alive||w.hp<=0)return;
 const id=String(m.w||''),meta=WEAPON_META[id];
 if(!meta)return;                                        // 未登记的火力源不参与裁定
 const now=Date.now();
 if(now-(w.shotAt||0)<minShotInterval(id))return;        // 射速由服务端武器表决定
 if(!meta.vehicle&&!safeCanUse(w.user,w.state.cls,id))return;  // 这个兵种/这个账号确实能用这把枪
 const q=[...r].find(x=>x.id===m.target);
 if(!q||q.team===w.team||!q.state?.alive||q.hp<=0)return;
 const ox=num(m.ox,-270,270),oy=num(m.oy,-20,180),oz=num(m.oz,-270,270);
 const dx=num(m.dx,-1.1,1.1),dy=num(m.dy,-1.1,1.1),dz=num(m.dz,-1.1,1.1);
 if([ox,oy,oz,dx,dy,dz].includes(null))return;
 // 客户端各条开火路径都会 normalize()，这里收紧到 0.02：
 // 非单位向量会让下面的投影/垂距计算出现与长度成正比的偏差，宁可直接拒收
 if(Math.abs(Math.hypot(dx,dy,dz)-1)>.02)return;
 // 开枪点必须贴着本人上报的位置，杜绝隔图开枪
 const tol=meta.vehicle?ORIGIN_TOL_VEH:ORIGIN_TOL;
 if(Math.hypot(ox-w.state.x,oy-(w.state.y+1.15),oz-w.state.z)>tol)return;
 const vx=q.state.x-ox,vy=q.state.y+1.15-oy,vz=q.state.z-oz,t=vx*dx+vy*dy+vz*dz;
 if(t<0||t>MAX_RANGE)return;
 const ex=vx-dx*t,ey=vy-dy*t,ez=vz-dz*t;
 if(ex*ex+ey*ey+ez*ez>HIT_RADIUS2)return;
 if(terrainBlocks(terrainOf(w),ox,oy,oz,dx,dy,dz,t))return;   // 隔着山头打不中
 if(boxesBlock(geoUsable(lobbies.get(w.room)),ox,oy,oz,dx,dy,dz,t))return;   // 隔着不可摧毁的建筑打不中
 w.shotAt=now;
 // 爆头由服务端按几何判定，不采信客户端的 head 标记
 const head=Math.abs(oy+dy*t-(q.state.y+1.62))<HEAD_TOL;
 const mul=meta.vehicle?1:attachDamageMul(w.user,w.state.cls);
 const ev=hurt(w,q,meta.dmg*(head?meta.headMul:1)*mul,head,r);
 if(ev)cast(r,ev);
}
// 投掷物弹道转发：只为让同房间的人看见并躲开，不参与任何伤害计算，
// 因此校验只需保证数值合理、频率不过分。
const PROJ={nade:{gap:700},at:{gap:900},smoke:{gap:900}};
function proj(w,m){
 const r=rooms.get(w.room);
 if(!r||!w.state?.alive||w.hp<=0)return;
 const def=PROJ[String(m.k||'')];
 if(!def)return;
 const now=Date.now();
 w.projAt=w.projAt||{};
 if(now-(w.projAt[m.k]||0)<def.gap)return;
 const x=num(m.x,-270,270),y=num(m.y,-20,180),z=num(m.z,-270,270);
 const vx=num(m.vx,-60,60),vy=num(m.vy,-60,60),vz=num(m.vz,-60,60),f=num(m.f,0.2,12);
 if([x,y,z,vx,vy,vz,f].includes(null))return;
 if(Math.hypot(x-w.state.x,z-w.state.z)>6)return;      // 只能从自己手里扔出去
 w.projAt[m.k]=now;
 cast(r,{type:'proj',id:w.id,k:m.k,x,y,z,vx,vy,vz,f},w);
}
// 爆炸物（手雷/迫击炮/火箭筒/航弹/坦克炮弹）对真人的伤害。
// 客户端只上报"哪种爆炸、炸在哪"，威力半径与衰减一律取服务端表。
function boom(w,m){
 const r=rooms.get(w.room);
 if(!r||!w.state?.alive||w.hp<=0)return;
 const def=EXPLOSION[String(m.k||'')];
 if(!def)return;
 const now=Date.now();
 w.boomAt=w.boomAt||{};
 if(now-(w.boomAt[m.k]||0)<def.gap)return;                       // 每类爆炸物独立冷却
 if(def.cls!==undefined&&w.state.cls!==def.cls)return;           // 例如火箭筒只有反坦克兵能用
 const x=num(m.x,-270,270),y=num(m.y,-20,180),z=num(m.z,-270,270);
 if([x,y,z].includes(null))return;
 // 落点不能离本人太远：手雷是投掷距离，炮弹/航弹则放宽到射程
 if(Math.hypot(x-w.state.x,z-w.state.z)>def.maxRange)return;
 w.boomAt[m.k]=now;
 // 客户端可以额外上报"目标被掩体挡住"，这只会让伤害变小，因此可以采信
 const blocked=new Set();
 if(Array.isArray(m.t))for(const it of m.t.slice(0,16))if(it&&it.b)blocked.add(String(it.id));
 const terrain=terrainOf(w),geo=geoUsable(lobbies.get(w.room));
 for(const q of [...r]){
  // 自伤与 BOT 伤害仍由各客户端本地结算，服务端只裁定"别人打到的真人"
  if(q===w||!q.state?.alive||q.hp<=0)continue;
  if(q.team===w.team)continue;                                    // 不误伤队友
  const d=Math.hypot(q.state.x-x,q.state.y+0.9-y,q.state.z-z);
  if(d>=def.r)continue;
  let dmg=def.linear?(1-d/def.r)*def.dmg:def.dmg+(10-def.dmg)*(d/def.r);
  // 掩体或山体遮挡都按客户端 explodeAt 的同一衰减处理
  let shielded=blocked.has(q.id);
  if(!shielded&&d>1){
   const ix=(q.state.x-x)/d,iy=(q.state.y+0.9-y)/d,iz=(q.state.z-z)/d;
   shielded=terrainBlocks(terrain,x,y,z,ix,iy,iz,d)||boxesBlock(geo,x,y,z,ix,iy,iz,d);
  }
  if(shielded)dmg*=0.25;
  if(dmg<=2)continue;
  const ev=hurt(w,q,dmg,false,r);
  if(ev)cast(r,ev);
 }
}
// 票数/比分以房主为准广播，避免各客户端本地各算一套越算越偏
function ticketSync(w,m){
 const l=lobbies.get(w.room);
 if(!l||l.host!==w)return;
 const t=Array.isArray(m.t)?m.t:null;
 if(!t||t.length<2)return;
 // 攻防/破袭里守方票数是 Infinity，JSON 序列化后是 null —— null 原样转发，表示"无限"
 const ok=v=>v===null||num(v,0,9999)!==null;
 if(!ok(t[0])||!ok(t[1]))return;
 cast(rooms.get(w.room),{type:'tickets',t:[t[0]===null?null:+t[0],t[1]===null?null:+t[1]],time:num(m.time,0,99999)},w);
}
// 聊天：大厅和局内通用，team=true 只发给同阵营。文本只做长度与控制字符清理，
// 渲染由客户端用 textContent 完成，不存在注入问题。
function chat(w,m){
 const now=Date.now();
 if(now-(w.chatAt||0)<800)return;                     // 防刷屏
 const text=String(m.text||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
 if(!text)return;
 const room=rooms.get(w.room),lobby=lobbies.get(w.lobby);
 const targets=room||lobby?.members;
 if(!targets)return;
 w.chatAt=now;
 const team=!!m.team&&!!room;                          // 大厅还没分阵营，一律当全局
 const out={type:'chat',from:w.user,team,txt:text,mine:false};
 for(const x of targets){
  if(team&&x.team!==w.team)continue;
  send(x,{...out,mine:x===w});
 }
}
function matchOver(w,m){
 const l=lobbies.get(w.room);
 if(!l||l.host!==w||l.ended)return;
 const winner=m.winner===0||m.winner===1?m.winner:-1;
 l.ended=true;
 cast(rooms.get(w.room),{type:'match_over',winner},w);
 // 场次与胜负只在够长的对局里登记，免得开局即宣布结束来刷战绩
 if(Date.now()-(l.startedAt||0)<MIN_RANKED_MS)return;
 for(const x of rooms.get(w.room)||[]){
  if(!x.user)continue;
  guard('stats',()=>store.bumpStats(x.user,
   winner<0?{matches:1}:(x.team===winner?{matches:1,wins:1}:{matches:1,losses:1})));
 }
 markDirty();
}
function message(w,text){
 let m;
 try{m=JSON.parse(text)}catch{return}
 if(!m||typeof m.type!=='string')return;
 switch(m.type){
  case 'create_room':return createRoom(w,m);
  case 'join_room':return joinRoom(w,m);
  case 'ready':return ready(w,m);
  case 'room_config':return configRoom(w,m);
  case 'start_room':return startRoom(w);
  case 'leave_room':return void(leaveCombat(w),leaveLobby(w));
  case 'state':return state(w,m.state||{});
  case 'shot':return shot(w,m);
  case 'boom':return boom(w,m);
  case 'proj':return proj(w,m);
  case 'geo':return geoUpload(w,m);
  case 'geohash':return geoDigest(w,m);
  // 原样回弹让客户端算往返延迟；客户端顺便上报上一次的测量值，仅用于记分板展示
  case 'latency':{
   if(Number.isFinite(+m.rtt))w.rtt=Math.max(0,Math.min(2000,Math.round(+m.rtt)));
   return send(w,{type:'latency',t:m.t});
  }
  case 'chat':return chat(w,m);
  case 'tickets':return ticketSync(w,m);
  case 'match_over':return matchOver(w,m);
 }
}

const srv=http.createServer((req,res)=>{
 let p='/';
 try{p=new URL(req.url,'http://x').pathname}catch{}
 if(!p.startsWith('/api/'))return json(res,404,{error:'Never Retreat API'});
 api(req,res).catch(e=>{log('!! api',p,e&&e.stack||e);guard('api-500',()=>json(res,500,{error:'服务器内部错误'}))});
});
srv.on('upgrade',(q,w)=>{
 if((q.headers.upgrade||'').toLowerCase()!=='websocket'||!q.headers['sec-websocket-key'])return w.destroy();
 const a=crypto.createHash('sha1').update(q.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 w.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+a+'\r\n\r\n');
 w.id=crypto.randomBytes(5).toString('hex');
 w.seen=Date.now();w.winAt=0;w.winN=0;w.credited=new Map();
 sockets.add(w);
 let b=Buffer.alloc(0);
 w.on('data',c=>{
  w.seen=Date.now();
  b=Buffer.concat([b,c]);
  if(b.length>65536)return w.destroy();
  for(;;){
   if(b.length<2)return;
   const op=b[0]&15,masked=b[1]&128;
   let n=b[1]&127,o=2;
   if(n===126){if(b.length<4)return;n=b.readUInt16BE(2);o=4;}
   else if(n===127)return w.destroy();     // 超大帧直接断开，避免按 127 当长度解错位
   if(!masked)return w.destroy();          // 浏览器帧必须带掩码
   const z=o+4+n;
   if(b.length<z)return;
   const mask=b.subarray(o,o+4),p=Buffer.from(b.subarray(o+4,z));
   for(let i=0;i<p.length;i++)p[i]^=mask[i%4];
   b=b.subarray(z);
   if(op===8){guard('close',()=>w.write(frame(Buffer.alloc(0),8)));return w.destroy();}
   if(op===9){guard('pong',()=>w.write(frame(p,10)));continue;}
   if(op===10)continue;
   if(op!==1)continue;
   if(!rateOk(w)){log('限速断开',w.id,w.user||'-');return w.destroy();}
   guard('message',()=>message(w,p.toString()));
  }
 });
 w.on('close',()=>guard('close',()=>dropSocket(w)));
 w.on('error',()=>guard('error',()=>dropSocket(w)));
});

// 心跳：定期 ping，长时间没动静的连接直接回收
setInterval(()=>{
 const now=Date.now();
 for(const w of sockets){
  if(now-(w.seen||0)>IDLE_MS){w.destroy();continue;}
  guard('ping',()=>{if(w.writable&&!w.destroyed)w.write(frame(Buffer.alloc(0),9))});
 }
},PING_MS);
// 每 5 秒把房间里各人的延迟同步一次，供记分板展示
setInterval(()=>{
 for(const r of rooms.values()){
  if(r.size<2)continue;
  const p={};
  for(const w of r)p[w.id]=w.rtt||0;
  cast(r,{type:'pings',p});
 }
},5000);
// 清理：过期会话、限速表、超过宽限期的空房间
setInterval(()=>{
 const now=Date.now();
 if(store.pruneSessions())markDirty();
 for(const [k,v] of hits)if(now>v.reset)hits.delete(k);
 matches.sweep();
 for(const [id,l] of lobbies)
  if(l.emptyAt&&!l.members.size&&now-l.emptyAt>LOBBY_GRACE_MS){lobbies.delete(id);rooms.delete(id);}
 for(const [id,r] of rooms)if(!r.size&&!lobbies.has(id))rooms.delete(id);
},SWEEP_MS);

srv.listen(PORT,HOST,()=>log(`Never Retreat server listening on ${HOST}:${PORT}`));
