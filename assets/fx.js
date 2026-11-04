/* FocusLock page: motion. Pure helpers (tested in node) plus one requestAnimationFrame loop that
   drives the countdown ring, the breathing glow, the watchdog sweep and the calm particles.
   Everything here stops when motion is off (Stop all motion, Quiet everything, or the system's
   reduced-motion setting), when the tab is hidden, or when the simulator is off screen. */
(function (root) {
  'use strict';

  /* Repeating motion, in seconds per cycle. All are slow: nothing flashes more than 3 times a second. */
  var TIMING = { BREATH: 6, SCAN: 5, SWEEP: 1.2, BROWSER_POLL: 2, SOS_PULSE: 2.4, SCATTER: 1.0, DRAIN: 1.8 };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  /* Frame-rate independent ease toward a target (critically damped feel). */
  function smooth(cur, target, dt, k) { return target + (cur - target) * Math.exp(-k * dt); }
  /* 0..1..0 once per period, starting and ending at 0. */
  function breath(t, period) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * t / period); }
  /* Motion runs only when nothing asks for quiet. */
  function motionAllowed(o) { return !(o && (o.calm === 'on' || o.reduced || o.hidden)); }
  /* Which row of n the sweep line is on at progress t (0..1); -1 when not sweeping. */
  function sweepIndex(t, n) { if (!(t >= 0) || t >= 1 || n <= 0) return -1; return Math.min(n - 1, Math.floor(t * n)); }
  function typingSlice(str, elapsedMs, durMs) { return str.slice(0, Math.round(str.length * clamp(elapsedMs / durMs, 0, 1))); }

  /* Calm motes. Modes: rise (session running), scatter then drain (a distraction), off. The cap is hard. */
  function createParticles(opts) {
    opts = opts || {};
    var cap = opts.cap || 48, seed = (opts.seed || 1) >>> 0;
    var list = [], mode = 'off', rest = 'off', modeT = 0, acc = 0, target = { x: 0, y: 0 };
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    function make(x, y) { return { x: x, y: y, vx: 0, vy: 0, age: 0, max: 5 + rnd() * 4, r: 1.5 + rnd() * 2, ph: rnd() * 6.28 }; }
    var api = {
      list: list, cap: cap,
      count: function () { return list.length; },
      mode: function () { return mode; },
      setRest: function (r) { rest = r === 'rise' ? 'rise' : 'off'; if (mode === 'off' || mode === 'rise') { mode = rest; modeT = 0; } },
      clear: function () { list.length = 0; mode = 'off'; acc = 0; },
      scatter: function (cx, cy) {
        mode = 'scatter'; modeT = 0; target.x = cx; target.y = cy;
        while (list.length < Math.min(cap, 20)) list.push(make(cx + (rnd() - 0.5) * 60, cy + (rnd() - 0.5) * 60));
        list.forEach(function (p) {
          var a = Math.atan2(p.y - cy, p.x - cx) + (rnd() - 0.5) * 0.9, s = 50 + rnd() * 70;
          p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.age = Math.min(p.age, p.max * 0.5);
        });
      },
      step: function (dt, w, h) {
        modeT += dt;
        if (mode === 'rise') {
          acc += dt * 9;
          while (acc >= 1) { acc -= 1; if (list.length < cap) { var p = make(rnd() * w, h + 4); p.vy = -(14 + rnd() * 18); list.push(p); } }
        } else if (mode === 'scatter' && modeT > TIMING.SCATTER) { mode = 'drain'; modeT = 0; }
        else if (mode === 'drain' && modeT > TIMING.DRAIN) { mode = rest; modeT = 0; if (rest === 'off') list.length = 0; }
        for (var i = list.length - 1; i >= 0; i--) {
          var q = list[i];
          if (mode === 'scatter') { q.x += q.vx * dt; q.y += q.vy * dt; var d = Math.exp(-1.6 * dt); q.vx *= d; q.vy *= d; q.age += dt * 2.2; }
          else if (mode === 'drain') { q.x = smooth(q.x, target.x, dt, 1.8); q.y = smooth(q.y, target.y, dt, 1.8); q.age += dt * 1.4; }
          else { q.age += dt; q.y += q.vy * dt; q.x += Math.sin(q.age * 1.3 + q.ph) * 8 * dt; }
          if (q.age >= q.max || q.y < -6) list.splice(i, 1);
        }
        if (list.length > cap) list.length = cap;
      },
      alpha: function (p) { return clamp(Math.sin(Math.PI * p.age / p.max), 0, 1) * 0.5; }
    };
    return api;
  }

  var api = { TIMING: TIMING, clamp: clamp, easeOutCubic: easeOutCubic, easeInOutCubic: easeInOutCubic, smooth: smooth, breath: breath,
    motionAllowed: motionAllowed, sweepIndex: sweepIndex, typingSlice: typingSlice, createParticles: createParticles };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------------- browser engine ---------------- */
  var html = document.documentElement, mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var cfg = null, raf = 0, last = 0, now = 0, onscreen = true, tasks = [], layers = [];
  var P = createParticles({ cap: 48, seed: 7 });
  var disp = 0, targetFrac = 0, amp = 0, sweepT = -1, color = '#4d7a68', ctx2d = null, size = { w: 0, h: 0 }, litIdx = -1;

  function allowed() { return motionAllowed({ calm: html.getAttribute('data-calm'), reduced: mq.matches, hidden: document.hidden }); }
  function syncClass() {
    var on = allowed();
    html.classList.toggle('fx', on);
    if (!on) stopAll();
    else ensure();
  }
  function paintDial(frac) {
    if (!cfg || !cfg.dial) return;
    var d = cfg.dial();
    if (d.prog) d.prog.style.strokeDashoffset = String(d.circ * (1 - frac));
  }
  function stopAll() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    layers.forEach(function (l) { if (l.stop) l.stop(); });
    tasks.length = 0; sweepT = -1; litIdx = -1; P.clear();
    disp = targetFrac; paintDial(disp);
    if (cfg && cfg.state) {
      if (ctx2d) ctx2d.clearRect(0, 0, size.w, size.h);
      var d = cfg.dial && cfg.dial();
      if (d && d.glow) { d.glow.style.transform = ''; d.glow.style.opacity = ''; }
      if (cfg.sweepEl) cfg.sweepEl.style.opacity = '0';
      cfg.rows().forEach(function (r) { r.classList.remove('lit'); });
      cfg.stage.classList.remove('shake');
    }
  }
  function wantLoop() {
    if (!allowed()) return false;
    for (var li = 0; li < layers.length; li++) if (layers[li].active()) return true;
    if (!cfg || !onscreen) return false;
    return cfg.state.phase === 'running' || P.count() > 0 || sweepT >= 0 || tasks.length > 0 || Math.abs(disp - targetFrac) > 0.0005;
  }
  function ensure() { if (!raf && wantLoop()) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(ts) {
    raf = 0;
    if (!wantLoop()) { return; }
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts; now += dt;
    update(dt);
    raf = requestAnimationFrame(frame);
  }
  function update(dt) {
    for (var lj = 0; lj < layers.length; lj++) if (layers[lj].active()) layers[lj].update(dt, now);
    if (!cfg || !cfg.state) return;
    var S = cfg.state, d = cfg.dial();
    disp = smooth(disp, targetFrac, dt, 5); if (Math.abs(disp - targetFrac) < 0.0003) disp = targetFrac;
    paintDial(disp);
    if (d.glow) {
      amp = smooth(amp, S.phase === 'running' && !cfg.paused() ? 1 : 0, dt, 3);
      var b = root.FX.glowOverride ? root.FX.glowOverride() : breath(now, TIMING.BREATH);
      d.glow.style.transform = 'scale(' + (0.94 + 0.1 * b * amp).toFixed(4) + ')';
      d.glow.style.opacity = (0.15 + 0.35 * b * amp).toFixed(3);
    }
    for (var i = tasks.length - 1; i >= 0; i--) if (tasks[i](dt) === false) tasks.splice(i, 1);
    if (sweepT >= 0) {
      sweepT += dt / TIMING.SWEEP;
      var rows = cfg.rows(), idx = sweepIndex(sweepT, rows.length);
      if (idx < 0) { sweepT = -1; litIdx = -1; cfg.sweepEl.style.opacity = '0'; rows.forEach(function (r) { r.classList.remove('lit'); }); }
      else {
        var h = cfg.sweepHost.offsetHeight;
        cfg.sweepEl.style.opacity = '1';
        cfg.sweepEl.style.transform = 'translateY(' + (sweepT * h).toFixed(1) + 'px)';
        if (idx !== litIdx) { for (var k = litIdx + 1; k <= idx; k++) rows[k].classList.add('lit'); litIdx = idx; }
      }
    }
    var cx = size.w / 2, cy = size.h / 2;
    P.step(dt, size.w, size.h);
    if (ctx2d) {
      ctx2d.clearRect(0, 0, size.w, size.h);
      ctx2d.fillStyle = color;
      for (var j = 0; j < P.list.length; j++) {
        var p = P.list[j];
        ctx2d.globalAlpha = P.alpha(p);
        ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.r, 0, 6.2832); ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
    }
  }

  root.FX = {
    pure: api,
    on: allowed,
    init: function (c) {
      cfg = c;
      var cv = c.canvas; ctx2d = cv.getContext ? cv.getContext('2d') : null;
      function resize() {
        var r = c.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        size.w = r.width; size.h = r.height; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
        if (ctx2d) ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resize();
      if (window.ResizeObserver) new ResizeObserver(resize).observe(c.stage);
      var cs = getComputedStyle(html); color = (cs.getPropertyValue('--sage') || color).trim() || color;
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (es) {
          onscreen = es[0].isIntersecting;
          c.simEl.classList.toggle('live', onscreen && c.state.phase === 'running');
          if (onscreen) ensure();
        }).observe(c.simEl);
      }
      new MutationObserver(syncClass).observe(html, { attributes: true, attributeFilter: ['data-calm'] });
      if (mq.addEventListener) mq.addEventListener('change', syncClass);
      document.addEventListener('visibilitychange', function () { html.classList.toggle('tab-hidden', document.hidden); syncClass(); });
      window.addEventListener('themechange', function () { color = getComputedStyle(html).getPropertyValue('--sage').trim() || color; });
      syncClass();
    },
    /* Other loops (the living background) join this one rather than starting their own. */
    layer: function (l) { layers.push(l); syncClass(); ensure(); },
    ensure: function () { ensure(); },
    glowOverride: null,
    refresh: function () { /* call after state changes */
      if (!cfg || !cfg.state) return;
      var running = cfg.state.phase === 'running';
      P.setRest(running && !cfg.paused() ? 'rise' : 'off');
      cfg.simEl.classList.toggle('live', running && onscreen && allowed());
      ensure();
    },
    setDial: function (frac) { targetFrac = clamp(frac, 0, 1); if (!allowed()) { disp = targetFrac; paintDial(disp); } else ensure(); },
    resetDial: function () { disp = 0; targetFrac = 0; paintDial(0); },
    startSweep: function () { if (!allowed()) return false; sweepT = 0; litIdx = -1; ensure(); return true; },
    distract: function () { if (!allowed()) return; P.scatter(size.w / 2, size.h / 2); ensure(); },
    task: function (fn) { if (!allowed()) return false; tasks.push(fn); ensure(); return true; },
    particleCount: function () { return P.count(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
