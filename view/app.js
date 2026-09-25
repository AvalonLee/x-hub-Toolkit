/* ============ 小李工具箱 · 框架（路由 / 导航 / 存储 / 公共助手） ============ */
'use strict';

/* ---------- DOM 助手 ---------- */
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled') node[k] = v;
      else node.setAttribute(k, v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fmt(n, digits = 2) {
  return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

/* ---------- 复制与提示 ---------- */
let toastTimer = 0;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}
async function copyText(text, label = '已复制') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? label : '复制失败，请手动选择');
  }
}

/* ---------- 存储（xhub.storage 无需权限；无宿主时降级 localStorage） ---------- */
const store = {
  async get(key) {
    try {
      if (window.xhub?.storage) return await window.xhub.storage.get(key);
    } catch { /* 无宿主环境降级 */ }
    try { return JSON.parse(localStorage.getItem('tk.' + key)); } catch { return null; }
  },
  async set(key, value) {
    try {
      if (window.xhub?.storage) { await window.xhub.storage.set(key, value); return; }
    } catch { /* 降级 */ }
    try { localStorage.setItem('tk.' + key, JSON.stringify(value)); } catch { /* 忽略 */ }
  }
};

/* ---------- 工具注册与路由 ---------- */
const Toolkit = {
  registry: new Map(),   // id -> { meta, render }
  current: null,
  groupOrder: null,      // 用户自定义分组顺序（id 数组，storage 'grouporder'）
  pinned: [],            // 钉住到概览的工具 id（有序，storage 'pinned'）

  register(meta, render) {
    if (!this.registry.has(meta.id)) this.registry.set(meta.id, { meta, render });
  },

  metaOf(id) {
    const cat = window.TK_CATALOG;
    return cat.tools.find(t => t.id === id) || null;
  },

  groupName(id) {
    const g = window.TK_CATALOG.groups.find(g => g.id === id);
    return g ? g.name : id;
  },

  async trackUsage(id) {
    const stats = (await store.get('stats')) || { usage: {}, recent: [] };
    stats.usage[id] = (stats.usage[id] || 0) + 1;
    stats.recent = [id, ...stats.recent.filter(x => x !== id)].slice(0, 8);
    await store.set('stats', stats);
  },

  /* ---------- 分组排序（用户自定义，storage 'grouporder'） ---------- */
  sortedGroups(cat) {
    const order = this.groupOrder;
    if (!Array.isArray(order) || !order.length) return cat.groups;
    const rank = g => { const i = order.indexOf(g.id); return i < 0 ? 100 + cat.groups.indexOf(g) : i; };
    return [...cat.groups].sort((a, b) => rank(a) - rank(b));
  },

  moveGroup(id, dir) {
    const cat = window.TK_CATALOG;
    const cur = this.sortedGroups(cat).map(g => g.id);
    const i = cur.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    this.groupOrder = cur;
    store.set('grouporder', cur); // 持久化（异步，不阻塞渲染）
  },

  /* ---------- 钉住到概览（storage 'pinned'，有序） ---------- */
  async togglePin(id) {
    const cur = Array.isArray(this.pinned) ? this.pinned : [];
    this.pinned = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    await store.set('pinned', this.pinned);
  },

  pinSvg(on) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (on ? 'currentColor' : 'none')
      + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M9 4h6l-1 6.5 3.5 3H6.5L10 10.5 9 4z"/><path d="M12 13.5V20"/></svg>';
  },

  async open(id, push = true) {
    if (this.current === id) { if (push) location.hash = '#/' + id; return; }
    const entry = this.registry.get(id);
    const meta = this.metaOf(id);
    if (!entry || !meta) return;
    if (typeof this.cleanup === 'function') { try { this.cleanup(); } catch { /* 忽略 */ } }
    this.cleanup = null;
    const main = document.getElementById('main');
    document.querySelectorAll('.navitem').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    main.innerHTML = '';
    const pinBtn = el('button', {
      class: 'pinbtn' + ((this.pinned || []).includes(id) ? ' on' : ''),
      title: (this.pinned || []).includes(id) ? '取消钉住' : '钉住到概览'
    });
    pinBtn.innerHTML = this.pinSvg((this.pinned || []).includes(id));
    pinBtn.addEventListener('click', async () => {
      await this.togglePin(id);
      const on = (this.pinned || []).includes(id);
      pinBtn.classList.toggle('on', on);
      pinBtn.innerHTML = this.pinSvg(on);
      pinBtn.title = on ? '取消钉住' : '钉住到概览';
      toast(on ? '已钉住到概览' : '已取消钉住');
    });
    main.append(
      el('div', { class: 'toolhead' },
        el('h1', {}, meta.name),
        el('p', {}, meta.desc, ' · ', this.groupName(meta.group)),
        pinBtn)
    );
    const box = el('div');
    main.append(box);
    try { this.cleanup = await entry.render(box, ctx); } catch (err) {
      box.append(el('p', { class: 'out err' }, '工具加载失败：' + err.message));
    }
    this.current = id;
    if (push) location.hash = '#/' + id;
    this.trackUsage(id);
    main.scrollTop = 0;
  },

  renderNav(filter = '') {
    const cat = window.TK_CATALOG;
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    const f = filter.trim().toLowerCase();
    for (const g of this.sortedGroups(cat)) {
      const items = cat.tools.filter(t => t.group === g.id &&
        (!f || t.name.toLowerCase().includes(f) || t.id.includes(f) || t.desc.includes(filter.trim())));
      if (!items.length) continue;
      nav.append(el('div', { class: 'navgroup' },
        el('span', {}, g.name),
        el('span', { class: 'gctl' },
          el('button', { title: '分组上移', onclick: e => { e.stopPropagation(); this.moveGroup(g.id, -1); this.renderNav(filter); } }, '↑'),
          el('button', { title: '分组下移', onclick: e => { e.stopPropagation(); this.moveGroup(g.id, 1); this.renderNav(filter); } }, '↓'))));
      for (const t of items) {
        nav.append(el('button', {
          class: 'navitem' + (this.current === t.id ? ' on' : ''),
          'data-id': t.id,
          onclick: () => this.open(t.id)
        }, el('span', { class: 'dot' }), t.name));
      }
    }
  },

  renderHome() {
    const cat = window.TK_CATALOG;
    const main = document.getElementById('main');
    document.querySelectorAll('.navitem').forEach(b => b.classList.remove('on'));
    main.innerHTML = '';
    location.hash = '';
    this.current = null;

    const head = el('div', { class: 'toolhead' },
      el('h1', {}, '小李工具箱'),
      el('p', {}, `本地小工具合集 · 全部计算在你设备上完成，数据不出本机`));
    main.append(head);

    /* 钉住的工具（置顶快捷区，点击直达） */
    const pinnedIds = (this.pinned || []);
    if (pinnedIds.length) {
      const pinGrid = el('div', { class: 'homegrid' });
      for (const id of pinnedIds) {
        const m = this.metaOf(id);
        if (!m) continue;
        const card = el('button', { class: 'homecard pin-item', onclick: () => this.open(id) },
          el('b', {}, '📌 ', m.name), el('span', {}, m.desc));
        card.append(el('span', {
          class: 'unpin', title: '取消钉住',
          onclick: e => { e.stopPropagation(); this.togglePin(id).then(() => this.renderHome()); }
        }, '✕'));
        pinGrid.append(card);
      }
      main.append(el('div', { class: 'card' }, el('h3', {}, '钉住的工具'), pinGrid));
    }

    const statsCard = el('div', { class: 'card' }, el('h3', {}, '概览'));
    const chips = el('div', { class: 'chips' });
    statsCard.append(chips);
    main.append(statsCard);
    if (!pinnedIds.length) {
      main.append(el('p', { class: 'hint', style: { margin: '0 0 14px' } },
        '小贴士：打开任意工具后，点标题右侧的图钉可将其钉到概览顶部，快速访问。'));
    }
    store.get('stats').then(stats => {
      const usage = stats?.usage || {};
      const total = Object.values(usage).reduce((a, b) => a + b, 0);
      chips.append(el('span', { class: 'chip' }, cat.tools.length, el('small', {}, '项工具')));
      chips.append(el('span', { class: 'chip' }, total, el('small', {}, '次使用')));
      const rec = (stats?.recent || []).map(id => this.metaOf(id)).filter(Boolean).slice(0, 3);
      for (const m of rec) {
        chips.append(el('button', {
          class: 'chip', style: { cursor: 'pointer', border: '0', font: 'inherit' },
          onclick: () => this.open(m.id)
        }, '↻ ', m.name));
      }
    });

    for (const g of this.sortedGroups(cat)) {
      const items = cat.tools.filter(t => t.group === g.id);
      const grid = el('div', { class: 'homegrid' });
      for (const t of items) {
        grid.append(el('button', { class: 'homecard', onclick: () => this.open(t.id) },
          el('b', {}, t.name), el('span', {}, t.desc)));
      }
      main.append(el('div', { class: 'card' }, el('h3', {}, g.name), grid));
    }
  },

  async init() {
    // 注册各工具（tools/*.js 依赖 TK_CATALOG 已加载）
    for (const reg of window.TK_REGISTERS || []) reg();

    // 用户偏好预取（分组顺序 / 钉住列表）——先读回再首绘
    this.groupOrder = await store.get('grouporder');
    this.pinned = (await store.get('pinned')) || [];

    const nav = document.getElementById('nav');
    const filter = document.getElementById('navfilter');
    /* 版本号单一来源 = catalog.js（manifest.version 升级时同步改它） */
    const bv = document.getElementById('brandver');
    if (bv) bv.textContent = 'v' + ((window.TK_CATALOG && window.TK_CATALOG.version) || '?');
    document.getElementById('brand').addEventListener('click', () => this.renderHome());
    filter.addEventListener('input', () => this.renderNav(filter.value));

    const fromHash = () => {
      const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
      if (id && this.registry.has(id)) this.open(id, false);
      else this.renderHome();
    };
    window.addEventListener('hashchange', fromHash);

    // 侧栏首屏：先渲染导航，再按 hash 进入（storage 异步不影响导航可用性）
    this.renderNav();
    fromHash();

    // 无宿主环境提示（浏览器直开预览时 bridge 不存在，功能仍可用）
    if (!window.xhub?.storage) {
      const tip = el('div', { class: 'card', style: { marginBottom: '14px', padding: '8px 14px' } },
        el('span', { class: 'hint' }, '⚠ 当前在浏览器预览模式，偏好与统计暂存于浏览器；在 x-hub 中打开则由宿主持久化。'));
      document.getElementById('main').prepend(tip);
    }
  }
};

/* 公共上下文：传给每个工具的 render(container, ctx) */
const ctx = { el, esc, num, fmt, toast, copyText, store };

/* 各工具文件向这里 push 注册函数，init 时统一执行 */
window.TK_REGISTERS = window.TK_REGISTERS || [];

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Toolkit.init());
} else {
  Toolkit.init(); // 脚本被动态注入或 DOMContentLoaded 已过时兜底
}
