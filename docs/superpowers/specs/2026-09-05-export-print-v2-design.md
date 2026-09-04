# Export & impression v2 — Design

## Contexte et objectif

Extension du sous-système d'export PNG/PDF de la v1 (`src/export/pdf.js`,
IPC `export:pdf` dans `main.js`, bouton "Exporter PDF" dans le renderer)
pour se rapprocher des options d'impression de Stitch Fiddle, adaptées à un
usage personnel (pas de formats vectoriels, pas de légende en fichier
séparé, pas d'export de zone sélectionnée — hors scope, volontairement
simplifié).

Sous-projet 1 sur 6 de la feuille de route v2 (voir historique de
conversation pour le découpage complet : navigation avancée, suivi de
progression, outils de transformation, édition avancée de grille,
organisation de projets).

## Fonctionnalités ajoutées

1. **Orientation** : Portrait ou Paysage (choix explicite avant export,
   affecte l'orientation de la page PDF).
2. **Format papier** : A4 ou Letter (limité à ces deux formats courants).
3. **Marge** : une valeur numérique unique en millimètres, appliquée sur
   les quatre côtés de chaque page.
4. **Position des instructions** : avant la grille, après la grille, ou
   aucune (actuellement toujours après, implicitement, dans la v1).
5. **Pagination automatique** : si la grille imprimée (à une taille de
   maille fixe et lisible) ne tient pas dans la zone imprimable d'une
   page au format/orientation choisis, elle est découpée automatiquement
   en plusieurs pages, chacune numérotée ("Page X sur Y"), dans l'ordre
   de lecture (gauche à droite, puis de haut en bas).

## Hors scope (volontairement simplifié vs Stitch Fiddle)

- Formats vectoriels (SVG, EPS, DOCX, ODT, XLSX, WMF, EMF), formats
  logiciels de point de croix (OXS).
- Formats papier autres que A4/Letter (A0-A6, Legal, Ledger).
- Unités de marge autres que le millimètre.
- Téléchargement de la légende en fichier séparé.
- Export d'une zone sélectionnée uniquement (nécessite un outil de
  sélection, prévu dans un sous-projet ultérieur).
- Export PNG : inchangé, ces options ne s'appliquent qu'au PDF.

## Interface utilisateur

Le bouton "Exporter PDF" existant ouvre désormais une petite fenêtre
modale (même approche que la modale "Nouveau motif" de la v1 — HTML/CSS
custom, pas de `window.prompt`, qui ne fonctionne pas dans Electron)
avec :
- Orientation : deux boutons (Portrait / Paysage), sélection unique.
- Format papier : menu déroulant (A4 / Letter).
- Marge : champ numérique (mm), valeur par défaut 10.
- Instructions : menu déroulant (Avant / Après / Aucune), valeur par
  défaut "Après" (comportement actuel).
- Boutons "Exporter" / "Annuler".

## Calcul de la pagination

Le PDF est généré avec `pdfkit`. Pour chaque page :
1. Calculer la zone imprimable = taille papier − 2×marge.
2. Choisir une taille de maille fixe pour l'impression (ex. 14pt/maille,
   constante, indépendante du zoom à l'écran) pour rester lisible.
3. Calculer combien de mailles tiennent en largeur et en hauteur dans la
   zone imprimable d'une page.
4. Si la grille complète tient dans une page → une seule page.
5. Sinon, découper la grille en blocs rectangulaires de cette taille
   maximale, générer une page par bloc, avec numérotation "Page X/Y" en
   pied de page, dans l'ordre gauche→droite puis haut→bas.
6. Les instructions texte (générées par `generateInstructions`) sont
   ajoutées sur une ou plusieurs pages dédiées, avant ou après les pages
   de grille selon le réglage choisi (ou omises si "Aucune").

## Modèle de données de l'appel IPC

```js
// renderer -> main, canal 'export:pdf'
{
  gridImageData: { width, height, cells, palette, mode }, // pour reconstruire l'image page par page côté main
  instructions: string[],
  options: {
    orientation: 'portrait' | 'landscape',
    paperSize: 'A4' | 'Letter',
    marginMm: number,
    instructionsPosition: 'before' | 'after' | 'none',
  }
}
```

Contrairement à la v1 (qui envoyait juste une image PNG déjà rendue en
un bloc), la v2 envoie les données brutes de la grille pour permettre à
`buildPdf` de redessiner chaque page à la bonne échelle/découpe plutôt
que de redimensionner une image unique (ce qui donnerait un rendu flou
ou mal proportionné en cas de pagination). `buildPdf` dessine donc
directement les cellules avec l'API vectorielle de `pdfkit` (rectangles
colorés), comme le fait déjà `renderGrid()` sur le `<canvas>` du
renderer, plutôt que d'intégrer une image bitmap.

## Gestion des erreurs

Mêmes garanties que la v1 : toute erreur d'écriture (dialogue annulé,
permission refusée) renvoie `{success:false, error}` ou
`{success:false, canceled:true}`, jamais de crash silencieux. Valeurs de
marge invalides (négative, non numérique) sont rejetées côté renderer
avec un message clair avant l'envoi IPC.

## Tests

- Tests unitaires (Jest) sur la logique pure de pagination (nouvelle
  fonction extraite, ex. `computePageLayout({width, height, paperSize,
  orientation, marginMm}) -> { pagesX, pagesY, cellPt }`), avec cas :
  grille tenant sur une page, grille nécessitant 2x1 pages, 2x2 pages,
  changement d'orientation change le nombre de pages.
- Validation manuelle dans l'app réelle avant de considérer le travail
  terminé (export d'une petite grille tenant sur une page, et d'une
  grande grille nécessitant plusieurs pages, vérification visuelle du
  PDF produit).
