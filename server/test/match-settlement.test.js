'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createMatchStore}=require('../lib/match_store');
test('match settlement pays once and early exit pays proportional reward',()=>{let now=1000;const s=createMatchStore(()=>now);const m=s.start('syhx',{mode:'bot',startedScore:0});now+=181000;const a=s.end('syhx',m.id,{kills:4,deaths:1,score:500,reason:'early'});assert.equal(a.reward,30);assert.equal(a.ended,true);assert.throws(()=>s.end('syhx',m.id,{kills:99,deaths:0,score:9999,reason:'early'}),/已结算/);});
test('another account cannot settle this match',()=>{const s=createMatchStore(()=>1);const m=s.start('syhx',{});assert.throws(()=>s.end('111',m.id,{kills:1,deaths:0,score:100}),/不属于/);});
