import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, poisson, sum } from '../js/math.js';
import { DEFAULTS, STORAGE_KEY, cleanSettings, loadSettings, saveSettings } from '../js/settings.js';
const close = (a, b, tolerance = 1e-13) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b}`);

test('Valori richiesti: arrotondamento a due decimali', () => {
  const r = simulate(1.45, 1.1);
  for (const [key, expected] of Object.entries({ home: '45.13', draw: '26.20', away: '28.67', over25: '46.89', bttsYes: '51.06' })) {
    assert.equal((r[key] * 100).toFixed(2), expected);
  }
  assert.equal(r.topScores[0].home, 1); assert.equal(r.topScores[0].away, 1);
  assert.equal((r.topScores[0].probability * 100).toFixed(2), '12.45');
});

test('Probabilità complementari, limiti e simmetria: tutte le 109.561 coppie di slider', () => {
  for (let h = 20; h <= 350; h++) for (let a = 20; a <= 350; a++) {
    const r = simulate(h / 100, a / 100);
    close(r.home + r.draw + r.away, 1);
    close(r.over15 + r.under15, 1); close(r.over25 + r.under25, 1); close(r.bttsYes + r.bttsNo, 1);
    for (const value of [r.home, r.draw, r.away, r.over15, r.under15, r.over25, r.under25, r.bttsYes, r.bttsNo, r.outsideMatrix, ...r.matrix.flat()]) assert.ok(value >= 0 && value <= 1);
    assert.ok(r.over15 >= r.over25);
    assert.ok(r.omittedTailBound < 2e-17);
    if (h === a) close(r.home, r.away);
  }
});

// Independent reference: log factorial PMF and fixed 81 × 81 support.
function reference(h, a) {
  const pmf = (lambda, k) => {
    let logFactorial = 0;
    for (let n = 2; n <= k; n++) logFactorial += Math.log(n);
    return Math.exp(-lambda + k * Math.log(lambda) - logFactorial);
  };
  const result = { home: 0, draw: 0, away: 0, over15: 0, over25: 0, bttsYes: 0 };
  for (let i = 0; i <= 80; i++) for (let j = 0; j <= 80; j++) {
    const p = pmf(h, i) * pmf(a, j);
    result[i > j ? 'home' : i === j ? 'draw' : 'away'] += p;
    if (i + j > 1) result.over15 += p;
    if (i + j > 2) result.over25 += p;
    if (i > 0 && j > 0) result.bttsYes += p;
  }
  return result;
}
test('Confronto con calcolo indipendente a limiti e valori intermedi', () => {
  for (const h of [0.2, 0.21, 1, 1.45, 2, 3.49, 3.5]) for (const a of [0.2, 1.1, 2.7, 3.5]) {
    const r = simulate(h, a); const ref = reference(h, a); const reverse = simulate(a, h);
    for (const key of Object.keys(ref)) close(r[key], ref[key]);
    close(r.home, reverse.away); close(r.draw, reverse.draw);
  }
});
test('Code non rinormalizzate e matrice con probabilità assolute', () => {
  for (const lambda of [0.2, 1.1, 1.45, 3.5]) {
    const p = poisson(lambda); close(sum(p.probabilities), 1);
    const next = p.probabilities.at(-1) * lambda / p.probabilities.length;
    let term = next; let actualTail = 0;
    for (let k = p.probabilities.length; k < 100; k++) { actualTail += term; term *= lambda / (k + 1); }
    assert.ok(actualTail <= p.tailBound); assert.ok(p.tailBound < 1e-17);
  }
  const r = simulate(3.5, 3.5);
  assert.ok(r.outsideMatrix > 0.25);
  close(r.matrix[0][0], Math.exp(-7));
  close(sum(r.matrix.flat()) + r.outsideMatrix, 1);
  assert.equal(r.matrix.length, 6); assert.ok(r.matrix.every(row => row.length === 6));
  assert.equal(r.topScores.length, 5);
  assert.ok(r.topScores.every((s, i, list) => i === 0 || list[i - 1].probability >= s.probability));
});
test('Lambda non validi rifiutati', () => {
  for (const value of [0, -1, 0.19, 3.51, Infinity, NaN, '1.45', null, undefined]) {
    assert.throws(() => simulate(value, 1.1), RangeError);
    assert.throws(() => simulate(1.45, value), RangeError);
  }
});
test('Impostazioni: recupero, dati corrotti, valori limite e storage bloccato', () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(loadSettings(storage), DEFAULTS);
  const settings = { homeName: 'Test A', awayName: 'Test B', homeLambda: 0.2, awayLambda: 3.5 };
  assert.equal(saveSettings(storage, settings), true); assert.deepEqual(loadSettings(storage), settings);
  data.set(STORAGE_KEY, '{'); assert.deepEqual(loadSettings(storage), DEFAULTS);
  assert.deepEqual(cleanSettings({ homeName: ' ', awayName: 42, homeLambda: 9, awayLambda: '2' }), DEFAULTS);
  assert.equal(cleanSettings({ homeName: 'a'.repeat(80) }).homeName.length, 40);
  assert.deepEqual(loadSettings(null), DEFAULTS); assert.equal(saveSettings(null, settings), false);
});
