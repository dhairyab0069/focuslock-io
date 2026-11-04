/* FocusLock page: the rules the watchdog works from, as data you can edit. No DOM; tested in node.
   Defaults mirror the app. Everything past the defaults (editing, undo, custom grace) is a page extra. */
(function (root) {
  'use strict';
  var FL = root.FL || (typeof require !== 'undefined' ? require('./core.js') : null);

  /* Browsers the app can read a tab from. Anything else (Firefox, for example) is never looked at. */
  var BROWSERS = [
    { id: 'com.apple.Safari', name: 'Safari' }, { id: 'com.apple.SafariTechnologyPreview', name: 'Safari Technology Preview' },
    { id: 'com.google.Chrome', name: 'Google Chrome' }, { id: 'com.brave.Browser', name: 'Brave Browser' },
    { id: 'com.microsoft.edgemac', name: 'Microsoft Edge' }, { id: 'company.thebrowser.Browser', name: 'Arc' }
  ];
  function isWatchedBrowser(id) { return BROWSERS.some(function (b) { return b.id === id; }); }

  /* How a running program is recognised. app: the app's name as macOS reports it. cmd-exe: a process whose
     executable is that name. cmd-contains: a command line containing that text. */
  var DEFAULT_PATTERNS = [
    { type: 'app', value: 'Claude', label: 'Claude (app)' }, { type: 'app', value: 'ChatGPT', label: 'ChatGPT (app)' },
    { type: 'app', value: 'Perplexity', label: 'Perplexity (app)' }, { type: 'app', value: 'Copilot', label: 'Copilot (app)' },
    { type: 'app', value: 'Gemini', label: 'Gemini (app)' },
    { type: 'cmd-exe', value: 'claude', label: 'Claude Code (CLI)' },
    { type: 'cmd-contains', value: 'Claude.app/', label: 'Claude (app)' }, { type: 'cmd-contains', value: 'ChatGPT.app/', label: 'ChatGPT (app)' },
    { type: 'cmd-contains', value: 'Perplexity.app/', label: 'Perplexity (app)' }
  ];

  var LIMITS = { sites: 120, patterns: 40, graceMin: 5, graceMax: 300, minsMin: 1, minsMax: 240, text: 60 };
  var CATEGORIES = ['social media', 'LLM', 'other'];

  function defaults() {
    return {
      blocklist: FL.BLOCKLIST.map(function (b) { return { domain: b.domain, name: b.name, category: b.category }; }),
      patterns: DEFAULT_PATTERNS.map(function (p) { return { type: p.type, value: p.value, label: p.label }; }),
      grace: FL.GRACE, mins: 25
    };
  }
  function clone(r) { return JSON.parse(JSON.stringify(r)); }
  function clampInt(v, lo, hi, dflt) { v = parseInt(v, 10); return isNaN(v) ? dflt : Math.max(lo, Math.min(hi, v)); }

  /* "https://WWW.Reddit.com/r/x" -> "reddit.com". Returns '' when it cannot be a host name. */
  function normalizeDomain(s) {
    s = String(s || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s) && s.length <= 253 ? s : '';
  }
  function cleanText(s) { return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.text); }

  function addSite(r, site) {
    var d = normalizeDomain(site.domain);
    if (!d) return { ok: false, error: 'That does not look like a site name. Try something like example.com.' };
    if (r.blocklist.some(function (b) { return b.domain === d; })) return { ok: false, error: d + ' is already on the list.' };
    if (r.blocklist.length >= LIMITS.sites) return { ok: false, error: 'The list is full (' + LIMITS.sites + ' sites).' };
    var cat = CATEGORIES.indexOf(site.category) >= 0 ? site.category : 'other';
    var n = r.blocklist.concat([{ domain: d, name: cleanText(site.name) || d, category: cat }]);
    var next = clone(r); next.blocklist = n; return { ok: true, rules: next };
  }
  function removeSite(r, domain) {
    var next = clone(r); next.blocklist = r.blocklist.filter(function (b) { return b.domain !== domain; });
    return { ok: next.blocklist.length !== r.blocklist.length, rules: next };
  }
  function addPattern(r, p) {
    var type = ['app', 'cmd-exe', 'cmd-contains'].indexOf(p.type) >= 0 ? p.type : '';
    var value = cleanText(p.value);
    if (!type || !value) return { ok: false, error: 'Choose a kind and type the name or text to look for.' };
    if (r.patterns.length >= LIMITS.patterns) return { ok: false, error: 'The list is full.' };
    if (r.patterns.some(function (x) { return x.type === type && x.value === value; })) return { ok: false, error: 'That pattern is already there.' };
    var next = clone(r); next.patterns.push({ type: type, value: value, label: cleanText(p.label) || value + (type === 'app' ? ' (app)' : '') }); return { ok: true, rules: next };
  }
  function removePattern(r, i) {
    if (i < 0 || i >= r.patterns.length) return { ok: false, rules: r };
    var next = clone(r); next.patterns.splice(i, 1); return { ok: true, rules: next };
  }
  function setGrace(r, v) { var next = clone(r); next.grace = clampInt(v, LIMITS.graceMin, LIMITS.graceMax, r.grace); return next; }
  function setMins(r, v) { var next = clone(r); next.mins = clampInt(v, LIMITS.minsMin, LIMITS.minsMax, r.mins); return next; }

  function matchLine(p, cmd) {
    var line = String(cmd || '').trim();
    if (p.type === 'cmd-contains') return line.indexOf(p.value) >= 0;
    if (p.type === 'cmd-exe') {
      var v = p.value.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
      return line === p.value || line.indexOf(p.value + ' ') === 0 || new RegExp('^[^ ]*/' + v + '( |$)').test(line);
    }
    return false;
  }
  /* The two-layer scan: app names first, then full command lines. Returns every match with the reason. */
  function scanProcesses(processes, rules) {
    var hits = [];
    processes.forEach(function (pr) {
      rules.patterns.forEach(function (p) {
        if (p.type === 'app' ? (pr.app && pr.app === p.value) : matchLine(p, pr.cmd)) {
          hits.push({ pid: pr.pid, label: p.label, by: p.type === 'app' ? 'app name "' + p.value + '"' : p.type === 'cmd-exe' ? 'command line starts with "' + p.value + '"' : 'command line contains "' + p.value + '"' });
        }
      });
    });
    return hits;
  }
  function labels(hits) { var seen = {}; hits.forEach(function (h) { seen[h.label] = 1; }); return Object.keys(seen).sort(); }

  /* Undo and redo for rule edits. */
  function createHistory(initial) {
    var past = [], future = [], cur = clone(initial);
    return {
      get current() { return cur; },
      push: function (next) { past.push(cur); if (past.length > 50) past.shift(); cur = clone(next); future.length = 0; return cur; },
      undo: function () { if (!past.length) return null; future.push(cur); cur = past.pop(); return cur; },
      redo: function () { if (!future.length) return null; past.push(cur); cur = future.pop(); return cur; },
      canUndo: function () { return past.length > 0; }, canRedo: function () { return future.length > 0; }
    };
  }
  function sameAsDefault(r) { return JSON.stringify(r) === JSON.stringify(defaults()); }

  var api = { BROWSERS: BROWSERS, isWatchedBrowser: isWatchedBrowser, DEFAULT_PATTERNS: DEFAULT_PATTERNS, LIMITS: LIMITS, CATEGORIES: CATEGORIES,
    defaults: defaults, clone: clone, normalizeDomain: normalizeDomain, addSite: addSite, removeSite: removeSite, addPattern: addPattern,
    removePattern: removePattern, setGrace: setGrace, setMins: setMins, scanProcesses: scanProcesses, labels: labels, createHistory: createHistory,
    sameAsDefault: sameAsDefault, clampInt: clampInt, cleanText: cleanText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
