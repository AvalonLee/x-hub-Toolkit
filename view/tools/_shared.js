/* ============ 共享公共设施：文件 IO / 输出链路（img.js 与 pdf.js 共用） ============ */
/* 顶层声明跨 script 可见（与 app.js 的 el/toast 同一模式）。
   覆盖：Base64 编解码 / 体积格式化 / 触发下载 / 宿主能力探测 / 路径工具 /
        filePicker 三通道选文件 / 输出偏好 / 冲突弹层与自动重命名 /
        输出设置卡 / 统一输出 saveOutputs / 结果展示。
   注意：须在 app.js 之后、img.js / pdf.js 之前加载（见 view/index.html）。 */
'use strict';

function bytesToB64(bytes) {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fsize(n) {
  if (n >= 1024 * 1024) return fmt(n / 1048576, 2) + ' MB';
  if (n >= 1024) return fmt(n / 1024, 1) + ' KB';
  return n + ' B';
}

function downloadBlob(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

const HAS_FS = () => !!(window.xhub && window.xhub.fs);
/* 能力点级检测：HAS_FS 只说明旧版保存桥（saveFile/saveAs）在，
   路径读写五能力（openFiles/readFile/saveTo/exists）是宿主 v0.6.7+ 才有——
   按方法存在性逐个检测，扩展拷到旧宿主 / 其他环境时自动平滑降级 */
const HAS_PATH = () => !!(window.xhub?.fs?.openFiles && window.xhub?.fs?.readFile
  && window.xhub?.fs?.saveTo && window.xhub?.fs?.exists);
const HAS_DIR = () => !!window.xhub?.fs?.pickDirectory;

/* Windows / Unix 通用取父目录 */
function dirOf(path) {
  if (!path) return null;
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return i > 0 ? path.slice(0, i) : null;
}

/* 目录 + 文件名 → 完整路径（dir 已是宿主返回的 Windows 路径） */
function joinPath(dir, name) {
  return dir.replace(/[\\/]+$/, '') + '\\' + name;
}

/* ---------- 输出偏好（图像组 / PDF 组共用同一实例与 'outprefs' 存储，跨工具跨会话记忆） ---------- */
const outPrefs = { mode: 'source', customDir: null }; // mode: 'source' | 'custom' | 'download'
store.get('outprefs').then(v => { if (v && v.mode) { outPrefs.mode = v.mode; outPrefs.customDir = v.customDir || null; } }).catch(() => {});
function saveOutPrefs() { store.set('outprefs', { mode: outPrefs.mode, customDir: outPrefs.customDir }); }

/* ---------- 输入：filePicker 拖放区（宿主 / 点击 / 拖拽三通道） ----------
   优先宿主 fs.openFiles（拿完整路径 → 输出可回源目录）；无宿主 / 拖拽降级为
   File 对象（无路径，输出回退下载目录）。统一回调 onPicked(items)：
   items = [{ name, path?, size, bytes }]
   accept / hint 可由调用方特化（如 PDF 组传 .pdf 专用文案），默认图像通道。 */
function filePicker({ multiple = false, label = '＋ 选择文件', hint = '或将文件拖到这里', accept = 'image/*,.pdf', onPicked }) {
  const input = el('input', {
    type: 'file',
    accept,
    multiple: multiple || null,
    style: { display: 'none' }
  });

  async function filesToItems(files) {
    const out = [];
    for (const f of files) {
      out.push({ name: f.name, size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    return out;
  }

  async function hostPick() {
    const r = await window.xhub.fs.openFiles({ multiple });
    if (!r || r.canceled) return [];
    const out = [];
    for (const f of (r.files || [])) {
      try {
        const rd = await window.xhub.fs.readFile(f.path);
        out.push({ name: rd.name || f.name, path: rd.path || f.path, size: rd.size ?? f.size, bytes: b64ToBytes(rd.base64) });
      } catch (e) {
        toast(`读取「${f.name}」失败：${e.message || e}`);
      }
    }
    return out;
  }

  const btn = el('button', {
    class: 'btn primary',
    onclick: async () => {
      try {
        if (HAS_PATH()) {
          const items = await hostPick();
          if (items.length) onPicked(items);
          return;
        }
      } catch (e) { toast('宿主选择文件失败：' + (e.message || e)); /* 落浏览器通道 */ }
      input.value = ''; input.click();
    }
  }, label);

  const zone = el('div', { class: 'dropzone' },
    el('div', { class: 'dz-main' }, btn),
    el('span', { class: 'hint' }, hint));
  input.addEventListener('change', async () => {
    const fs = [...(input.files || [])];
    if (!fs.length) return;
    try { onPicked(await filesToItems(fs)); }
    catch (e) { toast('读取失败：' + (e.message || e)); }
  });
  /* 拖拽 */
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', async e => {
    e.preventDefault(); zone.classList.remove('over');
    const fs = [...(e.dataTransfer?.files || [])];
    if (!fs.length) return;
    try { onPicked(await filesToItems(fs)); }
    catch (e2) { toast('读取失败：' + (e2.message || e2)); }
  });
  return { node: zone, input };
}

/* ---------- 冲突弹层：覆盖 / 重命名 / 取消（可勾选应用到本批后续） ---------- */
function conflictDialog(suggestedName) {
  return new Promise(resolve => {
    const mask = el('div', { class: 'tk-modal-mask' });
    const nameInput = el('input', { type: 'text', value: suggestedName, style: { width: '260px' } });
    const applyAll = el('input', { type: 'checkbox' });
    const finish = r => { mask.remove(); resolve(r); };
    const card = el('div', { class: 'tk-modal' },
      el('h3', {}, '文件名冲突'),
      el('p', { class: 'hint' }, '目标目录已存在同名文件：', el('b', {}, suggestedName)),
      el('div', { class: 'row', style: { alignItems: 'center' } },
        el('label', { style: { fontSize: '12px' } }, '新文件名'), nameInput),
      el('label', { class: 'row', style: { gap: '6px', marginTop: '8px', fontSize: '12px', alignItems: 'center' } },
        applyAll, '本批后续冲突应用相同策略（重命名 = 自动加序号）'),
      el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } },
        el('button', { class: 'btn primary', onclick: () => finish({ action: 'overwrite', applyAll: applyAll.checked }) }, '覆盖'),
        el('button', { class: 'btn', onclick: () => {
          const v = nameInput.value.trim();
          if (!v || v === suggestedName) { toast('请修改文件名后确定'); return; }
          finish({ action: 'rename', name: v, applyAll: applyAll.checked });
        } }, '重命名'),
        el('button', { class: 'btn', onclick: () => finish(null) }, '取消')));
    mask.append(card);
    document.body.append(mask);
    nameInput.focus(); nameInput.select();
  });
}

/* 冲突时自动重命名：stem_2.ext → stem_3.ext … */
async function autoRename(dir, name) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; n < 1000; n++) {
    const cand = `${stem}_${n}${ext}`;
    const r = await window.xhub.fs.exists(joinPath(dir, cand));
    if (!r.exists) return cand;
  }
  return stem + '_' + Date.now() + ext;
}

/* ---------- 输出设置卡（三选一：源目录 / 自定义目录 / 系统下载目录） ---------- */
function outPrefsCard() {
  const label = el('span', { class: 'hint', style: { marginLeft: '4px' } });
  const refreshLabel = () => {
    if (outPrefs.mode === 'custom') label.textContent = outPrefs.customDir ? ('当前目录：' + outPrefs.customDir) : '尚未选择目录';
    else if (outPrefs.mode === 'source') label.textContent = '每个文件输出到其所在目录（文件名加后缀）';
    else label.textContent = '输出到系统下载目录';
  };
  const pickBtn = el('button', {
    class: 'btn sm',
    onclick: async () => {
      if (!HAS_DIR()) { toast('当前环境不支持选择目录（需新版宿主），可改用其他输出方式'); return; }
      try {
        const r = await window.xhub.fs.pickDirectory();
        if (r && !r.canceled && r.path) { outPrefs.customDir = r.path; outPrefs.mode = 'custom'; sync(); }
      } catch (e) { toast('选择目录失败：' + (e.message || e)); }
    }
  }, '选择目录…');

  function sync() {
    for (const [m, r] of [['source', rSource], ['custom', rCustom], ['download', rDownload]]) r.checked = outPrefs.mode === m;
    refreshLabel();
    saveOutPrefs();
  }
  const mk = (mode, text) => {
    const r = el('input', { type: 'radio', name: 'tk-outmode-' + Math.random().toString(36).slice(2, 7) });
    r.addEventListener('change', () => { if (r.checked) { outPrefs.mode = mode; sync(); } });
    return el('label', { class: 'row', style: { gap: '4px', fontSize: '12px', alignItems: 'center' } }, r, text);
  };
  const rSource = mk('source', '源文件所在目录');
  const rCustom = mk('custom', '自定义目录');
  const rDownload = mk('download', '系统下载目录');
  /* 旧宿主 / 无路径读写能力时，源目录与自定义目录不可用——置灰并提示 */
  if (!HAS_PATH()) {
    for (const r of [rSource, rCustom]) {
      r.querySelector('input').disabled = true;
      r.title = '需新版宿主支持（fs 路径读写能力）';
    }
  }
  const node = el('div', { class: 'card' }, el('h3', {}, '输出位置'),
    el('div', { class: 'row', style: { alignItems: 'center' } }, rSource, rCustom, rDownload, pickBtn, label));
  setTimeout(sync, 0);
  return { node };
}

/* ---------- 统一输出 ----------
   outItems: [{ name, bytes, srcPath? }]；mime 供浏览器下载通道的 Blob 标注类型
   （PDF 工具省略 mime 时默认 application/pdf；图像工具均显式传入）。
   返回 { ok: [显示名], fail: [原因], where: string } */
async function saveOutputs(outItems, mime = 'application/pdf') {
  if (!HAS_FS()) {
    for (const it of outItems) downloadBlob(new Blob([it.bytes], { type: mime }), it.name);
    return { ok: outItems.map(i => i.name), fail: [], where: '浏览器下载' };
  }
  /* 解析各项目标目录——路径写盘（saveTo/exists）需 HAS_PATH 能力，
     无能力（旧宿主）时 custom/source 一律落下载目录，防 fs.exists TypeError */
  const dirs = [];
  for (const it of outItems) {
    if (outPrefs.mode === 'custom' && outPrefs.customDir && HAS_PATH()) dirs.push(outPrefs.customDir);
    else if (outPrefs.mode === 'source' && it.srcPath && dirOf(it.srcPath) && HAS_PATH()) dirs.push(dirOf(it.srcPath));
    else dirs.push(null); // null = 系统下载目录
  }
  const ok = [], fail = [];
  const downloadItems = [];
  let batchPolicy = null; // 冲突批量策略
  for (let i = 0; i < outItems.length; i++) {
    const it = outItems[i];
    const dir = dirs[i];
    if (!dir) { downloadItems.push(it); continue; }
    /* guard 须声明在 for 外：循环后还要用 guard >= 20 判定重试超限 */
    let name = it.name, done = false, guard = 0;
    for (; guard < 20 && !done; guard++) {
      let exists;
      try { exists = (await window.xhub.fs.exists(joinPath(dir, name))).exists; }
      catch (e) { fail.push(name + '（检测冲突失败：' + (e.message || e) + '）'); done = true; break; }
      if (!exists) {
        try {
          const r = await window.xhub.fs.saveTo(dir, name, bytesToB64(it.bytes), false);
          ok.push(r.path || joinPath(dir, r.name || name));
        } catch (e) { fail.push(name + '（' + (e.message || e) + '）'); }
        done = true; break;
      }
      /* 同名冲突处理 */
      let choice = batchPolicy;
      if (!choice) choice = await conflictDialog(name);
      if (!choice) { fail.push(name + '（用户取消）'); done = true; break; }
      if (choice.applyAll) {
        batchPolicy = choice.action === 'overwrite'
          ? { action: 'overwrite' }
          : { action: 'auto' };
      }
      if (choice.action === 'overwrite') {
        try {
          const r = await window.xhub.fs.saveTo(dir, name, bytesToB64(it.bytes), true);
          ok.push(r.path || joinPath(dir, name));
        } catch (e) { fail.push(name + '（' + (e.message || e) + '）'); }
        done = true;
      } else {
        name = choice.action === 'auto'
          ? await autoRename(dir, name)
          : choice.name;
      }
    }
    if (guard >= 20 && !done) fail.push(name + '（重试次数超限）');
  }
  /* 无目录项（拖拽导入 / 下载模式）走系统下载目录（能走到这里 HAS_FS 必为真） */
  if (downloadItems.length) {
    for (const it of downloadItems) {
      try {
        const r = await window.xhub.fs.saveFile(it.name, bytesToB64(it.bytes));
        ok.push(r && r.path ? r.path : (r && r.name) || it.name);
      } catch (e) { fail.push(it.name + '（' + (e.message || e) + '）'); }
    }
  }
  const where = dirs.every(d => d) ? (outPrefs.mode === 'custom' ? '自定义目录' : '各源文件所在目录')
    : dirs.some(d => d) ? '混合目录' : '系统下载目录';
  return { ok, fail, where };
}

/* ---------- 结果区 ---------- */
function resultBox() {
  const box = el('div');
  return {
    node: box,
    show(children) { box.innerHTML = ''; box.append(...children); },
    clear() { box.innerHTML = ''; }
  };
}

/* 保存结果 → 展示 */
function renderSaveResult(res, resBox, extra) {
  resBox.show([
    extra || null,
    el('p', { class: 'hint' }, `已输出 ${res.ok.length} 个文件 → ${res.where}。`),
    res.fail.length ? el('p', { class: 'out err' }, '失败：' + res.fail.join('；')) : null
  ]);
}
