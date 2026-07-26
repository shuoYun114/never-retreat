'use strict';
const crypto=require('crypto');
const {attachmentFits}=require('./weapon_meta');
// 商店可购武器（免费基础枪见 FREE）
const WEAPONS={
 garand:{name:'M1 加兰德',kind:'rifle',cost:0,classes:[0]}, thompson:{name:'汤普森 M1A1',kind:'assault',cost:0,classes:[1,2]}, m1911:{name:'M1911',kind:'pistol',cost:0,classes:[0,1,2,3,4,5,6,7]},
 springfield:{name:'春田 M1903A4',kind:'sniper',cost:650,classes:[3]}, stg44:{name:'STG 44',kind:'assault',cost:700,classes:[1,2]}, bar:{name:'BAR 自动步枪',kind:'rifle',cost:560,classes:[0,2]},
 kar98zf:{name:'Kar98k ZF41',kind:'sniper',cost:720,classes:[3]}, p38:{name:'瓦尔特 P38',kind:'pistol',cost:260,classes:[0,1,2,3,4,5,6,7]}
};
// 各阵营兵种自带枪械：兵种 → 无需购买即可使用
const FREE={
 kar98:[0,4],mosin:[0,4],arisaka:[0,4],zhongzheng:[0],hanyang:[0,4,5],
 mp40:[1],ppsh:[1],type100:[1],mp18:[1],c96auto:[1],
 dp28:[2],type96:[2],zb26:[2],type11:[2],
 mosinpu:[3],type97s:[3],zhongzhengs:[3],m1903:[4],
 bazooka:[5],schreck:[5],ptrd:[5],type97at:[5],boys:[5],
 m1carb:[6,7],g33:[6,7],m38carb:[6,7],type38c:[6,7],laotao:[6,7],
 tt33:[0,1,2,3,4,5,6,7],nambu:[0,1,2,3,4,5,6,7],c96:[0,1,2,3,4,5,6,7]
};
const ATTACH={scope_4x:{name:'4× 瞄准镜',cost:220},silencer:{name:'消音器',cost:180},extended_mag:{name:'扩容弹匣',cost:200},stock:{name:'稳定枪托',cost:160}};
const SESSION_TTL=30*24*3600*1000;
// 累计战绩只记真人对战：击杀/阵亡由服务端裁定，场次与胜负由对局结束时统一登记，
// 单人 BOT 战绩是浏览器上报的，不进这里。
function blankStats(){return {matches:0,wins:0,losses:0,kills:0,deaths:0};}
function defaults(){return {credits:0,owned:{garand:true,thompson:true,m1911:true},loadouts:{},stats:blankStats()};}
function tokenHash(t){return crypto.createHash('sha256').update(String(t)).digest('hex');}
function createStore(db,clock=()=>Date.now()){
 db.users||={};db.sessions||={};
 const user=n=>{
  const u=db.users[n];
  if(!u)throw Error('账号不存在');
  u.owned||={};u.loadouts||={};u.credits=Number(u.credits)||0;
  u.stats={...blankStats(),...(u.stats||{})};
  return u;
 };
 // 兵种自带 or 已购买，才算能用这把枪
 function canUse(n,cls,id){const u=user(n);return !!(FREE[id]?.includes(Number(cls))||WEAPONS[id]?.classes?.includes(Number(cls))||u.owned[id]);}
 // 该兵种保存的配装（服务端算伤害时要按改装件修正，和客户端 modifyWeapon 对齐）
 function loadout(n,cls){const l=user(n).loadouts[String(Math.max(0,Math.min(7,Number(cls)||0)))];return l?{weapon:l.weapon,attachments:[...(l.attachments||[])]}:null;}
 function view(n){const u=user(n);u.owned.garand??=true;u.owned.thompson??=true;u.owned.m1911??=true;return {username:n,credits:u.credits,owned:u.owned,loadouts:u.loadouts,stats:{...u.stats},isAdmin:!!u.isAdmin};}
 // 累加真人对战战绩，只接受已知字段的非负增量
 function bumpStats(n,patch){
  const u=user(n);
  for(const k of Object.keys(blankStats())){
   const v=Math.max(0,Math.min(1000,Math.floor(Number(patch?.[k])||0)));
   if(v)u.stats[k]+=v;
  }
  return {...u.stats};
 }
 // cred 可以是 {salt,hash}；测试里直接传字符串当哈希
 function create(n,cred){
  if(db.users[n])throw Error('账号已存在');
  const auth=typeof cred==='string'?{hash:cred,salt:''}:{hash:String(cred?.hash||''),salt:String(cred?.salt||'')};
  db.users[n]={...auth,...defaults(),createdAt:clock()};
  return view(n);
 }
 function award(n,amount){const u=user(n);if(!u.isAdmin)u.credits+=Math.max(0,Number(amount)||0);return view(n);}
 function buyable(id){return WEAPONS[id]||ATTACH[id];}
 function purchase(n,id){const u=user(n),x=buyable(id);if(!x)throw Error('未知商品');if(u.owned[id])throw Error('已拥有');if(!u.isAdmin&&u.credits<x.cost)throw Error('战功不足');if(!u.isAdmin)u.credits-=x.cost;u.owned[id]=true;return view(n);}
 function equip(n,cls,weapon,attachments){
  const u=user(n);
  cls=Math.max(0,Math.min(7,Number(cls)||0));
  if(!canUse(n,cls,weapon))throw Error('该兵种不能使用这把枪');
  attachments=[...new Set(attachments||[])].slice(0,4);
  for(const id of attachments){
   if(!ATTACH[id]||!u.owned[id])throw Error('改装未拥有');
   if(!attachmentFits(weapon,id,cls))throw Error('改装不兼容');
  }
  u.loadouts[String(cls)]={weapon,attachments};
  return view(n);
 }
 function pruneSessions(){const now=clock();let n=0;for(const [k,v] of Object.entries(db.sessions))if(!v||!v.user||!db.users[v.user]||!(v.exp>now)){delete db.sessions[k];n++;}return n;}
 // 会话落盘（只存 token 的 sha256），服务端重启后自动登录仍然有效
 function newSession(n){
  user(n);pruneSessions();
  for(const [k,v] of Object.entries(db.sessions))if(v.user===n)delete db.sessions[k];
  const t=crypto.randomBytes(24).toString('hex');
  db.sessions[tokenHash(t)]={user:n,exp:clock()+SESSION_TTL};
  return t;
 }
 function sessionUser(t){
  if(!t)return null;
  const s=db.sessions[tokenHash(t)];
  if(!s)return null;
  if(!(s.exp>clock())||!db.users[s.user]){delete db.sessions[tokenHash(t)];return null;}
  return s.user;
 }
 function dropSession(t){const k=tokenHash(t);const had=!!db.sessions[k];delete db.sessions[k];return had;}
 return {create,view,award,purchase,equip,canUse,loadout,bumpStats,newSession,sessionUser,dropSession,pruneSessions};
}
module.exports={createStore,WEAPONS,ATTACH,FREE};
