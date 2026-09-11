/* ============================================================
   和你第N天 · album.js
   相册（PRD P0 相册 + 灯箱轮播）
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;

  global.Views = global.Views || {};

  var photosIndex = []; // [{mid, pid, title, dateStr}]

  function collect() {
    photosIndex = [];
    var memories = State.memories();
    memories.slice().sort(function (a, b) { return (b.date + b.createdAt).localeCompare(a.date + a.createdAt); })
      .forEach(function (m) {
        (m.photos || []).forEach(function (p) {
          photosIndex.push({ mid: m.id, pid: p.id, title: m.title || '', dateStr: m.date });
        });
      });
    return photosIndex;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function render() {
    var photos = collect();
    var grid = document.getElementById('album-grid');
    var emptyEl = document.getElementById('album-empty');
    grid.innerHTML = '';

    if (!photos.length) {
      grid.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    grid.hidden = false;

    photos.forEach(function (ph, idx) {
      var holder = document.createElement('div');
      holder.className = 'album-item';
      holder.setAttribute('data-idx', idx);
      var img = document.createElement('img');
      img.alt = ph.title || '回忆照片';
      OD.PhotoStore.get(ph.pid).then(function (url) {
        if (url) img.src = url;
      });
      holder.appendChild(img);
      holder.addEventListener('click', function () { openLightbox(idx); });
      grid.appendChild(holder);
    });
  }

  function lightboxEl() { return document.getElementById('lightbox'); }

  function renderLightbox() {
    if (!photosIndex.length) return;
    var idx = currentLb;
    var ph = photosIndex[idx];
    var img = document.getElementById('lightbox-img');
    OD.PhotoStore.get(ph.pid).then(function (url) {
      if (url) img.src = url;
    });
    var meta = document.getElementById('lightbox-meta');
    meta.textContent = (ph.title || '回忆') + ' · ' + (ph.dateStr || '');
    document.getElementById('lightbox-count').textContent = (idx + 1) + ' / ' + photosIndex.length;
    meta.onclick = function () {
      closeLightbox();
      global.Nav.go('/memory/detail?id=' + ph.mid);
    };
    meta.style.cursor = 'pointer';
    meta.title = '查看这段回忆';
  }

  var currentLb = 0;

  function openLightbox(idx) {
    currentLb = idx;
    var el = lightboxEl();
    el.hidden = false;
    /* 锁定背景滚动（iOS 需 position:fixed 方案，见 UI.lockScroll） */
    if (global.UI && global.UI.lockScroll) global.UI.lockScroll();
    else document.body.style.overflow = 'hidden';
    renderLightbox();
  }
  function closeLightbox() {
    var el = lightboxEl();
    el.hidden = true;
    if (global.UI && global.UI.unlockScroll) global.UI.unlockScroll();
    else document.body.style.overflow = '';
  }
  function step(dir) {
    if (!photosIndex.length) return;
    currentLb = (currentLb + dir + photosIndex.length) % photosIndex.length;
    renderLightbox();
  }

  /* 移动端：灯箱内左右滑动切换上一张/下一张 */
  function bindSwipe() {
    var el = lightboxEl();
    var sx = 0, sy = 0;
    el.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function bind() {
    document.getElementById('lightbox').addEventListener('click', function (e) {
      var id = e.target && e.target.id;
      if (id === 'lightbox') closeLightbox();
    });
    document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev').addEventListener('click', function () { step(-1); });
    document.getElementById('lightbox-next').addEventListener('click', function () { step(1); });
    document.addEventListener('keydown', function (e) {
      if (lightboxEl().hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    bindSwipe();
  }

  global.Views.album = { render: render };
  bind();
})(window);
