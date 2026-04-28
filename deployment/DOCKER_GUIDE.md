# Guide Docker — Automatisation MAIL

## Prérequis

- **Docker** installé (v24+) et **Docker Compose** (v2+)
- Vérifier que Docker est en cours d'exécution :
  ```bash
  docker info
  ```

## Structure Docker du projet

```
.
├── Dockerfile          # Multi-stage build (builder → production)
├── docker-compose.yml  # Orchestration du service
├── .dockerignore       # Exclusion de fichiers du contexte Docker
└── .env                # Variables d'environnement (non versionné)
```

## Construction de l'image

```bash
# Depuis la racine du projet
docker build -t automatisation-mail:latest .
```

Ou plus explicitement :

```bash
docker build -t automatisation-mail:latest \
  -f Dockerfile \
  --no-cache \
  .
```

## Démarrage avec Docker Compose

### 1. Vérifier le fichier `.env`

Assurez-vous que le fichier `.env` existe et contient les variables requises :

```env
SMTP_USER=anika.mohammad@etu.univ-tours.fr
SMTP_PASS=********
ZIMBRA_URL=https://webmailetu-zimbra.univ-tours.fr
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
PORT=3000
NODE_ENV=production
DATABASE_URL=file:./dev.db
```

> ⚠️ **Important** : Le fichier `.env` est lu automatiquement par Docker Compose.

### 2. Présence du fichier PDF

Le fichier `CV_LETTRE_DE_RECOMMANDATION.pdf` doit être présent à la racine du projet. Il est monté en volume (lecture seule) dans le conteneur.

### 3. Lancer le service

```bash
docker compose up -d
```

### 4. Vérifier que le conteneur tourne

```bash
docker compose ps
```

### 5. Voir les logs

```bash
docker compose logs -f
```

### 6. Arrêter le service

```bash
docker compose down
```

Pour supprimer aussi les volumes (⚠️ supprime la BDD et les uploads) :

```bash
docker compose down -v
```

## Volumes persistants

| Volume | Chemin conteneur | Utilité |
|--------|-----------------|---------|
| `mailcandid_sqlite_data` | `/app/prisma/` | Base de données SQLite |
| `mailcandid_uploads_data` | `/app/uploads/` | Documents uploadés par les utilisateurs |

## Détails du Dockerfile

### Multi-stage build

1. **Builder** (`FROM node:20-alpine AS builder`)
   - Installation de toutes les dépendances (y compris `prisma` en devDep)
   - Génération du client Prisma

2. **Production** (`FROM node:20-alpine AS production`)
   - Installation des dépendances de production uniquement (`--omit=dev`)
   - Copie du client Prisma généré depuis le builder
   - Création d'un utilisateur non-root (`appuser`)
   - Healthcheck HTTP
   - Utilisateur non-root par défaut

### Améliorations par rapport à l'ancien Dockerfile

| Ancien | Nouveau |
|--------|---------|
| `npm install --omit=dev` (prisma manquant) | Build multi-stage avec `npm ci` |
| Prisma generate non exécuté | `npx prisma generate` dans le builder |
| Pas de `.dockerignore` | `.dockerignore` complet |
| Pas de healthcheck | `HEALTHCHECK` avec wget |
| Root user | Utilisateur non-root `appuser` |
| Aucun volume persistant | Volumes pour SQLite et uploads |

## Commandes utiles

```bash
# Voir l'image construite
docker images automatisation-mail

# Voir la taille de l'image
docker images automatisation-mail --format "{{.Size}}"

# Inspecter l'image
docker inspect automatisation-mail:latest

# Exécuter un shell dans le conteneur en cours
docker exec -it mailcandid-backend sh

# Tester le healthcheck manuellement
docker inspect --format='{{json .State.Health}}' mailcandid-backend
```

## Dépannage

### L'image ne se construit pas

Vérifier que Docker est bien démarré :
```bash
open -a Docker
```

### Erreur "PrismaClientInitializationError"

Le client Prisma n'a pas été généré. Vérifier que le build multi-stage fonctionne :
```bash
docker build --no-cache -t automatisation-mail:latest .
```

### Base de données réinitialisée

Les données sont dans le volume `mailcandid_sqlite_data`. Pour les récupérer après un `docker compose down -v` :
- Les fichiers `.db` sont dans `/app/prisma/` dans le conteneur
- Les migrations Prisma sont dans `/app/prisma/migrations/`

⚠️ **Ne pas faire `docker compose down -v` en production** sans avoir sauvegardé la BDD.

## Déploiement sur un serveur

1. Transférer les fichiers nécessaires :
   ```bash
   rsync -avz --exclude='node_modules' --exclude='.git' \
     . user@serveur:/app/automatisation-mail/
   ```

2. Configurer le `.env` sur le serveur

3. Lancer avec Docker Compose :
   ```bash
   cd /app/automatisation-mail
   docker compose up -d
   ```

4. Configurer un reverse proxy (nginx/caddy) pour exposer le port 3000 avec HTTPS
