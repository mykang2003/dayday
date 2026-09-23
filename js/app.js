/* ============================================================
   和你第N天 · app.js
   主路由：页面注册 / 导航 / 主题初始化
   ============================================================ */
(function (global) {
  'use strict';
  var UI = global.UI;
  var OD = global.OurDays;
  var State = OD.State;
  var Views = global.Views || {};

  /* ---------- 渲染器注册（页面 ID → render） ---------- */
  var renderers = global.renderers = {};
  renderers.home = Views.home && Views.home.render;
  renderers.story = Views.timeline && Views.timeline.render;
  renderers.album = Views.album && Views.album.render;
  renderers.anniv = Views.anniv && Views.anniv.render;
  renderers.profile = Views.profile && Views.profile.render;
  renderers.onboarding = Views.onboarding && Views.onboarding.render;
  renderers['memory-new'] = Views['memory-new'] && Views['memory-new'].render;
  renderers['memory-detail'] = Views['memory-detail'] && Views['memory-detail'].render;
  renderers.share = Views.share && Views.share.render;

  /* ---------- 路由 ---------- */
  function queryOf(raw) {
    var q = {};
    var idx = raw.indexOf('?');
    if (idx < 0) return q;
    raw.slice(idx + 1).split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0]) q[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : '';
    });
    return q;
  }

  function go(raw) {
    var path = raw.split('?')[0] || '/';
    var q = queryOf(raw);
    var page;
    var opts = { nav: true };
    if (path.indexOf('/memory/new') === 0) { page = 'memory-new'; opts.id = q.id || null; }
    else if (path.indexOf('/memory/detail') === 0) { page = 'memory-detail'; opts.id = q.id || null; }
    else if (path === '/story') page = 'story';
    else if (path === '/album') page = 'album';
    else if (path === '/anniv') page = 'anniv';
    else if (path === '/profile') page = 'profile';
    else if (path === '/onboarding') page = 'onboarding';
    else if (path === '/share') page = 'share';
    else if (path === '/' || path === '/home') page = 'home';
    else page = 'home';
    if (page === 'share') opts.nav = false;
    if (page === 'onboarding') opts.nav = false;
    UI.showPage(page, opts);
    if (page === 'album') {
      var items = document.querySelectorAll('.nav-item');
      for (var k = 0; k < items.length; k++) {
        items[k].classList.toggle('active', items[k].getAttribute('data-nav') === 'story');
      }
    }
  }
  global.Nav = { go: go };

  /* ---------- 导航点击（data-nav / data-seg） ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var nav = t.closest ? t.closest('[data-nav]') : null;
    if (nav) {
      var val = nav.getAttribute('data-nav');
      if (val === 'anniv' || val === 'profile' || val === 'home' || val === 'story') {
        e.preventDefault();
        go('/' + val);
        return;
      }
      if (val === 'memory/new' || val === 'memory/detail') {
        e.preventDefault();
        go('/' + val);
        return;
      }
    }
    var seg = t.closest ? t.closest('[data-seg]') : null;
    if (seg) {
      e.preventDefault();
      go(seg.getAttribute('data-seg') === 'album' ? '/album' : '/story');
    }
  });

  /* 首页设置齿轮 → 我的 */
  var gear = document.getElementById('home-settings');
  if (gear) {
    gear.addEventListener('click', function () { go('/profile'); });
  }

  /* ---------- 启动 ---------- */
  function init() {
    var s = State.settings();
    document.documentElement.setAttribute('data-theme', s.theme || 'cream');
    // 浏览器状态栏配色跟随主题（读取当前主题的 --bg），保证切换主题后刷新仍一致
    if (UI.syncThemeColor) UI.syncThemeColor();
    if (State.hasCouple()) {
      // 刷新后停留在上次所在主导航页（localStorage 由 ui.showPage 记录）
      var last = '';
      try { last = localStorage.getItem('od.lastPage') || ''; } catch (e) { last = ''; }
      go((last === 'home' || last === 'story' || last === 'anniv' || last === 'profile') ? ('/' + last) : '/home');
    } else go('/onboarding');

    // 进入页面提醒（E）：等当前页渲染完成后再检查，避免弹层与首屏渲染竞争
    if (global.AnnivReminder && global.AnnivReminder.check) {
      setTimeout(global.AnnivReminder.check, 700);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
