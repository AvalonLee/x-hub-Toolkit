/* ============ PDF 组：合并 / 拆分 / 加页码 / 旋转 / 裁剪 / 压缩 ============ */
/* 依赖 vendor/pdf-lib.min.js（UMD，全局 PDFLib）。全部处理在本机完成，文件不上传。
   输入：宿主 fs.openFiles（带完整路径，可回源目录）/ 拖拽 / 浏览器文件选择。
   输出：默认源文件目录 → 自定义目录 → 系统下载目录 → 浏览器下载；
        同名冲突弹层三选（覆盖 / 重命名 / 取消），支持批量应用。
   选文件 / 输出 / 冲突处理等公共设施见 tools/_shared.js（filePicker / saveOutputs 等）。 */
'use strict';

TK_REGISTERS.push(() => {

  /* ---------- PDF 引擎加载检查 ---------- */
  function requirePdfLib() {
    if (!window.PDFLib) throw new Error('PDF 引擎（pdf-lib）未加载，请检查扩展文件完整性');
  }

  /* PDF 选择器：accept / 提示语特化，复用 _shared.js 的 filePicker */
  const pdfPicker = (opts) => filePicker({ accept: '.pdf,application/pdf', hint: '或将 PDF 文件拖到这里', ...opts });

  /* 加载 PDF：加密文件自动降级 ignoreEncryption，返回 { doc, encrypted } */
  async function loadPdfFromBytes(bytes) {
    const { PDFDocument } = window.PDFLib;
    try {
      return { doc: await PDFDocument.load(bytes), encrypted: false };
    } catch (e) {
      try {
        return { doc: await PDFDocument.load(bytes, { ignoreEncryption: true }), encrypted: true };
      } catch {
        throw new Error('无法解析该 PDF（可能已损坏或受密码保护）');
      }
    }
  }

  /* 页码区间解析："3" / "2-5" / "1-3,7" 混写；空 = 全部。返回 0-based 索引数组 */
  function parsePages(spec, total) {
    const out = new Set();
    const s = (spec || '').trim();
    if (!s) { for (let i = 0; i < total; i++) out.add(i); return [...out]; }
    for (const part of s.split(/[,，、\s]+/).filter(Boolean)) {
      const m = part.match(/^(\d+)(?:\s*[-~—至]\s*(\d+)?)?$/);
      if (!m) throw new Error(`无法识别的页码范围「${part}」，示例：1-3,7`);
      const a = parseInt(m[1], 10);
      const b = m[2] != null ? parseInt(m[2], 10) : a;
      if (a < 1) throw new Error('页码从 1 开始');
      let lo = Math.min(a, b), hi = Math.max(a, b);
      if (lo > total) throw new Error(`页码 ${lo} 超出总页数（共 ${total} 页）`);
      hi = Math.min(hi, total);
      for (let p = lo; p <= hi; p++) out.add(p - 1);
    }
    return [...out].sort((x, y) => x - y);
  }

  /* 页码六方位坐标：pos 首字符 t/b 定纵向、次字符 l/c/r 定横向 */
  function stampLayout(pageW, pageH, textW, size, margin, pos) {
    const y = pos[0] === 't' ? pageH - margin - size : margin;
    const x = pos[1] === 'l' ? margin : pos[1] === 'c' ? (pageW - textW) / 2 : pageW - textW - margin;
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }

  /* 测试出口 */
  window.TK_PDF_TEST = { parsePages, bytesToB64, b64ToBytes, fsize, loadPdfFromBytes, requirePdfLib, stampLayout, dirOf, joinPath };

  /* ---------- 1. PDF 合并 ---------- */
  Toolkit.register({ id: 'pdfmerge' }, async (box) => {
    requirePdfLib();
    const items = []; // { name, path?, size, pages, bytes, encrypted }
    const list = el('div');
    const res = resultBox();

    function renderList() {
      list.innerHTML = '';
      if (!items.length) {
        list.append(el('p', { class: 'hint' }, '尚未选择文件。选择后点击「合并并导出」才会执行，按下方列表顺序合并。'));
        return;
      }
      const tb = el('tbody');
      items.forEach((it, i) => {
        tb.append(el('tr', {},
          el('td', {}, i + 1, '. ', it.name, it.path ? '' : el('span', { class: 'hint' }, '（无源路径）'), it.encrypted ? el('span', { class: 'badge warn', style: { marginLeft: '6px' } }, '已加密') : null),
          el('td', {}, it.pages + ' 页'),
          el('td', {}, fsize(it.size)),
          el('td', {},
            el('button', { class: 'btn sm', disabled: i === 0 || null, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; renderList(); } }, '↑'),
            ' ',
            el('button', { class: 'btn sm', disabled: i === items.length - 1 || null, onclick: () => { [items[i], items[i + 1]] = [items[i + 1], items[i]]; renderList(); } }, '↓'),
            ' ',
            el('button', { class: 'btn sm', onclick: () => { items.splice(i, 1); renderList(); } }, '移除'))));
      });
      list.append(el('table', { class: 'outtable' }, tb));
    }

    const pick = pdfPicker({
      multiple: true, label: '＋ 选择 PDF',
      onPicked: async (picked) => {
        for (const p of picked) {
          try {
            const { doc, encrypted } = await loadPdfFromBytes(p.bytes);
            items.push({ name: p.name, path: p.path, size: p.size, pages: doc.getPageCount(), bytes: p.bytes, encrypted });
          } catch (e) { toast('跳过 ' + p.name + '：' + (e.message || e)); }
        }
        renderList();
      }
    });

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择文件'), pick.node, list),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '② 执行'),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn primary', onclick: async () => {
              try {
                if (items.length < 2) { toast('请至少选择 2 个 PDF'); return; }
                const { PDFDocument } = PDFLib;
                const out = await PDFDocument.create();
                for (const it of items) {
                  const { doc } = await loadPdfFromBytes(it.bytes);
                  const pages = await out.copyPages(doc, doc.getPageIndices());
                  pages.forEach(p => out.addPage(p));
                }
                const bytes = await out.save();
                const r = await saveOutputs([{ name: 'merged.pdf', bytes, srcPath: items[0].path }]);
                renderSaveResult(r, res, el('p', { class: 'hint' },
                  `合并完成：${items.length} 个文件 → ${out.getPageCount()} 页 · ${fsize(bytes.length)}（原始合计 ${fsize(items.reduce((a, b) => a + b.size, 0))}）`));
              } catch (e) { toast('合并失败：' + (e.message || e)); }
            }
          }, '合并并导出'),
          el('button', { class: 'btn', onclick: () => { items.length = 0; renderList(); res.clear(); } }, '清空列表'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));

    renderList();
  });

  /* ---------- 2. PDF 拆分 ---------- */
  Toolkit.register({ id: 'pdfsplit' }, async (box) => {
    requirePdfLib();
    let cur = null;
    const res = resultBox();
    const rangeInput = el('input', { type: 'text', placeholder: '如 1-3,7（留空 = 全部页）', style: { width: '200px' } });
    const info = el('p', { class: 'hint' }, '尚未选择文件。');

    const pick = pdfPicker({
      label: '选择 PDF',
      onPicked: async ([p]) => {
        const { doc, encrypted } = await loadPdfFromBytes(p.bytes);
        cur = { name: p.name, path: p.path, pages: doc.getPageCount(), bytes: p.bytes };
        info.textContent = `${p.name} · 共 ${cur.pages} 页${encrypted ? ' · ⚠ 已加密' : ''}`;
      }
    });

    async function extract() {
      if (!cur) { toast('请先选择 PDF'); return; }
      const { PDFDocument } = PDFLib;
      const idx = parsePages(rangeInput.value, cur.pages);
      const src = await loadPdfFromBytes(cur.bytes);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src.doc, idx);
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save();
      const stem = cur.name.replace(/\.pdf$/i, '');
      const r = await saveOutputs([{ name: `${stem}_extract.pdf`, bytes, srcPath: cur.path }]);
      renderSaveResult(r, res, el('p', { class: 'hint' }, `已提取 ${idx.length} 页（第 ${idx.map(i => i + 1).join('、')} 页）→ ${fsize(bytes.length)}`));
    }

    async function splitAll() {
      if (!cur) { toast('请先选择 PDF'); return; }
      const { PDFDocument } = PDFLib;
      const src = await loadPdfFromBytes(cur.bytes);
      const stem = cur.name.replace(/\.pdf$/i, '');
      const outItems = [];
      for (let i = 0; i < cur.pages; i++) {
        const out = await PDFDocument.create();
        const [p] = await out.copyPages(src.doc, [i]);
        out.addPage(p);
        outItems.push({ name: `${stem}_p${i + 1}.pdf`, bytes: await out.save(), srcPath: cur.path });
      }
      const r = await saveOutputs(outItems);
      renderSaveResult(r, res, el('p', { class: 'hint' }, `已拆分为 ${outItems.length} 个单页 PDF。`));
      toast(`拆分完成：${r.ok.length} 个文件`);
    }

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择文件'), pick.node, info),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '② 区间提取（产出一个新 PDF）'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '页码范围'), rangeInput),
          el('button', { class: 'btn primary', onclick: () => extract().catch(e => toast('提取失败：' + (e.message || e))) }, '提取并导出')),
        el('p', { class: 'hint' }, '支持「3」「2-5」「1-3,7」混写，倒序如「5-2」亦可。')),
      el('div', { class: 'card' }, el('h3', {}, '② 逐页拆分（每页一个 PDF）'),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: () => splitAll().catch(e => toast('拆分失败：' + (e.message || e))) }, '逐页拆分并导出'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));
  });

  /* ---------- 3. PDF 加页码 ---------- */
  Toolkit.register({ id: 'pdfstamp' }, async (box) => {
    requirePdfLib();
    let cur = null;
    const info = el('p', { class: 'hint' }, '尚未选择文件。');
    const res = resultBox();

    const POS = [
      ['bl', '左下'], ['bc', '底部居中'], ['br', '右下'],
      ['tl', '左上'], ['tc', '顶部居中'], ['tr', '右上']
    ];
    const posSel = el('select', {}, POS.map(([v, t]) => el('option', { value: v }, t)));
    const startNo = el('input', { type: 'number', value: '1', min: '0', style: { width: '80px' } });
    const sizeNo = el('input', { type: 'number', value: '10', min: '6', max: '36', style: { width: '80px' } });
    const marginNo = el('input', { type: 'number', value: '24', min: '0', max: '200', style: { width: '80px' } });
    const tpl = el('input', { type: 'text', value: '{n} / {m}', style: { width: '160px' } });

    const pick = pdfPicker({
      label: '选择 PDF',
      onPicked: async ([p]) => {
        const { doc, encrypted } = await loadPdfFromBytes(p.bytes);
        cur = { name: p.name, path: p.path, pages: doc.getPageCount(), bytes: p.bytes };
        info.textContent = `${p.name} · 共 ${cur.pages} 页${encrypted ? ' · ⚠ 已加密' : ''}`;
      }
    });

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择文件'), pick.node, info),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '② 页码设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '位置'), posSel),
          el('div', { class: 'field' }, el('label', {}, '起始页码'), startNo),
          el('div', { class: 'field' }, el('label', {}, '字号 (pt)'), sizeNo),
          el('div', { class: 'field' }, el('label', {}, '边距 (pt)'), marginNo),
          el('div', { class: 'field' }, el('label', {}, '格式模板'), tpl)),
        el('p', { class: 'hint' }, '模板中 {n} = 当前页码、{m} = 总页数。注意：内置字体仅支持英文 / 数字 / 常用符号，不支持中文（会拒绝执行）。')),
      el('div', { class: 'card' }, el('h3', {}, '③ 执行'),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn primary', onclick: async () => {
              try {
                if (!cur) { toast('请先选择 PDF'); return; }
                const text0 = tpl.value.replace(/\{n\}/g, '0').replace(/\{m\}/g, String(cur.pages));
                if (/[^\x20-\x7e]/.test(text0)) { toast('模板含非英文字符，内置字体无法渲染'); return; }
                const { PDFDocument, StandardFonts, rgb } = PDFLib;
                const { doc } = await loadPdfFromBytes(cur.bytes);
                const helv = await doc.embedFont(StandardFonts.Helvetica);
                const size = num(sizeNo.value, 10), margin = num(marginNo.value, 24);
                const start = Math.max(0, Math.floor(num(startNo.value, 1)));
                const m = cur.pages;
                doc.getPages().forEach((page, i) => {
                  const text = tpl.value.replace(/\{n\}/g, String(start + i)).replace(/\{m\}/g, String(m));
                  const { width, height } = page.getSize();
                  const w = helv.widthOfTextAtSize(text, size);
                  const { x, y } = stampLayout(width, height, w, size, margin, posSel.value);
                  page.drawText(text, { x, y, size, font: helv, color: rgb(0.3, 0.3, 0.3) });
                });
                const bytes = await doc.save();
                const stem = cur.name.replace(/\.pdf$/i, '');
                const r = await saveOutputs([{ name: `${stem}_paged.pdf`, bytes, srcPath: cur.path }]);
                renderSaveResult(r, res, el('p', { class: 'hint' }, `已为 ${m} 页加页码（起始 ${start}）→ ${fsize(bytes.length)}`));
              } catch (e) { toast('加页码失败：' + (e.message || e)); }
            }
          }, '加页码并导出'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));
  });

  /* ---------- 4. PDF 旋转 ---------- */
  Toolkit.register({ id: 'pdfrotate' }, async (box) => {
    requirePdfLib();
    let cur = null;
    const info = el('p', { class: 'hint' }, '尚未选择文件。');
    const res = resultBox();

    const angSel = el('select', {},
      [['90', '顺时针 90°'], ['180', '180°'], ['270', '逆时针 90°（270°）'], ['-90', '逆时针 90°'], ['0', '归零（清除旋转）']]
        .map(([v, t]) => el('option', { value: v }, t)));
    const rangeInput = el('input', { type: 'text', placeholder: '留空 = 全部页', style: { width: '160px' } });

    const pick = pdfPicker({
      label: '选择 PDF',
      onPicked: async ([p]) => {
        const { doc, encrypted } = await loadPdfFromBytes(p.bytes);
        cur = { name: p.name, path: p.path, pages: doc.getPageCount(), bytes: p.bytes };
        info.textContent = `${p.name} · 共 ${cur.pages} 页${encrypted ? ' · ⚠ 已加密' : ''}`;
      }
    });

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择文件'), pick.node, info),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '② 旋转设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '角度'), angSel),
          el('div', { class: 'field' }, el('label', {}, '页码范围'), rangeInput),
          el('button', {
            class: 'btn primary', onclick: async () => {
              try {
                if (!cur) { toast('请先选择 PDF'); return; }
                const { degrees } = PDFLib;
                const { doc } = await loadPdfFromBytes(cur.bytes);
                const idx = parsePages(rangeInput.value, cur.pages);
                const delta = parseInt(angSel.value, 10);
                const pages = doc.getPages();
                for (const i of idx) {
                  const cur0 = pages[i].getRotation().angle || 0;
                  pages[i].setRotation(degrees(((cur0 + delta) % 360 + 360) % 360));
                }
                const bytes = await doc.save();
                const stem = cur.name.replace(/\.pdf$/i, '');
                const r = await saveOutputs([{ name: `${stem}_rotated.pdf`, bytes, srcPath: cur.path }]);
                renderSaveResult(r, res, el('p', { class: 'hint' }, `已旋转 ${idx.length} 页（${delta >= 0 ? '+' : ''}${delta}°，在原有角度上叠加）→ ${fsize(bytes.length)}`));
              } catch (e) { toast('旋转失败：' + (e.message || e)); }
            }
          }, '旋转并导出')),
        el('p', { class: 'hint' }, '旋转为相对叠加：在页面当前角度基础上追加。选「归零」可清除全部旋转标记。')),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));
  });

  /* ---------- 5. PDF 裁剪 ---------- */
  Toolkit.register({ id: 'pdfcrop' }, async (box) => {
    requirePdfLib();
    let cur = null;
    const info = el('p', { class: 'hint' }, '尚未选择文件。');
    const res = resultBox();

    const mk = (v) => el('input', { type: 'number', value: v, min: '0', max: '45', style: { width: '76px' } });
    const top = mk('0'), bottom = mk('0'), left = mk('0'), right = mk('0');
    const rangeInput = el('input', { type: 'text', placeholder: '留空 = 全部页', style: { width: '160px' } });

    const pick = pdfPicker({
      label: '选择 PDF',
      onPicked: async ([p]) => {
        const { doc, encrypted } = await loadPdfFromBytes(p.bytes);
        cur = { name: p.name, path: p.path, pages: doc.getPageCount(), bytes: p.bytes };
        info.textContent = `${p.name} · 共 ${cur.pages} 页${encrypted ? ' · ⚠ 已加密' : ''}`;
      }
    });

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择文件'), pick.node, info),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '② 裁剪边距（占页宽/页高的百分比）'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '上边距 %'), top),
          el('div', { class: 'field' }, el('label', {}, '下边距 %'), bottom),
          el('div', { class: 'field' }, el('label', {}, '左边距 %'), left),
          el('div', { class: 'field' }, el('label', {}, '右边距 %'), right),
          el('div', { class: 'field' }, el('label', {}, '页码范围'), rangeInput),
          el('button', {
            class: 'btn primary', onclick: async () => {
              try {
                if (!cur) { toast('请先选择 PDF'); return; }
                const t = num(top.value, 0) / 100, b = num(bottom.value, 0) / 100;
                const l = num(left.value, 0) / 100, r0 = num(right.value, 0) / 100;
                if (t + b >= 1 || l + r0 >= 1) { toast('上下（或左右）边距之和不能达到 100%'); return; }
                if (!t && !b && !l && !r0) { toast('边距全为 0，无需裁剪'); return; }
                const { doc } = await loadPdfFromBytes(cur.bytes);
                const idx = parsePages(rangeInput.value, cur.pages);
                const pages = doc.getPages();
                for (const i of idx) {
                  const mb = pages[i].getMediaBox();
                  pages[i].setCropBox(mb.x + mb.width * l, mb.y + mb.height * b, mb.width * (1 - l - r0), mb.height * (1 - t - b));
                }
                const bytes = await doc.save();
                const stem = cur.name.replace(/\.pdf$/i, '');
                const r = await saveOutputs([{ name: `${stem}_cropped.pdf`, bytes, srcPath: cur.path }]);
                renderSaveResult(r, res, el('p', { class: 'hint' }, `已裁剪 ${idx.length} 页（保留宽度 ${fmt((1 - l - r0) * 100, 1)}% · 高度 ${fmt((1 - t - b) * 100, 1)}%）→ ${fsize(bytes.length)}`));
              } catch (e) { toast('裁剪失败：' + (e.message || e)); }
            }
          }, '裁剪并导出')),
        el('p', { class: 'hint' }, '⚠ 说明：此处为 CropBox 视口裁剪——页面内容并未删除，仅改变显示与打印范围（绝大多数阅读器按此显示）；需要永久删除内容请配合「打印为 PDF」使用。')),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));
  });

  /* ---------- 6. PDF 压缩 ---------- */
  Toolkit.register({ id: 'pdfcompress' }, async (box) => {
    requirePdfLib();
    let cur = null;
    const info = el('p', { class: 'hint' }, '尚未选择文件。');
    const res = resultBox();

    const pick = pdfPicker({
      label: '选择 PDF',
      onPicked: async ([p]) => {
        const { doc, encrypted } = await loadPdfFromBytes(p.bytes);
        cur = { name: p.name, path: p.path, size: p.size, pages: doc.getPageCount(), bytes: p.bytes };
        info.textContent = `${p.name} · ${fsize(p.size)} · ${cur.pages} 页${encrypted ? ' · ⚠ 已加密' : ''}`;
      }
    });

    const prefs = outPrefsCard();
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '① 选择文件'), pick.node, info),
      prefs.node,
      el('div', { class: 'card' }, el('h3', {}, '② 压缩'),
        el('p', { class: 'hint' }, '⚠ 压缩口径：重新序列化 + 对象流（object streams）紧凑编码，对未优化的 PDF 通常可减小 10%~30%；不含图像有损压缩，扫描件 / 大图片 PDF 效果有限。'),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', {
            class: 'btn primary', onclick: async () => {
              try {
                if (!cur) { toast('请先选择 PDF'); return; }
                const { doc } = await loadPdfFromBytes(cur.bytes);
                const bytes = await doc.save({ useObjectStreams: true });
                const delta = cur.size - bytes.length;
                const pct = cur.size ? delta / cur.size * 100 : 0;
                if (bytes.length >= cur.size) {
                  res.show([el('p', { class: 'hint' }, '该文件重新序列化后体积未减小（可能已高度优化），未生成新文件。')]);
                  return;
                }
                const outName = cur.name.replace(/(\.pdf)?$/i, '') + '_compressed.pdf';
                const r = await saveOutputs([{ name: outName, bytes, srcPath: cur.path }]);
                renderSaveResult(r, res, el('div', { class: 'chips' },
                  el('span', { class: 'chip' }, fsize(cur.size), el('small', {}, '原始大小')),
                  el('span', { class: 'chip' }, fsize(bytes.length), el('small', {}, '压缩后')),
                  el('span', { class: 'chip' }, '-' + fmt(Math.abs(pct), 1) + '%', el('small', {}, '变化'))));
              } catch (e) { toast('压缩失败：' + (e.message || e)); }
            }
          }, '压缩并导出'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), res.node));
  });

});
