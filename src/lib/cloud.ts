import type { CloudEvent, Grade, Question, Rating } from '../types/domain';

const CODE_KEY = 'history-access-code';

export function accessCode(): string | null { return localStorage.getItem(CODE_KEY) }
export function setAccessCode(code: string) { localStorage.setItem(CODE_KEY, code) }

type CloudBody =
  | { type: 'attempt'; question: Question & { source?: string; scope?: string }; answer: string }
  | { type: 'rating'; attemptId: string; rating: Rating }
  | { type: 'reviewed'; questionId: string | number; pointIndex: number };

interface CloudResult { events?: CloudEvent[]; event?: CloudEvent; grade?: Grade; aiError?: string; error?: string }

/**
 * Call the study Function. A 401 clears the stored code so the access panel reappears.
 * Errors carry the server's Korean message, which the UI shows verbatim.
 */
export async function cloud(method: 'GET' | 'POST' = 'GET', body?: CloudBody): Promise<CloudResult> {
  const code = accessCode();
  if (!code) throw new Error('접속 코드를 입력해 주세요.');
  const response = await fetch('/api/study', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-study-code': code },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result: CloudResult = await response.json().catch(() => ({ error: '서버 응답을 읽을 수 없습니다.' }));
  if (response.status === 401) localStorage.removeItem(CODE_KEY);
  if (!response.ok) throw new Error(result.error || '클라우드에 연결하지 못했습니다.');
  return result;
}

/** The append-only study log, fetched once per session and appended to locally by `record`. */
let cloudEvents: CloudEvent[] | null = null;

export function events(): CloudEvent[] | null { return cloudEvents }
export function record(event: CloudEvent) { if (cloudEvents) cloudEvents.push(event) }

export async function loadCloud(): Promise<CloudEvent[]> {
  const result = await cloud();
  cloudEvents = result.events || [];
  return cloudEvents;
}
