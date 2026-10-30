# Piano BD

A free, fully offline, bilingual (English / বাংলা) toy piano that runs entirely in the
browser. Play two octaves (C4–B5), change the synthesized sound, learn three classic
tunes note by note, and record your own playing — no audio files, no accounts, no
network requests.

## Features

1. **Playable 2-octave keyboard** — 14 white + 10 black keys, mouse/touch + computer
   keyboard (A-row plays C4–E5; W/S/E/T/Y/U/O/P are the black keys). Each key shows its
   note name, sargam name (Sa, Re, Ga, Ma, Pa, Dha, Ni) and exact frequency.
2. **WebAudio synthesizer** — sine / triangle / square / sawtooth waveforms, volume
   control, and a sustain option. Sound is generated live; nothing is downloaded.
3. **Learn a tune** — Twinkle Twinkle Little Star, Happy Birthday, and Ode to Joy
   (all public-domain melodies). Play the whole tune with highlighted keys, or step
   through it one note at a time.
4. **Record & replay** — record a performance (notes + timing), save it in
   localStorage, play it back, or delete it.
5. **Bilingual UI** — EN/বাংলা toggle, persisted across reloads, with Bengali digits
   in recording stats.
6. **Mobile friendly** — the keyboard scrolls horizontally on narrow screens and was
   verified at 390 px width with no horizontal overflow.

## Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies.

## Prerequisites

Any modern browser (Chrome, Firefox, Safari, Edge). For the test suite: Node.js 18+.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then visit http://localhost:8000/.

## Tests

```sh
node tests/test.js     # 13 unit tests: frequencies, keyboard map, sargam, tune validation
node tests/smoke.mjs   # 22 headless-Chrome checks: keys, note display, record, tunes, BN toggle + persistence, 390px layout
```

The smoke test uses Playwright's `headless_shell` binary via raw CDP and a fresh
browser profile on every run (a reused profile would leak localStorage between runs).

## How note frequencies work

Equal temperament with A4 = 440 Hz: `f = 440 × 2^((midi − 69)/12)`. So C4 (MIDI 60)
is 261.63 Hz and C5 is exactly double that. Sargam names follow the C-major scale
(Sa = C, with komal/tivra variants for the black keys).

## Deployment

Static site — publish the folder on GitHub Pages (or any static host). No server,
no environment variables, no secrets.

## Limitations

- This is a toy piano, not a music-education or performance instrument: two octaves,
  one voice at a time per key press, no MIDI input, no velocity sensitivity.
- Recordings live only in the browser's localStorage on the device that made them.
- Audio requires a browser with Web Audio; if audio is unavailable, notes still
  display and recording still works.

## Status

Complete MVP. Tests: 13/13 unit + 22/22 headless-Chrome smoke, 0 console/page errors.
