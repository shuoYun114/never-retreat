'use strict';
const crypto=require('crypto');
// 对局结算。奖励只认服务端时钟：浏览器上报的击杀/得分只用于展示，不参与发奖。
const MIN_PAID_SECONDS=120;   // 不足两分钟的对局不发奖，堵住 start/end 刷分
const COMPLETE_SECONDS=180;   // 打完整局的额外奖励门槛
const COMPLETE_BONUS=100;
const TIME_BONUS_CAP=120;
const DAILY_CAP=1500;         // 单账号每日结算奖励上限
const KEEP_ENDED_MS=10*60*1000;
const STALE_MS=6*3600*1000;
function createMatchStore(clock=()=>Date.now(),opts={}){
 const dailyCap=Number.isFinite(opts.dailyCap)?opts.dailyCap:DAILY_CAP;
 let seq=0;const matches=new Map(),ledger=new Map();
 function sweep(){
  const now=clock();
  for(const [id,x] of matches)
   if((x.ended&&now-x.endedAt>KEEP_ENDED_MS)||now-x.startedAt>STALE_MS)matches.delete(id);
 }
 function day(){return Math.floor(clock()/86400000);}
 function spent(user){const l=ledger.get(user);return l&&l.day===day()?l.earned:0;}
 function record(user,amount){const d=day(),l=ledger.get(user);if(!l||l.day!==d)ledger.set(user,{day:d,earned:amount});else l.earned+=amount;}
 function start(user,meta={}){
  sweep();
  // 同一账号只保留一个进行中的对局，防止无限 start 撑内存
  for(const [id,x] of matches)if(x.user===user&&!x.ended)matches.delete(id);
  const id='m_'+(++seq)+'_'+crypto.randomBytes(4).toString('hex');
  const x={id,user,startedAt:clock(),meta,ended:false,endedAt:0};
  matches.set(id,x);
  return x;
 }
 function end(user,id,stats={}){
  const x=matches.get(id);
  if(!x)throw Error('对局不存在');
  if(x.user!==user)throw Error('对局不属于当前账号');
  if(x.ended)throw Error('本局已结算');
  x.ended=true;x.endedAt=clock();
  const seconds=Math.max(0,Math.floor((x.endedAt-x.startedAt)/1000));
  const kills=Math.max(0,Math.min(30,Number(stats.kills)||0));
  const deaths=Math.max(0,Math.min(50,Number(stats.deaths)||0));
  const score=Math.max(0,Math.min(5000,Number(stats.score)||0));
  const completed=stats.reason==='complete';
  let reward=0,capped=false;
  if(seconds>=MIN_PAID_SECONDS){
   reward=Math.min(TIME_BONUS_CAP,Math.floor(seconds/60)*10);
   if(completed&&seconds>=COMPLETE_SECONDS)reward+=COMPLETE_BONUS;
  }
  const left=Math.max(0,dailyCap-spent(user));
  if(reward>left){reward=left;capped=true;}
  if(reward>0)record(user,reward);
  return {id,ended:true,seconds,kills,deaths,score,reward,capped,dailyLeft:Math.max(0,dailyCap-spent(user)),reason:completed?'complete':'early'};
 }
 return {start,end,sweep,dailyLeft:u=>Math.max(0,dailyCap-spent(u)),size:()=>matches.size};
}
module.exports={createMatchStore,MIN_PAID_SECONDS,COMPLETE_SECONDS,DAILY_CAP};
