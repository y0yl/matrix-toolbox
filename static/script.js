document.addEventListener('DOMContentLoaded', () => {
  const OPS = {
    basic: [
      { id: 'add', name: '加法 A+B', icon: '➕', needB: true },
      { id: 'subtract', name: '减法 A-B', icon: '➖', needB: true },
      { id: 'multiply', name: '乘法 A×B', icon: '✖️', needB: true },
      { id: 'scalar-mul', name: '数乘 kA', icon: '🔢', needScalar: true },
    ],
    transform: [
      { id: 'ref', name: '行阶梯形', icon: '📐', needSquare: false },
      { id: 'rref', name: '行最简形', icon: '✅', needSquare: false },
      { id: 'transpose', name: '转置 Aᵀ', icon: '↕️', needSquare: false },
      { id: 'inverse', name: '逆矩阵', icon: '🔄', needSquare: true },
    ],
    property: [
      { id: 'det', name: '行列式', icon: '📏', needSquare: true },
      { id: 'rank', name: '秩', icon: '📊', needSquare: false },
      { id: 'trace', name: '迹', icon: 'Σ', needSquare: true },
      { id: 'cofactor', name: '余子式', icon: '🧮', needSquare: true },
      { id: 'adjugate', name: '伴随矩阵', icon: '📋', needSquare: true },
      { id: 'eigen', name: '特征值/特征向量', icon: 'λ', needSquare: true },
    ],
    proof: [
      { id: 'transpose-mul', name: '(AB)ᵀ=BᵀAᵀ', icon: '↕️', proof: true, needB: true },
      { id: 'transpose-add', name: '(A+B)ᵀ=Aᵀ+Bᵀ', icon: '➕', proof: true, needB: true },
      { id: 'transpose-transpose', name: '(Aᵀ)ᵀ=A', icon: '🔄', proof: true },
      { id: 'inverse-mul', name: 'A·A⁻¹=I', icon: '✖️', proof: true, needSquare: true },
      { id: 'inverse-mul-reverse', name: '(AB)⁻¹=B⁻¹A⁻¹', icon: '🔀', proof: true, needB: true, needSquare: true },
      { id: 'det-mul', name: 'det(AB)=detA·detB', icon: '📏', proof: true, needB: true, needSquare: true },
      { id: 'det-transpose', name: 'det(Aᵀ)=detA', icon: '↕️', proof: true, needSquare: true },
      { id: 'det-scalar', name: 'det(kA)=kⁿdetA', icon: '🔢', proof: true, needSquare: true, needScalar: true },
      { id: 'trace-mul', name: 'tr(AB)=tr(BA)', icon: 'Σ', proof: true, needB: true },
      { id: 'trace-add', name: 'tr(A+B)=trA+trB', icon: 'Σ', proof: true, needB: true, needSquare: true },
      { id: 'adjugate-mul', name: 'A·adj(A)=detA·I', icon: '📋', proof: true, needSquare: true },
    ],
    ai: [
      { id: 'ai-solve', name: 'AI 线性代数解题', icon: '🤖', isAI: true },
    ],
    param: [
      { id: 'param-rref', name: '参数行最简形', icon: '📐', isParam: true },
      { id: 'param-ref', name: '参数行阶梯形', icon: '📋', isParam: true },
      { id: 'param-det', name: '参数行列式', icon: '📏', isParam: true, needSquare: true },
      { id: 'param-rank', name: '参数秩', icon: '📊', isParam: true },
    ]
  };

  let currentOp = 'rref', currentCat = 'transform';
  const opGrid = document.getElementById('op-grid');
  const sectionA = document.getElementById('section-a');
  const sectionB = document.getElementById('section-b');
  const sectionScalar = document.getElementById('section-scalar');
  const sectionAI = document.getElementById('section-ai');
  const resultSection = document.getElementById('result-section');
  const resultTitle = document.getElementById('result-title');
  const resultContent = document.getElementById('result-content');

  document.querySelectorAll('.op-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.op-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCat = tab.dataset.cat;
      renderOps();
      updateVisibility();
    });
  });

  function renderOps() {
    const ops = OPS[currentCat];
    opGrid.innerHTML = '';
    // 切换分类时默认选中第一个
    if (!ops.find(o => o.id === currentOp)) currentOp = ops[0]?.id;
    ops.forEach(op => {
      const btn = document.createElement('button');
      btn.className = 'op-btn' + (op.id === currentOp ? ' selected' : '');
      btn.innerHTML = `<span class="op-icon">${op.icon}</span>${op.name}`;
      btn.addEventListener('click', () => { currentOp = op.id; document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); updateVisibility(); });
      opGrid.appendChild(btn);
    });
    updateVisibility();
  }

  function updateVisibility() {
    const allOps = Object.values(OPS).flat();
    const op = allOps.find(o => o.id === currentOp);
    const isAI = op?.isAI;
    const isParam = op?.isParam;
    sectionA.style.display = (isAI || isParam) ? 'none' : 'block';
    sectionB.style.display = op?.needB ? 'block' : 'none';
    sectionScalar.style.display = op?.needScalar ? 'block' : 'none';
    sectionAI.style.display = isAI ? 'block' : 'none';
    document.getElementById('section-param').style.display = isParam ? 'block' : 'none';
    // 切换按钮文字
    const btnCalc = document.getElementById('btn-calc');
    btnCalc.textContent = isAI ? '开始解题' : (isParam ? '开始化简' : '计算');
    // 显示/隐藏符号面板按钮
    document.getElementById('btn-symbols').style.display = isAI ? 'inline-block' : 'none';
    if (!isAI) document.getElementById('symbol-panel').style.display = 'none';
  }

  function createTable(id, rows, cols) {
    const table = document.getElementById(id);
    table.innerHTML = '';
    for (let i = 0; i < rows; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < cols; j++) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text'; input.value = '0';
        input.addEventListener('focus', () => { if (input.value === '0') input.value = ''; });
        input.addEventListener('blur', () => { if (!input.value.trim()) input.value = '0'; });
        td.appendChild(input); tr.appendChild(td);
      }
      table.appendChild(tr);
    }
  }

  function getMatrix(id, rows, cols) {
    return Array.from(document.getElementById(id).querySelectorAll('input')).map(i => i.value.trim() || '0');
  }

  document.getElementById('btn-create').addEventListener('click', () => {
    const r = parseInt(document.getElementById('rows').value) || 3;
    const c = parseInt(document.getElementById('cols').value) || 3;
    createTable('matrix-a', r, c);
    const r2 = parseInt(document.getElementById('rows2').value) || r;
    const c2 = parseInt(document.getElementById('cols2').value) || c;
    createTable('matrix-b', r2, c2);
  });

  document.getElementById('btn-example').addEventListener('click', () => {
    const r = parseInt(document.getElementById('rows').value) || 3;
    const c = parseInt(document.getElementById('cols').value) || 3;
    createTable('matrix-a', r, c);
    const inputs = document.getElementById('matrix-a').querySelectorAll('input');
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++)
      inputs[i * c + j].value = i === j ? '1' : String(Math.floor(Math.random() * 7) - 3);
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    document.querySelectorAll('#matrix-a input, #matrix-b input').forEach(i => i.value = '0');
    if (document.getElementById('ai-input')) document.getElementById('ai-input').value = '';
    resultSection.style.display = 'none';
  });

  // Symbol panel toggle
  document.getElementById('btn-symbols').addEventListener('click', () => {
    const panel = document.getElementById('symbol-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  // Regular symbol insert (non-matrix)
  document.querySelectorAll('.sym-btn[data-sym]').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('ai-input');
      const sym = btn.dataset.sym;
      const start = textarea.selectionStart;
      const text = textarea.value;
      textarea.value = text.substring(0, start) + sym + text.substring(start);
      textarea.focus();
      textarea.setSelectionRange(start + sym.length, start + sym.length);
    });
  });

  // Matrix modal
  const modal = document.getElementById('matrix-modal');
  let modalFormat = 'bracket';

  document.querySelectorAll('.sym-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalFormat = btn.dataset.format;
      const isDet = modalFormat === 'det';
      document.getElementById('modal-title').textContent = isDet ? '生成行列式' : '生成矩阵';
      document.getElementById('modal-cols-row').style.display = isDet ? 'none' : 'flex';
      buildModalGrid();
      modal.style.display = 'flex';
    });
  });

  // Rebuild modal grid when rows/cols change
  ['modal-rows', 'modal-cols'].forEach(id => {
    document.getElementById(id).addEventListener('input', buildModalGrid);
  });

  function buildModalGrid() {
    const r = parseInt(document.getElementById('modal-rows').value) || 2;
    const c = modalFormat === 'det' ? r : (parseInt(document.getElementById('modal-cols').value) || 2);
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${c}, 48px)`;
    for (let i = 0; i < r * c; i++) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = '0';
      inp.addEventListener('focus', () => { if (inp.value === '0') inp.value = ''; });
      inp.addEventListener('blur', () => { if (!inp.value.trim()) inp.value = '0'; });
      grid.appendChild(inp);
    }
  }

  document.getElementById('modal-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('modal-ok').addEventListener('click', () => {
    const r = parseInt(document.getElementById('modal-rows').value) || 2;
    const c = modalFormat === 'det' ? r : (parseInt(document.getElementById('modal-cols').value) || 2);
    const inputs = document.getElementById('modal-grid').querySelectorAll('input');
    // Build matrix string
    let rows = [];
    for (let i = 0; i < r; i++) {
      let cells = [];
      for (let j = 0; j < c; j++) {
        cells.push(inputs[i * c + j].value.trim() || '0');
      }
      rows.push(cells.join(', '));
    }
    let str;
    if (modalFormat === 'det') {
      str = '|' + rows.join('; ') + '|';
    } else if (modalFormat === 'paren') {
      str = '(' + rows.join('; ') + ')';
    } else {
      str = '[' + rows.join('; ') + ']';
    }
    // Insert into textarea
    const textarea = document.getElementById('ai-input');
    const start = textarea.selectionStart;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + str + text.substring(start);
    textarea.focus();
    textarea.setSelectionRange(start + str.length, start + str.length);
    modal.style.display = 'none';
  });

  ['rows', 'cols'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      createTable('matrix-a', parseInt(document.getElementById('rows').value) || 3, parseInt(document.getElementById('cols').value) || 3);
    });
  });
  ['rows2', 'cols2'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      createTable('matrix-b', parseInt(document.getElementById('rows2').value) || 3, parseInt(document.getElementById('cols2').value) || 3);
    });
  });

  // Calculate
  document.getElementById('btn-calc').addEventListener('click', async () => {
    const allOps = Object.values(OPS).flat();
    const opDef = allOps.find(o => o.id === currentOp);
    const isAI = opDef?.isAI;
    const isParam = opDef?.isParam;

    let body;
    if (isAI) {
      const text = document.getElementById('ai-input').value.trim();
      if (!text) { alert('请输入问题'); return; }
      body = { op: 'ai', text };
    } else if (opDef?.isParam) {
      const raw = document.getElementById('param-input').value.trim();
      if (!raw) { alert('请输入参数矩阵'); return; }
      // Parse: rows separated by ; or newline, cells by ,
      const rows = raw.split(/[;\n]+/).map(r => r.trim()).filter(Boolean);
      const paramMatrix = rows.map(row => row.split(',').map(cell => cell.trim()));
      const r = paramMatrix.length, c = Math.max(...paramMatrix.map(row => row.length));
      // Normalize: ensure all rows have same number of columns
      paramMatrix.forEach(row => { while (row.length < c) row.push('0'); });
      body = { op: currentOp, paramMatrix, rows: r, cols: c };
    } else {
      const rows = parseInt(document.getElementById('rows').value) || 3;
      const cols = parseInt(document.getElementById('cols').value) || 3;
      const matrix = getMatrix('matrix-a', rows, cols);
      const isProof = opDef?.proof;
      body = isProof ? { op: 'proof', proofId: currentOp, rows, cols, matrix } : { op: currentOp, rows, cols, matrix };
      if (sectionB.style.display !== 'none') {
        const r2 = parseInt(document.getElementById('rows2').value) || rows;
        const c2 = parseInt(document.getElementById('cols2').value) || cols;
        body.rows2 = r2; body.cols2 = c2; body.matrix2 = getMatrix('matrix-b', r2, c2);
      }
      if (sectionScalar.style.display !== 'none') body.scalar = document.getElementById('scalar-val').value.trim() || '1';
    }

    const btn = document.getElementById('btn-calc');
    const progress = document.getElementById('progress');
    btn.disabled = true; btn.textContent = isAI ? '解题中...' : (isParam ? '化简中...' : '计算中...');

    if (isAI) {
      progress.style.display = 'flex';
      progress.querySelector('.progress-text').textContent = '提交中...';

      try {
        // 1. Submit AI task, get reqId
        const submitResp = await (typeof _0xEnc !== 'undefined' ? _0xEnc.fetch(body) : fetch('/api/calc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
        const submitData = typeof _0xEnc !== 'undefined' ? submitResp : await submitResp.json();
        if (submitData.error) throw new Error(submitData.error);
        const reqId = submitData.reqId;

        // 2. Poll queue position until result is ready
        let result = null;
        while (true) {
          await new Promise(r => setTimeout(r, 1500));
          const pollResp = await fetch(`/api/ai-queue?id=${reqId}`);
          const status = await pollResp.json();
          const pt = progress.querySelector('.progress-text');
          if (status.done) { result = status.result; break; }
          if (status.position > 0) pt.textContent = `排队中，前面还有 ${status.position} 人...`;
          else pt.textContent = 'AI 正在思考...';
        }

        // 3. Render result
        progress.querySelector('.progress-text').textContent = '正在渲染结果...';
        if (result.error) { resultContent.innerHTML = `<div class="error">${result.error}</div>`; resultTitle.textContent = '错误'; }
        else { result.steps = result.steps || []; renderResult(result); }
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) { resultContent.innerHTML = `<div class="error">请求失败：${err.message}</div>`; resultSection.style.display = 'block'; }
      finally { btn.disabled = false; btn.textContent = '开始解题'; progress.style.display = 'none'; }
      return;
    }

    try {
      const resp = await (typeof _0xEnc !== 'undefined' ? _0xEnc.fetch(body) : fetch('/api/calc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      const data = typeof _0xEnc !== 'undefined' ? resp : await resp.json();
      if (data.error) { resultContent.innerHTML = `<div class="error">${data.error}</div>`; resultTitle.textContent = '错误'; }
      else { renderResult(data); }
      resultSection.style.display = 'block';
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { resultContent.innerHTML = `<div class="error">请求失败：${err.message}</div>`; resultSection.style.display = 'block'; }
    finally { btn.disabled = false; btn.textContent = isAI ? '开始解题' : (isParam ? '开始化简' : '计算'); progress.style.display = 'none'; }
  });

  // Render
  function fracStr(f) { if (!f) return '0'; return f.den === 1 ? String(f.num) : `${f.num}/${f.den}`; }

  function formatEntry(e) {
    if (!e) return '0';
    if (typeof e === 'string') return e; // symbolic expression
    const c = e.const || e, p = e.coeff || { num: 0, den: 1 };
    if (c.num === 0 && p.num === 0) return '0';
    if (p.num === 0) return fracStr(c);
    let ps;
    if (p.num === 1 && p.den === 1) ps = 'a';
    else if (p.num === -1 && p.den === 1) ps = '-a';
    else if (p.den === 1) ps = p.num + 'a';
    else ps = `(${fracStr(p)})a`;
    if (c.num === 0) return ps;
    return p.num > 0 ? fracStr(c) + '+' + ps : fracStr(c) + ps;
  }

  function renderMatrix(m) {
    if (!m || !m.length) return '';
    return '<table>' + m.map(row => '<tr>' + row.map(cell => {
      const text = formatEntry(cell);
      const cls = text === '0' ? 'zero' : (text === '1' || text === '-1') ? 'is-one' : '';
      return `<td class="${cls}">${text}</td>`;
    }).join('') + '</tr>').join('') + '</table>';
  }

  function renderResult(data) {
    const op = OPS[currentCat]?.find(o => o.id === currentOp);
    resultTitle.textContent = op ? op.name : '结果';
    let html = '';

    // AI answer
    if (data.isLinearAlgebra === false && data.conclusion) {
      html += `<div class="error">${data.conclusion}</div>`;
    } else if (data.steps?.length && data.steps[0]?.desc && !data.steps[0]?.matrix) {
      // AI answer - parse numbered steps and render LaTeX
      const text = data.steps[0].desc;
      html += `<div class="ai-box" id="ai-result">`;
      text.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;
        const m = line.match(/^(\d+)[\.、\)）]\s*(.*)/);
        if (m) {
          html += `<div class="ai-step"><span class="ai-step-num">${m[1]}</span><span class="ai-step-text">${escapeHtml(m[2])}</span></div>`;
        } else if (line.startsWith('**') || line.startsWith('##')) {
          html += `<div class="ai-heading">${escapeHtml(line.replace(/^[*#]+|[*#]+$/g, ''))}</div>`;
        } else {
          html += `<div class="ai-line">${escapeHtml(line)}</div>`;
        }
      });
      html += '</div>';
    }

    // Proof conclusion
    if (data.conclusion && data.proved !== undefined) {
      const color = data.proved ? '#059669' : '#ef4444';
      html += `<div class="result-box" style="border-color:${data.proved ? '#bbf7d0' : '#fecaca'};background:${data.proved ? '#f0fdf4' : '#fef2f2'}"><div class="label" style="color:${color}">${data.proofName || '证明结论'}</div><div class="value" style="color:${color};font-size:18px">${data.conclusion}</div></div>`;
    }

    // Eigenvalue result
    if (data.eigenvalues) {
      html += `<div class="result-box"><div class="label">特征值</div><div class="value" style="font-size:16px">`;
      data.eigenvalues.forEach((ev, i) => { html += `λ${i + 1} = ${ev}<br>`; });
      html += '</div></div>';
      if (data.eigenvectors?.length) {
        html += `<div class="result-box"><div class="label">特征向量</div><div class="step-matrix" style="margin-top:8px">`;
        data.eigenvectors.forEach((v, i) => { html += `<div style="margin:4px 0">v${i + 1} = (${v.join(', ')})</div>`; });
        html += '</div></div>';
      }
    }

    // Scalar result
    if (data.result !== null && data.result !== undefined && !data.conclusion && !data.eigenvalues) {
      if (typeof data.result === 'object' && data.result.num !== undefined) {
        html += `<div class="result-box"><div class="label">最终结果</div><div class="value">${fracStr(data.result)}</div></div>`;
      } else if (Array.isArray(data.result)) {
        html += `<div class="result-box"><div class="label">最终结果</div><div class="step-matrix">${renderMatrix(data.result)}</div></div>`;
      }
    }
    resultContent.innerHTML = html;

    // Render LaTeX with KaTeX
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(resultContent, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  }

  function escapeHtml(s) {
    // Don't escape $ signs for LaTeX
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Init
  createTable('matrix-a', 3, 3);
  createTable('matrix-b', 3, 3);
  renderOps();
  updateVisibility();
});
