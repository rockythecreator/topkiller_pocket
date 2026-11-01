const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root=path.resolve(__dirname,'..');
const baseline='7dfccfa1c2c4ea96a61e6473429c779a93a98cf5';
let oldRelease=false;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/topkiller_pocket/')){res.writeHead(404).end();return;}
  const relative=url.pathname.slice('/topkiller_pocket/'.length)||'index.html';
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try {
    const data=oldRelease?execFileSync('git',['show',`${baseline}:${relative}`],{cwd:root,stdio:['ignore','pipe','ignore']}):await fs.readFile(file);
    const ext=path.extname(file);res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'})[ext]||'application/octet-stream');res.end(data);
  }catch{res.writeHead(404).end();}
});
server.listen(0,'127.0.0.1',async()=>{
  let browser;const timeout=setTimeout(()=>{console.error('MC browser timeout');process.exit(1);},120000);
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
    const base=`http://127.0.0.1:${server.address().port}/topkiller_pocket/`;
    const context=await browser.newContext();const page=await context.newPage();
    const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
    await page.goto(base);await page.waitForSelector('#matrix tbody td');
    // Controller adversarial cases use injected transports; production UI stays crypto-only.
    const controls=await page.evaluate(async()=>{
      const {startExecution}=await import('./js/mc-ui.js');
      const {createExperiment}=await import('./js/monte-carlo.js');
      const config={runId:73,lambdaCasa:1.45,lambdaOspite:1.1,N:1000,mode:'seeded',seed:42};
      const experiment=createExperiment(config);experiment.step(1000);const expected=JSON.stringify(experiment.result);
      async function execute(workerFactory,startupTimeout=50){
        return new Promise((resolve,reject)=>{
          const modes=[],progress=[];
          startExecution(config,{workerFactory,startupTimeout,onProgress:n=>progress.push(n),onMode:m=>modes.push(m),onError:reject,onComplete:r=>resolve({same:JSON.stringify(r)===expected,modes,progress})});
        });
      }
      const actual=await execute(()=>new Worker('./js/mc-worker.js',{type:'module'}),2000);
      const missing=await execute(()=>{throw new Error('Worker unavailable');});
      const loadError=await execute(()=>{const w={terminate(){},postMessage(){}};setTimeout(()=>w.onerror({preventDefault(){}}),0);return w;});
      const timeout=await execute(()=>({terminate(){},postMessage(){}}));
      const partial=await execute(()=>{const w={terminate(){},postMessage(){w.onmessage({data:{type:'progress',runId:73,completed:500}});w.onerror({preventDefault(){}});}};setTimeout(()=>w.onmessage({data:{type:'ready'}}),0);return w;});
      const obsolete=await execute(()=>{
        const w={terminate(){},postMessage(){
          w.onmessage({data:{type:'complete',runId:72,result:{}}});
          w.onmessage({data:{type:'progress',runId:72,completed:999}});
          setTimeout(()=>w.onmessage({data:{type:'complete',runId:73,result:experiment.result}}),0);
        }};setTimeout(()=>w.onmessage({data:{type:'ready'}}),0);return w;
      });
      let cancelledCompletion=false;
      const cancel=startExecution({...config,N:100000},{workerFactory:()=>{throw new Error('unavailable');},onProgress(){},onError(){},onComplete(){cancelledCompletion=true;}});cancel.cancel();
      await new Promise(r=>setTimeout(r,30));
      return {actual,missing,loadError,timeout,partial,obsolete,cancelledCompletion};
    });
    for(const key of ['actual','missing','loadError','timeout','partial','obsolete'])assert.equal(controls[key].same,true,key);
    assert.deepEqual(controls.actual.modes,['worker']);
    assert.deepEqual(controls.timeout.modes,['fallback']);
    assert.deepEqual(controls.partial.progress.slice(0,2),[500,0]);
    assert(!controls.obsolete.progress.includes(999));assert.equal(controls.cancelledCompletion,false);
    console.log('PASS real seeded worker = fallback = engine; construction/load/ack timeout/partial restart; stale messages ignored; fallback cancelled');
    for(const width of [320,390,393,430,1440]){
      await page.setViewportSize({width,height:852});
      assert.equal(await page.locator('#mc-volume').inputValue(),'10000');
      await page.locator('#mc-volume').selectOption('1000');await page.locator('#mc-start').click();
      await page.waitForFunction(()=>document.querySelector('#mc-status').textContent.includes('completato'));
      assert.equal(await page.locator('#mc-results > .mc-row').count(),14);
      assert.match(await page.locator('#mc-results > .mc-row').nth(9).innerText(),/1–1/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
      assert((await page.locator('#mc-start').boundingBox()).height>=48);
      const before=await page.locator('#mc-results').innerText();await page.locator('#home-name').fill('Nome cambiato');
      assert.equal(await page.locator('#mc-results').innerText(),before);assert.match(await page.locator('#mc-snapshot').innerText(),/Nome cambiato/);
      await page.locator('#reset').click();assert.equal(await page.locator('#mc-results').innerText(),'');
      await page.locator('#mc-volume').selectOption('10000');
    }
    await page.locator('#mc-volume').selectOption('100000');
    await page.locator('#mc-start').click();
    const cancelStart=performance.now();await page.locator('#mc-cancel').click();
    assert.match(await page.locator('#mc-status').innerText(),/annullato/);
    const cancellationMs=performance.now()-cancelStart;
    await page.waitForTimeout(600);assert.equal(await page.locator('#mc-results').innerText(),'');
    await page.locator('#mc-start').click();
    await page.locator('#home-lambda').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForTimeout(600);assert.equal(await page.locator('#mc-results').innerText(),'');assert.match(await page.locator('#mc-status').innerText(),/Lambda modificati/);
    assert.equal(await page.locator('#home-name').inputValue(),'Squadra Casa');
    await page.reload();assert.equal(await page.locator('#home-lambda').inputValue(),'2');
    await page.locator('#mc-start').click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.match(await page.locator('#mc-status').innerText(),/background/);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.locator('#mc-results').innerText(),'');
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('PASS 5 viewports, theoretical priority, >=48px button, names, cancel, lambda/reset invalidation, persistence, background cancellation, no external requests');
    // Fresh context forces the actual UI down the fallback path.
    const fallbackContext=await browser.newContext();
    await fallbackContext.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('disabled for test');}};});
    const fp=await fallbackContext.newPage();await fp.goto(base);await fp.waitForSelector('#matrix tbody td');
    await fp.locator('#mc-volume').selectOption('1000');await fp.locator('#mc-start').click();
    await fp.waitForFunction(()=>document.querySelector('#mc-status').textContent.includes('completato'));
    await fp.locator('#mc-volume').selectOption('100000');await fp.locator('#mc-start').click();await fp.locator('#mc-cancel').click();
    assert.match(await fp.locator('#mc-status').innerText(),/annullato/);await fallbackContext.close();
    const failureContext=await browser.newContext();
    await failureContext.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('worker unavailable');}};Object.defineProperty(crypto,'getRandomValues',{value(){throw new Error('entropy failure');}});});
    const failurePage=await failureContext.newPage();await failurePage.goto(base);await failurePage.waitForSelector('#matrix tbody td');
    await failurePage.locator('#mc-start').click();await failurePage.waitForFunction(()=>document.querySelector('#mc-status').textContent.includes('entropy failure'));
    assert.equal(await failurePage.locator('#mc-results').innerText(),'');
    await failurePage.locator('#home-lambda').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await failurePage.locator('#home-value').innerText(),'2,00');
    await failureContext.close();console.log('PASS entropy failure produces no fake percentages; Poisson still interactive');
    // Measure full UI work, including result rendering, for both execution paths.
    const measurements=[];
    for(const fallback of [false,true]) for(const lambda of [null,3.5]){
      const c=await browser.newContext();if(fallback)await c.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('test fallback');}};});
      const p=await c.newPage();await p.goto(base);await p.waitForSelector('#matrix tbody td');
      const measurement=await p.evaluate(async(lambda)=>{
        const longTasks=[],gaps=[];let last;
        const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push(e.duration);});observer.observe({type:'longtask'});
        if(lambda!==null) for(const id of ['home-lambda','away-lambda']){const el=document.getElementById(id);el.value=String(lambda);el.dispatchEvent(new Event('input',{bubbles:true}));}
        const status=document.querySelector('#mc-status');
        const progress=new MutationObserver(()=>{if(document.querySelector('#mc-progress').value>0){const now=performance.now();if(last)gaps.push(now-last);last=now;}});progress.observe(document.querySelector('#mc-progress'),{attributes:true,attributeFilter:['value']});
        document.querySelector('#mc-volume').value='100000';
        const start=performance.now();document.querySelector('#mc-start').click();
        await new Promise(resolve=>{const o=new MutationObserver(()=>{if(status.textContent.includes('completato')){o.disconnect();resolve();}});o.observe(status,{childList:true});});
        const elapsed=performance.now()-start;await new Promise(r=>setTimeout(r,100));observer.disconnect();progress.disconnect();
        return {elapsedMs:elapsed,longTasksMs:longTasks,progressGapsMs:gaps};
      },lambda);measurements.push({path:fallback?'fallback':'worker',scenario:lambda===null?'1.45/1.10':'3.50/3.50',...measurement});await c.close();
    }
    console.log('MEASUREMENTS',JSON.stringify({cancellationMs,measurements}));
    // True upgrade: serve the Git baseline first, then current sources on the same origin.
    oldRelease=true;const upgradeContext=await browser.newContext();let up=await upgradeContext.newPage();await up.goto(base);
    await up.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
    assert.equal(await up.locator('.version').innerText(),'V0.2.1');await up.locator('#home-name').fill('Scenario V0.2.1');
    oldRelease=false;
    await up.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await up.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Aggiornamento pronto'));
    await up.close();up=await upgradeContext.newPage();await up.goto(base);
    await up.waitForFunction(()=>document.querySelector('.version').textContent==='V0.3.0');
    await up.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('App pronta'));
    assert.equal(await up.locator('#home-name').inputValue(),'Scenario V0.2.1');
    assert.equal(await up.evaluate(()=>caches.has('topkiller-pocket-shell-v0.2.1')),false);
    assert.equal(await up.evaluate(()=>caches.has('topkiller-pocket-shell-v0.3.0')),true);
    await upgradeContext.setOffline(true);await up.close();up=await upgradeContext.newPage();await up.goto(base);
    await up.locator('#mc-volume').selectOption('1000');await up.locator('#mc-start').click();
    await up.waitForFunction(()=>document.querySelector('#mc-status').textContent.includes('completato'));
    assert.equal(await up.locator('#home-name').inputValue(),'Scenario V0.2.1');
    console.log('PASS actual V0.2.1 -> V0.3 update, old cache removed, settings preserved, reopen and simulate offline');
    await upgradeContext.close();await context.close();
  }catch(error){console.error(error);process.exitCode=1;}
  finally{clearTimeout(timeout);if(browser)await browser.close();server.close();}
});
