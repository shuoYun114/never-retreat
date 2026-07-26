'use strict';
// 从客户端 01_data.js 抽取战役地形参数，生成 lib/terrain.js。
// 服务端用它复现地形高度，从而判断射线是否被山体/地形挡住（零信任，不依赖客户端上报）。
// 客户端地形数据改动后重新运行： node tools/gen_terrain.js
const fs=require('fs'),path=require('path');
const CLIENT=path.resolve(__dirname,'..','..','client','js');
const OUT=path.resolve(__dirname,'..','lib','terrain.js');

function extractLiteral(text,name){
 const at=text.indexOf('const '+name);
 if(at<0)throw Error('找不到 '+name);
 // 从 = 之后第一个非空白字符开始，可能是数组也可能是对象
 let open=text.indexOf('=',at)+1;
 while(open<text.length&&/\s/.test(text[open]))open++;
 const openCh=text[open],closeCh=openCh==='['?']':'}';
 if(openCh!=='['&&openCh!=='{')throw Error(name+' 不是数组/对象字面量');
 let depth=0,i=open;
 for(;i<text.length;i++){
  if(text[i]===openCh)depth++;
  else if(text[i]===closeCh&&--depth===0){i++;break;}
 }
 if(depth!==0)throw Error(name+' 括号不匹配');
 return text.slice(open,i);
}

const src=fs.readFileSync(path.join(CLIENT,'01_data.js'),'utf8');
const CAMPAIGNS=new Function('return '+extractLiteral(src,'CAMPAIGNS'))();
// RIVER 在客户端是「按当前战役取一条」，这里要整张表
const riverLiteral=extractLiteral(src,'RIVER');
const RIVERS=new Function('return '+riverLiteral)();

// 只保留地形计算需要的字段
const campaigns=CAMPAIGNS.map(c=>({
 id:c.id,
 terr:c.terr,
 layout:c.layout,
 mapSize:c.mapSize||null,
 bases:c.bases.map(b=>({x:b.x,z:b.z})),
 flags:c.flags.map(f=>({x:f.x,z:f.z,r:f.r})),
 trench:(c.trench||[]).map(t=>[...t]),
 river:RIVERS[c.id]||null
}));

const body=`'use strict';
// 本文件由 server/tools/gen_terrain.js 从 client/js/01_data.js 生成，请勿手改。
// 高度公式与客户端 05_terrain.js 的 rawHeight()/heightAt() 逐条对应，用于服务端遮挡判定。
const CAMPAIGNS=${JSON.stringify(campaigns,null,1)};

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
function segDist(px,pz,ax,az,bx,bz){
 const abx=bx-ax,abz=bz-az;
 const dd=abx*abx+abz*abz;
 const t=dd?clamp(((px-ax)*abx+(pz-az)*abz)/dd,0,1):0;
 return Math.hypot(px-(ax+abx*t),pz-(az+abz*t));
}
// 与客户端 05_terrain.js rawHeight() 完全一致
function rawHeight(terr,x,z){
 switch(terr){
  case 'urban':
   return 0.45*Math.sin(x*0.03)*Math.cos(z*0.028)
    +0.25*Math.sin(x*0.09+1)*Math.sin(z*0.07+0.5);
  case 'delta':
   return 0.55*Math.sin(x*0.018)*Math.cos(z*0.02)
    +0.35*Math.sin(x*0.06+2)*Math.sin(z*0.05+1)-0.15;
  case 'loess':
   return 3.8*Math.sin(x*0.018+0.5)*Math.cos(z*0.021)
    +2.0*(1-Math.abs(Math.sin(x*0.03+z*0.012+1)))
    +0.8*Math.sin(x*0.1+3)*Math.cos(z*0.09+1.2)-0.6;
  case 'jungle':
   return 2.3*Math.sin(x*0.014)*Math.cos(z*0.017+1)
    +1.25*Math.sin(x*0.05+1.2)*Math.sin(z*0.043+2)
    +0.5*Math.sin(x*0.12+3)*Math.cos(z*0.1);
  case 'alpine':{
   const r1=1-Math.abs(Math.sin(x*0.021+z*0.009));
   const r2=1-Math.abs(Math.sin(z*0.026-x*0.007+1.3));
   const r3=1-Math.abs(Math.sin((x+z)*0.014+2.6));
   return r1*r1*6.5+r2*r2*4.2+r3*r3*2.5
    +1.3*Math.sin(x*0.05)*Math.cos(z*0.045)-2.6;
  }
  default:
   return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)
    +0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)
    +0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
 }
}
// 按战役构造地形；FLATS/TRENCHES 的算法与客户端一致
function createTerrain(idx){
 const c=CAMPAIGNS[Math.max(0,Math.min(CAMPAIGNS.length-1,Number(idx)||0))];
 const terr=c.terr;
 const flats=[];
 const addFlat=(x,z,r)=>flats.push({x,z,r,h:rawHeight(terr,x,z)*0.55});
 for(const b of c.bases)addFlat(b.x,b.z,20);
 for(const f of c.flags)addFlat(f.x,f.z,f.r+12);
 if(terr==='rolling')addFlat(0,0,34);
 const trenches=c.trench.map(t=>({x1:t[0],z1:t[1],x2:t[2],z2:t[3]}));
 const river=c.river;
 function heightAt(x,z){
  let h=rawHeight(terr,x,z);
  for(const f of flats){
   const d=Math.hypot(x-f.x,z-f.z);
   if(d<f.r){
    const t=1-d/f.r;
    h=lerp(h,f.h,t*t*(3-2*t));
   }
  }
  for(const t of trenches){
   const d=segDist(x,z,t.x1,t.z1,t.x2,t.z2);
   if(d<2.4){
    const k=1-d/2.4;
    h-=1.3*k*k*(3-2*k);
   }
  }
  if(river){
   let rd=1e9;
   const P=river.pts;
   for(let i=0;i<P.length-1;i++){
    const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
    if(d<rd)rd=d;
   }
   if(rd<river.w){
    const k=1-rd/river.w;
    h-=(river.ice?1.2:1.9)*k*k*(3-2*k);
   }
  }
  return h;
 }
 return {id:c.id,terr,heightAt};
}
module.exports={createTerrain,CAMPAIGNS};
`;
fs.writeFileSync(OUT,body);
console.log('已生成',path.relative(process.cwd(),OUT),'共',campaigns.length,'个战役地形');
