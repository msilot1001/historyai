import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const events=[];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.pdf':'application/pdf','.ttf':'font/ttf','.json':'application/json'};

createServer(async(req,res)=>{
  if(req.url?.startsWith('/api/study')){
    if(req.headers['x-study-code']!=='browser-test'){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'접속 코드를 확인해 주세요.'}));return}
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){res.end(JSON.stringify({events}));return}
    let body='';for await(const chunk of req)body+=chunk;
    const input=JSON.parse(body);
    if(input.type==='attempt'){
      const event={type:'attempt',id:randomUUID(),at:new Date().toISOString(),question:input.question,answer:input.answer};events.push(event);
      const facts=input.question.a.split(' / ').slice(0,3);
      const good=input.answer.includes('정답');
      const points=facts.map((text,index)=>({index,text,status:good?'covered':'missing',feedback:good?'핵심을 정확히 설명했습니다.':'이 사실을 설명하지 않았습니다.'}));
      const grade={level:good?'strong':'weak',reason:good?'핵심 사실을 모두 설명했습니다.':'핵심 사실이 빠졌습니다.',missing:good?[]:facts,points};
      events.push({type:'grade',attemptId:event.id,grade,at:new Date().toISOString()});
      res.end(JSON.stringify({event,grade}));return;
    }
    const event={...input,at:new Date().toISOString()};events.push(event);res.end(JSON.stringify({event}));return;
  }
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path==='/'||path.startsWith('/coach')||path.startsWith('/review')||path.startsWith('/study/')?'index.html':path.replace(/^\//,'');
  try{const data=await readFile(join(import.meta.dirname,'dist',file));res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data)}
  catch{res.writeHead(404);res.end('not found')}
}).listen(8771,'0.0.0.0',()=>console.log('Browser test server on 8771'));
