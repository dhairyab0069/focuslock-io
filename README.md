# focuslock-io

The project page for FocusLock, a minimal macOS focus timer: an LLM watchdog pauses the clock, browsers are
filtered for social media, and emergency killswitches mean it never traps you. The page has an interactive
session simulator, a filter probe, and the emergency exits explained and demoable.

**The FocusLock source is private for now.** This page only describes behaviour; it contains no app code,
prompts or settings, and does not link the private repository. The simulator is a separate model written for
this page (`assets/core.js`) that follows the app's rules and lists.

Live at https://dhairyab0069.github.io/focuslock-io/ (GitHub Pages, served from the repo root).

## Light, dark and auto

The three-icon switch in the top bar picks Light, Dark or Auto (follow the system). The choice is saved as `theme` in `localStorage`, which every site on dhairyab0069.github.io shares, so it carries across the sites and updates live in other open tabs. A small script in the page head applies it before the first paint (no flash). The canvases, motes, lantern, haze and sand garden re-read their colours when it changes, with a short circle reveal and a soft chime (instant when motion is off), and both palettes keep text at 4.5:1 contrast or better. See `assets/theme.js`.

## Run locally

Static HTML, CSS and plain JavaScript; no build step, no libraries, no external requests (no web fonts, CDNs
or trackers). Open `index.html` directly or run `python3 -m http.server 8000`.

## The playable world

The page is built around a pretend Mac you can use from the first second. It is all simulation: it never looks at the visitor's computer.

- *Desktop:* windows you can drag (with a flick that glides), focus, stack, snap to an edge, minimise and close; a menu bar with menus, a right-click desktop menu, and a Dock. Keyboard: title bars move with the arrow keys (Shift resizes). On phones it shows one app at a time with the Dock.
- *Apps:* Browser (tabs, address bar, Safari, Chrome or Firefox), Terminal (`focuslock start|stop|unlock|status|build`, a pretend `claude`, `top`, `ls` and a few more), Notes, Music, Messages, the FocusLock window itself, and Claude and ChatGPT stand-ins that say nothing and send nothing.
- *Faithful rules:* the 5 second program scan (app names and command lines), the 2 second tab check of the front tab of a frontmost watched browser only (Firefox is not watched), pre-flight refusal, the grace button, the exits, quit asks first. These come from `assets/core.js` and `assets/rules.js`.
- *Distractions:* scenarios send notification banners, tempting tabs and programs that start by themselves. Let it pass, snooze (up to 3 times), open it, or park it in Notes (drag it onto Notes). The scenario only advances while the clock runs.
- *X-ray:* programs with matches highlighted and the reason, the front tab and the rule that matched, scan and tab-check countdowns, grace.
- *Rules lab:* add and remove sites (drag suggestions in) and program patterns, change grace and session length, undo and redo, test a command line. Verdicts everywhere follow your rules.
- *Try to break it:* 18 attempts (look-alike domains, subdomains, IP addresses, background tabs, an unwatched browser, a renamed program, and more), each judged against your current rules with the reason. A neutral tally, not a score.
- *Practise the exits:* six short scenes, one per way out.
- *History and stats:* a scrubbable timeline of each session and gentle totals. It celebrates coming back and counts no failures.
- *Link:* "Copy link to my setup" puts your rules, scenario and preset in the URL hash (`#s=...`), validated on load.
- *Tour and keys:* a skippable first-run tour (replay with `t`) and a cheat sheet on `?`.

Page extras (not in the real app) are labelled on the page: scenarios and presets, the rules lab and custom grace or length, stats and history, the menu bar status item and the browser picker.

## Healing and mindfulness theme, and cursor effects

The page is re-skinned in mist, sage, warm sand, deep-water teal and a touch of lavender, with rounded shapes, leaf and lotus motifs and spacious system-font type. Light and dark are both calm. A living layer reacts to the pointer (a finger counts on touch), all in `assets/nature.js` with the physics in `assets/field.js` (pure, tested):

- *Background field:* fireflies, pollen and petals drift behind the page, part around the pointer and drift back; a soft lantern follows the pointer. Fewer motes on phones.
- *Ripples and current:* a click or tap makes a still-water ripple; press and hold makes a slow current that swirls the motes around you.
- *Haze:* a faint mist covers the page and clears under the pointer. Switchable.
- *Growth:* lotus, fern and moss bloom where the pointer rests, then fade (capped at 12).
- *Lean and glow:* cards, panels and pretend windows lean toward the pointer with a specular glow; headings and the hero ring shift a little with depth.
- *Sand garden:* drag to rake lines (three tines), drag or arrow-key the stones (rings form around them), smooth the sand, or have a wave raked for you. It works by drag even with motion stopped. Soft rake and water-drop sounds if Sound is on.
- *Breathing guide:* a ring in the corner (or following the pointer). Hold it, or hold Space or Enter on it, to breathe at a calm pace (in 4 out 6, in 4 out 4, or box). It can pace the simulator's glow, can be hidden, and becomes words only when motion is off.
- *Mindful moments:* an optional 20 second pause and a five-things grounding exercise. Page extras, not medical advice.

The three symbols in the top bar (speaker, wave, lantern) switch sound, motion and cursor effects, all on by default, and the moon quiets all three at once (press again to bring them back). Turning the lantern off fades every cursor effect at once. The motion symbol, the moon and `prefers-reduced-motion` also stop the background loop (it becomes a still picture), the lantern, haze, lean and parallax. Everything joins the page's single animation loop in `assets/fx.js`, uses only canvas, transform and opacity, pauses when the tab is hidden, and is `aria-hidden` decoration.

## Quiet by design

- The top bar has symbol switches for sound, motion and cursor effects (motion starts off only if your system asks for reduced motion; sound starts on and begins playing after the first touch or key press, as browsers require)
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
- *Sound:* each of these has a matching quiet synthesized sound (scan blip, whoosh, stamp, ripple, type tick), on by default (switch it off with the speaker symbol).

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
- `assets/rules.js` editable rules, program scan, undo; `assets/scenario.js` presets, scenarios, scheduler; `assets/score.js` history and gentle summaries; `assets/hash.js` URL-hash state; `assets/challenge.js` break-it attempts; `assets/wm.js` window geometry; `assets/keys.js` shortcuts (all pure and tested)
- `assets/state.js`, `desktop.js`, `panels.js`, `app.js`, `ui.js` page glue and UI
- `assets/field.js` motes, ripples, blooms, breath pacing, rake geometry (pure, tested); `assets/nature.js` the calm cursor layer, sand garden, breathing guide and mindful moments
- `assets/fx.js` motion: easing, particles, the single animation loop (pure parts tested)
- `assets/sound.js` optional synthesized sound
- `assets/style.css` calm, low-stimulation styling with a dark scheme
- `assets/og-image.png`, `assets/favicon-64.png`
