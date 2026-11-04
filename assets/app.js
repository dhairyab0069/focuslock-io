/* FocusLock page: wires the simulator and the filter probe to assets/core.js. */
(function () {
  'use strict';
  var FL = window.FL, snd = window.FLSound;
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var sim = FL.createSim(), S = sim.state;

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (e) { n.addEventListener(e, attrs.on[e]); });
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function announce(t) { $('announce').textContent = t; }
  function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
  function later(fn, ms) { setTimeout(fn, ms); }

  /* ---- quiet settings ---- */
  var calm = $('sw-calm'), sound = $('sw-sound');
  calm.checked = root.getAttribute('data-calm') === 'on';
  calm.addEventListener('change', function () {
    root.setAttribute('data-calm', calm.checked ? 'on' : 'off'); store('fl-calm', calm.checked ? 'on' : 'off');
  });
  sound.addEventListener('change', function () { snd.set(sound.checked); snd.play('click'); });
  $('quiet-all').addEventListener('click', function () {
    calm.checked = true; calm.dispatchEvent(new Event('change'));
    sound.checked = false; snd.set(false);
    announce('Motion and sound are off.');
  });

  /* ---- pretend Mac: programs ---- */
  var apps = $('apps'), sweepEl = el('div', { class: 'sweep', 'aria-hidden': 'true' });
  apps.appendChild(sweepEl);
  FL.LLM_PROGRAMS.forEach(function (name, i) {
    var cb = el('input', { type: 'checkbox', id: 'app' + i });
    cb.addEventListener('change', function () { sim.setApp(name, cb.checked); render(); });
    apps.appendChild(el('label', { for: 'app' + i, class: 'approw' }, [cb, el('span', { text: name })]));
  });

  /* ---- pretend browser ---- */
  var SAMPLES = [['https://www.reddit.com/r/macapps', 'no'], ['https://x.com/home', 'no'], ['https://claude.ai/chat', 'no'],
    ['https://www.youtube.com/watch?v=lofi', 'ok'], ['https://open.spotify.com', 'ok'], ['https://developer.apple.com/documentation', 'ok'], ['https://www.google.com/search?q=pomodoro', 'ok']];
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  SAMPLES.forEach(function (s) {
    $('chips').appendChild(el('button', { type: 'button', class: 'chip ' + s[1], text: hostOf(s[0]), on: { click: function () { typeInto($('addr'), s[0]); visit(s[0]); } } }));
  });
  function normalize(v) { v = v.trim(); return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? 'https://' + v : v; }
  /* Cosmetic: the address types itself out. The visit itself is applied at once, so no control waits for it. */
  function typeInto(input, text) {
    input.value = text;
    if (!FX.on()) return;
    var t = 0, dur = Math.min(450, 16 * text.length);
    input.value = '';
    snd.play('type');
    var ok = FX.task(function (dt) {
      t += dt * 1000; input.value = FX.pure.typingSlice(text, t, dur);
      if (t >= dur) { input.value = text; return false; }
    });
    if (!ok) input.value = text;
  }
  function visit(given) {
    var url = normalize(given || $('addr').value), before = S.log.length;
    sim.visit(url);
    var last = S.log[S.log.length - 1];
    if (S.phase === 'running' && S.log.length > before && last.kind === 'block') { snd.play('block'); FX.distract(); restart($('page-view'), 'slide'); }
    if (S.phase !== 'running') $('page-view').textContent = 'Tab: ' + url + '  (no session running, so nothing is filtered)';
    render();
  }
  $('go-form').addEventListener('submit', function (e) { e.preventDefault(); visit(); });
  $('automation').addEventListener('change', function () { S.automation = this.checked; });

  /* ---- terminal ---- */
  $('term-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var cmd = $('term-in').value.trim().replace(/\s+/g, ' '); $('term-in').value = '';
    var out = '';
    if (cmd === 'focuslock status') out = S.phase === 'running' ? 'FocusLock is running (pid 4242).' : 'FocusLock is not running.';
    else if (cmd === 'focuslock unlock' || cmd === 'focuslock stop') {
      if (sim.emergencyExit('focuslock unlock')) { out = 'FocusLock stopped: session over.'; snd.play('exit'); } else out = "FocusLock wasn't running.";
    } else if (cmd === '') out = '';
    else out = 'Usage: focuslock [start|stop|unlock|status|build]  (the simulator knows status, unlock and stop)';
    $('term-out').textContent = cmd + '\n' + out;
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && e.shiftKey && (e.metaKey || e.ctrlKey) && S.overlay) {
      e.preventDefault();
      if (sim.emergencyExit('keyboard shortcut')) { snd.play('exit'); render(); }
    }
  });

  /* ---- FocusLock window ---- */
  var win = $('win'), minutes = 25, sheet = false, lastMin = 25;
  var C = 2 * Math.PI * 80;

  function chrome() {
    return el('div', { class: 'chrome' }, [el('i'), el('i'), el('i'), el('span', { text: 'FocusLock' })]);
  }
  function setupView() {
    var seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Session length' });
    [25, 45, 60, 90].forEach(function (m) {
      var r = el('input', { type: 'radio', name: 'mins', id: 'm' + m, value: m });
      if (m === minutes) r.checked = true;
      r.addEventListener('change', function () { minutes = m; render(); });
      seg.appendChild(el('label', { for: 'm' + m }, [r, el('span', { text: m + ' min' })]));
    });
    var kids = [
      el('h3', { text: 'FocusLock' }),
      el('p', { class: 'meta', style: 'text-align:left', text: 'A timer plus a distraction blocker, nothing more. Every app stays usable. Social media and LLM sites get redirected; any LLM program pauses your timer until you close it.' }),
      seg, el('div', { class: 'spacer' })
    ];
    if (S.blockers.length) {
      var ul = el('ul'); S.blockers.forEach(function (b) { ul.appendChild(el('li', { text: b })); });
      kids.push(el('div', { class: 'note-box', role: 'alert' }, [el('strong', { text: 'Close these before locking in:' }), ul,
        el('span', { text: 'Starting with an LLM open would drop you straight onto a paused screen. Untick them in the pretend Mac, then try again.' })]));
    }
    kids.push(el('button', { class: 'btn primary', type: 'button', id: 'lock', text: S.blockers.length ? 'I closed them: check again and lock in' : 'Lock in for ' + minutes + ' minutes',
      on: { click: function () { lastMin = minutes; var r = sim.start(minutes); if (r.ok) { FX.resetDial(); snd.play('start'); announce('Session started.'); scanPulse(); } else announce('Close ' + r.blockers.join(', ') + ' first.'); render(); } } }));
    return kids;
  }
  /* The dial is built once and kept, so its ring and glow animate smoothly across re-renders. */
  var NS = 'http://www.w3.org/2000/svg';
  var dialNode = el('div', { class: 'dial', role: 'timer' }), dialSvg = document.createElementNS(NS, 'svg'),
      dialGlow = el('div', { class: 'glow', 'aria-hidden': 'true' }), dialText = el('div', { class: 't' });
  dialSvg.setAttribute('viewBox', '0 0 190 190'); dialSvg.setAttribute('aria-hidden', 'true');
  dialSvg.innerHTML = '<circle class="track" cx="95" cy="95" r="80"></circle><circle class="prog" cx="95" cy="95" r="80" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '"></circle>';
  dialNode.appendChild(dialGlow); dialNode.appendChild(dialSvg); dialNode.appendChild(dialText);
  var dialProg = dialSvg.querySelector('.prog');
  function frac() { return S.total ? (S.total - S.remaining) / S.total : 0; }
  function updateDial() {
    dialNode.classList.toggle('paused', sim.paused);
    dialNode.setAttribute('aria-label', 'Time remaining ' + FL.formatTime(S.remaining));
    var txt = FL.formatTime(S.remaining); if (dialText.textContent !== txt) dialText.textContent = txt;
    FX.setDial(frac());
  }

  function sessionView() {
    var paused = sim.paused;
    updateDial();
    var kids = [
      el('div', { class: 'status ' + (paused ? 'paused' : 'ok'), text: paused ? 'Paused: LLM detected' : 'Locked in' }),
      dialNode,
      el('div', { class: 'meta' + (S.violations !== lastViolations ? ' bump' : ''), text: S.violations ? S.violations + ' distraction' + (S.violations === 1 ? '' : 's') + ' blocked' + (S.last ? ' · last: ' + S.last : '') : '' }),
      el('div', { class: 'spacer' })
    ];
    if (sheet) {
      kids.push(el('div', { class: 'sheet', role: 'alertdialog', 'aria-label': 'End the session early?' }, [
        el('strong', { text: 'End the session early?' }), el('div', { class: 'meta', style: 'text-align:left', text: Math.ceil(S.remaining / 60) + ' minutes left on the clock.' }),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn primary small', type: 'button', id: 'keep', text: 'Keep going', on: { click: function () { sheet = false; render(); } } }),
          el('button', { class: 'btn warn small', type: 'button', text: 'End session', on: { click: function () { sheet = false; sim.endEarly(); snd.play('exit'); render(); } } })])]));
    } else {
      kids.push(el('button', { class: 'btn warn small', type: 'button', text: 'End session early…', on: { click: function () { sheet = true; render(); setTimeout(function () { var k = $('keep'); if (k) k.focus(); }, 0); } } }));
      kids.push(el('button', { class: 'linkbtn', type: 'button', text: 'Quit FocusLock (⌘Q)', title: 'Quitting during a session asks first instead of quitting', on: { click: function () { sheet = true; render(); } } }));
    }
    return kids;
  }
  function finishedView() {
    return [el('div', { class: 'spacer' }), el('h3', { text: 'Session complete', style: 'text-align:center' }),
      el('div', { class: 'meta', text: Math.round(S.total / 60) + ' focused minutes · ' + S.violations + ' distraction' + (S.violations === 1 ? '' : 's') + ' blocked' }),
      el('button', { class: 'btn primary', type: 'button', text: 'Start another', on: { click: function () { sim.reset(); render(); } } }), el('div', { class: 'spacer' })];
  }

  function overlayView() {
    var o = S.overlay, slot = $('overlay-slot');
    var key = o ? o.kind + (o.processes ? o.processes.join() : '') + (o.site || '') : '';
    if (slot.getAttribute('data-key') === key) return;
    slot.setAttribute('data-key', key);
    var old = slot.firstElementChild;
    if (!o) {
      /* The overlay lifts away instead of vanishing; it never blocks the controls underneath while it goes. */
      if (old && FX.on() && !old.classList.contains('out')) { old.classList.add('out'); later(function () { if (old.parentNode && old.classList.contains('out')) old.remove(); }, 520); }
      else slot.textContent = '';
      return;
    }
    slot.textContent = '';
    var sosBtn = el('button', { class: 'btn warn small sos', type: 'button', id: 'sos', text: 'Emergency exit: end session now', on: { click: function () {
      ripple(sosBtn); sim.emergencyExit('SOS button'); snd.play('exit'); snd.play('ripple'); render(); } } });
    var foot = el('div', { class: 'foot' }, [sosBtn,
      el('div', { style: 'margin-top:.5rem', text: 'also: Ctrl+Shift+Esc here (⌘⇧Esc on a Mac) · or run  focuslock unlock  in a terminal' })]);
    var inner;
    if (o.kind === 'llm') {
      inner = [el('h3', { text: 'No LLM shortcuts.' }), el('p', { class: 'procs', text: 'Running: ' + o.processes.join(', ') }),
        el('p', { text: 'The struggle is the workout: outsourcing it skips the rep. Your timer is paused until they are closed. It resumes automatically.' }),
        el('button', { class: 'btn primary', type: 'button', text: 'Give me 30 seconds to close it', on: { click: function () { sim.grantGrace(); render(); } } }), foot];
    } else if (o.kind === 'unreadable') {
      inner = [el('h3', { text: "Can't see the browser tab" }),
        el('p', { text: 'Allow FocusLock to control the browser in System Settings, Privacy and Security, Automation. Until then the browser stays locked.' }), foot];
    } else {
      inner = [el('h3', { text: o.category === 'LLM' ? 'No LLM shortcuts' : o.site + ' can wait' }),
        el('p', { text: 'Search, docs, YouTube and music are all fine during focus; ' + o.site + " isn't. Redirected you out of there." }), foot];
    }
    slot.appendChild(el('div', { class: 'overlay ' + (o.kind === 'llm' ? 'llm' : 'browser'), role: 'alertdialog', 'aria-label': 'FocusLock overlay' }, [el('div', {}, inner)]));
    if (o.kind === 'llm') snd.play('whoosh');
  }

  /* A ring that spreads from the SOS button, then fades. Decorative; the exit has already happened. */
  function ripple(btn) {
    if (!FX.on()) return;
    var sr = $('stage').getBoundingClientRect(), br = btn.getBoundingClientRect();
    var r = el('div', { class: 'ripple', 'aria-hidden': 'true', style: 'left:' + (br.left + br.width / 2 - sr.left) + 'px;top:' + (br.top + br.height / 2 - sr.top) + 'px' });
    $('stage').appendChild(r); later(function () { r.remove(); }, 900);
  }

  var lastLogCount = -1, lastPaused = false, lastPhase = '', lastWinKey = '', lastViolations = 0;
  function render() {
    var phase = S.phase, kids, key;
    if (phase !== 'running') sheet = false;
    key = phase + '|' + (phase === 'running' ? sim.paused + '|' + S.violations + '|' + sheet + (sheet ? Math.ceil(S.remaining / 60) : '') : minutes + S.blockers.join());
    if (phase === 'running') updateDial();
    if (key !== lastWinKey) {
      kids = phase === 'running' ? sessionView() : phase === 'finished' ? finishedView() : setupView();
      var focusedId = document.activeElement && win.contains(document.activeElement) ? document.activeElement.id : '';
      win.textContent = ''; win.appendChild(chrome());
      var body = el('div', { class: 'body' }, kids); win.appendChild(body);
      if (focusedId && $(focusedId)) $(focusedId).focus();
      lastWinKey = key; lastViolations = S.violations;
    }
    overlayView();
    if (S.phase === 'running' && S.tab !== 'about:blank') $('page-view').textContent = 'Tab: ' + S.tab;
    else if (S.phase === 'running') $('page-view').textContent = 'Tab: about:blank' + (S.violations ? '  (redirected here)' : '');
    renderLog();
    markRows();
    if (lastPhase === 'running' && phase === 'finished') { snd.play('finish'); announce('Session complete.'); }
    if (phase === 'running') {
      if (sim.paused && !lastPaused) {
        snd.play('pause'); announce('Timer paused: ' + S.detected.join(', ') + ' detected.');
        if (FX.on()) { restart(dialNode, 'settle'); FX.distract(); if ($('shake').checked) restart($('stage'), 'shake'); }
      }
      if (!sim.paused && lastPaused) { snd.play('resume'); snd.play('lift'); announce('Timer resumed.'); if (FX.on()) restart(dialNode, 'rise-back'); }
    }
    if (phase === 'idle' && lastPhase === 'running') FX.resetDial();
    lastPaused = phase === 'running' && sim.paused; lastPhase = phase;
    FX.refresh();
  }
  /* Programs the watchdog has found stay tinted until they are closed. */
  function markRows() {
    var rows = apps.querySelectorAll('.approw');
    FL.LLM_PROGRAMS.forEach(function (name, i) { rows[i].classList.toggle('hit', S.phase === 'running' && S.detected.indexOf(name) >= 0); });
  }
  function renderLog() {
    if (S.log.length === lastLogCount) return;
    lastLogCount = S.log.length;
    var ol = $('log'); ol.textContent = '';
    if (!S.log.length) { ol.appendChild(el('li', { class: 'empty', text: 'Nothing yet. Start a session.' })); return; }
    S.log.slice().reverse().forEach(function (l) {
      var kids = [el('span', { class: 'tag ' + l.kind, text: l.kind }), l.text];
      if (l.why) kids.push(el('span', { class: 'why', text: 'Why: ' + l.why }));
      ol.appendChild(el('li', {}, kids));
    });
  }

  setInterval(function () {
    if (S.phase !== 'running') return;
    sim.tick(parseInt($('speed').value, 10) || 1);
    if (S.phase === 'running' && S.scanIn === FL.SCAN_EVERY) scanPulse();
    render();
  }, 1000);
  function scanPulse() { if (FX.startSweep()) snd.play('scan'); }
  /* When the tab is hidden the timers throttle; that only slows the demo. */

  /* ---- filter probe ---- */
  var PROBES = ['https://old.reddit.com/r/adhd', 'https://notreddit.com', 'https://www.youtube.com/watch?v=lofi', 'https://chat.openai.com', 'about:blank', 'file:///notes/todo.html', 'https://docs.swift.org'];
  PROBES.forEach(function (u) { $('probe-chips').appendChild(el('button', { type: 'button', class: 'chip', text: u.replace(/^https:\/\//, ''), on: { click: function () { $('probe').value = u; probe(true); } } })); });
  function probe(fromUser) {
    var u = normalize($('probe').value), v = FL.verdictForUrl(u), box = $('verdict');
    box.className = 'verdict ' + v.kind; box.textContent = '';
    box.appendChild(el('strong', { text: v.kind === 'blocked' ? 'Redirected: ' + v.site + ' (' + v.category + ')' : 'Allowed' }));
    box.appendChild(el('div', { text: v.reason }));
    if (fromUser) { restart(box, 'stamp'); snd.play('stamp'); }
  }
  $('probe-form').addEventListener('submit', function (e) { e.preventDefault(); probe(true); });
  FL.BLOCKLIST.forEach(function (r) {
    $(r.category === 'LLM' ? 'list-llm' : 'list-social').appendChild(el('li', { text: r.domain }));
  });
  probe(); render();
  FX.init({
    stage: $('stage'), canvas: $('fx-canvas'), simEl: $('sim'), state: S, sweepEl: sweepEl, sweepHost: apps,
    paused: function () { return sim.paused; },
    rows: function () { return Array.prototype.slice.call(apps.querySelectorAll('.approw')); },
    dial: function () { return { prog: dialProg, glow: dialGlow, circ: C }; }
  });
  /* Scroll feel: a thin progress line, and gentle reveals that never hide anything for long. */
  var sbar = $('scrollbar'), pend = false;
  function onScroll() {
    if (pend) return; pend = true;
    requestAnimationFrame(function () {
      pend = false; var max = root.scrollHeight - innerHeight;
      sbar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0).toFixed(4) + ')';
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.card, .panel, .steps li, .priv, .verdict'));
  revealEls.forEach(function (n, i) { n.classList.add('reveal'); n.style.setProperty('--d', ((i % 3) * 0.07).toFixed(2) + 's'); });
  function showAll() { revealEls.forEach(function (n) { n.classList.add('in'); }); }
  if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }); }, { threshold: 0.08 });
    revealEls.forEach(function (n) { rio.observe(n); });
    later(showAll, 3000);
  } else showAll();
  /* Looping decoration (the hero halo) rests while it is off screen. */
  if ('IntersectionObserver' in window) {
    var hero = document.querySelector('.breath');
    new IntersectionObserver(function (es) { hero.classList.toggle('off', !es[0].isIntersecting); }).observe(hero);
  }

})();
