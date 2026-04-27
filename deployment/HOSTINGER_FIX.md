# Fix pour l'erreur "Unexpected token '<'" sur Hostinger

## Problème
Lors du déploiement sur Hostinger, l'erreur "Unexpected token '<'" indique que le frontend JavaScript reçoit du HTML au lieu de JSON lors des appels API.

## Causes principales
1. **Problème de routage** : Le serveur Express ne sert pas correctement les fichiers statiques
2. **Erreur 404 détournée** : Une page d'erreur HTML est retournée au lieu des endpoints API
3. **Configuration incorrecte de Node.js** : L'application ne démarre pas correctement sur Hostinger

## Solutions mises en place

### 1. Amélioration de la configuration serveur (server.js)

#### Avant :
```javascript
app.use(express.static(staticDir));
```

#### Après :
```javascript
// Configuration optimisée pour Hostinger
app.use(express.static(staticDir, {
  maxAge: '1d', // Cache 1 jour pour la production
  etag: true,
  lastModified: true
}));

// Middleware de logging pour debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Gestion d'erreur 404 personnalisée pour éviter les retours HTML inattendus
app.use((req, res, next) => {
  // Si c'est une requête API, retourner toujours du JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      success: false, 
      error: 'Endpoint not found',
      path: req.path 
    });
  }
  // Pour les autres requêtes, laisser express.static gérer
  next();
});
```

### 2. Amélioration de la gestion des erreurs frontend (public/app.js)

#### Avant :
```javascript
const res = await fetch('/api/upload', { method: 'POST', body: formData });
const data = await res.json();
```

#### Après :
```javascript
const res = await fetch('/api/upload', { method: 'POST', body: formData });

// Vérification du type de réponse pour éviter l'erreur "Unexpected token '<'"
if (!res.headers.get('content-type')?.includes('application/json')) {
  throw new Error('Réponse serveur invalide (HTML au lieu de JSON). Vérifiez que le serveur est démarré et que l\'endpoint /api/upload existe.');
}

const data = await res.json();
```

### 3. Amélioration du démarrage serveur

#### Avant :
```javascript
app.listen(PORT, () => {
  console.log(`\n🚀 Application démarrée sur http://localhost:${PORT}`);
  console.log(`📧 Compte  : ${process.env.SMTP_USER}`);
  console.log(`🔗 Zimbra  : ${process.env.ZIMBRA_URL}`);
  console.log(`🧪 Test auth : http://localhost:${PORT}/api/test-auth\n`);
});
```

#### Après :
```javascript
app.listen(PORT, () => {
  console.log(`\n🚀 Application démarrée sur http://localhost:${PORT}`);
  console.log(`📧 Compte  : ${process.env.SMTP_USER}`);
  console.log(`🔗 Zimbra  : ${process.env.ZIMBRA_URL}`);
  console.log(`🧪 Test auth : http://localhost:${PORT}/api/test-auth`);
  console.log(`📁 Dossier static : ${staticDir}`);
  console.log(`🌐 Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});
```

## Instructions de déploiement sur Hostinger

### Étape 1 : Upload des fichiers
1. Connectez-vous à votre espace client Hostinger
2. Allez dans "Hébergement" > "Gestionnaire de fichiers"
3. Téléversez TOUS les fichiers de votre projet dans le répertoire racine
4. Vérifiez que vous avez :
   - `server.js`
   - `package.json`
   - `package-lock.json`
   - `.env`
   - `public/` (avec index.html, style.css, app.js)
   - `src/` (avec zimbra-client.js)
   - `CV_LETTRE_DE_RECOMMANDATION.pdf`
   - `Tableau contact.xlsx`

### Étape 2 : Configuration Node.js

**Méthode recommandée : Via le gestionnaire de fichiers**

1. Dans le gestionnaire de fichiers Hostinger
2. Cliquez sur le fichier `server.js`
3. Cliquez sur "Modifier" (ou "Edit")
4. En haut à droite, cherchez un bouton "Node.js" ou "Exécuter"
5. Activez l'exécution Node.js pour ce fichier

**Alternative : Via fichier .env**

Si l'interface Hostinger ne permet pas de configurer facilement les variables d'environnement, vous pouvez les définir directement dans `server.js` :

```javascript
// Ajoutez ces lignes au début de server.js, avant require('dotenv').config();
process.env.SMTP_USER = 'votre_email@etu.univ-tours.fr';
process.env.SMTP_PASS = 'votre_mot_de_passe';
process.env.ZIMBRA_URL = 'https://webmailetu-zimbra.univ-tours.fr';
process.env.PORT = '3000';
```

### Étape 3 : Démarrage de l'application
1. Recherchez un bouton "Démarrer" ou "Lancer"
2. Cliquez dessus
3. Attendez 1-2 minutes

### Étape 4 : Tests et vérification
1. Accédez à https://www.masdelsol-test.online
2. Vérifiez que l'interface se charge correctement
3. Testez l'upload d'un fichier Excel
4. Vérifiez la réception du mail

## Points importants

- **Aucune restructuration nécessaire** : L'application est déjà prête pour le déploiement
- **Pièces jointes** : Le fichier PDF doit rester à la racine pour être accessible
- **Sécurité** : Ne partagez pas le fichier `.env` publiquement
- **Performance** : L'application est légère et convient parfaitement à un hébergement standard

## Dépannage

### Problèmes courants :
- **Erreur 500** : Vérifiez les identifiants Zimbra dans `.env`
- **Erreur de connexion SMTP** : Vérifiez que le compte Zimbra est actif
- **Fichiers non trouvés** : Vérifiez la structure des dossiers
- **Performance lente** : Vérifiez votre forfait d'hébergement

### Support :
- Documentation Hostinger : https://www.hostinger.fr/tutoriels/node-js
- Support 24/7 via chat
- Tickets de support

## Temps estimé
- Upload : 2 minutes
- Configuration : 3 minutes
- Démarrage : 2 minutes
- **Total : 7 minutes maximum !**