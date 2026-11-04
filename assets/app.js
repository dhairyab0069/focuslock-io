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
  var apps = $('apps');
  FL.LLM_PROGRAMS.forEach(function (name, i) {
    var cb = el('input', { type: 'checkbox', id: 'app' + i });
    cb.addEventListener('change', function () { sim.setApp(name, cb.checked); render(); });
    apps.appendChild(el('label', { for: 'app' + i }, [cb, el('span', { text: name })]));
  });

  /* ---- pretend browser ---- */
  var SAMPLES = [['https://www.reddit.com/r/macapps', 'no'], ['https://x.com/home', 'no'], ['https://claude.ai/chat', 'no'],
    ['https://www.youtube.com/watch?v=lofi', 'ok'], ['https://open.spotify.com', 'ok'], ['https://developer.apple.com/documentation', 'ok'], ['https://www.google.com/search?q=pomodoro', 'ok']];
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  SAMPLES.forEach(function (s) {
    $('chips').appendChild(el('button', { type: 'button', class: 'chip ' + s[1], text: hostOf(s[0]), on: { click: function () { $('addr').value = s[0]; visit(); } } }));
  });
  function normalize(v) { v = v.trim(); return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? 'https://' + v : v; }
  function visit() {
    var url = normalize($('addr').value), before = S.log.length;
    sim.visit(url);
    var last = S.log[S.log.length - 1];
    if (S.phase === 'running' && S.log.length > before && last.kind === 'block') snd.play('block');
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
      on: { click: function () { lastMin = minutes; var r = sim.start(minutes); if (r.ok) { snd.play('start'); announce('Session started.'); } else announce('Close ' + r.blockers.join(', ') + ' first.'); render(); } } }));
    return kids;
  }
  function sessionView() {
    var paused = sim.paused, off = C * (1 - (S.total - S.remaining) / S.total);
    var dial = el('div', { class: 'dial' + (paused ? ' paused' : ''), role: 'timer', 'aria-label': 'Time remaining ' + FL.formatTime(S.remaining) }, [
      document.createElementNS('http://www.w3.org/2000/svg', 'svg'), el('div', { class: 't', text: FL.formatTime(S.remaining) })]);
    var svg = dial.firstChild; svg.setAttribute('viewBox', '0 0 190 190'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<circle class="track" cx="95" cy="95" r="80"></circle><circle class="prog" cx="95" cy="95" r="80" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>';
    var kids = [
      el('div', { class: 'status ' + (paused ? 'paused' : 'ok'), text: paused ? 'Paused: LLM detected' : 'Locked in' }),
      dial,
      el('div', { class: 'meta', text: S.violations ? S.violations + ' distraction' + (S.violations === 1 ? '' : 's') + ' blocked' + (S.last ? ' · last: ' + S.last : '') : '' }),
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
    slot.setAttribute('data-key', key); slot.textContent = '';
    if (!o) return;
    var foot = el('div', { class: 'foot' }, [
      el('button', { class: 'btn warn small', type: 'button', id: 'sos', text: 'Emergency exit: end session now', on: { click: function () { sim.emergencyExit('SOS button'); snd.play('exit'); render(); } } }),
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
  }

  var lastLogCount = -1, lastPaused = false, lastPhase = '', lastWinKey = '';
  function render() {
    var phase = S.phase, kids, key;
    if (phase !== 'running') sheet = false;
    kids = phase === 'running' ? sessionView() : phase === 'finished' ? finishedView() : setupView();
    key = phase + '|' + (phase === 'running' ? S.remaining + sim.paused + S.violations + sheet : minutes + S.blockers.join());
    if (key !== lastWinKey) {
      var focusedId = document.activeElement && win.contains(document.activeElement) ? document.activeElement.id : '';
      win.textContent = ''; win.appendChild(chrome());
      var body = el('div', { class: 'body' }, kids); win.appendChild(body);
      if (focusedId && $(focusedId)) $(focusedId).focus();
      lastWinKey = key;
    }
    overlayView();
    if (S.phase === 'running' && S.tab !== 'about:blank') $('page-view').textContent = 'Tab: ' + S.tab;
    else if (S.phase === 'running') $('page-view').textContent = 'Tab: about:blank' + (S.violations ? '  (redirected here)' : '');
    renderLog();
    if (lastPhase === 'running' && phase === 'finished') { snd.play('finish'); announce('Session complete.'); }
    if (phase === 'running') {
      if (sim.paused && !lastPaused) { snd.play('pause'); announce('Timer paused: ' + S.detected.join(', ') + ' detected.'); }
      if (!sim.paused && lastPaused) { snd.play('resume'); announce('Timer resumed.'); }
    }
    lastPaused = phase === 'running' && sim.paused; lastPhase = phase;
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

  setInterval(function () { if (S.phase === 'running') { sim.tick(parseInt($('speed').value, 10) || 1); render(); } }, 1000);
  /* When the tab is hidden the timers throttle; that only slows the demo. */

  /* ---- filter probe ---- */
  var PROBES = ['https://old.reddit.com/r/adhd', 'https://notreddit.com', 'https://www.youtube.com/watch?v=lofi', 'https://chat.openai.com', 'about:blank', 'file:///notes/todo.html', 'https://docs.swift.org'];
  PROBES.forEach(function (u) { $('probe-chips').appendChild(el('button', { type: 'button', class: 'chip', text: u.replace(/^https:\/\//, ''), on: { click: function () { $('probe').value = u; probe(); } } })); });
  function probe() {
    var u = normalize($('probe').value), v = FL.verdictForUrl(u), box = $('verdict');
    box.className = 'verdict ' + v.kind; box.textContent = '';
    box.appendChild(el('strong', { text: v.kind === 'blocked' ? 'Redirected: ' + v.site + ' (' + v.category + ')' : 'Allowed' }));
    box.appendChild(el('div', { text: v.reason }));
  }
  $('probe-form').addEventListener('submit', function (e) { e.preventDefault(); probe(); });
  FL.BLOCKLIST.forEach(function (r) {
    $(r.category === 'LLM' ? 'list-llm' : 'list-social').appendChild(el('li', { text: r.domain }));
  });
  probe(); render();
})();
