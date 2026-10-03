// ============================================================
//  MofuMusic — progression : chats, rangs, niveaux, sauvegarde
// ============================================================
'use strict';

const Game = (() => {
  const CAT = f => 'assets/cats/' + f + '.png';

  // Chats utilisés par l'interface
  const CATS = {
    logo: CAT('music00_01'), teacher: CAT('sheet3_02'), songs: CAT('music13_01'), duo: CAT('music12_01'),
    band: CAT('music09_01'), success: CAT('sheet2_16'), fail: CAT('sheet2_06'), listen: CAT('sheet2_03'),
    sing: CAT('sheet2_01'), free: CAT('music05_01'), profile: CAT('sheet3_08'), sleepy: CAT('sheet1_12'),
    think: CAT('sheet1_08'), piano: CAT('music06_01'), rankup: CAT('music10_01'),
  };
  // Chats « à collectionner » : tous les autres, débloqués au fil des niveaux
  const ALL_CATS = [
    'sheet1_01', 'sheet1_02', 'sheet1_03', 'sheet1_04', 'sheet1_05', 'sheet1_06', 'sheet1_08', 'sheet1_09', 'sheet1_10a', 'sheet1_10b',
    'sheet1_11', 'sheet1_12', 'sheet1_13', 'sheet1_14', 'sheet1_15', 'sheet1_16', 'sheet1_17', 'sheet1_18', 'sheet1_20', 'sheet1_21',
    'sheet1_22a', 'sheet1_22b', 'sheet1_23', 'sheet1_24', 'sheet1_25a', 'sheet1_25b',
    'sheet2_01', 'sheet2_02', 'sheet2_03', 'sheet2_04', 'sheet2_05', 'sheet2_06', 'sheet2_07', 'sheet2_09', 'sheet2_10', 'sheet2_11',
    'sheet2_12', 'sheet2_13', 'sheet2_15', 'sheet2_16', 'sheet2_17',
    'sheet3_01', 'sheet3_02', 'sheet3_03', 'sheet3_04', 'sheet3_05', 'sheet3_06', 'sheet3_07', 'sheet3_08', 'sheet3_09',
    'music00_01', 'music01_01', 'music02_01', 'music03_01', 'music04_01', 'music05_01', 'music06_01', 'music07_01', 'music08_01',
    'music09_01', 'music10_01', 'music12_01', 'music13_01',
  ].map(CAT);

  // ---------------- Rangs ----------------
  const RANKS = [
    { xp: 0, name: 'Chaton endormi', cat: CAT('sheet1_12'), text: 'Tu ouvres à peine un œil… mais l’oreille est déjà là.' },
    { xp: 150, name: 'Chaton miauleur', cat: CAT('sheet2_01'), text: 'Premiers miaulements justes !' },
    { xp: 400, name: 'Écolier du solfège', cat: CAT('sheet3_09'), text: 'Cartable sur le dos, tu révises tes intervalles.' },
    { xp: 800, name: 'Percussionniste en boîte', cat: CAT('music01_01'), text: 'Le rythme, ça te connaît.' },
    { xp: 1400, name: 'Choriste à moustaches', cat: CAT('music04_01'), text: 'Tu tiens ta voix face à la mélodie.' },
    { xp: 2200, name: 'Guitariste des toits', cat: CAT('music03_01'), text: 'Tierces, sixtes… plus rien ne te fait peur.' },
    { xp: 3300, name: 'Chef de chœur', cat: CAT('sheet3_02'), text: 'Baguette en main, tu diriges les harmonies.' },
    { xp: 4800, name: 'Rockstar Mofu', cat: CAT('music10_01'), text: 'Tu harmonises des chansons entières.' },
    { xp: 7000, name: 'Légende Mofusand', cat: CAT('music09_01'), text: 'Tout le groupe chante avec toi !' },
  ];
  function rankOf(xp) {
    let i = 0; RANKS.forEach((r, k) => { if (xp >= r.xp) i = k; });
    const r = RANKS[i], next = RANKS[i + 1];
    return { index: i, ...r, next, progress: next ? (xp - r.xp) / (next.xp - r.xp) : 1 };
  }

  // ---------------- Niveaux ----------------
  // type : 'single' (une note -> chanter l'harmonie), 'identify' (reconnaître l'intervalle), 'melody'
  // Pour 'single'/'melody' : harmonies = codes (voir Music.harmony) ; multi = poser TOUTES les harmonies sur la même note/mélodie
  const LEVELS = [
    { id: 'l1', chapter: 1, name: 'Échauffement : l’unisson', cat: 'sheet2_03', type: 'single', harmonies: ['c:1J:+1'], count: 6,
      intro: 'Écoute la note et chante exactement la même. C’est aussi l’occasion de vérifier que le micro t’entend bien.' },
    { id: 'l2', chapter: 1, name: 'Reconnaître : tierce, quinte, octave', cat: 'sheet1_05', type: 'identify', intervals: ['3m', '3M', '5J', '8J'], count: 8,
      intro: 'Avant de chanter, on apprend à reconnaître. Écoute l’intervalle et donne son nom.' },
    { id: 'l3', chapter: 1, name: 'La quinte juste', cat: 'music01_01', type: 'single', harmonies: ['c:5J:+1'], count: 8,
      intro: 'La quinte juste (3 tons ½) : Do → Sol. Pense au début de Star Wars.' },
    { id: 'l4', chapter: 1, name: 'La tierce majeure', cat: 'sheet2_05', type: 'single', harmonies: ['c:3M:+1'], count: 8,
      intro: 'La tierce majeure (2 tons) : Do → Mi. Lumineuse, c’est la base des harmonies pop.' },
    { id: 'l5', chapter: 1, name: 'La tierce mineure', cat: 'sheet2_12', type: 'single', harmonies: ['c:3m:+1'], count: 8,
      intro: 'La tierce mineure (1 ton ½) : Do → Mi♭. Plus douce, plus mélancolique.' },

    { id: 'l6', chapter: 2, name: 'Tierce majeure ou mineure ?', cat: 'sheet2_13', type: 'single', harmonies: ['c:3M:+1', 'c:3m:+1'], count: 8,
      intro: 'On mélange : on te dira laquelle chanter. Sens bien la différence de couleur.' },
    { id: 'l7', chapter: 2, name: 'Tierces dans la gamme', cat: 'sheet3_03', type: 'single', harmonies: ['3+'], diatonic: true, count: 8,
      intro: 'En vraie harmonie, on reste dans la tonalité : la tierce au-dessus est majeure ou mineure selon le degré. On te donne la tonalité, à toi de trouver la bonne note.' },
    { id: 'l8', chapter: 2, name: 'Toutes les harmonies d’une note', cat: 'music12_01', type: 'single', harmonies: ['3+', '5+', '3-'], diatonic: true, multi: true, count: 4,
      intro: 'Une même note peut s’harmoniser de plusieurs façons. Pour chaque note, je te demande les différentes harmonies possibles, l’une après l’autre.' },
    { id: 'l9', chapter: 2, name: 'Tons et demi-tons', cat: 'sheet2_02', type: 'single', harmonies: ['c:2m:+1', 'c:2m:-1', 'c:2M:+1', 'c:2M:-1'], count: 8,
      intro: 'Monter ou descendre d’un demi-ton (seconde mineure) ou d’un ton (seconde majeure). Plus dur qu’il n’y paraît : ça frotte !' },
    { id: 'l10', chapter: 2, name: 'Reconnaître : tous les intervalles', cat: 'sheet3_02', type: 'identify', intervals: ['2m', '2M', '3m', '3M', '4J', '4A', '5J', '6m', '6M', '7m', '7M', '8J'], count: 10,
      intro: 'Le grand examen d’oreille : les 12 intervalles. Les moyens mnémotechniques des Leçons vont t’aider.' },
    { id: 'l11', chapter: 2, name: 'Sixtes et quartes', cat: 'sheet3_05', type: 'single', harmonies: ['6-', '4-', '6+'], diatonic: true, multi: true, count: 4,
      intro: 'Les renversements : la sixte en dessous (= tierce au-dessus, une octave plus bas), la quarte en dessous (= quinte), la sixte au-dessus.' },

    { id: 'l12', chapter: 3, name: 'Petite mélodie en tierces', cat: 'sheet1_09', type: 'melody', harmonies: ['3+'], length: 3, count: 5,
      intro: 'Une petite mélodie de 3 notes. Chante-la une tierce au-dessus, en restant dans la gamme.' },
    { id: 'l13', chapter: 3, name: 'Mélodie : tierce en dessous', cat: 'sheet1_21', type: 'melody', harmonies: ['3-'], length: 4, count: 5,
      intro: 'Cette fois tu passes sous la mélodie, une tierce en dessous.' },
    { id: 'l14', chapter: 3, name: 'Décalages : demi-ton & ton', cat: 'music07_01', type: 'melody', harmonies: ['c:2m:+1', 'c:2m:-1', 'c:2M:+1'], multi: true, length: 4, count: 3,
      intro: 'Même mélodie, plusieurs harmonies parallèles : un demi-ton au-dessus, un demi-ton en dessous, un ton au-dessus. Chaque note est décalée exactement de la même distance.' },
    { id: 'l15', chapter: 3, name: 'Mélodie : plusieurs harmonies', cat: 'sheet1_23', type: 'melody', harmonies: ['3+', '6-', '5+'], multi: true, length: 5, count: 3,
      intro: 'Tierce au-dessus, sixte en dessous, quinte au-dessus : trois façons d’habiller la même mélodie.' },
    { id: 'l16', chapter: 3, name: 'Grande mélodie', cat: 'music09_01', type: 'melody', harmonies: ['3+', '3-'], length: 8, count: 4,
      intro: 'Huit notes, comme une vraie phrase de chanson. Tu es prêt·e pour le mode Chansons !' },
  ];
  LEVELS.forEach((l, i) => { l.index = i; l.catSrc = CAT(l.cat); });
  const CHAPTERS = { 1: 'Chapitre 1 — Les intervalles de base', 2: 'Chapitre 2 — Harmoniser une note', 3: 'Chapitre 3 — Harmoniser une mélodie' };

  // ---------------- Sauvegarde ----------------
  const KEY = 'mofumusic.v1';
  const DEFAULT = {
    xp: 0, levels: {}, stats: {}, cats: [], history: [], streak: { day: null, count: 0 },
    settings: { range: 'medium', naming: 'fr', octaveTol: true, tempo: 80, accomp: false, drone: false, showNames: true, volume: 0.8, micMode: 'auto' },
  };
  let state = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s) return { ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
    } catch (e) { /* stockage indisponible */ }
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function reset() { state = JSON.parse(JSON.stringify(DEFAULT)); save(); }

  function addXp(n) {
    const before = rankOf(state.xp).index;
    state.xp += Math.round(n);
    touchStreak();
    save();
    const after = rankOf(state.xp);
    return after.index > before ? after : null; // renvoie le nouveau rang si promotion
  }
  function touchStreak() {
    const d = new Date().toISOString().slice(0, 10);
    const s = state.streak;
    if (s.day === d) return;
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    s.count = s.day === y ? s.count + 1 : 1; s.day = d;
  }
  function recordStat(key, ok) {
    const s = state.stats[key] || (state.stats[key] = { ok: 0, n: 0 });
    s.n++; if (ok) s.ok++;
    save();
  }
  function finishLevel(id, ratio) {
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.75 ? 2 : ratio >= 0.5 ? 1 : 0;
    const L = state.levels[id] || { stars: 0, best: 0, plays: 0 };
    L.plays++; L.best = Math.max(L.best, ratio); const gained = Math.max(0, stars - L.stars); L.stars = Math.max(L.stars, stars);
    state.levels[id] = L;
    let newCat = null;
    if (stars > 0) {
      const locked = ALL_CATS.filter(c => !state.cats.includes(c));
      if (locked.length && gained > 0) { newCat = Music.rnd(locked); state.cats.push(newCat); }
    }
    state.history.unshift({ id, ratio, date: Date.now() }); state.history = state.history.slice(0, 50);
    save();
    return { stars, gained, newCat };
  }
  function unlocked(level) {
    if (level.index === 0) return true;
    const prev = LEVELS[level.index - 1];
    return (state.levels[prev.id]?.stars || 0) >= 1 || (state.levels[level.id]?.stars || 0) > 0;
  }
  function nextLevel() {
    return LEVELS.find(l => unlocked(l) && !(state.levels[l.id]?.stars >= 1)) || LEVELS.find(l => (state.levels[l.id]?.stars || 0) < 3) || LEVELS[LEVELS.length - 1];
  }

  return {
    CATS, ALL_CATS, RANKS, rankOf, LEVELS, CHAPTERS, get state() { return state; }, save, reset,
    addXp, recordStat, finishLevel, unlocked, nextLevel,
  };
})();
