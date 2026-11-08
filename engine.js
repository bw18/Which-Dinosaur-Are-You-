// Pure scoring logic, ported 1:1 from the Python quiz (no DOM here).
const DinoEngine = (function () {
  const D = typeof QUIZ_DATA !== 'undefined' ? QUIZ_DATA : require('./data.js');
  // Python-style round(x, 2): exact binary ties (x = odd/8, e.g. 8.625) go to the even digit.
  const r2 = (x) => {
    const t = x * 8;
    if (Number.isInteger(t) && t % 2 !== 0) {
      const f = Math.floor(x * 100);
      return (f % 2 === 0 ? f : f + 1) / 100;
    }
    return Number(x.toFixed(2));
  };

  // Accurate erf to match Python's math.erf: series near 0, continued-fraction erfc in the tails.
  function erf(x) {
    const a = Math.abs(x);
    if (a >= 2) {
      let t = a;
      for (let k = 300; k >= 1; k--) t = a + k / 2 / t;
      return Math.sign(x) * (1 - Math.exp(-a * a) / (Math.sqrt(Math.PI) * t));
    }
    let term = a, sum = a;
    for (let n = 1; n < 200; n++) {
      term *= (2 * a * a) / (2 * n + 1);
      sum += term;
      if (term < 1e-17 * sum) break;
    }
    return Math.sign(x) * (2 / Math.sqrt(Math.PI)) * Math.exp(-a * a) * sum;
  }
  const cdf = (x, mu = 0, sigma = 1) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));

  const points = (values, answer) => values.map((v) => Math.max(0, 4 - Math.abs(v - (5 - answer))));

  function groupScores(answers) {
    const s = D.groups.map(() => 0);
    for (let n = 1; n <= 16; n++) {
      const sc = D.scoring[n], a = answers[n - 1];
      const pts = sc.type === 'dist' ? points(sc.values, a) : points(sc.table[a], 1);
      pts.forEach((p, i) => (s[i] += p * D.questionWeights[n]));
    }
    const calibrated = s.map((v, i) => r2(v + D.calibrationOffsets[i]));
    const max = Math.max(...calibrated);
    return { calibrated, max, selected: D.groups.filter((g, i) => calibrated[i] === max) };
  }

  function eligible(selected, followAnswers) {
    const names = [];
    for (const g of D.groups) {
      if (!selected.includes(g)) continue;
      const f = D.followups[g];
      if (!f) names.push(...Object.keys(D.speciesDatabase[g])); // e.g. Sauropods: no follow-up in the Python
      else names.push(...(f.options.length ? f.species[followAnswers[g]] : []), ...f.always);
    }
    const out = {};
    for (const n of names)
      for (const grp of Object.values(D.speciesDatabase)) if (n in grp) { out[n] = grp[n]; break; }
    return out;
  }

  function biometrics({ gender, age, weight, height, build }) {
    const [avg, sd] = gender === 'male' ? [69.0, 2.9] : [63.5, 2.7];
    const size = 10 * cdf((height - avg) / sd);
    const bmi = (weight * 0.453592) / (height * 0.0254) ** 2;
    const bmiScore = 10 * cdf(bmi, 26, 5);
    const bStock = { skinny: 0.5, 'skinny-muscular': 3.0, muscular: 5.5, 'skinny-fat': 4.0, 'fat-muscular': 8.5, fat: 10.0 };
    const bPower = { skinny: 1.0, 'skinny-muscular': 5.0, muscular: 9.0, 'skinny-fat': 2.0, 'fat-muscular': 6.0, fat: 3.0 };
    const stockiness = 0.65 * bmiScore + 0.25 * bStock[build];
    const wScore = Math.max(0, Math.min(10, ((weight - 100) / 150) * 10));
    const hScore = Math.max(0, Math.min(10, ((height - 60) / 18) * 10));
    let power = 0.5 * bPower[build] + 0.3 * wScore + 0.2 * hScore;
    power *= Math.max(0.5, 1 - Math.max(0, age - 30) * 0.008);
    const c = (x) => r2(Math.max(0, Math.min(10, x)));
    return { size: c(size), stockiness: c(stockiness), power: c(power) };
  }

  function closest(u, pool) {
    let best = null, low = Infinity;
    for (const [name, m] of Object.entries(pool)) {
      const e = 0.5 * (u.size - m.size) ** 2 + 0.425 * (u.power - m.power) ** 2 + 0.075 * (u.stockiness - m.stockiness) ** 2;
      if (e < low) { low = e; best = name; }
    }
    return { name: best, error: r2(low) };
  }

  return { groupScores, eligible, biometrics, closest };
})();
if (typeof module !== 'undefined') module.exports = DinoEngine;
