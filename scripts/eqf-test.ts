import { BUILTIN_PRESETS, buildEqLibrary, parseEqLibrary, EQF_HEADER, RECORD_SIZE, valueToDb } from '../src/eqf.ts';
const lib = buildEqLibrary(BUILTIN_PRESETS);
const back = parseEqLibrary(lib.buffer as ArrayBuffer);
const ok = back.length === 17 && back.every((p, i) => p.name === BUILTIN_PRESETS[i].name && p.preamp === BUILTIN_PRESETS[i].preamp && p.bands.join() === BUILTIN_PRESETS[i].bands.join());
console.log(JSON.stringify({ bytes: lib.length, expected: EQF_HEADER.length + 17 * RECORD_SIZE, roundtrip: ok, db0: valueToDb(0), db31: valueToDb(31), db63: valueToDb(63), names: back.map((p) => p.name).join('|') }));
