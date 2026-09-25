/* ============ 开发者扩展：二维码工具（生成 / 识别 / CSV 批量） ============ */
'use strict';

TK_REGISTERS.push(() => {

  /* 中文内容必须走 UTF-8 编码（qrcode-generator 默认单字节截断） */
  if (window.qrcode?.stringToBytesFuncs?.['UTF-8']) {
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
  }

  /* 把 QR 模块矩阵画到 canvas */
  function paintQR(canvas, text, opts = {}) {
    const { size = 320, margin = 4, dark = '#000000', light = '#ffffff', level = 'M' } = opts;
    const qr = window.qrcode(0, level);
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = Math.max(1, Math.floor((size - margin * 2) / count));
    const real = cell * count + margin * 2;
    canvas.width = real; canvas.height = real;
    const g = canvas.getContext('2d');
    g.fillStyle = light; g.fillRect(0, 0, real, real);
    g.fillStyle = dark;
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) g.fillRect(margin + c * cell, margin + r * cell, cell, cell);
    }
    return real;
  }
  /* 解析「内容[,文件名]」清单行 */
  function parseCsvLine(line) {
    const parts = line.split(',').map(s => s.trim());
    const content = parts[0] || '';
    const name = (parts.slice(1).join(',') || '').replace(/[\\/:*?"<>|]/g, '_');
    return { content, name };
  }

  /* headless 断言钩子 */
  window.TK_QRCODE_TEST = { paintQR, parseCsvLine };

  function downloadCanvas(cv, name) {
    cv.toBlob(bl => {
      const a = el('a', { href: URL.createObjectURL(bl), download: name });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('已下载 ' + name);
    }, 'image/png');
  }

  /* 外链打开：宿主 WebView 内 target="_blank" / window.open 会被静默拦截，
     必须走 xhub.openExternal 调起系统浏览器；无该能力时降级 window.open 并提示 */
  function openExternal(url) {
    const api = window.xhub;
    if (api && typeof api.openExternal === 'function') {
      Promise.resolve(api.openExternal(url)).catch(e => toast('打开链接失败：' + ((e && e.message) || e)));
      return;
    }
    const w = window.open(url, '_blank', 'noopener');
    if (!w) toast('当前环境无法打开链接，请手动复制：' + url);
  }

  Toolkit.register({ id: 'qrcode' }, async (box) => {
    const tabs = el('div', { class: 'row', style: { marginBottom: '4px' } });
    const panes = [];
    function addTab(name, pane) {
      const b = el('button', { class: 'btn sm primary' }, name);
      b.addEventListener('click', () => {
        [...tabs.children].forEach(x => x.classList.toggle('primary', x === b));
        panes.forEach(p => p.style.display = p === pane ? '' : 'none');
      });
      tabs.append(b);
      pane.style.display = panes.length ? 'none' : '';
      panes.push(pane);
      box.append(pane);
    }

    /* ---------- 单条生成 ---------- */
    {
      const text = el('textarea', { rows: 4, placeholder: '输入文本 / 链接（支持中文）…' });
      const sizeRange = el('input', { type: 'range', min: 128, max: 1024, step: 32, value: 320 });
      const sizeLabel = el('b', { class: 'mono' }, '320px');
      const marginRange = el('input', { type: 'range', min: 0, max: 10, value: 4 });
      const marginLabel = el('b', { class: 'mono' }, '4');
      const levelSel = el('select', {},
        el('option', { value: 'L' }, 'L（7% 容错）'),
        el('option', { value: 'M', selected: true }, 'M（15% 容错）'),
        el('option', { value: 'Q' }, 'Q（25% 容错）'),
        el('option', { value: 'H' }, 'H（30% 容错）'));
      const darkC = el('input', { type: 'color', value: '#000000' });
      const lightC = el('input', { type: 'color', value: '#ffffff' });
      const cv = el('canvas', { class: 'repl-canvas', style: { cursor: 'default', maxWidth: '100%' } });
      const info = el('span', { class: 'hint' });

      let redrawTimer = 0;
      function redraw() {
        const s = text.value.trim();
        if (!s) {
          const g = cv.getContext('2d');
          cv.width = cv.height = 320;
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, 320, 320);
          g.fillStyle = '#9aa3ad'; // canvas 不解析 CSS 变量，白底占位文字用固定灰
          g.font = '13px sans-serif'; g.textAlign = 'center';
          g.fillText('输入内容后自动生成', 160, 160);
          info.textContent = '';
          return;
        }
        try {
          const real = paintQR(cv, s, {
            size: +sizeRange.value, margin: +marginRange.value,
            dark: darkC.value, light: lightC.value, level: levelSel.value
          });
          info.textContent = `${real}px · 容错 ${levelSel.value}`;
        } catch (err) {
          info.textContent = '生成失败：' + err.message;
        }
      }
      const lazy = () => { clearTimeout(redrawTimer); redrawTimer = setTimeout(redraw, 200); };
      text.addEventListener('input', lazy);
      [sizeRange, marginRange, levelSel, darkC, lightC].forEach(c => c.addEventListener('input', redraw));
      sizeRange.addEventListener('input', () => { sizeLabel.textContent = sizeRange.value + 'px'; });
      marginRange.addEventListener('input', () => { marginLabel.textContent = marginRange.value; });
      text.value = 'https://';
      redraw();

      const pane = el('div', { class: 'card' }, el('h3', {}, '生成'),
        el('div', { class: 'field' }, el('label', {}, '内容'), text),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('div', { class: 'field' }, el('label', {}, '尺寸 ', sizeLabel), sizeRange),
          el('div', { class: 'field' }, el('label', {}, '静区边距 ', marginLabel), marginRange),
          el('div', { class: 'field' }, el('label', {}, '容错级别'), levelSel),
          el('div', { class: 'field' }, el('label', {}, '前景'), darkC),
          el('div', { class: 'field' }, el('label', {}, '背景'), lightC),
          el('button', { class: 'btn primary', onclick: () => downloadCanvas(cv, 'qrcode.png') }, '下载 PNG'),
          info),
        el('div', { style: { marginTop: '10px' } }, cv));
      addTab('单条生成', pane);
    }

    /* ---------- 图片识别 ---------- */
    {
      const result = el('div', { class: 'out' }, '识别结果将显示在这里');
      const cv = el('canvas', { class: 'repl-canvas', style: { cursor: 'default', maxWidth: '100%' } });
      const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      const drop = el('div', { class: 'dropzone' },
        el('div', { class: 'dz-main' }, '拖放含二维码的图片，或'),
        el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '选择图片'),
        el('span', { class: 'hint' }, '支持 PNG / JPEG / WebP / GIF 首帧；也支持粘贴截图（Ctrl+V）'));

      function decode(file) {
        if (!file || !file.type.startsWith('image/')) { toast('请选择图片'); return; }
        const img = new Image();
        img.onload = () => {
          const g = cv.getContext('2d', { willReadFrequently: true });
          const r = Math.min(1, 900 / Math.max(img.width, img.height));
          cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
          g.drawImage(img, 0, 0, cv.width, cv.height);
          const raw = g.getImageData(0, 0, cv.width, cv.height);
          let code = null;
          /* 原尺寸失败后逐级放大重试（小二维码常需 ≥2px/模块） */
          for (const scale of [1, 2, 3]) {
            if (scale === 1) code = window.jsQR(raw.data, cv.width, cv.height);
            else {
              const c2 = document.createElement('canvas');
              c2.width = cv.width * scale; c2.height = cv.height * scale;
              const g2 = c2.getContext('2d', { willReadFrequently: true });
              g2.imageSmoothingEnabled = false;
              g2.drawImage(cv, 0, 0, c2.width, c2.height);
              code = window.jsQR(g2.getImageData(0, 0, c2.width, c2.height).data, c2.width, c2.height);
            }
            if (code?.data) break;
          }
          result.classList.remove('err');
          if (code?.data) {
            result.innerHTML = '';
            result.append(
              el('div', { class: 'mono', style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }, code.data),
              el('div', { class: 'row', style: { marginTop: '8px' } },
                el('button', { class: 'btn sm primary', onclick: () => copyText(code.data, '内容已复制') }, '复制内容'),
                code.data.startsWith('http') ? el('button', { class: 'btn sm', onclick: () => openExternal(code.data) }, '打开链接') : null,
                el('span', { class: 'hint' }, `定位 ${code.location ? '成功' : '—'} · ${cv.width}×${cv.height}`)));
          } else {
            result.textContent = '未识别到二维码。可尝试：更清晰的图、裁掉无关区域、或检查是否为被遮挡的码。';
            result.classList.add('err');
          }
        };
        img.onerror = () => toast('图片解码失败');
        img.src = URL.createObjectURL(file);
      }
      ;['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
        e.preventDefault();
        drop.classList.toggle('over', ev === 'dragover');
        if (ev === 'drop') decode(e.dataTransfer.files[0]);
      }));
      fileInput.addEventListener('change', () => decode(fileInput.files[0]));
      box.addEventListener('paste', e => {
        if (panes[1].style.display === 'none') return; // 仅识别页响应
        const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
        if (item) decode(item.getAsFile());
      });

      const pane = el('div', { class: 'card' }, el('h3', {}, '识别'), drop, fileInput,
        el('div', { style: { marginTop: '10px' } }, cv),
        el('div', { style: { marginTop: '10px' } }, result));
      addTab('图片识别', pane);
    }

    /* ---------- CSV 批量 ---------- */
    {
      const csv = el('textarea', { rows: 8, spellcheck: 'false',
        placeholder: '每行一条：内容[,文件名]\n例如：\nhttps://example.com/001,编号001\n客户感谢信-张三\nhttps://example.com/002' });
      const sizeRange = el('input', { type: 'range', min: 128, max: 512, step: 32, value: 256 });
      const sizeLabel = el('b', { class: 'mono' }, '256px');
      const levelSel = el('select', {},
        el('option', { value: 'M', selected: true }, 'M'),
        el('option', { value: 'L' }, 'L'), el('option', { value: 'Q' }, 'Q'), el('option', { value: 'H' }, 'H'));
      const status = el('span', { class: 'hint' });

      async function batch() {
        const lines = csv.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) { toast('请先粘贴 CSV 内容'); return; }
        status.textContent = `生成中（0/${lines.length}）…`;
        const zip = new window.JSZip();
        let ok = 0, fail = [];
        for (let i = 0; i < lines.length; i++) {
          const { content, name: rawName } = parseCsvLine(lines[i]);
          const name = (rawName || `qr-${String(i + 1).padStart(3, '0')}`) + '.png';
          try {
            const cv = document.createElement('canvas');
            paintQR(cv, content, { size: +sizeRange.value, level: levelSel.value });
            const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
            zip.file(name, await blob.arrayBuffer(), { binary: true });
            ok++;
          } catch (err) { fail.push(`第 ${i + 1} 行：${err.message}`); }
          status.textContent = `生成中（${i + 1}/${lines.length}）…`;
          if (i % 20 === 19) await new Promise(r => setTimeout(r, 0)); // 让出主线程
        }
        if (!ok) { status.textContent = '全部失败：\n' + fail.join('\n'); return; }
        status.textContent = '打包中…';
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'qrcodes.zip' });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        status.textContent = fail.length
          ? `完成：${ok} 成功，${fail.length} 失败（${fail.slice(0, 3).join('；')}${fail.length > 3 ? '…' : ''}）`
          : `完成：${ok} 个二维码已打包`;
        toast(`已下载 qrcodes.zip（${ok} 个）`);
      }

      const pane = el('div', { class: 'card' }, el('h3', {}, 'CSV 批量生成（ZIP 打包下载）'),
        el('div', { class: 'field' }, el('label', {}, '清单（每行一条：内容[,文件名]）'), csv),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('div', { class: 'field' }, el('label', {}, '尺寸 ', sizeLabel), sizeRange),
          el('div', { class: 'field' }, el('label', {}, '容错级别'), levelSel),
          el('button', { class: 'btn primary', onclick: batch }, '批量生成并下载 ZIP'),
          status),
        el('p', { class: 'hint' }, '文件名可省略（默认 qr-001.png 起）；非法字符自动替换为下划线。'));
      sizeRange.addEventListener('input', () => { sizeLabel.textContent = sizeRange.value + 'px'; });
      addTab('CSV 批量', pane);
    }

    box.prepend(tabs);
  });

});
