// Piano BD \u2014 pure logic (testable in Node) + browser UI wiring.
// No network calls. No eval. All state except recordings/settings lives in memory.
(function (global) {
  'use strict';

  // Two octaves: C4 (MIDI 60) .. B5 (MIDI 83). 24 semitones.
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var SARGAM = ['Sa', 'Komal Re', 'Re', 'Komal Ga', 'Ga', 'Ma', 'Tivra Ma', 'Pa', 'Komal Dha', 'Dha', 'Komal Ni', 'Ni'];
  // Computer-keyboard map: key -> MIDI. Lower octave on A-row, upper on K-row.
  var KEY_MAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };

  function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function midiToSargam(midi) {
    return SARGAM[midi % 12];
  }
  function isBlack(midi) {
    return NOTE_NAMES[midi % 12].indexOf('#') !== -1;
  }
  function buildKeyboard() {
    var keys = [];
    for (var m = 60; m <= 83; m++) keys.push({ midi: m, name: midiToName(m), freq: midiToFreq(m), sargam: midiToSargam(m), black: isBlack(m) });
    return keys;
  }
  // A tune is a list of {midi, beats}. Validate: every note inside the keyboard range.
  function validateTune(tune) {
    if (!Array.isArray(tune) || tune.length === 0) return 'Tune must be a non-empty list';
    for (var i = 0; i < tune.length; i++) {
      var n = tune[i];
      if (typeof n.midi !== 'number' || n.midi < 60 || n.midi > 83) return 'Note out of range at index ' + i;
      if (typeof n.beats !== 'number' || n.beats <= 0) return 'Bad beats at index ' + i;
    }
    return null;
  }
  // Total tune length in ms at a given tempo (beats per minute), 1 beat = 1 quarter note.
  function tuneDurationMs(tune, bpm) {
    var total = 0;
    for (var i = 0; i < tune.length; i++) total += tune[i].beats * (60000 / bpm);
    return Math.round(total);
  }
  // Recording helpers: events are {midi, t} with t = ms since recording started.
  function encodeRecording(events) {
    return events.map(function (e) { return { midi: e.midi, t: Math.max(0, Math.round(e.t)) }; });
  }
  function recordingDurationMs(events) {
    if (!events.length) return 0;
    var max = 0;
    for (var i = 0; i < events.length; i++) if (events[i].t > max) max = events[i].t;
    return max;
  }

  var TUNES = {
    twinkle: { title: 'Twinkle Twinkle Little Star', notes: [
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 } ] },
    birthday: { title: 'Happy Birthday', notes: [
      { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 72, beats: 1 }, { midi: 71, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 74, beats: 1 }, { midi: 72, beats: 2 } ] },
    ode: { title: 'Ode to Joy', notes: [
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 64, beats: 1.5 }, { midi: 62, beats: 0.5 }, { midi: 62, beats: 2 } ] }
  };

  var api = { NOTE_NAMES: NOTE_NAMES, SARGAM: SARGAM, KEY_MAP: KEY_MAP, midiToName: midiToName, midiToFreq: midiToFreq, midiToSargam: midiToSargam, isBlack: isBlack, buildKeyboard: buildKeyboard, validateTune: validateTune, tuneDurationMs: tuneDurationMs, encodeRecording: encodeRecording, recordingDurationMs: recordingDurationMs, TUNES: TUNES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PianoBD = api;

  // ---------------- Browser UI ----------------
  if (typeof document === 'undefined') return;
  var I18N = {
    en: { title: 'Piano BD', sub: 'Play, record and learn \u2014 right in your browser', lastNote: 'Last note', none: '\u2014', record: 'Record', stop: 'Stop', playTune: 'Play tune', step: 'Step', playRec: 'Play', del: 'Delete', saved: 'My recordings', emptyRec: 'No recordings yet. Press Record, play something, then Stop.', tuneLabel: 'Learn a tune', waveLabel: 'Sound', volLabel: 'Volume', sustainLabel: 'Sustain', keysHint: 'Computer keys: A\u2013; row plays C4\u2013E5 (W/S/E/T/Y/U/O/P are the black keys). Tap the piano keys on touch screens.', footer: 'Offline toy piano. Sound is synthesized in your browser \u2014 no audio files, no network requests.' },
    bn: { title: '\u09aa\u09bf\u09af\u09bc\u09be\u09a8\u09cb \u09ac\u09bf\u09a1\u09bf', sub: '\u09ac\u09be\u099c\u09be\u09a8, \u09b0\u09c7\u0995\u09b0\u09cd\u09a1 \u0995\u09b0\u09c1\u09a8 \u0993 \u09b6\u09bf\u0996\u09c1\u09a8 \u2014 \u09b8\u09b0\u09be\u09b8\u09b0\u09bf \u09ac\u09cd\u09b0\u09be\u0989\u099c\u09be\u09b0\u09c7', lastNote: '\u09b6\u09c7\u09b7 \u09a8\u09cb\u099f', none: '\u2014', record: '\u09b0\u09c7\u0995\u09b0\u09cd\u09a1', stop: '\u09a5\u09be\u09ae\u09be\u09a8', playTune: '\u099f\u09bf\u0989\u09a8 \u09ac\u09be\u099c\u09be\u09a8', step: '\u09aa\u09b0\u09c7\u09b0 \u09a8\u09cb\u099f', playRec: '\u09ac\u09be\u099c\u09be\u09a8', del: '\u09ae\u09c1\u099b\u09c1\u09a8', saved: '\u0986\u09ae\u09be\u09b0 \u09b0\u09c7\u0995\u09b0\u09cd\u09a1\u09bf\u0982', emptyRec: '\u098f\u0996\u09a8\u09cb \u0995\u09cb\u09a8\u09cb \u09b0\u09c7\u0995\u09b0\u09cd\u09a1\u09bf\u0982 \u09a8\u09c7\u0987\u0964 Record \u099a\u09be\u09aa\u09c1\u09a8, \u0995\u09bf\u099b\u09c1 \u09ac\u09be\u099c\u09be\u09a8, \u09a4\u09be\u09b0\u09aa\u09b0 Stop \u099a\u09be\u09aa\u09c1\u09a8\u0964', tuneLabel: '\u099f\u09bf\u0989\u09a8 \u09b6\u09bf\u0996\u09c1\u09a8', waveLabel: '\u09b8\u09be\u0989\u09a8\u09cd\u09a1', volLabel: '\u09ad\u09b2\u09bf\u0989\u09ae', sustainLabel: '\u09b8\u09be\u09b8\u099f\u09c7\u0987\u09a8', keysHint: '\u0995\u09ae\u09cd\u09aa\u09bf\u0989\u099f\u09be\u09b0 \u0995\u09c0: A\u2013; \u09b8\u09be\u09b0\u09bf C4\u2013E5 \u09ac\u09be\u099c\u09be\u09af\u09bc (W/S/E/T/Y/U/O/P \u0995\u09be\u09b2\u09cb \u0995\u09c0)\u0964 \u099f\u09be\u099a \u09b8\u09cd\u0995\u09cd\u09b0\u09bf\u09a8\u09c7 \u09aa\u09bf\u09af\u09bc\u09be\u09a8\u09cb \u0995\u09c0 \u099f\u09cd\u09af\u09be\u09aa \u0995\u09b0\u09c1\u09a8\u0964', footer: '\u0985\u09ab\u09b2\u09be\u0987\u09a8 \u0996\u09c7\u09b2\u09a8\u09be \u09aa\u09bf\u09af\u09bc\u09be\u09a8\u09cb\u0964 \u09b8\u09be\u0989\u09a8\u09cd\u09a1 \u09ac\u09cd\u09b0\u09be\u0989\u099c\u09be\u09b0\u09c7\u0987 \u09a4\u09c8\u09b0\u09bf \u09b9\u09af\u09bc \u2014 \u0995\u09cb\u09a8\u09cb \u0985\u09a1\u09bf\u0993 \u09ab\u09be\u0987\u09b2 \u09ac\u09be \u09a8\u09c7\u099f\u0993\u09af\u09bc\u09be\u09b0\u09cd\u0995 \u09b2\u09be\u0997\u09c7 \u09a8\u09be\u0964' }
  };
  function bnDigits(s) {
    var map = { '0': '\u09e6', '1': '\u09e7', '2': '\u09e8', '3': '\u09e9', '4': '\u09ea', '5': '\u09eb', '6': '\u09ec', '7': '\u09ed', '8': '\u09ee', '9': '\u09ef' };
    return String(s).replace(/[0-9]/g, function (d) { return map[d]; });
  }
  function fmtNum(n, lang) { return lang === 'bn' ? bnDigits(n) : String(n); }

  var lang = 'en';
  try { lang = localStorage.getItem('piano-bd-lang') || 'en'; } catch (e) {}
  var audioCtx = null, masterGain = null;
  var waveform = 'triangle', volume = 0.7, sustain = false;
  var recording = null, recStart = 0, recTimer = null;
  var recordings = [];
  try { recordings = JSON.parse(localStorage.getItem('piano-bd-recordings') || '[]'); } catch (e) { recordings = []; }
  var tuneStepIndex = 0, tuneTimers = [];

  function ensureAudio() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return true;
    } catch (e) { return false; }
  }
  function playMidi(midi, durMs) {
    if (!ensureAudio()) { showNote(midi); if (recording) recording.push({ midi: midi, t: Date.now() - recStart }); return; }
    var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = waveform;
    osc.frequency.value = midiToFreq(midi);
    var t = audioCtx.currentTime;
    var dur = (durMs || (sustain ? 900 : 400)) / 1000;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.05);
    showNote(midi);
    if (recording) recording.push({ midi: midi, t: Date.now() - recStart });
  }
  function showNote(midi) {
    var el = document.getElementById('last-note');
    if (el) el.textContent = midiToName(midi) + ' \u00b7 ' + midiToSargam(midi) + ' \u00b7 ' + midiToFreq(midi).toFixed(2) + ' Hz';
  }
  function stopTune() { tuneTimers.forEach(clearTimeout); tuneTimers = []; }
  function playTune(key) {
    stopTune();
    var tune = TUNES[key]; if (!tune) return;
    tuneStepIndex = 0;
    var bpm = 100, at = 0;
    tune.notes.forEach(function (n) {
      tuneTimers.push(setTimeout(function () { flashKey(n.midi); playMidi(n.midi, 450); }, at));
      at += n.beats * (60000 / bpm);
    });
    document.getElementById('tune-status').textContent = tune.title + ' \u2014 ' + tune.notes.length + ' notes';
  }
  function stepTune() {
    var key = document.getElementById('tune-select').value;
    var tune = TUNES[key]; if (!tune) return;
    if (tuneStepIndex >= tune.notes.length) tuneStepIndex = 0;
    var n = tune.notes[tuneStepIndex++];
    flashKey(n.midi); playMidi(n.midi, 450);
    document.getElementById('tune-status').textContent = tune.title + ' \u2014 note ' + tuneStepIndex + '/' + tune.notes.length + ': ' + midiToName(n.midi);
  }
  function flashKey(midi) {
    var el = document.querySelector('[data-midi="' + midi + '"]');
    if (!el) return;
    el.classList.add('active');
    setTimeout(function () { el.classList.remove('active'); }, 350);
  }
  function saveRecordings() { try { localStorage.setItem('piano-bd-recordings', JSON.stringify(recordings)); } catch (e) {} }
  function renderRecordings() {
    var list = document.getElementById('rec-list');
    var t = I18N[lang];
    if (!recordings.length) { list.innerHTML = '<p class="muted">' + t.emptyRec + '</p>'; return; }
    list.innerHTML = '';
    recordings.forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'rec-row';
      var dur = (recordingDurationMs(r.events) / 1000).toFixed(1);
      row.innerHTML = '<span><strong>' + r.name + '</strong> \u00b7 ' + fmtNum(r.events.length, lang) + ' notes \u00b7 ' + fmtNum(dur, lang) + 's</span><span><button data-act="play" data-i="' + i + '">' + t.playRec + '</button> <button data-act="del" data-i="' + i + '">' + t.del + '</button></span>';
      list.appendChild(row);
    });
    list.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-i'), 10);
        if (b.getAttribute('data-act') === 'del') { recordings.splice(i, 1); saveRecordings(); renderRecordings(); return; }
        stopTune();
        recordings[i].events.forEach(function (e) {
          tuneTimers.push(setTimeout(function () { flashKey(e.midi); playMidi(e.midi, 400); }, e.t));
        });
      });
    });
  }
  function applyLang() {
    var t = I18N[lang];
    document.getElementById('app-title').textContent = t.title;
    document.getElementById('app-sub').textContent = t.sub;
    document.getElementById('last-note-label').textContent = t.lastNote;
    document.getElementById('rec-btn').textContent = recording ? t.stop : t.record;
    document.getElementById('tune-btn').textContent = t.playTune;
    document.getElementById('step-btn').textContent = t.step;
    document.getElementById('saved-title').textContent = t.saved;
    document.getElementById('tune-label').textContent = t.tuneLabel;
    document.getElementById('wave-label').textContent = t.waveLabel;
    document.getElementById('vol-label').textContent = t.volLabel;
    document.getElementById('sustain-label').textContent = t.sustainLabel;
    document.getElementById('keys-hint').textContent = t.keysHint;
    document.getElementById('footer-text').textContent = t.footer;
    document.getElementById('lang-btn').textContent = lang === 'en' ? '\u09ac\u09be\u0982\u09b2\u09be' : 'English';
    renderRecordings();
    try { localStorage.setItem('piano-bd-lang', lang); } catch (e) {}
  }
  function buildUI() {
    var kb = document.getElementById('keyboard');
    buildKeyboard().forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'key ' + (k.black ? 'black' : 'white');
      b.setAttribute('data-midi', k.midi);
      b.setAttribute('aria-label', k.name);
      var kbKey = Object.keys(KEY_MAP).find(function (x) { return KEY_MAP[x] === k.midi; });
      b.innerHTML = '<span class="n">' + k.name + '</span>' + (k.black ? '' : '<span class="s">' + k.sargam + '</span>') + (kbKey ? '<span class="k">' + kbKey.toUpperCase() + '</span>' : '');
      b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); flashKey(k.midi); playMidi(k.midi); });
      kb.appendChild(b);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var midi = KEY_MAP[ev.key.toLowerCase()];
      if (midi === undefined) return;
      ev.preventDefault();
      flashKey(midi); playMidi(midi);
    });
    document.getElementById('lang-btn').addEventListener('click', function () { lang = lang === 'en' ? 'bn' : 'en'; applyLang(); });
    document.getElementById('wave-select').addEventListener('change', function (e) { waveform = e.target.value; });
    document.getElementById('vol-range').addEventListener('input', function (e) {
      volume = parseFloat(e.target.value);
      if (masterGain) masterGain.gain.value = volume;
    });
    document.getElementById('sustain-check').addEventListener('change', function (e) { sustain = e.target.checked; });
    document.getElementById('tune-btn').addEventListener('click', function () { ensureAudio(); playTune(document.getElementById('tune-select').value); });
    document.getElementById('step-btn').addEventListener('click', function () { ensureAudio(); stepTune(); });
    document.getElementById('tune-select').addEventListener('change', function () { tuneStepIndex = 0; document.getElementById('tune-status').textContent = ''; });
    document.getElementById('rec-btn').addEventListener('click', function () {
      ensureAudio();
      if (!recording) {
        recording = []; recStart = Date.now();
        document.getElementById('rec-btn').textContent = I18N[lang].stop;
        document.getElementById('rec-btn').classList.add('recording');
        document.getElementById('rec-status').textContent = '\u25cf REC';
      } else {
        var events = encodeRecording(recording);
        recording = null;
        document.getElementById('rec-btn').textContent = I18N[lang].record;
        document.getElementById('rec-btn').classList.remove('recording');
        document.getElementById('rec-status').textContent = '';
        if (events.length) {
          recordings.unshift({ name: 'Recording ' + (recordings.length + 1), events: events });
          saveRecordings(); renderRecordings();
        }
      }
    });
    applyLang();
  }
  document.addEventListener('DOMContentLoaded', buildUI);
})(typeof window !== 'undefined' ? window : globalThis);
