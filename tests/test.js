// Node unit tests for Piano BD pure logic. Run: node tests/test.js
const assert = require('assert');
const P = require('../app.js');

let n = 0;
function check(name, fn) { fn(); n++; console.log('ok - ' + name); }

// Frequency: A4 (69) = 440 exactly; C4 (60) = 261.63; hand-verified values.
check('A4 = 440 Hz', () => assert.strictEqual(P.midiToFreq(69), 440));
check('C4 = 261.63 Hz', () => assert.strictEqual(P.midiToFreq(60).toFixed(2), '261.63'));
check('C5 is double C4', () => assert.strictEqual(P.midiToFreq(72).toFixed(2), (P.midiToFreq(60) * 2).toFixed(2)));
check('A#4 = 466.16 Hz', () => assert.strictEqual(P.midiToFreq(70).toFixed(2), '466.16'));
check('names', () => { assert.strictEqual(P.midiToName(60), 'C4'); assert.strictEqual(P.midiToName(71), 'B4'); assert.strictEqual(P.midiToName(72), 'C5'); assert.strictEqual(P.midiToName(83), 'B5'); });
check('sargam', () => { assert.strictEqual(P.midiToSargam(60), 'Sa'); assert.strictEqual(P.midiToSargam(67), 'Pa'); assert.strictEqual(P.midiToSargam(69), 'Dha'); });
check('black keys', () => { assert.strictEqual(P.isBlack(61), true); assert.strictEqual(P.isBlack(60), false); assert.strictEqual(P.isBlack(66), true); });
check('keyboard = 24 keys C4..B5, 14 white + 10 black', () => {
  const kb = P.buildKeyboard();
  assert.strictEqual(kb.length, 24); assert.strictEqual(kb[0].midi, 60); assert.strictEqual(kb[23].midi, 83);
  assert.strictEqual(kb.filter(k => !k.black).length, 14); assert.strictEqual(kb.filter(k => k.black).length, 10);
});
check('keyboard map covers A-row + K-row, no duplicates', () => {
  const vals = Object.values(P.KEY_MAP);
  assert.strictEqual(new Set(vals).size, vals.length);
  assert.strictEqual(P.KEY_MAP.a, 60); assert.strictEqual(P.KEY_MAP.k, 72); assert.strictEqual(P.KEY_MAP[';'], 76);
});
check('all built-in tunes validate', () => {
  for (const k of Object.keys(P.TUNES)) assert.strictEqual(P.validateTune(P.TUNES[k].notes), null, k);
});
check('validateTune rejects out-of-range + empty', () => {
  assert.ok(P.validateTune([])); assert.ok(P.validateTune([{ midi: 59, beats: 1 }])); assert.ok(P.validateTune([{ midi: 60, beats: 0 }]));
});
check('tune durations at 100 BPM: twinkle 16 beats = 9600ms, birthday 14 beats = 8400ms', () => {
  assert.strictEqual(P.tuneDurationMs(P.TUNES.twinkle.notes, 100), 9600);
  assert.strictEqual(P.tuneDurationMs(P.TUNES.birthday.notes, 100), 8400);
});
check('recording encode clamps negatives + duration = max t', () => {
  assert.deepStrictEqual(P.encodeRecording([{ midi: 60, t: -5 }, { midi: 64, t: 1234.6 }]), [{ midi: 60, t: 0 }, { midi: 64, t: 1235 }]);
  assert.strictEqual(P.recordingDurationMs([{ midi: 60, t: 0 }, { midi: 64, t: 2500 }]), 2500);
  assert.strictEqual(P.recordingDurationMs([]), 0);
});
console.log(n + '/' + n + ' unit tests passed');
