// PCG-XSH-RR 64/32, reference initialization: pcg32_srandom_r(seed, stream).
// BigInt preserves the reference 64-bit arithmetic. Only deterministic tests use it.
const MASK = (1n << 64n) - 1n;
const DENOMINATOR = 4294967296;
export function createPCG32(seed, stream = 54) {
  for (const value of [seed, stream]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Seed e stream devono essere interi sicuri non negativi.');
  }
  let state = 0n;
  const increment = (BigInt(stream) << 1n) | 1n;
  function nextUint32() {
    const old = state;
    state = (old * 6364136223846793005n + increment) & MASK;
    const shifted = Number(((old >> 18n) ^ old) >> 27n) >>> 0;
    const rotation = Number(old >> 59n);
    return ((shifted >>> rotation) | (shifted << ((-rotation) & 31))) >>> 0;
  }
  nextUint32(); state = (state + BigInt(seed)) & MASK; nextUint32();
  return { nextUint32, uniform: () => (nextUint32() + 0.5) / DENOMINATOR };
}
export function createCryptoUniform(cryptoSource = globalThis.crypto) {
  if (!cryptoSource?.getRandomValues) throw new Error('Sorgente casuale sicura non disponibile.');
  const buffer = new Uint32Array(4096);
  let index = buffer.length;
  return () => {
    if (index === buffer.length) { cryptoSource.getRandomValues(buffer); index = 0; }
    return (buffer[index++] + 0.5) / DENOMINATOR;
  };
}
export function createUniform(mode, seed) {
  if (mode === 'crypto') {
    if (seed !== undefined) throw new RangeError('La modalità normale non accetta seed.');
    return createCryptoUniform();
  }
  if (mode === 'seeded') return createPCG32(seed).uniform;
  throw new RangeError('Modalità casuale non valida.');
}
