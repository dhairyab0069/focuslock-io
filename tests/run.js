// Node checks for the DOM-free rules: node tests/run.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FL = require('../assets/core.js');
const FX = require('../assets/fx.js');
const R = require('../assets/rules.js');
const SC = require('../assets/scenario.js');
const SCORE = require('../assets/score.js');
const HASH = require('../assets/hash.js');
const CH = require('../assets/challenge.js');
const WM = require('../assets/wm.js');
const FLD = require('../assets/field.js');

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok', n, name); };
const V = (u) => FL.verdictForUrl(u);

ok('formatTime pads and clamps', () => {
  assert.equal(FL.formatTime(0), '00:00'); assert.equal(FL.formatTime(1500), '25:00');
  assert.equal(FL.formatTime(65), '01:05'); assert.equal(FL.formatTime(-4), '00:00');
});
ok('social and LLM sites are blocked, with category', () => {
  assert.equal(V('https://www.reddit.com/r/x').kind, 'blocked');
  assert.equal(V('https://claude.ai/chat').category, 'LLM');
  assert.equal(V('https://x.com/home').site, 'X');
});
ok('subdomains match but look-alikes do not', () => {
  assert.equal(V('https://old.reddit.com').kind, 'blocked');
  assert.equal(V('https://notreddit.com').kind, 'allowed');
  assert.equal(V('https://box.com').kind, 'allowed');
  assert.equal(V('https://reddit.com.example.org').kind, 'allowed');
});
ok('search, docs, YouTube and music stay allowed', () => {
  for (const u of ['https://www.google.com/search?q=x', 'https://developer.apple.com/documentation', 'https://www.youtube.com/watch?v=1',
    'https://music.youtube.com', 'https://open.spotify.com', 'https://music.apple.com', 'https://soundcloud.com'])
    assert.equal(V(u).kind, 'allowed', u);
});
ok('non-http addresses are never filtered', () => {
  for (const u of ['', 'about:blank', 'file:///Users/x/index.html', 'chrome://settings', 'favorites://'])
    assert.equal(V(u).kind, 'allowed', u);
});
ok('host matching ignores case; garbage does not throw', () => {
  assert.equal(V('https://WWW.TikTok.COM/').kind, 'blocked');
  assert.equal(V('http://').kind, 'allowed');
});
ok('command lines: claude CLI and apps are recognised', () => {
  const c = FL.classifyCommandLine;
  assert.equal(c('claude'), 'Claude Code (CLI)'); assert.equal(c('claude --resume'), 'Claude Code (CLI)');
  assert.equal(c('/opt/homebrew/bin/claude -p hi'), 'Claude Code (CLI)');
  assert.equal(c('/Applications/Claude.app/Contents/MacOS/Claude'), 'Claude (app)');
  assert.equal(c('/Applications/ChatGPT.app/Contents/MacOS/ChatGPT'), 'ChatGPT (app)');
  assert.equal(c('/Applications/Perplexity.app/Contents/MacOS/x'), 'Perplexity (app)');
  assert.equal(c('/usr/bin/claudette'), null); assert.equal(c('vim claude.txt'), null); assert.equal(c('/bin/zsh'), null);
});
ok('a clean session counts down and finishes', () => {
  const sim = FL.createSim(); assert.ok(sim.start(1).ok);
  for (let i = 0; i < 60; i++) sim.tick(1);
  assert.equal(sim.state.phase, 'finished'); assert.equal(sim.state.remaining, 0);
});
ok('speed scales the countdown only', () => {
  const sim = FL.createSim(); sim.start(25);
  for (let i = 0; i < 10; i++) sim.tick(30);
  assert.equal(sim.state.remaining, 1500 - 300);
});
ok('start is refused while an LLM is open, and lists it', () => {
  const sim = FL.createSim(); sim.setApp('Claude (app)', true);
  const r = sim.start(25); assert.equal(r.ok, false); assert.deepEqual(r.blockers, ['Claude (app)']);
  assert.equal(sim.state.phase, 'idle');
  sim.setApp('Claude (app)', false); assert.ok(sim.start(25).ok);
});
ok('an LLM opened mid-session pauses the clock within one scan, closing resumes it', () => {
  const sim = FL.createSim(); sim.start(25);
  sim.tick(1); sim.tick(1);
  sim.setApp('ChatGPT (app)', true);
  for (let i = 0; i < FL.SCAN_EVERY; i++) sim.tick(1);
  assert.equal(sim.paused, true); assert.equal(sim.state.overlay.kind, 'llm');
  const frozen = sim.state.remaining;
  for (let i = 0; i < 10; i++) sim.tick(1);
  assert.equal(sim.state.remaining, frozen);
  sim.setApp('ChatGPT (app)', false);
  for (let i = 0; i < FL.SCAN_EVERY; i++) sim.tick(1);
  assert.equal(sim.paused, false); assert.equal(sim.state.overlay, null);
  const before = sim.state.remaining; sim.tick(1); assert.equal(sim.state.remaining, before - 1);
});
ok('grace lowers the overlay for 30s, keeps the clock paused, then the overlay returns', () => {
  const sim = FL.createSim(); sim.start(25); sim.setApp('Claude Code (CLI)', true);
  for (let i = 0; i < FL.SCAN_EVERY; i++) sim.tick(1);
  assert.equal(sim.state.overlay.kind, 'llm');
  sim.grantGrace(); assert.equal(sim.state.overlay, null); assert.equal(sim.paused, true);
  const r = sim.state.remaining;
  for (let i = 0; i < FL.GRACE - 1; i++) sim.tick(1);
  assert.equal(sim.state.overlay, null); assert.equal(sim.state.remaining, r);
  for (let i = 0; i < FL.SCAN_EVERY + 1; i++) sim.tick(1);
  assert.equal(sim.state.overlay.kind, 'llm');
});
ok('a blocked site is redirected, counted, and the overlay clears after 2s', () => {
  const sim = FL.createSim(); sim.start(25);
  const r = sim.visit('https://www.instagram.com/'); assert.equal(r.verdict.kind, 'blocked');
  assert.equal(sim.state.violations, 1); assert.equal(sim.state.last, 'Instagram'); assert.equal(sim.state.tab, 'about:blank');
  assert.equal(sim.state.overlay.kind, 'browser');
  sim.tick(1); assert.ok(sim.state.overlay); sim.tick(1); assert.equal(sim.state.overlay, null);
});
ok('allowed sites are not counted; outside a session nothing is policed', () => {
  const sim = FL.createSim();
  assert.equal(sim.visit('https://reddit.com').policed, false); assert.equal(sim.state.violations, 0);
  sim.start(25); sim.visit('https://docs.python.org'); assert.equal(sim.state.violations, 0);
});
ok('without Automation permission the browser is locked and counted', () => {
  const sim = FL.createSim(); sim.start(25); sim.state.automation = false;
  const r = sim.visit('https://docs.python.org'); assert.equal(r.unreadable, true);
  assert.equal(sim.state.violations, 1); assert.equal(sim.state.overlay.kind, 'unreadable');
  for (let i = 0; i < 4; i++) sim.tick(1); assert.equal(sim.state.overlay, null);
});
ok('every emergency exit ends the session even under the red screen', () => {
  for (const how of ['SOS button', 'Cmd+Shift+Esc', 'focuslock unlock']) {
    const sim = FL.createSim(); sim.start(25); sim.setApp('Claude (app)', true);
    for (let i = 0; i < FL.SCAN_EVERY; i++) sim.tick(1);
    assert.ok(sim.state.overlay);
    assert.equal(sim.emergencyExit(how), true);
    assert.equal(sim.state.phase, 'idle'); assert.equal(sim.state.overlay, null);
    assert.equal(sim.emergencyExit(how), false);
  }
});
ok('ending early works and logs a reason', () => {
  const sim = FL.createSim(); sim.start(25); assert.equal(sim.endEarly(), true);
  assert.equal(sim.state.phase, 'idle'); assert.ok(sim.state.log.some((l) => l.kind === 'end' && l.why));
});
ok('easing stays in range and hits its ends', () => {
  for (const f of [FX.easeOutCubic, FX.easeInOutCubic]) {
    assert.equal(f(0), 0); assert.equal(f(1), 1); assert.equal(f(-5), 0); assert.equal(f(9), 1);
    let prev = -1; for (let i = 0; i <= 20; i++) { const v = f(i / 20); assert.ok(v >= prev); prev = v; }
  }
});
ok('smooth approaches the target without overshoot and is frame-rate independent', () => {
  let a = 0; for (let i = 0; i < 60; i++) a = FX.smooth(a, 1, 1 / 60, 5);
  let b = 0; for (let i = 0; i < 30; i++) b = FX.smooth(b, 1, 1 / 30, 5);
  assert.ok(a < 1 && a > 0.99); assert.ok(Math.abs(a - b) < 1e-9);
});
ok('breath is a slow 0..1 wave starting and ending at 0', () => {
  assert.ok(Math.abs(FX.breath(0, 6)) < 1e-9); assert.ok(Math.abs(FX.breath(3, 6) - 1) < 1e-9); assert.ok(Math.abs(FX.breath(6, 6)) < 1e-9);
});
ok('motion is off for calm mode, reduced motion or a hidden tab', () => {
  assert.equal(FX.motionAllowed({ calm: 'off', reduced: false, hidden: false }), true);
  assert.equal(FX.motionAllowed({ calm: 'on' }), false); assert.equal(FX.motionAllowed({ calm: 'off', reduced: true }), false);
  assert.equal(FX.motionAllowed({ calm: 'off', hidden: true }), false);
});
ok('every repeating motion is slow enough: well under 3 flashes per second', () => {
  for (const k of ['BREATH', 'SCAN', 'BROWSER_POLL', 'SOS_PULSE']) assert.ok(1 / FX.TIMING[k] <= 0.5, k);
  assert.equal(FX.TIMING.SCAN, FL.SCAN_EVERY); assert.equal(FX.TIMING.BROWSER_POLL, FL.BROWSER_POLL);
});
ok('sweep index walks the rows once and then ends', () => {
  assert.equal(FX.sweepIndex(0, 6), 0); assert.equal(FX.sweepIndex(0.5, 6), 3); assert.equal(FX.sweepIndex(0.999, 6), 5);
  assert.equal(FX.sweepIndex(1, 6), -1); assert.equal(FX.sweepIndex(-1, 6), -1); assert.equal(FX.sweepIndex(0.5, 0), -1);
});
ok('typing slices grow monotonically to the full address', () => {
  const s = 'https://x.com'; let prev = 0;
  for (let t = 0; t <= 300; t += 30) { const v = FX.typingSlice(s, t, 300); assert.ok(v.length >= prev && s.startsWith(v)); prev = v.length; }
  assert.equal(FX.typingSlice(s, 999, 300), s); assert.equal(FX.typingSlice(s, 0, 300), '');
});
ok('particles: hard cap, rise while focused, scatter then drain, then clear', () => {
  const P = FX.createParticles({ cap: 48, seed: 3 });
  P.setRest('rise');
  for (let i = 0; i < 3000; i++) { P.step(1 / 60, 400, 300); assert.ok(P.count() <= 48); }
  assert.ok(P.count() > 10); assert.equal(P.mode(), 'rise');
  P.setRest('off'); P.scatter(200, 150);
  assert.equal(P.mode(), 'scatter'); assert.ok(P.count() <= 48);
  const before = P.list.map((p) => Math.hypot(p.x - 200, p.y - 150)).reduce((a, b) => a + b, 0) / P.count();
  for (let i = 0; i < 50; i++) P.step(1 / 60, 400, 300);
  const spread = P.list.map((p) => Math.hypot(p.x - 200, p.y - 150)).reduce((a, b) => a + b, 0) / P.count();
  assert.ok(spread > before, 'scatters outward');
  for (let i = 0; i < 400; i++) { P.step(1 / 60, 400, 300); assert.ok(P.count() <= 48); }
  assert.equal(P.mode(), 'off'); assert.equal(P.count(), 0);
});
ok('particles: scatter then drain resumes rising when the session goes on', () => {
  const P = FX.createParticles({ cap: 30, seed: 9 }); P.setRest('rise'); P.scatter(100, 100);
  for (let i = 0; i < 300; i++) P.step(1 / 60, 200, 200);
  assert.equal(P.mode(), 'rise');
});
ok('particle alpha is gentle and never above 0.5', () => {
  const P = FX.createParticles({ cap: 10, seed: 1 }); P.setRest('rise');
  for (let i = 0; i < 600; i++) { P.step(1 / 30, 300, 200); for (const p of P.list) assert.ok(P.alpha(p) >= 0 && P.alpha(p) <= 0.5); }
});
ok('motion code uses transform, opacity and clip-path only, and one animation frame loop', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'assets/style.css'), 'utf8');
  const fx = fs.readFileSync(path.join(__dirname, '..', 'assets/fx.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, '..', 'assets/app.js'), 'utf8');
  assert.equal((fx.match(/requestAnimationFrame\(frame\)/g) || []).length, 2); // start and continue, same loop
  assert.ok(!/setInterval/.test(fx));
  for (const m of css.matchAll(/@keyframes [\w-]+ \{/g)) {
    let depth = 1, i = m.index + m[0].length; const start = i;
    while (depth && i < css.length) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
    assert.ok(!/(width|height|top|left|margin|padding)\s*:/.test(css.slice(start, i)), 'layout property animated in ' + m[0]);
  }
  assert.ok(/data-calm/.test(fx) && /matchMedia/.test(fx));
});
/* ---------- playable world: rules, scenarios, score, hash, challenge, window manager ---------- */
ok('rules: defaults mirror the app (21 sites, 9 program patterns, 30s grace)', () => {
  const d = R.defaults(); assert.equal(d.blocklist.length, 21); assert.equal(d.patterns.length, 9); assert.equal(d.grace, 30); assert.equal(R.sameAsDefault(d), true);
});
ok('rules: normalizeDomain accepts hosts and rejects junk', () => {
  assert.equal(R.normalizeDomain('https://WWW.Example.com/path?q=1'), 'example.com'); assert.equal(R.normalizeDomain('foo.bar.co:8080'), 'foo.bar.co');
  for (const bad of ['', 'localhost', 'a b.com', '<script>.com', 'x..com', '-a.com', 'a'.repeat(300) + '.com']) assert.equal(R.normalizeDomain(bad), '', bad);
});
ok('rules: add and remove a site changes verdicts at once, without mutating the old rules', () => {
  const d = R.defaults(); const a = R.addSite(d, { domain: 'redditt.com', name: 'Redditt', category: 'social media' });
  assert.ok(a.ok); assert.equal(d.blocklist.length, 21); assert.equal(FL.verdictForUrl('https://redditt.com', a.rules.blocklist).kind, 'blocked');
  assert.equal(FL.verdictForUrl('https://redditt.com', d.blocklist).kind, 'allowed');
  assert.equal(R.addSite(a.rules, { domain: 'redditt.com' }).ok, false);
  const r = R.removeSite(a.rules, 'reddit.com'); assert.equal(FL.verdictForUrl('https://reddit.com', r.rules.blocklist).kind, 'allowed');
  assert.equal(R.addSite(d, { domain: 'not a site' }).ok, false);
});
ok('rules: list sizes are capped', () => {
  let r = R.defaults(); for (let i = 0; i < 200; i++) { const x = R.addSite(r, { domain: 'site' + i + '.com' }); if (x.ok) r = x.rules; }
  assert.equal(r.blocklist.length, R.LIMITS.sites);
});
ok('rules: grace and length are clamped', () => {
  const d = R.defaults(); assert.equal(R.setGrace(d, 5000).grace, 300); assert.equal(R.setGrace(d, 1).grace, 5); assert.equal(R.setGrace(d, 'x').grace, 30);
  assert.equal(R.setMins(d, 0).mins, 1); assert.equal(R.setMins(d, 999).mins, 240);
});
ok('rules: process scan matches app names and command lines, and names the reason', () => {
  const d = R.defaults();
  const hits = R.scanProcesses([{ pid: 1, app: 'Claude', cmd: '/Applications/Claude.app/Contents/MacOS/Claude' }, { pid: 2, app: null, cmd: '/opt/homebrew/bin/claude -p x' }, { pid: 3, app: 'Finder', cmd: '/System/Finder' }], d);
  assert.deepEqual(R.labels(hits), ['Claude (app)', 'Claude Code (CLI)']); assert.ok(hits.every((h) => h.pid !== 3)); assert.ok(hits.some((h) => /app name/.test(h.by)));
});
ok('rules: scan agrees with the core command-line classifier for the default patterns', () => {
  const d = R.defaults();
  for (const line of ['claude', 'claude --resume', '/opt/homebrew/bin/claude -p hi', '/Applications/Claude.app/Contents/MacOS/Claude', '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT', '/usr/bin/claudette', 'vim claude.txt', '/bin/zsh']) {
    const viaCore = FL.classifyCommandLine(line); const viaRules = R.labels(R.scanProcesses([{ pid: 1, app: null, cmd: line }], d));
    assert.deepEqual(viaRules, viaCore ? [viaCore] : [], line);
  }
});
ok('rules: custom patterns work (a renamed binary is recognised once added)', () => {
  const d = R.defaults(), p = { pid: 1, app: null, cmd: '/usr/local/bin/cld' };
  assert.equal(R.scanProcesses([p], d).length, 0);
  const a = R.addPattern(d, { type: 'cmd-exe', value: 'cld', label: 'Renamed CLI' }); assert.ok(a.ok);
  assert.deepEqual(R.labels(R.scanProcesses([p], a.rules)), ['Renamed CLI']); assert.equal(R.addPattern(a.rules, { type: 'cmd-exe', value: 'cld' }).ok, false);
  assert.equal(R.addPattern(d, { type: 'bogus', value: 'x' }).ok, false);
});
ok('rules: only the six browsers the app reads are watched (not Firefox)', () => {
  assert.equal(R.isWatchedBrowser('com.apple.Safari'), true); assert.equal(R.isWatchedBrowser('company.thebrowser.Browser'), true); assert.equal(R.isWatchedBrowser('org.mozilla.firefox'), false);
});
ok('rules: undo and redo walk the edit history', () => {
  const h = R.createHistory(R.defaults()); assert.equal(h.canUndo(), false);
  h.push(R.addSite(h.current, { domain: 'a.com' }).rules); h.push(R.addSite(h.current, { domain: 'b.com' }).rules);
  assert.equal(h.current.blocklist.length, 23); h.undo(); assert.equal(h.current.blocklist.length, 22); h.undo(); assert.equal(h.current.blocklist.length, 21); assert.equal(h.undo(), null);
  h.redo(); assert.equal(h.current.blocklist.length, 22); h.push(R.defaults()); assert.equal(h.canRedo(), false);
});
ok('sim: custom rules change what the watchdog does', () => {
  const rules = R.addSite(R.defaults(), { domain: 'news.example.com', name: 'News', category: 'other' }).rules;
  const sim = FL.createSim({ rules: { blocklist: rules.blocklist, grace: 12 } }); sim.start(25);
  assert.equal(sim.visit('https://news.example.com/x').verdict.kind, 'blocked');
  sim.setApp('Claude (app)', true); for (let i = 0; i < FL.SCAN_EVERY; i++) sim.tick(1); sim.grantGrace(); assert.equal(sim.state.grace, 12);
});
ok('sim: the detector and the browser probe drive the watchdog like the app does', () => {
  const sim = FL.createSim(); const d = R.defaults(); let procs = [], front = { frontmost: true, url: 'https://docs.swift.org' }, redirected = 0;
  sim.detector = () => R.labels(R.scanProcesses(procs, d)); sim.browserProbe = () => front; sim.onRedirect = () => redirected++;
  sim.start(25); for (let i = 0; i < 4; i++) sim.tick(1); assert.equal(sim.state.violations, 0);
  front = { frontmost: false, url: 'https://reddit.com' }; for (let i = 0; i < 6; i++) sim.tick(1); assert.equal(sim.state.violations, 0, 'not frontmost: not policed');
  front = { frontmost: true, url: 'https://reddit.com' }; for (let i = 0; i < 3; i++) sim.tick(1); assert.equal(sim.state.violations, 1); assert.equal(redirected, 1);
  procs = [{ pid: 1, app: null, cmd: 'claude' }]; for (let i = 0; i < 5; i++) sim.tick(1); assert.equal(sim.paused, true);
});
ok('sim: log entries carry virtual time and exit method for the timeline', () => {
  const sim = FL.createSim(); sim.start(1); sim.setApp('Claude (app)', true); for (let i = 0; i < 5; i++) sim.tick(10); sim.emergencyExit('SOS button');
  const e = sim.state.log.filter((l) => l.kind === 'exit')[0]; assert.equal(e.how, 'SOS button'); assert.ok(e.vt >= 40);
});
ok('scenarios: every scenario is well formed and in order', () => {
  assert.ok(SC.SCENARIOS.length >= 3); assert.ok(SC.PRESETS.length >= 3);
  for (const s of SC.SCENARIOS) { let last = 0; assert.ok(s.events.length >= 3); for (const e of s.events) { assert.ok(e.at > 0 && e.at < 1 && e.at >= last); last = e.at; assert.ok(['banner', 'tab', 'launch'].includes(e.kind)); } }
  for (const p of SC.PRESETS) assert.ok(SC.scenario(p.scenario).id === p.scenario && p.mins >= 1);
});
ok('scheduler: events come due once, in order, only as focused time passes; snooze is capped', () => {
  const ev = SC.schedule(SC.scenario('tuesday'), 1500); const sch = SC.createScheduler(ev);
  assert.deepEqual(sch.due(0), []); const first = sch.due(ev[0].t); assert.equal(first.length, 1); assert.deepEqual(sch.due(ev[0].t), []);
  assert.ok(sch.snooze(first[0], ev[0].t, 300)); assert.equal(sch.due(ev[0].t + 299).filter((e) => e.snoozed).length, 0); assert.equal(sch.due(ev[0].t + 300).filter((e) => e.snoozed).length, 1);
  let e = first[0]; for (let i = 0; i < 5; i++) { const ok2 = sch.snooze(e, 0, 1); if (!ok2) break; e = sch.due(99999).filter((x) => x.id === e.id)[0]; }
  assert.equal(e.snoozed <= 3, true);
  assert.equal(SC.createScheduler(SC.schedule(SC.scenario('rabbit'), 5400)).due(5400).length, 5);
});
ok('scenario: an unknown scenario falls back safely', () => { assert.equal(SC.scenario('nope').id, 'tuesday'); assert.equal(SC.preset('nope'), null); });
const fakeSession = () => {
  const sim = FL.createSim(); sim.start(25); sim.state.log = []; return sim;
};
ok('score: records, spans, summary and narration for a session with a pause', () => {
  const sim = FL.createSim(); sim.start(25);
  for (let i = 0; i < 4; i++) sim.tick(30); sim.setApp('Claude (app)', true); for (let i = 0; i < 5; i++) sim.tick(30);
  sim.setApp('Claude (app)', false); for (let i = 0; i < 6; i++) sim.tick(30); sim.endEarly();
  const rec = SCORE.makeRecord(sim, { at: 1000, scenario: 'tuesday', preset: 'sprint' });
  assert.equal(rec.outcome, 'ended'); assert.equal(SCORE.pauseSpans(rec).length, 1); const s = SCORE.summarize(rec); assert.equal(s.pauses, 1); assert.equal(s.resumed, 1);
  const text = SCORE.narrate(rec).join(' '); assert.ok(/came back/.test(text)); assert.ok(!/fail|lost|bad|wasted|only/i.test(text));
});
ok('score: narration never uses shaming words for any outcome', () => {
  for (const outcome of ['completed', 'ended', 'exit']) for (const ev of [[], [{ vt: 10, kind: 'pause', text: '' }], [{ vt: 5, kind: 'block', text: '' }, { vt: 9, kind: 'exit', text: '', how: 'x' }]]) {
    const t = SCORE.narrate({ mins: 25, focused: 600, endVt: 100, outcome, events: ev }).join(' ');
    assert.ok(!/fail|lost|bad|wasted|weak|give up|gave up|streak|disappoint|only /i.test(t), t);
  }
});
ok('score: stateAt subtracts paused time and reports the pause', () => {
  const rec = { mins: 25, focused: 600, endVt: 100, outcome: 'completed', events: [{ vt: 20, kind: 'pause' }, { vt: 50, kind: 'resume' }] };
  assert.equal(SCORE.stateAt(rec, 10).focused, 10); assert.equal(SCORE.stateAt(rec, 30).paused, true); assert.equal(SCORE.stateAt(rec, 30).focused, 20);
  assert.equal(SCORE.stateAt(rec, 80).focused, 50); assert.equal(SCORE.stateAt(rec, 80).paused, false); assert.equal(SCORE.stateAt(rec, 999).vt, 100);
});
ok('score: aggregate counts good things only and sanitizeHistory rejects junk', () => {
  const recs = [{ at: 86400000 * 3, mins: 25, total: 1500, focused: 1500, endVt: 1500, outcome: 'completed', events: [{ vt: 1, kind: 'pause' }, { vt: 2, kind: 'resume' }] }, { at: 86400000 * 5, mins: 25, total: 1500, focused: 300, endVt: 300, outcome: 'ended', events: [] }];
  const a = SCORE.aggregate(recs); assert.equal(a.sessions, 2); assert.equal(a.resumes, 1); assert.equal(a.focusedMinutes, 30); assert.equal(a.daysShown, 2); assert.ok(!('failed' in a) && !('streak' in a));
  assert.deepEqual(SCORE.sanitizeHistory('x'), []); assert.equal(SCORE.sanitizeHistory([null, 3, { events: 'x' }, recs[0]]).length, 1);
  assert.equal(SCORE.sanitizeHistory(new Array(80).fill(recs[0])).length, 50);
});
ok('hash: default state round-trips, and links stay short', () => {
  const st = { rules: R.defaults(), scenario: 'afternoon', preset: 'deep' }; const h = HASH.encode(st); assert.ok(h.length < 80, h);
  const d = HASH.decode('#' + h); assert.ok(d.ok); assert.equal(d.state.scenario, 'afternoon'); assert.equal(d.state.preset, 'deep'); assert.ok(R.sameAsDefault(d.state.rules));
});
ok('hash: edited rules round-trip exactly, including non-ASCII names', () => {
  let r = R.defaults(); r = R.addSite(r, { domain: 'news.example.com', name: 'Nachrichten ☕', category: 'other' }).rules; r = R.removeSite(r, 'x.com').rules;
  r = R.addPattern(r, { type: 'cmd-exe', value: 'cld', label: 'Renamed' }).rules; r = R.setGrace(R.setMins(r, 50), 12);
  const d = HASH.decode(HASH.encode({ rules: r, scenario: 'rabbit', preset: '' })); assert.ok(d.ok); assert.deepEqual(d.state.rules, r);
});
ok('hash: malformed, hostile or oversize input is rejected or sanitised', () => {
  for (const bad of ['', '#', '#s=', '#s=!!!', '#x=1', '#s=' + 'A'.repeat(9000), '#s=' + Buffer.from('{"v":2}').toString('base64url'), '#s=' + Buffer.from('not json').toString('base64url')]) assert.equal(HASH.decode(bad).ok, false, bad);
  const evil = { v: 1, s: '<img onerror=x>', p: 'zzz', g: 99999, m: -4, b: [['javascript:alert(1)', '<b>x</b>', 1], ['ok.com', '<script>', 0], 'str', ['ok.com', 'dup', 0]], x: [[9, 'x', 'y'], [0, '', 'e'], [1, 'good', '<i>']] };
  const d = HASH.decode('#s=' + Buffer.from(JSON.stringify(evil)).toString('base64url')); assert.ok(d.ok);
  assert.equal(d.state.scenario, 'tuesday'); assert.equal(d.state.preset, ''); assert.equal(d.state.rules.grace, 300); assert.equal(d.state.rules.mins, 1);
  assert.deepEqual(d.state.rules.blocklist.map((b) => b.domain), ['ok.com']); assert.ok(!/[<>]/.test(JSON.stringify(d.state.rules)));
  assert.deepEqual(d.state.rules.patterns.map((p) => p.value), ['good']);
});
ok('challenge: with the default rules the guards and the gaps are exactly the honest ones', () => {
  const res = Object.fromEntries(CH.evaluateAll(R.defaults()).map((r) => [r.id, r.outcome]));
  for (const id of ['subdomain', 'shout', 'port', 'llmsite', 'minimise', 'cli', 'quit']) assert.equal(res[id], 'held', id);
  for (const id of ['lookalike', 'ip', 'proxy', 'data', 'llmlook', 'background', 'firefox', 'renamed', 'remote']) assert.equal(res[id], 'gap', id);
  assert.equal(res.preflight, 'refused'); assert.equal(res.unlock, 'by-design');
});
ok('challenge: closing a gap in the rules lab flips the verdict and the explanation', () => {
  let r = R.defaults(); const before = CH.evaluate(CH.ATTEMPTS.find((a) => a.id === 'lookalike'), r); assert.equal(before.outcome, 'gap'); assert.match(before.why, /Rules lab/);
  r = R.addSite(r, { domain: 'redditt.com', name: 'Redditt', category: 'social media' }).rules; assert.equal(CH.evaluate(CH.ATTEMPTS.find((a) => a.id === 'lookalike'), r).outcome, 'held');
  r = R.addPattern(R.defaults(), { type: 'cmd-exe', value: 'cld', label: 'CLI' }).rules; assert.equal(CH.evaluate(CH.ATTEMPTS.find((a) => a.id === 'renamed'), r).outcome, 'held');
  r = R.removeSite(R.defaults(), 'reddit.com').rules; assert.equal(CH.evaluate(CH.ATTEMPTS.find((a) => a.id === 'subdomain'), r).outcome, 'gap');
});
ok('challenge: the tally is neutral and complete', () => {
  const t = CH.tally(CH.evaluateAll(R.defaults())); assert.equal(t.held + t.gap + t.refused + t['by-design'], CH.ATTEMPTS.length);
  for (const a of CH.ATTEMPTS) { assert.ok(a.title && a.how && CH.evaluate(a, R.defaults()).why.length > 10); }
});
ok('wm: open, focus, stacking, minimise and the front window', () => {
  const wm = WM.createWM({ w: 800, h: 500 }); wm.open('a', { x: 10, y: 10 }); wm.open('b', { x: 50, y: 50 }); assert.equal(wm.front().id, 'b');
  wm.focus('a'); assert.equal(wm.front().id, 'a'); wm.minimize('a'); assert.equal(wm.front().id, 'b'); wm.minimize('b'); assert.equal(wm.front(), null);
  wm.restore('a'); assert.equal(wm.front().id, 'a'); wm.close('a'); assert.equal(wm.get('a'), null); assert.equal(wm.open('b', {}).min, false);
});
ok('wm: windows cannot be dragged out of reach', () => {
  const wm = WM.createWM({ w: 800, h: 500 }); const w = wm.open('a', { w: 300, h: 200 });
  wm.move('a', -9999, -9999); assert.ok(w.x + w.w >= WM.KEEP); assert.equal(w.y, 0); wm.move('a', 9999, 9999); assert.ok(w.x <= 800 - WM.KEEP); assert.ok(w.y <= 460);
  wm.setBounds({ w: 400, h: 300 }); assert.ok(w.x <= 400 - WM.KEEP);
});
ok('wm: snapping to halves and full, resize limits, tidy', () => {
  const wm = WM.createWM({ w: 800, h: 500 }); wm.open('a', { w: 300, h: 200 });
  assert.deepEqual(wm.snapRect(2, 100), { x: 0, y: 0, w: 400, h: 500 }); assert.deepEqual(wm.snapRect(799, 100), { x: 400, y: 0, w: 400, h: 500 });
  assert.deepEqual(wm.snapRect(300, 1), { x: 0, y: 0, w: 800, h: 500 }); assert.equal(wm.snapRect(300, 100), null);
  wm.resize('a', 50, 50); assert.equal(wm.get('a').w, 240); wm.resize('a', 5000, 5000); assert.equal(wm.get('a').w, 800);
  wm.open('b', { w: 200, h: 100 }); wm.tidy(); assert.ok(wm.get('a').x !== wm.get('b').x);
});
ok('wm: flick velocity is capped and inertia decays to rest inside the desktop', () => {
  const v = WM.velocity([{ x: 0, y: 0, t: 0 }, { x: 5000, y: 0, t: 50 }]); assert.equal(v.vx, 1800); assert.deepEqual(WM.velocity([{ x: 0, y: 0, t: 0 }]), { vx: 0, vy: 0 });
  assert.deepEqual(WM.velocity([{ x: 0, y: 0, t: 0 }, { x: 50, y: 0, t: 900 }]), { vx: 0, vy: 0 }, 'a slow release does not fling');
  let st = { x: 100, y: 100, vx: 1500, vy: -900 }; const win = { w: 300 }, b = { w: 800, h: 500 }, n = 0;
  for (let i = 0; i < 600; i++) { st = WM.inertiaStep(st, 1 / 60, b, win); assert.ok(st.x <= 800 - WM.KEEP && st.y >= 0); if (st.done) break; }
  assert.equal(st.done, true);
});
ok('wm: phones show one app at a time', () => { assert.equal(WM.isPhone(390), true); assert.equal(WM.isPhone(1200), false); assert.deepEqual(WM.phoneRect({ w: 390, h: 600 }), { x: 0, y: 0, w: 390, h: 600 }); });
ok('field: motes part around the pointer, swirl while it is held, and the count stays capped', () => {
  const m = FLD.createMotes({ cap: 60, seed: 2 }); m.fill(800, 600, 9999); assert.equal(m.list.length, 60);
  const near = m.list[0]; near.x = 410; near.y = 300; near.vx = near.vy = 0; const d0 = Math.hypot(near.x - 400, near.y - 300);
  for (let i = 0; i < 20; i++) m.step(1 / 60, 800, 600, { x: 400, y: 300, on: true, down: false, held: 0 }); assert.ok(Math.hypot(near.x - 400, near.y - 300) > d0, 'pushed away');
  const s = FLD.createMotes({ cap: 1, seed: 2 }); s.fill(800, 600, 1); const q = s.list[0]; q.x = 460; q.y = 300; q.vx = q.vy = 0;
  for (let i = 0; i < 30; i++) s.step(1 / 60, 800, 600, { x: 400, y: 300, on: true, down: true, held: 1.5 }); assert.ok(Math.abs(q.y - 300) > 1, 'swirled sideways');
  assert.ok(FLD.moteCount(390) < FLD.moteCount(1400));
});
ok('field: blooms only grow where the pointer rests, are capped, and fade away; ripples end', () => {
  const b = FLD.createBlooms({ cap: 12, seed: 1 }); const still = { x: 100, y: 100, on: true };
  for (let i = 0; i < 60 * 40; i++) { b.update(1 / 60, still); assert.ok(b.list.length <= 12); } assert.ok(b.list.length > 0);
  const moving = FLD.createBlooms({ seed: 1 }); for (let i = 0; i < 600; i++) moving.update(1 / 60, { x: i * 9, y: 50, on: true }); assert.equal(moving.list.length, 0);
  for (let i = 0; i < 60 * 20; i++) b.update(1 / 60, { on: false }); assert.equal(b.list.length, 0);
  const r = FLD.createRipples(3); for (let i = 0; i < 5; i++) r.add(i, i); assert.equal(r.list.length, 3); for (let i = 0; i < 200; i++) r.step(0.02); assert.equal(r.list.length, 0);
});
ok('field: breathing presets pace in and out calmly, and the rake offsets its tines', () => {
  assert.equal(FLD.breathAt(0, '4-6').phase, 'in'); assert.ok(FLD.breathAt(3.99, '4-6').scale > 0.99 && FLD.breathAt(10, '4-6').scale < 0.01);
  assert.equal(FLD.breathAt(5, '4-6').phase, 'out'); assert.equal(FLD.breathAt(5, '4-6').label, 'Breathe out'); assert.equal(FLD.breathCycle('box'), 16); assert.equal(FLD.breathAt(6, 'box').label, 'Hold');
  assert.ok(FLD.breathCycle('4-4') >= 8, 'never faster than a calm pace');
  const o = FLD.offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], 9); assert.ok(o.every((p) => Math.abs(Math.abs(p.y) - 9) < 1e-9));
  assert.equal(FLD.thin([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 8, y: 0 }], 4).length, 2);
});
ok('page hygiene: no external requests, no secrets, no source paths', () => {
  const root = path.join(__dirname, '..');
  const files = ['index.html', 'assets/app.js', 'assets/core.js', 'assets/sound.js', 'assets/fx.js', 'assets/style.css', 'assets/ui.js', 'assets/rules.js', 'assets/scenario.js', 'assets/score.js', 'assets/hash.js', 'assets/challenge.js', 'assets/wm.js', 'assets/keys.js', 'assets/state.js', 'assets/desktop.js', 'assets/panels.js', 'assets/field.js', 'assets/nature.js'];
  for (const f of files) {
    const t = fs.readFileSync(path.join(root, f), 'utf8');
    if (f === 'index.html') {
      for (const m of t.matchAll(/<(script|img|iframe)[^>]+src="([^"]+)"/g)) assert.ok(!/^(https?:)?\/\//.test(m[2]), 'external ' + m[2]);
      for (const m of t.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) assert.ok(!/^(https?:)?\/\//.test(m[1]), 'external ' + m[1]);
    }
    if (f.endsWith('.css')) assert.ok(!/@import|url\(\s*['"]?(https?:)?\/\//.test(t), 'css loads external');
    assert.ok(!/api[_-]?key|sk-[a-z0-9]{10}|\/Users\/dhairya|github\.com\/dhairyab0069\/FocusLock(?!-io)/i.test(t), f);
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(t), f + ' makes requests');
  }
});
console.log(`\n${n} passed`);
