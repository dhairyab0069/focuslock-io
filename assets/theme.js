/* One light / dark / auto setting for every site on dhairyab0069.github.io: localStorage "theme".
   The inline script in <head> applied it before first paint; this file runs the switch in the top bar,
   follows changes made on other pages or tabs, and tells the canvases to re-read their colours. */
(function () {
  'use strict';
  var root = document.documentElement, mq = window.matchMedia('(prefers-color-scheme: dark)');
  var sw = document.getElementById('theme-switch');
  function valid(m) { return m === 'light' || m === 'dark' ? m : 'auto'; }
  function resolve(m) { return m === 'auto' ? (mq.matches ? 'dark' : 'light') : m; }
  function read() { try { return valid(localStorage.getItem('theme')); } catch (e) { return 'auto'; } }
  var mode = valid(root.getAttribute('data-theme-mode')), theme = root.getAttribute('data-theme') || resolve(mode);
  var meta = document.querySelector('meta[name="theme-color"]');
  var CUES = { auto: 0, light: 1, dark: 2 };

  function apply() {
    root.setAttribute('data-theme-mode', mode); root.setAttribute('data-theme', theme); root.style.colorScheme = theme;
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#101a1e' : '#eef2ec');
    if (sw) [].forEach.call(sw.querySelectorAll('[data-theme-mode]'), function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-theme-mode') === mode)); });
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode: mode, theme: theme } }));
  }
  /* a circle opening from the control, or a short crossfade; instant when motion is off */
  function change(commit, origin) {
    if (root.getAttribute('data-calm') === 'on') { commit(); return; }
    if (document.startViewTransition) {
      var r = (origin || document.body).getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var vt = document.startViewTransition(commit);
      vt.ready.then(function () {
        root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 700, easing: 'cubic-bezier(.33,1,.68,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(function () {});
      return;
    }
    root.classList.add('theme-fade'); commit(); setTimeout(function () { root.classList.remove('theme-fade'); }, 450);
  }
  function set(next, origin, store, quiet) {
    if (next === mode) return;
    mode = next;
    if (store !== false) { try { localStorage.setItem('theme', mode); } catch (e) {} }
    if (!quiet && window.FLSound) window.FLSound.play('theme');
    var t = resolve(mode);
    if (t === theme) { apply(); return; }
    change(function () { theme = t; apply(); }, origin);
  }
  if (sw) {
    sw.addEventListener('click', function (e) { var b = e.target.closest('[data-theme-mode]'); if (b) set(b.getAttribute('data-theme-mode'), b); });
    sw.addEventListener('keydown', function (e) {   /* arrow keys move through the radio group */
      var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
      var all = [].slice.call(sw.querySelectorAll('[data-theme-mode]')), n = all[(all.indexOf(document.activeElement) + k + all.length) % all.length];
      n.focus(); set(n.getAttribute('data-theme-mode'), n); e.preventDefault();
    });
  }
  window.addEventListener('storage', function (e) { if (e.key === 'theme' || e.key === null) set(read(), null, false, true); });
  var onSys = function () { if (mode === 'auto' && resolve('auto') !== theme) change(function () { theme = resolve('auto'); apply(); }, sw); };
  if (mq.addEventListener) mq.addEventListener('change', onSys);
  apply();
})();
