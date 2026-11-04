/* FocusLock page: a link that reopens your rules and scenario. Encodes the editable state into the URL hash
   (#s=...) and reads it back with strict checks. Nothing is sent anywhere. Pure; tested in node. */
(function (root) {
  'use strict';
  var R = root.FLRules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  var SC = root.FLScenario || (typeof require !== 'undefined' ? require('./scenario.js') : null);
  var TYPES = ['app', 'cmd-exe', 'cmd-contains'];

  function b64e(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* state: {rules, scenario, preset}. Rules that equal the defaults are left out to keep links short. */
  function encode(state) {
    var o = { v: 1, s: state.scenario, p: state.preset || '' };
    var d = R.defaults(), r = state.rules;
    if (r.mins !== d.mins) o.m = r.mins;
    if (r.grace !== d.grace) o.g = r.grace;
    if (JSON.stringify(r.blocklist) !== JSON.stringify(d.blocklist)) o.b = r.blocklist.map(function (b) { return [b.domain, b.name, R.CATEGORIES.indexOf(b.category)]; });
    if (JSON.stringify(r.patterns) !== JSON.stringify(d.patterns)) o.x = r.patterns.map(function (p) { return [TYPES.indexOf(p.type), p.value, p.label]; });
    return 's=' + b64e(JSON.stringify(o));
  }

  function decode(hash) {
    var m = /^#?s=([A-Za-z0-9_-]{1,8000})$/.exec(String(hash || ''));
    if (!m) return { ok: false };
    var o;
    try { o = JSON.parse(b64d(m[1])); } catch (e) { return { ok: false }; }
    if (!o || o.v !== 1) return { ok: false };
    var rules = R.defaults();
    if (o.m !== undefined) rules.mins = R.clampInt(o.m, R.LIMITS.minsMin, R.LIMITS.minsMax, rules.mins);
    if (o.g !== undefined) rules.grace = R.clampInt(o.g, R.LIMITS.graceMin, R.LIMITS.graceMax, rules.grace);
    if (Array.isArray(o.b)) {
      var list = [], seen = {};
      o.b.slice(0, R.LIMITS.sites).forEach(function (b) {
        if (!Array.isArray(b)) return;
        var d = R.normalizeDomain(b[0]); if (!d || seen[d]) return; seen[d] = 1;
        list.push({ domain: d, name: R.cleanText(b[1]) || d, category: R.CATEGORIES[b[2]] || 'other' });
      });
      rules.blocklist = list;
    }
    if (Array.isArray(o.x)) {
      var pats = [];
      o.x.slice(0, R.LIMITS.patterns).forEach(function (p) {
        if (!Array.isArray(p) || !TYPES[p[0]]) return;
        var v = R.cleanText(p[1]); if (!v) return;
        pats.push({ type: TYPES[p[0]], value: v, label: R.cleanText(p[2]) || v });
      });
      rules.patterns = pats;
    }
    var sc = SC.scenario(String(o.s));
    var pr = SC.preset(String(o.p)); 
    return { ok: true, state: { rules: rules, scenario: sc.id, preset: pr ? pr.id : '' } };
  }

  var api = { encode: encode, decode: decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLHash = api;
})(typeof window !== 'undefined' ? window : globalThis);
