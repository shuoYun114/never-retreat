'use strict';
// 本文件由 server/tools/gen_terrain.js 从 client/js/01_data.js 生成，请勿手改。
// 高度公式与客户端 05_terrain.js 的 rawHeight()/heightAt() 逐条对应，用于服务端遮挡判定。
const CAMPAIGNS=[
 {
  "id": "normandy",
  "terr": "rolling",
  "layout": "rural",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": -70,
    "z": 22,
    "r": 13
   },
   {
    "x": -26,
    "z": -66,
    "r": 13
   },
   {
    "x": 3,
    "z": 8,
    "r": 14
   },
   {
    "x": 30,
    "z": 68,
    "r": 13
   },
   {
    "x": 74,
    "z": -29,
    "r": 13
   }
  ],
  "trench": [
   [
    -52,
    4,
    -30,
    -8
   ],
   [
    36,
    2,
    58,
    14
   ]
  ],
  "river": null
 },
 {
  "id": "stalingrad",
  "terr": "urban",
  "layout": "city",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": -62,
    "z": 20,
    "r": 13
   },
   {
    "x": -20,
    "z": -26,
    "r": 13
   },
   {
    "x": 4,
    "z": 12,
    "r": 14
   },
   {
    "x": 42,
    "z": -18,
    "r": 13
   },
   {
    "x": 72,
    "z": 26,
    "r": 13
   }
  ],
  "trench": [
   [
    -42,
    -34,
    -20,
    -44
   ],
   [
    24,
    32,
    46,
    24
   ]
  ],
  "river": null
 },
 {
  "id": "berlin",
  "terr": "urban",
  "layout": "city",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": -74,
    "z": 10,
    "r": 13
   },
   {
    "x": -26,
    "z": -16,
    "r": 13
   },
   {
    "x": 22,
    "z": 18,
    "r": 14
   },
   {
    "x": 74,
    "z": -8,
    "r": 13
   }
  ],
  "trench": [
   [
    -48,
    26,
    -28,
    36
   ],
   [
    46,
    -26,
    66,
    -32
   ]
  ],
  "river": null
 },
 {
  "id": "songhu",
  "terr": "delta",
  "layout": "delta",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": 72,
    "z": -18,
    "r": 13
   },
   {
    "x": 30,
    "z": 24,
    "r": 13
   },
   {
    "x": -12,
    "z": -20,
    "r": 14
   },
   {
    "x": -60,
    "z": 12,
    "r": 13
   }
  ],
  "trench": [
   [
    52,
    -4,
    34,
    10
   ],
   [
    10,
    4,
    -6,
    -10
   ],
   [
    -34,
    2,
    -48,
    10
   ],
   [
    -24,
    -32,
    -4,
    -38
   ]
  ],
  "river": {
   "pts": [
    [
     -165,
     -52
    ],
    [
     -80,
     -42
    ],
    [
     0,
     -58
    ],
    [
     80,
     -32
    ],
    [
     165,
     -42
    ]
   ],
   "w": 7,
   "ice": false
  }
 },
 {
  "id": "baituan",
  "terr": "loess",
  "layout": "loess",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": -50,
    "z": -20,
    "r": 13
   },
   {
    "x": 10,
    "z": 30,
    "r": 13
   },
   {
    "x": 58,
    "z": -24,
    "r": 13
   }
  ],
  "trench": [
   [
    -64,
    -8,
    -44,
    -2
   ],
   [
    -6,
    18,
    14,
    12
   ],
   [
    40,
    -12,
    56,
    -4
   ],
   [
    24,
    -40,
    44,
    -46
   ]
  ],
  "river": null
 },
 {
  "id": "burma",
  "terr": "jungle",
  "layout": "jungle",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": -64,
    "z": -28,
    "r": 14
   },
   {
    "x": -10,
    "z": 38,
    "r": 14
   },
   {
    "x": 20,
    "z": -42,
    "r": 14
   },
   {
    "x": 66,
    "z": 24,
    "r": 14
   }
  ],
  "trench": [
   [
    -32,
    -36,
    -12,
    -44
   ]
  ],
  "river": {
   "pts": [
    [
     -165,
     62
    ],
    [
     -70,
     32
    ],
    [
     -8,
     62
    ],
    [
     60,
     12
    ],
    [
     120,
     42
    ],
    [
     165,
     22
    ]
   ],
   "w": 8,
   "ice": false
  }
 },
 {
  "id": "moscow",
  "terr": "alpine",
  "layout": "alpine",
  "mapSize": null,
  "bases": [
   {
    "x": -142,
    "z": 0
   },
   {
    "x": 142,
    "z": 0
   }
  ],
  "flags": [
   {
    "x": 66,
    "z": -18,
    "r": 13
   },
   {
    "x": 22,
    "z": 26,
    "r": 13
   },
   {
    "x": -24,
    "z": -26,
    "r": 14
   },
   {
    "x": -70,
    "z": 14,
    "r": 13
   }
  ],
  "trench": [
   [
    48,
    -8,
    32,
    6
   ],
   [
    6,
    14,
    -10,
    2
   ],
   [
    -42,
    -8,
    -56,
    4
   ]
  ],
  "river": {
   "pts": [
    [
     -165,
     -70
    ],
    [
     -60,
     -34
    ],
    [
     20,
     -48
    ],
    [
     90,
     -92
    ],
    [
     165,
     -120
    ]
   ],
   "w": 9,
   "ice": true
  }
 }
];

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
