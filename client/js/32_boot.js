'use strict';

applyQuality();
initMenuUI();
const autoLoginBox=document.getElementById('acctAutoLogin');
if(autoLoginBox){autoLoginBox.checked=Account.autoEnabled();autoLoginBox.onchange=()=>Account.setAuto(autoLoginBox.checked);}
// 自动登录是异步的：菜单已经渲染过一遍，登录回来后要把商店/背包再刷一次，
// 否则明明已登录，商店和背包还停在"请先登录"。
Account.restore().then(()=>{
const a=Account.account();
if(!a)return;
const s=document.getElementById('acctState');
if(s)s.textContent=`已恢复登录：${a.username}${a.isAdmin?' · 管理员':''} · 战功 ${a.isAdmin?'∞':a.credits}`;
try{renderShop();renderBag();}catch(e){console.warn('刷新商店/背包失败',e);}
if(typeof updateNetUI==='function')updateNetUI();
}).catch(()=>{});
loop();
