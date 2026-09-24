import fs from 'node:fs';
import { createRequire } from 'node:module';
// The cloze and quiz engines now live in typed modules; Node strips the types natively.
import { clozeCandidates as candidates, splitTarget, randomKeyTarget } from './src/lib/cloze.ts';
import { questionPool, unitQuestions } from './src/lib/questions.ts';
import { gradingText } from './src/lib/text.ts';
const data=JSON.parse(fs.readFileSync(new URL('./public/data.json',import.meta.url),'utf8'));
const v2=JSON.parse(fs.readFileSync(new URL('./public/data-sets/v2.json',import.meta.url),'utf8'));
const v3=JSON.parse(fs.readFileSync(new URL('./public/data-sets/v3.json',import.meta.url),'utf8'));
if(v2.version!==2||v3.version!==3||v2.data.units.length!==217||v3.data.units.length!==217||v2.questions.length!==88) throw new Error('버전 데이터 묶음 수 오류');
const ids=new Set(data.units.map(u=>u.id));
if(data.units.length!==217) throw new Error(`학습 단위 수 오류: ${data.units.length}`);
if(ids.size!==data.units.length) throw new Error('중복 학습 단위 ID');
if(data.entries.length!==137) throw new Error(`원문 항목 수 오류: ${data.entries.length}`);
for(const u of data.units){
  if(!u.lines?.length||!u.answer) throw new Error(`빈 원문: ${u.id}`);
  if(u.lines.map(x=>x.text).join('\n')!==u.answer) throw new Error(`재결합 불일치: ${u.id}`);
}
if(gradingText('용정촌·명동촌')!==gradingText('용정촌 명동촌')) throw new Error('특수기호 제외 채점 오류');
if(gradingText('3·1 운동')!==gradingText('31운동')) throw new Error('숫자·가운뎃점 채점 오류');
if(gradingText('용정촌')===gradingText('명동촌')) throw new Error('다른 단어 오답 판정 오류');
const phrase='일본사·일본어를 ‘국사’·‘국어’로 교육';
const pieces=splitTarget({id:'sample',start:0,end:phrase.length,answer:phrase});
if(pieces.map(x=>x.answer).join('|')!=='일본사|일본어를|국사|국어|교육') throw new Error('긴 빈칸 분할 오류');
let visible='',at=0;
for(const piece of pieces){visible+=phrase.slice(at,piece.start)+'_';at=piece.end}
visible+=phrase.slice(at);
if(!visible.includes('·')||!visible.includes('‘')||!visible.includes('’로')) throw new Error('원문 특수기호 보존 오류');
const key=randomKeyTarget({id:'random',start:0,end:phrase.length,answer:phrase});
if(key.answer!=='국사'||phrase.slice(key.start,key.end)!==key.answer) throw new Error('랜덤 빈칸 핵심어 선택 오류');
if(randomKeyTarget({id:'particle',start:0,end:4,answer:'일본어를'}).answer!=='일본어') throw new Error('조사 가림 오류');
if(randomKeyTarget({id:'place',start:0,end:3,answer:'상하이'}).answer!=='상하이') throw new Error('지명 보존 오류');
if(randomKeyTarget({id:'number',start:0,end:9,answer:'1908년 약 2'}).answer!=='1908년') throw new Error('수치 빈칸 분리 오류');
for(const u of data.units)for(const line of u.lines){
  const parts=splitTarget({id:'check',start:0,end:line.text.length,answer:line.text});
  for(const part of parts)if(line.text.slice(part.start,part.end)!==part.answer||/[^\p{L}\p{N}\s]/u.test(part.answer)) throw new Error(`빈칸 원문 위치·기호 오류: ${u.id}`);
}
if(candidates(data.units[1].lines[1])[0]?.answer!=='이회영') throw new Error('인명 우선 가림 오류');
if(candidates(data.units[4].lines[3])[0]?.answer!=='주권') throw new Error('동사 대신 핵심어 가림 오류');
if(candidates(data.units[8].lines[0]).length) throw new Error('일반 소제목 가림 오류');
const questionWindow={};
Function('window',fs.readFileSync(new URL('./question-bank.js',import.meta.url),'utf8'))(questionWindow);
const questions=questionWindow.HISTORY_QUESTIONS;
if(questions.length!==88) throw new Error(`이해 질문 수 오류: ${questions.length}`);
for(const topic of data.meta.topics) if(!questions.some(q=>q[0]===topic)) throw new Error(`주제 ${topic}의 이해 질문 누락`);
for(const [topic,kind,refs,q,a] of questions){
  if(!kind||!q||!a||/이후 이어지는 내용|빈칸은|다음에 뭐/.test(q)) throw new Error(`단순 문장 회상 질문: ${q}`);
  for(const id of refs.split(' ')) if(!ids.has(id)) throw new Error(`질문 원문 근거 오류: ${q} / ${id}`);
}
const byId=new Map(data.units.map(u=>[u.id,u]));
const selfDetermination=unitQuestions(byId.get('t02-e01-u04'));
if(!selfDetermination.some(q=>/패전국 식민지/.test(q.a))||selfDetermination.some(q=>/국제 정세는 어떻게 달라졌나/.test(q.q))) throw new Error('민족 자결주의 질문이 근거 카드 범위를 벗어남');
for(const u of data.units){
  const expected=unitQuestions(u),packed=v3.questions.filter(q=>q.refs.length===1&&q.refs[0]===u.id);
  if(expected.length!==packed.length||expected.some(q=>!packed.some(p=>p.id===q.id&&p.a===q.a&&p.facts?.[0]===q.a)))throw new Error(`v3 사실 질문 묶음 오류: ${u.id}`);
}
if(v3.questions.some(q=>!q.refs.every(id=>ids.has(id)))) throw new Error('v3 질문 참조 무결성 오류');
for(const topic of ['all',...data.meta.topics])for(const count of [6,10,20]){
  const selected=data.units.filter(u=>topic==='all'||String(u.topic)===String(topic));
  for(let setIndex=0;setIndex<Math.ceil(selected.length/count);setIndex++){
    const state={topic,count,setIndex,session:selected.slice(setIndex*count,(setIndex+1)*count).map(u=>u.id)};
    const pool=questionPool({questionBank:v3.questions,byId,state,filtered:()=>selected,buildSession:()=>{throw new Error('빈 세트')}});
    const main=pool.filter(q=>q.scope==='current'),recap=pool.filter(q=>q.scope==='recap');
    const currentIds=new Set(state.session),priorIds=new Set(selected.slice(0,setIndex*count).map(u=>u.id));
    if(!main.length||recap.length>=10) throw new Error(`퀴즈 문항 수 오류: ${topic}/${count}/${setIndex}`);
    if(recap.length!==Math.min(8,priorIds.size)||new Set(pool.map(q=>q.id)).size!==pool.length) throw new Error('리캡 수 또는 중복 문항 오류');
    if(pool.slice(0,main.length).some(q=>q.scope!=='current')||pool.slice(main.length).some(q=>q.scope!=='recap')) throw new Error('퀴즈·리캡 순서 오류');
    for(const q of main)if(!q.refs.every(id=>currentIds.has(id))||!q.q||!q.a) throw new Error(`현재 세트 범위 오류: ${q.q}`);
    for(const id of state.session)for(const q of unitQuestions(byId.get(id)))if(!main.some(item=>item.id===q.id))throw new Error(`카드 사실 누락: ${id} / ${q.q}`);
    for(const q of recap)if(!q.refs.every(id=>priorIds.has(id))||!q.source.includes('세트')||!q.q||!q.a) throw new Error(`리캡 출처 오류: ${q.q}`);
    for(const q of pool)if(String(q.id).length>100||q.q.length>600||q.a.length>2400||q.source.length>400||q.refs.length>6)throw new Error(`클라우드 저장 제한 초과: ${q.id}`);
  }
}
console.log(`통과: ${data.entries.length}항목, ${data.units.length}학습 단위, ID/재결합 검사`);

const require=createRequire(import.meta.url),handler=require('./api/study.js'),log=[],store=new Map();
process.env.STUDY_ACCESS_CODE='test-owner-code';
process.env.KV_REST_API_URL='https://test.invalid';
process.env.KV_REST_API_TOKEN='test-token';
process.env.AI_GATEWAY_API_KEY='test-gateway-token';
let modelCalls=0;
globalThis.fetch=async(url,options)=>{
  if(String(url).includes('ai-gateway.vercel.sh')){
    modelCalls++;
    const content=modelCalls===1?'not-json':modelCalls===2
      ? {summary:'인정은 기억했지만 지원은 빠졌습니다.',ratings:[{index:0,status:'covered',feedback:'인정을 정확히 썼습니다.'},{index:1,status:'missing',feedback:'지원 강화를 쓰지 않았습니다.'}]}
      : {summary:'두 사실 모두 설명했습니다.',ratings:[{index:0,status:'covered',feedback:'인정을 설명했습니다.'},{index:1,status:'covered',feedback:'지원 강화를 설명했습니다.'}]};
    return Response.json({content:[{type:'text',text:typeof content==='string'?content:JSON.stringify(content)}],finishReason:{unified:'stop'},usage:{inputTokens:{total:120},outputTokens:{total:80}}});
  }
  const [command,key,...args]=JSON.parse(options.body);
  if(command==='RPUSH'&&key==='history:quiz:v1'){log.push(args[0]);return Response.json({result:log.length})}
  if(command==='LRANGE'&&key==='history:quiz:v1')return Response.json({result:log});
  if(command==='GET')return Response.json({result:store.get(key)||null});
  if(command==='SET'){if(!store.has(key))store.set(key,args[0]);return Response.json({result:'OK'})}
  if(command==='EVAL'){
    const count=Number(args[0]),listKey=args[1],dedupeKey=args[2],value=args[3];
    if(store.has(dedupeKey))return Response.json({result:store.get(dedupeKey)});
    store.set(dedupeKey,value);log.push(value);return Response.json({result:value});
  }
  if(command==='INCR'){const next=Number(store.get(key)||0)+1;store.set(key,next);return Response.json({result:next})}
  if(command==='EXPIRE')return Response.json({result:1});
  throw new Error('unexpected Redis command');
};
const call=async(method,body,code='test-owner-code',query={})=>{
  const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(value){this.body=value;return this}};
  await handler({method,headers:{'x-study-code':code},body,query},res);
  return res;
};
if((await call('GET',null,'wrong')).statusCode!==401)throw new Error('cloud auth failed');
store.set('history:dataset:active','3');store.set('history:dataset:v3',JSON.stringify(v3));
const active=(await call('GET',null,'wrong',{dataset:'active'}));
if(active.statusCode!==200||active.body.version!==3||active.body.questions.length!==856)throw new Error('버전 학습 자료 공개 로딩 오류');
const question={id:3,q:'무슨 일이 있었나?',a:'독립운동',source:'1세트 1번째 카드',refs:['t01-e01-u01'],scope:'current',topic:1};
const blankId='blank-attempt-1';
const blankSave=(await call('POST',{type:'attempt',id:blankId,dataVersion:3,question,answer:''})).body;
if(modelCalls||blankSave.event?.id!==blankId||log.length!==1)throw new Error('attempt 저장 요청이 채점과 분리되지 않음');
await call('POST',{type:'attempt',id:blankId,dataVersion:3,question,answer:''});
if(log.length!==1)throw new Error('attempt 재요청이 중복 저장함');
const blankGrade=(await call('POST',{type:'grade',attemptId:blankId})).body;
if(blankGrade.grade?.level!=='weak'||log.length!==2)throw new Error('빈 답안 채점 저장 오류');
const events=(await call('GET')).body.events;
if(events[0].answer!==''||events[1].type!=='grade')throw new Error('cloud log reconstruction failed');
await call('POST',{type:'rating',attemptId:blankId,rating:'review'});
if(log.length!==3)throw new Error('manual rating not persisted');
if((await call('POST',{type:'attempt',id:'too-long',dataVersion:3,question,answer:'x'.repeat(2001)})).statusCode!==400)throw new Error('answer bound failed');
const detailed={...question,id:'sample-detail',a:'대한민국 임시정부 인정 / 지원 강화',facts:['대한민국 임시정부 인정','지원 강화']};
const id='retry-attempt-1';
const saved=(await call('POST',{type:'attempt',id,dataVersion:3,question:detailed,answer:'대한민국 임시정부를 인정했다'})).body;
if(saved.event?.id!==id||modelCalls||log.filter(x=>JSON.parse(x).type==='attempt'&&JSON.parse(x).id===id).length!==1)throw new Error('답안이 채점 전에 한 번 저장되지 않음');
const failed=(await call('POST',{type:'grade',attemptId:id})).body;
if(!failed.aiError||log.some(x=>JSON.parse(x).type==='grade'&&JSON.parse(x).attemptId===id))throw new Error('실패한 채점이 grade로 저장됨');
const first=(await call('POST',{type:'grade',attemptId:id})).body;
if(first.grade?.points?.length!==2||first.grade.points[1].status!=='missing'||log.filter(x=>JSON.parse(x).type==='attempt'&&JSON.parse(x).id===id).length!==1)throw new Error('같은 attempt ID 재채점이 중복 저장됨');
const read=(await call('POST',{type:'reviewed',questionId:'sample-detail',dataVersion:3,pointIndex:1})).body;
if(read.event?.type!=='reviewed'||read.event.dataVersion!==3)throw new Error('버전별 복습 기록 오류');
const secondId='second-attempt';
await call('POST',{type:'attempt',id:secondId,dataVersion:3,question:detailed,answer:'대한민국 임시정부 인정과 지원 강화'});
const second=(await call('POST',{type:'grade',attemptId:secondId})).body;
if(second.grade?.points?.[1]?.status!=='covered'||modelCalls!==3||store.size<2)throw new Error('고정 사실 기준 보완 재평가 오류');
const blank2='blank-with-rubric';
await call('POST',{type:'attempt',id:blank2,dataVersion:3,question:detailed,answer:''});
const blankWithRubric=(await call('POST',{type:'grade',attemptId:blank2})).body;
if(blankWithRubric.grade?.points?.[1]?.status!=='missing'||modelCalls!==3)throw new Error('빈 답안의 기존 사실 재평가 오류');
const legacyId='legacy-pending';
log.push(JSON.stringify({type:'attempt',id:legacyId,at:new Date().toISOString(),question:detailed,answer:'임시정부를 인정했다'}));
const legacyGrade=(await call('POST',{type:'grade',attemptId:legacyId})).body;
if(!legacyGrade.grade||legacyGrade.gradeEvent.dataVersion!==2||log.filter(x=>JSON.parse(x).type==='attempt'&&JSON.parse(x).id===legacyId).length!==1)throw new Error('기존 미채점 답안 재채점 경로 오류');
console.log('통과: 인증·자료 버전 로딩·분리 저장/채점·idempotent attempt·동일 ID 재시도·기존 미채점 답안 재채점·버전별 복습');
