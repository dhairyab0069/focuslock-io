/* FocusLock page: the simulator's rules, with no DOM so node can test them.
   Classic script: sets window.FL in the browser, module.exports in node.
   This is a model of the app's behaviour written for this page, not the app's source. */
(function (root) {
  'use strict';

  /* Sites the filter redirects away from. YouTube and music services are
     deliberately absent: concentration music is allowed. */
  var BLOCKLIST = [
    ['instagram.com', 'Instagram', 'social media'],
    ['facebook.com', 'Facebook', 'social media'],
    ['twitter.com', 'Twitter/X', 'social media'],
    ['x.com', 'X', 'social media'],
    ['tiktok.com', 'TikTok', 'social media'],
    ['reddit.com', 'Reddit', 'social media'],
    ['snapchat.com', 'Snapchat', 'social media'],
    ['threads.net', 'Threads', 'social media'],
    ['pinterest.com', 'Pinterest', 'social media'],
    ['tumblr.com', 'Tumblr', 'social media'],
    ['twitch.tv', 'Twitch', 'social media'],
    ['discord.com', 'Discord', 'social media'],
    ['claude.ai', 'Claude', 'LLM'],
    ['chatgpt.com', 'ChatGPT', 'LLM'],
    ['chat.openai.com', 'ChatGPT', 'LLM'],
    ['gemini.google.com', 'Gemini', 'LLM'],
    ['perplexity.ai', 'Perplexity', 'LLM'],
    ['copilot.microsoft.com', 'Copilot', 'LLM'],
    ['poe.com', 'Poe', 'LLM'],
    ['grok.com', 'Grok', 'LLM'],
    ['chat.deepseek.com', 'DeepSeek', 'LLM']
  ].map(function (r) { return { domain: r[0], name: r[1], category: r[2] }; });

  /* Things the watchdog looks for on the machine. */
  var LLM_PROGRAMS = ['Claude (app)', 'ChatGPT (app)', 'Perplexity (app)', 'Claude Code (CLI)', 'Copilot (app)', 'Gemini (app)'];

  var SCAN_EVERY = 5;      /* seconds between watchdog scans */
  var BROWSER_POLL = 2;    /* seconds between tab checks (shown for context) */
  var GRACE = 30;          /* seconds the red screen stands down */
  var REDIRECT = 'about:blank';

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* The filter only reads http(s) addresses; blank tabs, browser pages and
     local files are always fine. A site matches when the host is the domain
     or a subdomain of it ("old.reddit.com" yes, "notreddit.com" no). */
  function verdictForUrl(input) {
    var trimmed = String(input == null ? '' : input).trim();
    if (trimmed.indexOf('http') !== 0) {
      return { kind: 'allowed', host: '', reason: 'Not a web address, so there is nothing to filter (blank tab, browser page or local file).' };
    }
    var host;
    try { host = new URL(trimmed).hostname.toLowerCase(); } catch (e) { host = ''; }
    if (!host) return { kind: 'allowed', host: '', reason: 'No host name could be read from that address.' };
    for (var i = 0; i < BLOCKLIST.length; i++) {
      var r = BLOCKLIST[i];
      if (host === r.domain || host.slice(-(r.domain.length + 1)) === '.' + r.domain) {
        return { kind: 'blocked', host: host, site: r.name, category: r.category, domain: r.domain,
          reason: host + ' is ' + (host === r.domain ? '' : 'a subdomain of ') + r.domain + ', which is on the ' + r.category + ' list.' };
      }
    }
    return { kind: 'allowed', host: host, reason: host + ' is not on the list. Search, documentation, YouTube and music all stay open on purpose.' };
  }

  /* How the CLI layer reads a process list line: "claude" as the executable. */
  function classifyCommandLine(raw) {
    var line = String(raw).trim();
    if (line === 'claude' || line.indexOf('claude ') === 0 || /^[^ ]*\/claude( |$)/.test(line)) return 'Claude Code (CLI)';
    if (line.indexOf('Claude.app/') >= 0) return 'Claude (app)';
    if (line.indexOf('ChatGPT.app/') >= 0) return 'ChatGPT (app)';
    if (line.indexOf('Perplexity.app/') >= 0) return 'Perplexity (app)';
    return null;
  }

  function sorted(set) { return Array.from(set).sort(); }

  function createSim() {
    var s = {
      phase: 'idle',          /* idle | running | finished */
      total: 0, remaining: 0,
      violations: 0, last: null,
      world: new Set(),       /* LLM programs actually open on the pretend Mac */
      detected: [],           /* what the last scan found */
      grace: 0,
      overlay: null,          /* null | {kind:'llm'|'browser'|'unreadable', ...} */
      overlayLeft: 0,
      scanIn: 0,
      automation: true,       /* pretend Automation permission for the browser */
      tab: 'about:blank',
      blockers: [],
      clock: 0,
      log: []
    };
    var sim = { state: s };

    function note(kind, text, why) { s.log.push({ at: s.clock, kind: kind, text: text, why: why || '' }); }
    sim.note = note;
    Object.defineProperty(sim, 'paused', { get: function () { return s.phase === 'running' && s.detected.length > 0; } });

    sim.setApp = function (name, open) {
      if (open) s.world.add(name); else s.world.delete(name);
    };

    sim.start = function (minutes) {
      var blockers = sorted(s.world);
      if (blockers.length) {
        s.blockers = blockers;
        note('guard', 'Start refused: ' + blockers.join(', ') + ' open.', 'Starting with an LLM open would drop you straight onto a paused screen, so the pre-flight check lists what to close instead.');
        return { ok: false, blockers: blockers };
      }
      s.blockers = [];
      s.total = Math.max(minutes | 0, 1) * 60;
      s.remaining = s.total;
      s.violations = 0; s.last = null; s.detected = []; s.grace = 0;
      s.overlay = null; s.overlayLeft = 0; s.scanIn = 0; s.clock = 0; s.tab = REDIRECT;
      s.phase = 'running';
      s.log = [];
      note('start', 'Session started: ' + minutes + ' minutes.', 'The watchdog scans straight away, then every ' + SCAN_EVERY + ' seconds.');
      scan();
      s.scanIn = SCAN_EVERY;
      return { ok: true };
    };

    function scan() {
      var found = sorted(s.world);
      var had = s.detected.length > 0;
      s.detected = found;
      if (found.length) {
        if (!had) note('pause', found.join(', ') + ' detected. The clock is paused.', 'No credit for minutes spent with an LLM open. It resumes by itself when you close it.');
        if (s.grace <= 0) s.overlay = { kind: 'llm', processes: found };
      } else if (had) {
        if (s.overlay && s.overlay.kind === 'llm') s.overlay = null;
        note('resume', 'All LLMs closed. The clock is running again.', 'Nothing to confirm: the next scan saw a clean machine.');
      }
    }

    /* One real second passes. `scale` only speeds the countdown; the watchdog and grace run in real time. */
    sim.tick = function (scale) {
      if (s.phase !== 'running') return;
      scale = scale || 1;
      s.clock++;
      if (s.grace > 0) s.grace--;
      if (s.overlayLeft > 0) {
        s.overlayLeft--;
        if (s.overlayLeft === 0 && s.overlay && s.overlay.kind !== 'llm' && !s.detected.length) s.overlay = null;
      }
      s.scanIn--;
      if (s.scanIn <= 0) { scan(); s.scanIn = SCAN_EVERY; }
      if (!s.detected.length) {
        s.remaining -= scale;
        if (s.remaining <= 0) { s.remaining = 0; s.phase = 'finished'; s.overlay = null; note('finish', 'Session complete.', ''); }
      }
    };

    sim.grantGrace = function () {
      if (s.phase !== 'running') return;
      s.grace = GRACE;
      if (s.overlay && s.overlay.kind === 'llm') s.overlay = null;
      note('grace', 'Grace: the red screen stands down for ' + GRACE + ' seconds.', 'The clock stays paused, but you can reach the app and close it.');
    };

    sim.visit = function (url) {
      var v = verdictForUrl(url);
      if (s.phase !== 'running') { s.tab = v.kind === 'blocked' ? url : url; return { verdict: v, policed: false }; }
      if (!s.automation) {
        s.violations++; s.last = 'browser (unreadable)';
        s.overlay = { kind: 'unreadable' }; s.overlayLeft = 4;
        note('block', 'Could not read the browser tab. The browser was hidden.', 'Without Automation permission the filter cannot check the tab, so the browser stays locked and everything else keeps working.');
        return { verdict: v, policed: true, unreadable: true };
      }
      if (v.kind === 'blocked') {
        s.violations++; s.last = v.site;
        s.tab = REDIRECT;
        s.overlay = { kind: 'browser', site: v.site, category: v.category }; s.overlayLeft = 2;
        note('block', v.site + ' was redirected away.', v.reason);
      } else {
        s.tab = url;
        note('allow', 'Allowed: ' + (v.host || 'page') + '.', v.reason);
      }
      return { verdict: v, policed: true };
    };

    function stop(kind, text, why) {
      if (s.phase !== 'running') return false;
      s.phase = 'idle'; s.overlay = null; s.detected = []; s.overlayLeft = 0;
      note(kind, text, why);
      return true;
    }
    sim.endEarly = function () { return stop('end', 'Session ended early.', 'One click on a confirmation, no typing rituals.'); };
    sim.emergencyExit = function (how) { return stop('exit', 'Emergency exit (' + (how || 'button') + '): session ended.', 'Every way out ends everything immediately, whatever the screen is showing.'); };
    sim.reset = function () { s.phase = 'idle'; s.overlay = null; s.blockers = []; };

    return sim;
  }

  var api = {
    BLOCKLIST: BLOCKLIST, LLM_PROGRAMS: LLM_PROGRAMS, SCAN_EVERY: SCAN_EVERY, BROWSER_POLL: BROWSER_POLL, GRACE: GRACE,
    formatTime: formatTime, verdictForUrl: verdictForUrl, classifyCommandLine: classifyCommandLine, createSim: createSim
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FL = api;
})(typeof window !== 'undefined' ? window : globalThis);
