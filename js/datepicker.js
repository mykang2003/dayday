/* ============================================================
   和你第N天 · datepicker.js
   自定义日历选择（替代原生 input[type=date]，规避 WebView 显示空白）
   用法：在任意 <input> 上加 data-date-open（或其外层 .date-field 点击），
         UI.datePicker(inputEl).then(function(v){ if (v) inputEl.value = v; });
   选中后自动写回 input.value（YYYY-MM-DD）并派发 change 事件。
   ============================================================ */
(function (global) {
  'use strict';
  var UI = global.UI;
  var OD = global.OurDays; // 离线农历（js/lunar.js）；未加载时自动降级为不显示农历

  var SHEET_ID = 'datepicker-sheet';

  /* 农历短文本：初一显示月名（闰月为「闰X月」），其余显示日名；
     超出算法覆盖范围（1901-02-19 ~ 2100-12-31）或模块缺失时返回 '' */
  function lunarCell(date) {
    var L = OD && OD.Lunar;
    if (!L || typeof L.cellOf !== 'function') return '';
    try { return L.cellOf(date) || ''; } catch (e) { return ''; }
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function toISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function parseISO(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d);
  }
  function todayDate() {
    var t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function sameDate(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ---------- 状态 ---------- */
  // 日历下限：1926-01-01（约为当前年份-100，即 2026-100）
  // 防止用户连续翻月把年份翻到异常早（如 1912-12-11），避免再次写入 113 年前的错误开始日期
  var MIN_DATE = new Date(1926, 0, 1);
  var MIN_YEAR = MIN_DATE.getFullYear();  // 年网格下限页起点（1926）
  var YEAR_PAGE = 12;                     // 年网格每页 12 年
  var targetInput = null;   // 正在选择的目标输入框
  var viewY = 0, viewM = 0; // 当前视图年/月
  var viewMode = 'day';     // 视图模式：day=日历 / month=月网格 / year=年网格
  var selISO = '';          // 当前选中日期 YYYY-MM-DD
  var pendingResolve = null; // 未决 Promise resolve

  /* 清空未决状态并返回待 resolve 的回调（可能为 null） */
  function consumePending() {
    var r = pendingResolve;
    pendingResolve = null;
    targetInput = null;
    return r;
  }

  /* 弹层当前是否可见（hidden=false 即打开） */
  function sheetOpen() {
    var el = document.getElementById(SHEET_ID);
    return !!(el && !el.hidden);
  }

  function resolveAndClose(v) {
    var r = consumePending();
    UI.closeSheet(SHEET_ID);
    if (r) r(v);
  }

  /* ---------- 关闭路径全覆盖 ----------
     日历可能被多条路径关闭：✕ / 遮罩 / UI.closeSheet / UI.closeAllSheets / 切页等。
     无论哪条路径，只要弹层被关闭，就必须清理 pendingResolve 并 resolve(null)（取消，不写回日期），
     否则 pendingResolve 残留会让同一输入框在本页生命周期内再也无法唤出日历。 */
  function hookSheetClose() {
    var baseCloseSheet = UI.closeSheet;
    var baseCloseAll = UI.closeAllSheets;
    if (typeof baseCloseSheet === 'function') {
      UI.closeSheet = function (id) {
        var r = (id === SHEET_ID) ? consumePending() : null;
        var out = baseCloseSheet.apply(this, arguments);
        if (r) r(null);
        return out;
      };
    }
    if (typeof baseCloseAll === 'function') {
      UI.closeAllSheets = function () {
        var r = sheetOpen() ? consumePending() : null;
        var out = baseCloseAll.apply(this, arguments);
        if (r) r(null);
        return out;
      };
    }
  }

  /* 兜底：无论谁把弹层 hidden 掉（含直接改 DOM 的路径），都同步清理未决状态 */
  function observeSheetHidden() {
    var el = document.getElementById(SHEET_ID);
    if (!el || !global.MutationObserver) return;
    new global.MutationObserver(function () {
      if (el.hidden) {
        var r = consumePending();
        if (r) r(null);
      }
    }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }

  function openPicker(input) {
    if (pendingResolve) resolveAndClose(null); // 释放上一次未决选择

    targetInput = input;
    selISO = (input && input.value) || '';
    var anchor = parseISO(selISO) || todayDate();
    // 打开时下限钳制：存量异常值（如 1912-12-11）不再作为视图起点
    if (anchor < MIN_DATE) anchor = MIN_DATE;
    viewY = anchor.getFullYear();
    viewM = anchor.getMonth();
    viewMode = 'day';   // 每次打开都从日历视图开始
    render();

    UI.openSheet(SHEET_ID);
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var gridEl = document.getElementById('dp-grid');
    var titleEl = document.getElementById('dp-title');
    if (!gridEl || !titleEl) return;

    // 星期行仅在日历视图有意义；月网格只有一屏，翻页按钮隐藏（年网格翻页 = 翻 12 年）
    var weekEl = document.getElementById('dp-week');
    if (weekEl) weekEl.className = (viewMode === 'day') ? 'dp-week' : 'dp-week is-hidden';
    var headEl = document.getElementById('dp-head');
    if (headEl) headEl.className = (viewMode === 'month') ? 'dp-head is-nav-hidden' : 'dp-head';

    if (viewMode === 'year') { renderTitle('year', titleEl); renderYearGrid(gridEl); return; }
    if (viewMode === 'month') { renderTitle('month', titleEl); renderMonthGrid(gridEl); return; }
    renderTitle('day', titleEl);
    renderDayGrid(gridEl);
  }

  /* 标题：点「年」进年网格、点「月」进月网格，两种网格之间也可互相切换 */
  function renderTitle(mode, titleEl) {
    var yearPart = '<button type="button" class="dp-title-part' + (mode === 'year' ? ' is-active' : '') +
      '" data-dp-view="year">' + (mode === 'year' ? '选择年份' : viewY + ' 年') + '</button>';
    var monthPart = '<button type="button" class="dp-title-part' + (mode === 'month' ? ' is-active' : '') +
      '" data-dp-view="month">' + (mode === 'month' ? '选择月份' : (viewM + 1) + ' 月') + '</button>';
    titleEl.innerHTML = yearPart + monthPart;
  }

  /* 日历视图（默认）：公历数字 + 下方农历（初一显示月名、闰月标「闰X月」、其余显示日名） */
  function renderDayGrid(gridEl) {
    var first = new Date(viewY, viewM, 1);
    var lead = (first.getDay() + 6) % 7; // 周一为一周起点
    var daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    var today = todayDate();
    var selected = parseISO(selISO);

    var total = Math.ceil((lead + daysInMonth) / 7) * 7;
    var html = '';
    for (var i = 0; i < lead; i++) html += '<span class="dp-cell dp-void"></span>';
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(viewY, viewM, d);
      var iso = toISO(date);
      var cls = 'dp-cell';
      if (sameDate(date, today)) cls += ' dp-today';
      if (sameDate(date, selected)) cls += ' dp-selected';
      var lu = lunarCell(date);
      html += '<button type="button" class="' + cls + '" data-date="' + iso + '"' +
        (lu ? ' aria-label="' + iso + ' 农历' + lu + '"' : '') + '>' +
        '<span class="dp-d">' + d + '</span>' +
        (lu ? '<span class="dp-l">' + lu + '</span>' : '') +
        '</button>';
    }
    for (var k = lead + daysInMonth; k < total; k++) html += '<span class="dp-cell dp-void"></span>';
    gridEl.className = 'dp-grid dp-grid-day';
    gridEl.innerHTML = html;
  }

  /* 年网格分页起点：自 1926 起按 12 年一页对齐，保证永不显示 1926 之前的年份 */
  function yearPageStart() {
    return MIN_YEAR + Math.floor((viewY - MIN_YEAR) / YEAR_PAGE) * YEAR_PAGE;
  }

  /* 年网格：每页 12 年 */
  function renderYearGrid(gridEl) {
    var startY = yearPageStart();
    var todayY = todayDate().getFullYear();
    var html = '';
    for (var i = 0; i < YEAR_PAGE; i++) {
      var y = startY + i;
      var cls = 'dp-cell';
      if (y === viewY) cls += ' dp-selected';
      if (y === todayY) cls += ' dp-today';
      html += '<button type="button" class="' + cls + '" data-dp-year="' + y + '">' + y + '</button>';
    }
    gridEl.className = 'dp-grid dp-grid-year';
    gridEl.innerHTML = html;
  }

  /* 月网格：12 个月 */
  function renderMonthGrid(gridEl) {
    var html = '';
    for (var i = 0; i < 12; i++) {
      var cls = 'dp-cell';
      if (i === viewM) cls += ' dp-selected';
      html += '<button type="button" class="' + cls + '" data-dp-month="' + i + '">' + (i + 1) + ' 月</button>';
    }
    gridEl.className = 'dp-grid dp-grid-month';
    gridEl.innerHTML = html;
  }

  /* 视图切换（标题区域点击） */
  function setView(mode) {
    if (mode !== 'day' && mode !== 'month' && mode !== 'year') return;
    viewMode = mode;
    render();
  }

  function goMonth(delta) {
    var y = viewY, m = viewM + delta;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    // 下界钳制：翻月不可越过下限年/月（1926-01），上一月按钮/手势到 1926-01 即停
    if (y < MIN_DATE.getFullYear() || (y === MIN_DATE.getFullYear() && m < MIN_DATE.getMonth())) {
      y = MIN_DATE.getFullYear();
      m = MIN_DATE.getMonth();
    }
    viewY = y; viewM = m;
    render();
  }

  /* 翻页统一入口：日历视图翻月；年网格翻 12 年（受 1926 下限钳制）；月网格单屏不翻页 */
  function goNav(delta) {
    if (viewMode === 'year') {
      var startY = yearPageStart() + delta * YEAR_PAGE;
      if (startY < MIN_YEAR) startY = MIN_YEAR;
      viewY = startY;
      render();
      return;
    }
    if (viewMode === 'month') return;
    goMonth(delta);
  }

  /* ---------- 事件 ---------- */
  function init() {
    if (!document.getElementById('datepicker-sheet')) return;

    // 关闭路径全覆盖：包装 UI 关闭 API + 监听 hidden 变化
    hookSheetClose();
    observeSheetHidden();

    // 弹层内：导航 / 回今天 / 选日期
    document.getElementById('datepicker-sheet').addEventListener('click', function (e) {
      var nav = e.target.closest ? e.target.closest('[data-dp-nav]') : null;
      var todayBtn = e.target.closest ? e.target.closest('[data-dp-today]') : null;
      var dayBtn = e.target.closest ? e.target.closest('.dp-cell[data-date]') : null;
      var viewBtn = e.target.closest ? e.target.closest('[data-dp-view]') : null;
      var yearBtn = e.target.closest ? e.target.closest('[data-dp-year]') : null;
      var monthBtn = e.target.closest ? e.target.closest('[data-dp-month]') : null;

      // 标题区域：在「日历 / 年网格 / 月网格」之间切换
      if (viewBtn) { setView(viewBtn.getAttribute('data-dp-view')); return; }
      // 年网格选中 → 回日历视图（沿用当前月，年份受 1926 下限钳制）
      if (yearBtn) {
        var y = parseInt(yearBtn.getAttribute('data-dp-year'), 10);
        if (!isNaN(y)) { viewY = Math.max(y, MIN_YEAR); viewMode = 'day'; render(); }
        return;
      }
      // 月网格选中 → 回日历视图
      if (monthBtn) {
        var mSel = parseInt(monthBtn.getAttribute('data-dp-month'), 10);
        if (!isNaN(mSel)) { viewM = Math.min(Math.max(mSel, 0), 11); viewMode = 'day'; render(); }
        return;
      }
      if (nav) { goNav(parseInt(nav.getAttribute('data-dp-nav'), 10) || 0); return; }
      if (todayBtn) {
        var t = todayDate();
        viewY = t.getFullYear(); viewM = t.getMonth();
        viewMode = 'day';
        render();
        return;
      }
      if (dayBtn && pendingResolve) {
        var val = dayBtn.getAttribute('data-date');
        selISO = val;
        var input = targetInput;
        if (input) input.value = val;
        resolveAndClose(val);
        if (input && typeof input.dispatchEvent === 'function') {
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // mask / ✕ → 取消（不写回）
    // ✕ 位于 sheet 内部，不能再把“是否在 sheet 内”作为排除条件，
    // 否则 ✕ 关闭后 pendingResolve 残留，同一输入框无法再次唤出日历。
    document.addEventListener('click', function (e) {
      var t = e.target;
      var isMask = t === document.getElementById('modal-mask');
      var isCloseBtn = !!(t && t.closest && t.closest('[data-close-sheet]'));
      if (isMask || isCloseBtn) { resolveAndClose(null); return; }
      // 弹层内部的翻月/选日期/“回到今天”不在此处理
      if (t && t.closest && t.closest('#' + SHEET_ID)) return;
      // 兜底：未决状态存在但弹层已不可见（被间接关闭）→ 同步清理
      if (pendingResolve && !sheetOpen()) resolveAndClose(null);
    });

    // Escape → 取消
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pendingResolve) resolveAndClose(null);
    });

    // 委托：点击 [data-date-open]（input 本身）或 .date-field 区域 → 打开
    document.addEventListener('click', function (e) {
      var opener = e.target.closest ? e.target.closest('[data-date-open], .date-field') : null;
      if (!opener) return;
      var input = null;
      if (opener.tagName === 'INPUT') {
        input = opener;
      } else {
        input = opener.querySelector('input[data-date-open]');
      }
      if (!input) return;
      // 三种情况都重新打开：无未决状态 / 换了输入框 / 弹层实际已不可见（状态残留兜底）
      if (!pendingResolve || targetInput !== input || !sheetOpen()) openPicker(input);
    });
  }

  /* ---------- 对外 API ---------- */
  global.UI.datePicker = function (input) {
    if (pendingResolve && targetInput === input && sheetOpen()) {
      // 已打开同一输入框的选择器时，直接返回当前未决 Promise
      return new Promise(function (resolve) {
        var old = pendingResolve;
        pendingResolve = function (v) { old(v); resolve(v); };
      });
    }
    if (pendingResolve) resolveAndClose(null);
    return openPicker(input);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
