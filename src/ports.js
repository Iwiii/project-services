const fs = require('node:fs');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
function listeners() {
  try {
    const output = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
    let pid, command; const found = [];
    for (const line of output.split('\n')) {
      if (line[0] === 'p') pid = Number(line.slice(1));
      if (line[0] === 'c') command = line.slice(1);
      if (line[0] === 'n') { const match = line.slice(1).match(/^(.*):(\d+)$/); if (match) found.push({ pid, command, host: match[1].replace(/^\[|\]$/g,''), port: Number(match[2]) }); }
    }
    return found;
  } catch (error) { if (process.platform !== 'linux') { if (error.status === 1) return []; throw new Error('Listener discovery requires lsof'); } }
  const sockets = new Map();
  for (const file of ['/proc/net/tcp','/proc/net/tcp6']) {
    for (const line of fs.readFileSync(file,'utf8').trim().split('\n').slice(1)) {
      const cols=line.trim().split(/\s+/); if(cols[3]!=='0A') continue;
      const [hex,port]=cols[1].split(':'); let host;
      if(hex.length===8) host=hex.match(/../g).reverse().map(x=>parseInt(x,16)).join('.');
      else host=hex.match(/.{8}/g).map(x=>x.match(/../g).reverse().join('')).join('').match(/.{4}/g).join(':');
      sockets.set(cols[9],{host,port:parseInt(port,16)});
    }
  }
  const found=[];
  for(const pid of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))) { try {
    const command=fs.readFileSync(`/proc/${pid}/comm`,'utf8').trim();
    for(const fd of fs.readdirSync(`/proc/${pid}/fd`)) { try { const inode=fs.readlinkSync(`/proc/${pid}/fd/${fd}`).match(/^socket:\[(\d+)\]$/)?.[1]; if(sockets.has(inode)) found.push({pid:Number(pid),command,...sockets.get(inode)}); } catch {} }
  } catch {} }
  return found;
}
function descendants(pid) {
  const set=new Set([Number(pid)]); if(!pid) return set;
  try { const rows=execFileSync('ps',['-eo','pid=,ppid='],{encoding:'utf8'}).trim().split('\n').map(x=>x.trim().split(/\s+/).map(Number)); let changed=true; while(changed) { changed=false; for(const [child,parent] of rows) if(set.has(parent)&&!set.has(child)){set.add(child);changed=true;} } } catch {}
  return set;
}
function probe(item) { return new Promise(resolve=> { const host=['*','0.0.0.0'].includes(item.host)?'127.0.0.1':['::','0000:0000:0000:0000:0000:0000:0000:0000'].includes(item.host)?'::1':item.host; const socket=net.connect({host,port:item.port}); let done=false; const finish=ok=>{if(done)return;done=true;socket.destroy();resolve({...item,verified:ok,address:`http://${host.includes(':')?'['+host+']':host}:${item.port}`});}; socket.setTimeout(400,()=>finish(false));socket.on('connect',()=>finish(true));socket.on('error',()=>finish(false)); }); }
function freePort(port=0) { return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',error=>reject(new Error(`Port ${port} is unavailable: ${error.message}`)));server.listen(port,'0.0.0.0',()=>{const selected=server.address().port;server.close(()=>resolve(selected));});}); }
module.exports={listeners,descendants,probe,freePort};
