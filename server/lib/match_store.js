'use strict';
function createMatchStore(clock=()=>Date.now()){let seq=0;const matches=new Map();
function start(user,meta={}){const id='m_'+(++seq)+'_'+Math.random().toString(36).slice(2,8);const x={id,user,startedAt:clock(),meta,ended:false};matches.set(id,x);return x}
function end(user,id,stats={}){const x=matches.get(id);if(!x)throw Error('对局不存在');if(x.user!==user)throw Error('对局不属于当前账号');if(x.ended)throw Error('本局已结算');x.ended=true;const seconds=Math.max(0,Math.floor((clock()-x.startedAt)/1000));const kills=Math.max(0,Math.min(30,Number(stats.kills)||0));const deaths=Math.max(0,Math.min(50,Number(stats.deaths)||0));const score=Math.max(0,Math.min(5000,Number(stats.score)||0));const completed=stats.reason==='complete';// 本地 BOT 战绩只能展示，不能作为发奖依据；浏览器上报的击杀数可伪造。
const timeBonus=Math.min(120,Math.floor(seconds/60)*10);const reward=Math.max(0,timeBonus+(completed?100:0));return {id,ended:true,seconds,kills,deaths,score,reward,reason:completed?'complete':'early'} }
return {start,end};}
module.exports={createMatchStore};
