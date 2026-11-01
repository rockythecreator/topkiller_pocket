import { validateLambda, simulate } from './math.js';
import { EVENTS, assertCounts } from './monte-carlo.js';
export function wilson(k, N) {
  if (!Number.isSafeInteger(N) || N < 1 || !Number.isSafeInteger(k) || k < 0 || k > N) throw new RangeError('Conteggio Wilson non valido.');
  const z = 1.959964, z2 = z*z, p = k/N, denominator = 1 + z2/N;
  const center = (p + z2/(2*N))/denominator;
  const half = z*Math.sqrt(p*(1-p)/N + z2/(4*N*N))/denominator;
  return [Math.max(0, center-half), Math.min(1, center+half)];
}
// Separate exact-score probability for all observed scores, including goals > 5.
export function poissonProbability(lambda, goals) {
  validateLambda(lambda);
  if (!Number.isSafeInteger(goals) || goals < 0) throw new RangeError('Gol non validi.');
  let p = Math.exp(-lambda);
  for (let k=1; k<=goals; k++) p *= lambda/k;
  return p;
}
export function compare(k, N, theory) {
  if (!Number.isFinite(theory) || theory < 0 || theory > 1) throw new RangeError('Probabilità non valida.');
  return { count: k, theory, frequency: k/N, difference: 100*(k/N-theory), interval: wilson(k,N) };
}
export function summarize(result, home, away) {
  assertCounts(result);
  const theory = simulate(home, away), N = result.completed;
  const events = Object.fromEntries(EVENTS.map(k => [k, compare(result.counts[k], N, theory[k])]));
  // Priority is defined BEFORE inspecting the sample: the theoretical top five.
  const priority = theory.topScores.map(s => `${s.home}:${s.away}`);
  const keys = [...priority, ...Object.keys(result.scores).filter(k => !priority.includes(k)).sort((a,b) => {
    const [h,a1] = a.split(':').map(Number), [h2,a2] = b.split(':').map(Number);
    return h-h2 || a1-a2;
  })];
  const scores = keys.map(key => {
    const [h,a] = key.split(':').map(Number);
    return { key, priority: priority.includes(key), ...compare(result.scores[key] || 0,N,poissonProbability(home,h)*poissonProbability(away,a)) };
  });
  return { events, scores };
}
