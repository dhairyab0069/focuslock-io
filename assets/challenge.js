/* FocusLock page: "try to break it". Each attempt is judged against the rules you currently have, using the same
   matching code the simulator uses, and comes with a plain explanation. Everything happens inside the simulation.
   Pure; tested in node. outcome: held (the guard caught it), gap (it slipped through), refused, by-design. */
(function (root) {
  'use strict';
  var FL = root.FL || (typeof require !== 'undefined' ? require('./core.js') : null);
  var R = root.FLRules || (typeof require !== 'undefined' ? require('./rules.js') : null);

  function urlAttempt(id, title, how, url, held, gap) {
    return { id: id, title: title, how: how, apply: { type: 'url', url: url }, judge: function (rules) {
      var v = FL.verdictForUrl(url, rules.blocklist);
      return v.kind === 'blocked' ? { outcome: 'held', why: held + ' (' + v.reason + ')' } : { outcome: 'gap', why: gap + ' (' + v.reason + ')' };
    } };
  }
  function procAttempt(id, title, how, proc, held, gap) {
    return { id: id, title: title, how: how, apply: { type: 'process', proc: proc }, judge: function (rules) {
      var hits = R.scanProcesses([proc], rules);
      return hits.length ? { outcome: 'held', why: held + ' Matched by ' + hits[0].by + '.' } : { outcome: 'gap', why: gap };
    } };
  }

  var ATTEMPTS = [
    urlAttempt('subdomain', 'Use a subdomain', 'Open old.reddit.com instead of reddit.com.', 'https://old.reddit.com/', 'Subdomains of a listed site count as that site.', 'This subdomain was not recognised.'),
    urlAttempt('shout', 'SHOUT the address', 'Type the address in capitals.', 'https://WWW.REDDIT.COM/', 'Host names are compared in lower case.', 'Capitals got through.'),
    urlAttempt('port', 'Add a port number', 'Open reddit.com:8443.', 'https://reddit.com:8443/', 'Only the host name is compared, so the port does not matter.', 'The port confused the match.'),
    urlAttempt('lookalike', 'A look-alike domain', 'Open redditt.com, a different address that sounds the same.', 'https://redditt.com/', 'That look-alike is on the list.', 'The list matches host names exactly, so a different spelling is a different site. Add it in the Rules lab to close the gap.'),
    urlAttempt('ip', 'Use the numeric address', 'Open the site by its IP address.', 'http://151.101.1.140/', 'That number is on the list.', 'The filter reads names, not numbers, so an IP address is not recognised.'),
    urlAttempt('proxy', 'Go through a translator proxy', 'Open reddit through a translation-proxy host name.', 'https://www-reddit-com.translate.goog/', 'The proxy host is on the list.', 'The host is the proxy, not reddit.com, so nothing matches. A real limit of a name list.'),
    urlAttempt('data', 'A non-web address', 'Open a data: page.', 'data:text/html,hello', 'That was caught.', 'Only http and https addresses are read. A data: page is not a website, so it is left alone.'),
    urlAttempt('llmsite', 'An LLM website', 'Open chatgpt.com in the browser.', 'https://chatgpt.com/', 'LLM websites are redirected like social media.', 'The LLM site is not on the list.'),
    urlAttempt('llmlook', 'A look-alike LLM host', 'Open chatgpt.com.example.net.', 'https://chatgpt.com.example.net/', 'That host is on the list.', 'The real host is example.net, not chatgpt.com, so it is correctly left alone.'),
    { id: 'background', title: 'Hide it in a background tab', how: 'Open Reddit in a tab behind the one you are using.', apply: { type: 'bgtab', url: 'https://www.reddit.com/' }, judge: function (rules) {
      var v = FL.verdictForUrl('https://www.reddit.com/', rules.blocklist);
      return v.kind === 'blocked' ? { outcome: 'gap', why: 'Only the front tab is read, so a background tab is not seen. The moment you switch to it, the next check (within about 2 seconds) redirects it. So it only delays the detour.' }
        : { outcome: 'gap', why: 'Reddit is not on your list at all right now.' };
    } },
    { id: 'firefox', title: 'Use a different browser', how: 'Open Reddit in Firefox.', apply: { type: 'firefox', url: 'https://www.reddit.com/' }, judge: function () {
      return R.isWatchedBrowser('org.mozilla.firefox') ? { outcome: 'held', why: 'That browser is watched.' }
        : { outcome: 'gap', why: 'The app can only read tabs from Safari, Chrome, Brave, Edge and Arc. Other browsers are not looked at, so this one is outside the filter.' };
    } },
    procAttempt('minimise', 'Hide the LLM app', 'Minimise the Claude app instead of quitting it.', { pid: 900, app: 'Claude', cmd: '/Applications/Claude.app/Contents/MacOS/Claude' }, 'What counts is that it is running, not whether you can see it.', 'Not recognised.'),
    procAttempt('cli', 'Run the Claude Code CLI', 'Start claude in a terminal.', { pid: 901, app: null, cmd: 'claude' }, 'The watchdog reads full command lines, which catches the command line tool.', 'Not recognised.'),
    procAttempt('renamed', 'Rename the program', 'Copy the CLI to a different file name and run that.', { pid: 902, app: null, cmd: '/usr/local/bin/cld' }, 'Caught.', 'Recognition is by name, so a renamed copy is not recognised. Add the new name in the Rules lab to close the gap.'),
    procAttempt('remote', 'Run it on another machine', 'Open an ssh session to a server and run the LLM there.', { pid: 903, app: null, cmd: 'ssh devbox' }, 'Caught.', 'Only programs on this Mac are visible. What runs elsewhere is outside what the watchdog can see.'),
    { id: 'preflight', title: 'Start with an LLM already open', how: 'Open the Claude app, then press Lock in.', apply: { type: 'static' }, judge: function (rules) {
      var hits = R.scanProcesses([{ pid: 1, app: 'Claude', cmd: '/Applications/Claude.app/Contents/MacOS/Claude' }], rules);
      return hits.length ? { outcome: 'refused', why: 'The pre-flight check refuses to start and lists what to close, so you never land on a red screen.' } : { outcome: 'gap', why: 'Claude is not in your program patterns right now.' };
    } },
    { id: 'quit', title: 'Quit the app with Command-Q', how: 'Press Command-Q during a session.', apply: { type: 'static' }, judge: function () {
      return { outcome: 'held', why: 'Quitting during a session does not quit. It opens the "End the session early?" question instead.' };
    } },
    { id: 'unlock', title: 'Run focuslock unlock', how: 'Type the emergency command in a terminal.', apply: { type: 'static' }, judge: function () {
      return { outcome: 'by-design', why: 'This one works on purpose. The lock must never trap you, so every exit ends everything at once.' };
    } }
  ];

  function evaluate(attempt, rules) { var r = attempt.judge(rules); r.id = attempt.id; return r; }
  function evaluateAll(rules) { return ATTEMPTS.map(function (a) { return evaluate(a, rules); }); }
  /* A gentle tally: no points, nothing to lose. */
  function tally(results) {
    var t = { held: 0, gap: 0, refused: 0, 'by-design': 0 };
    results.forEach(function (r) { t[r.outcome]++; });
    return t;
  }
  var api = { ATTEMPTS: ATTEMPTS, evaluate: evaluate, evaluateAll: evaluateAll, tally: tally };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLChallenge = api;
})(typeof window !== 'undefined' ? window : globalThis);
