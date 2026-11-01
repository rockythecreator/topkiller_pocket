import test from 'node:test';
import assert from 'node:assert/strict';
import { createPCG32, createCryptoUniform } from '../js/mc-rng.js';
import { samplePoisson, createExperiment, createCounts, recordScore, assertCounts, executeRun, EVENTS, validateRun } from '../js/monte-carlo.js';
import { wilson, poissonProbability, compare, summarize } from '../js/mc-statistics.js';
const config = { runId:1, lambdaCasa:1.45, lambdaOspite:1.1, N:1000, mode:'seeded', seed:42 };
test('PCG32 reference vectors, open uniforms, crypto buffering and errors', () => {
  // pcg-random.org reference demo: initstate=42, initseq=54.
  const rng = createPCG32(42);
  assert.deepEqual(Array.from({length:6},()=>rng.nextUint32()), [0xa15c02b7,0x7b47f409,0xba1d3330,0x83d2f293,0xbfa4784b,0xcbed606e]);
  for (const seed of [-1, NaN, 1.2, '42', undefined]) assert.throws(()=>createPCG32(seed));
  let fills=0;
  const u = createCryptoUniform({getRandomValues(a){ fills++; a.fill(0); a[1]=0xffffffff; }});
  assert.equal(u(),0.5/2**32); assert.equal(u(),(2**32-0.5)/2**32);
  for(let i=0;i<4095;i++) u(); assert.equal(fills,2);
  assert.throws(()=>createCryptoUniform({}));
  const fail = createCryptoUniform({getRandomValues(){throw new Error('entropy failure');}});
  assert.throws(fail,/entropy failure/);
});
test('Knuth, validation, artificial categories and no goal cap', () => {
  assert.equal(samplePoisson(1,()=>0.1),0);
  let remaining=8;
  assert(samplePoisson(3.5,()=>remaining-- > 0 ? 0.99 : 0.001)>5);
  for(const u of [0,1,-1,NaN,Infinity]) assert.throws(()=>samplePoisson(1,()=>u));
  for(const lambda of [0,3.51,'1',NaN]) assert.throws(()=>samplePoisson(lambda,()=>0.5));
  for(const bad of [{N:999},{seed:-1},{mode:'other'},{mode:'crypto',seed:42},{runId:0}]) assert.throws(()=>validateRun({...config,...bad}));
  const result=createCounts();
  for(const [h,a] of [[0,0],[1,0],[0,2],[2,1],[0,7],[9,0]]) recordScore(result,h,a);
  assertCounts(result,6);
  assert.deepEqual(result.counts,{home:3,draw:1,away:2,over15:4,under15:2,over25:3,under25:3,bttsYes:1,bttsNo:5});
  assert.equal(result.scores['0:7'],1); assert.equal(result.scores['9:0'],1);
  assert.throws(()=>recordScore(result,-1,0));
  assert.throws(()=>assertCounts(result,7));
  result.counts.draw++; assert.throws(()=>assertCounts(result));
});
test('same seed, chunk invariance, completion and cancellation', async () => {
  const a=createExperiment(config),b=createExperiment(config);
  while(!a.step(1)) {} while(!b.step(317)) {}
  assert.deepEqual(a.result,b.result);
  assert.deepEqual(await executeRun(config,{yieldControl:async()=>{},blockSize:77}),a.result);
  let cancelled=false;
  assert.equal(await executeRun(config,{yieldControl:async()=>{cancelled=true;},cancelled:()=>cancelled}),null);
  assert.throws(()=>a.step(0));
});
test('Wilson endpoints and independent numerical reference; unrounded differences', () => {
  const [l,u]=wilson(0,1000); assert(Math.abs(l)<1e-15); assert(Math.abs(u-0.0038267585)<1e-10);
  const [l2,u2]=wilson(1000,1000); assert(Math.abs(l2-(1-u))<1e-15); assert.equal(u2,1);
  const mid=wilson(500,1000); assert(Math.abs(mid[0]-0.4690696001)<1e-9); assert(Math.abs(mid[1]-0.5309303999)<1e-9);
  assert.throws(()=>wilson(1,0)); assert.throws(()=>wilson(1001,1000));
  assert.equal(compare(321,1000,0.32123456).difference,100*(0.321-0.32123456));
  assert(Math.abs(poissonProbability(3.5,8)-Math.exp(-3.5)*3.5**8/40320)<1e-16);
  const experiment=createExperiment(config);experiment.step(1000);
  const s=summarize(experiment.result,1.45,1.1);
  assert.equal(s.scores[0].key,'1:1'); assert.equal(s.scores.filter(x=>x.priority).length,5);
});
// Statistical plan fixed before execution. 6 scenarios x 3 volumes x 42 comparisons.
// Family false-alarm budget 1e-4, Bonferroni: alpha = 1e-4/756 per comparison.
// Two-sided Bernstein: |mean-E| <= sqrt(2 Var log(2/alpha)/N) + 2 B log(2/alpha)/(3N).
// Binomial comparisons use exact Bernoulli variance; moment tests use bounded
// transforms min(goals,20), not a cap in the sampler. Expectations/variances
// are independently summed from log-factorial Poisson probabilities (0..80).
const scenarios=[[.2,.2],[3.5,3.5],[.2,3.5],[3.5,.2],[1.45,1.1],[1,1]];
const alpha=1e-4/(6*3*42), log=Math.log(2/alpha);
function reference(lambda) {
  let logFactorial=0;
  return Array.from({length:81},(_,k)=>{if(k>0)logFactorial+=Math.log(k);return Math.exp(-lambda+k*Math.log(lambda)-logFactorial);});
}
function check(value,mean,variance,bound,N,label) {
  const tolerance=Math.sqrt(2*variance*log/N)+2*bound*log/(3*N);
  assert(Math.abs(value-mean)<=tolerance,`${label}: ${value}, expected ${mean}, tolerance ${tolerance}`);
}
let comparisons=0;
test('preplanned statistical family: 18 runs, 756 Bernstein comparisons, alpha total 1e-4', () => {
  for(let i=0;i<scenarios.length;i++) for(const N of [1000,10000,100000]) {
    const [h,a]=scenarios[i];
    const experiment=createExperiment({...config,lambdaCasa:h,lambdaOspite:a,N,seed:20261101+i});
    while(!experiment.step(4096)) {} const r=assertCounts(experiment.result,N);
    const ph=reference(h),pa=reference(a),market=Object.fromEntries(EVENTS.map(k=>[k,0]));
    for(let x=0;x<=80;x++)for(let y=0;y<=80;y++) {
      const p=ph[x]*pa[y],total=x+y;
      for(const k of [x>y?'home':x===y?'draw':'away',total>1?'over15':'under15',total>2?'over25':'under25',x>0&&y>0?'bttsYes':'bttsNo'])market[k]+=p;
    }
    function bern(k,p,label) {check(k/N,p,p*(1-p),1,N,label);comparisons++;}
    for(const k of EVENTS) bern(r.counts[k],market[k],k);
    const marginals=[Array(81).fill(0),Array(81).fill(0)];let bothZero=0;
    for(const [key,count] of Object.entries(r.scores)) {
      const [x,y]=key.split(':').map(Number); assert(Number.isInteger(x)&&x>=0&&Number.isInteger(y)&&y>=0);
      marginals[0][x]=(marginals[0][x]||0)+count;marginals[1][y]=(marginals[1][y]||0)+count;
      if(x===0&&y===0)bothZero+=count;
    }
    for(let side=0;side<2;side++) {
      const probs=side===0?ph:pa;
      for(let k=0;k<=10;k++)bern(marginals[side][k],probs[k],`marginal ${side}:${k}`);
      for(const power of [1,2]) {
        // The second transform measures central second moment (variance about known lambda).
        const lambda=side===0?h:a;
        const f=x=>power===1?Math.min(x,20):(Math.min(x,20)-lambda)**2;
        const mean=probs.reduce((s,p,k)=>s+p*f(k),0), second=probs.reduce((s,p,k)=>s+p*f(k)**2,0);
        const observed=marginals[side].reduce((s,c,k)=>s+c*f(k),0)/N;
        check(observed,mean,second-mean**2,power===1?20:400,N,`moment ${side}:${power}`);comparisons++;
      }
    }
    bern(bothZero,ph[0]*pa[0],'independent zero indicators');
    const mu=p=>p.reduce((s,v,k)=>s+v*Math.min(k,20),0);
    const mh=mu(ph),ma=mu(pa);
    const variance=(p,m)=>p.reduce((s,v,k)=>s+v*(Math.min(k,20)-m)**2,0);
    let cross=0;
    for(const [key,c] of Object.entries(r.scores)){const [x,y]=key.split(':').map(Number);cross+=c*(Math.min(x,20)-mh)*(Math.min(y,20)-ma);}
    check(cross/N,0,variance(ph,mh)*variance(pa,ma),400,N,'independent centered product');comparisons++;
    // Five scores are fixed a priori, never selected from the sample.
    for(const key of ['0:0','1:0','0:1','1:1','6:0']){const [x,y]=key.split(':').map(Number);bern(r.scores[key]||0,ph[x]*pa[y],key);}
  }
  assert.equal(comparisons,756);
});
