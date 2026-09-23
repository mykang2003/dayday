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

  /* ---------- 主题取色 ----------
     海报配色完全跟随当前主题：从 :root 读取 --share-* 变量（每套主题都已定义），
     主题切换后（html[data-theme] 变化）再次生成海报即自动套用新配色。
     取不到变量时回落到奶油色，保证极端情况下仍可出图。 */
  var COLOR_FALLBACK = {
    'share-bg-from': '#FFF3F5',
    'share-bg-to': '#FFDCE5',
    'share-deco': '#FFC9D6',
    'share-num': '#E84D6F',
    'share-accent': '#FF6B8A',
    'share-title': '#4A2B33',
    'share-text': '#7A5A62',
    'share-sub': '#A8737B',
    'share-card': 'rgba(255,255,255,0.55)',
    'share-foot': '#E84D6F',
    'share-foot-sub': '#B5888F',
    'share-on-dark': '0'
  };

  /* ---------- 分享模板（L：多模板配色） ----------
     模板名对应分享页顶部 #share-templates 的 data-st（sunny / night / sakura）。
     选中模板后覆盖 --share-* 变量：模板优先、主题次之、内置兜底。 */
  var STYLE_TEMPLATES = {
    sunny: {
      'share-bg-from': '#FFF7EC', 'share-bg-to': '#FFE2BC',
      'share-deco': '#F5C787', 'share-num': '#C96E1F', 'share-accent': '#EE9A3E',
      'share-title': '#4A2E14', 'share-text': '#7A5B3A', 'share-sub': '#8F6B45',
      'share-card': 'rgba(255,255,255,0.62)',
      'share-foot': '#C96E1F', 'share-foot-sub': '#A07B55', 'share-on-dark': '0'
    },
    night: {
      'share-bg-from': '#332A3D', 'share-bg-to': '#16121C',
      'share-deco': '#5A4470', 'share-num': '#F2C8DA', 'share-accent': '#E8A0B4',
      'share-title': '#F6EFF8', 'share-text': '#DCD0E2', 'share-sub': '#B3A3BC',
      'share-card': 'rgba(255,255,255,0.09)',
      'share-foot': '#F2C8DA', 'share-foot-sub': 'rgba(255,255,255,0.60)', 'share-on-dark': '1'
    },
    sakura: {
      'share-bg-from': '#FDF1F6', 'share-bg-to': '#F6D6E4',
      'share-deco': '#EBB9CE', 'share-num': '#AF4272', 'share-accent': '#E97CA7',
      'share-title': '#4A3340', 'share-text': '#7A5F6B', 'share-sub': '#8F6B7D',
      'share-card': 'rgba(255,255,255,0.60)',
      'share-foot': '#AF4272', 'share-foot-sub': '#8F7482', 'share-on-dark': '0'
    }
  };

  var _tmplOverride = null;
  function setTemplate(name) {
    _tmplOverride = (name && STYLE_TEMPLATES[name]) ? STYLE_TEMPLATES[name] : null;
  }

  function themeColor(name) {
    if (_tmplOverride && _tmplOverride[name] !== undefined) return _tmplOverride[name];
    var v = '';
    try {
      v = global.getComputedStyle(document.documentElement).getPropertyValue('--' + name);
    } catch (e) { v = ''; }
    v = v ? String(v).trim() : '';
    return v || COLOR_FALLBACK[name] || '';
  }

  /* 当前主题是否深色底（决定页脚文字用白/彩色） */
  function isDarkTheme() { return themeColor('share-on-dark') === '1'; }

  function paintBase(ctx, theme) {
    theme = theme || 'day';
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, themeColor('share-bg-from'));
    g.addColorStop(1, themeColor('share-bg-to'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 装饰圆
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = themeColor('share-deco');
    ctx.beginPath(); ctx.arc(W - 60, 120, 150, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.arc(40, H - 160, 190, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  var CJK = '"PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';

  /* 页脚：双人名字（可选）+ 品牌 + 一句话
     双人名字来自引导页/编辑资料设置（OurDays.Utils.pairNames），未设置时该行整体省略，
     页脚回到原有两行布局（老用户排版不变）。名字过长时按可用宽度等比缩小字号，防溢出出血。 */
  function paintFooter(ctx, dark) {
    var OD = global.OurDays || {};
    var pn = (OD.Utils && typeof OD.Utils.pairNames === 'function') ? OD.Utils.pairNames() : { has: false, text: '' };
    var NAME_BASE = 30, NAME_MIN = 18, SAFE = 80;

    ctx.textAlign = 'center';

    if (pn.has) {
      ctx.fillStyle = dark ? 'rgba(255,255,255,.85)' : themeColor('share-foot');
      ctx.font = 'bold ' + NAME_BASE + 'px ' + CJK;
      var nameW = ctx.measureText(pn.text).width;
      var maxW = W - SAFE * 2;
      if (nameW > maxW) {
        ctx.font = 'bold ' + Math.max(NAME_MIN, Math.floor(NAME_BASE * maxW / nameW)) + 'px ' + CJK;
      }
      ctx.fillText(pn.text, W / 2, H - 146, maxW);
    }

    ctx.fillStyle = dark ? 'rgba(255,255,255,.85)' : themeColor('share-foot');
    ctx.font = 'bold 40px ' + CJK;
    ctx.fillText('和你第N天', W / 2, H - 96);
    ctx.fillStyle = dark ? 'rgba(255,255,255,.55)' : themeColor('share-foot-sub');
    ctx.font = '24px ' + CJK;
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
    var dark = isDarkTheme();
    ctx.textAlign = 'center';
    ctx.fillStyle = themeColor('share-sub');
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
    ctx.fillStyle = themeColor('share-num');
    ctx.fillText(num, x0, 570, maxNumW); // 末参为极端位数（8位以上）的压缩兜底

    ctx.font = '40px sans-serif';
    ctx.fillStyle = themeColor('share-sub');
    ctx.fillText('天', x0 + numW + GAP, 470);
    ctx.textAlign = 'center';

    // 日期区间
    ctx.font = '30px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = themeColor('share-text');
    ctx.fillText((data.startStr || '') + '  —  ' + (data.endStr || ''), W / 2, 680);

    // 分隔爱心
    ctx.fillStyle = themeColor('share-accent');
    ctx.font = '34px sans-serif';
    ctx.fillText('❤', W / 2, 740);

    // 文案
    ctx.fillStyle = themeColor('share-text');
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

    ctx.fillStyle = themeColor('share-sub');
    ctx.font = '32px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText('我们的下一个特别日子', W / 2, 300);

    ctx.fillStyle = themeColor('share-num');
    ctx.font = 'bold 88px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var titleLines = wrapText(ctx, data.title || '纪念日', 620);
    centerLines(ctx, titleLines, W / 2, 420, 100, 620);

    ctx.fillStyle = themeColor('share-text');
    ctx.font = '34px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText(data.dateCN || '', W / 2, 680);

    ctx.fillStyle = themeColor('share-accent');
    ctx.font = 'bold 56px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var remainTxt;
    if (data.remain > 0) remainTxt = '还有 ' + data.remain + ' 天';
    else if (data.remain === 0) remainTxt = '就是今天 ❤';
    else remainTxt = '已过去 ' + (-data.remain) + ' 天';
    ctx.fillText(remainTxt, W / 2, 780);

    ctx.fillStyle = themeColor('share-text');
    ctx.font = '28px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var quoteLines = wrapText(ctx, data.quote || '一起走过的每一天，都值得被记住。', 560);
    centerLines(ctx, quoteLines, W / 2, 880, 42, 560);

    paintFooter(ctx, isDarkTheme());
  }

  /* ---------- 类型C：回忆卡 ----------
     版式：顶部图片圆角展示（等比 cover，不压缩画质，仅裁剪显示），
     图片区高度收窄为 440px，给下方文字让出更多垂直空间，防止长文与页脚姓名重叠。 */
  function paintMemory(canvas, data) {
    var ctx = canvas.getContext('2d');
    paintBase(ctx, 'memory');
    var y = 0;
    ctx.fillStyle = themeColor('share-card');
    roundedRect(ctx, 36, 40, W - 72, H - 180, 36);
    ctx.fill();

    if (data.photo) {
      return loadImage(data.photo).then(function (img) {
        // 顶部图片圆角裁剪
        ctx.save();
        roundedRect(ctx, 60, 70, W - 120, 440, 32);
        ctx.clip();
        var scale = Math.max((W - 120) / img.width, 440 / img.height);
        var dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, 60 + ((W - 120) - dw) / 2, 70 + (440 - dh) / 2, dw, dh);
        ctx.restore();
        paintMemoryText(ctx, data, 560);
      });
    }
    paintMemoryText(ctx, data, 140);
    return Promise.resolve();
  }

  function paintMemoryText(ctx, data, startY) {
    /* 页脚保护区：名字行基线在 H-146，正文区不得侵入 H-250 以下 */
    var FOOT_TOP = H - 250;
    var n = data.moodEmoji || '❤️';
    ctx.textAlign = 'center';
    ctx.font = '44px sans-serif';
    ctx.fillText(n, W / 2, startY + 60);

    ctx.fillStyle = themeColor('share-sub');
    ctx.font = '28px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    ctx.fillText(data.dateCN || '', W / 2, startY + 130);

    ctx.fillStyle = themeColor('share-title');
    ctx.font = 'bold 54px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var titleLines = wrapText(ctx, data.title || '我们的回忆', 560);
    var tLines = titleLines.length > 2 ? titleLines.slice(0, 2) : titleLines;
    var ty = centerLines(ctx, tLines, W / 2, startY + 200, 66, 560);

    /* 正文：按剩余可用高度动态计算行数（上限 4 行），超出截断并加省略号 */
    ctx.fillStyle = themeColor('share-text');
    ctx.font = '30px "PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    var content = data.content || '';
    var contentLines = wrapText(ctx, content, 540);
    var maxRows = Math.max(1, Math.min(4, Math.floor((FOOT_TOP - (ty + 90) - 12) / 46)));
    if (contentLines.length > maxRows) {
      contentLines = contentLines.slice(0, maxRows);
      var lastTxt = contentLines[maxRows - 1];
      var cut = lastTxt;
      while (cut.length > 0 && ctx.measureText(cut + '…').width > 540) cut = cut.slice(0, -1);
      contentLines[maxRows - 1] = (cut.length ? cut : lastTxt.slice(0, 1)) + '…';
    }
    var cy = centerLines(ctx, contentLines, W / 2, ty + 90, 46, 540);

    paintFooter(ctx, isDarkTheme());
  }

  /* 入口：render(type, data, template?) → Promise<dataUrl> */
  function render(type, data, template) {
    setTemplate(template || null);
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
