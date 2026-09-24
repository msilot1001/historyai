(()=>{
  'use strict';
  const DATA=window.HISTORY_DATA;
  const units=DATA.units.map((u,i)=>({...u,sourceIndex:i}));
  const byId=new Map(units.map(u=>[u.id,u]));
  const questionBank=window.HISTORY_QUESTIONS.map(([topic,kind,refs,q,a],id)=>({topic,kind,refs:refs.split(' '),q,a,id}));
  const $=(s,r=document)=>r.querySelector(s);
  const app=$('#app');
  const modes={
    memorize:['먼저 외우기','정답을 그대로 넘겨 보며 머릿속에 먼저 담기'],
    recall:['읽고 가리기','원문의 자리와 문장을 통째로 복원'],
    blanks:['랜덤 빈칸','원문 안의 빈칸에 바로 입력'],
    stages:['단계별 가리기','같은 자리에서 가림 범위를 점차 확대'],
    questions:['퀴즈','현재 세트 확인 후 이전 세트 누적 리캡'],
    timeline:['연도 양방향','사건과 연도 카드를 알맞은 자리에 배치'],
    order:['순서 회상','섞인 카드를 원본 노트 순서로 정렬'],
    compare:['비교 암기','관련된 두 원문을 나란히 대조']
  };
  const defaults={topic:'all',count:10,setIndex:0,indices:{},session:[],drafts:{},progress:{},stage:2,blankSeed:0,timelineDirection:'event',placements:{},order:[],selected:null,questionVersion:2,coachRound:[],coachIndex:0};
  let state=load();
  let attempt={revealed:false,checked:false,hint:false};
  let cloudEvents=null;
  let coachTab='gaps',coachTopic='all';

  async function cloud(method='GET',body){
    const code=localStorage.getItem('history-access-code');
    if(!code)throw new Error('접속 코드를 입력해 주세요.');
    const response=await fetch('/api/study',{method,headers:{'Content-Type':'application/json','x-study-code':code},body:body?JSON.stringify(body):undefined});
    const result=await response.json().catch(()=>({error:'서버 응답을 읽을 수 없습니다.'}));
    if(response.status===401)localStorage.removeItem('history-access-code');
    if(!response.ok)throw new Error(result.error||'클라우드에 연결하지 못했습니다.');
    return result;
  }
  function record(event){if(cloudEvents)cloudEvents.push(event)}
  async function loadCloud(){const result=await cloud();cloudEvents=result.events;return cloudEvents}
  function accessPanel(){return `<div class="access-panel"><label class="field">클라우드 접속 코드<input id="accessCode" type="password" autocomplete="off" placeholder="처음 한 번만 입력"></label><button id="saveCode">연결하기</button><small>이 기기에만 코드가 저장됩니다. 퀴즈 답안은 클라우드에 보관됩니다.</small></div>`}
  function bindAccess(ready){const input=$('#accessCode');$('#saveCode').onclick=()=>{const code=input.value.trim();if(!code)return input.focus();localStorage.setItem('history-access-code',code);ready()};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#saveCode').click()}}}
  function learningSnapshot(){
    const entries=new Map(),grades=new Map(),ratings=new Map(),reviewed=new Map();
    for(const event of cloudEvents||[]){
      if(event.type==='attempt')entries.set(event.id,event);
      else if(event.type==='grade')grades.set(event.attemptId,event.grade);
      else if(event.type==='rating')ratings.set(event.attemptId,event.rating);
      else if(event.type==='reviewed')reviewed.set(`${event.questionId}:${event.pointIndex}`,event.at);
    }
    const all=[...entries.values()].map(event=>({...event,grade:grades.get(event.id),rating:ratings.get(event.id)}));
    const points=new Map(),questions=new Map(),tested=new Set(),legacy=new Map();
    for(const event of all){
      const q=event.question;questions.set(q.id,q);
      if(!event.grade?.points?.length){if(![...points.values()].some(p=>p.id===q.id))legacy.set(q.id,event);continue}
      q.refs.forEach(id=>tested.add(id));legacy.delete(q.id);
      for(const part of event.grade.points){
        const key=`${q.id}:${part.index}`,old=points.get(key),history=[...(old?.history||[]),{at:event.at,status:part.status,answer:event.answer,feedback:part.feedback||''}];
        points.set(key,{key,id:q.id,index:part.index,text:part.text,status:part.status,feedback:part.feedback||'',question:q,at:event.at,answer:event.answer,history,misses:history.filter(item=>item.status!=='covered').length,reviewed:Date.parse(reviewed.get(key)||0)>=Date.parse(event.at)});
      }
    }
    const list=[...points.values()],gaps=list.filter(point=>point.status!=='covered'),covered=list.filter(point=>point.status==='covered');
    const priority={incorrect:0,missing:1,partial:2};
    gaps.sort((a,b)=>(priority[a.status]??3)-(priority[b.status]??3)||b.misses-a.misses||a.at.localeCompare(b.at));
    const topics=DATA.topics.map(topic=>{
      const topicUnits=units.filter(u=>String(u.topic)===String(topic.number));
      const topicPoints=list.filter(point=>String(point.question.topic||byId.get(point.question.refs[0])?.topic)===String(topic.number));
      return {number:topic.number,title:topic.title,total:topicUnits.length,tested:topicUnits.filter(u=>tested.has(u.id)).length,assessed:topicPoints.length,covered:topicPoints.filter(p=>p.status==='covered').length,gaps:topicPoints.filter(p=>p.status!=='covered').length,legacy:[...legacy.values()].filter(e=>String(e.question.topic)===String(topic.number)).length};
    });
    return {all,points:list,gaps,covered,topics,questions,legacy:[...legacy.values()],tested:tested.size,unseen:units.length-tested.size,reviewed};
  }

  function load(){try{const x=JSON.parse(localStorage.getItem('history-v2')||'null');if(!validState(x))return structuredClone(defaults);const next={...defaults,...x};if(x.questionVersion!==2){next.indices={...next.indices,questions:0};next.questionVersion=2}return next}catch{return structuredClone(defaults)}}
  function validState(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&(!x.session||Array.isArray(x.session))&&(!x.drafts||typeof x.drafts==='object')}
  function save(){try{localStorage.setItem('history-v2',JSON.stringify(state));setStatus('저장됨')}catch{setStatus('저장하지 못했습니다. 이 화면을 닫지 마세요.')}}
  function setStatus(t){const e=$('.status');if(e)e.textContent=t}
  function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1700)}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function text(u){return u.lines.map(x=>x.text).join('\n')}
  function yearText(u){return u.year.replace(/^●\s*/,'').trim()}
  function modeIndex(mode=pathMode()){return state.indices[mode]||0}
  function unitQuestion(u,detail=false){
    const specific={
      't02-e05-u02':'2·8 독립 선언은 민족 자결을 요구하면서 일본에 어떤 태도를 선언했나?',
      't03-e05-u01':'임시 정부는 외교·군사·언론을 통해 독립운동을 어떻게 펼쳤나?',
      't03-e06-u01':'초기 임시 정부가 위기에 빠진 정치·조직·재정상의 이유는?',
      't03-e08-u02':'임시 정부가 위기 속에서도 유지한 독립운동상·국가적 의미는?',
      't04-e01-u01':'일제는 3·1 운동 뒤 통치 방식을 왜 바꾸었고 무엇을 노렸나?',
      't04-e02-u02':'도 평의회와 부·면 협의회를 실질적인 자치 기관으로 보기 어려운 이유는?',
      't04-e04-u02':'제2차 조선 교육령의 학교 증설이 식민 교육의 목적과 연결된 이유는?',
      't04-e07-u01':'이입세 폐지는 일본 상품과 한국 기업의 경쟁에 어떤 영향을 주었나?',
      't04-e09-u02':'회사령 폐지·이입세 폐지를 한국 경제의 자유화로만 볼 수 없는 이유는?',
      't05-e06-u01':'만주 3부는 어느 지역에 어떤 조직을 두었나?',
      't05-e08-u02':'의열단의 5파괴·7가살은 각각 어떤 대상을 겨냥했나?',
      't11-e02-u01':'동북 항일 연군은 어떤 조직에서 발전했고 누가 참여했나?',
      't11-e10-u01':'임시 정부 건국 강령의 삼균주의가 말한 균등은 어떤 분야였나?',
      't11-e11-u01':'미주 독립운동 단체들은 어떻게 연대해 임시 정부를 지원했나?',
      't11-e12-u01':'카이로·얄타·포츠담 회담은 한국 독립과 전후 처리에 관해 각각 무엇을 약속했나?',
      't13-e12-u01':'북한 정권 수립 전 인민 위원회는 어떤 개혁을 했고 언제 국가를 세웠나?',
      't14-e02-u01':'반민 특위는 어떤 방해를 받아 좌절됐나?',
      't16-e03-u01':'전후 남한에서 농촌의 부담과 도시의 문제는 각각 어떻게 나타났나?',
      't18-e07-u01':'4·19 혁명에는 학생과 노동자·어린이·노인이 어떻게 참여했나?'
    };
    const first=u.lines[0].text.trim(),label=first.replace(/^→\s*/,'').split(':')[0].trim();
    const heading=/^(목적|과정|결과|영향|특징|내용|배경|전개|피해|의의|원인|변화)$/.test(label);
    const name=label.replace(/\([^)]*\)$/,'').trim(),focus=first.startsWith('→')||heading?u.title:label;
    const facts=u.lines.slice(heading?1:0).map(line=>line.text.replace(/^→\s*/,'')).filter(Boolean);
    if(!detail){
      let prompt;
      if(first.startsWith('→')){
        const metric=first.match(/^→\s*([^\d]+?)\s*\d/);
        if(metric&&/증가|감소/.test(first))prompt=`${u.title}: ${metric[1].trim()}은 얼마나 달라졌나?`;
        else if(/전투|대첩/.test(u.title))prompt=`${u.title}: 어떤 세력이 맞섰고 전투의 결과는?`;
        else if(/의거/.test(u.title))prompt=`${u.title}: 누가 무엇을 겨냥해 행동했고 어떤 반향이 있었나?`;
        else if(/사건|참변|학살|피습/.test(u.title))prompt=`${u.title}: 어떤 일이 벌어졌고 그 뒤 어떤 영향이 있었나?`;
        else if(/운동|혁명|시위/.test(u.title))prompt=`${u.title}: 누가 무엇을 요구하며 어떤 방식으로 행동했나?`;
        else if(/전쟁|남침|후퇴|상륙|북진|휴전|정전/.test(u.title))prompt=`${u.title}: 전쟁의 흐름과 결과는 어떻게 달라졌나?`;
        else if(/위원회|정부|광복군|의용군|의용대|연맹|애국단|혁명당/.test(u.title))prompt=`${u.title}: 어떤 세력이 참여했고 어떤 활동을 했나?`;
        else if(/조선 총독부 설치/.test(u.title))prompt=`${u.title}: 총독의 권한과 지방 행정은 어떻게 짜였나?`;
        else if(/통계|재정의 확대/.test(u.title))prompt=`${u.title}: 수치와 계층 변화가 무엇을 보여 주나?`;
        else if(/공화국 구상|건국 강령/.test(u.title))prompt=`${u.title}: 주권과 새 국가의 원칙을 어떻게 설명했나?`;
        else if(/독립 준비|연합 작전|의열단 조직|의열 투쟁|좌우 통합/.test(u.title))prompt=`${u.title}: 어떤 세력들이 어떤 방식으로 독립을 추진했나?`;
        else if(/국민 대표 회의|협상|외상 회의|유엔의 결정/.test(u.title))prompt=`${u.title}: 어떤 방안을 논의했고 무엇이 쟁점이 되었나?`;
        else if(/정읍 발언|총선거|부정 선거/.test(u.title))prompt=`${u.title}: 누가 어떤 방안을 내세우거나 실행했고 정치에 어떤 영향을 주었나?`;
        else if(/개헌|재선 위기|야당의 성장|진보당|우상화|숙청|독재/.test(u.title))prompt=`${u.title}: 권력을 유지하거나 견제하려고 어떤 일이 벌어졌나?`;
        else if(/광복|군정|정당|귀속 재산|과거사 청산/.test(u.title))prompt=`${u.title}: 광복 뒤 어떤 정책·조직이 등장했고 갈등은 무엇이었나?`;
        else if(/피란 수도|포로·전사자/.test(u.title))prompt=`${u.title}: 전쟁이 사람들의 삶에 남긴 구체적 흔적은?`;
        else if(/하야|내각|민주화 요구|군사 정변/.test(u.title))prompt=`${u.title}: 정치 체제와 시민의 요구는 어떻게 달라졌나?`;
        else if(/통치|교육|수탈|정책|개혁|령|법|제도/.test(u.title))prompt=`${u.title}: 어떤 방식으로 시행됐고 누구에게 어떤 영향을 주었나?`;
        else if(/경제|사회|재정|피해|변화|분단|냉전|복구/.test(u.title))prompt=`${u.title}: 어떤 변화와 문제가 나타났나?`;
        else prompt=`${u.title}: 어떤 일이 있었고 그 영향은 무엇인가?`;
      }
      else if(label==='목적'||label==='배경'||label==='원인')prompt=`${u.title}: 어떤 목적이나 배경에서 추진됐나?`;
      else if(label==='과정'||label==='전개')prompt=`${u.title}: 어떤 절차와 방식으로 진행됐나?`;
      else if(label==='결과'||label==='영향'||label==='피해'||label==='변화')prompt=`${u.title}: 어떤 결과와 변화가 나타났나?`;
      else if(/피해$/.test(label))prompt=`${u.title}: ${label}는 구체적으로 무엇이었나?`;
      else if(/영향$/.test(label))prompt=`${u.title}: ${label}으로 어떤 변화가 나타났나?`;
      else if(label==='지주'||label==='농민')prompt=`${u.title}: ${label}의 권리와 처지는 어떻게 달라졌나?`;
      else if(label==='성격')prompt=`${u.title}: 어떤 성격의 운동이었나?`;
      else if(u.title==='국외 독립운동 기지 형성')prompt=`${label}에는 어떤 독립운동 기반이 마련됐고 이후 어떤 활동으로 이어졌나?`;
      else if(/(?:령|법|제도|계획|개헌|정책)$/.test(name))prompt=`${label}: 어떤 조치를 규정했고 누구에게 어떤 영향을 주었나?`;
      else if(/(?:회|단|당|정부|위원회|의군부|군정서)$/.test(name))prompt=`${label}: 어떤 목표와 활동을 내세웠나?`;
      else if(/(?:운동|전투|사건|의거|혁명|시위|선언|참변)$/.test(name))prompt=`${label}: 어떻게 전개됐고 어떤 결과로 이어졌나?`;
      else if(/(?:통계|횟수|총액|자본액|경영 변화|계층)$/.test(label))prompt=`${label} 자료에서 확인되는 가장 중요한 추세는?`;
      else if(label==='지방')prompt=`${u.title}: 지방 행정 구역과 관리 배치는 어떻게 이루어졌나?`;
      else if(/신청사$/.test(label))prompt=`${label}: 어디에 세워졌고 이후 어떻게 처리됐나?`;
      else if(/두 노선/.test(label))prompt=`${u.title}: 복벽주의와 공화주의는 어떤 국가를 지향했나?`;
      else if(label.startsWith('『'))prompt=`${label}: 어떤 국가 구상이나 주장을 담았나?`;
      else if(/경제 구조$/.test(label))prompt=`${u.title}: 한국의 자원·시장·일본 상품은 어떤 관계로 묶였나?`;
      else if(/국제 정세 변화|제1차 세계 대전/.test(u.title))prompt=`${label}: 전쟁과 민족 자결주의를 둘러싼 국제 정세는 어떻게 달라졌나?`;
      else if(/독립 준비/.test(u.title))prompt=`${label}: 한국 독립을 국제 사회에 알리려 어떤 행동을 했나?`;
      else if(/독립 선언/.test(u.title))prompt=`${label}: 어디에서 누가 어떤 독립 방안을 주장했나?`;
      else if(/만세 시위 준비|3·1 운동 시작/.test(u.title))prompt=`${label}: 독립 선언과 만세 시위를 어떻게 준비하거나 전개했나?`;
      else if(/확산과 무력 투쟁|농촌 시위/.test(u.title))prompt=`${label}: 시위의 참여층·장소·방식은 어떻게 달라졌나?`;
      else if(/여성과 지역의 참여|유관순과 만세/.test(u.title))prompt=`${label}: 여성은 만세 시위와 이후 운동에 어떻게 참여했나?`;
      else if(/역사적 의의와 영향|시위 횟수와 참여 계층/.test(u.title))prompt=`${label}: 자료는 3·1 운동의 규모와 중심 참여층을 어떻게 보여 주나?`;
      else if(/지역 사례의 날짜/.test(u.title))prompt=`${label}: 누가 어떤 방식으로 만세 시위에 참여했나?`;
      else if(/임시 정부|상하이 임시 정부|국내외 연결/.test(u.title))prompt=`${label}: 임시 정부의 조직·연락·활동에서 맡은 역할은?`;
      else if(/산미 증식 계획|농촌의 변화/.test(u.title))prompt=`${label}: 쌀 생산과 농민 생활에 어떤 영향을 주었나?`;
      else if(/^[가-힣]{2,4}$/.test(label))prompt=`${u.title}: ${label}의 역할이나 활동은 무엇이었나?`;
      else prompt=`${u.title} · ${label}: 어떤 활동·조치와 그 결과가 제시되나?`;
      return {id:`unit:${u.id}`,kind:'내용 확인',refs:[u.id],q:specific[u.id]||prompt,a:facts.join(' / ')};
    }
    const line=u.lines.find(x=>x.text.includes(':'));
    if(line){const [subject,...rest]=line.text.replace(/^→\s*/,'').split(':');return {id:`detail:${u.id}`,kind:'세부 확인',refs:[u.id],q:`${focus}: ${subject.trim()}의 구체적 내용은?`,a:rest.join(':').trim()}}
    return {id:`detail:${u.id}`,kind:'세부 확인',refs:[u.id],q:`${focus}: 구체적인 조치나 결과 한 가지는?`,a:facts.at(-1)||first};
  }
  function questionPool(){
    if(!state.session.length)buildSession();
    const all=filtered(),current=state.session.map(id=>byId.get(id)).filter(Boolean),ids=new Set(state.session);
    const target=Math.min(20,Math.max(10,current.length));
    const main=questionBank.filter(q=>q.refs.every(id=>ids.has(id))).slice(0,target);
    const covered=new Set(main.flatMap(q=>q.refs));
    for(const u of current.filter(u=>!covered.has(u.id))){if(main.length>=target)break;main.push(unitQuestion(u))}
    for(const u of current.filter(u=>u.lines.some(line=>line.text.includes(':'))).concat(current.filter(u=>!u.lines.some(line=>line.text.includes(':'))))){if(main.length>=target)break;main.push(unitQuestion(u,true))}
    for(const u of current.filter(u=>covered.has(u.id))){if(main.length>=target)break;main.push(unitQuestion(u))}
    const prior=all.slice(0,state.setIndex*Number(state.count)),priorIds=new Set(prior.map(u=>u.id)),used=new Set();
    const recap=Array.from({length:Math.min(8,prior.length)},(_,i)=>prior[Math.floor((i+.5)*prior.length/Math.min(8,prior.length))]).map(u=>{
      const picked=questionBank.find(q=>!used.has(q.id)&&q.refs.includes(u.id)&&q.refs.every(id=>priorIds.has(id)))||unitQuestion(u);
      used.add(picked.id);return picked;
    });
    const source=q=>q.refs.map(id=>{const u=byId.get(id),i=all.findIndex(item=>item.id===id),size=Number(state.count);return i<0?'':`${Math.floor(i/size)+1}세트 ${i%size+1}번째 카드 · 주제 ${u.topic} ${u.title}`}).filter(Boolean).join(' / ');
    return main.map(q=>({...q,scope:'current',source:source(q),groupCount:main.length})).concat(recap.map(q=>({...q,scope:'recap',source:source(q),groupCount:recap.length})));
  }
  function modeLength(mode){return mode==='questions'?questionPool().length:state.session.length}
  function current(mode=pathMode()){return byId.get(state.session[modeIndex(mode)])||units[0]}
  function draftKey(mode,u,suffix='main'){return `${mode}:${u.id}:${suffix}`}
  function filtered(){return units.filter(u=>(state.topic==='all'||String(u.topic)===String(state.topic)))}
  function buildSession(){const pool=filtered(),size=Number(state.count)||10,total=Math.max(1,Math.ceil(pool.length/size));state.setIndex=Math.min(Math.max(0,state.setIndex||0),total-1);const start=state.setIndex*size;state.session=pool.slice(start,start+size).map(u=>u.id);state.indices={};state.placements={};state.order=[];save()}
  function go(path){history.pushState({},'',path);attempt={revealed:false,checked:false,hint:false};render();scrollTo(0,0)}
  function pathMode(){const mode=location.pathname.match(/^\/study\/([^/]+)/)?.[1];return mode==='quiz'?'questions':mode}
  function bindLinks(){document.querySelectorAll('[data-link]').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.getAttribute('href'))})}

  function home(){
    const topicOptions=DATA.topics.map(t=>`<option value="${t.number}" ${String(state.topic)===String(t.number)?'selected':''}>주제 ${t.number} · ${esc(t.title)}</option>`).join('');
    const pool=filtered(),size=Number(state.count)||10,totalSets=Math.max(1,Math.ceil(pool.length/size));state.setIndex=Math.min(state.setIndex||0,totalSets-1);const start=state.setIndex*size,end=Math.min(start+size,pool.length),percent=Math.round(((state.setIndex+1)/totalSets)*100);
    app.innerHTML=`<section class="hero"><div><div class="kicker">137개 원문 · 217개 학습 카드</div><h1>문장을 외우고,<br>자리를 기억한다.</h1><p>연표 노트의 문구는 그대로 두고, 학습 방식에 맞춰 화면만 바꿉니다.</p></div><section class="setup-card compact-setup" aria-label="학습 세트"><div class="setup-fields"><label class="field">범위<select id="topic"><option value="all">전체 주제</option>${topicOptions}</select></label><label class="field small-field">분량<select id="count"><option ${state.count==6?'selected':''}>6</option><option ${state.count==10?'selected':''}>10</option><option ${state.count==20?'selected':''}>20</option></select></label></div><div class="set-row"><div class="set-copy"><strong>${state.setIndex+1} / ${totalSets} 세트</strong><span>${pool.length?`${start+1}–${end}번째 카드 · 전체 ${pool.length}개`:'선택 범위에 카드 없음'}</span><i style="--set-progress:${percent}%"></i></div><div class="set-actions"><button class="ghost" id="prevSet" ${state.setIndex===0?'disabled':''} aria-label="이전 학습 세트">←</button><button id="nextSet" ${state.setIndex>=totalSets-1?'disabled':''}>다음 세트 →</button></div></div></section></section><section class="mode-grid"><a class="mode-card mode-coach" href="/coach" data-link><b>AI 코칭 · 누적 학습 분석</b><h2>내가 아는 것과 놓친 것</h2><p>핵심 사실별 진단 · 취약 주제 · 놓친 내용 다시보기 · 보완 리캡</p><span class="arrow">→</span></a>${Object.entries(modes).map(([id,[name,desc]],i)=>`<a class="mode-card ${id==='memorize'?'mode-zero':''}" href="/study/${id==='questions'?'quiz':id}" data-link><b>${String(i).padStart(2,'0')}</b><h2>${name}</h2><p>${desc}</p><span class="arrow">→</span></a>`).join('')}</section><div class="home-foot"><span>파스텔 그린 · Wanted Sans</span><span>퀴즈 답안은 클라우드, 나머지 진도는 브라우저에 저장</span><button class="ghost danger" id="reset">로컬 학습 기록 초기화</button></div>`;
    const applySettings=()=>{if(state.topic!==$('#topic').value)state.indices.questions=0;state.topic=$('#topic').value;state.count=Number($('#count').value);state.setIndex=0;buildSession();render();toast('첫 세트로 변경했습니다')};$('#topic').onchange=applySettings;$('#count').onchange=applySettings;
    $('#prevSet').onclick=()=>{if(state.setIndex>0){state.setIndex--;buildSession();render()}};$('#nextSet').onclick=()=>{if(state.setIndex<totalSets-1){state.setIndex++;buildSession();render()}};
    $('#reset').onclick=()=>{if(confirm('학습 기록과 초안을 모두 지울까요? 원문은 지워지지 않습니다.')){localStorage.removeItem('history-v2');state=structuredClone(defaults);render()}};
    bindLinks();
  }

  function shell(mode,content){
    if(!state.session.length)buildSession();
    const [name]=modes[mode],index=modeIndex(mode),total=modeLength(mode);const p=Math.round(((index+1)/total)*100);
    app.innerHTML=`<header class="study-head"><div><a class="crumb" href="/" data-link>← 학습 홈</a><h1>${name}</h1><div class="status">브라우저에 자동 저장</div></div><div class="progress">${index+1} / ${total}<i style="--p:${p}%"></i></div></header>${content}`;
    bindLinks();
  }
  function paper(u,{inputs=[],hide=false}={}){
    const lines=u.lines.map((l,li)=>`<div class="line">${inputs.length?clozeLine(l.text,li,inputs):hide?'••••••••••••••':l.html}</div>`).join('');
    const special=n=>inputs.some(i=>i.line===n)?clozeLine(n===-1?yearText(u):u.title,n,inputs):null;
    return `<article class="paper"><div class="topic">주제 ${String(u.topic).padStart(2,'0')} ${esc(u.topic_title)}</div><div class="year">${special(-1)||u.year_html}</div><h3 class="title">${special(-2)||u.title_html}</h3>${u.book?'<div class="book">교과서</div>':''}<div class="lines">${lines}</div></article>`;
  }
  function paperSurface(u,opts={}){return `<section class="surface"><div class="surface-head"><h2>원문의 자리</h2><span class="meta">${u.position.page}쪽 · ${u.position.column}단(상위 위치)</span></div><div class="paper-stage"><div class="paper-scale">${paper(u,opts)}</div></div></section>`}
  function resizePapers(){document.querySelectorAll('.paper-stage').forEach(stage=>{const wrap=stage.querySelector('.paper-scale'),p=stage.querySelector('.paper');if(!wrap||!p)return;const style=getComputedStyle(stage),available=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),scale=Math.min(1,available/360);p.style.transform=`scale(${scale})`;wrap.style.height=`${p.offsetHeight*scale}px`;wrap.style.flexBasis=`${360*scale}px`;wrap.style.width=`${360*scale}px`})}
  function navigation(mode){const index=modeIndex(mode);return `<div class="nav"><button class="ghost" data-prev ${index===0?'disabled':''}>← 이전</button><button class="secondary" data-next>${index===modeLength(mode)-1?'학습 마치기':'다음 →'}</button></div>`}
  function bindNav(mode,before=()=>{}){const prev=$('[data-prev]'),next=$('[data-next]');const after=()=>{if(mode==='questions')requestAnimationFrame(() => $('#answer')?.focus())};if(prev)prev.onclick=()=>{before();const index=modeIndex(mode);if(index>0){state.indices[mode]=index-1;attempt={revealed:false,checked:false,hint:false};save();render();after()}};if(next)next.onclick=()=>{before();const index=modeIndex(mode);if(index<modeLength(mode)-1){state.indices[mode]=index+1;attempt={revealed:false,checked:false,hint:false};save();render();after()}else go('/')};}

  function memorize(){const u=current('memorize');shell('memorize',`<div class="memorize-wrap">${paperSurface(u)}<section class="surface memorize-note"><div class="kicker">0번 · 먼저 눈으로 외우기</div><h2>${esc(u.title)}</h2><p>연도, 제목, 화살표의 위치와 문장을 그대로 읽으세요. 준비되면 다음 카드로 넘어가고, 한 바퀴 본 뒤 다른 활동을 시작하면 됩니다.</p><p class="key-help">키보드: ←/→ 또는 Enter로 넘기기</p>${navigation('memorize')}</section></div>`);bindNav('memorize');resizePapers()}

  function recall(){const u=current(),key=draftKey('recall',u);shell('recall',`<div class="workspace">${paperSurface(u,{hide:attempt.revealed===false&&attempt.checked})}<section class="surface answer"><div class="prompt">원문을 읽은 뒤 가리고, 문구와 줄 순서를 그대로 입력하세요. Ctrl+Enter로 채점합니다.</div><label>원문 복원<textarea id="answer" spellcheck="false" placeholder="기억한 문장을 입력하세요">${esc(state.drafts[key]||'')}</textarea></label><div class="actions"><button id="hide">${attempt.checked?'원문 다시 보기':'가리고 복원하기'}</button><button class="ghost" id="check">정답 확인</button><button class="ghost" id="reveal">정답 공개</button></div><div id="result"></div>${navigation('recall')}</section></div>`);const a=$('#answer');a.oninput=()=>{state.drafts[key]=a.value;attempt.checked=false;save()};a.onkeydown=e=>{if(e.ctrlKey&&e.key==='Enter'&&!e.isComposing){e.preventDefault();$('#check').click()}};$('#hide').onclick=()=>{attempt.checked=!attempt.checked;render()};$('#reveal').onclick=()=>{attempt.revealed=true;attempt.hint=true;$('.paper-scale').innerHTML=paper(u);resizePapers()};$('#check').onclick=()=>grade($('#result'),text(u),a.value);bindNav('recall',()=>{state.drafts[key]=a.value;save()});resizePapers()}
  function gradingText(value){return value.normalize('NFC').replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase('ko-KR')}
  function grade(box,expected,actual){const ok=gradingText(expected)===gradingText(actual);box.className=`result ${ok?'ok':'bad'}`;box.innerHTML=ok?'✓ 특수기호를 제외한 단어가 일치합니다.':`다시 확인할 단어가 있습니다.<br><b>원문</b><br>${esc(expected).replace(/\n/g,'<br>')}`;attempt.checked=true;return ok}

  function clozeCandidates(line){
    const source=line.text,found=[];
    // ponytail: 이름 목록은 이 고정 원문에 맞춘 것. 자료가 바뀌면 원문 데이터에서 인명 태그를 제공한다.
    const people='이승만 김원봉 김일성 이동휘 김좌진 조소앙 신채호 김규식 안창호 박상진 양세봉 김두봉 조봉암 이상설 박용만 신규식 박은식 홍범도 윤세주 박헌영 김약연 이회영 이청천 이범석 임병찬 한용운 이승훈 유관순 서재필 정칠성 박자혜 윤형숙 김향화 윤학조 이광수 신익희 최진동 김익상 김상옥 김지섭 나석주 윤봉길 민영주 오광심 조순옥 김정숙 신순호 안재홍 조만식 송진우 김성수 이시영 김상덕 노덕술 김명복 김무정 조병옥 김주열 오성원 전한승 박정희 김구 황싱 쑨원 우장춘'.split(' ');
    const action=/\s+(?:설립|정착|배출|조직|발행|담당|장악|철거|확대|변경|건립|실시|공포|주장|증가|감소|제한|반출|반입|확보|이동|시작|해결|인정|지원|참여|진압|체포|사망|순국|활동|전개|제시|계승|비판|부정|폐지|구성|수립|발각|습격|훈련|탄압|처벌|보급|강요|요구|반대|파견|귀환|취득|수탈|계획|철수|결렬|선물|논의|사퇴|고수|촉구|중단|억압|연기|희생|승리|박탈|임명|파괴|기념|편입|전락|확산|주도|강화|양성|단행|작성|보호|후원|계속|처단|결집|마련|받음|나섬|차단|부상|확인|공개|추진|가입|결성|승계|가담|돌입|무효|철폐|차별|장려|투쟁|독점|침략|점령|패배|피습|저항|기도|수감|피란|개최|이관|제정|복원)(?:\s|$)/;
    function add(start,value,score){
      if(start<0)return;
      const lead=value.match(/^\s*/)[0].length;start+=lead;value=value.trim();
      value=value.replace(/[\s,.:;·→]+$/,'').trim();
      if(value.length<2||!/[\p{L}\p{N}]/u.test(value)||value.length>28)return;
      if(source===value&&/^(?:목적|배경|결과|특징|영향|내용)$/.test(value))return;
      found.push({start,end:start+value.length,answer:value,score});
    }
    for(const m of line.html.matchAll(/<b>([^<]+)<\/b>/g))add(source.indexOf(m[1]),m[1],130);
    for(const name of people){let at=source.indexOf(name);while(at>=0){add(at,name,125);at=source.indexOf(name,at+name.length)}}
    for(const m of source.matchAll(/[가-힣]{2,8}(?:\s+[가-힣]{2,8}){0,2}\s*(?:회|학교|강습소|정부|군정서|군단|의거|대첩|선언|사건|제도|태형령|운동|전쟁|협회|학사|총독부)/g))add(m.index,m[0],121);
    for(const m of source.matchAll(/\(([^)]+)\)/g)){
      for(const part of m[1].split(/[,·]/)){const value=part.trim();add(source.indexOf(value,m.index),value,/\d/.test(value)?94:108)}
    }
    for(const m of source.matchAll(/([^→:]+):\s*([^→,]+)/g)){
      const label=m[1].trim(),value=m[2].trim();
      add(source.indexOf(value,m.index),value,118);
      if(/^[가-힣]{2,4}$/.test(label))add(source.indexOf(label,m.index),label,label.length>=3?120:112);
    }
    for(const m of source.matchAll(/(?:대통령|부통령|국무총리|위원장|교수|장군|교사|총독|대표)\s+([가-힣]{2,4})/g))add(m.index+m[0].lastIndexOf(m[1]),m[1],110);
    for(const m of source.matchAll(/\d{4}(?:\.\s*\d{1,2})?(?:년)?|\d+(?:\.\d+)?(?:%|만\s*원|명|채|가구)/g))add(m.index,m[0],94);
    for(const m of source.matchAll(/(?:^|\s)([가-힣]{2,8})(?:을|를)(?=\s|$)/g))add(m.index+m[0].indexOf(m[1]),m[1],80);
    for(const m of source.matchAll(/[^→]+/g)){
      let chunk=m[0].trim().replace(/^[●\-\s]+/,'');
      if(!chunk)continue;
      if(!source.includes('→')&&/^(?:목적|배경|결과|특징|영향|내용)$/.test(chunk))continue;
      const originalStart=source.indexOf(chunk,m.index);
      if(chunk.includes(':'))chunk=chunk.slice(0,chunk.indexOf(':')).trim();
      for(const part of chunk.split(',')){
        let name=part.trim().replace(/^[“‘『]|[”’』]$/g,'');
        const verb=name.match(action);if(verb)name=name.slice(0,verb.index).trim();
        if(name.length>24)name=name.split(/\s+/).slice(0,3).join(' ');
        if(name.length>=2)add(source.indexOf(name,originalStart),name,/\d|·|\(|회|군|정부|학교|위원회|의거|전투|대첩|사건|운동|혁명|촌|도|단|령|법/.test(name)?86:70);
      }
    }
    return found.sort((a,b)=>b.score-a.score||a.start-b.start).filter((x,i,all)=>all.findIndex(y=>y.start<x.end&&x.start<y.end)===i);
  }
  function splitTarget(x){
    const spans=[];
    for(const segment of x.answer.matchAll(/[\p{L}\p{N}\s]+/gu)){
      const words=[...segment[0].matchAll(/[\p{L}\p{N}]+/gu)].filter(m=>m[0].length>1||!/[’”']/.test(x.answer[segment.index+m.index-1]||''));
      let start=-1,end=-1;
      for(const word of words){
        if(start>=0&&word.index+word[0].length-start>9){spans.push([segment.index+start,segment.index+end]);start=-1}
        if(start<0)start=word.index;
        end=word.index+word[0].length;
      }
      if(start>=0)spans.push([segment.index+start,segment.index+end]);
    }
    if(spans.length===1&&spans[0][0]===0&&spans[0][1]===x.answer.length)return [x];
    return spans.map(([start,end])=>({...x,id:`${x.id}-${start}`,start:x.start+start,end:x.start+end,answer:x.answer.slice(start,end)}));
  }
  function randomKeyTarget(x){
    const parts=splitTarget(x).map(part=>{
      const number=part.answer.match(/\d{4}년?|\d+(?:년|명|개|원|%)/);
      if(number&&part.answer.length>number[0].length+2){const start=part.start+number.index;return {...part,id:`${part.id}-number`,start,end:start+number[0].length,answer:number[0]}}
      const answer=part.answer.replace(/(?<=[가-힣]{2})(?:을|를|은|는)$/u,'');
      return {...part,end:part.start+answer.length,answer};
    }).filter(part=>part.answer.length>1&&!/^(?:설립|조직|활동|시작|확대|강화|증가|감소|제한|교육|중심|결과|배경|영향|내용|실시|지원|참여|진압|발행|추진|요구|반대|사망|순국|이동|계속|해결|인정|보급)$/u.test(part.answer));
    return parts.sort((a,b)=>Number(/(?:정부|학교|교육령|령|법|운동|사건|의거|대첩|전투|협회|군|회의|조약|제도|교육|독립|주권|국사|국어|당|단|촌|도|년|명|개|원|%)/u.test(b.answer))-Number(/(?:정부|학교|교육령|령|법|운동|사건|의거|대첩|전투|협회|군|회의|조약|제도|교육|독립|주권|국사|국어|당|단|촌|도|년|명|개|원|%)/u.test(a.answer))||a.start-b.start)[0];
  }
  function targets(u,stage=2,random=false){
    if(stage===1)return [];
    const out=[];
    u.lines.forEach((line,li)=>{
      if(stage===5){out.push({id:`${u.id}-${li}-all`,line:li,start:0,end:line.text.length,answer:line.text});return}
      const candidates=clozeCandidates(line),count=stage>=4?3:stage>=3?2:1;
      const primary=candidates.filter(x=>x.score>=86);
      const first=random&&primary.length?primary[state.blankSeed%primary.length]:candidates[0];
      const chosen=first?[first,...candidates.filter(x=>x!==first)].slice(0,count):[];
      chosen.sort((a,b)=>a.start-b.start).forEach(x=>out.push({id:`${u.id}-${li}-${x.start}`,line:li,start:x.start,end:x.end,answer:x.answer}));
    });
    if(stage===5)out.unshift({id:`${u.id}-year`,line:-1,answer:yearText(u),start:0,end:yearText(u).length},{id:`${u.id}-title`,line:-2,answer:u.title,start:0,end:u.title.length});
    return random?out.map(randomKeyTarget).filter(Boolean):out.flatMap(splitTarget);
  }
  function clozeLine(line,li,list){let at=0,s='';list.filter(x=>x.line===li).sort((a,b)=>a.start-b.start).forEach(x=>{s+=esc(line.slice(at,x.start));const val=state.drafts[draftKey(pathMode(),current(),x.id)]||'';s+=`<span class="cloze-wrap"><input class="inline-input" data-cloze="${x.id}" aria-label="${list.indexOf(x)+1}번째 빈칸" autocomplete="off" spellcheck="false" value="${esc(val)}" style="width:${Math.max(28,Math.min(160,x.answer.length*13+8))}px"><span class="cloze-peek" aria-hidden="true">${esc(x.answer)}</span></span>`;at=x.end});return s+esc(line.slice(at))}
  function showPeek(show){attempt.revealed=show;document.querySelectorAll('.cloze-wrap').forEach(x=>x.classList.toggle('peek',show));const b=$('#reveal');if(b){b.textContent=show?'정답 다시 가리기':'정답 살짝 보기';b.setAttribute('aria-pressed',String(show))}}
  function clozeMode(mode){const u=current(),list=targets(u,mode==='stages'?state.stage:2,mode==='blanks');shell(mode,`${mode==='stages'?`<div class="toolbar stage-picker"><label>가림 단계 <input id="stage" type="range" min="1" max="5" value="${state.stage}"> <b>${state.stage}</b></label></div>`:''}<div class="workspace">${paperSurface(u,{inputs:list})}<section class="surface answer"><div class="prompt">빈칸에서 바로 입력하세요. 가운뎃점·화살표·괄호·띄어쓰기는 채점하지 않습니다. Enter/Tab은 다음 칸입니다.</div><div class="actions"><button id="check">정답 확인</button><button class="ghost" id="reveal" aria-pressed="false">정답 살짝 보기</button>${mode==='blanks'?'<button class="ghost" id="new">새 빈칸</button>':''}</div><div id="result"></div>${navigation(mode)}</section></div>`);const inputs=[...document.querySelectorAll('[data-cloze]')];inputs.forEach((inp,i)=>{const hide=()=>showPeek(false);inp.onfocus=hide;inp.oninput=()=>{hide();state.drafts[draftKey(mode,u,inp.dataset.cloze)]=inp.value;inp.classList.remove('correct','wrong');save()};inp.onkeydown=e=>{if(e.isComposing||inp.dataset.composing)return;if(e.key==='Enter'){e.preventDefault();(inputs[i+1]||$('#check')).focus();if(!inputs[i+1])$('#check').click()}};inp.oncompositionstart=()=>inp.dataset.composing='1';inp.oncompositionend=()=>delete inp.dataset.composing});$('#check').onclick=()=>{showPeek(false);let ok=true;list.forEach(x=>{const inp=$(`[data-cloze="${x.id}"]`);const good=gradingText(inp.value)===gradingText(x.answer);inp.classList.add(good?'correct':'wrong');ok&&=good});const r=$('#result');r.className=`result ${ok?'ok':'bad'}`;r.textContent=ok?'✓ 특수기호를 제외한 모든 단어가 일치합니다.':'표시된 빈칸의 단어를 다시 확인하세요.'};$('#reveal').onclick=()=>{attempt.hint=true;showPeek(!attempt.revealed)};if($('#new'))$('#new').onclick=()=>{state.blankSeed++;list.forEach(x=>delete state.drafts[draftKey(mode,u,x.id)]);save();render()};if($('#stage'))$('#stage').oninput=e=>{state.stage=Number(e.target.value);save();render()};bindNav(mode);resizePapers()}

  function quizCard(q,number,total,reviewing=false){
    const key=`${reviewing?'review':'questions'}:${q.id}`;
    return `<div class="question-wrap surface question-card"><div class="quiz-context ${esc(q.scope||'review')}"><span>${reviewing?'AI 코칭 · 보완 리캡':q.scope==='current'?'현재 세트 퀴즈':'이전 세트 누적 리캡'}</span><strong>${number} / ${total}</strong></div><div class="quiz-source">${esc(q.source)}</div><div class="kicker">${esc(q.kind||'내용 확인')}</div><h2>${esc(q.q)}</h2><label class="field">내 설명<textarea id="answer" spellcheck="false" placeholder="핵심 내용을 내 말로 설명해 보세요" maxlength="2000">${esc(state.drafts[key]||'')}</textarea></label><div class="actions"><button id="check">답안 저장 · 분석</button><button class="ghost" id="hint">원문 근거 보기</button></div><div id="quizAccess" ${localStorage.getItem('history-access-code')?'hidden':''}>${accessPanel()}</div><p id="cloudStatus" class="cloud-status" role="status">답안을 제출하면 클라우드에 기록되고 AI가 핵심 사실별로 살펴봅니다.</p><div id="result" class="result" role="status" hidden></div><div id="selfcheck" class="actions" hidden><button id="known">확인했어요 →</button><button id="review" class="secondary">다시 볼게요 →</button></div><details class="evidence" id="evidence"><summary>원문 근거</summary>${q.refs.map(id=>byId.get(id)).filter(Boolean).map(u=>paper(u)).join('')}</details>${reviewing?'':navigation('questions')}</div>`;
  }
  function bindQuiz(q,next,reviewing=false){
    const key=`${reviewing?'review':'questions'}:${q.id}`,a=$('#answer'),check=$('#check');
    let lastAttemptId=null;
    bindAccess(()=>{$('#quizAccess').hidden=true;check.click()});
    a.oninput=()=>{state.drafts[key]=a.value;save()};
    a.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();check.click()}};
    check.onclick=async()=>{
      if(check.disabled)return;
      if(!localStorage.getItem('history-access-code')){$('#quizAccess').hidden=false;$('#accessCode').focus();return}
      check.disabled=true;$('#cloudStatus').textContent='답안을 클라우드에 저장하고 있습니다…';
      try{
        const question={...q,id:String(q.id),topic:q.topic||byId.get(q.refs[0])?.topic};
        const result=await cloud('POST',{type:'attempt',question,answer:a.value});
        lastAttemptId=result.event.id;record(result.event);
        if(result.grade)record({type:'grade',attemptId:lastAttemptId,grade:result.grade});
        $('#cloudStatus').textContent=result.aiError||'클라우드 저장 완료 · AI 채점 완료';
        const label={strong:'핵심 사실 확인',partial:'보완할 사실 있음',weak:'다시 살펴볼 사실 많음'}[result.grade?.level];
        const status={covered:'알고 있음',partial:'일부만 설명',missing:'빠뜨림',incorrect:'잘못 이해함'};
        $('#result').innerHTML=`${label?`<div class="ai-grade ${result.grade.level}"><b>AI 분석 · ${label}</b><span>${esc(result.grade.reason)}</span></div>`:''}${result.grade?.points?.length?`<div class="point-results"><h3>핵심 사실별 진단 <small>${result.grade.points.filter(p=>p.status==='covered').length} / ${result.grade.points.length}개 확인</small></h3>${result.grade.points.map(p=>`<div class="point-result ${esc(p.status)}"><b>${status[p.status]}</b><strong>${esc(p.text)}</strong><span>${esc(p.feedback)}</span></div>`).join('')}</div>`:result.grade?.missing?.length?`<p>빠진 핵심: ${esc(result.grade.missing.join(' · '))}</p>`:''}<details class="answer-detail"><summary>핵심 답안 전체 보기</summary><p>${esc(q.a)}</p></details><small>AI 평가는 참고용입니다. 자기평가는 핵심 사실 판정을 덮어쓰지 않습니다.</small>`;
        $('#result').hidden=false;$('#selfcheck').hidden=false;$('#known').focus();
      }catch(error){$('#cloudStatus').textContent=error.message;check.disabled=false;if(!localStorage.getItem('history-access-code')){$('#quizAccess').hidden=false;$('#accessCode').focus()}else check.focus()}
    };
    $('#hint').onclick=()=>{$('#evidence').open=true;attempt.hint=true;resizePapers()};
    for(const [id,rating] of [['known','known'],['review','review']])$('#'+id).onclick=async()=>{
      if(!lastAttemptId)return;
      $('#known').disabled=true;$('#review').disabled=true;
      try{
        const result=await cloud('POST',{type:'rating',attemptId:lastAttemptId,rating});record(result.event);
        state.progress[key]=rating;save();next(rating);
      }catch(error){$('#cloudStatus').textContent=error.message;$('#known').disabled=false;$('#review').disabled=false}
    };
    resizePapers();
  }
  function questions(){
    const pool=questionPool();state.indices.questions=Math.min(modeIndex('questions'),pool.length-1);
    const index=modeIndex('questions'),q=pool[index],number=q.scope==='current'?index+1:index-pool[0].groupCount+1;
    shell('questions',quizCard(q,number,q.groupCount));
    bindQuiz(q,()=>$('[data-next]').click());bindNav('questions');
  }
  function pointCard(point){
    const status={covered:'알고 있음',partial:'일부만 설명',missing:'빠뜨림',incorrect:'잘못 이해함'};
    const improved=point.status==='covered'&&point.history.some(item=>item.status!=='covered');
    const regressed=point.status!=='covered'&&point.history.some(item=>item.status==='covered');
    const place=point.question.refs.map(id=>byId.get(id)).filter(Boolean);
    return `<article class="coach-point ${esc(point.status)}"><div class="coach-point-head"><span class="point-pill ${esc(point.status)}">${improved?'보완 확인':regressed?'다시 빠짐':status[point.status]}</span><small>${esc(point.question.source||place.map(u=>`주제 ${u.topic} · ${u.title}`).join(' / '))}</small></div><h3>${esc(point.text)}</h3><p>${esc(point.feedback||'다음 답안에서 이 사실을 다시 확인해 보세요.')}</p><div class="point-meta"><span>제출 ${point.history.length}회 · 누락 ${point.misses}회</span><span>${point.status==='covered'?(improved?'다시 답해 보완 확인':'답안으로 확인'):point.reviewed?'원문 읽음 · 답안으로 재확인 필요':'원문 미확인'}</span></div><details><summary>이전 답안과 원문 보기</summary><div class="coach-evidence"><strong>질문</strong><p>${esc(point.question.q)}</p><strong>최근 답안</strong><p>${esc(point.answer||'(빈 답안)')}</p><strong>핵심 답안</strong><p>${esc(point.question.a)}</p>${place.map(u=>paper(u)).join('')}</div></details>${point.status!=='covered'?`<button class="ghost point-read" data-read="${esc(point.key)}" ${point.reviewed?'disabled':''}>${point.reviewed?'읽음 기록됨':'놓친 사실 읽었어요'}</button>`:''}</article>`;
  }
  async function coach(){
    if(!localStorage.getItem('history-access-code')){app.innerHTML=`<section class="surface review-loading"><a class="crumb" href="/" data-link>← 학습 홈</a><h1>AI 코칭</h1><p>핵심 사실별 학습 기록을 보려면 접속 코드를 입력하세요.</p>${accessPanel()}</section>`;bindLinks();bindAccess(()=>coach());return}
    if(!cloudEvents){app.innerHTML='<section class="surface review-loading"><h1>AI 코칭 준비 중</h1><p>클라우드 학습 기록을 불러옵니다.</p><p id="loadStatus" role="status"></p></section>';try{await loadCloud();if(location.pathname==='/coach'||location.pathname==='/review')coach();else if(location.pathname==='/coach/recap')coachRecap()}catch(error){$('#loadStatus').innerHTML=`${esc(error.message)} <button id="retryCloud">다시 연결</button>`;$('#retryCloud').onclick=coach}return}
    const summary=learningSnapshot();
    const shown=(coachTab==='gaps'?summary.gaps:coachTab==='covered'?summary.covered:[]).filter(p=>coachTopic==='all'||String(p.question.topic||byId.get(p.question.refs[0])?.topic)===coachTopic);
    const legacy=summary.legacy.filter(e=>coachTopic==='all'||String(e.question.topic)===coachTopic);
    const top=summary.topics.filter(t=>t.gaps).sort((a,b)=>b.gaps-a.gaps||b.gaps/b.assessed-a.gaps/a.assessed).slice(0,3);
    app.innerHTML=`<header class="study-head coach-head"><div><a class="crumb" href="/" data-link>← 학습 홈</a><h1>AI 코칭</h1><div class="status">어떤 사실을 알고, 무엇을 반복해서 빠뜨리는지 답안 이력으로 분석합니다.</div></div><div class="review-tools"><button class="ghost" id="refreshLog">새로고침</button><button class="ghost" id="exportLog">기록 내보내기</button></div></header><section class="coach-summary"><div class="coach-lead"><span>현재 확인된 핵심 사실</span><strong>${summary.covered.length}<small> / ${summary.points.length}</small></strong><i style="--score:${summary.points.length?Math.round(summary.covered.length/summary.points.length*100):0}%"></i><p>AI로 평가한 사실만 분모에 포함합니다. 읽기·자가평가는 정답 확인으로 세지 않습니다.</p></div><div><b>${summary.gaps.length}</b><span>아직 보완할 사실</span></div><div><b>${summary.tested}<small> / ${units.length}</small></b><span>AI 평가와 연결된 학습 카드</span></div><div><b>${summary.unseen}</b><span>아직 평가되지 않은 카드</span></div></section><section class="surface coach-topics"><div class="section-title"><div><span class="kicker">TOPIC MAP</span><h2>주제별 이해 상태</h2></div><p>분모는 평가된 핵심 사실. 학습 범위 전체의 숙달률은 아닙니다.</p></div>${top.length?`<p class="coach-focus">우선 보완: ${top.map(t=>`주제 ${t.number} ${esc(t.title)} (${t.gaps}개 누락)`).join(' · ')}</p>`:''}<div class="topic-matrix">${summary.topics.map(t=>`<button class="topic-cell ${coachTopic===String(t.number)?'active':''}" data-topic="${t.number}"><span>주제 ${t.number}</span><strong>${esc(t.title)}</strong><i style="--score:${t.assessed?Math.round(t.covered/t.assessed*100):0}%"></i><small>확인 ${t.covered} · 보완 ${t.gaps} · 미평가 카드 ${t.total-t.tested}</small></button>`).join('')}</div></section><section class="coach-section"><div class="section-title"><div><span class="kicker">FACT TRACKER</span><h2>사실별 학습 기록</h2></div><button id="startRecap" ${summary.gaps.length?'':'disabled'}>보완 리캡 시작 →</button></div><div class="coach-controls"><div class="coach-tabs" role="tablist" aria-label="학습 분석 보기"><button data-tab="gaps" aria-selected="${coachTab==='gaps'}">놓친 사실 ${summary.gaps.length}</button><button data-tab="covered" aria-selected="${coachTab==='covered'}">알고 있는 사실 ${summary.covered.length}</button><button data-tab="legacy" aria-selected="${coachTab==='legacy'}">이전 기록 ${summary.legacy.length}</button></div><label class="field">주제 필터<select id="coachTopic"><option value="all">전체 주제</option>${DATA.topics.map(t=>`<option value="${t.number}" ${coachTopic===String(t.number)?'selected':''}>주제 ${t.number} · ${esc(t.title)}</option>`).join('')}</select></label></div><div class="coach-list">${coachTab==='legacy'?legacy.map(e=>`<article class="coach-point"><span class="point-pill">세부 재확인 필요</span><h3>${esc(e.question.q)}</h3><p>예전 채점은 사실별로 저장되지 않았습니다. 추측해서 분석하지 않고, 새 답안으로 다시 확인합니다.</p><small>${esc(e.question.source)}</small></article>`).join(''):shown.map(pointCard).join('')||'<p class="coach-empty">이 범위에는 아직 표시할 사실이 없습니다. 퀴즈를 풀면 여기에 쌓입니다.</p>'}</div></section>`;
    bindLinks();
    document.querySelectorAll('[data-topic]').forEach(button=>button.onclick=()=>{coachTopic=coachTopic===button.dataset.topic?'all':button.dataset.topic;coach()});
    document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{coachTab=button.dataset.tab;coach()});
    $('#coachTopic').onchange=e=>{coachTopic=e.target.value;coach()};
    $('#startRecap').onclick=()=>{const ids=[...new Set(summary.gaps.map(p=>p.id))].slice(0,10);state.coachRound=ids;state.coachIndex=0;ids.forEach(id=>delete state.drafts[`review:${id}`]);save();go('/coach/recap')};
    document.querySelectorAll('[data-read]').forEach(button=>button.onclick=async()=>{const [questionId,pointIndex]=button.dataset.read.split(/:(?=\d+$)/);button.disabled=true;try{const result=await cloud('POST',{type:'reviewed',questionId,pointIndex:Number(pointIndex)});record(result.event);coach()}catch(error){button.disabled=false;toast(error.message)}});
    $('#exportLog').onclick=()=>{const blob=new Blob([JSON.stringify(cloudEvents,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='history-quiz-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    $('#refreshLog').onclick=async()=>{try{await loadCloud();coach();toast('기록을 새로 읽었습니다')}catch(error){toast(error.message)}};
    resizePapers();
  }
  function coachRecap(){
    if(!cloudEvents){coach();return}
    const summary=learningSnapshot(),ids=state.coachRound||[],index=state.coachIndex||0;
    if(index>=ids.length||!ids.length){state.coachRound=[];state.coachIndex=0;save();go('/coach');toast('보완 리캡을 마쳤습니다. 사실별 상태를 확인해 보세요.');return}
    const q=summary.questions.get(ids[index]);if(!q){state.coachIndex++;save();coachRecap();return}
    app.innerHTML=`<header class="study-head"><div><a class="crumb" href="/coach" data-link>← AI 코칭</a><h1>보완 리캡</h1><div class="status">앞서 놓친 사실을 전체 질문에 답하며 다시 확인합니다.</div></div><div class="progress">${index+1} / ${ids.length}<i style="--p:${Math.round((index+1)/ids.length*100)}%"></i></div></header>${quizCard({...q,scope:'coach'},index+1,ids.length,true)}`;
    bindLinks();bindQuiz({...q,scope:'coach'},()=>{state.coachIndex++;save();coachRecap()},true);requestAnimationFrame(()=>$('#answer')?.focus());
  }

  function roundUnits(){return state.session.map(byId.get.bind(byId)).filter(Boolean).slice(0,10)}
  function dragCard(u,label){return `<div class="sort-card ${state.selected===u.id?'selected':''}" draggable="true" data-card="${u.id}" tabindex="0"><strong>${esc(label||u.title)}</strong><small>${esc(u.lines[0]?.text||'')}</small><div class="card-buttons"><button class="ghost" data-select="${u.id}">선택</button></div></div>`}
  function timeline(){const list=roundUnits().filter(u=>yearText(u));const dir=state.timelineDirection;const placed=new Set(Object.values(state.placements).flat());const pool=list.filter(u=>!placed.has(dir==='event'?u.id:`year:${u.id}`));let slots,cards;if(dir==='event'){cards=pool.map(u=>dragCard(u)).join('');slots=[...new Set(list.map(yearText))].map(y=>`<section class="year-slot" data-slot="${esc(y)}"><h3>${esc(y)}</h3>${(state.placements[y]||[]).map(id=>dragCard(byId.get(id))).join('')}</section>`).join('')}else{cards=pool.map(u=>dragCard({...u,id:`year:${u.id}`},yearText(u))).join('');slots=list.map(u=>`<section class="year-slot" data-slot="${u.id}"><h3>${esc(u.title)}</h3>${(state.placements[u.id]||[]).map(id=>{const real=byId.get(id.replace('year:',''));return dragCard({id},yearText(real))}).join('')}</section>`).join('')}shell('timeline',`<div class="toolbar"><button id="direction" class="secondary">${dir==='event'?'사건 → 연도':'연도 → 사건'}</button><button id="resetRound" class="ghost">현재 라운드 초기화</button><button id="check">배치 확인</button></div><div class="board"><section class="surface tray"><h2>배치할 카드</h2><div class="cards">${cards||'<p class="meta">모든 카드를 배치했습니다.</p>'}</div></section><section class="surface slots"><h2>${dir==='event'?'연도 자리':'사건 자리'}</h2>${slots}<div id="result"></div></section></div>`);bindDrag(dir);$('#direction').onclick=()=>{state.timelineDirection=dir==='event'?'year':'event';state.placements={};state.selected=null;save();render()};$('#resetRound').onclick=()=>{state.placements={};state.selected=null;save();render()};$('#check').onclick=()=>{let total=0,good=0;Object.entries(state.placements).forEach(([slot,ids])=>ids.forEach(id=>{total++;const u=byId.get(id.replace('year:',''));if((dir==='event'&&yearText(u)===slot)||(dir==='year'&&u.id===slot))good++}));const r=$('#result');r.className=`result ${total===list.length&&good===total?'ok':'bad'}`;r.textContent=`${good} / ${list.length}개를 알맞게 배치했습니다.`}}
  function bindDrag(){document.querySelectorAll('[data-card]').forEach(c=>{c.ondragstart=e=>e.dataTransfer.setData('text/plain',c.dataset.card)});document.querySelectorAll('[data-slot]').forEach(s=>{s.tabIndex=0;s.ondragover=e=>{e.preventDefault();s.classList.add('over')};s.ondragleave=()=>s.classList.remove('over');s.ondrop=e=>{e.preventDefault();place(e.dataTransfer.getData('text/plain'),s.dataset.slot)};s.onclick=e=>{if(e.target.closest('button')||!state.selected)return;place(state.selected,s.dataset.slot)};s.onkeydown=e=>{if(e.key==='Enter'&&state.selected){e.preventDefault();place(state.selected,s.dataset.slot)}}});document.querySelectorAll('[data-select]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.selected=state.selected===b.dataset.select?null:b.dataset.select;render()})}
  function place(id,slot){Object.keys(state.placements).forEach(k=>state.placements[k]=state.placements[k].filter(x=>x!==id));state.placements[slot]=[...(state.placements[slot]||[]),id];state.selected=null;save();render()}

  function order(){let list=state.order.length?state.order:roundUnits().map(u=>u.id).sort(()=>Math.random()-.5);state.order=list;save();shell('order',`<div class="toolbar"><button id="check">순서 확인</button><button id="shuffle" class="ghost">다시 섞기</button></div><p class="prompt">실제 연대순이 아니라 <b>원본 노트에 실린 순서</b>로 배열하세요. 카드에 초점을 두고 ↑/↓로 이동할 수 있습니다.</p><div class="order-list">${list.map((id,i)=>{const u=byId.get(id);return `<div class="sort-card" tabindex="0" draggable="true" data-order="${id}"><div><strong>${esc(u.title)}</strong><small>${esc(u.lines[0]?.text||'')}</small></div><div class="card-buttons"><button class="ghost" data-up="${i}" ${i===0?'disabled':''}>↑</button><button class="ghost" data-down="${i}" ${i===list.length-1?'disabled':''}>↓</button></div></div>`}).join('')}<div id="result"></div></div>`);document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>moveOrder(Number(b.dataset.up),-1));document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>moveOrder(Number(b.dataset.down),1));document.querySelectorAll('[data-order]').forEach(c=>{c.ondragstart=e=>e.dataTransfer.setData('text/plain',c.dataset.order);c.onkeydown=e=>{if(e.target!==c)return;if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const i=state.order.indexOf(c.dataset.order),d=e.key==='ArrowUp'?-1:1;if(i+d>=0&&i+d<state.order.length)moveOrder(i,d,c.dataset.order)}};c.ondragover=e=>e.preventDefault();c.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain'),from=state.order.indexOf(id),to=state.order.indexOf(c.dataset.order);state.order.splice(from,1);state.order.splice(to,0,id);save();render()}});$('#check').onclick=()=>{const expected=[...state.order].sort((a,b)=>byId.get(a).sourceIndex-byId.get(b).sourceIndex),good=state.order.filter((id,i)=>id===expected[i]).length,r=$('#result');r.className=`result ${good===expected.length?'ok':'bad'}`;r.textContent=`${good} / ${expected.length}개가 원본 위치와 일치합니다.`};$('#shuffle').onclick=()=>{state.order=[...state.order].sort(()=>Math.random()-.5);save();render()}}
  function moveOrder(i,d,focusId){const j=i+d;[state.order[i],state.order[j]]=[state.order[j],state.order[i]];save();render();if(focusId)requestAnimationFrame(()=>$(`[data-order="${focusId}"]`)?.focus())}

  const pairNames=[['국내 비밀 결사와 의병','의열 투쟁'],['이봉창 의거','윤봉길 의거'],['제1차 미소 공동 위원회','제2차 미소 공동 위원회'],['발췌 개헌','사사오입 개헌'],['봉오동 전투','청산리 대첩']];
  function compare(){const pairs=pairNames.map(names=>names.map(n=>units.find(u=>u.title===n))).filter(p=>p.every(Boolean)),pair=pairs[modeIndex('compare')%pairs.length]||[current(),units[current().sourceIndex+1]||units[0]];shell('compare',`<p class="prompt">관련 사건의 원문 표현을 나란히 보고 공통점과 차이를 기억하세요.</p><div class="compare"><section class="surface">${paperSurface(pair[0]).replace(/^<section class="surface">|<\/section>$/g,'')}<div class="answer"><label>${esc(pair[0].title)} 메모<textarea data-compare="${pair[0].id}">${esc(state.drafts[draftKey('compare',pair[0])]||'')}</textarea></label></div></section><section class="surface">${paperSurface(pair[1]).replace(/^<section class="surface">|<\/section>$/g,'')}<div class="answer"><label>${esc(pair[1].title)} 메모<textarea data-compare="${pair[1].id}">${esc(state.drafts[draftKey('compare',pair[1])]||'')}</textarea></label></div></section></div>${navigation('compare')}`);document.querySelectorAll('[data-compare]').forEach(a=>a.oninput=()=>{state.drafts[draftKey('compare',byId.get(a.dataset.compare))]=a.value;save()});bindNav('compare');resizePapers()}

  function render(){const mode=pathMode();if(location.pathname==='/coach/recap')coachRecap();else if(location.pathname==='/coach'||location.pathname==='/review')coach();else if(!mode||!modes[mode])home();else if(mode==='memorize')memorize();else if(mode==='recall')recall();else if(mode==='blanks'||mode==='stages')clozeMode(mode);else if(mode==='questions')questions();else if(mode==='timeline')timeline();else if(mode==='order')order();else compare();document.onkeydown=e=>{if(e.isComposing)return;if(e.altKey&&e.key==='ArrowLeft'){$('[data-prev]')?.click();e.preventDefault()}else if(e.altKey&&e.key==='ArrowRight'){$('[data-next]')?.click();e.preventDefault()}else if(mode==='memorize'&&e.target===document.body&&(e.key==='Enter'||e.key==='ArrowRight')){$('[data-next]')?.click();e.preventDefault()}else if(mode==='memorize'&&e.target===document.body&&e.key==='ArrowLeft'){$('[data-prev]')?.click();e.preventDefault()}};requestAnimationFrame(resizePapers)}
  addEventListener('popstate',()=>{attempt={revealed:false,checked:false,hint:false};render()});addEventListener('resize',resizePapers);render();
})();
