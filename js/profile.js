/* ============================================================
   和你第N天 · profile.js
   我的（PRD 10）：主题 / AI 设置 / 导出 / 示例 / 清空
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};

  // 与 index.html #theme-sheet 中的 .theme-opt[data-theme] 保持一一对应
  var THEME_NAMES = {
    cream: '奶油恋爱', sakura: '樱花', night: '夜晚',
    mint: '薄荷', sea: '海盐', sun: '暖阳'
  };

  // 在一起日期合理性下限：1926-01-01（当前年份 - 100，与 onboarding / datepicker 的下限一致）
  var MIN_DATE = new Date(1926, 0, 1);

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function settings() {
    var s = State.settings();
    if (!s.ai) s.ai = { base: '', model: '', key: '' };
    if (!s.theme) s.theme = 'cream';
    return s;
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'cream');
    var s = settings();
    s.theme = theme || 'cream';
    State.saveSettings(s);
    // 状态栏 / 地址栏取色跟随当前主题
    if (UI && UI.syncThemeColor) UI.syncThemeColor();
  }
  function aiReady() {
    var ai = settings().ai;
    return !!(ai && ai.base && ai.model && ai.key);
  }
  function refreshLabels() {
    var s = settings();
    document.getElementById('theme-label').textContent = THEME_NAMES[s.theme] || '奶油恋爱';
    document.getElementById('ai-status').textContent = aiReady() ? '已接入' : '未配置（内置文案）';
    var opts = document.querySelectorAll('.theme-opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-theme') === s.theme);
    }
  }

  function render() {
    var couple = State.couple();
    if (!couple) { global.Nav.go('/onboarding'); return; }
    var my = couple.myName || '你';
    var ta = couple.taName || 'TA';
    document.getElementById('profile-names').innerHTML = esc(my) + '<span class="sep">♥</span>' + esc(ta);
    var d = Utils.parseDate(couple.relationshipDate);
    if (d) {
      document.getElementById('profile-since').textContent =
        '从 ' + Utils.fmtCN(d) + ' 开始 · 今天第 ' + Utils.dayNumber(d) + ' 天';
    }
    renderDateRow(couple);
    renderBirthdayLabel(couple);
    refreshLabels();
  }

  /* 双人生日（I）：设置页展示两人的生日，未设置时提示去设置 */
  function renderBirthdayLabel(couple) {
    var label = document.getElementById('profile-birthday-label');
    if (!label) return;
    var my = couple && couple.myBirthday;
    var ta = couple && couple.taBirthday;
    if (!my && !ta) {
      label.textContent = '未设置';
      label.classList.add('muted');
      return;
    }
    label.classList.remove('muted');
    var parts = [];
    if (my) parts.push('我 ' + my);
    if (ta) parts.push('TA ' + ta);
    label.textContent = parts.join(' · ');
  }

  /* "在一起日期"行：展示当前日期（2024.02.14）；
     存量异常值（无法解析或早于 MIN_DATE，如 1912-12-11）在该行醒目标注提示修改 */
  function renderDateRow(couple) {
    var row = document.getElementById('profile-date');
    var label = document.getElementById('profile-date-label');
    if (!row || !label) return;
    var d = Utils.parseDate(couple && couple.relationshipDate);
    if (!d || isNaN(d.getTime()) || d < MIN_DATE) {
      row.classList.add('danger');
      label.textContent = '日期异常，请修改';
    } else {
      row.classList.remove('danger');
      label.textContent = Utils.fmtDot(d);
    }
  }

  /* 修改"在一起日期"：复用 datepicker 组件选日期，校验通过后写回 couple 并持久化 */
  function editRelationshipDate() {
    var couple = State.couple();
    if (!couple) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = couple.relationshipDate || '';
    input.style.display = 'none';
    document.body.appendChild(input);
    UI.datePicker(input).then(function (val) {
      if (input.parentNode) input.parentNode.removeChild(input);
      if (!val) return; // 用户取消，不改动
      var d = Utils.parseDate(val);
      if (!d || isNaN(d.getTime())) { UI.toast('日期格式不正确，请重新选择'); return; }
      if (d > Utils.today()) { UI.toast('在一起日期不能晚于今天'); return; }
      if (d < MIN_DATE) { UI.toast('在一起日期不能早于 1926-01-01'); return; }
      couple.relationshipDate = Utils.fmtInput(d);
      State.saveCouple(couple);
      render(); // 重新渲染"我的"页；返回首页时首页会重算天数
      UI.toast('在一起日期已更新');
    });
  }

  /* 双人生日（I）：datepicker 选中后（data-date-open 委托写回 YYYY-MM-DD 并触发 change）
     把全日期转成 MM-DD 展示与存储（兼容读取时两种格式） */
  function bdToMmdd(input, label) {
    var v = String(input.value || '').trim();
    if (!v) return;
    var p = v.split('-');
    if (p.length === 3) {
      var mmdd = p[1] + '-' + p[2];
      input.value = mmdd;
    }
    label.textContent = '已选择 ' + input.value;
  }
  function openBirthdaySheet() {
    var couple = State.couple();
    if (!couple) { UI.toast('请先设置在一起日期'); return; }
    var myBd = couple.myBirthday || '';
    var taBd = couple.taBirthday || '';
    var myInput = document.getElementById('bd-my');
    var taInput = document.getElementById('bd-ta');
    var myLabel = document.getElementById('bd-my-label');
    var taLabel = document.getElementById('bd-ta-label');
    myInput.value = myBd;
    taInput.value = taBd;
    myLabel.textContent = myBd ? '已选择 ' + myBd : '未设置';
    taLabel.textContent = taBd ? '已选择 ' + taBd : '未设置';
    UI.openSheet('birthday-sheet');
  }
  function saveBirthday() {
    var couple = State.couple();
    if (!couple) return;
    var mb = document.getElementById('bd-my').value.trim();
    var tb = document.getElementById('bd-ta').value.trim();
    var bad = [];
    if (mb && !/^\d{2}-\d{2}$/.test(mb)) bad.push('我的生日');
    if (tb && !/^\d{2}-\d{2}$/.test(tb)) bad.push('TA的生日');
    if (bad.length) { UI.toast(bad.join('、') + '格式应为 月-日，如 02-14'); return; }
    couple.myBirthday = mb || '';
    couple.taBirthday = tb || '';
    State.saveCouple(couple);
    UI.closeSheet('birthday-sheet');
    UI.toast('双人生日已保存');
    render();
  }

  function exportData() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'ourdays',
      couple: State.couple(),
      settings: settings(),
      memories: State.memories(),
      customAnniv: State.customAnniv(),
      annivOrder: OD.LS.get('annivOrder', []),      // 纪念日拖拽顺序
      shareTemplate: OD.LS.get('shareTemplate', 'sunny') // 分享模板偏好
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ourdays-backup-' + Utils.fmtInput(Utils.today()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 800);
    UI.toast('已导出备份文件');
  }

  function pushSample() {
    var couple = State.couple();
    var start = Utils.parseDate(couple ? couple.relationshipDate : null) || Utils.today();
    var today = Utils.today();
    function at(n) {
      var d = new Date(start);
      d.setDate(d.getDate() + (n - 1));
      return Utils.fmtInput(d > today ? today : d);
    }
    var seeds = [
      { date: at(1), title: '在一起的第一天', content: '说了好多好多话，从傍晚一直聊到深夜。原来遇到对的人，第一天就像认识了很久。', mood: 'happy' },
      { date: at(7), title: '一周啦', content: '一起看了场电影，散场后沿着河边走回家。路灯把影子拉得很长，也很近。', mood: 'bliss' },
      { date: at(30), title: '满月快乐', content: '认识你满一个月。谢谢你愿意把生活里的小事讲给我听。', mood: 'touched' }
    ];
    var list = State.memories();
    seeds.forEach(function (s) {
      list.push({ id: Utils.uid('mem'), title: s.title, content: s.content, date: s.date, mood: s.mood, photos: [], createdAt: Utils.fmtInput(Utils.today()) });
    });
    State.saveMemories(list);
    UI.toast('已载入 3 条示例回忆');
    global.Nav.go('/story');
  }
  function loadSample() {
    if (State.memories().length) {
      UI.confirm({
        title: '要载入示例回忆吗？',
        text: '载入会在现有回忆基础上追加 3 条示例，方便你体验完整功能。',
        okText: '载入示例',
        danger: false
      }).then(function (ok) { if (ok) pushSample(); });
      return;
    }
    pushSample();
  }
  function clearAll() {
    UI.confirm({
      title: '真的要清空吗？',
      text: '将删除这台设备上的全部回忆、纪念日与设置，且无法恢复。',
      okText: '清空全部',
      cancelText: '取消'
    }).then(function (ok) {
      if (!ok) return;
      State.clearAll().then(function () {
        // 数据已清空，主题设置一并还原为默认，避免界面残留旧主题
        document.documentElement.setAttribute('data-theme', 'cream');
        UI.toast('已清空，重新开始吧');
        global.Nav.go('/onboarding');
      });
    });
  }

  /* 生成今日分享卡（唯一分享入口）：复用首页的今日数据，分享页返回"我的" */
  function openDayShare() {
    if (!global.DayShareData) { UI.toast('今日分享卡暂不可用'); return; }
    var data = global.DayShareData();
    if (!data) { UI.toast('请先设置在一起日期'); return; }
    global.ShareOpen('day', data, '/profile');
  }

  function openAiSheet() {
    var ai = settings().ai;
    document.getElementById('ai-base').value = ai.base || '';
    document.getElementById('ai-model').value = ai.model || '';
    document.getElementById('ai-key').value = ai.key || '';
    UI.openSheet('ai-sheet');
  }
  function saveAi() {
    var s = settings();
    s.ai = {
      base: document.getElementById('ai-base').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
      key: document.getElementById('ai-key').value.trim()
    };
    State.saveSettings(s);
    UI.closeSheet('ai-sheet');
    UI.toast(aiReady() ? 'AI 设置已保存' : '已保存（未填完整，将使用内置文案）');
    refreshLabels();
  }
  function openThemeSheet() {
    refreshLabels();
    UI.openSheet('theme-sheet');
  }

  function bind() {
    document.getElementById('profile-edit').addEventListener('click', function () {
      if (global.Views.onboarding && global.Views.onboarding.setEditMode) {
        global.Views.onboarding.setEditMode(true);
      }
      global.Nav.go('/onboarding');
    });
    document.getElementById('profile-share').addEventListener('click', openDayShare);
    document.getElementById('profile-date').addEventListener('click', editRelationshipDate);
    document.getElementById('profile-theme').addEventListener('click', openThemeSheet);
    document.getElementById('profile-ai').addEventListener('click', openAiSheet);
    document.getElementById('profile-export').addEventListener('click', exportData);
    document.getElementById('profile-sample').addEventListener('click', loadSample);
    document.getElementById('profile-reset').addEventListener('click', clearAll);
    document.getElementById('ai-save').addEventListener('click', saveAi);

    /* 双人生日（I） */
    var bdEntry = document.getElementById('profile-birthday');
    if (bdEntry) bdEntry.addEventListener('click', openBirthdaySheet);
    var bdMy = document.getElementById('bd-my');
    var bdTa = document.getElementById('bd-ta');
    if (bdMy) bdMy.addEventListener('change', function () { bdToMmdd(bdMy, document.getElementById('bd-my-label')); });
    if (bdTa) bdTa.addEventListener('change', function () { bdToMmdd(bdTa, document.getElementById('bd-ta-label')); });
    var bdSave = document.getElementById('birthday-save');
    if (bdSave) bdSave.addEventListener('click', saveBirthday);

    document.getElementById('theme-sheet').addEventListener('click', function (e) {
      var opt = e.target.closest ? e.target.closest('.theme-opt') : null;
      if (!opt) return;
      var theme = opt.getAttribute('data-theme');
      if (!theme) return;
      applyTheme(theme);
      UI.closeAllSheets();
      UI.toast('主题已切换');
      refreshLabels();
    });
  }

  global.Views.profile = { render: render, applyTheme: applyTheme, refreshLabels: refreshLabels };
  bind();
})(window);
