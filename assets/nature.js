/* FocusLock page: the calm, living layer. A background of fireflies, pollen and petals that part around the
   pointer; a lantern, a faint haze that clears under it; ripples and a slow current; growth where the pointer rests;
   a zen sand garden; a breathing guide; two optional mindful moments; and soft lean and glow on cards and windows.
   Every cursor effect fades with Calm mode, stops with Stop all motion and prefers-reduced-motion, and joins the
   page's single animation loop (fx.js). Touch works: a finger is the pointer. Decorations are aria-hidden. */
(function () {
  'use strict';
  var UI = window.FLUI, $ = UI.$, el = UI.el, later = UI.later, announce = UI.announce, F = window.FLField, G = window.FLG, snd = window.FLSound, FX = window.FX;
  var html = document.documentElement;

  /* ---------- Calm mode: one switch fades every cursor effect ---------- */
  var calmSw = $('sw-cursor');
  var stored = UI.load('fl-cursor');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var calmCursor = stored === null ? reduced : stored === 'off';
  function applyCalm() {
    html.setAttribute('data-cursor', calmCursor ? 'off' : 'on'); calmSw.checked = calmCursor;
    if (calmCursor) { clearVars(); fog.classList.remove('on'); }
  }
  var fog = $('fog');
  calmSw.addEventListener('change', function () { calmCursor = calmSw.checked; UI.save('fl-cursor', calmCursor ? 'off' : 'on'); applyCalm(); FX.ensure(); announce(calmCursor ? 'Calm mode on. Cursor effects faded out.' : 'Cursor effects on.'); });
  $('quiet-all').addEventListener('click', function () { calmCursor = true; UI.save('fl-cursor', 'off'); applyCalm(); });
  function cursorOn() { return FX.on() && !calmCursor; }

  /* ---------- pointer (a finger counts) ---------- */
  var ptr = { x: -999, y: -999, on: false, down: false, downAt: 0, moved: false, target: null };
  var touchTimer = 0;
  window.addEventListener('pointermove', function (e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.moved = true; ptr.target = e.target; }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.down = true; ptr.downAt = performance.now(); ptr.target = e.target; clearTimeout(touchTimer);
    if (cursorOn()) { ripples.add(e.clientX, e.clientY); snd.play('water'); FX.ensure(); }
  }, { passive: true });
  function release(e) { ptr.down = false; if (e && e.pointerType && e.pointerType !== 'mouse') { clearTimeout(touchTimer); touchTimer = setTimeout(function () { ptr.on = false; }, 700); } }
  window.addEventListener('pointerup', release, { passive: true }); window.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('pointerleave', function () { ptr.on = false; ptr.down = false; });
  window.addEventListener('blur', function () { ptr.on = false; ptr.down = false; });

  /* ---------- the living background ---------- */
  var cv = $('bg-canvas'), ctx = cv.getContext ? cv.getContext('2d') : null, W = 0, H = 0;
  var motes = F.createMotes({ cap: 60, seed: 11 }), ripples = F.createRipples(6), blooms = F.createBlooms({ cap: 12, seed: 5 });
  var C = { lantern: 'rgba(255,226,150,0.5)', sage: '#4f8a73', lav: '#7b72b0', teal: '#2e6a70', glowRaw: '255,214,130' };
  var prefs = { fog: true, growth: true };
  function readColors() {
    var cs = getComputedStyle(html); function g(n, d) { return (cs.getPropertyValue(n) || '').trim() || d; }
    C.sage = g('--sage', C.sage); C.lav = g('--lav', C.lav); C.teal = g('--teal', C.teal); C.glowRaw = g('--lantern-rgb', C.glowRaw);
  }
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    motes.fill(W, H, F.moteCount(W));
    if (!FX.on()) drawStatic();
  }
  window.addEventListener('resize', resize);

  function drawMotes(animated) {
    for (var i = 0; i < motes.list.length; i++) {
      var m = motes.list[i], g = animated ? motes.glow(m) : 0.7;
      if (m.kind === 'fly') {
        var rg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 6); rg.addColorStop(0, 'rgba(' + C.glowRaw + ',' + (0.75 * g).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(' + C.glowRaw + ',0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 6, 0, 6.2832); ctx.fill();
      } else if (m.kind === 'pollen') { ctx.globalAlpha = 0.35; ctx.fillStyle = C.sage; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
      else { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot); ctx.globalAlpha = 0.4; ctx.fillStyle = C.lav; ctx.beginPath(); ctx.ellipse(0, 0, m.r * 1.6, m.r * 0.8, 0, 0, 6.2832); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
    }
  }
  function drawBloom(b) {
    var s = blooms.scale(b) * b.size, a = blooms.alpha(b); if (a <= 0.01) return;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.globalAlpha = a;
    if (b.kind === 'lotus') {
      ctx.fillStyle = C.lav; for (var k = -2; k <= 2; k++) { ctx.save(); ctx.rotate(k * 0.42); ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.22, s * 0.6, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = 'rgba(' + C.glowRaw + ',0.9)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, 6.2832); ctx.fill();
    } else if (b.kind === 'fern') {
      ctx.strokeStyle = C.sage; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.3, -s * 0.6, 0, -s * 1.2); ctx.stroke();
      for (var j = 1; j <= 5; j++) { var y = -s * 0.22 * j, w = s * 0.34 * (1 - j / 7); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-w, y - w * 0.6); ctx.moveTo(0, y); ctx.lineTo(w, y - w * 0.6); ctx.stroke(); }
    } else { ctx.fillStyle = C.sage; for (var q = 0; q < 6; q++) { ctx.beginPath(); ctx.arc(Math.cos(q * 1.9) * s * 0.4, Math.sin(q * 2.3) * s * 0.3, s * 0.13, 0, 6.2832); ctx.fill(); } }
    ctx.restore();
  }
  function drawStatic() { if (!ctx) return; ctx.clearRect(0, 0, W, H); readColors(); drawMotes(false); }

  var fogPrev = { x: -1, y: -1 }, lean = null, lastHold = 0;
  function clearVars() {
    html.style.setProperty('--px', '0'); html.style.setProperty('--py', '0');
    if (lean) { lean.style.removeProperty('--rx'); lean.style.removeProperty('--ry'); lean.style.removeProperty('--mx'); lean.style.removeProperty('--my'); lean = null; }
  }
  var LEAN = '.card, .panel, .attempt, .statc, .win2, .toolbar, .priv, .hrow';
  function update(dt, now) {
    var on = cursorOn(), held = on && ptr.down ? (performance.now() - ptr.downAt) / 1000 : 0;
    var p = { x: ptr.x, y: ptr.y, on: on && ptr.on, down: on && ptr.down, held: held };
    motes.step(dt, W, H, p); ripples.step(dt); blooms.update(dt, prefs.growth ? p : { on: false });
    if (held > 0.7 && lastHold <= 0.7) snd.play('current'); lastHold = held;
    ctx.clearRect(0, 0, W, H);
    /* drifting mist */
    for (var i = 0; i < 3; i++) {
      var mx = W * (0.2 + 0.3 * i) + Math.sin(now * 0.05 + i * 2) * 120, my = H * (0.3 + 0.2 * i) + Math.cos(now * 0.04 + i) * 80, r = Math.max(W, H) * 0.35;
      var g = ctx.createRadialGradient(mx, my, 0, mx, my, r); g.addColorStop(0, 'rgba(' + C.glowRaw + ',0.05)'); g.addColorStop(1, 'rgba(' + C.glowRaw + ',0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (p.on) { var lg = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 170); lg.addColorStop(0, 'rgba(' + C.glowRaw + ',0.30)'); lg.addColorStop(1, 'rgba(' + C.glowRaw + ',0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 170, 0, 6.2832); ctx.fill(); }
    drawMotes(true);
    ctx.lineWidth = 1.6; ctx.strokeStyle = C.teal;
    for (var k = 0; k < ripples.list.length; k++) { var rp = ripples.list[k]; ctx.globalAlpha = ripples.alpha(rp); ctx.beginPath(); ctx.arc(rp.x, rp.y, ripples.radius(rp), 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(rp.x, rp.y, ripples.radius(rp) * 0.62, 0, 6.2832); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (var b = 0; b < blooms.list.length; b++) drawBloom(blooms.list[b]);
    /* haze and lean follow the pointer, only while cursor effects are on */
    if (on && ptr.on && ptr.moved) {
      ptr.moved = false;
      if (prefs.fog) { fog.style.setProperty('--lx', ptr.x + 'px'); fog.style.setProperty('--ly', ptr.y + 'px'); }
      html.style.setProperty('--px', ((ptr.x / W) * 2 - 1).toFixed(3)); html.style.setProperty('--py', ((ptr.y / H) * 2 - 1).toFixed(3));
      var t = ptr.target && ptr.target.closest ? ptr.target.closest(LEAN) : null;
      if (lean && lean !== t) { lean.style.removeProperty('--rx'); lean.style.removeProperty('--ry'); lean.style.removeProperty('--mx'); lean.style.removeProperty('--my'); }
      if (t) {
        var r = t.getBoundingClientRect(), fx = (ptr.x - r.left) / r.width, fy = (ptr.y - r.top) / r.height;
        t.style.setProperty('--mx', (ptr.x - r.left) + 'px'); t.style.setProperty('--my', (ptr.y - r.top) + 'px');
        if (!t.classList.contains('win2') && !t.classList.contains('toolbar')) { t.style.setProperty('--rx', ((0.5 - fy) * 4).toFixed(2) + 'deg'); t.style.setProperty('--ry', ((fx - 0.5) * 5).toFixed(2) + 'deg'); }
        lean = t;
      } else lean = null;
    }
    fog.classList.toggle('on', prefs.fog && on && ptr.on);
    breathUpdate(dt);
  }
  FX.layer({ update: update, active: function () { return !!ctx; }, stop: function () { if (ctx) { fog.classList.remove('on'); clearVars(); drawStatic(); } } });

  /* ---------- breathing guide ---------- */
  var brW = $('br-widget'), ring = $('br-ring'), brLabel = $('br-label'), preset = $('br-preset');
  var br = { t: 0, hold: false, keep: false, follow: false, scale: 0, phase: '', hidden: UI.load('fl-breath') === 'hidden', x: 40, y: 40 };
  function holdOn(v) { br.hold = v; ring.setAttribute('aria-pressed', v ? 'true' : 'false'); FX.ensure(); if (!FX.on()) textTick(); }
  ring.addEventListener('pointerdown', function (e) { e.stopPropagation(); holdOn(true); try { ring.setPointerCapture(e.pointerId); } catch (x) {} });
  ring.addEventListener('pointerup', function () { holdOn(false); }); ring.addEventListener('pointercancel', function () { holdOn(false); });
  ring.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdOn(true); } });
  ring.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holdOn(false); } });
  ring.addEventListener('blur', function () { if (br.hold) holdOn(false); });
  $('br-keep').addEventListener('change', function () { br.keep = this.checked; FX.ensure(); if (!FX.on()) textTick(); });
  $('br-follow').addEventListener('change', function () { br.follow = this.checked; brW.classList.toggle('follow', br.follow); if (!br.follow) brW.style.transform = ''; });
  $('br-pace').addEventListener('change', function () { FX.glowOverride = this.checked ? function () { return br.scale; } : null; });
  $('opt-fog').addEventListener('change', function () { prefs.fog = this.checked; if (!this.checked) fog.classList.remove('on'); });
  $('opt-growth').addEventListener('change', function () { prefs.growth = this.checked; });
  function brHidden(h) { br.hidden = h; brW.classList.toggle('collapsed', h); UI.save('fl-breath', h ? 'hidden' : 'shown'); $('br-show').hidden = !h; if (h) holdOn(false); }
  $('br-hide').addEventListener('click', function () { brHidden(true); $('br-show').focus(); });
  $('br-show').addEventListener('click', function () { brHidden(false); ring.focus(); });
  brHidden(br.hidden);
  function active() { return br.hold || br.keep; }
  function setLabel(txt) { if (brLabel.textContent !== txt) brLabel.textContent = txt; }
  function breathUpdate(dt) {
    if (br.hidden) return;
    var act = active();
    if (act) br.t += dt; else { br.t = 0; }
    var s = act ? F.breathAt(br.t, preset.value) : { scale: 0, phase: '', label: 'Hold to breathe' };
    br.scale += (s.scale - br.scale) * Math.min(1, dt * 6);
    ring.style.transform = 'scale(' + (0.72 + 0.5 * br.scale).toFixed(3) + ')'; ring.style.opacity = (0.65 + 0.35 * br.scale).toFixed(3);
    setLabel(act ? s.label : 'Hold to breathe');
    if (act && s.phase !== br.phase) { br.phase = s.phase; if (s.phase === 'in') snd.play('breathin'); else if (s.phase === 'out') snd.play('breathout'); } else if (!act) br.phase = '';
    if (br.follow && ptr.on) { br.x += (ptr.x + 28 - br.x) * Math.min(1, dt * 5); br.y += (ptr.y + 28 - br.y) * Math.min(1, dt * 5); brW.style.transform = 'translate(' + br.x.toFixed(1) + 'px,' + br.y.toFixed(1) + 'px)'; }
  }
  /* Reduced motion: the guide becomes words only, no scaling. */
  var textTimer = 0;
  function textTick() {
    clearInterval(textTimer); ring.style.transform = ''; ring.style.opacity = '';
    if (!active()) { setLabel('Hold to breathe'); return; }
    var t0 = performance.now();
    textTimer = setInterval(function () { if (!active() || FX.on()) { clearInterval(textTimer); if (!active()) setLabel('Hold to breathe'); return; } setLabel(F.breathAt((performance.now() - t0) / 1000, preset.value).label); }, 400);
  }

  /* ---------- zen sand garden ---------- */
  var sand = $('sand'), sctx = sand.getContext('2d'), wrap = $('garden-wrap'), base = document.createElement('canvas'), SW = 0, SH = 0, sdpr = 1;
  function sandBase() {
    var b = base.getContext('2d'), cs = getComputedStyle(html), c1 = (cs.getPropertyValue('--sand') || '#ecdfc6').trim();
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, base.width, base.height); b.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    b.fillStyle = c1; b.fillRect(0, 0, SW, SH);
    var seed = 7; for (var i = 0; i < 700; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; var x = (seed % 10000) / 10000 * SW; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; var y = (seed % 10000) / 10000 * SH; b.fillStyle = (i % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(90,70,40,0.12)'); b.fillRect(x, y, 1.4, 1.4); }
  }
  function sandSize() {
    sdpr = Math.min(window.devicePixelRatio || 1, 1.5); SW = wrap.clientWidth; SH = wrap.clientHeight; if (!SW) return;
    sand.width = base.width = Math.round(SW * sdpr); sand.height = base.height = Math.round(SH * sdpr); sandBase(); smoothNow(); placeStones();
  }
  function smoothNow() { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.drawImage(base, 0, 0); sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0); }
  var TINES = [-9, 0, 9];
  function groove(a, b, off) {
    sctx.lineCap = 'round';
    sctx.strokeStyle = 'rgba(70,52,28,0.34)'; sctx.lineWidth = 2.6; sctx.beginPath(); sctx.moveTo(a.x, a.y); sctx.lineTo(b.x, b.y); sctx.stroke();
    sctx.strokeStyle = 'rgba(255,250,235,0.5)'; sctx.lineWidth = 1.2; sctx.beginPath(); sctx.moveTo(a.x + 1.6, a.y + 1.6); sctx.lineTo(b.x + 1.6, b.y + 1.6); sctx.stroke();
  }
  var pts = [], raking = false, lastRake = 0;
  function pos(e) { var r = sand.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  sand.addEventListener('pointerdown', function (e) { raking = true; pts = [pos(e)]; try { sand.setPointerCapture(e.pointerId); } catch (x) {} });
  sand.addEventListener('pointermove', function (e) {
    if (!raking) return; pts.push(pos(e)); pts = F.thin(pts, 4);
    if (pts.length >= 3) {
      var seg = pts.slice(-3); TINES.forEach(function (d) { var o = F.offsetPolyline(seg, d); groove(o[1], o[2]); });
      var n = performance.now(); if (n - lastRake > 110) { lastRake = n; snd.play('rake'); }
    }
  });
  function endRake() { raking = false; pts = []; } sand.addEventListener('pointerup', endRake); sand.addEventListener('pointercancel', endRake);
  var stones = Array.prototype.slice.call(wrap.querySelectorAll('.stone')), spos = [[0.22, 0.5], [0.55, 0.38], [0.78, 0.62]];
  function placeStones() { stones.forEach(function (s, i) { if (!s._p) s._p = { x: spos[i][0], y: spos[i][1] }; s.style.left = (s._p.x * 100) + '%'; s.style.top = (s._p.y * 100) + '%'; }); }
  function ringsAround(s) {
    var cx = s._p.x * SW, cy = s._p.y * SH; sctx.strokeStyle = 'rgba(70,52,28,0.3)'; sctx.lineWidth = 2;
    [34, 46, 58].forEach(function (r) { sctx.beginPath(); sctx.arc(cx, cy, r, 0, 6.2832); sctx.stroke(); sctx.strokeStyle = 'rgba(255,250,235,0.4)'; sctx.lineWidth = 1; sctx.beginPath(); sctx.arc(cx + 1.4, cy + 1.4, r, 0, 6.2832); sctx.stroke(); sctx.strokeStyle = 'rgba(70,52,28,0.3)'; sctx.lineWidth = 2; });
    snd.play('water');
  }
  stones.forEach(function (s) {
    var drag = null;
    s.addEventListener('pointerdown', function (e) { var r = wrap.getBoundingClientRect(); drag = { dx: e.clientX - (r.left + s._p.x * SW), dy: e.clientY - (r.top + s._p.y * SH) }; s.setPointerCapture(e.pointerId); s.classList.add('held'); e.stopPropagation(); });
    s.addEventListener('pointermove', function (e) { if (!drag) return; var r = wrap.getBoundingClientRect(); s._p.x = Math.max(0.05, Math.min(0.95, (e.clientX - drag.dx - r.left) / SW)); s._p.y = Math.max(0.08, Math.min(0.92, (e.clientY - drag.dy - r.top) / SH)); placeStones(); });
    function up() { if (!drag) return; drag = null; s.classList.remove('held'); ringsAround(s); }
    s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
    s.addEventListener('keydown', function (e) { var k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return; e.preventDefault(); s._p.x = Math.max(0.05, Math.min(0.95, s._p.x + k[0] * 0.04)); s._p.y = Math.max(0.08, Math.min(0.92, s._p.y + k[1] * 0.06)); placeStones(); ringsAround(s); });
  });
  $('sand-smooth').addEventListener('click', function () {
    snd.play('chime');
    var p = 0, ok = FX.task(function (dt) {
      p += dt / 0.9; var w = Math.min(1, p) * SW;
      sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.save(); sctx.beginPath(); sctx.rect(0, 0, w * sdpr, base.height); sctx.clip(); sctx.drawImage(base, 0, 0); sctx.restore(); sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
      return p < 1;
    });
    if (!ok) smoothNow(); announce('The sand is smooth again.');
  });
  $('sand-wave').addEventListener('click', function () {
    smoothNow(); for (var row = 0; row < 3; row++) { var line = []; for (var x = 0; x <= SW; x += 6) line.push({ x: x, y: SH * (0.28 + row * 0.22) + Math.sin(x / 38 + row) * 14 }); TINES.forEach(function (d) { var o = F.offsetPolyline(line, d * 0.45); for (var i = 1; i < o.length; i++) groove(o[i - 1], o[i]); }); }
    stones.forEach(ringsAround); announce('Raked a wave pattern.');
  });
  if (window.ResizeObserver) new ResizeObserver(function () { sandSize(); }).observe(wrap); else sandSize();

  /* ---------- mindful moments (page extras, opt in) ---------- */
  var dlg = null, dlgFrom = null, dlgTimer = 0;
  function closeDlg() { clearInterval(dlgTimer); document.querySelectorAll('.ground-hl').forEach(function (n) { n.classList.remove('ground-hl'); }); if (dlg) { dlg.remove(); dlg = null; } if (dlgFrom) dlgFrom.focus(); }
  function openDlg(title, kids) {
    closeDlg(); dlgFrom = document.activeElement;
    dlg = el('div', { class: 'modal soft', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [el('div', { class: 'modal-card calmcard' }, kids)]);
    dlg.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeDlg(); } });
    document.body.appendChild(dlg); var f = dlg.querySelector('button'); if (f) f.focus(); return dlg;
  }
  $('moment-pause').addEventListener('click', function () {
    var n = 20, num = el('div', { class: 'count', 'aria-hidden': 'true', text: String(n) }), msg = el('p', { class: 'mmsg', role: 'status', text: 'Take twenty seconds. There is nothing to do, and nothing to get right.' });
    var done = el('button', { class: 'btn primary', type: 'button', text: 'Skip, or finish', on: { click: closeDlg } });
    openDlg('A 20 second pause', [el('h3', { text: 'A pause' }), el('div', { class: 'pausering', 'aria-hidden': 'true' }, [num]), msg, done, el('p', { class: 'hint', text: 'Page extra. A moment to breathe, not medical advice or therapy.' })]);
    snd.play('chime');
    dlgTimer = setInterval(function () { n--; num.textContent = String(Math.max(n, 0)); if (n <= 0) { clearInterval(dlgTimer); msg.textContent = 'That is enough. Come back whenever you like.'; done.textContent = 'Back to the page'; snd.play('chime'); } }, 1000);
  });
  var FIVE = [['h1', 'the big headline at the top'], ['.breath', 'the soft ring beside it'], ['#dock', 'the row of little app icons in the pretend Mac'], ['#sand', 'the sand in the garden'], ['#sw-cursor', 'the Calm mode switch in the top bar']];
  $('moment-ground').addEventListener('click', function () {
    var i = 0, txt = el('p', { class: 'mmsg', 'aria-live': 'polite' }), cnt = el('div', { class: 'hint' }), next = el('button', { class: 'btn primary', type: 'button', text: 'Next' });
    function show() {
      document.querySelectorAll('.ground-hl').forEach(function (n) { n.classList.remove('ground-hl'); });
      if (i >= FIVE.length) { txt.textContent = 'Five things named. That is all there was to do.'; cnt.textContent = ''; next.textContent = 'Back to the page'; next.onclick = closeDlg; return; }
      var t = document.querySelector(FIVE[i][0]); if (t) { t.classList.add('ground-hl'); t.scrollIntoView({ block: 'center', behavior: 'auto' }); }
      txt.textContent = 'Name one thing you can see: ' + FIVE[i][1] + '.'; cnt.textContent = (i + 1) + ' of 5'; next.textContent = i === FIVE.length - 1 ? 'Done' : 'Next';
    }
    next.onclick = function () { i++; show(); snd.play('tab'); };
    openDlg('Five things you can see', [el('h3', { text: 'Five things' }), txt, cnt, el('div', { class: 'row' }, [next, el('button', { class: 'btn', type: 'button', text: 'Stop', on: { click: closeDlg } })]), el('p', { class: 'hint', text: 'Page extra. A simple grounding exercise, not medical advice or therapy.' })]);
    show();
  });

  /* ---------- start ---------- */
  applyCalm(); readColors(); resize(); sandSize();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { readColors(); sandBase(); smoothNow(); if (!FX.on()) drawStatic(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) readColors(); });
  var mo = new MutationObserver(function () { if (!FX.on()) { drawStatic(); textTick(); } }); mo.observe(html, { attributes: true, attributeFilter: ['data-calm'] });
  G.nature = { ptr: ptr, motes: motes, ripples: ripples, blooms: blooms, setCalm: function (v) { calmSw.checked = v; calmSw.dispatchEvent(new Event('change')); } };
})();
