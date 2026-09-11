/* ============================================================
   和你第N天 · home.js
   首页（PRD 6 / Page 01）
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};

  function countUp(el, target) {
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / 1300, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  function nextAuto() {
    var couple = State.couple();
    if (!couple) return null;
    var start = Utils.parseDate(couple.relationshipDate);
    var days = Utils.dayNumber(start);
    for (var i = 0; i < OD.AUTO_ANNIV.length; i++) {
      var n = OD.AUTO_ANNIV[i].n;
      var d = Utils.nthDayDate(start, n);
      if (Utils.diffDaysFromToday(d) >= 0) return { n: n, date: d, kind: 'auto' };
    }
    return null;
  }

  function nextCustom() {
    var list = State.customAnniv().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var now = Utils.fmtInput(Utils.today());
    for (var i = 0; i < list.length; i++) {
      if (list[i].date >= now) {
        return { title: list[i].title, date: Utils.parseDate(list[i].date), kind: 'custom', note: list[i].note };
      }
    }
    return null;
  }

  function renderNext(next) {
    var box = document.getElementById('home-next');
    if (!next) {
      box.innerHTML =
        '<div class="nc-label">💕 下一个特别日子</div>' +
        '<div class="nc-title">把每个普通的日子，都过成纪念日</div>' +
        '<div class="nc-meta">今天也很特别，因为你们在一起。</div>';
      return;
    }
    var remain = Utils.diffDaysFromToday(next.date);
    var title = next.kind === 'auto' ? (next.n + '天纪念日') : next.title;
    var dateCN = Utils.fmtCN(next.date);
    var dayTxt = remain === 0 ? '就是今天 ❤️' : (remain > 0 ? '还有 ' + remain + ' 天' : '已过去 ' + (-remain) + ' 天');
    var html =
      '<div class="nc-label">💕 下一个特别日子</div>' +
      '<div class="nc-title">' + title + '</div>' +
      '<div class="nc-meta">' + dateCN + '</div>' +
      '<div class="nc-days">' + dayTxt + '</div>' +
      '<div class="nc-btn-row"><button class="btn btn-soft btn-sm" data-nav="anniv">查看全部纪念日</button></div>';
    box.innerHTML = html;
  }

  function renderRecent() {
    var wrap = document.getElementById('home-recent');
    var list = State.memories().slice().sort(function (a, b) {
      return (b.date + b.createdAt).localeCompare(a.date + a.createdAt);
    }).slice(0, 3);
    if (!list.length) {
      wrap.innerHTML =
        '<div class="empty-state" style="padding:24px 8px">' +
        '<div class="empty-icon">💌</div>' +
        '<div class="empty-title">你们的故事，从今天开始。</div>' +
        '<div class="empty-desc">记下第一段回忆，让未来有故事可回看。</div>' +
        '<button class="btn btn-primary" data-nav="memory/new">记录第一段回忆</button></div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach(function (m) {
      var card = global.Card.build(m);
      wrap.appendChild(card.el);
    });
  }

  function render() {
    var couple = State.couple();
    if (!couple) { global.Nav.go('/onboarding'); return; }
    var start = Utils.parseDate(couple.relationshipDate);
    var days = Utils.dayNumber(start);

    var dayEl = document.getElementById('home-days');
    Utils.fitNum(dayEl, days); // 天数位数多时自动缩小字号，防溢出
    countUp(dayEl, days);
    var todayD = Utils.today();
    document.getElementById('home-range').textContent =
      Utils.fmtDot(start) + ' → ' + Utils.fmtDot(todayD);

    var quoteIdx = (days - 1) % OD.QUOTES.length;
    var quote = OD.QUOTES[quoteIdx].replace('{n}', days);
    document.getElementById('home-quote').textContent = '“' + quote + '”';

    document.getElementById('home-today-tip').textContent =
      days === 1 ? '今天是第1天 ❤️' : '原来我们已经一起走了这么久。';

    // 今日分享卡数据（供 data-open-share="day" 入口使用）
    lastDayShare = {
      days: days,
      startStr: Utils.fmtDot(start),
      endStr: Utils.fmtDot(todayD),
      quote: quote
    };

    renderNext(nextAuto() || nextCustom());
    renderRecent();
  }

  global.Views.home = { render: render };

  /* 快捷入口：想个惊喜 */
  function openSurprise() {
    var next = nextAuto() || nextCustom();
    var ideas = global.AI.surpriseIdeas(next && next.kind === 'custom' ? { title: next.title } : (next && next.kind === 'auto' ? { title: next.n + '天纪念日' } : null));
    var text = '一些小小的想法：\n\n' + ideas.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n\n');
    global.UI.tipSheet(text, '🎁 想个惊喜');
  }

  /* 今日分享卡 */
  var lastDayShare = null;
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-open-share="day"]') : null;
    if (!t || !lastDayShare) return;
    global.ShareOpen('day', lastDayShare, '/home');
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-open-ai]') : null;
    if (!t) return;
    var kind = t.getAttribute('data-open-ai');
    if (kind === 'memory') {
      // 去记录页，提示可用 AI 辅助
      global.Nav.go('/memory/new?ai=1');
    } else if (kind === 'surprise') {
      openSurprise();
    }
  });
})(window);
