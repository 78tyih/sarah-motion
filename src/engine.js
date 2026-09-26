(function (global) {
  'use strict';

  var BEAT = 0.5;
  var TOTAL_BEATS = 40;
  var T = TOTAL_BEATS * BEAT;
  var b2s = function (b) { return b * BEAT; };

  var C = {
    canvas: '#F2F0ED',
    ink: '#0A0A0A',
    paper: '#FFFFFF',
    accent: '#4F8CFF',
    line: '#DCD7CE',
    mute: '#8A857E'
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function stepResp(t, t0, w, z) {
    if (t <= t0) return 0;
    var dt = t - t0;
    var wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
  }
  function decay(t, t0, w, z) {
    if (t <= t0) return 1;
    var dt = t - t0;
    var wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
    return Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
  }

  function Spring(v0) { this.v0 = v0; this.ch = []; }
  Spring.prototype.set = function (tb, target, w, z) {
    var prev = this.ch.length ? this.ch[this.ch.length - 1].target : this.v0;
    if (Math.abs(target - prev) < 1e-9) return;
    this.ch.push({ t: b2s(tb), a: target - prev, target: target, w: w || 14, z: z || 0.66 });
  };
  Spring.prototype.at = function (t) {
    var v = this.v0;
    for (var i = 0; i < this.ch.length; i++) {
      var c = this.ch[i];
      v += c.a * stepResp(t, c.t, c.w, c.z);
    }
    return v;
  };

  function Drag(v0) { this.v0 = v0; this.g = []; }
  Drag.prototype.grab = function (tb0, tb1, fn, snap, w, z) {
    this.g.push({ t0: b2s(tb0), t1: b2s(tb1), fn: fn, snap: snap, w: w || 15, z: z || 0.66 });
  };
  Drag.prototype.at = function (t) {
    var cur = this.v0;
    for (var i = 0; i < this.g.length; i++) {
      var g = this.g[i];
      if (t < g.t0) return cur;
      if (t < g.t1) return g.fn(t);
      cur = g.snap + (g.fn(g.t1) - g.snap) * decay(t, g.t1, g.w, g.z);
    }
    return cur;
  };

  var GEO = [
    { tb: 0, id: 'button', w: 400, h: 112, r: 56, fill: C.ink },
    { tb: 4, id: 'loader', w: 168, h: 168, r: 84, fill: C.ink },
    { tb: 8, id: 'check', w: 168, h: 168, r: 84, fill: C.ink },
    { tb: 12, id: 'player', w: 760, h: 192, r: 32, fill: C.ink },
    { tb: 16, id: 'progress', w: 880, h: 64, r: 32, fill: C.line },
    { tb: 20, id: 'slider', w: 560, h: 88, r: 44, fill: C.line },
    { tb: 24, id: 'toggle', w: 176, h: 104, r: 52, fill: C.line },
    { tb: 28, id: 'tabs', w: 520, h: 96, r: 48, fill: C.line },
    { tb: 32, id: 'chart', w: 880, h: 440, r: 28, fill: C.paper },
    { tb: 35.5, id: 'palette', w: 680, h: 360, r: 24, fill: C.paper },
    { tb: 38, id: 'notify', w: 560, h: 140, r: 28, fill: C.ink },
    { tb: 38.75, id: 'button', w: 400, h: 112, r: 56, fill: C.ink }
  ];

  var FILL_EVENTS = [
    { tb: 25, c: C.accent, w: 16, z: 0.66 },
    { tb: 26.5, c: C.line, w: 16, z: 0.66 }
  ];

  var WINDOWS = {
    button: [[0, 4], [38.75, 40]],
    loader: [[4, 8]],
    check: [[8, 12]],
    player: [[12, 16]],
    progress: [[16, 20]],
    slider: [[20, 24]],
    toggle: [[24, 28]],
    tabs: [[28, 32]],
    chart: [[32, 35.5]],
    palette: [[35.5, 38]],
    notify: [[38, 38.75]]
  };

  var PRESS = [
    [1.5, 2.25], [10.4, 10.7], [13.0, 13.25], [14.25, 14.5],
    [16.75, 19.25], [20.75, 22.5], [25.0, 25.3], [26.5, 26.8],
    [28.75, 29.0], [30.25, 30.5], [31.25, 31.5], [35.75, 36.0]
  ];

  var CURSOR_PATH = [
    { tb: 0, x: 0, y: 0 },
    { tb: 3.0, x: 330, y: -150 },
    { tb: 4.4, x: -300, y: 190 },
    { tb: 6.0, x: 280, y: -170 },
    { tb: 7.6, x: 0, y: 0 },
    { tb: 12.6, x: -262, y: 0 },
    { tb: 15.4, x: 0, y: 0 },
    { tb: 24.4, x: 0, y: 0 },
    { tb: 28.4, x: -173, y: 0 },
    { tb: 28.6, x: 0, y: 0 },
    { tb: 30.1, x: 173, y: 0 },
    { tb: 31.1, x: -173, y: 0 },
    { tb: 32.4, x: 150, y: -30 },
    { tb: 35.3, x: 0, y: -120 },
    { tb: 38.3, x: 0, y: 0 },
    { tb: 38.6, x: 0, y: 0, w: 16, z: 0.7 }
  ];

  var TAB_STOPS = [-173, 0, 173];
  var TAB_HITS = [
    { tb: 28.75, i: 1 },
    { tb: 30.25, i: 2 },
    { tb: 31.25, i: 0 }
  ];

  var CHART_DATA = [0.28, 0.42, 0.36, 0.55, 0.48, 0.68, 0.62, 0.82, 0.74, 0.95];
  var CH = { x0: 48, x1: 832, yTop: 120, yBot: 344 };

  var PALETTE_ROWS = ['Settings', 'Segments', 'Setup', 'Members', 'Export'];
  var PALETTE_MATCH = { '': [1, 1, 1, 1, 1], 's': [1, 1, 1, 0, 0], 'se': [1, 1, 1, 0, 0], 'set': [1, 0, 1, 0, 0] };
  var TYPE_KEYS = [
    { tb: 36.0, s: 's' },
    { tb: 36.75, s: 'se' },
    { tb: 37.5, s: 'set' }
  ];

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  function buildTimeline(opts) {
    var fit = opts.fitPx;
    var S = {
      w: new Spring(GEO[0].w), h: new Spring(GEO[0].h), r: new Spring(GEO[0].r),
      cr: new Spring(hexRGB(GEO[0].fill)[0]),
      cg: new Spring(hexRGB(GEO[0].fill)[1]),
      cb: new Spring(hexRGB(GEO[0].fill)[2]),
      cam: new Spring(fit / Math.max(GEO[0].w, GEO[0].h)),
      border: new Spring(0),
      cx: new Spring(0), cy: new Spring(0),
      press: new Spring(0),
      knob: new Spring(0),
      leadX: new Spring(-173), trailX: new Spring(-173),
      leadW: new Spring(160), trailW: new Spring(160),
      tone: new Spring(0)
    };

    for (var i = 1; i < GEO.length; i++) {
      var g = GEO[i];
      var last = (i === GEO.length - 1);
      var w = last ? 20 : 14, z = last ? 0.72 : 0.66;
      S.w.set(g.tb, g.w, w, z);
      S.h.set(g.tb, g.h, w, z);
      S.r.set(g.tb, g.r, w, z);
      S.cam.set(g.tb, fit / Math.max(g.w, g.h), last ? 20 : 11, last ? 0.72 : 0.7);
      S.border.set(g.tb, (g.id === 'chart' || g.id === 'palette') ? 1 : 0, w, z);
    }

    var colorEvents = [];
    for (i = 0; i < GEO.length; i++) {
      colorEvents.push({ tb: GEO[i].tb, c: GEO[i].fill, w: (i === GEO.length - 1 ? 20 : 14), z: (i === GEO.length - 1 ? 0.72 : 0.66) });
    }
    for (i = 0; i < FILL_EVENTS.length; i++) {
      colorEvents.push({ tb: FILL_EVENTS[i].tb, c: FILL_EVENTS[i].c, w: FILL_EVENTS[i].w, z: FILL_EVENTS[i].z });
    }
    colorEvents.sort(function (a, b) { return a.tb - b.tb; });
    for (i = 0; i < colorEvents.length; i++) {
      var ce = colorEvents[i], cc = hexRGB(ce.c);
      S.cr.set(ce.tb, cc[0], ce.w, ce.z);
      S.cg.set(ce.tb, cc[1], ce.w, ce.z);
      S.cb.set(ce.tb, cc[2], ce.w, ce.z);
    }

    for (i = 0; i < PRESS.length; i++) {
      S.press.set(PRESS[i][0], 1, 30, 0.8);
      S.press.set(PRESS[i][1], 0, 30, 0.8);
    }

    for (i = 0; i < CURSOR_PATH.length; i++) {
      var cp = CURSOR_PATH[i];
      S.cx.set(cp.tb, cp.x, cp.w || 13, cp.z || 0.68);
      S.cy.set(cp.tb, cp.y, cp.w || 13, cp.z || 0.68);
    }

    for (i = 0; i < TAB_HITS.length; i++) {
      var th = TAB_HITS[i];
      var x = TAB_STOPS[th.i];
      S.leadX.set(th.tb, x, 17, 0.6);
      S.trailX.set(th.tb, x, 13, 0.7);
    }

    S.knob.set(25.0, 1, 17, 0.6);
    S.knob.set(26.5, 0, 17, 0.6);

    var prog = new Drag(0.12);
    prog.grab(16.75, 19.25, function (t) {
      var p = (t - b2s(16.75)) / (b2s(19.25) - b2s(16.75));
      return lerp(0.12, 0.9, smooth(p));
    }, 0.86, 15, 0.62);

    var slid = new Drag(0.35);
    slid.grab(20.75, 22.5, function (t) {
      var p = (t - b2s(20.75)) / (b2s(22.5) - b2s(20.75));
      return lerp(0.35, 1.22, smooth(p));
    }, 1.0, 15, 0.6);

    S.prog = prog;
    S.slid = slid;
    return S;
  }

  var HTML = {
    button: '<div class="c-btn"><span>Continue</span></div>',
    loader: '<svg class="c-load" viewBox="0 0 168 168" width="168" height="168">' +
      '<circle cx="84" cy="84" r="66" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="9"/>' +
      '<g class="load-rot"><circle class="load-arc" cx="84" cy="84" r="66" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/></g></svg>',
    check: '<svg class="c-check" viewBox="0 0 168 168" width="168" height="168">' +
      '<path class="chk" d="M50 86 L74 110 L120 60" fill="none" stroke="#4F8CFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    player: '<div class="c-play">' +
      '<div class="pl-ico"><svg viewBox="0 0 48 48" width="48" height="48">' +
      '<g class="pl-pause"><rect x="12" y="9" width="8" height="30" rx="4" fill="#FFFFFF"/><rect x="28" y="9" width="8" height="30" rx="4" fill="#FFFFFF"/></g>' +
      '<g class="pl-play"><path d="M15 9 L41 24 L15 39 Z" fill="#FFFFFF"/></g></svg></div>' +
      '<div class="pl-mid"><div class="pl-title">Weightless</div>' +
      '<div class="pl-track"><div class="pl-fill"></div><div class="pl-dot"></div></div></div>' +
      '<div class="pl-time">1:24</div></div>',
    progress: '<div class="c-prog"><div class="pg-fill"></div><div class="pg-knob"></div></div>',
    slider: '<div class="c-slid"><div class="sl-fill"></div><div class="sl-knob"></div></div>',
    toggle: '<div class="c-tog"><div class="tg-knob"></div></div>',
    tabs: '<div class="c-tabs"><div class="tb-ind"></div><div class="tb-labels"><span>Day</span><span>Week</span><span>Month</span></div></div>',
    chart: '<div class="c-chart"><div class="ch-head"><span class="ch-title">Revenue</span><span class="ch-sub">10 weeks</span></div>' +
      '<svg class="ch-svg" viewBox="0 0 880 440" width="880" height="440">' +
      '<g class="ch-grid"></g><path class="ch-area" fill="rgba(79,140,255,0.10)"/>' +
      '<path class="ch-line" fill="none" stroke="#4F8CFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle class="ch-dot" r="9" fill="#0A0A0A"/></svg>' +
      '<div class="ch-tip"><span>+18.4%</span></div></div>',
    palette: '<div class="c-pal"><div class="pa-input"><span class="pa-text"></span><span class="pa-caret"></span><span class="pa-kbd">&#8984;K</span></div><div class="pa-list"></div></div>',
    notify: '<div class="c-notify"><svg viewBox="0 0 40 40" width="40" height="40">' +
      '<circle cx="20" cy="20" r="18" fill="#4F8CFF"/><path d="M12 20.5 L17.5 26 L28 15" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<div class="nt-body"><div class="nt-t">Saved</div><div class="nt-s">Settings updated</div></div></div>'
  };

  var CSS = [
    '.morph-frame{position:relative;overflow:hidden;background:' + C.canvas + ';font-family:Geist,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;font-feature-settings:"tnum" 1;}',
    '.morph-cam{position:absolute;left:50%;top:50%;transform-origin:50% 50%;}',
    '.morph-shape{position:absolute;left:0;top:0;transform-origin:50% 50%;box-sizing:border-box;}',
    '.morph-content{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;}',
    '.c-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:27px;font-weight:500;letter-spacing:-0.012em;}',
    '.c-load,.c-check{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}',
    '.c-play{position:absolute;inset:0;display:flex;align-items:center;padding:0 34px;gap:26px;}',
    '.pl-ico{width:48px;height:48px;flex:0 0 48px;position:relative;}',
    '.pl-ico svg{position:absolute;inset:0;}',
    '.pl-mid{flex:1;display:flex;flex-direction:column;gap:14px;}',
    '.pl-title{color:#fff;font-size:23px;font-weight:500;letter-spacing:-0.015em;}',
    '.pl-track{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,0.20);}',
    '.pl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:' + C.accent + ';}',
    '.pl-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.pl-time{color:rgba(255,255,255,0.62);font-size:19px;font-weight:400;letter-spacing:0;}',
    '.c-prog,.c-slid,.c-tog,.c-tabs{position:absolute;inset:0;}',
    '.pg-fill{position:absolute;left:0;top:0;bottom:0;border-radius:32px;background:' + C.accent + ';}',
    '.pg-knob{position:absolute;top:50%;width:48px;height:48px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.sl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:44px;background:' + C.accent + ';}',
    '.sl-knob{position:absolute;top:50%;width:72px;height:72px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.tg-knob{position:absolute;top:50%;height:80px;border-radius:40px;background:#fff;transform:translate(0,-50%);}',
    '.c-tabs{display:flex;align-items:center;}',
    '.tb-ind{position:absolute;top:8px;bottom:8px;border-radius:40px;background:' + C.accent + ';}',
    '.tb-labels{position:absolute;inset:0;display:flex;align-items:center;}',
    '.tb-labels span{flex:1;text-align:center;font-size:21px;font-weight:500;letter-spacing:-0.01em;color:' + C.ink + ';transition:none;}',
    '.c-chart{position:absolute;inset:0;}',
    '.ch-head{position:absolute;left:48px;top:40px;display:flex;align-items:baseline;gap:14px;}',
    '.ch-title{font-size:27px;font-weight:500;color:' + C.ink + ';letter-spacing:-0.02em;}',
    '.ch-sub{font-size:18px;color:' + C.mute + ';}',
    '.ch-svg{position:absolute;inset:0;}',
    '.ch-tip{position:absolute;background:' + C.ink + ';color:#fff;font-size:20px;font-weight:500;padding:10px 14px;border-radius:11px;transform:translate(-50%,-100%);white-space:nowrap;}',
    '.c-pal{position:absolute;inset:0;padding:24px 26px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box;}',
    '.pa-input{display:flex;align-items:center;gap:8px;height:64px;padding:0 18px;border-radius:14px;background:#F4F2EE;}',
    '.pa-text{font-size:23px;font-weight:500;color:' + C.ink + ';letter-spacing:-0.015em;}',
    '.pa-caret{width:2px;height:24px;background:' + C.accent + ';}',
    '.pa-kbd{margin-left:auto;font-size:16px;color:' + C.mute + ';border:1px solid rgba(10,10,10,0.12);border-radius:7px;padding:3px 8px;}',
    '.pa-list{position:relative;flex:1;}',
    '.pa-row{position:absolute;left:0;right:0;height:52px;display:flex;align-items:center;padding:0 18px;border-radius:12px;font-size:21px;font-weight:500;color:' + C.ink + ';letter-spacing:-0.012em;}',
    '.c-notify{position:absolute;inset:0;display:flex;align-items:center;gap:22px;padding:0 32px;}',
    '.nt-t{color:#fff;font-size:25px;font-weight:500;letter-spacing:-0.015em;}',
    '.nt-s{color:rgba(255,255,255,0.60);font-size:18px;margin-top:4px;}',
    '.morph-cursor{position:absolute;left:0;top:0;pointer-events:none;}'
  ].join('');

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function mount(root, opts) {
    opts = opts || {};
    var frame = opts.frame || 1440;
    var fitPx = opts.fitPx || (frame * 0.70);

    if (!document.getElementById('morph-engine-css')) {
      var st = document.createElement('style');
      st.id = 'morph-engine-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    root.className += (root.className ? ' ' : '') + 'morph-frame';
    root.style.width = frame + 'px';
    root.style.height = frame + 'px';

    var cam = el('div', 'morph-cam');
    var shape = el('div', 'morph-shape');
    cam.appendChild(shape);

    var refs = { root: root, cam: cam, shape: shape, c: {} };
    var ids = Object.keys(WINDOWS);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var node = el('div', 'morph-content c-' + id, HTML[id]);
      node.style.opacity = '0';
      shape.appendChild(node);
      refs.c[id] = { node: node };
    }

    var cur = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cur.setAttribute('class', 'morph-cursor');
    var cs = opts.cursorScale || (frame / 1440);
    cur.setAttribute('width', String(44 * cs));
    cur.setAttribute('height', String(44 * cs));
    cur.setAttribute('viewBox', '0 0 36 36');
    cur.innerHTML = '<path d="M4 2 L4 27 L9.6 21.2 L14.6 30.4 L19.4 28.2 L14.4 19 L23.5 19 Z" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="1.8" stroke-linejoin="round"/>';
    root.appendChild(cam);
    root.appendChild(cur);
    refs.cursor = cur;

    var r = refs.c;
    r.loader.arc = r.loader.node.querySelector('.load-arc');
    r.loader.rot = r.loader.node.querySelector('.load-rot');
    r.check.path = r.check.node.querySelector('.chk');
    var L = r.check.path.getTotalLength ? r.check.path.getTotalLength() : 100;
    r.check.len = L;
    r.check.path.setAttribute('stroke-dasharray', L + ' ' + L);

    r.player.pause = r.player.node.querySelector('.pl-pause');
    r.player.play = r.player.node.querySelector('.pl-play');
    r.player.fill = r.player.node.querySelector('.pl-fill');
    r.player.dot = r.player.node.querySelector('.pl-dot');

    r.progress.fill = r.progress.node.querySelector('.pg-fill');
    r.progress.knob = r.progress.node.querySelector('.pg-knob');
    r.slider.fill = r.slider.node.querySelector('.sl-fill');
    r.slider.knob = r.slider.node.querySelector('.sl-knob');
    r.toggle.knob = r.toggle.node.querySelector('.tg-knob');
    r.tabs.ind = r.tabs.node.querySelector('.tb-ind');
    r.tabs.labels = r.tabs.node.querySelectorAll('.tb-labels span');

    var g = r.chart.node.querySelector('.ch-grid');
    var gl = '';
    for (var k = 0; k < 4; k++) {
      var y = CH.yTop + k * ((CH.yBot - CH.yTop) / 3);
      gl += '<line x1="' + CH.x0 + '" y1="' + y + '" x2="' + CH.x1 + '" y2="' + y + '" stroke="rgba(10,10,10,0.08)" stroke-width="1.5" stroke-dasharray="3 7"/>';
    }
    g.innerHTML = gl;
    r.chart.line = r.chart.node.querySelector('.ch-line');
    r.chart.area = r.chart.node.querySelector('.ch-area');
    r.chart.dot = r.chart.node.querySelector('.ch-dot');
    r.chart.tip = r.chart.node.querySelector('.ch-tip');

    var pts = [];
    for (k = 0; k < CHART_DATA.length; k++) {
      pts.push([CH.x0 + k * ((CH.x1 - CH.x0) / (CHART_DATA.length - 1)), CH.yBot - CHART_DATA[k] * (CH.yBot - CH.yTop)]);
    }
    r.chart.pts = pts;
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    r.chart.line.setAttribute('d', d);
    r.chart.area.setAttribute('d', d + ' L' + CH.x1 + ' ' + CH.yBot + ' L' + CH.x0 + ' ' + CH.yBot + ' Z');
    var len = 0;
    for (k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    r.chart.len = len;
    r.chart.line.setAttribute('stroke-dasharray', len + ' ' + len);
    r.chart.hoverPt = pts[6];

    r.palette.text = r.palette.node.querySelector('.pa-text');
    r.palette.caret = r.palette.node.querySelector('.pa-caret');
    var list = r.palette.node.querySelector('.pa-list');
    r.palette.rows = [];
    for (k = 0; k < PALETTE_ROWS.length; k++) {
      var row = el('div', 'pa-row', PALETTE_ROWS[k]);
      row.style.top = (k * 56) + 'px';
      list.appendChild(row);
      r.palette.rows.push(row);
    }

    refs.S = buildTimeline({ fitPx: fitPx });
    refs.frame = frame;
    refs.cs = cs;
    refs.fitPx = fitPx;
    return refs;
  }

  function contentAlpha(t, id) {
    var ws = WINDOWS[id], a = 0;
    for (var i = 0; i < ws.length; i++) {
      var S = b2s(ws[i][0]), E = b2s(ws[i][1]);
      if (t < S - 1e-4 || t > E + 0.22) continue;
      var enter = S <= 1e-4 ? 1 : smooth((t - (S + 0.20)) / 0.25);
      var exit = 1 - smooth((t - E) / 0.20);
      a = Math.max(a, clamp01(Math.min(enter, exit)));
    }
    return a;
  }

  function setContent(node, a) {
    node.style.opacity = a.toFixed(3);
    if (a <= 0.001) { node.style.visibility = 'hidden'; return; }
    node.style.visibility = 'visible';
    var blur = (1 - a) * 13;
    node.style.filter = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
    node.style.transform = 'translateY(' + ((1 - a) * 9).toFixed(2) + 'px)';
  }

  function typedAt(t) {
    var s = '';
    for (var i = 0; i < TYPE_KEYS.length; i++) if (t >= b2s(TYPE_KEYS[i].tb)) s = TYPE_KEYS[i].s;
    return s;
  }

  function render(refs, t) {
    var S = refs.S, r = refs.c, shape = refs.shape;
    if (t < 0) t = 0;

    var sv = S.slid.at(t);
    var over = Math.max(0, sv - 1);
    var stretch = 1 + 0.34 * over;

    var w = S.w.at(t) * stretch;
    var h = S.h.at(t);
    var rad = S.r.at(t);
    var pr = clamp01(S.press.at(t));

    shape.style.width = w.toFixed(2) + 'px';
    shape.style.height = h.toFixed(2) + 'px';
    shape.style.borderRadius = rad.toFixed(2) + 'px';
    shape.style.background = 'rgb(' + Math.round(S.cr.at(t)) + ',' + Math.round(S.cg.at(t)) + ',' + Math.round(S.cb.at(t)) + ')';
    var ba = clamp01(S.border.at(t));
    shape.style.border = ba > 0.01 ? (1.5 / Math.max(0.2, S.cam.at(t))).toFixed(2) + 'px solid rgba(10,10,10,' + (0.09 * ba).toFixed(3) + ')' : '0px solid rgba(0,0,0,0)';
    shape.style.transform = 'translate(-50%,-50%) scale(' + (1 - 0.032 * pr).toFixed(4) + ')';

    var scale = S.cam.at(t);
    refs.cam.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(4) + ')';

    var ids = Object.keys(WINDOWS);
    for (var i = 0; i < ids.length; i++) setContent(r[ids[i]].node, contentAlpha(t, ids[i]));

    var ta = contentAlpha(t, 'loader');
    if (ta > 0.001) {
      var lp = clamp01((t - b2s(4)) / (b2s(7.6) - b2s(4)));
      var ang = lp * 1080;
      r.loader.rot.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' 84 84)');
      var sweep = 0.30 * Math.max(0, 1 - clamp01((t - b2s(7.2)) / 0.25));
      var circ = 2 * Math.PI * 66;
      r.loader.arc.setAttribute('stroke-dasharray', (circ * (0.22 + sweep)).toFixed(1) + ' ' + circ.toFixed(1));
    }

    var ca = contentAlpha(t, 'check');
    if (ca > 0.001) {
      var cp = smooth((t - b2s(8.5)) / (b2s(10.25) - b2s(8.5)));
      r.check.path.setAttribute('stroke-dashoffset', (r.check.len * (1 - cp)).toFixed(2));
    }

    var pa = contentAlpha(t, 'player');
    if (pa > 0.001) {
      var mp = smooth((t - b2s(13)) / 0.34) * (1 - smooth((t - b2s(14.25)) / 0.34));
      r.player.pause.setAttribute('opacity', mp.toFixed(3));
      r.player.play.setAttribute('opacity', (1 - mp).toFixed(3));
      r.player.pause.setAttribute('transform', 'rotate(' + (-70 * (1 - mp)).toFixed(1) + ' 24 24) scale(' + (0.7 + 0.3 * mp).toFixed(3) + ')');
      r.player.play.setAttribute('transform', 'rotate(' + (70 * mp).toFixed(1) + ' 24 24) scale(' + (0.7 + 0.3 * (1 - mp)).toFixed(3) + ')');
      var pvp = clamp01((t - b2s(12.8)) / 1.2);
      r.player.fill.style.width = (pvp * 100).toFixed(2) + '%';
      r.player.dot.style.left = (pvp * 100).toFixed(2) + '%';
    }

    var pv = S.prog.at(t);
    var pga = contentAlpha(t, 'progress');
    if (pga > 0.001) {
      var pp = 100 * 32 / 880;
      r.progress.fill.style.width = (Math.min(1, pv) * 100).toFixed(2) + '%';
      r.progress.knob.style.left = (pp + pv * (100 - 2 * pp)).toFixed(2) + '%';
      r.progress.knob.style.transform = 'translate(-50%,-50%) scale(' + (1 + 0.10 * pr).toFixed(3) + ')';
    }

    var sla = contentAlpha(t, 'slider');
    if (sla > 0.001) {
      var sp = 100 * 44 / 560;
      r.slider.fill.style.width = (Math.min(1, sv) * 100).toFixed(2) + '%';
      r.slider.knob.style.left = (sp + Math.min(sv, 1.25) * (100 - 2 * sp)).toFixed(2) + '%';
      r.slider.knob.style.transform = 'translate(-50%,-50%) scale(' + ((1 + 0.22 * over) * (1 + 0.08 * pr)).toFixed(3) + ',' + ((1 - 0.16 * over) * (1 + 0.08 * pr)).toFixed(3) + ')';
    }

    var tga = contentAlpha(t, 'toggle');
    if (tga > 0.001) {
      var kv = S.knob.at(t);
      var pad = 12, travel = 176 - 80 - pad * 2;
      var lx = 12 + kv * travel;
      r.toggle.knob.style.left = lx.toFixed(2) + 'px';
      r.toggle.knob.style.width = (80 + (1 - Math.abs(kv * 2 - 1)) * 14).toFixed(2) + 'px';
    }

    var tba = contentAlpha(t, 'tabs');
    if (tba > 0.001) {
      var lx2 = S.leadX.at(t), tx2 = S.trailX.at(t);
      var left = Math.min(lx2, tx2) + 260 - 78;
      var right = Math.max(lx2, tx2) + 260 + 78;
      r.tabs.ind.style.left = left.toFixed(2) + 'px';
      r.tabs.ind.style.width = (right - left).toFixed(2) + 'px';
      var act = 0;
      for (var q = 0; q < TAB_HITS.length; q++) if (t >= b2s(TAB_HITS[q].tb)) act = TAB_HITS[q].i;
      for (q = 0; q < r.tabs.labels.length; q++) r.tabs.labels[q].style.color = (q === act ? '#FFFFFF' : C.ink);
    }

    var cha = contentAlpha(t, 'chart');
    if (cha > 0.001) {
      var dp = smooth((t - b2s(32.5)) / (b2s(33.75) - b2s(32.5)));
      r.chart.line.setAttribute('stroke-dashoffset', (r.chart.len * (1 - dp)).toFixed(2));
      r.chart.area.setAttribute('opacity', smooth((t - b2s(33.4)) / 0.4).toFixed(3));
      var hp = r.chart.hoverPt;
      var hv = smooth((t - b2s(34.0)) / 0.22) * (1 - smooth((t - b2s(34.85)) / 0.2));
      r.chart.dot.setAttribute('cx', hp[0]);
      r.chart.dot.setAttribute('cy', hp[1]);
      r.chart.dot.setAttribute('opacity', (hv * dp).toFixed(3));
      r.chart.tip.style.left = hp[0] + 'px';
      r.chart.tip.style.top = (hp[1] - 18) + 'px';
      r.chart.tip.style.opacity = (hv * dp).toFixed(3);
      r.chart.tip.style.transform = 'translate(-50%,-100%) scale(' + (0.9 + 0.1 * hv).toFixed(3) + ')';
    }

    var pla = contentAlpha(t, 'palette');
    if (pla > 0.001) {
      var typed = typedAt(t);
      r.palette.text.textContent = typed;
      var focused = t >= b2s(35.75);
      r.palette.caret.style.opacity = focused ? (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3.2))).toFixed(2) : '0.35';
      var states = [{ t: -1, m: PALETTE_MATCH[''] }];
      for (var z2 = 0; z2 < TYPE_KEYS.length; z2++) states.push({ t: b2s(TYPE_KEYS[z2].tb), m: PALETTE_MATCH[TYPE_KEYS[z2].s] });
      var si = 0;
      while (si < states.length - 1 && t >= states[si + 1].t) si++;
      var yy = 0;
      for (var m = 0; m < r.palette.rows.length; m++) {
        var cur;
        if (si >= states.length - 1) cur = states[si].m[m];
        else {
          var span = states[si + 1].t - states[si].t;
          var pg2 = span > 0 ? smooth((t - states[si].t) / span) : 1;
          cur = lerp(states[si].m[m], states[si + 1].m[m], pg2);
        }
        var rowEl = r.palette.rows[m];
        rowEl.style.opacity = cur.toFixed(3);
        rowEl.style.top = (yy * 56).toFixed(1) + 'px';
        rowEl.style.transform = 'translateX(' + ((1 - cur) * 14).toFixed(1) + 'px)';
        yy += cur;
      }
      var sel = smooth((t - b2s(37.75)) / 0.22);
      r.palette.rows[0].style.background = 'rgba(79,140,255,' + (0.16 * sel).toFixed(3) + ')';
      r.palette.rows[0].style.color = sel > 0.5 ? C.accent : C.ink;
    }

    var cxp = S.cx.at(t), cyp = S.cy.at(t);
    var dragging = (t >= b2s(16.75) && t < b2s(19.25)) || (t >= b2s(20.75) && t < b2s(22.5));
    if (dragging) {
      if (t >= b2s(16.75) && t < b2s(19.25)) {
        cxp = -440 + pv * 880; cyp = 0;
      } else {
        cxp = -280 + Math.min(1.04, sv) * 560; cyp = 0;
      }
    }
    var sx = refs.frame / 2 + cxp * scale;
    var sy = refs.frame / 2 + cyp * scale;
    refs.cursor.style.transform = 'translate(' + (sx - 4 * refs.cs).toFixed(2) + 'px,' + (sy - 3 * refs.cs).toFixed(2) + 'px) scale(' + (1 - 0.14 * pr).toFixed(3) + ')';
    refs.cursor.style.opacity = opts_cursorOpacity(refs, t);
  }

  function opts_cursorOpacity(refs, t) { return '1'; }

  var CATALOG = [
    { key: 'button', name: 'Button', cn: '按钮', b0: 0, b1: 4 },
    { key: 'loader', name: 'Loader', cn: '加载器', b0: 4, b1: 8 },
    { key: 'check', name: 'Checkmark', cn: '勾选', b0: 8, b1: 12 },
    { key: 'player', name: 'Music player', cn: '播放器', b0: 12, b1: 16 },
    { key: 'progress', name: 'Progress', cn: '进度条', b0: 16, b1: 20 },
    { key: 'slider', name: 'Volume slider', cn: '音量滑块', b0: 20, b1: 24 },
    { key: 'toggle', name: 'Switch', cn: '开关', b0: 24, b1: 28 },
    { key: 'tabs', name: 'Liquid tabs', cn: '液体标签', b0: 28, b1: 32 },
    { key: 'chart', name: 'Chart', cn: '图表', b0: 32, b1: 35.5 },
    { key: 'palette', name: 'Command ⌘K', cn: '命令面板', b0: 35.5, b1: 38 },
    { key: 'notify', name: 'Notification', cn: '通知', b0: 38, b1: 38.75 }
  ];

  global.MorphEngine = {
    BEAT: BEAT, TOTAL: T, TOTAL_BEATS: TOTAL_BEATS, C: C,
    mount: mount, render: render, CATALOG: CATALOG, b2s: b2s
  };
})(typeof window !== 'undefined' ? window : this);
