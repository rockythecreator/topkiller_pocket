/* Real browser integration: no changes to production files during update tests. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let version = 'v0.3.0'; let failAsset = false;
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/other/') { res.end('unrelated'); return; }
  if (!pathname.startsWith('/topkiller_pocket/')) { res.writeHead(404).end(); return; }
  const relative = pathname.slice('/topkiller_pocket/'.length) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || (failAsset && relative === 'icons/icon-512.png')) { res.writeHead(404).end(); return; }
  try {
    let data = await fs.readFile(file);
    if (relative === 'sw.js') data = Buffer.from(data.toString().replace('v0.3.0', version));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
async function ready(page) {
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}));
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForSelector('#matrix tbody td');
}
let base;
server.listen(0, '127.0.0.1', async () => {
  let browser;
  const timeout = setTimeout(() => { console.error('PWA test timeout'); process.exit(1); }, 60000);
  try {
    base = `http://127.0.0.1:${server.address().port}/topkiller_pocket/`;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    const context = await browser.newContext(); let page = await context.newPage();
    await ready(page);
    await page.waitForFunction(() => document.getElementById('offline-status').textContent.includes('pronta'));
    const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
    assert.equal(manifest.scope, '/topkiller_pocket/'); assert.equal(manifest.start_url, manifest.scope);
    assert.equal(manifest.display, 'standalone');
    assert.equal(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL), new URL('sw.js', base).href);
    for (const [file, size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
      const data = await fs.readFile(path.join(root,'icons',file));
      assert.equal(data.subarray(1,4).toString(),'PNG');
      assert.equal(data.readUInt32BE(16),size); assert.equal(data.readUInt32BE(20),size);
    }
    const keys = await page.evaluate(async () => (await (await caches.open('topkiller-pocket-shell-v0.3.0')).keys()).map(r => new URL(r.url).pathname));
    assert.equal(keys.length, 16); assert(keys.every(k => k.startsWith('/topkiller_pocket/')));
    await page.evaluate(() => caches.open('unrelated-cache').then(c => c.put('/other/', new Response('keep'))));
    await page.locator('#home-name').fill('Scenario offline');
    await context.setOffline(true);
    await page.close(); page = await context.newPage(); await ready(page);
    assert.equal(await page.locator('#home-name').inputValue(), 'Scenario offline');
    assert.match(await page.locator('#outcomes').innerText(), /45,13%/);
    await page.locator('#home-lambda').evaluate(el => { el.value='3.5'; el.dispatchEvent(new Event('input')); });
    await page.reload(); assert.equal(await page.locator('#home-lambda').inputValue(),'3.5');
    await context.setOffline(false); await page.reload();
    console.log('PASS manifest, PNG icons, scoped registration, complete shell, offline reopen, slider persistence, reconnection');
    version = 'v0.3.1'; failAsset = true;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration(); await reg.update();
      const worker = reg.installing;
      if (worker) await new Promise(resolve => worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); }));
    });
    assert(await page.evaluate(() => caches.has('topkiller-pocket-shell-v0.3.0')));
    assert.equal(await page.evaluate(() => caches.has('topkiller-pocket-shell-v0.3.1')),false);
    failAsset = false; version = 'v0.3.2';
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration(); await reg.update();
      if (!reg.waiting) await new Promise(resolve => reg.installing.addEventListener('statechange', () => { if (reg.waiting) resolve(); }));
    });
    assert(await page.evaluate(() => caches.has('topkiller-pocket-shell-v0.3.0')));
    await page.waitForFunction(() => document.getElementById('offline-status').textContent.includes('Aggiornamento pronto'));
    await page.close(); page = await context.newPage(); await ready(page);
    await page.waitForFunction(async () => !(await caches.has('topkiller-pocket-shell-v0.3.0')));
    assert(await page.evaluate(() => caches.has('topkiller-pocket-shell-v0.3.2')));
    assert(await page.evaluate(() => caches.has('unrelated-cache')));
    assert.equal(await page.locator('#home-name').inputValue(),'Scenario offline');
    const other = await context.newPage(); await other.goto(new URL('/other/',base).href);
    assert.equal(await other.evaluate(() => navigator.serviceWorker.controller),null);
    await context.setOffline(true); await page.reload(); await page.waitForSelector('#matrix tbody td');
    await page.locator('#mc-volume').selectOption('1000');
    await page.locator('#mc-start').click();
    await page.waitForFunction(() => document.querySelector('#mc-status').textContent.includes('completato'));
    assert.equal(await page.locator('#mc-results > .mc-row').count(),14);
    console.log('PASS Monte Carlo simulation offline with cached module worker');
    console.log('PASS failed update preserves old shell; successful update activates, removes old cache, preserves settings/unrelated cache; outside scope uncontrolled; updated shell offline');
    await context.close();
  } catch (error) { console.error(error); process.exitCode=1; }
  finally { clearTimeout(timeout); if(browser) await browser.close(); server.close(); }
});
