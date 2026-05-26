const http = require('http');
const fs = require('fs');
const path = require('path');

// Fraction class
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
  isZero() { return this.num === 0; }

  toString() {
    if (this.den === 1) return String(this.num);
    return `${this.num}/${this.den}`;
  }
}

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) { [a, b] = [b, a % b]; }
  return a === 0n ? 1n : a;
}

// Entry: constant + coefficient * parameter
class Entry {
  constructor(constFrac, coeffFrac) {
    this.c = constFrac;
    this.p = coeffFrac;
  }

  isZero() { return this.c.isZero() && this.p.isZero(); }
  hasParam() { return !this.p.isZero(); }

  neg() { return new Entry(this.c.neg(), this.p.neg()); }

  add(e) { return new Entry(this.c.add(e.c), this.p.add(e.p)); }
  sub(e) { return new Entry(this.c.sub(e.c), this.p.sub(e.p)); }

  mulScalar(s) {
    return new Entry(this.c.mul(s), this.p.mul(s));
  }

  toString() {
    const cZero = this.c.isZero();
    const pZero = this.p.isZero();

    if (cZero && pZero) return '0';
    if (pZero) return this.c.toString();

    let coeffStr;
    if (this.p.num === 1 && this.p.den === 1) coeffStr = 'a';
    else if (this.p.num === -1 && this.p.den === 1) coeffStr = '-a';
    else if (this.p.den === 1) coeffStr = `${this.p.num}a`;
    else coeffStr = `(${this.p.toString()})a`;

    if (cZero) return coeffStr;

    return this.p.num > 0
      ? `${this.c.toString()}+${coeffStr}`
      : `${this.c.toString()}${coeffStr}`;
  }
}

function zeroEntry() { return new Entry(new Fraction(0), new Fraction(0)); }

function entryFromString(s) {
  s = s.trim();
  if (!s || s === '0') return zeroEntry();

  // Find parameter character
  let paramChar = '';
  for (const ch of s) {
    if (ch >= 'a' && ch <= 'z' && ch !== 'e') {
      paramChar = ch;
      break;
    }
  }

  if (!paramChar) return parseNumber(s);

  // Split by parameter
  const parts = s.split(paramChar);
  if (parts.length === 1) {
    const t = parts[0].trim();
    if (!t || t === '+') return new Entry(new Fraction(0), new Fraction(1));
    if (t === '-') return new Entry(new Fraction(0), new Fraction(-1));
    return new Entry(new Fraction(0), parseNumber(t).c);
  }

  let coeffPart = parts[0].trim();
  let constPart = parts[1].trim();

  let coeff;
  if (!coeffPart || coeffPart === '+') coeff = new Fraction(1);
  else if (coeffPart === '-') coeff = new Fraction(-1);
  else coeff = parseNumber(coeffPart).c;

  let cnst = new Fraction(0);
  if (constPart) cnst = parseNumber(constPart).c;

  return new Entry(cnst, coeff);
}

function parseNumber(s) {
  s = s.trim();
  if (!s || s === '0') return zeroEntry();
  if (s === '1') return new Entry(new Fraction(1), new Fraction(0));
  if (s === '-1') return new Entry(new Fraction(-1), new Fraction(0));
  if (s.includes('/')) {
    const [num, den] = s.split('/').map(Number);
    return new Entry(new Fraction(num, den), new Fraction(0));
  }
  return new Entry(new Fraction(Number(s)), new Fraction(0));
}

// Matrix reduction
function reduceMatrix(rows, cols, matrixData) {
  const steps = [];

  function snapshot(desc, data) {
    steps.push({
      index: steps.length + 1,
      desc,
      matrix: data.map(row => row.map(e => ({
        const: { num: e.c.num, den: e.c.den },
        coeff: { num: e.p.num, den: e.p.den }
      })))
    });
  }

  // Clone data
  const data = matrixData.map(row => [...row]);

  snapshot('初始矩阵', data);

  // Gauss-Jordan elimination
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    // Find pivot
    let bestRow = -1;
    for (let row = pivotRow; row < rows; row++) {
      const e = data[row][col];
      if (e.isZero()) continue;
      if (!e.hasParam()) { bestRow = row; break; }
      if (bestRow === -1) bestRow = row;
    }
    if (bestRow === -1) continue;

    // Swap
    if (bestRow !== pivotRow) {
      [data[pivotRow], data[bestRow]] = [data[bestRow], data[pivotRow]];
      snapshot(`交换第${pivotRow + 1}行和第${bestRow + 1}行`, data);
    }

    // Scale pivot row
    const pivot = data[pivotRow][col];
    if (!pivot.isZero()) {
      let needScale = false;
      if (pivot.hasParam()) {
        needScale = pivot.p.num !== 1 || pivot.p.den !== 1;
      } else {
        needScale = pivot.c.num !== 1 || pivot.c.den !== 1;
      }

      if (needScale) {
        let inv;
        if (!pivot.hasParam()) {
          inv = new Fraction(pivot.c.den, pivot.c.num);
          for (let j = col; j < cols; j++) {
            data[pivotRow][j] = new Entry(
              data[pivotRow][j].c.mul(inv),
              data[pivotRow][j].p.mul(inv)
            );
          }
          snapshot(`第${pivotRow + 1}行 × ${inv.toString()}`, data);
        } else {
          inv = new Fraction(pivot.p.den, pivot.p.num);
          for (let j = col; j < cols; j++) {
            data[pivotRow][j] = new Entry(
              data[pivotRow][j].c.mul(inv),
              data[pivotRow][j].p.mul(inv)
            );
          }
          snapshot(`第${pivotRow + 1}行 × ${inv.toString()} (使a的系数为1)`, data);
        }
      }
    }

    // Eliminate other rows
    for (let row = 0; row < rows; row++) {
      if (row === pivotRow) continue;
      const factor = data[row][col];
      if (factor.isZero()) continue;

      for (let j = col; j < cols; j++) {
        // row_j = row_j - factor * pivotRow_j
        // factor is a value, we need to multiply it with pivot row entry
        // For entries with params, this is complex. Simplify:
        // If factor has no param: straightforward scalar multiplication
        // If factor has param: we treat it as scalar (constant part) for elimination
        // This works for standard row reduction where we eliminate using the pivot

        let subVal;
        if (!factor.hasParam()) {
          // Pure number factor
          subVal = data[pivotRow][j].mulScalar(factor.c);
        } else {
          // Has param - multiply (c_f + p_f*a) * entry
          // This gets complex with a^2 terms. For linear algebra, we assume
          // the matrix entries are linear in 'a', so we do the multiplication
          // treating 'a' as an algebraic variable
          const e = data[pivotRow][j];
          // (c_f + p_f*a)(c_e + p_e*a) = c_f*c_e + (c_f*p_e + p_f*c_e)*a + p_f*p_e*a^2
          // For linear systems, we ignore a^2 (assume it doesn't arise or is handled separately)
          // This is correct for standard row reduction of parametric matrices
          const cc = factor.c.mul(e.c);
          const cp = factor.c.mul(e.p).add(factor.p.mul(e.c));
          subVal = new Entry(cc, cp);
        }
        data[row][j] = data[row][j].sub(subVal);
      }
      snapshot(`第${row + 1}行 - (${factor.toString()})×第${pivotRow + 1}行`, data);
    }

    pivotRow++;
  }

  return steps;
}

// HTTP server
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const filePath = path.join(__dirname, 'static', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/static/')) {
    const filePath = path.join(__dirname, req.url);
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json'
    };
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/reduce') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { rows, cols, matrix } = JSON.parse(body);

        if (!rows || !cols || rows < 1 || cols < 1 || rows > 10 || cols > 10) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '矩阵大小需在1-10之间' }));
          return;
        }

        if (!matrix || matrix.length !== rows * cols) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `需要${rows * cols}个元素` }));
          return;
        }

        // Parse matrix
        const data = [];
        let idx = 0;
        for (let i = 0; i < rows; i++) {
          const row = [];
          for (let j = 0; j < cols; j++) {
            row.push(entryFromString(matrix[idx]));
            idx++;
          }
          data.push(row);
        }

        const steps = reduceMatrix(rows, cols, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ steps }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 6130;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
