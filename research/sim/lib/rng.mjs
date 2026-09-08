// rng.mjs — a seeded generator, so every number the harness prints can be
// reproduced to the digit. mulberry32 for uniforms, Box–Muller for normals.
// Nothing here is statistically exotic; it exists so the report and the
// tests never disagree about what "the simulation said".

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u1;
    do u1 = uniform();
    while (u1 <= 1e-12);
    const u2 = uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    const th = 2 * Math.PI * u2;
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
  return {
    uniform,
    normal,
    int: (n) => Math.floor(uniform() * n),
    // Two unit-variance normals with correlation rho.
    bivariate(rho) {
      const z1 = normal();
      const z2 = normal();
      return [z1, rho * z1 + Math.sqrt(1 - rho * rho) * z2];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(uniform() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
export const variance = (xs) => {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
};
export const sd = (xs) => Math.sqrt(variance(xs));
export function correlation(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
// Standard normal quantile (Acklam's approximation; relative error < 1.2e-9).
export function zQuantile(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -zQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
