import { DATA, byId, questionBank, units } from './src/lib/data.ts';
import { buildSession, currentUnit, draftKey, filtered, modeIndex, roundUnits, save, setStatusHandler, state } from './src/lib/state.ts';
import { esc, gradingText, text, yearText } from './src/lib/text.ts';
import { targets as clozeTargets } from './src/lib/cloze.ts';
import { questionPool as buildQuestionPool } from './src/lib/questions.ts';
import { accessCode, cloud, events as cloudEventList, loadCloud, record, setAccessCode } from './src/lib/cloud.ts';
import { learningSnapshot as snapshotOf } from './src/lib/snapshot.ts';

// ponytail: legacy view layer. All domain logic now lives in src/lib/; this file is being
// replaced feature by feature with React components and is deleted at the end of the migration.
const $=(s,r=document)=>r.querySelector(s);
let app=null;
let navigate=path=>{history.pushState({},'',path)};
let keyHandler=null;

/** Render an unported route into a container React owns. Removed with this file. */
export function mountLegacy(container,go_){app=container;navigate=go_;setStatusHandler(setStatus);attempt={revealed:false,checked:false,hint:false};render()}
export function unmountLegacy(){if(keyHandler)document.removeEventListener('keydown',keyHandler);keyHandler=null;app=null}
const current=(mode=pathMode())=>currentUnit(mode);
const targets=(u,stage,random)=>clozeTargets(u,stage,random,state.blankSeed);
const questionPool=()=>buildQuestionPool({questionBank,byId,state,filtered,buildSession});
const learningSnapshot=()=>snapshotOf(cloudEventList());
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
let attempt={revealed:false,checked:false,hint:false};
let coachTab='gaps',coachTopic='all';

function accessPanel(){return `<div class="access-panel"><label class="field">클라우드 접속 코드<input id="accessCode" type="password" autocomplete="off" placeholder="처음 한 번만 입력"></label><button id="saveCode">연결하기</button><small>이 기기에만 코드가 저장됩니다. 퀴즈 답안은 클라우드에 보관됩니다.</small></div>`}
function bindAccess(ready){const input=$('#accessCode');$('#saveCode').onclick=()=>{const code=input.value.trim();if(!code)return input.focus();setAccessCode(code);ready()};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#saveCode').click()}}}

function setStatus(t){const e=$('.status');if(e)e.textContent=t}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1700)}
function modeLength(mode){return mode==='questions'?questionPool().length:state.session.length}
function go(path){attempt={revealed:false,checked:false,hint:false};navigate(path)}
function pathMode(){const mode=location.pathname.match(/^\/study\/([^/]+)/)?.[1];return mode==='quiz'?'questions':mode}
function bindLinks(){document.querySelectorAll('[data-link]').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.getAttribute('href'))})}

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
function grade(box,expected,actual){const ok=gradingText(expected)===gradingText(actual);box.className=`result ${ok?'ok':'bad'}`;box.innerHTML=ok?'✓ 특수기호를 제외한 단어가 일치합니다.':`다시 확인할 단어가 있습니다.<br><b>원문</b><br>${esc(expected).replace(/\n/g,'<br>')}`;attempt.checked=true;return ok}

function clozeLine(line,li,list){let at=0,s='';list.filter(x=>x.line===li).sort((a,b)=>a.start-b.start).forEach(x=>{s+=esc(line.slice(at,x.start));const val=state.drafts[draftKey(pathMode(),current(),x.id)]||'';s+=`<span class="cloze-wrap"><input class="inline-input" data-cloze="${x.id}" aria-label="${list.indexOf(x)+1}번째 빈칸" autocomplete="off" spellcheck="false" value="${esc(val)}" style="width:${Math.max(28,Math.min(160,x.answer.length*13+8))}px"><span class="cloze-peek" aria-hidden="true">${esc(x.answer)}</span></span>`;at=x.end});return s+esc(line.slice(at))}
function showPeek(show){attempt.revealed=show;document.querySelectorAll('.cloze-wrap').forEach(x=>x.classList.toggle('peek',show));const b=$('#reveal');if(b){b.textContent=show?'정답 다시 가리기':'정답 살짝 보기';b.setAttribute('aria-pressed',String(show))}}
function clozeMode(mode){const u=current(),list=targets(u,mode==='stages'?state.stage:2,mode==='blanks');shell(mode,`${mode==='stages'?`<div class="toolbar stage-picker"><label>가림 단계 <input id="stage" type="range" min="1" max="5" value="${state.stage}"> <b>${state.stage}</b></label></div>`:''}<div class="workspace">${paperSurface(u,{inputs:list})}<section class="surface answer"><div class="prompt">빈칸에서 바로 입력하세요. 가운뎃점·화살표·괄호·띄어쓰기는 채점하지 않습니다. Enter/Tab은 다음 칸입니다.</div><div class="actions"><button id="check">정답 확인</button><button class="ghost" id="reveal" aria-pressed="false">정답 살짝 보기</button>${mode==='blanks'?'<button class="ghost" id="new">새 빈칸</button>':''}</div><div id="result"></div>${navigation(mode)}</section></div>`);const inputs=[...document.querySelectorAll('[data-cloze]')];inputs.forEach((inp,i)=>{const hide=()=>showPeek(false);inp.onfocus=hide;inp.oninput=()=>{hide();state.drafts[draftKey(mode,u,inp.dataset.cloze)]=inp.value;inp.classList.remove('correct','wrong');save()};inp.onkeydown=e=>{if(e.isComposing||inp.dataset.composing)return;if(e.key==='Enter'){e.preventDefault();(inputs[i+1]||$('#check')).focus();if(!inputs[i+1])$('#check').click()}};inp.oncompositionstart=()=>inp.dataset.composing='1';inp.oncompositionend=()=>delete inp.dataset.composing});$('#check').onclick=()=>{showPeek(false);let ok=true;list.forEach(x=>{const inp=$(`[data-cloze="${x.id}"]`);const good=gradingText(inp.value)===gradingText(x.answer);inp.classList.add(good?'correct':'wrong');ok&&=good});const r=$('#result');r.className=`result ${ok?'ok':'bad'}`;r.textContent=ok?'✓ 특수기호를 제외한 모든 단어가 일치합니다.':'표시된 빈칸의 단어를 다시 확인하세요.'};$('#reveal').onclick=()=>{attempt.hint=true;showPeek(!attempt.revealed)};if($('#new'))$('#new').onclick=()=>{state.blankSeed++;list.forEach(x=>delete state.drafts[draftKey(mode,u,x.id)]);save();render()};if($('#stage'))$('#stage').oninput=e=>{state.stage=Number(e.target.value);save();render()};bindNav(mode);resizePapers()}

function quizCard(q,number,total,reviewing=false){
  const key=`${reviewing?'review':'questions'}:${q.id}`;
  return `<div class="question-wrap surface question-card"><div class="quiz-context ${esc(q.scope||'review')}"><span>${reviewing?'AI 코칭 · 보완 리캡':q.scope==='current'?'현재 세트 퀴즈':'이전 세트 누적 리캡'}</span><strong>${number} / ${total}</strong></div><div class="quiz-source">${esc(q.source)}</div><div class="kicker">${esc(q.kind||'내용 확인')}</div><h2>${esc(q.q)}</h2><label class="field">내 설명<textarea id="answer" spellcheck="false" placeholder="핵심 내용을 내 말로 설명해 보세요" maxlength="2000">${esc(state.drafts[key]||'')}</textarea></label><div class="actions"><button id="check">답안 저장 · 분석</button><button class="ghost" id="hint">원문 근거 보기</button></div><div id="quizAccess" ${accessCode()?'hidden':''}>${accessPanel()}</div><p id="cloudStatus" class="cloud-status" role="status">답안을 제출하면 클라우드에 기록되고 AI가 핵심 사실별로 살펴봅니다.</p><div id="result" class="result" role="status" hidden></div><div id="selfcheck" class="actions" hidden><button id="known">확인했어요 →</button><button id="review" class="secondary">다시 볼게요 →</button></div><details class="evidence" id="evidence"><summary>원문 근거</summary>${q.refs.map(id=>byId.get(id)).filter(Boolean).map(u=>paper(u)).join('')}</details>${reviewing?'':navigation('questions')}</div>`;
}
function bindQuiz(q,next,reviewing=false){
  const key=`${reviewing?'review':'questions'}:${q.id}`,a=$('#answer'),check=$('#check');
  let lastAttemptId=null;
  bindAccess(()=>{$('#quizAccess').hidden=true;check.click()});
  a.oninput=()=>{state.drafts[key]=a.value;save()};
  a.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();check.click()}};
  check.onclick=async()=>{
    if(check.disabled)return;
    if(!accessCode()){$('#quizAccess').hidden=false;$('#accessCode').focus();return}
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
    }catch(error){$('#cloudStatus').textContent=error.message;check.disabled=false;if(!accessCode()){$('#quizAccess').hidden=false;$('#accessCode').focus()}else check.focus()}
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
  if(!accessCode()){app.innerHTML=`<section class="surface review-loading"><a class="crumb" href="/" data-link>← 학습 홈</a><h1>AI 코칭</h1><p>핵심 사실별 학습 기록을 보려면 접속 코드를 입력하세요.</p>${accessPanel()}</section>`;bindLinks();bindAccess(()=>coach());return}
  if(!cloudEventList()){app.innerHTML='<section class="surface review-loading"><h1>AI 코칭 준비 중</h1><p>클라우드 학습 기록을 불러옵니다.</p><p id="loadStatus" role="status"></p></section>';try{await loadCloud();if(location.pathname==='/coach'||location.pathname==='/review')coach();else if(location.pathname==='/coach/recap')coachRecap()}catch(error){$('#loadStatus').innerHTML=`${esc(error.message)} <button id="retryCloud">다시 연결</button>`;$('#retryCloud').onclick=coach}return}
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
  $('#exportLog').onclick=()=>{const blob=new Blob([JSON.stringify(cloudEventList(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='history-quiz-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  $('#refreshLog').onclick=async()=>{try{await loadCloud();coach();toast('기록을 새로 읽었습니다')}catch(error){toast(error.message)}};
  resizePapers();
}
function coachRecap(){
  if(!cloudEventList()){coach();return}
  const summary=learningSnapshot(),ids=state.coachRound||[],index=state.coachIndex||0;
  if(index>=ids.length||!ids.length){state.coachRound=[];state.coachIndex=0;save();go('/coach');toast('보완 리캡을 마쳤습니다. 사실별 상태를 확인해 보세요.');return}
  const q=summary.questions.get(ids[index]);if(!q){state.coachIndex++;save();coachRecap();return}
  app.innerHTML=`<header class="study-head"><div><a class="crumb" href="/coach" data-link>← AI 코칭</a><h1>보완 리캡</h1><div class="status">앞서 놓친 사실을 전체 질문에 답하며 다시 확인합니다.</div></div><div class="progress">${index+1} / ${ids.length}<i style="--p:${Math.round((index+1)/ids.length*100)}%"></i></div></header>${quizCard({...q,scope:'coach'},index+1,ids.length,true)}`;
  bindLinks();bindQuiz({...q,scope:'coach'},()=>{state.coachIndex++;save();coachRecap()},true);requestAnimationFrame(()=>$('#answer')?.focus());
}

function dragCard(u,label){return `<div class="sort-card ${state.selected===u.id?'selected':''}" draggable="true" data-card="${u.id}" tabindex="0"><strong>${esc(label||u.title)}</strong><small>${esc(u.lines[0]?.text||'')}</small><div class="card-buttons"><button class="ghost" data-select="${u.id}">선택</button></div></div>`}
function timeline(){const list=roundUnits().filter(u=>yearText(u));const dir=state.timelineDirection;const placed=new Set(Object.values(state.placements).flat());const pool=list.filter(u=>!placed.has(dir==='event'?u.id:`year:${u.id}`));let slots,cards;if(dir==='event'){cards=pool.map(u=>dragCard(u)).join('');slots=[...new Set(list.map(yearText))].map(y=>`<section class="year-slot" data-slot="${esc(y)}"><h3>${esc(y)}</h3>${(state.placements[y]||[]).map(id=>dragCard(byId.get(id))).join('')}</section>`).join('')}else{cards=pool.map(u=>dragCard({...u,id:`year:${u.id}`},yearText(u))).join('');slots=list.map(u=>`<section class="year-slot" data-slot="${u.id}"><h3>${esc(u.title)}</h3>${(state.placements[u.id]||[]).map(id=>{const real=byId.get(id.replace('year:',''));return dragCard({id},yearText(real))}).join('')}</section>`).join('')}shell('timeline',`<div class="toolbar"><button id="direction" class="secondary">${dir==='event'?'사건 → 연도':'연도 → 사건'}</button><button id="resetRound" class="ghost">현재 라운드 초기화</button><button id="check">배치 확인</button></div><div class="board"><section class="surface tray"><h2>배치할 카드</h2><div class="cards">${cards||'<p class="meta">모든 카드를 배치했습니다.</p>'}</div></section><section class="surface slots"><h2>${dir==='event'?'연도 자리':'사건 자리'}</h2>${slots}<div id="result"></div></section></div>`);bindDrag(dir);$('#direction').onclick=()=>{state.timelineDirection=dir==='event'?'year':'event';state.placements={};state.selected=null;save();render()};$('#resetRound').onclick=()=>{state.placements={};state.selected=null;save();render()};$('#check').onclick=()=>{let total=0,good=0;Object.entries(state.placements).forEach(([slot,ids])=>ids.forEach(id=>{total++;const u=byId.get(id.replace('year:',''));if((dir==='event'&&yearText(u)===slot)||(dir==='year'&&u.id===slot))good++}));const r=$('#result');r.className=`result ${total===list.length&&good===total?'ok':'bad'}`;r.textContent=`${good} / ${list.length}개를 알맞게 배치했습니다.`}}
function bindDrag(){document.querySelectorAll('[data-card]').forEach(c=>{c.ondragstart=e=>e.dataTransfer.setData('text/plain',c.dataset.card)});document.querySelectorAll('[data-slot]').forEach(s=>{s.tabIndex=0;s.ondragover=e=>{e.preventDefault();s.classList.add('over')};s.ondragleave=()=>s.classList.remove('over');s.ondrop=e=>{e.preventDefault();place(e.dataTransfer.getData('text/plain'),s.dataset.slot)};s.onclick=e=>{if(e.target.closest('button')||!state.selected)return;place(state.selected,s.dataset.slot)};s.onkeydown=e=>{if(e.key==='Enter'&&state.selected){e.preventDefault();place(state.selected,s.dataset.slot)}}});document.querySelectorAll('[data-select]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.selected=state.selected===b.dataset.select?null:b.dataset.select;render()})}
function place(id,slot){Object.keys(state.placements).forEach(k=>state.placements[k]=state.placements[k].filter(x=>x!==id));state.placements[slot]=[...(state.placements[slot]||[]),id];state.selected=null;save();render()}

function order(){let list=state.order.length?state.order:roundUnits().map(u=>u.id).sort(()=>Math.random()-.5);state.order=list;save();shell('order',`<div class="toolbar"><button id="check">순서 확인</button><button id="shuffle" class="ghost">다시 섞기</button></div><p class="prompt">실제 연대순이 아니라 <b>원본 노트에 실린 순서</b>로 배열하세요. 카드에 초점을 두고 ↑/↓로 이동할 수 있습니다.</p><div class="order-list">${list.map((id,i)=>{const u=byId.get(id);return `<div class="sort-card" tabindex="0" draggable="true" data-order="${id}"><div><strong>${esc(u.title)}</strong><small>${esc(u.lines[0]?.text||'')}</small></div><div class="card-buttons"><button class="ghost" data-up="${i}" ${i===0?'disabled':''}>↑</button><button class="ghost" data-down="${i}" ${i===list.length-1?'disabled':''}>↓</button></div></div>`}).join('')}<div id="result"></div></div>`);document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>moveOrder(Number(b.dataset.up),-1));document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>moveOrder(Number(b.dataset.down),1));document.querySelectorAll('[data-order]').forEach(c=>{c.ondragstart=e=>e.dataTransfer.setData('text/plain',c.dataset.order);c.onkeydown=e=>{if(e.target!==c)return;if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const i=state.order.indexOf(c.dataset.order),d=e.key==='ArrowUp'?-1:1;if(i+d>=0&&i+d<state.order.length)moveOrder(i,d,c.dataset.order)}};c.ondragover=e=>e.preventDefault();c.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain'),from=state.order.indexOf(id),to=state.order.indexOf(c.dataset.order);state.order.splice(from,1);state.order.splice(to,0,id);save();render()}});$('#check').onclick=()=>{const expected=[...state.order].sort((a,b)=>byId.get(a).sourceIndex-byId.get(b).sourceIndex),good=state.order.filter((id,i)=>id===expected[i]).length,r=$('#result');r.className=`result ${good===expected.length?'ok':'bad'}`;r.textContent=`${good} / ${expected.length}개가 원본 위치와 일치합니다.`};$('#shuffle').onclick=()=>{state.order=[...state.order].sort(()=>Math.random()-.5);save();render()}}
function moveOrder(i,d,focusId){const j=i+d;[state.order[i],state.order[j]]=[state.order[j],state.order[i]];save();render();if(focusId)requestAnimationFrame(()=>$(`[data-order="${focusId}"]`)?.focus())}

const pairNames=[['국내 비밀 결사와 의병','의열 투쟁'],['이봉창 의거','윤봉길 의거'],['제1차 미소 공동 위원회','제2차 미소 공동 위원회'],['발췌 개헌','사사오입 개헌'],['봉오동 전투','청산리 대첩']];
function compare(){const pairs=pairNames.map(names=>names.map(n=>units.find(u=>u.title===n))).filter(p=>p.every(Boolean)),pair=pairs[modeIndex('compare')%pairs.length]||[current(),units[current().sourceIndex+1]||units[0]];shell('compare',`<p class="prompt">관련 사건의 원문 표현을 나란히 보고 공통점과 차이를 기억하세요.</p><div class="compare"><section class="surface">${paperSurface(pair[0]).replace(/^<section class="surface">|<\/section>$/g,'')}<div class="answer"><label>${esc(pair[0].title)} 메모<textarea data-compare="${pair[0].id}">${esc(state.drafts[draftKey('compare',pair[0])]||'')}</textarea></label></div></section><section class="surface">${paperSurface(pair[1]).replace(/^<section class="surface">|<\/section>$/g,'')}<div class="answer"><label>${esc(pair[1].title)} 메모<textarea data-compare="${pair[1].id}">${esc(state.drafts[draftKey('compare',pair[1])]||'')}</textarea></label></div></section></div>${navigation('compare')}`);document.querySelectorAll('[data-compare]').forEach(a=>a.oninput=()=>{state.drafts[draftKey('compare',byId.get(a.dataset.compare))]=a.value;save()});bindNav('compare');resizePapers()}

function render(){const mode=pathMode();if(location.pathname==='/coach/recap')coachRecap();else if(location.pathname==='/coach'||location.pathname==='/review')coach();else if(mode==='memorize')memorize();else if(mode==='recall')recall();else if(mode==='blanks'||mode==='stages')clozeMode(mode);else if(mode==='questions')questions();else if(mode==='timeline')timeline();else if(mode==='order')order();else compare();if(keyHandler)document.removeEventListener('keydown',keyHandler);keyHandler=e=>{if(e.isComposing)return;if(e.altKey&&e.key==='ArrowLeft'){$('[data-prev]')?.click();e.preventDefault()}else if(e.altKey&&e.key==='ArrowRight'){$('[data-next]')?.click();e.preventDefault()}else if(mode==='memorize'&&e.target===document.body&&(e.key==='Enter'||e.key==='ArrowRight')){$('[data-next]')?.click();e.preventDefault()}else if(mode==='memorize'&&e.target===document.body&&e.key==='ArrowLeft'){$('[data-prev]')?.click();e.preventDefault()}};document.addEventListener('keydown',keyHandler);requestAnimationFrame(resizePapers)}
addEventListener('resize',resizePapers);
