// ============================================================
//  MofuMusic — théorie musicale (notes épelées, intervalles, tonalités)
// ============================================================
'use strict';

const Music = (() => {
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const NAMES_FR = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const NAMES_EN = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };

  let naming = 'fr'; // 'fr' (Do Ré Mi) ou 'en' (C D E)
  const setNaming = n => { naming = n; };

  // Une note épelée : { l: lettre 0..6 (Do..Si), a: altération -2..2, o: octave }
  const note = (l, a, o) => ({ l, a, o });
  const midiOf = n => 12 * (n.o + 1) + LETTER_PC[n.l] + n.a;
  const freqOf = m => 440 * Math.pow(2, (m - 69) / 12);
  const midiFromFreq = f => 69 + 12 * Math.log2(f / 440);

  function name(n, withOctave = false) {
    const base = (naming === 'fr' ? NAMES_FR : NAMES_EN)[n.l] + ACC[n.a];
    return withOctave ? base + (naming === 'fr' ? n.o - 1 : n.o) : base; // Do3 = C4 en France
  }

  // Nom d'un numéro MIDI sans contexte (dièses par défaut)
  function midiName(m, withOctave = false, preferFlat = false) {
    return name(spellMidi(Math.round(m), preferFlat), withOctave);
  }
  function spellMidi(m, preferFlat = false) {
    const pc = ((m % 12) + 12) % 12, o = Math.floor(m / 12) - 1;
    let l = LETTER_PC.indexOf(pc);
    if (l >= 0) return note(l, 0, o);
    if (preferFlat) { l = LETTER_PC.indexOf(pc + 1); return note(l, -1, o); }
    l = LETTER_PC.indexOf(pc - 1); return note(l, 1, o);
  }

  // ---------------- Intervalles ----------------
  const ORD = ['', 'unisson', 'seconde', 'tierce', 'quarte', 'quinte', 'sixte', 'septième', 'octave'];
  const PERFECT = { 1: 0, 4: 5, 5: 7, 8: 12 };
  const MAJOR = { 2: 2, 3: 4, 6: 9, 7: 11 };

  // Nom d'un intervalle à partir du nombre (1..8+) et des demi-tons
  function intervalName(num, semis) {
    const simple = num > 8 ? ((num - 1) % 7) + 1 : num;
    const oct = num > 8 ? Math.floor((num - 1) / 7) : 0;
    const s = semis - 12 * oct;
    let q;
    if (PERFECT[simple] !== undefined) {
      const d = s - PERFECT[simple];
      q = { 0: 'juste', 1: 'augmentée', '-1': 'diminuée', 2: 'sur-augmentée', '-2': 'sous-diminuée' }[d] || '?';
    } else {
      const d = s - MAJOR[simple];
      q = { 0: 'majeure', '-1': 'mineure', 1: 'augmentée', '-2': 'diminuée' }[d] || '?';
    }
    if (simple === 1) return (q === 'juste' ? 'unisson' : 'unisson ' + q.replace(/e$/, ''));
    let n = ORD[simple] + ' ' + q;
    if (oct) n += ' (+ ' + oct + ' octave' + (oct > 1 ? 's' : '') + ')';
    return n;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Catalogue des intervalles (pour les leçons & exercices)
  const INTERVALS = [
    { id: '1J', n: 1, s: 0, name: 'Unisson', short: 'Uni', alias: 'la même note',
      song: 'Chanter exactement la même note que quelqu’un', feel: 'Fusion totale : les deux voix n’en font qu’une.', cons: 'parfaite' },
    { id: '2m', n: 2, s: 1, name: 'Seconde mineure', short: '2m', alias: '1 demi-ton',
      song: 'Les Dents de la mer (« Ta-dam… ta-dam »)', feel: 'Frottement très tendu, inquiétant.', cons: 'dissonance forte' },
    { id: '2M', n: 2, s: 2, name: 'Seconde majeure', short: '2M', alias: '1 ton',
      song: 'Joyeux anniversaire (« -eux » → « an- »)', feel: 'Un pas de gamme, léger frottement.', cons: 'dissonance douce' },
    { id: '3m', n: 3, s: 3, name: 'Tierce mineure', short: '3m', alias: '1 ton ½',
      song: 'Greensleeves (début) / Smoke on the Water', feel: 'Doux, mélancolique.', cons: 'consonance imparfaite' },
    { id: '3M', n: 3, s: 4, name: 'Tierce majeure', short: '3M', alias: '2 tons',
      song: 'Oh When the Saints (« Oh when »)', feel: 'Lumineux, joyeux : LA couleur des harmonies pop.', cons: 'consonance imparfaite' },
    { id: '4J', n: 4, s: 5, name: 'Quarte juste', short: '4J', alias: '2 tons ½',
      song: 'La Marseillaise (« Al-lons »)', feel: 'Ouvert, solennel, un peu suspendu.', cons: 'consonance (instable)' },
    { id: '4A', n: 4, s: 6, name: 'Quarte augmentée (triton)', short: 'Tri', alias: '3 tons',
      song: 'Les Simpson (« The Simp-sons »)', feel: 'Instable, étrange, « diabolus in musica ».', cons: 'dissonance' },
    { id: '5J', n: 5, s: 7, name: 'Quinte juste', short: '5J', alias: '3 tons ½',
      song: 'Star Wars (thème principal, 2 premières notes)', feel: 'Puissant, vide, stable.', cons: 'consonance parfaite' },
    { id: '6m', n: 6, s: 8, name: 'Sixte mineure', short: '6m', alias: '4 tons',
      song: 'The Entertainer (Mi → Do aigu)', feel: 'Tendre, nostalgique.', cons: 'consonance imparfaite' },
    { id: '6M', n: 6, s: 9, name: 'Sixte majeure', short: '6M', alias: '4 tons ½',
      song: 'My Bonnie Lies over the Ocean (« My Bon- »)', feel: 'Chaleureux, ouvert.', cons: 'consonance imparfaite' },
    { id: '7m', n: 7, s: 10, name: 'Septième mineure', short: '7m', alias: '5 tons',
      song: 'Star Trek (série originale) / « Somewhere » (West Side Story)', feel: 'Bluesy, appelle une résolution.', cons: 'dissonance douce' },
    { id: '7M', n: 7, s: 11, name: 'Septième majeure', short: '7M', alias: '5 tons ½',
      song: 'Take On Me (refrain, « Take on »)', feel: 'Rêveur, très tendu, veut monter à l’octave.', cons: 'dissonance forte' },
    { id: '8J', n: 8, s: 12, name: 'Octave', short: '8ve', alias: '6 tons',
      song: 'Over the Rainbow (« Some-where »)', feel: 'La même note, plus haut : fusion.', cons: 'consonance parfaite' },
  ];
  const IV = Object.fromEntries(INTERVALS.map(i => [i.id, i]));

  // Transposer une note épelée d'un intervalle (num, semis) vers le haut (+1) ou le bas (-1)
  function transpose(n, num, semis, dir = 1) {
    const L = n.l + dir * (num - 1);
    const l = ((L % 7) + 7) % 7;
    const o = n.o + Math.floor(L / 7);
    const target = midiOf(n) + dir * semis;
    const a = target - (12 * (o + 1) + LETTER_PC[l]);
    if (a < -2 || a > 2) return spellMidi(target, dir < 0);
    return note(l, a, o);
  }

  // ---------------- Tonalités ----------------
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
  // Toniques bien épelées pour chaque classe de hauteur
  const MAJOR_TONICS = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  const MINOR_TONICS = [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]];

  function makeKey(pc, mode) {
    const [l, a] = (mode === 'minor' ? MINOR_TONICS : MAJOR_TONICS)[pc];
    return keyFrom(l, a, mode);
  }
  function keyFrom(l, a, mode) {
    const steps = mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS;
    const tonicPc = (LETTER_PC[l] + a + 12) % 12;
    const acc = new Array(7).fill(0);
    const scale = [];
    for (let i = 0; i < 7; i++) {
      const L = (l + i) % 7;
      const pc = (tonicPc + steps[i]) % 12;
      let d = pc - LETTER_PC[L];
      if (d > 6) d -= 12; if (d < -6) d += 12;
      acc[L] = d;
      scale.push({ l: L, a: d, pc });
    }
    return { l, a, mode, pc: tonicPc, acc, scale };
  }
  function keyName(k) {
    return name({ l: k.l, a: k.a, o: 4 }) + (k.mode === 'minor' ? ' mineur' : ' majeur');
  }
  const keyId = k => k.pc + ':' + k.mode;
  const ALL_KEYS = [];
  for (let pc = 0; pc < 12; pc++) { ALL_KEYS.push(makeKey(pc, 'major')); ALL_KEYS.push(makeKey(pc, 'minor')); }
  const EASY_KEYS = [[0, 'major'], [7, 'major'], [5, 'major'], [2, 'major'], [10, 'major'], [9, 'minor'], [4, 'minor'], [2, 'minor']]
    .map(([p, m]) => makeKey(p, m));
  const MID_KEYS = EASY_KEYS.concat([[9, 'major'], [3, 'major'], [4, 'major'], [11, 'minor'], [7, 'minor'], [0, 'minor']].map(([p, m]) => makeKey(p, m)));

  // Épeler un numéro MIDI dans une tonalité
  function spellInKey(m, key) {
    const pc = ((m % 12) + 12) % 12, o = Math.floor(m / 12) - 1;
    const deg = key.scale.find(s => s.pc === pc);
    const fix = (l, a) => { // corriger l'octave pour Si♯ / Do♭ etc.
      const n = note(l, a, o); const d = midiOf(n) - m; n.o -= Math.round(d / 12); return n;
    };
    if (deg) return fix(deg.l, deg.a);
    const sharpKey = key.acc.some(x => x > 0) || key.acc.every(x => x === 0);
    const sp = spellMidi(m, !sharpKey);
    return sp;
  }
  // Degré (0..6) d'une note épelée dans la tonalité
  const degreeOf = (n, key) => ((n.l - key.l) % 7 + 7) % 7;

  // Décalage diatonique : steps = +2 (tierce au-dessus), -2 (tierce en dessous), +4 (quinte)…
  function diatonicShift(n, key, steps) {
    const L = n.l + steps;
    const l = ((L % 7) + 7) % 7;
    const o = n.o + Math.floor(L / 7);
    return note(l, key.acc[l], o);
  }

  // Décrire l'intervalle entre deux notes épelées (du grave vers l'aigu)
  function describe(a, b) {
    let lo = a, hi = b;
    if (midiOf(b) < midiOf(a)) { lo = b; hi = a; }
    const num = (hi.l + 7 * hi.o) - (lo.l + 7 * lo.o) + 1;
    return intervalName(num, midiOf(hi) - midiOf(lo));
  }

  // ---------------- Types d'harmonie ----------------
  // kind 'dia' : diatonique dans la tonalité ; kind 'chr' : intervalle fixe (harmonie parallèle)
  const HARMONIES = {
    '3+': { kind: 'dia', steps: 2, label: 'Tierce au-dessus', desc: 'La 3e note de la gamme au-dessus : l’harmonie la plus utilisée en pop. Selon le degré, la tierce est majeure ou mineure.' },
    '3-': { kind: 'dia', steps: -2, label: 'Tierce en dessous', desc: 'Même idée, mais sous la mélodie : très chaleureux, typique des duos.' },
    '6-': { kind: 'dia', steps: -5, label: 'Sixte en dessous', desc: 'Renversement de la tierce au-dessus (même nom de note, une octave plus bas). Doux et enveloppant.' },
    '6+': { kind: 'dia', steps: 5, label: 'Sixte au-dessus', desc: 'Renversement de la tierce en dessous. Voix aérienne.' },
    '5+': { kind: 'dia', steps: 4, label: 'Quinte au-dessus', desc: 'Son « puissant » et ouvert. Attention au 7e degré (quinte diminuée).' },
    '4-': { kind: 'dia', steps: -3, label: 'Quarte en dessous', desc: 'Même nom de note que la quinte au-dessus, une octave plus bas.' },
    '5-': { kind: 'dia', steps: -4, label: 'Quinte en dessous', desc: 'Base solide sous la mélodie (souvent la fondamentale de l’accord).' },
    '8+': { kind: 'dia', steps: 7, label: 'Octave au-dessus', desc: 'La même mélodie, une octave plus haut.' },
  };
  function chromaticHarmony(ivId, dir) {
    const iv = IV[ivId];
    const where = dir > 0 ? 'au-dessus' : 'en dessous';
    const label = ivId === '1J' ? 'Unisson (la même note)' : iv.name + ' ' + where + (ivId === '2m' ? ' (½ ton)' : ivId === '2M' ? ' (1 ton)' : '');
    return { kind: 'chr', iv: ivId, dir, label,
      desc: 'Harmonie parallèle : chaque note est décalée d’exactement ' + iv.s + ' demi-ton' + (iv.s > 1 ? 's' : '') + ' (' + iv.alias + '), sans tenir compte de la gamme.' };
  }
  // Récupère une définition d'harmonie à partir d'un code : '3+', 'c:3M:+1', 'c:2m:-1'
  function harmony(code) {
    if (HARMONIES[code]) return Object.assign({ code }, HARMONIES[code]);
    const [, iv, d] = code.split(':');
    return Object.assign({ code }, chromaticHarmony(iv, +d));
  }
  function harmonize(n, key, code) {
    const h = harmony(code);
    if (h.kind === 'dia') return diatonicShift(n, key, h.steps);
    const iv = IV[h.iv];
    return transpose(n, iv.n, iv.s, h.dir);
  }

  // ---------------- Tessitures ----------------
  const RANGES = {
    grave: { label: 'Grave (basse / baryton)', lo: 41, hi: 62 },
    medium: { label: 'Medium (ténor / alto)', lo: 48, hi: 69 },
    aigu: { label: 'Aigu (mezzo / soprano)', lo: 55, hi: 77 },
  };

  // ---------------- Détection de tonalité (Krumhansl-Schmuckler) ----------------
  const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function corr(x, y) {
    const mx = x.reduce((s, v) => s + v, 0) / 12, my = y.reduce((s, v) => s + v, 0) / 12;
    let n = 0, dx = 0, dy = 0;
    for (let i = 0; i < 12; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
    return n / Math.sqrt(dx * dy || 1);
  }
  function detectKey(notes) {
    const h = new Array(12).fill(0);
    notes.forEach(n => { h[((n.midi % 12) + 12) % 12] += n.dur || 1; });
    let best = null;
    for (let pc = 0; pc < 12; pc++) {
      for (const [mode, prof] of [['major', KK_MAJ], ['minor', KK_MIN]]) {
        const rot = prof.map((_, i) => prof[(i - pc + 12) % 12]);
        const c = corr(h, rot);
        if (!best || c > best.c) best = { c, pc, mode };
      }
    }
    return makeKey(best ? best.pc : 0, best ? best.mode : 'major');
  }

  const rnd = a => a[Math.floor(Math.random() * a.length)];
  // « la tierce… », « l'octave… », « l'unisson… »
  const art = label => (/^[aeiouyéèh]/i.test(label) ? 'l’' : 'la ') + label.toLowerCase();

  return {
    note, midiOf, freqOf, midiFromFreq, name, midiName, spellMidi, intervalName, cap,
    INTERVALS, IV, transpose, makeKey, keyFrom, keyName, keyId, ALL_KEYS, EASY_KEYS, MID_KEYS,
    spellInKey, degreeOf, diatonicShift, describe, HARMONIES, harmony, harmonize, RANGES,
    detectKey, setNaming, rnd, art, NAMES_FR, NAMES_EN,
  };
})();
