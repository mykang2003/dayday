/* ============================================================
   和你第N天 · ai.js
   AI 是增强不是主角（PRD 13/27）
   - 配置了 OpenAI 兼容接口 → 真实生成
   - 未配置 / 失败 → 内置温柔模板降级，绝不阻塞用户保存
   ============================================================ */
(function (global) {
  'use strict';

  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;

  var AI_SYSTEM = [
    '你是产品「和你第N天」里的温柔回忆助手。',
    '要求：语气自然、温柔、年轻、不油腻、不说教、不过度浪漫。',
    '严禁编造用户没有提供的信息（事件、地点、对话、感受都不许虚构）。',
    '严禁作出确定性关系判断，禁止出现"注定天长地久""一定会结婚""天生一对"等表述。',
    '输出 50～120 字中文，不用引号包裹全文，不要加标题。'
  ].join('\n');

  function aiConfig() {
    var s = State.settings();
    return s.ai || { base: '', model: '', key: '' };
  }

  function configured() {
    var c = aiConfig();
    return !!(c.base && c.model && c.key);
  }

  /* OpenAI 兼容 chat 调用；60s 超时 */
  function callChat(messages) {
    var cfg = aiConfig();
    if (!configured()) return Promise.reject(new Error('no-config'));
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 60000);
    var base = cfg.base.replace(/\/+$/, '');
    return fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages: messages, temperature: 0.8, max_tokens: 600 }),
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    }).then(function (data) {
      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('empty');
      return String(content).trim().replace(/^["'“”]+|["'“”]+$/g, '');
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function names() {
    var c = State.couple();
    if (!c) return { my: '', ta: '' };
    return { my: c.myName || '', ta: c.taName || 'TA' };
  }

  /* ---------- 能力1：帮我写回忆 ---------- */
  function writeMemory(facts) {
    facts = facts || {};
    var n = names();
    var moodLabel = facts.mood && OD.MOODS[facts.mood] ? OD.MOODS[facts.mood].label : '';

    var userParts = ['帮我把我们的一段回忆写成温柔自然的短文（50～120字）：'];
    if (facts.myName && facts.taName) userParts.push('称呼：' + facts.myName + ' 和 ' + facts.taName);
    if (facts.dateStr) userParts.push('日期：' + facts.dateStr);
    if (facts.title) userParts.push('标题/事件：' + facts.title);
    if (facts.location) userParts.push('地点：' + facts.location);
    if (moodLabel) userParts.push('心情：' + moodLabel);
    if (facts.content) userParts.push('ta 写下的草稿：' + facts.content);
    else userParts.push('ta 没有写正文，请基于上面仅有的信息写，绝不能自己编造细节。');
    userParts.push('只输出正文。');

    if (configured()) {
      return callChat([
        { role: 'system', content: AI_SYSTEM },
        { role: 'user', content: userParts.join('\n') }
      ]).catch(function () { return fallbackWrite(facts, n, moodLabel); });
    }
    return Promise.resolve(fallbackWrite(facts, n, moodLabel));
  }

  function fallbackWrite(facts, n, moodLabel) {
    var lines = [];
    var who = (n.my ? n.my : '') + (n.my && n.ta ? '和' : '') + (n.ta ? n.ta : '你们');
    var hasTitle = !!facts.title, hasContent = !!facts.content, hasLoc = !!facts.location;

    if (hasTitle) {
      if (moodLabel) lines.push(facts.title + '那天，心里满满都是' + moodLabel + '。');
      else lines.push(facts.title + '的这一天，值得被好好记住。');
    }
    if (hasLoc) lines.push('在' + facts.location + '发生的这段回忆，就像一枚小小的书签，夹在你们的故事里。');
    if (hasContent) {
      lines.push('你说："' + facts.content.trim() + '"');
      lines.push('这些细节，都是日后想起来会笑的理由。');
    } else if (!hasTitle) {
      lines.push('这一天，' + who + '在一起。普通的日子，因为彼此变得值得记录。');
      if (moodLabel) lines.push('那是' + moodLabel + '的一天。');
    } else {
      if (moodLabel && !hasTitle) {}
      lines.push('愿往后翻到这一天时，还能想起当时的笑容。');
    }
    var text = lines.join('');
    return text.length > 140 ? text.slice(0, 140) : text;
  }

  /* ---------- 能力3：照片配文（3 种风格） ---------- */
  function captionForPhoto(facts) {
    facts = facts || {};
    var n = names();
    var seeds = [];
    if (facts.title) seeds.push('画面是关于' + facts.title);
    if (facts.location) seeds.push('在' + facts.location);
    if (facts.mood && OD.MOODS[facts.mood]) seeds.push('心情' + OD.MOODS[facts.mood].label);
    if (facts.content) seeds.push('ta 写：' + facts.content);
    var promptText = '根据照片场景生成3条配文（每行一条，前缀分别为【日常】【浪漫】【搞笑】），温柔不油腻，不编造细节。' + (seeds.length ? seeds.join('，') : '画面未知时请写通用留白风格的句子');

    function fallback() {
      return {
        daily: '镜头里藏着的，是舍不得忘掉的一天。',
        romantic: '有些瞬间不用说话，光看着就很好。',
        funny: '这张照片建议永久收藏，笑点全在细节里。'
      };
    }
    if (!configured()) return Promise.resolve(fallback());
    return callChat([
      { role: 'system', content: AI_SYSTEM },
      { role: 'user', content: promptText }
    ]).then(function (raw) {
      var out = { daily: '', romantic: '', funny: '' };
      var lines = raw.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        if (line.indexOf('日常') > -1) out.daily = line.replace(/^【?日常】?[:：]?\s*/, '');
        else if (line.indexOf('浪漫') > -1) out.romantic = line.replace(/^【?浪漫】?[:：]?\s*/, '');
        else if (line.indexOf('搞笑') > -1) out.funny = line.replace(/^【?搞笑】?[:：]?\s*/, '');
      }
      if (!out.daily || !out.romantic || !out.funny) throw new Error('parse');
      return out;
    }).catch(fallback);
  }

  /* ---------- 惊喜建议（模板为主，不诱导消费） ---------- */
  var SURPRISE_POOL = [
    '把你们在一起以来最想重看的一张照片洗出来，配一句话送TA。',
    '提前准备好一顿饭，关掉手机，只聊从认识到现在的事。',
    '写一张小纸条，列出三件TA让你开心的小事，藏进TA明天会打开的地方。',
    '约TA去第一次约会/第一次见面的地方，什么也不说，再走一遍。',
    '做一份"和你在一起的第N天"小清单：最常听的歌、最常去的地方、最想一起做的事。',
    '在纪念日前一天，把最近一段时间的聊天里最戳你的一句发给TA。',
    '挑一个天气好的傍晚，带上相机去拍一段"今天的我们"，一年后回放。',
    '买两张最近的电影票，故意晚到五分钟，像刚开始约会那样。'
  ];
  function surpriseIdeas(extra) {
    var list = SURPRISE_POOL.slice();
    if (extra && extra.title) {
      list.unshift('为「' + extra.title + '」准备一个小小的仪式感：一束花、一封信、一顿认真做的饭，都可以。');
    }
    // 洗牌取前 3
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list.slice(0, 3);
  }

  /* AI 状态文案 */
  function statusLabel() { return configured() ? '已接入' : '模板模式'; }

  global.AI = {
    writeMemory: writeMemory,
    captionForPhoto: captionForPhoto,
    surpriseIdeas: surpriseIdeas,
    configured: configured,
    statusLabel: statusLabel,
    names: names
  };
})(window);
