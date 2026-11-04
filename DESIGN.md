# FocusLock: design

Written 2026-11-04 from the page as it stands (the page already follows the shared design language; this file documents it). Keep it current: every customisation gets a line in "Decisions".

## Purpose
The project page for **FocusLock**, a minimal macOS focus timer in which an LLM watchdog pauses the clock, browsers are filtered for social media, and emergency exits mean it never traps you. The page is a **healing and mindfulness playable desktop**: a pretend Mac you can use from the first second (draggable, snappable windows, a menu bar, a Dock, Browser, Terminal, Notes, Music, Messages, the FocusLock window itself and Claude and ChatGPT stand-ins), a live X-ray of the scan and tab-check rules, a Rules lab, "Try to break it" (18 attempts judged against your rules), six short exit scenes, history and gentle stats, a sand garden, a breathing guide and optional mindful moments. It is all simulation: it never looks at the visitor's computer, ships no app code, prompts or settings, and does not link the private repository. Readers are people deciding whether to trust and try the app.

## Theme choice and why
**Mist, sage and warm sand** with deep-water teal and a touch of lavender, rounded shapes, leaf and lotus motifs and a spacious rounded system-font stack. A focus tool that polices your attention should not feel punishing, so the page is deliberately low-stimulation and kind: it celebrates coming back and counts no failures. Light is misty and warm; dark is deep-water teal, not black. Both are designed sets.

## Tokens
Defined once in `assets/style.css`; components read roles.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#eef2ec` | `#101a1e` |
| `--surface` | `#f9faf6` | `#182529` |
| `--ink` | `#22323a` | `#e4eae4` |
| `--muted` | `#52646b` | `#a7b7b6` |
| `--line` | `#d3dccf` | `#2f4348` |
| `--sage` (accent) | `#33705a` | `#93cdb4` |
| `--teal`, `--lav` | `#2e6a70`, `#5f56a0` | `#6fb7bd`, `#b9b2e6` |
| `--amber`, `--rose` | `#7a5c24`, `#874f50` | `#e0c07f`, `#e0a8a2` |
| `--focus` | `#2a5fb0` | `#8fb8ff` |
| `--lantern-rgb` | `206,140,40` | `255,214,130` |

Radius `--r` 22 px, rounded shapes throughout.

## Theme modes (light, dark, auto)
Shared protocol for all of the owner's pages (one origin): localStorage `theme` = `light` | `dark` | `auto` (absent = auto). An inline script in `<head>` sets `data-theme-mode`, `data-theme` and `style.colorScheme` before first paint; tokens under `:root, :root[data-theme="light"]`, `:root[data-theme="dark"]` and a `:root:not([data-theme])` media-query fallback. Control: a three-way radiogroup (sun, moon, half circle; `aria-checked`, arrow keys, 44 px) in the top bar. `assets/theme.js` writes the key, dispatches `themechange`, follows `storage` from other pages and tabs, and follows the system in auto; the change is a View Transition circle reveal (crossfade fallback, instant when motion is off). The canvases, motes, lantern, haze and sand garden re-read their colours on `themechange`.

## Motion spec
- Personality: slow, breathing, cause and effect. Motion shows what the rules did and stops when you ask for quiet.
- Countdown ring sweeps between ticks and breathes with a soft glow while focused; the watchdog sweep crosses the program list every 5 seconds; a slow bar crosses the address bar every 2 seconds in a session; the pause overlay closes like an iris and lifts away; probe verdicts settle with a stamp; the SOS button pulses slowly and sends a ripple.
- Living layer (`assets/nature.js`, physics in `assets/field.js`): fireflies, pollen and petals (at most 48 motes, fewer on phones) that part around the pointer, a lantern that follows the pointer, ripples on click, a slow current on press and hold, haze that clears under the pointer, growth (at most 12 blooms), lean and glow on cards, a sand garden, a breathing guide.
- One `requestAnimationFrame` loop (`assets/fx.js`), stops when the tab is hidden, the simulator is off screen or nothing is moving; transform, opacity and clip-path only; nothing repeats faster than every 2 seconds.
- Gate: Motion on AND the system not asking for reduced motion AND the tab visible. Otherwise the field becomes a still picture and the breathing guide becomes words. The sand garden still works by drag.

## Sound spec
- Palette: calm nature and soft digital, synthesized with Web Audio (no files, no requests): scan blip, whoosh, stamp, ripple, type tick, rake and water-drop sounds in the garden. On by default; the audio context is created and resumed at the first touch or key press.
- Each motion has a matching quiet cue; sound is never the only channel.

## Interaction inventory
| Where | Interaction | Feedback |
|---|---|---|
| Pretend desktop | drag, snap, minimise, close windows; menu bar; right-click menu; Dock; arrow keys move a focused title bar (Shift resizes) | glide, stack, snap; phones show one app at a time |
| Simulator | Lock in, grace, SOS, exits, distractions (let pass, snooze up to 3, open, park in Notes) | ring, banners, overlay iris, cues |
| X-ray and Rules lab | edit sites and programs, undo and redo, test a command line | verdicts everywhere follow your rules |
| Try to break it | 18 attempts | verdict with the reason and a neutral tally |
| Sand garden, breathing guide | drag to rake, hold to breathe | soft sounds, ring pacing |
| Link | "Copy link to my setup" | rules, scenario and preset in the URL hash, validated on load |
| Header | theme group, Sound, Motion, Cursor effects, Quiet everything | state glyph, announcement |

## Accessibility notes
- Four visible symbol buttons and the theme radiogroup (44 px, `aria-pressed` or `aria-checked`, labels state the state); Quiet restores the previous state. Sound, Motion and Effects are on by default; Motion starts off only under `prefers-reduced-motion`.
- Keyboard: skip link, visible focus ring, window keys, `?` cheat sheet, `t` replays the tour; breathing guide works with Space or Enter.
- The simulator never inspects the machine; page extras are labelled as not part of the real app; not medical advice.
- Contrast at least 4.5:1 in both sets; focus ring 3 px.

## Decisions and trade-offs
| Date | Decision | Why |
|---|---|---|
| earlier | Re-skin to the healing and mindfulness theme | a tool that blocks things should feel safe, not punishing |
| earlier | A faithful rules core (`core.js`, tested) separate from the page extras | the simulator must behave like the app; extras are labelled |
| earlier | History celebrates coming back and counts no failures | gentle by design |
| 2026-11-04 | Adopted the shared theme protocol | one setting across the owner's pages |
| 2026-11-04 | "Cursor effects" is the Effects control and fades every cursor effect at once | one switch for the whole living layer |

## How to extend
- Rules, scenarios, scripts: the pure modules (`core.js`, `rules.js`, `scenario.js`, `score.js`, `hash.js`, `challenge.js`) have tests in `tests/run.js`; add logic there first.
- Living layer: add a mote kind or tool in `assets/field.js` (pure, tested) and wire it in `assets/nature.js`; it must stop when motion or effects are off.
- Tokens: change `assets/style.css` in both sets; anything that caches colours re-reads on `themechange`.
- After any change: `node tests/run.js`, look at a screenshot in light and dark, and add a line to "Decisions".
