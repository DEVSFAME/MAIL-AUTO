#!/bin/bash
# ─── Script de démarrage de MailCandid ───────────────────────────────────────
# Double-cliquez sur ce fichier pour lancer l'application

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "================================================="
echo "   MailCandid — Automatisation de Candidatures"
echo "================================================="
echo ""

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
  echo "❌ Node.js n'est pas installé. Veuillez l'installer sur https://nodejs.org"
  read -p "Appuyez sur Entrée pour fermer..."
  exit 1
fi

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
  echo ""
fi

echo "🚀 Démarrage du serveur..."
echo ""
echo "➡️  Local       : http://localhost:3000"
echo "➡️  Public ngrok: https://cytotropic-bipedally-ollie.ngrok-free.dev"
echo ""
echo "   (Appuyez sur Ctrl+C pour arrêter le serveur)"
echo ""

# Ouvrir le navigateur après 2 secondes
(sleep 2 && open "http://localhost:3000") &

# Lancer ngrok en arrière-plan avec le domaine fixe
echo "🌐 Démarrage du tunnel ngrok (domaine fixe)..."
ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3000 &
NGROK_PID=$!

# Lancer le serveur (au premier plan)
node server.js

# Arrêter ngrok quand le serveur s'arrête
kill $NGROK_PID 2>/dev/null
