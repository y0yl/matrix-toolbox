document.addEventListener('DOMContentLoaded', () => {
  const btnCreate = document.getElementById('btn-create');
  const btnReduce = document.getElementById('btn-reduce');
  const btnClear = document.getElementById('btn-clear');
  const btnExample = document.getElementById('btn-example');
  const matrixSection = document.getElementById('matrix-section');
  const resultSection = document.getElementById('result-section');
  const matrixTable = document.getElementById('matrix-table');
  const stepsContainer = document.getElementById('steps-container');

  let rows = 3, cols = 4;

  btnCreate.addEventListener('click', createMatrix);
  btnReduce.addEventListener('click', doReduce);
  btnClear.addEventListener('click', clearMatrix);
  btnExample.addEventListener('click', fillExample);

  // Enter key triggers creation
  document.getElementById('rows').addEventListener('keydown', e => {
    if (e.key === 'Enter') createMatrix();
  });
  document.getElementById('cols').addEventListener('keydown', e => {
    if (e.key === 'Enter') createMatrix();
  });

  function createMatrix() {
    rows = parseInt(document.getElementById('rows').value) || 3;
    cols = parseInt(document.getElementById('cols').value) || 4;
    if (rows < 1 || rows > 10) rows = 3;
    if (cols < 1 || cols > 10) cols = 4;

    matrixTable.innerHTML = '';
    for (let i = 0; i < rows; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < cols; j++) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '0';
        input.dataset.row = i;
        input.dataset.col = j;
        input.addEventListener('focus', () => {
          if (input.value === '0') input.value = '';
        });
        input.addEventListener('blur', () => {
          if (input.value.trim() === '') input.value = '0';
        });
        td.appendChild(input);
        tr.appendChild(td);
      }
      matrixTable.appendChild(tr);
    }
    matrixSection.style.display = 'block';
    resultSection.style.display = 'none';
  }

  function clearMatrix() {
    const inputs = matrixTable.querySelectorAll('input');
    inputs.forEach(inp => inp.value = '0');
    resultSection.style.display = 'none';
  }

  function fillExample() {
    // Example: matrix with parameter
    const param = document.getElementById('param').value || 'a';
    const examples = {
      '3x4': [
        ['1', '2', '-1', '3'],
        ['2', '1', param, '1'],
        ['-1', '1', '2', param]
      ],
      '2x3': [
        ['1', param, '2'],
        ['3', '1', '-1']
      ]
    };

    const key = `${rows}x${cols}`;
    let data = examples[key];

    if (!data) {
      // Generate a simple example
      data = [];
      for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
          if (i === j) row.push('1');
          else if (j === cols - 1 && i === 1) row.push(param);
          else row.push(String(Math.floor(Math.random() * 5) - 2));
        }
        data.push(row);
      }
    }

    // Ensure matrix is created first
    if (matrixSection.style.display === 'none') {
      createMatrix();
    }

    const inputs = matrixTable.querySelectorAll('input');
    let idx = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (data[i] && data[i][j] !== undefined) {
          inputs[idx].value = data[i][j];
        }
        idx++;
      }
    }
  }

  async function doReduce() {
    const inputs = matrixTable.querySelectorAll('input');
    const matrix = [];
    inputs.forEach(inp => matrix.push(inp.value.trim() || '0'));

    // Disable button
    btnReduce.disabled = true;
    btnReduce.textContent = '计算中...';

    try {
      const resp = await fetch('/api/reduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, cols, matrix })
      });

      const data = await resp.json();

      if (data.error) {
        stepsContainer.innerHTML = `<div class="error">${data.error}</div>`;
        resultSection.style.display = 'block';
        return;
      }

      renderSteps(data.steps);
      resultSection.style.display = 'block';
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      stepsContainer.innerHTML = `<div class="error">请求失败：${err.message}</div>`;
      resultSection.style.display = 'block';
    } finally {
      btnReduce.disabled = false;
      btnReduce.textContent = '开始化简';
    }
  }

  function formatEntry(e) {
    // Format an entry object for display
    if (!e) return '0';

    const c = e.const;
    const p = e.coeff;

    const cZero = c.num === 0;
    const pZero = p.num === 0;

    if (cZero && pZero) return '0';

    let parts = [];

    // Constant part
    if (!cZero) {
      parts.push(fracStr(c));
    }

    // Param part
    if (!pZero) {
      let coeffStr = '';
      if (p.num === 1 && p.den === 1) {
        coeffStr = 'a';
      } else if (p.num === -1 && p.den === 1) {
        coeffStr = '-a';
      } else if (p.den === 1) {
        coeffStr = p.num + 'a';
      } else {
        coeffStr = `(${fracStr(p)})a`;
      }

      if (cZero) {
        return coeffStr;
      }

      // Combine with sign
      if (p.num > 0) {
        return parts[0] + '+' + coeffStr;
      } else {
        return parts[0] + coeffStr; // already has minus
      }
    }

    return parts[0];
  }

  function fracStr(f) {
    if (f.den === 1) return String(f.num);
    return f.num + '/' + f.den;
  }

  function renderSteps(steps) {
    stepsContainer.innerHTML = '';

    steps.forEach((step, idx) => {
      const div = document.createElement('div');
      div.className = 'step' + (step.desc === '初始矩阵' ? ' initial' : '');

      // Header
      const header = document.createElement('div');
      header.className = 'step-header';
      header.innerHTML = `
        <span class="step-num">${step.index}</span>
        <span class="step-desc">${step.desc}</span>
      `;
      div.appendChild(header);

      // Matrix
      const matrixDiv = document.createElement('div');
      matrixDiv.className = 'step-matrix';

      const table = document.createElement('table');
      step.matrix.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
          const td = document.createElement('td');
          const text = formatEntry(cell);
          td.textContent = text;

          if (text === '0') td.classList.add('zero');
          if (text.includes('a')) td.classList.add('has-param');
          if (text === '1' || text === '-1') td.classList.add('is-one');

          tr.appendChild(td);
        });
        table.appendChild(tr);
      });

      matrixDiv.appendChild(table);
      div.appendChild(matrixDiv);
      stepsContainer.appendChild(div);
    });
  }

  // Auto-create matrix on load
  createMatrix();
});
