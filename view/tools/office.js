/* ============ 办公：PPTX 素材提取（纯前端，jszip 解包 + DOMParser） ============ */
'use strict';

/* 解析单页：文本段落 + 图片引用路径（独立纯函数便于测试） */
async function parseSlide(zip, slideName) {
  const n = +slideName.match(/slide(\d+)\.xml$/)[1];
  const xmlText = await zip.files[slideName].async('string');
  const relName = `ppt/slides/_rels/slide${n}.xml.rels`;
  const media = [];
  if (zip.files[relName]) {
    const rels = new DOMParser().parseFromString(await zip.files[relName].async('string'), 'application/xml');
    for (const rel of rels.getElementsByTagName('Relationship')) {
      const type = rel.getAttribute('Type') || '';
      const target = rel.getAttribute('Target') || '';
      if (type.includes('/image') && target) {
        const path = 'ppt/media/' + target.replace(/^\.\.\//, '').replace(/^\//, '').split('/').pop();
        if (zip.files[path]) media.push(path);
      }
    }
  }
  /* 段落文本：按 a:p 分组，a:t 串联 */
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const paras = [];
  for (const p of doc.getElementsByTagName('a:p')) {
    const ts = [...p.getElementsByTagName('a:t')].map(t => t.textContent).join('');
    if (ts.trim()) paras.push(ts.trim());
  }
  return { n, text: paras, media: [...new Set(media)] };
}
/* 页码文件名排序 */
function slideNum(name) { return +name.match(/slide(\d+)\.xml$/)[1]; }

/* headless 断言钩子 */
window.TK_OFFICE_TEST = { parseSlide, slideNum };

TK_REGISTERS.push(() => {

  Toolkit.register({ id: 'pptxextract' }, async (box) => {
    const zipBox = el('div', { class: 'card' }, el('h3', {}, '载入 PPTX'));
    const listCard = el('div', { class: 'card', style: { display: 'none' } }, el('h3', {}, '逐页素材'));
    const status = el('span', { class: 'hint' });
    let zip = null, pages = [], selected = new Set();

    const fileInput = el('input', { type: 'file', accept: '.pptx', style: { display: 'none' } });
    const drop = el('div', { class: 'dropzone' },
      el('div', { class: 'dz-main' }, '拖放 .pptx 文件到这里，或'),
      el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '选择 PPTX'),
      el('span', { class: 'hint' }, '仅支持新版 .pptx（Office Open XML）；旧版 .ppt 不受支持。全程本地解析，不联网'));

    const selAll = el('button', { class: 'btn sm', onclick: () => toggleAll(true) }, '全选图片');
    const selNone = el('button', { class: 'btn sm', onclick: () => toggleAll(false) }, '全不选');
    const btnZip = el('button', { class: 'btn primary', onclick: downloadZip }, '打包下载勾选图片 ZIP');
    const cnt = el('span', { class: 'hint' });
    /* 操作行只建一次：render() 会被多次调用（重复载入 PPTX），重复 append 会累加按钮 */
    const actionBar = el('div', { class: 'row', style: { marginTop: '10px' } }, selAll, selNone, btnZip, cnt);

    function updateCnt() {
      cnt.textContent = selected.size ? `已勾选 ${selected.size} 张` : '未勾选';
    }

    async function loadFile(file) {
      if (!file) return;
      if (!/\.pptx$/i.test(file.name)) { toast('仅支持 .pptx 文件'); return; }
      status.textContent = '解析中…';
      try {
        zip = await window.JSZip.loadAsync(file);
      } catch {
        status.textContent = '解析失败：文件损坏或已加密';
        toast('PPTX 解析失败');
        return;
      }
      const slideNames = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => slideNum(a) - slideNum(b));
      if (!slideNames.length) { status.textContent = '未找到幻灯片（可能不是标准 PPTX）'; return; }

      pages = [];
      selected = new Set();
      for (const name of slideNames) {
        pages.push(await parseSlide(zip, name));
        for (const m of pages[pages.length - 1].media) selected.add(m);
      }
      status.textContent = `共 ${pages.length} 页 · ${selected.size} 张图片`;
      render();
    }

    function render() {
      listCard.style.display = '';
      const list = listCard.querySelector('.page-list') || (() => {
        const d = el('div', { class: 'page-list' }); listCard.append(d); return d;
      })();
      list.innerHTML = '';
      for (const pg of pages) {
        const card = el('div', { class: 'pagecard' });
        card.append(el('h4', {}, `第 ${pg.n} 页`));
        if (pg.text.length) {
          card.append(el('div', { class: 'pagetext' }, pg.text.map(t => el('p', {}, t))));
          card.append(el('button', {
            class: 'btn sm', onclick: () => copyText(pg.text.join('\n'), `第 ${pg.n} 页文本已复制`)
          }, '复制本页文本'));
        } else {
          card.append(el('p', { class: 'hint' }, '（本页无文本）'));
        }
        if (pg.media.length) {
          const grid = el('div', { class: 'media-grid' });
          for (const path of pg.media) {
            const cell = el('label', { class: 'media-cell' });
            const cb = el('input', { type: 'checkbox', checked: selected.has(path) });
            cb.addEventListener('change', () => {
              if (cb.checked) selected.add(path); else selected.delete(path);
              updateCnt();
            });
            cell.append(el('div', { class: 'media-thumb' }), cb, el('span', { class: 'mono' }, path.split('/').pop()));
            zip.files[path].async('blob').then(bl =>
              cell.querySelector('.media-thumb').append(el('img', {
                src: URL.createObjectURL(new Blob([bl], { type: blobType(path) })), loading: 'lazy'
              })));
            grid.append(cell);
          }
          card.append(el('p', { class: 'hint', style: { margin: '8px 0 4px' } }, `${pg.media.length} 张图片：`), grid);
        } else {
          card.append(el('p', { class: 'hint', style: { margin: '8px 0 0' } }, '（本页无图片引用）'));
        }
        list.append(card);
      }
      if (!actionBar.isConnected) listCard.append(actionBar);
      updateCnt();
    }

    function blobType(path) {
      if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
      if (/\.png$/i.test(path)) return 'image/png';
      if (/\.gif$/i.test(path)) return 'image/gif';
      if (/\.svg$/i.test(path)) return 'image/svg+xml';
      return 'application/octet-stream';
    }
    function toggleAll(on) {
      selected = new Set();
      if (on) for (const pg of pages) for (const m of pg.media) selected.add(m);
      for (const cb of listCard.querySelectorAll('.media-cell input[type="checkbox"]')) cb.checked = on;
      updateCnt();
    }
    async function downloadZip() {
      if (!selected.size) { toast('请先勾选图片'); return; }
      const z = new window.JSZip();
      let i = 0;
      for (const path of [...selected].sort()) {
        const base = path.split('/').pop();
        z.file(`${String(++i).padStart(2, '0')}-${base}`, await zip.files[path].async('uint8array'), { binary: true });
      }
      const blob = await z.generateAsync({ type: 'blob' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'pptx-media.zip' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`已下载 ${selected.size} 张图片`);
    }

    ;['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.toggle('over', ev === 'dragover');
      if (ev === 'drop') loadFile(e.dataTransfer.files[0]);
    }));
    fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

    zipBox.append(drop, fileInput, status);
    box.append(zipBox, listCard);
  });

});
