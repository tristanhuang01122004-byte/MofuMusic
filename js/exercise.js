// ============================================================
//  MofuMusic — exercices : note seule, reconnaissance, mélodie
// ============================================================
'use strict';

const Exercise = (() => {
  const { h, btn, $, toast } = UI;
  const S = () => Game.state.settings;
  const range = () => Music.RANGES[S().range];

  // ---------------- Génération des questions ----------------
  function inRange(m, pad = 2) { const r = range(); return m >= r.lo - pad && m <= r.hi + pad; }

  function randomKey(level) { return Music.rnd(level.index > 8 ? Music.MID_KEYS : Music.EASY_KEYS); }

  // note épelée d'un degré de la tonalité, à une hauteur MIDI proche de `around`
  function degreeNote(key, deg, around) {
    const tonic = Music.note(key.l, key.a, 4);
    let n = Music.diatonicShift(tonic, key, deg);
    while (Music.midiOf(n) < around - 6) n = { ...n, o: n.o + 1 };
    while (Music.midiOf(n) > around + 6) n = { ...n, o: n.o - 1 };
    return n;
  }

  function makeSingle(level) {
    const r = range();
    for (let tries = 0; tries < 200; tries++) {
      const key = randomKey(level);
      const ref = degreeNote(key, Math.floor(Math.random() * 7), r.lo + Math.random() * (r.hi - r.lo));
      const codes = level.multi ? level.harmonies.slice() : [Music.rnd(level.harmonies)];
      const parts = codes.map(code => ({ code, h: Music.harmony(code), target: Music.harmonize(ref, key, code) }));
      if (!inRange(Music.midiOf(ref), 0)) continue;
      if (!parts.every(p => inRange(Music.midiOf(p.target)))) continue;
      return { type: 'single', key, ref, parts, diatonic: !!level.diatonic || parts.some(p => p.h.kind === 'dia') };
    }
    throw new Error('Impossible de générer une question dans ta tessiture');
  }

  function makeIdentify(level) {
    const r = range();
    const id = Music.rnd(level.intervals), iv = Music.IV[id];
    const lo = r.lo + Math.floor(Math.random() * Math.max(1, r.hi - r.lo - iv.s));
    const ref = Music.spellMidi(lo, Math.random() < 0.4);
    const target = Music.transpose(ref, iv.n, iv.s, 1);
    return { type: 'identify', ref, target, id, parts: [{ code: id }] };
  }

  function makeMelody(level) {
    const r = range(), len = level.length || 4;
    for (let tries = 0; tries < 300; tries++) {
      const key = randomKey(level);
      const center = (r.lo + r.hi) / 2 + (Math.random() * 6 - 3);
      let deg = Music.rnd([0, 2, 4]);
      const degs = [deg];
      for (let i = 1; i < len; i++) {
        const x = Math.random();
        let step = x < 0.62 ? Music.rnd([-1, 1]) : x < 0.9 ? Music.rnd([-2, 2]) : x < 0.95 ? 0 : Music.rnd([-3, 3, 4]);
        if (Math.abs(deg + step) > 6) step = -step;
        deg += step; degs.push(deg);
      }
      if (len > 3 && Math.random() < 0.6) degs[len - 1] = Music.rnd([0, 2, 4, 7].filter(d => Math.abs(d - degs[len - 2]) <= 3)) ?? degs[len - 1];
      const base = degreeNote(key, 0, center - 4);
      const spb = 60 / S().tempo;
      let t = 0;
      const notes = degs.map((d, i) => {
        const n = Music.diatonicShift(base, key, d);
        const dur = (i === len - 1 ? 2 : 1) * spb;
        const o = { n, midi: Music.midiOf(n), start: t, dur }; t += dur; return o;
      });
      if (!notes.every(x => inRange(x.midi, 1))) continue;
      const codes = level.multi ? level.harmonies.slice() : [Music.rnd(level.harmonies)];
      const parts = codes.map(code => ({
        code, h: Music.harmony(code),
        targets: notes.map(x => { const n = Music.harmonize(x.n, key, code); return { n, midi: Music.midiOf(n), start: x.start, dur: x.dur }; }),
      }));
      if (!parts.every(p => p.targets.every(x => inRange(x.midi, 3)))) continue;
      return { type: 'melody', key, notes, parts, total: t };
    }
    throw new Error('Impossible de générer une mélodie dans ta tessiture');
  }

  function makeQuestion(level) {
    return level.type === 'identify' ? makeIdentify(level) : level.type === 'melody' ? makeMelody(level) : makeSingle(level);
  }

  // ---------------- Évaluation ----------------
  function diffSemis(sung, target) {
    let d = sung - target;
    if (S().octaveTol) d = ((d + 6) % 12 + 12) % 12 - 6;
    return d;
  }
  const isOk = (sung, target) => Math.abs(diffSemis(sung, target)) <= 0.5;

  // nom de l'intervalle formé entre ref et une note chantée (approx. chromatique)
  function sungInterval(refMidi, sung) {
    let s = Math.round(sung) - refMidi;
    const dir = s >= 0 ? 'au-dessus' : 'en dessous';
    s = Math.abs(s);
    const oct = Math.floor(s / 12); const simple = s % 12;
    const iv = Music.INTERVALS.find(i => i.s === simple && i.id !== '5d') || Music.IV['1J'];
    let n = simple === 0 && oct ? 'une octave' : (iv.id === '1J' ? 'l’unisson' : 'une ' + iv.name.toLowerCase());
    if (oct && simple) n += ' (+ ' + oct + ' oct.)';
    return simple === 0 && !oct ? 'l’unisson' : n + ' ' + dir;
  }

  // Enregistre la voix pendant `dur` secondes à partir de t0 (temps audio). onFrame(p) avec p.t relatif.
  // signal (AbortController) : permet d'arrêter avant la fin ; frames.aborted = true dans ce cas
  async function recordAlong(t0, dur, onFrame, signal) {
    const frames = [];
    const stop = Audio.listen(f => {
      const p = { t: f.t - t0, midi: f.midi, rms: f.rms };
      if (p.t >= -0.2) { frames.push(p); onFrame && onFrame(p); }
    });
    await new Promise(res => {
      const ms = Math.max(0, (t0 + dur + 0.25 - Audio.now()) * 1000);
      const timer = setTimeout(res, ms);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); res(); }, { once: true });
    });
    stop();
    if (signal?.aborted) frames.aborted = true;
    return frames;
  }

  // Évalue des notes cibles [{midi,start,dur}] à partir de trames [{t,midi}]
  function evalNotes(targets, frames, latency = 0.06) {
    return targets.map(tg => {
      const a = tg.start + Math.min(0.2, tg.dur * 0.25) + latency, b = tg.start + tg.dur * 0.9 + latency;
      const vals = frames.filter(f => f.t >= a && f.t <= b && f.midi != null).map(f => f.midi);
      if (vals.length < 3) return { state: 'none', sung: null };
      const sung = Audio.median(vals);
      return { state: isOk(sung, tg.midi) ? 'good' : 'bad', sung, cents: Math.round(diffSemis(sung, tg.midi) * 100) };
    });
  }

  // ---------------- Session d'exercice ----------------
  let cur = null; // { level, free, q, qi, pi, items, score, done, xp, ... }

  function start(level, opts = {}) {
    Audio.ensure();
    cur = { level, free: !!opts.free, qi: 0, pi: 0, score: 0, items: 0, xp: 0, total: 0 };
    const qs = [];
    for (let i = 0; i < level.count; i++) qs.push(makeQuestion(level));
    cur.questions = qs;
    cur.total = qs.reduce((s, q) => s + q.parts.length, 0);
    App.show('exercise');
    renderShell();
    showIntro();
  }

  function renderShell() {
    const root = $('#view-exercise'); root.innerHTML = '';
    const L = cur.level;
    root.append(
      h('div.ex-head',
        btn('← Quitter', () => { Audio.stopAll(); App.show(cur.free ? 'free' : 'levels'); }, 'ghost small'),
        h('div.ex-title', h('img', { src: L.catSrc || Game.CATS.free, alt: '' }), h('div', h('div.ex-name', L.name), h('div.ex-sub#ex-sub', ''))),
        h('div.ex-score#ex-score', '')),
      h('div.progress', h('div#ex-bar')),
      h('div#ex-body'));
    updateHead();
  }
  function updateHead() {
    $('#ex-bar').style.width = (100 * cur.items / cur.total) + '%';
    $('#ex-score').textContent = '★ ' + (Math.round(cur.score * 10) / 10) + ' / ' + cur.items;
    $('#ex-sub').textContent = 'Question ' + Math.min(cur.qi + 1, cur.questions.length) + ' / ' + cur.questions.length;
  }

  function showIntro() {
    const body = $('#ex-body'); body.innerHTML = '';
    body.append(h('div.card.intro',
      h('img.intro-cat', { src: Game.CATS.teacher, alt: '' }),
      h('div', h('h3', 'Consigne'), h('p', cur.level.intro || 'C’est parti !'),
        cur.level.type !== 'identify' ? h('p.dim', '🎧 Astuce : réponds en chantant (micro) ou avec le clavier. Dans tous les cas, tu entendras la bonne réponse.') : null,
        btn('Commencer', () => ask(), 'primary big'))));
  }

  // ---------- Affichage d'une question ----------
  function ask() {
    Audio.stopAll();
    const q = cur.questions[cur.qi];
    cur.answered = false;
    updateHead();
    const body = $('#ex-body'); body.innerHTML = '';
    if (q.type === 'identify') return askIdentify(q, body);
    if (q.type === 'melody') return askMelody(q, body);
    return askSingle(q, body);
  }

  const chip = (label, val, cls = '') => h('span.chip' + (cls ? '.' + cls : ''), h('b', label + ' '), val);

  // ======== Note seule ========
  function askSingle(q, body) {
    const part = q.parts[cur.pi];
    const refM = Music.midiOf(q.ref), tgM = Music.midiOf(part.target);
    const multiTxt = q.parts.length > 1
      ? h('p.multi', '✨ Cette note a ' + q.parts.length + ' harmonies possibles ici : ' + q.parts.map(p => p.h.label.toLowerCase()).join(', ') + '. On les fait une par une.')
      : null;
    const bubble = h('div.bubble',
      multiTxt,
      h('div.ask', q.parts.length > 1 ? h('span.pill', 'Harmonie ' + (cur.pi + 1) + '/' + q.parts.length) : null,
        ' Chante ', h('b', Music.art(part.h.label)), part.h.kind === 'dia' ? ' (dans la gamme)' : ''),
      h('div.chips',
        q.diatonic ? chip('Tonalité', Music.keyName(q.key)) : null,
        chip('Note de départ', S().showNames ? Music.name(q.ref, true) : '???')));
    const meterEl = h('div.hidden');
    const meter = new UI.Meter(meterEl);
    const fb = h('div.feedback');
    const kbEl = h('div.hidden');
    const r = range();
    const kb = new UI.Keyboard(kbEl, { lo: Math.min(r.lo, refM, tgM) - 2, hi: Math.max(r.hi, refM, tgM) + 2, onPress: m => { if (!cur.answered) answer(m, 'clavier'); } });
    kb.mark(refM, 'ref');

    const playRef = () => { Audio.stopAll(); Audio.playNote(refM, 0, 1.6, { timbre: 'piano', vol: 0.6 }); };
    let abort = null;
    const singBtn = btn('🎤 Chanter', async () => {
      if (cur.answered) return;
      if (abort) { abort.abort(); return; } // « Arrêter » marche même pendant l'ouverture du micro
      abort = new AbortController();
      const sig = abort.signal;
      singBtn.textContent = '⏹ Arrêter';
      meterEl.classList.remove('hidden'); meter.reset('Ouverture du micro…');
      let res = null;
      try {
        await Audio.openMic();
        if (!sig.aborted) {
          meter.reset('Chante et tiens la note…');
          if (S().drone) Audio.playNote(refM, 0, 8, { timbre: 'soft', vol: 0.25 });
          res = await Audio.captureStableNote({ timeout: 8000, signal: sig, onFrame: f => meter.update(f),
            onDead: () => meter.reset('Le micro s\u2019est coupé, je le relance… continue de chanter') });
        } else res = { aborted: true };
      } catch (e) { toast(e.message || 'Micro refusé', 'bad'); res = { aborted: true }; }
      Audio.stopAll(); Audio.closeMic();
      abort = null; singBtn.textContent = '🎤 Chanter';
      if (cur.answered) return;
      if (res?.aborted) { meter.reset('Arrêté. Appuie sur « Chanter » pour réessayer.'); return; }
      if (!res) { meter.reset('Je n\u2019ai pas entendu de note tenue. Rapproche-toi du micro et réessaie !'); return; }
      answer(res.midi, 'voix');
    }, 'primary');

    const actions = h('div.row.wrap',
      btn('▶ Réécouter la note', playRef),
      singBtn,
      btn('🎹 Clavier', () => kbEl.classList.toggle('hidden')),
      btn('🤷 Je ne sais pas', () => { if (!cur.answered) answer(null, 'passe'); }, 'ghost'));

    body.append(h('div.card.question', h('div.q-top', h('img.q-cat', { src: Game.CATS.listen, alt: '' }), bubble), actions, h('p.dim.small.nosound', '🔇 Pas de son ? Désactive le mode silencieux, monte le volume, ou fais le test dans ', h('a', { href: '#', onclick: e => { e.preventDefault(); Audio.stopAll(); App.show('profile'); } }, 'Profil'), '.'), meterEl, kbEl, fb));
    playRef();

    function answer(sung, how) {
      cur.answered = true;
      const ok = sung != null && isOk(sung, tgM);
      score(ok ? 1 : 0, part.code);
      kb.clear(); kb.mark(refM, 'ref'); kb.mark(tgM, 'target'); if (sung != null && !ok) kb.mark(sung, 'sung');
      kbEl.classList.remove('hidden');
      const tName = Music.name(part.target, true);
      const ivName = Music.describe(q.ref, part.target);
      const dirTxt = tgM > refM ? ' au-dessus de ' : tgM < refM ? ' en dessous de ' : ' de ';
      fb.innerHTML = '';
      const msg = [];
      if (ok) {
        const c = Math.round(diffSemis(sung, tgM) * 100);
        msg.push(h('h3', Music.rnd(['Bravo !', 'Parfait !', 'Miaou-gnifique !', 'Juste !'])),
          h('p', 'C’était bien ', h('b', tName), ' — ', ivName, dirTxt, Music.name(q.ref), '.'),
          how === 'voix' ? h('p.dim', 'Justesse : ' + (c > 0 ? '+' : '') + c + ' cents' + (Math.abs(Math.round(sung) - tgM) >= 12 ? ' (à l’octave près)' : '')) : null);
      } else {
        msg.push(h('h3', sung == null ? 'Écoute la réponse' : 'Pas tout à fait…'));
        if (sung != null) msg.push(h('p', 'Tu as ' + (how === 'voix' ? 'chanté' : 'joué') + ' ', h('b', Music.midiName(sung, true)), ' (' + sungInterval(refM, sung) + ').'));
        msg.push(h('p', 'La réponse : ', h('b', tName), ' — ', ivName, dirTxt, Music.name(q.ref), '.'));
        if (part.h.kind === 'dia') msg.push(h('p.dim', 'En ' + Music.keyName(q.key) + ', ' + Music.art(part.h.label) + ' de ' + Music.name(q.ref) + ' est une ' + ivName + '.'));
      }
      const playAnswer = async () => {
        Audio.stopAll();
        const t = Audio.now() + 0.1;
        Audio.playNote(refM, t, 0.8, { timbre: 'piano', vol: 0.6 });
        Audio.playNote(tgM, t + 0.9, 0.8, { timbre: 'flute', vol: 0.6 });
        Audio.playNote(refM, t + 1.9, 1.6, { timbre: 'piano', vol: 0.5 });
        Audio.playNote(tgM, t + 1.9, 1.6, { timbre: 'flute', vol: 0.5 });
      };
      fb.append(h('div.fb-inner' + (ok ? '.good' : '.bad'),
        h('img.fb-cat', { src: ok ? Game.CATS.success : Game.CATS.fail, alt: '' }),
        h('div', msg, h('div.row.wrap',
          btn('🔊 Réécouter la réponse', playAnswer),
          sung != null && !ok ? btn('🙉 Ce que tu as fait', () => { Audio.stopAll(); const t = Audio.now() + 0.05; Audio.playNote(refM, t, 1.4); Audio.playNote(Math.round(sung), t, 1.4, { timbre: 'flute' }); }, 'ghost') : null,
          btn('Suivant →', next, 'primary')))));
      playAnswer();
    }
  }

  // ======== Reconnaissance d'intervalle ========
  function askIdentify(q, body) {
    const refM = Music.midiOf(q.ref), tgM = Music.midiOf(q.target);
    const play = () => {
      Audio.stopAll(); const t = Audio.now() + 0.05;
      Audio.playNote(refM, t, 0.7); Audio.playNote(tgM, t + 0.8, 0.7);
      Audio.playNote(refM, t + 1.7, 1.3); Audio.playNote(tgM, t + 1.7, 1.3);
    };
    const fb = h('div.feedback');
    const choices = h('div.choices', cur.level.intervals.map(id => {
      const iv = Music.IV[id];
      const b = btn(h('span', h('b', iv.name), h('small', iv.alias)), () => {
        if (cur.answered) return;
        cur.answered = true;
        const ok = id === q.id;
        score(ok ? 1 : 0, 'id:' + q.id);
        b.classList.add(ok ? 'good' : 'bad');
        choices.querySelector('[data-id="' + q.id + '"]').classList.add('good');
        const right = Music.IV[q.id];
        fb.innerHTML = '';
        fb.append(h('div.fb-inner' + (ok ? '.good' : '.bad'), h('img.fb-cat', { src: ok ? Game.CATS.success : Game.CATS.fail, alt: '' }),
          h('div', h('h3', ok ? 'Bien entendu !' : 'C’était une ' + right.name.toLowerCase()),
            h('p', Music.name(q.ref, true) + ' → ' + Music.name(q.target, true) + ' : ' + right.name.toLowerCase() + ' (' + right.s + ' demi-tons, ' + right.alias + ').'),
            h('p.dim', '🎵 Pour s’en souvenir : ' + right.song),
            h('div.row.wrap', btn('🔊 Réécouter', play), btn('Suivant →', next, 'primary')))));
        play();
      }, 'choice');
      b.dataset.id = id; return b;
    }));
    body.append(h('div.card.question',
      h('div.q-top', h('img.q-cat', { src: Game.CATS.listen, alt: '' }), h('div.bubble', h('div.ask', 'Quel est cet intervalle ?'), h('p.dim', 'Deux notes l’une après l’autre, puis ensemble.'))),
      h('div.row', btn('▶ Réécouter', play, 'primary')), choices, fb));
    play();
  }

  // ======== Mélodie ========
  function askMelody(q, body) {
    const part = q.parts[cur.pi];
    const spb = 60 / S().tempo;
    const canvas = h('canvas.roll');
    const roll = new UI.Roll(canvas, { duration: q.total + 0.2 });
    roll.names = S().showNames;
    const melLayer = { cls: 'melody', notes: q.notes.map(n => ({ midi: n.midi, start: n.start, dur: n.dur, name: Music.name(n.n) })) };
    roll.set([melLayer]);
    const meterEl = h('div.hidden'); const meter = new UI.Meter(meterEl);
    const fb = h('div.feedback');
    const kbEl = h('div.hidden');
    const allM = q.notes.map(n => n.midi).concat(part.targets.map(t => t.midi));
    const typed = [];
    const kb = new UI.Keyboard(kbEl, { lo: Math.min(...allM) - 3, hi: Math.max(...allM) + 3, onPress: m => {
      if (cur.answered) return;
      typed.push(m);
      typedEl.textContent = 'Tes notes : ' + typed.map(x => Music.midiName(x)).join(' – ') + '  (' + typed.length + '/' + part.targets.length + ')';
      if (typed.length === part.targets.length) finish(typed.map((m2, i) => ({ state: isOk(m2, part.targets[i].midi) ? 'good' : 'bad', sung: m2 })), 'clavier');
    } });
    const typedEl = h('p.dim', 'Clique les notes de l’harmonie dans l’ordre.');
    kbEl.prepend(typedEl);

    const playMelody = () => { Audio.stopAll(); const t = Audio.now() + 0.1; Audio.playSeq(q.notes, t, { timbre: 'piano', vol: 0.6 }); roll.play(t, q.total); };

    let recAbort = null;
    const singLabel = '🎤 Chanter l\u2019harmonie';
    const singBtn = btn(singLabel, async () => {
      if (cur.answered) return;
      if (recAbort) { recAbort.abort(); return; } // bouton « Arrêter »
      recAbort = new AbortController();
      const sig = recAbort.signal;
      singBtn.textContent = '⏹ Arrêter';
      meterEl.classList.remove('hidden'); meter.reset('Ouverture du micro…');
      const done = () => { Audio.stopAll(); Audio.closeMic(); roll.stop(); recAbort = null; singBtn.textContent = singLabel; };
      try { await Audio.openMic(); } catch (e) { toast(e.message || 'Micro refusé', 'bad'); done(); meter.reset('Micro indisponible'); return; }
      if (sig.aborted) { done(); meter.reset('Arrêté'); return; }
      Audio.stopAll();
      meter.reset('Décompte…');
      const t = Audio.now() + 0.2;
      for (let i = 0; i < 4; i++) Audio.click(t + i * spb, i === 0);
      Audio.playNote(q.notes[0].midi, t, spb * 3.5, { timbre: 'soft', vol: 0.3 }); // note de repère pendant le décompte
      const t0 = t + 4 * spb;
      if (S().accomp) Audio.playSeq(q.notes, t0, { timbre: 'piano', vol: 0.35 });
      else q.notes.forEach((n, i) => Audio.click(t0 + n.start, false));
      roll.trace = []; roll.play(t0, q.total);
      const frames = await recordAlong(t0, q.total, p => { meter.update(p); if (p.t >= 0) { roll.trace.push(p); } }, sig);
      done();
      if (cur.answered) return;
      if (frames.aborted) { roll.trace = []; roll.draw(); meter.reset('Arrêté. Appuie sur « Chanter » pour réessayer.'); return; }
      finish(evalNotes(part.targets, frames), 'voix');
    }, 'primary');

    let hinted = false;
    const bubble = h('div.bubble',
      q.parts.length > 1 ? h('p.multi', '✨ Plusieurs harmonies à faire sur cette mélodie : ' + q.parts.map(p => p.h.label.toLowerCase()).join(', ') + '.') : null,
      h('div.ask', q.parts.length > 1 ? h('span.pill', 'Harmonie ' + (cur.pi + 1) + '/' + q.parts.length) : null, ' Chante la mélodie : ', h('b', part.h.label.toLowerCase())),
      h('p.dim', part.h.desc),
      h('div.chips', chip('Tonalité', Music.keyName(q.key)), chip('Tempo', S().tempo + ' bpm'),
        chip('Accompagnement', S().accomp ? 'mélodie jouée pendant que tu chantes (casque conseillé)' : 'clics seulement')));
    body.append(h('div.card.question', h('div.q-top', h('img.q-cat', { src: Game.CATS.sing, alt: '' }), bubble), canvas,
      h('div.row.wrap', btn('▶ Écouter la mélodie', playMelody), singBtn,
        btn('💡 1re note', () => { hinted = true; Audio.stopAll(); Audio.playNote(part.targets[0].midi, 0, 1.2, { timbre: 'flute', vol: 0.6 }); toast('1re note : ' + Music.name(part.targets[0].n, true)); }, 'ghost'),
        btn('🎹 Clavier', () => kbEl.classList.toggle('hidden')),
        btn('🤷 Montrer la réponse', () => { if (!cur.answered) finish(part.targets.map(() => ({ state: 'none', sung: null })), 'passe'); }, 'ghost')),
      meterEl, kbEl, fb));
    playMelody();

    function finish(results, how) {
      cur.answered = true;
      const good = results.filter(r => r.state === 'good').length;
      let ratio = good / results.length;
      if (hinted) ratio *= 0.8;
      score(ratio, part.code, ratio >= 0.75);
      const harmLayer = { cls: 'harmony', notes: part.targets.map((t, i) => ({ midi: t.midi, start: t.start, dur: t.dur, name: Music.name(t.n), state: results[i].state })) };
      roll.set([{ ...melLayer, ghost: true }, harmLayer]);
      const playBoth = () => { Audio.stopAll(); const t = Audio.now() + 0.1; Audio.playSeq(q.notes, t, { timbre: 'piano', vol: 0.5 }); Audio.playSeq(part.targets, t, { timbre: 'flute', vol: 0.55 }); roll.play(t, q.total); };
      const playHarm = () => { Audio.stopAll(); const t = Audio.now() + 0.1; Audio.playSeq(part.targets, t, { timbre: 'flute', vol: 0.6 }); roll.play(t, q.total); };
      const ok = ratio >= 0.75;
      const detail = part.targets.map((t, i) => {
        const r = results[i];
        return h('span.nt.' + r.state, Music.name(t.n) + (r.state === 'bad' && r.sung != null ? ' (' + Music.midiName(r.sung) + ')' : r.state === 'none' && how === 'voix' ? ' (?)' : ''));
      });
      const intervals = part.h.kind === 'dia' ? h('p.dim', 'Intervalles : ' + q.notes.map((n, i) => Music.describe(n.n, part.targets[i].n).split(' (')[0]).join(' · ')) : null;
      fb.innerHTML = '';
      fb.append(h('div.fb-inner' + (ok ? '.good' : '.bad'), h('img.fb-cat', { src: ok ? Game.CATS.success : Game.CATS.fail, alt: '' }),
        h('div', h('h3', how === 'passe' ? 'Voici la réponse' : ok ? 'Belle harmonie ! ' + good + '/' + results.length : good + '/' + results.length + ' notes justes'),
          h('p', 'Harmonie : ', detail), intervals,
          how === 'voix' && results.some(r => r.state === 'none') ? h('p.dim', '(?) = pas assez de son détecté sur cette note.') : null,
          h('div.row.wrap', btn('🔊 Mélodie + harmonie', playBoth), btn('🎶 Harmonie seule', playHarm), btn('Suivant →', next, 'primary')))));
      kbEl.classList.add('hidden');
      playBoth();
    }
  }

  // ---------- Score & enchaînement ----------
  function score(v, statKey, okOverride) {
    cur.items++;
    cur.score += v;
    Game.recordStat(statKey, okOverride ?? v >= 1);
    const gain = v * (cur.free ? 5 : 10 + 2 * cur.level.index);
    cur.xp += gain;
    updateHead();
  }

  function next() {
    Audio.stopAll();
    const q = cur.questions[cur.qi];
    if (cur.pi + 1 < q.parts.length) { cur.pi++; return ask(); }
    cur.pi = 0; cur.qi++;
    if (cur.qi < cur.questions.length) return ask();
    end();
  }

  async function end() {
    const ratio = cur.score / cur.total;
    const body = $('#ex-body'); body.innerHTML = '';
    let res = { stars: 0, newCat: null };
    if (!cur.free) res = Game.finishLevel(cur.level.id, ratio);
    const bonus = cur.free ? 0 : res.stars * 15;
    const promo = Game.addXp(cur.xp + bonus);
    const stars = h('div.stars.big', [0, 1, 2].map(i => h('span' + (i < res.stars ? '.on' : ''), '★')));
    const nextL = !cur.free && Game.LEVELS[cur.level.index + 1];
    body.append(h('div.card.results',
      h('img.res-cat', { src: ratio >= 0.5 ? Game.CATS.success : Game.CATS.think, alt: '' }),
      h('h2', ratio >= 0.9 ? 'Incroyable !' : ratio >= 0.75 ? 'Très bien !' : ratio >= 0.5 ? 'Niveau réussi !' : 'Encore un petit effort…'),
      cur.free ? null : stars,
      h('p', 'Score : ' + Math.round(ratio * 100) + ' % — +' + Math.round(cur.xp + bonus) + ' XP'),
      !cur.free && ratio < 0.5 ? h('p.dim', 'Il faut au moins 50 % (1 étoile) pour débloquer le niveau suivant.') : null,
      res.newCat ? h('div.newcat', h('img', { src: res.newCat, alt: '' }), h('p', 'Nouveau chat débloqué dans ta collection !')) : null,
      h('div.row.center.wrap',
        btn('↻ Rejouer', () => start(cur.level, { free: cur.free })),
        nextL && Game.unlocked(nextL) ? btn('Niveau suivant →', () => start(nextL), 'primary') : null,
        btn(cur.free ? 'Retour' : 'Carte des niveaux', () => App.show(cur.free ? 'free' : 'levels'), 'ghost'))));
    App.refreshHeader();
    if (promo) App.rankUp(promo);
  }

  return { start, makeQuestion, evalNotes, recordAlong, isOk, diffSemis };
})();
