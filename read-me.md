# 📧 MailCandid — Plateforme d'Automatisation de Candidatures

> **Documentation technique approfondie** — Architecture, flux, déploiement, et maintenance.

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture technique](#2-architecture-technique)
3. [Stack technologique](#3-stack-technologique)
4. [Schéma de base de données](#4-schéma-de-base-de-données)
5. [Flux métier détaillé](#5-flux-métier-détaillé)
6. [Système d'authentification](#6-système-dauthentification)
7. [Envoi d'emails : double moteur](#7-envoi-demails--double-moteur)
8. [Frontend : Dashboard AI Futuriste](#8-frontend--dashboard-ai-futuriste)
9. [Structure du projet](#9-structure-du-projet)
10. [Déploiement](#10-déploiement)
11. [Configuration et variables d'environnement](#11-configuration-et-variables-denvironnement)
12. [Sécurité](#12-sécurité)
13. [Dépannage](#13-dépannage)

---

## 1. Présentation du projet

**MailCandid** est une application web full-stack qui automatise l'envoi de candidatures spontanées personnalisées pour des stages de Master en Imagerie Biomédicale Multimodale. L'application permet de :

1. **Importer** un fichier Excel contenant une liste de contacts (chercheurs, laboratoires)
2. **Générer automatiquement** des emails personnalisés à partir d'un template
3. **Éditer** individuellement le sujet et le corps de chaque email
4. **Envoyer** les emails en masse via deux moteurs d'envoi distincts
5. **Suivre** l'état de chaque candidature (en attente / envoyée / supprimée)

Le projet est conçu pour être déployé dans un environnement **Docker** sur une machine locale macOS, avec exposition publique via un tunnel **ngrok** à domaine fixe, et un frontend hébergé séparément sur **Hostinger**.

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR CLIENT                                │
│                   (https://masdelsol-test.online)                       │
│                                                                         │
│  Le frontend (HTML/CSS/JS) est hébergé sur Hostinger.                   │
│  Il communique avec le backend via l'URL ngrok fixe.                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ HTTPS (fetch API)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TUNNEL NGROK                                    │
│          https://cytotropic-bipedally-ollie.ngrok-free.dev              │
│                                                                         │
│  Domaine fixe (plan gratuit ngrok).                                     │
│  Forward les requêtes HTTPS vers localhost:3001.                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ HTTP (localhost)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTENEUR DOCKER                                   │
│                   (mailcandid-backend)                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  server.js (Express v4)                                         │   │
│  │                                                                 │   │
│  │  Routes API :                                                   │   │
│  │  ├── /api/auth/zimbra      → Auth Zimbra SOAP                   │   │
│  │  ├── /api/auth/google      → Google OAuth2 (Arctic + PKCE)     │   │
│  │  ├── /api/auth/logout      → Déconnexion                        │   │
│  │  ├── /api/me               → Profil utilisateur                 │   │
│  │  ├── /api/upload           → Import Excel                       │   │
│  │  ├── /api/contacts         → CRUD contacts                      │   │
│  │  ├── /api/send/:id         → Envoi unitaire                     │   │
│  │  ├── /api/send-all         → Envoi en masse                     │   │
│  │  ├── /api/test-send        → Mail de test                       │   │
│  │  └── /api/documents/*      → Gestion pièces jointes             │   │
│  │                                                                 │   │
│  │  Middleware :                                                    │   │
│  │  ├── CORS (ngrok + localhost)                                   │   │
│  │  ├── requireAuth (Lucia sessions)                               │   │
│  │  ├── Logging structuré                                          │   │
│  │  ├── Gestion globale d'erreurs                                  │   │
│  │  └── Gestion uncaughtException / unhandledRejection             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  src/auth.js — Système d'authentification                       │   │
│  │  ├── Lucia v3 (sessions)                                        │   │
│  │  ├── Adapter Prisma (PostgreSQL)                                │   │
│  │  ├── Arctic v3 (Google OAuth2 PKCE)                             │   │
│  │  └── Refresh token Google automatique                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Moteurs d'envoi d'emails                                       │   │
│  │  ├── src/gmail-client.js    → Gmail API REST                    │   │
│  │  └── src/zimbra-client.js   → Zimbra SOAP (HTTPS 443)           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  src/db.js — Prisma Client (instance unique)                    │   │
│  │  ├── Adapter PostgreSQL (@prisma/adapter-pg)                    │   │
│  │  ├── Connection pool limité à 3 (Neon gratuit)                  │   │
│  │  └── SSL/TLS verify-full                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               │ PostgreSQL (TLS)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BASE DE DONNÉES (Neon PostgreSQL)                     │
│                                                                         │
│  Tables :                                                               │
│  ├── User       (utilisateurs OAuth/Google ou Zimbra)                  │
│  ├── Session    (sessions Lucia)                                        │
│  ├── Contact    (contacts importés + emails générés)                    │
│  └── Document   (pièces jointes uploadées par utilisateur)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flux d'une requête type

```
1. L'utilisateur clique sur "Envoyer" dans le frontend Hostinger
2. Le frontend émet un fetch POST vers https://ngrok-url/api/send/42
3. ngrok forwarde la requête HTTPS vers localhost:3001 (Docker)
4. Express reçoit la requête → middleware CORS → middleware requireAuth
5. requireAuth valide le cookie de session Lucia
6. Prisma lit les tokens OAuth de l'utilisateur en base
7. Si authType === 'google' → gmail-client.js envoie via Gmail API
8. Si authType === 'zimbra' → zimbra-client.js envoie via Zimbra SOAP
9. Le statut du contact est mis à jour en base : 'sent'
10. Réponse JSON envoyée au frontend → toast de succès
```

---

## 3. Stack technologique

### 3.1 Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Node.js** | 20 (Alpine) | Runtime JavaScript |
| **Express** | 4.18+ | Framework HTTP / serveur web |
| **Prisma** | 7.8+ | ORM + migrations |
| **PostgreSQL** | Neon (serverless) | Base de données |
| **Lucia** | 3.2+ | Gestion de sessions (cookies httpOnly) |
| **Arctic** | 3.7+ | Client OAuth2 Google (PKCE) |
| **Google APIs** | 171+ | Gmail API (envoi d'emails) |
| **Axios** | 1.13+ | Client HTTP pour Zimbra SOAP |
| **fast-xml-parser** | 5.7+ | Parsing XML SOAP |
| **xlsx** | 0.18+ | Parsing Excel |
| **Multer** | 2.1+ | Upload de fichiers |
| **Nodemailer** | 6.9+ | Client SMTP (fallback non utilisé en production) |

### 3.2 Frontend

| Technologie | Rôle |
|-------------|------|
| **HTML5** | Structure SPA |
| **CSS3** | Design futuriste (dark theme, animations, grid, glass morphism) |
| **Vanilla JavaScript** | Logique applicative (pas de framework) |
| **Google Fonts (Inter)** | Typographie |

### 3.3 Infrastructure

| Technologie | Rôle |
|-------------|------|
| **Docker** | Conteneurisation multi-stage (node:20-alpine) |
| **Docker Compose** | Orchestration + volumes persistants |
| **ngrok** | Tunnel HTTPS avec domaine fixe |
| **Hostinger** | Hébergement frontend statique |
| **Neon** | PostgreSQL serverless (gratuit) |

---

## 4. Schéma de base de données

Le schéma Prisma définit **4 modèles** :

### 4.1 `User` — Utilisateurs authentifiés

```prisma
model User {
  id             String     @id @default(cuid())
  googleId       String?    @unique        // ID Google (sub)
  zimbraUsername String?    @unique        // Email Zimbra
  email          String?    @unique        // Email principal
  name           String?                   // Nom d'affichage
  picture        String?                   // Photo de profil (Google)
  accessToken    String?                   // Access token OAuth Google
  refreshToken   String?                   // Refresh token OAuth Google
  tokenExpiresAt DateTime?                 // Expiration du token
  authType       String     @default("google") // "google" ou "zimbra"
  sessions       Session[]                 // Sessions Lucia
  contacts       Contact[]                 // Contacts importés
  documents      Document[]               // Pièces jointes uploadées
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
}
```

**Deux modes d'authentification :**
- `authType = "google"` → L'utilisateur s'est connecté via Google OAuth. Les tokens `accessToken` et `refreshToken` sont stockés.
- `authType = "zimbra"` → L'utilisateur s'est connecté via Zimbra SOAP. Seul `zimbraUsername` est stocké.

**Isolation multi-utilisateur :** Chaque contact et document est rattaché à un `userId`. Les contacts orphelins (legacy, `userId: null`) sont visibles par tous les utilisateurs authentifiés pour la transition.

### 4.2 `Session` — Sessions Lucia

```prisma
model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(references: [id], fields: [userId], onDelete: Cascade)
}
```

Géré automatiquement par Lucia. Les sessions expirent et sont nettoyées automatiquement.

### 4.3 `Contact` — Contacts importés

```prisma
model Contact {
  id        Int      @id @default(autoincrement())
  userId    String?                     // Propriétaire (null = legacy)
  user      User?    @relation(...)
  name      String                      // Nom du contact (PI/Responsable)
  structure String                      // Structure/Laboratoire
  location  String                      // Localisation
  research  String                      // Axe de recherche principal
  email     String                      // Adresse email destinataire
  subject   String                      // Sujet de l'email (généré ou modifié)
  body      String                      // Corps de l'email (généré ou modifié)
  status    String   @default("pending") // "pending" | "sent" | "deleted"
}
```

**Cycle de vie d'un contact :**
1. `pending` — Importé depuis Excel, prêt à être envoyé
2. `sent` — L'email a été envoyé avec succès
3. `deleted` — Suppression logique (soft delete)

### 4.4 `Document` — Pièces jointes

```prisma
model Document {
  id           Int      @id @default(autoincrement())
  userId       String                      // Propriétaire
  user         User     @relation(...)
  filename     String                      // Nom sur le disque (timestampé)
  originalName String                      // Nom original du fichier
  mimetype     String   @default("application/pdf")
  size         Int                         // Taille en octets
  uploadedAt   DateTime @default(now())
}
```

**Limite :** 5 documents maximum par utilisateur. Seuls les PDF sont acceptés.

---

## 5. Flux métier détaillé

### 5.1 Workflow complet d'une campagne de candidatures

```
ÉTAPE 1 : Connexion
─────────────────────
- L'utilisateur arrive sur la landing page
- Deux options : "Se connecter avec Google" ou "Se connecter avec Zimbra"
- Google : redirection OAuth2 PKCE → callback → création session Lucia → redirection /
- Zimbra : appel SOAP AuthRequest → création session Lucia → réponse JSON
- La session est stockée dans un cookie httpOnly, secure, sameSite=lax

ÉTAPE 2 : Import des contacts
──────────────────────────────
- L'utilisateur dépose un fichier .xlsx dans la drop zone
- POST /api/upload (multipart/form-data)
- Le fichier est parsé avec la librairie xlsx
- Les colonnes attendues :
  - "Nom du Contact (PI / Responsable)"
  - "Structure / Laboratoire"
  - "Localisation"
  - "Axe de Recherche Principal"
  - "Adresse E-mail"
- Pour chaque ligne, un email est généré via la fonction generateEmail()
- Les contacts sont insérés en base (status = 'pending')

ÉTAPE 3 : Génération des emails
────────────────────────────────
- Template d'email :
  - Sujet : "Candidature Spontanée – M2 Imagerie Biomédicale Multimodale"
  - Corps : personnalisé avec nom, structure, localisation, axe de recherche
  - Signature fixe : MOHAMMAD ANIKA, M2 Imagerie Biomédicale Multimodale
- L'utilisateur peut modifier le sujet et le corps via la modale d'édition

ÉTAPE 4 : Envoi des emails
────────────────────────────
- Option A : Envoi unitaire → POST /api/send/:id
- Option B : Envoi batch (sélection) → POST /api/send/:id pour chaque sélectionné
- Option C : Envoi global → POST /api/send-all (tous les 'pending')
- Un délai de 1.5 seconde est appliqué entre chaque envoi
- Le moteur d'envoi est choisi selon authType de l'utilisateur
- La pièce jointe CV_LETTRE_DE_RECOMMANDATION.pdf est attachée automatiquement

ÉTAPE 5 : Suivi
───────────────
- Les contacts sont affichés avec leur statut (pending/sent/deleted)
- Filtres : Tous / En attente / Envoyés
- Barre de recherche par nom, structure, email
- Badges de statistiques dans le header (pending / sent / total)
```

### 5.2 Génération d'email personnalisé

La fonction `generateEmail()` dans `server.js` prend un objet contact et retourne un `{ subject, body }` :

```
Sujet : Candidature Spontanée – M2 Imagerie Biomédicale Multimodale

Corps :
Madame, Monsieur {name},

Je me permets de vous adresser ma candidature spontanée au sein de {structure},
en lien avec vos travaux de recherche en {research}.

Actuellement étudiante en deuxième année de Master en Imagerie Biomédicale
Multimodale à l'Université de Tours, je suis particulièrement intéressé par
le domaine de « {research} » développé au sein de votre équipe à {location}.

[...]

MOHAMMAD ANIKA
M2 Imagerie Biomédicale Multimodale
{email}
```

---

## 6. Système d'authentification

### 6.1 Double mode d'authentification

L'application supporte deux méthodes d'authentification, **non mutuellement exclusives** :

#### 6.1.1 Google OAuth2 (mode recommandé)

```
Flux OAuth2 PKCE (Proof Key for Code Exchange) :

1. GET /api/auth/google
   ├── Génère un code_verifier (PKCE) + state (CSRF)
   ├── Stocke state, code_verifier, redirect_uri dans des cookies httpOnly
   └── Redirige vers https://accounts.google.com/o/oauth2/v2/auth
       avec params : client_id, redirect_uri, scope, prompt=consent, access_type=offline

2. Google redirige vers /api/auth/google/callback?code=...&state=...
   ├── Vérifie state (anti-CSRF)
   ├── Récupère code_verifier depuis le cookie
   ├── Échange code + code_verifier contre tokens via Google API
   ├── Récupère les infos utilisateur (userinfo)
   ├── Crée/met à jour l'utilisateur en base (createUserFromGoogle)
   └── Crée une session Lucia → cookie → redirection / (frontend)

Scopes demandés :
- openid, profile, email → Infos utilisateur
- https://www.googleapis.com/auth/gmail.send → Envoi d'emails via Gmail API

Gestion du redirect_uri dynamique :
- Le redirect_uri est détecté automatiquement via les headers (x-forwarded-proto, x-forwarded-host)
- Cela permet de supporter ngrok, localhost, et la production sans changer le .env
```

#### 6.1.2 Zimbra SOAP

```
Flux :

1. POST /api/auth/zimbra
   ├── Appel SOAP AuthRequest → Zimbra
   ├── Récupération du authToken Zimbra (cache avec TTL)
   ├── Création de l'utilisateur en base (createUserFromZimbra)
   └── Création session Lucia → cookie

Le token Zimbra est caché en mémoire avec expiration automatique.
Les credentials SMTP sont stockés dans .env (SMTP_USER, SMTP_PASS).
```

### 6.2 Sessions Lucia

```javascript
// Configuration Lucia
const lucia = new Lucia(
  new PrismaAdapter(prisma.session, prisma.user),
  {
    sessionCookie: {
      attributes: {
        secure: process.env.NODE_ENV === 'production' && !process.env.LOCAL_DEV,
        sameSite: 'lax',
      },
    },
    getUserAttributes: (attributes) => ({
      id: attributes.id,
      email: attributes.email,
      name: attributes.name,
      picture: attributes.picture,
      authType: attributes.authType,
    }),
  }
);
```

**Caractéristiques :**
- Cookies `httpOnly` (inaccessibles au JavaScript)
- `secure` en production (HTTPS uniquement)
- `sameSite: 'lax'` (protection CSRF)
- Sessions persistantes en base PostgreSQL

### 6.3 Middleware `requireAuth`

```javascript
async function requireAuth(req, res, next) {
  const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
  if (!sessionId) return res.status(401).json({ error: 'Non authentifié.' });

  const { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user) return res.status(401).json({ error: 'Session invalide.' });

  req.user = user;
  next();
}
```

Appliqué à toutes les routes `/api/*` sauf `/api/auth/*`, `/api/test-auth`, `/api/test-send`.

---

## 7. Envoi d'emails : double moteur

### 7.1 Sélection du moteur

La fonction `sendEmailViaProvider()` dans `server.js` choisit automatiquement :

```javascript
if (user.authType === 'google' && user.accessToken) {
  // → Gmail API REST
} else {
  // → Zimbra SOAP (fallback)
}
```

### 7.2 Moteur Gmail API (`src/gmail-client.js`)

**Avantages :**
- L'email part avec l'adresse Gmail réelle de l'utilisateur
- Meilleure délivrabilité (SPF/DKIM Google)
- L'utilisateur voit les emails dans ses "Envoyés"

**Fonctionnement :**
1. Construction d'un message MIME conforme RFC 2822
2. Gestion des pièces jointes en multipart/mixed
3. Encodage base64url (RFC 4648 §5) requis par l'API Gmail
4. POST `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`

**Refresh token automatique :**
- Si l'API répond 401 (token expiré), le refresh token est utilisé
- `POST https://oauth2.googleapis.com/token` → nouveau access token
- Le nouveau token est stocké en base pour les prochains envois

**Structure du message MIME :**
```
From: {utf-8 encoded if non-ASCII}
To: {email}
Subject: {utf-8 encoded if non-ASCII}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="..."

--boundary
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

{corps de l'email}

--boundary
Content-Type: application/pdf; name="..."
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="..."

{PDF en base64, lignes de 76 caractères}

--boundary--
```

### 7.3 Moteur Zimbra SOAP (`src/zimbra-client.js`)

**Pourquoi Zimbra SOAP ?**
- L'université bloque le port SMTP standard (25/587/465)
- Zimbra utilise HTTPS (port 443), jamais bloqué
- L'API SOAP de Zimbra permet l'envoi complet (auth + upload + envoi)

**Fonctionnement :**
1. **Authentification** : SOAP `AuthRequest` → récupération `authToken`
   - Token mis en cache avec expiration automatique
   - Retry automatique (2 tentatives, backoff exponentiel)
2. **Upload pièce jointe** : POST multipart vers `/service/upload?fmt=raw`
   - Récupération de l'`aid` (attachment ID)
3. **Envoi** : SOAP `SendMsgRequest` avec le message + `aid`
   - Les headers non-ASCII sont encodés selon RFC 2047
   - Les caractères XML spéciaux sont échappés

**Gestion HTTPS :**
- Validation TLS standard par défaut
- Support d'un CA personnalisé via `ZIMBRA_CA_PATH`
- Option `ZIMBRA_INSECURE=true` pour désactiver la validation (déconseillé en production)

**Structure de la requête SOAP :**
```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      <authToken>TOKEN</authToken>
    </context>
  </soap:Header>
  <soap:Body>
    <SendMsgRequest xmlns="urn:zimbraMail">
      <m>
        <e t="f" a="expediteur@example.com" p="Nom Expéditeur"/>
        <e t="t" a="destinataire@example.com"/>
        <su>Sujet</su>
        <mp ct="text/plain">
          <content>Corps du message</content>
        </mp>
        <attach><aid>ID_PIECE_JOINTE</aid></attach>
      </m>
    </SendMsgRequest>
  </soap:Body>
</soap:Envelope>
```

---

## 8. Frontend : Dashboard AI Futuriste

### 8.1 Architecture SPA sans framework

Le frontend est une **Single Page Application** en vanilla JavaScript, sans React/Vue/Angular. Il est composé de :

| Fichier | Rôle |
|---------|------|
| `public/index.html` | Structure HTML complète (landing page + dashboard) |
| `public/style.css` | Styles CSS (dark theme, glass morphism, animations) |
| `public/app.js` | Logique applicative principale |
| `public/config.js` | Configuration (API_BASE_URL) |
| `public/digital-serenity.js` | Animation du fond SVG (grille + particules) |
| `public/limelight-nav.js` | Navigation avec effet spotlight |
| `public/glowing-shadow.js` | Effets d'ombre dynamiques sur les cartes |
| `public/test-refonte.js` | Tests de la refonte |

### 8.2 États de l'application

```
┌──────────────────────────────────────────────────────────────┐
│                    LANDING PAGE (#loginSection)              │
│                                                              │
│  - Fond SVG animé (DigitalSerenity)                         │
│  - Logo MailCandid + tagline                                │
│  - Bouton "Se connecter avec Google" (OAuth2)               │
│  - Bouton "Se connecter avec Zimbra" (SOAP)                 │
│  - Message de sécurité (cadenas)                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ Connexion réussie
                            ▼
┌──────────────────────────────────────────────────────────────┐
│            DASHBOARD (#appSection) — Navigation par onglets  │
│                                                              │
│  Header :                                                    │
│  ├── Logo + nom                                              │
│  ├── LimelightNav : [Contacts | Documents | Logs | Settings] │
│  ├── Badges stats : pending / sent / total                   │
│  ├── Avatar + nom utilisateur                                │
│  └── Bouton Déconnexion                                      │
│                                                              │
│  Onglet Contacts (#contactsSection) :                        │
│  ├── Zone d'upload (Excel .xlsx)                             │
│  ├── Barre d'outils : filtres + sélection + boutons d'action │
│  ├── Recherche                                               │
│  └── Grille de cartes contacts                               │
│                                                              │
│  Onglet Documents (#documentsSection) :                      │
│  ├── Upload de PDF (max 5 fichiers)                          │
│  └── Liste des documents                                     │
│                                                              │
│  Onglet Logs :                                               │
│  └── Logs d'envoi (à implémenter)                            │
│                                                              │
│  Onglet Settings :                                           │
│  └── Configuration (à implémenter)                           │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 Flux utilisateur dans le frontend

```
1. Connexion
   ├── Clic sur "Google" → redirection vers /api/auth/google → OAuth → callback → /
   └── Clic sur "Zimbra" → POST /api/auth/zimbra → session → affichage dashboard

2. Import
   ├── Drag & drop ou clic → sélection fichier .xlsx
   ├── POST /api/upload (FormData + fichier)
   └── Affichage des contacts dans la grille

3. Gestion des contacts
   ├── Filtres : Tous / En attente / Envoyés
   ├── Recherche par nom/structure/email
   ├── Mode sélection (batch) : checkbox + actions groupées
   │   ├── Envoyer la sélection
   │   ├── Marquer en attente
   │   └── Supprimer la sélection
   └── Modale détail : édition + envoi unitaire + suppression

4. Envoi
   ├── POST /api/send/:id → succès → mise à jour UI (status → sent)
   ├── POST /api/send-all → barre de progression → résultats
   └── Toast notifications

5. Déconnexion
   └── POST /api/auth/logout → nettoyage session → retour landing page
```

---

## 9. Structure du projet

```
Automatisation MAIL/
│
├── server.js                 # Point d'entrée Express (888 lignes)
│                             # Routes API, middleware, génération emails
│
├── Dockerfile                # Multi-stage build (node:20-alpine)
│                             # Builder → Production (image optimisée)
│
├── docker-compose.yml        # Orchestration Docker
│                             # Service mailcandid + volumes persistants
│
├── docker-entrypoint.sh      # Script d'entrée Docker
│                             # Migrations Prisma + démarrage serveur
│
├── package.json              # Dépendances + scripts npm
├── prisma.config.ts          # Configuration Prisma v7 (runtime)
├── .env                      # Variables d'environnement (NON COMMITTÉ)
├── .gitignore                # Fichiers exclus du versioning
├── .dockerignore             # Fichiers exclus de l'image Docker
│
├── read-me.md                # ← CE FICHIER : documentation technique
├── PLAN-REFONTE.md           # Plan de refonte de l'interface
│
├── prisma/
│   ├── schema.prisma         # Schéma de base de données
│   └── migrations/           # Migrations Prisma (historique)
│
├── src/
│   ├── auth.js               # Lucia + Google OAuth + helpers
│   ├── db.js                 # Instance Prisma unique (pool Neon)
│   ├── gmail-client.js       # Client Gmail API REST
│   ├── zimbra-client.js      # Client Zimbra SOAP
│   └── generated/            # Client Prisma généré (gitignoré ?)
│       └── prisma/           # PrismaClient + types
│
├── public/                   # Frontend statique
│   ├── index.html            # SPA (landing + dashboard)
│   ├── style.css             # Design futuriste
│   ├── app.js                # Logique applicative
│   ├── config.js             # Configuration (API_BASE_URL)
│   ├── digital-serenity.js   # Animation fond de grille SVG
│   ├── limelight-nav.js      # Navigation avec effet spotlight
│   ├── glowing-shadow.js     # Ombres dynamiques
│   ├── test-refonte.js       # Tests de la refonte
│   └── test-refonte-node.js  # Tests backend
│
├── uploads/
│   └── documents/            # Pièces jointes uploadées (persisté via volume)
│
├── notes/                    # Notes de développement
│   ├── 2026-04-30-Bouton-Selectionner.md
│   ├── 2026-04-30-Correction-BatchModal.md
│   ├── 2026-04-30-Correction-BatchModal-complet.md
│   └── 2026-05-04-Fix-Gmail-API-Media-Type.md
│
├── deployment/               # Documentation de déploiement
│   ├── DOCKER_NGROK_GUIDE.md # ← Guide principal de déploiement
│   ├── DOCKER_GUIDE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── HOSTINGER_FIX.md
│   ├── SIMPLE_DEPLOYMENT.md
│   └── README.md
│
├── Contact école/            # Ressources contacts
├── graphify-out/             # Sortie d'analyse de code (graph.html)
└── Démarrer l'application.command  # Script de démarrage macOS
```

---

## 10. Déploiement

### 10.1 Architecture de déploiement

```
┌──────────────────────────────────────────────────────────┐
│                    HOSTINGER (frontend)                   │
│                                                          │
│  public_html/                                            │
│  ├── index.html        ← depuis public/index.html        │
│  ├── app.js            ← depuis public/app.js            │
│  ├── style.css         ← depuis public/style.css         │
│  └── config.js         ← depuis public/config.js         │
│                                                          │
│  URL : https://masdelsol-test.online                     │
└──────────────────────────────────────────────────────────┘
                            │
                            │ fetch → API_BASE_URL
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    TUNNEL NGROK                           │
│                                                          │
│  Domaine fixe :                                          │
│  https://cytotropic-bipedally-ollie.ngrok-free.dev       │
│                                                          │
│  Forward → http://localhost:3001                         │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                 DOCKER (machine locale macOS)             │
│                                                          │
│  Container : mailcandid-backend                           │
│  Port : 3001                                             │
│  Volumes :                                               │
│  ├── sqlite_data → /app/prisma/ (DB SQLite)              │
│  └── uploads_data → /app/uploads/ (documents)            │
│                                                          │
│  Montage :                                               │
│  └── CV_LETTRE_DE_RECOMMANDATION.pdf (read-only)         │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Démarrage rapide

#### Option A — One-click (macOS)

```bash
# Double-cliquez sur le fichier :
Démarrer l'application.command
```

Ce script lance automatiquement Docker + ngrok.

#### Option B — Manuel

```bash
# Terminal 1 : Lancer Docker
cd "/Users/yacinehida/Desktop/Automatisation MAIL"
docker compose up --build

# Terminal 2 : Lancer le tunnel ngrok
ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3001
```

### 10.3 Variables d'environnement Docker

Le fichier `docker-compose.yml` injecte automatiquement les variables depuis `.env` :

```yaml
environment:
  - NODE_ENV=production
  - LOCAL_DEV=true          # Force les cookies non-secure pour ngrok
  - SMTP_USER=${SMTP_USER}
  - SMTP_PASS=${SMTP_PASS}
  - ZIMBRA_URL=${ZIMBRA_URL}
  - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
  - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
  - GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
  - PORT=3001
  - DATABASE_URL=${DATABASE_URL:-file:./prisma/dev.db}
```

### 10.4 Volumes persistants

```yaml
volumes:
  sqlite_data:      # Base de données SQLite (persistante entre redémarrages)
    name: mailcandid_sqlite_data
  uploads_data:     # Documents uploadés par les utilisateurs
    name: mailcandid_uploads_data
```

### 10.5 Healthcheck

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 20s
```

### 10.6 Build Docker optimisé

Le Dockerfile utilise un **multi-stage build** :

```
Stage 1 — BUILDER (node:20-alpine)
├── npm ci (cache si package.json inchangé)
├── Copie prisma/schema.prisma
├── npx prisma generate → src/generated/prisma/

Stage 2 — PRODUCTION (node:20-alpine)
├── Copie node_modules (depuis builder)
├── Copie src/generated (depuis builder)
├── Copie code source (server.js, src/, public/)
├── Utilisateur non-root (appuser:appgroup)
├── Répertoires de données avec permissions
├── Entrypoint : docker-entrypoint.sh
└── CMD : node server.js
```

---

## 11. Configuration et variables d'environnement

### 11.1 Fichier `.env` (obligatoire, non commité)

```env
# ── Serveur ──
PORT=3000
NODE_ENV=development

# ── Zimbra (Université de Tours) ──
SMTP_USER=anika.mohammad@etu.univ-tours.fr
SMTP_PASS=votre_mot_de_passe
ZIMBRA_URL=https://webmailetu-zimbra.univ-tours.fr

# ── Google OAuth2 (Console Google Cloud) ──
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# ── Base de données (Neon PostgreSQL) ──
DATABASE_URL=postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require

# ── Optionnel ──
ZIMBRA_CA_PATH=/path/to/ca-cert.pem    # Certificat CA personnalisé
ZIMBRA_INSECURE=false                   # Désactiver TLS (déconseillé)
LOCAL_DEV=true                          # Cookies non-secure (pour ngrok)
```

### 11.2 Configuration CORS

Les origines autorisées sont définies dans `server.js` :

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

> ⚠️ En production avec ngrok, le frontend communique via l'URL ngrok, donc les requêtes sont "same-origin" après le tunnel — le CORS n'est pas un problème.

### 11.3 Configuration Google Cloud

Pour que Google OAuth fonctionne, vous devez configurer dans la **Console Google Cloud** :

1. **APIs & Services > Credentials**
   - Créer un OAuth 2.0 Client ID (type "Web application")
   - Ajouter les URIs de redirection autorisés :
     - `http://localhost:3000/api/auth/google/callback`
     - `https://cytotropic-bipedally-ollie.ngrok-free.dev/api/auth/google/callback`

2. **APIs & Services > OAuth consent screen**
   - Ajouter l'email utilisateur comme "Test user" (en mode testing)
   - Ou publier l'application (mode production)

3. **APIs & Services > Library**
   - Activer **Gmail API**

---

## 12. Sécurité

### 12.1 Mesures de sécurité implémentées

| Mesure | Implémentation |
|--------|---------------|
| **Sessions httpOnly** | Cookies de session Lucia inaccessibles au JavaScript |
| **HTTPS** | Tunnel ngrok chiffré + TLS PostgreSQL |
| **OAuth2 PKCE** | Protection contre les attaques par interception de code |
| **CSRF Protection** | State parameter dans OAuth + sameSite cookies |
| **Multi-utilisateur** | Isolation des contacts/documents par userId |
| **Soft delete** | Les contacts sont marqués 'deleted', pas supprimés physiquement |
| **Non-root user** | Le conteneur Docker s'exécute avec l'utilisateur `appuser` |
| **Rate limiting** | Délai de 1.5s entre chaque envoi d'email |
| **Limite documents** | Maximum 5 PDF par utilisateur, 10 Mo par fichier |
| **Validation fichiers** | Seuls les PDF sont acceptés pour les documents |
| **Pas de credentials en dur** | Toutes les credentials sont dans `.env` (gitignoré) |

> ⚠️ **Note :** Le fichier `server.js` contient un fallback de credentials hardcodées (lignes 28-32) pour le développement local. Ce fallback n'est pas utilisé en production car Docker injecte les variables via docker-compose.yml.

### 12.2 À ne pas commiter

Le fichier `.gitignore` exclut :
- `.env` et toutes les variantes (contient les credentials)
- `CV_LETTRE_DE_RECOMMANDATION.pdf` (données personnelles)
- `*.xlsx` / `*.xls` (données des contacts)
- `node_modules/` (dépendances)
- `prisma/dev.db` (base de données locale)

---

## 13. Dépannage

### 13.1 Problèmes courants

#### ❌ "Vérifiez que le backend Docker est démarré"

**Cause :** Le frontend ne peut pas joindre l'API.
**Solutions :**
1. Vérifier que Docker est lancé : `docker ps` doit montrer `mailcandid-backend`
2. Vérifier que ngrok est actif : ouvrir `https://cytotropic-bipedally-ollie.ngrok-free.dev` dans un navigateur
3. Vérifier le fichier `public/config.js` (sur Hostinger) : `API_BASE_URL` doit pointer vers l'URL ngrok

#### ❌ Erreur CORS

**Cause :** L'origine de la requête n'est pas dans la liste CORS.
**Solutions :**
1. Vérifier que le frontend Hostinger utilise bien l'URL ngrok (pas localhost)
2. Les requêtes passant par ngrok sont "same-origin" après le tunnel, donc CORS ne devrait pas bloquer

#### ❌ Erreur Google OAuth : `access_denied`

**Cause :** L'utilisateur n'est pas dans la liste des test users.
**Solution :** Dans la console Google Cloud → OAuth consent screen → ajouter l'email dans "Test users".

#### ❌ Erreur Google OAuth : `redirect_uri_mismatch`

**Cause :** Le redirect_uri ne correspond pas à celui configuré dans Google Cloud.
**Solution :** Ajouter l'URL ngrok + callback dans les URIs autorisés :
`https://cytotropic-bipedally-ollie.ngrok-free.dev/api/auth/google/callback`

#### ❌ ngrok `ERR_NGROK_3200` (session expirée)

**Cause :** Le tunnel ngrok s'est arrêté.
**Solution :** Relancer `ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3001`

#### ❌ Zimbra : `Authentification échouée`

**Cause :** Identifiants incorrects ou serveur Zimbra inaccessible.
**Solutions :**
1. Vérifier `SMTP_USER` et `SMTP_PASS` dans `.env`
2. Vérifier que `ZIMBRA_URL` est accessible depuis le réseau
3. Vérifier le certificat TLS (option `ZIMBRA_CA_PATH`)

#### ❌ PDF non trouvé

**Cause :** Le fichier n'est pas monté dans le conteneur Docker.
**Solution :** Vérifier que `CV_LETTRE_DE_RECOMMANDATION.pdf` existe à la racine du projet et que le volume est bien monté dans `docker-compose.yml`.

#### ❌ Base de données : `Connection terminated unexpectedly`

**Cause :** Trop de connexions simultanées à Neon (plan gratuit limité).
**Solution :** L'application est déjà configurée avec `connection_limit=3` et un pool de 3 connexions max.

### 13.2 Commandes de diagnostic

```bash
# Vérifier que Docker tourne
docker ps
docker logs mailcandid-backend

# Vérifier que ngrok est actif
curl https://cytotropic-bipedally-ollie.ngrok-free.dev

# Tester l'authentification Zimbra
curl http://localhost:3001/api/test-auth

# Tester l'envoi d'un mail
curl -X POST http://localhost:3001/api/test-send

# Vérifier la connexion à la base de données
docker exec mailcandid-backend npx prisma db push --help

# Redémarrer le backend
docker compose down
docker compose up --build -d
```

### 13.3 Logs

Les logs Docker sont au format JSON avec rotation :

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

Pour voir les logs en temps réel :

```bash
docker logs -f mailcandid-backend
```

---

## Annexe : Résumé des endpoints API

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| `GET` | `/` | Non | Page d'accueil (frontend statique) |
| `POST` | `/api/auth/zimbra` | Non | Connexion Zimbra SOAP |
| `GET` | `/api/auth/google` | Non | Redirection OAuth Google |
| `GET` | `/api/auth/google/callback` | Non | Callback OAuth Google |
| `POST` | `/api/auth/logout` | Session | Déconnexion |
| `GET` | `/api/me` | Session | Profil utilisateur connecté |
| `POST` | `/api/upload` | Session | Import fichier Excel |
| `GET` | `/api/contacts` | Session | Liste des contacts |
| `PUT` | `/api/contacts/:id` | Session | Modifier un contact |
| `DELETE` | `/api/contacts/:id` | Session | Supprimer un contact (soft) |
| `POST` | `/api/send/:id` | Session | Envoyer un email |
| `POST` | `/api/send-all` | Session | Envoyer tous les emails en attente |
| `GET` | `/api/test-auth` | Non | Tester connexion Zimbra |
| `POST` | `/api/test-send` | Non | Envoyer un mail de test |
| `GET` | `/api/documents` | Session | Liste des documents |
| `POST` | `/api/documents/upload` | Session | Upload de PDF |
| `DELETE` | `/api/documents/:id` | Session | Supprimer un document |

---

<div align="center">

**MailCandid** — Automatisez vos candidatures avec intelligence.

*Documentation technique rédigée le 29 juillet 2026.*

</div>