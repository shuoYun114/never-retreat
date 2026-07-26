'use strict';
// 本文件由 server/tools/gen_weapon_meta.js 生成，请勿手改；数值改动后重新运行生成器。
// 客户端：背包界面用它决定哪些改装件可勾选，规则与服务端逐字一致。
function attachmentFitsOn(w,attachId){
 if(!w||w.vehicle)return false;
 const heavy=!!(w.rocket||w.mortar||w.atRifle);
 // 4×镜：装在没有自带瞄具的栓动步枪上（狙击兵的枪本来就自带镜，不重复加装）
 if(attachId==='scope_4x')return !heavy&&w.type==='bolt'&&!w.scoped;
 if(attachId==='silencer')return !heavy&&!!(w.type==='bolt'||w.type==='auto'||w.pistol);
 if(attachId==='extended_mag')return !heavy&&w.mag>1;
 if(attachId==='stock')return !heavy&&!w.pistol;
 return false;
}
function attachmentFits(weaponId,attachId,cls){return attachmentFitsOn(WPN_DEFS[weaponId],attachId);}
