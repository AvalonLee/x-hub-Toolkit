/* ============ 计算器组：体脂率 / 时间戳 / 房贷 / 利息 / 密码生成 ============ */
'use strict';

TK_REGISTERS.push(() => {

  /* ---------- 体脂率计算器 ---------- */
  Toolkit.register({ id: 'bmi' }, async (box, c) => {
    const sex = el('select', {}, el('option', { value: 'm', selected: true }, '男'), el('option', { value: 'f' }, '女'));
    const age = el('input', { type: 'number', value: 30, min: 10, max: 100 });
    const height = el('input', { type: 'number', value: 170, min: 80, max: 250 });
    const weight = el('input', { type: 'number', value: 65, min: 20, max: 300, step: '0.1' });
    const neck = el('input', { type: 'number', value: 38, min: 20, max: 70, step: '0.1' });
    const waist = el('input', { type: 'number', value: 82, min: 40, max: 200, step: '0.1' });
    const hip = el('input', { type: 'number', value: 95, min: 50, max: 200, step: '0.1' });
    const hipField = el('div', { class: 'field' }, el('label', {}, '臀围 (cm)'), hip);
    const out = el('div');

    function classifyBmi(v) {
      if (v < 18.5) return ['偏瘦', 'warn'];
      if (v < 24) return ['正常', 'ok'];
      if (v < 28) return ['超重', 'warn'];
      return ['肥胖', 'bad'];
    }
    function classifyBf(v, s) {
      const t = s === 'm'
        ? [[6, '运动员', 'ok'], [14, '健康', 'ok'], [18, '可接受', 'warn'], [25, '肥胖', 'bad']]
        : [[14, '运动员', 'ok'], [21, '健康', 'ok'], [25, '可接受', 'warn'], [32, '肥胖', 'bad']];
      if (v < t[0][0]) return ['偏低', 'warn'];
      for (const [limit, label, cls] of t) if (v < limit) return [label, cls];
      return [t[t.length - 1][1], t[t.length - 1][2]];
    }
    function run() {
      const s = sex.value, h = c.num(height.value), w = c.num(weight.value), a = c.num(age.value);
      const n = c.num(neck.value), wa = c.num(waist.value), hp = c.num(hip.value);
      if (!(h > 0 && w > 0)) { toast('请输入有效的身高体重'); return; }
      const bmi = w / Math.pow(h / 100, 2);
      let bf = null, note = '';
      try {
        if (s === 'm') {
          if (wa - n <= 0) throw 0;
          bf = 495 / (1.0324 - 0.19077 * Math.log10(wa - n) + 0.15456 * Math.log10(h)) - 450;
        } else {
          if (wa + hp - n <= 0) throw 0;
          bf = 495 / (1.29579 - 0.35004 * Math.log10(wa + hp - n) + 0.22100 * Math.log10(h)) - 450;
        }
      } catch { bf = null; note = '围度数据无效，无法用海军法估算'; }
      const [bl, bc] = classifyBmi(bmi);
      out.innerHTML = '';
      const grid = el('div', { class: 'row', style: { gap: '28px' } },
        el('div', {}, el('div', { class: 'kpi' }, c.fmt(bmi), el('small', {}, 'BMI')), el('span', { class: 'badge ' + bc }, bl)),
        bf != null && bf > 0
          ? el('div', {}, el('div', { class: 'kpi' }, c.fmt(Math.max(0, bf), 1) + '%', el('small', {}, '体脂率（海军法）')),
              (() => { const [l, cl] = classifyBf(bf, s); return el('span', { class: 'badge ' + cl }, l); })())
          : el('div', {}, el('span', { class: 'hint' }, note)));
      out.append(grid,
        el('p', { class: 'hint' },
          `性别 ${s === 'm' ? '男' : '女'} · 年龄 ${a} 岁 · 身高 ${h}cm · 体重 ${w}kg。`,
          s === 'f' ? '女性体脂估算含臀围。' : '', '结果为统计估算，不构成医学建议。'));
    }
    sex.addEventListener('change', () => { hipField.style.display = sex.value === 'f' ? '' : 'none'; });
    hipField.style.display = 'none'; // 默认男性，隐藏臀围
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '基本信息'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '性别'), sex),
          el('div', { class: 'field' }, el('label', {}, '年龄'), age),
          el('div', { class: 'field' }, el('label', {}, '身高 (cm)'), height),
          el('div', { class: 'field' }, el('label', {}, '体重 (kg)'), weight))),
      el('div', { class: 'card' }, el('h3', {}, '围度（美国海军法）'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '颈围 (cm)'), neck),
          el('div', { class: 'field' }, el('label', {}, '腰围 (cm)'), waist),
          hipField,
          el('button', { class: 'btn primary', onclick: run }, '计算'))),
      out);
    run();
  });

  /* ---------- 时间戳计算器 ---------- */
  Toolkit.register({ id: 'timestamp' }, async (box, c) => {
    const nowBox = el('div', { class: 'row', style: { gap: '24px' } });
    let timer = 0;
    function tick() {
      const now = new Date();
      nowBox.innerHTML = '';
      nowBox.append(
        el('div', {}, el('div', { class: 'kpi', style: { fontSize: '18px' } }, Math.floor(now.getTime() / 1000)), el('span', { class: 'hint' }, 'Unix 秒')),
        el('div', {}, el('div', { class: 'kpi', style: { fontSize: '18px' } }, now.getTime()), el('span', { class: 'hint' }, 'Unix 毫秒')),
        el('div', {}, el('div', { style: { fontSize: '15px', fontWeight: 600, paddingTop: '4px' } }, now.toLocaleString('zh-CN', { hour12: false })), el('span', { class: 'hint' }, '本地时间')));
    }
    const tsInput = el('input', { type: 'text', placeholder: '如 1727232000 或 1727232000000', style: { width: '240px' }, class: 'mono' });
    const tsOut = el('div');
    tsInput.addEventListener('input', () => {
      tsOut.innerHTML = '';
      const v = tsInput.value.trim();
      if (!/^\d{1,16}$/.test(v)) return;
      const ms = v.length >= 13 ? Number(v) : Number(v) * 1000;
      const d = new Date(ms);
      if (isNaN(d.getTime())) { tsOut.append(el('p', { class: 'out err' }, '✗ 超出可表示范围')); return; }
      tsOut.append(el('pre', { class: 'out' },
        `本地：${d.toLocaleString('zh-CN', { hour12: false })}\nUTC ：${d.toUTCString()}\nISO ：${d.toISOString()}`));
    });
    const dtInput = el('input', { type: 'datetime-local' });
    const dtOut = el('div');
    function dtRun() {
      dtOut.innerHTML = '';
      if (!dtInput.value) return;
      const d = new Date(dtInput.value);
      if (isNaN(d.getTime())) { dtOut.append(el('p', { class: 'out err' }, '✗ 日期无效')); return; }
      dtOut.append(el('pre', { class: 'out' }, `秒：${Math.floor(d.getTime() / 1000)}\n毫秒：${d.getTime()}`));
    }
    dtInput.addEventListener('input', dtRun);
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '当前时间'), nowBox),
      el('div', { class: 'card' }, el('h3', {}, '时间戳 → 日期'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '时间戳（自动识别秒/毫秒）'), tsInput)),
        tsOut),
      el('div', { class: 'card' }, el('h3', {}, '日期 → 时间戳'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '本地日期时间'), dtInput),
          el('button', { class: 'btn', onclick: () => { dtInput.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); dtRun(); } }, '填入现在')),
        dtOut),
      el('p', { class: 'hint' }, '纯本地换算，时区取系统设置。'));
    tick();
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  });

  /* ---------- 房贷计算器 ---------- */
  Toolkit.register({ id: 'mortgage' }, async (box, c) => {
    const amount = el('input', { type: 'number', value: 100, min: 1, step: '1' });
    const rate = el('input', { type: 'number', value: 3.6, min: 0.01, max: 36, step: '0.01' });
    const years = el('select', {},
      ...[10, 15, 20, 25, 30].map(y => el('option', { value: y, selected: y === 30 }, `${y} 年`)));
    const mode = el('select', {},
      el('option', { value: 'axbx', selected: true }, '等额本息（月供固定）'),
      el('option', { value: 'debx' }, '等额本金（月供递减）'));
    const out = el('div');

    function run() {
      const P = c.num(amount.value) * 10000;   // 元
      const R = c.num(rate.value) / 100 / 12;  // 月利率
      const N = c.num(years.value) * 12;       // 期数
      if (!(P > 0 && R > 0 && N > 0)) { toast('请检查输入'); return; }
      out.innerHTML = '';
      const rows = [];
      let totalPay = 0, firstPay = 0, lastPay = 0;
      if (mode.value === 'axbx') {
        const m = P * R * Math.pow(1 + R, N) / (Math.pow(1 + R, N) - 1);
        totalPay = m * N; firstPay = lastPay = m;
        let bal = P;
        for (let i = 1; i <= N; i++) {
          const it = bal * R, pr = m - it; bal -= pr;
          rows.push([i, m, pr, it, Math.max(0, bal)]);
        }
      } else {
        const pr = P / N; let bal = P;
        for (let i = 1; i <= N; i++) {
          const it = bal * R; const pay = pr + it; bal -= pr;
          if (i === 1) firstPay = pay;
          lastPay = pay;
          totalPay += pay;
          rows.push([i, pay, pr, it, Math.max(0, bal)]);
        }
      }
      const totalInterest = totalPay - P;
      const showRows = rows.slice(0, 12);
      const tb = el('table', { class: 'outtable' },
        el('tr', {}, el('th', {}, '期数'), el('th', {}, '月供'), el('th', {}, '本金'), el('th', {}, '利息'), el('th', {}, '剩余本金')),
        showRows.map(r => el('tr', {},
          r.slice(0, 4).map((v, i) => el('td', {}, i === 0 ? r[0] : '¥' + c.fmt(v))),
          el('td', {}, '¥' + c.fmt(r[4])))));
      out.append(
        el('div', { class: 'row', style: { gap: '28px', marginBottom: '12px' } },
          mode.value === 'axbx'
            ? el('div', {}, el('div', { class: 'kpi' }, '¥' + c.fmt(firstPay), el('small', {}, '每月月供')))
            : el('div', {}, el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(firstPay), el('small', {}, '首月')),
                el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(lastPay), el('small', {}, `末月（逐月递减 ¥${c.fmt((firstPay - lastPay) / Math.max(1, N - 1))}）`))),
          el('div', {}, el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(totalInterest), el('small', {}, '总利息'))),
          el('div', {}, el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(totalPay), el('small', {}, '还款总额')))),
        tb,
        N > 12 ? el('p', { class: 'hint' }, `仅显示前 12 期，共 ${N} 期。`) : null,
        el('p', { class: 'hint' }, `贷款 ¥${c.fmt(P)} · 年利率 ${c.fmt(c.num(rate.value), 2)}% · ${N} 期。利率与政策以银行实际为准。`));
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '贷款条件'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '贷款额（万元）'), amount),
          el('div', { class: 'field' }, el('label', {}, '年利率 (%)'), rate),
          el('div', { class: 'field' }, el('label', {}, '期限'), years),
          el('div', { class: 'field' }, el('label', {}, '方式'), mode),
          el('button', { class: 'btn primary', onclick: run }, '计算'))),
      out);
    run();
  });

  /* ---------- 利息计算器 ---------- */
  Toolkit.register({ id: 'interest' }, async (box, c) => {
    const principal = el('input', { type: 'number', value: 100000, min: 1, step: '100' });
    const rate = el('input', { type: 'number', value: 2.5, min: 0.01, max: 100, step: '0.01' });
    const years = el('input', { type: 'number', value: 5, min: 1, max: 50 });
    const freq = el('select', {},
      el('option', { value: 'simple' }, '单利'),
      el('option', { value: '1' }, '复利 · 按年'),
      el('option', { value: '2' }, '复利 · 按半年'),
      el('option', { value: '4', selected: true }, '复利 · 按季'),
      el('option', { value: '12' }, '复利 · 按月'),
      el('option', { value: '365' }, '复利 · 按日'));
    const out = el('div');

    function run() {
      const P = c.num(principal.value), r = c.num(rate.value) / 100, n = c.num(years.value);
      if (!(P > 0 && r > 0 && n > 0)) { toast('请检查输入'); return; }
      out.innerHTML = '';
      const m = freq.value === 'simple' ? 0 : c.num(freq.value, 1);
      const fv = m === 0 ? P * (1 + r * n) : P * Math.pow(1 + r / m, m * n);
      const rows = [];
      for (let y = 1; y <= Math.min(30, n); y++) {
        rows.push([y, m === 0 ? P * (1 + r * y) : P * Math.pow(1 + r / m, m * y)]);
      }
      out.append(
        el('div', { class: 'row', style: { gap: '28px', marginBottom: '12px' } },
          el('div', {}, el('div', { class: 'kpi' }, '¥' + c.fmt(fv), el('small', {}, `${n} 年后终值`))),
          el('div', {}, el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(fv - P), el('small', {}, '总利息')))),
        el('table', { class: 'outtable' },
          el('tr', {}, el('th', {}, '年末'), el('th', {}, '账户价值'), el('th', {}, '累计利息')),
          rows.map(([y, v]) => el('tr', {},
            el('td', {}, `第 ${y} 年`), el('td', {}, '¥' + c.fmt(v)), el('td', {}, '¥' + c.fmt(v - P))))),
        n > 30 ? el('p', { class: 'hint' }, `增长表仅显示前 30 年。`) : null,
        el('p', { class: 'hint' }, m === 0 ? '单利：FV = P × (1 + r × n)' : '复利：FV = P × (1 + r/m)^(m×n)，结果未计税费。'));
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '存款条件'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '本金 (¥)'), principal),
          el('div', { class: 'field' }, el('label', {}, '年利率 (%)'), rate),
          el('div', { class: 'field' }, el('label', {}, '期限（年）'), years),
          el('div', { class: 'field' }, el('label', {}, '计息方式'), freq),
          el('button', { class: 'btn primary', onclick: run }, '计算'))),
      out);
    run();
  });

  /* ---------- 密码生成器 ---------- */
  Toolkit.register({ id: 'password' }, async (box, c) => {
    const len = el('input', { type: 'range', min: 8, max: 64, value: 16, style: { width: '180px' } });
    const lenLabel = el('b', {}, '16');
    const up = el('input', { type: 'checkbox', checked: true });
    const low = el('input', { type: 'checkbox', checked: true });
    const dig = el('input', { type: 'checkbox', checked: true });
    const sym = el('input', { type: 'checkbox', checked: true });
    const noAmb = el('input', { type: 'checkbox' });
    const out = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });

    const SETS = { up: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', low: 'abcdefghijklmnopqrstuvwxyz', dig: '0123456789', sym: '!@#$%^&*()-_=+[]{};:,.<>?/~' };
    const AMBIG = /[0O1lI|`'"{}[\]();:,.]/g;

    function randInt(max) { // 无模偏差 rejection sampling
      const lim = Math.floor(0xFFFFFFFF / max) * max;
      const buf = new Uint32Array(1);
      do { crypto.getRandomValues(buf); } while (buf[0] >= lim);
      return buf[0] % max;
    }
    function genOne() {
      let pool = '';
      const groups = [];
      if (up.checked) { let s = SETS.up; if (noAmb.checked) s = s.replace(AMBIG, ''); pool += s; groups.push(s); }
      if (low.checked) { let s = SETS.low; if (noAmb.checked) s = s.replace(AMBIG, ''); pool += s; groups.push(s); }
      if (dig.checked) { let s = SETS.dig; if (noAmb.checked) s = s.replace(AMBIG, ''); pool += s; groups.push(s); }
      if (sym.checked) { let s = SETS.sym; if (noAmb.checked) s = s.replace(AMBIG, ''); pool += s; groups.push(s); }
      if (!pool) return null;
      const L = c.num(len.value, 16);
      const chars = [];
      for (const s of groups) if (s.length) chars.push(s[randInt(s.length)]);       // 保证每类至少一个
      while (chars.length < L) chars.push(pool[randInt(pool.length)]);
      // Fisher-Yates 洗牌
      for (let i = chars.length - 1; i > 0; i--) {
        const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.slice(0, L).join('');
    }
    function strength(L, poolLen) {
      const bits = L * Math.log2(Math.max(2, poolLen));
      const label = bits < 60 ? ['弱', 'bad'] : bits < 80 ? ['中', 'warn'] : bits < 100 ? ['强', 'ok'] : ['极强', 'ok'];
      return { bits: Math.round(bits), label, cls: label[1] };
    }
    function gen() {
      const n = 5;
      const L = c.num(len.value, 16);
      let poolLen = 0;
      for (const [k, set] of Object.entries(SETS)) {
        if ({ up, low, dig, sym }[k].checked) poolLen += noAmb.checked ? set.replace(AMBIG, '').length : set.length;
      }
      if (!poolLen) { toast('请至少选择一类字符'); return; }
      out.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const pw = genOne();
        out.append(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          el('code', { class: 'mono', style: { flex: '1', fontSize: '14px', cursor: 'pointer', wordBreak: 'break-all' },
            onclick: (e) => copyText(pw, '密码已复制'), title: '点击复制' }, pw),
          el('button', { class: 'btn sm', onclick: (e) => copyText(pw, '密码已复制') }, '复制')));
      }
      const s = strength(L, poolLen);
      out.append(el('p', { class: 'hint' }, `字符池 ${poolLen} 位 · 熵约 `,
        el('b', {}, `${s.bits} bit`), ' · 强度：', el('span', { class: 'badge ' + s.cls }, s.label[0]),
        ' · 密码仅生成于内存，不写入存储、不上传。'));
    }
    len.addEventListener('input', () => { lenLabel.textContent = len.value; });
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '规则'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '长度（', lenLabel, ' 位）'), len),
          el('label', { class: 'chk' }, up, '大写 A-Z'),
          el('label', { class: 'chk' }, low, '小写 a-z'),
          el('label', { class: 'chk' }, dig, '数字 0-9'),
          el('label', { class: 'chk' }, sym, '符号'),
          el('label', { class: 'chk' }, noAmb, '排除易混淆（0O1lI 等）'),
          el('button', { class: 'btn primary', onclick: gen }, '生成 5 个'),
          el('button', { class: 'btn', onclick: () => copyText([...out.querySelectorAll('code')].map(x => x.textContent).join('\n'), '全部已复制') }, '复制全部'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), out));
    gen();
  });

  /* ---------- 退休待遇测算器 ---------- */
  /* 规则依据：基础养老金 =退休时计发基数×(1+平均缴费指数)/2×缴费年限×1%；
     个人账户养老金 =账户累计储存额÷计发月数（国发〔2005〕38 号表）；
     延迟退休按 2025-01-01 起渐进式办法推算（男 60→63 每 4 个月+1 月、
     女 55→58 每 4 个月+1 月、女 50→55 每 2 个月+1 月，首批均延迟 1 个月）。 */
  Toolkit.register({ id: 'pension' }, async (box, c) => {
    const MONTHS = { 40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212, 47: 208, 48: 204, 49: 199, 50: 195, 51: 190, 52: 185, 53: 180, 54: 175, 55: 170, 56: 164, 57: 158, 58: 152, 59: 145, 60: 139, 61: 132, 62: 125, 63: 117, 64: 109, 65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56 };
    const KINDS = {
      m60: { base: 60, y0: 1965, step: 4, cap: 36, label: '男职工' },
      f55: { base: 55, y0: 1970, step: 4, cap: 36, label: '女职工（管理技术岗）' },
      f50: { base: 50, y0: 1975, step: 2, cap: 60, label: '女职工（工人岗）' }
    };
    const kind = el('select', {},
      el('option', { value: 'm60', selected: true }, '男职工（原 60 岁退休）'),
      el('option', { value: 'f55' }, '女职工 · 管理技术岗（原 55 岁）'),
      el('option', { value: 'f50' }, '女职工 · 工人岗（原 50 岁）'));
    const by = el('input', { type: 'number', value: 1985, min: 1950, max: 2010 });
    const bm = el('select', {}, ...Array.from({ length: 12 }, (_, i) =>
      el('option', { value: String(i + 1), selected: i === 5 }, `${i + 1} 月`)));
    const paidYears = el('input', { type: 'number', value: 12, min: 0, max: 47, step: '0.5' });
    const idx = el('input', { type: 'number', value: 0.8, min: 0.6, max: 3, step: '0.05' });
    const base = el('input', { type: 'number', value: 8000, min: 2000, step: '10' });
    const acc = el('input', { type: 'number', value: 60000, min: 0, step: '1000' });
    const grow = el('input', { type: 'number', value: 3, min: 0, max: 10, step: '0.5' });
    const rate = el('input', { type: 'number', value: 2, min: 0, max: 9, step: '0.1' });
    const out = el('div');

    function run() {
      out.innerHTML = '';
      const cfg = KINDS[kind.value];
      const Y = Math.round(c.num(by.value)), M = Math.round(c.num(bm.value, 1));
      if (!(Y >= 1950 && Y <= 2010 && M >= 1 && M <= 12)) { toast('请填写有效出生年份'); return; }
      const now = new Date();
      const nowM = now.getFullYear() * 12 + now.getMonth() + 1;
      const birthM = Y * 12 + (M - 1);
      const ageMonths = nowM - birthM;
      if (ageMonths < 16 * 12) { toast('出生年月需距今年满 16 周岁'); return; }

      // 延迟退休月数：2025-01-01 前已满原法定年龄（出生早于基线年）不延迟
      let delay = 0;
      if (Y >= cfg.y0) {
        const d = (Y - cfg.y0) * 12 + (M - 1);
        delay = Math.min(Math.ceil((d + 1) / cfg.step), cfg.cap);
      }
      const retM = birthM + cfg.base * 12 + delay;          // 退休月索引（绝对）
      const retireYear = Math.floor(retM / 12), retireMonth = (retM % 12) + 1;
      const totalAgeMonths = cfg.base * 12 + delay;
      const ageY = Math.floor(totalAgeMonths / 12), ageMo = totalAgeMonths % 12;
      const futureM = Math.max(0, retM - nowM);             // 距退休的月数

      const paid = Math.max(0, c.num(paidYears.value));
      const idxV = c.num(idx.value, 0.6);
      const baseNow = c.num(base.value, 0);
      const accNow = Math.max(0, c.num(acc.value));
      const g = c.num(grow.value, 3) / 100;
      const r = c.num(rate.value, 2) / 100;
      const totalYears = paid + futureM / 12;
      const minY = retireYear <= 2029 ? 15 : Math.min(20, 15 + (retireYear - 2029) * 0.5);

      if (!(idxV > 0) || !(baseNow > 0)) { toast('请填写缴费指数与计发基数'); return; }

      // 个人账户滚存：按月递推（月入账 = 计发基数×指数×8%，按增长率逐月上调）
      const gM = Math.pow(1 + g, 1 / 12) - 1;
      const rM = r / 12;
      let B = accNow;
      for (let k = 0; k < futureM; k++) {
        B = B * (1 + rM) + baseNow * idxV * Math.pow(1 + gM, k) * 0.08;
      }
      const baseRet = baseNow * Math.pow(1 + g, futureM / 12);
      const pensionA = baseRet * (1 + idxV) / 2 * totalYears * 0.01;   // 基础养老金
      const retireAgeY = cfg.base + delay / 12;
      const mi = Math.min(70, Math.max(40, Math.floor(retireAgeY)));
      const months = MONTHS[mi];
      const pensionB = B / months;                                     // 个人账户养老金
      const total = pensionA + pensionB;
      const short = totalYears < minY;

      out.append(
        el('div', { class: 'row', style: { gap: '28px', marginBottom: '12px' } },
          el('div', {}, el('div', { class: 'kpi' }, '¥' + c.fmt(total), el('small', {}, '预计月养老金'))),
          el('div', {}, el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(pensionA), el('small', {}, '基础养老金'))),
          el('div', {}, el('div', { class: 'kpi', style: { fontSize: '17px' } }, '¥' + c.fmt(pensionB), el('small', {}, '个人账户养老金')))),
        el('table', { class: 'outtable' },
          el('tr', {}, el('th', {}, '项目'), el('th', {}, '估算值')),
          el('tr', {}, el('td', {}, '法定退休年龄'), el('td', {}, `${ageY} 岁 ${ageMo} 个月（延迟 ${delay} 个月）`)),
          el('tr', {}, el('td', {}, '预计退休时间'), el('td', {}, `${retireYear} 年 ${retireMonth} 月`)),
          el('tr', {}, el('td', {}, '总缴费年限（含视同）'), el('td', {}, totalYears.toFixed(1) + ' 年')),
          el('tr', {}, el('td', {}, '最低缴费年限要求'), el('td', {},
            `${minY % 1 ? minY.toFixed(1) : minY} 年`,
            el('span', { class: 'badge ' + (short ? 'bad' : 'ok'), style: { marginLeft: '8px' } }, short ? '未达最低年限' : '已达标'))),
          el('tr', {}, el('td', {}, '退休时计发基数（假设）'), el('td', {}, '¥' + c.fmt(baseRet) + ' / 月')),
          el('tr', {}, el('td', {}, '退休时个人账户储存额（估算）'), el('td', {}, '¥' + c.fmt(B))),
          el('tr', {}, el('td', {}, '计发月数'), el('td', {}, `${months} 个月（按 ${Math.floor(retireAgeY)} 岁档）`))),
        short ? el('p', { class: 'hint', style: { color: 'var(--red)' } },
          `按当前口径推算总缴费年限 ${totalYears.toFixed(1)} 年，低于 ${retireYear} 年退休所需的 ${minY} 年最低年限，可能无法按月领取养老金。`) : null,
        el('p', { class: 'hint', style: { color: 'var(--red)', fontWeight: '600' } }, '⚠ 估算结果仅供参考，实际以各地政策为准。'),
        el('p', { class: 'hint' },
          '口径：基础养老金 =退休时计发基数×(1+平均缴费指数)/2×缴费年限×1%；个人账户养老金=账户储存额÷计发月数（国发〔2005〕38 号，取退休整岁档）。未含过渡性养老金与地方性增发项；缴费基数按「计发基数×指数」近似，月入账 8%，按记账利率月复利滚存；计发基数与基数增长率共用同一假设增速。'));
    }
    [kind, by, bm, paidYears, idx, base, acc, grow, rate].forEach(x => x.addEventListener('input', run));
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '基本信息'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '人员类别'), kind),
          el('div', { class: 'field' }, el('label', {}, '出生年份'), by),
          el('div', { class: 'field' }, el('label', {}, '出生月份'), bm),
          el('div', { class: 'field' }, el('label', {}, '已缴费年限（年，含视同）'), paidYears),
          el('div', { class: 'field' }, el('label', {}, '平均缴费指数'), idx))),
      el('div', { class: 'card' }, el('h3', {}, '缴费与假设'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '当地计发基数 (¥/月)'), base),
          el('div', { class: 'field' }, el('label', {}, '个人账户现有余额 (¥)'), acc),
          el('div', { class: 'field' }, el('label', {}, '基数年增长率 (%)'), grow),
          el('div', { class: 'field' }, el('label', {}, '个人账户记账利率 (%)'), rate)),
        el('p', { class: 'hint' }, '计发基数请按本地社保年度公布值填写（示例默认 8000 元）；记账利率近年参考：2023 年 3.97%、2024 年 2.62%、2025 年 1.50%，默认取 2%。')),
      out);
    run();
  });

});
