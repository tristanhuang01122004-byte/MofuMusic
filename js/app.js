// ============================================================
//  MofuMusic — application : navigation, accueil, leçons, niveaux, entraînement libre, profil
// ============================================================
'use strict';

const App = (() => {
  const { h, btn, $, $$, toast } = UI;
  const S = () => Game.state.settings;

  const VIEWS = [
    { id: 'home', label: 'Accueil', icon: '🏠' },
    { id: 'lessons', label: 'Leçons', icon: '📖' },
    { id: 'levels', label: 'Niveaux', icon: '🗺️' },
    { id: 'free', label: 'Libre', icon: '🎛️' },
    { id: 'songs', label: 'Chansons', icon: '🎵' },
    { id: 'profile', label: 'Profil', icon: '🐱' },
  ];
  let current = 'home';

  function show(id) {
    if (current === 'profile' && id !== 'profile') stopMicTest();
    current = id;
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + id));
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === id));
    const r = { home: renderHome, lessons: renderLessons, levels: renderLevels, free: renderFree, songs: () => Song.render(), profile: renderProfile }[id];
    if (r) r();
    window.scrollTo({ top: 0 });
  }

  function refreshHeader() {
    const rk = Game.rankOf(Game.state.xp);
    const el = $('#rank-mini'); el.innerHTML = '';
    el.append(h('img', { src: rk.cat, alt: '' }), h('div', h('b', rk.name), h('div.xpbar', h('div', { style: { width: rk.progress * 100 + '%' } })),
      h('small', Game.state.xp + ' XP' + (rk.next ? ' / ' + rk.next.xp : ''))));
  }

  function rankUp(rk) {
    UI.modal({ cat: rk.cat, title: 'Nouveau rang : ' + rk.name + ' !', body: h('p', rk.text), buttons: [{ label: 'Miaou !' }] });
  }

  // ---------------- Accueil ----------------
  function renderHome() {
    const root = $('#view-home'); root.innerHTML = '';
    const rk = Game.rankOf(Game.state.xp);
    const nxt = Game.nextLevel();
    const done = Game.LEVELS.filter(l => (Game.state.levels[l.id]?.stars || 0) > 0).length;
    const starsTotal = Game.LEVELS.reduce((s, l) => s + (Game.state.levels[l.id]?.stars || 0), 0);
    root.append(
      h('section.hero',
        h('div.hero-text',
          h('h1', 'Apprends à ', h('span.hl', 'harmoniser'), ' avec les chats'),
          h('p', 'Une note, une mélodie, puis tes chansons préférées : entraîne ton oreille et ta voix à trouver la deuxième voix, sur demande.'),
          h('div.row.wrap',
            btn('▶ Continuer : ' + nxt.name, () => Exercise.start(nxt), 'primary big'),
            btn('📖 Leçons', () => show('lessons'), 'big'))),
        h('img.hero-cat', { src: Game.CATS.band, alt: '' })),
      h('div.grid3',
        h('div.card.rank-card', h('img', { src: rk.cat, alt: '' }), h('div',
          h('small.dim', 'Ton rang'), h('h3', rk.name), h('p.dim', rk.text),
          h('div.xpbar.big', h('div', { style: { width: rk.progress * 100 + '%' } })),
          h('small', rk.next ? (rk.next.xp - Game.state.xp) + ' XP avant « ' + rk.next.name + ' »' : 'Rang maximum atteint !'))),
        h('div.card.stat', h('img', { src: Game.CATS.piano, alt: '' }), h('div', h('small.dim', 'Niveaux réussis'), h('h3', done + ' / ' + Game.LEVELS.length), h('p', '★ ' + starsTotal + ' / ' + Game.LEVELS.length * 3))),
        h('div.card.stat', h('img', { src: Game.CATS.profile, alt: '' }), h('div', h('small.dim', 'Série de jours'), h('h3', (Game.state.streak.count || 0) + ' 🔥'), h('p', Game.state.cats.length + ' chats collectionnés')))),
      h('div.tiles',
        tile('📖', 'Leçons', 'Les noms des intervalles et des harmonies, avec des exemples à écouter.', Game.CATS.teacher, () => show('lessons')),
        tile('🗺️', 'Niveaux', 'Une note → une mélodie : un parcours progressif avec étoiles et rangs.', Game.CATS.listen, () => show('levels')),
        tile('🎛️', 'Entraînement libre', 'Choisis tes intervalles, tes harmonies, la longueur des mélodies.', Game.CATS.free, () => show('free')),
        tile('🎵', 'Chansons', 'Importe une chanson (audio ou MIDI) et harmonise-la pas à pas.', Game.CATS.songs, () => show('songs'))));
  }
  const tile = (icon, title, text, cat, fn) => h('button.tile', { type: 'button', onclick: fn }, h('img', { src: cat, alt: '' }), h('b', icon + ' ' + title), h('small', text));

  // ---------------- Leçons ----------------
  const LESSONS = [
    { id: 'solfege', title: 'Rappels de solfège', cat: 'sheet3_09' },
    { id: 'intervals', title: 'Les 13 intervalles', cat: 'sheet3_02' },
    { id: 'qualities', title: 'Juste, majeur, mineur…', cat: 'sheet1_05' },
    { id: 'harmony', title: 'Qu’est-ce qu’harmoniser ?', cat: 'music12_01' },
    { id: 'thirds', title: 'Les tierces dans la gamme', cat: 'sheet3_03' },
    { id: 'multi', title: 'Plusieurs harmonies pour une note', cat: 'sheet2_04' },
    { id: 'types', title: 'Les types d’harmonie', cat: 'music05_01' },
    { id: 'tips', title: 'Conseils pour chanter juste', cat: 'sheet2_01' },
  ];
  let lesson = 'intervals';
  function renderLessons() {
    const root = $('#view-lessons'); root.innerHTML = '';
    const menu = h('div.lesson-menu', LESSONS.map(l => h('button.lesson-btn' + (l.id === lesson ? '.on' : ''), { type: 'button', onclick: () => { lesson = l.id; renderLessons(); } },
      h('img', { src: 'assets/cats/' + l.cat + '.png', alt: '' }), h('span', l.title))));
    const body = h('div.lesson-body.card');
    root.append(h('h2', '📖 Leçons'), h('div.lessons', menu, body));
    ({ solfege: lSolfege, intervals: lIntervals, qualities: lQualities, harmony: lHarmony, thirds: lThirds, multi: lMulti, types: lTypes, tips: lTips })[lesson](body);
  }
  const play = (notes, gap = 0.55, harm = false) => {
    Audio.stopAll(); const t = Audio.now() + 0.05;
    notes.forEach((m, i) => Audio.playNote(m, harm ? t : t + i * gap, harm ? 1.6 : gap * 0.95, { timbre: i && !harm ? 'piano' : 'piano', vol: 0.55 }));
  };
  const C4 = 60;
  const nm = m => Music.midiName(m, true);

  function lSolfege(b) {
    const major = [0, 2, 4, 5, 7, 9, 11, 12].map(x => C4 + x), minor = [0, 2, 3, 5, 7, 8, 10, 12].map(x => 57 + x);
    b.append(h('h3', 'Rappels de solfège'),
      h('p', 'Les 7 notes : ', h('b', 'Do Ré Mi Fa Sol La Si'), ' (en anglais : C D E F G A B). En France, le Do du milieu du piano s’appelle ', h('b', 'Do3'), ' (C4 en anglais).'),
      h('p', 'Le ', h('b', 'demi-ton'), ' est le plus petit écart (deux touches voisines du piano, noires comprises). Un ', h('b', 'ton'), ' = 2 demi-tons. Entre Mi–Fa et Si–Do il n’y a qu’un demi-ton.'),
      h('p', 'Les altérations : le ', h('b', 'dièse ♯'), ' monte d’un demi-ton, le ', h('b', 'bémol ♭'), ' descend d’un demi-ton, le ', h('b', 'bécarre ♮'), ' annule.'),
      h('div.box', h('b', 'Gamme majeure'), ' : T – T – ½ – T – T – T – ½', h('br'), h('span.dim', 'Do Ré Mi Fa Sol La Si Do'),
        h('div.row', btn('▶ Do majeur', () => play(major, 0.4)))),
      h('div.box', h('b', 'Gamme mineure naturelle'), ' : T – ½ – T – T – ½ – T – T', h('br'), h('span.dim', 'La Si Do Ré Mi Fa Sol La'),
        h('div.row', btn('▶ La mineur', () => play(minor, 0.4)))),
      h('p', 'Les ', h('b', 'degrés'), ' : I tonique, II sus-tonique, III médiante, IV sous-dominante, V dominante, VI sus-dominante, VII sensible.'),
      h('p', 'Chaque tonalité a son ', h('b', 'armure'), ' (dièses ou bémols à la clé). Harmoniser « dans la gamme » = n’utiliser que les notes de l’armure.'),
      h('div.row', btn('Tester : Échauffement →', () => Exercise.start(Game.LEVELS[0]), 'primary')));
  }

  function lIntervals(b) {
    b.append(h('h3', 'Les 13 intervalles (à partir de Do3)'),
      h('p.dim', 'Un intervalle = la distance entre deux notes. Son nom a deux parties : un ', h('b', 'nombre'), ' (seconde, tierce… on compte les noms de notes, Do–Mi = Do Ré Mi = 3 → tierce) et une ', h('b', 'qualité'), ' (majeure, mineure, juste…) qui dépend du nombre exact de demi-tons.'),
      h('div.iv-cards', Music.INTERVALS.map(iv => {
        const top = C4 + iv.s;
        const target = Music.transpose(Music.note(0, 0, 4), iv.n, iv.s, 1);
        return h('div.iv-card',
          h('div.iv-head', h('b', iv.name), h('span.pill', iv.s + ' ½t')),
          h('div.dim', 'Do → ' + Music.name(target) + ' · ' + iv.alias),
          h('div.small', '🎵 ' + iv.song), h('div.small.dim', iv.feel + ' — ' + iv.cons),
          h('div.row', btn('↗', () => play([C4, top]), 'small'), btn('↘', () => play([top, C4]), 'small'), btn('ensemble', () => play([C4, top], 0, true), 'small')));
      })),
      h('div.row', btn('S’entraîner à les reconnaître →', () => Exercise.start(Game.LEVELS.find(l => l.id === 'l10')), 'primary')));
  }

  function lQualities(b) {
    const row = (a, c, d) => h('tr', h('td', a), h('td', c), h('td', d));
    b.append(h('h3', 'Juste, majeur, mineur, augmenté, diminué'),
      h('p', 'Il y a deux familles d’intervalles :'),
      h('div.box', h('b', '1. Les « justes » : unisson, quarte, quinte, octave.'), h('br'), 'Ils n’ont qu’une forme normale (juste). Un demi-ton de plus → ', h('b', 'augmenté'), ', un de moins → ', h('b', 'diminué'), '.'),
      h('div.box', h('b', '2. Les « majeurs/mineurs » : seconde, tierce, sixte, septième.'), h('br'), 'Forme ', h('b', 'majeure'), ' (la plus grande) ou ', h('b', 'mineure'), ' (un demi-ton de moins).'),
      h('table.tbl', h('tr', h('th', 'Intervalle'), h('th', 'Demi-tons'), h('th', 'Exemple')),
        row('Tierce mineure', '3', 'Do → Mi♭ / Ré → Fa'), row('Tierce majeure', '4', 'Do → Mi / Fa → La'),
        row('Quarte juste', '5', 'Do → Fa'), row('Quarte augmentée', '6', 'Fa → Si (triton)'), row('Quinte diminuée', '6', 'Si → Fa (même son, autre nom !)'),
        row('Quinte juste', '7', 'Do → Sol'), row('Sixte mineure', '8', 'Mi → Do'), row('Sixte majeure', '9', 'Do → La')),
      h('p', h('b', 'Renversement'), ' : si on retourne un intervalle (la note du bas passe en haut), les chiffres font toujours ', h('b', '9'), ' et majeur ↔ mineur, juste reste juste. Tierce majeure ↔ sixte mineure, quinte juste ↔ quarte juste. C’est pour ça que « tierce au-dessus » et « sixte en dessous » donnent la même note !'),
      h('div.row', btn('▶ Do–Mi (3M) puis Mi–Do (6m)', () => { Audio.stopAll(); const t = Audio.now() + 0.05; Audio.playNote(60, t, 1); Audio.playNote(64, t, 1); Audio.playNote(64, t + 1.3, 1); Audio.playNote(72, t + 1.3, 1); })));
  }

  function lHarmony(b) {
    const mel = [60, 62, 64, 65, 67], harm = [64, 65, 67, 69, 71];
    b.append(h('h3', 'Qu’est-ce qu’harmoniser ?'),
      h('p', 'Harmoniser, c’est chanter ', h('b', 'une deuxième ligne mélodique'), ' en même temps que la mélodie principale, qui s’accorde avec elle.'),
      h('p', 'Les intervalles qui « sonnent bien » ensemble sont les ', h('b', 'consonances'), ' :'),
      h('ul', h('li', h('b', 'parfaites'), ' : unisson, octave, quinte (très fusionnées, un peu « vides » si on en enchaîne trop)'),
        h('li', h('b', 'imparfaites'), ' : tierces et sixtes (riches, chaleureuses — ', h('b', 'les stars de l’harmonie vocale'), ')')),
      h('p', 'Les ', h('b', 'dissonances'), ' (secondes, septièmes, triton) créent une tension ; on les utilise de passage.'),
      h('div.box', 'Exemple : la mélodie Do Ré Mi Fa Sol, harmonisée à la tierce au-dessus : Mi Fa Sol La Si.',
        h('div.row.wrap', btn('▶ Mélodie', () => play(mel, 0.45)), btn('▶ Harmonie', () => play(harm, 0.45)),
          btn('▶ Ensemble', () => { Audio.stopAll(); const t = Audio.now() + 0.05; mel.forEach((m, i) => { Audio.playNote(m, t + i * 0.5, 0.45); Audio.playNote(harm[i], t + i * 0.5, 0.45, { timbre: 'flute' }); }); }, 'primary'))),
      h('p', 'Remarque : Do–Mi est une tierce ', h('b', 'majeure'), ', Ré–Fa une tierce ', h('b', 'mineure'), '. En restant dans la gamme, la qualité change toute seule. C’est l’harmonie ', h('b', 'diatonique'), ' — voir la leçon suivante.'));
  }

  function lThirds(b) {
    const key = Music.makeKey(0, 'major');
    const rows = [0, 1, 2, 3, 4, 5, 6].map(d => {
      const n = Music.diatonicShift(Music.note(0, 0, 4), key, d);
      const t = Music.diatonicShift(n, key, 2);
      const q = Music.describe(n, t);
      return h('tr', h('td', ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d]), h('td', Music.name(n)), h('td', Music.name(t)), h('td', h('span' + (q.includes('majeure') ? '.maj' : '.min'), q)),
        h('td', btn('▶', () => { Audio.stopAll(); const tt = Audio.now() + 0.05; Audio.playNote(Music.midiOf(n), tt, 1.2); Audio.playNote(Music.midiOf(t), tt, 1.2, { timbre: 'flute' }); }, 'small')));
    });
    b.append(h('h3', 'Les tierces dans la gamme (Do majeur)'),
      h('p', 'Pour harmoniser à la tierce « dans la gamme », on saute simplement ', h('b', 'une note de la gamme'), ' : Do→Mi, Ré→Fa, Mi→Sol… Mais la distance réelle change :'),
      h('table.tbl', h('tr', h('th', 'Degré'), h('th', 'Note'), h('th', 'Tierce au-dessus'), h('th', 'Qualité'), h('th', '')), rows),
      h('div.box', h('b', 'À retenir (gamme majeure) : '), 'tierces majeures sur I, IV, V ; mineures sur II, III, VI, VII. C’est ce qui donne un son « naturel » : l’harmonie reste dans la tonalité de la chanson.'),
      h('div.row', btn('S’entraîner : Tierces dans la gamme →', () => Exercise.start(Game.LEVELS.find(l => l.id === 'l7')), 'primary')));
  }

  function lMulti(b) {
    const key = Music.makeKey(0, 'major');
    const E = Music.note(2, 0, 4);
    const opts = [
      ['3+', 'Mi–Sol : dans l’accord de Do majeur (Do–Mi–Sol) ou de Mi mineur (Mi–Sol–Si)'],
      ['3-', 'Do–Mi : Mi est la tierce de l’accord de Do majeur'],
      ['5+', 'Mi–Si : Mi est la fondamentale de l’accord de Mi mineur'],
      ['6-', 'Sol en dessous : la tierce au-dessus, renversée'],
      ['5-', 'La–Mi : Mi est la quinte de l’accord de La mineur (La–Do–Mi)'],
      ['4-', 'Si en dessous : la quinte au-dessus, renversée']];
    b.append(h('h3', 'Une note, plusieurs harmonies'),
      h('p', 'Une même note de mélodie peut appartenir à ', h('b', 'plusieurs accords'), ' : elle peut en être la fondamentale, la tierce ou la quinte. Donc il existe plusieurs harmonies justes !'),
      h('p', 'Exemple avec ', h('b', 'Mi'), ' en Do majeur :'),
      h('div.iv-cards', opts.map(([code, why]) => {
        const hm = Music.harmony(code); const t = Music.harmonize(E, key, code);
        return h('div.iv-card', h('div.iv-head', h('b', hm.label), h('span.pill', Music.name(t))), h('div.small.dim', Music.describe(E, t) + ' — ' + why),
          h('div.row', btn('▶ ensemble', () => { Audio.stopAll(); const tt = Audio.now() + 0.05; Audio.playNote(64, tt, 1.3); Audio.playNote(Music.midiOf(t), tt, 1.3, { timbre: 'flute' }); }, 'small')));
      })),
      h('p', 'Dans une chanson, c’est l’', h('b', 'accord joué'), ' à ce moment qui décide laquelle sonne le mieux. Le niveau « Toutes les harmonies d’une note » te les fait chanter une par une.'),
      h('div.row', btn('S’entraîner →', () => Exercise.start(Game.LEVELS.find(l => l.id === 'l8')), 'primary')));
  }

  function lTypes(b) {
    b.append(h('h3', 'Les types d’harmonie'),
      h('div.box', h('b', 'Harmonie diatonique'), ' (dans la gamme) : on décale chaque note d’un même nombre de ', h('i', 'degrés'), '. La taille exacte (majeure/mineure) s’adapte. C’est ce qu’on chante dans 90 % des chansons.'),
      h('div.iv-cards', Object.keys(Music.HARMONIES).map(code => { const hm = Music.harmony(code); return h('div.iv-card', h('b', hm.label), h('div.small.dim', hm.desc)); })),
      h('div.box', h('b', 'Harmonie parallèle'), ' (chromatique) : on décale chaque note d’exactement le même nombre de ', h('i', 'demi-tons'), '. Par exemple « monter d’un demi-ton », « descendre d’un ton », « tierce majeure au-dessus partout ». C’est un excellent exercice d’oreille, et ça s’entend dans certains styles (chœurs de jazz, effets).'),
      h('p', h('b', 'Autres techniques'), ' que tu rencontreras : la ', h('b', 'voix fixe'), ' (bourdon, une note tenue pendant que la mélodie bouge), le ', h('b', 'contrechant'), ' (une vraie mélodie différente), les ', h('b', 'accords à 3 voix'), ' (tierce au-dessus + tierce en dessous en même temps).'),
      h('div.row', btn('Essayer « Décalages : demi-ton & ton » →', () => Exercise.start(Game.LEVELS.find(l => l.id === 'l14')), 'primary')));
  }

  function lTips(b) {
    b.append(h('h3', 'Conseils pour chanter une harmonie'),
      h('ol',
        h('li', h('b', 'Connais la mélodie par cœur'), ' avant de chercher l’harmonie.'),
        h('li', h('b', 'Chante l’harmonie seule'), ' plusieurs fois avant de la chanter contre la mélodie.'),
        h('li', 'Pense en ', h('b', 'degrés'), ' : « je suis 2 notes de gamme au-dessus ». Pas besoin de calculer les demi-tons.'),
        h('li', 'Écoute le ', h('b', 'frottement'), ' : quand c’est juste, les deux voix « fusionnent » et ça vibre agréablement. Quand c’est faux, ça bat.'),
        h('li', 'Utilise un ', h('b', 'casque'), ' pour les exercices avec accompagnement : sinon le micro entend la musique au lieu de ta voix.'),
        h('li', 'Pour le micro : ', h('b', 'tiens la note'), ' environ une demi-seconde, sans trop de vibrato, dans un endroit calme.'),
        h('li', 'Règle ta ', h('b', 'tessiture'), ' dans le Profil pour que les notes proposées soient confortables.')),
      h('div.row', btn('Tester mon micro →', () => show('profile'), 'primary')));
  }

  // ---------------- Carte des niveaux ----------------
  function renderLevels() {
    const root = $('#view-levels'); root.innerHTML = '';
    root.append(h('h2', '🗺️ Niveaux'));
    [1, 2, 3].forEach(ch => {
      root.append(h('h3.chapter', Game.CHAPTERS[ch]));
      root.append(h('div.level-grid', Game.LEVELS.filter(l => l.chapter === ch).map(l => {
        const un = Game.unlocked(l), stars = Game.state.levels[l.id]?.stars || 0;
        const typeTxt = l.type === 'identify' ? '👂 Reconnaître' : l.type === 'melody' ? '🎼 Mélodie ' + l.length + ' notes' : '🎤 Une note';
        return h('button.level' + (un ? '' : '.locked') + (stars ? '.done' : ''), { type: 'button', onclick: () => un ? Exercise.start(l) : toast('Réussis le niveau précédent (1 étoile) pour débloquer celui-ci') },
          h('span.lnum', l.index + 1), h('img', { src: l.catSrc, alt: '' }), h('b', l.name), h('small', typeTxt + (l.multi ? ' · plusieurs harmonies' : '')),
          h('div.stars', [0, 1, 2].map(i => h('span' + (i < stars ? '.on' : ''), '★'))), un ? null : h('span.lock', '🔒'));
      })));
    });
    root.append(h('div.card.center', h('img.small-cat', { src: Game.CATS.songs, alt: '' }), h('p', 'Prêt·e pour du vrai ? Le mode ', h('b', 'Chansons'), ' est toujours accessible.'), btn('🎵 Chansons', () => show('songs'), 'primary')));
  }

  // ---------------- Entraînement libre ----------------
  const free = { type: 'single', intervals: ['3M', '3m', '5J'], harms: ['3+', '3-'], chrom: [], dir: 'up', length: 4, count: 8, multi: false };
  function renderFree() {
    const root = $('#view-free'); root.innerHTML = '';
    const typeSel = h('div.seg', [['single', '🎤 Une note'], ['melody', '🎼 Mélodie'], ['identify', '👂 Reconnaître']].map(([v, l]) =>
      h('button' + (free.type === v ? '.on' : ''), { type: 'button', onclick: () => { free.type = v; renderFree(); } }, l)));
    const checks = (list, sel, label) => h('div.checks', list.map(([v, l]) => h('label.check' + (sel.includes(v) ? '.on' : ''), h('input', {
      type: 'checkbox', checked: sel.includes(v), onchange: e => { e.target.checked ? sel.push(v) : sel.splice(sel.indexOf(v), 1); e.target.parentNode.classList.toggle('on', e.target.checked); } }), l)));
    const ivList = Music.INTERVALS.filter(i => i.id !== '1J').map(i => [i.id, i.name]);
    const diaList = Object.keys(Music.HARMONIES).map(k => [k, Music.HARMONIES[k].label + ' (gamme)']);
    const chrList = [];
    Music.INTERVALS.filter(i => i.id !== '1J').forEach(i => { chrList.push(['c:' + i.id + ':+1', i.name + ' ↑']); chrList.push(['c:' + i.id + ':-1', i.name + ' ↓']); });
    const num = (label, key, min, max) => h('label.num', label, ' ', h('input', { type: 'number', min, max, value: free[key], oninput: e => free[key] = Math.max(min, Math.min(max, +e.target.value || min)) }));
    const body = [];
    if (free.type === 'identify') body.push(h('h4', 'Intervalles à reconnaître'), checks(ivList, free.intervals));
    else {
      body.push(h('h4', 'Harmonies dans la gamme (diatoniques)'), checks(diaList, free.harms),
        h('h4', 'Harmonies parallèles (intervalle fixe)'), h('p.dim', 'Ex. « Seconde mineure ↑ » = monter d’un demi-ton.'), checks(chrList, free.chrom),
        h('label.check' + (free.multi ? '.on' : ''), h('input', { type: 'checkbox', checked: free.multi, onchange: e => { free.multi = e.target.checked; e.target.parentNode.classList.toggle('on', free.multi); } }),
          'Me questionner sur TOUTES les harmonies choisies pour chaque note / mélodie'));
      if (free.type === 'melody') body.push(num('Longueur de la mélodie', 'length', 2, 12));
    }
    body.push(num('Nombre de questions', 'count', 1, 30));
    root.append(h('h2', '🎛️ Entraînement libre'),
      h('div.card.free', h('div.free-head', h('img', { src: Game.CATS.free, alt: '' }), h('p', 'Compose ton propre exercice. (XP réduite, mais aucune limite !)')),
        typeSel, body,
        h('div.row', btn('C’est parti !', () => {
          const harmonies = free.harms.concat(free.chrom);
          if (free.type === 'identify' && free.intervals.length < 2) return toast('Choisis au moins 2 intervalles', 'bad');
          if (free.type !== 'identify' && !harmonies.length) return toast('Choisis au moins une harmonie', 'bad');
          Exercise.start({
            id: 'free', index: 6, name: 'Entraînement libre', catSrc: Game.CATS.free, type: free.type, intervals: free.intervals.slice(), harmonies,
            multi: free.multi && harmonies.length > 1, length: free.length, count: free.count, diatonic: free.harms.length > 0,
            intro: free.type === 'identify' ? 'Écoute et nomme l’intervalle.' : 'Harmonies : ' + harmonies.map(c => Music.harmony(c).label.toLowerCase()).join(', ') + '.',
          }, { free: true });
        }, 'primary big'))));
  }

  // ---------------- Profil ----------------
  let micStop = null;
  function stopMicTest() { if (micStop) { micStop(); micStop = null; } }
  function renderProfile() {
    stopMicTest();
    const root = $('#view-profile'); root.innerHTML = '';
    const st = Game.state, rk = Game.rankOf(st.xp);
    const set = (k, v) => { st.settings[k] = v; Game.save(); if (k === 'naming') Music.setNaming(v); if (k === 'volume') Audio.setVolume(v); };
    const sel = (k, opts) => h('select', { onchange: e => { set(k, e.target.value); renderProfile(); } }, opts.map(([v, l]) => h('option', { value: v, selected: st.settings[k] === v }, l)));
    const chk = (k, l, d) => h('label.check' + (st.settings[k] ? '.on' : ''), h('input', { type: 'checkbox', checked: st.settings[k], onchange: e => { set(k, e.target.checked); e.target.parentNode.classList.toggle('on', e.target.checked); } }), h('span', l, d ? h('small.dim', ' — ' + d) : null));
    const meterEl = h('div'); const meter = new UI.Meter(meterEl); meter.reset('Clique sur « Tester »');
    const stats = Object.entries(st.stats).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ k, label: statLabel(k), p: v.ok / v.n, n: v.n })).sort((a, b) => a.p - b.p);
    root.append(h('h2', '🐱 Profil'),
      h('div.grid2',
        h('div.card.rank-card', h('img', { src: rk.cat, alt: '' }), h('div', h('small.dim', 'Rang ' + (rk.index + 1) + ' / ' + Game.RANKS.length), h('h3', rk.name),
          h('div.xpbar.big', h('div', { style: { width: rk.progress * 100 + '%' } })), h('small', st.xp + ' XP')),
          h('div.ranks', Game.RANKS.map((r, i) => h('div.rank' + (i <= rk.index ? '.on' : ''), { title: r.name + ' — ' + r.xp + ' XP' }, h('img', { src: r.cat, alt: '' }), h('small', r.name), h('small.dim', r.xp + ' XP'))))),
        h('div.card', h('h3', '⚙️ Réglages'),
          h('label.field', 'Ta tessiture ', sel('range', Object.entries(Music.RANGES).map(([k, r]) => [k, r.label + ' : ' + Music.midiName(r.lo, true) + '–' + Music.midiName(r.hi, true)]))),
          h('label.field', 'Nom des notes ', sel('naming', [['fr', 'Do Ré Mi (solfège)'], ['en', 'C D E (anglo-saxon)']])),
          h('label.field', 'Tempo des mélodies ', h('input', { type: 'range', min: 50, max: 140, value: st.settings.tempo, oninput: e => { set('tempo', +e.target.value); e.target.nextSibling.textContent = e.target.value + ' bpm'; } }), h('span', st.settings.tempo + ' bpm')),
          h('label.field', 'Volume ', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.settings.volume, oninput: e => set('volume', +e.target.value) })),
          chk('octaveTol', 'Accepter la bonne note à une autre octave', 'pratique si ta voix est plus grave/aiguë que la note'),
          chk('showNames', 'Afficher le nom des notes', 'décoche pour travailler 100 % à l’oreille'),
          chk('accomp', 'Jouer la mélodie pendant que je chante', 'casque obligatoire'),
          chk('drone', 'Tenir la note de départ pendant que je chante', 'casque obligatoire'))),
      h('div.card', h('h3', '🎤 Test du micro'), h('p.dim', 'Chante une note : elle doit s’afficher et l’aiguille rester près du centre. La barre du bas montre le volume capté.'),
        meterEl, h('div.row', btn('Tester', async () => {
          try { await Audio.openMic(); } catch (e) { toast(e.message || 'Micro refusé', 'bad'); return; }
          stopMicTest(); meter.reset(); micStop = Audio.listen(f => meter.update(f));
        }, 'primary'), btn('Arrêter', () => { stopMicTest(); meter.reset('Arrêté'); }, 'ghost'))),
      h('div.card', h('h3', '📊 Tes points à travailler'), stats.length ? h('div.stats', stats.slice(0, 12).map(s => h('div.statrow', h('span', s.label), h('div.bar', h('div', { style: { width: s.p * 100 + '%' } })), h('small', Math.round(s.p * 100) + ' % (' + s.n + ')'))))
        : h('p.dim', 'Joue quelques niveaux pour voir tes statistiques.')),
      h('div.card', h('h3', '🐾 Ta collection de chats (' + st.cats.length + ' / ' + Game.ALL_CATS.length + ')'),
        h('p.dim', 'Chaque nouvelle étoile gagnée dans un niveau débloque un chat.'),
        h('div.collection', Game.ALL_CATS.map(c => h('div.coll' + (st.cats.includes(c) ? '.on' : ''), h('img', { src: c, alt: '', loading: 'lazy' }))))),
      h('div.row', btn('Réinitialiser ma progression', async () => {
        const r = await UI.modal({ title: 'Tout effacer ?', body: 'XP, étoiles, chats et statistiques seront remis à zéro.', cat: Game.CATS.fail, buttons: [{ label: 'Annuler', value: false, cls: 'ghost' }, { label: 'Effacer', value: true, cls: 'danger' }] });
        if (r) { Game.reset(); Music.setNaming(Game.state.settings.naming); refreshHeader(); renderProfile(); toast('Progression réinitialisée'); }
      }, 'ghost danger')));
  }
  function statLabel(k) {
    if (k.startsWith('id:')) return 'Reconnaître : ' + Music.IV[k.slice(3)].name.toLowerCase();
    if (k.startsWith('song:')) return 'Chansons : ' + ({ melody: 'mélodie', guided: 'harmonie avec guide', solo: 'harmonie seule' })[k.slice(5)];
    try { return 'Chanter : ' + Music.harmony(k).label.toLowerCase(); } catch (e) { return k; }
  }

  // ---------------- Démarrage ----------------
  function init() {
    Music.setNaming(S().naming);
    Audio.setVolume(S().volume);
    $('#logo-cat').src = Game.CATS.logo;
    const nav = $('#nav');
    VIEWS.forEach(v => nav.appendChild(h('button', { type: 'button', 'data-v': v.id, onclick: () => show(v.id) }, h('span.i', v.icon), h('span.t', v.label))));
    refreshHeader();
    show('home');
    // débloquer l'audio au premier geste (iOS)
    document.addEventListener('pointerdown', () => Audio.ensure(), { once: true });
  }
  document.addEventListener('DOMContentLoaded', init);

  return { show, refreshHeader, rankUp };
})();
