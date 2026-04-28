#!/bin/sh
# =============================================================================
#  docker-entrypoint.sh — Entrypoint pour le conteneur Automatisation MAIL
#  Exécute les migrations Prisma (en root), puis lance l'application
#  sous l'utilisateur non-root (appuser)
# =============================================================================
set -e

echo "================================================================"
echo "  🐳 Automatisation MAIL — Démarrage du conteneur"
echo "  📅 $(date)"
echo "  🌐 Node $(node -v)"
echo "================================================================"

# ── Vérifier que les variables critiques sont définies ──────────────────────
if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
    echo "⚠️  ATTENTION : SMTP_USER ou SMTP_PASS non définis."
    echo "   L'application peut ne pas fonctionner correctement."
fi

if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "⚠️  ATTENTION : GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non définis."
    echo "   L'authentification Google OAuth ne fonctionnera pas."
    echo "   Vérifie que le fichier .env est présent au niveau de docker-compose.yml"
fi

if [ -z "$GOOGLE_REDIRECT_URI" ]; then
    echo "⚠️  ATTENTION : GOOGLE_REDIRECT_URI non définie."
    echo "   L'authentification Google OAuth ne fonctionnera pas."
fi

# ── Exécuter les migrations Prisma (création/mise à jour de la DB) ────────
#    On reste en root pour que Prisma puisse créer le fichier SQLite
echo ""
echo "📦 Configuration de la base de données..."

cd /app

# Forcer DATABASE_URL dans l'environnement pour Prisma
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"

echo "   📁 Base : $DATABASE_URL"

# 1. Essayer migrate deploy d'abord (si des migrations existent)
echo "   → Migration via prisma migrate deploy..."
npx prisma migrate deploy 2>&1 || true

# 2. db push pour s'assurer que le schéma est à jour
echo "   → Synchronisation du schéma (prisma db push)..."
npx prisma db push --accept-data-loss 2>&1 || true

# 3. S'assurer que les fichiers de la base ont les bons droits pour appuser
# Donner les droits uniquement sur la base de données et les uploads
DB_FILE="$(echo "$DATABASE_URL" | sed 's/file://')"
if [ -f "$DB_FILE" ]; then
    chown appuser:appgroup "$DB_FILE"
    chown appuser:appgroup "$(dirname "$DB_FILE")" 2>/dev/null || true
fi
chown -R appuser:appgroup /app/uploads 2>/dev/null || true

# ── Vérifier que le client Prisma est correctement généré ───────────────────
echo ""
echo "🔍 Vérification du client Prisma..."
node -e "
  try {
    const { PrismaClient } = require('./src/generated/prisma');
    console.log('✅ Client Prisma chargé avec succès');
  } catch (e) {
    console.error('❌ Erreur chargement Prisma:', e.message);
    console.log('   Tentative de regénération...');
    require('child_process').execSync('npx prisma generate', { stdio: 'inherit' });
  }
"

# ── Redescendre vers appuser pour exécuter l'application ───────────────────
echo ""
echo "🚀 Démarrage de l'application..."
echo ""

exec su -s /bin/sh appuser -c "cd /app && $*"
