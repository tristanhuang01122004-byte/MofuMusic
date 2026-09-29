# 🐱🎶 MofuMusic

Application web pour **apprendre à chanter des harmonies**, sur le thème des chats mofusand.
Elle est entièrement en français, utilise un thème sombre et ne demande aucune installation. C'est une page statique en HTML/CSS/JS.

## Fonctionnalités

- **Leçons** : rappels de solfège, les 13 intervalles avec leur nom, leur nombre de demi-tons et un moyen mnémotechnique à écouter, les qualités (juste, majeur, mineur…), les tierces dans la gamme, « une note, plusieurs harmonies », harmonie diatonique ou parallèle, et des conseils de chant.
- **16 niveaux en 3 chapitres**, avec étoiles, déblocage progressif et XP :
  1. *Les intervalles de base* : unisson, quinte, tierces majeure et mineure, reconnaissance à l'oreille.
  2. *Harmoniser une note* : tierces dans la gamme, **toutes les harmonies possibles d'une note posées l'une après l'autre**, tons et demi-tons, sixtes et quartes.
  3. *Harmoniser une mélodie* : tierce au-dessus ou en dessous, **décalages d'un demi-ton ou d'un ton**, plusieurs harmonies sur la même mélodie, et une grande mélodie de 8 notes.
- **Tu réponds en chantant** (le micro détecte la hauteur avec l'algorithme YIN) **ou au clavier**. Dans tous les cas, l'app te fait **entendre la bonne réponse** : la note de départ, puis l'harmonie, puis les deux ensemble.
- **Entraînement libre** : tu choisis les intervalles, les harmonies (diatoniques ou parallèles), la longueur de la mélodie et le nombre de questions.
- **Mode Chansons, étape par étape** :
  1. Importer un fichier audio (mp3, wav…) ou MIDI, saisir une mélodie, ou prendre un exemple (Au clair de la lune, Frère Jacques, Ode à la joie).
  2. Choisir un passage (sélection sur la forme d'onde ou liste de phrases).
  3. Détecter la mélodie et la tonalité, avec des outils pour corriger les notes.
  4. Chanter la mélodie avec la chanson (ta voix s'affiche en direct).
  5. Découvrir une harmonie (tierce, sixte, quinte, parallèle…) et l'écouter avec la chanson.
  6. La chanter avec une flûte qui te guide.
  7. La chanter seul·e, avec un score et de l'XP, puis passer au passage suivant.
- **9 rangs**, de *Chaton endormi* à *Légende Mofusand*, plus une **collection de 63 chats** à débloquer.
- **Profil** : tessiture (grave, medium ou aiguë), nom des notes (Do Ré Mi ou C D E), tolérance d'octave, tempo, test du micro et statistiques de tes points faibles.

## Lancer l'application

Le micro ne fonctionne qu'en **https** ou en **localhost**.

En local :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

En ligne avec GitHub Pages : dans le dépôt, va dans *Settings → Pages → Build and deployment*, choisis *Deploy from a branch*, puis la branche et le dossier `/ (root)`.

🎧 **Mets un casque** pour les exercices où de la musique joue pendant que tu chantes, sinon le micro entend la musique à la place de ta voix.

## 📱 Installer sur ton téléphone

MofuMusic est une **application web installable** (PWA) : une fois installée, elle a son icône sur l'écran d'accueil, s'ouvre en plein écran et marche même sans connexion.

1. Mets l'app en ligne avec GitHub Pages (voir plus haut) et ouvre le lien sur ton téléphone.
2. **iPhone** : ouvre le lien dans **Safari**, appuie sur **Partager** (le carré avec la flèche), puis **Sur l'écran d'accueil**.
3. **Android** : ouvre le lien dans **Chrome**, appuie sur **⋮**, puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
4. Au premier lancement, autorise le micro.

## Structure

```
index.html          page unique
manifest.webmanifest, sw.js   application installable + mode hors ligne
css/style.css       thème sombre aux couleurs mofusand
js/music.js         théorie : notes épelées, intervalles, tonalités, harmonies, détection de tonalité
js/audio.js         synthé Web Audio, métronome, micro, détection de hauteur YIN, analyse de fichiers
js/game.js          rangs, niveaux, XP, sauvegarde (localStorage)
js/ui.js            clavier, jauge de justesse, rouleau de notes
js/exercise.js      exercices (note seule, reconnaissance, mélodie)
js/song.js          mode Chansons (lecteur MIDI, découpage en phrases, étapes)
js/app.js           navigation, accueil, leçons, carte des niveaux, mode libre, profil
assets/cats/        chats découpés individuellement (PNG transparents)
assets/source/      planches d'origine, PDF et script de découpage
```

## Crédits

Les illustrations de chats viennent de **mofusand** (© juno, https://www.mofusand.com). Ce projet est personnel, non officiel et sans but commercial. Si le dépôt est public, ces images restent la propriété de leur autrice.
