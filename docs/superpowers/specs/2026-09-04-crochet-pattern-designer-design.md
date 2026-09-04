# Crochet Pattern Designer — Design v1

## Contexte et objectif

Application de bureau Windows destinée à une amie qui fait du crochet, inspirée de
l'éditeur de grille de [Stitch Fiddle](https://www.stitchfiddle.com/en/c/snseqy-ddynp3).
L'objectif de la v1 est de lui permettre de **créer ses propres motifs** sur une grille
pixel-art, en modes grille classique ou Corner-to-Corner (C2C), et d'obtenir les
instructions de crochet + un export imprimable (PNG + PDF).

Usage strictement personnel, mono-utilisatrice, 100% local (pas de compte, pas de
serveur, pas de synchronisation cloud).

## Hors scope v1

Pourra être ajouté plus tard si besoin, mais explicitement exclu de la v1 :
- Comptes utilisateurs / cloud / partage en ligne
- Bibliothèque de fils par marque (juste des couleurs libres nommables)
- Import d'image vers grille
- Plusieurs projets ouverts simultanément (un seul projet actif à la fois)

## Stack technique

- **Electron** (dernière version stable) — process principal Node.js + fenêtre
  renderer.
- **Frontend** : HTML/CSS/JavaScript vanilla, rendu de la grille via `<canvas>`
  (pas de framework UI lourd nécessaire pour la v1).
- **Génération PDF** : `pdfkit` (ou équivalent léger, sans dépendance serveur).
- **Persistance** : fichiers `.json` custom lus/écrits via l'API `fs` de Node,
  dialogues natifs Windows (`dialog.showOpenDialog` / `showSaveDialog`) pour
  ouvrir/enregistrer. Dossier par défaut : `Documents`.
- **Empaquetage** : `electron-builder` → installateur `.exe` Windows.
- **Tests** : Jest pour la logique pure (génération d'instructions, sérialisation
  de projet). Pas de tests end-to-end automatisés de l'UI en v1 — validation
  manuelle des fonctionnalités clés dans l'app réelle avant de considérer le
  travail terminé.

## Composants

### 1. Éditeur de grille (Canvas)
- Grille de cellules colorables, taille configurable (largeur × hauteur en
  mailles) à la création du projet, modifiable ensuite (ajout/suppression de
  rangs/colonnes).
- Zoom / pan sur la grille.
- Outils : pinceau (peindre une cellule), seau de peinture (remplir une zone
  contiguë de même couleur), gomme (retour à "vide"), pipette (sélectionner la
  couleur d'une cellule existante).
- Undo / redo sur les actions de dessin.
- Dessin libre ("freeform") : aucune contrainte de motif répétitif imposée —
  c'est le comportement par défaut de l'éditeur, pas un mode technique séparé.

### 2. Palette de couleurs
- Liste des couleurs utilisées dans le motif courant.
- Ajout / suppression / renommage d'une couleur (nom optionnel, ex. "Bleu ciel").
- Sélecteur de couleur standard (color picker RGB/hex).
- Sélection de la couleur active pour le pinceau/seau depuis la palette.

### 3. Modes de motif
- Sélecteur à la création du projet (modifiable ensuite) entre :
  - **Grille classique** : rangs droits, lecture ligne par ligne comme un
    diagramme de point simple.
  - **Corner-to-Corner (C2C)** : la grille est interprétée et affichée en
    diagonale, blocs de mailles.
- Le mode détermine uniquement comment la grille est affichée/interprétée pour
  la génération d'instructions ; la logique de dessin (peindre des cellules)
  reste identique dans les deux modes.

### 4. Générateur d'instructions
- À partir de la grille remplie et du mode sélectionné, génère un texte
  ligne par ligne (ex. grille classique : `Rang 1 : 3 mailles Bleu ciel, 5
  mailles Blanc, ...` ; C2C : `Bloc 1 : augmenter, 2 mailles Bleu ciel...`).
- Affiché dans un panneau latéral à côté de la grille, mis à jour en direct
  quand la grille change.

### 5. Export
- Bouton "Exporter" avec deux formats :
  - **PNG** : image de la grille colorée.
  - **PDF** : image de la grille + instructions texte complètes, mise en page
    prête à imprimer.

### 6. Gestion de projet
- Nouveau / Ouvrir / Enregistrer / Enregistrer sous.
- Format de fichier `.json` custom contenant : nom du projet, dimensions de la
  grille, mode (classique/C2C), palette de couleurs, contenu de la grille
  (couleur par cellule).
- Un seul projet ouvert à la fois.

## Modèle de données (fichier projet `.json`)

```json
{
  "name": "Mon motif",
  "mode": "classic" | "c2c",
  "width": 40,
  "height": 40,
  "palette": [
    { "id": "c1", "name": "Bleu ciel", "hex": "#87CEEB" }
  ],
  "cells": [
    ["c1", null, "c1", ...],
    ...
  ]
}
```

- `cells` est un tableau 2D (hauteur × largeur), chaque valeur étant un `id` de
  couleur de la palette ou `null` pour une cellule vide.

## Gestion des erreurs

- Sauvegarde/ouverture de fichier : messages d'erreur clairs si le fichier est
  corrompu, illisible, ou dans un format inattendu (pas de crash silencieux).
- Redimensionnement de la grille : préserver le contenu existant dans la zone
  commune, avertir si le redimensionnement va tronquer des cellules peintes.
- Export PDF/PNG : gérer l'échec d'écriture disque (ex. dossier protégé) avec
  message utilisateur explicite.

## Tests

- Tests unitaires (Jest) sur :
  - Génération d'instructions à partir d'une grille (grille classique et C2C),
    y compris cas limites (grille vide, une seule couleur, grille non
    rectangulaire impossible par construction).
  - Sérialisation / désérialisation de projet (round-trip `.json`).
  - Logique de remplissage (seau de peinture) sur des cas simples et complexes
    (zones non contiguës, bords de grille).
- Validation manuelle de l'UI (dessin, export, sauvegarde/ouverture) dans
  l'application packagée avant de considérer une étape terminée.
