'use strict';
const Account=(()=>{
let token='',current=null;
const base=()=>String(window.STEEL_FRONT_SERVER||location.origin).replace(/\/$/,'');
function headers(){return {'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};}
async function request(path,data){const r=await fetch(base()+path,{method:'POST',headers:headers(),body:JSON.stringify(data||{})});const j=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401)clear();throw Error(j.error||'请求失败')}return j;}
function sync(a){current=a||current;syncUI();return current}
function syncUI(){const c=current?.isAdmin?'∞':(current?.credits||0);const e=document.getElementById('accountCredits');if(e)e.textContent=c;const s=document.getElementById('acctState');if(s&&current)s.textContent=`已登录：${current.username}${current.isAdmin?' · 管理员':''} · 战功 ${c}`;}
function set(j){token=j.token||token;return sync(j.account)}
function clear(){token='';current=null;syncUI()}
async function register(username,password){return set(await request('/api/register',{username,password}))}
async function login(username,password){return set(await request('/api/login',{username,password}))}
async function refresh(){return set(await request('/api/me',{}))}
async function purchase(id){return set(await request('/api/purchase',{id}))}
async function equip(classId,weapon,attachments){return set(await request('/api/equip',{classId,weapon,attachments}))}
async function matchStart(mode){return request('/api/match/start',{mode})}
async function matchEnd(matchId,stats){const j=await request('/api/match/end',{matchId,...stats});sync(j.account);return j}
return {register,login,refresh,purchase,equip,matchStart,matchEnd,ready:()=>!!token,token:()=>token,user:()=>current?.username||'',credits:()=>current?.credits||0,account:()=>current,base,clear,sync};
})();
const MatchSettlement=(()=>{let id='',ending=false;async function start(){id='';ending=false;if(!Account.ready())return null;try{id=(await Account.matchStart(NetPlay?.id?'pvp':'solo')).matchId;return id}catch(e){console.warn('对局创建失败',e);return null}}async function end(reason){if(!id||ending)return null;ending=true;try{return await Account.matchEnd(id,{kills:player.kills||0,deaths:player.deaths||0,score:player.score||0,reason})}finally{id=''}}return {start,end,active:()=>!!id};})();
