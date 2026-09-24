import type { PoolQuestion, Question, Unit } from '../types/domain';

export function unitQuestion(u: Unit, detail = false): Question {
  const specific: Record<string, string> = {
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
    let prompt: string;
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

/** Everything `questionPool` needs from the session/state layer, injected so it stays pure. */
export interface PoolContext {
  questionBank: Question[];
  byId: Map<string, Unit>;
  state: Pick<import('../types/domain').StudyState, 'session' | 'setIndex' | 'count'>;
  filtered: () => Unit[];
  buildSession: () => void;
}

/**
 * The quiz for the current set: up to 20 questions drawn from the question bank first,
 * then generated per unit, followed by up to 8 recap questions sampled evenly from every
 * earlier set. Bank questions are only used when all of their refs are inside the set.
 */
export function questionPool(ctx: PoolContext): PoolQuestion[] {
  const { questionBank, byId, state, filtered, buildSession } = ctx;
  if(!state.session.length)buildSession();
  const all=filtered(),current=state.session.map(id=>byId.get(id)).filter(Boolean) as Unit[],ids=new Set(state.session);
  const target=Math.min(20,Math.max(10,current.length));
  const main=questionBank.filter(q=>q.refs.every(id=>ids.has(id))).slice(0,target);
  const covered=new Set(main.flatMap(q=>q.refs));
  for(const u of current.filter(u=>!covered.has(u.id))){if(main.length>=target)break;main.push(unitQuestion(u))}
  for(const u of current.filter(u=>u.lines.some(line=>line.text.includes(':'))).concat(current.filter(u=>!u.lines.some(line=>line.text.includes(':'))))){if(main.length>=target)break;main.push(unitQuestion(u,true))}
  for(const u of current.filter(u=>covered.has(u.id))){if(main.length>=target)break;main.push(unitQuestion(u))}
  const prior=all.slice(0,state.setIndex*Number(state.count)),priorIds=new Set(prior.map(u=>u.id)),used=new Set<string|number>();
  const recap=Array.from({length:Math.min(8,prior.length)},(_,i)=>prior[Math.floor((i+.5)*prior.length/Math.min(8,prior.length))]).map(u=>{
    const picked=questionBank.find(q=>!used.has(q.id)&&q.refs.includes(u.id)&&q.refs.every(id=>priorIds.has(id)))||unitQuestion(u);
    used.add(picked.id);return picked;
  });
  const source=(q: Question)=>q.refs.map(id=>{const u=byId.get(id)!,i=all.findIndex(item=>item.id===id),size=Number(state.count);return i<0?'':`${Math.floor(i/size)+1}세트 ${i%size+1}번째 카드 · 주제 ${u.topic} ${u.title}`}).filter(Boolean).join(' / ');
  const pool: PoolQuestion[]=main.map(q=>({...q,scope:'current' as const,source:source(q),groupCount:main.length}));
  return pool.concat(recap.map(q=>({...q,scope:'recap' as const,source:source(q),groupCount:recap.length})));
}
