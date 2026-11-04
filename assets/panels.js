/* FocusLock page: the panels around the desktop. The X-ray (what the watchdog sees right now), the Rules lab,
   "Try to break it", Practise the exits, History and stats, the guided tour and the shortcut cheat sheet.
   Stats, scenarios, presets and the lab are page extras and are labelled that way. */
(function () {
  'use strict';
  var UI = window.FLUI, el = UI.el, $ = UI.$, later = UI.later, announce = UI.announce, G = window.FLG, FL = window.FL, R = window.FLRules, SC = window.FLScenario, SCORE = window.FLScore, CH = window.FLChallenge, K = window.FLKeys, snd = window.FLSound;
  var sim = G.sim, S = sim.state;

  /* ================= X-ray ================= */
  var xr = $('xray'), rows = {}, xpHost, sweepEl;
  (function buildXray() {
    xr.appendChild(el('h3', { text: 'X-ray: what the watchdog sees' }));
    xr.appendChild(el('p', { class: 'hint', text: 'Live, inside the simulation. It updates as you play.' }));
    var dl = el('dl', { class: 'kv', id: 'xr-kv' }); xr.appendChild(dl);
    xr.appendChild(el('h4', { text: 'Programs it scans' }));
    xpHost = el('div', { class: 'xp', id: 'xp', role: 'table', 'aria-label': 'Pretend process list' }); sweepEl = el('div', { class: 'sweep', 'aria-hidden': 'true' }); xpHost.appendChild(sweepEl); xr.appendChild(xpHost);
    xr.appendChild(el('h4', { text: 'The browser check' })); xr.appendChild(el('dl', { class: 'kv', id: 'xr-br' }));
    xr.appendChild(el('label', { class: 'row', for: 'automation' }, [el('input', { type: 'checkbox', id: 'automation', checked: 'checked' }), el('span', { text: 'Automation permission granted (pretend)' })]));
    $('automation').addEventListener('change', function () { S.automation = this.checked; G.render(); });
  })();
  G.xray = { sweepEl: sweepEl, host: xpHost, rows: function () { return Array.prototype.slice.call(xpHost.querySelectorAll('.xr')); } };

  function kv(dl, pairs) {
    var i = 0; pairs.forEach(function (p) {
      var dt = dl.children[i * 2], dd = dl.children[i * 2 + 1];
      if (!dt) { dt = el('dt'); dd = el('dd'); dl.appendChild(dt); dl.appendChild(dd); }
      if (dt.textContent !== p[0]) dt.textContent = p[0]; if (dd.textContent !== p[1]) dd.textContent = p[1]; dd.className = p[2] || ''; i++;
    });
    while (dl.children.length > pairs.length * 2) dl.lastChild.remove();
  }
  function renderXray() {
    var running = S.phase === 'running', procs = G.processes(), hits = R.scanProcesses(procs, G.rules), byPid = {};
    hits.forEach(function (h) { (byPid[h.pid] = byPid[h.pid] || []).push(h); });
    kv($('xr-kv'), [
      ['Session', running ? (sim.paused ? 'running, clock paused' : 'running, clock counting') : S.phase === 'finished' ? 'finished' : 'not started', running && sim.paused ? 'warn' : ''],
      ['Clock', running || S.phase === 'finished' ? FL.formatTime(S.remaining) + ' left' : '—'],
      ['Next program scan', running ? 'in ' + Math.max(0, S.scanIn) + ' s (every ' + FL.SCAN_EVERY + ' s)' : '—'],
      ['Next tab check', running ? 'in ' + Math.max(0, S.pollIn) + ' s (every ' + FL.BROWSER_POLL + ' s)' : '—'],
      ['Grace', S.grace > 0 ? S.grace + ' s left: the red screen is standing down' : 'not in use (' + sim.rules.grace + ' s when you ask)']]);
    var seen = {};
    procs.forEach(function (p) {
      seen[p.pid] = 1; var h = byPid[p.pid], r = rows[p.pid];
      if (!r) {
        r = rows[p.pid] = { node: el('div', { class: 'xr', role: 'row' }) };
        r.pid = el('span', { class: 'pid', role: 'cell' }); r.name = el('span', { class: 'pn', role: 'cell' }); r.cmd = el('span', { class: 'pc', role: 'cell' }); r.m = el('span', { class: 'pm', role: 'cell' });
        r.q = el('button', { class: 'btn small qb', type: 'button', text: 'Quit' }); r.node.appendChild(r.pid); r.node.appendChild(r.name); r.node.appendChild(r.cmd); r.node.appendChild(r.m); r.node.appendChild(r.q); xpHost.appendChild(r.node);
      }
      r.key = p.key; r.pid.textContent = p.pid; r.name.textContent = p.name; r.cmd.textContent = p.cmd; r.cmd.title = p.cmd;
      r.node.classList.toggle('hit', !!h); r.m.textContent = h ? h[0].label + ' ← ' + h[0].by : '';
      r.q.hidden = !p.key; r.q.setAttribute('aria-label', 'Quit ' + p.name + ' (pid ' + p.pid + ')');
      r.q.onclick = function () { quit(r.key); };
    });
    Object.keys(rows).forEach(function (pid) { if (!seen[pid]) { rows[pid].node.remove(); delete rows[pid]; } });
    var front = G.wm.front(), pr = G.probe(), cur = G.browser.activeTab, v = FL.verdictForUrl(cur.url, G.rules.blocklist), watched = R.isWatchedBrowser(pr.engine.bundle);
    kv($('xr-br'), [
      ['Front app', front ? G.APPS[front.id].title : 'Finder'],
      ['Browser', pr.engine.name + (watched ? ': watched' : ': not watched (the app only reads Safari, Chrome, Brave, Edge and Arc)'), watched ? '' : 'warn'],
      ['Reads the tab now?', pr.frontmost ? 'yes, it is the front app' : pr.browserFront ? 'no, this browser is not one it reads' : 'no, the browser is not in front'],
      ['Front tab', cur.url], ['Host', v.host || '—'],
      ['Rule that matches', v.kind === 'blocked' ? v.domain + ' (' + v.category + ')' : 'none'],
      ['If it read it', v.kind === 'blocked' ? 'redirect away' : 'leave alone', v.kind === 'blocked' ? 'warn' : '']]);
  }
  function quit(key) {
    if (!key) return;
    if (key.indexOf('extra:') === 0) { var pid = +key.slice(6); G.extraProcs = G.extraProcs.filter(function (p) { return p.pid !== pid; }); snd.play('close'); G.render(); }
    else G.closeApp(key);
  }
  G.renderers.push(renderXray);

  /* ================= tabs ================= */
  var tabDefs = [['rules', 'Rules lab'], ['break', 'Try to break it'], ['exits', 'Practise the exits'], ['history', 'History and stats'], ['log', 'What happened']];
  var tablist = $('lab-tabs'), panels = {};
  function selectTab(name, focus) {
    tabDefs.forEach(function (d) { var on = d[0] === name; var b = $('tab-' + d[0]); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; panels[d[0]].hidden = !on; });
    if (focus) $('tab-' + name).focus();
    if (name === 'history') renderHistory();
  }
  tabDefs.forEach(function (d) {
    tablist.appendChild(el('button', { class: 'ltab', role: 'tab', id: 'tab-' + d[0], 'aria-controls': 'panel-' + d[0], type: 'button', text: d[1], on: { click: function () { selectTab(d[0]); snd.play('click'); } } }));
    panels[d[0]] = $('panel-' + d[0]);
  });
  tablist.addEventListener('keydown', function (e) {
    var i = tabDefs.map(function (d) { return d[0]; }).indexOf(document.activeElement.id.replace('tab-', '')); if (i < 0) return;
    var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabDefs.length - 1 : -1; if (n < 0) return;
    e.preventDefault(); selectTab(tabDefs[(n + tabDefs.length) % tabDefs.length][0], true);
  });
  G.bus.on('tab', function (name) { if (panels[name]) { selectTab(name, true); $('lab').scrollIntoView({ block: 'start', behavior: G.fxOn() ? 'smooth' : 'auto' }); } });

  /* ================= Rules lab ================= */
  var rp = panels.rules;
  (function () {
    rp.appendChild(el('p', { class: 'hint', text: 'Edit what the watchdog looks for and watch verdicts change instantly. Page extra: the real app has these lists fixed in its code, a 30 second grace and four session lengths.' }));
    var top = el('div', { class: 'row wrapr' });
    var mins = el('input', { type: 'number', id: 'in-mins', min: 1, max: 240, 'aria-label': 'Session length in minutes' }), grace = el('input', { type: 'number', id: 'in-grace', min: 5, max: 300, 'aria-label': 'Grace period in seconds' });
    mins.addEventListener('change', function () { G.setRules(R.setMins(G.rules, mins.value)); }); grace.addEventListener('change', function () { G.setRules(R.setGrace(G.rules, grace.value)); });
    top.appendChild(el('label', {}, ['Session length (min) ', mins])); top.appendChild(el('label', {}, ['Grace (seconds) ', grace]));
    var undo = el('button', { class: 'btn small', type: 'button', id: 'rl-undo', text: 'Undo (z)', on: { click: function () { if (G.undo()) announce('Undid the last edit.'); } } });
    var redo = el('button', { class: 'btn small', type: 'button', id: 'rl-redo', text: 'Redo (Z)', on: { click: function () { G.redo(); } } });
    top.appendChild(undo); top.appendChild(redo); top.appendChild(el('button', { class: 'btn small', type: 'button', text: 'Back to the app’s defaults', on: { click: function () { G.resetRules(); G.toast('Back to the app’s own rules.'); } } }));
    rp.appendChild(top);
    rp.appendChild(el('h4', { text: 'Sites the filter redirects' }));
    var bl = el('ul', { class: 'tags editable', id: 'rl-bl', 'aria-label': 'Blocked sites. Drop a suggested site here to add it.' }); rp.appendChild(bl);
    ['dragover', 'dragenter'].forEach(function (ev) { bl.addEventListener(ev, function (e) { e.preventDefault(); bl.classList.add('over'); }); }); bl.addEventListener('dragleave', function () { bl.classList.remove('over'); });
    bl.addEventListener('drop', function (e) { e.preventDefault(); bl.classList.remove('over'); addSite(e.dataTransfer.getData('text/plain'), '', 'other'); snd.play('drop'); });
    var sf = el('form', { class: 'row wrapr', autocomplete: 'off' }), sd = el('input', { type: 'text', id: 'in-site', placeholder: 'example.com', 'aria-label': 'Site to add' }), sn = el('input', { type: 'text', id: 'in-sname', placeholder: 'Name (optional)', 'aria-label': 'Display name' }), sc = el('select', { id: 'in-scat', 'aria-label': 'Category' });
    R.CATEGORIES.forEach(function (c) { sc.appendChild(el('option', { value: c, text: c })); });
    sf.appendChild(sd); sf.appendChild(sn); sf.appendChild(sc); sf.appendChild(el('button', { class: 'btn small primary', type: 'submit', text: 'Add site' }));
    sf.addEventListener('submit', function (e) { e.preventDefault(); if (addSite(sd.value, sn.value, sc.value)) { sd.value = ''; sn.value = ''; } }); rp.appendChild(sf);
    rp.appendChild(el('div', { class: 'ph', id: 'rl-err', role: 'status' }));
    rp.appendChild(el('p', { class: 'hint', text: 'Suggestions (drag one into the list, or press Add):' }));
    var sg = el('div', { class: 'chips' });
    [['news.ycombinator.com', 'Hacker News'], ['youtube.com', 'YouTube'], ['linkedin.com', 'LinkedIn'], ['netflix.com', 'Netflix'], ['redditt.com', 'Look-alike']].forEach(function (s) {
      var chip = el('span', { class: 'sugg', draggable: 'true' }, [el('span', { text: s[0] }), el('button', { class: 'chip', type: 'button', text: 'Add', 'aria-label': 'Add ' + s[0], on: { click: function () { addSite(s[0], s[1], 'other'); } } })]);
      chip.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', s[0]); }); sg.appendChild(chip);
    }); rp.appendChild(sg);
    rp.appendChild(el('h4', { text: 'Programs the watchdog recognises' }));
    rp.appendChild(el('ul', { class: 'plist', id: 'rl-pl' }));
    var pf = el('form', { class: 'row wrapr', autocomplete: 'off' }), pt = el('select', { id: 'in-ptype', 'aria-label': 'How to recognise it' });
    [['app', 'App name is'], ['cmd-exe', 'Program name is'], ['cmd-contains', 'Command line contains']].forEach(function (o) { pt.appendChild(el('option', { value: o[0], text: o[1] })); });
    var pv = el('input', { type: 'text', id: 'in-pval', placeholder: 'e.g. cld', 'aria-label': 'Name or text' }), pl = el('input', { type: 'text', id: 'in-plabel', placeholder: 'Label (optional)', 'aria-label': 'Label' });
    pf.appendChild(pt); pf.appendChild(pv); pf.appendChild(pl); pf.appendChild(el('button', { class: 'btn small primary', type: 'submit', text: 'Add pattern' }));
    pf.addEventListener('submit', function (e) { e.preventDefault(); var r = R.addPattern(G.rules, { type: pt.value, value: pv.value, label: pl.value }); if (r.ok) { G.setRules(r.rules); pv.value = ''; pl.value = ''; $('rl-err').textContent = ''; snd.play('tab'); } else $('rl-err').textContent = r.error; });
    rp.appendChild(pf);
    rp.appendChild(el('h4', { text: 'Test a program command line' }));
    var cmd = el('input', { type: 'text', id: 'in-cmd', value: '/usr/local/bin/cld --resume', 'aria-label': 'Command line to test' }); rp.appendChild(cmd); rp.appendChild(el('div', { class: 'verdict', id: 'cmd-out', role: 'status' }));
    cmd.addEventListener('input', testCmd);
    rp.appendChild(el('p', { class: 'hint', text: 'Test a web address: use the filter box in the section below, it follows these rules too.' }));
  })();
  function addSite(d, n, c) {
    var r = R.addSite(G.rules, { domain: d, name: n, category: c }); $('rl-err').textContent = r.ok ? '' : r.error;
    if (r.ok) { G.setRules(r.rules); snd.play('tab'); announce('Added ' + R.normalizeDomain(d) + ' to the list.'); } return r.ok;
  }
  function testCmd() {
    var v = $('in-cmd').value, hits = R.scanProcesses([{ pid: 1, app: null, cmd: v }], G.rules), box = $('cmd-out');
    box.className = 'verdict ' + (hits.length ? 'blocked' : 'allowed'); box.textContent = hits.length ? 'Recognised: ' + hits[0].label + ' (' + hits[0].by + ')' : 'Not recognised: the watchdog would not notice it.';
  }
  function renderRules() {
    $('in-mins').value = G.rules.mins; $('in-grace').value = G.rules.grace;
    $('rl-undo').disabled = !G.hist.canUndo(); $('rl-redo').disabled = !G.hist.canRedo();
    var bl = $('rl-bl'); bl.textContent = '';
    G.rules.blocklist.forEach(function (b) {
      bl.appendChild(el('li', { class: 'cat-' + b.category.replace(/\W/g, '') }, [el('span', { text: b.domain, title: b.name + ' · ' + b.category }),
        el('button', { class: 'x', type: 'button', 'aria-label': 'Remove ' + b.domain, text: '×', on: { click: function () { var r = R.removeSite(G.rules, b.domain); G.setRules(r.rules); snd.play('close'); announce('Removed ' + b.domain + '.'); } } })]));
    });
    var pl = $('rl-pl'); pl.textContent = '';
    G.rules.patterns.forEach(function (p, i) {
      pl.appendChild(el('li', {}, [el('span', { text: ({ app: 'App named ', 'cmd-exe': 'Program named ', 'cmd-contains': 'Command line contains ' })[p.type] + '“' + p.value + '” → ' + p.label }),
        el('button', { class: 'x', type: 'button', 'aria-label': 'Remove pattern ' + p.value, text: '×', on: { click: function () { G.setRules(R.removePattern(G.rules, i).rules); snd.play('close'); } } })]));
    });
    testCmd();
  }
  G.bus.on('rules', renderRules);

  /* ================= Try to break it ================= */
  var bp = panels.break, tried = {}, cards = {};
  (function () {
    bp.appendChild(el('p', { class: 'hint', text: 'Try to get around the watchdog. Each attempt is judged against your current rules, with the reason, all inside the simulation. This is not a scoreboard: a gap is just something you can close in the Rules lab, and some limits are real.' }));
    var tl = el('div', { class: 'row wrapr' }, [el('button', { class: 'btn small primary', type: 'button', text: 'Try them all', on: { click: function () { CH.ATTEMPTS.forEach(function (a) { tried[a.id] = true; }); renderBreak(); snd.play('stamp'); announce('Tried every attempt.'); } } }), el('span', { id: 'tally', role: 'status', class: 'tally' })]);
    bp.appendChild(tl);
    var grid = el('div', { class: 'attempts', id: 'attempts' }); bp.appendChild(grid);
    CH.ATTEMPTS.forEach(function (a) {
      var res = el('div', { class: 'res', role: 'status' }), badge = el('span', { class: 'badge2' });
      var btn = el('button', { class: 'btn small', type: 'button', text: 'Try it', on: { click: function () { tried[a.id] = true; applyLive(a); renderBreak(); snd.play('stamp'); restart(cards[a.id].node, 'stamp'); announce(a.title + ': ' + CH.evaluate(a, G.rules).outcome); } } });
      var node = el('article', { class: 'attempt' }, [el('h5', { text: a.title }), el('p', { class: 'how', text: a.how }), el('div', { class: 'row' }, [btn, badge]), res]);
      cards[a.id] = { node: node, res: res, badge: badge }; grid.appendChild(node);
    });
  })();
  var restart = UI.restart;
  var LABEL = { held: 'The guard held', gap: 'It slipped through', refused: 'Start refused', 'by-design': 'Works by design' };
  function renderBreak() {
    CH.ATTEMPTS.forEach(function (a) {
      var c = cards[a.id]; if (!tried[a.id]) { c.res.textContent = ''; c.badge.textContent = ''; c.badge.className = 'badge2'; return; }
      var r = CH.evaluate(a, G.rules); c.badge.textContent = LABEL[r.outcome]; c.badge.className = 'badge2 ' + r.outcome; c.res.textContent = r.why;
    });
    var done = CH.ATTEMPTS.filter(function (a) { return tried[a.id]; }).map(function (a) { return CH.evaluate(a, G.rules); }), t = CH.tally(done);
    $('tally').textContent = done.length ? done.length + ' tried: ' + t.held + ' guards held, ' + t.gap + ' gaps found (each one is something to learn, or close).' : 'Nothing tried yet.';
  }
  var pidc = 5000;
  function applyLive(a) {
    var ap = a.apply; if (S.phase !== 'running') return; 
    if (ap.type === 'url') G.navigate(ap.url);
    else if (ap.type === 'bgtab') { G.openApp('browser', { quiet: true }); G.newTab(ap.url, false); }
    else if (ap.type === 'firefox') { G.browser.engineId = 'firefox'; G.openApp('browser', { quiet: true }); G.navigate(ap.url); }
    else if (ap.type === 'process') { var p = ap.proc; G.extraProcs.push({ pid: ++pidc, name: p.cmd.split('/').pop().split(' ')[0], app: p.app, cmd: p.cmd, tty: 'challenge' }); }
    if (a.id === 'quit') G.askEnd();
    G.render();
  }
  G.bus.on('rules', renderBreak);

  /* ================= Practise the exits ================= */
  var ep = panels.exits;
  function idleScene() {
    G.quietStop = true; if (S.phase === 'running') sim.endEarly(); G.quietStop = false; if (S.phase === 'finished') sim.reset();
    ['claude', 'chatgpt'].forEach(function (id) { if (G.isOpen(id)) G.closeApp(id); }); G.extraProcs = []; G.render();
  }
  var STEPS = [
    { id: 'preflight', title: 'Pre-flight check', task: 'The Claude app is open. Press Lock in and watch it refuse, and tell you what to close.', scene: function () { idleScene(); G.openApp('claude', { quiet: true, keepFocus: true }); G.openApp('focuslock'); }, goal: function (e) { return e.kind === 'guard'; } },
    { id: 'grace', title: 'Grace button', task: 'A session is running and an LLM app opens. When the red screen comes (up to 5 seconds), press Give me 30 seconds.', scene: function () { idleScene(); G.lockIn(); later(function () { G.openApp('claude', { quiet: true, keepFocus: true }); }, 400); }, goal: function (e) { return e.kind === 'grace'; } },
    { id: 'sos', title: 'SOS button', task: 'Same scene. This time press Emergency exit on the red screen.', scene: function () { idleScene(); G.lockIn(); later(function () { G.openApp('claude', { quiet: true, keepFocus: true }); }, 400); }, goal: function (e) { return e.kind === 'exit' && e.how === 'SOS button'; } },
    { id: 'keys', title: 'The keyboard', task: 'Same scene again. With the red screen up, press Ctrl+Shift+Esc (Command-Shift-Esc on a Mac).', scene: function () { idleScene(); G.lockIn(); later(function () { G.openApp('claude', { quiet: true, keepFocus: true }); }, 400); }, goal: function (e) { return e.kind === 'exit' && e.how === 'keyboard shortcut'; } },
    { id: 'terminal', title: 'The terminal', task: 'A session is running. In the Terminal type focuslock unlock.', scene: function () { idleScene(); G.lockIn(); G.openApp('terminal'); }, goal: function (e) { return e.kind === 'exit' && e.how === 'focuslock unlock'; } },
    { id: 'quit', title: 'Quit asks first', task: 'A session is running. Close the FocusLock window or press Quit: it opens a question instead of quitting.', scene: function () { idleScene(); G.lockIn(); G.openApp('focuslock'); }, goal: function (e) { return e.kind === 'quit-sheet'; } }
  ];
  var epList = el('ol', { class: 'steps2' }); ep.appendChild(el('p', { class: 'hint', text: 'A short walk through every way out, one at a time. Press Set the scene and try the exit on the desktop above. Page extra: your progress is kept on this device only if stats are on, and you can reset it.' }));
  ep.appendChild(epList); ep.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn small', type: 'button', text: 'Reset my practice', on: { click: function () { G.practice = {}; G.persist(); renderExits(); } } }), el('span', { id: 'ex-msg', role: 'status', class: 'tally' })]));
  var stepNodes = {};
  STEPS.forEach(function (st) {
    var chk = el('span', { class: 'chk', 'aria-hidden': 'true' });
    var node = el('li', { class: 'step2' }, [chk, el('div', {}, [el('strong', { text: st.title }), el('p', { text: st.task }), el('button', { class: 'btn small', type: 'button', text: 'Set the scene', on: { click: function () { st.scene(); $('desktop').scrollIntoView({ block: 'nearest' }); announce('Scene set. ' + st.task); } } })]), el('span', { class: 'sr-status' })]);
    stepNodes[st.id] = { node: node, chk: chk }; epList.appendChild(node);
  });
  function renderExits() {
    var n = 0; STEPS.forEach(function (st) { var d = G.practice[st.id] === true; if (d) n++; stepNodes[st.id].node.classList.toggle('done', d); stepNodes[st.id].chk.textContent = d ? '✓' : ''; stepNodes[st.id].node.lastChild.textContent = d ? 'Practised' : ''; });
    $('ex-msg').textContent = n === STEPS.length ? 'All six exits practised. You can always get out.' : n + ' of ' + STEPS.length + ' practised.';
  }
  function exitGoal(e) { STEPS.forEach(function (st) { if (!G.practice[st.id] && st.goal(e)) { G.practice[st.id] = true; G.persist(); renderExits(); snd.play('celebrate'); G.toast('Exit practised: ' + st.title + '.'); announce('Exit practised: ' + st.title); if (STEPS.every(function (s) { return G.practice[s.id]; })) later(function () { G.toast('All six exits practised. You can never be trapped.'); }, 900); } }); }
  G.bus.on('log', exitGoal); G.bus.on('quit-sheet', function () { exitGoal({ kind: 'quit-sheet' }); });

  /* ================= History and stats ================= */
  var hp = panels.history, selected = null;
  (function () {
    hp.appendChild(el('p', { class: 'hint', text: 'Page extra: the real app keeps no history. This is a gentle log of your play here, shown only to you. It celebrates coming back, and it never counts failures.' }));
    var tg = el('div', { class: 'row wrapr' }, [el('label', { class: 'row' }, [el('input', { type: 'checkbox', id: 'st-on' }), el('span', { text: 'Keep my history and stats on this device' })]), el('button', { class: 'btn small', type: 'button', text: 'Forget everything', on: { click: function () { G.forgetAll(); renderHistory(); G.toast('Forgotten. Nothing is stored now.'); } } })]);
    hp.appendChild(tg);
    $('st-on').checked = G.prefs.stats;
    $('st-on').addEventListener('change', function () { G.prefs.stats = this.checked; G.savePrefs(); if (this.checked) G.persist(); else G.forgetAll(); });
    hp.appendChild(el('div', { class: 'statcards', id: 'statcards' }));
    hp.appendChild(el('div', { class: 'hist', id: 'hist' }));
    hp.appendChild(el('div', { id: 'hdetail' }));
  })();
  function mmss(sec) { return FL.formatTime(sec); }
  function renderHistory() {
    var a = SCORE.aggregate(G.history), sc = $('statcards'); sc.textContent = '';
    [['Sessions', a.sessions], ['Focused minutes', a.focusedMinutes], ['Times you came back', a.resumes], ['Days you showed up', a.daysShown]].forEach(function (c) { sc.appendChild(el('div', { class: 'statc' }, [el('b', { text: String(c[1]) }), el('span', { text: c[0] })])); });
    var h = $('hist'); h.textContent = '';
    if (!G.history.length) { h.appendChild(el('p', { class: 'ph', text: 'No sessions yet. Run one above and it will show up here.' })); $('hdetail').textContent = ''; return; }
    G.history.slice().reverse().forEach(function (rec, i) {
      var idx = G.history.length - 1 - i;
      h.appendChild(el('button', { class: 'hrow' + (selected === idx ? ' on' : ''), type: 'button', 'aria-pressed': selected === idx ? 'true' : 'false', text: (rec.at ? new Date(rec.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · ' : '') + rec.mins + ' min · ' + ({ completed: 'finished', ended: 'stopped', exit: 'used an exit' })[rec.outcome] + (SCORE.summarize(rec).resumed ? ' · came back ' + SCORE.summarize(rec).resumed + 'x' : ''),
        on: { click: function () { selected = idx; renderHistory(); } } }));
    });
    if (selected === null || !G.history[selected]) selected = G.history.length - 1;
    renderDetail(G.history[selected]);
  }
  function renderDetail(rec) {
    var d = $('hdetail'); d.textContent = '';
    d.appendChild(el('h4', { text: 'Summary' }));
    SCORE.narrate(rec).forEach(function (t) { d.appendChild(el('p', { text: t })); });
    var end = Math.max(rec.endVt, 1), spans = SCORE.pauseSpans(rec);
    d.appendChild(el('h4', { text: 'Timeline (drag the slider)' }));
    var track = el('div', { class: 'tl', role: 'img', 'aria-label': 'Timeline of the session' });
    spans.forEach(function (sp) { track.appendChild(el('i', { class: 'tl-pause', style: 'left:' + (sp.from / end * 100) + '%;width:' + Math.max(0.8, (sp.to - sp.from) / end * 100) + '%' })); });
    rec.events.forEach(function (e) { var cls = { block: 'tl-block', grace: 'tl-grace', exit: 'tl-exit', end: 'tl-exit', resist: 'tl-pass', park: 'tl-pass', snooze: 'tl-pass', open: 'tl-open' }[e.kind]; if (cls) track.appendChild(el('b', { class: 'tl-mark ' + cls, style: 'left:' + (e.vt / end * 100) + '%', title: e.text })); });
    var head = el('i', { class: 'tl-head', 'aria-hidden': 'true' }); track.appendChild(head); d.appendChild(track);
    var rng = el('input', { type: 'range', class: 'scrub', min: 0, max: end, value: end, step: 1, 'aria-label': 'Scrub through the session' }), out = el('div', { class: 'tl-read', role: 'status' });
    function upd() {
      var st = SCORE.stateAt(rec, +rng.value); head.style.left = (st.vt / end * 100) + '%';
      var txt = 'At ' + mmss(st.vt) + ': ' + mmss(st.focused) + ' focused' + (st.paused ? ', clock paused' : '') + (st.last ? '. Latest: ' + st.last.text : '.');
      out.textContent = txt; rng.setAttribute('aria-valuetext', txt);
    }
    rng.addEventListener('input', upd); upd(); d.appendChild(rng); d.appendChild(out);
    d.appendChild(el('p', { class: 'legend', text: 'Soft red bands: the clock was paused. Dots: detours turned away, grace used, exits, and nudges you let pass.' }));
  }
  G.bus.on('history', function (rec) { if (rec) selected = G.history.length - 1; renderHistory(); if (rec) later(function () { G.toast(SCORE.narrate(rec)[0]); }, 400); });
  G.bus.on('rules', function () {});

  /* ================= What happened (the live log) ================= */
  var lp = panels.log; lp.appendChild(el('p', { class: 'hint', text: 'Every decision the watchdog makes, with the reason.' })); var logOl = el('ol', { class: 'log', id: 'log', role: 'log', 'aria-label': 'Event log' }); lp.appendChild(logOl);
  var lastLog = -1;
  function renderLog() {
    if (S.log.length === lastLog) return; lastLog = S.log.length; logOl.textContent = '';
    if (!S.log.length) { logOl.appendChild(el('li', { class: 'empty', text: 'Nothing yet. Press Lock in.' })); return; }
    S.log.slice().reverse().forEach(function (l) { var k = [el('span', { class: 'tag ' + l.kind, text: l.kind }), l.text]; if (l.why) k.push(el('span', { class: 'why', text: 'Why: ' + l.why })); logOl.appendChild(el('li', {}, k)); });
  }
  G.renderers.push(renderLog);

  /* ================= cheat sheet ================= */
  var helpEl = null, helpFrom = null;
  function toggleHelp() {
    if (helpEl) { helpEl.remove(); helpEl = null; if (helpFrom) helpFrom.focus(); return; }
    helpFrom = document.activeElement;
    var list = el('dl', { class: 'keylist' });
    K.SHORTCUTS.forEach(function (s) { if (s.action === 'exit') return; list.appendChild(el('dt', {}, [el('kbd', { text: s.key === 'Escape+Ctrl+Shift' ? 'Ctrl+Shift+Esc' : s.key })])); list.appendChild(el('dd', { text: s.label })); });
    list.appendChild(el('dt', {}, [el('kbd', { text: 'Ctrl+Shift+Esc' })])); list.appendChild(el('dd', { text: 'Emergency exit (Command-Shift-Esc on a Mac), while a screen is up' }));
    helpEl = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard shortcuts' }, [el('div', { class: 'modal-card' }, [el('h3', { text: 'Keyboard shortcuts' }), el('p', { class: 'hint', text: 'They work anywhere on the page except while you are typing in a box.' }), list, el('button', { class: 'btn primary', type: 'button', id: 'help-close', text: 'Close', on: { click: toggleHelp } })])]);
    helpEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); toggleHelp(); } else if (e.key === 'Tab') { e.preventDefault(); $('help-close').focus(); } });
    helpEl.addEventListener('click', function (e) { if (e.target === helpEl) toggleHelp(); });
    document.body.appendChild(helpEl); $('help-close').focus();
  }
  G.bus.on('help', toggleHelp);

  /* ================= guided tour ================= */
  var TOUR = [
    { sel: '#toolbar', text: 'Pick a preset and a scenario. Scenarios are page extras: they send pretend distractions while you focus.' },
    { sel: '#win-wrap', text: 'This is a pretend Mac. Drag windows by their title bars, flick them, snap them to an edge, minimise or close them. The Dock opens apps.' },
    { sel: '#dock', text: 'Open the Browser, Terminal, Notes, Music or Messages. Claude and ChatGPT here are stand-ins: opening one during a session pauses the clock, which is the whole idea.' },
    { sel: '#xray', text: 'The X-ray shows what the watchdog sees right now: programs, the front tab, and the rule that matched.' },
    { sel: '#lab', text: 'Edit the rules, try to break the watchdog, practise every emergency exit, and look back at your sessions. All of it stays on this page.' },
    { sel: '#tour-btn', text: 'That is it. Replay this any time, or press ? for keyboard shortcuts. Everything on this page is a simulation.' }
  ];
  var tourEl = null, tourI = 0, spot = null;
  function tourStop(done) { if (tourEl) { tourEl.remove(); spot.remove(); tourEl = spot = null; } if (done) UI.save('fl-tour', 'done'); document.removeEventListener('keydown', tourKey, true); window.removeEventListener('resize', tourPlace); }
  function tourKey(e) { if (!tourEl) return; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tourStop(true); } else if (e.key === 'ArrowRight') { e.preventDefault(); tourGo(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); tourGo(-1); } }
  function tourPlace() {
    var st = TOUR[tourI], t = document.querySelector(st.sel); if (!t) return;
    var r = t.getBoundingClientRect(), pad = 8;
    spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px'; spot.style.transform = 'translate(' + (r.left - pad) + 'px,' + (r.top - pad) + 'px)';
    var below = r.bottom + 12 + 180 < innerHeight; var top = below ? r.bottom + 14 : Math.max(8, r.top - 14 - tourEl.offsetHeight);
    tourEl.style.top = Math.max(8, Math.min(top, innerHeight - tourEl.offsetHeight - 8)) + 'px'; tourEl.style.left = Math.max(8, Math.min(r.left, innerWidth - tourEl.offsetWidth - 8)) + 'px';
  }
  function tourGo(d) {
    var n = tourI + d; if (n < 0) return; if (n >= TOUR.length) { tourStop(true); G.toast('Tour finished. Press t to replay it.'); return; }
    tourI = n; var st = TOUR[n], t = document.querySelector(st.sel); if (t) t.scrollIntoView({ block: 'center', behavior: 'auto' });
    tourEl.querySelector('.tt').textContent = st.text; tourEl.querySelector('.tc').textContent = (n + 1) + ' of ' + TOUR.length; tourEl.querySelector('.tnext').textContent = n === TOUR.length - 1 ? 'Done' : 'Next'; tourEl.querySelector('.tback').disabled = n === 0;
    later(tourPlace, 30); snd.play('tab');
  }
  function tourStart() {
    tourStop(false); tourI = -1;
    spot = el('div', { class: 'spot', 'aria-hidden': 'true' });
    tourEl = el('div', { class: 'tour', role: 'dialog', 'aria-label': 'Guided tour' }, [el('p', { class: 'tt', 'aria-live': 'polite' }), el('div', { class: 'row between' }, [el('span', { class: 'tc' }),
      el('span', { class: 'row' }, [el('button', { class: 'btn small tback', type: 'button', text: 'Back', on: { click: function () { tourGo(-1); } } }), el('button', { class: 'btn small primary tnext', type: 'button', text: 'Next', on: { click: function () { tourGo(1); } } }), el('button', { class: 'btn small', type: 'button', text: 'Skip', on: { click: function () { tourStop(true); } } })])])]);
    document.body.appendChild(spot); document.body.appendChild(tourEl); document.addEventListener('keydown', tourKey, true); window.addEventListener('resize', tourPlace);
    tourGo(1); tourEl.querySelector('.tnext').focus();
  }
  G.bus.on('tour', tourStart);
  G.bus.on('ready', function () { if (!G.fromLink && UI.load('fl-tour') !== 'done' && !G.tourOffered) { G.tourOffered = true; later(function () { if (!UI.load('fl-tour')) tourStart(); }, 1200); } });
  if (/[?&]notour\b/.test(location.search)) UI.save('fl-tour', 'done');

  /* ---------- initial render of panels ---------- */
  renderRules(); renderBreak(); renderExits(); selectTab('rules');
  G.renderers.push(function () {});
})();
