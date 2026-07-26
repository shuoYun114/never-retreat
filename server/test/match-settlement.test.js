'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createMatchStore,MIN_PAID_SECONDS,DAILY_CAP}=require('../lib/match_store');

test('match settlement pays once and early exit pays proportional reward',()=>{
 let now=1000;const s=createMatchStore(()=>now);
 const m=s.start('syhx',{mode:'bot',startedScore:0});
 now+=181000;
 const a=s.end('syhx',m.id,{kills:4,deaths:1,score:500,reason:'early'});
 assert.equal(a.reward,30);assert.equal(a.ended,true);
 assert.throws(()=>s.end('syhx',m.id,{kills:99,deaths:0,score:9999,reason:'early'}),/已结算/);
});
test('another account cannot settle this match',()=>{
 const s=createMatchStore(()=>1);const m=s.start('syhx',{});
 assert.throws(()=>s.end('111',m.id,{kills:1,deaths:0,score:100}),/不属于/);
});
// 曾经可以 start→end 循环刷分：每次 reason:'complete' 都白拿 100 战功
test('instant start/end loops earn nothing',()=>{
 let now=1000;const s=createMatchStore(()=>now);
 for(let i=0;i<20;i++){
  const m=s.start('cheat',{});
  now+=200;   // 秒开秒结
  assert.equal(s.end('cheat',m.id,{kills:30,deaths:0,score:5000,reason:'complete'}).reward,0);
 }
 assert.equal(s.dailyLeft('cheat'),DAILY_CAP);
});
test('completion bonus needs a real match length',()=>{
 let now=1000;const s=createMatchStore(()=>now);
 const short=s.start('syhx',{});
 now+=(MIN_PAID_SECONDS+5)*1000;   // 够拿时长奖，但不够拿打完奖
 assert.equal(s.end('syhx',short.id,{reason:'complete'}).reward,20);
 const ten=s.start('syhx',{});
 now+=600*1000;                    // 10 分钟：时长奖 100
 assert.equal(s.end('syhx',ten.id,{reason:'complete'}).reward,100+100);
 const long=s.start('syhx',{});
 now+=1200*1000;                   // 20 分钟：时长奖到 120 上限
 assert.equal(s.end('syhx',long.id,{reason:'complete'}).reward,120+100);
});
test('daily settlement rewards are capped',()=>{
 let now=1000;const s=createMatchStore(()=>now,{dailyCap:250});
 const take=()=>{const m=s.start('syhx',{});now+=600*1000;return s.end('syhx',m.id,{reason:'complete'})};
 assert.equal(take().reward,200);
 const second=take();
 assert.equal(second.reward,50);   // 只补到上限
 assert.equal(second.capped,true);
 assert.equal(take().reward,0);
 assert.equal(s.dailyLeft('syhx'),0);
});
test('finished and stale matches do not pile up in memory',()=>{
 let now=1000;const s=createMatchStore(()=>now);
 for(let i=0;i<50;i++){const m=s.start('syhx',{});now+=300000;s.end('syhx',m.id,{reason:'complete'});}
 now+=7*3600*1000;s.sweep();
 assert.equal(s.size(),0);
});
test('a second start replaces the previous unfinished match',()=>{
 let now=1000;const s=createMatchStore(()=>now);
 const a=s.start('syhx',{});
 const b=s.start('syhx',{});
 now+=600*1000;
 assert.throws(()=>s.end('syhx',a.id,{reason:'complete'}),/不存在/);
 assert.ok(s.end('syhx',b.id,{reason:'complete'}).reward>0);
 assert.equal(s.size(),1);
});
