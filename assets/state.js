/* FocusLock page: the one shared state object (FLG) the page modules read and write. */
(function () {
  'use strict';
  var UI = window.FLUI, FL = window.FL, R = window.FLRules, SC = window.FLScenario, H = window.FLHash, SCORE = window.FLScore;
  var listeners = {};
  var G = window.FLG = {
    bus: { on: function (n, f) { (listeners[n] = listeners[n] || []).push(f); }, emit: function (n, d) { (listeners[n] || []).forEach(function (f) { f(d); }); } },
    renderers: [],
    render: function () { G.renderers.forEach(function (f) { f(); }); },
    fxOn: function () { return window.FX ? window.FX.on() : false; },
    prefs: { stats: true, distractions: true, shake: false },
    rules: R.defaults(), scenarioId: 'tuesday', presetId: 'sprint', history: [], practice: {}
  };
  G.hist = R.createHistory(G.rules);
  var P = UI.loadJSON('fl-prefs'); if (P && typeof P === 'object') { G.prefs.stats = P.stats !== false; G.prefs.distractions = P.distractions !== false; G.prefs.shake = P.shake === true; }
  G.savePrefs = function () { UI.save('fl-prefs', G.prefs); };
  if (G.prefs.stats) { G.history = SCORE.sanitizeHistory(UI.loadJSON('fl-history')); var pr = UI.loadJSON('fl-practice'); if (pr && typeof pr === 'object') Object.keys(pr).forEach(function (k) { if (pr[k] === true && /^[a-z]{2,12}$/.test(k)) G.practice[k] = true; }); }
  G.persist = function () { if (G.prefs.stats) { UI.save('fl-history', G.history); UI.save('fl-practice', G.practice); } };
  G.forgetAll = function () { ['fl-history', 'fl-practice'].forEach(UI.forget); G.history = []; G.practice = {}; G.bus.emit('history'); };

  G.sim = FL.createSim({ rules: { blocklist: G.rules.blocklist, grace: G.rules.grace } });
  G.sim.detector = function () { return R.labels(R.scanProcesses(G.processes(), G.rules)); };
  G.sim.browserProbe = function () { return G.probe(); };
  G.sim.onRedirect = function () { G.redirectActive(); };

  function applyRules() {
    G.rules = G.hist.current; G.sim.rules.blocklist = G.rules.blocklist; G.sim.rules.grace = G.rules.grace;
    G.updateHash(); G.bus.emit('rules'); G.render();
  }
  G.setRules = function (next) { G.hist.push(next); applyRules(); };
  G.setRulesQuiet = function (next) { G.hist.current; G.rules = G.hist.push(next); applyRules(); };
  G.undo = function () { var r = G.hist.undo(); if (r) { applyRules(); return true; } return false; };
  G.redo = function () { var r = G.hist.redo(); if (r) { applyRules(); return true; } return false; };
  G.resetRules = function () { G.setRules(R.defaults()); };
  G.shareHash = function () { return H.encode({ rules: G.rules, scenario: G.scenarioId, preset: G.presetId }); };
  G.updateHash = function () {
    try { var plain = R.sameAsDefault(G.rules) && G.scenarioId === 'tuesday' && G.presetId === 'sprint'; history.replaceState(null, '', plain ? location.pathname + location.search : '#' + G.shareHash()); } catch (e) {}
  };
  /* A link someone sent: reopen its rules and scenario. */
  G.loadHash = function () {
    var d = H.decode(location.hash); if (!d.ok) return false;
    G.hist = R.createHistory(d.state.rules); G.rules = G.hist.current; G.scenarioId = d.state.scenario; G.presetId = d.state.preset;
    G.sim.rules.blocklist = G.rules.blocklist; G.sim.rules.grace = G.rules.grace; return true;
  };
  G.fromLink = G.loadHash();
})();
