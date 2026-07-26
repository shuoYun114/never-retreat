'use strict';
// 从客户端 13_weapons_data.js 抽取服务端裁定所需的武器数值，生成 lib/weapon_meta.js。
// 武器数值一旦改动，重新运行： node tools/gen_weapon_meta.js
const fs=require('fs'),path=require('path');
const CLIENT=path.resolve(__dirname,'..','..','client','js');
const SRC=path.join(CLIENT,'13_weapons_data.js');
const OUT=path.resolve(__dirname,'..','lib','weapon_meta.js');
const OUT_CLIENT=path.join(CLIENT,'13c_attach_rules.js');

function extractLiteral(text,name){
 const at=text.indexOf('const '+name);
 if(at<0)throw Error('找不到 '+name);
 const open=text.indexOf('{',at);
 let depth=0,i=open;
 for(;i<text.length;i++){
  if(text[i]==='{')depth++;
  else if(text[i]==='}'&&--depth===0){i++;break;}
 }
 if(depth!==0)throw Error(name+' 括号不匹配');
 return text.slice(open,i);
}

const read=f=>fs.readFileSync(f,'utf8');
const defs=new Function('return '+extractLiteral(read(SRC),'WPN_DEFS'))();
const meta={};
for(const [id,w] of Object.entries(defs)){
 meta[id]={
  name:w.name,
  dmg:+w.dmg||0,
  headMul:+w.headMul||1,
  rpm:+w.rpm||60,
  mag:+w.mag||1,
  type:String(w.type||''),
  pistol:!!w.pistol,
  rocket:!!w.rocket,
  mortar:!!w.mortar,
  atRifle:!!w.atRifle,
  scoped:!!w.scoped
 };
}
// 玩家还能用载具/工事火力打真人：这些 def 在玩法代码里是内联对象，按固定 id 一并登记，
// 否则服务端会把这类命中当成未知武器直接丢弃。
const carried=id=>({mag:99,type:'auto',pistol:false,rocket:false,mortar:false,atRifle:false,scoped:false,vehicle:true,id});
// 机枪堡：各阵营数值不同（client/js/08_world.js FACTION_MG）
const MG=new Function('return '+extractLiteral(read(path.join(CLIENT,'08_world.js')),'FACTION_MG'))();
for(const [f,d] of Object.entries(MG))
 meta['emp_mg_'+f]={...carried(),name:d.name,dmg:+d.dmg,headMul:1.9,rpm:+d.rpm};
// 飞机机枪：按 阵营+机型序号 登记（client/js/01_data.js FACTIONS[x].planes）
const FACTIONS=new Function('return '+extractLiteral(read(path.join(CLIENT,'01_data.js')),'FACTIONS'))();
for(const [f,d] of Object.entries(FACTIONS))
 (d.planes||[]).forEach((p,i)=>{
  meta[`plane_mg_${f}_${i}`]={...carried(),name:p.name+' 机枪',dmg:+p.mgDmg,headMul:1.5,rpm:Math.round(60/(+p.rof||0.08))};
 });
// 坦克并列机枪：client/js/20_tank.js firePlayerMG 的内联 def（mgT=0.105s → 约 571 rpm）
meta.veh_mg={...carried(),name:'并列机枪',dmg:18,headMul:1.7,rpm:571};
// 改装兼容规则只写这一份，同时发给服务端和客户端，两边永远不会各判一套
const RULE=`function attachmentFitsOn(w,attachId){
 if(!w||w.vehicle)return false;
 const heavy=!!(w.rocket||w.mortar||w.atRifle);
 // 4×镜：装在没有自带瞄具的栓动步枪上（狙击兵的枪本来就自带镜，不重复加装）
 if(attachId==='scope_4x')return !heavy&&w.type==='bolt'&&!w.scoped;
 if(attachId==='silencer')return !heavy&&!!(w.type==='bolt'||w.type==='auto'||w.pistol);
 if(attachId==='extended_mag')return !heavy&&w.mag>1;
 if(attachId==='stock')return !heavy&&!w.pistol;
 return false;
}`;
const HEAD=id=>`'use strict';\n// 本文件由 server/tools/gen_weapon_meta.js 生成，请勿手改；数值改动后重新运行生成器。\n// ${id}\n`;

fs.writeFileSync(OUT,HEAD('服务端：裁定伤害/爆头倍率/射速，并复用同一套改装兼容规则。')+
`const WEAPON_META=${JSON.stringify(meta,null,1)};

${RULE}
function attachmentFits(weaponId,attachId,cls){return attachmentFitsOn(WEAPON_META[weaponId],attachId);}
// 单发最小间隔(ms)：射速留 15% 余量吸收网络抖动。
function minShotInterval(weaponId){
 const w=WEAPON_META[weaponId];
 if(!w)return 1000;
 return Math.max(40,Math.floor(60000/Math.max(30,w.rpm)*0.85));
}
module.exports={WEAPON_META,attachmentFits,attachmentFitsOn,minShotInterval};
`);
// 客户端版本直接查 WPN_DEFS，规则文本与服务端逐字相同
fs.writeFileSync(OUT_CLIENT,HEAD('客户端：背包界面用它决定哪些改装件可勾选，规则与服务端逐字一致。')+
`${RULE}
function attachmentFits(weaponId,attachId,cls){return attachmentFitsOn(WPN_DEFS[weaponId],attachId);}
`);
console.log('已生成',path.relative(process.cwd(),OUT),'与',path.relative(process.cwd(),OUT_CLIENT),'共',Object.keys(meta).length,'把武器');
