import type { Unit } from '../types/domain';

/** HTML-escape. Still needed wherever we hand a string to dangerouslySetInnerHTML. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** The whole unit as plain text, one line per source line. */
export function text(u: Unit): string {
  return u.lines.map(x => x.text).join('\n');
}

export function yearText(u: Unit): string {
  return u.year.replace(/^●\s*/, '').trim();
}

/**
 * Normalised form used for every answer comparison: 특수기호·띄어쓰기를 제외한 글자만 비교한다.
 * `3·1 운동` and `31운동` must match; `용정촌` and `명동촌` must not.
 */
export function gradingText(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase('ko-KR');
}
