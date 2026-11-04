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
