// 브라우저 회귀 검사. QA_REPORT.md의 동작 목록을 자동으로 확인합니다.
//
//   npm run build
//   node test-browser-server.mjs &     # dist를 서비스하고 /api/study를 흉내냅니다
//   npm run test:browser
//
// playwright-core는 브라우저를 내려받지 않습니다. 없으면 먼저 설치하세요:
//   npx -y playwright@latest install chromium
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8771';

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = join(process.env.HOME || '', os.platform() === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root).filter(d => d.startsWith('chromium')).sort().reverse();
  for (const d of dirs) {
    for (const rel of ['chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
      const exe = join(root, d, rel);
      if (existsSync(exe)) return exe;
    }
  }
  if (os.platform() === 'darwin') {
    const dirs = readdirSync(root).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse();
    for (const d of dirs) {
      const exe = join(root, d, `chrome-headless-shell-${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}`, 'chrome-headless-shell');
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

const EXE = chromiumPath();
if (!EXE) {
  console.error('Chromium을 찾지 못했습니다. `npx -y playwright@latest install chromium` 후 다시 실행하세요.');
  process.exit(2);
}

let chromium;
try { ({ chromium } = await import('playwright-core')) }
catch { console.error('playwright-core가 없습니다. `npm i -D playwright-core` 후 다시 실행하세요.'); process.exit(2) }

const fails = [], errors = [];
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' :: ' + extra}`); if (!ok) fails.push(name); };

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

const goto = async p => { await page.goto(BASE + p, { waitUntil: 'networkidle' }); };

// 1. home
await goto('/');
check('home hero', await page.locator('.hero h1').isVisible());
check('home mode cards = 9', await page.locator('.mode-grid .mode-card').count() === 9);
check('home order card renamed', await page.locator('.mode-card').filter({ hasText: '순서 맞추기' }).count() === 1);
check('home set label', (await page.locator('.set-copy strong').textContent()).includes('세트'));

// 2. every mode renders via direct URL + refresh
for (const [mode, sel] of [['memorize', '.memorize-note'], ['recall', '#answer'], ['blanks', '[data-cloze]'],
  ['stages', '#stage'], ['quiz', '.question-card'], ['timeline', '.year-slot'], ['order', '[data-order]'], ['compare', '[data-compare]']]) {
  await goto('/study/' + mode);
  check(`direct /study/${mode}`, await page.locator(sel).first().isVisible().catch(() => false));
  await page.reload({ waitUntil: 'networkidle' });
  check(`reload /study/${mode}`, await page.locator(sel).first().isVisible().catch(() => false));
}

// 3. progress is per-mode and persists
await goto('/study/blanks');
await page.locator('[data-next]').click();
check('blanks 2/10', (await page.locator('.progress').textContent()).startsWith('2 / 10'));
await goto('/study/quiz');
check('quiz progress independent', (await page.locator('.progress').textContent()).startsWith('1 / '));
await goto('/study/blanks');
check('blanks progress kept 2/10', (await page.locator('.progress').textContent()).startsWith('2 / 10'));

// 4. per-card drafts stay separate
await goto('/study/recall');
await page.locator('#answer').fill('A 카드 전용');
await page.locator('[data-next]').click();
check('next card draft empty', await page.locator('#answer').inputValue() === '');
await page.locator('[data-prev]').click();
check('prev card draft kept', await page.locator('#answer').inputValue() === 'A 카드 전용');

// 5. cloze: Enter moves to next input, value persists, peek hides on focus
await goto('/study/blanks');
const inputs = page.locator('[data-cloze]');
const n = await inputs.count();
check('blanks has inputs', n > 1, String(n));
await inputs.nth(0).click();
await inputs.nth(0).fill('테스트');
await inputs.nth(0).press('Enter');
check('Enter moves to 2nd blank', await inputs.nth(1).evaluate(e => e === document.activeElement));
await page.locator('#reveal').click();
check('peek shown', await page.locator('.cloze-wrap.peek').first().isVisible());
await inputs.nth(0).click();
check('peek hidden on focus', await page.locator('.cloze-wrap.peek').count() === 0);
await page.reload({ waitUntil: 'networkidle' });
check('cloze draft persisted', await page.locator('[data-cloze]').first().inputValue() === '테스트');

// 5b. Korean IME: composing must not commit early, and Enter mid-composition must not jump
await goto('/study/blanks');
{
  const cdp = await page.context().newCDPSession(page);
  const first = page.locator('[data-cloze]').first();
  await first.click();
  await first.evaluate(e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await cdp.send('Input.imeSetComposition', { text: '\u1100', selectionStart: 0, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '\uAC00', selectionStart: 0, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '\uAC10', selectionStart: 0, selectionEnd: 1 });
  check('IME composition text visible', await first.inputValue() === '\uAC10', await first.inputValue());
  // Enter while still composing must be swallowed, leaving focus put
  await page.keyboard.press('Enter');
  check('IME Enter mid-composition keeps focus', await first.evaluate(e => e === document.activeElement));
  await cdp.send('Input.insertText', { text: '\uAC10' });
  check('IME commit keeps one syllable', await first.inputValue() === '\uAC10', await first.inputValue());
  await page.reload({ waitUntil: 'networkidle' });
  check('IME text persisted to draft', await page.locator('[data-cloze]').first().inputValue() === '\uAC10', await page.locator('[data-cloze]').first().inputValue());
}

// 6. stages slider
await goto('/study/stages');
const before = await page.locator('[data-cloze]').count();
await page.locator('#stage').fill('5');
const after = await page.locator('[data-cloze]').count();
check('stage 5 reveals more blanks', after > before, `${before} -> ${after}`);

// 7. keyboard Alt+Arrow
await goto('/study/questions');
const p0 = await page.locator('.progress').textContent();
await page.locator('body').press('Alt+ArrowRight');
check('Alt+Right advances', (await page.locator('.progress').textContent()) !== p0);
await page.locator('body').press('Alt+ArrowLeft');
check('Alt+Left goes back', (await page.locator('.progress').textContent()) === p0);

// 8. memorize bare arrows
await goto('/study/memorize');
const m0 = await page.locator('.progress').textContent();
await page.locator('body').press('ArrowRight');
check('memorize ArrowRight', (await page.locator('.progress').textContent()) !== m0);

// 9. order mode keyboard move
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  const selected = window.HISTORY_DATA.units.filter(u => String(u.topic) === '1');
  s.topic = '1'; s.count = 6; s.setIndex = 1; s.session = selected.slice(6, 12).map(u => u.id); s.order = [];
  localStorage.setItem('history-v2', JSON.stringify(s));
});
await goto('/study/order');
check('order page renamed', await page.locator('.study-head h1').textContent() === '순서 맞추기');
const cumulativeExpected = await page.evaluate(() => Math.min(12, window.HISTORY_DATA.units.filter(u => String(u.topic) === '1').length));
check('order includes learned sets through current set', await page.locator('[data-order]').count() === cumulativeExpected);
const firstId = await page.locator('[data-order]').first().getAttribute('data-order');
await page.locator('[data-order]').nth(1).focus();
await page.locator('[data-order]').nth(1).press('ArrowUp');
check('order ArrowUp moves card', (await page.locator('[data-order]').first().getAttribute('data-order')) !== firstId);
await page.locator('#check').click();
check('order score gives live complete feedback', await page.locator('#result[role="status"]').isVisible() && (await page.locator('#result').textContent()).includes('개'));
const scoredMatches = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  const sourceIds = window.HISTORY_DATA.units.filter(u => String(u.topic) === '1').slice(0, 12).map(u => u.id);
  return s.order.filter((id, index) => id === sourceIds[index]).length;
});
check('order score uses source-note order', (await page.locator('#result').textContent()).startsWith(`${scoredMatches} / ${cumulativeExpected}개`));
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  s.order = window.HISTORY_DATA.units.filter(u => String(u.topic) === '1').slice(0, 12).map(u => u.id);
  localStorage.setItem('history-v2', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.locator('#check').click();
check('order perfect score confirms completion', (await page.locator('#result').textContent()).includes('모두 맞혔습니다!'));
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  s.topic = 'all'; s.count = 10; s.setIndex = 0; s.session = window.HISTORY_DATA.units.slice(0, 10).map(u => u.id); s.order = [];
  localStorage.setItem('history-v2', JSON.stringify(s));
});

// 10. timeline select + place
await goto('/study/timeline');
const trayBefore = await page.locator('.tray [data-card]').count();
await page.locator('.tray [data-select]').first().click();
await page.locator('.year-slot').first().click();
check('timeline place reduces tray', await page.locator('.tray [data-card]').count() === trayBefore - 1, String(trayBefore));

// 10b. previous-set recap keeps its eight questions and adds labeled fusion questions
await goto('/study/quiz');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  s.setIndex = 1; s.session = []; s.indices = { ...s.indices, questions: 0 };
  localStorage.setItem('history-v2', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
const currentTotal = Number((await page.locator('.quiz-context strong').textContent()).split('/')[1].trim());
await page.evaluate(total => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  s.indices.questions = total + 8;
  localStorage.setItem('history-v2', JSON.stringify(s));
}, currentTotal);
await page.reload({ waitUntil: 'networkidle' });
check('previous-set fusion has explicit label', await page.locator('.quiz-context.recap').isVisible() && await page.locator('.question-card .kicker').textContent().then(t => t.trim() === '융합'));
check('fusion adds to previous-set recap count', Number((await page.locator('.quiz-context strong').textContent()).split('/')[1].trim()) > 8);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('history-v2'));
  s.setIndex = 0; s.session = []; s.indices = { ...s.indices, questions: 0 };
  localStorage.setItem('history-v2', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });

// 11. quiz full cloud flow with access code
await page.evaluate(() => localStorage.setItem('history-access-code', 'browser-test'));
await goto('/study/quiz');
// deliberately weak answer first, so the coach has gaps to recap
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.locator('#answer').fill('잘 모르겠습니다');
await page.locator('#answer').press('Enter');
await page.waitForFunction(() => document.querySelector('#cloudStatus')?.textContent === '저장 완료 · AI 채점 중');
check('saved then grading status', await page.locator('#cloudStatus').textContent().then(t => t === '저장 완료 · AI 채점 중'));
check('progress bar respects reduced motion', await page.locator('.quiz-progress').evaluate(e => getComputedStyle(e.querySelector('i')).animationName === 'none'));
check('progress status is accessible', await page.locator('#cloudStatus').getAttribute('role') === 'status');
await page.waitForSelector('#retryGrade', { timeout: 10000 });
check('grading failure offers retry', await page.locator('#retryGrade').isVisible());
const attemptsAfterFailure = await page.evaluate(async () => (await (await fetch('/__test-counts')).json()).attempts);
await page.locator('#retryGrade').click();
await page.waitForSelector('.point-results', { timeout: 10000 });
check('same-attempt retry does not save again', await page.evaluate(async () => (await (await fetch('/__test-counts')).json()).attempts) === attemptsAfterFailure);
check('weak answer marked missing', await page.locator('.point-result.missing').count() > 0);
check('AI flags unclear or inaccurate phrasing briefly', await page.locator('.ai-writing-note').isVisible());
await page.locator('#review').click();
await page.waitForTimeout(400);
await page.locator('#answer').fill('정답을 설명합니다');
await page.locator('#check').click();
await page.waitForSelector('.point-results', { timeout: 10000 });
check('quiz AI grade rendered', await page.locator('.ai-grade').isVisible());
check('quiz point results', await page.locator('.point-result').count() > 0);
await page.locator('#known').click();
await page.waitForTimeout(500);
check('quiz advances after rating', (await page.locator('.progress').textContent()).startsWith('3 / '));

// 12. coach
await goto('/coach');
await page.waitForSelector('.coach-summary', { timeout: 10000 });
check('coach summary', await page.locator('.coach-summary').isVisible());
check('coach topic matrix', await page.locator('.topic-cell').count() > 0);
const dataVersion = page.locator('label.field select').first();
check('coach current version is v6', await dataVersion.inputValue() === '6');
check('coach keeps previous versions', await dataVersion.locator('option').count() === 5);
await dataVersion.selectOption('3');
check('coach can inspect v3 history', await dataVersion.inputValue() === '3');
await dataVersion.selectOption('4');
await page.locator('[data-tab="covered"]').click();
check('coach tab switch', await page.locator('[data-tab="covered"]').getAttribute('aria-selected') === 'true');
await page.locator('[data-tab="gaps"]').click();
{
  const cell = page.locator('.topic-cell').first();
  const topic = Number(await cell.getAttribute('data-topic'));
  const expected = await page.evaluate(async topic => {
    const bundle = await (await fetch('/api/study?dataset=active')).json();
    return bundle.questions.filter(q => Number(q.topic) === topic);
  }, topic);
  await cell.click();
  check('topic disclosure accessible and expanded', await cell.getAttribute('aria-expanded') === 'true' && Boolean(await cell.getAttribute('aria-controls')));
  check('topic disclosure lists every current question', await page.locator('.topic-questions .topic-question').count() === expected.length);
  check('topic disclosure includes assigned fusion questions', await page.locator('.topic-questions [data-kind="융합"]').count() === expected.filter(q => q.kind === '융합').length);
  check('topic question state labels are defined', await page.locator('.topic-question .point-pill').evaluateAll(nodes => nodes.every(node => ['미학습', '미채점', '완료', '보완 필요'].includes(node.textContent.trim()))));
  await cell.click();
  check('topic disclosure collapses', await cell.getAttribute('aria-expanded') === 'false' && !(await page.locator('.topic-questions').isVisible()));
}

// 13. /review alias
await goto('/review');
await page.waitForSelector('.coach-summary', { timeout: 10000 });
check('/review renders coach', await page.locator('.coach-summary').isVisible());

// 14. coach recap
await goto('/coach');
await page.waitForSelector('.coach-summary', { timeout: 10000 });
if (await page.locator('#startRecap').isEnabled()) {
  await page.locator('#startRecap').click();
  await page.waitForSelector('.question-card', { timeout: 5000 });
  check('coach recap card', await page.locator('.quiz-context').textContent().then(t => t.includes('보완 리캡')));
  check('coach recap url', page.url().endsWith('/coach/recap'));
} else check('coach recap start enabled', false, 'no gaps recorded');

// 14b. compare memos persist per card
await goto('/study/compare');
{
  const memos = page.locator('[data-compare]');
  await memos.first().fill('비교 메모');
  await page.reload({ waitUntil: 'networkidle' });
  check('compare memo persisted', await page.locator('[data-compare]').first().inputValue() === '비교 메모');
  check('compare shows two papers', await page.locator('.compare .paper').count() === 2);
}

// 14c. recall grading and reveal
await goto('/study/recall');
await page.locator('#answer').fill('틀린 답');
await page.locator('#check').click();
check('recall wrong answer flagged', await page.locator('#result.bad').isVisible());
await page.locator('#reveal').click();
check('recall reveal shows 원문', await page.locator('.paper .line').first().isVisible());

// 14d. stage level persists across reload
await goto('/study/stages');
await page.locator('#stage').fill('4');
await page.reload({ waitUntil: 'networkidle' });
check('stage level persisted', await page.locator('#stage').inputValue() === '4');

// 14e. coach filters
await goto('/coach');
await page.waitForSelector('.coach-summary', { timeout: 10000 });
{
  const all = await page.locator('.coach-list .coach-point').count();
  await page.locator('[data-tab="legacy"]').click();
  check('coach legacy tab renders', await page.locator('[data-tab="legacy"]').getAttribute('aria-selected') === 'true');
  await page.locator('[data-tab="gaps"]').click();
  const cell = page.locator('.topic-cell').first();
  await cell.click();
  check('topic filter marks cell active', (await cell.getAttribute('class')).includes('active'));
  const filtered = await page.locator('.coach-list .coach-point, .coach-empty').count();
  check('topic filter narrows list', filtered <= Math.max(all, 1), `${all} -> ${filtered}`);
  await cell.click();
  check('topic filter toggles off', !(await cell.getAttribute('class')).includes('active'));
  check('coach export button present', await page.locator('#exportLog').isVisible());
}

// 15. mobile width, no horizontal overflow
for (const w of [1440, 1024, 768, 390, 320]) {
  await page.setViewportSize({ width: w, height: 800 });
  await goto('/study/blanks');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no h-overflow @${w}`, over <= 1, String(over));
  const scaled = await page.evaluate(() => { const p = document.querySelector('.paper'); return p ? getComputedStyle(p).transform : 'none'; });
  check(`paper scaled @${w}`, scaled !== 'none' && scaled !== '');
}
await page.setViewportSize({ width: 1280, height: 900 });

for (const w of [390, 320]) {
  await page.setViewportSize({ width: w, height: 800 });
  for (const [path, title] of [['/', '.hero h1'], ['/coach', '.coach-head h1'], ['/study/order', '.study-head h1']]) {
    await goto(path);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`responsive ${path} no overflow @${w}`, over <= 1, String(over));
    check(`responsive ${path} title visible @${w}`, await page.locator(title).isVisible());
  }
}
await page.setViewportSize({ width: 1280, height: 900 });

// 16. reset clears local state
await goto('/study/recall');
await page.locator('#answer').fill('지워질 값');
page.once('dialog', d => d.accept());
await goto('/');
await page.locator('#reset').click();
await page.waitForTimeout(300);
await goto('/study/recall');
check('reset cleared drafts', await page.locator('#answer').inputValue() === '');

// 17. localStorage shape unchanged
const shape = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('history-v2') || '{}')).sort().join(','));
check('localStorage key shape', shape === 'blankSeed,coachIndex,coachRound,count,drafts,indices,order,placements,progress,questionVersion,selected,session,setIndex,stage,timelineDirection,topic', shape);
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('history-v2'));
  state.questionVersion = 5;
  state.indices = { ...state.indices, questions: 7, memorize: 2 };
  state.progress = { ...state.progress, 'recall:t01-e01-u01': 'known' };
  state.drafts = { ...state.drafts, 'recall:t01-e01-u01': 'kept across question update' };
  localStorage.setItem('history-v2', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => JSON.parse(localStorage.getItem('history-v2') || '{}').questionVersion === 6);
const upgraded = await page.evaluate(() => JSON.parse(localStorage.getItem('history-v2')));
check('quiz index resets on data version change', upgraded.indices.questions === 0);
check('other mode progress survives data version change', upgraded.indices.memorize === 2 && upgraded.progress['recall:t01-e01-u01'] === 'known');
check('draft survives data version change', upgraded.drafts['recall:t01-e01-u01'] === 'kept across question update');

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : `\nALL PASS`);
process.exit(fails.length ? 1 : 0);
