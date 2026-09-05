# Export & impression v3 — Design

## Contexte et objectif

Extension du sous-système d'export PDF de la v2 (`src/export/page-layout.js`,
`src/export/pdf.js`, IPC `export:pdf` dans `main.js`, modal "Exporter en
PDF" du renderer) pour lever trois limitations explicitement notées comme
hors-scope dans le design v2 :

1. Formats papier au-delà de A4/Letter.
2. Unités de marge au-delà du millimètre.
3. Téléchargement de la légende (couleur → nom) en fichier séparé.

Premier sous-projet d'une feuille de route en 6 parties (formats
vectoriels, import d'image, outil de sélection + export de zone, projets
multiples ouverts simultanément — chacun son propre spec/plan ultérieur).
Toujours hors-scope ici : formats vectoriels, export de zone sélectionnée,
plusieurs projets ouverts simultanément, import d'image — traités dans
des sous-projets séparés.

## Fonctionnalités ajoutées

1. **Formats papier étendus** : en plus de A4/Letter, ajout de A0, A1,
   A2, A3, A5, A6, Legal, Ledger. Toujours limité à une liste fixe (pas
   de format personnalisé en v3).
2. **Unités de marge** : la marge peut être saisie en millimètres,
   centimètres, ou pouces. La valeur est toujours convertie en points
   PDF via une seule fonction de conversion centralisée, pour éviter
   toute divergence d'arrondi entre unités.
3. **Légende intégrée au PDF principal** : nouvelle section optionnelle
   ("Inclure la légende") listant, pour chaque couleur de la palette
   *effectivement utilisée* dans la grille (les couleurs ajoutées à la
   palette mais jamais peintes sur la grille sont omises), une pastille
   de la couleur, son nom (si défini par l'utilisateur), et son code
   hexadécimal. Quand incluse, la légende apparaît toujours juste après
   la dernière page de grille et avant les pages d'instructions (position
   fixe, non configurable en v3 — indépendante du réglage "Position des
   instructions").
4. **Téléchargement de la légende en fichier séparé** : bouton dédié
   dans le modal d'export, indépendant du bouton "Exporter" principal,
   avec un choix de format (PDF ou PNG). Génère un second fichier
   contenant uniquement le tableau de légende (même contenu que la
   section intégrée), via un second dialogue natif de sauvegarde.

## Hors scope (reporté à des sous-projets ultérieurs ou volontairement exclu)

- Formats vectoriels (SVG, EPS, DOCX, ODT, XLSX, WMF, EMF), formats
  logiciels de point de croix (OXS) — sous-projet séparé.
- Formats papier personnalisés (dimensions libres) — non demandé.
- Export d'une zone sélectionnée uniquement — nécessite un outil de
  sélection, sous-projet séparé.
- Plusieurs projets ouverts simultanément — sous-projet séparé, sans
  lien avec l'export.
- Import d'image vers grille — sous-projet séparé, sans lien avec
  l'export.
- Position configurable de la légende (avant/après/aucune, comme les
  instructions) — en v3 elle est toujours juste après la grille si
  incluse ; une position configurable pourra être ajoutée plus tard si
  le besoin se confirme.
- Export PNG du motif complet : inchangé, ces options ne s'appliquent
  qu'au PDF et à la légende séparée.

## Interface utilisateur

Modifications du modal "Exporter en PDF" existant (`#pdf-export-modal`) :

- **Format papier** : le `<select id="pdf-paper-size">` gagne les
  options A0, A1, A2, A3, A5, A6, Legal, Ledger, dans cet ordre (du plus
  grand au plus petit format A, puis Legal/Ledger), en plus de A4/Letter
  déjà présents.
- **Marge** : le champ numérique `#pdf-margin-mm` est accompagné d'un
  nouveau `<select id="pdf-margin-unit">` (mm / cm / in), valeur par
  défaut "mm" (comportement v2 inchangé par défaut). L'id du champ
  numérique reste `pdf-margin-mm` pour limiter le diff malgré le nom
  devenu partiellement impropre (il contient une valeur dans l'unité
  choisie, plus nécessairement des mm) — un renommage est jugé non
  justifié pour ce gain.
- **Légende** : une case à cocher `#pdf-include-legend` ("Inclure la
  légende"), décochée par défaut (comportement v2 inchangé par défaut).
- **Téléchargement séparé** : un bouton `#pdf-legend-download-btn`
  ("Télécharger la légende séparément…") toujours visible dans le modal,
  avec un `<select id="pdf-legend-format">` (PDF / PNG) à côté. Ce bouton
  fonctionne indépendamment de la case à cocher et du bouton "Exporter"
  principal — il n'exporte que la légende, dans un fichier à part,
  immédiatement.

## Calcul et rendu

### Formats papier et unités de marge

`PAPER_SIZES_PT` dans `page-layout.js` est étendu avec les dimensions en
points des nouveaux formats (dimensions ISO 216 standard pour A0-A6,
dimensions US standard pour Legal/Ledger). `computePageLayout` reçoit un
nouveau paramètre `marginUnit: 'mm' | 'cm' | 'in'` (défaut `'mm'` si
absent, pour rester compatible avec un appelant v2). La conversion vers
points se fait via une table de facteurs (`MM_TO_PT`, `CM_TO_PT`,
`IN_TO_PT`) appliquée à la valeur numérique de marge avant tout autre
calcul ; le reste de la logique de pagination (déjà testée en v2) est
inchangé.

### Légende

Nouveau module pur `src/export/legend.js` :
- `buildLegendRows(chart)` — à partir de `chart.palette` et
  `chart.cells`, retourne la liste des couleurs de la palette dont l'id
  apparaît au moins une fois dans `cells`, sous la forme
  `{ hex, label }` où `label` est `"${name} (${hex})"` si un nom est
  défini, sinon juste `hex`. Ordre : celui de la palette (ordre
  d'ajout), pas trié par couleur ou usage.
- `drawLegendSection(doc, rows)` — dessine, avec l'API `pdfkit` déjà
  utilisée par `buildPdf` (`doc.rect(...).fill(...)`, `doc.text(...)`),
  une pastille carrée suivie du label, une ligne par couleur, en
  paginant automatiquement si le nombre de couleurs dépasse une page
  (réutilise `ensureFreshPage` de la même manière que
  `writeInstructions`).

`buildPdf` (modifié) : nouvelle option `options.includeLegend: boolean`
(défaut `false`). Quand `true`, après les pages de grille et avant le
bloc d'instructions (indépendamment de `instructionsPosition`), appelle
`drawLegendSection(doc, buildLegendRows(chart))`.

### Légende en fichier séparé

Nouvelle fonction `buildLegendDocument({ chart, outputPath })` dans
`legend.js` : crée un `PDFDocument` autonome (une seule page, ou
paginé si nécessaire par la même logique que `drawLegendSection`) ne
contenant que la légende, écrit dans `outputPath`. Réutilise
`drawLegendSection` — pas de duplication du rendu entre le PDF principal
et le PDF de légende seule.

Pour le format PNG, la légende est dessinée côté renderer sur un
`<canvas>` détaché (même technique que l'export PNG du motif existant :
`canvas.toDataURL('image/png')`), puis envoyée à `main.js` comme une
image déjà encodée — pas de nouveau code de rendu PNG côté Node. Le
canvas dessine les mêmes pastilles + labels que `buildLegendRows`
produit, avec une taille de police/pastille fixe suffisante pour la
lisibilité (pas de contrainte de pagination : un PNG unique, aussi haut
que nécessaire).

## Modèle de données des appels IPC

Extension de l'appel `export:pdf` existant :

```js
// renderer -> main, canal 'export:pdf'
{
  chart: { width, height, cells, palette },
  instructions: string[],
  options: {
    orientation: 'portrait' | 'landscape',
    paperSize: 'A4' | 'Letter' | 'A0' | 'A1' | 'A2' | 'A3' | 'A5' | 'A6' | 'Legal' | 'Ledger',
    marginValue: number,       // remplace marginMm ; interprété selon marginUnit
    marginUnit: 'mm' | 'cm' | 'in',
    instructionsPosition: 'before' | 'after' | 'none',
    includeLegend: boolean,
  }
}
```

**Rupture de nom volontaire** : `options.marginMm` (v2) devient
`options.marginValue` + `options.marginUnit` (v3), car une valeur
appelée `marginMm` contenant potentiellement des pouces serait trompeuse
pour tout futur lecteur du code. `main.js` et `page-layout.js` sont mis
à jour ensemble ; aucun appelant externe n'existe (app desktop
mono-utilisateur, pas d'API versionnée), donc pas de compatibilité
ascendante à maintenir.

Nouveau canal IPC séparé pour le téléchargement de légende, plus proche
du modèle `export:png` existant que de `export:pdf` :

```js
// renderer -> main, canal 'export:legend-pdf'
{ chart: { width, height, cells, palette } }
// -> { success: true, path } | { success: false, canceled: true } | { success: false, error }

// renderer -> main, canal 'export:legend-png'
{ dataUrl: string } // PNG déjà encodé côté renderer, comme export:png existant
// -> { success: true, path } | { success: false, canceled: true } | { success: false, error }
```

## Gestion des erreurs

Mêmes garanties que la v2 : `paperSize`, `marginUnit`, et
`instructionsPosition` sont validés contre une liste blanche côté IPC
avant tout traitement, avec un message clair en cas de valeur invalide ;
`marginValue` est validé comme nombre fini positif (même contrôle que
`marginMm` en v2). Le guard existant contre un `options` absent/null
(ajouté lors de la revue finale v2) reste en place et couvre aussi ces
nouveaux champs. Le bouton "Télécharger la légende séparément" suit les
mêmes règles : dialogue annulé → pas d'erreur affichée, échec d'écriture
→ message clair, jamais de crash silencieux.

## Tests

- `tests/export-page-layout.test.js` étendu : un cas par nouveau format
  papier (au moins A3 et Legal, pour couvrir un format plus grand et un
  format proche d'A4) ; un cas vérifiant que 10mm, 1cm, et
  0.3937007874in produisent le même `marginPt` à l'arrondi flottant
  près (tolérance `toBeCloseTo`).
- Nouveau `tests/export-legend.test.js` : `buildLegendRows` — palette
  avec une couleur jamais peinte (doit être omise), couleur avec nom
  (label = "nom (hex)"), couleur sans nom (label = hex seul), grille
  entièrement vide (résultat vide).
- Validation manuelle dans l'app réelle avant de considérer le travail
  terminé : export PDF avec un format papier étendu (ex. A3) et une
  marge en pouces, vérification visuelle de la mise en page ; export
  avec légende incluse, vérification que les couleurs inutilisées de la
  palette n'apparaissent pas ; téléchargement de la légende seule en PDF
  puis en PNG, vérification du contenu des deux fichiers.
