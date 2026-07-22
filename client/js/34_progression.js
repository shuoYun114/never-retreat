'use strict';
// 所有战功、已购枪械、配装都来自账号服务端；浏览器不再保存资产。
const Progression=(()=>{
const CATALOG=[
 {id:'springfield',name:'春田 M1903A4',kind:'sniper',cost:650,desc:'狙击手专用 · 高伤害'},
 {id:'kar98zf',name:'Kar98k ZF41',kind:'sniper',cost:720,desc:'狙击手专用 · 4×瞄准'},
 {id:'stg44',name:'STG 44',kind:'assault',cost:700,desc:'冲锋枪手/突击兵 · 全自动'},
 {id:'bar',name:'BAR 自动步枪',kind:'rifle',cost:560,desc:'步枪兵/突击兵 · 高火力'},
 {id:'p38',name:'瓦尔特 P38',kind:'pistol',cost:260,desc:'全兵种副武器'},
 {id:'scope_4x',name:'4× 瞄准镜',kind:'attachment',cost:220,desc:'仅狙击枪可装'},
 {id:'silencer',name:'消音器',kind:'attachment',cost:180,desc:'狙击/突击/手枪可装'},
 {id:'extended_mag',name:'扩容弹匣',kind:'attachment',cost:200,desc:'步枪/突击/手枪可装'},
 {id:'stock',name:'稳定枪托',kind:'attachment',cost:160,desc:'步枪/突击/狙击枪可装'}
];
function data(){return Account.account()||{credits:0,owned:{},loadouts:{}}}
function credits(){return data().credits||0} function owned(id){return !!data().owned?.[id]}
async function buy(id){const r=await Account.purchase(id);return r.account}
function selected(cls,base){const l=data().loadouts?.[String(cls)];return l?.weapon||base}
function attachments(cls){return data().loadouts?.[String(cls)]?.attachments||[]}
function applyLoadout(p,keys){const o=[...keys];o[0]=selected(p.cls,o[0]);return o}
function modifyWeapon(slot,cls){const a=attachments(cls),d=slot.def;if(a.includes('extended_mag')){slot.mag=Math.round(slot.mag*1.35);slot.reserve=Math.round(slot.reserve*1.2)}if(a.includes('stock'))d.recoil*=.82;if(a.includes('silencer'))d.dmg*=.92;return slot}
return {CATALOG,credits,owned,buy,selected,attachments,applyLoadout,modifyWeapon,data};
})();
