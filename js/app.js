import { simulate } from './math.js';
import { DEFAULTS, loadSettings, saveSettings } from './settings.js';
const $ = id => document.getElementById(id);
const percent = value => `${(value * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const decimal = value => value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Access to localStorage itself can throw in privacy-restricted browsers.
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let settings = loadSettings(storage);
function fillInputs() {
  for (const side of ['home', 'away']) {
    $(`${side}-name`).value = settings[`${side}Name`];
    $(`${side}-lambda`).value = settings[`${side}Lambda`];
  }
}
function render() {
  const result = simulate(settings.homeLambda, settings.awayLambda);
  $('home-value').textContent = decimal(settings.homeLambda);
  $('away-value').textContent = decimal(settings.awayLambda);
  for (const side of ['home', 'away']) $(`${side}-lambda`).setAttribute('aria-valuetext', `${decimal(settings[`${side}Lambda`])} gol attesi`);
  $('match-title').textContent = `${settings.homeName} / ${settings.awayName}`;
  $('outcomes').replaceChildren();
  $('outcome-bar').replaceChildren();
  for (const [key, label] of [['home', '1 · Casa'], ['draw', 'X · Pareggio'], ['away', '2 · Ospite']]) {
    const block = document.createElement('div');
    block.className = 'outcome';
    const title = document.createElement('span'); title.textContent = label;
    const value = document.createElement('strong'); value.textContent = percent(result[key]);
    block.append(title, value); $('outcomes').append(block);
    const bar = document.createElement('span'); bar.style.width = `${result[key] * 100}%`; $('outcome-bar').append(bar);
  }
  $('goal-markets').innerHTML = [
    ['Totale gol 1,5', 'Over', result.over15, 'Under', result.under15],
    ['Totale gol 2,5', 'Over', result.over25, 'Under', result.under25],
    ['BTTS · Entrambe segnano', 'Sì', result.bttsYes, 'No', result.bttsNo],
  ].map(([title, a, pa, b, pb]) => `<div class="market-row"><div>${title}</div><div><span>${a}</span><strong>${percent(pa)}</strong></div><div><span>${b}</span><strong>${percent(pb)}</strong></div></div>`).join('');
  $('top-scores').innerHTML = result.topScores.map(score => `<li><b>${score.home}–${score.away}</b><span>${percent(score.probability)}</span></li>`).join('');
  const table = $('matrix');
  table.querySelectorAll('thead, tbody').forEach(node => node.remove());
  const head = table.createTHead();
  head.innerHTML = '<tr><th scope="col">C / O</th>' + Array.from({ length: 6 }, (_, a) => `<th scope="col">${a}</th>`).join('') + '</tr>';
  const body = table.createTBody();
  const peak = Math.max(...result.matrix.flat());
  result.matrix.forEach((row, h) => {
    const tr = body.insertRow();
    const th = document.createElement('th'); th.scope = 'row'; th.textContent = h; tr.append(th);
    row.forEach((probability, a) => {
      const cell = tr.insertCell(); cell.textContent = percent(probability);
      cell.style.backgroundColor = `rgba(63, 193, 127, ${0.06 + 0.42 * probability / peak})`;
      cell.setAttribute('aria-label', `${h} a ${a}: ${percent(probability)}`);
    });
  });
  $('matrix-tail').textContent = `Risultati fuori dalla matrice (almeno una squadra con 6 o più gol): ${percent(result.outsideMatrix)}. Nessuna rinormalizzazione.`;
}
function persist() {
  $('storage-status').textContent = saveSettings(storage, settings) ? 'Impostazioni salvate su questo browser.' : 'Salvataggio non disponibile. Lo scenario resta attivo in questa pagina.';
}
for (const side of ['home', 'away']) {
  $(`${side}-lambda`).addEventListener('input', event => {
    settings[`${side}Lambda`] = Number(event.target.value); render(); persist();
  });
  $(`${side}-name`).addEventListener('input', event => {
    settings[`${side}Name`] = event.target.value.trim() || DEFAULTS[`${side}Name`]; render(); persist();
  });
  $(`${side}-name`).addEventListener('blur', event => { event.target.value = settings[`${side}Name`]; });
}
$('reset').addEventListener('click', () => { settings = { ...DEFAULTS }; fillInputs(); render(); persist(); });
fillInputs(); render(); persist();
