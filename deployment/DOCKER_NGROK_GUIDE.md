# 🚀 Guide : Docker + ngrok + Hostinger

## Architecture

```
Navigateur (site Hostinger)
         │
         │  fetch('https://cytotropic-bipedally-ollie.ngrok-free.dev/api/...')
         ▼
   [ngrok tunnel] — URL FIXE (ne change jamais ✅)
         │
         ▼
   Docker sur votre Mac
   └── server.js (Express + Zimbra SOAP)
        └── CV_LETTRE_DE_RECOMMANDATION.pdf
```

---

## 📋 Pré-requis

- **Docker Desktop** installé sur votre Mac  
  → https://www.docker.com/products/docker-desktop

- **ngrok** installé avec un compte (plan gratuit avec domaine fixe)  
  → https://ngrok.com/download  
  → `ngrok config add-authtoken VOTRE_TOKEN`

---

## 🏁 Démarrage (à faire à chaque session)

### Option A — Démarrage en un clic ✅ (recommandé)

Double-cliquez sur **`Démarrer l'application.command`**

Le script démarre automatiquement :
1. Le serveur Node.js sur `http://localhost:3000`
2. Le tunnel ngrok sur `https://cytotropic-bipedally-ollie.ngrok-free.dev`

---

### Option B — Démarrage manuel

#### Étape 1 — Démarrer le backend Docker

```bash
cd "/Users/yacinehida/Desktop/Automatisation MAIL"
docker-compose up --build
```

Le serveur démarre sur `http://localhost:3000`

---

#### Étape 2 — Ouvrir le tunnel ngrok (domaine fixe)

Dans un **nouveau terminal** :

```bash
ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3000
```

Le tunnel sera accessible sur :
```
https://cytotropic-bipedally-ollie.ngrok-free.dev
```

> ✅ **Cette URL ne change jamais** — Aucune mise à jour de `config.js` requise !

---

## ✅ Domaine ngrok fixe

Le domaine ngrok est permanent :

```
https://cytotropic-bipedally-ollie.ngrok-free.dev
```

Les fichiers déjà configurés :
- `public/config.js` → `window.API_BASE_URL` pointe sur ce domaine
- `server.js` → CORS autorise ce domaine
- `Démarrer l'application.command` → lance ngrok avec ce domaine automatiquement

> ⚠️ Il n'est plus nécessaire de mettre à jour `config.js` ni de le ré-uploader sur Hostinger à chaque session.

---

## 📁 Fichiers à uploader sur Hostinger (une seule fois)

Ces fichiers ne changent plus :

```
public_html/
├── index.html        ← depuis public/index.html
├── app.js            ← depuis public/app.js
├── style.css         ← depuis public/style.css
└── config.js         ← depuis public/config.js (✅ domaine fixe, plus besoin de MAJ)
```

> ⚠️ Ne uploadez PAS server.js, package.json, .env, etc. sur Hostinger.
> Ces fichiers tournent dans Docker sur votre machine locale.

---

## 🔄 Workflow complet résumé

```
Démarrer l'application  →  Double-clic sur "Démarrer l'application.command"
Aller sur le site       →  https://masdelsol-test.online ✅
```

C'est tout ! Plus besoin de copier/coller l'URL ngrok ou de modifier `config.js`.

---

## 🛑 Arrêter l'application

```bash
# Dans le terminal : Ctrl+C
# ngrok s'arrête automatiquement avec le serveur
```

Ou si vous utilisez Docker :
```bash
docker-compose down
```

---

## 🔧 Dépannage

### ❌ "Vérifiez que le backend Docker est démarré"
- Vérifiez que le serveur tourne dans un terminal
- Vérifiez que ngrok est actif : `https://cytotropic-bipedally-ollie.ngrok-free.dev`

### ❌ Erreur CORS
- Le domaine ngrok est déjà dans la liste CORS de `server.js` ✅
- Vérifiez que `https://masdelsol-test.online` est bien aussi dans la liste

### ❌ ngrok "ERR_NGROK_3200" (session expirée)
- Relancez ngrok : `ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3000`
- L'URL reste identique, pas besoin de modifier `config.js`

### ❌ PDF non trouvé
- Le fichier `CV_LETTRE_DE_RECOMMANDATION.pdf` doit être à la racine du projet
  (même dossier que `server.js`)
