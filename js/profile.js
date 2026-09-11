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

  var THEME_NAMES = { cream: '奶油恋爱', sakura: '樱花', night: '夜晚' };

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
    refreshLabels();
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

  function exportData() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      couple: State.couple(),
      settings: settings(),
      memories: State.memories(),
      customAnniv: State.customAnniv()
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
    document.getElementById('profile-date').addEventListener('click', editRelationshipDate);
    document.getElementById('profile-theme').addEventListener('click', openThemeSheet);
    document.getElementById('profile-ai').addEventListener('click', openAiSheet);
    document.getElementById('profile-export').addEventListener('click', exportData);
    document.getElementById('profile-sample').addEventListener('click', loadSample);
    document.getElementById('profile-reset').addEventListener('click', clearAll);
    document.getElementById('ai-save').addEventListener('click', saveAi);

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
