# Déploiement sur Hostingerrrrrr

## Vue d'ensemble

Votre application MailCandid est une application web full-stack Node.js/Express avec une interface frontend statique. Elle peut être déployée sur Hostinger sans besoin de restructurer les fichiers.

## Structure recommandée pour Hostinger

```
masdelsol-test.online/
├── server.js              # Serveur Express (backend)
├── package.json           # Dépendances et scripts
├── package-lock.json      # Verrouillage des versions
├── .env                   # Variables d'environnement (à créer)
├── public/                # Frontend statique
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/                   # Code backend
│   └── zimbra-client.js
├── CV_LETTRE_DE_RECOMMANDATION.pdf  # Pièce jointe
└── Tableau contact.xlsx   # Fichier de données
```

## Configuration requise

### 1. Compte Hostinger
- Hébergement web avec support Node.js
- Accès FTP et gestionnaire de fichiers

### 2. Variables d'environnement (.env)
Créez un fichier `.env` à la racine avec vos identifiants Zimbra :

```env
# Identifiants Zimbra (inchangés, utilisés par l'API SOAP)
SMTP_USER=votre_email@etu.univ-tours.fr
SMTP_PASS=votre_mot_de_passe

# URL du webmail Zimbra (API SOAP via HTTPS — bypass restriction SMTP)
ZIMBRA_URL=https://webmailetu-zimbra.univ-tours.fr

# Port (optionnel, généralement 3000)
PORT=3000
```

## Étapes de déploiement

### Étape 1 : Préparation locale
1. Vérifiez que tous les fichiers sont présents
2. Créez le fichier `.env` avec vos identifiants
3. Testez localement avec `npm start`

### Étape 2 : Import dans Hostinger
1. Connectez-vous à votre espace client Hostinger
2. Accédez au gestionnaire de fichiers
3. Téléversez tous les fichiers dans le répertoire racine de votre domaine
4. Vérifiez que la structure correspond à celle indiquée ci-dessus

### Étape 3 : Configuration Node.js
1. Dans le panneau de contrôle Hostinger, activez Node.js
2. Spécifiez `server.js` comme point d'entrée
3. Configurez les variables d'environnement dans l'interface Hostinger
4. Démarrez l'application

### Étape 4 : Vérification
1. Accédez à `https://www.masdelsol-test.online`
2. Vérifiez que l'interface se charge correctement
3. Testez l'upload d'un fichier Excel
4. Vérifiez l'envoi des emails de test

## Points importants

- **Aucune restructuration nécessaire** : L'application est déjà prête pour le déploiement
- **Pièces jointes** : Le fichier PDF doit rester à la racine pour être accessible
- **Sécurité** : Ne partagez pas le fichier `.env` publiquement
- **Performance** : L'application est légère et convient parfaitement à un hébergement standard

## Dépannage

### Problèmes courants :
- Vérifiez les identifiants Zimbra dans `.env`
- Assurez-vous que Node.js est activé dans le panneau Hostinger
- Vérifiez que le port 3000 est autorisé (ou configurez un reverse proxy)

### Support :
- Documentation Hostinger : https://www.hostinger.fr/tutoriels/node-js
- Support technique via le panneau de contrôle