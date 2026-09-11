/* ============================================================
   和你第N天 · share.js
   分享海报（Canvas 绘制）PRD 15
   type: day / anniv / memory
   ============================================================ */
(function (global) {
  'use strict';

  var W = 750, H = 1200;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function baseCanvas() {
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    return canvas;
  }

  function paintBase(ctx, theme) {
    theme = theme || 'day';
    var g;
    if (theme === 'night') {
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3A2B3E');
      g.addColorStop(1, '#1F1A24');
    } else {
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, theme === 'memory' ? '#FDEFF3' : '#FFF3F5');
      g.addColorStop(1, '#FFDCE5');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 装饰圆
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#FFC9D6';
    ctx.beginPath(); ctx.arc(W - 60, 120, 150, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.arc(40, H - 160, 190, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintFooter(ctx, dark) {
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? 'rgba(255,255,255,.85)' : '#E84D6F';
    ctx.font = 'bold 40px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText('和你第N天', W / 2, H - 96);
    ctx.fillStyle = dark ? 'rgba(255,255,255,.55)' : '#B5888F';
    ctx.font = '24px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText('记录你和TA的每一天', W / 2, H - 52);
  }

  /* 居中绘制多行文本，返回最后一行 y */
  function centerLines(ctx, lines, x, y, lineHeight, maxWidth) {
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
    return y + (lines.length - 1) * lineHeight;
  }

  /* ---------- 类型A：恋爱天数 ---------- */
  function paintDay(canvas, data) {
    var ctx = canvas.getContext('2d');
    paintBase(ctx, 'day');
    var dark = false;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#B5888F';
    ctx.font = '30px sans-serif';
    ctx.fillText('我们在一起', W / 2, 250);

    // 天数大数字 + "天"：按可用宽度自适应字号，组合整体水平居中
    var num = String(data.days || 0);
    var BASE_SIZE = 280; // 1~3 位沿用原设计字号
    var MIN_SIZE = 120;  // 最小字号下限，保证可读
    var SAFE = 70;       // 画布左右安全留白
    var GAP = 16;        // 数字与"天"字的水平间距
    var numFont = function (size) {
      return '900 ' + size + 'px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    };

    ctx.font = '40px sans-serif';
    var tianW = ctx.measureText('天').width;
    var maxNumW = W - SAFE * 2 - tianW - GAP; // 数字可用最大宽度

    ctx.font = numFont(BASE_SIZE);
    var baseW = ctx.measureText(num).width;
    var numSize = BASE_SIZE;
    if (baseW > maxNumW) {
      // 位数增加导致超宽时，按可用宽度等比缩小
      numSize = Math.max(MIN_SIZE, Math.floor(BASE_SIZE * maxNumW / baseW));
    }
    ctx.font = numFont(numSize);

    var numW = Math.min(ctx.measureText(num).width, maxNumW);
    var x0 = (W - (numW + GAP + tianW)) / 2; // 数字+“天”组合整体居中

    ctx.textAlign = 'left';
    ctx.fillStyle = '#E84D6F';
    ctx.fillText(num, x0, 570, maxNumW); // 末参为极端位数（8位以上）的压缩兜底

    ctx.font = '40px sans-serif';
    ctx.fillStyle = '#B5888F';
    ctx.fillText('天', x0 + numW + GAP, 470);
    ctx.textAlign = 'center';

    // 日期区间
    ctx.font = '30px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#7A5A62';
    ctx.fillText((data.startStr || '') + '  —  ' + (data.endStr || ''), W / 2, 680);

    // 分隔爱心
    ctx.fillStyle = '#FF6B8A';
    ctx.font = '34px sans-serif';
    ctx.fillText('❤', W / 2, 740);

    // 文案
    ctx.fillStyle = '#7A5A62';
    ctx.font = '30px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var quoteLines = wrapText(ctx, data.quote || '普通的一天，因为有TA，变得值得记录。', 560);
    var lines = quoteLines.length > 2 ? quoteLines.slice(0, 2) : quoteLines;
    centerLines(ctx, lines, W / 2, 800, 46, 560);

    paintFooter(ctx, dark);
  }

  /* ---------- 类型B：纪念日 ---------- */
  function paintAnniv(canvas, data) {
    var ctx = canvas.getContext('2d');
    paintBase(ctx, 'day');
    ctx.textAlign = 'center';

    ctx.fillStyle = '#B5888F';
    ctx.font = '32px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText('我们的下一个特别日子', W / 2, 300);

    ctx.fillStyle = '#E84D6F';
    ctx.font = 'bold 88px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var titleLines = wrapText(ctx, data.title || '纪念日', 620);
    centerLines(ctx, titleLines, W / 2, 420, 100, 620);

    ctx.fillStyle = '#7A5A62';
    ctx.font = '34px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText(data.dateCN || '', W / 2, 680);

    ctx.fillStyle = '#FF6B8A';
    ctx.font = 'bold 56px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var remainTxt;
    if (data.remain > 0) remainTxt = '还有 ' + data.remain + ' 天';
    else if (data.remain === 0) remainTxt = '就是今天 ❤';
    else remainTxt = '已过去 ' + (-data.remain) + ' 天';
    ctx.fillText(remainTxt, W / 2, 780);

    ctx.fillStyle = '#7A5A62';
    ctx.font = '28px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var quoteLines = wrapText(ctx, data.quote || '一起走过的每一天，都值得被记住。', 560);
    centerLines(ctx, quoteLines, W / 2, 880, 42, 560);

    paintFooter(ctx, false);
  }

  /* ---------- 类型C：回忆卡 ---------- */
  function paintMemory(canvas, data) {
    var ctx = canvas.getContext('2d');
    paintBase(ctx, 'memory');
    var y = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundedRect(ctx, 36, 40, W - 72, H - 180, 36);
    ctx.fill();

    if (data.photo) {
      return loadImage(data.photo).then(function (img) {
        // 顶部图片圆角裁剪
        ctx.save();
        roundedRect(ctx, 60, 70, W - 120, 560, 32);
        ctx.clip();
        var scale = Math.max((W - 120) / img.width, 560 / img.height);
        var dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, 60 + ((W - 120) - dw) / 2, 70 + (560 - dh) / 2, dw, dh);
        ctx.restore();
        paintMemoryText(ctx, data, 660);
      });
    }
    paintMemoryText(ctx, data, 140);
    return Promise.resolve();
  }

  function paintMemoryText(ctx, data, startY) {
    var n = data.moodEmoji || '❤️';
    ctx.textAlign = 'center';
    ctx.font = '44px sans-serif';
    ctx.fillText(n, W / 2, startY + 60);

    ctx.fillStyle = '#B5888F';
    ctx.font = '28px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText(data.dateCN || '', W / 2, startY + 130);

    ctx.fillStyle = '#4A2B33';
    ctx.font = 'bold 54px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var titleLines = wrapText(ctx, data.title || '我们的回忆', 560);
    var tLines = titleLines.length > 2 ? titleLines.slice(0, 2) : titleLines;
    var ty = centerLines(ctx, tLines, W / 2, startY + 200, 66, 560);

    ctx.fillStyle = '#8A626A';
    ctx.font = '30px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var content = data.content || '';
    var contentLines = wrapText(ctx, content, 540);
    if (contentLines.length > 4) contentLines = contentLines.slice(0, 4);
    var cy = centerLines(ctx, contentLines, W / 2, ty + 90, 46, 540);

    paintFooter(ctx, false);
  }

  /* 入口：render(type, data) → Promise<dataUrl> */
  function render(type, data) {
    var canvas = baseCanvas();
    var p;
    if (type === 'anniv') { paintAnniv(canvas, data); p = Promise.resolve(); }
    else if (type === 'memory') { p = paintMemory(canvas, data); }
    else { paintDay(canvas, data); p = Promise.resolve(); }
    return p.then(function () {
      return canvas.toDataURL('image/png');
    });
  }

  global.Share = { render: render };
})(window);
