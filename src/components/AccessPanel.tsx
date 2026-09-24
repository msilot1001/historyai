import { useRef } from 'react';
import { setAccessCode } from '../lib/cloud.ts';

/** First-run panel for the cloud access code. The code only ever lives in this browser. */
export function AccessPanel({ onReady }: { onReady: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const submit = () => {
    const code = input.current?.value.trim();
    if (!code) { input.current?.focus(); return }
    setAccessCode(code);
    onReady();
  };
  return (
    <div className="access-panel">
      <label className="field">클라우드 접속 코드
        <input
          id="accessCode" ref={input} type="password" autoComplete="off" placeholder="처음 한 번만 입력"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        />
      </label>
      <button id="saveCode" onClick={submit}>연결하기</button>
      <small>이 기기에만 코드가 저장됩니다. 퀴즈 답안은 클라우드에 보관됩니다.</small>
    </div>
  );
}
