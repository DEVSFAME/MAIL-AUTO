# Guide complet de déploiement sur Hostinger

## Introduction

Ce guide vous accompagne pas à pas pour déployer votre application MailCandid sur votre domaine www.masdelsol-test.online via la plateforme Hostinger.

## Avant de commencer

### Vérifications préalables
- ✅ Vous avez un compte Hostinger avec hébergement web
- ✅ Votre domaine www.masdelsol-test.online est configuré
- ✅ Vous avez accès au panneau de contrôle Hostinger
- ✅ Vous avez vos identifiants Zimbra à jour

### Structure du projet
Votre application est déjà structurée pour le déploiement. Aucune restructuration n'est nécessaire.

## Étape 1 : Préparation du projet

### 1.1 Vérification des fichiers
Assurez-vous d'avoir tous les fichiers suivants à la racine de votre projet :

```
Automatisation MAIL/
├── server.js                    # Serveur backend
├── package.json                 # Dépendances
├── package-lock.json           # Verrouillage versions
├── .env                        # Variables d'environnement
├── public/                     # Interface frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/                        # Code source backend
│   └── zimbra-client.js
├── CV_LETTRE_DE_RECOMMANDATION.pdf  # Pièce jointe
└── Tableau contact.xlsx        # Données
```

### 1.2 Configuration du fichier .env
Créez/modifiez le fichier `.env` à la racine avec vos identifiants :

```env
# Identifiants Zimbra
SMTP_USER=votre_email@etu.univ-tours.fr
SMTP_PASS=votre_mot_de_passe

# URL Zimbra
ZIMBRA_URL=https://webmailetu-zimbra.univ-tours.fr

# Port
PORT=3000
```

**⚠️ Attention :** Ne partagez jamais ce fichier publiquement !

### 1.3 Test local
Avant le déploiement, testez localement :

```bash
npm install
npm start
```

Accédez à http://localhost:3000 et vérifiez que tout fonctionne.

## Étape 2 : Accès à Hostinger

### 2.1 Connexion
1. Rendez-vous sur [hostinger.fr](https://www.hostinger.fr)
2. Connectez-vous avec vos identifiants
3. Accédez à votre tableau de bord

### 2.2 Accès au gestionnaire de fichiers
1. Dans le tableau de bord, cliquez sur "Hébergement"
2. Sélectionnez votre domaine "masdelsol-test.online"
3. Cliquez sur "Gestionnaire de fichiers"

## Étape 3 : Upload des fichiers

### 3.1 Upload via interface web
1. Dans le gestionnaire de fichiers, vous êtes dans le répertoire racine
2. Cliquez sur "Upload" (en haut à droite)
3. Sélectionnez tous les fichiers de votre projet
4. Attendez la fin de l'upload

### 3.2 Upload via FTP (alternative)
Si vous préférez utiliser FTP :

1. Récupérez vos identifiants FTP dans Hostinger
2. Utilisez un client FTP (FileZilla, Cyberduck, etc.)
3. Connectez-vous à votre espace
4. Téléversez tous les fichiers dans le répertoire racine

### 3.3 Vérification de la structure
Après upload, vérifiez que la structure est correcte :

```
public_html/ (ou www/)
├── server.js
├── package.json
├── .env
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   └── zimbra-client.js
├── CV_LETTRE_DE_RECOMMANDATION.pdf
└── Tableau contact.xlsx
```

## Étape 4 : Configuration Node.js

### 4.1 Activation Node.js (Méthode simple)

**Option 1 : Via le gestionnaire de fichiers (la plus simple)**

1. Dans le gestionnaire de fichiers Hostinger
2. Cliquez sur le fichier `server.js`
3. Cliquez sur "Modifier" (ou "Edit")
4. En haut à droite, cherchez un bouton "Node.js" ou "Exécuter"
5. Activez l'exécution Node.js pour ce fichier

**Option 2 : Via le panneau de contrôle**

1. Dans le tableau de bord Hostinger
2. Allez dans "Hébergement" > "Gestion avancée"
3. Recherchez "Node.js" ou "Applications"
4. Activez Node.js pour votre domaine
5. Spécifiez `server.js` comme point d'entrée

**Option 3 : Via fichier de configuration**

Créez un fichier `package.json` avec un script de démarrage (déjà présent) :

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

Hostinger détectera automatiquement que c'est une application Node.js.

### 4.2 Variables d'environnement

**Méthode la plus simple : Directement dans server.js**

Si l'interface Hostinger ne permet pas de configurer facilement les variables d'environnement, vous pouvez les définir directement dans `server.js` :

```javascript
// Ajoutez ces lignes au début de server.js, avant require('dotenv').config();
process.env.SMTP_USER = 'votre_email@etu.univ-tours.fr';
process.env.SMTP_PASS = 'votre_mot_de_passe';
process.env.ZIMBRA_URL = 'https://webmailetu-zimbra.univ-tours.fr';
process.env.PORT = '3000';
```

**Alternative : Via fichier .env**

1. Créez le fichier `.env` à la racine (comme indiqué précédemment)
2. Hostinger devrait le détecter automatiquement
3. Sinon, utilisez la méthode ci-dessus dans `server.js`

### 4.3 Version Node.js

Hostinger utilise généralement la dernière version LTS par défaut. Si vous devez la changer :

1. Recherchez "Node.js version" dans le panneau de contrôle
2. Sélectionnez la version 18.x ou 20.x
3. Redémarrez l'application

## Étape 5 : Démarrage de l'application

### 5.1 Installation des dépendances
Hostinger installera automatiquement les dépendances via `package.json`. Sinon :

1. Accédez à la console SSH (si disponible)
2. Exécutez : `npm install`

### 5.2 Démarrage
1. Dans l'interface Node.js, cliquez sur "Démarrer"
2. Attendez que l'application soit active

## Étape 6 : Tests et vérification

### 6.1 Accès au site
Ouvrez votre navigateur et accédez à :
```
https://www.masdelsol-test.online
```

### 6.2 Vérifications à faire
- ✅ L'interface se charge correctement
- ✅ Le header affiche les statistiques
- ✅ Le bouton "Parcourir les fichiers" fonctionne
- ✅ L'upload d'un fichier Excel fonctionne
- ✅ Les contacts s'affichent correctement

### 6.3 Test d'envoi d'email
1. Importez un fichier Excel
2. Ouvrez un contact
3. Cliquez sur "Envoyer"
4. Vérifiez la réception du mail

## Étape 7 : Configuration HTTPS (optionnel mais recommandé)

Hostinger propose généralement un certificat SSL gratuit :

1. Allez dans "SSL" dans le panneau de contrôle
2. Activez le certificat SSL gratuit
3. Configurez la redirection HTTP vers HTTPS

## Dépannage

### Problèmes courants

#### Erreur 500
- Vérifiez les variables d'environnement
- Vérifiez que Node.js est bien démarré
- Consultez les logs dans l'interface Hostinger

#### Erreur de connexion SMTP
- Vérifiez vos identifiants Zimbra
- Assurez-vous que le compte Zimbra est actif
- Testez avec un email de test

#### Fichiers non trouvés
- Vérifiez la structure des dossiers
- Assurez-vous que les fichiers sont dans le bon répertoire
- Vérifiez les permissions des fichiers

#### Performance lente
- Vérifiez votre forfait d'hébergement
- Optimisez les images si nécessaire
- Contactez le support Hostinger

### Support technique

#### Hostinger
- Documentation : https://www.hostinger.fr/tutoriels
- Support 24/7 via chat
- Tickets de support

#### Debug Node.js
Dans l'interface Hostinger, vous pouvez :
- Voir les logs d'erreur
- Redémarrer l'application
- Modifier les variables d'environnement

## Bonnes pratiques

### Sécurité
- Changez régulièrement vos mots de passe
- Ne partagez pas vos identifiants
- Utilisez HTTPS

### Maintenance
- Sauvegardez régulièrement vos données
- Mettez à jour les dépendances
- Surveillez les logs d'erreur

### Performance
- Nettoyez régulièrement les logs
- Optimisez les fichiers uploadés
- Surveillez l'espace disque

## Conclusion

Votre application MailCandid est maintenant déployée sur www.masdelsol-test.online ! 

L'application est prête à l'emploi et vous permettra d'automatiser l'envoi de candidatures via votre interface web accessible depuis n'importe quel navigateur.

Pour toute question ou problème, consultez la documentation Hostinger ou contactez leur support technique.