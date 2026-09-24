import type { Candidate, ClozeTarget, Line, Unit } from '../types/domain';
import { yearText } from './text.ts';

/**
 * Rank every phrase in one source line by how worth hiding it is.
 * Scores are ordinal only: 130 (원문 강조) > 125 (인명) > 121 (단체·사건) > 118 (콜론 뒤 값)
 * > 112·110 (짧은 라벨·직함 뒤 이름) > 94 (연도·수치) > 86·80·70 (일반 어구).
 * `targets()` treats >= 86 as "핵심어" when picking a random blank.
 */
export function clozeCandidates(line: Line): Candidate[] {
  const source = line.text, found: Candidate[] = [];
  // ponytail: 이름 목록은 이 고정 원문에 맞춘 것. 자료가 바뀌면 원문 데이터에서 인명 태그를 제공한다.
  const people = '이승만 김원봉 김일성 이동휘 김좌진 조소앙 신채호 김규식 안창호 박상진 양세봉 김두봉 조봉암 이상설 박용만 신규식 박은식 홍범도 윤세주 박헌영 김약연 이회영 이청천 이범석 임병찬 한용운 이승훈 유관순 서재필 정칠성 박자혜 윤형숙 김향화 윤학조 이광수 신익희 최진동 김익상 김상옥 김지섭 나석주 윤봉길 민영주 오광심 조순옥 김정숙 신순호 안재홍 조만식 송진우 김성수 이시영 김상덕 노덕술 김명복 김무정 조병옥 김주열 오성원 전한승 박정희 김구 황싱 쑨원 우장춘'.split(' ');
  const action = /\s+(?:설립|정착|배출|조직|발행|담당|장악|철거|확대|변경|건립|실시|공포|주장|증가|감소|제한|반출|반입|확보|이동|시작|해결|인정|지원|참여|진압|체포|사망|순국|활동|전개|제시|계승|비판|부정|폐지|구성|수립|발각|습격|훈련|탄압|처벌|보급|강요|요구|반대|파견|귀환|취득|수탈|계획|철수|결렬|선물|논의|사퇴|고수|촉구|중단|억압|연기|희생|승리|박탈|임명|파괴|기념|편입|전락|확산|주도|강화|양성|단행|작성|보호|후원|계속|처단|결집|마련|받음|나섬|차단|부상|확인|공개|추진|가입|결성|승계|가담|돌입|무효|철폐|차별|장려|투쟁|독점|침략|점령|패배|피습|저항|기도|수감|피란|개최|이관|제정|복원)(?:\s|$)/;
  function add(start: number, value: string, score: number) {
    if (start < 0) return;
    const lead = value.match(/^\s*/)![0].length; start += lead; value = value.trim();
    value = value.replace(/[\s,.:;·→]+$/, '').trim();
    if (value.length < 2 || !/[\p{L}\p{N}]/u.test(value) || value.length > 28) return;
    if (source === value && /^(?:목적|배경|결과|특징|영향|내용)$/.test(value)) return;
    found.push({ start, end: start + value.length, answer: value, score });
  }
  for (const m of line.html.matchAll(/<b>([^<]+)<\/b>/g)) add(source.indexOf(m[1]), m[1], 130);
  for (const name of people) { let at = source.indexOf(name); while (at >= 0) { add(at, name, 125); at = source.indexOf(name, at + name.length) } }
  for (const m of source.matchAll(/[가-힣]{2,8}(?:\s+[가-힣]{2,8}){0,2}\s*(?:회|학교|강습소|정부|군정서|군단|의거|대첩|선언|사건|제도|태형령|운동|전쟁|협회|학사|총독부)/g)) add(m.index!, m[0], 121);
  for (const m of source.matchAll(/\(([^)]+)\)/g)) {
    for (const part of m[1].split(/[,·]/)) { const value = part.trim(); add(source.indexOf(value, m.index!), value, /\d/.test(value) ? 94 : 108) }
  }
  for (const m of source.matchAll(/([^→:]+):\s*([^→,]+)/g)) {
    const label = m[1].trim(), value = m[2].trim();
    add(source.indexOf(value, m.index!), value, 118);
    if (/^[가-힣]{2,4}$/.test(label)) add(source.indexOf(label, m.index!), label, label.length >= 3 ? 120 : 112);
  }
  for (const m of source.matchAll(/(?:대통령|부통령|국무총리|위원장|교수|장군|교사|총독|대표)\s+([가-힣]{2,4})/g)) add(m.index! + m[0].lastIndexOf(m[1]), m[1], 110);
  for (const m of source.matchAll(/\d{4}(?:\.\s*\d{1,2})?(?:년)?|\d+(?:\.\d+)?(?:%|만\s*원|명|채|가구)/g)) add(m.index!, m[0], 94);
  for (const m of source.matchAll(/(?:^|\s)([가-힣]{2,8})(?:을|를)(?=\s|$)/g)) add(m.index! + m[0].indexOf(m[1]), m[1], 80);
  for (const m of source.matchAll(/[^→]+/g)) {
    let chunk = m[0].trim().replace(/^[●\-\s]+/, '');
    if (!chunk) continue;
    if (!source.includes('→') && /^(?:목적|배경|결과|특징|영향|내용)$/.test(chunk)) continue;
    const originalStart = source.indexOf(chunk, m.index!);
    if (chunk.includes(':')) chunk = chunk.slice(0, chunk.indexOf(':')).trim();
    for (const part of chunk.split(',')) {
      let name = part.trim().replace(/^[“‘『]|[”’』]$/g, '');
      const verb = name.match(action); if (verb) name = name.slice(0, verb.index).trim();
      if (name.length > 24) name = name.split(/\s+/).slice(0, 3).join(' ');
      if (name.length >= 2) add(source.indexOf(name, originalStart), name, /\d|·|\(|회|군|정부|학교|위원회|의거|전투|대첩|사건|운동|혁명|촌|도|단|령|법/.test(name) ? 86 : 70);
    }
  }
  return found.sort((a, b) => b.score - a.score || a.start - b.start).filter((x, i, all) => all.findIndex(y => y.start < x.end && x.start < y.end) === i);
}

type Span = { id: string; start: number; end: number; answer: string };

/**
 * Split one long blank into several shorter ones, cutting at 특수기호 so that
 * ·, 따옴표 and 조사 stay visible in the 원문 and only 낱말이 가려진다.
 */
export function splitTarget<T extends Span>(x: T): T[] {
  const spans: Array<[number, number]> = [];
  for (const segment of x.answer.matchAll(/[\p{L}\p{N}\s]+/gu)) {
    const words = [...segment[0].matchAll(/[\p{L}\p{N}]+/gu)].filter(m => m[0].length > 1 || !/[’”']/.test(x.answer[segment.index! + m.index! - 1] || ''));
    let start = -1, end = -1;
    for (const word of words) {
      if (start >= 0 && word.index! + word[0].length - start > 9) { spans.push([segment.index! + start, segment.index! + end]); start = -1 }
      if (start < 0) start = word.index!;
      end = word.index! + word[0].length;
    }
    if (start >= 0) spans.push([segment.index! + start, segment.index! + end]);
  }
  if (spans.length === 1 && spans[0][0] === 0 && spans[0][1] === x.answer.length) return [x];
  return spans.map(([start, end]) => ({ ...x, id: `${x.id}-${start}`, start: x.start + start, end: x.start + end, answer: x.answer.slice(start, end) }));
}

/** Pick the single most quiz-worthy piece of one blank: 수치 우선, 조사 제거, 일반 동사 제외. */
export function randomKeyTarget<T extends Span>(x: T): T | undefined {
  const parts = splitTarget(x).map(part => {
    const number = part.answer.match(/\d{4}년?|\d+(?:년|명|개|원|%)/);
    if (number && part.answer.length > number[0].length + 2) { const start = part.start + number.index!; return { ...part, id: `${part.id}-number`, start, end: start + number[0].length, answer: number[0] } }
    const answer = part.answer.replace(/(?<=[가-힣]{2})(?:을|를|은|는)$/u, '');
    return { ...part, end: part.start + answer.length, answer };
  }).filter(part => part.answer.length > 1 && !/^(?:설립|조직|활동|시작|확대|강화|증가|감소|제한|교육|중심|결과|배경|영향|내용|실시|지원|참여|진압|발행|추진|요구|반대|사망|순국|이동|계속|해결|인정|보급)$/u.test(part.answer));
  return parts.sort((a, b) => Number(/(?:정부|학교|교육령|령|법|운동|사건|의거|대첩|전투|협회|군|회의|조약|제도|교육|독립|주권|국사|국어|당|단|촌|도|년|명|개|원|%)/u.test(b.answer)) - Number(/(?:정부|학교|교육령|령|법|운동|사건|의거|대첩|전투|협회|군|회의|조약|제도|교육|독립|주권|국사|국어|당|단|촌|도|년|명|개|원|%)/u.test(a.answer)) || a.start - b.start)[0];
}

/**
 * Every blank for one unit.
 * stage 1 = 가림 없음, 2~4 = 줄마다 1~3개, 5 = 연도·제목 포함 전체 가림.
 * `random` is the 랜덤 빈칸 mode: one key blank per line, rotated by `blankSeed`.
 */
export function targets(u: Unit, stage = 2, random = false, blankSeed = 0): ClozeTarget[] {
  if (stage === 1) return [];
  const out: ClozeTarget[] = [];
  u.lines.forEach((line, li) => {
    if (stage === 5) { out.push({ id: `${u.id}-${li}-all`, line: li, start: 0, end: line.text.length, answer: line.text }); return }
    const candidates = clozeCandidates(line), count = stage >= 4 ? 3 : stage >= 3 ? 2 : 1;
    const primary = candidates.filter(x => x.score >= 86);
    const first = random && primary.length ? primary[blankSeed % primary.length] : candidates[0];
    const chosen = first ? [first, ...candidates.filter(x => x !== first)].slice(0, count) : [];
    chosen.sort((a, b) => a.start - b.start).forEach(x => out.push({ id: `${u.id}-${li}-${x.start}`, line: li, start: x.start, end: x.end, answer: x.answer }));
  });
  if (stage === 5) out.unshift(
    { id: `${u.id}-year`, line: -1, answer: yearText(u), start: 0, end: yearText(u).length },
    { id: `${u.id}-title`, line: -2, answer: u.title, start: 0, end: u.title.length },
  );
  return random
    ? out.map(x => randomKeyTarget(x)).filter((x): x is ClozeTarget => Boolean(x))
    : out.flatMap(x => splitTarget(x));
}
