// ============================================================
//  MofuMusic — composants d'interface : helpers, clavier, rouleau, jauge de justesse
// ============================================================
'use strict';

const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // h('div.card#id', {onclick, style}, enfants…)
  function h(tag, attrs, ...kids) {
    const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const e = document.createElement(m[1] || 'div');
    (m[2].match(/[.#][\w-]+/g) || []).forEach(p => p[0] === '.' ? e.classList.add(p.slice(1)) : (e.id = p.slice(1)));
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    const add = k => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else e.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return e;
  }
  const btn = (label, onclick, cls = '') => h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { onclick, type: 'button' }, label);

  function toast(msg, type = '') {
    const t = h('div.toast' + (type ? '.' + type : ''), msg);
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  function modal({ title, body, cat, buttons = [{ label: 'OK' }] }) {
    return new Promise(res => {
      const close = v => { bg.remove(); res(v); };
      const bg = h('div.modal-bg', h('div.modal',
        cat ? h('img.modal-cat', { src: cat, alt: '' }) : null,
        title ? h('h2', title) : null,
        typeof body === 'string' ? h('div', { html: body }) : body,
        h('div.row.center', buttons.map(b => btn(b.label, () => close(b.value ?? b.label), b.cls || 'primary')))));
      document.body.appendChild(bg);
    });
  }

  // ---------------- Clavier de piano ----------------
  class Keyboard {
    constructor(root, { lo = 48, hi = 72, onPress, labels = true } = {}) {
      this.root = root; this.onPress = onPress; this.lo = lo; this.hi = hi; this.labels = labels;
      this.render();
    }
    render() {
      const r = this.root; r.innerHTML = ''; r.classList.add('keyboard');
      // commencer / finir sur des touches blanches
      let lo = this.lo, hi = this.hi;
      while ([1, 3, 6, 8, 10].includes(lo % 12)) lo--;
      while ([1, 3, 6, 8, 10].includes(hi % 12)) hi++;
      const whites = []; for (let m = lo; m <= hi; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
      const W = 100 / whites.length;
      this.keys = {};
      whites.forEach((m, i) => {
        const k = h('div.key.white', { style: { left: i * W + '%', width: W + '%' }, 'data-m': m },
          this.labels ? h('span', Music.midiName(m, m % 12 === 0)) : null);
        this.bind(k, m); r.appendChild(k); this.keys[m] = k;
      });
      whites.forEach((m, i) => {
        const b = m + 1;
        if ([1, 3, 6, 8, 10].includes(b % 12) && b <= hi) {
          const k = h('div.key.black', { style: { left: (i + 1) * W - W * 0.3 + '%', width: W * 0.6 + '%' }, 'data-m': b });
          this.bind(k, b); r.appendChild(k); this.keys[b] = k;
        }
      });
    }
    bind(k, m) {
      k.addEventListener('pointerdown', e => {
        e.preventDefault();
        Audio.playNote(m, 0, 0.6, { timbre: 'piano', vol: 0.55 });
        this.flash(m, 'pressed');
        this.onPress && this.onPress(m);
      });
    }
    flash(m, cls, ms = 350) { const k = this.keys[m]; if (!k) return; k.classList.add(cls); setTimeout(() => k.classList.remove(cls), ms); }
    mark(m, cls) { const k = this.keys[Math.round(m)]; if (k) k.classList.add(cls); }
    clear() { Object.values(this.keys).forEach(k => k.classList.remove('good', 'bad', 'ref', 'target', 'sung')); }
  }

  // ---------------- Jauge de justesse ----------------
  class Meter {
    constructor(root) {
      this.root = root; root.classList.add('meter');
      root.innerHTML = '';
      this.note = h('div.meter-note', '—');
      this.cents = h('div.meter-cents', 'Chante…');
      this.needle = h('div.meter-needle');
      this.scale = h('div.meter-scale', h('div.meter-zone'), this.needle, h('span.l', '-50'), h('span.c', '0'), h('span.r', '+50'));
      this.level = h('div.meter-level', h('div'));
      root.append(this.note, this.scale, this.cents, this.level);
    }
    update(f) {
      this.level.firstChild.style.width = Math.min(100, (f.rms || 0) * 900) + '%';
      if (f.midi == null) { this.root.classList.add('idle'); return; }
      this.root.classList.remove('idle');
      const r = Math.round(f.midi), c = Math.round((f.midi - r) * 100);
      this.note.textContent = Music.midiName(r, true);
      this.cents.textContent = (c > 0 ? '+' : '') + c + ' cents';
      this.needle.style.left = (50 + c) + '%';
      this.root.classList.toggle('intune', Math.abs(c) <= 15);
    }
    reset(txt = 'Chante…') { this.note.textContent = '—'; this.cents.textContent = txt; this.needle.style.left = '50%'; }
  }

  // ---------------- Rouleau (piano roll) ----------------
  // layers : [{ notes:[{midi,start,dur,name?,state?}], cls:'melody'|'harmony'|'user', label }]
  class Roll {
    constructor(canvas, { duration = 4 } = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.layers = []; this.trace = []; this.cursor = null; this.duration = duration; this.names = true;
      this.selected = -1; this.onClickNote = null;
      this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(canvas);
      canvas.addEventListener('click', e => this.click(e));
    }
    set(layers, duration) { this.layers = layers; if (duration) this.duration = duration; this.draw(); }
    range() {
      let lo = 127, hi = 0;
      this.layers.forEach(L => L.notes.forEach(n => { if (n.midi != null) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); } }));
      if (lo > hi) { lo = 55; hi = 67; }
      lo -= 3; hi += 3;
      if (hi - lo < 14) { const m = (hi + lo) / 2; lo = Math.floor(m - 7); hi = Math.ceil(m + 7); }
      return [lo, hi];
    }
    geom() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.c.clientWidth, hgt = this.c.clientHeight;
      if (this.c.width !== Math.round(w * dpr)) { this.c.width = Math.round(w * dpr); this.c.height = Math.round(hgt * dpr); }
      const [lo, hi] = this.range();
      const padL = 44;
      return { dpr, w, h: hgt, lo, hi, padL, x: t => padL + (t / this.duration) * (w - padL - 8), y: m => hgt - ((m - lo) / (hi - lo)) * hgt, rowH: hgt / (hi - lo) };
    }
    draw() {
      const g = this.geom(); if (!g.w) return;
      const c = this.ctx; c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      const css = getComputedStyle(document.documentElement);
      const col = v => css.getPropertyValue(v).trim();
      c.clearRect(0, 0, g.w, g.h);
      // lignes de hauteur
      c.font = '10px Nunito, sans-serif'; c.textBaseline = 'middle';
      for (let m = Math.ceil(g.lo); m <= g.hi; m++) {
        const y = g.y(m + 0.5), black = [1, 3, 6, 8, 10].includes(m % 12);
        c.fillStyle = black ? col('--roll-black') : col('--roll-white');
        c.fillRect(g.padL, y, g.w - g.padL, g.rowH);
        if (!black) { c.fillStyle = col('--text-dim'); c.fillText(Music.midiName(m, m % 12 === 0 || m % 12 === 7 ? true : false), 4, g.y(m)); }
      }
      // temps
      c.strokeStyle = col('--line'); c.lineWidth = 1;
      for (let t = 0; t <= this.duration; t += this.duration > 20 ? 5 : 1) { const x = g.x(t); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, g.h); c.stroke(); }
      // notes
      this.hit = [];
      this.layers.forEach((L, li) => L.notes.forEach((n, i) => {
        if (n.midi == null) return;
        const x = g.x(n.start), w = Math.max(3, g.x(n.start + n.dur) - x - 2), y = g.y(n.midi + 0.5) + 1, hh = Math.max(4, g.rowH - 2);
        let fill = col(L.cls === 'harmony' ? '--harmony' : L.cls === 'user' ? '--user' : '--melody');
        if (n.state === 'good') fill = col('--good'); if (n.state === 'bad') fill = col('--bad'); if (n.state === 'none') fill = col('--text-dim');
        c.globalAlpha = L.ghost ? 0.35 : 1;
        c.fillStyle = fill; roundRect(c, x, y, w, hh, Math.min(5, hh / 2)); c.fill();
        if (li === 0 && i === this.selected) { c.strokeStyle = col('--text'); c.lineWidth = 2; c.stroke(); }
        if (this.names && w > 18 && hh > 9) {
          c.fillStyle = '#231c2b'; c.font = 'bold ' + Math.min(12, hh - 1) + 'px Nunito, sans-serif';
          c.fillText(n.name || Music.midiName(n.midi), x + 4, y + hh / 2);
        }
        c.globalAlpha = 1;
        if (li === 0) this.hit.push({ i, x, y, w, h: hh });
      }));
      // courbe chantée
      c.fillStyle = col('--trace'); c.globalAlpha = 0.6;
      this.trace.forEach(p => { if (p.midi != null && p.t >= 0 && p.t <= this.duration) { c.beginPath(); c.arc(g.x(p.t), g.y(p.midi), 2.2, 0, 7); c.fill(); } });
      c.globalAlpha = 1;
      if (this.cursor != null) { c.strokeStyle = col('--accent'); c.lineWidth = 2; const x = g.x(this.cursor); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, g.h); c.stroke(); }
    }
    click(e) {
      if (!this.onClickNote || !this.hit) return;
      const r = this.c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const n = this.hit.find(b => x >= b.x && x <= b.x + b.w && y >= b.y - 3 && y <= b.y + b.h + 3);
      this.onClickNote(n ? n.i : -1);
    }
    // anime un curseur de t0 (temps audio) pendant dur secondes
    play(t0, dur) {
      const id = (this._anim = Symbol());
      const step = () => {
        if (this._anim !== id) return;
        const t = Audio.now() - t0;
        this.cursor = t; this.draw();
        if (t < dur) requestAnimationFrame(step); else { this.cursor = null; this.draw(); }
      };
      requestAnimationFrame(step);
    }
    stop() { this._anim = null; this.cursor = null; this.draw(); }
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  return { $, $$, h, btn, toast, modal, Keyboard, Meter, Roll };
})();
