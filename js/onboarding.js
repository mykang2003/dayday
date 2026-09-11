/* ============================================================
   和你第N天 · onboarding.js
   首次引导（PRD 16）：欢迎 → 选日期 → 天数+昵称
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};
  var editMode = false;
  // 开始日期合理性下限：1926-01-01（约为当前年份-100，即 2026-100）
  // 防止异常历史日期（如 1912-12-11）被写入 couple.relationshipDate
  var MIN_DATE = new Date(1926, 0, 1);

  function showOb(name) {
    var views = document.querySelectorAll('.ob-view');
    for (var i = 0; i < views.length; i++) views[i].hidden = true;
    var el = document.getElementById('ob-' + name);
    if (el) el.hidden = false;
  }

  function countUp(el, target, duration) {
    var start = 0, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / (duration || 1200), 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  function render() {
    var welcome = document.getElementById('ob-welcome');
    var dateView = document.getElementById('ob-date');
    var doneView = document.getElementById('ob-done');
    var couple = State.couple();
    if (editMode && couple) {
      showOb('date');
      var input = document.getElementById('ob-date-input');
      input.value = couple.relationshipDate;
      document.getElementById('ob-done').querySelector('.ob-nickname-block').style.display = 'block';
      document.getElementById('ob-my-name').value = couple.myName || '';
      document.getElementById('ob-ta-name').value = couple.taName || '';
      var enterBtn = doneView.querySelector('[data-action="ob-enter"]');
      enterBtn.textContent = '保存修改';
      var skipBtn = doneView.querySelector('[data-action="ob-skip"]');
      skipBtn.style.display = 'none';
      document.querySelector('.ob-title').textContent = '你们是哪一天开始的？';
    } else {
      editMode = false;
      welcome.style.display = '';
      dateView.style.display = '';
      doneView.style.display = '';
      var eb = doneView.querySelector('[data-action="ob-enter"]');
      eb.textContent = '进入我们的故事';
      var sb = doneView.querySelector('[data-action="ob-skip"]');
      sb.style.display = '';
      document.querySelector('.ob-title').textContent = '你们是哪一天开始的？';
      showOb('welcome');
    }
  }

  function saveCoupleAndEnter() {
    var my = document.getElementById('ob-my-name').value.trim();
    var ta = document.getElementById('ob-ta-name').value.trim();
    var dateStr = document.getElementById('ob-date-input').value;
    var d = Utils.parseDate(dateStr);
    if (!d || isNaN(d.getTime())) { // 落盘前兜底校验：防绕过 next 校验直接保存（如 ob-skip 等路径）
      UI.toast('请先选择正确的开始日期');
      return;
    }
    dateStr = Utils.fmtInput(d); // 落盘前规范化 YYYY-MM-DD
    var old = State.couple() || {};
    var couple = {
      id: old.id || Utils.uid('couple'),
      myName: my,
      taName: ta,
      relationshipDate: dateStr,
      theme: (State.settings().theme) || 'cream',
      createdAt: old.createdAt || Utils.fmtInput(Utils.today())
    };
    State.saveCouple(couple);
    if (editMode) {
      editMode = false;
      UI.toast('资料已更新');
      global.Nav.go('/profile');
      return;
    }
    UI.toast('我们的故事开始啦');
    global.Nav.go('/home');
  }

  function bind() {
    var welcome = document.getElementById('ob-welcome');

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!t) return;
      var act = t.getAttribute('data-action');
      if (act === 'ob-start') {
        if (editMode) {
          // 编辑模式回到选择日期
          editMode = false;
          document.getElementById('ob-date-input').value = State.couple() ? State.couple().relationshipDate : '';
          showOb('date');
        } else {
          showOb('date');
        }
      } else if (act === 'ob-date-next') {
        var input = document.getElementById('ob-date-input');
        var val = input.value;
        var err = document.getElementById('ob-date-error');
        if (!val) { err.hidden = false; err.textContent = '请选择你们在一起的那一天。'; return; }
        var d = Utils.parseDate(val);
        if (!d || isNaN(d.getTime())) {
          err.hidden = false;
          err.textContent = '请检查开始日期是否正确。';
          return;
        }
        var today = Utils.today();
        if (d > today) {
          err.hidden = false;
          err.textContent = '这一天还没到哦，换一个日期吧。';
          return;
        }
        if (d < MIN_DATE) {
          err.hidden = false;
          err.textContent = '请检查开始日期是否正确，这一天似乎太早了。';
          return;
        }
        err.hidden = true;
        var days = Utils.dayNumber(d);
        var obDays = document.getElementById('ob-days');
        Utils.fitNum(obDays, days); // 天数位数多时自动缩小字号，防溢出
        countUp(obDays, days, 1100);
        showOb('done');
      } else if (act === 'ob-enter') {
        saveCoupleAndEnter();
      } else if (act === 'ob-skip') {
        document.getElementById('ob-my-name').value = '';
        document.getElementById('ob-ta-name').value = '';
        saveCoupleAndEnter();
      } else if (act === 'ob-back') {
        if (editMode) { global.Nav.go('/profile'); return; }
        showOb('welcome');
      }
    });
  }

  /* 供编辑入口调用 */
  global.Views.onboarding = {
    render: render,
    setEditMode: function (flag) { editMode = !!flag; }
  };
  bind();
})(window);
