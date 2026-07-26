'use strict';
// 集成测试用的最小工具：启动一个真实服务端进程 + 一个手写 WebSocket 客户端。
// 手写客户端是为了不引入任何依赖（服务端本身也没用 ws 库）。
const {spawn}=require('child_process');
const net=require('net'),crypto=require('crypto'),path=require('path'),fs=require('fs'),os=require('os');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function startServer(){
 const port=20000+Math.floor(Math.random()*20000);
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'nr-test-')),'accounts.json');
 const proc=spawn(process.execPath,[path.resolve(__dirname,'..','..','server.js')],
  {env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_FILE:file},stdio:['ignore','pipe','pipe']});
 const logs=[];
 proc.stdout.on('data',d=>logs.push(String(d)));
 proc.stderr.on('data',d=>logs.push(String(d)));
 const base='http://127.0.0.1:'+port;
 for(let i=0;i<100;i++){
  try{const r=await fetch(base+'/api/health');if(r.ok)break;}catch{}
  await sleep(100);
 }
 return {
  port,base,file,logs,
  post:(p,body,tok)=>fetch(base+p,{method:'POST',
   headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},
   body:JSON.stringify(body||{})}).then(async r=>({status:r.status,body:await r.json().catch(()=>null)})),
  async register(name){
   const u=name+Math.floor(Math.random()*1e6);
   const r=await this.post('/api/register',{username:u,password:'abc123'});
   if(r.status!==201)throw Error('注册失败 '+JSON.stringify(r.body));
   return {user:u,token:r.body.token};
  },
  stop(){return new Promise(ok=>{proc.once('exit',()=>ok());proc.kill();setTimeout(ok,1500);});}
 };
}

// 极简 WS 客户端：只做握手 + 收发文本帧，够测试用
function connect(port){
 return new Promise((ok,fail)=>{
  const s=net.connect(port,'127.0.0.1',()=>s.write(
   `GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n`+
   `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
  const inbox=[];
  let buf=Buffer.alloc(0),up=false;
  const api={
   inbox,
   send(o){
    const p=Buffer.from(JSON.stringify(o)),m=crypto.randomBytes(4),d=Buffer.from(p);
    for(let i=0;i<d.length;i++)d[i]^=m[i%4];
    let h;
    if(p.length<126)h=Buffer.from([129,0x80|p.length]);
    else{h=Buffer.alloc(4);h[0]=129;h[1]=254;h.writeUInt16BE(p.length,2);}
    s.write(Buffer.concat([h,m,d]));
   },
   take(type){return inbox.filter(x=>x.type===type)},
   last(type){const a=api.take(type);return a[a.length-1]},
   clear(){inbox.length=0},
   async wait(type,ms=1500){
    const t0=Date.now();
    while(Date.now()-t0<ms){const m=api.last(type);if(m)return m;await sleep(25);}
    return null;
   },
   close(){s.destroy()}
  };
  s.on('data',c=>{
   buf=Buffer.concat([buf,c]);
   if(!up){const i=buf.indexOf('\r\n\r\n');if(i<0)return;up=true;buf=buf.subarray(i+4);ok(api);}
   for(;;){
    if(buf.length<2)return;
    const opcode=buf[0]&15;
    let n=buf[1]&127,o=2;
    if(n===126){if(buf.length<4)return;n=buf.readUInt16BE(2);o=4;}
    if(buf.length<o+n)return;
    const p=buf.subarray(o,o+n);buf=buf.subarray(o+n);
    if(opcode===1){try{inbox.push(JSON.parse(p.toString()))}catch{}}
   }
  });
  s.on('error',fail);
 });
}
const ALIVE={x:0,y:0,z:0,yaw:0,pitch:0,alive:true,deployed:true,cls:0};
module.exports={startServer,connect,sleep,ALIVE};
