/* ============ PDF 扩展：PDF 转图像（pdfjs 主线程模式保底） ============ */
'use strict';

/* 解析页码表达式：1-3,7,10- ；返回升序去重页码数组（独立纯函数便于测试） */
function parseRange(expr, total) {
  const s = String(expr || '').trim();
  if (!s) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set();
  for (let part of s.split(/[,，]/)) {
    part = part.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (m) {
      const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= total) set.add(i);
    } else if (/^\d+$/.test(part) && +part >= 1 && +part <= total) set.add(+part);
  }
  return [...set].sort((a, b) => a - b);
}
window.TK_CONVERT_TEST = { parseRange };

TK_REGISTERS.push(() => {

  Toolkit.register({ id: 'pdf2img' }, async (box) => {
    if (!window.pdfjsLib) {
      box.append(el('p', { class: 'out err' }, 'pdfjs 未加载（vendor 缺失）'));
      return;
    }
    /* 主线程模式：index.html 先加载 pdf.worker.min.js（UMD → window.pdfjsWorker），
       pdfjs 检测到主线程 handler 后不再创建真实 Worker（协议/CSP 全兼容）。
       若 worker 缺失（vendor 未加载），getDocument 传 disableWorker 也会因 fake worker
       缺代码而失败——直接提前报错更明确。 */
    const lib = window.pdfjsLib;
    if (!window.pdfjsWorker) {
      box.append(el('p', { class: 'out err' },
        'pdf.worker 未加载：请确认 index.html 中 pdf.worker.min.js 在 pdf.min.js 之前引入。'));
      return;
    }

    let pdf = null;
    const status = el('span', { class: 'hint' });
    const progress = el('div', { class: 'progress' }, el('div', { class: 'bar', style: { width: '0' } }));

    const fileInput = el('input', { type: 'file', accept: '.pdf,application/pdf', style: { display: 'none' } });
    const drop = el('div', { class: 'dropzone' },
      el('div', { class: 'dz-main' }, '拖放 PDF 到这里，或'),
      el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '选择 PDF'),
      el('span', { class: 'hint' }, '逐页渲染为 PNG，全程本地处理'));

    const scaleSel = el('select', {},
      el('option', { value: '1' }, '1x（原始尺寸）'),
      el('option', { value: '2', selected: true }, '2x（高清）'),
      el('option', { value: '3' }, '3x（超清，较慢）'),
      el('option', { value: '0.5' }, '0.5x（缩略）'));
    const rangeInput = el('input', { type: 'text', placeholder: '如 1-3,7,10- ；留空=全部', style: { width: '180px' }, spellcheck: 'false' });
    const btnRender = el('button', { class: 'btn primary', disabled: true, onclick: render }, '渲染 PNG');
    const btnZip = el('button', { class: 'btn', disabled: true, onclick: downloadZip }, '打包下载 ZIP');
    const previewGrid = el('div', { class: 'media-grid' });
    let rendered = [];  // { page, blob, url }

    async function loadFile(file) {
      if (!file || (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')) { toast('请选择 PDF 文件'); return; }
      status.textContent = '读取中…';
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        pdf = await lib.getDocument({ data }).promise;
      } catch (err) {
        status.textContent = '打开失败：' + (err?.message || '文件损坏或已加密');
        toast('PDF 打开失败');
        return;
      }
      rangeInput.placeholder = `1-${pdf.numPages}（留空=全部）`;
      btnRender.disabled = false;
      status.textContent = `已载入：${file.name} · ${pdf.numPages} 页`;
      toast(`已载入 ${pdf.numPages} 页`);
    }

    async function render() {
      if (!pdf) return;
      const pages = parseRange(rangeInput.value, pdf.numPages);
      if (!pages.length) { toast('页码范围无效'); return; }
      const scale = +scaleSel.value;
      btnRender.disabled = btnZip.disabled = true;
      rendered.forEach(r => URL.revokeObjectURL(r.url));
      rendered = [];
      previewGrid.innerHTML = '';
      const bar = progress.querySelector('.bar');
      for (let i = 0; i < pages.length; i++) {
        const pno = pages[i];
        status.textContent = `渲染第 ${pno} 页（${i + 1}/${pages.length}）…`;
        bar.style.width = ((i + 1) / pages.length * 100).toFixed(1) + '%';
        try {
          const page = await pdf.getPage(pno);
          const viewport = page.getViewport({ scale });
          const cv = document.createElement('canvas');
          cv.width = viewport.width; cv.height = viewport.height;
          await page.render({ canvasContext: cv.getContext('2d'), viewport }).promise;
          const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
          const url = URL.createObjectURL(blob);
          rendered.push({ page: pno, blob, url });
          const cell = el('div', { class: 'media-cell' },
            el('div', { class: 'media-thumb' }, el('img', { src: url, loading: 'lazy' })),
            el('span', { class: 'mono' }, `第 ${pno} 页`),
            el('button', {
              class: 'btn sm', onclick: () => {
                const a = el('a', { href: url, download: `page-${String(pno).padStart(3, '0')}.png` });
                a.click(); toast('已下载单页');
              }
            }, '下载'));
          previewGrid.append(cell);
        } catch (err) {
          previewGrid.append(el('div', { class: 'media-cell' },
            el('span', { class: 'out err' }, `第 ${pno} 页渲染失败：${err.message}`)));
        }
        if (i % 2 === 1) await new Promise(r => setTimeout(r, 0));
      }
      status.textContent = `完成：${rendered.length} 页已渲染（${scale}x）`;
      btnRender.disabled = btnZip.disabled = false;
      toast('渲染完成');
    }

    async function downloadZip() {
      if (!rendered.length) { toast('请先渲染'); return; }
      if (!window.JSZip) { rendered.forEach(r => r && singleSave(r)); return; }
      const zip = new window.JSZip();
      for (const r of rendered) zip.file(`page-${String(r.page).padStart(3, '0')}.png`, await r.blob.arrayBuffer(), { binary: true });
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'pdf-pages.zip' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`已下载 ${rendered.length} 页`);
    }
    function singleSave(r) {
      const a = el('a', { href: r.url, download: `page-${String(r.page).padStart(3, '0')}.png` });
      a.click();
    }

    ;['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.toggle('over', ev === 'dragover');
      if (ev === 'drop') loadFile(e.dataTransfer.files[0]);
    }));
    fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '载入 PDF'), drop, fileInput, status),
      el('div', { class: 'card' }, el('h3', {}, '渲染设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '清晰度'), scaleSel),
          el('div', { class: 'field' }, el('label', {}, '页码范围'), rangeInput),
          btnRender, btnZip),
        el('p', { class: 'hint' }, '页码支持「1-3,7,10-」写法；2x 适合投影与打印预览，3x 大文件较慢。'),
        el('div', { style: { marginTop: '10px' } }, progress)),
      el('div', { class: 'card' }, el('h3', {}, '页面预览'), previewGrid)
    );
  });

});
