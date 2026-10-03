// ============================================================
//  MofuMusic — audio : synthé, métronome, micro & détection de hauteur (YIN)
// ============================================================
'use strict';

const Audio = (() => {
  let ctx = null, master = null, comp = null;
  let volume = 0.8;
  const active = new Set(); // sources en cours (pour tout arrêter)

  // Création / réveil du contexte audio. Sur téléphone, le contexte peut être
  // « suspended » ou « interrupted » (appel, écouteurs branchés…) : on le relance.
  function build(sampleRate) {
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = sampleRate ? new AC({ sampleRate, latencyHint: 'interactive' }) : new AC({ latencyHint: 'interactive' }); }
    catch (e) { ctx = new AC(); }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = volume;
    master.connect(comp); comp.connect(ctx.destination);
    ctx.onstatechange = () => { if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); };
  }
  function ensure() {
    if (!ctx || ctx.state === 'closed') build();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  // Jette le contexte (ex. écouteurs branchés/débranchés) : le prochain son en recrée un propre
  function rebuild() {
    stopAll(); closeMic();
    if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } }
    ctx = null;
  }

  // ----- Session audio (iPhone) -----
  // Sans ça, Safari coupe les sons quand le téléphone est en mode silencieux,
  // et envoie le son dans l'écouteur du haut (très faible) quand le micro est ouvert.
  function setSession(type) {
    try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* non supporté */ }
  }
  let silentEl = null;
  function unlock() {
    ensure();
    if (!mic) setSession('playback');
    // son muet (bascule iOS en catégorie « lecture », qui ignore le bouton silencieux)
    try {
      const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (e) { /* ignore */ }
    if (!silentEl && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
      silentEl = document.createElement('audio');
      silentEl.setAttribute('x-webkit-airplay', 'deny'); silentEl.preload = 'auto'; silentEl.loop = true;
      silentEl.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';
      silentEl.play().catch(() => {});
    }
  }

  const now = () => ensure().currentTime;
  function setVolume(v) { volume = v; if (master) master.gain.value = v; }

  function track(node, stopAt) {
    active.add(node);
    node.onended = () => active.delete(node);
    return node;
  }
  function stopAll() {
    active.forEach(n => { try { n.stop(); } catch (e) { /* déjà arrêté */ } });
    active.clear();
  }

  // Timbres : 'piano' (référence), 'flute' (réponse / harmonie), 'soft' (accompagnement)
  const TIMBRES = {
    piano: { partials: [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine'], [4, 0.05, 'sine']], a: 0.008, d: 0.5, s: 0.35, r: 0.35, lp: 3200, vib: 0 },
    flute: { partials: [[1, 1, 'sine'], [2, 0.18, 'sine'], [3, 0.06, 'triangle']], a: 0.06, d: 0.15, s: 0.85, r: 0.18, lp: 2600, vib: 5 },
    soft: { partials: [[1, 1, 'sine'], [2, 0.2, 'triangle']], a: 0.03, d: 0.3, s: 0.5, r: 0.3, lp: 1500, vib: 0 },
  };

  // Joue une note MIDI à l'instant `when` (temps AudioContext)
  function playNote(midi, when = 0, dur = 1, opts = {}) {
    ensure();
    const t = Math.max(when || 0, ctx.currentTime + 0.01);
    const tb = TIMBRES[opts.timbre || 'piano'];
    const vel = (opts.vol ?? 0.5) * 0.45;
    const f = Music.freqOf(midi);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = tb.lp;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + tb.a);
    g.gain.exponentialRampToValueAtTime(Math.max(vel * tb.s, 0.0002), t + tb.a + tb.d);
    const end = t + Math.max(dur, tb.a + 0.02);
    g.gain.setValueAtTime(Math.max(vel * tb.s, 0.0002), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + tb.r);
    g.connect(lp); lp.connect(opts.dest || master);
    let lfo = null;
    if (tb.vib) {
      lfo = ctx.createOscillator(); lfo.frequency.value = tb.vib;
      lfo.start(t + 0.25); lfo.stop(end + tb.r + 0.05);
      track(lfo);
    }
    tb.partials.forEach(([mult, amp, type]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult;
      if (lfo) { const lg = ctx.createGain(); lg.gain.value = f * mult * 0.004; lfo.connect(lg); lg.connect(o.frequency); }
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(end + tb.r + 0.05);
      track(o);
    });
    return end + tb.r;
  }

  // Joue une suite [{midi, start, dur}] (start relatif) ; renvoie l'instant de fin
  function playSeq(notes, when, opts = {}) {
    ensure();
    const t0 = Math.max(when || 0, ctx.currentTime + 0.05);
    let end = t0;
    notes.forEach(n => { if (n.midi != null) end = Math.max(end, playNote(n.midi, t0 + n.start, n.dur * (opts.legato ?? 0.92), opts)); });
    return end;
  }

  function click(when, accent = false) {
    ensure();
    const t = Math.max(when, ctx.currentTime + 0.005);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1600 : 1100;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.08); track(o);
  }

  // Joue un AudioBuffer (chanson importée) de offset à offset+dur
  function playBuffer(buf, when, offset = 0, dur, vol = 0.9) {
    ensure();
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(master);
    const t = Math.max(when || 0, ctx.currentTime + 0.03);
    src.start(t, offset, dur);
    track(src);
    return { src, start: t, end: t + (dur ?? buf.duration - offset) };
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const waitUntil = t => wait(Math.max(0, (t - now()) * 1000));

  // ---------------- Détection de hauteur (YIN) ----------------
  function yin(buf, sr, minF = 65, maxF = 1100, thresh = 0.15) {
    const W = Math.floor(buf.length / 2);
    const tauMin = Math.floor(sr / maxF), tauMax = Math.min(Math.floor(sr / minF), W - 1);
    const d = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
      d[tau] = s;
    }
    // différence moyenne cumulée normalisée
    let run = 0; d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < thresh) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) return null;
    // interpolation parabolique
    const x0 = d[tau - 1] ?? d[tau], x2 = d[tau + 1] ?? d[tau];
    const denom = x0 + x2 - 2 * d[tau];
    const better = denom ? tau + (x0 - x2) / (2 * denom) : tau;
    return { freq: sr / better, clarity: 1 - d[tau] };
  }

  // ---------------- Micro ----------------
  // Le micro n'est ouvert que pendant l'enregistrement, puis refermé : sinon le
  // téléphone reste en mode « appel » et le son sort tout bas (ou plus du tout).
  let mic = null; // { stream, src, an, buf, hp }
  let opening = false;
  async function openMic() {
    opening = true;
    try { return await openMicInner(); } finally { setTimeout(() => { opening = false; }, 1500); }
  }
  async function openMicInner() {
    if (mic && mic.stream.getAudioTracks().some(t => t.readyState === 'live')) { ensure(); return mic; }
    mic = null;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Micro non disponible (il faut ouvrir l\u2019app en https ou sur localhost).');
    setSession('play-and-record');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      setSession('playback');
      if (e && e.name === 'NotAllowedError') throw new Error('Accès au micro refusé : autorise-le dans les réglages du navigateur.');
      if (e && e.name === 'NotFoundError') throw new Error('Aucun micro trouvé.');
      // certains téléphones refusent ces options : on réessaie avec les réglages par défaut
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    // Si la fréquence du micro diffère de celle du contexte (fréquent avec des écouteurs
    // filaires sur iPhone), on recrée le contexte à la bonne fréquence, sinon : silence.
    const rate = stream.getAudioTracks()[0]?.getSettings?.().sampleRate;
    if (ctx && rate && Math.abs(ctx.sampleRate - rate) > 1) { stopAll(); try { ctx.close(); } catch (e) { /* ignore */ } ctx = null; build(rate); }
    ensure();
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60;
    const an = ctx.createAnalyser(); an.fftSize = 2048;
    src.connect(hp); hp.connect(an);
    mic = { stream, src, an, hp, buf: new Float32Array(an.fftSize) };
    // laisser le temps au téléphone de basculer de mode audio
    await wait(150);
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
    return mic;
  }
  function closeMic() {
    if (!mic) return;
    try { mic.src.disconnect(); } catch (e) { /* ignore */ }
    mic.stream.getTracks().forEach(t => t.stop());
    mic = null;
    setSession('playback');
  }

  // Écouteurs branchés / débranchés : on repart sur un contexte audio neuf
  if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
    // (ignoré pendant un enregistrement : certains navigateurs le déclenchent à l'ouverture du micro)
    navigator.mediaDevices.addEventListener('devicechange', () => { if (!mic && !opening) rebuild(); });
  }

  // Infos pour le diagnostic (Profil)
  function info() {
    return ctx ? { state: ctx.state, rate: ctx.sampleRate, mic: !!mic, session: navigator.audioSession?.type || 'n/a' } : { state: 'non créé', rate: 0, mic: !!mic, session: navigator.audioSession?.type || 'n/a' };
  }

  // Lecture d'une trame : { t, midi (float) | null, rms }
  function readPitch() {
    if (!mic) return null;
    mic.an.getFloatTimeDomainData(mic.buf);
    let s = 0; for (let i = 0; i < mic.buf.length; i++) s += mic.buf[i] * mic.buf[i];
    const rms = Math.sqrt(s / mic.buf.length);
    const t = ctx.currentTime;
    if (rms < 0.004) return { t, midi: null, rms };
    const r = yin(mic.buf, ctx.sampleRate, 70, 1100, 0.12);
    if (!r || r.clarity < 0.82) return { t, midi: null, rms };
    return { t, midi: Music.midiFromFreq(r.freq), rms };
  }

  // Écoute continue : appelle onFrame(frame) toutes les ~30 ms jusqu'à stop()
  function listen(onFrame) {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const f = readPitch(); if (f) onFrame(f);
      setTimeout(loop, 25);
    };
    loop();
    return () => { alive = false; };
  }

  // Attend une note tenue stable. Renvoie { midi } (float, médiane) ou null si délai dépassé.
  function captureStableNote({ timeout = 7000, holdMs = 450, onFrame, signal } = {}) {
    return new Promise(resolve => {
      const frames = [];
      const t0 = performance.now();
      let done = false;
      const stop = listen(f => {
        if (done) return;
        onFrame && onFrame(f);
        if (signal?.aborted) { finish(null); return; }
        if (f.midi != null) frames.push({ tm: performance.now(), m: f.midi });
        else if (frames.length && performance.now() - frames[frames.length - 1].tm > 150) frames.length = 0;
        // fenêtre récente
        const nowMs = performance.now();
        const recent = frames.filter(x => nowMs - x.tm <= holdMs);
        if (recent.length >= Math.max(6, holdMs / 50)) {
          const med = median(recent.map(x => x.m));
          if (recent.every(x => Math.abs(x.m - med) < 0.6)) { finish({ midi: med }); return; }
        }
        if (nowMs - t0 > timeout) finish(null);
      });
      function finish(v) { done = true; stop(); resolve(v); }
    });
  }

  function median(a) {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // ---------------- Analyse hors-ligne d'un fichier audio ----------------
  async function decodeFile(file) {
    ensure();
    const ab = await file.arrayBuffer();
    return await ctx.decodeAudioData(ab);
  }

  // Rend une portion en mono 16 kHz filtrée (voix)
  async function renderForPitch(buf, offset, dur) {
    const sr = 16000;
    const len = Math.ceil(dur * sr);
    const oc = new OfflineAudioContext(1, len, sr);
    const src = oc.createBufferSource(); src.buffer = buf;
    const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    src.connect(hp); hp.connect(lp); lp.connect(oc.destination);
    src.start(0, offset, dur);
    const out = await oc.startRendering();
    return { data: out.getChannelData(0), sr };
  }

  // Suivi de hauteur sur une portion ; onProgress(0..1). Renvoie [{t, midi|null}]
  async function pitchTrack(buf, offset, dur, onProgress) {
    const { data, sr } = await renderForPitch(buf, offset, dur);
    const win = 1024, hop = 160; // 10 ms
    const frames = [];
    let gmax = 0; for (let i = 0; i < data.length; i += 64) gmax = Math.max(gmax, Math.abs(data[i]));
    const gate = gmax * 0.06;
    const w = new Float32Array(win);
    for (let i = 0, k = 0; i + win < data.length; i += hop, k++) {
      w.set(data.subarray(i, i + win));
      let s = 0; for (let j = 0; j < win; j++) s += w[j] * w[j];
      const rms = Math.sqrt(s / win);
      let midi = null;
      if (rms > gate) {
        const r = yin(w, sr, 75, 1000, 0.2);
        if (r && r.clarity > 0.75) midi = Music.midiFromFreq(r.freq);
      }
      frames.push({ t: i / sr + win / 2 / sr, midi });
      if (k % 200 === 0) { onProgress && onProgress(i / data.length); await wait(0); }
    }
    return frames;
  }

  // Transforme une courbe de hauteur en notes [{midi, start, dur}]
  function framesToNotes(frames, minDur = 0.11) {
    // lissage médian
    const m = frames.map((f, i) => {
      const win = frames.slice(Math.max(0, i - 3), i + 4).map(x => x.midi).filter(x => x != null);
      return f.midi == null || win.length < 3 ? null : median(win);
    });
    // correction des sauts d'octave isolés
    const notes = [];
    let cur = null;
    for (let i = 0; i < frames.length; i++) {
      const v = m[i], t = frames[i].t;
      const r = v == null ? null : Math.round(v);
      if (cur && r != null && Math.abs(v - cur.ref) < 0.7) { cur.vals.push(v); cur.end = t; continue; }
      if (cur && r == null && t - cur.end < 0.05) continue;
      if (cur) { notes.push(cur); cur = null; }
      if (r != null) cur = { ref: v, vals: [v], start: t, end: t };
    }
    if (cur) notes.push(cur);
    let out = notes.map(n => ({ midi: Math.round(median(n.vals)), start: n.start, dur: n.end - n.start + 0.01 }))
      .filter(n => n.dur >= minDur);
    // fusion des notes identiques très proches
    const merged = [];
    out.forEach(n => {
      const p = merged[merged.length - 1];
      if (p && p.midi === n.midi && n.start - (p.start + p.dur) < 0.09) p.dur = n.start + n.dur - p.start;
      else merged.push(n);
    });
    return merged;
  }

  return {
    ensure, now, setVolume, stopAll, playNote, playSeq, click, playBuffer, wait, waitUntil,
    unlock, rebuild, info, openMic, closeMic, readPitch, listen, captureStableNote, median, yin,
    decodeFile, pitchTrack, framesToNotes, get ctx() { return ctx; }, get micOpen() { return !!mic; },
  };
})();
