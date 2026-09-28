/* ============================================================
   和你第N天 · period.js
   生理期 Tab：月历展示（已记录经期 / 预测期 / 排卵日）· 前后翻月 ·
   周期学习与自动预测 · 首次引导录入
   ------------------------------------------------------------
   数据（od.period，纯本机存储）：
     {
       onboarded: true,               // 是否已完成首次引导
       lastStart: 'YYYY-MM-DD',       // 最近一次经期开始日
       cycleLen: 28,                  // 周期天数（引导初始值，随记录自动修正）
       periodLen: 5,                  // 持续天数（引导初始值）
       marks: { 'YYYY-MM-DD': 1 | 0 } // 每日标记：1=经期来，0=经期没来
     }
   预测规则：
     · 从 marks 提取「经期开始日」序列（当天=经期来 且 前一天≠经期来）；
     · 最近两次开始日间隔 → 学习周期，修正 cycleLen（10~90 天区间内生效）；
     · 下次预计开始日 = lastStart 起按 cycleLen 推进到 ≥ 今天；
     · 预计持续天数 = periodLen；
     · 预测由设置自动排布，日历为只读展示，不支持手动点击修改。
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var LS = OD.LS;
  var UI = global.UI;

  global.Views = global.Views || {};

  var KEY = 'period';
  var WEEK_HEAD = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  var DEFAULT_PERIOD_LEN = 5;
  var DEFAULT_CYCLE_LEN = 28;
  var PERIOD_LEN_OPTIONS = [3, 4, 5, 6, 7];
  var CYCLE_LEN_OPTIONS = [21, 24, 26, 28, 30, 32, 35, 40];

  /* ---------- 存取 ---------- */
  function read() {
    var d = LS.get(KEY, null);
    return d && typeof d === 'object' ? d : null;
  }
  function write(d) { LS.set(KEY, d); }

  /* ---------- 日期工具 ---------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseISO(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function sameDate(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function todayDate() {
    var t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function diffDays(a, b) {
    return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 周期学习与预测 ---------- */
  function collectStarts(marks) {
    var days = Object.keys(marks || {}).filter(function (k) {
      return marks[k] === 1 && /^\d{4}-\d{2}-\d{2}$/.test(k);
    }).sort();
    var starts = [];
    for (var i = 0; i < days.length; i++) {
      var iso = days[i];
      var prev = toISO(addDays(parseISO(iso), -1));
      if (marks[prev] === 1) continue; // 前一天也是经期 → 连续段中间
      starts.push(iso);
    }
    return starts;
  }

  /* 返回预测结果：
       nextStart: Date|null  下次预计开始日（≥ 今天；无数据时为 null）
       cycleLen / periodLen  本次生效的周期 / 持续天数
       learned               true=周期来自记录学习，false=引导默认/历史值
       lastStartISO          当前生效的最近一次开始日 */
  function predict(data) {
    var d = data || {};
    var marks = d.marks || {};
    var starts = collectStarts(marks);
    var lastStart = d.lastStart ? parseISO(d.lastStart) : null;
    var cycleLen = Number(d.cycleLen) || DEFAULT_CYCLE_LEN;
    var periodLen = Number(d.periodLen) || DEFAULT_PERIOD_LEN;
    var learned = false;

    /* 记录中存在更新的开始日 → 以实际记录为准 */
    if (starts.length) {
      var last = parseISO(starts[starts.length - 1]);
      if (!lastStart || diffDays(last, lastStart) > 0) lastStart = last;
    }
    /* 最近两次开始日间隔 → 学习周期（宽松校验，防脏数据） */
    if (starts.length >= 2) {
      var gap = diffDays(parseISO(starts[starts.length - 1]), parseISO(starts[starts.length - 2]));
      if (gap >= 10 && gap <= 90) { cycleLen = gap; learned = true; }
    }
    var nextStart = lastStart ? new Date(lastStart) : null;
    if (nextStart) {
      /* 越过已过去的日期；若预测日恰为今天且今天已被标记为经期来（本次已发生），
         同样推进到下一周期，避免「下次预计开始」停留在今天 */
      while (diffDays(nextStart, todayDate()) < 0 ||
             (diffDays(nextStart, todayDate()) === 0 && marks[toISO(nextStart)] === 1)) {
        nextStart = addDays(nextStart, cycleLen);
      }
    }
    var ovulation = nextStart ? addDays(nextStart, -14) : null;
    return {
      nextStart: nextStart,
      ovulation: ovulation,
      cycleLen: cycleLen,
      periodLen: periodLen,
      learned: learned,
      lastStartISO: lastStart ? toISO(lastStart) : '',
      has: !!lastStart
    };
  }

  /* 预测的经期日期集合（供月历虚线提示） */
  function predictedISOSet(p) {
    var set = {};
    if (!p || !p.nextStart) return set;
    for (var i = 0; i < p.periodLen; i++) {
      set[toISO(addDays(p.nextStart, i))] = true;
    }
    return set;
  }

  /* ---------- 视图状态 ---------- */
  var viewY = 0;
  var viewM = 0; // 0-11
  var setupOpenedOnce = false; // 每会话首次进入自动弹引导（未引导时）

  function setViewToToday() {
    var t = todayDate();
    viewY = t.getFullYear();
    viewM = t.getMonth();
  }

  /* ---------- 引导 sheet ---------- */
  function buildChips(rowId, options, activeVal) {
    var row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = options.map(function (v) {
      return '<button type="button" class="mood-chip' + (v === activeVal ? ' active' : '') + '" data-val="' + v + '">' + v + '天</button>';
    }).join('');
  }
  function chipValue(rowId) {
    var row = document.getElementById(rowId);
    if (!row) return 0;
    var active = row.querySelector('.mood-chip.active');
    return active ? (Number(active.getAttribute('data-val')) || 0) : 0;
  }

  function openSetup() {
    var data = read();
    var lastStart = data && data.lastStart ? data.lastStart : '';
    var plen = data && Number(data.periodLen) ? Number(data.periodLen) : DEFAULT_PERIOD_LEN;
    var cyc = data && Number(data.cycleLen) ? Number(data.cycleLen) : DEFAULT_CYCLE_LEN;
    var input = document.getElementById('period-last-start');
    if (input) input.value = lastStart;
    buildChips('period-len-row', PERIOD_LEN_OPTIONS, plen);
    buildChips('period-cycle-row', CYCLE_LEN_OPTIONS, cyc);
    UI.openSheet('period-sheet');
  }

  function saveSetup() {
    var input = document.getElementById('period-last-start');
    var lastStart = input ? input.value.trim() : '';
    if (!lastStart) { UI.toast('请选择最近一次开始日期'); return; }
    var plen = chipValue('period-len-row') || DEFAULT_PERIOD_LEN;
    var cyc = chipValue('period-cycle-row') || DEFAULT_CYCLE_LEN;
    var data = read() || {};
    data.onboarded = true;
    data.lastStart = lastStart;
    data.periodLen = plen;
    data.cycleLen = cyc;
    /* 以设置为准：重建经期标记，清掉旧的手动标记，避免日历显示杂乱且与设置不符 */
    var marks = {};
    var startD = parseISO(lastStart);
    if (startD) {
      for (var i = 0; i < plen; i++) marks[toISO(addDays(startD, i))] = 1;
    }
    data.marks = marks;
    write(data);
    UI.closeSheet('period-sheet');
    var p = predict(data);
    var nextTxt = p.nextStart ? (Utils.fmtCN(p.nextStart) + '开始') : '记录后即可预测';
    UI.toast('已保存 · 预计 ' + nextTxt);
    render();
  }

  /* 清空本机生理期数据并重新打开引导设置 */
  function resetPeriod() {
    UI.confirm({
      title: '清空生理期数据',
      text: '将删除本机保存的全部生理期记录与预测，重新开始设置。',
      okText: '清空并重设',
      cancelText: '取消'
    }).then(function (ok) {
      if (!ok) return;
      LS.remove(KEY);
      confirmDismissed = false;
      setupOpenedOnce = false;
      UI.closeSheet('period-sheet');
      UI.toast('已清空，请重新设置');
      render();
    });
  }

  /* ---------- 三态标记 ----------
     已废弃：预测由设置自动排布，日历为只读展示。
     仅保留「月经来了？」确认条写入 marks；不再支持手动点击修改日历。 */

  /* 会话级：本次会话内「月经来了？」确认条是否已处理（是/否均不再弹） */
  var confirmDismissed = false;

  /* "是"：把今天记为经期开始，并顺延 periodLen 天预填为经期来 */
  function markPeriodStartToday() {
    var data = read() || {};
    var marks = data.marks || {};
    var today = todayDate();
    var iso = toISO(today);
    var plen = Number(data.periodLen) || DEFAULT_PERIOD_LEN;
    for (var i = 0; i < plen; i++) marks[toISO(addDays(today, i))] = 1;
    data.marks = marks;
    data.lastStart = iso;
    data.onboarded = true;
    write(data);
    confirmDismissed = true;
    UI.toast('已记录今天为月经期开始');
    render();
  }

  /* 以设置为准：若 marks 中的经期开始日与 lastStart 不一致（旧手动标记残留），
     自动重建为 lastStart 起 periodLen 天，保证日历与设置一致 */
  function alignMarksToLastStart(data) {
    if (!data || !data.lastStart) return;
    var starts = collectStarts(data.marks || {});
    if (!starts.length) return;
    if (starts[starts.length - 1] === data.lastStart) return; // 一致，无需重建
    var plen = Number(data.periodLen) || DEFAULT_PERIOD_LEN;
    var marks = {};
    var startD = parseISO(data.lastStart);
    if (startD) {
      for (var i = 0; i < plen; i++) marks[toISO(addDays(startD, i))] = 1;
    }
    data.marks = marks;
    write(data);
  }

  /* ---------- 渲染 ---------- */
  function renderPredict() {
    var box = document.getElementById('period-predict');
    if (!box) return;
    var data = read();
    var p = predict(data);
    var html = '';
    if (!data || !data.onboarded) {
      html =
        '<div class="period-predict pp-empty">' +
          '<div class="pp-empty-ico">🌸</div>' +
          '<div class="pp-label">生理期记录与预测</div>' +
          '<div class="pp-desc">设置最近一次开始日期后，我们会按周期自动预测下一次。</div>' +
          '<button class="btn btn-primary" data-pd-setup>开始设置</button>' +
        '</div>';
      box.innerHTML = html;
      return;
    }
    if (!p.has) {
      html =
        '<div class="period-predict pp-empty">' +
          '<div class="pp-empty-ico">🌸</div>' +
          '<div class="pp-label">等待记录</div>' +
          '<div class="pp-desc">设置最近一次开始日期后，即可自动预测下一次。</div>' +
          '<button class="btn btn-soft" data-pd-setup>重新设置</button>' +
        '</div>';
      box.innerHTML = html;
      return;
    }
    var nextTxt = p.nextStart ? (Utils.fmtCN(p.nextStart) + ' · ' + WEEK_HEAD[(p.nextStart.getDay() + 6) % 7]) : '—';
    var diff = p.nextStart ? diffDays(p.nextStart, todayDate()) : -1;
    var diffTxt = diff === 0 ? '就是今天' : (diff > 0 ? '还有 ' + diff + ' 天' : '');
    var ovuTxt = p.ovulation ? (Utils.fmtCN(p.ovulation) + ' · ' + WEEK_HEAD[(p.ovulation.getDay() + 6) % 7]) : '';
    html =
      '<div class="period-predict">' +
        '<div class="pp-label">🌙 下次预计开始</div>' +
        '<div class="pp-title">' + esc(nextTxt) + '</div>' +
        '<div class="pp-days">' + diffTxt + '</div>' +
        '<div class="pp-cols">' +
          '<div class="pp-col">' +
            '<div class="pp-k">预计持续 · 周期</div>' +
            '<div class="pp-v">' + p.periodLen + ' 天 · ' + p.cycleLen + ' 天' + (p.learned ? ' · 已修正' : '') + '</div>' +
          '</div>' +
          (ovuTxt ?
          '<div class="pp-col">' +
            '<div class="pp-k">预计排卵日</div>' +
            '<div class="pp-v">' + esc(ovuTxt) + '</div>' +
          '</div>' : '') +
        '</div>' +
        '<div class="pp-meta">最近一次开始：' + esc(p.lastStartISO) + '</div>' +
      '</div>';
    box.innerHTML = html;
  }

  function renderCal() {
    var title = document.getElementById('pd-title');
    var grid = document.getElementById('pd-grid');
    if (!title || !grid) return;
    title.textContent = viewY + '年' + (viewM + 1) + '月';

    var data = read();
    var marks = (data && data.marks) || {};
    var p = predict(data);
    var predSet = predictedISOSet(p);
    var ovuISO = p && p.ovulation ? toISO(p.ovulation) : '';

    var first = new Date(viewY, viewM, 1);
    var lead = (first.getDay() + 6) % 7; // 周一开头
    var daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    var total = Math.ceil((lead + daysInMonth) / 7) * 7;

    var today = todayDate();
    var html = '';
    for (var i = 0; i < lead; i++) html += '<span class="dp-cell dp-void"></span>';
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(viewY, viewM, d);
      var iso = toISO(date);
      var cls = 'dp-cell pd-cell';
      if (sameDate(date, today)) cls += ' dp-today';
      var st = marks[iso];
      if (st === 1) cls += ' pd-on';
      else if (st === 0) cls += ' pd-off';
      else if (predSet[iso]) cls += ' pd-pred';
      if (ovuISO === iso) cls += ' pd-ovu';
      html += '<span class="' + cls + '">' +
        '<span class="dp-d">' + d + '</span>' +
        '<span class="pd-dot"></span>' +
      '</span>';
    }
    for (var j = lead + daysInMonth; j < total; j++) html += '<span class="dp-cell dp-void"></span>';
    grid.innerHTML = html;

    var foot = document.getElementById('pd-foot');
    if (foot) foot.hidden = (viewY === today.getFullYear() && viewM === today.getMonth());
  }

  function render() {
    if (!OD.State.hasCouple()) { global.Nav.go('/onboarding'); return; }
    if (!viewY) setViewToToday();
    var data = read();
    alignMarksToLastStart(data);
    renderPredict();
    renderCal();
    var cfm = document.getElementById('period-confirm');
    if (cfm) {
      var p0 = predict(data);
      var todayIso = toISO(todayDate());
      var predSet = predictedISOSet(p0);
      var inPredWin = !!(p0 && p0.nextStart && predSet[todayIso]);
      var alreadyMarked = !!(data && data.marks && data.marks[todayIso] === 1);
      var needConfirm = !!(data && data.onboarded && inPredWin && !alreadyMarked);
      cfm.classList.toggle('pc-hide', needConfirm ? confirmDismissed : true);
    }
    if (!data || !data.onboarded) {
      if (!setupOpenedOnce) {
        setupOpenedOnce = true;
        setTimeout(openSetup, 60);
      }
    }
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    var page = document.getElementById('page-period');
    if (!page) return;

    page.addEventListener('click', function (e) {
      var t = e.target;
      var navBtn = t.closest ? t.closest('[data-pd-nav]') : null;
      if (navBtn) {
        var step = Number(navBtn.getAttribute('data-pd-nav')) || 0;
        viewM += step;
        if (viewM < 0) { viewM = 11; viewY--; }
        if (viewM > 11) { viewM = 0; viewY++; }
        renderCal();
        return;
      }
      var todayBtn = t.closest ? t.closest('[data-pd-today]') : null;
      if (todayBtn) { setViewToToday(); renderCal(); return; }
      var setupBtn = t.closest ? t.closest('[data-pd-setup]') : null;
      if (setupBtn) { openSetup(); return; }
      var cfmBtn = t.closest ? t.closest('[data-pd-confirm]') : null;
      if (cfmBtn) {
        if (cfmBtn.getAttribute('data-pd-confirm') === 'yes') {
          markPeriodStartToday();
        } else {
          confirmDismissed = true;
          var cfmEl = document.getElementById('period-confirm');
          if (cfmEl) cfmEl.classList.add('pc-hide');
        }
        return;
      }
    });

    var setupBtn = document.getElementById('period-setup');
    if (setupBtn) setupBtn.addEventListener('click', openSetup);

    var saveBtn = document.getElementById('period-save');
    if (saveBtn) saveBtn.addEventListener('click', saveSetup);

    var resetBtn = document.getElementById('period-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetPeriod);

    var sheet = document.getElementById('period-sheet');
    if (sheet) {
      sheet.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.mood-chip') : null;
        if (!chip || !sheet.contains(chip)) return;
        var row = chip.parentNode;
        if (!row) return;
        var chips = row.querySelectorAll('.mood-chip');
        for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
        chip.classList.add('active');
      });
    }
  }

  global.Views.period = { render: render, openSetup: openSetup };
  bind();
})(window);
