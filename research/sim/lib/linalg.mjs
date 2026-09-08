// linalg.mjs — the one piece of numerical linear algebra the harness
// needs: the null space of a set of vectors, found through their Gram
// matrix with a Jacobi eigen-solve. Sizes here are tiny (a handful of
// columns), and what matters is that the answer is exact to tolerance and
// readable — which combinations of the columns vanish.

/** Jacobi eigen-decomposition of a small symmetric matrix (array of rows). */
export function symEigen(A, sweeps = 100) {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let s = 0; s < sweeps; s += 1) {
    let off = 0;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) off += a[i][j] * a[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const sn = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - sn * akq;
          a[k][q] = sn * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - sn * aqk;
          a[q][k] = sn * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - sn * vkq;
          v[k][q] = sn * vkp + c * vkq;
        }
      }
    }
  }
  const values = a.map((r, i) => r[i]);
  // vectors[k] is the eigenvector for values[k]
  const vectors = values.map((_, k) => v.map((row) => row[k]));
  return { values, vectors };
}

/**
 * Null space of the columns (each a Float64Array of equal length).
 * Columns are scaled to unit norm first so a component whose matrix
 * happens to be large (the error term's identity, say) cannot swamp a
 * small one; the returned vectors are mapped back to the original
 * scaling, so `sum_k c[k] * column_k == 0` holds for each returned c.
 * A zero column is its own null direction.
 */
export function nullSpace(columns, tol = 1e-9) {
  const k = columns.length;
  const norms = columns.map((c) => Math.sqrt(c.reduce((s, x) => s + x * x, 0)));
  const scaled = columns.map((c, i) => (norms[i] > 0 ? c.map((x) => x / norms[i]) : c));
  const G = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => {
      let s = 0;
      for (let t = 0; t < scaled[i].length; t += 1) s += scaled[i][t] * scaled[j][t];
      return s;
    }),
  );
  const { values, vectors } = symEigen(G);
  const max = Math.max(...values, 1e-300);
  const nulls = [];
  values.forEach((val, idx) => {
    if (val <= tol * max) {
      // back to original scaling: c_k = ctilde_k / norm_k (a zero column keeps its coefficient)
      nulls.push(vectors[idx].map((x, i) => (norms[i] > 0 ? x / norms[i] : x)));
    }
  });
  return { rank: k - nulls.length, nulls, eigenvalues: values };
}

/** Whether a parameter direction e_k is identified: orthogonal to every null vector. */
export function identifiedParameters(nulls, k, tol = 1e-7) {
  return Array.from({ length: k }, (_, i) => nulls.every((c) => Math.abs(c[i]) < tol * (Math.max(...c.map(Math.abs)) || 1)));
}
