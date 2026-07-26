'use strict';
function initMenuUI(){
// 主菜单导航
const showPanel=(id)=>{
el('mHome').classList.toggle('hidden',id!=='mHome');
['mPlay','mAccount','mNet','mShop','mBag','mCamp','mSet'].forEach(pid=>el(pid).classList.toggle('hidden',pid!==id));
if(id==='mShop') renderShop();
if(id==='mBag') renderBag();
};
document.querySelectorAll('.navBtn').forEach(b=>{
b.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel(b.dataset.p); };
});
document.querySelectorAll('.backBtn').forEach(b=>{ b.onclick=()=>showPanel('mHome'); });
// 触控按键大小
{
const stored=parseInt(localStorage.getItem('sf_tsize')||'100');
el('tsizeRange').value=stored;
el('tsizeVal').textContent=stored+'%';
el('tsizeRange').oninput=e=>{
localStorage.setItem('sf_tsize',e.target.value);
el('tsizeVal').textContent=e.target.value+'%';
applyTouchScale();
};
}
// 战役选择: 切换后存档并重载页面重建世界
const campRow=el('campRow');
CAMPAIGNS.forEach((c,i)=>{
const b=document.createElement('button');
b.className='optBtn'+(i===CAMPAIGN_IDX?' sel':'');
b.innerHTML=`<b>${c.title}</b><br><span style="font-size:10px;opacity:.8;color:#c0d8e0">${c.modeName}</span><br><span style="font-size:11px;opacity:.7">${c.sub}</span>`;
b.style.minWidth='150px';
b.onclick=()=>{
if(i===CAMPAIGN_IDX) return;
localStorage.setItem('sf_campaign',String(i));
location.reload();
};
campRow.appendChild(b);
});
el('menuSub').textContent=`—— ${CAMPAIGN.title} · ${CAMPAIGN.sub} ——`;
el('teamUS').innerHTML=`${TEAM_FACTION[0].sym} ${TEAM_FACTION[0].short} · ${TEAM_FACTION[0].name}`;
el('teamGER').innerHTML=`${TEAM_FACTION[1].sym} ${TEAM_FACTION[1].short} · ${TEAM_FACTION[1].name}`;
document.querySelector('.t0h').textContent=TEAM_NAME[0];
document.querySelector('.t1h').textContent=TEAM_NAME[1];
// 模式归属战役, 此处仅兵力规模
document.querySelectorAll('.sizeBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.s===SIZE_IDX);
b.onclick=()=>{
SIZE_IDX=+b.dataset.s;
localStorage.setItem('sf_size',b.dataset.s);
document.querySelectorAll('.sizeBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
// 操控模式切换 (自动检测/强制触屏/强制键鼠)
{
const ov=localStorage.getItem('sf_mobile');
const lbl=ov==='1'?'操控: 触屏':(ov==='0'?'操控: 键鼠':'操控: 自动'+(MOBILE?'(触屏)':'(键鼠)'));
el('ctrlModeBtn').textContent=lbl;
el('ctrlModeBtn').onclick=()=>{
const cur=localStorage.getItem('sf_mobile');
const next=cur===null||cur===''?'1':(cur==='1'?'0':'');
if(next==='') localStorage.removeItem('sf_mobile'); else localStorage.setItem('sf_mobile',next);
location.reload();
};
}
el('teamUS').onclick=()=>{ SETTINGS.team=0; el('teamUS').classList.add('sel'); el('teamGER').classList.remove('sel'); };
el('teamGER').onclick=()=>{ SETTINGS.team=1; el('teamGER').classList.add('sel'); el('teamUS').classList.remove('sel'); };
document.querySelectorAll('.diffBtn').forEach(b=>b.onclick=()=>{
SETTINGS.diff=+b.dataset.d;
document.querySelectorAll('.diffBtn').forEach(x=>x.classList.toggle('sel',x===b));
});
document.querySelectorAll('.qualBtn').forEach(b=>b.onclick=()=>{
SETTINGS.quality=+b.dataset.q;
document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',x===b));
applyQuality();
});
el('sensRange').oninput=e=>{ SETTINGS.sens=e.target.value/100; el('sensVal').textContent=SETTINGS.sens.toFixed(1); };
// 右键瞄准方式: 按住 / 切换
{
const syncAdsBtn=()=>{ el('adsModeBtn').textContent=SETTINGS.adsToggle?'切换瞄准':'按住瞄准'; };
syncAdsBtn();
el('adsModeBtn').onclick=()=>{
SETTINGS.adsToggle=!SETTINGS.adsToggle;
try{ localStorage.setItem('sf_adsmode',SETTINGS.adsToggle?'toggle':'hold'); }catch(e){}
syncAdsBtn();
};
}
el('volRange').oninput=e=>{ SETTINGS.vol=e.target.value/100; el('volVal').textContent=e.target.value; AudioSys.setVol(SETTINGS.vol); };
el('startBtn').onclick=()=>{
AudioSys.init();
player.team=SETTINGS.team;
BOTS_PER_TEAM=SIZE_OPTS[SIZE_IDX].bots;
tickets[0]=SIZE_OPTS[SIZE_IDX].tk;
tickets[1]=SIZE_OPTS[SIZE_IDX].tk;
startMatch();
MatchSettlement.start();
el('menu').classList.add('hidden');
showDeploy(true);
};
// 账号登录与注册
const accountAction=async register=>{
const u=el('acctUser').value.trim(),p=el('acctPass').value;
el('acctState').textContent='正在连接服务端…';
try{ const r=register?await Account.register(u,p):await Account.login(u,p); const a=r.account||r; el('acctState').textContent='已登录：'+a.username+' · 战功 '+a.credits; }
catch(e){ el('acctState').textContent=e.message||'登录失败'; }
};
el('acctLogin').onclick=()=>accountAction(false);
el('acctRegister').onclick=()=>accountAction(true);
// 房主制联机大厅
if(typeof NetPlay!=='undefined'){
NetPlay.init();
const roomInput=el('netRoom'),roomName=el('netRoomName'),camp=el('netCampaign'),size=el('netSize'),hostTeam=el('netHostTeam'),hostHint=el('netHostTeamHint');
roomInput.value=NetPlay.room;
CAMPAIGNS.forEach((c,i)=>camp.add(new Option(c.title,i,i===CAMPAIGN_IDX,i===CAMPAIGN_IDX)));
SIZE_OPTS.forEach((s,i)=>size.add(new Option(`${s.n} · 每方${s.bots}BOT · ${s.tk}票`,i,i===SIZE_IDX,i===SIZE_IDX)));
const syncLobbyConfig=()=>{
 const idx=Math.max(0,Math.min(CAMPAIGNS.length-1,Number(NetPlay.config?.campaign??camp.value) || 0)),c=CAMPAIGNS[idx],team=NetPlay.config?.hostTeam===1?1:0;
 const sz=Math.max(0,Math.min(SIZE_OPTS.length-1,Number(NetPlay.config?.size??size.value) || 0));
 camp.value=String(idx);size.value=String(sz);
 hostTeam.textContent=`${FACTIONS[c.f[team]].sym} ${FACTIONS[c.f[team]].short}`;hostHint.textContent=`${FACTIONS[c.f[0]].short} vs ${FACTIONS[c.f[1]].short} · 房主可选攻/守方`;
 camp.disabled=!NetPlay.host;size.disabled=!NetPlay.host;hostTeam.disabled=!NetPlay.host;roomName.disabled=!NetPlay.host;
 if(NetPlay.host)roomName.value=NetPlay.config?.name||roomName.value;
};
NetPlay.onLobbyUpdate=syncLobbyConfig;
syncLobbyConfig();
hostTeam.onclick=()=>{const next=(NetPlay.config?.hostTeam===1?0:1);NetPlay.setConfig({hostTeam:next});};
el('netCreateBtn').onclick=()=>NetPlay.create(roomName.value);el('netJoinBtn').onclick=()=>NetPlay.join(roomInput.value);el('netReadyBtn').onclick=()=>NetPlay.setReady();el('netLaunchBtn').onclick=()=>NetPlay.launch();
el('netLeaveBtn').onclick=()=>NetPlay.leave();
camp.onchange=()=>NetPlay.setConfig({campaign:+camp.value});size.onchange=()=>NetPlay.setConfig({size:+size.value});roomName.onchange=()=>NetPlay.setConfig({name:roomName.value});updateNetUI();
}
el('againBtn').onclick=()=>location.reload();
const grid=el('classGrid');
CLASSES.forEach((c,i)=>{
const d=document.createElement('div');
d.className='classCard'+(i===0?' sel':'');
d.innerHTML=`<div class="cname">${c.name}</div><div class="cwpn" id="cw${i}"></div><div class="cwpn">手雷 ×${c.nades}</div>`;
d.onclick=()=>{
player.cls=i;
document.querySelectorAll('.classCard').forEach(x=>x.classList.toggle('sel',x===d));
};
grid.appendChild(d);
});
el('deployBtn').onclick=()=>{
if(respawnCd>0||matchOver) return;
deployPlayer();
};
el('resumeBtn').onclick=()=>{
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
lockPointer();
};
el('pauseResume').onclick=()=>{el('pause').classList.add('hidden');lockPointer();};
el('pauseEnd').onclick=async()=>{
if(!confirm('确定结束本局吗？'))return;
matchOver=true;document.exitPointerLock&&document.exitPointerLock();document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
const end=el('end');end.classList.remove('hidden');el('endTitle').textContent='正在结算';el('endTitle').className='win';el('endStats').textContent='正在把本局战功写入账号…';
try{const r=await MatchSettlement.end('early');const x=r?.settlement;el('endTitle').textContent='本 局 结 束';el('endStats').innerHTML=`你的战绩：<b>${player.kills||0}</b> 击杀 / <b>${player.deaths||0}</b> 阵亡 · 本局得分 <b>${player.score||0}</b><br>本局结算战功：<b>+${x?.reward||0}</b> · 账号总战功：<b>${Account.credits()||0}</b>`;}catch(e){el('endTitle').textContent='结算失败';el('endStats').textContent=e.message+'。请勿刷新页面，稍后重试。'}
};
renderer.domElement.addEventListener('click',()=>{
if(player.alive&&player.deployed&&!pointerLocked&&!matchOver) lockPointer();
});
}
function renderShop(){
const grid=el('shopGrid');
if(!Account.ready()){grid.innerHTML='<div class="secLabel">请先登录账号，商店资产会绑定到账号。</div>';return;}
el('shopCredits').textContent=Account.account()?.isAdmin?'∞':Account.credits();
grid.innerHTML='';
Progression.CATALOG.forEach(item=>{
const owned=Progression.owned(item.id), admin=Account.account()?.isAdmin, can=admin||Account.credits()>=item.cost;
const b=document.createElement('button');
b.className='optBtn'+(owned?' sel':'');b.style.width='220px';
b.innerHTML=`<b>${item.name}</b><br><span style="font-size:11px;opacity:.8">${item.desc}</span><br><span style="color:${owned?'#9fda9f':can?'#f2cf75':'#d68a7a'}">${owned?'已拥有':item.cost+' 战功'}</span>`;
if(!owned)b.onclick=async()=>{try{await Progression.buy(item.id);AudioSys.click(1100,.28,.06);renderShop();}catch(e){AudioSys.click(240,.22,.08);alert(e.message)}};grid.appendChild(b);
});
}
function renderBag(){
const grid=el('bagGrid');if(!Account.ready()){grid.innerHTML='<div class="secLabel">先登录账号，才能管理背包。</div>';return;}grid.innerHTML='';
const allowed=(id,cls,base)=>id===base||Progression.CATALOG.find(x=>x.id===id)?.classes?.includes(cls);
CLASSES.forEach((c,cls)=>{const base=TEAM_FACTION[SETTINGS.team].cls[cls][0];const candidates=Object.entries(WPN_DEFS).filter(([id])=>Progression.owned(id)&&allowed(id,cls,base));if(!candidates.some(([id])=>id===base))candidates.unshift([base,WPN_DEFS[base]]);const wanted=Progression.selected(cls,base),selected=candidates.some(([id])=>id===wanted)?wanted:base;const wrap=document.createElement('div');wrap.className='optBtn';wrap.style.width='260px';wrap.innerHTML=`<b>${c.name}</b><br><select id="bagW${cls}">${candidates.map(([id,w])=>`<option value="${id}" ${id===selected?'selected':''}>${w.name}</option>`).join('')}</select><br><span class="bagAttachments"></span><br><button class="bigBtn" style="margin-top:8px">保存配装</button>`;
const renderAttachments=()=>{const weapon=wrap.querySelector('select').value,old=Progression.attachments(cls),box=wrap.querySelector('.bagAttachments');box.innerHTML='';if(WPN_DEFS[weapon]?.scoped){const l=document.createElement('span');l.textContent='自带 4×镜';box.appendChild(l);box.append(' ');}[['scope_4x','4×镜'],['silencer','消音'],['extended_mag','扩容弹匣'],['stock','稳定枪托']].forEach(([id,label])=>{if(!attachmentFits(weapon,id,cls))return;const l=document.createElement('label');l.innerHTML=`<input type="checkbox" value="${id}">${label}`;const x=l.querySelector('input');x.checked=old.includes(id);x.disabled=!Progression.owned(id);box.appendChild(l);box.append(' ');});};
wrap.querySelector('select').onchange=renderAttachments;renderAttachments();wrap.querySelector('button').onclick=async()=>{const weapon=wrap.querySelector('select').value,ats=[...wrap.querySelectorAll('input:checked')].map(x=>x.value);try{await Account.equip(cls,weapon,ats);renderBag()}catch(e){alert(e.message)}};grid.appendChild(wrap);});
}
function showDeploy(isDead){
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('deploy').classList.remove('hidden');
el('blackOv').style.opacity=0;
CLASSES.forEach((c,i)=>{
const ws=TEAM_FACTION[player.team].cls[i];
let d2=ws.map(k=>WPN_DEFS[k].name).join(' · ');
if(i===2) d2+=' · AT雷×2';
if(i===4) d2+=' · 医疗箱[B] · 绷带×6';
if(i===5) d2+=' · AT雷×'+(TEAM_FACTION[player.team].atn5||3);
el('cw'+i).textContent=d2;
});
el('deathInfo').innerHTML=(()=>{ 
if(!isDead) return '';
const lifeT=Math.max(0,nowT-(player.lifeStartT||nowT));
const mm2=Math.floor(lifeT/60), ss3=Math.floor(lifeT%60);
const lk=player.lifeKills||0, ls=(player.score||0)-(player.lifeScoreStart||0);
return (player.killerName?`你被 <b>${player.killerName}</b> 击杀了<br>`:'')+
`<span style="font-size:13px;color:#cdd8c8">本次存活 ${mm2}:${ss3<10?'0':''}${ss3} · 击杀 <b>${lk}</b> · 获得 <b>+${ls}</b> 分 &nbsp;|&nbsp; 本局总计 ${player.kills} 杀 / ${player.deaths} 死 / ${player.score} 分</span>`;
})();
el('resumeBtn').style.display=(player.alive&&player.deployed)?'inline-block':'none';
el('deployBtn').style.display=player.alive&&player.deployed?'none':'inline-block';
buildSpawnList();
drawDeployMap();
}
// 战地式规则：队友身边有敌军时不能在他那里复活，避免直接空降到交火点
function spawnBlocked(x,z){
for(const c of combatants){
if(!c.alive||c.team===player.team||c.isPlayer) continue;
if(Math.hypot(c.pos.x-x,c.pos.z-z)<25) return true;
}
if(typeof NetPlay!=='undefined') for(const q of NetPlay.peers.values()){
const s=q.target;
if(!s||!s.alive||q.team===player.team) continue;
if(Math.hypot(s.x-x,s.z-z)<25) return true;
}
return false;
}
// 可作为出生点的队友：真人队友 + 本小队 BOT
function mateSpawns(){
const out=[];
if(typeof NetPlay!=='undefined'&&NetPlay.started) for(const q of NetPlay.peers.values()){
const s=q.target;
if(!s||q.team!==player.team) continue;
const live=!!s.alive&&!!s.deployed;
out.push({icon:'●',label:q.name,id:'P'+q.id,x:s.x,z:s.z,live});
}
if(typeof SQUAD!=='undefined'&&SQUAD.members) SQUAD.members.forEach((s,i)=>{
if(!s) return;
out.push({icon:'◆',label:s.name,id:'S'+i,x:s.pos.x,z:s.pos.z,live:!!s.alive&&!s.onVehicle});
});
return out;
}
function buildSpawnList(){
const list=el('spawnList');
list.innerHTML='';
const opts=[{name:'主基地',x:BASES[player.team].x,z:BASES[player.team].z,id:-1}];
FLAGS.forEach((f,i)=>{ if(f.owner===player.team) opts.push({name:f.id+' 点',x:f.x,z:f.z,id:i}); });
// 队友出生点
for(const m of mateSpawns()){
const blocked=m.live&&spawnBlocked(m.x,m.z);
opts.push({icon:m.icon,name:m.label+(m.live?(blocked?' (附近有敌军)':' (可复活)'):' (阵亡)'),
id:m.id,x:m.x,z:m.z,disabled:!m.live||blocked});
}
// 载具出生选项
const vehs=[...tanks,...planes].filter(v=>v.team===player.team);
vehs.forEach((v,i)=>{
const id='V'+i;
const busy=v.playerDriven;
const ready=v.alive&&!busy;
opts.push({name:(v.kind==='plane'?'✈ ':'▣ ')+v.name+(ready?'':(busy?' (占用)':' (重生 '+Math.ceil(v.respawnT)+'s)')),id,veh:v,disabled:!ready});
});
if(!opts.some(o=>!o.disabled&&(o.id===selectedSpawn))) selectedSpawn=-1;
opts.forEach(o=>{
const b=document.createElement('button');
b.className='spawnBtn'+(o.id===selectedSpawn?' sel':'');
b.textContent=(o.icon||'◈')+' '+o.name;
if(o.disabled){ b.disabled=true; b.style.opacity=0.45; }
else b.onclick=()=>{ selectedSpawn=o.id; document.querySelectorAll('.spawnBtn').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); };
list.appendChild(b);
});
}
function drawDeployMap(){
const c=el('deployMap').getContext('2d');
const S=300;
c.fillStyle='#141a10'; c.fillRect(0,0,S,S);
const toM=(x,z)=>[S/2+x/(MAP_SIZE/2+10)*S/2, S/2+z/(MAP_SIZE/2+10)*S/2];
c.strokeStyle='rgba(150,130,90,.5)'; c.lineWidth=4;
if(CAMPAIGN.sineRoad){
c.beginPath();
for(let x=-155;x<=155;x+=10){ const [px,py]=toM(x,3*Math.sin(x*0.02)); x===-155?c.moveTo(px,py):c.lineTo(px,py); }
c.stroke();
}
for(const r of CAMPAIGN.roads){
c.beginPath();
const [ax,ay]=toM(r[0],r[1]), [bx2,by2]=toM(r[2],r[3]);
c.moveTo(ax,ay); c.lineTo(bx2,by2);
c.stroke();
}
[0,1].forEach(t=>{
const [px,py]=toM(BASES[t].x,BASES[t].z);
c.fillStyle=t===0?'#4a70b0':'#b05a4a';
c.fillRect(px-8,py-8,16,16);
c.fillStyle='#fff'; c.font='10px sans-serif'; c.textAlign='center';
c.fillText(TEAM_NAME[t][0],px,py+3);
});
for(const f of FLAGS){
const [px,py]=toM(f.x,f.z);
c.beginPath(); c.arc(px,py,13,0,TAU);
c.fillStyle=f.owner===0?'rgba(90,140,220,.85)':f.owner===1?'rgba(220,110,90,.85)':'rgba(150,150,140,.7)';
c.fill();
c.fillStyle='#fff'; c.font='bold 13px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+4);
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toM(s.pos.x,s.pos.z);
c.fillStyle=s.team===0?'#7da8e8':'#e8907d';
c.beginPath(); c.arc(px,py,2,0,TAU); c.fill();
}
}
function deployPlayer(){
const p=player;
// 载具出生
let vehSpawn=null;
if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='V'){
const vehs=[...tanks,...planes].filter(v=>v.team===p.team);
const v=vehs[+selectedSpawn.slice(1)];
if(v&&v.alive&&!v.playerDriven) vehSpawn=v;
}
// 队友出生：点击到实际部署之间队友可能已经阵亡或被敌军贴住，这里重新确认一次
let mateSpawn=null;
if(typeof selectedSpawn==='string'&&(selectedSpawn[0]==='P'||selectedSpawn[0]==='S')){
const m=mateSpawns().find(x=>x.id===selectedSpawn);
if(m&&m.live&&!spawnBlocked(m.x,m.z)) mateSpawn=m;
else showScorePop('队友出生点已失效，改为主基地');
}
let sx,sz;
if(vehSpawn){ sx=vehSpawn.pos.x; sz=vehSpawn.pos.z; }
else if(mateSpawn){ sx=mateSpawn.x; sz=mateSpawn.z; }
else if(selectedSpawn===-1||typeof selectedSpawn==='string'){ sx=BASES[p.team].x; sz=BASES[p.team].z; }
else {
const f=FLAGS[selectedSpawn];
if(f.owner!==p.team){ sx=BASES[p.team].x; sz=BASES[p.team].z; }
else { sx=f.x; sz=f.z; }
}
const fp2=findFreeSpawn(sx,sz);
p.pos.set(fp2[0],0,fp2[1]);
p.pos.y=standHeight(p.pos.x,p.pos.z,10);
p.vel.set(0,0,0);
p.hp=100; p.alive=true; p.deployed=true; p.crouch=false; p.prone=false; p.chute=false;
p.stamina=1; p.suppressV=0; p.bloom=0;
p.ads=false; p.holdBreath=false; VM.adsBlend=0;
document.getElementById('scopeOv').style.display='none';
p.yaw=Math.atan2(-sx,-sz); p.pitch=0;
const base=TEAM_FACTION[p.team].cls[p.cls];
const wkeys=Progression.applyLoadout(p,base);
p.slots=wkeys.map(k=>{const def={...WPN_DEFS[k]};const slot={key:k,def,mag:def.mag,reserve:def.reserve};return Progression.modifyWeapon(slot,p.cls);});
p.curSlot=0; p.curW=p.slots[0];
p.nadeCount=CLASSES[p.cls].nades;
p.atNades=p.cls===5?(TEAM_FACTION[p.team].atn5||3):(p.cls===2?2:0);
p.maxBandages=p.cls===4?6:2;
p.bandages=p.maxBandages;
p.smokeCount=CLASSES[p.cls].smoke||0;
p.bandaging=0;
p.medkitUsed=false; p.grabAction=null;
p.deathRag=null; p.deathCamT=0;
p.lifeStartT=nowT; p.lifeKills=0; p.lifeScoreStart=p.score||0;
p.onMortar=null; p.mortarPlaced=false; p.buildCount=6; p.buildSel=0; p.pendingBuild=null;
p.nadeIsAT=false; p.nadeHeld=false; p.nadeIsSmoke=false;
p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.tankView=false; p.braced=false;
ensurePlayerBody();
document.getElementById('deathQuote').style.opacity='0';
document.getElementById('heatWrap').style.display='none';
vmEquip(p.curW.key,p.team);
VM.root.visible=true;
if(p.cls===4) showScorePop(MOBILE?'医护兵 · 左侧「医疗箱」放置 · 「绷带」自疗':'医护兵 · 按 B 放置医疗箱 / H 包扎');
else if(p.cls===6) showScorePop(MOBILE?'迫击炮兵 · 左侧「架炮」架设 · 靠近后点「上迫击炮」':'迫击炮兵 · 按 B 架设迫击炮, F 上炮开火');
else if(p.cls===7) showScorePop(MOBILE?'工程兵 · 「工事」选类型 · 「建造」锤击建造':'工程兵 · 按 5 选择工事, 按 B 锤击建造');
if(vehSpawn){
if(vehSpawn.crewBot){
const cb=vehSpawn.crewBot;
if(vehSpawn.kind==='plane'){
vehSpawn.crewBot=null;
cb.onVehicle=null;
cb.chuting=true;
cb.pos.set(vehSpawn.pos.x,Math.max(vehSpawn.pos.y-2,heightAt(vehSpawn.pos.x,vehSpawn.pos.z)+3),vehSpawn.pos.z);
if(cb.mesh) cb.mesh.root.visible=true;
cb.path=null; cb.state='idle'; cb.target=null;
} else cb.dismountVehicle(false);
}
vehSpawn.playerDriven=true;
if(vehSpawn.kind==='tank'){ vehSpawn.isAI=false; vehSpawn.vel=0; p.yaw=vehSpawn.yaw+vehSpawn.turretYaw+Math.PI; }
else { p.yaw=vehSpawn.yaw+Math.PI; p.pitch=vehSpawn.pitch; }
p.onVehicle=vehSpawn;
p.pos.copy(vehSpawn.pos);
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('blackOv').style.opacity=0;
lockPointer();
}
function startMatch(){
const names0=[...TEAM_FACTION[0].names].sort(()=>Math.random()-0.5);
const names1=[...TEAM_FACTION[1].names].sort(()=>Math.random()-0.5);
const nameIdx=[0,0];
const nextName=t=>(t===0?names0:names1)[nameIdx[t]++%(t===0?names0:names1).length];
for(let t=0;t<2;t++){
const n=t===player.team?BOTS_PER_TEAM-1:BOTS_PER_TEAM;
for(let i=0;i<n;i++){
const cls=CLS_POOL[randi(0,CLS_POOL.length-1)];
const bot=new Bot(t,cls,nextName(t));
bot.spawn();
}
}
// 旗帜初始归属 (征服: 靠近各自基地的旗点归属该方; 攻防/破袭: 防守方全部据守)
el('flagIcons').innerHTML=FLAGS.map(f=>`<span id="fi${f.id}">${f.id}</span>`).join('');
if(GAMEMODE==='conquest'){
const sorted=[...FLAGS].sort((a,b)=>Math.hypot(a.x-BASES[0].x,a.z-BASES[0].z)-Math.hypot(b.x-BASES[0].x,b.z-BASES[0].z));
sorted[0].owner=0;
sorted[sorted.length-1].owner=1;
if(sorted.length>=5){ sorted[1].owner=0; sorted[sorted.length-2].owner=1; }
FLAGS.forEach(f=>drawFlagTex(f));
} else {
// 攻防/破袭: 防守方(DEF)据守全部旗点
assaultIdx=0;
FLAGS.forEach(f=>{ f.owner=DEF; f.cap=0; f.capTeam=-1; drawFlagTex(f); });
tickets[DEF]=Infinity;
matchTime=GAMEMODE==='assault'?18*60:16*60;
}
// 组建玩家小队: 挑3名本方步兵
for(const s of soldiers){
if(SQUAD.members.length>=3) break;
if(s.team===player.team&&!s.onVehicle&&!s.pilotOf){
s.inSquad=true;
SQUAD.members.push(s);
s.mesh.tag.material.color.set(0x86ffa6);
}
}
new Tank(0,0); new Tank(0,1); new Tank(1,0); new Tank(1,1);
if(TEAM_FACTION[0].tanks[2]) new Tank(0,2);
if(TEAM_FACTION[1].tanks[2]) new Tank(1,2);
new APC(0); new APC(1);
new Plane(0,0); new Plane(0,1); new Plane(1,0); new Plane(1,1);
// 每辆载具塞入一名真正的AI乘员(算一个人, 可下车/跳伞)
for(const t of tanks){
const b=new Bot(t.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(t.team));
b.spawnInVehicle(t);
}
for(const a of apcs){
const b=new Bot(a.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(a.team));
b.spawnInVehicle(a);
}
for(const pl of planes){
const b=new Bot(pl.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(pl.team));
b.pilotOf=pl;
pl.pilotBot=b;
b.spawnInVehicle(pl);
}
}
let lastT=performance.now(), fpsAcc=0, fpsN=0, fpsShow=0;
