import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const events=[];
let failFirstGrade=true;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.pdf':'application/pdf','.ttf':'font/ttf','.json':'application/json'};

createServer(async(req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return}
  if(req.url==='/__test-counts'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({attempts:events.filter(e=>e.type==='attempt').length}));return}
  if(req.url?.startsWith('/api/study')){
    if(req.method==='GET'&&req.url.includes('dataset=active')){res.setHeader('Content-Type','application/json');res.end(await readFile(join(import.meta.dirname,'public/data-sets/v6.json')));return}
    if(req.headers['x-study-code']!=='browser-test'){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'접속 코드를 확인해 주세요.'}));return}
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){res.end(JSON.stringify({events}));return}
    let body='';for await(const chunk of req)body+=chunk;
    const input=JSON.parse(body);
    if(input.type==='attempt'){
      const event={type:'attempt',id:input.id||randomUUID(),dataVersion:input.dataVersion,at:new Date().toISOString(),question:input.question,answer:input.answer};events.push(event);
      res.end(JSON.stringify({event}));return;
    }
    if(input.type==='grade'){
      await new Promise(resolve=>setTimeout(resolve,250));
      const event=events.find(e=>e.type==='attempt'&&e.id===input.attemptId);
      if(!event){res.writeHead(404);res.end(JSON.stringify({error:'not found'}));return}
      if(failFirstGrade){failFirstGrade=false;res.end(JSON.stringify({event,aiError:'테스트 채점 실패'}));return}
      const facts=event.question.a.split(' / ').slice(0,3);
      const good=event.answer.includes('정답');
      const points=facts.map((text,index)=>({index,text,status:good?'covered':'missing',feedback:good?'핵심을 정확히 설명했습니다.':'이 사실을 설명하지 않았습니다.'}));
      const grade={level:good?'strong':'weak',reason:good?'핵심 사실을 모두 설명했습니다.':'핵심 사실이 빠졌습니다.',writingNote:good?'':'핵심 사실의 주체를 밝혀 쓰면 뜻이 더 분명합니다.',missing:good?[]:facts,points};
      const gradeEvent={type:'grade',attemptId:event.id,dataVersion:event.dataVersion,grade,at:new Date().toISOString()};events.push(gradeEvent);
      res.end(JSON.stringify({event,gradeEvent,grade}));return;
    }
    const event={...input,at:new Date().toISOString()};events.push(event);res.end(JSON.stringify({event}));return;
  }
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path==='/'||path.startsWith('/coach')||path.startsWith('/review')||path.startsWith('/study/')?'index.html':path.replace(/^\//,'');
  try{const data=await readFile(join(import.meta.dirname,'dist',file));res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data)}
  catch{res.writeHead(404);res.end('not found')}
}).listen(8771,'0.0.0.0',()=>console.log('Browser test server on 8771'));
