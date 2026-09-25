/* ============ 开发者组：JSON / Base64 / URL / UUID / JWT ============ */
'use strict';

TK_REGISTERS.push(() => {

  /* ---------- JSON 格式化 ---------- */
  Toolkit.register({ id: 'json' }, async (box) => {
    const input = el('textarea', { rows: 7, placeholder: '粘贴 JSON 文本…' });
    const indent = el('select', {}, el('option', { value: 2 }, '2 空格'), el('option', { value: 4, selected: true }, '4 空格'), el('option', { value: '\t' }, 'Tab'));
    const out = el('pre', { class: 'out', style: { display: 'none' } });

    function highlight(src) {
      return esc(src).replace(
        /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
        (m, str, colon, bool) => {
          if (str) return colon ? `<span class="tok-key">${str}</span>${colon}` : `<span class="tok-str">${str}</span>`;
          if (bool) return `<span class="tok-bool">${m}</span>`;
          if (m === 'null') return `<span class="tok-null">null</span>`;
          return `<span class="tok-num">${m}</span>`;
        });
    }
    function run(mode) {
      const src = input.value.trim();
      if (!src) { toast('请先输入 JSON'); return; }
      try {
        const obj = JSON.parse(src);
        const text = mode === 'min' ? JSON.stringify(obj) : JSON.stringify(obj, null, indent.value);
        out.className = 'out';
        out.innerHTML = highlight(text);
        out.dataset.raw = text;
        out.style.display = '';
      } catch (err) {
        out.className = 'out err';
        out.textContent = '✗ ' + err.message;
        out.style.display = '';
      }
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '输入'),
        input,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('div', { class: 'field' }, el('label', {}, '缩进'), indent),
          el('button', { class: 'btn primary', onclick: () => run('fmt') }, '格式化'),
          el('button', { class: 'btn', onclick: () => run('min') }, '压缩'),
          el('span', { style: { flex: '1' } }),
          el('button', { class: 'btn', onclick: () => copyText(input.value, '输入已复制') }, '复制输入'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'),
        out,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn', onclick: () => copyText(out.dataset.raw || out.textContent, '结果已复制') }, '复制结果'),
          el('button', { class: 'btn', onclick: () => { input.value = out.dataset.raw || ''; toast('已填回输入'); } }, '填回输入')),
        el('p', { class: 'hint' }, '仅在本机解析，不会发送任何数据。')));
  });

  /* ---------- Base64 编解码 ---------- */
  Toolkit.register({ id: 'base64' }, async (box) => {
    const input = el('textarea', { rows: 5, placeholder: '输入文本…' });
    const mode = el('select', { onchange: () => { input.placeholder = mode.value === 'enc' ? '输入文本…' : '输入 Base64…'; out.style.display = 'none'; } },
      el('option', { value: 'enc', selected: true }, '文本 → Base64'),
      el('option', { value: 'dec' }, 'Base64 → 文本'));
    const urlsafe = el('input', { type: 'checkbox' });
    const out = el('pre', { class: 'out', style: { display: 'none' } });

    function b64encode(str) {
      const bytes = new TextEncoder().encode(str);
      let bin = '';
      bytes.forEach(b => bin += String.fromCharCode(b));
      let b64 = btoa(bin);
      if (urlsafe.checked) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return b64;
    }
    function b64decode(b64) {
      let s = b64.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
      while (s.length % 4) s += '=';
      const bin = atob(s); // 非法字符在此抛错
      const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes); // 非法 UTF-8 在此抛错
    }
    function run() {
      const v = input.value;
      if (!v.trim()) { toast('请先输入内容'); return; }
      try {
        out.className = 'out';
        out.textContent = mode.value === 'enc' ? b64encode(v) : b64decode(v);
      } catch (err) {
        out.className = 'out err';
        out.textContent = '✗ 解码失败：不是合法的 Base64（或非 UTF-8 内容）。' ;
      }
      out.style.display = '';
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '输入'),
        el('div', { class: 'row', style: { marginBottom: '8px' } },
          el('div', { class: 'field' }, el('label', {}, '方向'), mode),
          el('label', { class: 'chk' }, urlsafe, 'URL-Safe（-_ 且去 =）')),
        input,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: run }, '转换'),
          el('button', { class: 'btn', onclick: () => { input.value = ''; out.style.display = 'none'; } }, '清空'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'),
        out,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn', onclick: () => copyText(out.textContent, '结果已复制') }, '复制结果'),
          el('button', { class: 'btn', onclick: () => { input.value = out.textContent; run(); toast('已反向回填并转换'); } }, '反向回填'))),
      el('p', { class: 'hint' }, 'UTF-8 安全编解码；URL-Safe 输出会去掉末尾 =，解码时自动补齐。'));
  });

  /* ---------- URL 编解码 ---------- */
  Toolkit.register({ id: 'urlcodec' }, async (box) => {
    const input = el('textarea', { rows: 4, placeholder: '输入 URL 或任意文本…' });
    const out = el('pre', { class: 'out', style: { display: 'none' } });
    const tableBox = el('div');

    function renderTable() {
      tableBox.innerHTML = '';
      let base = input.value.trim();
      if (!base) return;
      try {
        // 支持完整 URL 或纯 query 串
        if (!/[?&]/.test(base) && !base.includes('=')) { tableBox.append(el('p', { class: 'hint' }, '输入含 ?a=1&b=2 的链接或参数串可解析参数表')); return; }
        const url = base.startsWith('http') ? new URL(base) : new URL('https://x.local/' + (base.startsWith('?') ? '' : '?') + base.replace(/^\?/, ''));
        const params = [...url.searchParams.entries()];
        if (!params.length) { tableBox.append(el('p', { class: 'hint' }, '未解析到查询参数')); return; }
        const tb = el('table', { class: 'outtable' },
          el('tr', {}, el('th', {}, '参数'), el('th', {}, '解码值'), el('th', {}, '原始值')),
          params.map(([k, v]) => el('tr', {},
            el('td', { class: 'mono' }, k), el('td', {}, v), el('td', { class: 'mono' }, encodeURIComponent(v)))));
        tableBox.append(tb);
      } catch { tableBox.append(el('p', { class: 'hint' }, '无法按 URL 解析，请检查格式')); }
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '输入'),
        input,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: () => { out.className = 'out'; out.textContent = encodeURIComponent(input.value); out.style.display = ''; } }, 'Encode 组件'),
          el('button', { class: 'btn', onclick: () => {
            try { out.className = 'out'; out.textContent = decodeURIComponent(input.value.replace(/\+/g, '%20')); }
            catch { out.className = 'out err'; out.textContent = '✗ 解码失败：百分号编码不合法'; }
            out.style.display = '';
          } }, 'Decode 组件'),
          el('button', { class: 'btn', onclick: () => copyText(out.textContent, '结果已复制') }, '复制结果'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), out),
      el('div', { class: 'card' }, el('h3', {}, 'Query 参数解析'), tableBox,
        el('p', { class: 'hint' }, '输入链接或 ?a=1&b=2 串后自动解析')));
    input.addEventListener('input', renderTable);
  });

  /* ---------- UUID 生成器 ---------- */
  Toolkit.register({ id: 'uuid' }, async (box, c) => {
    const count = el('input', { type: 'number', min: 1, max: 100, value: 5 });
    const upper = el('input', { type: 'checkbox' });
    const nohyphen = el('input', { type: 'checkbox' });
    const list = el('div', { class: 'out', style: { display: 'none', maxHeight: '320px' } });

    function uuidv4() {
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
    function gen() {
      const n = Math.min(100, Math.max(1, c.num(count.value, 1)));
      const ids = [];
      for (let i = 0; i < n; i++) {
        let id = uuidv4();
        if (nohyphen.checked) id = id.replace(/-/g, '');
        if (upper.checked) id = id.toUpperCase();
        ids.push(id);
      }
      list.innerHTML = '';
      list.style.display = '';
      ids.forEach((id, i) => list.append(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' } },
          el('span', { style: { color: 'var(--ink3)', minWidth: '26px' } }, String(i + 1).padStart(2, '0')),
          el('span', { style: { flex: '1', cursor: 'pointer' }, onclick: () => copyText(id, '已复制：' + id) }, id))));
      list.dataset.raw = ids.join('\n');
      toast(`已生成 ${n} 个 UUID`);
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '选项'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '数量（1-100）'), count),
          el('label', { class: 'chk' }, upper, '大写'),
          el('label', { class: 'chk' }, nohyphen, '去连字符'),
          el('button', { class: 'btn primary', onclick: gen }, '生成'),
          el('button', { class: 'btn', onclick: () => copyText(list.dataset.raw || '', '全部已复制') }, '复制全部'))),
      el('div', { class: 'card' }, el('h3', {}, '结果（点击单条复制）'), list,
        el('p', { class: 'hint' }, 'RFC 4122 v4，crypto 密码学安全随机源，不联网。')));
    gen();
  });

  /* ---------- JWT 查看器 ---------- */
  Toolkit.register({ id: 'jwt' }, async (box) => {
    const input = el('textarea', { rows: 4, placeholder: '粘贴 JWT（eyJ… 开头的三段式 Token）' });
    const out = el('div');

    function b64urlDecode(s) {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return new TextDecoder().decode(Uint8Array.from(atob(s), ch => ch.charCodeAt(0)));
    }
    function render() {
      out.innerHTML = '';
      const token = input.value.trim();
      if (!token) return;
      const parts = token.split('.');
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        out.append(el('p', { class: 'out err' }, '✗ 不是合法的 JWT 结构（应为 header.payload.signature 三段）')); return;
      }
      try {
        const header = JSON.parse(b64urlDecode(parts[0]));
        const payload = JSON.parse(b64urlDecode(parts[1]));
        const claims = el('table', { class: 'outtable' },
          el('tr', {}, el('th', {}, '字段'), el('th', {}, '值'), el('th', {}, '说明')));
        const timeKeys = { exp: '过期时间', iat: '签发时间', nbf: '生效时间' };
        const now = Date.now() / 1000;
        for (const [k, v] of Object.entries(payload)) {
          let show = typeof v === 'object' ? JSON.stringify(v) : String(v);
          let note = '';
          if (timeKeys[k] && Number.isFinite(Number(v))) {
            const t = new Date(Number(v) * 1000);
            show = `${t.toLocaleString('zh-CN')}（${v}）`;
            if (k === 'exp') note = t.getTime() / 1000 < now
              ? el('span', { class: 'badge bad' }, '已过期')
              : el('span', { class: 'badge ok' }, '有效');
            else note = el('span', { class: 'badge ok' }, '✓');
          }
          claims.append(el('tr', {}, el('td', { class: 'mono' }, k), el('td', {}, show), el('td', {}, note)));
        }
        out.append(
          el('div', { class: 'card', style: { padding: '10px 12px' } },
            el('h3', {}, 'Header'),
            el('pre', { class: 'out', style: { maxHeight: '120px' } }, JSON.stringify(header, null, 2)),
            el('p', { class: 'hint' }, '算法：', el('b', { class: 'mono' }, header.alg || '?'))),
          el('div', { class: 'card', style: { padding: '10px 12px' } },
            el('h3', {}, 'Payload Claims'), claims),
          el('p', { class: 'hint' }, '签名段不做校验（需要密钥）；Token 仅在本机解析，不发送任何数据。'));
      } catch (err) {
        out.append(el('p', { class: 'out err' }, '✗ 解码失败：' + err.message));
      }
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, 'Token'), input,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: render }, '解析'),
          el('button', { class: 'btn', onclick: () => { input.value = ''; out.innerHTML = ''; } }, '清空'))),
      out);
    input.addEventListener('input', () => { if (input.value.trim().split('.').length >= 2) render(); });
  });

});
