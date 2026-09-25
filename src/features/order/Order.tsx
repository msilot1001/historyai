import { useEffect, useState } from 'react';
import { byId } from '../../lib/data.ts';
import { filtered, save, state } from '../../lib/state.ts';
import { cumulativeOrderUnits, shuffleOrder } from '../../lib/order.ts';
import { StudyShell } from '../../components/StudyShell.tsx';
import { useRefresh } from '../../app/store.ts';

/** Cards are graded against the order they appear in the source note, not by date. */
export function Order() {
  const refresh = useRefresh();
  const [result, setResult] = useState<{ good: number; total: number } | null>(null);
  const scope = cumulativeOrderUnits(filtered(), state.setIndex, state.count);
  const scopeIds = scope.map(u => u.id);
  const scopeKey = scopeIds.join('|');

  // Seed the round once, in an effect: rendering must not mutate or persist state.
  useEffect(() => {
    if (state.order.length !== scopeIds.length || scopeIds.some(id => !state.order.includes(id))) {
      state.order = shuffleOrder(scopeIds); save(); refresh();
    }
  }, [refresh, scopeKey]);

  const list = state.order;
  const move = (i: number, d: number, focusId?: string) => {
    const j = i + d;
    if (j < 0 || j >= state.order.length) return;
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    save(); setResult(null); refresh();
    if (focusId) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-order="${focusId}"]`)?.focus());
  };

  return (
    <StudyShell mode="order" total={list.length || scopeIds.length}>
      <div className="toolbar">
        <button id="check" onClick={() => {
          const expected = [...state.order].sort((a, b) => (byId.get(a)!.sourceIndex) - (byId.get(b)!.sourceIndex));
          setResult({ good: state.order.filter((id, i) => id === expected[i]).length, total: expected.length });
        }}>순서 확인</button>
        <button id="shuffle" className="ghost" onClick={() => { state.order = shuffleOrder(state.order); save(); setResult(null); refresh() }}>다시 섞기</button>
      </div>
      <p className="prompt">첫 세트부터 현재 세트까지 익힌 카드를 <b>원본 노트에 실린 순서</b>로 배열하세요. 실제 연대순과 다를 수 있습니다. 카드에 초점을 두고 ↑/↓로 이동할 수 있습니다.</p>
      <div className="order-list">
        {list.map((id, i) => {
          const u = byId.get(id);
          if (!u) return null;
          return (
            <div
              className="sort-card" key={id} tabIndex={0} draggable data-order={id}
              onDragStart={e => e.dataTransfer.setData('text/plain', id)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dragged = e.dataTransfer.getData('text/plain');
                const from = state.order.indexOf(dragged), to = state.order.indexOf(id);
                if (from < 0 || to < 0) return;
                state.order.splice(from, 1); state.order.splice(to, 0, dragged);
                save(); setResult(null); refresh();
              }}
              onKeyDown={e => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(state.order.indexOf(id), e.key === 'ArrowUp' ? -1 : 1, id);
                }
              }}
            >
              <div><strong>{u.title}</strong><small>{u.lines[0]?.text || ''}</small></div>
              <div className="card-buttons">
                <button className="ghost" data-up={i} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="ghost" data-down={i} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              </div>
            </div>
          );
        })}
        <div id="result" role="status" aria-live="polite" className={result ? `result ${result.good === result.total ? 'ok' : 'bad'}` : undefined}>
          {result && `${result.good} / ${result.total}개 카드가 정확한 위치에 있습니다. ${result.good === result.total ? '모두 맞혔습니다!' : '다시 정렬해 보세요.'}`}
        </div>
      </div>
    </StudyShell>
  );
}
