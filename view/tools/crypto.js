/* ============ 加密组：哈希 / HMAC / AES-GCM / Hex / 随机密钥 ============ */
'use strict';

TK_REGISTERS.push(() => {

  const b2hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const b2b64 = buf => btoa(bytes2bin(new Uint8Array(buf))); // 分块拼接，避免大缓冲 spread 溢出
  // 大数组安全地转 latin1 二进制串（blueimp-md5 对 latin1 输入的 UTF-8 预处理是恒等的，
  // 因此 md5(bytes2bin(bytes)) 等价于对原始字节做摘要）
  function bytes2bin(bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return s;
  }
  const b642buf = s => {
    let t = s.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return Uint8Array.from(atob(t), ch => ch.charCodeAt(0)).buffer;
  };
  async function subtleDigest(name, data) {
    return crypto.subtle.digest(name, data);
  }
  async function deriveKey(password, salt, iterations = 150000) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* ---------- 哈希摘要 ---------- */
  Toolkit.register({ id: 'hash' }, async (box, c) => {
    const tabText = el('textarea', { rows: 5, placeholder: '输入要计算摘要的文本…' });
    const fileInput = el('input', { type: 'file' });
    const alg = el('select', {},
      el('option', { value: 'MD5' }, 'MD5（兼容校验用）'),
      el('option', { value: 'SHA-1', selected: true }, 'SHA-1'),
      el('option', { value: 'SHA-256' }, 'SHA-256'),
      el('option', { value: 'SHA-384' }, 'SHA-384'),
      el('option', { value: 'SHA-512' }, 'SHA-512'));
    const out = el('pre', { class: 'out', style: { display: 'none' } });

    async function calc(buf, label) {
      const name = alg.value;
      out.style.display = '';
      try {
        let hex;
        if (name === 'MD5') {
          if (!window.md5?.raw) throw new Error('MD5 库未加载或缺少 raw 接口');
          const rawStr = window.md5.raw(bytes2bin(new Uint8Array(buf)));
          hex = [...rawStr].map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('');
        } else {
          hex = b2hex(await subtleDigest(name, buf));
        }
        out.className = 'out';
        out.textContent = `${name}  ${label}\nhex    ：${hex}\nbase64 ：${btoa(hex.replace(/../g, h => String.fromCharCode(parseInt(h, 16))))}`;
      } catch (err) {
        out.className = 'out err';
        out.textContent = '✗ ' + err.message;
      }
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '文本摘要'),
        el('div', { class: 'row', style: { marginBottom: '8px' } },
          el('div', { class: 'field' }, el('label', {}, '算法'), alg)),
        tabText,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: () => calc(new TextEncoder().encode(tabText.value).buffer, `文本 ${tabText.value.length} 字符`) }, '计算摘要'),
          el('button', { class: 'btn', onclick: () => copyText(out.textContent.split('\n')[1]?.replace(/^hex\s*：/, '') || '', 'hex 已复制') }, '复制 hex'))),
      el('div', { class: 'card' }, el('h3', {}, '文件摘要（≤64MB，不上传）'),
        el('div', { class: 'row' }, fileInput),
        el('p', { class: 'hint' }, '选择文件即计算；大文件需数秒，请耐心等待。')),
      el('div', { class: 'card' }, el('h3', {}, '结果'), out,
        el('p', { class: 'hint' }, 'MD5 / SHA-1 仅用于数据完整性校验；安全场景请使用 SHA-256 及以上。')));
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) return;
      if (f.size > 64 * 1024 * 1024) { toast('文件超过 64MB，请分段处理'); return; }
      toast(`读取中：${f.name}（${(f.size / 1024).toFixed(1)} KB）`);
      calc(await f.arrayBuffer(), f.name);
    });
  });

  /* ---------- HMAC 签名 ---------- */
  Toolkit.register({ id: 'hmac' }, async (box) => {
    const msg = el('textarea', { rows: 4, placeholder: '消息内容…' });
    const key = el('input', { type: 'text', placeholder: '密钥（任意字符串）', style: { width: '260px' }, class: 'mono' });
    const alg = el('select', {},
      el('option', { value: 'SHA-256', selected: true }, 'HMAC-SHA256'),
      el('option', { value: 'SHA-1' }, 'HMAC-SHA1'),
      el('option', { value: 'SHA-512' }, 'HMAC-SHA512'));
    const out = el('pre', { class: 'out', style: { display: 'none' } });
    async function run() {
      if (!msg.value && !key.value) { toast('请输入消息与密钥'); return; }
      if (!key.value) { toast('请输入密钥（消息内容可为空——空消息的 HMAC 是有效的，密钥不可为空）'); return; }
      try {
        const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key.value),
          { name: 'HMAC', hash: alg.value }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg.value));
        const hex = b2hex(sig);
        out.className = 'out';
        out.textContent = `${alg.value}\nhex    ：${hex}\nbase64 ：${btoa(hex.replace(/../g, h => String.fromCharCode(parseInt(h, 16))))}`;
      } catch (err) {
        out.className = 'out err'; out.textContent = '✗ ' + err.message;
      }
      out.style.display = '';
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '输入'),
        el('div', { class: 'row', style: { marginBottom: '8px' } },
          el('div', { class: 'field' }, el('label', {}, '算法'), alg),
          el('div', { class: 'field' }, el('label', {}, '密钥'), key)),
        msg,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: run }, '计算签名'),
          el('button', { class: 'btn', onclick: () => copyText(out.textContent.split('\n')[1]?.replace(/^hex\s*：/, '') || '', 'hex 已复制') }, '复制 hex'))),
      el('div', { class: 'card' }, el('h3', {}, '签名结果'), out,
        el('p', { class: 'hint' }, '密钥仅存在于内存，不写入存储。')));
  });

  /* ---------- AES-GCM 加解密 ---------- */
  Toolkit.register({ id: 'aesgcm' }, async (box) => {
    const pw = el('input', { type: 'password', placeholder: '加密密码（派生密钥用）', style: { width: '240px' } });
    const plain = el('textarea', { rows: 4, placeholder: '明文…' });
    const cipher = el('textarea', { rows: 4, placeholder: '密文（TK1:… 格式，可直接粘贴解密）' });
    const out = el('pre', { class: 'out', style: { display: 'none' } });

    async function encrypt() {
      if (!pw.value || !plain.value) { toast('请输入密码与明文'); return; }
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(pw.value, salt);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain.value));
        const token = 'TK1:' + b2b64(salt) + ':' + b2b64(iv) + ':' + b2b64(ct);
        cipher.value = token;
        out.className = 'out'; out.textContent = '✓ 已加密，密文在右侧密文框，可直接复制保存。';
      } catch (err) { out.className = 'out err'; out.textContent = '✗ ' + err.message; }
      out.style.display = '';
    }
    async function decrypt() {
      if (!pw.value || !cipher.value.trim()) { toast('请输入密码与密文'); return; }
      try {
        const parts = cipher.value.trim().split(':');
        if (parts.length !== 4 || parts[0] !== 'TK1') throw new Error('密文格式不对（应为 TK1:salt:iv:data）');
        const key = await deriveKey(pw.value, new Uint8Array(b642buf(parts[1])));
        const pt = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(b642buf(parts[2])) }, key, b642buf(parts[3]));
        plain.value = new TextDecoder().decode(pt);
        out.className = 'out'; out.textContent = '✓ 解密成功，明文已填入明文框。';
      } catch (err) {
        out.className = 'out err';
        out.textContent = '✗ 解密失败：' + (err.message.includes('格式') ? err.message : '密码错误或密文损坏');
      }
      out.style.display = '';
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '密码'),
        el('div', { class: 'row' }, el('div', { class: 'field' }, el('label', {}, '密码（PBKDF2-SHA256 · 15 万次迭代派生）'), pw))),
      el('div', { class: 'card' }, el('h3', {}, '明文'), plain),
      el('div', { class: 'card' }, el('h3', {}, '密文（TK1:salt:iv:data，可自解密）'), cipher),
      el('div', { class: 'card' }, el('h3', {}, '操作'),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: encrypt }, '加密 →'),
          el('button', { class: 'btn primary', onclick: decrypt }, '← 解密'),
          el('button', { class: 'btn', onclick: () => copyText(cipher.value, '密文已复制') }, '复制密文')),
        out),
      el('p', { class: 'hint' }, 'AES-256-GCM · 随机盐与 IV 每次加密都重新生成 · 数据不出本机。'));
  });

  /* ---------- Hex 转换 ---------- */
  Toolkit.register({ id: 'hexcodec' }, async (box) => {
    const input = el('textarea', { rows: 4, placeholder: '文本或十六进制串…' });
    const out = el('pre', { class: 'out', style: { display: 'none' } });
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '输入'), input,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: () => {
            out.className = 'out';
            out.textContent = b2hex(new TextEncoder().encode(input.value)).replace(/(..)/g, '$1 ').trim();
          } }, '文本 → Hex'),
          el('button', { class: 'btn', onclick: () => {
            try {
              const clean = input.value.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
              if (clean.length % 2) throw new Error('hex 长度为奇数');
              const bytes = new Uint8Array(clean.match(/../g).map(h => parseInt(h, 16)));
              out.className = 'out';
              out.textContent = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch (err) {
              out.className = 'out err';
              out.textContent = '✗ 转换失败：' + (err.message.includes('hex') ? err.message : '非 UTF-8 内容，仅显示为不可解码字节');
              if (!err.message.includes('hex')) {
                try {
                  const clean = input.value.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
                  const bytes = new Uint8Array(clean.match(/../g).map(h => parseInt(h, 16)));
                  out.textContent = '（非 UTF-8 文本，字节数 ' + bytes.length + '，hex：' + b2hex(bytes) + '）';
                } catch { /* 保持错误显示 */ }
              }
            }
          } }, 'Hex → 文本'),
          el('button', { class: 'btn', onclick: () => copyText(out.textContent, '结果已复制') }, '复制结果'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), out,
        el('p', { class: 'hint' }, '自动忽略 0x 前缀、空格与换行。')));
  });

  /* ---------- 随机密钥生成 ---------- */
  Toolkit.register({ id: 'keygen' }, async (box) => {
    const bytes = el('select', {},
      ...[16, 24, 32, 48, 64].map(n => el('option', { value: n, selected: n === 32 }, `${n} 字节（${n * 8} bit）`)));
    const out = el('pre', { class: 'out' });
    function gen() {
      const n = Number(bytes.value);
      const buf = crypto.getRandomValues(new Uint8Array(n));
      const hex = b2hex(buf);
      out.textContent = `hex    ：${hex}\nbase64 ：${b2b64(buf)}`;
    }
    box.append(
      el('div', { class: 'card' }, el('h3', {}, '长度'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '字节数'), bytes),
          el('button', { class: 'btn primary', onclick: gen }, '生成'),
          el('button', { class: 'btn', onclick: () => copyText(out.textContent.split('\n')[0].replace('hex    ：', ''), 'hex 已复制') }, '复制 hex'),
          el('button', { class: 'btn', onclick: () => copyText(out.textContent.split('\n')[1].replace('base64 ：', ''), 'base64 已复制') }, '复制 base64'))),
      el('div', { class: 'card' }, el('h3', {}, '结果'), out,
        el('p', { class: 'hint' }, 'crypto.getRandomValues 密码学安全随机 · 仅内存，不写入存储。')));
    gen();
  });

});
