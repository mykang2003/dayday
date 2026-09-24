/* ============================================================
   和你第N天 · onboarding.js
   首次引导（多步优化版）：欢迎 → 在一起的日子 → 昵称 → 生日 → 完成
   - 生日支持公历 MM-DD 与农历 L:MM-DD（复用 OD.Lunar 换算，
     datepicker 选公历日 → 农历月日暂存，禁用原生下拉）
   - 保存字段格式与旧版完全一致：relationshipDate / myName /
     taName / myBirthday / taBirthday
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

  /* 步骤顺序（不含欢迎页）：用于返回导航与进度计算 */
  var STEPS = ['date', 'names', 'birthday', 'done'];
  var STEP_INDEX = { date: 0, names: 1, birthday: 2, done: 3 };

  function showOb(name, dir) {
    var views = document.querySelectorAll('.ob-view');
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = true;
      views[i].classList.remove('ob-in', 'ob-out-prev');
    }
    var el = document.getElementById('ob-' + name);
    if (!el) return;
    el.hidden = false;
    el.classList.add('ob-in');
    /* 返回时旧视图做退出动画（不阻塞切换） */
    var prev = document.querySelector('.ob-view[data-ob-prev="1"]');
    if (prev) prev.classList.remove('ob-out-prev');
    el.setAttribute('data-ob-prev', '1');
    /* 进度条：欢迎页不显示，步骤页按 index 推进 */
    var prog = document.getElementById('ob-progress');
    var bar = document.getElementById('ob-progress-bar');
    if (name === 'welcome') {
      if (prog) prog.hidden = true;
    } else if (prog) {
      prog.hidden = false;
      var idx = STEP_INDEX[name] != null ? STEP_INDEX[name] : 0;
      if (bar) bar.style.width = ((idx + 1) / STEPS.length * 100) + '%';
      var labels = prog.querySelectorAll('.ob-progress-labels span');
      for (var j = 0; j < labels.length; j++) {
        labels[j].classList.toggle('on', j <= idx);
      }
    }
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

  /* ---------- 生日（公历 / 农历）---------- */
  var bdType = { my: 'solar', ta: 'solar' };
  /* 农历选中暂存：datepicker 选公历日 → 换算成农历月日，保存时读取 */
  var bdLunarSel = { my: null, ta: null };
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* 解析存储值 L:MM-DD → { m, d }；非农历/非法返回 null */
  function parseLunarStored(v) {
    var s = String(v || '');
    if (s.indexOf('L:') !== 0) return null;
    var p = s.slice(2).split('-');
    var m = +p[0], d = +p[1];
    if (!m || !d || m < 1 || m > 12 || d < 1 || d > 30) return null;
    return { m: m, d: d };
  }
  /* 农历月日 → 今年/明年第一个未过的公历日期（用于日历定位与回显） */
  function lunarAnchorDate(md) {
    var L = OD.Lunar;
    var today = Utils.today();
    var y = today.getFullYear();
    var d1 = L && L.toSolarDate ? L.toSolarDate(y, md.m, md.d, false) : null;
    if (d1 && d1 >= today) return d1;
    var d2 = L && L.toSolarDate ? L.toSolarDate(y + 1, md.m, md.d, false) : null;
    if (d2) return d2;
    return d1 || today;
  }
  /* 公历 input change：datepicker 写回 YYYY-MM-DD → 转 MM-DD 展示与存储 */
  function bdToMmdd(input, label) {
    var v = String(input.value || '').trim();
    if (!v) return;
    var p = v.split('-');
    if (p.length === 3) input.value = p[1] + '-' + p[2];
    if (label) label.textContent = '已选择 ' + input.value;
  }
  /* 农历 input change：datepicker 写回公历 YYYY-MM-DD → 换算农历月日暂存 */
  function onLunarPicked(person, input, label) {
    var v = String(input.value || '').trim();
    if (!v) return;
    var p = v.split('-');
    if (p.length !== 3) return;
    var date = new Date(+p[0], +p[1] - 1, +p[2]);
    var r = OD.Lunar && OD.Lunar.fromDate ? OD.Lunar.fromDate(date) : null;
    if (!r) { bdLunarSel[person] = null; if (label) label.textContent = '未设置'; UI.toast('所选日期超出农历支持范围'); return; }
    bdLunarSel[person] = { m: r.m, d: r.d };
    if (label) label.textContent = '已选择 ' + (r.isLeap ? '闰' : '') + r.monthName + r.dayName;
  }
  function setBdType(person, type) {
    var solar = document.getElementById('ob-bd-' + person + '-solar');
    var lunar = document.getElementById('ob-bd-' + person + '-lunar');
    if (solar) solar.hidden = (type !== 'solar');
    if (lunar) lunar.hidden = (type !== 'lunar');
    var btns = document.querySelectorAll('.bd-type-btn[data-ob-bd-person="' + person + '"]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-ob-bd-type') === type);
    }
    bdType[person] = type;
  }
  /* 读取某人当前选择：公历 MM-DD / 农历 L:MM-DD / 空 */
  function readBirthday(person) {
    var type = bdType[person] || 'solar';
    if (type === 'lunar') {
      var sel = bdLunarSel[person];
      if (!sel || !sel.m || !sel.d) return '';
      return 'L:' + pad2(sel.m) + '-' + pad2(sel.d);
    }
    return String(document.getElementById('ob-bd-' + person).value || '').trim();
  }

  /* 预填生日（编辑模式） */
  function prefillBirthdays(couple) {
    ['my', 'ta'].forEach(function (p) {
      var v = (p === 'my') ? (couple.myBirthday || '') : (couple.taBirthday || '');
      var type = (String(v).indexOf('L:') === 0) ? 'lunar' : 'solar';
      var md = parseLunarStored(v);
      bdLunarSel[p] = md ? { m: md.m, d: md.d } : null;
      var solarInput = document.getElementById('ob-bd-' + p);
      var lunarInput = document.getElementById('ob-bd-' + p + '-lunar-input');
      var label = document.getElementById('ob-bd-' + p + '-label');
      if (solarInput) solarInput.value = (type === 'solar') ? v : '';
      if (lunarInput) lunarInput.value = md ? Utils.fmtInput(lunarAnchorDate(md)) : '';
      if (label) label.textContent = v ? '已选择 ' + ((type === 'lunar' && md) ? '农历' + OD.Lunar.monthName(md.m, false) + OD.Lunar.dayName(md.d) : String(v).replace('L:', '')) : '未设置';
      setBdType(p, type);
    });
  }

  function render() {
    var couple = State.couple();
    if (editMode && couple) {
      /* 编辑模式：预填全部字段，从日期步开始 */
      var input = document.getElementById('ob-date-input');
      input.value = couple.relationshipDate || '';
      document.getElementById('ob-my-name').value = couple.myName || '';
      document.getElementById('ob-ta-name').value = couple.taName || '';
      prefillBirthdays(couple);
      var enterBtn = document.getElementById('ob-done').querySelector('[data-action="ob-enter"]');
      enterBtn.textContent = '保存修改';
      showOb('date');
    } else {
      editMode = false;
      var eb = document.getElementById('ob-done').querySelector('[data-action="ob-enter"]');
      eb.textContent = '进入我们的故事';
      showOb('welcome');
    }
  }

  function saveCoupleAndEnter() {
    var my = document.getElementById('ob-my-name').value.trim();
    var ta = document.getElementById('ob-ta-name').value.trim();
    var dateStr = document.getElementById('ob-date-input').value;
    var d = Utils.parseDate(dateStr);
    if (!d || isNaN(d.getTime())) { // 落盘前兜底校验：防绕过 next 校验直接保存
      UI.toast('请先选择正确的开始日期');
      return;
    }
    dateStr = Utils.fmtInput(d); // 落盘前规范化 YYYY-MM-DD
    var mb = readBirthday('my');
    var tb = readBirthday('ta');
    var bad = [];
    if (mb && !/^\d{2}-\d{2}$/.test(mb) && !/^L:\d{2}-\d{2}$/.test(mb)) bad.push('我的生日');
    if (tb && !/^\d{2}-\d{2}$/.test(tb) && !/^L:\d{2}-\d{2}$/.test(tb)) bad.push('TA的生日');
    if (bad.length) { UI.toast(bad.join('、') + '格式应为 月-日（公历）或 L:月-日（农历），如 02-14 或 L:08-10'); return; }

    var old = State.couple() || {};
    var couple = {
      id: old.id || Utils.uid('couple'),
      myName: my,
      taName: ta,
      relationshipDate: dateStr,
      theme: (State.settings().theme) || 'cream',
      createdAt: old.createdAt || Utils.fmtInput(Utils.today()),
      // 保留编辑资料时未涉及的字段（双人生日等），避免覆盖丢失
      myBirthday: mb || old.myBirthday || '',
      taBirthday: tb || old.taBirthday || ''
    };
    State.saveCouple(couple);
    State.syncMyBirthdayAnniv(couple);
    if (editMode) {
      editMode = false;
      UI.toast('资料已更新');
      global.Nav.go('/profile');
      return;
    }
    UI.toast('我们的故事开始啦', 3000);
    global.Nav.go('/home');
  }

  function bind() {
    /* 生日：datepicker 委托（data-date-open）由 datepicker.js 全局处理；
       change 由 datepicker 写回后触发，此处只做换算/回显 */
    function bindBdInput(person) {
      var solarInput = document.getElementById('ob-bd-' + person);
      var lunarInput = document.getElementById('ob-bd-' + person + '-lunar-input');
      if (solarInput) solarInput.addEventListener('change', function () {
        bdToMmdd(solarInput, document.getElementById('ob-bd-' + person + '-label'));
      });
      if (lunarInput) lunarInput.addEventListener('change', function () {
        onLunarPicked(person, lunarInput, document.getElementById('ob-bd-' + person + '-label'));
      });
    }
    bindBdInput('my');
    bindBdInput('ta');

    /* 公历/农历切换 */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-ob-bd-type]') : null;
      if (!btn) return;
      setBdType(btn.getAttribute('data-ob-bd-person'), btn.getAttribute('data-ob-bd-type'));
    });

    /* 步骤流转 */
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!t) return;
      var act = t.getAttribute('data-action');
      if (act === 'ob-start') {
        if (editMode) {
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
        showOb('names');
      } else if (act === 'ob-names-next' || act === 'ob-names-skip') {
        showOb('birthday');
      } else if (act === 'ob-bd-next' || act === 'ob-bd-skip') {
        var days = Utils.dayNumber(Utils.parseDate(document.getElementById('ob-date-input').value));
        var obDays = document.getElementById('ob-days');
        Utils.fitNum(obDays, days); // 天数位数多时自动缩小字号，防溢出
        countUp(obDays, days, 1100);
        showOb('done');
      } else if (act === 'ob-enter') {
        saveCoupleAndEnter();
      } else if (act === 'ob-back') {
        if (editMode) { global.Nav.go('/profile'); return; }
        var cur = null;
        var views = document.querySelectorAll('.ob-view');
        for (var i = 0; i < views.length; i++) {
          if (!views[i].hidden && views[i].id !== 'ob-progress') { cur = views[i].id.replace('ob-', ''); break; }
        }
        if (cur === 'date') showOb('welcome');
        else if (cur === 'names') showOb('date');
        else if (cur === 'birthday') showOb('names');
        else if (cur === 'done') showOb('birthday');
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
