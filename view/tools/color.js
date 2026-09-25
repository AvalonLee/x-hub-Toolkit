/* ============ 图像扩展：颜色空间对比 / 智能颜色替换 / 图标生成器 ============ */
'use strict';

TK_REGISTERS.push(() => {

  /* ================= 颜色数学（三工具共用） ================= */
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const hex2 = n => n.toString(16).padStart(2, '0');

  function hexToRgb(hex) {
    let s = String(hex).trim().replace(/^#/, '');
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  const rgbToHex = rgb => '#' + rgb.map(v => hex2(Math.round(clamp01(v / 255) * 255))).join('');

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h, s, l]; // 0..1
  }
  function hslToRgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    if (s === 0) { const v = l * 255; return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => v * 255);
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }
  function rgbToCmyk(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return [0, 0, 0, 1];
    return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
  }
  /* sRGB(D65) → XYZ → CIELAB */
  function rgbToLab(r, g, b) {
    const lin = v => { v = clamp01(v / 255); return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const R = lin(r), G = lin(g), B = lin(b);
    const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  /* WCAG 相对亮度与对比度 */
  function luminance(r, g, b) {
    const lin = v => { v = clamp01(v / 255); return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  const contrastRatio = (rgb1, rgb2) => {
    const L1 = luminance(...rgb1), L2 = luminance(...rgb2);
    const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
    return (hi + 0.05) / (lo + 0.05);
  };

  /* ================= 颜色空间对比 ================= */
  Toolkit.register({ id: 'colorconv' }, async (box) => {
    const colorInput = el('input', { type: 'color', value: '#176c6b' });
    const hexInput = el('input', { type: 'text', value: '#176C6B', class: 'mono', style: { width: '120px' }, spellcheck: 'false' });
    const tbody = el('tbody');

    const fg = el('input', { type: 'color', value: '#ffffff' });
    const bg = el('input', { type: 'color', value: '#176c6b' });
    const demo = el('div', { class: 'contrast-demo' },
      el('b', { style: { fontSize: '17px' } }, '正文标题示例 Aa 123'),
      el('span', {}, '正文文字示例——The quick brown fox jumps over the lazy dog. 一目十行。'));
    const ratioOut = el('div', { class: 'contrast-grid' });

    function row(label, value, note = '') {
      const tr = el('tr', { title: '点击复制', style: { cursor: 'pointer' } },
        el('td', {}, label), el('td', { class: 'mono' }, value),
        el('td', { class: 'hint' }, note));
      tr.addEventListener('click', () => copyText(value, '已复制 ' + label));
      return tr;
    }
    function pct(v) { return (v * 100).toFixed(1) + '%'; }

    function update() {
      const rgb = hexToRgb(colorInput.value);
      if (!rgb) return;
      const swatch = box.querySelector('.swatch');
      if (swatch) swatch.style.background = rgbToHex(rgb);
      hexInput.value = colorInput.value.toUpperCase();
      const [h, s, l] = rgbToHsl(...rgb);
      const [hv, sv, vv] = rgbToHsv(...rgb);
      const [c, m, y, k] = rgbToCmyk(...rgb);
      const [L, a, bb] = rgbToLab(...rgb);
      tbody.innerHTML = '';
      tbody.append(
        row('HEX', rgbToHex(rgb).toUpperCase()),
        row('RGB', `rgb(${rgb.join(', ')})`, `(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`),
        row('HSL', `hsl(${(h * 360).toFixed(0)}, ${pct(s)}, ${pct(l)})`, `色相 ${(h * 360).toFixed(1)}°`),
        row('HSV / HSB', `hsv(${(hv * 360).toFixed(0)}, ${pct(sv)}, ${pct(vv)})`),
        row('CMYK', `${pct(c)} ${pct(m)} ${pct(y)} ${pct(k)}`),
        row('CIELAB', `L* ${L.toFixed(1)}  a* ${a.toFixed(1)}  b* ${bb.toFixed(1)}`),
        row('相对亮度', luminance(...rgb).toFixed(4), 'WCAG 2.x'),
        row('灰度等价', (() => { const g = Math.round(luminance(...rgb) * 255); return `rgb(${g}, ${g}, ${g})`; })(), '亮度加权')
      );
    }

    function updateContrast() {
      const r1 = hexToRgb(fg.value), r2 = hexToRgb(bg.value);
      if (!r1 || !r2) return;
      const ratio = contrastRatio(r1, r2);
      demo.style.background = bg.value;
      demo.style.color = fg.value;
      const grade = (limit, ok) => el('span', { class: ok ? 'grade ok' : 'grade no' }, ok ? '✓ ' + limit + ' 通过' : '✕ ' + limit + ' 未达标');
      ratioOut.innerHTML = '';
      ratioOut.append(
        el('div', { class: 'ratio-num mono' }, ratio.toFixed(2) + ':1'),
        el('div', { class: 'contrast-grades' },
          grade('AA 正文', ratio >= 4.5), grade('AA 大字', ratio >= 3),
          grade('AAA 正文', ratio >= 7), grade('AAA 大字', ratio >= 4.5)));
    }

    colorInput.addEventListener('input', update);
    hexInput.addEventListener('change', () => {
      const rgb = hexToRgb(hexInput.value);
      if (rgb) { colorInput.value = rgbToHex(rgb); update(); }
      else toast('HEX 格式无效，示例 #FF8800');
    });
    fg.addEventListener('input', updateContrast);
    bg.addEventListener('input', updateContrast);
    update(); updateContrast();

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '单色全空间解析'),
        el('div', { class: 'row', style: { alignItems: 'center' } },
          colorInput, hexInput,
          el('div', { class: 'swatch', style: { flex: '1', background: '#176c6b' } })),
        el('table', { class: 'outtable', style: { marginTop: '10px' } },
          el('thead', {}, el('tr', {}, el('th', {}, '色彩空间'), el('th', {}, '值'), el('th', {}, '说明'))), tbody)),
      el('div', { class: 'card' }, el('h3', {}, '两色对比度（WCAG 可读性）'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '前景 / 文字'), fg),
          el('div', { class: 'field' }, el('label', {}, '背景'), bg)),
        demo, ratioOut,
        el('p', { class: 'hint' }, 'AA 正文 ≥ 4.5:1（大字 ≥ 3:1），AAA 正文 ≥ 7:1（大字 ≥ 4.5:1）。'))
    );
  });

  /* ================= 智能颜色替换 ================= */
  Toolkit.register({ id: 'imgreplace' }, async (box, toolCtx) => {
    let img = null, origData = null;      // 原始 ImageData
    const canvas = el('canvas', { class: 'repl-canvas', title: '点击画布取源颜色' });
    const g2d = canvas.getContext('2d', { willReadFrequently: true });

    const srcColor = el('input', { type: 'color', value: '#e74c3c' });
    const dstColor = el('input', { type: 'color', value: '#2fd3c5' });
    const tolSlider = el('input', { type: 'range', min: 1, max: 255, value: 70 });
    const tolLabel = el('b', { class: 'mono' }, '70');
    const featherSlider = el('input', { type: 'range', min: 0, max: 100, value: 40 });
    const featherLabel = el('b', { class: 'mono' }, '40%');
    const modeSel = el('select', {},
      el('option', { value: 'rgb' }, 'RGB 距离（精确匹配）'),
      el('option', { value: 'hsl' }, '色相匹配（抗光照不均）'));
    const btnReset = el('button', { class: 'btn', onclick: () => { drawOriginal(); canvas._result = null; status.textContent = '已还原原图'; }, disabled: true }, '↩ 还原');
    const btnApply = el('button', { class: 'btn primary', onclick: apply, disabled: true }, '应用替换');
    const btnDownload = el('button', { class: 'btn primary', onclick: download, disabled: true }, '下载 PNG');
    const status = el('span', { class: 'hint' });

    const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    const drop = el('div', { class: 'dropzone' },
      el('div', { class: 'dz-main' }, '拖放图片到这里，或'),
      el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '选择图片'),
      el('span', { class: 'hint' }, '处理与下载均在本地完成'));

    async function loadFile(file) {
      if (!file || !file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
      if (!bmp) { toast('图片解码失败'); return; }
      img = bmp;
      origData = null;
      drawOriginal();
      toast(`已载入 ${bmp.width}×${bmp.height}`);
    }
    function ensureOrig() {
      if (origData) return;
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
      origData = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height);
    }
    function fitSize() {
      const max = 1200, r = Math.min(1, max / Math.max(img.width, img.height));
      return [Math.max(1, Math.round(img.width * r)), Math.max(1, Math.round(img.height * r))];
    }
    function drawOriginal() {
      if (!img) return;
      ensureOrig();
      const [w, h] = fitSize();
      canvas.width = w; canvas.height = h;
      g2d.putImageData(scaleData(origData, w, h), 0, 0);
      btnReset.disabled = btnDownload.disabled = btnApply.disabled = false;
      status.textContent = '';
    }
    /* 最近邻缩放 ImageData（仅预览用） */
    function scaleData(src, w, h) {
      const out = new ImageData(w, h);
      const sx = src.width / w, sy = src.height / h;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const si = ((y * sy | 0) * src.width + (x * sx | 0)) * 4, di = (y * w + x) * 4;
        out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = src.data[si + 3];
      }
      return out;
    }

    /* 同步计算替换结果（全分辨率），apply / download 共用 */
    function computeReplace() {
      const s = origData.data, out = new ImageData(origData.width, origData.height);
      const d = out.data;
      const [r1, gg1, b1] = hexToRgb(srcColor.value), [r2, g2v, b2] = hexToRgb(dstColor.value);
      const T = +tolSlider.value / 255;
      const feather = +featherSlider.value / 100;
      const hard = T * (1 - feather);
      const mode = modeSel.value;
      const weight = dist => {
        if (dist <= hard) return 1;
        if (dist <= T && feather > 0 && T > hard) return (T - dist) / (T - hard);
        return 0;
      };
      if (mode === 'rgb') {
        for (let i = 0; i < s.length; i += 4) {
          d[i + 3] = s[i + 3];
          if (!s[i + 3]) continue;
          const dist = Math.sqrt((s[i] - r1) ** 2 + (s[i + 1] - gg1) ** 2 + (s[i + 2] - b1) ** 2) / 441.67;
          const w = weight(dist);
          if (w > 0) { d[i] = s[i] + (r2 - s[i]) * w; d[i + 1] = s[i + 1] + (g2v - s[i + 1]) * w; d[i + 2] = s[i + 2] + (b2 - s[i + 2]) * w; }
          else { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; }
        }
      } else {
        const [h1, s1, l1] = rgbToHsl(r1, gg1, b1);
        for (let i = 0; i < s.length; i += 4) {
          d[i + 3] = s[i + 3];
          if (!s[i + 3]) continue;
          const [hh, ss, ll] = rgbToHsl(s[i], s[i + 1], s[i + 2]);
          const dh = Math.abs(hh - h1); const hueD = Math.min(dh, 1 - dh) / 0.5;
          const dist = Math.max(hueD, Math.abs(ss - s1), Math.abs(ll - l1) * 0.7);
          const w = weight(dist);
          if (w > 0) { d[i] = s[i] + (r2 - s[i]) * w; d[i + 1] = s[i + 1] + (g2v - s[i + 1]) * w; d[i + 2] = s[i + 2] + (b2 - s[i + 2]) * w; }
          else { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; }
        }
      }
      return out;
    }

    function apply() {
      if (!img) { toast('请先载入图片'); return; }
      ensureOrig();
      status.textContent = '处理中…';
      setTimeout(() => {
        const out = computeReplace();
        const [w2, h2] = fitSize();
        canvas.width = w2; canvas.height = h2;
        g2d.putImageData(scaleData(out, w2, h2), 0, 0);
        canvas._result = out;   // 全分辨率结果挂画布
        status.textContent = `完成（容差 ${tolSlider.value} · 羽化 ${featherSlider.value}% · ${modeSel.value === 'rgb' ? 'RGB' : '色相'}模式）`;
      }, 30);
    }

    async function download() {
      if (!img) return;
      ensureOrig();
      let full = canvas._result;
      if (!full) full = computeReplace();
      const cv = document.createElement('canvas');
      cv.width = origData.width; cv.height = origData.height;
      cv.getContext('2d').putImageData(full, 0, 0);
      cv.toBlob(bl => {
        const a = el('a', { href: URL.createObjectURL(bl), download: 'color-replaced.png' });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('已下载 color-replaced.png');
      }, 'image/png');
    }

    /* 画布取色 */
    canvas.addEventListener('click', e => {
      if (!img) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * canvas.width / rect.width);
      const y = Math.round((e.clientY - rect.top) * canvas.height / rect.height);
      const px = g2d.getImageData(Math.min(canvas.width - 1, x), Math.min(canvas.height - 1, y), 1, 1).data;
      const hex = rgbToHex([px[0], px[1], px[2]]);
      srcColor.value = hex;
      toast('已取色 ' + hex.toUpperCase() + '，点击「应用替换」生效');
    });

    tolSlider.addEventListener('input', () => { tolLabel.textContent = tolSlider.value; });
    tolSlider.addEventListener('change', apply);
    featherSlider.addEventListener('input', () => { featherLabel.textContent = featherSlider.value + '%'; });
    featherSlider.addEventListener('change', apply);
    modeSel.addEventListener('change', apply);
    srcColor.addEventListener('change', apply);
    dstColor.addEventListener('change', apply);

    /* 拖放 */
    ;['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.toggle('over', ev === 'dragover');
      if (ev === 'drop') loadFile(e.dataTransfer.files[0]);
    }));
    fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '载入图片'), drop, fileInput),
      el('div', { class: 'card' }, el('h3', {}, '替换参数'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '源颜色（画布点击取色）'), srcColor),
          el('div', { class: 'field' }, el('label', {}, '目标颜色'), dstColor),
          el('div', { class: 'field' }, el('label', {}, '匹配模式'), modeSel)),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('div', { class: 'field' }, el('label', {}, '容差 ', tolLabel), tolSlider),
          el('div', { class: 'field' }, el('label', {}, '边缘羽化 ', featherLabel), featherSlider),
          btnApply, btnReset, btnDownload, status)),
      el('div', { class: 'card' }, el('h3', {}, '预览（点击画布取源颜色）'), canvas),
      el('p', { class: 'hint' }, '色相匹配模式：只比较色相 / 饱和度并对亮度放宽，适合光照不均照片（如白墙上的红色贴纸整体换色）。')
    );
  });

  /* ================= 图标生成器 ================= */
  Toolkit.register({ id: 'iconforge' }, async (box) => {
    let img = null;
    const preview = el('canvas', { width: 256, height: 256, class: 'repl-canvas', style: { maxWidth: '256px' } });
    const pg = preview.getContext('2d');

    const radius = el('input', { type: 'range', min: 0, max: 50, value: 0 });
    const radiusLabel = el('b', { class: 'mono' }, '0%');
    const padding = el('input', { type: 'range', min: 0, max: 20, value: 0 });
    const paddingLabel = el('b', { class: 'mono' }, '0%');
    const bgColor = el('input', { type: 'color', value: '#ffffff' });
    const bgTrans = el('input', { type: 'checkbox', checked: true });
    const flip = el('input', { type: 'checkbox', checked: false });
    const sizeBoxes = [16, 24, 32, 48, 64, 128, 256, 512].map(s =>
      [s, el('input', { type: 'checkbox', checked: [16, 32, 48, 256].includes(s) })]);

    const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    const drop = el('div', { class: 'dropzone' },
      el('div', { class: 'dz-main' }, '拖放方形图片到这里，或'),
      el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '选择图片'),
      el('span', { class: 'hint' }, '非方图自动居中裁切为方'));

    const outRow = el('div', { class: 'row' });
    const btnIco = el('button', { class: 'btn primary', disabled: true, onclick: () => buildIco() }, '下载 .ico（含勾选尺寸）');
    const btnZip = el('button', { class: 'btn', disabled: true, onclick: buildZip }, '打包下载 ZIP');
    const status = el('span', { class: 'hint' });

    /* 中心裁方 → 圆角/背景/边距 合成 size×size */
    function renderAt(size) {
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const useBg = !bgTrans.checked;
      if (radius.value > 0 || useBg) {
        g.save();
        const rr = size * (+radius.value / 100);
        roundedPath(g, 0, 0, size, size, rr);
        g.clip();
      }
      if (useBg) { g.fillStyle = bgColor.value; g.fillRect(0, 0, size, size); }
      if (img) {
        const pad = size * (+padding.value / 100);
        drawCropped(g, pad, size);
      }
      if (radius.value > 0 || useBg) g.restore();
      return cv;
    }
    function roundedPath(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
    /* 居中裁方绘制（含可选水平镜像） */
    function drawCropped(g, pad, size) {
      const s0 = Math.min(img.width, img.height);
      const sx = (img.width - s0) / 2, sy = (img.height - s0) / 2;
      const s = size - pad * 2;
      if (flip.checked) {
        g.save(); g.translate(pad + s, pad); g.scale(-1, 1);
        g.drawImage(img, sx, sy, s0, s0, 0, 0, s, s);
        g.restore();
      } else {
        g.drawImage(img, sx, sy, s0, s0, pad, pad, s, s);
      }
    }

    function redraw() {
      if (!img) return;
      const cv = renderAt(256);
      pg.clearRect(0, 0, 256, 256);
      pg.drawImage(cv, 0, 0);
      btnIco.disabled = btnZip.disabled = false;
    }

    async function canvasPngBytes(size) {
      const cv = renderAt(size);
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      return new Uint8Array(await blob.arrayBuffer());
    }
    /* PNG-in-ICO 容器（Vista+） */
    async function buildIco(download = true) {
      const sizes = sizeBoxes.filter(([, cb]) => cb.checked).map(([s]) => s).sort((a, b) => a - b);
      if (!sizes.length) { toast('请至少勾选一个尺寸'); return null; }
      status.textContent = '生成 ICO…';
      const pngs = [];
      for (const s of sizes) pngs.push(await canvasPngBytes(s));
      const blob = new Blob([icoFromPngs(sizes, pngs)], { type: 'image/x-icon' });
      status.textContent = `ICO 就绪：${sizes.join(' / ')} px`;
      if (download) {
        const a = el('a', { href: URL.createObjectURL(blob), download: 'favicon.ico' });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('已下载 favicon.ico');
      }
      return blob;
    }
    async function buildZip() {
      if (!window.JSZip) { toast('JSZip 未加载'); return; }
      const sizes = sizeBoxes.filter(([, cb]) => cb.checked).map(([s]) => s).sort((a, b) => a - b);
      if (!sizes.length) { toast('请至少勾选一个尺寸'); return; }
      status.textContent = '打包 ZIP…';
      const zip = new window.JSZip();
      for (const s of sizes) zip.file(`icon-${s}.png`, await canvasPngBytes(s), { binary: true });
      zip.file('favicon.ico', await buildIco(false), { binary: true });
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'icons.zip' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      status.textContent = `ZIP 就绪：${sizes.join(' / ')} px + favicon.ico`;
      toast('已下载 icons.zip');
    }
    /* 单尺寸 PNG 下载按钮 */
    function renderOutRow() {
      outRow.innerHTML = '';
      for (const [s, cb] of sizeBoxes) {
        if (!cb.checked) continue;
        outRow.append(el('button', {
          class: 'btn sm', disabled: !img,
          onclick: async () => {
            const bytes = await canvasPngBytes(s);
            const blob = new Blob([bytes], { type: 'image/png' });
            const a = el('a', { href: URL.createObjectURL(blob), download: `icon-${s}.png` });
            a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          }
        }, `${s}px PNG`));
      }
    }
    sizeBoxes.forEach(([, cb]) => cb.addEventListener('change', renderOutRow));

    async function loadFile(file) {
      if (!file || !file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
      if (!bmp) { toast('图片解码失败'); return; }
      img = bmp; redraw(); renderOutRow();
      toast(`已载入 ${bmp.width}×${bmp.height}，预览为 256px 效果`);
    }
    ;['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.toggle('over', ev === 'dragover');
      if (ev === 'drop') loadFile(e.dataTransfer.files[0]);
    }));
    fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
    [radius, padding, bgColor, bgTrans, flip].forEach(c => c.addEventListener('input', () => {
      radiusLabel.textContent = radius.value + '%';
      paddingLabel.textContent = padding.value + '%';
      redraw();
    }));

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '载入原图'), drop, fileInput),
      el('div', { class: 'card' }, el('h3', {}, '样式参数'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '圆角 ', radiusLabel), radius),
          el('div', { class: 'field' }, el('label', {}, '内边距 ', paddingLabel), padding),
          el('div', { class: 'field' }, el('label', {}, '背景色'), bgColor),
          el('label', { class: 'field' }, el('span', {}, '背景透明'), bgTrans),
          el('label', { class: 'field' }, el('span', {}, '水平镜像'), flip)),
        el('p', { class: 'hint' }, '勾选「背景透明」时背景色不参与绘制（圆角仍裁剪图像边缘）。')),
      el('div', { class: 'card' }, el('h3', {}, '尺寸与导出'),
        el('div', { class: 'row', style: { marginBottom: '8px' } },
          sizeBoxes.map(([s, cb]) => el('label', { class: 'field', style: { flexDirection: 'row', alignItems: 'center', gap: '4px' } },
            cb, el('span', { class: 'mono' }, s + 'px')))),
        el('div', { class: 'row' }, btnIco, btnZip, status),
        el('div', { class: 'row', style: { marginTop: '8px' } }, outRow),
        el('p', { class: 'hint' }, 'ICO 采用 PNG-in-ICO 容器（Vista+），256px 条目宽度记 0；favicon 建议 16 / 32 / 48 / 256。')),
      el('div', { class: 'card' }, el('h3', {}, '预览（256px）'), preview)
    );
  });

  /* ICO 容器拼装（PNG-in-ICO，独立纯函数便于测试） */
  function icoFromPngs(sizes, pngs) {
    const count = sizes.length, dirSize = 6 + 16 * count;
    const total = dirSize + pngs.reduce((a, b) => a + b.length, 0);
    const buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, count, true);
    let offset = dirSize;
    sizes.forEach((s, i) => {
      const e = 6 + 16 * i;
      u8[e] = s >= 256 ? 0 : s; u8[e + 1] = s >= 256 ? 0 : s;
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, pngs[i].length, true);
      dv.setUint32(e + 12, offset, true);
      u8.set(pngs[i], offset); offset += pngs[i].length;
    });
    return u8;
  }

  /* headless 断言钩子 */
  window.TK_COLOR_TEST = { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv, rgbToCmyk, rgbToLab, luminance, contrastRatio, icoFromPngs };

});
