/* ============ 计算器扩展：单位换算器 ============ */
'use strict';

TK_REGISTERS.push(() => {

  /* 线性单位表：[显示名, 基准倍率]；温度类走独立函数 */
  const CATS = [
    { id: 'length', name: '长度', units: [
      ['米 m', 1], ['千米 km', 1000], ['分米 dm', 0.1], ['厘米 cm', 0.01], ['毫米 mm', 0.001],
      ['微米 μm', 1e-6], ['纳米 nm', 1e-9], ['英里 mi', 1609.344], ['码 yd', 0.9144],
      ['英尺 ft', 0.3048], ['英寸 in', 0.0254], ['海里 nmi', 1852], ['里 (华里)', 500], ['丈', 10 / 3]
    ] },
    { id: 'mass', name: '质量', units: [
      ['千克 kg', 1], ['克 g', 0.001], ['毫克 mg', 1e-6], ['吨 t', 1000], ['斤', 0.5], ['两', 0.05],
      ['磅 lb', 0.45359237], ['盎司 oz', 0.028349523125], ['克拉 ct', 0.0002], ['钱', 0.005]
    ] },
    { id: 'temp', name: '温度', special: 'temp', units: [
      ['摄氏度 °C', 'C'], ['华氏度 °F', 'F'], ['开尔文 K', 'K'], ['兰氏度 °R', 'R']
    ] },
    { id: 'area', name: '面积', units: [
      ['平方米 m²', 1], ['平方千米 km²', 1e6], ['公顷 ha', 1e4], ['亩', 2000 / 3],
      ['平方分米 dm²', 0.01], ['平方厘米 cm²', 1e-4], ['平方英尺 ft²', 0.09290304],
      ['平方英寸 in²', 6.4516e-4], ['英亩 acre', 4046.8564224]
    ] },
    { id: 'volume', name: '体积', units: [
      ['升 L', 1], ['毫升 mL', 0.001], ['立方米 m³', 1000], ['加仑 (美) gal', 3.785411784],
      ['夸脱 (美) qt', 0.946352946], ['品脱 (美) pt', 0.473176473], ['杯 (公制) cup', 0.25],
      ['汤匙 tbsp', 0.0147867648], ['茶匙 tsp', 0.0049289216], ['立方英尺 ft³', 28.316846592]
    ] },
    { id: 'speed', name: '速度', units: [
      ['米/秒 m/s', 1], ['千米/时 km/h', 1 / 3.6], ['英里/时 mph', 0.44704],
      ['节 kn', 1852 / 3600], ['英尺/秒 ft/s', 0.3048], ['马赫 (常温声速)', 340.3]
    ] },
    { id: 'time', name: '时间', units: [
      ['秒 s', 1], ['毫秒 ms', 0.001], ['微秒 μs', 1e-6], ['分 min', 60], ['时 h', 3600],
      ['天 d', 86400], ['周', 604800], ['月 (30 天)', 2592000], ['年 (365 天)', 31536000]
    ] },
    { id: 'data', name: '数据', units: [
      ['字节 B', 1], ['千字节 KiB', 1024], ['兆字节 MiB', 1048576], ['吉字节 GiB', 1073741824],
      ['太字节 TiB', 1099511627776], ['比特 bit', 0.125],
      ['KB (十进制)', 1e3], ['MB (十进制)', 1e6], ['GB (十进制)', 1e9], ['TB (十进制)', 1e12]
    ] },
    { id: 'pressure', name: '压力', units: [
      ['帕 Pa', 1], ['千帕 kPa', 1000], ['兆帕 MPa', 1e6], ['巴 bar', 1e5],
      ['标准大气压 atm', 101325], ['毫米汞柱 mmHg', 133.322368421], ['工程大气压 at', 98066.5],
      ['磅/平方英寸 psi', 6894.757293168]
    ] },
    { id: 'energy', name: '能量', units: [
      ['焦耳 J', 1], ['千焦 kJ', 1000], ['卡路里 cal', 4.184], ['千卡 kcal', 4184],
      ['瓦时 Wh', 3600], ['千瓦时 kWh', 3.6e6], ['电子伏特 eV', 1.602176634e-19]
    ] },
    { id: 'power', name: '功率', units: [
      ['瓦 W', 1], ['千瓦 kW', 1000], ['兆瓦 MW', 1e6],
      ['马力 (米制) PS', 735.49875], ['马力 (英制) hp', 745.699871582]
    ] },
    { id: 'angle', name: '角度', units: [
      ['度 °', 1], ['弧度 rad', 180 / Math.PI], ['百分度 grad', 0.9],
      ['周 turn', 360], ['角分 ′', 1 / 60], ['角秒 ″', 1 / 3600]
    ] }
  ];

  /* 温度互转：统一以摄氏为中转 */
  function tempToC(v, from) {
    if (from === 'F') return (v - 32) * 5 / 9;
    if (from === 'K') return v - 273.15;
    if (from === 'R') return (v - 491.67) * 5 / 9;
    return v;
  }
  function cToTemp(c, to) {
    if (to === 'F') return c * 9 / 5 + 32;
    if (to === 'K') return c + 273.15;
    if (to === 'R') return (c + 273.15) * 9 / 5;
    return c;
  }

  /* 智能位数：极大/极小走科学计数，其余保留 10 位有效并千分位 */
  function fmtSmart(x) {
    if (!Number.isFinite(x)) return '—';
    if (x !== 0 && (Math.abs(x) >= 1e15 || Math.abs(x) < 1e-9)) return x.toExponential(6);
    return Number(x.toPrecision(12)).toLocaleString('zh-CN', { maximumFractionDigits: 10 });
  }

  Toolkit.register({ id: 'unitconv' }, async (box) => {
    let cat = CATS[0];

    const val = el('input', { type: 'text', inputmode: 'decimal', value: '1', style: { width: '140px' } });
    const unitSel = el('select');
    const tbody = el('tbody');
    const table = el('table', { class: 'outtable' },
      el('thead', {}, el('tr', {}, el('th', {}, '目标单位'), el('th', {}, '换算结果（点击行复制）'))), tbody);

    const catChips = el('div', { class: 'chips', style: { marginBottom: '10px' } });
    for (const c of CATS) {
      const b = el('button', { class: 'btn sm' + (c === cat ? ' primary' : ''), onclick: () => setCat(c) }, c.name);
      c._btn = b;
      catChips.append(b);
    }

    function setCat(c) {
      cat = c;
      for (const x of CATS) x._btn.classList.toggle('primary', x === c);
      unitSel.innerHTML = '';
      for (const [label, key] of c.units) unitSel.append(el('option', { value: String(key) }, label));
      convert();
    }

    function convert() {
      const n = parseFloat(val.value.replace(/,/g, ''));
      tbody.innerHTML = '';
      if (!Number.isFinite(n)) {
        tbody.append(el('tr', {}, el('td', { colspan: 2, class: 'hint' }, '输入有效数值后自动换算…')));
        return;
      }
      const makeRow = (label, out) => {
        const tr = el('tr', { title: '点击复制', style: { cursor: 'pointer' } },
          el('td', {}, label), el('td', { class: 'mono' }, fmtSmart(out)));
        tr.addEventListener('click', () => copyText(fmtSmart(out), '已复制：' + label + ' = ' + fmtSmart(out)));
        return tr;
      };
      if (cat.special === 'temp') {
        const cv = tempToC(n, unitSel.value);
        for (const [label, key] of cat.units) tbody.append(makeRow(label, cToTemp(cv, key)));
      } else {
        const base = n * unitSel.value;
        for (const [label, rate] of cat.units) tbody.append(makeRow(label, base / rate));
      }
    }

    val.addEventListener('input', convert);
    unitSel.addEventListener('change', convert);
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '类别与输入'), catChips,
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '数值'), val),
          el('div', { class: 'field' }, el('label', {}, '从单位'), unitSel),
          el('span', { class: 'hint' }, '结果实时列出该类别全部单位'))),
      el('div', { class: 'card' }, el('h3', {}, '换算结果'), table)
    );
    setCat(CATS[0]);
  });

  /* headless 断言钩子 */
  window.TK_UNIT_TEST = { CATS, tempToC, cToTemp, fmtSmart };

});
