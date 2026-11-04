// Node checks for the DOM-free rules: node tests/run.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FL = require('../assets/core.js');
const FX = require('../assets/fx.js');

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
ok('page hygiene: no external requests, no secrets, no source paths', () => {
  const root = path.join(__dirname, '..');
  const files = ['index.html', 'assets/app.js', 'assets/core.js', 'assets/sound.js', 'assets/fx.js', 'assets/style.css'];
  for (const f of files) {
    const t = fs.readFileSync(path.join(root, f), 'utf8');
    if (f === 'index.html') {
      for (const m of t.matchAll(/<(script|img|iframe)[^>]+src="([^"]+)"/g)) assert.ok(!/^(https?:)?\/\//.test(m[2]), 'external ' + m[2]);
      for (const m of t.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) assert.ok(!/^(https?:)?\/\//.test(m[1]), 'external ' + m[1]);
    }
    if (f.endsWith('.css')) assert.ok(!/@import|url\(\s*['"]?(https?:)?\/\//.test(t), 'css loads external');
    assert.ok(!/api[_-]?key|sk-[a-z0-9]{10}|\/Users\/|github\.com\/dhairyab0069\/FocusLock(?!-io)/i.test(t), f);
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(t), f + ' makes requests');
  }
});
console.log(`\n${n} passed`);
