/* ============================================================
   和你第N天 · timeline.js
   我们的故事 · 时间轴（PRD 7）
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function buildGroups(memories) {
    var groups = {};
    memories.slice().sort(function (a, b) {
      var d = (b.date + ' ' + (b.createdAt || '')).localeCompare(a.date + ' ' + (a.createdAt || ''));
      return d;
    }).forEach(function (m) {
      var d = Utils.parseDate(m.date);
      var y = d ? d.getFullYear() : 0;
      if (!groups[y]) groups[y] = [];
      groups[y].push(m);
    });
    var keys = Object.keys(groups).map(Number).sort(function (a, b) { return b - a; });
    return keys.map(function (k) { return { year: k, items: groups[k] }; });
  }

  function attachThumbs(el, photos, max) {
    if (!photos || !photos.length) return;
    var box = el.querySelector('.tl-thumbs');
    if (!box) return;
    var count = 0;
    photos.slice(0, max || 3).forEach(function (p) {
      OD.PhotoStore.get(p.id).then(function (url) {
        if (!url || count >= (max || 3)) return;
        count++;
        var img = document.createElement('img');
        img.className = 'thumb';
        img.alt = '回忆照片';
        img.src = url;
        box.appendChild(img);
      });
    });
  }

  function render() {
    var memories = State.memories();
    var listEl = document.getElementById('timeline-list');
    var emptyEl = document.getElementById('timeline-empty');
    listEl.innerHTML = '';

    if (!memories.length) {
      listEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.hidden = false;

    var groups = buildGroups(memories);
    var frag = document.createDocumentFragment();
    groups.forEach(function (g) {
      var yearBox = document.createElement('div');
      yearBox.className = 'tl-year';
      yearBox.textContent = g.year;
      frag.appendChild(yearBox);
      g.items.forEach(function (m) {
        var d = Utils.parseDate(m.date);
        var emoji = OD.pickIcon(m.title, m.mood);
        var excerpt = (m.content || '').trim();
        var item = document.createElement('div');
        item.className = 'tl-item';
        item.setAttribute('data-mid', m.id);
        item.innerHTML =
          '<div class="tl-dot">' + emoji + '</div>' +
          '<div class="tl-card">' +
            '<div class="tl-date">' + (d ? pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) : '') + '</div>' +
            '<div class="tl-title">' + escapeHtml(m.title || '这一刻') + '</div>' +
            (excerpt ? '<div class="tl-excerpt">' + escapeHtml(excerpt) + '</div>' : '') +
            '<div class="tl-thumbs"></div>' +
          '</div>';
        attachThumbs(item, m.photos, 3);
        item.addEventListener('click', function () {
          global.Nav.go('/memory/detail?id=' + m.id);
        });
        frag.appendChild(item);
      });
    });
    listEl.appendChild(frag);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 时间轴页"?"帮助 */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-open-timeline-help]') : null;
    if (t) {
      UI.tipSheet('按时间记下你们的故事：\n\n• 点下方「＋ 记录这一刻」添加回忆\n• 点任意一条可查看详情与照片\n• 每一段回忆都可以生成分享卡', '关于我们的故事');
    }
  });

  global.Views.timeline = { render: render };
  global.TimelineHelpers = { escapeHtml: escapeHtml };
})(window);
