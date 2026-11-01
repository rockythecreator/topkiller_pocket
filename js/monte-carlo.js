import { validateLambda } from './math.js';
import { createUniform } from './mc-rng.js';
export const VOLUMES = [1000, 10000, 100000];
export const EVENTS = ['home', 'draw', 'away', 'over15', 'under15', 'over25', 'under25', 'bttsYes', 'bttsNo'];
export function validateRun(config) {
  if (!config || !Number.isSafeInteger(config.runId) || config.runId < 1) throw new RangeError('runId non valido.');
  validateLambda(config.lambdaCasa); validateLambda(config.lambdaOspite);
  if (!VOLUMES.includes(config.N)) throw new RangeError('Volume non valido.');
  if (!['crypto', 'seeded'].includes(config.mode)) throw new RangeError('Modalità non valida.');
  if (config.mode === 'seeded' && (!Number.isSafeInteger(config.seed) || config.seed < 0)) throw new RangeError('Seed non valido.');
  if (config.mode === 'crypto' && config.seed !== undefined) throw new RangeError('Seed non consentito.');
}
function drawPoisson(threshold, uniform) {
  let product = 1, k = 0;
  do {
    const u = uniform();
    if (!Number.isFinite(u) || u <= 0 || u >= 1) throw new RangeError('Uniforme fuori da (0,1).');
    product *= u; k++;
  } while (product > threshold);
  return k - 1;
}
export function samplePoisson(lambda, uniform) {
  validateLambda(lambda);
  if (typeof uniform !== 'function') throw new TypeError('Sorgente casuale non valida.');
  return drawPoisson(Math.exp(-lambda), uniform);
}
export function createCounts() {
  return { completed: 0, counts: Object.fromEntries(EVENTS.map(k => [k, 0])), scores: Object.create(null) };
}
export function recordScore(result, home, away) {
  if (![home, away].every(x => Number.isSafeInteger(x) && x >= 0)) throw new RangeError('Gol non validi.');
  result.completed++;
  const c = result.counts, total = home + away;
  c[home > away ? 'home' : home === away ? 'draw' : 'away']++;
  c[total > 1 ? 'over15' : 'under15']++;
  c[total > 2 ? 'over25' : 'under25']++;
  c[home > 0 && away > 0 ? 'bttsYes' : 'bttsNo']++;
  const key = `${home}:${away}`;
  result.scores[key] = (result.scores[key] || 0) + 1;
}
export function assertCounts(result, N = result.completed) {
  if (!Number.isSafeInteger(N) || N < 0 || result.completed !== N) throw new Error('Simulazione incompleta.');
  const c = result.counts;
  if (!EVENTS.every(k => Number.isSafeInteger(c[k]) && c[k] >= 0 && c[k] <= N)) throw new Error('Conteggi non validi.');
  for (const keys of [['home','draw','away'], ['over15','under15'], ['over25','under25'], ['bttsYes','bttsNo']]) {
    if (keys.reduce((s,k) => s+c[k],0) !== N) throw new Error('Identità dei conteggi violata.');
  }
  let total = 0;
  for (const [key, count] of Object.entries(result.scores)) {
    if (!/^\d+:\d+$/.test(key) || !Number.isSafeInteger(count) || count <= 0) throw new Error('Risultati esatti non validi.');
    total += count;
  }
  if (total !== N) throw new Error('Somma risultati esatti non valida.');
  return result;
}
export function createExperiment(config) {
  validateRun(config);
  const uniform = createUniform(config.mode, config.seed);
  const homeThreshold = Math.exp(-config.lambdaCasa), awayThreshold = Math.exp(-config.lambdaOspite);
  const result = createCounts();
  return {
    result,
    step(size) {
      if (!Number.isSafeInteger(size) || size <= 0) throw new RangeError('Blocco non valido.');
      const end = Math.min(config.N, result.completed + size);
      while (result.completed < end) recordScore(result, drawPoisson(homeThreshold, uniform), drawPoisson(awayThreshold, uniform));
      return result.completed === config.N;
    },
  };
}
// Both execution paths share this loop and the same RNG consumption order.
export async function executeRun(config, { cancelled = () => false, progress = () => {}, yieldControl = () => new Promise(r => setTimeout(r, 0)), blockSize = 256 } = {}) {
  const experiment = createExperiment(config);
  let lastProgress = performance.now();
  while (!cancelled()) {
    const done = experiment.step(blockSize);
    const now = performance.now();
    if (done || now - lastProgress >= 125) { progress(experiment.result.completed); lastProgress = now; }
    if (done) return assertCounts(experiment.result, config.N);
    await yieldControl();
  }
  return null;
}
