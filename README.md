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

## Tests

```bash
node tests/run.js
```

Covers the DOM-free rules in `assets/core.js` (URL filter, subdomain matching, process-line classification,
pause/resume, pre-flight, grace, every emergency exit) and a hygiene check that the page makes no external
requests and contains no secrets or local paths.

## Layout

- `index.html` content and structure
- `assets/core.js` rules and simulation (no DOM, tested)
- `assets/app.js` simulator and probe UI
- `assets/sound.js` optional synthesized sound
- `assets/style.css` calm, low-stimulation styling with a dark scheme
- `assets/og-image.png`, `assets/favicon-64.png`
