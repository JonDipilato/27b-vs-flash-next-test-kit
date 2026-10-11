// Grader for the three web-page jobs (2, 4, 6). Text jobs 1, 3, 5 are graded by hand (see README.md).
// Usage: node grade.mjs [folder]   (default: outputs)
import { chromium } from 'playwright';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

const D = resolve(process.argv[2] || 'outputs');
if (!existsSync(D)) { console.error(`Folder not found: ${D}`); process.exit(1); }
const cents = s => { const m = (s || '').replace(/[^0-9.\-]/g, ''); return m === '' ? NaN : Math.round(parseFloat(m) * 100); };
const results = {};
const browser = await chromium.launch();

async function open(file) {
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(500);
  return { page, errs };
}
const txt = (page, sel) => page.locator(sel).first().innerText({ timeout: 2000 }).catch(() => null);

// ---- Job 2: invoice fix (checks = the three asks in TASK.md + nothing broke)
{
  const f = `${D}/2-invoice-fix.html`, r = { checks: {}, notes: [] };
  if (!existsSync(f)) r.notes.push('no output file');
  else {
    const pristine = readFileSync(resolve(HERE, 'invoice-original.html'), 'utf8');
    const fixed = readFileSync(f, 'utf8');
    const style = s => (s.match(/<style[\s\S]*?<\/style>/i) || [''])[0].replace(/\s+/g, ' ');
    r.checks.css_unchanged = style(pristine) === style(fixed);
    r.checks.file_complete = /<\/html>\s*$/i.test(fixed.trim());
    const { page, errs } = await open(f);
    r.checks.seed_thousands_separator = (await page.locator('#grid').first().innerText().catch(() => '')).includes('$24,500.00');
    // Bug 1: huge discount
    await page.click('#clearAll').catch(e => r.notes.push('clearAll: ' + e.message));
    await page.click('#addBtn').catch(e => r.notes.push('addBtn: ' + e.message));
    const nums = page.locator('#grid').first().locator('input[type=number]');
    if (await nums.count() >= 3) {
      await nums.nth(0).fill('1'); await nums.nth(1).fill('3200'); await nums.nth(2).fill('99999');
      const st = cents(await txt(page, '#subtotal')), tot = cents(await txt(page, '#total'));
      const gridText = await page.locator('#grid').first().innerText();
      r.checks.bug1_never_negative = st >= 0 && tot >= 0 && !gridText.includes('-$') && !gridText.includes('$-');
      r.notes.push(`bug1 subtotal=${await txt(page, '#subtotal')} total=${await txt(page, '#total')}`);
      // Bug 2: 3 x 33.335 at 8.25%
      await nums.nth(0).fill('3'); await nums.nth(1).fill('33.335'); await nums.nth(2).fill('0');
      await page.fill('#taxRate', '8.25');
      const s = await txt(page, '#subtotal'), t = await txt(page, '#taxAmount'), g = await txt(page, '#total');
      r.checks.bug2_adds_up = cents(s) + cents(t) === cents(g);
      r.notes.push(`bug2 ${s} + ${t} = ${g}`);
    } else r.notes.push('could not find qty/price/discount inputs after Add Line Item');
    r.checks.no_console_errors = errs.length === 0;
    if (errs.length) r.notes.push(...errs.slice(0, 3));
    await page.close();
  }
  results['2-invoice-fix'] = r;
}

// ---- Job 4: estimate calculator (exact ids given in the prompt)
{
  const f = `${D}/4-estimate-calculator.html`, r = { checks: {}, notes: [] };
  if (!existsSync(f)) r.notes.push('no output file');
  else {
    const { page, errs } = await open(f);
    const ids = ['hours', 'rate', 'materials', 'markup', 'tax', 'labor', 'subtotal', 'markupAmount', 'taxAmount', 'total'];
    const missing = [];
    for (const id of ids) if (await page.locator('#' + id).count() === 0) missing.push(id);
    r.checks.all_ids_present = missing.length === 0;
    if (missing.length) r.notes.push('missing ids: ' + missing.join(','));
    const out = async () => Object.fromEntries(await Promise.all(['labor', 'subtotal', 'markupAmount', 'taxAmount', 'total'].map(async k => [k, await txt(page, '#' + k)])));
    const run = async (vals, expect, name) => {
      try {
        for (const [k, v] of Object.entries(vals)) await page.fill('#' + k, v);
        await page.waitForTimeout(200);
        const o = await out();
        r.checks[name] = Object.entries(expect).every(([k, v]) => (o[k] || '').includes(v));
        r.notes.push(`${name}: ` + JSON.stringify(o));
      } catch (e) { r.checks[name] = false; r.notes.push(`${name} error: ${e.message.slice(0, 120)}`); }
    };
    await run({ hours: '10', rate: '75', materials: '500', markup: '20', tax: '6.25' },
      { labor: '$750.00', subtotal: '$1,250.00', markupAmount: '$250.00', taxAmount: '$93.75', total: '$1,593.75' }, 'caseA_math_live');
    await run({ hours: '8', rate: '62.5', materials: '1234.56', markup: '15', tax: '0' },
      { labor: '$500.00', subtotal: '$1,734.56', markupAmount: '$260.18', taxAmount: '$0.00', total: '$1,994.74' }, 'caseB_rounding_adds_up');
    try {
      for (const k of ['hours', 'rate', 'materials', 'markup', 'tax']) await page.fill('#' + k, '');
      await page.waitForTimeout(200);
      r.checks.empty_no_NaN = !(await page.locator('body').innerText()).includes('NaN');
    } catch (e) { r.checks.empty_no_NaN = false; }
    r.checks.no_console_errors = errs.length === 0;
    if (errs.length) r.notes.push(...errs.slice(0, 3));
    await page.screenshot({ path: `${D}/4-estimate-calculator.png`, fullPage: true });
    await page.close();
  }
  results['4-estimate-calculator'] = r;
}

// ---- Job 6: snake game (exact ids given in the prompt)
{
  const f = `${D}/6-snake-game.html`, r = { checks: {}, notes: [] };
  if (!existsSync(f)) r.notes.push('no output file');
  else {
    const { page, errs } = await open(f);
    const missing = [];
    for (const id of ['game', 'score', 'restart', 'status']) if (await page.locator('#' + id).count() === 0) missing.push(id);
    r.checks.all_ids_present = missing.length === 0;
    if (missing.length) r.notes.push('missing ids: ' + missing.join(','));
    const status = async () => (await txt(page, '#status')) || '';
    r.checks.starts_playing = /playing/i.test(await status());
    r.checks.score_starts_0 = /^\D*0\D*$/.test((await txt(page, '#score')) || 'x');
    // steer with arrow keys for 4 s, then drive into the wall
    const before = await page.screenshot({ path: `${D}/6-snake-game.png` });
    for (let i = 0; i < 8; i++) { await page.keyboard.press(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'][i % 4]); await page.waitForTimeout(500); }
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(6000);
    r.checks.game_over_on_wall = /game over/i.test(await status());
    r.notes.push(`status after wall run: ${await status()}, score: ${await txt(page, '#score')}`);
    await page.click('#restart').catch(e => r.notes.push('restart: ' + e.message.slice(0, 80)));
    await page.waitForTimeout(300);
    r.checks.restart_resets = /playing/i.test(await status()) && /^\D*0\D*$/.test((await txt(page, '#score')) || 'x');
    r.checks.no_console_errors = errs.length === 0;
    if (errs.length) r.notes.push(...errs.slice(0, 3));
    await page.close();
  }
  results['6-snake-game'] = r;
}

await browser.close();
writeFileSync(resolve(D, `grades-${basename(D)}.json`), JSON.stringify(results, null, 1));
for (const [k, r] of Object.entries(results)) {
  const c = Object.values(r.checks), p = c.filter(Boolean).length;
  console.log(`${k}: ${p}/${c.length}`, JSON.stringify(r.checks));
  r.notes.forEach(n => console.log('   ', n.slice(0, 220)));
}
