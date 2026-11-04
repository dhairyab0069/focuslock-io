/* FocusLock page: presets and scenarios (page extras). A scenario is a list of distractions that arrive
   on their own as focused time passes. Pure; tested in node. Times are seconds of focused time, so a
   paused clock also pauses the scenario: nothing piles up while you are dealing with something. */
(function (root) {
  'use strict';

  var PRESETS = [
    { id: 'study', name: 'Study', mins: 45, scenario: 'tuesday', note: 'A steady 45 minutes.' },
    { id: 'deep', name: 'Deep work', mins: 90, scenario: 'rabbit', note: 'The long one, with a rabbit hole in it.' },
    { id: 'sprint', name: 'Quick sprint', mins: 25, scenario: 'tuesday', note: 'The classic 25.' }
  ];

  /* kinds: banner (a notification you can resist, snooze or open), tab (a tempting tab opens in the background),
     launch (a program starts by itself). `open` says what giving in does. */
  var SCENARIOS = [
    { id: 'tuesday', name: 'A normal Tuesday', blurb: 'A couple of nudges and one tempting tab.', events: [
      { at: 0.15, kind: 'banner', from: 'Messages', text: 'Sam: did you see the thread?', open: { type: 'url', url: 'https://www.reddit.com/r/macapps' } },
      { at: 0.45, kind: 'tab', url: 'https://www.instagram.com/', text: 'A tab opened in the browser: Instagram' },
      { at: 0.7, kind: 'banner', from: 'Messages', text: 'Quick question when you have a sec', open: { type: 'url', url: 'https://x.com/home' } }
    ] },
    { id: 'afternoon', name: 'A tempting afternoon', blurb: 'Nudges every few minutes, a chat app that opens itself.', events: [
      { at: 0.08, kind: 'banner', from: 'Messages', text: 'Lunch spot poll is live', open: { type: 'url', url: 'https://discord.com/channels/@me' } },
      { at: 0.2, kind: 'launch', proc: 'chatgpt', text: 'ChatGPT opened by itself (a login item, pretend)' },
      { at: 0.35, kind: 'banner', from: 'Messages', text: 'Watch this, it is two minutes', open: { type: 'url', url: 'https://www.tiktok.com/' } },
      { at: 0.55, kind: 'tab', url: 'https://www.reddit.com/r/adhd', text: 'A tab opened in the browser: Reddit' },
      { at: 0.75, kind: 'banner', from: 'Messages', text: 'Can you settle a bet? Just ask the bot', open: { type: 'url', url: 'https://claude.ai/chat' } },
      { at: 0.9, kind: 'banner', from: 'Messages', text: 'New follower!', open: { type: 'url', url: 'https://www.threads.net/' } }
    ] },
    { id: 'rabbit', name: 'A rabbit hole', blurb: 'One link leads to the next. Practise stepping out.', events: [
      { at: 0.1, kind: 'banner', from: 'Messages', text: 'Not work, but you will like this', open: { type: 'url', url: 'https://www.youtube.com/watch?v=lofi' } },
      { at: 0.25, kind: 'tab', url: 'https://www.reddit.com/r/todayilearned', text: 'A tab opened: Reddit' },
      { at: 0.4, kind: 'launch', proc: 'claude-cli', text: 'A helper started the Claude Code CLI in a terminal (pretend)' },
      { at: 0.55, kind: 'tab', url: 'https://gemini.google.com/app', text: 'A tab opened: Gemini' },
      { at: 0.7, kind: 'banner', from: 'Messages', text: 'One more video?', open: { type: 'url', url: 'https://www.twitch.tv/' } }
    ] }
  ];

  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function scenario(id) { return byId(SCENARIOS, id) || SCENARIOS[0]; }
  function preset(id) { return byId(PRESETS, id); }

  /* Turns a scenario into timed events for a session of `totalSeconds`. `at` is a fraction of the session. */
  function schedule(sc, totalSeconds) {
    return sc.events.map(function (e, i) { var c = {}; Object.keys(e).forEach(function (k) { c[k] = e[k]; }); c.id = sc.id + ':' + i; c.t = Math.round(e.at * totalSeconds); return c; });
  }

  function createScheduler(events) {
    var pending = events.slice().sort(function (a, b) { return a.t - b.t; });
    return {
      /* Events that have come due once `elapsed` focused seconds have passed. */
      due: function (elapsed) { var out = []; while (pending.length && pending[0].t <= elapsed) out.push(pending.shift()); return out; },
      /* "Snooze": the same nudge comes back later, never more than three times. */
      snooze: function (ev, elapsed, bySeconds) {
        var n = (ev.snoozed || 0) + 1; if (n > 3) return false;
        var c = {}; Object.keys(ev).forEach(function (k) { c[k] = ev[k]; }); c.snoozed = n; c.t = elapsed + bySeconds;
        pending.push(c); pending.sort(function (a, b) { return a.t - b.t; }); return true;
      },
      remaining: function () { return pending.length; }
    };
  }

  var api = { PRESETS: PRESETS, SCENARIOS: SCENARIOS, scenario: scenario, preset: preset, schedule: schedule, createScheduler: createScheduler };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLScenario = api;
})(typeof window !== 'undefined' ? window : globalThis);
