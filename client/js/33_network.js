'use strict';
// 房主制联机：房主创建六码房间，成员按房间号加入，全部准备后由房主开始。
// 战役/规模由房主决定；成员本地战役不一致时会在开局前自动重载并自动回到房间。
const NetPlay={ws:null,id:null,room:'',peers:new Map(),lastSend:0,lastTicket:0,status:'未连接',host:false,ready:false,started:false,
config:{campaign:0,size:0,hostTeam:0,name:''},onLobbyUpdate:null,_resume:false,_retry:0,
init(){
 try{
  this.room=(localStorage.getItem('sf_room')||'').replace(/\D/g,'').slice(0,6);
  this._resume=localStorage.getItem('sf_pending_room')==='1';
 }catch(e){}
 // 自动登录是异步的，必须等 token 恢复完再连，否则重载回房间会直接卡在"请先登录"
 if(this._resume&&this.room)Account.whenRestored().then(()=>this.connect());
},
connect(){
 if(!Account.ready()){this.status='请先登录';updateNetUI();return;}
 if(this.ws&&this.ws.readyState<2)return;
 const url=Account.base().replace(/^http/,'ws')+'/';
 this.status='连接中…';updateNetUI();
 const ws=this.ws=new WebSocket(url);
 ws.onopen=()=>{
  this.status='已连接';this._retry=0;
  if(this._resume&&this.room){this._resume=false;this.send({type:'join_room',room:this.room,token:Account.token()});}
  updateNetUI();
 };
 ws.onmessage=e=>this.receive(e);
 ws.onclose=()=>{this.status=this.started?'连接断开':'离线';this.id=null;this.clear();updateNetUI();};
 ws.onerror=()=>{this.status='连接失败';updateNetUI();};
},
send(x){if(this.ws&&this.ws.readyState===1)this.ws.send(JSON.stringify(x));},
// 连上之后再发指令；最多等 4 秒，避免服务器没开时无限重试
whenOpen(fn){
 let n=0;
 const wait=()=>{
  if(this.ws?.readyState===1)return fn();
  if(++n>50){this.status='连接失败';updateNetUI();return;}
  setTimeout(wait,80);
 };
 this.connect();wait();
},
create(name){this.whenOpen(()=>this.send({type:'create_room',name:String(name||'').trim(),token:Account.token()}));},
join(room){
 this.room=String(room||'').replace(/\D/g,'').slice(0,6);
 if(!/^\d{6}$/.test(this.room)){alert('请输入 6 位加入代码');return;}
 this.whenOpen(()=>this.send({type:'join_room',room:this.room,token:Account.token()}));
},
setReady(){this.send({type:'ready',ready:!this.ready});},
setConfig(c){if(!this.host)return;this.send({type:'room_config',config:c});},
launch(){if(!this.host)return;this.send({type:'start_room'});},
leave(){this.send({type:'leave_room'});this.started=false;this.host=false;this.ready=false;this.clear();
 try{localStorage.removeItem('sf_room');localStorage.removeItem('sf_pending_room')}catch{}
 this.room='';updateNetUI();},
receive(e){
 let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.type==='room_state'||m.type==='welcome_room'){
  this.id=m.id||this.id;this.room=m.room||this.room;this.host=!!m.host;this.ready=!!m.ready;this.started=!!m.started;
  this.config={campaign:0,size:0,hostTeam:0,name:'',...(m.config||{})};
  if(Number.isInteger(m.team))player.team=m.team;
  this.peers.clear();(m.players||[]).forEach(p=>this.add(p));
  // 已经回到房间里了，重连标记用完就清，别让下次开页面又去自动加入
  try{localStorage.setItem('sf_room',this.room);localStorage.removeItem('sf_pending_room')}catch{}
  this.onLobbyUpdate?.();updateNetUI();
  // 还没开局就先把战役对齐，重载后再回房间；等到开局才重载会赶不上这一局
  if(!this.started)this.syncCampaign();
 }
 else if(m.type==='room_error'){
  // 房间已经没了就别再把旧房号挂在界面上
  if(/不存在|已关闭/.test(m.error||'')){this.room='';try{localStorage.removeItem('sf_room')}catch{}}
  try{localStorage.removeItem('sf_pending_room')}catch{}
  this.status='未在房间中';updateNetUI();alert(m.error||'房间操作失败');
 }
 else if(m.type==='match_start'){this.begin(m);}
 else if(m.type==='auth_error'||m.type==='session_replaced'){
  Account.clear();this.status='登录已失效';
  try{localStorage.removeItem('sf_pending_room')}catch{}
  this.ws?.close();alert(m.error||'账号已在另一台设备登录');
 }
 else if(m.type==='join')this.add(m.player);
 else if(m.type==='leave')this.remove(m.id);
 else if(m.type==='state'&&m.id!==this.id){const p=this.peers.get(m.id);if(p){p.target=m.state;p.hp=m.hp??p.hp;}}
 else if(m.type==='damage')this.damage(m);
 else if(m.type==='tickets'){
  // 守方无限票在 JSON 里是 null，收回来要还原成 Infinity，否则 HUD 会显示 0
  if(Array.isArray(m.t)){tickets[0]=m.t[0]===null?Infinity:m.t[0];tickets[1]=m.t[1]===null?Infinity:m.t[1];}
  if(Number.isFinite(m.time))matchTime=m.time;
 }
 else if(m.type==='match_over'){if(!matchOver)endMatch(m.winner>=0?m.winner:undefined);}
},
// 本地战役和房间不一致：记下房间号后重载，重载完 init() 会自动重新加入
syncCampaign(){
 const idx=Number(this.config?.campaign);
 if(!Number.isInteger(idx)||idx===CAMPAIGN_IDX)return false;
 try{
  localStorage.setItem('sf_campaign',String(idx));
  localStorage.setItem('sf_pending_room','1');
  localStorage.setItem('sf_room',this.room);
 }catch{}
 location.reload();return true;
},
begin(m){
 this.config=m.config||this.config;
 if(this.syncCampaign())return;
 try{localStorage.removeItem('sf_pending_room')}catch{}
 this.started=true;
 SETTINGS.team=m.team===1?1:0;player.team=SETTINGS.team;
 // 规模也由房主统一，否则各人 BOT 数量/票数不一样
 const size=Number(this.config?.size);
 if(Number.isInteger(size)&&size>=0&&size<SIZE_OPTS.length)SIZE_IDX=size;
 BOTS_PER_TEAM=SIZE_OPTS[SIZE_IDX].bots;tickets[0]=SIZE_OPTS[SIZE_IDX].tk;tickets[1]=SIZE_OPTS[SIZE_IDX].tk;
 (m.players||[]).forEach(p=>this.add(p));
 startMatch();MatchSettlement.start();
 el('menu').classList.add('hidden');showDeploy(true);
},
add(p){
 if(!p||p.id===this.id||this.peers.has(p.id))return;
 this.peers.set(p.id,{id:p.id,name:p.name||'士兵',team:p.team===1?1:0,target:p.state||null,hp:p.hp??100,mesh:null,ready:!!p.ready});
},
remove(id){const p=this.peers.get(id);if(p?.mesh)scene.remove(p.mesh.root);this.peers.delete(id);},
clear(){[...this.peers.keys()].forEach(id=>this.remove(id));},
damage(m){
 const target=this.peers.get(m.target);
 if(target){target.hp=m.hp;if(m.killed&&target.mesh)target.mesh.root.visible=false;}
 // 真人阵亡的兵力损失由房主统一扣，成员本地不扣(否则会和房主的权威票数对不上)
 if(this.host&&m.killed){
  const t=m.target===this.id?player.team:target?.team;
  if(t===0||t===1)tickets[t]=Math.max(0,tickets[t]-1);
 }
 if(m.target===this.id){
  player.hp=m.hp;
  if(m.killed){player.alive=false;player.deployed=false;showScorePop('你被敌军击杀');showDeploy(true);}
  else{dmgFlash=Math.min(1,dmgFlash+.55);AudioSys.hurt();}
 }
 if(m.attacker===this.id){
  player.score=m.score;player.kills=m.kills;
  if(m.killed){
   if(Number.isFinite(m.credits))Account.sync({...(Account.account()||{}),credits:m.credits});
   onPlayerKill({isPlayer:false},m.head,true);
  }else{onPlayerHit({isPlayer:false},m.head);AudioSys.hitImpact(m.head);}
 }
},
// 只上报"用哪把枪、从哪往哪打"，伤害与爆头由服务端武器表裁定
shoot(target,origin,dir,def,head){
 if(!def?.id)return;
 this.send({type:'shot',target:target.id,w:def.id,ox:origin.x,oy:origin.y,oz:origin.z,dx:dir.x,dy:dir.y,dz:dir.z});
},
tick(dt){
 if(!this.started)return;
 const now=performance.now();
 if(this.ws?.readyState===1&&now-this.lastSend>50){
  this.lastSend=now;
  this.send({type:'state',state:{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch,alive:player.alive,deployed:player.deployed,cls:player.cls}});
 }
 // 房主每秒同步一次票数，其他人以房主为准
 if(this.host&&this.ws?.readyState===1&&now-this.lastTicket>1000){
  this.lastTicket=now;
  this.send({type:'tickets',t:[tickets[0],tickets[1]],time:matchTime});
 }
 for(const p of this.peers.values()){
  const s=p.target;
  if(!s||!s.deployed)continue;
  if(!p.mesh)p.mesh=buildSoldierMesh(p.team,p.name);
  p.mesh.root.visible=!!s.alive;
  if(!s.alive)continue;
  p.mesh.root.position.lerp(V3(s.x,s.y,s.z),Math.min(1,dt*12));
  p.mesh.root.rotation.y=angleLerpTo(p.mesh.root.rotation.y,s.yaw+Math.PI,dt*10);
  p.mesh.tag.visible=true;p.mesh.gunG.visible=true;p.mesh.headG.visible=true;
 }
}
};
// 联机时票数由房主裁定，成员不再本地扣票，否则同一局各人票数越打越偏
function ticketsLocal(){return !(typeof NetPlay!=='undefined'&&NetPlay.started&&!NetPlay.host);}
function updateNetUI(){
 const e=document.getElementById('netState'),members=document.getElementById('netMembers'),code=document.getElementById('netRoom'),name=document.getElementById('netName');
 if(e)e.textContent='联机：'+NetPlay.status+(NetPlay.room?' · 加入代码 '+NetPlay.room:'');
 if(code&&NetPlay.room)code.value=NetPlay.room;
 if(name)name.textContent=NetPlay.config?.name?`房间：${NetPlay.config.name}`:'';
 if(members){
  const a=[...NetPlay.peers.values()].map(p=>`${p.name} ${p.ready?'✓':'未准备'}`);
  members.textContent='成员：'+(NetPlay.id?`${Account.user()} ${NetPlay.ready?'✓':'未准备'}`:'—')+(a.length?' · '+a.join(' · '):'');
 }
 const r=document.getElementById('netReadyBtn'),l=document.getElementById('netLaunchBtn');
 if(r)r.textContent=NetPlay.ready?'取 消 准 备':'准 备';
 if(l)l.style.display=NetPlay.host?'inline-block':'none';
}
