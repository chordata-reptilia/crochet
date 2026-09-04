# Crochet Pattern Designer

Application de bureau Windows pour concevoir des motifs de crochet sur une
grille (mode classique ou Corner-to-Corner), générer les instructions
ligne par ligne, et exporter en PNG/PDF. 100% local, aucun compte requis.

## Développement

```bash
npm install
npm start       # lance l'app en mode développement
npm test        # lance les tests unitaires (Jest)
```

## Construire l'installateur Windows

```bash
npm run dist
```

L'installateur `.exe` est généré dans `dist/`.
