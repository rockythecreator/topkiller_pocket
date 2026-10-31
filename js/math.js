/** Two independent Poisson variables. No rescaling of truncated probabilities. */
export const MIN_LAMBDA = 0.2;
export const MAX_LAMBDA = 3.5;
const TOLERANCE = 1e-17;

export function validateLambda(lambda) {
  if (!Number.isFinite(lambda) || lambda < MIN_LAMBDA || lambda > MAX_LAMBDA) {
    throw new RangeError('Lambda deve essere compreso tra 0.20 e 3.50.');
  }
}

export function sum(values) {
  // Kahan summation reduces loss of precision when adding small probabilities.
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = total + adjusted;
    correction = (next - total) - adjusted;
    total = next;
  }
  return total;
}

export function poisson(lambda) {
  validateLambda(lambda);
  const probabilities = [Math.exp(-lambda)];
  let tailBound = Infinity;
  for (let k = 0; k < 100; k++) {
    const next = probabilities[k] * lambda / (k + 1);
    // All subsequent ratios decrease: bound the omitted tail geometrically.
    const ratio = lambda / (k + 2);
    if (k >= 5 && ratio < 1) {
      tailBound = next / (1 - ratio);
      if (tailBound < TOLERANCE) return { probabilities, tailBound };
    }
    probabilities.push(next);
  }
  throw new Error('Convergenza Poisson non raggiunta.');
}

export function simulate(homeLambda, awayLambda) {
  const home = poisson(homeLambda);
  const away = poisson(awayLambda);
  const outcomes = { home: [], draw: [], away: [] };
  const scores = [];
  home.probabilities.forEach((ph, h) => {
    away.probabilities.forEach((pa, a) => {
      const probability = ph * pa;
      outcomes[h > a ? 'home' : h === a ? 'draw' : 'away'].push(probability);
      scores.push({ home: h, away: a, probability });
    });
  });
  scores.sort((a, b) => b.probability - a.probability || a.home - b.home || a.away - b.away);
  const totalLambda = homeLambda + awayLambda;
  const under15 = Math.exp(-totalLambda) * (1 + totalLambda);
  const under25 = Math.exp(-totalLambda) * (1 + totalLambda + totalLambda ** 2 / 2);
  const bttsYes = (-Math.expm1(-homeLambda)) * (-Math.expm1(-awayLambda));
  const matrix = home.probabilities.slice(0, 6).map(ph => away.probabilities.slice(0, 6).map(pa => ph * pa));
  return {
    home: sum(outcomes.home), draw: sum(outcomes.draw), away: sum(outcomes.away),
    under15, over15: 1 - under15, under25, over25: 1 - under25,
    bttsYes, bttsNo: 1 - bttsYes,
    topScores: scores.slice(0, 5), matrix,
    outsideMatrix: 1 - sum(matrix.flat()),
    omittedTailBound: home.tailBound + away.tailBound,
  };
}
