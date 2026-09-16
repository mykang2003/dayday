/* ============================================================
   和你第N天 · ui.js
   通用 UI：toast / sheet / 确认 / 页面切换
   ============================================================ */
(function (global) {
  'use strict';

  var toastTimer = null;
  function toast(text, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2200);
  }

  /* ---------- 背景滚动锁定 ----------
     弹层/灯箱打开时禁止背景滚动穿透。
     iOS 仅 overflow:hidden 无效，需 position:fixed + 记录 scrollY 还原（见 style.css .is-locked） */
  var _lockCount = 0;
  var _lockY = 0;
  function lockScroll() {
    _lockCount++;
    if (_lockCount > 1) return;
    _lockY = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.top = (-_lockY) + 'px';
    document.body.classList.add('is-locked');
  }
  function unlockScroll() {
    if (_lockCount === 0) return;
    _lockCount--;
    if (_lockCount > 0) return;
    document.body.classList.remove('is-locked');
    document.body.style.top = '';
    window.scrollTo(0, _lockY);
  }
  function forceUnlock() {
    _lockCount = 0;
    document.body.classList.remove('is-locked');
    document.body.style.top = '';
  }

  var mask = document.getElementById('modal-mask');
  function showMask() {
    if (!mask) return;
    if (mask.hidden) { mask.hidden = false; lockScroll(); }
  }
  function hideMask() {
    if (!mask) return;
    if (!mask.hidden) { mask.hidden = true; unlockScroll(); }
  }

  var openedSheets = [];
  function openSheet(id) {
    var el = document.getElementById(id);
    if (!el) return;
    showMask();
    el.hidden = false;
    if (openedSheets.indexOf(id) === -1) openedSheets.push(id);
  }
  function closeAllSheets() {
    openedSheets.slice().forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    openedSheets = [];
    hideMask();
  }
  function closeSheet(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
    openedSheets = openedSheets.filter(function (x) { return x !== id; });
    if (!openedSheets.length) hideMask();
  }

  /* 确认弹层：PRD 19.4 情感化文案由调用方传入 title/text */
  function confirm(opts) {
    return new Promise(function (resolve) {
      var title = opts.title || '确认';
      var text = opts.text || '';
      var okText = opts.okText || '删除';
      var cancelText = opts.cancelText || '取消';
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-text').textContent = text;
      document.getElementById('confirm-ok').textContent = okText;
      document.getElementById('confirm-cancel').textContent = cancelText;
      var okBtn = document.getElementById('confirm-ok');
      if (opts.danger === false) {
        okBtn.classList.remove('btn-danger');
        okBtn.classList.add('btn-primary');
      } else {
        okBtn.classList.remove('btn-primary');
        okBtn.classList.add('btn-danger');
      }
      openSheet('confirm-sheet');
      function done(val) {
        document.getElementById('confirm-ok').onclick = null;
        document.getElementById('confirm-cancel').onclick = null;
        closeSheet('confirm-sheet');
        resolve(val);
      }
      document.getElementById('confirm-ok').onclick = function () { done(true); };
      document.getElementById('confirm-cancel').onclick = function () { done(false); };
    });
  }

  function tipSheet(text, title) {
    return new Promise(function (resolve) {
      document.querySelector('#sheet-tip .sheet-title').textContent = title || '❤️';
      document.getElementById('sheet-tip-text').textContent = text;
      openSheet('sheet-tip');
      function done() {
        document.getElementById('sheet-tip-ok').onclick = null;
        closeSheet('sheet-tip');
        resolve(true);
      }
      document.getElementById('sheet-tip-ok').onclick = done;
    });
  }

  /* ---------- 页面切换 ---------- */
  var NAV_PAGES = ['home', 'story', 'anniv', 'profile'];
  var currentPage = '';
  function showPage(pageId, opts) {
    opts = opts || {};
    forceUnlock(); // 兜底：页面切换时确保背景不被锁死
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) pages[i].hidden = true;
    var el = document.getElementById('page-' + pageId);
    if (!el) { // 分享页等独立页
      document.getElementById('page-home').hidden = false;
      pageId = 'home';
      el = document.getElementById('page-home');
    }
    el.hidden = false;
    document.getElementById('bottom-nav').hidden = (pageId === 'share') || (pageId === 'onboarding');
    if (opts.nav !== false) {
      var items = document.querySelectorAll('.nav-item');
      for (var j = 0; j < items.length; j++) {
        items[j].classList.toggle('active', items[j].getAttribute('data-nav') === pageId);
      }
    }
    currentPage = pageId;
    window.scrollTo(0, 0);
    if (global.renderers && global.renderers[pageId]) {
      global.renderers[pageId](opts);
    }
  }

  function busyHtml() {
    return '<span class="spinner"></span>请稍候';
  }

  /* ---------- 状态栏配色跟随主题 ----------
     读取当前主题的 --bg（主题切换后会立即变化），写入 <meta name="theme-color">，
     让浏览器地址栏 / 系统状态栏颜色与主题保持一致，刷新后依旧生效 */
  function syncThemeColor() {
    if (!global.getComputedStyle) return;
    var cs = global.getComputedStyle(document.documentElement);
    var bg = cs.getPropertyValue('--bg');
    bg = bg ? bg.trim() : '';
    if (!bg) return;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', bg);
  }

  global.UI = {
    toast: toast,
    confirm: confirm,
    tipSheet: tipSheet,
    openSheet: openSheet,
    closeSheet: closeSheet,
    closeAllSheets: closeAllSheets,
    showPage: showPage,
    showMask: showMask,
    hideMask: hideMask,
    lockScroll: lockScroll,
    unlockScroll: unlockScroll,
    busyHtml: busyHtml,
    syncThemeColor: syncThemeColor,
    get currentPage() { return currentPage; }
  };

  /* 全局事件：点击任何 [data-close-sheet] 关闭弹层、点击 mask 关闭 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute('data-close-sheet') !== null) {
        global.UI.closeAllSheets();
        return;
      }
      t = t.parentNode;
    }
    if (e.target === mask) global.UI.closeAllSheets();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') global.UI.closeAllSheets();
  });
})(window);
