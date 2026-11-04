# focuslock-io

The project page for FocusLock, a minimal macOS focus timer: an LLM watchdog pauses the clock, browsers are
filtered for social media, and emergency killswitches mean it never traps you. The page has an interactive
session simulator, a filter probe, and the emergency exits explained and demoable.

**The FocusLock source is private for now.** This page only describes behaviour; it contains no app code,
prompts or settings, and does not link the private repository. The simulator is a separate model written for
this page (`assets/core.js`) that follows the app's rules and lists.

Live at https://dhairyab0069.github.io/focuslock-io/ (GitHub Pages, served from the repo root).

## Run locally

Static HTML, CSS and plain JavaScript; no build step, no libraries, no external requests (no web fonts, CDNs
or trackers). Open `index.html` directly or run `python3 -m http.server 8000`.

## Quiet by design

- The top bar has **Stop all motion** (starts on if your system asks for reduced motion) and **Sound**
  (always off until you switch it on), plus a **Quiet everything** button. Choices are kept in `localStorage`
  on this device only.
- Sound is synthesized live with the Web Audio API (`assets/sound.js`); there are no audio files.
- The simulator never inspects your machine: the Mac, browser and terminal are pretend.

## Motion

Motion is there to show cause and effect, and every piece of it stops when you ask for quiet.

- *Countdown ring:* sweeps smoothly between ticks, breathes with a soft glow while focused, settles when the clock pauses and eases back in on resume.
- *Watchdog sweep:* every 5 seconds a line crosses the pretend program list and each row lights as it is checked; programs it finds stay tinted. A slow soft bar crosses the address bar every 2 seconds while a session runs.
- *Calm motes:* a few embers drift up while you focus, scatter when a distraction is detected, then drain back to the clock.
- *Pause and resume:* the overlay closes like an iris over the pretend Mac and lifts away again. An optional gentle shake (off by default) is in the simulator panel.
- *Redirect:* chosen addresses type themselves out; the tab slides to the blank page; the counter bumps.
- *Probe verdicts* settle in with a stamp, the SOS button pulses slowly and sends a ripple when pressed, cards and sections ease in on scroll, a thin line shows scroll progress, and every control has hover and press feedback.
- *Sound:* each of these has a matching quiet synthesized sound (scan blip, whoosh, stamp, ripple, type tick), still off by default.

Rules the code keeps (checked in `tests/run.js`): nothing repeats faster than every 2 seconds; only transform, opacity and clip-path animate; one `requestAnimationFrame` loop (`assets/fx.js`) that stops when the tab is hidden, the simulator is off screen or nothing is moving; at most 48 motes; nothing waits on an animation (state changes happen first, the motion follows). **Stop all motion**, **Quiet everything** and the system's reduced-motion setting all stop every loop, mote, shake and reveal and leave a clear still page (the `html.fx` class is the single gate).

## Tests

```bash
node tests/run.js
```

Covers the DOM-free rules in `assets/core.js` and the motion helpers in `assets/fx.js` (easing, particle cap and modes, reduced-motion gate, timing limits) (URL filter, subdomain matching, process-line classification,
pause/resume, pre-flight, grace, every emergency exit) and a hygiene check that the page makes no external
requests and contains no secrets or local paths.

## Layout

- `index.html` content and structure
- `assets/core.js` rules and simulation (no DOM, tested)
- `assets/app.js` simulator and probe UI
- `assets/fx.js` motion: easing, particles, the single animation loop (pure parts tested)
- `assets/sound.js` optional synthesized sound
- `assets/style.css` calm, low-stimulation styling with a dark scheme
- `assets/og-image.png`, `assets/favicon-64.png`
