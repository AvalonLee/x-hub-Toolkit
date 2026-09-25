/* ============ 图像组：格式转换 / 批量压缩 / 长图拼接 ============ */
/* 全部基于 Canvas 在本机完成，文件不上传。
   输入：宿主 fs.openFiles（带完整路径，可回源目录）/ 拖拽 / 浏览器文件选择。
   输出：默认源文件目录 → 自定义目录（fs.pickDirectory）→ 系统下载目录 → 浏览器下载；
        同名冲突弹层三选（覆盖 / 重命名 / 取消），支持批量应用。
   选文件 / 输出 / 冲突处理等公共设施见 tools/_shared.js（filePicker / saveOutputs 等）。 */
'use strict';

TK_REGISTERS.push(() => {

  /* ---------- MIME 推断（openFiles/readFile 通道无 MIME，按扩展名推） ---------- */
  const EXT_MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif'
  };
  function mimeOfName(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return (m && EXT_MIME[m[1]]) || 'application/octet-stream';
  }

  /* ---------- 图像解码（bytes + 文件名；EXIF 方向自动纠正） ---------- */
  async function loadImageFromBytes(bytes, name) {
    const blob = new Blob([bytes], { type: mimeOfName(name) });
    if (window.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch { /* 落 <img> 降级 */ }
    }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`无法解码图像「${name}」`)); };
      img.src = url;
    });
  }

  function drawTo(img, w, h, bg) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function canvasToBlob(c, type, quality) {
    return new Promise((resolve, reject) => {
      c.toBlob(b => b ? resolve(b) : reject(new Error('Canvas 导出失败（可能不支持该格式）')), type, quality);
    });
  }

  async function blobBytes(blob) { return new Uint8Array(await blob.arrayBuffer()); }

  /* ---------- MIME / 扩展名映射 ---------- */
  const TYPES = {
    png: { mime: 'image/png', ext: 'png' },
    jpeg: { mime: 'image/jpeg', ext: 'jpg' },
    webp: { mime: 'image/webp', ext: 'webp' }
  };

  /* 保持原格式：按 MIME 判定 */
  function mimeToKind(mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpeg';
  }

  /* 测试出口（headless 验证用；不影响运行时行为） */
  window.TK_IMG_TEST = { drawTo, loadImageFromBytes, canvasToBlob, mimeToKind, TYPES, dirOf, joinPath, mimeOfName, bytesToB64, b64ToBytes };

  /* ---------- 1. 图像格式转换（两段式：选择 → 确认转换） ---------- */
  Toolkit.register({ id: 'imgconvert' }, async (box) => {
    const items = []; // { name, path?, size, bytes }
    const res = resultBox();
    const preview = el('div');
    const runBtn = el('button', { class: 'btn primary', disabled: true, onclick: () => run().catch(e => toast('转换失败：' + (e.message || e))) }, '开始转换');

    const kindSel = el('select', {}, ['png', 'jpeg', 'webp'].map(k =>
      el('option', { value: k }, k === 'png' ? 'PNG（无损，保透明）' : k === 'jpeg' ? 'JPEG（有损，体积小）' : 'WebP（通常最小）')));
    const quality = el('input', { type: 'range', min: '0.1', max: '1', step: '0.05', value: '0.9' });
    const qualityVal = el('span', { class: 'hint' }, '0.9');
    quality.addEventListener('input', () => { qualityVal.textContent = quality.value; });
    const bgSel = el('select', {}, [['#ffffff', '白色'], ['#000000', '黑色']].map(([v, t]) => el('option', { value: v, selected: v === '#ffffff' || null }, t)));

    function renderPreview() {
      preview.innerHTML = '';
      runBtn.disabled = !items.length;
      if (!items.length) { preview.append(el('p', { class: 'hint' }, '尚未选择图像。选择后点击「开始转换」才会执行。')); return; }
      const tb = el('tbody');
      items.forEach((it, i) => tb.append(el('tr', {},
        el('td', {}, (i + 1) + '. ', it.name, it.path ? '' : el('span', { class: 'hint' }, '（拖拽/浏览器导入，无源路径）')),
        el('td', {}, fsize(it.size)))));
      preview.append(el('table', { class: 'outtable' }, tb));
    }

    const pick = filePicker({
      multiple: true, label: '＋ 选择图像',
      onPicked: async (picked) => {
        for (const p of picked) {
          /* 解码校验（不通过的直接提示并跳过） */
          try { const im = await loadImageFromBytes(p.bytes, p.name); p._w = im.width; p._h = im.height; }
          catch (e) { toast('跳过 ' + p.name + '：' + (e.message || e)); continue; }
          items.push(p);
        }
        renderPreview();
      }
    });

    async function run() {
      if (!items.length) { toast('请先选择图像'); return; }
      const kind = kindSel.value, t = TYPES[kind];
      const q = kind === 'png' ? undefined : Number(quality.value);
      const outItems = [];
      const rows = el('tbody');
      for (const it of items) {
        const img = await loadImageFromBytes(it.bytes, it.name);
        const bg = kind === 'jpeg' ? bgSel.value : undefined;
        const c = drawTo(img, img.width, img.height, bg);
        const blob = await canvasToBlob(c, t.mime, q);
        const bytes = await blobBytes(blob);
        const outName = it.name.replace(/\.[^.]+$/, '') + '.' + t.ext;
        outItems.push({ name: outName, bytes, srcPath: it.path });
        rows.append(el('tr', {},
          el('td', {}, it.name, ' → ', outName),
          el('td', {}, `${img.width}×${img.height}`),
          el('td', {}, fsize(it.size) + ' → ' + fsize(bytes.length))));
      }
      const r = await saveOutputs(outItems, t.mime);
      renderSaveResult(r, res, el('table', { class: 'outtable' }, rows));
      toast(`转换完成：${r.ok.length} 张`);
    }

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择图像'), pick.node, preview),
      el('div', { class: 'card' }, el('h3', {}, '② 转换设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '目标格式'), kindSel),
          el('div', { class: 'field' }, el('label', {}, '质量（JPEG / WebP）'), quality, qualityVal),
          el('div', { class: 'field' }, el('label', {}, '透明背景填充（转 JPEG 时）'), bgSel)),
        el('p', { class: 'hint' }, '确认设置后点击「开始转换」才会执行；输出位置见下方。')),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '③ 执行'), el('div', { class: 'row' }, runBtn)),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));

    renderPreview();
  });

  /* ---------- 2. 图像批量压缩（两段式） ---------- */
  Toolkit.register({ id: 'imgcompress' }, async (box) => {
    const items = [];
    const res = resultBox();
    const preview = el('div');
    const runBtn = el('button', { class: 'btn primary', disabled: true, onclick: () => run().catch(e => toast('压缩失败：' + (e.message || e))) }, '开始压缩');

    const maxEdge = el('input', { type: 'number', value: '1920', min: '0', style: { width: '90px' } });
    const quality = el('input', { type: 'range', min: '0.3', max: '1', step: '0.05', value: '0.8' });
    const qualityVal = el('span', { class: 'hint' }, '0.8');
    quality.addEventListener('input', () => { qualityVal.textContent = quality.value; });
    const keepFmt = el('select', {}, [
      ['keep', '保持原格式'], ['jpeg', '统一 JPEG'], ['webp', '统一 WebP']
    ].map(([v, t]) => el('option', { value: v }, t)));

    function renderPreview() {
      preview.innerHTML = '';
      runBtn.disabled = !items.length;
      if (!items.length) { preview.append(el('p', { class: 'hint' }, '尚未选择图像。选择后点击「开始压缩」才会执行。')); return; }
      const tb = el('tbody');
      let sum = 0;
      items.forEach((it, i) => { sum += it.size; tb.append(el('tr', {}, el('td', {}, (i + 1) + '. ', it.name), el('td', {}, fsize(it.size)))); });
      preview.append(el('table', { class: 'outtable' }, tb),
        el('p', { class: 'hint' }, `共 ${items.length} 张 · 合计 ${fsize(sum)}`));
    }

    const pick = filePicker({
      multiple: true, label: '＋ 选择图像',
      onPicked: async (picked) => {
        for (const p of picked) {
          try { const im = await loadImageFromBytes(p.bytes, p.name); p._w = im.width; p._h = im.height; }
          catch (e) { toast('跳过 ' + p.name + '：' + (e.message || e)); continue; }
          items.push(p);
        }
        renderPreview();
      }
    });

    async function run() {
      if (!items.length) { toast('请先选择图像'); return; }
      const me = Math.max(0, Math.floor(Number(maxEdge.value) || 0));
      const q = Number(quality.value);
      const mode = keepFmt.value;
      const outItems = [];
      const rows = el('tbody');
      let sumIn = 0, sumOut = 0;
      for (const it of items) {
        const img = await loadImageFromBytes(it.bytes, it.name);
        let w = img.width, h = img.height;
        if (me > 0 && Math.max(w, h) > me) {
          const k = me / Math.max(w, h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        const kind = mode === 'keep' ? mimeToKind(mimeOfName(it.name)) : mode;
        const t = TYPES[kind];
        const c = drawTo(img, w, h, kind === 'jpeg' ? '#ffffff' : undefined);
        const blob = await canvasToBlob(c, t.mime, kind === 'png' ? undefined : q);
        const bytes = await blobBytes(blob);
        const outName = it.name.replace(/\.[^.]+$/, '') + '.' + t.ext;
        outItems.push({ name: outName, bytes, srcPath: it.path });
        sumIn += it.size; sumOut += bytes.length;
        rows.append(el('tr', {},
          el('td', {}, outName),
          el('td', {}, `${img.width}×${img.height} → ${w}×${h}`),
          el('td', {}, fsize(it.size) + ' → ' + fsize(bytes.length))));
      }
      const r = await saveOutputs(outItems, 'image/*');
      const pct = sumIn ? (sumIn - sumOut) / sumIn * 100 : 0;
      renderSaveResult(r, res,
        el('div', {},
          el('div', { class: 'chips' },
            el('span', { class: 'chip' }, fsize(sumIn), el('small', {}, '原始合计')),
            el('span', { class: 'chip' }, fsize(sumOut), el('small', {}, '压缩后')),
            el('span', { class: 'chip' }, (pct >= 0 ? '-' : '+') + fmt(Math.abs(pct), 1) + '%', el('small', {}, '体积变化'))),
          el('table', { class: 'outtable', style: { marginTop: '10px' } }, rows)));
      toast(`压缩完成：${r.ok.length} 张`);
    }

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择图像'), pick.node, preview),
      el('div', { class: 'card' }, el('h3', {}, '② 压缩设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '最长边上限 px（0 = 不缩放）'), maxEdge),
          el('div', { class: 'field' }, el('label', {}, '质量'), quality, qualityVal),
          el('div', { class: 'field' }, el('label', {}, '输出格式'), keepFmt)),
        el('p', { class: 'hint' }, '口径：Canvas 重编码（有损）。PNG 转 JPEG 时透明区域填充白色。确认后点「开始压缩」执行。')),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '③ 执行'), el('div', { class: 'row' }, runBtn)),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));

    renderPreview();
  });

  /* ---------- 3. 长图拼接 ---------- */
  Toolkit.register({ id: 'imgstitch' }, async (box) => {
    const files = []; // { name, path?, size, bytes }
    const res = resultBox();
    const listNode = el('p', { class: 'hint' }, '尚未选择图像（按列表顺序拼接）。');
    const preview = el('div');

    const dirSel = el('select', {}, [
      ['v', '垂直拼接（长图）'], ['h', '水平拼接（宽图）']
    ].map(([v, t]) => el('option', { value: v }, t)));
    const alignSel = el('select', {}, [
      ['center', '居中对齐'], ['start', '起点对齐'], ['end', '终点对齐']
    ].map(([v, t]) => el('option', { value: v }, t)));
    const gapNo = el('input', { type: 'number', value: '0', min: '0', max: '200', style: { width: '80px' } });
    const bgCol = el('input', { type: 'color', value: '#ffffff', style: { width: '42px', height: '28px', padding: '0' } });
    const fmtSel = el('select', {}, [['png', 'PNG'], ['jpeg', 'JPEG']].map(([v, t]) => el('option', { value: v }, t)));

    function renderList() {
      listNode.textContent = files.length
        ? files.map((f, i) => `${i + 1}. ${f.name}`).join('　')
        : '尚未选择图像（按列表顺序拼接）。';
    }

    const pick = filePicker({
      multiple: true, label: '＋ 添加图像',
      onPicked: async (picked) => { files.push(...picked); renderList(); }
    });

    async function run() {
      if (files.length < 2) { toast('请至少选择 2 张图像'); return; }
      const gap = Math.max(0, Math.floor(num(gapNo.value, 0)));
      const bg = bgCol.value;
      const vertical = dirSel.value === 'v';
      const align = alignSel.value;
      const imgs = [];
      for (const f of files) imgs.push(await loadImageFromBytes(f.bytes, f.name));
      const crossMax = vertical
        ? Math.max(...imgs.map(m => m.width))
        : Math.max(...imgs.map(m => m.height));
      const scaled = imgs.map(m => {
        const k = vertical ? crossMax / m.width : crossMax / m.height;
        return { img: m, w: Math.round(m.width * k), h: Math.round(m.height * k) };
      });
      const totalMain = scaled.reduce((a, s) => a + (vertical ? s.h : s.w), 0) + gap * (scaled.length - 1);
      const W = vertical ? crossMax : totalMain;
      const H = vertical ? totalMain : crossMax;
      if (W * H > 268_435_456) { toast('拼接尺寸过大（超过 16384×16384），请缩小图片或分批拼接'); return; }
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      let main = 0;
      for (const s of scaled) {
        let cross;
        if (align === 'center') cross = Math.round((crossMax - (vertical ? s.w : s.h)) / 2);
        else if (align === 'end') cross = crossMax - (vertical ? s.w : s.h);
        else cross = 0;
        const x = vertical ? cross : main;
        const y = vertical ? main : cross;
        g.drawImage(s.img, x, y, s.w, s.h);
        main += (vertical ? s.h : s.w) + gap;
      }
      const kind = fmtSel.value;
      const blob = await canvasToBlob(c, TYPES[kind].mime, kind === 'jpeg' ? 0.92 : undefined);
      const bytes = await blobBytes(blob);
      const outName = 'stitch_' + Date.now() + '.' + TYPES[kind].ext;
      preview.innerHTML = '';
      preview.append(el('img', {
        src: URL.createObjectURL(blob),
        style: { maxWidth: '100%', maxHeight: '320px', border: '1px solid var(--line)', borderRadius: '8px' }
      }));
      const r = await saveOutputs([{ name: outName, bytes, srcPath: files[0].path }], TYPES[kind].mime);
      renderSaveResult(r, res, el('p', { class: 'hint' }, `拼接完成：${imgs.length} 张 → ${W}×${H} · ${fsize(bytes.length)}`));
      toast('拼接完成');
    }

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择图像'),
        el('div', { class: 'row' },
          pick.node,
          el('button', { class: 'btn', onclick: () => { files.length = 0; renderList(); preview.innerHTML = ''; res.clear(); } }, '清空')),
        listNode),
      el('div', { class: 'card' }, el('h3', {}, '② 拼接设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '方向'), dirSel),
          el('div', { class: 'field' }, el('label', {}, '对齐'), alignSel),
          el('div', { class: 'field' }, el('label', {}, '间隔 px'), gapNo),
          el('div', { class: 'field' }, el('label', {}, '背景色'), bgCol),
          el('div', { class: 'field' }, el('label', {}, '输出格式'), fmtSel)),
        el('p', { class: 'hint' }, '口径：以最大宽 / 高为基准，其余图像等比缩放后对齐排布；透明区域填充背景色。')),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '③ 执行'),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: () => run().catch(e => toast('拼接失败：' + (e.message || e))) }, '拼接并导出'))),
      el('div', { class: 'card' }, el('h3', {}, '预览'), preview),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));

    renderList();
  });

});
