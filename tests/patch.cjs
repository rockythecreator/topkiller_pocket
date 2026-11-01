const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = process.env.TEST_ROOT || path.resolve(__dirname, '..');
let missing = false, slow = false, mathError = false, otherRelease = false;
const server = http.createServer(async (req, res) => {
  const relative = new URL(req.url, 'http://localhost').pathname.replace(/^\/topkiller_pocket\//, '') || 'index.html';
  try {
    if (relative === 'js/app.js' && missing) { res.writeHead(404).end(); return; }
    if (relative === 'js/app.js' && slow) await new Promise(r => setTimeout(r, 1500));
    let data = await fs.readFile(path.join(root, relative));
    if (relative === 'sw.js' && otherRelease) data = Buffer.from(data.toString().replace(/const VERSION = '[^']+'/, "const VERSION = 'v9.0.0'"));
    if (relative === 'js/math.js' && mathError) data = Buffer.from(data.toString().replace('export function simulate(homeLambda, awayLambda) {', 'export function simulate(homeLambda, awayLambda) { throw new RangeError("regression mathematical failure");'));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.webmanifest') ? 'application/manifest+json' : relative.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({executablePath: '/usr/bin/chromium', headless:true});
  const base = `http://127.0.0.1:${server.address().port}/topkiller_pocket/`;
  let failures = 0;
  async function test(name, fn) {
    const context = await browser.newContext();
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    try { await fn(page, context); console.log('PASS', name); }
    catch(e) { failures++; console.error('FAIL', name, e.message); }
    finally { missing=false; slow=false; mathError=false; otherRelease=false; await context.close(); }
  }
  try {
    await test('404 cache vuota, errore accessibile, riprova e impostazioni preservate', async (p,c) => {
      await c.addInitScript(() => localStorage.setItem('topkiller-pocket:v0.1', JSON.stringify({homeName:'Persistito',awayName:'Ospite',homeLambda:2,awayLambda:1})));
      missing=true; await p.goto(base);
      await p.getByRole('alert').filter({hasText:'Il simulatore non è stato caricato'}).waitFor();
      missing=false; await p.getByRole('button',{name:'Riprova',exact:true}).click();
      await p.waitForSelector('#matrix tbody td');
      assert.equal(await p.locator('#home-name').inputValue(),'Persistito');
    });
    await test('caricamento lento senza falso errore e slider accessibili', async p => {
      slow=true; await p.goto(base,{waitUntil:'commit'});
      await p.waitForTimeout(500); assert.equal(await p.getByRole('alert').isVisible(),false);
      await p.waitForSelector('#matrix tbody td');
      assert.equal(await p.getByRole('slider',{name:'Gol attesi squadra casa',exact:true}).count(),1);
      assert.equal(await p.getByRole('slider',{name:'Gol attesi squadra ospite',exact:true}).count(),1);
    });
    await test('errore matematico resta osservabile', async p => {
      const errors=[]; p.on('pageerror',e=>errors.push(e.message)); mathError=true;
      await p.goto(base); await p.waitForTimeout(500);
      assert(errors.some(e=>e.includes('regression mathematical failure')));
      assert.equal(await p.locator('#matrix tbody td').count(),0);
    });
    await test('cache incompleta online riparata automaticamente senza reload successivo', async p => {
      await p.goto(base); await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
      await p.evaluate(async()=>{ for(const key of await caches.keys()) if(key.startsWith('topkiller-pocket-shell-')) await (await caches.open(key)).delete('/topkiller_pocket/js/app.js'); });
      await p.reload(); await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
      assert(await p.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('topkiller-pocket-shell-')); return !!await (await caches.open(key)).match('/topkiller_pocket/js/app.js');}));
    });
    await test('recupero rifiutato se il server distribuisce una versione diversa', async p => {
      await p.goto(base); await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
      await p.evaluate(async()=>{ for(const key of await caches.keys()) if(key.startsWith('topkiller-pocket-shell-')) await (await caches.open(key)).delete('/topkiller_pocket/js/app.js'); });
      otherRelease=true;
      await p.evaluate(()=>window.dispatchEvent(new Event('online')));
      await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('incompleta'));
      assert.equal(await p.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('topkiller-pocket-shell-')); return !!await (await caches.open(key)).match('/topkiller_pocket/js/app.js');}),false);
    });
    for (const online of [true,false]) await test(`cache incompleta ${online?'online: recupero':'offline: errore e riconnessione'}`, async (p,c) => {
      await p.goto(base); await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
      await p.locator('#home-name').fill('Salvato');
      await p.evaluate(async()=>{ for(const key of await caches.keys()) if(key.startsWith('topkiller-pocket-shell-')) await (await caches.open(key)).delete('/topkiller_pocket/js/app.js'); });
      if(!online) await c.setOffline(true);
      else missing=true;
      await p.reload();
      await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('incompleta'));
      assert(! (await p.locator('#offline-status').innerText()).includes('App pronta'));
      if(!online) await p.getByRole('alert').waitFor();
      missing=false; await c.setOffline(false);
      await p.evaluate(()=>window.dispatchEvent(new Event('online')));
      await p.waitForFunction(()=>!document.querySelector('#offline-status').textContent.includes('incompleta'));
      await p.reload(); await p.waitForSelector('#matrix tbody td');
      await p.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
      assert.equal(await p.locator('#home-name').inputValue(),'Salvato');
      await c.setOffline(true); await p.reload(); await p.waitForSelector('#matrix tbody td');
    });
    await test('versione package interfaccia e cache', async p => {
      assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).version,'0.3.0');
      await p.goto(base); assert.equal(await p.locator('.version').innerText(),'V0.3.0');
      assert.match(await fs.readFile(path.join(root,'sw.js'),'utf8'), /const VERSION = 'v0\.3\.0'/);
    });
  } finally { await browser.close(); server.close(); process.exitCode=failures?1:0; }
});
