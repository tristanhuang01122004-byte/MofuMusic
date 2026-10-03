// ============================================================
//  MofuMusic — mode Chansons : importer une chanson et apprendre à l'harmoniser pas à pas
// ============================================================
'use strict';

const Song = (() => {
  const { h, btn, $, toast } = UI;
  const S = () => Game.state.settings;

  const STEPS = [
    { id: 'import', label: 'Importer', icon: '📂' },
    { id: 'section', label: 'Choisir un passage', icon: '✂️' },
    { id: 'analyse', label: 'Mélodie & tonalité', icon: '🔍' },
    { id: 'melody', label: 'Chanter la mélodie', icon: '🎤' },
    { id: 'harmony', label: 'Découvrir l’harmonie', icon: '🎶' },
    { id: 'guided', label: 'Chanter avec le guide', icon: '🐾' },
    { id: 'solo', label: 'Chanter seul·e', icon: '⭐' },
  ];

  // État de la chanson en cours
  const st = {
    step: 0, source: null, name: '', buffer: null, peaks: null,
    all: [], accomp: [], phrases: [], region: null, notes: [], key: null,
    harmonyCode: '3+', harmony: [], sel: -1, scores: {},
  };

  // ---------------- Exemples intégrés (domaine public) ----------------
  const EXAMPLES = [
    { name: 'Au clair de la lune', tempo: 90,
      seq: 'C4:1 C4:1 C4:1 D4:1 E4:2 D4:2 C4:1 E4:1 D4:1 D4:1 C4:4 C4:1 C4:1 C4:1 D4:1 E4:2 D4:2 C4:1 E4:1 D4:1 D4:1 C4:4' },
    { name: 'Frère Jacques', tempo: 100,
      seq: 'C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1 E4:1 F4:1 G4:2 E4:1 F4:1 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 C4:1 G3:1 C4:2 C4:1 G3:1 C4:2' },
    { name: 'Ode à la joie', tempo: 100,
      seq: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2 E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2' },
  ];
  function parseSeq(seq, tempo) {
    const spb = 60 / tempo; let t = 0;
    return seq.trim().split(/\s+/).map(tok => {
      const [nm, beats] = tok.split(':');
      const m = nm.match(/^([A-G])([#b]?)(-?\d)$/);
      const l = 'CDEFGAB'.indexOf(m[1]), a = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
      const midi = Music.midiOf(Music.note(l, a, +m[3]));
      const n = { midi, start: t, dur: +beats * spb }; t += +beats * spb; return n;
    });
  }

  // ---------------- Lecteur MIDI (format SMF) ----------------
  function parseMidi(ab) {
    const d = new DataView(ab); let p = 0;
    const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p++)); return s; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    if (str(4) !== 'MThd') throw new Error('Fichier MIDI invalide');
    const hl = u32(); const fmt = u16(), ntr = u16(), div = u16(); p = 8 + hl;
    if (div & 0x8000) throw new Error('Format MIDI SMPTE non pris en charge');
    const tempos = [{ tick: 0, us: 500000 }];
    const tracks = [];
    for (let ti = 0; ti < ntr && p < d.byteLength; ti++) {
      const id = str(4), len = u32(), end = p + len;
      if (id !== 'MTrk') { p = end; continue; }
      let tick = 0, run = 0, name = '';
      const on = {}, notes = [];
      while (p < end) {
        tick += vlq();
        let s = d.getUint8(p);
        if (s & 0x80) { p++; run = s; } else s = run;
        const type = s & 0xf0, ch = s & 0x0f;
        if (s === 0xff) {
          const mt = d.getUint8(p++), ml = vlq();
          if (mt === 0x51) tempos.push({ tick, us: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
          if (mt === 0x03) { const q = p; name = ''; for (let i = 0; i < ml; i++) name += String.fromCharCode(d.getUint8(q + i)); }
          p += ml;
        } else if (s === 0xf0 || s === 0xf7) { p += vlq(); }
        else if (type === 0x90 || type === 0x80) {
          const k = d.getUint8(p++), v = d.getUint8(p++);
          const kk = ch + ':' + k;
          if (type === 0x90 && v > 0) { (on[kk] = on[kk] || []).push(tick); }
          else if (on[kk]?.length) { const st0 = on[kk].shift(); notes.push({ midi: k, t0: st0, t1: tick, ch }); }
        } else if (type === 0xc0 || type === 0xd0) p += 1;
        else p += 2;
      }
      p = end;
      if (notes.length) tracks.push({ name: name || 'Piste ' + (ti + 1), notes, drums: notes.every(n => n.ch === 9) });
    }
    tempos.sort((a, b) => a.tick - b.tick);
    const toSec = tick => {
      let s = 0, last = 0, us = 500000;
      for (const t of tempos) { if (t.tick > tick) break; s += (t.tick - last) * us / div / 1e6; last = t.tick; us = t.us; }
      return s + (tick - last) * us / div / 1e6;
    };
    tracks.forEach(tr => { tr.notes = tr.notes.map(n => ({ midi: n.midi, start: toSec(n.t0), dur: Math.max(0.05, toSec(n.t1) - toSec(n.t0)) })).sort((a, b) => a.start - b.start); });
    return { tracks: tracks.filter(t => !t.drums), fmt };
  }
  // Monophoniser (note la plus aiguë)
  function skyline(notes) {
    const out = [];
    notes.forEach(n => {
      const p = out[out.length - 1];
      if (p && n.start < p.start + p.dur - 0.03) {
        if (Math.abs(n.start - p.start) < 0.03) { if (n.midi > p.midi) { p.midi = n.midi; p.dur = n.dur; } return; }
        p.dur = n.start - p.start;
      }
      out.push({ ...n });
    });
    return out.filter(n => n.dur > 0.04);
  }
  // Découper en phrases (silences ou ~8 notes)
  function splitPhrases(notes) {
    const phrases = []; let cur = [];
    notes.forEach((n, i) => {
      const prev = notes[i - 1];
      const gap = prev ? n.start - (prev.start + prev.dur) : 0;
      const len = cur.length ? n.start - cur[0].start : 0;
      const afterLong = prev && prev.dur >= 1.5 * Math.min(...cur.map(x => x.dur));
      if (cur.length && (gap > 0.35 || cur.length >= 12 || (cur.length >= 6 && gap > 0.12) || (len >= 3.5 && afterLong) || len >= 7)) { phrases.push(cur); cur = []; }
      cur.push(n);
    });
    if (cur.length) phrases.push(cur);
    return phrases.map(ph => ({ start: Math.max(0, ph[0].start - 0.05), end: ph[ph.length - 1].start + ph[ph.length - 1].dur + 0.1 }));
  }

  // ---------------- Rendu ----------------
  function open() { App.show('songs'); render(); }

  function render() {
    const root = $('#view-songs'); root.innerHTML = '';
    const stepper = h('div.stepper', STEPS.map((s, i) => h('button.step' + (i === st.step ? '.on' : '') + (i < st.step ? '.done' : ''),
      { type: 'button', disabled: !canGo(i), onclick: () => go(i) }, h('span.n', i + 1), h('span.l', s.icon + ' ' + s.label))));
    const body = h('div.song-body');
    root.append(h('div.song-head', h('img', { src: Game.CATS.songs, alt: '' }),
      h('div', h('h2', 'Chansons'), h('p.dim', st.name ? '🎵 ' + st.name + (st.key ? ' — ' + Music.keyName(st.key) : '') : 'Importe une chanson et apprends à l’harmoniser, étape par étape.'))), stepper, body);
    [stepImport, stepSection, stepAnalyse, stepMelody, stepHarmony, stepGuided, stepSolo][st.step](body);
  }
  function canGo(i) {
    if (i === 0) return true;
    if (i === 1) return !!st.source;
    if (i === 2) return !!st.region;
    return st.notes.length > 0 && !!st.key && (i < 5 || st.harmony.length > 0);
  }
  function go(i) { Audio.stopAll(); if (canGo(i)) { st.step = i; if (i >= 4) computeHarmony(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  const nextBtn = (label = 'Étape suivante →') => btn(label, () => go(st.step + 1), 'primary');
  const tip = (cat, ...content) => h('div.tip', h('img', { src: cat, alt: '' }), h('div', ...content));

  // ---------- 1. Import ----------
  function stepImport(body) {
    const input = h('input', { type: 'file', accept: 'audio/*,.mid,.midi', class: 'hidden' });
    input.addEventListener('change', () => input.files[0] && loadFile(input.files[0]));
    const drop = h('div.drop', { onclick: () => input.click() },
      h('img', { src: Game.CATS.duo, alt: '' }),
      h('p', h('b', 'Clique ou dépose un fichier ici')),
      h('p.dim', 'Audio (mp3, wav, m4a, ogg…) ou partition MIDI (.mid). Idéal : une version où la voix est bien audible, ou une piste voix seule.'), input);
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); });

    const manual = h('div.card',
      h('h3', '🎹 Ou saisis une mélodie toi-même'),
      h('p.dim', 'Pratique si tu connais la chanson : joue la mélodie note par note au clavier.'),
      btn('Saisir une mélodie', manualEntry));
    const ex = h('div.card', h('h3', '🐾 Ou essaie avec un exemple'),
      h('div.row.wrap', EXAMPLES.map(e => btn(e.name, () => {
        reset(); st.source = 'manual'; st.name = e.name;
        st.all = parseSeq(e.seq, e.tempo); st.phrases = splitPhrases(st.all); st.region = { ...st.phrases[0] }; st.step = 1; render();
      }))));
    body.append(h('div.steps-explain', tip(Game.CATS.teacher,
      h('b', 'Comment ça marche ? '),
      'On découpe la chanson en petits passages. Pour chaque passage : 1) on trouve la mélodie et la tonalité, 2) tu chantes la mélodie, 3) tu découvres une harmonie (tierce, sixte…), 4) tu la chantes avec un guide, 5) puis toute seule sur la chanson.')),
      drop, h('div.grid2', manual, ex));
  }
  function reset() {
    Object.assign(st, { source: null, name: '', buffer: null, peaks: null, all: [], accomp: [], phrases: [], region: null, notes: [], key: null, harmony: [], sel: -1, scores: {} });
  }
  async function loadFile(file) {
    reset();
    st.name = file.name.replace(/\.[^.]+$/, '');
    try {
      if (/\.midi?$/i.test(file.name)) {
        const mid = parseMidi(await file.arrayBuffer());
        if (!mid.tracks.length) throw new Error('Aucune note trouvée dans ce MIDI');
        st.source = 'midi'; st.midi = mid;
        // piste mélodie par défaut : la plus aiguë en moyenne avec assez de notes
        const scoreT = t => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length + Math.min(10, t.notes.length / 20);
        st.trackIdx = mid.tracks.indexOf(mid.tracks.slice().sort((a, b) => scoreT(b) - scoreT(a))[0]);
        useTrack(st.trackIdx);
      } else {
        toast('Décodage de l’audio…');
        st.buffer = await Audio.decodeFile(file);
        st.source = 'audio';
        st.peaks = computePeaks(st.buffer, 1200);
        st.region = { start: 0, end: Math.min(8, st.buffer.duration) };
      }
      st.step = 1; render();
    } catch (e) {
      console.error(e); toast('Impossible de lire ce fichier : ' + e.message, 'bad');
    }
  }
  function useTrack(i) {
    st.trackIdx = i;
    const tr = st.midi.tracks[i];
    st.all = skyline(tr.notes);
    st.accomp = st.midi.tracks.filter((_, k) => k !== i).flatMap(t => t.notes);
    st.phrases = splitPhrases(st.all);
    st.region = st.phrases[0] ? { ...st.phrases[0] } : null; st.notes = []; st.harmony = [];
  }
  function computePeaks(buf, n) {
    const ch = buf.getChannelData(0), step = Math.floor(ch.length / n), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < (i + 1) * step; j += 16) m = Math.max(m, Math.abs(ch[j])); out[i] = m; }
    return out;
  }

  // Saisie manuelle
  function manualEntry() {
    reset(); st.source = 'manual'; st.name = 'Ma mélodie';
    const body = $('.song-body'); body.innerHTML = '';
    let beats = 1; const notes = [];
    const tempoIn = h('input', { type: 'number', min: 40, max: 200, value: S().tempo, style: { width: '70px' } });
    const list = h('div.typed');
    const canvas = h('canvas.roll'); const roll = new UI.Roll(canvas, { duration: 4 });
    const refresh = () => {
      const spb = 60 / +tempoIn.value; let t = 0;
      st.all = notes.map(n => { const o = { midi: n.midi, start: t, dur: n.beats * spb }; t += n.beats * spb; return o; });
      roll.set([{ cls: 'melody', notes: st.all }], Math.max(4, t + 0.3));
      list.textContent = notes.length ? notes.map(n => Music.midiName(n.midi) + (n.beats !== 1 ? '(' + n.beats + ')' : '')).join(' ') : 'Aucune note pour l’instant.';
    };
    const durBtns = h('div.row.wrap', [['Croche', 0.5], ['Noire', 1], ['Noire pointée', 1.5], ['Blanche', 2], ['Ronde', 4]].map(([l, b]) => {
      const x = btn(l, () => { beats = b; durBtns.querySelectorAll('button').forEach(y => y.classList.remove('on')); x.classList.add('on'); }, 'small' + (b === 1 ? ' on' : ''));
      return x;
    }));
    const kbEl = h('div');
    new UI.Keyboard(kbEl, { lo: 43, hi: 79, onPress: m => { notes.push({ midi: m, beats }); refresh(); } });
    tempoIn.addEventListener('input', refresh);
    body.append(h('div.card', h('h3', '🎹 Saisie de la mélodie'),
      h('p.dim', 'Choisis la durée, puis clique les notes dans l’ordre.'),
      h('div.row.wrap', h('label', 'Tempo ', tempoIn, ' bpm'), durBtns),
      kbEl, list, canvas,
      h('div.row.wrap',
        btn('⌫ Effacer la dernière', () => { notes.pop(); refresh(); }, 'ghost'),
        btn('▶ Écouter', () => { Audio.stopAll(); const t = Audio.now() + 0.1; Audio.playSeq(st.all, t); roll.play(t, st.all.length ? st.all[st.all.length - 1].start + st.all[st.all.length - 1].dur : 0); }),
        btn('Valider →', () => {
          if (notes.length < 2) { toast('Ajoute au moins 2 notes', 'bad'); return; }
          st.phrases = splitPhrases(st.all); st.region = { ...st.phrases[0] }; st.step = 1; render();
        }, 'primary'))));
    refresh();
  }

  // ---------- 2. Choisir un passage ----------
  function stepSection(body) {
    if (st.source === 'audio') return sectionAudio(body);
    const tracks = st.source === 'midi' ? h('div.row.wrap', h('b', 'Piste de la mélodie : '),
      (() => {
        const sel = h('select', { onchange: e => { useTrack(+e.target.value); render(); } },
          st.midi.tracks.map((t, i) => h('option', { value: i, selected: i === st.trackIdx }, t.name + ' (' + t.notes.length + ' notes)')));
        return sel;
      })(),
      btn('▶ Écouter la piste', () => { Audio.stopAll(); Audio.playSeq(st.all.filter(n => n.start < 20), Audio.now() + 0.1); }, 'small'),
      btn('⏹', () => Audio.stopAll(), 'small ghost')) : null;
    const list = h('div.phrases', st.phrases.map((p, i) => {
      const ns = st.all.filter(n => n.start >= p.start - 0.01 && n.start < p.end - 0.09);
      const active = st.region && Math.abs(st.region.start - p.start) < 0.01;
      const done = st.scores['p' + p.start.toFixed(2)];
      return h('button.phrase' + (active ? '.on' : ''), { type: 'button', onclick: () => { st.region = { ...p }; st.notes = []; st.harmony = []; st.sel = -1; render(); } },
        h('b', 'Passage ' + (i + 1)), h('small', ns.slice(0, 8).map(n => Music.midiName(n.midi)).join(' ') + (ns.length > 8 ? '…' : '')),
        done ? h('span.stars', '★'.repeat(done)) : null);
    }));
    body.append(tip(Game.CATS.teacher, 'Choisis un ', h('b', 'petit passage'), ' (une phrase de la chanson). On travaille toujours morceau par morceau.'),
      h('div.card', tracks, list, h('div.row.wrap',
        st.region ? btn('▶ Écouter ce passage', () => playRegionOriginal()) : null,
        st.region ? nextBtn() : h('p.dim', 'Sélectionne un passage.'))));
  }

  function sectionAudio(body) {
    const dur = st.buffer.duration;
    const canvas = h('canvas.wave');
    const info = h('span.dim');
    const draw = () => {
      const c = canvas.getContext('2d'), dpr = devicePixelRatio || 1, w = canvas.clientWidth, hh = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = hh * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const css = getComputedStyle(document.documentElement);
      const r = st.region;
      c.fillStyle = css.getPropertyValue('--accent-soft'); c.fillRect(r.start / dur * w, 0, (r.end - r.start) / dur * w, hh);
      c.fillStyle = css.getPropertyValue('--melody');
      const n = st.peaks.length;
      for (let i = 0; i < n; i++) { const x = i / n * w, v = st.peaks[i] * hh * 0.9; c.fillRect(x, hh / 2 - v / 2, Math.max(1, w / n), v); }
      info.textContent = 'Passage : ' + fmt(r.start) + ' → ' + fmt(r.end) + ' (' + (r.end - r.start).toFixed(1) + ' s)';
    };
    let dragging = null;
    const tAt = e => { const r = canvas.getBoundingClientRect(); return Math.max(0, Math.min(dur, (e.clientX - r.left) / r.width * dur)); };
    canvas.addEventListener('pointerdown', e => { dragging = tAt(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (dragging == null) return; const t = tAt(e); st.region = { start: Math.min(dragging, t), end: Math.max(dragging, t) }; draw(); });
    canvas.addEventListener('pointerup', e => {
      if (dragging == null) return; const t = tAt(e);
      if (Math.abs(t - dragging) < 0.3) st.region = { start: t, end: Math.min(dur, t + 8) };
      if (st.region.end - st.region.start > 30) st.region.end = st.region.start + 30;
      dragging = null; st.notes = []; draw();
    });
    const shift = d => { const len = st.region.end - st.region.start; let s = Math.max(0, Math.min(dur - 1, st.region.start + d * len)); st.region = { start: s, end: Math.min(dur, s + len) }; st.notes = []; draw(); };
    const nudge = (which, d) => { st.region[which] = Math.max(0, Math.min(dur, st.region[which] + d)); if (st.region.end - st.region.start < 1) st.region.end = st.region.start + 1; st.notes = []; draw(); };
    body.append(tip(Game.CATS.teacher, 'Glisse sur la forme d’onde pour sélectionner ', h('b', 'une phrase chantée'), ' (idéalement 4 à 12 secondes). Un simple clic sélectionne 8 s.'),
      h('div.card', canvas, h('div.row.wrap', info),
        h('div.row.wrap',
          btn('▶ Écouter le passage', () => playRegionOriginal()), btn('⏹', () => Audio.stopAll(), 'ghost'),
          btn('⟵ Début −0,5 s', () => nudge('start', -0.5), 'small ghost'), btn('Début +0,5 s ⟶', () => nudge('start', 0.5), 'small ghost'),
          btn('⟵ Fin −0,5 s', () => nudge('end', -0.5), 'small ghost'), btn('Fin +0,5 s ⟶', () => nudge('end', 0.5), 'small ghost'),
          btn('Passage suivant ⏭', () => shift(1), 'small')),
        h('div.row', nextBtn('Analyser ce passage →'))));
    requestAnimationFrame(draw);
    new ResizeObserver(draw).observe(canvas);
  }
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + Math.floor((s % 1) * 10);

  // Joue le passage original (audio ou MIDI) à `when` ; renvoie l'instant de fin
  function playRegionOriginal(when, vol = 0.9) {
    const r = st.region; const t = when || Audio.now() + 0.1;
    if (st.source === 'audio') { Audio.playBuffer(st.buffer, t, r.start, r.end - r.start, vol); return t + r.end - r.start; }
    const rel = st.all.filter(n => n.start >= r.start - 0.01 && n.start < r.end - 0.09).map(n => ({ ...n, start: n.start - r.start }));
    Audio.playSeq(rel, t, { timbre: 'piano', vol: 0.55 * vol });
    if (st.accomp.length) Audio.playSeq(st.accomp.filter(n => n.start >= r.start - 0.01 && n.start < r.end - 0.09).map(n => ({ ...n, start: n.start - r.start, dur: Math.min(n.dur, r.end - n.start) })), t, { timbre: 'soft', vol: 0.18 * vol });
    return t + r.end - r.start;
  }
  const regionDur = () => st.region.end - st.region.start;

  // ---------- 3. Analyse ----------
  async function analyse() {
    const r = st.region;
    if (st.source === 'audio') {
      const frames = await Audio.pitchTrack(st.buffer, r.start, r.end - r.start, p => { const b = $('#an-bar'); if (b) b.style.width = Math.round(p * 100) + '%'; });
      st.frames = frames;
      st.notes = Audio.framesToNotes(frames);
    } else {
      st.notes = st.all.filter(n => n.start >= r.start - 0.01 && n.start < r.end - 0.09).map(n => ({ ...n, start: n.start - r.start }));
    }
    // la tonalité est estimée sur toute la chanson (MIDI) ou le passage (audio)
    st.key = Music.detectKey(st.source === 'audio' ? st.notes : st.all);
  }
  function stepAnalyse(body) {
    if (!st.notes.length) {
      body.append(h('div.card.center', h('img.spin-cat', { src: Game.CATS.think, alt: '' }), h('p', 'J’écoute la mélodie…'), h('div.progress', h('div#an-bar'))));
      analyse().then(() => {
        if (!st.notes.length) { toast('Aucune mélodie détectée sur ce passage. Essaie un autre passage (avec du chant bien audible).', 'bad'); st.step = 1; }
        render();
      }).catch(e => { console.error(e); toast('Erreur d’analyse : ' + e.message, 'bad'); });
      return;
    }
    const canvas = h('canvas.roll.tall');
    const roll = new UI.Roll(canvas, { duration: regionDur() });
    const draw = () => {
      const layers = [{ cls: 'melody', notes: st.notes.map(n => ({ ...n, name: Music.name(Music.spellInKey(n.midi, st.key)) })) }];
      roll.selected = st.sel; roll.set(layers, regionDur());
      if (st.frames && showTrace.checked) roll.trace = st.frames.filter(f => f.midi != null); else roll.trace = [];
      roll.draw();
    };
    roll.onClickNote = i => { st.sel = i; draw(); if (i >= 0) Audio.playNote(st.notes[i].midi, 0, 0.5); };
    const showTrace = h('input', { type: 'checkbox', checked: true, onchange: () => draw() });
    const keySel = h('select', { onchange: e => { st.key = Music.ALL_KEYS[+e.target.value]; render(); } },
      Music.ALL_KEYS.map((k, i) => h('option', { value: i, selected: Music.keyId(k) === Music.keyId(st.key) }, Music.keyName(k))));
    const edit = (fn) => { if (st.sel < 0) { toast('Clique d’abord sur une note'); return; } fn(st.notes[st.sel]); draw(); };
    const t0 = () => Audio.now() + 0.1;
    const accidentals = st.key.acc.filter(a => a > 0).length ? st.key.acc.filter(a => a > 0).length + ' dièse(s)' : st.key.acc.filter(a => a < 0).length ? st.key.acc.filter(a => a < 0).length + ' bémol(s)' : 'aucune altération';
    body.append(
      tip(Game.CATS.teacher, h('b', 'Voici la mélodie que j’ai trouvée. '),
        st.source === 'audio' ? 'La détection automatique n’est pas parfaite sur une chanson complète : compare avec l’original et corrige les notes (clique une note puis ↑ ↓ ou 🗑). Les points roses sont la hauteur brute détectée.' : 'Vérifie que c’est bien la mélodie chantée.'),
      h('div.card',
        h('div.row.wrap', h('b', 'Tonalité : '), keySel, h('span.dim', '(' + accidentals + ' — gamme : ' + st.key.scale.map(s => Music.name({ l: s.l, a: s.a, o: 4 })).join(' ') + ')')),
        canvas,
        h('div.row.wrap',
          btn('▶ Original', () => { Audio.stopAll(); const t = t0(); playRegionOriginal(t); roll.play(t, regionDur()); }),
          btn('▶ Mélodie détectée', () => { Audio.stopAll(); const t = t0(); Audio.playSeq(st.notes, t, { timbre: 'flute', vol: 0.55 }); roll.play(t, regionDur()); }),
          btn('▶ Les deux', () => { Audio.stopAll(); const t = t0(); playRegionOriginal(t, 0.7); Audio.playSeq(st.notes, t, { timbre: 'flute', vol: 0.45 }); roll.play(t, regionDur()); }),
          btn('⏹', () => { Audio.stopAll(); roll.stop(); }, 'ghost')),
        h('div.row.wrap', h('span.dim', 'Corriger la note sélectionnée :'),
          btn('↑ ½ ton', () => edit(n => { n.midi++; Audio.playNote(n.midi, 0, 0.4); }), 'small'),
          btn('↓ ½ ton', () => edit(n => { n.midi--; Audio.playNote(n.midi, 0, 0.4); }), 'small'),
          btn('↑ octave', () => edit(n => { n.midi += 12; }), 'small ghost'),
          btn('↓ octave', () => edit(n => { n.midi -= 12; }), 'small ghost'),
          btn('🗑 Supprimer', () => edit(() => { st.notes.splice(st.sel, 1); st.sel = -1; }), 'small ghost'),
          btn('Tout ↑ octave', () => { st.notes.forEach(n => n.midi += 12); draw(); }, 'small ghost'),
          btn('Tout ↓ octave', () => { st.notes.forEach(n => n.midi -= 12); draw(); }, 'small ghost'),
          st.source === 'audio' ? h('label.dim', showTrace, ' courbe brute') : null,
          st.source === 'audio' ? btn('↻ Réanalyser', () => { st.notes = []; render(); }, 'small ghost') : null),
        h('div.row', btn('Recalculer la tonalité', () => { st.key = Music.detectKey(st.notes); render(); }, 'ghost'), nextBtn())));
    draw();
  }

  // ---------- Chanter sur le passage (commun aux étapes 4, 6, 7) ----------
  function singPanel(body, { targets, guide, title, what, statKey, onDone }) {
    const canvas = h('canvas.roll.tall');
    const roll = new UI.Roll(canvas, { duration: regionDur() });
    const melLayer = { cls: 'melody', notes: st.notes.map(n => ({ ...n, name: Music.name(Music.spellInKey(n.midi, st.key)) })), ghost: targets !== st.notes };
    const tgtLayer = targets === st.notes ? null : { cls: 'harmony', notes: st.harmony.map(n => ({ ...n })) };
    roll.set(tgtLayer ? [melLayer, tgtLayer] : [melLayer]);
    const meterEl = h('div'); const meter = new UI.Meter(meterEl);
    const fb = h('div.feedback');
    let busy = false;
    const go2 = async () => {
      if (busy) return;
      try { await Audio.openMic(); } catch (e) { toast(e.message || 'Micro refusé', 'bad'); return; }
      busy = true; Audio.stopAll(); fb.innerHTML = '';
      const spb = 0.5, t = Audio.now() + 0.2;
      for (let i = 0; i < 4; i++) Audio.click(t + i * spb, i === 0);
      if (targets[0]) Audio.playNote(targets[0].midi, t, spb * 3.5, { timbre: 'soft', vol: 0.3 });
      const t0 = t + 4 * spb;
      playRegionOriginal(t0, 0.85);
      if (guide) Audio.playSeq(guide, t0, { timbre: 'flute', vol: 0.4 });
      roll.trace = []; roll.play(t0, regionDur());
      meter.reset('Décompte…');
      const frames = await Exercise.recordAlong(t0, regionDur(), p => { meter.update(p); if (p.t >= 0) roll.trace.push(p); });
      Audio.closeMic();
      busy = false;
      const res = Exercise.evalNotes(targets, frames, 0.08);
      tgtLayer ? tgtLayer.notes.forEach((n, i) => n.state = res[i].state) : melLayer.notes.forEach((n, i) => n.state = res[i].state);
      roll.draw();
      const good = res.filter(r => r.state === 'good').length, ratio = good / res.length;
      Game.recordStat(statKey, ratio >= 0.75);
      const stars = ratio >= 0.9 ? 3 : ratio >= 0.75 ? 2 : ratio >= 0.5 ? 1 : 0;
      fb.append(h('div.fb-inner' + (ratio >= 0.75 ? '.good' : '.bad'), h('img.fb-cat', { src: ratio >= 0.75 ? Game.CATS.success : Game.CATS.fail, alt: '' }),
        h('div', h('h3', good + ' / ' + res.length + ' notes justes (' + Math.round(ratio * 100) + ' %)'),
          h('div.stars', [0, 1, 2].map(i => h('span' + (i < stars ? '.on' : ''), '★'))),
          h('p.dim', ratio >= 0.75 ? 'Super ! Tu peux passer à l’étape suivante.' : 'Réécoute, puis réessaie. Les notes rouges sont à retravailler.'),
          onDone ? onDone(ratio, stars) : null)));
    };
    body.append(h('div.card', h('h3', title), what, canvas, meterEl,
      h('div.row.wrap', btn('🎤 Chanter (décompte de 4 clics)', go2, 'primary'),
        btn('▶ Écouter l’exemple', () => { Audio.stopAll(); const t = Audio.now() + 0.1; playRegionOriginal(t, 0.7); Audio.playSeq(targets, t, { timbre: 'flute', vol: 0.55 }); roll.play(t, regionDur()); }),
        btn('⏹', () => { Audio.stopAll(); roll.stop(); }, 'ghost'),
        st.step < STEPS.length - 1 ? btn('Étape suivante →', () => go(st.step + 1), 'ghost') : null), fb));
    return roll;
  }

  // ---------- 4. Chanter la mélodie ----------
  function stepMelody(body) {
    body.append(tip(Game.CATS.sing, h('b', 'D’abord, la mélodie. '), 'Pour bien harmoniser, il faut connaître la mélodie par cœur. Mets un ', h('b', 'casque'), ' (sinon le micro entend la chanson) et chante avec l’original.'));
    singPanel(body, { targets: st.notes, title: '🎤 Chante la mélodie', what: h('p.dim', 'Les points roses montrent ta voix en direct.'), statKey: 'song:melody',
      onDone: () => h('div.row', nextBtn()) });
  }

  // ---------- 5. Découvrir l'harmonie ----------
  const SONG_HARMONIES = ['3+', '3-', '6-', '6+', '5+', '4-', 'c:3M:+1', 'c:3m:+1', 'c:2m:+1', 'c:2m:-1'];
  function computeHarmony() {
    if (!st.key || !st.notes.length) return;
    st.harmony = st.notes.map(n => {
      const sp = Music.spellInKey(n.midi, st.key);
      const t = Music.harmonize(sp, st.key, st.harmonyCode);
      return { midi: Music.midiOf(t), start: n.start, dur: n.dur, name: Music.name(t), from: sp, to: t };
    });
  }
  function stepHarmony(body) {
    computeHarmony();
    const cards = h('div.harm-cards', SONG_HARMONIES.map(code => {
      const hm = Music.harmony(code);
      return h('button.harm' + (code === st.harmonyCode ? '.on' : ''), { type: 'button', onclick: () => { st.harmonyCode = code; render(); } },
        h('b', hm.label), h('small', hm.kind === 'dia' ? 'diatonique (dans la gamme)' : 'parallèle (intervalle fixe)'));
    }));
    const hm = Music.harmony(st.harmonyCode);
    const canvas = h('canvas.roll.tall');
    const roll = new UI.Roll(canvas, { duration: regionDur() });
    roll.set([{ cls: 'melody', notes: st.notes.map(n => ({ ...n, name: Music.name(Music.spellInKey(n.midi, st.key)) })) }, { cls: 'harmony', notes: st.harmony }]);
    const table = h('div.iv-table', st.harmony.map(x => h('div.iv-cell', h('span.m', Music.name(x.from)), h('span.arrow', '→'), h('span.hn', x.name), h('small', Music.describe(x.from, x.to).split(' (')[0]))));
    const outOfKey = hm.kind === 'chr' ? h('p.dim', '⚠️ Une harmonie parallèle sort souvent de la gamme : c’est un exercice d’oreille, pas forcément joli sur la chanson ! Les harmonies diatoniques (tierce, sixte…) sonnent « naturelles ».') : null;
    const t0 = () => Audio.now() + 0.1;
    body.append(
      tip(Game.CATS.teacher, h('b', 'Choisis un type d’harmonie. '), 'La plus courante en chanson est la ', h('b', 'tierce au-dessus'), ' (ou en dessous pour une voix grave). Remarque que la tierce est tantôt majeure, tantôt mineure : on reste dans la gamme de ' + Music.keyName(st.key) + '.'),
      h('div.card', cards, h('p', h('b', hm.label + ' : '), hm.desc), outOfKey, canvas, table,
        h('div.row.wrap',
          btn('▶ Chanson + harmonie', () => { Audio.stopAll(); const t = t0(); playRegionOriginal(t, 0.8); Audio.playSeq(st.harmony, t, { timbre: 'flute', vol: 0.55 }); roll.play(t, regionDur()); }, 'primary'),
          btn('▶ Mélodie + harmonie (synthé)', () => { Audio.stopAll(); const t = t0(); Audio.playSeq(st.notes, t, { timbre: 'piano', vol: 0.5 }); Audio.playSeq(st.harmony, t, { timbre: 'flute', vol: 0.55 }); roll.play(t, regionDur()); }),
          btn('▶ Harmonie seule', () => { Audio.stopAll(); const t = t0(); Audio.playSeq(st.harmony, t, { timbre: 'flute', vol: 0.6 }); roll.play(t, regionDur()); }),
          btn('⏹', () => { Audio.stopAll(); roll.stop(); }, 'ghost')),
        h('div.row', nextBtn())));
  }

  // ---------- 6. Avec guide ----------
  function stepGuided(body) {
    body.append(tip(Game.CATS.duo, h('b', 'On chante l’harmonie avec un guide. '), 'La flûte joue ta partie doucement pendant que la chanson tourne : chante avec elle. Casque conseillé !'));
    singPanel(body, { targets: st.harmony, guide: st.harmony, title: '🐾 ' + Music.harmony(st.harmonyCode).label + ' — avec guide', what: h('p.dim', 'En orange : ta partie. Les points roses : ta voix.'), statKey: 'song:guided',
      onDone: () => h('div.row', nextBtn()) });
  }

  // ---------- 7. Seul ----------
  function stepSolo(body) {
    body.append(tip(Game.CATS.band, h('b', 'Dernière étape : sans filet ! '), 'Seule la chanson joue. À toi de tenir ton harmonie face à la mélodie.'));
    singPanel(body, { targets: st.harmony, guide: null, title: '⭐ ' + Music.harmony(st.harmonyCode).label + ' — sans guide', what: h('p.dim', 'Tu peux réécouter l’exemple autant que tu veux.'), statKey: 'song:solo',
      onDone: (ratio, stars) => {
        const key = 'p' + st.region.start.toFixed(2);
        const prev = st.scores[key] || 0;
        if (stars > prev) st.scores[key] = stars;
        const xp = Math.round(ratio * 40 + stars * 10);
        const promo = Game.addXp(xp); App.refreshHeader(); if (promo) App.rankUp(promo);
        toast('+' + xp + ' XP', 'good');
        return h('div.row.wrap',
          btn('Essayer une autre harmonie', () => go(4)),
          btn('Passage suivant →', () => nextPassage(), 'primary'));
      } });
  }
  function nextPassage() {
    Audio.stopAll();
    if (st.source === 'audio') {
      const len = regionDur();
      const s = Math.min(st.buffer.duration - 1, st.region.end);
      st.region = { start: s, end: Math.min(st.buffer.duration, s + len) };
    } else {
      const i = st.phrases.findIndex(p => Math.abs(p.start - st.region.start) < 0.01);
      st.region = st.phrases[(i + 1) % st.phrases.length];
    }
    st.notes = []; st.harmony = []; st.sel = -1;
    st.step = 1; render();
  }

  return { open, render, parseMidi };
})();
