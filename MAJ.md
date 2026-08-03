# 🎨 MAJ 16 — Remplacement SVG Outlook par icone-outlook.png dans le bouton de login
**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Remplacement du SVG reconstruit (rect + polygon + text) de l'icône Outlook dans le bouton "Se connecter avec Outlook" sur la landing page par une simple balise `<img>` pointant vers `icone-outlook.png`.

## 🔧 Modifications

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/index.html` | Modifié | Ligne 106 : remplacement du bloc `<svg>...</svg>` (8 éléments : 4 `<rect>`, 3 `<polygon>`, 1 `<text>`) par `<img src="icone-outlook.png" width="20" height="20" alt="Outlook" />` |

### Avant
```html
<button id="outlookLoginBtn" class="btn-outlook">
  <svg width="20" height="20" viewBox="0 0 48 48">
    <rect x="4" y="10" width="30" height="28" rx="3" fill="#0078D4"/>
    <rect x="4" y="10" width="30" height="12" rx="3" fill="#0078D4" opacity="0.9"/>
    <rect x="4" y="10" width="30" height="12" fill="#0072C6"/>
    <polygon points="4,10 19,22 4,34" fill="#0072C6"/>
    <polygon points="19,22 34,32 34,12" fill="#00A2ED"/>
    <polygon points="4,38 34,38 34,28" fill="#005DA6"/>
    <rect x="18" y="12" width="14" height="18" rx="2" fill="#ffffff" opacity="0.95"/>
    <text x="25" y="26" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="11" fill="#0078D4" text-anchor="middle">O</text>
  </svg>
  Se connecter avec Outlook
</button>
```

### Après
```html
<button id="outlookLoginBtn" class="btn-outlook">
  <img src="icone-outlook.png" width="20" height="20" alt="Outlook" />
  Se connecter avec Outlook
</button>
```

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/index.html` | Modifié | Échange SVG → `<img>` pour l'icône Outlook |

---

# 🎨 MAJ 15 — Remplacement icône campagne par icone-outlook.png
**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Remplacement de l'icône `icone-logo.png` par `icone-outlook.png` dans le header du modal "Configuration du message".

## 🔧 Modifications

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/index.html` | Modifié | Dans `#campaignModal`, remplacement de `<img src="icone-logo.png" ...>` par `<img src="icone-outlook.png" ...>` |
| `public/icone-outlook.png` | Ajouté | Copie de l'image racine dans `public/` car Express sert les fichiers statiques depuis ce dossier |

---

# 🐳 MAJ 14 — Correction `Argument rawData: Expected String, provided Object`

**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction de l'erreur `Invalid prisma.contact.createMany() invocation: Argument rawData: Invalid value provided. Expected String, provided Object` qui empêchait la création de campagnes (POST /api/campaign).

---

## 🔴 Problème identifié

| Élément | Détail |
|----------|--------|
| **Erreur** | `Argument rawData: Invalid value provided. Expected String, provided Object` |
| **Déclencheur** | POST /api/campaign après upload Excel |
| **Cause racine** | Le champ `rawData` est déclaré `String` dans le schéma Prisma, mais le serveur passait un objet JavaScript brut (`c.rawData \|\| {}`) sans le sérialiser en JSON |
| **Symptôme** | Échec 500 à chaque tentative de génération de campagne, contacts non créés |

---

## 🔧 Correctif

### `server.js` — Ligne 682

```diff
- rawData: c.rawData || {},
+ rawData: JSON.stringify(c.rawData || {}),
```

Le champ `rawData` est maintenant correctement sérialisé en chaîne JSON avant l'insertion, ce qui correspond au type `String` attendu par le schéma Prisma.

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `server.js` | Modifié | Ligne 682 : `JSON.stringify()` sur `rawData` |

---

## ✅ Vérification

Build Docker + redéploiement réussis. Le conteneur est **healthy** et répond sur `http://localhost:3001`.

---

# 🐳 MAJ 13 — Correction définitive `The table main.User does not exist` (Volume Docker vs Migrations)
**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction définitive de l'erreur `The table 'main.User' does not exist in the current database` qui survenait après un callback OAuth Outlook réussi. La cause racine : un conflit entre le volume Docker `sqlite_data` et les migrations Prisma copiées dans l'image.

---

## 🔴 Problème identifié

| Élément | Détail |
|----------|--------|
| **Erreur** | `The table 'main.User' does not exist in the current database` |
| **Déclencheur** | Callback OAuth Outlook → `prisma.user.findFirst()` |
| **Cause racine** | Le volume Docker `sqlite_data` monté sur `/app/prisma/` écrase les migrations copiées par le Dockerfile |
| **Symptôme** | `No migration found in prisma/migrations` → aucune table créée |

### Chaîne causale complète

```
docker build → copy migrations → /app/prisma/migrations/
docker compose up → mount sqlite_data:/app/prisma/ → migrations masquées
entrypoint → prisma migrate deploy → ne trouve rien → DB vide
callback OAuth → prisma.user.findFirst() → table inexistante → CRASH
```

---

## 🔧 Modifications

### `Dockerfile`
| Changement | Détail |
|-----------|--------|
| **Ajout** | `COPY prisma/migrations ./prisma-migrations-backup/migrations` |
| Emplacement | `/app/prisma-migrations-backup/` — hors du volume `sqlite_data` |

### `docker-entrypoint.sh`
| Changement | Détail |
|-----------|--------|
| **Ajout** | Bloc de restauration : si `/app/prisma-migrations-backup/migrations/` existe, les copier dans `/app/prisma/migrations/` avant `prisma migrate deploy` |

### `diagnose-and-test.sh` (nouveau)
Script de diagnostic complet (250+ lignes) vérifiant :
1. État du conteneur
2. Présence de la base de données
3. Tables existantes
4. Migrations Prisma
5. Endpoints API (`/`, `/api/me`, `/api/test-auth`, `/api/auth/outlook`)
6. Connexion Prisma interne

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `Dockerfile` | Modifié | Ajout `COPY` du backup migrations |
| `docker-entrypoint.sh` | Modifié | Restauration migrations avant deploy |
| `diagnose-and-test.sh` | **Créé** | Script de diagnostic + test de connexion |

---

## ✅ Vérification

```
♻️  Restauration des migrations depuis le backup...
✅ Migrations restaurées depuis prisma-migrations-backup
1 migration found in prisma/migrations
Applying migration `20260731191622_init`
All migrations have been successfully applied.
🚀 Application démarrée sur http://localhost:3001

✅ prisma.user.count() = 0
📋 Tables : Contact, Document, Session, User, _prisma_migrations, sqlite_sequence
✅ PRISMA CONNEXION + REQUÊTES OK
```

---

# ✅ MAJ 12 — Correction CrashLoopBackOff : client Prisma désynchronisé (activeProvider: postgresql)
**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction du crash `PrismaClientConstructorValidationError: Unknown property datasourceUrl` qui bloquait le conteneur en `CrashLoopBackOff`. Le client Prisma généré contenait `"activeProvider": "postgresql"` au lieu de `"sqlite"` et un `inlineSchema` obsolète.

---

## 🔴 Problème identifié

| Élément | Détail |
|----------|--------|
| **Erreur** | `PrismaClientConstructorValidationError: Unknown property datasourceUrl provided to PrismaClient constructor` |
| **Cause racine** | Le client généré (`src/generated/prisma/index.js`) contenait `"activeProvider": "postgresql"` et un `inlineSchema` d'une ancienne version (sans `microsoftId`, avec `rawData` en `Json` au lieu de `String`) |
| **Origine** | Le `prisma generate` avait été exécuté à un moment où le schéma déclarait `provider = "postgresql"` (avant la MAJ 10). Le client généré n'avait pas été régénéré après le changement vers `"sqlite"`. |
| **Symptôme** | Conteneur bloqué en boucle de redémarrage, logs vides après `🚀 Démarrage de l'application...` |

---

## 🔧 Correctif

1. **`prisma generate`** : Régénération du client avec le bon schéma (`provider = "sqlite"`) → `"activeProvider": "sqlite"` ✅
2. **Vérification** : `grep activeProvider` confirme `"sqlite"`
3. **Rebuild Docker** : `docker compose build --no-cache` pour embarquer le client régénéré
4. **Redéploiement** : `docker compose up -d --force-recreate`

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `src/generated/prisma/` | Régénéré | `prisma generate` → client SQLite cohérent |
| `prisma/schema.prisma` | Inchangé | Déjà correct (pas de `url`, pas de modification nécessaire) |
| `src/db.js` | Inchangé | Déjà correct (adapter `PrismaBetterSqlite3` avec URL string) |

---

## ✅ Vérification

```
🔍 Vérification du client Prisma...
✅ Client Prisma chargé avec succès

🚀 Démarrage de l'application...
🚀 Application démarrée sur http://localhost:3001
```

Le conteneur démarre sans erreur et répond sur le port 3001.

---

# 🔧 MAJ 11 — Correction `Cannot read properties of undefined (reading 'replace')` (adapter Prisma)
**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction de l'erreur `TypeError: Cannot read properties of undefined (reading 'replace')` qui se produisait lors du callback OAuth Outlook, après validation du token Microsoft. L'erreur survenait dans `createBetterSQLite3Client()` de l'adapter Prisma au moment d'une requête DB.

---

## 🔴 Problème identifié

| Élément | Détail |
|----------|--------|
| **Erreur** | `Cannot read properties of undefined (reading 'replace')` |
| **Localisation** | `@prisma/adapter-better-sqlite3/dist/index.js:658:22` → `createBetterSQLite3Client()` |
| **Déclencheur** | Première requête Prisma après le callback OAuth (création/mise à jour de l'utilisateur Microsoft) |
| **Cause racine** | `PrismaBetterSqlite3` était instancié avec une **instance `better-sqlite3` déjà créée** (`new Database(path)`), mais le runtime Prisma 7 attend que l'adapter crée lui-même le client SQLite via sa factory `connect()`. |

### Détail technique

Dans l'ancien code (`src/db.js`), on faisait :

```javascript
const databasePath = rawUrl.replace(/^file:/, '');
const sqlite = new Database(databasePath);
const adapter = new PrismaBetterSqlite3(sqlite);
```

Le problème : la factory `connect()` de `PrismaBetterSqlite3AdapterFactory` reçoit la configuration du datasource (sans `url` dans le schema Prisma v7 → `undefined`). Elle tente alors `undefined.replace(...)` → crash.

La correction passe l'**URL string** directement à l'adapter, qui gère lui-même l'instanciation de `better-sqlite3` :

```javascript
const rawUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const adapter = new PrismaBetterSqlite3(rawUrl);
```

---

## 🔧 Modifications

### `src/db.js`

| Changement | Détail |
|------------|--------|
| Import `Database` | **Supprimé** — plus besoin d'instancier `better-sqlite3` manuellement |
| Instanciation adapter | `new PrismaBetterSqlite3(sqlite)` → `new PrismaBetterSqlite3(rawUrl)` |
| Gestion URL | L'URL est passée directement (avec préfixe `file:`) — l'adapter gère le parsing |

### `test-outlook-auth.sh`

| Changement | Détail |
|------------|--------|
| Section 3b | Ajout d'une vérification de la base SQLite (présence du fichier, tables) |
| Chargement `DATABASE_URL` | Depuis le `.env` pour localiser le fichier de DB |

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `src/db.js` | Modifié | Passage d'une instance `better-sqlite3` → URL string dans l'adapter |
| `test-outlook-auth.sh` | Modifié | Ajout verification DB SQLite (section 3b) |

---

## ✅ Vérification

Build Docker et redéploiement réussis. Le serveur démarre avec les migrations appliquées :

```
✅ Migrations appliquées avec succès
✅ Client Prisma chargé avec succès
🚀 Application démarrée sur http://localhost:3001
```

Script de test : **16/17 réussis, 0 échecs** (1 avertissement attendu car le `.env` local pointe vers Neon PostgreSQL, mais Docker utilise SQLite).

---

# 🚀 MAJ 1 — Refonte Templating & Parsing Dynamique Excel
**Date :** 29/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé des modifications

Cette mise à jour transforme le pipeline d'import Excel d'un système **rigide** (colonnes en dur, email codé en dur) en un système **dynamique et interactif** avec une modale de templating côté frontend.

---

## 🗄️ 1. Base de données — `prisma/schema.prisma`

| Changement | Détail |
|------------|--------|
| **Supprimé** | Colonnes `name`, `structure`, `location`, `research` |
| **Ajouté** | Colonne `rawData` (JSONB) — stocke toutes les colonnes Excel de manière générique |
| **Ajouté** | Colonne `createdAt` (DateTime) — date de création du contact |
| **Conservé** | `email`, `subject`, `body`, `status` — nécessaires pour l'envoi et les filtres |

**Migration :** `prisma db push --accept-data-loss` (les anciens contacts ont été purgés)

---

## 🔧 2. Backend — `server.js`

### Fonctions supprimées
- **`generateEmail(contact)`** (lignes 112-139) → la génération est maintenant pilotée par l'utilisateur

### Fonctions ajoutées
- **`detectEmailColumn(headers, rows)`** — détection automatique de la colonne email :
  - Étape 1 : cherche `"adresse mail"` exact (insensible à la casse)
  - Étape 2 : fallback — parcourt les 20 premières lignes pour trouver une colonne contenant `@`

### Route modifiée : `POST /api/upload`
**Avant :** Parsait les colonnes en dur (`Nom du Contact`, `Structure / Laboratoire`, etc.), générait l'email avec `generateEmail()`, insérait directement en base.

**Après :** Parse **dynamiquement** la 1ère ligne comme headers (via `XLSX.utils.sheet_to_json` avec `{ header: 1 }`), détecte la colonne email, retourne au frontend :
```json
{
  "headers": ["Nom", "Labo", "Ville", "Adresse Mail"],
  "rows": [["Dr X", "INSERM", "Tours", "x@test.com"], ...],
  "rowCount": 42,
  "emailColumn": { "index": 3, "method": "header", "label": "Adresse Mail" },
  "preview": [...]
}
```

### Nouvelle route : `POST /api/campaign`
Reçoit les contacts déjà compilés (template remplacé par les valeurs) et les insère en base :
```json
{
  "contacts": [
    { "email": "x@test.com", "subject": "...", "body": "...", "rawData": {...} }
  ]
}
```

---

## 🎨 3. Frontend HTML — `public/index.html`

### Ajout : Modale de configuration de campagne
Nouveau bloc HTML (`#campaignModalOverlay`) contenant :

| Élément | ID | Rôle |
|---------|-----|------|
| Barre des variables | `#campaignTagsBar` | Puces cliquables générées depuis les headers Excel |
| Indicateur email | `#detectedEmailCol` | Affiche le nom de la colonne email détectée automatiquement |
| Champ Sujet | `#campaignSubject` | Input pour le sujet avec support des variables `{{Nom}}` |
| Zone Corps | `#campaignBody` | Textarea redimensionnable pour le corps du message |
| Bouton Générer | `#campaignGenerateBtn` | Compile le template pour chaque ligne → POST `/api/campaign` |

---

## 🎨 4. CSS — `public/style.css`

### Ajout : ~180 lignes de styles pour la modale "Dark AI / Futuriste"

| Élément | Style |
|---------|-------|
| Fond modale | `rgba(26, 29, 36, 0.92)` + `backdrop-filter: blur(12px)` (glassmorphism) |
| Bordure | `1px solid rgba(255, 255, 255, 0.08)`, radius `20px` |
| Tags | Fond `rgba(0, 229, 255, 0.08)`, bordure cyan, texte `#00e5ff`, glow au hover |
| Inputs | Fond `#111318`, bordure invisible au repos, glow cyan `#00e5ff` au focus |
| Bouton primaire | Fond cyan `#00e5ff`, texte noir `#0a0a0a`, radius `12px` |
| Light mode | Adaptation automatique via `@media (prefers-color-scheme: light)` |

---

## 🧠 5. JavaScript — `public/app.js`

### Fonctions ajoutées

| Fonction | Description |
|----------|-------------|
| `detectEmailColumn(headers, rows)` | Même algorithme que le backend — détection auto de la colonne email |
| `compileTemplate(template, row, headers)` | Remplace `{{NomColonne}}` par la valeur de la cellule correspondante |
| `insertVariableAtCursor(variableName)` | Insère `{{variable}}` à la position du curseur dans l'input/textarea actif |
| `openCampaignModal(headers, rows, emailCol)` | Ouvre la modale, génère les tags, bind les événements |
| `closeCampaignModal()` | Ferme la modale et nettoie le state |
| `handleCampaignGenerate()` | Compile le template pour chaque ligne → `POST /api/campaign` → rafraîchit les contacts |
| `handleFileUpload(file)` | Nouveau handler d'upload : parse → détecte email → ouvre la modale |

### Flux utilisateur modifié

```
AVANT : Upload Excel → Parse (colonnes en dur) → generateEmail() → Insert DB → Afficher contacts
APRÈS : Upload Excel → Parse (dynamique) → Modale config → Template utilisateur → Compile → POST /api/campaign → Insert DB → Afficher contacts
```

### Interactions clavier
- `Escape` ferme la modale de campagne (priorité après batch sending)

---

## ✅ Algorithmes validés

Testé avec succès via Node.js :

| Test | Résultat |
|------|----------|
| Détection par header `"Adresse Mail"` | ✅ `{"index":1,"method":"header","label":"Adresse Mail"}` |
| Détection par contenu (`@`) | ✅ `{"index":1,"method":"content","label":"Email Pro"}` |
| Aucune colonne email | ✅ `null` |
| Compilation template `{{Nom}}` | ✅ `"Bonjour Dr Martin, votre labo INSERM U1234 à Tours"` |

---

## 📁 Fichiers impactés

| Fichier | Action | Lignes modifiées |
|---------|--------|-----------------|
| `prisma/schema.prisma` | Modifié | Modèle Contact refondu |
| `server.js` | Modifié | `generateEmail()` supprimée, `POST /api/upload` refait, `POST /api/campaign` ajouté |
| `public/index.html` | Modifié | Modale `#campaignModalOverlay` ajoutée (~50 lignes HTML) |
| `public/style.css` | Modifié | Styles campagne ajoutés (~180 lignes CSS) |
| `public/app.js` | Modifié | Logique templating + campagne ajoutée (~350 lignes JS) |

---

## 🔜 Prochaines étapes possibles

- [ ] Ajouter un drag & drop des tags dans le textarea
- [ ] Prévisualisation en temps réel du rendu pour une ligne sélectionnée
- [ ] Sauvegarde des templates utilisateur (modèles réutilisables)
- [ ] Support de pièces jointes personnalisées par contact

---

# 🎨 MAJ 6 — Remplacement icône campagne par icone-logo.png
**Date :** 30/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Remplacement de l'icône SVG (enveloppe) dans le header du modal "Configuration du message" par l'image `icone-logo.png`.

## 🔧 Modifications

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/index.html` | Modifié | Dans `#campaignModal`, remplacement du `<svg>` (enveloppe) dans `.campaign-header-icon` par `<img src="icone-logo.png" alt="Campagne" style="width:100%;height:100%;object-fit:contain;" />` |
| `public/icone-logo.png` | Ajouté | Copie de l'image racine dans `public/` car Express sert les fichiers statiques depuis ce dossier |

---

# 🎨 MAJ 2 — Champ "Nom ou structure" & Refonte Badges
**Date :** 30/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé des modifications

Cette mise à jour ajoute un champ **"Nom ou structure"** dans la modale de configuration de campagne, permettant à l'utilisateur de choisir quelle colonne Excel servira de nom affiché dans les cards. Elle corrige également le comportement des tags (perte de focus) et refond le style des badges de statut.

---

## 🎨 1. CSS — `public/style.css`

### Refonte des badges `.card-badge`
| État | Avant | Après |
|------|-------|-------|
| **Base** | pas de fond fixe | `background: #94A3B8; color: #FFFFFF` |
| **.sent (Envoyé)** | `background: var(--success-light)` | `background: #94A3B8; color: #FFFFFF` |
| **.pending (En attente)** | `background: #DEE2E6; color: #32324A` | **Texte en dégradé** `linear-gradient(135deg, rgb(224, 231, 255), rgb(255, 107, 107))` appliqué via `background-clip: text` |

### Nouveau composant : `.campaign-select`
- Select stylisé pour le campaign modal (cohérent avec `.campaign-input`)
- Flèche dropdown custom en SVG inline
- Variantes light mode via `@media (prefers-color-scheme: light)`
- `.campaign-hint` pour le texte d'aide sous le select

---

## 🧩 2. HTML — `public/index.html`

### Ajout dans la campagne form
Nouveau bloc avant le champ sujet :
```html
<div class="campaign-form-group">
  <label class="campaign-label" for="campaignNameColumn">Nom ou structure</label>
  <select id="campaignNameColumn" class="campaign-select">
    <option value="">— Colonne ignorée (Sans nom) —</option>
  </select>
  <p class="campaign-hint">Sélectionnez la colonne qui servira de nom dans les cartes. Laissez vide pour "Sans nom".</p>
</div>
```

---

## 🧠 3. JavaScript — `public/app.js`

### Corrections
| Problème | Solution |
|----------|----------|
| **Perte de focus au clic sur un tag** | Les tags utilisent maintenant `mousedown` + `e.preventDefault()` au lieu de `click`, ce qui préserve le focus sur le champ actif (sujet ou textarea) avant l'insertion de la variable |

### Ajouts
| Fonction | Description |
|----------|-------------|
| `campaignNameColumnSelect` | Nouvelle ref DOM pour le select "Nom ou structure" |
| Population dynamique du select | Dans `openCampaignModal()`, le select est rempli avec toutes les colonnes (sauf la colonne email) |
| `handleCampaignGenerate()` | Récupère l'index de la colonne sélectionnée, extrait la valeur pour chaque ligne, et l'envoie comme champ `name` dans le POST `/api/campaign` |

### Flux modifié
```
AVANT : contactData = { email, subject, body, rawData }
APRÈS : contactData = { email, name, subject, body, rawData }
         └─ name = valeur de la colonne sélectionnée (ou "" → "Sans nom")
```

---

## 🔧 4. Backend — `server.js`

### Route modifiée : `POST /api/campaign`
Ajout du champ `name` dans les données insérées :
```javascript
.map(c => ({
  userId: user.id,
  email: c.email.trim(),
  name: c.name || '',       // ← NOUVEAU
  subject: c.subject || '',
  body: c.body || '',
  rawData: c.rawData || {},
  status: 'pending',
}));
```

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/style.css` | Modifié | `.card-badge` refondu, `.campaign-select` et `.campaign-hint` ajoutés |
| `public/index.html` | Modifié | Champ `#campaignNameColumn` ajouté dans le campaign form |
| `public/app.js` | Modifié | Populate select, fix focus tags (`mousedown`), envoi du champ `name` |
| `server.js` | Modifié | Route `/api/campaign` : ajout du champ `name` |

---

# 🔧 MAJ 3 — Correctif : champ `name` manquant dans le modèle Prisma
**Date :** 30/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

**Bug :** L'insertion de contacts via Excel échouait silencieusement après la MAJ 2. Le serveur tentait d'insérer le champ `name` dans la table `Contact` mais la colonne n'existait pas en base de données, car le `prisma/schema.prisma` n'avait pas été mis à jour.

**Symptôme :** Les contacts restaient bloqués en statut `"pendin..."` (tronqué) après soumission du formulaire de campagne.

## 🔍 Cause racine

| Composant | Champ `name` |
|-----------|-------------|
| `prisma/schema.prisma` — modèle `Contact` | ❌ Absent (oubli de la MAJ 2) |
| `server.js` l. 496 — `POST /api/campaign` | ✅ `name: c.name \|\| ''` |
| `public/app.js` — `handleCampaignGenerate()` | ✅ envoie le champ `name` |

Le `server.js` et le frontend avaient été modifiés pour supporter le champ `name`, mais le schéma Prisma n'avait pas été synchronisé. Prisma rejetait donc l'insertion → erreur silencieuse → contacts non créés.

## 🔧 Correctif

1. **`prisma/schema.prisma`** : Ajout du champ `name String @default("")` dans le modèle `Contact`
2. **Migration** : `npx prisma db push` (ajout de colonne sans perte de données)
3. **Rebuild Docker** : `docker compose up -d --build --force-recreate mailcandid`

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `prisma/schema.prisma` | Modifié | Ajout du champ `name` dans le modèle `Contact` |

---

# 🎨 MAJ 4 — Remplacement du logo et texte "MailCandid" par l'image logo.png
**Date :** 30/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Remplacement de l'icône SVG + texte "MailCandid" sur la page de connexion par l'image `logo.png`.

## 🔧 Modifications

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/logo.png` | Ajouté | Copie de l'image logo.png à la racine dans le dossier public |
| `public/index.html` | Modifié | Dans la `#loginSection`, remplacement du bloc `<div class="login-logo-icon">` + `<h1 class="login-brand-name">MailCandid</h1>` par `<img src="logo.png" alt="MailCandid" class="login-logo-img" />` |
| `public/style.css` | Modifié | Suppression des styles `.login-logo-icon` et `.login-brand-name`, ajout du style `.login-logo-img { max-width: 200px; height: auto; display: block; }` |

**MAJ 4.1** (30/07/2026) : Logo agrandi (×1.6, max-width 200→320px) + header app également migré vers `logo.png` (`.brand-logo-img`, max-width 160px)

---

# 🏷️ MAJ 5 — Footer IMPETUS™ sur les pages connexion et accueil
**Date :** 30/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Ajout d'un footer commun "IMPETUS™ — Développé par HIDA Yacine — Propriété intellectuelle exclusive déposée" sur la page de connexion et la page d'accueil.

## 🔧 Modifications

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/index.html` | Modifié | Ajout de `#login-impetus-footer` dans `#loginSection` (après la card) et de `<footer class="app-impetus-footer">` dans `#appSection` (après `</main>`) |
| `public/style.css` | Modifié | Ajout des styles `.login-impetus-footer`, `.app-impetus-footer`, `.impetus-brand`, `.impetus-tm`, `.impetus-sep`, `.impetus-dev`, `.impetus-legal` (~50 lignes) |

### Styles clés
- **Page connexion** : footer `position: absolute; bottom: 1rem`, couleur `rgba(148, 163, 184, 0.35)`
- **Page accueil** : footer intégré dans le flow, bordure top `1px solid var(--border-light)`, background `var(--bg-card)`
- **Marque "IMPETUS"** : couleur `var(--accent)`, bold, letter-spacing 0.08em
- **™** : format exposant en `0.5rem`

---

# 🎨 MAJ 7 — Correction bouton "Se connecter avec Outlook"
**Date :** 31/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction complète du bouton "Se connecter avec Outlook" qui n'était pas fonctionnel (clic inopérant, aspect visuel non conforme). Le bouton a été aligné sur les mêmes normes que le bouton "Se connecter avec Google".

---

## 🔴 Problèmes identifiés

### 1. CSS cassé (bloc `.btn-google:active` vide + lignes orphelines)
Dans `style.css` lignes 726-756, le bloc `.btn-google:active` était vide et mal fermé, ce qui "avalait" le sélecteur `.btn-outlook` et cassait le parsing CSS du navigateur. Cela empêchait :
- Le rendu correct du bouton Outlook
- Potentiellement l'interactivité du bouton (le navigateur ignore les règles cassées)

### 2. SVG Outlook minimaliste
Le SVG était un simple rectangle bleu avec un "O", sans les couleurs officielles Microsoft, contrairement au SVG Google qui est multicolore et détaillé.

### 3. Style incohérent
Le bouton Outlook avait un fond bleu uni (`#0078D4`) avec texte blanc, alors que Google a un fond blanc avec texte sombre et ombre subtile.

---

## 🔧 Modifications

### `public/style.css`

| Changement | Détail |
|-----------|--------|
| **Bloc `.btn-google:active`** | Réparé : contient désormais `transform: translateY(0);` (était vide) |
| **Bloc `.btn-outlook`** | Refondu avec les mêmes propriétés que `.btn-google` : fond `white`, texte `#1e293b`, même ombre, même padding/gap/font |
| **Bloc `.btn-outlook:hover`** | Aligné sur `.btn-google:hover` : fond `#f8fafc`, ombre `0 4px 16px rgba(0,0,0,0.15)` |
| **Bloc `.btn-outlook:active`** | Conservé : `transform: translateY(0);` |
| **Lignes orphelines** | Suppression de `transform: translateY(0);` et `}` hors de tout bloc |
| **Correctif CSS préexistant** | `color: ##ffd1d1` → `color: #ffd1d1` (double `#` corrigé ligne 2423) |

### `public/index.html`

| Changement | Détail |
|-----------|--------|
| **SVG Outlook** | Remplacé par un logo officiel Microsoft Outlook avec les couleurs : `#0078D4`, `#0072C6`, `#00A2ED`, `#005DA6` et un "O" blanc sur fond bleu |

### `public/app.js`
Aucune modification nécessaire — le code JS était déjà correct. L'event listener sur `#outlookLoginBtn` redirige bien vers `/api/auth/outlook`.

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `public/style.css` | Modifié | Réparation CSS cassé + uniformisation `.btn-outlook` + correction `##ffd1d1` |
| `public/index.html` | Modifié | Remplacement SVG Outlook par logo officiel Microsoft |
| `public/app.js` | Aucun | Code JS déjà correct ✅ |

---

# 🔐 MAJ 8 — Correction erreur AADSTS90019 (tenant Outlook consumers)
**Date :** 31/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction de l'erreur **AADSTS90019: No tenant-identifying information found** qui empêchait la connexion via le bouton Outlook. L'erreur était due à 3 problèmes cumulatifs : **tenant incorrect**, **CLIENT_ID interverti avec CLIENT_SECRET**, et **secret périmé**.

---

## 🔴 Problèmes identifiés

| Problème | Valeur avant | Valeur après | Impact |
|----------|-------------|--------------|--------|
| **Tenant hardcodé** | `'organizations'` | `process.env.OUTLOOK_TENANT \|\| 'consumers'` | L'app Azure est enregistrée en "Personal Microsoft accounts" → oblige le tenant `consumers` |
| **OUTLOOK_CLIENT_ID** | `fr58Q~e...` (un secret) | `49b36ed7-3777-4ade-be34-42747092d21b` (le vrai GUID) | Le client ID était en réalité un secret, inversion ID/secret |
| **OUTLOOK_CLIENT_SECRET** | `ff4ba6fe-...` (périmé) | `GW~8Q~qC5Z_...` (nouveau secret généré) | Secret régénéré dans Azure Entra ID |

---

## 🔧 Modifications

### `.env`

| Variable | Action | Valeur |
|----------|--------|--------|
| `OUTLOOK_CLIENT_ID` | Corrigé | `49b36ed7-3777-4ade-be34-42747092d21b` |
| `OUTLOOK_CLIENT_SECRET` | Remplacé | `GW~8Q~...` (nouveau secret Azure) |
| `OUTLOOK_TENANT` | **Ajouté** | `consumers` |

### `src/auth.js`

| Fonction | Changement |
|----------|------------|
| `getOutlookAuth()` | Le tenant n'est plus hardcodé à `'organizations'` mais lit `process.env.OUTLOOK_TENANT \|\| 'consumers'` |
| `refreshOutlookToken()` | L'URL de refresh utilise désormais le tenant dynamique : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token` |

### `test-outlook-auth.sh` (nouveau)

Script de diagnostic complet qui vérifie :
1. Présence et validité (format GUID) du `OUTLOOK_CLIENT_ID`
2. Définition du `OUTLOOK_CLIENT_SECRET` et `OUTLOOK_TENANT`
3. Connectivité au serveur Express
4. Route `/api/auth/outlook` → redirection 302 vers `login.microsoftonline.com`
5. Tenant `consumers` présent dans l'URL d'autorisation
6. Client ID correct transmis à Microsoft
7. Scopes `Mail.Send` inclus
8. Cookies OAuth (`outlook_oauth_state`, `outlook_oauth_code_verifier`, `outlook_oauth_redirect_uri`) correctement définis

> Usage : `chmod +x test-outlook-auth.sh && ./test-outlook-auth.sh`

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `.env` | Modifié | `OUTLOOK_CLIENT_ID` corrigé, `OUTLOOK_CLIENT_SECRET` remplacé, `OUTLOOK_TENANT` ajouté |
| `src/auth.js` | Modifié | Tenant dynamique dans `getOutlookAuth()` et `refreshOutlookToken()` |
| `test-outlook-auth.sh` | **Créé** | Script de diagnostic OAuth Outlook (240 lignes) |

---

## 🔜 Rappel — Configuration Azure AD

| Propriété | Valeur |
|-----------|--------|
| Application | Impetus |
| Client ID | `49b36ed7-3777-4ade-be34-42747092d21b` |
| Tenant ID | `873627c9-a3e9-47d1-8c9d-8970da049289` |
| Type comptes | Utilisateurs de compte Microsoft personnel |
| Redirect URI | `http://localhost:3001/api/auth/outlook/callback` |

---

# 🔧 MAJ 10 — Correction `The column User.microsoftId does not exist` + Migration SQLite
**Date :** 01/08/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction de l'erreur `The column User.microsoftId does not exist in the current database` qui empêchait toute connexion via Microsoft Outlook. L'erreur était due à une **incohérence totale entre le schéma Prisma, la config Docker, la base de données et l'adaptateur**.

---

## 🔴 Problèmes identifiés

| Problème | Avant | Après | Impact |
|----------|-------|-------|--------|
| **Provider Prisma** | `postgresql` (Neon) | `sqlite` | Le `docker-compose.yml` utilise SQLite (volume local), pas PostgreSQL |
| **Migration Prisma** | Aucune (dossier vide) | `prisma/migrations/20260731191622_init/` | La table `User` n'avait jamais été créée en base |
| **`prisma.config.ts`** | `datasources.db.provider: "postgresql"` | Nettoyé, pas de datasources | Format invalide Prisma v7 |
| **`src/db.js`** | `@prisma/adapter-pg` + `PrismaPg` | `@prisma/adapter-better-sqlite3` + `PrismaBetterSqlite3` | L'adaptateur PostgreSQL était incompatible avec SQLite |
| **`docker-compose.yml`** | `DATABASE_URL=${DATABASE_URL:-...}` héritait `.env` (Neon) | `DATABASE_URL=file:/app/prisma/dev.db` (forcée) | Le container utilisait l'URL PostgreSQL de Neon |
| **`docker-entrypoint.sh`** | Skip des migrations ("PostgreSQL Neon est gérée en externe") | `npx prisma migrate deploy` | Les migrations n'étaient jamais appliquées |
| **`.dockerignore`** | `prisma/migrations/` exclu | Non exclu | Les migrations n'étaient pas copiées dans l'image |
| **`Dockerfile` — Node** | `node:20-alpine` | `node:22-alpine` | `better-sqlite3@13.x` exige Node ≥ 22 |
| **`Dockerfile` — build** | Pas d'outils de compilation natifs | `apk add python3 make g++` | `better-sqlite3` nécessite une compilation native |
| **`Dockerfile` — order** | `npm ci` avec `--ignore-scripts` OK | `npm rebuild better-sqlite3` après `prisma generate` | Ordre corrigé : installer → schema → generate → rebuild |
| **`prisma/schema.prisma`** | `url = env("DATABASE_URL")` dans `datasource` | Retiré (non supporté Prisma v7) | Erreur P1012 |

---

## 🔧 Modifications

### Fichiers modifiés

| Fichier | Action | Détail |
|---------|--------|--------|
| `prisma/schema.prisma` | Modifié | Provider `postgresql` → `sqlite`, retrait de `url`, type `rawData` de `Json` → `String` |
| `prisma.config.ts` | Modifié | Suppression `datasources` invalide, simplification |
| `src/db.js` | **Refondu** | Suppression `@prisma/adapter-pg`, utilisation `@prisma/adapter-better-sqlite3` + `PrismaBetterSqlite3` |
| `docker-compose.yml` | Modifié | `DATABASE_URL` forcée à `file:/app/prisma/dev.db` |
| `docker-entrypoint.sh` | Modifié | Exécute `npx prisma migrate deploy` au démarrage |
| `.dockerignore` | Modifié | Ne plus exclure `prisma/migrations/` |
| `Dockerfile` | Modifié | Node 22, outils build natifs, COPY migrations, ordre des étapes corrigé |

### Nouveaux paquets installés

| Paquet | Version |
|--------|---------|
| `@prisma/adapter-better-sqlite3` | ^7.8.0 |
| `better-sqlite3` | ^13.0.2 |

---

## 📁 Migration créée

```
prisma/migrations/
  └─ 20260731191622_init/
    └─ migration.sql
```

Tables créées : `User`, `Session`, `Document`, `Contact`

---

## ✅ Vérification

Le container Docker est **healthy** et l'application répond sur `http://localhost:3001`. La colonne `microsoftId` existe maintenant bien en base.

```bash
$ docker ps --filter name=mailcandid-backend
Up 41 seconds (healthy) 0.0.0.0:3001->3001/tcp
```

---

## 🔜 À surveiller

- Le volume Docker `sqlite_data` peut contenir une ancienne base incompatible. Si des erreurs persistent, supprimer le volume : `docker volume rm mailcandid_sqlite_data` puis `docker compose up -d`.

---

# 🔐 MAJ 9 — Correction erreur 403 Microsoft Graph /me (ID token)
**Date :** 31/07/2026  
**Projet :** MailCandid — Automatisation d'envoi de candidatures

---

## 📋 Résumé

Correction de l'erreur **403 Microsoft Graph /me** qui empêchait la connexion Outlook après l'échange du code d'autorisation. La cause : l'appel à `GET https://graph.microsoft.com/v1.0/me` nécessite le scope **`User.Read`** qui n'était pas demandé lors du login.

---

## 🔴 Problème identifié

| Élément | Détail |
|----------|--------|
| **Scopes demandés au login** | `openid profile email offline_access Mail.Send` |
| **Scope manquant** | `User.Read` (nécessaire pour `/me`) |
| **Symptôme** | `Error: Échec Microsoft Graph /me (403)` avec `"code":"UnknownError"` |

---

## 🔧 Solution : Option B — Extraction depuis l'ID token

Plutôt que d'ajouter le scope `User.Read` (option A, qui nécessite une reconfiguration Azure + un appel HTTP supplémentaire), les infos utilisateur sont extraites **directement depuis l'ID token JWT** fourni par Azure AD.

Avantages :
- **Aucun appel HTTP supplémentaire** à Microsoft Graph
- **Pas de scope API additionnel** à configurer dans Azure AD
- **Plus rapide** (pas de latence réseau)
- L'ID token contient déjà `sub`, `email`, `upn`, `name` via les scopes `openid profile email`

---

## 🔧 Modifications

### `server.js` — Route `GET /api/auth/outlook/callback`

| Section | Changement |
|---------|------------|
| **Étape 4 (avant)** | `fetch('https://graph.microsoft.com/v1.0/me')` → 403 |
| **Étape 4 (après)** | Extraction du payload JWT depuis `tokens.idToken()` → décodage base64url → parsing JSON |
| **Fallback** | Si l'ID token est absent, fallback vers `/me` (robustesse) |

Champs extraits de l'ID token :
```javascript
{
  sub: claims.sub || claims.oid,
  mail: claims.email || claims.preferred_username || claims.upn,
  userPrincipalName: claims.upn || claims.preferred_username,
  displayName: claims.name
}
```

Aucune modification nécessaire dans `src/auth.js` car `createUserFromMicrosoft()` accepte déjà la même structure d'objet (`{ sub, mail, userPrincipalName, displayName }`).

---

## 📁 Fichiers impactés

| Fichier | Action | Détail |
|---------|--------|--------|
| `server.js` | Modifié | Lignes 480-508 : remplacement appel `/me` par extraction ID token JWT |