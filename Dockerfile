# ─── Image de base Node.js LTS ───────────────────────────────────────────────
FROM node:20-alpine

# Répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dépendances en premier (cache Docker optimisé)
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm install --omit=dev

# Copier tout le reste du projet
COPY . .

# Exposer le port utilisé par Express
EXPOSE 3000

# Démarrer le serveur
CMD ["node", "server.js"]
