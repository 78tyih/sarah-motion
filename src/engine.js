(function (global) {
  'use strict';

  var BEAT = 0.5;

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
    this.ch.push({ t: tb * BEAT, a: target - prev, target: target, w: w || 14, z: z || 0.66 });
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
    this.g.push({ t0: tb0 * BEAT, t1: tb1 * BEAT, fn: fn, snap: snap, w: w || 15, z: z || 0.66 });
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

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mixColor(a, b, k) {
    var x = hexRGB(a), y = hexRGB(b);
    return 'rgb(' + Math.round(lerp(x[0], y[0], k)) + ',' + Math.round(lerp(x[1], y[1], k)) + ',' + Math.round(lerp(x[2], y[2], k)) + ')';
  }

  var C = {
    canvas: '#F2F0ED', ink: '#0A0A0A', paper: '#FFFFFF',
    accent: '#4F8CFF', line: '#DCD7CE', mute: '#8A857E',
    up: '#30A46C', down: '#E5484D'
  };

  var CSS_BASE = [
    '.morph-frame{position:relative;overflow:hidden;background:' + C.canvas + ';font-family:Geist,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;font-feature-settings:"tnum" 1;}',
    '.morph-cam{position:absolute;left:50%;top:50%;transform-origin:50% 50%;}',
    '.morph-shape{position:absolute;left:0;top:0;transform-origin:50% 50%;box-sizing:border-box;}',
    '.morph-content{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;}',
    '.morph-cursor{position:absolute;left:0;top:0;pointer-events:none;}',
    '.c-load,.c-check{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}',
    '.c-prog,.c-slid,.c-tog,.c-tabs,.c-lev{position:absolute;inset:0;}'
  ];

  var BASIC_CSS = [
    '.c-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:27px;font-weight:500;letter-spacing:-0.012em;}',
    '.c-play{position:absolute;inset:0;display:flex;align-items:center;padding:0 34px;gap:26px;}',
    '.pl-ico{width:48px;height:48px;flex:0 0 48px;position:relative;}',
    '.pl-ico svg{position:absolute;inset:0;}',
    '.pl-mid{flex:1;display:flex;flex-direction:column;gap:14px;}',
    '.pl-title{color:#fff;font-size:23px;font-weight:500;letter-spacing:-0.015em;}',
    '.pl-track{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,0.20);}',
    '.pl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:' + C.accent + ';}',
    '.pl-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.pl-time{color:rgba(255,255,255,0.62);font-size:19px;}',
    '.pg-fill{position:absolute;left:0;top:0;bottom:0;border-radius:32px;background:' + C.accent + ';}',
    '.pg-knob{position:absolute;top:50%;width:48px;height:48px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.sl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:44px;background:' + C.accent + ';}',
    '.sl-knob{position:absolute;top:50%;width:72px;height:72px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.tg-knob{position:absolute;top:50%;height:80px;border-radius:40px;background:#fff;transform:translate(0,-50%);}',
    '.c-tabs{display:flex;align-items:center;}',
    '.tb-ind{position:absolute;top:8px;bottom:8px;border-radius:40px;background:' + C.accent + ';}',
    '.tb-labels{position:absolute;inset:0;display:flex;align-items:center;}',
    '.tb-labels span{flex:1;text-align:center;font-size:21px;font-weight:500;letter-spacing:-0.01em;color:' + C.ink + ';}',
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
    '.nt-s{color:rgba(255,255,255,0.60);font-size:18px;margin-top:4px;}'
  ].join('');

  var QUOTE_CSS = [
    '.c-quote{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 34px;}',
    '.q-l{display:flex;flex-direction:column;gap:2px;}',
    '.q-sym{font-size:15px;font-weight:500;color:rgba(255,255,255,0.55);letter-spacing:0.10em;}',
    '.q-px{font-size:34px;font-weight:500;color:#fff;letter-spacing:-0.02em;}',
    '.q-r{display:flex;flex-direction:column;align-items:flex-end;gap:2px;}',
    '.q-chg{font-size:22px;font-weight:500;letter-spacing:-0.01em;color:' + C.up + ';}',
    '.q-abs{font-size:16px;color:' + C.up + ';}',
    '.c-replay{position:absolute;inset:0;display:flex;align-items:center;padding:0 30px;gap:24px;}',
    '.rp-ico{width:46px;height:46px;flex:0 0 46px;position:relative;}',
    '.rp-ico svg{position:absolute;inset:0;}',
    '.rp-mid{flex:1;display:flex;flex-direction:column;gap:12px;}',
    '.rp-top{display:flex;align-items:baseline;justify-content:space-between;}',
    '.rp-sym{font-size:20px;font-weight:500;color:#fff;letter-spacing:0.02em;}',
    '.rp-time{font-size:17px;color:rgba(255,255,255,0.60);}',
    '.rp-spark{position:relative;height:48px;}',
    '.rp-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}',
    '.c-tl{position:absolute;inset:0;}',
    '.tl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:32px;background:' + C.accent + ';}',
    '.tl-knob{position:absolute;top:50%;width:48px;height:48px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.lv-fill{position:absolute;left:0;top:0;bottom:0;border-radius:44px;}',
    '.lv-cap{position:absolute;top:50%;right:0;width:26px;height:4px;border-radius:2px;background:rgba(10,10,10,0.22);transform:translateY(-50%);}',
    '.lv-knob{position:absolute;top:50%;width:72px;height:72px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}',
    '.c-tf{position:absolute;inset:0;display:flex;align-items:center;}',
    '.tf-ind{position:absolute;top:8px;bottom:8px;border-radius:40px;background:' + C.accent + ';}',
    '.tf-labels{position:absolute;inset:0;display:flex;align-items:center;}',
    '.tf-labels span{flex:1;text-align:center;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:' + C.ink + ';}',
    '.c-equity{position:absolute;inset:0;}',
    '.eq-head{position:absolute;left:64px;top:42px;display:flex;align-items:baseline;gap:14px;}',
    '.eq-title{font-size:26px;font-weight:500;color:' + C.ink + ';letter-spacing:-0.02em;}',
    '.eq-sub{font-size:17px;color:' + C.mute + ';}',
    '.eq-svg{position:absolute;inset:0;}',
    '.eq-tip{position:absolute;background:' + C.ink + ';color:#fff;font-size:19px;font-weight:500;padding:9px 13px;border-radius:11px;transform:translate(-50%,-100%);white-space:nowrap;}',
    '.c-search{position:absolute;inset:0;padding:20px 22px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;}',
    '.se-input{display:flex;align-items:center;gap:10px;height:64px;padding:0 18px;border-radius:14px;background:#F4F2EE;}',
    '.se-text{font-size:23px;font-weight:500;color:' + C.ink + ';letter-spacing:0.02em;}',
    '.se-caret{width:2px;height:24px;background:' + C.accent + ';}',
    '.se-kbd{margin-left:auto;font-size:16px;color:' + C.mute + ';border:1px solid rgba(10,10,10,0.12);border-radius:7px;padding:3px 8px;}',
    '.se-list{position:relative;flex:1;}',
    '.se-row{position:absolute;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-radius:12px;font-size:21px;font-weight:500;color:' + C.ink + ';letter-spacing:0.02em;}',
    '.se-row em{font-style:normal;font-size:17px;font-weight:400;color:' + C.mute + ';}'
  ].join('');

  var HTML_LOADER = '<svg class="c-load" viewBox="0 0 168 168" width="168" height="168">' +
    '<circle cx="84" cy="84" r="66" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="9"/>' +
    '<g class="load-rot"><circle class="load-arc" cx="84" cy="84" r="66" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/></g></svg>';

  function checkHTML(color) {
    return '<svg class="c-check" viewBox="0 0 168 168" width="168" height="168">' +
      '<path class="chk" d="M50 86 L74 110 L120 60" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  var PLAY_ICON = '<div class="rp-ico"><svg viewBox="0 0 48 48" width="48" height="48">' +
    '<g class="pl-pause"><rect x="12" y="9" width="8" height="30" rx="4" fill="#FFFFFF"/><rect x="28" y="9" width="8" height="30" rx="4" fill="#FFFFFF"/></g>' +
    '<g class="pl-play"><path d="M15 9 L41 24 L15 39 Z" fill="#FFFFFF"/></g></svg></div>';

  function glyphListBars(box, dashed) {
    var gl = '', k;
    for (k = 0; k < 4; k++) {
      var y = box.yTop + k * ((box.yBot - box.yTop) / 3);
      gl += '<line x1="' + box.x0 + '" y1="' + y + '" x2="' + box.x1 + '" y2="' + y + '" stroke="rgba(10,10,10,0.08)" stroke-width="1.5" stroke-dasharray="3 7"/>';
    }
    return gl;
  }

  function linePoints(data, box) {
    var pts = [];
    for (var k = 0; k < data.length; k++) {
      pts.push([box.x0 + k * ((box.x1 - box.x0) / (data.length - 1)), box.yBot - data[k] * (box.yBot - box.yTop)]);
    }
    return pts;
  }
  function pathOf(pts) {
    return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
  }
  function polyLen(pts) {
    var len = 0;
    for (var k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    return len;
  }

  function makeEngine(SPEC) {
    var TOTAL_BEATS = SPEC.totalBeats;
    var T = TOTAL_BEATS * BEAT;
    var CSS = CSS_BASE.concat(SPEC.css).join('');
    var GEO = SPEC.geo, WINDOWS = SPEC.windows;

    function buildTimeline(fitPx) {
      var S = {
        w: new Spring(GEO[0].w), h: new Spring(GEO[0].h), r: new Spring(GEO[0].r),
        cr: new Spring(hexRGB(GEO[0].fill)[0]),
        cg: new Spring(hexRGB(GEO[0].fill)[1]),
        cb: new Spring(hexRGB(GEO[0].fill)[2]),
        cam: new Spring(fitPx / Math.max(GEO[0].w, GEO[0].h)),
        border: new Spring(0),
        cx: new Spring(SPEC.cursorPath[0].x),
        cy: new Spring(SPEC.cursorPath[0].y),
        press: new Spring(0)
      };
      var i;
      for (i = 1; i < GEO.length; i++) {
        var g = GEO[i];
        var fast = (i >= GEO.length - 2);
        var w = fast ? 24 : 14, z = fast ? 0.85 : 0.66;
        S.w.set(g.tb, g.w, w, z);
        S.h.set(g.tb, g.h, w, z);
        S.r.set(g.tb, g.r, w, z);
        S.cam.set(g.tb, fitPx / Math.max(g.w, g.h), fast ? 24 : 11, fast ? 0.85 : 0.7);
        S.border.set(g.tb, g.border ? 1 : 0, w, z);
      }
      var colorEvents = [];
      for (i = 0; i < GEO.length; i++) {
        colorEvents.push({ tb: GEO[i].tb, c: GEO[i].fill, w: (i >= GEO.length - 2 ? 24 : 14), z: (i >= GEO.length - 2 ? 0.85 : 0.66) });
      }
      for (i = 0; i < SPEC.fillEvents.length; i++) colorEvents.push(SPEC.fillEvents[i]);
      colorEvents.sort(function (a, b) { return a.tb - b.tb; });
      for (i = 0; i < colorEvents.length; i++) {
        var ce = colorEvents[i], c2 = hexRGB(ce.c);
        S.cr.set(ce.tb, c2[0], ce.w, ce.z);
        S.cg.set(ce.tb, c2[1], ce.w, ce.z);
        S.cb.set(ce.tb, c2[2], ce.w, ce.z);
      }
      for (i = 0; i < SPEC.press.length; i++) {
        S.press.set(SPEC.press[i][0], 1, 30, 0.8);
        S.press.set(SPEC.press[i][1], 0, 30, 0.8);
      }
      for (i = 0; i < SPEC.cursorPath.length; i++) {
        var cp = SPEC.cursorPath[i];
        S.cx.set(cp.tb, cp.x, cp.w || 13, cp.z || 0.68);
        S.cy.set(cp.tb, cp.y, cp.w || 13, cp.z || 0.68);
      }
      SPEC.extra(S);
      return S;
    }

    function el(tag, cls, html) {
      var d = document.createElement(tag);
      if (cls) d.className = cls;
      if (html != null) d.innerHTML = html;
      return d;
    }

    function contentAlpha(t, id) {
      var ws = WINDOWS[id], a = 0;
      for (var i = 0; i < ws.length; i++) {
        var S0 = ws[i][0] * BEAT, E0 = ws[i][1] * BEAT;
        if (t < S0 - 1e-4 || t > E0 + 0.22) continue;
        var enter = S0 <= 1e-4 ? 1 : smooth((t - (S0 + 0.20)) / 0.25);
        var exit = 1 - smooth((t - E0) / 0.20);
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

    function mount(root, opts) {
      opts = opts || {};
      var frame = opts.frame || 1440;
      var fitPx = opts.fitPx || Math.round(frame * SPEC.fit);

      var sid = 'morph-engine-css-' + SPEC.id;
      if (!document.getElementById(sid)) {
        var st = document.createElement('style');
        st.id = sid;
        st.textContent = CSS;
        document.head.appendChild(st);
      }

      root.className += (root.className ? ' ' : '') + 'morph-frame';
      root.style.width = frame + 'px';
      root.style.height = frame + 'px';

      var cam = el('div', 'morph-cam');
      var shape = el('div', 'morph-shape');
      cam.appendChild(shape);

      var refs = { root: root, cam: cam, shape: shape, c: {}, frame: frame, fitPx: fitPx, spec: SPEC };
      var ids = Object.keys(WINDOWS);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var node = el('div', 'morph-content c-' + id, SPEC.html[id]);
        node.style.opacity = '0';
        shape.appendChild(node);
        refs.c[id] = { node: node };
      }

      var cs = opts.cursorScale || (frame / 1440);
      var cur = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      cur.setAttribute('class', 'morph-cursor');
      cur.setAttribute('width', String(44 * cs));
      cur.setAttribute('height', String(44 * cs));
      cur.setAttribute('viewBox', '0 0 36 36');
      cur.innerHTML = '<path d="M4 2 L4 27 L9.6 21.2 L14.6 30.4 L19.4 28.2 L14.4 19 L23.5 19 Z" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="1.8" stroke-linejoin="round"/>';
      root.appendChild(cam);
      root.appendChild(cur);
      refs.cursor = cur;
      refs.cs = cs;

      refs.S = buildTimeline(fitPx);
      try { root.__morphS = refs.S; root.__morphSpec = SPEC.id; } catch (e) {}
      SPEC.prepare(refs);
      return refs;
    }

    function render(refs, t) {
      var S = refs.S, r = refs.c, shape = refs.shape;
      if (t < 0) t = 0;
      var vals = SPEC.vals(t, S);
      var over = vals.over || 0;
      var stretch = 1 + (SPEC.stretchGain || 0) * over;

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

      var scale = S.cam.at(t) * (1 - (SPEC.camFallback || 0) * over);
      refs.cam.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(4) + ')';

      var ids = Object.keys(WINDOWS), alpha = {};
      for (var i = 0; i < ids.length; i++) {
        alpha[ids[i]] = contentAlpha(t, ids[i]);
        setContent(r[ids[i]].node, alpha[ids[i]]);
      }

      SPEC.draw(refs, t, S, vals, alpha, pr);

      var cpos = SPEC.cursor(t, S, vals);
      var cxp = cpos ? cpos.x : S.cx.at(t);
      var cyp = cpos ? cpos.y : S.cy.at(t);
      var sx = refs.frame / 2 + cxp * scale;
      var sy = refs.frame / 2 + cyp * scale;
      refs.cursor.style.transform = 'translate(' + (sx - 4 * refs.cs).toFixed(2) + 'px,' + (sy - 3 * refs.cs).toFixed(2) + 'px) scale(' + (1 - 0.14 * pr).toFixed(3) + ')';
    }

    return { mount: mount, render: render, CATALOG: SPEC.catalog, BEAT: BEAT, TOTAL: T, spec: SPEC, fitRatio: SPEC.fit };
  }

  // ========================================================================
  // SPEC: basic — 通用 UI 动效
  // ========================================================================
  var BASIC_SPEC = {
    id: 'basic',
    palette: C,
    fit: 0.70,
    totalBeats: 40,
    css: [BASIC_CSS],
    stretchGain: 0.34,

    geo: [
      { tb: 0, id: 'button', w: 400, h: 112, r: 56, fill: C.ink },
      { tb: 4, id: 'loader', w: 168, h: 168, r: 84, fill: C.ink },
      { tb: 8, id: 'check', w: 168, h: 168, r: 84, fill: C.ink },
      { tb: 12, id: 'player', w: 760, h: 192, r: 32, fill: C.ink },
      { tb: 16, id: 'progress', w: 880, h: 64, r: 32, fill: C.line },
      { tb: 20, id: 'slider', w: 560, h: 88, r: 44, fill: C.line },
      { tb: 24, id: 'toggle', w: 176, h: 104, r: 52, fill: C.line },
      { tb: 28, id: 'tabs', w: 520, h: 96, r: 48, fill: C.line },
      { tb: 32, id: 'chart', w: 880, h: 440, r: 28, fill: C.paper, border: 1 },
      { tb: 35.5, id: 'palette', w: 680, h: 360, r: 24, fill: C.paper, border: 1 },
      { tb: 38, id: 'notify', w: 560, h: 140, r: 28, fill: C.ink },
      { tb: 38.75, id: 'button', w: 400, h: 112, r: 56, fill: C.ink }
    ],
    fillEvents: [
      { tb: 25, c: C.accent, w: 16, z: 0.66 },
      { tb: 26.5, c: C.line, w: 16, z: 0.66 }
    ],
    windows: {
      button: [[0, 4], [38.75, 40]],
      loader: [[4, 8]], check: [[8, 12]], player: [[12, 16]], progress: [[16, 20]],
      slider: [[20, 24]], toggle: [[24, 28]], tabs: [[28, 32]], chart: [[32, 35.5]],
      palette: [[35.5, 38]], notify: [[38, 38.75]]
    },
    press: [
      [1.5, 2.25], [10.4, 10.7], [13.0, 13.25], [14.25, 14.5],
      [16.75, 19.25], [20.75, 22.5], [25.0, 25.3], [26.5, 26.8],
      [28.75, 29.0], [30.25, 30.5], [31.25, 31.5], [35.75, 36.0]
    ],
    cursorPath: [
      { tb: 0, x: 0, y: 0 }, { tb: 3.0, x: 330, y: -150 }, { tb: 4.4, x: -300, y: 190 },
      { tb: 6.0, x: 280, y: -170 }, { tb: 7.6, x: 0, y: 0 }, { tb: 12.6, x: -262, y: 0 },
      { tb: 15.4, x: 0, y: 0 }, { tb: 24.4, x: 0, y: 0 }, { tb: 28.4, x: -173, y: 0 },
      { tb: 28.6, x: 0, y: 0 }, { tb: 30.1, x: 173, y: 0 }, { tb: 31.1, x: -173, y: 0 },
      { tb: 32.4, x: 150, y: -30 }, { tb: 35.3, x: 0, y: -120 }, { tb: 38.3, x: 0, y: 0, w: 22, z: 0.85 },
      { tb: 38.6, x: 0, y: 0, w: 22, z: 0.85 }
    ],
    tabStops: [-173, 0, 173],
    tabHits: [[28.75, 1], [30.25, 2], [31.25, 0]],
    knobTargets: [[25.0, 1, 17, 0.6], [26.5, 0, 17, 0.6]],

    html: {
      button: '<div class="c-btn"><span>Continue</span></div>',
      loader: HTML_LOADER,
      check: checkHTML(C.accent),
      player: '<div class="c-play"><div class="pl-ico"><svg viewBox="0 0 48 48" width="48" height="48">' +
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
        '<svg class="ch-svg" viewBox="0 0 880 440" width="880" height="440"><g class="ch-grid"></g>' +
        '<path class="ch-area" fill="rgba(79,140,255,0.10)"/>' +
        '<path class="ch-line" fill="none" stroke="' + C.accent + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle class="ch-dot" r="9" fill="#0A0A0A"/></svg>' +
        '<div class="ch-tip">+18.4%</div></div>',
      palette: '<div class="c-pal"><div class="pa-input"><span class="pa-text"></span><span class="pa-caret"></span><span class="pa-kbd">&#8984;K</span></div><div class="pa-list"></div></div>',
      notify: '<div class="c-notify"><svg viewBox="0 0 40 40" width="40" height="40">' +
        '<circle cx="20" cy="20" r="18" fill="' + C.accent + '"/><path d="M12 20.5 L17.5 26 L28 15" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<div class="nt-body"><div class="nt-t">Saved</div><div class="nt-s">Settings updated</div></div></div>'
    },

    strings: {
      rows: ['Settings', 'Segments', 'Setup', 'Members', 'Export'],
      match: { '': [1, 1, 1, 1, 1], 's': [1, 1, 1, 0, 0], 'se': [1, 1, 1, 0, 0], 'set': [1, 0, 1, 0, 0] },
      keys: [{ tb: 36.0, s: 's' }, { tb: 36.75, s: 'se' }, { tb: 37.5, s: 'set' }],
      data: [0.28, 0.42, 0.36, 0.55, 0.48, 0.68, 0.62, 0.82, 0.74, 0.95],
      box: { x0: 48, x1: 832, yTop: 120, yBot: 344 }
    },

    extra: function (S) {
      S.knob = new Spring(0);
      S.leadX = new Spring(BASIC_SPEC.tabStops[0]);
      S.trailX = new Spring(BASIC_SPEC.tabStops[0]);
      var i;
      for (i = 0; i < BASIC_SPEC.knobTargets.length; i++) {
        var kt = BASIC_SPEC.knobTargets[i];
        S.knob.set(kt[0], kt[1], kt[2], kt[3]);
      }
      for (i = 0; i < BASIC_SPEC.tabHits.length; i++) {
        var h = BASIC_SPEC.tabHits[i];
        S.leadX.set(h[0], BASIC_SPEC.tabStops[h[1]], 17, 0.6);
        S.trailX.set(h[0], BASIC_SPEC.tabStops[h[1]], 13, 0.7);
      }
      S.prog = new Drag(0.12);
      S.prog.grab(16.75, 19.25, function (t) {
        return lerp(0.12, 0.9, smooth((t - 8.375) / 1.25));
      }, 0.86, 15, 0.62);
      S.slid = new Drag(0.35);
      S.slid.grab(20.75, 22.5, function (t) {
        return lerp(0.35, 1.22, smooth((t - 10.375) / 0.875));
      }, 1.0, 15, 0.6);
    },

    prepare: function (refs) {
      var r = refs.c, ST = BASIC_SPEC.strings, k;
      r.loader.arc = r.loader.node.querySelector('.load-arc');
      r.loader.rot = r.loader.node.querySelector('.load-rot');
      r.check.path = r.check.node.querySelector('.chk');
      r.check.len = r.check.path.getTotalLength ? r.check.path.getTotalLength() : 100;
      r.check.path.setAttribute('stroke-dasharray', r.check.len + ' ' + r.check.len);
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
      r.chart.node.querySelector('.ch-grid').innerHTML = glyphListBars(ST.box);
      r.chart.line = r.chart.node.querySelector('.ch-line');
      r.chart.area = r.chart.node.querySelector('.ch-area');
      r.chart.dot = r.chart.node.querySelector('.ch-dot');
      r.chart.tip = r.chart.node.querySelector('.ch-tip');
      var pts = linePoints(ST.data, ST.box);
      r.chart.pts = pts;
      r.chart.line.setAttribute('d', pathOf(pts));
      r.chart.area.setAttribute('d', pathOf(pts) + ' L' + ST.box.x1 + ' ' + ST.box.yBot + ' L' + ST.box.x0 + ' ' + ST.box.yBot + ' Z');
      r.chart.len = polyLen(pts);
      r.chart.line.setAttribute('stroke-dasharray', r.chart.len + ' ' + r.chart.len);
      r.chart.hover = pts[6];
      r.palette.text = r.palette.node.querySelector('.pa-text');
      r.palette.caret = r.palette.node.querySelector('.pa-caret');
      var list = r.palette.node.querySelector('.pa-list');
      r.palette.rows = [];
      for (k = 0; k < ST.rows.length; k++) {
        var row = document.createElement('div');
        row.className = 'pa-row';
        row.textContent = ST.rows[k];
        row.style.top = (k * 56) + 'px';
        list.appendChild(row);
        r.palette.rows.push(row);
      }
    },

    vals: function (t, S) {
      var sv = S.slid.at(t);
      return { prog: S.prog.at(t), slid: sv, over: Math.max(0, sv - 1) };
    },

    draw: function (refs, t, S, V, A, pr) {
      var r = refs.c, i, ST = BASIC_SPEC.strings;

      if (A.loader > 0.001) {
        var lp = clamp01((t - 2.0) / 1.8);
        r.loader.rot.setAttribute('transform', 'rotate(' + (lp * 1080).toFixed(2) + ' 84 84)');
        var circ = 2 * Math.PI * 66;
        var sweep = 0.30 * Math.max(0, 1 - clamp01((t - 3.6) / 0.25));
        r.loader.arc.setAttribute('stroke-dasharray', (circ * (0.22 + sweep)).toFixed(1) + ' ' + circ.toFixed(1));
      }
      if (A.check > 0.001) {
        var cp = smooth((t - 4.25) / 0.875);
        r.check.path.setAttribute('stroke-dashoffset', (r.check.len * (1 - cp)).toFixed(2));
      }
      if (A.player > 0.001) {
        var mp = smooth((t - 6.5) / 0.34) * (1 - smooth((t - 7.125) / 0.34));
        r.player.pause.setAttribute('opacity', mp.toFixed(3));
        r.player.play.setAttribute('opacity', (1 - mp).toFixed(3));
        r.player.pause.setAttribute('transform', 'rotate(' + (-70 * (1 - mp)).toFixed(1) + ' 24 24) scale(' + (0.7 + 0.3 * mp).toFixed(3) + ')');
        r.player.play.setAttribute('transform', 'rotate(' + (70 * mp).toFixed(1) + ' 24 24) scale(' + (0.7 + 0.3 * (1 - mp)).toFixed(3) + ')');
        var pvp = clamp01((t - 6.4) / 1.2);
        r.player.fill.style.width = (pvp * 100).toFixed(2) + '%';
        r.player.dot.style.left = (pvp * 100).toFixed(2) + '%';
      }
      if (A.progress > 0.001) {
        var pp = 100 * 32 / 880;
        r.progress.fill.style.width = (Math.min(1, V.prog) * 100).toFixed(2) + '%';
        r.progress.knob.style.left = (pp + V.prog * (100 - 2 * pp)).toFixed(2) + '%';
        r.progress.knob.style.transform = 'translate(-50%,-50%) scale(' + (1 + 0.10 * pr).toFixed(3) + ')';
      }
      if (A.slider > 0.001) {
        var sp = 100 * 44 / 560;
        r.slider.fill.style.width = (Math.min(1, V.slid) * 100).toFixed(2) + '%';
        r.slider.knob.style.left = (sp + Math.min(V.slid, 1.25) * (100 - 2 * sp)).toFixed(2) + '%';
        r.slider.knob.style.transform = 'translate(-50%,-50%) scale(' + ((1 + 0.22 * V.over) * (1 + 0.08 * pr)).toFixed(3) + ',' + ((1 - 0.16 * V.over) * (1 + 0.08 * pr)).toFixed(3) + ')';
      }
      if (A.toggle > 0.001) {
        var kv = S.knob.at(t), travel = 176 - 80 - 24;
        r.toggle.knob.style.left = (12 + kv * travel).toFixed(2) + 'px';
        r.toggle.knob.style.width = (80 + (1 - Math.abs(kv * 2 - 1)) * 14).toFixed(2) + 'px';
      }
      if (A.tabs > 0.001) {
        var lx = S.leadX.at(t), tx = S.trailX.at(t);
        r.tabs.ind.style.left = (Math.min(lx, tx) + 260 - 78).toFixed(2) + 'px';
        r.tabs.ind.style.width = (Math.abs(lx - tx) + 156).toFixed(2) + 'px';
        var act = 0;
        for (i = 0; i < BASIC_SPEC.tabHits.length; i++) if (t >= BASIC_SPEC.tabHits[i][0] * BEAT) act = BASIC_SPEC.tabHits[i][1];
        for (i = 0; i < r.tabs.labels.length; i++) r.tabs.labels[i].style.color = (i === act ? '#FFFFFF' : C.ink);
      }
      if (A.chart > 0.001) {
        var dp = smooth((t - 16.25) / 0.625);
        r.chart.line.setAttribute('stroke-dashoffset', (r.chart.len * (1 - dp)).toFixed(2));
        r.chart.area.setAttribute('opacity', smooth((t - 16.7) / 0.4).toFixed(3));
        var hp = r.chart.hover;
        var hv = smooth((t - 17.0) / 0.22) * (1 - smooth((t - 17.425) / 0.2));
        r.chart.dot.setAttribute('cx', hp[0]);
        r.chart.dot.setAttribute('cy', hp[1]);
        r.chart.dot.setAttribute('opacity', (hv * dp).toFixed(3));
        r.chart.tip.style.left = hp[0] + 'px';
        r.chart.tip.style.top = (hp[1] - 18) + 'px';
        r.chart.tip.style.opacity = (hv * dp).toFixed(3);
        r.chart.tip.style.transform = 'translate(-50%,-100%) scale(' + (0.9 + 0.1 * hv).toFixed(3) + ')';
      }
      if (A.palette > 0.001) {
        var typed = '';
        for (i = 0; i < ST.keys.length; i++) if (t >= ST.keys[i].tb * BEAT) typed = ST.keys[i].s;
        r.palette.text.textContent = typed;
        var focused = t >= 17.875;
        r.palette.caret.style.opacity = focused ? (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3.2))).toFixed(2) : '0.35';
        var states = [{ t: -1, m: ST.match[''] }];
        for (i = 0; i < ST.keys.length; i++) states.push({ t: ST.keys[i].tb * BEAT, m: ST.match[ST.keys[i].s] });
        var si = 0;
        while (si < states.length - 1 && t >= states[si + 1].t) si++;
        var yy = 0;
        for (i = 0; i < r.palette.rows.length; i++) {
          var cur;
          if (si >= states.length - 1) cur = states[si].m[i];
          else {
            var span = states[si + 1].t - states[si].t;
            var pg2 = span > 0 ? smooth((t - states[si].t) / span) : 1;
            cur = lerp(states[si].m[i], states[si + 1].m[i], pg2);
          }
          var re = r.palette.rows[i];
          re.style.opacity = cur.toFixed(3);
          re.style.top = (yy * 56).toFixed(1) + 'px';
          re.style.transform = 'translateX(' + ((1 - cur) * 14).toFixed(1) + 'px)';
          yy += cur;
        }
        var sel = smooth((t - 18.875) / 0.22);
        r.palette.rows[0].style.background = 'rgba(79,140,255,' + (0.16 * sel).toFixed(3) + ')';
        r.palette.rows[0].style.color = sel > 0.5 ? C.accent : C.ink;
      }
    },

    cursor: function (t, S, V) {
      if (t >= 8.375 && t < 9.625) return { x: -440 + V.prog * 880, y: 0 };
      if (t >= 10.375 && t < 11.25) return { x: -280 + Math.min(1.04, V.slid) * 560, y: 0 };
      return null;
    },

    catalog: [
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
    ]
  };

  // ========================================================================
  // SPEC: quote — 金融展示页
  // 配色纪律：蓝 = 中性/操作，绿 = 涨/盈利，红 = 跌/风险过载
  // ========================================================================
  var QS = {
    equity: [0.30, 0.38, 0.34, 0.46, 0.58, 0.52, 0.44, 0.40, 0.55, 0.68, 0.76, 0.88],
    peak: 4, trough: 7,
    box: { x0: 64, x1: 816, yTop: 112, yBot: 358 },
    rows: [['NVDA', 'NVIDIA'], ['NVDL', '2× NVDA'], ['NVCR', 'Novocure'], ['AMD', 'Adv Micro'], ['MSFT', 'Microsoft']],
    match: { '': [1, 1, 1, 1, 1], 'n': [1, 1, 1, 0, 0], 'nv': [1, 1, 1, 0, 0], 'nvd': [1, 1, 0, 0, 0] },
    keys: [{ tb: 36.0, s: 'n' }, { tb: 36.75, s: 'nv' }, { tb: 37.5, s: 'nvd' }],
    spark: [0.35, 0.30, 0.44, 0.40, 0.55, 0.50, 0.62, 0.58, 0.72, 0.68, 0.82, 0.78, 0.90]
  };

  var QUOTE_SPEC = {
    id: 'quote',
    palette: C,
    fit: 0.70,
    totalBeats: 40,
    css: [QUOTE_CSS],
    stretchGain: 0.30,
    camFallback: 0.30,

    geo: [
      { tb: 0, id: 'quote', w: 440, h: 120, r: 60, fill: C.ink },
      { tb: 4, id: 'feed', w: 168, h: 168, r: 84, fill: C.ink },
      { tb: 8, id: 'fill', w: 168, h: 168, r: 84, fill: C.ink },
      { tb: 12, id: 'replay', w: 760, h: 192, r: 32, fill: C.ink },
      { tb: 16, id: 'timeline', w: 880, h: 64, r: 32, fill: C.line },
      { tb: 20, id: 'leverage', w: 560, h: 88, r: 44, fill: C.line },
      { tb: 24, id: 'mode', w: 176, h: 104, r: 52, fill: C.line },
      { tb: 28, id: 'timeframe', w: 520, h: 96, r: 48, fill: C.line },
      { tb: 32, id: 'equity', w: 880, h: 440, r: 28, fill: C.paper, border: 1 },
      { tb: 35.5, id: 'search', w: 680, h: 404, r: 24, fill: C.paper, border: 1 },
      { tb: 38, id: 'notify', w: 560, h: 140, r: 28, fill: C.ink },
      { tb: 38.75, id: 'quote', w: 440, h: 120, r: 60, fill: C.ink }
    ],
    fillEvents: [
      { tb: 25, c: C.accent, w: 16, z: 0.66 },
      { tb: 26.5, c: C.line, w: 16, z: 0.66 }
    ],
    windows: {
      quote: [[0, 4], [38.75, 40]],
      feed: [[4, 8]], fill: [[8, 12]], replay: [[12, 16]], timeline: [[16, 20]],
      leverage: [[20, 24]], mode: [[24, 28]], timeframe: [[28, 32]], equity: [[32, 35.5]],
      search: [[35.5, 38]], notify: [[38, 38.75]]
    },
    press: [
      [1.5, 2.25], [10.4, 10.7], [13.0, 13.25], [14.25, 14.5],
      [16.75, 19.25], [20.75, 22.5], [25.0, 25.3], [26.5, 26.8],
      [28.75, 29.0], [30.25, 30.5], [31.25, 31.5], [35.75, 36.0]
    ],
    cursorPath: [
      { tb: 0, x: 0, y: 0 }, { tb: 3.0, x: 340, y: -150 }, { tb: 4.4, x: -300, y: 190 },
      { tb: 6.0, x: 280, y: -170 }, { tb: 7.6, x: 0, y: 0 }, { tb: 12.6, x: -286, y: 0 },
      { tb: 15.4, x: 0, y: 0 }, { tb: 24.4, x: 0, y: 0 }, { tb: 28.4, x: -195, y: 0 },
      { tb: 28.6, x: -65, y: 0 }, { tb: 30.1, x: 65, y: 0 }, { tb: 31.1, x: 195, y: 0 },
      { tb: 32.4, x: 150, y: -40 }, { tb: 35.3, x: 0, y: -120 }, { tb: 38.3, x: 0, y: 0, w: 22, z: 0.85 },
      { tb: 38.6, x: 0, y: 0, w: 22, z: 0.85 }
    ],
    tabStops: [-195, -65, 65, 195],
    tabHits: [[28.75, 1], [30.25, 2], [31.25, 3]],
    knobTargets: [[25.0, 1, 17, 0.6], [26.5, 0, 17, 0.6]],

    html: {
      quote: '<div class="c-quote"><div class="q-l"><div class="q-sym">NVDA</div><div class="q-px">184.32</div></div>' +
        '<div class="q-r"><div class="q-chg">+2.41%</div><div class="q-abs">+4.34</div></div></div>',
      feed: HTML_LOADER,
      fill: checkHTML(C.accent),
      replay: '<div class="c-replay">' + PLAY_ICON +
        '<div class="rp-mid"><div class="rp-top"><span class="rp-sym">NVDA</span><span class="rp-time">09:47</span></div>' +
        '<div class="rp-spark"><svg class="rp-svg" viewBox="0 0 640 48" preserveAspectRatio="none">' +
        '<polyline class="rp-line" fill="none" stroke="' + C.up + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg></div></div></div>',
      timeline: '<div class="c-tl"><div class="tl-fill"></div><div class="tl-knob"></div></div>',
      leverage: '<div class="c-lev"><div class="lv-fill"></div><div class="lv-knob"></div></div>',
      mode: '<div class="c-tog"><div class="tg-knob"></div></div>',
      timeframe: '<div class="c-tf"><div class="tf-ind"></div><div class="tf-labels"><span>1m</span><span>5m</span><span>1h</span><span>1D</span></div></div>',
      equity: '<div class="c-equity"><div class="eq-head"><span class="eq-title">Equity</span><span class="eq-sub">12 weeks</span></div>' +
        '<svg class="eq-svg" viewBox="0 0 880 440" width="880" height="440"><g class="eq-grid"></g>' +
        '<rect class="eq-dd" fill="rgba(229,72,77,0.16)"/>' +
        '<path class="eq-line" fill="none" stroke="' + C.up + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle class="eq-dot" r="9" fill="#0A0A0A"/></svg>' +
        '<div class="eq-tip">\u22124.8%</div></div>',
      search: '<div class="c-search"><div class="se-input"><span class="se-text"></span><span class="se-caret"></span><span class="se-kbd">&#8984;K</span></div><div class="se-list"></div></div>',
      notify: '<div class="c-notify"><svg viewBox="0 0 40 40" width="40" height="40">' +
        '<circle cx="20" cy="20" r="18" fill="' + C.accent + '"/><path d="M12 20.5 L17.5 26 L28 15" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<div class="nt-body"><div class="nt-t">Added to watchlist</div><div class="nt-s">NVDA &middot; 184.32</div></div></div>'
    },

    extra: function (S) {
      S.knob = new Spring(0);
      S.leadX = new Spring(QUOTE_SPEC.tabStops[0]);
      S.trailX = new Spring(QUOTE_SPEC.tabStops[0]);
      var i;
      for (i = 0; i < QUOTE_SPEC.knobTargets.length; i++) {
        var kt = QUOTE_SPEC.knobTargets[i];
        S.knob.set(kt[0], kt[1], kt[2], kt[3]);
      }
      for (i = 0; i < QUOTE_SPEC.tabHits.length; i++) {
        var h = QUOTE_SPEC.tabHits[i];
        S.leadX.set(h[0], QUOTE_SPEC.tabStops[h[1]], 17, 0.6);
        S.trailX.set(h[0], QUOTE_SPEC.tabStops[h[1]], 13, 0.7);
      }
      S.tl = new Drag(0.18);
      S.tl.grab(16.75, 19.25, function (t) {
        return lerp(0.18, 0.88, smooth((t - 8.375) / 1.25));
      }, 0.84, 15, 0.62);
      S.lev = new Drag(3.0);
      S.lev.grab(20.75, 22.5, function (t) {
        return lerp(3.0, 11.4, smooth((t - 10.375) / 0.875));
      }, 9.5, 15, 0.58);
    },

    prepare: function (refs) {
      var r = refs.c, k;
      r.feed.arc = r.feed.node.querySelector('.load-arc');
      r.feed.rot = r.feed.node.querySelector('.load-rot');
      r.fill.path = r.fill.node.querySelector('.chk');
      r.fill.len = r.fill.path.getTotalLength ? r.fill.path.getTotalLength() : 100;
      r.fill.path.setAttribute('stroke-dasharray', r.fill.len + ' ' + r.fill.len);

      r.replay.pause = r.replay.node.querySelector('.pl-pause');
      r.replay.play = r.replay.node.querySelector('.pl-play');
      r.replay.line = r.replay.node.querySelector('.rp-line');
      var spD = QS.spark, spts = [], vw = 640, vh = 48;
      for (k = 0; k < spD.length; k++) {
        spts.push((k * (vw / (spD.length - 1))).toFixed(1) + ',' + (vh - spD[k] * (vh - 8) - 4).toFixed(1));
      }
      r.replay.line.setAttribute('points', spts.join(' '));

      r.timeline.fill = r.timeline.node.querySelector('.tl-fill');
      r.timeline.knob = r.timeline.node.querySelector('.tl-knob');
      r.leverage.fill = r.leverage.node.querySelector('.lv-fill');
      r.leverage.knob = r.leverage.node.querySelector('.lv-knob');

      r.mode.knob = r.mode.node.querySelector('.tg-knob');
      r.timeframe.ind = r.timeframe.node.querySelector('.tf-ind');
      r.timeframe.labels = r.timeframe.node.querySelectorAll('.tf-labels span');

      r.equity.node.querySelector('.eq-grid').innerHTML = glyphListBars(QS.box);
      var pts = linePoints(QS.equity, QS.box);
      r.equity.pts = pts;
      r.equity.line = r.equity.node.querySelector('.eq-line');
      r.equity.line.setAttribute('d', pathOf(pts));
      r.equity.len = polyLen(pts);
      r.equity.line.setAttribute('stroke-dasharray', r.equity.len + ' ' + r.equity.len);
      var pa = pts[QS.peak], pb = pts[QS.trough], dd = r.equity.node.querySelector('.eq-dd');
      dd.setAttribute('x', pa[0].toFixed(1));
      dd.setAttribute('y', Math.min(pa[1], pb[1]).toFixed(1));
      dd.setAttribute('width', (pb[0] - pa[0]).toFixed(1));
      dd.setAttribute('height', Math.abs(pb[1] - pa[1]).toFixed(1));
      r.equity.dot = r.equity.node.querySelector('.eq-dot');
      r.equity.tip = r.equity.node.querySelector('.eq-tip');
      r.equity.hover = pts[QS.trough];

      r.search.text = r.search.node.querySelector('.se-text');
      r.search.caret = r.search.node.querySelector('.se-caret');
      var list = r.search.node.querySelector('.se-list');
      r.search.rows = [];
      for (k = 0; k < QS.rows.length; k++) {
        var row = document.createElement('div');
        row.className = 'se-row';
        row.innerHTML = '<span>' + QS.rows[k][0] + '</span><em>' + QS.rows[k][1] + '</em>';
        list.appendChild(row);
        r.search.rows.push(row);
      }
    },

    vals: function (t, S) {
      var lv = S.lev.at(t);
      return { tl: S.tl.at(t), lev: lv, over: clamp01((lv - 10) / 1.4) };
    },

    draw: function (refs, t, S, V, A, pr) {
      var r = refs.c, i;

      if (A.feed > 0.001) {
        var lp = clamp01((t - 2.0) / 1.8);
        r.feed.rot.setAttribute('transform', 'rotate(' + (lp * 1080).toFixed(2) + ' 84 84)');
        var circ = 2 * Math.PI * 66;
        var sweep = 0.30 * Math.max(0, 1 - clamp01((t - 3.6) / 0.25));
        r.feed.arc.setAttribute('stroke-dasharray', (circ * (0.22 + sweep)).toFixed(1) + ' ' + circ.toFixed(1));
      }
      if (A.fill > 0.001) {
        var cp = smooth((t - 4.25) / 0.875);
        r.fill.path.setAttribute('stroke-dashoffset', (r.fill.len * (1 - cp)).toFixed(2));
      }
      if (A.replay > 0.001) {
        var mp = smooth((t - 6.5) / 0.34) * (1 - smooth((t - 7.125) / 0.34));
        r.replay.pause.setAttribute('opacity', mp.toFixed(3));
        r.replay.play.setAttribute('opacity', (1 - mp).toFixed(3));
        r.replay.pause.setAttribute('transform', 'rotate(' + (-70 * (1 - mp)).toFixed(1) + ' 24 24) scale(' + (0.7 + 0.3 * mp).toFixed(3) + ')');
        r.replay.play.setAttribute('transform', 'rotate(' + (70 * mp).toFixed(1) + ' 24 24) scale(' + (0.7 + 0.3 * (1 - mp)).toFixed(3) + ')');
        var sp = smooth((t - 6.175) / 1.1);
        r.replay.line.setAttribute('pathLength', '100');
        r.replay.line.setAttribute('stroke-dasharray', '100');
        r.replay.line.setAttribute('stroke-dashoffset', (100 * (1 - sp)).toFixed(2));
      }
      if (A.timeline > 0.001) {
        var pp = 100 * 32 / 880;
        r.timeline.fill.style.width = (Math.min(1, V.tl) * 100).toFixed(2) + '%';
        r.timeline.knob.style.left = (pp + V.tl * (100 - 2 * pp)).toFixed(2) + '%';
        r.timeline.knob.style.transform = 'translate(-50%,-50%) scale(' + (1 + 0.10 * pr).toFixed(3) + ')';
      }
      if (A.leverage > 0.001) {
        var lp2 = 100 * 44 / 560;
        r.leverage.fill.style.width = (Math.min(1, V.lev / 10) * 100).toFixed(2) + '%';
        r.leverage.fill.style.background = V.over > 0.001 ? mixColor(C.accent, C.down, V.over) : C.accent;
        r.leverage.knob.style.left = (lp2 + Math.min(V.lev, 11.4) / 10 * (100 - 2 * lp2)).toFixed(2) + '%';
        r.leverage.knob.style.transform = 'translate(-50%,-50%) scale(' + ((1 + 0.20 * V.over) * (1 + 0.08 * pr)).toFixed(3) + ',' + ((1 - 0.14 * V.over) * (1 + 0.08 * pr)).toFixed(3) + ')';
      }
      if (A.mode > 0.001) {
        var kv = S.knob.at(t), travel = 176 - 80 - 24;
        r.mode.knob.style.left = (12 + kv * travel).toFixed(2) + 'px';
        r.mode.knob.style.width = (80 + (1 - Math.abs(kv * 2 - 1)) * 14).toFixed(2) + 'px';
      }
      if (A.timeframe > 0.001) {
        var lx = S.leadX.at(t), tx = S.trailX.at(t);
        r.timeframe.ind.style.left = (Math.min(lx, tx) + 260 - 66).toFixed(2) + 'px';
        r.timeframe.ind.style.width = (Math.abs(lx - tx) + 132).toFixed(2) + 'px';
        var act = 0;
        for (i = 0; i < QUOTE_SPEC.tabHits.length; i++) if (t >= QUOTE_SPEC.tabHits[i][0] * BEAT) act = QUOTE_SPEC.tabHits[i][1];
        for (i = 0; i < r.timeframe.labels.length; i++) r.timeframe.labels[i].style.color = (i === act ? '#FFFFFF' : C.ink);
      }
      if (A.equity > 0.001) {
        var dp = smooth((t - 16.25) / 0.625);
        r.equity.line.setAttribute('stroke-dashoffset', (r.equity.len * (1 - dp)).toFixed(2));
        r.equity.node.querySelector('.eq-dd').setAttribute('opacity', smooth((t - 16.75) / 0.45).toFixed(3));
        var hp = r.equity.hover;
        var hv = smooth((t - 17.0) / 0.22) * (1 - smooth((t - 17.425) / 0.2));
        r.equity.dot.setAttribute('cx', hp[0]);
        r.equity.dot.setAttribute('cy', hp[1]);
        r.equity.dot.setAttribute('opacity', (hv * dp).toFixed(3));
        r.equity.tip.style.left = hp[0] + 'px';
        r.equity.tip.style.top = (hp[1] - 18) + 'px';
        r.equity.tip.style.opacity = (hv * dp).toFixed(3);
        r.equity.tip.style.transform = 'translate(-50%,-100%) scale(' + (0.9 + 0.1 * hv).toFixed(3) + ')';
      }
      if (A.search > 0.001) {
        var typed = '';
        for (i = 0; i < QS.keys.length; i++) if (t >= QS.keys[i].tb * BEAT) typed = QS.keys[i].s;
        r.search.text.textContent = typed;
        var focused = t >= 17.875;
        r.search.caret.style.opacity = focused ? (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3.2))).toFixed(2) : '0.35';
        var states = [{ t: -1, m: QS.match[''] }];
        for (i = 0; i < QS.keys.length; i++) states.push({ t: QS.keys[i].tb * BEAT, m: QS.match[QS.keys[i].s] });
        var si = 0;
        while (si < states.length - 1 && t >= states[si + 1].t) si++;
        var yy = 0;
        for (i = 0; i < r.search.rows.length; i++) {
          var cur;
          if (si >= states.length - 1) cur = states[si].m[i];
          else {
            var span = states[si + 1].t - states[si].t;
            var pg2 = span > 0 ? smooth((t - states[si].t) / span) : 1;
            cur = lerp(states[si].m[i], states[si + 1].m[i], pg2);
          }
          var re = r.search.rows[i];
          re.style.opacity = cur.toFixed(3);
          re.style.top = (yy * 56).toFixed(1) + 'px';
          re.style.transform = 'translateX(' + ((1 - cur) * 14).toFixed(1) + 'px)';
          yy += cur;
        }
        var sel = smooth((t - 18.875) / 0.22);
        r.search.rows[0].style.background = 'rgba(79,140,255,' + (0.16 * sel).toFixed(3) + ')';
        r.search.rows[0].style.color = sel > 0.5 ? C.accent : C.ink;
      }
    },

    cursor: function (t, S, V) {
      if (t >= 8.375 && t < 9.625) return { x: -440 + V.tl * 880, y: 0 };
      if (t >= 10.375 && t < 11.25) return { x: -280 + Math.min(11.2, V.lev) / 10 * 560, y: 0 };
      return null;
    },

    catalog: [
      { key: 'quote', name: 'Price tag', cn: '价格标签', b0: 0, b1: 4 },
      { key: 'feed', name: 'Tick feed', cn: 'tick 接入', b0: 4, b1: 8 },
      { key: 'fill', name: 'Fill confirm', cn: '成交确认', b0: 8, b1: 12 },
      { key: 'replay', name: 'Session replay', cn: '分时回放', b0: 12, b1: 16 },
      { key: 'timeline', name: 'Scrub timeline', cn: '时间轴拖拽', b0: 16, b1: 20 },
      { key: 'leverage', name: 'Leverage', cn: '杠杆滑块', b0: 20, b1: 24 },
      { key: 'mode', name: 'Paper / Live', cn: '模拟 / 实盘', b0: 24, b1: 28 },
      { key: 'timeframe', name: 'Timeframe', cn: '周期切换', b0: 28, b1: 32 },
      { key: 'equity', name: 'Equity curve', cn: '净值曲线', b0: 32, b1: 35.5 },
      { key: 'search', name: 'Symbol ⌘K', cn: '代码搜索', b0: 35.5, b1: 38 },
      { key: 'notify', name: 'Watchlist toast', cn: '加自选通知', b0: 38, b1: 38.75 }
    ]
  };

  var BasicEngine = makeEngine(BASIC_SPEC);
  var QuoteEngine = makeEngine(QUOTE_SPEC);

  function setLabel(refs, name, desc) {
    var s = refs.frame / 1440;
    var lb = refs.label;
    if (!lb) {
      lb = document.createElement('div');
      refs.root.appendChild(lb);
      refs.label = lb;
    }
    lb.style.cssText = 'position:absolute;left:' + (56 * s) + 'px;bottom:' + (46 * s) + 'px;' +
      'max-width:' + (900 * s) + 'px;pointer-events:none;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;';
    lb.innerHTML =
      '<div style="font-size:' + (27 * s) + 'px;font-weight:500;color:#0A0A0A;letter-spacing:-0.02em;line-height:1.2">' + name + '</div>' +
      '<div style="margin-top:' + (8 * s) + 'px;font-size:' + (20 * s) + 'px;color:#8A857E;line-height:1.45">' + desc + '</div>';
  }

  global.MorphEngine = {
    BEAT: BEAT, C: C,
    Basic: BasicEngine, Quote: QuoteEngine,
    engines: { basic: BasicEngine, quote: QuoteEngine },
    specs: { basic: BASIC_SPEC, quote: QUOTE_SPEC },
    setLabel: setLabel,
    mount: BasicEngine.mount,
    render: BasicEngine.render,
    CATALOG: BasicEngine.CATALOG,
    TOTAL: BasicEngine.TOTAL,
    TOTAL_BEATS: BASIC_SPEC.totalBeats,
    b2s: function (b) { return b * BEAT; }
  };
})(typeof window !== 'undefined' ? window : this);
