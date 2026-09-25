/* ============ 加密扩展：国密 SM2 / SM3 / SM4（vendor: sm-crypto） ============ */
'use strict';

TK_REGISTERS.push(() => {

  Toolkit.register({ id: 'smcrypto' }, async (box) => {
    if (!window.SMCrypto) {
      box.append(el('p', { class: 'out err' }, 'sm-crypto 未加载（vendor 缺失）'));
      return;
    }
    const { sm2, sm3, sm4 } = window.SMCrypto;

    const tabs = el('div', { class: 'row', style: { marginBottom: '4px' } });
    const panes = [];
    function addTab(name, pane) {
      const b = el('button', { class: 'btn sm primary' }, name);
      b.addEventListener('click', () => {
        [...tabs.children].forEach(x => x.classList.toggle('primary', x === b));
        panes.forEach(p => p.style.display = p === pane ? '' : 'none');
      });
      tabs.append(b);
      pane.style.display = panes.length ? 'none' : '';
      panes.push(pane);
      box.append(pane);
    }

    /* ---------- SM2 ---------- */
    {
      const kpPub = el('textarea', { rows: 2, spellcheck: 'false', class: 'mono', placeholder: '04 开头的公钥（130 位 hex）…' });
      const kpPriv = el('textarea', { rows: 2, spellcheck: 'false', class: 'mono', placeholder: '64 位 hex 私钥…' });
      const msg = el('textarea', { rows: 3, placeholder: '待加密 / 签名的明文…' });
      const cipher = el('textarea', { rows: 3, spellcheck: 'false', class: 'mono', placeholder: '密文（hex）…' });
      const sigOut = el('textarea', { rows: 3, spellcheck: 'false', class: 'mono', placeholder: '签名（hex）…' });
      const cipherMode = el('select', {},
        el('option', { value: '1', selected: true }, 'C1C3C2（新标准）'),
        el('option', { value: '0' }, 'C1C2C3（旧标准）'));
      const verifyOut = el('span', { class: 'hint' });

      function genKeypair() {
        const kp = sm2.generateKeyPairHex();
        kpPub.value = kp.publicKey;
        kpPriv.value = kp.privateKey;
        toast('密钥对已生成（请妥善保存私钥）');
      }
      const btnGen = el('button', { class: 'btn primary', onclick: genKeypair }, '生成密钥对');
      function doEnc() {
        if (!kpPub.value.trim()) { toast('请先生成或粘贴公钥'); return; }
        try {
          cipher.value = sm2.doEncrypt(msg.value, kpPub.value.trim(), +cipherMode.value);
          toast('加密完成');
        } catch (e) { toast('加密失败：' + e.message); }
      }
      function doDec() {
        if (!kpPriv.value.trim() || !cipher.value.trim()) { toast('需要私钥与密文'); return; }
        try {
          const plain = sm2.doDecrypt(cipher.value.trim(), kpPriv.value.trim(), +cipherMode.value);
          msg.value = plain;
          toast('解密完成');
        } catch (e) { toast('解密失败：' + e.message); }
      }
      function doSign() {
        if (!kpPriv.value.trim() || !msg.value.trim()) { toast('需要私钥与明文'); return; }
        try {
          sigOut.value = sm2.doSignature(msg.value, kpPriv.value.trim(), { hash: true, der: true });
          verifyOut.textContent = '已签名（DER + SM3 摘要）';
        } catch (e) { toast('签名失败：' + e.message); }
      }
      function doVerify() {
        if (!kpPub.value.trim() || !msg.value.trim() || !sigOut.value.trim()) { toast('需要公钥、明文与签名'); return; }
        try {
          const ok = sm2.doVerifySignature(msg.value, sigOut.value.trim(), kpPub.value.trim(), { hash: true, der: true });
          verifyOut.textContent = ok ? '✓ 验签通过' : '✕ 验签失败（内容或密钥不匹配）';
        } catch (e) { toast('验签异常：' + e.message); }
      }

      const pane = el('div', { class: 'card' }, el('h3', {}, 'SM2 非对称（加解密 + 签名验签）'),
        el('div', { class: 'row' }, btnGen,
          el('span', { class: 'hint' }, '密钥对仅在本页面生成与显示，不保存不外发')),
        el('div', { class: 'field', style: { marginTop: '10px' } }, el('label', {}, '公钥'), kpPub),
        el('div', { class: 'field' }, el('label', {}, '私钥'), kpPriv),
        el('div', { class: 'field', style: { marginTop: '10px' } }, el('label', {}, '明文'), msg),
        el('div', { class: 'row', style: { margin: '8px 0' } },
          el('div', { class: 'field' }, el('label', {}, '密文排列'), cipherMode),
          el('button', { class: 'btn', onclick: doEnc }, '加密 →'),
          el('button', { class: 'btn', onclick: doDec }, '← 解密')),
        cipher,
        el('div', { class: 'row', style: { margin: '8px 0' } },
          el('button', { class: 'btn', onclick: doSign }, '签名明文 →'),
          el('button', { class: 'btn', onclick: doVerify }, '验签明文'),
          verifyOut),
        sigOut);
      addTab('SM2 非对称', pane);
    }

    /* ---------- SM3 ---------- */
    {
      const text = el('textarea', { rows: 4, placeholder: '输入文本实时计算 SM3…' });
      const out = el('div', { class: 'out mono', style: { wordBreak: 'break-all' } });
      const keyInput = el('input', { type: 'text', class: 'mono', placeholder: 'HMAC 密钥（hex，可选）', style: { width: '260px' } });
      const fileInput = el('input', { type: 'file', style: { display: 'none' } });
      const btnFile = el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '文件摘要（≤ 16MB）');
      const fileOut = el('div', { class: 'out mono', style: { wordBreak: 'break-all' } });
      const LIMIT = 16 * 1024 * 1024;

      function textDigest() {
        const s = text.value;
        if (!s) { out.textContent = ''; return; }
        try {
          out.textContent = keyInput.value.trim()
            ? sm3(s, { key: keyInput.value.trim(), mode: 'hmac' })
            : sm3(s);
        } catch (e) { out.textContent = '计算失败：' + e.message; }
      }
      text.addEventListener('input', textDigest);
      keyInput.addEventListener('input', textDigest);
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files[0];
        if (!f) return;
        if (f.size > LIMIT) { toast(`文件过大（${(f.size / 1048576).toFixed(1)}MB > 16MB 上限）`); return; }
        fileOut.textContent = '计算中…';
        const bytes = new Uint8Array(await f.arrayBuffer());
        try {
          fileOut.textContent = `${f.name} · ${(f.size / 1024).toFixed(1)} KB\nSM3: ${
            keyInput.value.trim() ? sm3(Array.from(bytes), { key: keyInput.value.trim(), mode: 'hmac' }) : sm3(Array.from(bytes))}`;
        } catch (e) { fileOut.textContent = '计算失败：' + e.message; }
      });

      const pane = el('div', { class: 'card' }, el('h3', {}, 'SM3 摘要（含 HMAC）'),
        el('div', { class: 'field' }, el('label', {}, '文本'), text),
        el('div', { class: 'row', style: { margin: '8px 0' } },
          el('div', { class: 'field' }, el('label', {}, 'HMAC 密钥（留空 = 纯摘要）'), keyInput),
          btnFile, fileInput),
        el('p', { class: 'hint' }, '文本摘要'), out,
        el('p', { class: 'hint' }, '文件摘要（原始字节，非文本编码）'), fileOut);
      addTab('SM3 摘要', pane);
    }

    /* ---------- SM4 ---------- */
    {
      const keyInput = el('input', { type: 'text', class: 'mono', value: '0123456789abcdeffedcba9876543210', style: { width: '280px' } });
      const ivInput = el('input', { type: 'text', class: 'mono', placeholder: 'CBC 模式 IV（32 位 hex）', style: { width: '280px' } });
      const modeSel = el('select', {},
        el('option', { value: 'ecb', selected: true }, 'ECB（无需 IV）'),
        el('option', { value: 'cbc' }, 'CBC（需 IV）'));
      const paddingSel = el('select', {},
        el('option', { value: 'pkcs#7', selected: true }, 'PKCS#7 填充'),
        el('option', { value: 'none' }, 'None（明文须为 16 字节倍数）'));
      const msg = el('textarea', { rows: 3, placeholder: '待加密明文…' });
      const cipher = el('textarea', { rows: 3, spellcheck: 'false', class: 'mono', placeholder: '密文（hex）…' });

      function opts() {
        if (!/^[0-9a-f]{32}$/i.test(keyInput.value.trim())) throw new Error('密钥须为 32 位 hex（128-bit）');
        const o = { mode: modeSel.value, padding: paddingSel.value };
        if (o.mode === 'cbc') {
          if (!/^[0-9a-f]{32}$/i.test(ivInput.value.trim())) throw new Error('CBC 模式需要 32 位 hex IV');
          o.iv = ivInput.value.trim();
        }
        return o;
      }
      function doEnc() {
        try {
          const o = opts();
          cipher.value = sm4.encrypt(msg.value, keyInput.value.trim(), o);
          toast('加密完成');
        } catch (e) { toast('加密失败：' + e.message); }
      }
      function doDec() {
        try {
          const o = opts();
          msg.value = sm4.decrypt(cipher.value.trim(), keyInput.value.trim(), o);
          toast('解密完成');
        } catch (e) { toast('解密失败：' + e.message); }
      }

      const pane = el('div', { class: 'card' }, el('h3', {}, 'SM4 对称（分组加解密）'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '密钥（32 位 hex）'), keyInput),
          el('div', { class: 'field' }, el('label', {}, 'IV'), ivInput),
          el('div', { class: 'field' }, el('label', {}, '模式'), modeSel),
          el('div', { class: 'field' }, el('label', {}, '填充'), paddingSel)),
        el('div', { class: 'field', style: { marginTop: '10px' } }, el('label', {}, '明文'), msg),
        el('div', { class: 'row', style: { margin: '8px 0' } },
          el('button', { class: 'btn', onclick: doEnc }, '加密 →'),
          el('button', { class: 'btn', onclick: doDec }, '← 解密')),
        cipher,
        el('p', { class: 'hint' }, '默认演示密钥仅供测试，生产环境请自行生成并保管。'));
      addTab('SM4 对称', pane);
    }

    box.prepend(tabs);
  });

});
