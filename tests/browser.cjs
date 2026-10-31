/* Development-only browser checks. Requires Playwright, never loaded by the app. */
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/topkiller_pocket/')) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(url.pathname.slice('/topkiller_pocket/'.length)) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(content);
  });
});
async function run(engine, name) {
  const browser = await engine.launch({ headless: true, ...(name === 'Chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    for (const width of [320, 390, 430, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage(); const errors = []; const external = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:')) external.push(req.url()); });
      const url = `http://127.0.0.1:${server.address().port}/topkiller_pocket/`;
      await page.goto(url);
      await page.waitForSelector('#matrix tbody td');
      assert.equal(await page.locator('#matrix tbody td').count(), 36);
      assert.equal(await page.locator('#top-scores li').count(), 5);
      assert.match(await page.locator('#outcomes').innerText(), /45,13%/);
      assert.match(await page.locator('#top-scores li').first().innerText(), /1–1\s+12,45%/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      await page.locator('#home-name').fill('<img src=x onerror=alert(1)>');
      assert.match(await page.locator('#match-title').innerText(), /<img/);
      assert.equal(await page.locator('#match-title img').count(), 0);
      await page.locator('#home-lambda').evaluate(el => { el.value = '3.50'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.locator('#away-lambda').evaluate(el => { el.value = '0.20'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      assert.equal(await page.locator('#home-value').innerText(), '3,50');
      await page.reload(); await page.waitForSelector('#matrix tbody td');
      assert.equal(await page.locator('#home-lambda').inputValue(), '3.5');
      assert.equal(await page.locator('#away-lambda').inputValue(), '0.2');
      assert.match(await page.locator('#home-name').inputValue(), /<img/);
      await page.locator('#reset').click();
      assert.equal(await page.locator('#home-name').inputValue(), 'Squadra Casa');
      assert.equal(await page.locator('#away-name').inputValue(), 'Squadra Ospite');
      assert.equal(await page.locator('#home-lambda').inputValue(), '1.45');
      assert.equal(await page.locator('#away-lambda').inputValue(), '1.1');
      await page.reload(); await page.waitForSelector('#matrix tbody td');
      assert.equal(await page.locator('#home-lambda').inputValue(), '1.45');
      await page.locator('footer').scrollIntoViewIfNeeded();
      const notice = await page.locator('.disclaimer').boundingBox();
      assert.ok(notice.y >= 0 && notice.y + notice.height <= 844);
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
      if (name === 'Chromium' && width === 390) await page.screenshot({ path: path.join(root, 'work/mobile.png'), fullPage: true });
      console.log(`PASS ${name} ${width}px: rendering, slider, storage, reset, etichetta fissa, nessuna richiesta esterna`);
      await context.close();
    }
    const context = await browser.newContext();
    await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/topkiller_pocket/`);
    await page.waitForSelector('#matrix tbody td');
    assert.match(await page.locator('#storage-status').innerText(), /non disponibile/);
    await page.locator('#reset').click();
    console.log(`PASS ${name}: browser con localStorage bloccato`);
    await context.close();
  } finally { await browser.close(); }
}
server.listen(0, '127.0.0.1', async () => {
  try {
    await run(chromium, 'Chromium');
    if (process.env.TEST_WEBKIT === '1') await run(webkit, 'WebKit');
    else console.log('NON ESEGUITO WebKit: impostare TEST_WEBKIT=1 dopo aver installato il browser.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); }
});
