/* FocusLock page: the pretend Mac. A little desktop with windows you can drag, stack, snap, minimise and close,
   a menu bar, a Dock and apps (Browser, Terminal, Notes, Music, Messages, the FocusLock window itself).
   It is a simulation: nothing here looks at the visitor's computer. */
(function () {
  'use strict';
  var UI = window.FLUI, el = UI.el, $ = UI.$, later = UI.later, G = window.FLG, FL = window.FL, R = window.FLRules, WM = window.FLWM, snd = window.FLSound;

  var layer = $('windows'), desk = $('desktop'), dockEl = $('dock'), menubar = $('menubar');
  var wm = G.wm = WM.createWM({ w: 700, h: 500 });
  var nodes = {}, bodies = {}, phone = false;

  /* The programs on the pretend Mac. `proc` is what the watchdog sees in the process list while the app is open. */
  var APPS = {
    browser: { title: 'Browser', glyph: 'B', w: 520, h: 360, proc: { name: 'Browser', app: 'Safari', cmd: '/Applications/Safari.app/Contents/MacOS/Safari' } },
    terminal: { title: 'Terminal', glyph: '>_', w: 440, h: 280, proc: { name: 'zsh', app: 'Terminal', cmd: '-zsh' } },
    notes: { title: 'Notes', glyph: 'N', w: 300, h: 280, proc: { name: 'Notes', app: 'Notes', cmd: '/System/Applications/Notes.app/Contents/MacOS/Notes' } },
    music: { title: 'Music', glyph: '♫', w: 300, h: 260, proc: { name: 'Music', app: 'Music', cmd: '/System/Applications/Music.app/Contents/MacOS/Music' } },
    messages: { title: 'Messages', glyph: 'M', w: 330, h: 330, proc: { name: 'Messages', app: 'Messages', cmd: '/System/Applications/Messages.app/Contents/MacOS/Messages' } },
    focuslock: { title: 'FocusLock', glyph: 'F', w: 380, h: 440, proc: { name: 'FocusLock', app: 'FocusLock', cmd: '/Users/you/FocusLock/.build/release/FocusLock' } },
    claude: { title: 'Claude', glyph: 'C', w: 320, h: 250, tempting: true, proc: { name: 'Claude', app: 'Claude', cmd: '/Applications/Claude.app/Contents/MacOS/Claude' } },
    chatgpt: { title: 'ChatGPT', glyph: 'G', w: 320, h: 250, tempting: true, proc: { name: 'ChatGPT', app: 'ChatGPT', cmd: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT' } }
  };
  G.APPS = APPS;
  var SYSTEM = [
    { name: 'launchd', app: null, cmd: '/sbin/launchd' }, { name: 'WindowServer', app: null, cmd: '/System/Library/PrivateFrameworks/SkyLight.framework/WindowServer' },
    { name: 'Finder', app: 'Finder', cmd: '/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder' }, { name: 'Dock', app: 'Dock', cmd: '/System/Library/CoreServices/Dock.app/Contents/MacOS/Dock' },
    { name: 'mds_stores', app: null, cmd: '/System/Library/Frameworks/CoreServices.framework/mds_stores' }
  ];
  var pids = {};
  function pidFor(key) { if (!pids[key]) pids[key] = 300 + Object.keys(pids).length * 17 + 3; return pids[key]; }

  /* The pretend process list: the system, every open app, and any extra program started from a terminal or a scenario. */
  G.extraProcs = [];
  G.processes = function () {
    var list = SYSTEM.map(function (p, i) { return { pid: 100 + i * 7, name: p.name, app: p.app, cmd: p.cmd }; });
    wm.wins.forEach(function (w) {
      var c = APPS[w.id]; if (!c) return;
      var p = c.proc, app = p.app;
      if (w.id === 'browser') { var b = G.browser.engine; list.push({ pid: pidFor(w.id), name: b.name, app: b.app, cmd: b.cmd, key: w.id }); return; }
      list.push({ pid: pidFor(w.id), name: p.name, app: app, cmd: p.cmd, key: w.id });
    });
    G.extraProcs.forEach(function (p) { list.push({ pid: p.pid, name: p.name, app: p.app, cmd: p.cmd, key: 'extra:' + p.pid }); });
    return list;
  };
  G.browser = {
    tabs: [{ id: 1, url: 'about:blank' }], active: 1, nextId: 2, engineId: 'safari',
    get engine() { return ENGINES[this.engineId]; },
    get activeTab() { var a = this.active; return this.tabs.filter(function (t) { return t.id === a; })[0] || this.tabs[0]; }
  };
  var ENGINES = {
    safari: { name: 'Safari', app: 'Safari', bundle: 'com.apple.Safari', cmd: '/Applications/Safari.app/Contents/MacOS/Safari' },
    chrome: { name: 'Google Chrome', app: 'Google Chrome', bundle: 'com.google.Chrome', cmd: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    firefox: { name: 'Firefox', app: 'Firefox', bundle: 'org.mozilla.firefox', cmd: '/Applications/Firefox.app/Contents/MacOS/firefox' }
  };
  G.ENGINES = ENGINES;
  G.frontApp = function () { var f = wm.front(); return f ? f.id : null; };
  /* What the tab check can see: only when a watched browser is frontmost, and only its active tab. */
  G.probe = function () {
    var f = wm.front(), eng = G.browser.engine;
    return { frontmost: !!(f && f.id === 'browser' && R.isWatchedBrowser(eng.bundle)), url: G.browser.activeTab.url, engine: eng, browserFront: !!(f && f.id === 'browser') };
  };

  /* ---------- windows ---------- */
  function measure() {
    var b = { w: layer.clientWidth || 700, h: layer.clientHeight || 500 };
    phone = WM.isPhone(window.innerWidth);
    desk.classList.toggle('phone', phone);
    wm.setBounds(b);
  }
  var cascade = 0;
  function openApp(id, opts) {
    var c = APPS[id]; if (!c) return null;
    var had = !!wm.get(id);
    if (!had) {
      var n = cascade++ % 5;
      wm.open(id, { app: id, title: c.title, x: 28 + n * 34, y: 14 + n * 28, w: Math.min(c.w, wm.bounds.w - 16), h: Math.min(c.h, wm.bounds.h - 8) });
      snd.play('open');
    } else { wm.focus(id); }
    layout(); if (!had) { var nd = nodes[id]; if (nd && G.fxOn()) UI.restart(nd, 'pop'); }
    G.render(); UI.announce(c.title + (had ? ' brought to the front.' : ' opened.'));
    if (!(opts && opts.keepFocus)) { var t = nodes[id] && nodes[id].querySelector('.wt'); if (t && !(opts && opts.quiet)) t.focus({ preventScroll: true }); }
    return nodes[id];
  }
  function closeApp(id) {
    if (!wm.get(id)) return;
    if (id === 'focuslock' && G.sim.state.phase === 'running') { G.askEnd(); return; }
    if (id === 'terminal') G.extraProcs = G.extraProcs.filter(function (p) { return p.tty !== 'terminal'; });
    wm.close(id); if (nodes[id]) { nodes[id].remove(); delete nodes[id]; delete bodies[id]; }
    snd.play('close'); layout(); G.render(); UI.announce(APPS[id].title + ' closed.');
  }
  function minimizeApp(id) { wm.minimize(id); layout(); G.render(); UI.announce(APPS[id].title + ' minimised.'); }
  G.openApp = openApp; G.closeApp = closeApp; G.minimizeApp = minimizeApp;
  G.isOpen = function (id) { return !!wm.get(id); };

  function build(id) {
    var c = APPS[id], w = wm.get(id);
    var closeBtn = el('button', { class: 'wb close', type: 'button', 'aria-label': 'Close ' + c.title + ' (quits it)', title: 'Close (quit)', on: { click: function (e) { e.stopPropagation(); closeApp(id); } } });
    var minBtn = el('button', { class: 'wb min', type: 'button', 'aria-label': 'Minimise ' + c.title, title: 'Minimise', on: { click: function (e) { e.stopPropagation(); minimizeApp(id); } } });
    var head = el('header', { class: 'wt', tabindex: '0', role: 'group', 'aria-label': c.title + ' title bar. Arrow keys move the window, Shift and arrows resize it.' }, [
      el('span', { class: 'wbtns' }, [closeBtn, minBtn]), el('span', { class: 'wtitle', text: c.title })]);
    var body = el('div', { class: 'wbody' });
    var node = el('section', { class: 'win2 app-' + id, role: 'region', 'aria-label': c.title + ' window', 'data-id': id }, [head, body]);
    node.addEventListener('pointerdown', function () { if (wm.front() !== w || w.min) { wm.focus(id); layout(); G.render(); } }, true);
    attachDrag(node, head, id);
    head.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k || phone) return;
      e.preventDefault(); var win = wm.get(id);
      if (e.shiftKey) wm.resize(id, win.w + k[0] * 24, win.h + k[1] * 24); else wm.move(id, win.x + k[0] * 24, win.y + k[1] * 24);
      layout();
    });
    head.addEventListener('dblclick', function () { var r = { x: 0, y: 0, w: wm.bounds.w, h: wm.bounds.h }; wm.applyRect(id, r); layout(); });
    nodes[id] = node; layer.appendChild(node);
    bodies[id] = (BUILDERS[id] || BUILDERS.chat)(body, id);
    return node;
  }

  function layout() {
    wm.wins.forEach(function (w) { if (!nodes[w.id]) build(w.id); });
    var front = wm.front();
    wm.wins.forEach(function (w) {
      var n = nodes[w.id], p = phone;
      var hidden = w.min || (p && (!front || front.id !== w.id));
      n.hidden = hidden; n.classList.toggle('front', !!front && front.id === w.id);
      n.style.zIndex = w.z;
      if (p) { var r = WM.phoneRect(wm.bounds); n.style.transform = 'none'; n.style.width = r.w + 'px'; n.style.height = r.h + 'px'; n.style.left = '0'; n.style.top = '0'; }
      else { n.style.left = '0'; n.style.top = '0'; n.style.width = w.w + 'px'; n.style.height = w.h + 'px'; n.style.transform = 'translate(' + w.x + 'px,' + w.y + 'px)'; }
      n.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
    renderDock(); renderMenubar();
  }
  G.layout = layout;

  /* drag with inertia (flick) and snapping; keyboard and menu alternatives exist for everything */
  function attachDrag(node, head, id) {
    var st = null;
    head.addEventListener('pointerdown', function (e) {
      if (phone || e.button !== 0 || e.target.closest('.wb')) return;
      var w = wm.get(id); st = { sx: e.clientX, sy: e.clientY, ox: w.x, oy: w.y, samples: [] };
      head.setPointerCapture(e.pointerId); node.classList.add('drag');
    });
    head.addEventListener('pointermove', function (e) {
      if (!st) return; var w = wm.get(id);
      wm.move(id, st.ox + e.clientX - st.sx, st.oy + e.clientY - st.sy);
      st.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (st.samples.length > 5) st.samples.shift();
      node.style.transform = 'translate(' + w.x + 'px,' + w.y + 'px)';
      var r = layer.getBoundingClientRect(), s = wm.snapRect(e.clientX - r.left, e.clientY - r.top);
      showSnap(s);
    });
    function end(e) {
      if (!st) return; var s = st; st = null; node.classList.remove('drag'); showSnap(null);
      var r = layer.getBoundingClientRect(), sn = wm.snapRect(e.clientX - r.left, e.clientY - r.top);
      if (sn) { wm.applyRect(id, sn); layout(); snd.play('snap'); return; }
      var v = WM.velocity(s.samples);
      if ((Math.abs(v.vx) > 120 || Math.abs(v.vy) > 120) && G.fxOn()) {
        var w = wm.get(id), cur = { x: w.x, y: w.y, vx: v.vx, vy: v.vy };
        window.FX.task(function (dt) {
          if (!wm.get(id)) return false;
          cur = WM.inertiaStep(cur, dt, wm.bounds, w); w.x = cur.x; w.y = cur.y;
          node.style.transform = 'translate(' + w.x + 'px,' + w.y + 'px)';
          return cur.done ? false : true;
        });
      }
    }
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  }
  var snapEl = el('div', { class: 'snaphint', 'aria-hidden': 'true' }); layer.appendChild(snapEl);
  function showSnap(r) {
    if (!r) { snapEl.style.opacity = '0'; return; }
    snapEl.style.opacity = '1'; snapEl.style.width = r.w + 'px'; snapEl.style.height = r.h + 'px'; snapEl.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px)';
  }

  /* ---------- Dock ---------- */
  function renderDock() {
    var ids = ['browser', 'terminal', 'notes', 'music', 'messages', 'focuslock', 'claude', 'chatgpt'], front = wm.front();
    if (!dockEl.firstChild) {
      ids.forEach(function (id, i) {
        var c = APPS[id];
        var b = el('button', { class: 'dk' + (c.tempting ? ' tempt' : ''), type: 'button', 'data-app': id,
          'aria-label': c.title + (c.tempting ? ' (an LLM app: opening it pauses a session)' : ''), title: c.title + (c.tempting ? '  (an LLM app)' : '') + '  [' + (i < 6 ? i + 1 : '-') + ']',
          on: { click: function () { var w = wm.get(id); if (w && !w.min && front === w && false) minimizeApp(id); else openApp(id); } } }, [el('span', { class: 'gl', 'aria-hidden': 'true', text: c.glyph }), el('i', { class: 'run', 'aria-hidden': 'true' })]);
        if (id === 'notes') { b.addEventListener('dragover', function (e) { e.preventDefault(); b.classList.add('over'); }); b.addEventListener('dragleave', function () { b.classList.remove('over'); }); b.addEventListener('drop', function (e) { e.preventDefault(); b.classList.remove('over'); G.dropOnNotes(e.dataTransfer.getData('text/plain')); }); }
        dockEl.appendChild(b);
      });
      dockEl.addEventListener('pointermove', magnify); dockEl.addEventListener('pointerleave', function () { Array.prototype.forEach.call(dockEl.children, function (c) { c.style.removeProperty('--s'); }); });
    }
    Array.prototype.forEach.call(dockEl.children, function (b) {
      var w = wm.get(b.getAttribute('data-app'));
      b.classList.toggle('open', !!w); b.classList.toggle('minned', !!(w && w.min)); b.classList.toggle('isfront', !!(w && front === w));
    });
  }
  function magnify(e) {
    if (!G.fxOn()) return;
    Array.prototype.forEach.call(dockEl.children, function (c) {
      var r = c.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)), s = 1 + 0.35 * Math.max(0, 1 - d / 90);
      c.style.setProperty('--s', s.toFixed(3));
    });
  }

  /* ---------- menu bar and menus ---------- */
  var curMenu = null;
  function closeMenu() { if (curMenu) { curMenu.remove(); curMenu = null; document.removeEventListener('pointerdown', outside, true); } }
  function outside(e) { if (curMenu && !curMenu.contains(e.target) && !e.target.closest('.mbtn, .status-item')) closeMenu(); }
  /* at: {x,y} in desktop coordinates. Items: {label, action, disabled, sep} */
  function openMenu(at, items, label, restoreTo) {
    closeMenu();
    var m = el('div', { class: 'menu', role: 'menu', 'aria-label': label || 'Menu' }), hl = el('i', { class: 'hl', 'aria-hidden': 'true' }); m.appendChild(hl);
    items.forEach(function (it) {
      if (it.sep) { m.appendChild(el('hr', { role: 'separator' })); return; }
      var b = el('button', { type: 'button', role: 'menuitem', class: 'mi', text: it.label, disabled: it.disabled ? 'disabled' : false, on: { click: function () { closeMenu(); if (restoreTo) restoreTo.focus(); it.action(); } } });
      b.addEventListener('pointerenter', function () { hl.style.opacity = '1'; hl.style.transform = 'translateY(' + b.offsetTop + 'px)'; hl.style.height = b.offsetHeight + 'px'; });
      m.appendChild(b);
    });
    m.addEventListener('pointerleave', function () { hl.style.opacity = '0'; });
    m.addEventListener('keydown', function (e) {
      var bs = Array.prototype.filter.call(m.querySelectorAll('.mi'), function (b) { return !b.disabled; }), i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); if (restoreTo) restoreTo.focus(); }
      else if (e.key === 'Tab') closeMenu();
    });
    desk.appendChild(m); curMenu = m;
    var dw = desk.clientWidth, dh = desk.clientHeight;
    m.style.left = Math.max(4, Math.min(at.x, dw - m.offsetWidth - 4)) + 'px'; m.style.top = Math.max(4, Math.min(at.y, dh - m.offsetHeight - 4)) + 'px';
    document.addEventListener('pointerdown', outside, true);
    var first = m.querySelector('.mi:not([disabled])'); if (first) first.focus();
    return m;
  }
  G.openMenu = openMenu; G.closeMenu = closeMenu;
  function deskPoint(e) { var r = desk.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function menuItems(kind) {
    var f = wm.front();
    if (kind === 'app') return [{ label: f ? 'Minimise ' + APPS[f.id].title : 'Minimise', disabled: !f, action: function () { if (f) minimizeApp(f.id); } },
      { label: f ? 'Quit ' + APPS[f.id].title : 'Quit', disabled: !f, action: function () { if (f) closeApp(f.id); } }];
    if (kind === 'window') return [{ label: 'Tidy windows', action: function () { wm.tidy(); layout(); } },
      { label: 'Snap front window left', disabled: !f || phone, action: function () { var b = wm.bounds; wm.applyRect(f.id, { x: 0, y: 0, w: Math.round(b.w / 2), h: b.h }); layout(); snd.play('snap'); } },
      { label: 'Snap front window right', disabled: !f || phone, action: function () { var b = wm.bounds; wm.applyRect(f.id, { x: Math.round(b.w / 2), y: 0, w: Math.round(b.w / 2), h: b.h }); layout(); snd.play('snap'); } },
      { label: 'Fill the desktop', disabled: !f || phone, action: function () { var b = wm.bounds; wm.applyRect(f.id, { x: 0, y: 0, w: b.w, h: b.h }); layout(); } },
      { sep: true }, { label: 'Next window', action: function () { G.cycle(1); } }, { label: 'Previous window', action: function () { G.cycle(-1); } }];
    if (kind === 'help') return [{ label: 'Take the guided tour', action: function () { G.bus.emit('tour'); } }, { label: 'Keyboard shortcuts', action: function () { G.bus.emit('help'); } },
      { sep: true }, { label: 'Reset the desktop', action: function () { G.resetDesktop(); } }];
    return [{ label: 'New note', action: function () { openApp('notes'); } }, { label: 'Open the Browser', action: function () { openApp('browser'); } },
      { label: 'Tidy windows', action: function () { wm.tidy(); layout(); } }, { sep: true }, { label: 'Take the tour', action: function () { G.bus.emit('tour'); } }, { label: 'Reset the desktop', action: function () { G.resetDesktop(); } }];
  }
  function renderMenubar() {
    var f = wm.front(), name = f ? APPS[f.id].title : 'Finder';
    if (!menubar.firstChild) {
      menubar.appendChild(el('span', { class: 'mb-app', id: 'mb-app' }));
      [['app', null], ['window', 'Window'], ['help', 'Help']].forEach(function (m) {
        menubar.appendChild(el('button', { class: 'mbtn', type: 'button', 'data-m': m[0], 'aria-haspopup': 'menu', on: { click: function (e) {
          var r = e.currentTarget.getBoundingClientRect(), d = desk.getBoundingClientRect(); openMenu({ x: r.left - d.left, y: r.bottom - d.top + 2 }, menuItems(m[0]), (m[1] || 'App') + ' menu', e.currentTarget); } } }));
      });
      menubar.appendChild(el('span', { class: 'mb-sp' }));
      menubar.appendChild(el('button', { class: 'status-item', id: 'status-item', type: 'button', 'aria-haspopup': 'dialog', title: 'Page extra: the real FocusLock is a window, it has no menu bar item', on: { click: function (e) { G.statusPopover(e.currentTarget); } } }));
    }
    $('mb-app').textContent = name; menubar.querySelector('[data-m=app]').textContent = 'App'; menubar.querySelector('[data-m=app]').setAttribute('aria-label', name + ' app menu');
  }
  desk.addEventListener('contextmenu', function (e) {
    if (e.target.closest('.wbody input, .wbody textarea')) return;
    e.preventDefault(); openMenu(deskPoint(e), menuItems('desk'), 'Desktop menu');
  });
  desk.addEventListener('keydown', function (e) { if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && !e.target.closest('input,textarea')) { e.preventDefault(); var r = e.target.getBoundingClientRect(), d = desk.getBoundingClientRect(); openMenu({ x: r.left - d.left + 20, y: r.top - d.top + 20 }, menuItems('desk'), 'Desktop menu'); } });

  G.cycle = function (dir) {
    var vis = wm.order().filter(function (w) { return true; }); if (!vis.length) return;
    var f = wm.front(), i = f ? vis.indexOf(f) : -1, n = vis[(i + dir + vis.length) % vis.length]; openApp(n.id);
  };
  G.resetDesktop = function () { Object.keys(nodes).forEach(function (id) { if (id !== 'focuslock') closeApp(id); }); wm.tidy(); layout(); openApp('focuslock', { quiet: true }); };

  /* ---------- app bodies ---------- */
  var BUILDERS = {};

  /* Browser: tabs, an address bar, a page. Typed addresses are only checked by the watchdog on its next look. */
  BUILDERS.browser = function (body) {
    var B = G.browser, tabbar = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Browser tabs' }), addr = el('input', { type: 'text', class: 'addr', id: 'addr', 'aria-label': 'Address', spellcheck: 'false', autocomplete: 'off' });
    var eng = el('select', { class: 'engine', 'aria-label': 'Which browser this is (page extra)', title: 'Page extra: pick a browser. The app only watches the first two.' });
    Object.keys(ENGINES).forEach(function (k) { eng.appendChild(el('option', { value: k, text: ENGINES[k].name })); });
    eng.value = B.engineId; eng.addEventListener('change', function () { B.engineId = eng.value; G.render(); UI.announce('Browser is now ' + B.engine.name + (R.isWatchedBrowser(B.engine.bundle) ? ', a browser FocusLock watches.' : ', which FocusLock does not watch.')); });
    var page = el('div', { class: 'page' });
    var form = el('form', { class: 'bar2', autocomplete: 'off' }, [addr, eng]);
    form.addEventListener('submit', function (e) { e.preventDefault(); G.navigate(addr.value); });
    body.appendChild(tabbar); body.appendChild(form); body.appendChild(page);
    function render() {
      var cur = B.activeTab; tabbar.textContent = '';
      B.tabs.forEach(function (t) {
        var host = t.url === 'about:blank' ? 'New tab' : hostOf(t.url);
        var tb = el('button', { class: 'tab' + (t.id === cur.id ? ' on' : ''), role: 'tab', type: 'button', 'aria-selected': t.id === cur.id ? 'true' : 'false', text: host, on: { click: function () { B.active = t.id; render(); G.render(); } } });
        var x = el('button', { class: 'tx', type: 'button', 'aria-label': 'Close tab ' + host, text: '×', on: { click: function (e) { e.stopPropagation(); G.closeTab(t.id); } } });
        tabbar.appendChild(el('span', { class: 'tabwrap' }, [tb, x]));
      });
      tabbar.appendChild(el('button', { class: 'tab plus', type: 'button', 'aria-label': 'New tab', text: '+', on: { click: function () { G.newTab('about:blank', true); } } }));
      if (document.activeElement !== addr) addr.value = cur.url === 'about:blank' ? '' : cur.url;
      page.textContent = '';
      if (cur.url === 'about:blank') {
        page.appendChild(el('p', { class: 'ph', text: 'A blank page. Try a link, or type an address above.' }));
        var chips = el('div', { class: 'chips' });
        [['reddit.com', 'https://www.reddit.com/r/macapps'], ['x.com', 'https://x.com/home'], ['claude.ai', 'https://claude.ai/chat'], ['youtube.com', 'https://www.youtube.com/watch?v=lofi'], ['docs', 'https://developer.apple.com/documentation'], ['search', 'https://www.google.com/search?q=pomodoro']].forEach(function (c) {
          chips.appendChild(el('button', { class: 'chip', type: 'button', text: c[0], on: { click: function () { G.navigate(c[1]); } } }));
        });
        page.appendChild(chips);
      } else {
        var v = FL.verdictForUrl(cur.url, G.rules.blocklist);
        page.appendChild(el('div', { class: 'fakepage' }, [el('div', { class: 'fav', text: hostOf(cur.url).charAt(0).toUpperCase() }), el('strong', { text: hostOf(cur.url) }),
          el('div', { class: 'ln' }), el('div', { class: 'ln s' }), el('div', { class: 'ln' }), el('div', { class: 'ln s' }), el('p', { class: 'ph', text: 'A pretend page: nothing is loaded. ' + (v.kind === 'blocked' ? 'FocusLock would send this tab away during a session.' : 'FocusLock leaves this alone.') })]));
      }
    }
    return { render: render, addr: addr };
  };
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, '') || u; } catch (e) { return u; } }
  G.hostOf = hostOf;
  G.normalizeAddr = function (v) { v = String(v || '').trim(); return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? 'https://' + v : v; };
  G.navigate = function (v) {
    var url = G.normalizeAddr(v) || 'about:blank'; openApp('browser', { quiet: true });
    G.browser.activeTab.url = url; if (bodies.browser) bodies.browser.render(); snd.play('type'); G.render();
    UI.announce('Opened ' + (url === 'about:blank' ? 'a blank page' : hostOf(url)) + '. The watchdog looks at the front tab every ' + FL.BROWSER_POLL + ' seconds.');
  };
  G.newTab = function (url, activate) {
    var B = G.browser, id = B.nextId++; B.tabs.push({ id: id, url: url }); if (activate) B.active = id;
    if (bodies.browser) bodies.browser.render(); G.render(); snd.play('tab'); return id;
  };
  G.closeTab = function (id) {
    var B = G.browser; if (B.tabs.length === 1) { B.tabs[0].url = 'about:blank'; } else { B.tabs = B.tabs.filter(function (t) { return t.id !== id; }); if (B.active === id) B.active = B.tabs[B.tabs.length - 1].id; }
    if (bodies.browser) bodies.browser.render(); G.render();
  };
  G.redirectActive = function () { G.browser.activeTab.url = 'about:blank'; if (bodies.browser) bodies.browser.render(); };

  /* Terminal: understands focuslock and a few other commands. */
  BUILDERS.terminal = function (body) {
    var out = el('div', { class: 'tout', role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output' }), inp = el('input', { type: 'text', class: 'tin', 'aria-label': 'Terminal command', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
    var hist = [], hi = 0, inClaude = false;
    function print(t) { out.appendChild(el('div', { text: t })); out.scrollTop = out.scrollHeight; }
    print('Welcome. Try: help'); 
    var api = { print: print, focus: function () { inp.focus(); } };
    var form = el('form', { class: 'tline' }, [el('span', { 'aria-hidden': 'true', text: inClaude ? '>' : '$' }), inp]);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var line = inp.value.trim(); inp.value = ''; if (!line) return; hist.push(line); hi = hist.length; print((inClaude ? '> ' : '$ ') + line);
      run(line);
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); inp.value = hist[hi]; } else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; } });
    function cliProc() { return { pid: 4200, name: 'claude', app: null, cmd: 'claude', tty: 'terminal' }; }
    function run(line) {
      var a = line.split(/\s+/), c = a[0];
      if (inClaude) { if (c === 'exit' || c === '/exit') { inClaude = false; G.extraProcs = G.extraProcs.filter(function (p) { return p.tty !== 'terminal'; }); print('Claude Code (pretend) ended.'); G.render(); } else print('(pretend Claude Code: nothing is sent anywhere. Type exit to leave.)'); return; }
      if (c === 'focuslock') {
        var sub = a[1] || 'start';
        if (sub === 'start') { if (G.isOpen('focuslock')) print('FocusLock is already running (pid ' + pidFor('focuslock') + ').'); else { openApp('focuslock', { quiet: true }); print('FocusLock started (pid ' + pidFor('focuslock') + ').'); print('Emergency exits during a session: SOS button · ⌘⇧Esc · focuslock unlock'); } }
        else if (sub === 'stop' || sub === 'unlock') {
          if (G.isOpen('focuslock')) { G.sim.emergencyExit('focuslock unlock'); snd.play('exit'); closeApp('focuslock'); print('FocusLock stopped — session over.'); } else print("FocusLock wasn't running.");
        }
        else if (sub === 'status') print(G.isOpen('focuslock') ? 'FocusLock is running (pid ' + pidFor('focuslock') + ').' : 'FocusLock is not running.');
        else if (sub === 'build') { print('Building FocusLock (release)…'); print('Build complete. Run \'focuslock start\'. (pretend)'); }
        else print('Usage: focuslock [start|stop|unlock|status|build]');
      } else if (c === 'claude') { inClaude = true; if (!G.extraProcs.some(function (p) { return p.tty === 'terminal'; })) G.extraProcs.push(cliProc()); print('Claude Code (pretend). It is a stand-in for the real tool; nothing is sent anywhere. Type exit to leave.'); G.render(); }
      else if (c === 'help') print('focuslock [start|stop|unlock|status|build] · claude · top · ls · pwd · whoami · date · echo · clear');
      else if (c === 'top' || c === 'ps') G.processes().forEach(function (p) { print(String(p.pid).padStart(5) + '  ' + p.cmd.slice(-52)); });
      else if (c === 'ls') print('Desktop  Documents  Downloads  notes.txt');
      else if (c === 'pwd') print('/Users/you'); else if (c === 'whoami') print('you');
      else if (c === 'date') print('Tue 9:41 (pretend)'); else if (c === 'echo') print(a.slice(1).join(' '));
      else if (c === 'clear') out.textContent = '';
      else print('zsh: command not found: ' + c);
    }
    body.appendChild(out); body.appendChild(form);
    return api;
  };

  BUILDERS.notes = function (body) {
    var ta = el('textarea', { class: 'notes', 'aria-label': 'Notes', placeholder: 'Park anything that pops into your head here, and get back to it later.' });
    var hint = el('div', { class: 'ph', text: 'Drop a notification here to park it for later.' });
    body.appendChild(ta); body.appendChild(hint);
    ['dragover', 'dragenter'].forEach(function (ev) { body.addEventListener(ev, function (e) { e.preventDefault(); body.classList.add('over'); }); });
    body.addEventListener('dragleave', function () { body.classList.remove('over'); });
    body.addEventListener('drop', function (e) { e.preventDefault(); body.classList.remove('over'); G.dropOnNotes(e.dataTransfer.getData('text/plain')); });
    return { ta: ta };
  };
  G.dropOnNotes = function (text) {
    if (!text) return;
    openApp('notes', { quiet: true }); var ta = bodies.notes.ta; ta.value += (ta.value ? '\n' : '') + 'Check later: ' + text; snd.play('drop');
    G.bus.emit('parked', text);
  };

  BUILDERS.music = function (body) {
    var tracks = ['Rain on a window', 'Slow piano', 'Low hum'], idx = 0, playing = false, t = 0;
    var title = el('strong', { class: 'trk' }), bar = el('div', { class: 'mbar' }, [el('i')]), eq = el('div', { class: 'eq', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i'), el('i')]);
    var play = el('button', { class: 'btn small', type: 'button' }), nxt = el('button', { class: 'btn small', type: 'button', text: 'Next' });
    function r() { title.textContent = tracks[idx]; play.textContent = playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', playing ? 'true' : 'false'); eq.classList.toggle('on', playing); bar.firstChild.style.transform = 'scaleX(' + (t / 180).toFixed(3) + ')'; }
    play.addEventListener('click', function () { playing = !playing; snd.play('click'); r(); }); nxt.addEventListener('click', function () { idx = (idx + 1) % tracks.length; t = 0; r(); });
    body.appendChild(el('div', { class: 'player' }, [eq, title, bar, el('div', { class: 'row' }, [play, nxt])]));
    body.appendChild(el('p', { class: 'ph', text: 'Music is allowed during a session, on purpose: concentration fuel. (Pretend player: no sound is played.)' }));
    r(); var api = { tick: function () { if (playing) { t = (t + 1) % 180; r(); } } }; return api;
  };

  BUILDERS.messages = function (body) {
    var list = el('div', { class: 'msgs', role: 'log', 'aria-live': 'polite', 'aria-label': 'Messages' });
    function add(from, text, me) { list.appendChild(el('div', { class: 'msg' + (me ? ' me' : '') }, [el('b', { text: from }), el('span', { text: text })])); list.scrollTop = list.scrollHeight; }
    (G.msgLog || []).forEach(function (m) { add(m.from, m.text, m.me); });
    var quick = el('div', { class: 'chips' });
    ['On my way', 'Later today', 'Can we talk after my session?'].forEach(function (t) { quick.appendChild(el('button', { class: 'chip', type: 'button', text: t, on: { click: function () { G.msgLog.push({ from: 'You', text: t, me: true }); add('You', t, true); snd.play('click'); } } })); });
    body.appendChild(list); body.appendChild(quick); return { add: add };
  };
  G.msgLog = [{ from: 'Sam', text: 'Morning! Free later?' }];
  G.pushMessage = function (from, text) { G.msgLog.push({ from: from, text: text }); if (bodies.messages) bodies.messages.add(from, text); };

  /* A stand-in for LLM apps. The page never talks to any model. */
  BUILDERS.chat = function (body, id) {
    var c = APPS[id];
    body.appendChild(el('div', { class: 'chatfake' }, [el('strong', { text: c.title + ' (pretend)' }), el('p', { text: 'A stand-in window for an LLM app. It says nothing and sends nothing; it is here so the watchdog has something to find. Close it to resume.' }),
      el('div', { class: 'ln' }), el('div', { class: 'ln s' })]));
    return {};
  };

  /* FocusLock itself is built in app.js (it needs the session logic); it registers here. */
  BUILDERS.focuslock = function (body) { return G.buildFocusLock(body); };

  G.bodies = bodies;
  G.afterTick = function () { if (bodies.music) bodies.music.tick(); };
  G.updateBrowser = function () { if (bodies.browser) bodies.browser.render(); };

  new ResizeObserver(function () { measure(); layout(); }).observe(desk); window.addEventListener('resize', function () { measure(); layout(); });
  measure();
})();
