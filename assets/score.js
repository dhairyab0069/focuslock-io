/* FocusLock page: session history, summaries and personal stats (page extras). Gentle by design:
   it celebrates coming back, never counts failures, never shows a score that can go down.
   Pure; tested in node. */
(function (root) {
  'use strict';
  var MAX_HISTORY = 50;

  /* Build a record from a finished (or stopped) session. `log` is the sim's event log. */
  function makeRecord(sim, meta) {
    var s = sim.state, ev = [];
    s.log.forEach(function (e) {
      if (['pause', 'resume', 'grace', 'block', 'exit', 'end', 'finish', 'guard', 'resist', 'snooze', 'open', 'park'].indexOf(e.kind) >= 0)
        ev.push({ vt: Math.round(e.vt), kind: e.kind, text: e.text, how: e.how || '', site: e.site || '' });
    });
    return {
      at: meta.at || 0, mins: Math.round(s.total / 60), total: s.total, focused: Math.max(0, Math.round(s.total - s.remaining)),
      endVt: Math.round(s.vt), outcome: s.phase === 'finished' ? 'completed' : ev.some(function (e) { return e.kind === 'exit'; }) ? 'exit' : 'ended',
      scenario: meta.scenario || '', preset: meta.preset || '', events: ev
    };
  }

  /* Pause spans in virtual seconds: [{from,to}]. A pause still open at the end runs to the end. */
  function pauseSpans(rec) {
    var spans = [], open = null;
    rec.events.forEach(function (e) {
      if (e.kind === 'pause' && open === null) open = e.vt;
      else if (e.kind === 'resume' && open !== null) { spans.push({ from: open, to: e.vt }); open = null; }
    });
    if (open !== null) spans.push({ from: open, to: Math.max(open, rec.endVt) });
    return spans;
  }

  function count(rec, kind) { return rec.events.filter(function (e) { return e.kind === kind; }).length; }

  function summarize(rec) {
    var spans = pauseSpans(rec), resumed = count(rec, 'resume');
    return { mins: rec.mins, focusedMin: Math.round(rec.focused / 60), pauses: spans.length, resumed: resumed,
      graces: count(rec, 'grace'), blocks: count(rec, 'block'), exits: count(rec, 'exit'), resisted: count(rec, 'resist') + count(rec, 'park'),
      outcome: rec.outcome };
  }

  /* One kind sentence-set for the end of a session. */
  function narrate(rec) {
    var s = summarize(rec), out = [];
    if (rec.outcome === 'completed') out.push('You finished all ' + s.mins + ' minutes.');
    else if (rec.outcome === 'exit') out.push('You used an emergency exit after ' + s.focusedMin + ' focused minutes. That is exactly what exits are for.');
    else out.push('You stopped after ' + s.focusedMin + ' of ' + s.mins + ' minutes. Stopping is allowed, and every focused minute counted.');
    if (s.resumed) out.push('The clock paused ' + s.pauses + (s.pauses === 1 ? ' time' : ' times') + ' and you came back ' + s.resumed + (s.resumed === 1 ? ' time' : ' times') + '. Coming back is the skill.');
    else if (s.pauses) out.push('The clock paused ' + s.pauses + (s.pauses === 1 ? ' time' : ' times') + '. You can always pick it up again.');
    if (s.blocks) out.push(s.blocks + (s.blocks === 1 ? ' detour was' : ' detours were') + ' turned away for you.');
    if (s.resisted) out.push('You let ' + s.resisted + (s.resisted === 1 ? ' nudge' : ' nudges') + ' pass.');
    if (!s.pauses && !s.blocks && !s.resisted && rec.outcome === 'completed') out.push('A quiet one.');
    return out;
  }

  /* What the timeline shows at virtual second `vt`: how many focused seconds so far, paused or not, events so far. */
  function stateAt(rec, vt) {
    vt = Math.max(0, Math.min(vt, rec.endVt));
    var paused = 0, isPaused = false;
    pauseSpans(rec).forEach(function (sp) {
      if (vt > sp.from) { paused += Math.min(vt, sp.to) - sp.from; if (vt < sp.to) isPaused = true; }
    });
    var so = rec.events.filter(function (e) { return e.vt <= vt; });
    return { vt: vt, focused: Math.max(0, vt - paused), paused: isPaused, events: so, last: so.length ? so[so.length - 1] : null };
  }

  function aggregate(history) {
    var days = {}, a = { sessions: history.length, focusedMinutes: 0, resumes: 0, detours: 0, completed: 0, daysShown: 0 };
    history.forEach(function (r) {
      var sm = summarize(r);
      a.focusedMinutes += sm.focusedMin; a.resumes += sm.resumed; a.detours += sm.blocks; if (r.outcome === 'completed') a.completed++;
      if (r.at) days[new Date(r.at).toDateString()] = 1;
    });
    a.daysShown = Object.keys(days).length;
    return a;
  }

  /* Anything read back from storage is checked before use. */
  function sanitizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.slice(-MAX_HISTORY).forEach(function (r) {
      if (!r || typeof r !== 'object' || !Array.isArray(r.events)) return;
      var evs = r.events.slice(0, 200).filter(function (e) { return e && typeof e.vt === 'number' && typeof e.kind === 'string'; })
        .map(function (e) { return { vt: e.vt, kind: String(e.kind).slice(0, 12), text: String(e.text || '').slice(0, 160), how: String(e.how || '').slice(0, 40), site: String(e.site || '').slice(0, 40) }; });
      out.push({ at: +r.at || 0, mins: +r.mins || 0, total: +r.total || 0, focused: +r.focused || 0, endVt: +r.endVt || 0,
        outcome: ['completed', 'ended', 'exit'].indexOf(r.outcome) >= 0 ? r.outcome : 'ended', scenario: String(r.scenario || '').slice(0, 20), preset: String(r.preset || '').slice(0, 20), events: evs });
    });
    return out;
  }

  var api = { MAX_HISTORY: MAX_HISTORY, makeRecord: makeRecord, pauseSpans: pauseSpans, summarize: summarize, narrate: narrate, stateAt: stateAt, aggregate: aggregate, sanitizeHistory: sanitizeHistory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLScore = api;
})(typeof window !== 'undefined' ? window : globalThis);
