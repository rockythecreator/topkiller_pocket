import { executeRun, validateRun, assertCounts, EVENTS } from './monte-carlo.js';
import { summarize } from './mc-statistics.js';
// Exported controller allows real worker/fallback tests without changing the UI's crypto mode.
export function startExecution(config, { onProgress, onComplete, onError, onMode = () => {}, workerFactory = () => new Worker(new URL('./mc-worker.js', import.meta.url), { type: 'module' }), startupTimeout = 2000 } = {}) {
  validateRun(config);
  let stopped = false, worker, timer, fallbackStarted = false, acknowledged = false;
  const stopWorker = () => { clearTimeout(timer); if(worker) { worker.terminate(); worker = null; } };
  const complete = result => {
    if (stopped) return;
    try { assertCounts(result, config.N); } catch(error) { fail(error); return; }
    stopped = true; stopWorker(); onComplete(result);
  };
  const fail = error => { if(stopped)return; stopped = true; stopWorker(); onError(error); };
  const progress = n => {
    if (!stopped && Number.isInteger(n) && n >= 0 && n <= config.N) onProgress(n);
  };
  const fallback = () => {
    if (stopped || fallbackStarted) return;
    fallbackStarted = true; stopWorker(); onMode('fallback'); progress(0);
    // Fresh experiment: never reuse partial worker counts. Macrotasks yield to rendering.
    executeRun(config, { cancelled: () => stopped, progress, blockSize: 256 })
      .then(result => { if(result)complete(result); }).catch(fail);
  };
  try {
    worker = workerFactory();
    timer = setTimeout(fallback, startupTimeout);
    worker.onmessage = event => {
      if(stopped || fallbackStarted) return;
      const data = event.data;
      if(data?.type === 'ready' && !acknowledged) {
        acknowledged = true; clearTimeout(timer); onMode('worker');
        worker.postMessage({ type: 'start', config }); return;
      }
      if (!acknowledged || data?.runId !== config.runId) return;
      if (data.type === 'progress') progress(data.completed);
      if (data.type === 'complete') complete(data.result);
      if (data.type === 'error') fail(new Error(data.message || 'Errore Monte Carlo.'));
    };
    worker.onerror = event => { event.preventDefault?.(); fallback(); };
    worker.onmessageerror = fallback;
  } catch { fallback(); }
  return { cancel() { stopped = true; stopWorker(); } };
}

const $ = id => document.getElementById(id);
if (typeof document !== 'undefined' && $('mc-panel')) {
  const percent = p => `${(p*100).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
  const labels = {home:'1 · Casa',draw:'X · Pareggio',away:'2 · Ospite',over15:'Over 1,5',under15:'Under 1,5',over25:'Over 2,5',under25:'Under 2,5',bttsYes:'BTTS sì',bttsNo:'BTTS no'};
  let serial=0, active=null, snapshot=null, final=null, lastAnnouncement=-1;
  const lambdas = () => [Number($('home-lambda').value), Number($('away-lambda').value)];
  const names = () => `${$('home-name').value || 'Squadra Casa'} / ${$('away-name').value || 'Squadra Ospite'}`;
  function busy(value) {
    $('mc-start').disabled=value; $('mc-volume').disabled=value;
    $('mc-cancel').hidden=!value; $('mc-panel').setAttribute('aria-busy',String(value));
  }
  function cancel(message) {
    serial++; active?.cancel(); active=null; busy(false);
    if(message)$('mc-status').textContent=message;
  }
  function invalidate(message) {
    cancel(message); snapshot=null; final=null; $('mc-results').replaceChildren();
    $('mc-snapshot').textContent=''; $('mc-progress').value=0; $('mc-progress-text').textContent='0%';
  }
  function showSnapshot() {
    if(snapshot)$('mc-snapshot').textContent=`${names()} · λ casa ${snapshot[0].toLocaleString('it-IT')} · λ ospite ${snapshot[1].toLocaleString('it-IT')} · ${final ? final.completed.toLocaleString('it-IT') : $('mc-volume').value} partite`;
  }
  function row(label,data) {
    const article=document.createElement('article'); article.className='mc-row';
    const heading=document.createElement('h3');heading.textContent=label;article.append(heading);
    for(const [name,value,className] of [['Poisson',data.theory,'mc-theory'],['Monte Carlo',data.frequency,'mc-sample']]) {
      const line=document.createElement('div');line.className='mc-bar-line';
      const text=document.createElement('span');text.textContent=`${name}: ${percent(value)}`;
      const bar=document.createElement('span');bar.className=`mc-bar ${className}`;bar.style.width=`${value*100}%`;bar.setAttribute('aria-hidden','true');
      line.append(text,bar);article.append(line);
    }
    const detail=document.createElement('p');detail.className='muted small';
    const diff=data.difference.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'always'});
    detail.textContent=`Differenza: ${diff} punti percentuali · IC Wilson 95%: ${percent(data.interval[0])} – ${percent(data.interval[1])} · Conteggio: ${data.count}`;
    article.append(detail);return article;
  }
  function render(result) {
    const summary=summarize(result,...snapshot),container=$('mc-results');container.replaceChildren();
    for(const key of EVENTS)container.append(row(labels[key],summary.events[key]));
    const title=document.createElement('h3');title.textContent='Risultati esatti · primi cinque scelti dal modello Poisson';container.append(title);
    for(const score of summary.scores.filter(s=>s.priority))container.append(row(score.key.replace(':','–'),score));
    const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Tutti gli altri risultati osservati (anche oltre 5 gol)';details.append(heading);
    for(const score of summary.scores.filter(s=>!s.priority))details.append(row(score.key.replace(':','–'),score));
    container.append(details);
  }
  $('mc-start').addEventListener('click', () => {
    invalidate(); const runId=++serial; snapshot=lambdas();showSnapshot();busy(true);lastAnnouncement=-1;
    const config={runId,lambdaCasa:snapshot[0],lambdaOspite:snapshot[1],N:Number($('mc-volume').value),mode:'crypto'};
    $('mc-progress').max=config.N;$('mc-status').textContent='Avvio dell’esperimento…';
    try {
      active=startExecution(config, {
        onMode(mode){if(runId===serial)$('mc-status').textContent=mode==='fallback'?'Calcolo a blocchi sul dispositivo. Eventuali conteggi precedenti sono stati scartati.':'Calcolo in corso nel worker.';},
        onProgress(n){
          if(runId!==serial)return;
          $('mc-progress').value=n;const p=Math.floor(100*n/config.N);$('mc-progress-text').textContent=`${p}%`;
          const decile=Math.floor(p/10);
          if(decile>lastAnnouncement){lastAnnouncement=decile;$('mc-status').textContent=`Esperimento in corso: ${p}%.`;}
        },
        onComplete(result){
          if(runId!==serial)return;
          active=null;final=result;busy(false);showSnapshot();render(result);
          $('mc-status').textContent=`Esperimento completato: ${result.completed.toLocaleString('it-IT')} partite.`;
        },
        onError(error){if(runId!==serial)return;active=null;busy(false);final=null;$('mc-results').replaceChildren();$('mc-status').textContent=`Esperimento non riuscito: ${error.message} Il simulatore Poisson resta disponibile.`;},
      });
    } catch(error) {busy(false);$('mc-status').textContent=`Esperimento non avviato: ${error.message}`;}
  });
  $('mc-cancel').addEventListener('click',()=>invalidate('Esperimento annullato. Nessun risultato parziale presentato.'));
  for(const side of ['home','away']) {
    $(`${side}-lambda`).addEventListener('input',()=>invalidate('Lambda modificati: avvia un nuovo esperimento.'));
    $(`${side}-name`).addEventListener('input',showSnapshot);
    $(`${side}-name`).addEventListener('blur',showSnapshot);
  }
  $('reset').addEventListener('click',()=>invalidate('Scenario ripristinato: avvia un nuovo esperimento.'));
  // Explicitly cancel on backgrounding: no false completion after iOS suspends us.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&active)invalidate('Esperimento interrotto passando in background. Avvialo di nuovo al ritorno.');
  });
}
