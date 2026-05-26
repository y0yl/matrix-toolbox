const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============== Fraction ==============
class Fraction {
  constructor(num, den = 1) {
    if (den === 0) { this.num = 0; this.den = 1; return; }
    if (den < 0) { num = -num; den = -den; }
    const g = gcd(BigInt(num), BigInt(den));
    this.num = Number(BigInt(num) / g);
    this.den = Number(BigInt(den) / g);
  }
  add(f) { return new Fraction(this.num * f.den + f.num * this.den, this.den * f.den); }
  sub(f) { return new Fraction(this.num * f.den - f.num * this.den, this.den * f.den); }
  mul(f) { return new Fraction(this.num * f.num, this.den * f.den); }
  div(f) { return new Fraction(this.num * f.den, this.den * f.num); }
  neg() { return new Fraction(-this.num, this.den); }
  abs() { return new Fraction(Math.abs(this.num), this.den); }
  isZero() { return this.num === 0; }
  equals(f) { return this.num === f.num && this.den === f.den; }
  toNumber() { return this.num / this.den; }
  toString() { return this.den === 1 ? String(this.num) : `${this.num}/${this.den}`; }
  toJSON() { return { num: this.num, den: this.den }; }
}

function gcd(a, b) {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

const F0 = () => new Fraction(0);
const F1 = () => new Fraction(1);

// ============== Matrix utils ==============
function createMatrix(rows, cols, fill) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fill ? fill() : F0())
  );
}
function cloneMatrix(m) { return m.map(r => [...r]); }
function matToJSON(m) { return m.map(r => r.map(f => f.toJSON())); }

function parseNum(s) {
  s = String(s).trim();
  if (!s || s === '0') return F0();
  if (s === '1') return F1();
  if (s === '-1') return new Fraction(-1);
  if (s.includes('/')) { const [n, d] = s.split('/').map(Number); return new Fraction(n, d); }
  return new Fraction(Number(s));
}

function fracStr(f) { return f.den === 1 ? String(f.num) : `${f.num}/${f.den}`; }

// ============== Core operations ==============
function matAdd(a, b) {
  return a.map((r, i) => r.map((f, j) => f.add(b[i][j])));
}
function matSub(a, b) {
  return a.map((r, i) => r.map((f, j) => f.sub(b[i][j])));
}
function matScale(m, s) {
  return m.map(r => r.map(f => f.mul(s)));
}
function matMul(a, b) {
  const r = a.length, n = a[0].length, c = b[0].length;
  const res = createMatrix(r, c);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      for (let k = 0; k < n; k++)
        res[i][j] = res[i][j].add(a[i][k].mul(b[k][j]));
  return res;
}
function matTranspose(m) {
  const r = m.length, c = m[0].length;
  const res = createMatrix(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) res[j][i] = m[i][j];
  return res;
}
function matTrace(m) {
  let t = F0();
  for (let i = 0; i < Math.min(m.length, m[0].length); i++) t = t.add(m[i][i]);
  return t;
}
function identity(n) {
  const m = createMatrix(n, n);
  for (let i = 0; i < n; i++) m[i][i] = F1();
  return m;
}
function matEquals(a, b) {
  if (a.length !== b.length || a[0].length !== b[0].length) return false;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a[0].length; j++)
      if (!a[i][j].equals(b[i][j])) return false;
  return true;
}
function isIdentity(m) { return matEquals(m, identity(m.length)); }

// ============== REF / RREF ==============
function matREF(m) {
  const rows = m.length, cols = m[0].length;
  const data = cloneMatrix(m);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(data) }];
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let best = -1;
    for (let row = pivotRow; row < rows; row++) { if (!data[row][col].isZero()) { best = row; break; } }
    if (best === -1) continue;
    if (best !== pivotRow) { [data[pivotRow], data[best]] = [data[best], data[pivotRow]]; steps.push({ index: steps.length + 1, desc: `交换第${pivotRow + 1}行和第${best + 1}行`, matrix: matToJSON(data) }); }
    const pivot = data[pivotRow][col];
    if (!pivot.equals(F1())) {
      for (let j = col; j < cols; j++) data[pivotRow][j] = data[pivotRow][j].div(pivot);
      steps.push({ index: steps.length + 1, desc: `第${pivotRow + 1}行 × ${fracStr(new Fraction(pivot.den, pivot.num))}`, matrix: matToJSON(data) });
    }
    for (let row = pivotRow + 1; row < rows; row++) {
      const factor = data[row][col]; if (factor.isZero()) continue;
      for (let j = col; j < cols; j++) data[row][j] = data[row][j].sub(factor.mul(data[pivotRow][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(factor)})×第${pivotRow + 1}行`, matrix: matToJSON(data) });
    }
    pivotRow++;
  }
  return { result: data, steps };
}

function matRREF(m) {
  const rows = m.length, cols = m[0].length;
  const data = cloneMatrix(m);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(data) }];
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let best = -1;
    for (let row = pivotRow; row < rows; row++) { if (!data[row][col].isZero()) { best = row; break; } }
    if (best === -1) continue;
    if (best !== pivotRow) { [data[pivotRow], data[best]] = [data[best], data[pivotRow]]; steps.push({ index: steps.length + 1, desc: `交换第${pivotRow + 1}行和第${best + 1}行`, matrix: matToJSON(data) }); }
    const pivot = data[pivotRow][col];
    if (!pivot.equals(F1())) {
      for (let j = col; j < cols; j++) data[pivotRow][j] = data[pivotRow][j].div(pivot);
      steps.push({ index: steps.length + 1, desc: `第${pivotRow + 1}行 × ${fracStr(new Fraction(pivot.den, pivot.num))}`, matrix: matToJSON(data) });
    }
    for (let row = 0; row < rows; row++) {
      if (row === pivotRow) continue;
      const factor = data[row][col]; if (factor.isZero()) continue;
      for (let j = col; j < cols; j++) data[row][j] = data[row][j].sub(factor.mul(data[pivotRow][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(factor)})×第${pivotRow + 1}行`, matrix: matToJSON(data) });
    }
    pivotRow++;
  }
  return { result: data, steps };
}

// ============== Determinant ==============
function matDet(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, steps: [], error: '行列式要求方阵' };
  const data = cloneMatrix(m);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(data) }];
  let swapCount = 0;
  for (let i = 0; i < n; i++) {
    let best = -1;
    for (let row = i; row < n; row++) { if (!data[row][i].isZero()) { best = row; break; } }
    if (best === -1) return { result: F0(), steps: [...steps, { index: steps.length + 1, desc: '存在全零列，行列式 = 0', matrix: matToJSON(data) }] };
    if (best !== i) { [data[i], data[best]] = [data[best], data[i]]; swapCount++; steps.push({ index: steps.length + 1, desc: `交换第${i + 1}行和第${best + 1}行 (符号变号)`, matrix: matToJSON(data) }); }
    const pivot = data[i][i];
    for (let row = i + 1; row < n; row++) {
      const factor = data[row][i]; if (factor.isZero()) continue;
      const ratio = factor.div(pivot);
      for (let j = i; j < n; j++) data[row][j] = data[row][j].sub(ratio.mul(data[i][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(ratio)})×第${i + 1}行`, matrix: matToJSON(data) });
    }
  }
  let detVal = F1();
  for (let i = 0; i < n; i++) detVal = detVal.mul(data[i][i]);
  if (swapCount % 2 !== 0) detVal = detVal.neg();
  let desc = `对角线乘积 = ${fracStr(detVal.abs())}`;
  if (swapCount % 2 !== 0) desc += `，交换${swapCount}次行，变号`;
  else if (swapCount > 0) desc += `，交换${swapCount}次行，符号不变`;
  steps.push({ index: steps.length + 1, desc, matrix: matToJSON(data) });
  return { result: detVal, steps };
}

// ============== Inverse ==============
function matInverse(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, steps: [], error: '求逆要求方阵' };
  const aug = createMatrix(n, 2 * n);
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) aug[i][j] = m[i][j]; aug[i][n + i] = F1(); }
  const steps = [{ index: 1, desc: '构造增广矩阵 [A | I]', matrix: matToJSON(aug) }];
  for (let i = 0; i < n; i++) {
    let best = -1;
    for (let row = i; row < n; row++) { if (!aug[row][i].isZero()) { best = row; break; } }
    if (best === -1) return { result: null, steps: [...steps, { index: steps.length + 1, desc: '矩阵不可逆（行列式为0）', matrix: matToJSON(aug) }], error: '矩阵不可逆' };
    if (best !== i) { [aug[i], aug[best]] = [aug[best], aug[i]]; steps.push({ index: steps.length + 1, desc: `交换第${i + 1}行和第${best + 1}行`, matrix: matToJSON(aug) }); }
    const pivot = aug[i][i];
    if (!pivot.equals(F1())) { for (let j = 0; j < 2 * n; j++) aug[i][j] = aug[i][j].div(pivot); steps.push({ index: steps.length + 1, desc: `第${i + 1}行 × ${fracStr(new Fraction(pivot.den, pivot.num))}`, matrix: matToJSON(aug) }); }
    for (let row = 0; row < n; row++) {
      if (row === i) continue;
      const factor = aug[row][i]; if (factor.isZero()) continue;
      for (let j = 0; j < 2 * n; j++) aug[row][j] = aug[row][j].sub(factor.mul(aug[i][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(factor)})×第${i + 1}行`, matrix: matToJSON(aug) });
    }
  }
  const inv = createMatrix(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) inv[i][j] = aug[i][n + j];
  steps.push({ index: steps.length + 1, desc: '提取右侧即为逆矩阵 A⁻¹', matrix: matToJSON(inv) });
  return { result: inv, steps };
}

// ============== Rank ==============
function matRank(m) {
  const { result, steps } = matREF(m);
  let rank = 0;
  for (let i = 0; i < result.length; i++) {
    let nonzero = false;
    for (let j = 0; j < result[0].length; j++) { if (!result[i][j].isZero()) { nonzero = true; break; } }
    if (nonzero) rank++;
  }
  return { result: Fn(rank), steps, refMatrix: matToJSON(result) };
}
const Fn = (n) => new Fraction(n);

// ============== Adjugate / Cofactor ==============
function matCofactor(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, error: '余子式矩阵要求方阵' };
  const cofactors = createMatrix(n, n);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(m) }];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const minor = [];
      for (let r = 0; r < n; r++) { if (r === i) continue; const row = []; for (let c = 0; c < n; c++) { if (c !== j) row.push(m[r][c]); } minor.push(row); }
      const { result: minorDet } = matDet(minor);
      cofactors[i][j] = ((i + j) % 2 === 0) ? minorDet : minorDet.neg();
    }
  }
  steps.push({ index: 2, desc: '余子式矩阵 C', matrix: matToJSON(cofactors) });
  return { result: cofactors, steps };
}

function matAdjugate(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, error: '伴随矩阵要求方阵' };
  const { result: cof, steps } = matCofactor(m);
  const adj = matTranspose(cof);
  steps.push({ index: steps.length + 1, desc: '伴随矩阵 = 余子式矩阵的转置', matrix: matToJSON(adj) });
  return { result: adj, steps };
}

// ============== Eigenvalue ==============
function superscript(n) {
  const sup = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map(d => sup[d] || d).join('');
}

function matEigen(m) {
  const n = m.length;
  if (n !== m[0].length) return { error: '特征值要求方阵' };
  const steps = [];
  steps.push({ index: 1, desc: '初始矩阵 A', matrix: matToJSON(m) });

  if (n === 2) return eigen2x2(m, steps);
  if (n === 3) return eigen3x3(m, steps);
  return eigenGeneral(m, steps);
}

function eigen2x2(m, steps) {
  const a = m[0][0], b = m[0][1], c = m[1][0], d = m[1][1];
  const tr = a.add(d), det = a.mul(d).sub(b.mul(c));
  steps.push({ index: 2, desc: `tr(A) = ${fracStr(a)} + ${fracStr(d)} = ${fracStr(tr)}`, matrix: matToJSON(m) });
  steps.push({ index: 3, desc: `det(A) = ${fracStr(a)}×${fracStr(d)} - ${fracStr(b)}×${fracStr(c)} = ${fracStr(det)}`, matrix: matToJSON(m) });
  steps.push({ index: 4, desc: `特征多项式: λ² - (${fracStr(tr)})λ + (${fracStr(det)}) = 0`, matrix: matToJSON(m) });

  const disc = tr.mul(tr).sub(det.mul(new Fraction(4)));
  steps.push({ index: 5, desc: `判别式 Δ = (${fracStr(tr)})² - 4×(${fracStr(det)}) = ${fracStr(disc)}`, matrix: matToJSON(m) });

  const eigenvalues = [], eigenvectors = [];
  if (disc.num >= 0) {
    const sqrtDisc = Math.sqrt(disc.toNumber());
    const l1 = simplifyDecimal(tr.toNumber() / 2 + sqrtDisc / 2);
    const l2 = simplifyDecimal(tr.toNumber() / 2 - sqrtDisc / 2);
    eigenvalues.push(l1, l2);
    steps.push({ index: 6, desc: `λ₁ = ${fracStr(l1)}`, matrix: matToJSON(m) });
    steps.push({ index: 7, desc: `λ₂ = ${fracStr(l2)}`, matrix: matToJSON(m) });
    const v1 = eigenvec2x2(m, l1), v2 = eigenvec2x2(m, l2);
    eigenvectors.push(v1, v2);
    steps.push({ index: 8, desc: `λ₁=${fracStr(l1)} 的特征向量`, matrix: [v1.map(x => x.toJSON())] });
    steps.push({ index: 9, desc: `λ₂=${fracStr(l2)} 的特征向量`, matrix: [v2.map(x => x.toJSON())] });
  } else {
    const re = tr.toNumber() / 2, im = Math.sqrt(-disc.toNumber()) / 2;
    eigenvalues.push(`λ₁ = ${re.toFixed(4)} + ${im.toFixed(4)}i`, `λ₂ = ${re.toFixed(4)} - ${im.toFixed(4)}i`);
    steps.push({ index: 6, desc: `λ₁ = ${re.toFixed(4)} + ${im.toFixed(4)}i`, matrix: matToJSON(m) });
    steps.push({ index: 7, desc: `λ₂ = ${re.toFixed(4)} - ${im.toFixed(4)}i`, matrix: matToJSON(m) });
  }
  return { result: { eigenvalues: eigenvalues.map(e => typeof e === 'string' ? e : fracStr(e)), eigenvectors: eigenvectors.map(v => v.map(x => fracStr(x))) }, steps };
}

function simplifyDecimal(val) {
  const rounded = Math.round(val * 10000), den = 10000;
  const g = gcd(BigInt(Math.abs(rounded)), BigInt(den));
  return new Fraction(Number(BigInt(rounded) / g), Number(BigInt(den) / g));
}

function eigenvec2x2(m, lambda) {
  const a11 = m[0][0].sub(lambda), a12 = m[0][1];
  if (!a11.isZero()) return [a12.neg().div(a11), F1()];
  if (!a12.isZero()) return [F1(), F0()];
  const a21 = m[1][0], a22 = m[1][1].sub(lambda);
  if (!a21.isZero()) return [a22.neg().div(a21), F1()];
  return [F1(), F0()];
}

function eigen3x3(m, steps) {
  const n = 3, trA = matTrace(m);
  const detA = matDet(m);
  let minorSum = F0();
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const { result: md } = matDet([[m[i][i], m[i][j]], [m[j][i], m[j][j]]]);
    minorSum = minorSum.add(md);
  }
  steps.push({ index: 2, desc: `tr(A) = ${fracStr(trA)}`, matrix: matToJSON(m) });
  steps.push({ index: 3, desc: `二阶主子式之和 = ${fracStr(minorSum)}`, matrix: matToJSON(m) });
  steps.push({ index: 4, desc: `det(A) = ${fracStr(detA.result)}`, matrix: matToJSON(m) });
  steps.push({ index: 5, desc: `特征多项式: -λ³ + (${fracStr(trA)})λ² - (${fracStr(minorSum)})λ + (${fracStr(detA.result)}) = 0`, matrix: matToJSON(m) });

  const eigenvalues = solveCubic(-1, trA.toNumber(), -minorSum.toNumber(), detA.result.toNumber());
  eigenvalues.forEach((ev, idx) => {
    const label = typeof ev === 'string' ? ev : `λ${idx + 1} ≈ ${ev.toFixed(6)}`;
    steps.push({ index: 6 + idx, desc: label, matrix: matToJSON(m) });
  });

  const eigenvectors = [];
  eigenvalues.forEach((ev, idx) => {
    if (typeof ev === 'number') {
      const lam = new Fraction(Math.round(ev * 10000), 10000);
      const v = eigenvec3x3(m, lam);
      eigenvectors.push(v.map(x => fracStr(x)));
      steps.push({ index: 9 + idx, desc: `λ${idx + 1} ≈ ${ev.toFixed(4)} 的特征向量`, matrix: [v.map(x => x.toJSON())] });
    }
  });
  return { result: { eigenvalues: eigenvalues.map(e => typeof e === 'string' ? e : e.toFixed(6)), eigenvectors }, steps };
}

function solveCubic(a, b, c, d) {
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
  const disc = 4 * p * p * p + 27 * q * q;
  if (disc < 0) {
    const m2 = 2 * Math.sqrt(-p / 3), theta = Math.acos(3 * q / (p * m2)) / 3;
    return [m2 * Math.cos(theta) - b / (3 * a), m2 * Math.cos(theta + 2 * Math.PI / 3) - b / (3 * a), m2 * Math.cos(theta + 4 * Math.PI / 3) - b / (3 * a)];
  } else if (disc > 0) {
    const D = Math.cbrt((-q + Math.sqrt(disc / 27)) / 2), E = Math.cbrt((-q - Math.sqrt(disc / 27)) / 2);
    return [D + E - b / (3 * a)];
  } else {
    return p === 0 ? [-b / (3 * a), -b / (3 * a), -b / (3 * a)] : [(9 * a * d - b * c) / (2 * p * a)];
  }
}

function eigenvec3x3(m, lambda) {
  const n = 3;
  const a = createMatrix(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i][j] = i === j ? m[i][j].sub(lambda) : m[i][j];
  const aug = createMatrix(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) aug[i][j] = a[i][j];
  for (let col = 0; col < n; col++) {
    let best = -1;
    for (let row = col; row < n; row++) { if (!aug[row][col].isZero()) { best = row; break; } }
    if (best === -1) continue;
    if (best !== col) [aug[col], aug[best]] = [aug[best], aug[col]];
    const pivot = aug[col][col];
    for (let j = col; j < n; j++) aug[col][j] = aug[col][j].div(pivot);
    for (let row = 0; row < n; row++) { if (row === col) continue; const f = aug[row][col]; for (let j = col; j < n; j++) aug[row][j] = aug[row][j].sub(f.mul(aug[col][j])); }
  }
  const v = [F0(), F0(), F0()];
  let freeVar = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (aug[i][i].isZero()) { freeVar = i; v[i] = F1(); continue; }
    if (freeVar === -1) continue;
    let sum = F0();
    for (let j = i + 1; j < n; j++) sum = sum.add(aug[i][j].mul(v[j]));
    v[i] = sum.neg().div(aug[i][i]);
  }
  if (freeVar === -1) v[n - 1] = F1();
  return v;
}

function eigenGeneral(m, steps) {
  const n = m.length, coeffs = [F1()];
  let Mk = createMatrix(n, n);
  for (let k = 1; k <= n; k++) {
    const temp = createMatrix(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) temp[i][j] = Mk[i][j].add(i === j ? coeffs[k - 1] : F0());
    Mk = matMul(m, temp);
    const ck = matTrace(Mk).neg().div(new Fraction(k));
    coeffs.push(ck);
    steps.push({ index: k + 1, desc: `c${k} = ${fracStr(ck)}`, matrix: matToJSON(Mk) });
  }
  let polyDesc = '特征多项式: λ' + superscript(n);
  for (let i = 1; i <= n; i++) {
    const c = coeffs[i]; if (c.isZero()) continue;
    const exp = n - i, sign = c.num > 0 ? ' + ' : ' - ';
    const cStr = c.abs().equals(F1()) && exp > 0 ? '' : fracStr(c.abs());
    const expStr = exp === 0 ? '' : exp === 1 ? 'λ' : 'λ' + superscript(exp);
    polyDesc += sign + cStr + expStr;
  }
  polyDesc += ' = 0';
  steps.push({ index: n + 2, desc: polyDesc, matrix: matToJSON(m) });
  return { result: { characteristicPolynomial: coeffs.map(c => fracStr(c)), eigenvalues: ['高阶矩阵需数值方法求解'] }, steps };
}

// ============== Proofs ==============
const PROOFS = {
  'transpose-mul': { name: '(AB)ᵀ = BᵀAᵀ', needB: true, prove(a, b) {
    const s = []; const ab = matMul(a, b); s.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
    const lhs = matTranspose(ab); s.push({ index: 2, desc: '左边 = (AB)ᵀ', matrix: matToJSON(lhs) });
    const rhs = matMul(matTranspose(b), matTranspose(a)); s.push({ index: 3, desc: '右边 = BᵀAᵀ', matrix: matToJSON(rhs) });
    const eq = matEquals(lhs, rhs);
    return { steps: s, conclusion: eq ? '✓ (AB)ᵀ = BᵀAᵀ 成立' : '✗ 不相等', proved: eq };
  }},
  'transpose-add': { name: '(A+B)ᵀ = Aᵀ + Bᵀ', needB: true, prove(a, b) {
    const s = []; const lhs = matTranspose(matAdd(a, b)); s.push({ index: 1, desc: '左边 = (A+B)ᵀ', matrix: matToJSON(lhs) });
    const rhs = matAdd(matTranspose(a), matTranspose(b)); s.push({ index: 2, desc: '右边 = Aᵀ + Bᵀ', matrix: matToJSON(rhs) });
    const eq = matEquals(lhs, rhs);
    return { steps: s, conclusion: eq ? '✓ (A+B)ᵀ = Aᵀ + Bᵀ 成立' : '✗ 不相等', proved: eq };
  }},
  'transpose-transpose': { name: '(Aᵀ)ᵀ = A', needB: false, prove(a) {
    const s = []; const at = matTranspose(a); s.push({ index: 1, desc: '计算 Aᵀ', matrix: matToJSON(at) });
    const lhs = matTranspose(at); s.push({ index: 2, desc: '计算 (Aᵀ)ᵀ', matrix: matToJSON(lhs) });
    return { steps: s, conclusion: matEquals(lhs, a) ? '✓ (Aᵀ)ᵀ = A 成立' : '✗ 不相等', proved: matEquals(lhs, a) };
  }},
  'inverse-mul': { name: 'A·A⁻¹ = I', needB: false, needSquare: true, prove(a) {
    const s = []; const inv = matInverse(a);
    if (inv.error) return { steps: inv.steps, conclusion: '✗ 矩阵不可逆', proved: false };
    s.push(...inv.steps); const lhs = matMul(a, inv.result); s.push({ index: s.length + 1, desc: '计算 A·A⁻¹', matrix: matToJSON(lhs) });
    const eq = isIdentity(lhs);
    return { steps: s, conclusion: eq ? '✓ A·A⁻¹ = I 成立' : '✗ 不等于单位阵', proved: eq };
  }},
  'inverse-mul-reverse': { name: '(AB)⁻¹ = B⁻¹A⁻¹', needB: true, needSquare: true, prove(a, b) {
    const s = []; const ab = matMul(a, b); s.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
    const invAB = matInverse(ab); if (invAB.error) return { steps: s, conclusion: '✗ AB不可逆', proved: false };
    s.push({ index: 2, desc: '左边 = (AB)⁻¹', matrix: matToJSON(invAB.result) });
    const invA = matInverse(a), invB = matInverse(b); if (invA.error || invB.error) return { steps: s, conclusion: '✗ A或B不可逆', proved: false };
    const rhs = matMul(invB.result, invA.result); s.push({ index: 3, desc: '右边 = B⁻¹A⁻¹', matrix: matToJSON(rhs) });
    return { steps: s, conclusion: matEquals(invAB.result, rhs) ? '✓ (AB)⁻¹ = B⁻¹A⁻¹ 成立' : '✗ 不相等', proved: matEquals(invAB.result, rhs) };
  }},
  'det-mul': { name: 'det(AB) = det(A)·det(B)', needB: true, needSquare: true, prove(a, b) {
    const s = []; const ab = matMul(a, b); s.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
    const detAB = matDet(ab); s.push(...detAB.steps);
    const detA = matDet(a), detB = matDet(b); const rhs = detA.result.mul(detB.result);
    s.push({ index: s.length + 1, desc: `det(A)·det(B) = ${fracStr(detA.result)}×${fracStr(detB.result)} = ${fracStr(rhs)}`, matrix: matToJSON(a) });
    const eq = detAB.result.equals(rhs);
    return { steps: s, conclusion: eq ? '✓ det(AB) = det(A)·det(B) 成立' : '✗ 不相等', proved: eq };
  }},
  'det-transpose': { name: 'det(Aᵀ) = det(A)', needB: false, needSquare: true, prove(a) {
    const s = []; const detA = matDet(a); s.push(...detA.steps); s.push({ index: s.length + 1, desc: `det(A) = ${fracStr(detA.result)}`, matrix: matToJSON(a) });
    const detAT = matDet(matTranspose(a)); s.push({ index: s.length + 1, desc: `det(Aᵀ) = ${fracStr(detAT.result)}`, matrix: matToJSON(matTranspose(a)) });
    const eq = detA.result.equals(detAT.result);
    return { steps: s, conclusion: eq ? '✓ det(Aᵀ) = det(A) 成立' : '✗ 不相等', proved: eq };
  }},
  'det-scalar': { name: 'det(kA) = kⁿ·det(A)', needB: false, needSquare: true, needScalar: true, prove(a, b, k) {
    const s = [], n = a.length; const detA = matDet(a); s.push(...detA.steps); s.push({ index: s.length + 1, desc: `det(A) = ${fracStr(detA.result)}`, matrix: matToJSON(a) });
    const kA = matScale(a, k), detkA = matDet(kA); s.push(...detkA.steps);
    const kn = new Fraction(Math.pow(k.toNumber(), n)); const rhs = detA.result.mul(kn);
    s.push({ index: s.length + 1, desc: `kⁿ·det(A) = ${fracStr(k)}^${n}×${fracStr(detA.result)} = ${fracStr(rhs)}`, matrix: matToJSON(a) });
    const eq = detkA.result.equals(rhs);
    return { steps: s, conclusion: eq ? '✓ det(kA) = kⁿ·det(A) 成立' : '✗ 不相等', proved: eq };
  }},
  'trace-mul': { name: 'tr(AB) = tr(BA)', needB: true, prove(a, b) {
    const s = []; const ab = matMul(a, b), ba = matMul(b, a);
    s.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) }); s.push({ index: 2, desc: '计算 BA', matrix: matToJSON(ba) });
    const trAB = matTrace(ab), trBA = matTrace(ba);
    s.push({ index: 3, desc: `tr(AB) = ${fracStr(trAB)}，tr(BA) = ${fracStr(trBA)}`, matrix: matToJSON(ab) });
    const eq = trAB.equals(trBA);
    return { steps: s, conclusion: eq ? '✓ tr(AB) = tr(BA) 成立' : '✗ 不相等', proved: eq };
  }},
  'trace-add': { name: 'tr(A+B) = tr(A) + tr(B)', needB: true, needSquare: true, prove(a, b) {
    const s = []; const trA = matTrace(a), trB = matTrace(b), trAB = matTrace(matAdd(a, b)); const rhs = trA.add(trB);
    s.push({ index: 1, desc: `tr(A+B) = ${fracStr(trAB)}，tr(A)+tr(B) = ${fracStr(rhs)}`, matrix: matToJSON(matAdd(a, b)) });
    return { steps: s, conclusion: trAB.equals(rhs) ? '✓ tr(A+B) = tr(A)+tr(B) 成立' : '✗ 不相等', proved: trAB.equals(rhs) };
  }},
  'adjugate-mul': { name: 'A·adj(A) = det(A)·I', needB: false, needSquare: true, prove(a) {
    const s = []; const adj = matAdjugate(a); if (adj.error) return { steps: s, conclusion: '✗ ' + adj.error, proved: false };
    s.push(...adj.steps); const lhs = matMul(a, adj.result); s.push({ index: s.length + 1, desc: '计算 A·adj(A)', matrix: matToJSON(lhs) });
    const detA = matDet(a); const rhs = matScale(identity(a.length), detA.result);
    s.push({ index: s.length + 1, desc: `det(A)·I = ${fracStr(detA.result)}·I`, matrix: matToJSON(rhs) });
    const eq = matEquals(lhs, rhs);
    return { steps: s, conclusion: eq ? '✓ A·adj(A) = det(A)·I 成立' : '✗ 不相等', proved: eq };
  }},
};

// ============== AI Solver ==============
async function aiSolve(problem) {
  const prompt = `你是一个线性代数专家。请判断以下问题是否属于线性代数范畴（包括矩阵、行列式、向量空间、线性方程组、特征值、线性变换、内积空间等）。
如果是，请直接给出关键解题步骤（不要写"思考过程"，只写步骤），用中文回答，步骤用编号。
如果不是线性代数问题，请直接回答"NOT_LA"。

问题：${problem}`;
  try {
    const result = execSync(`openclaw agent --agent main --message ${JSON.stringify(prompt)} --json`, { timeout: 60000, encoding: 'utf-8' });
    const data = JSON.parse(result);
    const answer = data.result?.payloads?.[0]?.text || '无法获取回答';
    const isLA = !answer.includes('NOT_LA');
    return { answer: isLA ? answer : null, isLinearAlgebra: isLA, message: isLA ? null : '该问题不属于线性代数范畴' };
  } catch (err) {
    return { answer: null, isLinearAlgebra: false, message: 'AI服务暂时不可用：' + err.message };
  }
}

// ============== Handler ==============
function parseMatrix(matrix, rows, cols) {
  const data = []; let idx = 0;
  for (let i = 0; i < rows; i++) { const row = []; for (let j = 0; j < cols; j++) { row.push(parseNum(matrix[idx])); idx++; } data.push(row); }
  return data;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(path.join(__dirname, 'static', 'index.html'), (e, d) => { if (e) { res.writeHead(500); res.end(); return; } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d); }); return;
  }
  if (req.method === 'GET' && req.url.startsWith('/static/')) {
    const fp = path.join(__dirname, req.url); const ext = path.extname(fp);
    fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'text/plain' }); res.end(d); }); return;
  }

  if (req.method === 'POST' && req.url === '/api/calc') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const input = JSON.parse(body);
        const { op, rows, cols, matrix, rows2, cols2, matrix2, scalar } = input;
        let response = {};
        const m = matrix ? parseMatrix(matrix, rows, cols) : null;
        const m2 = matrix2 ? parseMatrix(matrix2, rows2 || rows, cols2 || cols) : null;

        switch (op) {
          case 'rref': { const r = matRREF(m); response = { steps: r.steps, result: matToJSON(r.result) }; break; }
          case 'ref': { const r = matREF(m); response = { steps: r.steps, result: matToJSON(r.result) }; break; }
          case 'det': { const r = matDet(m); response = { steps: r.steps, result: r.result ? r.result.toJSON() : null, error: r.error }; break; }
          case 'inverse': { const r = matInverse(m); response = { steps: r.steps, result: r.result ? matToJSON(r.result) : null, error: r.error }; break; }
          case 'transpose': { const r = matTranspose(m); response = { steps: [{ index: 1, desc: '转置结果', matrix: matToJSON(r) }], result: matToJSON(r) }; break; }
          case 'multiply': { if (!m2) { response = { error: '需要第二个矩阵' }; break; } const r = matMul(m, m2); response = { steps: [{ index: 1, desc: '乘法结果', matrix: matToJSON(r) }], result: matToJSON(r) }; break; }
          case 'add': { if (!m2) { response = { error: '需要第二个矩阵' }; break; } const r = matAdd(m, m2); response = { steps: [{ index: 1, desc: '加法结果', matrix: matToJSON(r) }], result: matToJSON(r) }; break; }
          case 'subtract': { if (!m2) { response = { error: '需要第二个矩阵' }; break; } const r = matSub(m, m2); response = { steps: [{ index: 1, desc: '减法结果', matrix: matToJSON(r) }], result: matToJSON(r) }; break; }
          case 'scalar-mul': { const s = parseNum(scalar || '1'); const r = matScale(m, s); response = { steps: [{ index: 1, desc: `${fracStr(s)} × A 的结果`, matrix: matToJSON(r) }], result: matToJSON(r) }; break; }
          case 'rank': { const r = matRank(m); response = { steps: r.steps, result: r.result.toJSON(), refMatrix: r.refMatrix }; break; }
          case 'trace': { const r = matTrace(m); response = { steps: [{ index: 1, desc: '迹 = 对角线元素之和', matrix: matToJSON(m) }], result: r.toJSON() }; break; }
          case 'adjugate': { const r = matAdjugate(m); response = { steps: r.steps, result: r.result ? matToJSON(r.result) : null, error: r.error }; break; }
          case 'cofactor': { const r = matCofactor(m); response = { steps: r.steps, result: r.result ? matToJSON(r.result) : null, error: r.error }; break; }
          case 'eigen': { const r = matEigen(m); response = r.error ? { error: r.error } : { steps: r.steps, eigenvalues: r.result.eigenvalues, eigenvectors: r.result.eigenvectors }; break; }
          case 'proof': { const { proofId } = input; const proof = PROOFS[proofId]; if (!proof) { response = { error: '未知证明题' }; break; } const k = scalar ? parseNum(scalar) : F1(); const r = proof.prove(m, m2, k); response = { steps: r.steps, conclusion: r.conclusion, proved: r.proved, proofName: proof.name }; break; }
          case 'ai': { const { text } = input; const r = await aiSolve(text); response = { steps: r.isLinearAlgebra ? [{ index: 1, desc: r.answer }] : [], conclusion: r.isLinearAlgebra ? null : r.message, isLinearAlgebra: r.isLinearAlgebra }; break; }
          default: response = { error: '未知操作' };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(response));
      } catch (err) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

const PORT = 6130;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on :${PORT}`));
