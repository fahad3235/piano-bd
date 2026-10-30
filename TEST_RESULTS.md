# Piano BD — Test Results (2026-10-30, 13:00 slot)

## Unit tests — 13/13 passed (`node tests/test.js`)

- A4 = 440 Hz exactly; C4 = 261.63 Hz; C5 = 2 × C4; A#4 = 466.16 Hz (hand-verified).
- Note names C4/B4/C5/B5; sargam Sa (C), Pa (G), Dha (A).
- Keyboard: 24 keys C4–B5, 14 white + 10 black.
- Keyboard map: no duplicate MIDI values; A = C4, K = C5, ';' = E5.
- All 3 built-in tunes validate; validator rejects empty / out-of-range / zero-beat tunes.
- Tune durations at 100 BPM: Twinkle 16 beats = 9600 ms; Birthday 14 beats = 8400 ms.
- Recording encode clamps negative timestamps; duration = max timestamp; empty = 0.

Fixes during testing (all test-side except one app hardening):
1. Test expectation corrected: Twinkle is 16 beats (9600 ms), not 14 — the app was right.
2. Smoke ordering: tune playback timers were still firing during the recording check,
   so extra notes landed in the recording. Recording check moved before tune checks.
3. Smoke hermeticity: a reused Chrome profile leaked localStorage between runs
   (language + old recordings), causing false failures on rerun. Smoke now uses a
   fresh profile dir per run; 22/22 passes twice in a row after the fix.
4. App hardening: `playMidi` now falls back gracefully if AudioContext is unavailable
   (notes still display and recording still works) instead of throwing.

## Headless-Chrome smoke — 22/22 passed (`node tests/smoke.mjs`, twice)

Title, 24/14/10 keys, 0 console errors, 0 page errors, 0 network requests; C4 press
shows "C4 · Sa · 261.63 Hz"; A4 press; record 2 notes → "Recording 1 · 2 notes" row;
Twinkle status; Ode-to-Joy step plays E4; BN toggle shows Bengali title and persists
across reload; 390 px viewport scrollWidth ≤ 390 with all 24 keys rendered.

## Toolchain notes

- `/opt/meta-chromium/chrome` refuses raw launches in this VM (Hatch WebGL domain
  policy error); the smoke test uses Playwright's headless_shell binary
  (`~/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell`).
- Sources are pure ASCII (Bengali emitted as \uXXXX escapes in JS and numeric
  entities in HTML) so the GitHub push cannot corrupt Bengali text.
