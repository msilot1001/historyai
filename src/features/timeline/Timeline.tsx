import { useState } from 'react';
import { byId } from '../../lib/data.ts';
import { roundUnits, save, state } from '../../lib/state.ts';
import { yearText } from '../../lib/text.ts';
import { StudyShell } from '../../components/StudyShell.tsx';
import { useRefresh } from '../../app/store.ts';
import type { IndexedUnit } from '../../types/domain';

interface CardProps { id: string; label: string; detail: string; selected: boolean; onSelect: () => void }

/** Draggable in both directions, with a 선택 button so keyboard and touch have a path too. */
function SortCard({ id, label, detail, selected, onSelect }: CardProps) {
  return (
    <div
      className={selected ? 'sort-card selected' : 'sort-card'}
      draggable data-card={id} tabIndex={0}
      onDragStart={e => e.dataTransfer.setData('text/plain', id)}
    >
      <strong>{label}</strong>
      <small>{detail}</small>
      <div className="card-buttons">
        <button className="ghost" data-select={id} onClick={e => { e.stopPropagation(); onSelect() }}>선택</button>
      </div>
    </div>
  );
}

export function Timeline() {
  const refresh = useRefresh();
  const [result, setResult] = useState<{ good: number; total: number; ok: boolean } | null>(null);
  const list = roundUnits().filter(u => yearText(u));
  const dir = state.timelineDirection;
  const placed = new Set(Object.values(state.placements).flat());
  const pool = list.filter(u => !placed.has(dir === 'event' ? u.id : `year:${u.id}`));

  const place = (id: string, slot: string) => {
    Object.keys(state.placements).forEach(k => { state.placements[k] = state.placements[k].filter(x => x !== id) });
    state.placements[slot] = [...(state.placements[slot] || []), id];
    state.selected = null;
    save(); refresh();
  };
  const slotProps = (slot: string) => ({
    'data-slot': slot, tabIndex: 0,
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add('over') },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove('over'),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); place(e.dataTransfer.getData('text/plain'), slot) },
    onClick: (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('button') || !state.selected) return; place(state.selected, slot) },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' && state.selected) { e.preventDefault(); place(state.selected, slot) } },
  });
  const select = (id: string) => { state.selected = state.selected === id ? null : id; refresh() };
  const cardOf = (u: IndexedUnit) => dir === 'event'
    ? { id: u.id, label: u.title, detail: u.lines[0]?.text || '' }
    : { id: `year:${u.id}`, label: yearText(u), detail: u.lines[0]?.text || '' };

  const check = () => {
    let total = 0, good = 0;
    Object.entries(state.placements).forEach(([slot, ids]) => ids.forEach(id => {
      total++;
      const u = byId.get(id.replace('year:', ''));
      if (u && ((dir === 'event' && yearText(u) === slot) || (dir === 'year' && u.id === slot))) good++;
    }));
    setResult({ good, total, ok: total === list.length && good === total });
  };

  return (
    <StudyShell mode="timeline" total={state.session.length}>
      <div className="toolbar">
        <button id="direction" className="secondary" onClick={() => {
          state.timelineDirection = dir === 'event' ? 'year' : 'event';
          state.placements = {}; state.selected = null; save(); setResult(null); refresh();
        }}>{dir === 'event' ? '사건 → 연도' : '연도 → 사건'}</button>
        <button id="resetRound" className="ghost" onClick={() => {
          state.placements = {}; state.selected = null; save(); setResult(null); refresh();
        }}>현재 라운드 초기화</button>
        <button id="check" onClick={check}>배치 확인</button>
      </div>
      <div className="board">
        <section className="surface tray">
          <h2>배치할 카드</h2>
          <div className="cards">
            {pool.length ? pool.map(u => {
              const c = cardOf(u);
              return <SortCard key={c.id} {...c} selected={state.selected === c.id} onSelect={() => select(c.id)} />;
            }) : <p className="meta">모든 카드를 배치했습니다.</p>}
          </div>
        </section>
        <section className="surface slots">
          <h2>{dir === 'event' ? '연도 자리' : '사건 자리'}</h2>
          {dir === 'event'
            ? [...new Set(list.map(yearText))].map(y => (
              <section className="year-slot" key={y} {...slotProps(y)}>
                <h3>{y}</h3>
                {(state.placements[y] || []).map(id => {
                  const u = byId.get(id);
                  return u ? <SortCard key={id} {...cardOf(u)} selected={state.selected === id} onSelect={() => select(id)} /> : null;
                })}
              </section>
            ))
            : list.map(u => (
              <section className="year-slot" key={u.id} {...slotProps(u.id)}>
                <h3>{u.title}</h3>
                {(state.placements[u.id] || []).map(id => {
                  const real = byId.get(id.replace('year:', ''));
                  return real ? <SortCard key={id} id={id} label={yearText(real)} detail="" selected={state.selected === id} onSelect={() => select(id)} /> : null;
                })}
              </section>
            ))}
          <div id="result" className={result ? `result ${result.ok ? 'ok' : 'bad'}` : undefined}>
            {result && `${result.good} / ${list.length}개를 알맞게 배치했습니다.`}
          </div>
        </section>
      </div>
    </StudyShell>
  );
}
