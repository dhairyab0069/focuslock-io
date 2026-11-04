/* Optional sound: tiny tones made live with the Web Audio API. Off by default, no audio files. */
(function (root) {
  'use strict';
  var ctx = null, on = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, start, dur, vol, type) {
    var c = ctx, t = c.currentTime + start;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function sweep(f1, f2, dur, vol) {
    var c = ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  var SOUNDS = {
    water:  function () { sweep(900, 420, 0.22, 0.03); tone(1300, 0.03, 0.08, 0.012); },
    chime:  function () { tone(784, 0, 1.1, 0.025); tone(988, 0.18, 1.1, 0.02); tone(1175, 0.36, 1.3, 0.018); },
    rake:   function () { tone(170 + Math.random() * 40, 0, 0.06, 0.012, 'triangle'); },
    breathin:  function () { sweep(220, 330, 1.2, 0.02); },
    breathout: function () { sweep(330, 200, 1.4, 0.02); },
    current: function () { sweep(140, 200, 0.9, 0.02); },
    open:   function () { tone(480, 0, 0.1, 0.03); tone(640, 0.06, 0.12, 0.025); },
    close:  function () { tone(420, 0, 0.1, 0.025); },
    snap:   function () { tone(300, 0, 0.07, 0.04, 'triangle'); },
    notify: function () { tone(660, 0, 0.12, 0.03); tone(880, 0.1, 0.16, 0.025); },
    pass:   function () { tone(520, 0, 0.2, 0.03); tone(660, 0.1, 0.25, 0.03); },
    tab:    function () { tone(700, 0, 0.06, 0.025); },
    drop:   function () { tone(240, 0, 0.12, 0.05, 'triangle'); },
    celebrate: function () { tone(523.25, 0, 0.3, 0.04); tone(659.25, 0.1, 0.3, 0.04); tone(783.99, 0.2, 0.5, 0.04); },
    scan:   function () { tone(880, 0, 0.09, 0.015); },
    type:   function () { tone(1250, 0, 0.04, 0.012); },
    stamp:  function () { tone(190, 0, 0.18, 0.06, 'triangle'); tone(380, 0.02, 0.1, 0.025); },
    whoosh: function () { sweep(700, 180, 0.5, 0.035); },
    lift:   function () { sweep(180, 700, 0.5, 0.03); },
    ripple: function () { sweep(260, 520, 0.6, 0.03); },
    click:  function () { tone(520, 0, 0.12, 0.05); },
    start:  function () { tone(392, 0, 0.5, 0.06); tone(523.25, 0.14, 0.6, 0.05); },
    pause:  function () { tone(330, 0, 0.5, 0.06); tone(262, 0.16, 0.7, 0.05); },
    resume: function () { tone(262, 0, 0.4, 0.05); tone(392, 0.14, 0.6, 0.06); },
    block:  function () { tone(294, 0, 0.35, 0.06, 'triangle'); },
    exit:   function () { tone(440, 0, 0.3, 0.05); tone(330, 0.12, 0.5, 0.05); },
    finish: function () { tone(392, 0, 0.7, 0.05); tone(493.88, 0.15, 0.7, 0.05); tone(587.33, 0.3, 1.0, 0.05); }
  };
  root.FLSound = {
    get on() { return on; },
    set: function (v) {
      on = !!v;
      if (on) { var c = ensure(); if (c && c.state === 'suspended') c.resume(); }
    },
    play: function (name) {
      if (!on || !SOUNDS[name]) return;
      var c = ensure(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      try { SOUNDS[name](); } catch (e) { /* sound is never essential */ }
    }
  };
})(window);
