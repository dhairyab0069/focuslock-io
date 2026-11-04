/* FocusLock page: the living background, as pure physics. Motes that part around the pointer and drift back,
   a slow current when you press and hold, still-water ripples, blooms that grow where the pointer rests,
   breathing-guide pacing, and rake geometry for the sand garden. No DOM; tested in node. */
(function (root) {
  'use strict';
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---- motes: fireflies, pollen and petals ---- */
  function createMotes(opts) {
    opts = opts || {};
    var cap = opts.cap || 56, seed = (opts.seed || 3) >>> 0, list = [], t = 0;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    var kinds = ['fly', 'fly', 'pollen', 'petal'];
    function make(w, h) {
      var k = kinds[Math.floor(rnd() * kinds.length)];
      return { x: rnd() * w, y: rnd() * h, vx: 0, vy: 0, r: k === 'petal' ? 3 + rnd() * 2.5 : 1.4 + rnd() * 2, ph: rnd() * 6.28, kind: k, rot: rnd() * 6.28 };
    }
    var api = {
      list: list, cap: cap,
      fill: function (w, h, n) { n = Math.min(n || cap, cap); while (list.length < n) list.push(make(w, h)); if (list.length > n) list.length = n; },
      /* ptr: {x, y, on, down, held} in the same units as w, h. */
      step: function (dt, w, h, ptr) {
        t += dt;
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          /* an unhurried wander of its own */
          m.vx += Math.sin(t * 0.35 + m.ph) * 5 * dt; m.vy += Math.cos(t * 0.29 + m.ph * 1.7) * 5 * dt;
          if (m.kind === 'petal') m.vy += 9 * dt;
          if (ptr && ptr.on) {
            var dx = m.x - ptr.x, dy = m.y - ptr.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d < 120) { var f = Math.pow(1 - d / 120, 2) * 380; m.vx += dx / d * f * dt; m.vy += dy / d * f * dt; }
            if (ptr.down && ptr.held > 0.25 && d < 230) {
              var s = (1 - d / 230) * 420 * Math.min(1, (ptr.held - 0.25) * 2);
              m.vx += (-dy / d) * s * dt - dx / d * 26 * dt; m.vy += (dx / d) * s * dt - dy / d * 26 * dt;
            }
          }
          var damp = Math.exp(-1.3 * dt); m.vx *= damp; m.vy *= damp;
          var sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy); if (sp > 340) { m.vx *= 340 / sp; m.vy *= 340 / sp; }
          m.x += m.vx * dt; m.y += m.vy * dt; m.rot += dt * 0.6;
          if (m.x < -10) m.x = w + 10; else if (m.x > w + 10) m.x = -10;
          if (m.y < -10) m.y = h + 10; else if (m.y > h + 10) m.y = -10;
        }
      },
      /* 0..1 glow, a slow twinkle (well under 1 Hz) */
      glow: function (m) { return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.ph * 3)); }
    };
    return api;
  }

  /* ---- still-water ripples ---- */
  function createRipples(cap) {
    cap = cap || 6; var list = [], LIFE = 1.9;
    return { list: list, LIFE: LIFE,
      add: function (x, y) { list.push({ x: x, y: y, age: 0 }); if (list.length > cap) list.shift(); },
      step: function (dt) { for (var i = list.length - 1; i >= 0; i--) { list[i].age += dt; if (list[i].age >= LIFE) list.splice(i, 1); } },
      radius: function (r) { return 14 + r.age * 150; },
      alpha: function (r) { return clamp(1 - r.age / LIFE, 0, 1) * 0.45; } };
  }

  /* ---- growth where the pointer rests ---- */
  function createBlooms(opts) {
    opts = opts || {}; var cap = opts.cap || 12, seed = (opts.seed || 5) >>> 0, list = [], rest = 0, since = 9, last = null, LIFE = 9;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    var kinds = ['lotus', 'fern', 'moss'];
    return { list: list, cap: cap, LIFE: LIFE,
      update: function (dt, ptr) {
        since += dt;
        if (ptr && ptr.on) {
          if (last && Math.abs(ptr.x - last.x) + Math.abs(ptr.y - last.y) < 5) rest += dt; else rest = 0;
          last = { x: ptr.x, y: ptr.y };
          if (rest > 0.7 && since > 1.1) { rest = 0.2; since = 0; list.push({ x: ptr.x + (rnd() - 0.5) * 24, y: ptr.y + (rnd() - 0.5) * 24, age: 0, kind: kinds[Math.floor(rnd() * 3)], rot: (rnd() - 0.5) * 1.2, size: 10 + rnd() * 8 }); if (list.length > cap) list.shift(); }
        } else { rest = 0; last = null; }
        for (var i = list.length - 1; i >= 0; i--) { list[i].age += dt; if (list[i].age >= LIFE) list.splice(i, 1); }
      },
      /* grows in over 1.4 s, fades over the last 3 s */
      scale: function (b) { return clamp(b.age / 1.4, 0, 1); },
      alpha: function (b) { return clamp(Math.min(b.age / 1.0, (LIFE - b.age) / 3), 0, 1) * 0.8; } };
  }

  /* ---- breathing guide pacing: [in, hold, out, hold] seconds ---- */
  var BREATH = { '4-4': [4, 0, 4, 0], '4-6': [4, 0, 6, 0], box: [4, 4, 4, 4] };
  var LABEL = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Rest' };
  function ease(p) { return 0.5 - 0.5 * Math.cos(Math.PI * clamp(p, 0, 1)); }
  /* scale 0 (small) .. 1 (full), the phase and its label at time t seconds into the guide */
  function breathAt(t, preset) {
    var p = BREATH[preset] || BREATH['4-6'], total = p[0] + p[1] + p[2] + p[3], x = ((t % total) + total) % total;
    if (x < p[0]) return { phase: 'in', scale: ease(x / p[0]), label: LABEL.in };
    x -= p[0]; if (x < p[1]) return { phase: 'hold', scale: 1, label: LABEL.hold };
    x -= p[1]; if (x < p[2]) return { phase: 'out', scale: 1 - ease(x / p[2]), label: LABEL.out };
    return { phase: 'hold', scale: 0, label: LABEL.hold };
  }
  function breathCycle(preset) { var p = BREATH[preset] || BREATH['4-6']; return p[0] + p[1] + p[2] + p[3]; }

  /* ---- the rake: three parallel grooves offset to either side of the path ---- */
  function offsetPolyline(pts, d) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      out.push({ x: pts[i].x - dy / l * d, y: pts[i].y + dx / l * d });
    }
    return out;
  }
  /* Drop points that are closer than `min` so strokes stay smooth and cheap. */
  function thin(pts, min) { var out = []; pts.forEach(function (p) { var q = out[out.length - 1]; if (!q || Math.hypot(p.x - q.x, p.y - q.y) >= min) out.push(p); }); return out; }

  /* How many motes for this screen: fewer on phones. */
  function moteCount(width) { return width < 700 ? 26 : width < 1100 ? 44 : 60; }

  var api = { createMotes: createMotes, createRipples: createRipples, createBlooms: createBlooms, BREATH: BREATH, breathAt: breathAt, breathCycle: breathCycle, offsetPolyline: offsetPolyline, thin: thin, moteCount: moteCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLField = api;
})(typeof window !== 'undefined' ? window : globalThis);
