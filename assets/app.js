/* FocusLock page: glue. The FocusLock window itself, the overlay, the one-second clock, scenario distractions
   and banners, keyboard shortcuts, the quiet switches and the filter probe. */
(function () {
  'use strict';
  var UI = window.FLUI, el = UI.el, $ = UI.$, restart = UI.restart, later = UI.later, announce = UI.announce, G = window.FLG, FL = window.FL, R = window.FLRules, SC = window.FLScenario, SCORE = window.FLScore, K = window.FLKeys, snd = window.FLSound;
  var sim = G.sim, S = sim.state, root = document.documentElement, sched = null, sheet = false, lastViolations = 0;

  /* ---------- quiet settings ---------- */
  var calm = $('sw-calm'), sound = $('sw-sound');
  calm.checked = root.getAttribute('data-calm') === 'on';
  calm.addEventListener('change', function () { root.setAttribute('data-calm', calm.checked ? 'on' : 'off'); UI.save('fl-calm', calm.checked ? 'on' : 'off'); });
  sound.addEventListener('change', function () { snd.set(sound.checked); snd.play('click'); });
  $('quiet-all').addEventListener('click', function () { calm.checked = true; calm.dispatchEvent(new Event('change')); sound.checked = false; snd.set(false); announce('Motion and sound are off.'); });

  /* ---------- the FocusLock window ---------- */
  var C = 2 * Math.PI * 80, NS = 'http://www.w3.org/2000/svg';
  var dialNode = el('div', { class: 'dial', role: 'timer' }), dialSvg = document.createElementNS(NS, 'svg'), dialGlow = el('div', { class: 'glow', 'aria-hidden': 'true' }), dialText = el('div', { class: 't' });
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

  var flBody = null, lastKey = '';
  G.buildFocusLock = function (body) { flBody = body; lastKey = ''; return { render: flRender }; };
  G.askEnd = function () { if (S.phase === 'running') { sheet = true; G.bus.emit('quit-sheet'); lastKey = ''; flRender(); G.openApp('focuslock', { quiet: true }); later(function () { var k = $('keep'); if (k) k.focus(); }, 0); } };

  function flRender() {
    if (!flBody) return;
    var phase = S.phase, mins = G.rules.mins;
    if (phase !== 'running') sheet = false;
    var key = phase + '|' + (phase === 'running' ? sim.paused + '|' + S.violations + '|' + sheet + (sheet ? Math.ceil(S.remaining / 60) : '') : mins + '|' + S.blockers.join());
    if (phase === 'running') updateDial();
    if (key !== lastKey) {
      var focusedId = document.activeElement && flBody.contains(document.activeElement) ? document.activeElement.id : '';
      flBody.textContent = '';
      (phase === 'running' ? sessionView() : phase === 'finished' ? finishedView() : setupView()).forEach(function (k) { flBody.appendChild(k); });
      if (focusedId && $(focusedId)) $(focusedId).focus();
      lastKey = key; lastViolations = S.violations;
    }
  }
  function setupView() {
    var mins = G.rules.mins, opts = [25, 45, 60, 90]; if (opts.indexOf(mins) < 0) opts.push(mins); opts.sort(function (a, b) { return a - b; });
    var seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Session length' });
    opts.forEach(function (m) {
      var r = el('input', { type: 'radio', name: 'mins', id: 'm' + m, value: m }); if (m === mins) r.checked = true;
      r.addEventListener('change', function () { G.setRules(R.setMins(G.rules, m)); });
      seg.appendChild(el('label', { for: 'm' + m }, [r, el('span', { text: m + ' min' })]));
    });
    var kids = [el('h3', { text: 'FocusLock' }),
      el('p', { class: 'meta left', text: 'A timer plus a distraction blocker, nothing more. Every app stays usable. Social media and LLM sites get redirected; any LLM program pauses your timer until you close it.' }), seg, el('div', { class: 'spacer' })];
    if (S.blockers.length) {
      var ul = el('ul'); S.blockers.forEach(function (b) { ul.appendChild(el('li', { text: b })); });
      kids.push(el('div', { class: 'note-box', role: 'alert' }, [el('strong', { text: 'Close these before locking in:' }), ul, el('span', { text: 'Starting with an LLM open would drop you straight onto a paused screen. Close them (the Dock or the X-ray panel can quit them), then try again.' })]));
    }
    kids.push(el('button', { class: 'btn primary', type: 'button', id: 'lock', 'data-magnet': '', text: S.blockers.length ? 'I closed them: check again and lock in' : 'Lock in for ' + mins + ' minutes', on: { click: function () { G.lockIn(); } } }));
    return kids;
  }
  function sessionView() {
    var paused = sim.paused; updateDial();
    var kids = [el('div', { class: 'status ' + (paused ? 'paused' : 'ok'), text: paused ? 'Paused: LLM detected' : 'Locked in' }), dialNode,
      el('div', { class: 'meta' + (S.violations !== lastViolations ? ' bump' : ''), text: S.violations ? S.violations + ' distraction' + (S.violations === 1 ? '' : 's') + ' blocked' + (S.last ? ' · last: ' + S.last : '') : '' }), el('div', { class: 'spacer' })];
    if (sheet) {
      kids.push(el('div', { class: 'sheet', role: 'alertdialog', 'aria-label': 'End the session early?' }, [el('strong', { text: 'End the session early?' }),
        el('div', { class: 'meta left', text: Math.ceil(S.remaining / 60) + ' minutes left on the clock.' }),
        el('div', { class: 'row between' }, [el('button', { class: 'btn primary small', type: 'button', id: 'keep', text: 'Keep going', on: { click: function () { sheet = false; G.render(); } } }),
          el('button', { class: 'btn warn small', type: 'button', text: 'End session', on: { click: function () { sheet = false; sim.endEarly(); snd.play('exit'); G.render(); } } })])]));
    } else {
      kids.push(el('button', { class: 'btn warn small', type: 'button', text: 'End session early…', on: { click: function () { G.askEnd(); } } }));
      kids.push(el('button', { class: 'linkbtn', type: 'button', text: 'Quit FocusLock (⌘Q)', title: 'Quitting during a session asks first instead of quitting', on: { click: function () { G.askEnd(); } } }));
    }
    return kids;
  }
  function finishedView() {
    return [el('div', { class: 'spacer' }), el('h3', { text: 'Session complete', class: 'center' }),
      el('div', { class: 'meta', text: Math.round(S.total / 60) + ' focused minutes · ' + S.violations + ' distraction' + (S.violations === 1 ? '' : 's') + ' blocked' }),
      el('button', { class: 'btn primary', type: 'button', text: 'Start another', on: { click: function () { sim.reset(); G.render(); } } }), el('div', { class: 'spacer' })];
  }
  G.renderers.push(flRender);

  /* ---------- sessions ---------- */
  G.lockIn = function () {
    if (!G.isOpen('focuslock')) G.openApp('focuslock', { quiet: true });
    var r = sim.start(G.rules.mins);
    if (r.ok) {
      FX.resetDial(); snd.play('start'); announce('Session started.');
      sched = G.prefs.distractions ? SC.createScheduler(SC.schedule(SC.scenario(G.scenarioId), S.total)) : null;
      scanPulse();
    } else announce('Close ' + r.blockers.join(', ') + ' first.');
    lastKey = ''; G.render(); return r;
  };
  G.quietStop = false;
  sim.on(function (e) {
    G.bus.emit('log', e);
    if (['finish', 'end', 'exit'].indexOf(e.kind) >= 0 && !G.quietStop) {
      var rec = SCORE.makeRecord(sim, { at: Date.now(), scenario: G.scenarioId, preset: G.presetId });
      if (rec.total > 0) { G.history.push(rec); if (G.history.length > SCORE.MAX_HISTORY) G.history.shift(); G.persist(); G.bus.emit('history', rec); }
    }
    if (['finish', 'end', 'exit'].indexOf(e.kind) >= 0) { sched = null; clearBanners(); }
  });

  function scanPulse() { if (FX.startSweep()) snd.play('scan'); }
  setInterval(function () {
    if (S.phase !== 'running') return;
    var speed = parseInt($('speed').value, 10) || 1;
    sim.tick(speed);
    if (S.phase === 'running' && S.scanIn === FL.SCAN_EVERY) scanPulse();
    if (S.phase === 'running' && sched && !sim.paused) sched.due(S.total - S.remaining).forEach(dispatch);
    G.afterTick(); G.render();
  }, 1000);

  /* ---------- distractions that arrive on their own ---------- */
  var bannerHost = $('banners'), toastHost = $('toasts');
  function clearBanners() { bannerHost.textContent = ''; }
  G.toast = function (text) {
    var t = el('div', { class: 'toast', role: 'status', text: text }); toastHost.appendChild(t); later(function () { t.remove(); }, 4200);
    while (toastHost.children.length > 2) toastHost.firstChild.remove();
  };
  function elapsed() { return S.total - S.remaining; }
  function dispatch(ev) {
    if (ev.kind === 'tab') { G.newTab(ev.url, false); G.openApp; banner(ev, 'tab'); }
    else if (ev.kind === 'launch') {
      if (ev.proc === 'claude-cli') { if (!G.extraProcs.some(function (p) { return p.tty === 'bg'; })) G.extraProcs.push({ pid: 4301, name: 'claude', app: null, cmd: 'claude', tty: 'bg' }); }
      else G.openApp(ev.proc, { quiet: true });
      banner(ev, 'launch');
    } else banner(ev, 'banner');
    G.render();
  }
  G.dispatch = dispatch;
  function banner(ev, kind) {
    var b = el('div', { class: 'banner', role: 'group', 'aria-label': 'Notification: ' + ev.text, draggable: kind === 'banner' ? 'true' : false });
    b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', ev.text); e.dataTransfer.effectAllowed = 'copy'; });
    var actions = el('div', { class: 'bacts' });
    function done(kindNote, text, why) { if (S.phase === 'running') sim.note(kindNote, text, why); b.remove(); G.render(); }
    function btn(label, fn, cls) { actions.appendChild(el('button', { class: 'btn small ' + (cls || ''), type: 'button', text: label, on: { click: fn } })); }
    if (kind === 'banner') {
      G.pushMessage(ev.from || 'Messages', ev.text);
      btn('Let it pass', function () { done('resist', 'You let a nudge pass: "' + ev.text + '"', 'Nothing needed doing. The clock kept going.'); G.toast('Let that one go by. Nicely done.'); snd.play('pass'); }, 'primary');
      if (sched && (ev.snoozed || 0) < 3) btn('Snooze 5 min', function () { sched.snooze(ev, elapsed(), 300); done('snooze', 'Snoozed a nudge for 5 minutes.', 'It will come back later, up to three times.'); snd.play('click'); });
      btn('Open it', function () { done('open', 'You opened the nudge.', 'It led to ' + (ev.open && ev.open.url ? G.hostOf(ev.open.url) : 'somewhere') + '. The watchdog checks the front tab within ' + FL.BROWSER_POLL + ' seconds.'); if (ev.open && ev.open.url) G.navigate(ev.open.url); });
      btn('Park in Notes', function () { G.dropOnNotes(ev.text); b.remove(); G.render(); });
    } else if (kind === 'tab') {
      btn('Let it be', function () { done('resist', 'You left a tempting tab alone.', 'Only the front tab is read, so a background tab does nothing until you switch to it.'); G.toast('Left alone. Fine.'); }, 'primary');
      btn('Close it', function () { var t = G.browser.tabs.filter(function (x) { return x.url === ev.url; })[0]; if (t) G.closeTab(t.id); done('resist', 'You closed a tempting tab.', ''); });
      btn('Look at it', function () { var t = G.browser.tabs.filter(function (x) { return x.url === ev.url; })[0]; if (t) G.browser.active = t.id; G.openApp('browser'); G.updateBrowser(); done('open', 'You switched to the tempting tab.', 'Now it is the front tab, so the next check will redirect it.'); });
    } else {
      btn('Quit it', function () { if (ev.proc === 'claude-cli') G.extraProcs = G.extraProcs.filter(function (p) { return p.tty !== 'bg'; }); else G.closeApp(ev.proc); done('resist', 'You quit the program that opened itself.', 'The next scan sees a clean machine and the clock resumes.'); }, 'primary');
      btn('Keep it open', function () { b.remove(); });
    }
    b.insertBefore(el('div', { class: 'btext' }, [el('strong', { text: kind === 'banner' ? (ev.from || 'Messages') : 'Heads up' }), el('span', { text: ev.text })]), b.firstChild);
    b.appendChild(actions); bannerHost.appendChild(b); snd.play('notify');
    while (bannerHost.children.length > 3) bannerHost.firstChild.remove();
    announce('Notification: ' + ev.text);
  }
  G.bus.on('parked', function (text) { if (S.phase === 'running') sim.note('park', 'You parked a nudge in Notes for later.', 'Written down is safely out of your head.'); G.toast('Parked in Notes. It will keep.'); });

  /* ---------- the overlay ---------- */
  var slot = $('overlay-slot');
  function overlayView() {
    var o = S.overlay, key = o ? o.kind + (o.processes ? o.processes.join() : '') + (o.site || '') : '';
    if (slot.getAttribute('data-key') === key) return;
    slot.setAttribute('data-key', key); var old = slot.firstElementChild;
    if (!o) {
      if (old && FX.on() && !old.classList.contains('out')) { old.classList.add('out'); later(function () { if (old.parentNode && old.classList.contains('out')) old.remove(); }, 520); } else slot.textContent = '';
      return;
    }
    slot.textContent = '';
    var sos = el('button', { class: 'btn warn small sos', type: 'button', id: 'sos', text: 'Emergency exit: end session now', on: { click: function () { ripple(sos); sim.emergencyExit('SOS button'); snd.play('exit'); snd.play('ripple'); G.render(); } } });
    var foot = el('div', { class: 'foot' }, [sos, el('div', { class: 'footnote', text: 'also: Ctrl+Shift+Esc here (⌘⇧Esc on a Mac) · or run  focuslock unlock  in a terminal' })]);
    var inner;
    if (o.kind === 'llm') inner = [el('h3', { text: 'No LLM shortcuts.' }), el('p', { class: 'procs', text: 'Running: ' + o.processes.join(', ') }),
      el('p', { text: 'The struggle is the workout: outsourcing it skips the rep. Your timer is paused until they are closed. It resumes automatically.' }),
      el('button', { class: 'btn primary', type: 'button', id: 'grace', text: 'Give me ' + sim.rules.grace + ' seconds to close it', on: { click: function () { sim.grantGrace(); G.render(); } } }), foot];
    else if (o.kind === 'unreadable') inner = [el('h3', { text: "Can't see the browser tab" }), el('p', { text: 'Allow FocusLock to control the browser in System Settings, Privacy and Security, Automation. Until then the browser stays locked.' }), foot];
    else inner = [el('h3', { text: o.category === 'LLM' ? 'No LLM shortcuts' : o.site + ' can wait' }), el('p', { text: 'Search, docs, YouTube and music are all fine during focus; ' + o.site + " isn't. Redirected you out of there." }), foot];
    slot.appendChild(el('div', { class: 'overlay ' + (o.kind === 'llm' ? 'llm' : 'browser'), role: 'alertdialog', 'aria-label': 'FocusLock overlay' }, [el('div', {}, inner)]));
    if (o.kind === 'llm') snd.play('whoosh');
  }
  function ripple(btn) {
    if (!FX.on()) return; var sr = $('desktop').getBoundingClientRect(), br = btn.getBoundingClientRect();
    var r = el('div', { class: 'ripple', 'aria-hidden': 'true', style: 'left:' + (br.left + br.width / 2 - sr.left) + 'px;top:' + (br.top + br.height / 2 - sr.top) + 'px' });
    $('desktop').appendChild(r); later(function () { r.remove(); }, 900);
  }

  var lastPaused = false, lastPhase = '';
  function stateEffects() {
    overlayView();
    var si = $('status-item');
    if (si) { si.textContent = S.phase === 'running' ? (sim.paused ? 'Paused ' : 'Locked ') + FL.formatTime(S.remaining) : 'FocusLock'; si.classList.toggle('paused', sim.paused); }
    if (lastPhase === 'running' && S.phase === 'finished') { snd.play('finish'); announce('Session complete.'); G.toast('Session complete. Well done for sitting down to it.'); }
    if (S.phase === 'running') {
      if (sim.paused && !lastPaused) { snd.play('pause'); announce('Timer paused: ' + S.detected.join(', ') + ' detected.'); if (FX.on()) { restart(dialNode, 'settle'); FX.distract(); if (G.prefs.shake) restart($('desktop'), 'shake'); } }
      if (!sim.paused && lastPaused) { snd.play('resume'); snd.play('lift'); announce('Timer resumed.'); G.toast('Back on the clock. Coming back is the skill.'); if (FX.on()) restart(dialNode, 'rise-back'); }
    }
    if (S.phase === 'idle' && lastPhase === 'running') FX.resetDial();
    lastPaused = S.phase === 'running' && sim.paused; lastPhase = S.phase;
    FX.refresh();
  }
  G.renderers.push(stateEffects);
  var lastBlocks = 0;
  G.bus.on('log', function (e) { if (e.kind === 'block') { snd.play('block'); FX.distract(); } });

  /* status item popover (a page extra) */
  G.statusPopover = function (btn) {
    var r = btn.getBoundingClientRect(), d = $('desktop').getBoundingClientRect();
    G.openMenu({ x: r.right - d.left - 220, y: r.bottom - d.top + 2 }, [
      { label: S.phase === 'running' ? (sim.paused ? 'Paused, ' : 'Locked in, ') + FL.formatTime(S.remaining) + ' left' : 'Not in a session', disabled: true, action: function () {} },
      { label: 'Open the FocusLock window', action: function () { G.openApp('focuslock'); } },
      { sep: true }, { label: 'Page extra: the real app is a window, with no menu bar item', disabled: true, action: function () {} }], 'FocusLock status (page extra)', btn);
  };

  /* ---------- toolbar: presets, scenarios, link, tour, keys ---------- */
  var presetSel = $('preset'), scenSel = $('scenario');
  SC.PRESETS.forEach(function (p) { presetSel.appendChild(el('option', { value: p.id, text: p.name + ' (' + p.mins + ' min)' })); });
  presetSel.insertBefore(el('option', { value: '', text: 'Custom' }), presetSel.firstChild);
  SC.SCENARIOS.forEach(function (s) { scenSel.appendChild(el('option', { value: s.id, text: s.name })); });
  function syncToolbar() { presetSel.value = G.presetId; scenSel.value = G.scenarioId; $('scn-blurb').textContent = SC.scenario(G.scenarioId).blurb; $('dist').checked = G.prefs.distractions; $('shk').checked = G.prefs.shake; }
  presetSel.addEventListener('change', function () { var p = SC.preset(presetSel.value); G.presetId = presetSel.value; if (p) { G.scenarioId = p.scenario; G.setRules(R.setMins(G.rules, p.mins)); } G.updateHash(); syncToolbar(); G.render(); });
  scenSel.addEventListener('change', function () { G.scenarioId = scenSel.value; G.updateHash(); syncToolbar(); });
  $('dist').addEventListener('change', function () { G.prefs.distractions = this.checked; G.savePrefs(); if (!this.checked) { sched = null; } });
  $('shk').addEventListener('change', function () { G.prefs.shake = this.checked; G.savePrefs(); });
  G.nextPreset = function () { var ids = [''].concat(SC.PRESETS.map(function (p) { return p.id; })), i = ids.indexOf(G.presetId); presetSel.value = ids[(i + 1) % ids.length]; presetSel.dispatchEvent(new Event('change')); };
  G.nextScenario = function () { var i = SC.SCENARIOS.map(function (s) { return s.id; }).indexOf(G.scenarioId); scenSel.value = SC.SCENARIOS[(i + 1) % SC.SCENARIOS.length].id; scenSel.dispatchEvent(new Event('change')); };
  G.copyLink = function () {
    G.updateHash(); var url = location.href.split('#')[0] + '#' + G.shareHash();
    var ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(url); ok = true; } } catch (e) {}
    $('share-out').value = url; G.toast(ok ? 'Link copied. It reopens your rules and scenario.' : 'Link is in the box below the toolbar: copy it from there.'); snd.play('click'); $('share-out').hidden = false; if (!ok) $('share-out').select();
  };
  $('share').addEventListener('click', G.copyLink);
  $('tour-btn').addEventListener('click', function () { G.bus.emit('tour'); });
  $('keys-btn').addEventListener('click', function () { G.bus.emit('help'); });
  G.bus.on('rules', function () { syncToolbar(); renderFilterLists(); probe(false); });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    var act = K.matchKey(e); if (!act) return;
    if (act === 'exit') { if (S.overlay) { e.preventDefault(); if (sim.emergencyExit('keyboard shortcut')) { snd.play('exit'); G.render(); } } return; }
    e.preventDefault();
    var m = /^(open|tab):(.+)$/.exec(act);
    if (m && m[1] === 'open') G.openApp(m[2]); else if (m && m[1] === 'tab') G.bus.emit('tab', m[2]);
    else if (act === 'help') G.bus.emit('help'); else if (act === 'tour') G.bus.emit('tour');
    else if (act === 'lock') { if (!G.isOpen('focuslock')) G.openApp('focuslock'); else if (S.phase === 'idle' || S.phase === 'finished') { if (S.phase === 'finished') sim.reset(); G.lockIn(); } else G.openApp('focuslock'); }
    else if (act === 'next') G.cycle(1); else if (act === 'prev') G.cycle(-1);
    else if (act === 'minimize') { var f = G.wm.front(); if (f) G.minimizeApp(f.id); } else if (act === 'close') { var f2 = G.wm.front(); if (f2) G.closeApp(f2.id); }
    else if (act === 'preset') G.nextPreset(); else if (act === 'scenario') G.nextScenario();
    else if (act === 'undo') { if (!G.undo()) G.toast('Nothing to undo.'); else announce('Undid the last rules edit.'); } else if (act === 'redo') { if (!G.redo()) G.toast('Nothing to redo.'); }
    else if (act === 'share') G.copyLink();
    else if (act === 'motion') { calm.checked = !calm.checked; calm.dispatchEvent(new Event('change')); announce(calm.checked ? 'All motion stopped.' : 'Motion allowed.'); }
    else if (act === 'sound') { sound.checked = !sound.checked; sound.dispatchEvent(new Event('change')); announce(sound.checked ? 'Sound on.' : 'Sound off.'); }
  });
  /* magnetic buttons: a tiny pull toward the pointer (only when motion is allowed) */
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('[data-magnet]'); if (!t || !FX.on()) return;
    var r = t.getBoundingClientRect(), dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    t.style.transform = 'translate(' + (dx * 6).toFixed(1) + 'px,' + (dy * 4).toFixed(1) + 'px)';
  });
  document.addEventListener('pointerout', function (e) { var t = e.target.closest && e.target.closest('[data-magnet]'); if (t) t.style.transform = ''; });

  /* ---------- the filter probe (follows your current rules) ---------- */
  var PROBES = ['https://old.reddit.com/r/adhd', 'https://notreddit.com', 'https://www.youtube.com/watch?v=lofi', 'https://chat.openai.com', 'about:blank', 'file:///notes/todo.html', 'https://docs.swift.org'];
  PROBES.forEach(function (u) { $('probe-chips').appendChild(el('button', { type: 'button', class: 'chip', text: u.replace(/^https:\/\//, ''), on: { click: function () { $('probe').value = u; probe(true); } } })); });
  function probe(fromUser) {
    var u = G.normalizeAddr($('probe').value), v = FL.verdictForUrl(u, G.rules.blocklist), box = $('verdict');
    box.className = 'verdict ' + v.kind; box.textContent = '';
    box.appendChild(el('strong', { text: v.kind === 'blocked' ? 'Redirected: ' + v.site + ' (' + v.category + ')' : 'Allowed' })); box.appendChild(el('div', { text: v.reason }));
    if (fromUser) { restart(box, 'stamp'); snd.play('stamp'); }
  }
  $('probe-form').addEventListener('submit', function (e) { e.preventDefault(); probe(true); });
  function renderFilterLists() {
    ['list-social', 'list-llm', 'list-other'].forEach(function (id) { $(id).textContent = ''; });
    G.rules.blocklist.forEach(function (r) { $(r.category === 'LLM' ? 'list-llm' : r.category === 'social media' ? 'list-social' : 'list-other').appendChild(el('li', { text: r.domain })); });
    $('card-other').hidden = !$('list-other').children.length;
  }

  /* ---------- scroll feel, reveals ---------- */
  var sbar = $('scrollbar'), pend = false;
  function onScroll() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; var max = root.scrollHeight - innerHeight; sbar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0).toFixed(4) + ')'; }); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.card, .steps li, .priv'));
  revealEls.forEach(function (n, i) { n.classList.add('reveal'); n.style.setProperty('--d', ((i % 3) * 0.07).toFixed(2) + 's'); });
  function showAll() { revealEls.forEach(function (n) { n.classList.add('in'); }); }
  if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }); }, { threshold: 0.08 });
    revealEls.forEach(function (n) { rio.observe(n); }); later(showAll, 3000);
    var hero = document.querySelector('.breath'); if (hero) new IntersectionObserver(function (es) { hero.classList.toggle('off', !es[0].isIntersecting); }).observe(hero);
  } else showAll();

  /* ---------- start ---------- */
  var th = $('tour-hero'); if (th) th.addEventListener('click', function () { G.bus.emit('tour'); });
  FX.init({
    stage: $('desktop'), canvas: $('fx-canvas'), simEl: $('try'), state: S, sweepEl: G.xray.sweepEl, sweepHost: G.xray.host,
    paused: function () { return sim.paused; }, rows: G.xray.rows,
    dial: function () { return { prog: dialProg, glow: dialGlow, circ: C }; }
  });
  renderFilterLists(); probe(false); syncToolbar();
  G.openApp('focuslock', { quiet: true, keepFocus: true });
  G.render();
  window.addEventListener('load', function () { G.bus.emit('ready'); });
  G.bus.emit('ready');
})();
