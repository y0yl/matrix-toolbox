const http = require('http');
const fs = require('fs');
const path = require('path');

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
const Fn = (n) => new Fraction(n);

// ============== Matrix utilities ==============
function createMatrix(rows, cols, fill = null) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fill ? fill() : F0())
  );
}

function cloneMatrix(m) {
  return m.map(row => [...row]);
}

function parseNum(s) {
  s = String(s).trim();
  if (!s || s === '0') return F0();
  if (s === '1') return F1();
  if (s === '-1') return new Fraction(-1);
  if (s.includes('/')) {
    const [n, d] = s.split('/').map(Number);
    return new Fraction(n, d);
  }
  return new Fraction(Number(s));
}

function fracStr(f) {
  if (f.den === 1) return String(f.num);
  return `${f.num}/${f.den}`;
}

function matToJSON(m) {
  return m.map(row => row.map(f => f.toJSON()));
}

// ============== Operations ==============

// Addition
function matAdd(a, b) {
  const r = a.length, c = a[0].length;
  const res = createMatrix(r, c);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      res[i][j] = a[i][j].add(b[i][j]);
  return res;
}

// Subtraction
function matSub(a, b) {
  const r = a.length, c = a[0].length;
  const res = createMatrix(r, c);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      res[i][j] = a[i][j].sub(b[i][j]);
  return res;
}

// Scalar multiplication
function matScale(m, s) {
  return m.map(row => row.map(f => f.mul(s)));
}

// Multiplication
function matMul(a, b) {
  const r = a.length, n = a[0].length, c = b[0].length;
  const res = createMatrix(r, c);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      for (let k = 0; k < n; k++)
        res[i][j] = res[i][j].add(a[i][k].mul(b[k][j]));
  return res;
}

// Transpose
function matTranspose(m) {
  const r = m.length, c = m[0].length;
  const res = createMatrix(c, r);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      res[j][i] = m[i][j];
  return res;
}

// Trace
function matTrace(m) {
  const n = Math.min(m.length, m[0].length);
  let t = F0();
  for (let i = 0; i < n; i++) t = t.add(m[i][i]);
  return t;
}

// Row Echelon Form (with steps)
function matREF(m) {
  const rows = m.length, cols = m[0].length;
  const data = cloneMatrix(m);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(data) }];

  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    // Find pivot
    let best = -1;
    for (let row = pivotRow; row < rows; row++) {
      if (!data[row][col].isZero()) { best = row; break; }
    }
    if (best === -1) continue;

    // Swap
    if (best !== pivotRow) {
      [data[pivotRow], data[best]] = [data[best], data[pivotRow]];
      steps.push({ index: steps.length + 1, desc: `交换第${pivotRow + 1}行和第${best + 1}行`, matrix: matToJSON(data) });
    }

    // Scale pivot
    const pivot = data[pivotRow][col];
    if (!pivot.equals(F1())) {
      for (let j = col; j < cols; j++) data[pivotRow][j] = data[pivotRow][j].div(pivot);
      steps.push({ index: steps.length + 1, desc: `第${pivotRow + 1}行 × ${fracStr(new Fraction(pivot.den, pivot.num))}`, matrix: matToJSON(data) });
    }

    // Eliminate below
    for (let row = pivotRow + 1; row < rows; row++) {
      const factor = data[row][col];
      if (factor.isZero()) continue;
      for (let j = col; j < cols; j++)
        data[row][j] = data[row][j].sub(factor.mul(data[pivotRow][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(factor)})×第${pivotRow + 1}行`, matrix: matToJSON(data) });
    }
    pivotRow++;
  }
  return { result: data, steps };
}

// Reduced Row Echelon Form (with steps)
function matRREF(m) {
  const rows = m.length, cols = m[0].length;
  const data = cloneMatrix(m);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(data) }];

  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let best = -1;
    for (let row = pivotRow; row < rows; row++) {
      if (!data[row][col].isZero()) { best = row; break; }
    }
    if (best === -1) continue;

    if (best !== pivotRow) {
      [data[pivotRow], data[best]] = [data[best], data[pivotRow]];
      steps.push({ index: steps.length + 1, desc: `交换第${pivotRow + 1}行和第${best + 1}行`, matrix: matToJSON(data) });
    }

    const pivot = data[pivotRow][col];
    if (!pivot.equals(F1())) {
      for (let j = col; j < cols; j++) data[pivotRow][j] = data[pivotRow][j].div(pivot);
      steps.push({ index: steps.length + 1, desc: `第${pivotRow + 1}行 × ${fracStr(new Fraction(pivot.den, pivot.num))}`, matrix: matToJSON(data) });
    }

    // Eliminate all other rows
    for (let row = 0; row < rows; row++) {
      if (row === pivotRow) continue;
      const factor = data[row][col];
      if (factor.isZero()) continue;
      for (let j = col; j < cols; j++)
        data[row][j] = data[row][j].sub(factor.mul(data[pivotRow][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(factor)})×第${pivotRow + 1}行`, matrix: matToJSON(data) });
    }
    pivotRow++;
  }
  return { result: data, steps };
}

// Determinant (with steps, cofactor expansion)
function matDet(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, steps: [], error: '行列式要求方阵' };

  const steps = [];

  function det(mat, depth) {
    const sz = mat.length;
    if (sz === 1) return { val: mat[0][0], steps: [] };

    if (sz === 2) {
      const val = mat[0][0].mul(mat[1][1]).sub(mat[0][1].mul(mat[1][0]));
      return { val, steps: [] };
    }

    let result = F0();
    const subSteps = [];

    for (let j = 0; j < sz; j++) {
      const sign = j % 2 === 0 ? 1 : -1;
      const coeff = sign === 1 ? mat[0][j] : mat[0][j].neg();
      if (coeff.isZero()) continue;

      // Build minor
      const minor = [];
      for (let r = 1; r < sz; r++) {
        const row = [];
        for (let c = 0; c < sz; c++) {
          if (c !== j) row.push(mat[r][c]);
        }
        minor.push(row);
      }

      const { val: minorVal } = det(minor, depth + 1);
      const term = coeff.mul(minorVal);
      result = result.add(term);
    }

    return { val: result, steps: subSteps };
  }

  // Use row reduction for determinant (more efficient with steps)
  const data = cloneMatrix(m);
  let swapCount = 0;
  let scaleProduct = F1();

  steps.push({ index: 1, desc: '初始矩阵', matrix: matToJSON(data) });

  for (let i = 0; i < n; i++) {
    // Find pivot
    let best = -1;
    for (let row = i; row < n; row++) {
      if (!data[row][i].isZero()) { best = row; break; }
    }
    if (best === -1) {
      return { result: F0(), steps: [...steps, { index: steps.length + 1, desc: '存在全零列，行列式 = 0', matrix: matToJSON(data) }] };
    }

    if (best !== i) {
      [data[i], data[best]] = [data[best], data[i]];
      swapCount++;
      steps.push({ index: steps.length + 1, desc: `交换第${i + 1}行和第${best + 1}行 (符号变号)`, matrix: matToJSON(data) });
    }

    const pivot = data[i][i];
    // Don't scale - just eliminate

    for (let row = i + 1; row < n; row++) {
      const factor = data[row][i];
      if (factor.isZero()) continue;
      // row = row - (factor/pivot) * pivotRow
      const ratio = factor.div(pivot);
      for (let j = i; j < n; j++)
        data[row][j] = data[row][j].sub(ratio.mul(data[i][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(ratio)})×第${i + 1}行`, matrix: matToJSON(data) });
    }
  }

  // Determinant = product of diagonal * (-1)^swaps
  let detVal = F1();
  for (let i = 0; i < n; i++) detVal = detVal.mul(data[i][i]);
  if (swapCount % 2 !== 0) detVal = detVal.neg();

  let desc = `对角线乘积 = ${fracStr(detVal.abs())}`;
  if (swapCount % 2 !== 0) desc += `，交换${swapCount}次行，变号`;
  else if (swapCount > 0) desc += `，交换${swapCount}次行，符号不变`;
  steps.push({ index: steps.length + 1, desc, matrix: matToJSON(data) });

  return { result: detVal, steps };
}

// Inverse (Gauss-Jordan with steps)
function matInverse(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, steps: [], error: '求逆要求方阵' };

  // Augment [A | I]
  const aug = createMatrix(n, 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) aug[i][j] = m[i][j];
    aug[i][n + i] = F1();
  }

  const steps = [{ index: 1, desc: '构造增广矩阵 [A | I]', matrix: matToJSON(aug) }];

  for (let i = 0; i < n; i++) {
    let best = -1;
    for (let row = i; row < n; row++) {
      if (!aug[row][i].isZero()) { best = row; break; }
    }
    if (best === -1) return { result: null, steps: [...steps, { index: steps.length + 1, desc: '矩阵不可逆（行列式为0）', matrix: matToJSON(aug) }], error: '矩阵不可逆' };

    if (best !== i) {
      [aug[i], aug[best]] = [aug[best], aug[i]];
      steps.push({ index: steps.length + 1, desc: `交换第${i + 1}行和第${best + 1}行`, matrix: matToJSON(aug) });
    }

    const pivot = aug[i][i];
    if (!pivot.equals(F1())) {
      for (let j = 0; j < 2 * n; j++) aug[i][j] = aug[i][j].div(pivot);
      steps.push({ index: steps.length + 1, desc: `第${i + 1}行 × ${fracStr(new Fraction(pivot.den, pivot.num))}`, matrix: matToJSON(aug) });
    }

    for (let row = 0; row < n; row++) {
      if (row === i) continue;
      const factor = aug[row][i];
      if (factor.isZero()) continue;
      for (let j = 0; j < 2 * n; j++)
        aug[row][j] = aug[row][j].sub(factor.mul(aug[i][j]));
      steps.push({ index: steps.length + 1, desc: `第${row + 1}行 - (${fracStr(factor)})×第${i + 1}行`, matrix: matToJSON(aug) });
    }
  }

  // Extract inverse
  const inv = createMatrix(n, n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      inv[i][j] = aug[i][n + j];

  steps.push({ index: steps.length + 1, desc: '提取右侧即为逆矩阵 A⁻¹', matrix: matToJSON(inv) });
  return { result: inv, steps };
}

// Rank (with steps)
function matRank(m) {
  const { result, steps } = matREF(m);
  let rank = 0;
  for (let i = 0; i < result.length; i++) {
    let nonzero = false;
    for (let j = 0; j < result[0].length; j++) {
      if (!result[i][j].isZero()) { nonzero = true; break; }
    }
    if (nonzero) rank++;
  }
  return { result: Fn(rank), steps, refMatrix: matToJSON(result) };
}

// Adjugate (cofactor matrix transpose)
function matAdjugate(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, error: '伴随矩阵要求方阵' };

  const cofactors = createMatrix(n, n);
  const steps = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Minor
      const minor = [];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const row = [];
        for (let c = 0; c < n; c++) {
          if (c === j) continue;
          row.push(m[r][c]);
        }
        minor.push(row);
      }
      const { result: minorDet } = matDet(minor);
      const sign = (i + j) % 2 === 0 ? 1 : -1;
      cofactors[i][j] = sign === 1 ? minorDet : minorDet.neg();
    }
  }

  steps.push({ index: 1, desc: '余子式矩阵', matrix: matToJSON(cofactors) });
  const adj = matTranspose(cofactors);
  steps.push({ index: 2, desc: '伴随矩阵 = 余子式矩阵的转置', matrix: matToJSON(adj) });

  return { result: adj, steps };
}

// Cofactor matrix
function matCofactor(m) {
  const n = m.length;
  if (n !== m[0].length) return { result: null, error: '余子式矩阵要求方阵' };

  const cofactors = createMatrix(n, n);
  const steps = [{ index: 1, desc: '初始矩阵', matrix: matToJSON(m) }];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const minor = [];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const row = [];
        for (let c = 0; c < n; c++) {
          if (c === j) continue;
          row.push(m[r][c]);
        }
        minor.push(row);
      }
      const { result: minorDet } = matDet(minor);
      const sign = (i + j) % 2 === 0 ? 1 : -1;
      cofactors[i][j] = sign === 1 ? minorDet : minorDet.neg();
    }
  }

  steps.push({ index: 2, desc: '余子式矩阵 C', matrix: matToJSON(cofactors) });
  return { result: cofactors, steps };
}

// ============== Proofs ===============
function matEquals(a, b) {
  if (a.length !== b.length || a[0].length !== b[0].length) return false;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a[0].length; j++)
      if (!a[i][j].equals(b[i][j])) return false;
  return true;
}

function identity(n) {
  const m = createMatrix(n, n);
  for (let i = 0; i < n; i++) m[i][i] = F1();
  return m;
}

function isIdentity(m) {
  return matEquals(m, identity(m.length));
}

const PROOFS = {
  'transpose-mul': {
    name: '(AB)ᵀ = BᵀAᵀ',
    needB: true,
    prove(a, b) {
      const steps = [];
      const ab = matMul(a, b);
      steps.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
      const lhs = matTranspose(ab);
      steps.push({ index: 2, desc: '左边 = (AB)ᵀ', matrix: matToJSON(lhs) });
      const at = matTranspose(a), bt = matTranspose(b);
      steps.push({ index: 3, desc: '计算 Bᵀ 和 Aᵀ', matrix: matToJSON(bt) });
      const rhs = matMul(bt, at);
      steps.push({ index: 4, desc: '右边 = BᵀAᵀ', matrix: matToJSON(rhs) });
      const eq = matEquals(lhs, rhs);
      return { steps, conclusion: eq ? '✓ (AB)ᵀ = BᵀAᵀ 成立' : '✗ 不相等', proved: eq };
    }
  },
  'transpose-add': {
    name: '(A+B)ᵀ = Aᵀ + Bᵀ',
    needB: true,
    prove(a, b) {
      const steps = [];
      const lhs = matTranspose(matAdd(a, b));
      steps.push({ index: 1, desc: '左边 = (A+B)ᵀ', matrix: matToJSON(lhs) });
      const rhs = matAdd(matTranspose(a), matTranspose(b));
      steps.push({ index: 2, desc: '右边 = Aᵀ + Bᵀ', matrix: matToJSON(rhs) });
      const eq = matEquals(lhs, rhs);
      return { steps, conclusion: eq ? '✓ (A+B)ᵀ = Aᵀ + Bᵀ 成立' : '✗ 不相等', proved: eq };
    }
  },
  'transpose-transpose': {
    name: '(Aᵀ)ᵀ = A',
    needB: false,
    prove(a) {
      const steps = [];
      const at = matTranspose(a);
      steps.push({ index: 1, desc: '计算 Aᵀ', matrix: matToJSON(at) });
      const lhs = matTranspose(at);
      steps.push({ index: 2, desc: '计算 (Aᵀ)ᵀ', matrix: matToJSON(lhs) });
      const eq = matEquals(lhs, a);
      return { steps, conclusion: eq ? '✓ (Aᵀ)ᵀ = A 成立' : '✗ 不相等', proved: eq };
    }
  },
  'inverse-mul': {
    name: 'A·A⁻¹ = I',
    needB: false,
    needSquare: true,
    prove(a) {
      const steps = [];
      const inv = matInverse(a);
      if (inv.error) return { steps: inv.steps, conclusion: '✗ 矩阵不可逆', proved: false };
      steps.push(...inv.steps);
      const lhs = matMul(a, inv.result);
      steps.push({ index: steps.length + 1, desc: '计算 A·A⁻¹', matrix: matToJSON(lhs) });
      const eq = isIdentity(lhs);
      return { steps, conclusion: eq ? '✓ A·A⁻¹ = I 成立' : '✗ 不等于单位阵', proved: eq };
    }
  },
  'inverse-mul-reverse': {
    name: '(AB)⁻¹ = B⁻¹A⁻¹',
    needB: true,
    needSquare: true,
    prove(a, b) {
      const steps = [];
      const ab = matMul(a, b);
      steps.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
      const invAB = matInverse(ab);
      if (invAB.error) return { steps, conclusion: '✗ AB不可逆', proved: false };
      steps.push({ index: 2, desc: '左边 = (AB)⁻¹', matrix: matToJSON(invAB.result) });
      const invA = matInverse(a), invB = matInverse(b);
      if (invA.error || invB.error) return { steps, conclusion: '✗ A或B不可逆', proved: false };
      const rhs = matMul(invB.result, invA.result);
      steps.push({ index: 3, desc: '右边 = B⁻¹A⁻¹', matrix: matToJSON(rhs) });
      const eq = matEquals(invAB.result, rhs);
      return { steps, conclusion: eq ? '✓ (AB)⁻¹ = B⁻¹A⁻¹ 成立' : '✗ 不相等', proved: eq };
    }
  },
  'det-mul': {
    name: 'det(AB) = det(A)·det(B)',
    needB: true,
    needSquare: true,
    prove(a, b) {
      const steps = [];
      const ab = matMul(a, b);
      steps.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
      const detAB = matDet(ab);
      steps.push(...detAB.steps);
      steps.push({ index: steps.length + 1, desc: `det(AB) = ${fracStr(detAB.result)}`, matrix: matToJSON(ab) });
      const detA = matDet(a), detB = matDet(b);
      const rhs = detA.result.mul(detB.result);
      steps.push({ index: steps.length + 1, desc: `det(A)·det(B) = ${fracStr(detA.result)} × ${fracStr(detB.result)} = ${fracStr(rhs)}`, matrix: matToJSON(a) });
      const eq = detAB.result.equals(rhs);
      return { steps, conclusion: eq ? '✓ det(AB) = det(A)·det(B) 成立' : '✗ 不相等', proved: eq };
    }
  },
  'det-transpose': {
    name: 'det(Aᵀ) = det(A)',
    needB: false,
    needSquare: true,
    prove(a) {
      const steps = [];
      const detA = matDet(a);
      steps.push(...detA.steps);
      steps.push({ index: steps.length + 1, desc: `det(A) = ${fracStr(detA.result)}`, matrix: matToJSON(a) });
      const at = matTranspose(a);
      const detAT = matDet(at);
      steps.push({ index: steps.length + 1, desc: `det(Aᵀ) = ${fracStr(detAT.result)}`, matrix: matToJSON(at) });
      const eq = detA.result.equals(detAT.result);
      return { steps, conclusion: eq ? '✓ det(Aᵀ) = det(A) 成立' : '✗ 不相等', proved: eq };
    }
  },
  'det-scalar': {
    name: 'det(kA) = kⁿ·det(A)',
    needB: false,
    needSquare: true,
    needScalar: true,
    prove(a, b, k) {
      const steps = [];
      const n = a.length;
      const detA = matDet(a);
      steps.push(...detA.steps);
      steps.push({ index: steps.length + 1, desc: `det(A) = ${fracStr(detA.result)}`, matrix: matToJSON(a) });
      const kA = matScale(a, k);
      const detkA = matDet(kA);
      steps.push(...detkA.steps);
      steps.push({ index: steps.length + 1, desc: `det(kA) = ${fracStr(detkA.result)}`, matrix: matToJSON(kA) });
      const kn = Math.pow(k.toNumber(), n);
      const rhs = detA.result.mul(new Fraction(kn));
      steps.push({ index: steps.length + 1, desc: `kⁿ·det(A) = ${fracStr(k)}^${n} × ${fracStr(detA.result)} = ${fracStr(rhs)}`, matrix: matToJSON(a) });
      const eq = detkA.result.equals(rhs);
      return { steps, conclusion: eq ? '✓ det(kA) = kⁿ·det(A) 成立' : '✗ 不相等', proved: eq };
    }
  },
  'trace-mul': {
    name: 'tr(AB) = tr(BA)',
    needB: true,
    prove(a, b) {
      const steps = [];
      const ab = matMul(a, b), ba = matMul(b, a);
      steps.push({ index: 1, desc: '计算 AB', matrix: matToJSON(ab) });
      steps.push({ index: 2, desc: '计算 BA', matrix: matToJSON(ba) });
      const trAB = matTrace(ab), trBA = matTrace(ba);
      steps.push({ index: 3, desc: `tr(AB) = ${fracStr(trAB)}，tr(BA) = ${fracStr(trBA)}`, matrix: matToJSON(ab) });
      const eq = trAB.equals(trBA);
      return { steps, conclusion: eq ? '✓ tr(AB) = tr(BA) 成立' : '✗ 不相等', proved: eq };
    }
  },
  'trace-add': {
    name: 'tr(A+B) = tr(A) + tr(B)',
    needB: true,
    needSquare: true,
    prove(a, b) {
      const steps = [];
      const trA = matTrace(a), trB = matTrace(b);
      const trAB = matTrace(matAdd(a, b));
      const rhs = trA.add(trB);
      steps.push({ index: 1, desc: `tr(A) = ${fracStr(trA)}，tr(B) = ${fracStr(trB)}`, matrix: matToJSON(a) });
      steps.push({ index: 2, desc: `tr(A+B) = ${fracStr(trAB)}，tr(A)+tr(B) = ${fracStr(rhs)}`, matrix: matToJSON(matAdd(a, b)) });
      const eq = trAB.equals(rhs);
      return { steps, conclusion: eq ? '✓ tr(A+B) = tr(A)+tr(B) 成立' : '✗ 不相等', proved: eq };
    }
  },
  'adjugate-mul': {
    name: 'A·adj(A) = det(A)·I',
    needB: false,
    needSquare: true,
    prove(a) {
      const steps = [];
      const adj = matAdjugate(a);
      if (adj.error) return { steps, conclusion: '✗ ' + adj.error, proved: false };
      steps.push(...adj.steps);
      const lhs = matMul(a, adj.result);
      steps.push({ index: steps.length + 1, desc: '计算 A·adj(A)', matrix: matToJSON(lhs) });
      const detA = matDet(a);
      const rhs = matScale(identity(a.length), detA.result);
      steps.push({ index: steps.length + 1, desc: `det(A)·I = ${fracStr(detA.result)}·I`, matrix: matToJSON(rhs) });
      const eq = matEquals(lhs, rhs);
      return { steps, conclusion: eq ? '✓ A·adj(A) = det(A)·I 成立' : '✗ 不相等', proved: eq };
    }
  },
  'det-trace-2x2': {
    name: '2×2特征多项式',
    needB: false,
    needSquare: true,
    prove(a) {
      if (a.length !== 2) return { steps: [], conclusion: '✗ 仅支持2×2矩阵', proved: false };
      const steps = [];
      const detA = matDet(a);
      const trA = matTrace(a);
      steps.push({ index: 1, desc: `det(A) = ${fracStr(detA.result)}`, matrix: matToJSON(a) });
      steps.push({ index: 2, desc: `tr(A) = ${fracStr(trA)}`, matrix: matToJSON(a) });
      steps.push({ index: 3, desc: `特征多项式: λ² - (${fracStr(trA)})λ + (${fracStr(detA.result)}) = 0`, matrix: matToJSON(a) });
      return { steps, conclusion: `λ² - ${fracStr(trA)}λ + ${fracStr(detA.result)} = 0`, proved: true };
    }
  }
};

function parseMatrix(matrix, rows, cols) {
  const data = [];
  let idx = 0;
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      row.push(parseNum(matrix[idx]));
      idx++;
    }
    data.push(row);
  }
  return data;
}

function handleAPI(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const input = JSON.parse(body);
      const { op, rows, cols, matrix, rows2, cols2, matrix2, scalar } = input;
      let response = {};

      const m = matrix ? parseMatrix(matrix, rows, cols) : null;
      const m2 = matrix2 ? parseMatrix(matrix2, rows2 || rows, cols2 || cols) : null;

      switch (op) {
        case 'rref': {
          const r = matRREF(m);
          response = { steps: r.steps, result: matToJSON(r.result) };
          break;
        }
        case 'ref': {
          const r = matREF(m);
          response = { steps: r.steps, result: matToJSON(r.result) };
          break;
        }
        case 'det': {
          const r = matDet(m);
          response = { steps: r.steps, result: r.result ? r.result.toJSON() : null, error: r.error };
          break;
        }
        case 'inverse': {
          const r = matInverse(m);
          response = { steps: r.steps, result: r.result ? matToJSON(r.result) : null, error: r.error };
          break;
        }
        case 'transpose': {
          const r = matTranspose(m);
          response = { steps: [{ index: 1, desc: '转置结果', matrix: matToJSON(r) }], result: matToJSON(r) };
          break;
        }
        case 'multiply': {
          if (!m2) { response = { error: '需要第二个矩阵' }; break; }
          const r = matMul(m, m2);
          response = { steps: [{ index: 1, desc: '乘法结果', matrix: matToJSON(r) }], result: matToJSON(r) };
          break;
        }
        case 'add': {
          if (!m2) { response = { error: '需要第二个矩阵' }; break; }
          const r = matAdd(m, m2);
          response = { steps: [{ index: 1, desc: '加法结果', matrix: matToJSON(r) }], result: matToJSON(r) };
          break;
        }
        case 'subtract': {
          if (!m2) { response = { error: '需要第二个矩阵' }; break; }
          const r = matSub(m, m2);
          response = { steps: [{ index: 1, desc: '减法结果', matrix: matToJSON(r) }], result: matToJSON(r) };
          break;
        }
        case 'scalar-mul': {
          const s = parseNum(scalar || '1');
          const r = matScale(m, s);
          response = { steps: [{ index: 1, desc: `${fracStr(s)} × A 的结果`, matrix: matToJSON(r) }], result: matToJSON(r) };
          break;
        }
        case 'rank': {
          const r = matRank(m);
          response = { steps: r.steps, result: r.result.toJSON(), refMatrix: r.refMatrix };
          break;
        }
        case 'trace': {
          const r = matTrace(m);
          response = { steps: [{ index: 1, desc: `迹 = 对角线元素之和`, matrix: matToJSON(m) }], result: r.toJSON() };
          break;
        }
        case 'adjugate': {
          const r = matAdjugate(m);
          response = { steps: r.steps, result: r.result ? matToJSON(r.result) : null, error: r.error };
          break;
        }
        case 'cofactor': {
          const r = matCofactor(m);
          response = { steps: r.steps, result: r.result ? matToJSON(r.result) : null, error: r.error };
          break;
        }
        case 'proof': {
          const { proofId } = input;
          const proof = PROOFS[proofId];
          if (!proof) { response = { error: '未知证明题' }; break; }
          const k = scalar ? parseNum(scalar) : F1();
          const r = proof.prove(m, m2, k);
          response = { steps: r.steps, conclusion: r.conclusion, proved: r.proved, proofName: proof.name };
          break;
        }
        default:
          response = { error: '未知操作' };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

// ============== Server ==============
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(path.join(__dirname, 'static', 'index.html'), (err, data) => {
      if (err) { res.writeHead(500); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/static/')) {
    const filePath = path.join(__dirname, req.url);
    const ext = path.extname(filePath);
    const mimes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/calc') {
    handleAPI(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 6130;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on :${PORT}`));
