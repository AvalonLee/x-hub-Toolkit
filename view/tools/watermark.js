/* ============ 图像扩展：图片批量水印（文字水印 平铺/九宫角，批量导出） ============ */
'use strict';

TK_REGISTERS.push(() => {

  Toolkit.register({ id: 'imgwatermark' }, async (box) => {
    let files = [];          // { name, bmp }
    let outItems = [];       // { name, blob, url }
    const status = el('span', { class: 'hint' });

    const text = el('input', { type: 'text', value: '示例水印', style: { width: '240px' } });
    const fontSize = el('input', { type: 'range', min: 8, max: 96, value: 24 });
    const fontSizeLabel = el('b', { class: 'mono' }, '24');
    const opacity = el('input', { type: 'range', min: 5, max: 100, value: 30 });
    const opacityLabel = el('b', { class: 'mono' }, '30%');
    const rotate = el('input', { type: 'range', min: -90, max: 90, value: -30 });
    const rotateLabel = el('b', { class: 'mono' }, '-30°');
    const color = el('input', { type: 'color', value: '#ffffff' });
    const outline = el('input', { type: 'checkbox', checked: true });
    const modeSel = el('select', {},
      el('option', { value: 'tile', selected: true }, '平铺（斜向重复）'),
      el('option', { value: 'corners' }, '四角 + 中心'),
      el('option', { value: 'center' }, '居中单条'));
    const density = el('input', { type: 'range', min: 20, max: 80, value: 40 });
    const densityLabel = el('b', { class: 'mono' }, '40%');
    const fontSel = el('select', {},
      el('option', { value: 'sans', selected: true }, '无衬线（系统默认）'),
      el('option', { value: 'serif' }, '衬线（宋体系）'),
      el('option', { value: 'mono' }, '等宽'));
    const fmtSel = el('select', {},
      el('option', { value: 'image/png', selected: true }, 'PNG（无损）'),
      el('option', { value: 'image/jpeg' }, 'JPEG（体积小，白底）'));
    const quality = el('input', { type: 'range', min: 50, max: 100, value: 90 });
    const qualityLabel = el('b', { class: 'mono' }, '90%');

    const fileInput = el('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    const drop = el('div', { class: 'dropzone' },
      el('div', { class: 'dz-main' }, '拖放图片（可多选）到这里，或'),
      el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '选择图片'),
      el('span', { class: 'hint' }, '所有处理在本地完成，单张建议 ≤ 4000px'));

    const btnApply = el('button', { class: 'btn primary', disabled: true, onclick: applyAll }, '批量加水印');
    const btnZip = el('button', { class: 'btn', disabled: true, onclick: downloadZip }, '打包下载 ZIP');
    const previewGrid = el('div', { class: 'media-grid' });

    function fontStack() {
      return fontSel.value === 'serif' ? 'Georgia, "Times New Roman", "SimSun", serif'
        : fontSel.value === 'mono' ? 'Consolas, "Courier New", monospace'
        : '"Segoe UI", "Microsoft YaHei", sans-serif';
    }

    /* 在画布上绘制水印层（与预览/导出共用一套逻辑） */
    function paintWatermark(g, w, h) {
      const s = +fontSize.value / 100 * Math.max(w, h) * 0.24; // 相对尺寸
      const f = `${s}px ${fontStack()}`;
      g.save();
      g.globalAlpha = +opacity.value / 100;
      g.font = f;
      g.fillStyle = color.value;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (outline.checked) {
        g.lineWidth = Math.max(1, s * 0.04);
        g.strokeStyle = 'rgba(0,0,0,.55)';
      }
      const tw = g.measureText(text.value).width;
      const rot = +rotate.value * Math.PI / 180;
      const stamp = (x, y) => {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        if (outline.checked) g.strokeText(text.value, 0, 0);
        g.fillText(text.value, 0, 0);
        g.restore();
      };
      const m = modeSel.value;
      if (m === 'tile') {
        const gap = tw * (0.6 + +density.value / 100 * 1.6);
        const stepY = s * (1.8 + +density.value / 100 * 3);
        for (let y = -h; y < h * 2; y += stepY) {
          let x = -w;
          while (x < w * 2) { stamp(x, y); x += gap; }
        }
      } else if (m === 'corners') {
        const pad = s * 1.2;
        [[pad, pad], [w - pad, pad], [pad, h - pad], [w - pad, h - pad], [w / 2, h / 2]].forEach(([x, y]) => stamp(x, y));
      } else {
        stamp(w / 2, h / 2);
      }
      g.restore();
    }

    async function loadFiles(list) {
      const incoming = [...list].filter(f => f.type.startsWith('image/'));
      if (!incoming.length) { toast('未选择图片'); return; }
      files = [];
      for (const f of incoming) {
        const bmp = await createImageBitmap(f).catch(() => null);
        if (bmp) files.push({ name: f.name.replace(/\.\w+$/, ''), bmp });
      }
      status.textContent = `已载入 ${files.length} 张图片`;
      btnApply.disabled = !files.length;
      toast(`已载入 ${files.length} 张`);
    }

    async function applyAll() {
      if (!files.length) { toast('请先载入图片'); return; }
      if (!text.value.trim()) { toast('请输入水印文字'); return; }
      btnApply.disabled = btnZip.disabled = true;
      outItems.forEach(o => URL.revokeObjectURL(o.url));
      outItems = [];
      previewGrid.innerHTML = '';
      const type = fmtSel.value;
      const q = +quality.value / 100;
      for (let i = 0; i < files.length; i++) {
        const { name, bmp } = files[i];
        status.textContent = `处理 ${name}（${i + 1}/${files.length}）…`;
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        const g = cv.getContext('2d');
        if (type === 'image/jpeg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
        g.drawImage(bmp, 0, 0);
        paintWatermark(g, cv.width, cv.height);
        const blob = await new Promise(res => cv.toBlob(res, type, q));
        const url = URL.createObjectURL(blob);
        outItems.push({ name: `${name}-wm.${type === 'image/png' ? 'png' : 'jpg'}`, blob, url });
        const cell = el('div', { class: 'media-cell' },
          el('div', { class: 'media-thumb' }, el('img', { src: url, loading: 'lazy' })),
          el('span', { class: 'mono' }, name),
          el('button', { class: 'btn sm', onclick: () => singleSave(outItems[i]) }, '下载'));
        previewGrid.append(cell);
        if (i % 2 === 1) await new Promise(r => setTimeout(r, 0));
      }
      status.textContent = `完成：${outItems.length} 张已加水印`;
      btnApply.disabled = btnZip.disabled = false;
      toast('水印完成');
    }
    function singleSave(o) {
      const a = el('a', { href: o.url, download: o.name });
      a.click();
      toast('已下载 ' + o.name);
    }
    async function downloadZip() {
      if (!outItems.length) { toast('请先批量处理'); return; }
      if (!window.JSZip) { outItems.forEach(singleSave); return; }
      const zip = new window.JSZip();
      for (const o of outItems) zip.file(o.name, await o.blob.arrayBuffer(), { binary: true });
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'watermarked.zip' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`已下载 ${outItems.length} 张`);
    }

    ;['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.toggle('over', ev === 'dragover');
      if (ev === 'drop') loadFiles(e.dataTransfer.files);
    }));
    fileInput.addEventListener('change', () => loadFiles(fileInput.files));

    /* 参数即时标签 */
    const bind = (r, l, fmt) => r.addEventListener('input', () => { l.textContent = fmt(r.value); });
    bind(fontSize, fontSizeLabel, v => v);
    bind(opacity, opacityLabel, v => v + '%');
    bind(rotate, rotateLabel, v => v + '°');
    bind(density, densityLabel, v => v + '%');
    bind(quality, qualityLabel, v => v + '%');

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '载入图片'), drop, fileInput, status),
      el('div', { class: 'card' }, el('h3', {}, '水印设置'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '水印文字'), text),
          el('div', { class: 'field' }, el('label', {}, '布局'), modeSel),
          el('div', { class: 'field' }, el('label', {}, '字体'), fontSel)),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('div', { class: 'field' }, el('label', {}, '字号 ', fontSizeLabel), fontSize),
          el('div', { class: 'field' }, el('label', {}, '不透明度 ', opacityLabel), opacity),
          el('div', { class: 'field' }, el('label', {}, '旋转 ', rotateLabel), rotate),
          el('div', { class: 'field' }, el('label', {}, '密度（平铺） ', densityLabel), density),
          el('div', { class: 'field' }, el('label', {}, '颜色'), color),
          el('label', { class: 'field', style: { flexDirection: 'row', alignItems: 'center', gap: '6px' } },
            el('span', {}, '描边阴影'), outline)),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('div', { class: 'field' }, el('label', {}, '导出格式'), fmtSel),
          el('div', { class: 'field' }, el('label', {}, 'JPEG 质量 ', qualityLabel), quality),
          btnApply, btnZip),
        el('p', { class: 'hint' }, '字号随图片尺寸自适应；平铺密度越大水印越稀疏。')),
      el('div', { class: 'card' }, el('h3', {}, '结果预览'), previewGrid)
    );
  });

});
