# Tutoriel : Régénérer l'image Docker backend

Ce guide vous explique comment régénérer l'image Docker backend **en supprimant complètement l'ancien cache** pour garantir une reconstruction propre.

---

## 📋 Prérequis

- Docker installé et en cours d'exécution
- Être positionné dans le répertoire du projet (`/Users/yacinehida/Desktop/Automatisation MAIL`)

---

## 🔄 Étapes pour régénérer l'image backend

### Étape 1 : Arrêter et supprimer le conteneur existant (si présent)

```bash
# Arrêter le conteneur
docker stop mailcandid-backend

# Supprimer le conteneur
docker rm mailcandid-backend
```

### Étape 2 : Supprimer l'ancienne image Docker

```bash
# Supprimer l'image existante
docker rmi automatisation-mail:latest

# Si l'image est utilisée par un conteneur, forcer la suppression
docker rmi -f automatisation-mail:latest
```

### Étape 3 : Nettoyer le cache Docker (optionnel mais recommandé)

```bash
# Supprimer toutes les images orphelines et le cache
docker system prune -a --volumes

# OU simplement nettoyer le cache de build
docker builder prune -a --force
```

### Étape 4 : Reconstruire l'image sans cache

```bash
# Reconstruire l'image sans utiliser le cache
docker compose build --no-cache mailcandid
```

### Étape 5 : Démarrer le conteneur

```bash
# Démarrer le service en arrière-plan
docker compose up -d mailcandid

# OU démarrer tous les services définis dans docker-compose.yml
docker compose up -d
```

### Étape 6 : Vérifier que tout fonctionne

```bash
# Voir les conteneurs en cours d'exécution
docker ps

# Voir les logs du conteneur
docker logs mailcandid-backend

# Vérifier que l'application répond (sur le port 3001)
curl http://localhost:3001/
```

---

## 🚀 Commande tout-en-un (rapide)

Si vous voulez tout faire en une seule fois :

```bash
# Arrêter, supprimer, nettoyer et reconstruire
docker stop mailcandid-backend 2>/dev/null || true
docker rm mailcandid-backend 2>/dev/null || true
docker rmi -f automatisation-mail:latest 2>/dev/null || true
docker builder prune -a --force
docker compose build --no-cache mailcandid
docker compose up -d mailcandid
```

---

## 📊 Vérification de l'image

Après la reconstruction, vous pouvez vérifier les détails de la nouvelle image :

```bash
# Liste des images
docker images automatisation-mail

# Informations détaillées sur l'image
docker inspect automatisation-mail:latest

# Taille de l'image
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep automatisation-mail
```

---

## ⚠️ Notes importantes

1. **Temps de build** : La reconstruction complète peut prendre plusieurs minutes (8-10 minutes) car elle réinstalle toutes les dépendances npm.

2. **Espace disque** : Le nettoyage du cache Docker peut libérer plusieurs Go d'espace.

3. **Variables d'environnement** : Assurez-vous que votre fichier `.env` est présent et correctement configuré avant de démarrer le conteneur.

4. **Volumes persistants** : Les volumes `sqlite_data` et `uploads_data` sont conservés entre les reconstructions pour préserver vos données.

---

## 🐛 Dépannage

### Le conteneur ne démarre pas
```bash
# Vérifier les logs détaillés
docker logs mailcandid-backend --tail 50

# Voir les événements Docker récents
docker events --since 5m
```

### Problème de port déjà utilisé
```bash
# Trouver quel processus utilise le port 3001
lsof -i :3001

# Changer le port dans docker-compose.yml si nécessaire
```

### Erreur de construction
```bash
# Reconstruire avec plus de détails
docker compose build --progress=plain --no-cache mailcandid
```

---

## 📝 Résumé des commandes essentielles

| Action | Commande |
|--------|----------|
| Arrêter le conteneur | `docker stop mailcandid-backend` |
| Supprimer le conteneur | `docker rm mailcandid-backend` |
| Supprimer l'image | `docker rmi automatisation-mail:latest` |
| Nettoyer le cache | `docker builder prune -a --force` |
| Reconstruire sans cache | `docker compose build --no-cache mailcandid` |
| Démarrer le service | `docker compose up -d mailcandid` |
| Voir les logs | `docker logs mailcandid-backend` |

---

**Dernière mise à jour** : 28/04/2026