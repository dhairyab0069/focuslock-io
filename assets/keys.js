/* FocusLock page: keyboard shortcuts as data, plus the pure matcher. Typing in a field never triggers one
   (except the emergency exit). Tested in node. */
(function (root) {
  'use strict';
  var SHORTCUTS = [
    { key: '?', action: 'help', label: 'Show or hide this cheat sheet' },
    { key: 't', action: 'tour', label: 'Take the guided tour' },
    { key: 'l', action: 'lock', label: 'Lock in (start a session) or open FocusLock' },
    { key: '1', action: 'open:browser', label: 'Open the Browser' }, { key: '2', action: 'open:terminal', label: 'Open the Terminal' },
    { key: '3', action: 'open:notes', label: 'Open Notes' }, { key: '4', action: 'open:music', label: 'Open Music' },
    { key: '5', action: 'open:messages', label: 'Open Messages' }, { key: '6', action: 'open:focuslock', label: 'Open FocusLock' },
    { key: '[', action: 'prev', label: 'Previous window' }, { key: ']', action: 'next', label: 'Next window' },
    { key: 'w', action: 'minimize', label: 'Minimise the front window' }, { key: 'W', action: 'close', label: 'Close the front window' },
    { key: 'r', action: 'tab:rules', label: 'Rules lab' }, { key: 'b', action: 'tab:break', label: 'Try to break it' },
    { key: 'e', action: 'tab:exits', label: 'Practise the exits' }, { key: 'h', action: 'tab:history', label: 'History and stats' },
    { key: 'p', action: 'preset', label: 'Next preset' }, { key: 'n', action: 'scenario', label: 'Next scenario' },
    { key: 'z', action: 'undo', label: 'Undo a rules edit' }, { key: 'Z', action: 'redo', label: 'Redo a rules edit' },
    { key: 'c', action: 'share', label: 'Copy a link to your rules and scenario' },
    { key: 'm', action: 'motion', label: 'Stop or allow all motion' }, { key: 'u', action: 'sound', label: 'Sound on or off' },
    { key: 'Escape+Ctrl+Shift', action: 'exit', label: 'Emergency exit (Ctrl+Shift+Esc here, Command-Shift-Esc on a Mac), while a screen is up' }
  ];
  var TYPING = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };

  /* e: {key, ctrlKey, metaKey, shiftKey, altKey, target:{tagName, isContentEditable}} -> action id or null */
  function matchKey(e) {
    if (e.key === 'Escape' && e.shiftKey && (e.metaKey || e.ctrlKey)) return 'exit';
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    var t = e.target || {};
    if (TYPING[String(t.tagName).toUpperCase()] || t.isContentEditable) return null;
    for (var i = 0; i < SHORTCUTS.length; i++) if (SHORTCUTS[i].key === e.key) return SHORTCUTS[i].action;
    return null;
  }
  var api = { SHORTCUTS: SHORTCUTS, matchKey: matchKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLKeys = api;
})(typeof window !== 'undefined' ? window : globalThis);
