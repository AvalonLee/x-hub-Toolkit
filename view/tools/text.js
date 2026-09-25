/* ============ 文本组：统计器 / 格式化 ============ */
'use strict';

TK_REGISTERS.push(() => {

  /* ---------- 文本统计器 ---------- */
  Toolkit.register({ id: 'textstats' }, async (box) => {
    const input = el('textarea', { rows: 10, placeholder: '粘贴或输入文本，实时统计…' });
    const chips = el('div', { class: 'chips' });

    function analyze(s) {
      const cjk = (s.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
      const enWords = (s.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
      const digits = (s.match(/\d/g) || []).length;
      const spaces = (s.match(/\s/g) || []).length;
      const punctuation = (s.match(/[^\p{L}\p{N}\s]/gu) || []).length;
      const lines = s ? s.split(/\r\n|\r|\n/).length : 0;
      const paras = s.trim() ? s.trim().split(/\n\s*\n+/).length : 0;
      return {
        chars: s.length,
        charsNoSpace: s.length - spaces,
        words: cjk + enWords,
        cjk, enWords, digits, punctuation, lines, paras
      };
    }
    function renderStats() {
      const s = input.value;
      const a = analyze(s);
      chips.innerHTML = '';
      const items = [
        ['总字符', a.chars], ['不含空格', a.charsNoSpace], ['字数', a.words],
        ['中文', a.cjk], ['英文单词', a.enWords], ['数字', a.digits],
        ['标点', a.punctuation], ['行数', a.lines], ['段落', a.paras]
      ];
      for (const [k, v] of items) chips.append(el('span', { class: 'chip' }, v.toLocaleString('zh-CN'), el('small', {}, k)));
    }
    input.addEventListener('input', renderStats);
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '统计'), chips),
      el('div', { class: 'card' }, el('h3', {}, '文本'), input,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn', onclick: () => { input.value = ''; renderStats(); } }, '清空'),
          el('button', { class: 'btn', onclick: () => copyText(JSON.stringify(analyze(input.value), null, 2), '统计结果已复制') }, '复制统计 JSON'))));
    renderStats();
  });

  /* ---------- 文本格式化 ---------- */
  Toolkit.register({ id: 'textformat' }, async (box) => {
    const input = el('textarea', { rows: 10, placeholder: '在上方选择操作，结果即时替换并支持撤销…' });
    const undoStack = [];
    const counter = el('span', { class: 'hint' });

    function updateCounter() {
      counter.textContent = input.value ? `${input.value.length} 字符 · ${input.value.split(/\n/).length} 行` : '空';
    }
    function apply(name, fn) {
      const src = input.value;
      if (!src) { toast('请先输入文本'); return; } // 清空按钮自带 onclick，不走 apply
      const res = fn(src);
      if (res === src) { toast('无变化'); return; }
      undoStack.push(src);
      if (undoStack.length > 30) undoStack.shift();
      input.value = res;
      updateCounter();
      toast(`${name} 完成（${src.length} → ${res.length} 字符）`);
    }
    function undo() {
      if (!undoStack.length) { toast('没有可撤销的操作'); return; }
      input.value = undoStack.pop();
      updateCounter();
    }
    const full2half = s => s.replace(/[\uff01-\uff5e\u3000]/g, ch =>
      ch === '\u3000' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
    const half2full = s => s.replace(/[!-~]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0xfee0)).replace(/ /g, '\u3000');

    const OPS = [
      ['去行首尾空格', s => s.split('\n').map(l => l.trim()).join('\n')],
      ['压缩连续空格', s => s.replace(/[ \t]{2,}/g, ' ')],
      ['去全部空格', s => s.replace(/[ \t]/g, '')],
      ['去除空行', s => s.split('\n').filter(l => l.trim()).join('\n')],
      ['合并为一段', s => s.split(/\n+/).map(l => l.trim()).filter(Boolean).join(' ')],
      ['全角 → 半角', full2half],
      ['半角 → 全角', half2full],
      ['全部大写', s => s.toUpperCase()],
      ['全部小写', s => s.toLowerCase()],
      ['行去重（保留首次）', s => [...new Set(s.split('\n'))].join('\n')],
      ['排序 · 字典序', s => s.split('\n').sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')).join('\n')],
      ['排序 · 数字感知', s => s.split('\n').sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true })).join('\n')],
      ['行倒序', s => s.split('\n').reverse().join('\n')],
      ['添加行号', s => s.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')],
      ['去除行号', s => s.split('\n').map(l => l.replace(/^\s*\d+[.、)]\s*/, '')).join('\n')]
    ];
    const btns = el('div', { class: 'row', style: { marginBottom: '10px' } },
      OPS.map(([name, fn]) => el('button', { class: 'btn sm', onclick: () => apply(name, fn) }, name)));
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '操作（结果即时替换输入，可撤销）'), btns),
      el('div', { class: 'card' }, el('h3', {}, '文本'),
        el('div', { class: 'row', style: { marginBottom: '8px' } },
          el('button', { class: 'btn sm', onclick: undo }, '↩ 撤销'),
          el('button', { class: 'btn sm', onclick: () => copyText(input.value, '已复制') }, '复制'),
          el('button', { class: 'btn sm', onclick: () => { undoStack.push(input.value); input.value = ''; updateCounter(); } }, '清空'),
          counter),
        input));
    input.addEventListener('input', updateCounter);
    updateCounter();
  });

});
