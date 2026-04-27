# Déploiement simplifié sur Hostinger

## Méthode ultra-simple (sans gestion avancée)

### Étape 1 : Upload des fichiers
1. Connectez-vous à votre espace client Hostinger
2. Allez dans "Hébergement" > "Gestionnaire de fichiers"
3. Téléversez TOUS les fichiers de votre projet dans le répertoire racine
4. Vérifiez que vous avez :
   - `server.js`
   - `package.json`
   - `public/` (avec index.html, style.css, app.js)
   - `src/` (avec zimbra-client.js)
   - `CV_LETTRE_DE_RECOMMANDATION.pdf`
   - `Tableau contact.xlsx`

### Étape 2 : Configuration rapide

**Option A : Directement dans server.js (la plus simple)**

Ouvrez `server.js` dans l'éditeur de fichiers Hostinger et ajoutez ces lignes AU DÉBUT du fichier (juste après les commentaires) :

```javascript
// Configuration rapide pour Hostinger
process.env.SMTP_USER = 'votre_email@etu.univ-tours.fr';
process.env.SMTP_PASS = 'votre_mot_de_passe';
process.env.ZIMBRA_URL = 'https://webmailetu-zimbra.univ-tours.fr';
process.env.PORT = '3000';
```

**Option B : Avec fichier .env**

Créez un fichier `.env` à la racine avec :

```env
SMTP_USER=votre_email@etu.univ-tours.fr
SMTP_PASS=votre_mot_de_passe
ZIMBRA_URL=https://webmailetu-zimbra.univ-tours.fr
PORT=3000
```

### Étape 3 : Activation Node.js

**Méthode 1 : Via gestionnaire de fichiers**
1. Cliquez sur `server.js`
2. Cliquez sur "Modifier" (Edit)
3. Cherchez un bouton "Node.js" ou "Exécuter"
4. Activez-le

**Méthode 2 : Via package.json**
Hostinger détecte automatiquement que c'est une app Node.js grâce à :
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

### Étape 4 : Démarrage
1. Recherchez un bouton "Démarrer" ou "Lancer"
2. Cliquez dessus
3. Attendez 1-2 minutes

### Étape 5 : Test
Accédez à https://www.masdelsol-test.online

## Si ça ne marche pas

### Erreur 500 ?
- Vérifiez que les variables d'environnement sont bien définies
- Vérifiez que tous les fichiers sont uploadés

### Page blanche ?
- Vérifiez que `public/index.html` est bien présent
- Vérifiez les chemins des CSS/JS dans index.html

### Erreur SMTP ?
- Vérifiez vos identifiants Zimbra
- Testez avec un email de test

## Support rapide
- Documentation Hostinger : https://www.hostinger.fr/tutoriels/node-js
- Chat support 24/7 dans l'espace client

## Temps estimé
- Upload : 2 minutes
- Configuration : 3 minutes
- Démarrage : 2 minutes
- **Total : 7 minutes maximum !**