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

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8771';

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = join(process.env.HOME || '', '.cache/ms-playwright');
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root).filter(d => d.startsWith('chromium')).sort().reverse();
  for (const d of dirs) {
    for (const rel of ['chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
      const exe = join(root, d, rel);
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
await goto('/study/order');
const firstId = await page.locator('[data-order]').first().getAttribute('data-order');
await page.locator('[data-order]').nth(1).focus();
await page.locator('[data-order]').nth(1).press('ArrowUp');
check('order ArrowUp moves card', (await page.locator('[data-order]').first().getAttribute('data-order')) !== firstId);

// 10. timeline select + place
await goto('/study/timeline');
const trayBefore = await page.locator('.tray [data-card]').count();
await page.locator('.tray [data-select]').first().click();
await page.locator('.year-slot').first().click();
check('timeline place reduces tray', await page.locator('.tray [data-card]').count() === trayBefore - 1, String(trayBefore));

// 11. quiz full cloud flow with access code
await page.evaluate(() => localStorage.setItem('history-access-code', 'browser-test'));
await goto('/study/quiz');
// deliberately weak answer first, so the coach has gaps to recap
await page.locator('#answer').fill('잘 모르겠습니다');
await page.locator('#check').click();
await page.waitForSelector('.point-results', { timeout: 10000 });
check('weak answer marked missing', await page.locator('.point-result.missing').count() > 0);
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
await page.locator('[data-tab="covered"]').click();
check('coach tab switch', await page.locator('[data-tab="covered"]').getAttribute('aria-selected') === 'true');
await page.locator('[data-tab="gaps"]').click();

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

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : `\nALL PASS`);
process.exit(fails.length ? 1 : 0);
