/* FocusLock page: window manager geometry for the pretend desktop. No DOM; tested in node.
   Windows have a position, size, stacking order and a minimised flag. The front app is the top window
   that is not minimised, which is what the browser check depends on. */
(function (root) {
  'use strict';
  var KEEP = 90; /* pixels of a window that must stay reachable */
  var SNAP = 18;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function createWM(bounds) {
    var wins = [], zc = 0;
    var wm = { bounds: bounds, wins: wins };
    function get(id) { for (var i = 0; i < wins.length; i++) if (wins[i].id === id) return wins[i]; return null; }
    wm.get = get;
    wm.setBounds = function (b) { wm.bounds = b; wins.forEach(function (w) { wm.move(w.id, w.x, w.y); }); };
    wm.open = function (id, spec) {
      var w = get(id);
      if (w) { w.min = false; wm.focus(id); return w; }
      w = { id: id, app: spec.app || id, title: spec.title || id, x: spec.x || 0, y: spec.y || 0, w: spec.w || 360, h: spec.h || 280, z: ++zc, min: false };
      wins.push(w); wm.move(id, w.x, w.y); return w;
    };
    wm.focus = function (id) { var w = get(id); if (!w) return null; w.min = false; w.z = ++zc; return w; };
    wm.close = function (id) { var i = wins.indexOf(get(id)); if (i >= 0) wins.splice(i, 1); return i >= 0; };
    wm.minimize = function (id) { var w = get(id); if (w) w.min = true; return !!w; };
    wm.restore = function (id) { return wm.focus(id); };
    wm.front = function () {
      var best = null; wins.forEach(function (w) { if (!w.min && (!best || w.z > best.z)) best = w; }); return best;
    };
    wm.order = function () { return wins.slice().sort(function (a, b) { return a.z - b.z; }); };
    wm.move = function (id, x, y) {
      var w = get(id), b = wm.bounds; if (!w) return null;
      w.x = clamp(x, KEEP - w.w, b.w - KEEP); w.y = clamp(y, 0, Math.max(0, b.h - 40)); return w;
    };
    wm.resize = function (id, width, height, minW, minH) {
      var w = get(id); if (!w) return null;
      w.w = clamp(width, minW || 240, wm.bounds.w); w.h = clamp(height, minH || 160, wm.bounds.h); return w;
    };
    /* Where a window snaps if dropped with the pointer at (px, py): left or right edge gives that half, the top gives full. */
    wm.snapRect = function (px, py) {
      var b = wm.bounds;
      if (py <= 6) return { x: 0, y: 0, w: b.w, h: b.h };
      if (px <= 6) return { x: 0, y: 0, w: Math.round(b.w / 2), h: b.h };
      if (px >= b.w - 6) return { x: Math.round(b.w / 2), y: 0, w: Math.round(b.w / 2), h: b.h };
      return null;
    };
    wm.applyRect = function (id, r) { var w = get(id); if (!w) return null; w.x = r.x; w.y = r.y; w.w = r.w; w.h = r.h; return w; };
    /* Spread the open windows in a tidy cascade. */
    wm.tidy = function () {
      var n = 0; wm.order().forEach(function (w) { if (!w.min) { w.x = clamp(24 + n * 34, 0, Math.max(0, wm.bounds.w - w.w)); w.y = clamp(16 + n * 30, 0, Math.max(0, wm.bounds.h - w.h)); n++; } });
    };
    return wm;
  }

  /* A flick: a window keeps drifting after you let go, slowing down. Velocity comes from the last few pointer samples. */
  function velocity(samples) {
    if (samples.length < 2) return { vx: 0, vy: 0 };
    var a = samples[0], b = samples[samples.length - 1], dt = (b.t - a.t) / 1000;
    if (dt <= 0 || dt > 0.25) return { vx: 0, vy: 0 };
    return { vx: clamp((b.x - a.x) / dt, -1800, 1800), vy: clamp((b.y - a.y) / dt, -1800, 1800) };
  }
  function inertiaStep(st, dt, bounds, win) {
    var f = Math.exp(-4.5 * dt), x = st.x + st.vx * dt, y = st.y + st.vy * dt, vx = st.vx * f, vy = st.vy * f;
    var minX = KEEP - win.w, maxX = bounds.w - KEEP, maxY = Math.max(0, bounds.h - 40);
    if (x < minX) { x = minX; vx = -vx * 0.3; } else if (x > maxX) { x = maxX; vx = -vx * 0.3; }
    if (y < 0) { y = 0; vy = -vy * 0.3; } else if (y > maxY) { y = maxY; vy = -vy * 0.3; }
    return { x: x, y: y, vx: vx, vy: vy, done: Math.abs(vx) < 8 && Math.abs(vy) < 8 };
  }

  /* On a phone the desktop shows one app at a time, full size. */
  function phoneRect(bounds) { return { x: 0, y: 0, w: bounds.w, h: bounds.h }; }
  function isPhone(width) { return width < 700; }

  var api = { KEEP: KEEP, SNAP: SNAP, createWM: createWM, velocity: velocity, inertiaStep: inertiaStep, phoneRect: phoneRect, isPhone: isPhone, clamp: clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLWM = api;
})(typeof window !== 'undefined' ? window : globalThis);
