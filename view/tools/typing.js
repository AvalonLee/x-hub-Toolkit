/* ============ 练习组：打字测试 ============ */
'use strict';

TK_REGISTERS.push(() => {

  const ZH = [
    '工具的意义不是炫技，而是把重复的事情一次做完。',
    '把复杂留给系统，把简单留给使用它的人。',
    '好的效率习惯，是把注意力留给真正重要的那件事。',
    '本地优先意味着数据始终在你自己的手里。',
    '每一次专注的练习，都会沉淀为可复用的能力。',
    '小事做到位，大事才不慌；清单是最朴素的杠杆。',
    '写作是把模糊的想法挤干净的过程，别怕先写烂。',
    '技术的价值在于被使用，而不是被收藏。',
    '先完成，再完美；先跑通，再优化。',
    '安静地做一件事，胜过喧哗地计划十件。'
  ];
  const ZH_LONG = [
    '把一件事做到位的过程，往往比结果更能暴露问题：准备工作是否充分、流程是否顺畅、异常是否有预案，都会在中途一一现形，而这些正是下一次改进最该记录的地方。',
    '效率工具的价值不在于功能多，而在于它是否恰好嵌进你的工作流；装了一百个应用不如把一个用到顺手，反复折腾工具本身就是最大的时间黑洞。',
    '写周报的时候先别急着罗列做了什么，先问自己这周真正推动了哪件事、卡在哪里、下周第一件事是什么，三句话能答清楚，说明这一周没有白过。',
    '本地优先的意义不只是数据安全，更是一种心态：你的笔记、待办和思考不需要托管在别人的服务器上，它们属于你，随时可以带走，也随时可以重来。',
    '判断一个人是否靠谱，看他怎么对待小事就够了：文件命名是否规范、承诺的时间是否兑现、交接的文档别人能不能直接看懂，细节不会说谎。',
    '学新东西最快的方式不是看完整本教程，而是先做一个具体的小项目，遇到问题再回头查，带着问题学到的知识会自动挂在你需要的地方，记得格外牢。',
    '会议开得越久越要警惕：真正需要会议解决的是分歧和共创，如果只是单向传达信息，一份写得清楚的文档，远比占用十个人的一个小时更有效率。',
    '复杂的系统都是由简单的部分组合出来的，好的工程师不是写更多的代码，而是删掉不必要的分支和状态，让每一段逻辑都简单到不需要注释也能读懂。',
    '拖延往往不是懒，而是任务太大无从下手；把"整理季度数据"拆成"先导出表格、再核对三列关键字段"，每一步都小到不好意思开始拖延，事情就动起来了。',
    '键盘上最快的键是快捷键，但比快捷键更快的是不用切换：把常用的三五个动作练成肌肉记忆，手不离键盘，注意力始终留在内容本身上。'
  ];
  const EN = [
    'The quickest way to double your productivity is to do the right things in a calm and steady rhythm.',
    'Simple tools, used daily, beat complex systems that are opened once a month.',
    'Typing is thinking at the speed of your fingers; accuracy comes first, speed will follow.',
    'Local first means your data stays in your hands, not on someone else\u2019s server.'
  ];

  Toolkit.register({ id: 'typing' }, async (box, c) => {
    const mode = el('select', {},
      el('option', { value: 'zh', selected: true }, '中文短句'),
      el('option', { value: 'zhlong' }, '中文长句'),
      el('option', { value: 'en' }, '英文段落'),
      el('option', { value: 'mylib' }, '我的词库'),
      el('option', { value: 'custom' }, '自定义文本'));
    const custom = el('textarea', { rows: 2, placeholder: '粘贴自定义练习文本（模式切到「自定义文本」后生效）', style: { display: 'none' } });
    const target = el('div', { class: 'typebox' });
    const hidden = el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false',
      style: { width: '100%', fontSize: '15px', padding: '8px 12px' }, placeholder: '对照上方文本，在此开始输入…' });
    const stats = el('div', { class: 'chips', style: { margin: '10px 0' } });
    const result = el('div');

    let text = '', started = 0, timer = 0, wrongCount = 0, finished = false;

    async function pickText() {
      if (mode.value === 'custom') {
        text = custom.value.trim();
        if (!text) { target.innerHTML = '<span class="t-todo">请先在下方粘贴自定义文本…</span>'; return; }
      } else if (mode.value === 'mylib') {
        const lib = (await c.store.get('typinglib')) || [];
        if (!lib.length) {
          text = '';
          target.innerHTML = '<span class="t-todo">词库为空——打开「打字词库」工具导入或编写后即可练习。</span>';
          return;
        }
        text = lib[Math.floor(Math.random() * lib.length)];
      } else {
        const pool = mode.value === 'zh' ? ZH : mode.value === 'zhlong' ? ZH_LONG : EN;
        text = pool[Math.floor(Math.random() * pool.length)];
      }
      reset();
    }
    function reset() {
      clearInterval(timer); timer = 0;
      started = 0; wrongCount = 0; finished = false;
      hidden.value = ''; hidden.disabled = false;
      result.innerHTML = '';
      render();
      renderStats();
    }
    function render() {
      target.innerHTML = '';
      const typed = hidden.value;
      [...text].forEach((ch, i) => {
        let cls = 't-todo';
        if (i < typed.length) cls = (typed[i] === ch) ? 't-done' : 't-bad';
        else if (i === typed.length) cls += ' t-caret';
        target.append(el('span', { class: cls },
          ch === ' ' ? '\u00a0' : ch));
      });
      if (typed.length >= text.length) target.append(el('span', { class: 't-caret' }));
    }
    function renderStats() {
      const elapsed = started ? (Date.now() - started) / 1000 : 0;
      const typedLen = hidden.value.length;
      const speed = elapsed > 0.5
        ? Math.round(mode.value === 'en' ? typedLen / 5 / (elapsed / 60) : typedLen / (elapsed / 60))
        : 0; // 英文按 WPM（5 字符/词），中文按 CPM（字符/分钟）
      const acc = typedLen ? Math.max(0, Math.round((typedLen - wrongCount) / typedLen * 100)) : 100;
      stats.innerHTML = '';
      const items = [
        ['用时', elapsed ? elapsed.toFixed(1) + ' s' : '—'],
        [mode.value === 'en' ? 'WPM' : 'CPM', speed || '—'],
        ['正确率', typedLen ? acc + '%' : '—'],
        ['错误按键', wrongCount],
        ['进度', `${Math.min(typedLen, text.length)}/${text.length}`]
      ];
      for (const [k, v] of items) stats.append(el('span', { class: 'chip' }, String(v), el('small', {}, k)));
    }
    function finish() {
      finished = true;
      clearInterval(timer);
      hidden.disabled = true;
      const elapsed = (Date.now() - started) / 1000;
      const typedLen = text.length;
      const acc = Math.max(0, Math.round((typedLen - wrongCount) / typedLen * 100));
      const speed = Math.round((mode.value === 'en' ? typedLen / 5 : typedLen) / (elapsed / 60));
      const grade = acc >= 98 ? el('span', { class: 'badge ok' }, '优秀') :
        acc >= 92 ? el('span', { class: 'badge warn' }, '良好') : el('span', { class: 'badge bad' }, '继续加油');
      result.append(el('div', { class: 'card', style: { borderColor: 'var(--primary)' } },
        el('h3', {}, '完成！', grade),
        el('div', { class: 'row', style: { gap: '28px' } },
          el('div', {}, el('div', { class: 'kpi' }, elapsed.toFixed(1), el('small', {}, '秒'))),
          el('div', {}, el('div', { class: 'kpi' }, speed, el('small', {}, mode.value === 'en' ? 'WPM' : 'CPM'))),
          el('div', {}, el('div', { class: 'kpi' }, acc + '%', el('small', {}, '正确率'))),
          el('div', {}, el('div', { class: 'kpi' }, wrongCount, el('small', {}, '错误按键')))),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: () => pickText() }, '再来一局'))));
      hidden.blur();
    }
    mode.addEventListener('change', () => {
      custom.style.display = mode.value === 'custom' ? '' : 'none';
      pickText();
    });
    custom.addEventListener('change', pickText);
    /* --- 输入处理：IME 兼容。输入法组合（拼音等）期间不判定、不改写 value，
           组合结束后统一做全量比对（公共正确前缀 + 错误即退回），
           对"一次上屏多个字"、粘贴、回删均幂等健壮。--- */
    let composing = false;
    hidden.addEventListener('compositionstart', () => { composing = true; });
    hidden.addEventListener('compositionend', () => {
      composing = false;
      handleInput(); // 选字上屏 / 取消组合后，处理最终文本
    });
    function handleInput() {
      if (finished) return;
      const v = hidden.value;
      if (!started && v.length) {
        started = Date.now();
        timer = setInterval(renderStats, 200);
      }
      let m = 0;
      const n = Math.min(v.length, text.length);
      while (m < n && v[m] === text[m]) m++;
      if (m < v.length) { // 存在错误或多余字符：退回到正确前缀并按字符计数
        wrongCount += v.length - m;
        hidden.value = v.slice(0, m);
        try { hidden.setSelectionRange(m, m); } catch (_) {}
        hidden.classList.remove('type-reject');
        void hidden.offsetWidth; // 强制 reflow，重启动画
        hidden.classList.add('type-reject');
      }
      render();
      renderStats();
      if (text.length && hidden.value.length >= text.length) finish();
    }
    hidden.addEventListener('input', e => {
      // 组合中的拼音字母不是最终输入：不动 value、不计数、不渲染，避免打断 IME
      if (composing || e.isComposing) return;
      handleInput();
    });
    hidden.addEventListener('keydown', e => {
      if (e.isComposing || e.keyCode === 229) return; // IME 处理中的按键不劫持（含 Esc 取消组词）
      if (e.key === 'Escape') { reset(); toast('已重置'); }
    });

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '模式'),
        el('div', { class: 'row' },
          el('div', { class: 'field' }, el('label', {}, '文本来源'), mode),
          el('button', { class: 'btn', onclick: () => pickText() }, '换一段'),
          el('button', { class: 'btn', onclick: () => reset() }, '重置（Esc）')),
        custom),
      el('div', { class: 'card' }, el('h3', {}, '目标文本'), target, stats, hidden,
        el('p', { class: 'hint' }, '输错会立即退回，改正后才能继续；支持拼音等输入法（上屏后判定）；Esc 重置。')),
      result);
    pickText();
    /* 切走工具时停掉统计计时器：Toolkit.open() 会调用 render 返回的清理函数（见 app.js），
       否则 200ms 轮询会在切换后继续跑在已脱离 DOM 的元素上 */
    return () => { clearInterval(timer); timer = 0; };
  });

  /* ---------- 打字词库（与打字测试「我的词库」模式联动） ---------- */
  Toolkit.register({ id: 'typinglib' }, async (box, c) => {
    const lib = (await c.store.get('typinglib')) || [];
    const editor = el('textarea', { rows: 12, spellcheck: 'false',
      placeholder: '每行一条，作为「打字测试 → 我的词库」的随机题库。\n支持中英文混合，建议单条不超过 120 字。' });
    editor.value = lib.join('\n');
    const counter = el('span', { class: 'hint' });
    const fileInput = el('input', { type: 'file', accept: '.txt,.csv,text/plain', style: { display: 'none' } });

    function parse(text) {
      return [...new Set(text.split(/\r?\n/).map(l => l.trim()).filter(Boolean))];
    }
    function updateCounter() {
      const items = parse(editor.value);
      counter.textContent = items.length
        ? `${items.length} 条 · ${items.join('').length} 字 · 平均 ${(items.join('').length / items.length).toFixed(1)} 字/条`
        : '空词库';
    }
    async function save() {
      const items = parse(editor.value);
      await c.store.set('typinglib', items);
      updateCounter();
      toast(items.length ? `已保存 ${items.length} 条到我的词库` : '词库已清空');
    }
    function importTxt(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const merged = [...new Set([...parse(editor.value), ...parse(String(reader.result))])];
        editor.value = merged.join('\n');
        updateCounter();
        toast(`已合并导入，当前 ${merged.length} 条（记得保存）`);
      };
      reader.readAsText(file, 'utf-8');
    }

    editor.addEventListener('input', updateCounter);
    fileInput.addEventListener('change', () => importTxt(fileInput.files[0]));
    updateCounter();

    box.append(
      el('div', { class: 'card' }, el('h3', {}, '词库编辑（每行一条）'), editor,
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: save }, '保存词库'),
          el('button', { class: 'btn sm', onclick: () => fileInput.click() }, '导入 .txt（合并去重）'),
          el('button', { class: 'btn sm', onclick: () => {
            const blob = new Blob([parse(editor.value).join('\n')], { type: 'text/plain;charset=utf-8' });
            const a = el('a', { href: URL.createObjectURL(blob), download: 'typing-library.txt' });
            a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            toast('已导出 typing-library.txt');
          } }, '导出 .txt'),
          el('button', { class: 'btn sm', onclick: async () => {
            if (!editor.value.trim()) { toast('词库已是空的'); return; }
            if (!confirm('确定清空词库？该操作不可撤销（可先导出备份）。')) return;
            editor.value = '';
            await save();
          } }, '清空'),
          counter),
        el('p', { class: 'hint' }, '保存后，到「打字测试」把模式切到「我的词库」即可随机练习。'))
    );
  });

});
