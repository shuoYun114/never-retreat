'use strict';
const WEAPONS={
 garand:{name:'M1 加兰德',kind:'rifle',cost:0,classes:[0]}, thompson:{name:'汤普森 M1A1',kind:'assault',cost:0,classes:[1,2]}, m1911:{name:'M1911',kind:'pistol',cost:0,classes:[0,1,2,3,4,5,6,7]},
 springfield:{name:'春田 M1903A4',kind:'sniper',cost:650,classes:[3]}, stg44:{name:'STG 44',kind:'assault',cost:700,classes:[1,2]}, bar:{name:'BAR 自动步枪',kind:'rifle',cost:560,classes:[0,2]},
 kar98zf:{name:'Kar98k ZF41',kind:'sniper',cost:720,classes:[3]}, p38:{name:'瓦尔特 P38',kind:'pistol',cost:260,classes:[0,1,2,3,4,5,6,7]}
};
const ATTACH={scope_4x:{name:'4× 瞄准镜',cost:220,kinds:['sniper']},silencer:{name:'消音器',cost:180,kinds:['sniper','assault','pistol']},extended_mag:{name:'扩容弹匣',cost:200,kinds:['rifle','assault','pistol']},stock:{name:'稳定枪托',cost:160,kinds:['sniper','assault','rifle']}};
function defaults(){return {credits:0,owned:{garand:true,thompson:true,m1911:true},loadouts:{}};}
function createStore(db){db.users||={};let seq=0;const sessions=new Map();const user=n=>{const u=db.users[n];if(!u)throw Error('账号不存在');u.owned||={};u.loadouts||={};u.credits=Number(u.credits)||0;return u;};
function view(n){const u=user(n);u.owned.garand??=true;u.owned.thompson??=true;u.owned.m1911??=true;return {username:n,credits:u.credits,owned:u.owned,loadouts:u.loadouts,isAdmin:!!u.isAdmin};}
function create(n,hash){if(db.users[n])throw Error('账号已存在');db.users[n]={hash,...defaults()};return view(n);}
function award(n,amount){const u=user(n);u.credits+=Math.max(0,Number(amount)||0);return view(n);}
function buyable(id){return WEAPONS[id]||ATTACH[id];}
function purchase(n,id){const u=user(n),x=buyable(id);if(!x)throw Error('未知商品');if(u.owned[id])throw Error('已拥有');if(!u.isAdmin&&u.credits<x.cost)throw Error('战功不足');if(!u.isAdmin)u.credits-=x.cost;u.owned[id]=true;return view(n);}
function equip(n,cls,weapon,attachments){const u=user(n),w=WEAPONS[weapon];if(!w||!u.owned[weapon]||!w.classes.includes(Number(cls)))throw Error('该兵种不能使用这把枪');attachments=[...new Set(attachments||[])].slice(0,4);for(const id of attachments){const a=ATTACH[id];if(!a||!u.owned[id]||!a.kinds.includes(w.kind))throw Error('改装不兼容或未拥有');}u.loadouts[String(cls)]={weapon,attachments};return view(n);}
function newSession(n){user(n);for(const [t,v] of sessions)if(v===n)sessions.delete(t);const t='s'+(++seq)+'_'+Math.random().toString(36).slice(2);sessions.set(t,n);return t;}
return {create,view,award,purchase,equip,newSession,sessionUser:t=>sessions.get(t)||null};}
module.exports={createStore,WEAPONS,ATTACH};
