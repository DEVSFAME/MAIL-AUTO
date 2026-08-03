# 🏠 Dashboard — Automatisation MAIL

> **Vault Obsidian** — Point d'entrée stratégique du projet.
> Consulte ce dashboard en complément du rapport technique pour naviguer dans l'architecture.

---

## 🔗 Rapport d'Architecture

- [[graphify-out/GRAPH_REPORT|📊 Graph Report]] — Graphe complet des dépendances et communautés du code
- [[Automatisation MAIL.code-workspace|💻 Workspace VS Code]] — Ouvrir le projet dans VS Code

---

## ⚡ Accès Rapide

### 🖥️ Backend (Serveur)
| Fichier | Description |
|---------|-------------|
| [[server.js]] | 🚀 Point d'entrée Express (routes API, auth, upload, envoi) |
| [[src/auth.js]] | 🔐 Lucia + Google OAuth2 + middleware `requireAuth` |
| [[src/zimbra-client.js]] | 📧 Client SOAP Zimbra (envoi mails fallback) |

### 🎨 Frontend
| Fichier | Description |
|---------|-------------|
| [[public/app.js]] | 🧠 Logique frontend complète (758 lignes) |
| [[public/index.html]] | 📄 Landing page + App shell |
| [[public/style.css]] | 🎨 Styles complets (1393 lignes) |
| [[public/config.js]] | ⚙️ Auto-détection URL API (ngrok/Hostinger) |

### 🗄️ Base de Données
| Fichier | Description |
|---------|-------------|
| [[prisma/schema.prisma]] | 📊 Schéma Prisma (User, Session, Document, Contact) |

### 🐳 Déploiement
| Fichier | Description |
|---------|-------------|
| [[deployment/DOCKER_NGROK_GUIDE.md]] | 🐳 Guide Docker + ngrok |
| [[deployment/DEPLOYMENT_GUIDE.md]] | 📦 Guide déploiement général |
| [[deployment/HOSTINGER_FIX.md]] | 🔧 Fix Hostinger |
| [[Dockerfile]] | 🏗️ Dockerfile de build |
| [[docker-compose.yml]] | 📋 Docker Compose |

---

## 📝 Notes de Tâches

### 🚨 Priorité 1 : Réparer le démarrage du serveur
- [x] Rendre `zimbra-client.js` lazy (pas d'appel réseau au `require()`)
- [x] Redémarrer le serveur et tester `GET /api/me`
- [x] Vérifier que toutes les routes répondent

### 🔄 Priorité 2 : Tester le flux OAuth2
- [x] Démarrer ngrok : `ngrok http --domain=... 3000`
- [x] Mettre à jour `GOOGLE_REDIRECT_URI` dans `.env`
- [x] Tester connexion Google + callback + création session

### 📧 Priorité 3 : Tester l'envoi Gmail
- [x] Ajouter les identifiants Google corrects
- [x] Tester envoi sur un contact
- [ ] Vérifier l'attachement des PDF

### 🔒 Priorité 4 : Isolation des données
- [ ] Créer deux utilisateurs
- [ ] Vérifier qu'ils ne voient pas les données de l'autre

### 🐳 Priorité 5 : Déploiement
- [ ] Vérifier Dockerfile + docker-compose.yml
- [ ] Déployer sur Hostinger
- [ ] Configurer GOOGLE_REDIRECT_URI pour la prod

---

## 🧭 Navigation Graphify (Communautés)

| Communauté | Description | Nodes clés |
|------------|-------------|------------|
| [[_COMMUNITY_Community 0\|Community 0]] | API & Contacts | `api()`, `loadContacts()`, `sendAll()` |
| [[_COMMUNITY_Community 1\|Community 1]] | Client Zimbra | `soapRequest()`, `sendEmail()`, `authenticate()` |
| [[_COMMUNITY_Community 3\|Community 3]] | Auth Session | `checkAuth()`, `init()`, `logout()` |
| [[_COMMUNITY_Community 4\|Community 4]] | Contacts & Upload | `renderContacts()`, `uploadFile()` |
| [[_COMMUNITY_Community 7\|Community 7]] | UI Modale | `openModal()`, `showAppSection()` |
| [[_COMMUNITY_Community 8\|Community 8]] | Documents | `loadDocuments()`, `uploadDocuments()` |

---

> 🗺️ **Navigation rapide** : Utilise `Cmd+O` (macOS) / `Ctrl+O` (Windows) dans Obsidian pour chercher n'importe quel fichier du projet.
