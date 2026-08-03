#!/bin/bash
# =============================================================================
#  diagnose-oauth.sh — Diagnostic Google OAuth (mode local / Docker)
#  Usage : bash diagnose-oauth.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check_pass() { echo -e "  ${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS + 1)); }
check_fail() { echo -e "  ${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"; WARN=$((WARN + 1)); }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🔍 DIAGNOSTIC GOOGLE OAUTH — Mode Local / Docker      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Fichier .env ──────────────────────────────────────────────────────────
echo -e "${BLUE}═══ 1. Fichier .env ═══${NC}"
if [ -f .env ]; then
  check_pass "Fichier .env présent"
  set -a && source .env && set +a
else
  check_fail "Fichier .env absent — impossible de charger les variables"
  exit 1
fi

# ─── 2. Variables Google OAuth ────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 2. Variables Google OAuth ═══${NC}"

if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  check_pass "GOOGLE_CLIENT_ID  = ${GOOGLE_CLIENT_ID:0:30}..."
else
  check_fail "GOOGLE_CLIENT_ID non défini"
fi

if [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  check_pass "GOOGLE_CLIENT_SECRET = **** (défini)"
else
  check_fail "GOOGLE_CLIENT_SECRET non défini"
fi

if [ -n "${GOOGLE_REDIRECT_URI:-}" ]; then
  echo "  ℹ️  GOOGLE_REDIRECT_URI = ${GOOGLE_REDIRECT_URI}"
  if [[ "$GOOGLE_REDIRECT_URI" == http://localhost:* ]]; then
    check_pass "GOOGLE_REDIRECT_URI pointe vers localhost ✅"
  elif [[ "$GOOGLE_REDIRECT_URI" == *"ngrok"* ]]; then
    check_warn "GOOGLE_REDIRECT_URI pointe vers ngrok (obsolète ?) — mode local = localhost"
  else
    check_warn "GOOGLE_REDIRECT_URI format non standard : $GOOGLE_REDIRECT_URI"
  fi
else
  check_fail "GOOGLE_REDIRECT_URI non défini"
fi

# ─── 3. Port du serveur ───────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 3. Port du serveur ═══${NC}"
PORT="${PORT:-3001}"
echo "  ℹ️  PORT = ${PORT}"
if [ "${PORT}" = "3001" ]; then
  check_pass "Port 3001 (standard Docker)"
else
  check_warn "Port non standard : ${PORT} (Docker expose 3001)"
fi

# ─── 4. Serveur local ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 4. Serveur local ═══${NC}"

SERVER_URL="http://localhost:${PORT}"
echo "  ℹ️  Tentative de connexion à ${SERVER_URL}..."

if curl -s --max-time 3 "${SERVER_URL}/" > /dev/null 2>&1; then
  check_pass "Serveur répond sur ${SERVER_URL}"
else
  check_warn "Serveur injoignable sur ${SERVER_URL} (normal s'il n'est pas lancé)"
  echo "  ℹ️  Lance avec : docker compose up -d"
fi

# ─── 5. Route OAuth Google ────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 5. Route /api/auth/google ═══${NC}"

if curl -s --max-time 5 -o /dev/null -w "%{http_code}" "${SERVER_URL}/api/auth/google" 2>/dev/null | grep -q "302"; then
  check_pass "GET /api/auth/google → 302 Redirect (OAuth fonctionnel)"
else
  check_warn "GET /api/auth/google ne renvoie pas 302 (serveur offline ?)"
fi

# ─── 6. Connectivité Google OAuth ─────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 6. Connectivité Google OAuth ═══${NC}"

# Test DNS
if host oauth2.googleapis.com > /dev/null 2>&1; then
  check_pass "DNS : oauth2.googleapis.com résolu"
else
  check_fail "DNS : oauth2.googleapis.com non résolu"
fi

# Test HTTPS
if curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://oauth2.googleapis.com/token 2>/dev/null | grep -q "400\|401\|403\|405"; then
  check_pass "HTTPS : oauth2.googleapis.com/token accessible"
else
  check_fail "HTTPS : oauth2.googleapis.com/token inaccessible"
fi

# Test userinfo
if curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://www.googleapis.com/oauth2/v3/userinfo 2>/dev/null | grep -q "401\|403"; then
  check_pass "HTTPS : www.googleapis.com/userinfo accessible (401 attendu sans token)"
else
  check_warn "HTTPS : www.googleapis.com/userinfo — réponse inattendue"
fi

# ─── 7. Cohérence de la configuration ─────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 7. Cohérence configuration ═══${NC}"

echo "  ℹ️  Mode : LOCAL / DOCKER → redirect_uri = http://localhost:${PORT}/api/auth/google/callback"

if [ "${GOOGLE_REDIRECT_URI:-}" = "http://localhost:${PORT}/api/auth/google/callback" ]; then
  check_pass "GOOGLE_REDIRECT_URI cohérent avec le port ${PORT}"
else
  check_warn "GOOGLE_REDIRECT_URI (${GOOGLE_REDIRECT_URI:-}) ≠ http://localhost:${PORT}/api/auth/google/callback"
  echo "  ℹ️  Vérifie que http://localhost:${PORT}/api/auth/google/callback est dans Google Cloud Console"
  echo "  ℹ️  (APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs)"
fi

# ─── 8. Docker ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 8. Docker ═══${NC}"

if command -v docker &> /dev/null; then
  check_pass "Docker installé"
  
  if docker compose ps 2>/dev/null | grep -q "mailcandid"; then
    check_pass "Conteneur 'mailcandid-backend' en cours d'exécution"
  else
    check_warn "Conteneur 'mailcandid-backend' non trouvé (pas lancé ?)"
  fi
else
  check_warn "Docker non trouvé — l'app tourne peut-être sans Docker"
fi

# ─── 9. NODE_ENV et LOCAL_DEV ────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 9. NODE_ENV / LOCAL_DEV ═══${NC}"

NODE_ENV="${NODE_ENV:-development}"
echo "  ℹ️  NODE_ENV = ${NODE_ENV}"

if [ "${NODE_ENV}" = "production" ]; then
  check_warn "NODE_ENV=production → erreurs masquées. Active LOCAL_DEV=true dans docker-compose.yml"
  if [ "${LOCAL_DEV:-}" = "true" ]; then
    check_pass "LOCAL_DEV=true → les erreurs détaillées seront affichées"
  else
    check_warn "LOCAL_DEV n'est pas 'true' → erreurs génériques en production"
  fi
else
  check_pass "NODE_ENV=${NODE_ENV} → mode développement, erreurs détaillées"
fi

# ─── 10. Google Cloud Console — Rappel ────────────────────────────────────────
echo ""
echo -e "${BLUE}═══ 10. Google Cloud Console — À vérifier ═══${NC}"

echo "  ℹ️  Dans Google Cloud Console :"
echo "      1. APIs & Services → Credentials → OAuth 2.0 Client ID"
echo "         → Authorized redirect URIs :"
echo "           ✅ http://localhost:${PORT}/api/auth/google/callback"
echo "      2. APIs & Services → OAuth consent screen → Test users"
echo "         → Ajouter l'adresse email de test"
echo ""

# ─── Résumé ───────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
echo -e "║  📊 RÉSUMÉ : ${GREEN}${PASS} PASS${NC}, ${RED}${FAIL} FAIL${NC}, ${YELLOW}${WARN} WARN${NC}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}⚠️  Corrige les FAIL ci-dessus avant de tester l'authentification.${NC}"
  echo ""
  echo "🚀 Actions correctives suggérées :"
  echo "   1. Vérifier le fichier .env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)"
  echo "   2. Lancer le serveur : docker compose up -d"
  echo "   3. Vérifier la console Google Cloud pour les redirect URIs"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}ℹ️  Quelques avertissements. L'auth Google peut fonctionner, mais vérifie les WARN.${NC}"
  echo ""
  echo "🚀 Pour tester :"
  echo "   1. docker compose up -d"
  echo "   2. Ouvre http://localhost:${PORT}"
  echo "   3. Clique sur 'Se connecter avec Google'"
else
  echo -e "${GREEN}✅ Tout est OK ! L'auth Google devrait fonctionner.${NC}"
  echo ""
  echo "🚀 Pour tester :"
  echo "   1. docker compose up -d (si pas déjà lancé)"
  echo "   2. Ouvre http://localhost:${PORT}"
  echo "   3. Clique sur 'Se connecter avec Google'"
fi
echo ""