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

  var SHEET_ID = 'datepicker-sheet';

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
  var targetInput = null;   // 正在选择的目标输入框
  var viewY = 0, viewM = 0; // 当前视图年/月
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

    var first = new Date(viewY, viewM, 1);
    var lead = (first.getDay() + 6) % 7; // 周一为一周起点
    var daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    var today = todayDate();
    var selected = parseISO(selISO);

    titleEl.textContent = viewY + ' 年 ' + (viewM + 1) + ' 月';

    var total = Math.ceil((lead + daysInMonth) / 7) * 7;
    var html = '';
    for (var i = 0; i < lead; i++) html += '<span class="dp-cell dp-void"></span>';
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(viewY, viewM, d);
      var iso = toISO(date);
      var cls = 'dp-cell';
      if (sameDate(date, today)) cls += ' dp-today';
      if (sameDate(date, selected)) cls += ' dp-selected';
      html += '<button type="button" class="' + cls + '" data-date="' + iso + '">' + d + '</button>';
    }
    for (var k = lead + daysInMonth; k < total; k++) html += '<span class="dp-cell dp-void"></span>';
    gridEl.innerHTML = html;
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

      if (nav) { goMonth(parseInt(nav.getAttribute('data-dp-nav'), 10) || 0); return; }
      if (todayBtn) {
        var t = todayDate();
        viewY = t.getFullYear(); viewM = t.getMonth();
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
