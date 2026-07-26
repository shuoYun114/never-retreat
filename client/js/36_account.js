'use strict';
const Account=(()=>{
const STORE_TOKEN='never_retreat_token';
const STORE_AUTO='never_retreat_auto_login';
let token='',current=null,restored=null;
// 未配置服务器地址时：同域优先，端口不同则默认取同主机的 18080(部署时客户端 18081 / 服务端 18080)
const base=()=>{
 const cfg=String(window.STEEL_FRONT_SERVER||'').trim().replace(/\/$/,'');
 if(cfg)return cfg;
 if(location.protocol==='file:')return 'http://127.0.0.1:18080';
 return location.port&&location.port!=='18080'?`${location.protocol}//${location.hostname}:18080`:location.origin;
};
function headers(){return {'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};}
async function request(path,data){const r=await fetch(base()+path,{method:'POST',headers:headers(),body:JSON.stringify(data||{})});const j=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401)clear();throw Error(j.error||'请求失败')}return j;}
function sync(a){current=a||current;syncUI();return current}
function syncUI(){
 const c=current?.isAdmin?'∞':(current?.credits||0);
 const e=document.getElementById('accountCredits');if(e)e.textContent=c;
 const s=document.getElementById('acctState');
 if(s&&current)s.textContent=`已登录：${current.username}${current.isAdmin?' · 管理员':''} · 战功 ${c}`;
 // 真人对战累计战绩（服务端记账）
 const box=document.getElementById('acctStats');
 if(box){
  const t=current?.stats;
  if(!t)box.textContent='真人对战战绩：登录后显示';
  else{
   const kd=t.deaths?(t.kills/t.deaths).toFixed(2):(t.kills?'∞':'0.00');
   const wr=t.matches?Math.round(t.wins/t.matches*100):0;
   box.textContent=`真人对战：${t.matches} 场 · ${t.wins} 胜 ${t.losses} 负（胜率 ${wr}%） · ${t.kills} 击杀 / ${t.deaths} 阵亡 · K/D ${kd}`;
  }
 }
}
function autoEnabled(){try{return localStorage.getItem(STORE_AUTO)!=='0'}catch{return true}}
function setAuto(enabled){try{localStorage.setItem(STORE_AUTO,enabled?'1':'0');if(!enabled)localStorage.removeItem(STORE_TOKEN)}catch{}}
function set(j){token=j.token||token;try{if(token&&autoEnabled())localStorage.setItem(STORE_TOKEN,token)}catch{}return sync(j.account)}
function clear(){token='';current=null;try{localStorage.removeItem(STORE_TOKEN)}catch{}syncUI()}
async function logout(){try{if(token)await request('/api/logout',{})}catch(e){}clear()}
function restore(){
 if(restored)return restored;
 restored=(async()=>{
  try{
   if(!autoEnabled())return null;
   token=localStorage.getItem(STORE_TOKEN)||'';
   if(!token)return null;
   return await refresh();
  }catch(e){clear();return null}
 })();
 return restored;
}
// 自动登录是异步的，需要等它结束的地方(联机重连、商店/背包刷新)用这个
function whenRestored(){return restored||restore()}
async function register(username,password){return set(await request('/api/register',{username,password}))}
async function login(username,password){return set(await request('/api/login',{username,password}))}
async function refresh(){return set(await request('/api/me',{}))}
async function purchase(id){return set(await request('/api/purchase',{id}))}
async function equip(classId,weapon,attachments){return set(await request('/api/equip',{classId,weapon,attachments}))}
async function matchStart(mode){return request('/api/match/start',{mode})}
async function matchEnd(matchId,stats){const j=await request('/api/match/end',{matchId,...stats});sync(j.account);return j}
return {register,login,logout,refresh,restore,whenRestored,setAuto,autoEnabled,purchase,equip,matchStart,matchEnd,ready:()=>!!token,token:()=>token,user:()=>current?.username||'',credits:()=>current?.credits||0,account:()=>current,base,clear,sync};
})();
const MatchSettlement=(()=>{let id='',ending=false;async function start(){id='';ending=false;if(!Account.ready())return null;try{id=(await Account.matchStart(NetPlay?.started?'pvp':'solo')).matchId;return id}catch(e){console.warn('对局创建失败',e);return null}}async function end(reason){if(!id||ending)return null;ending=true;try{return await Account.matchEnd(id,{kills:player.kills||0,deaths:player.deaths||0,score:player.score||0,reason})}finally{id=''}}return {start,end,active:()=>!!id};})();
