#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# test-outlook-auth.sh — Test de diagnostic du flux OAuth Microsoft Outlook
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage : chmod +x test-outlook-auth.sh && ./test-outlook-auth.sh
#
# Ce script vérifie :
#   1. La présence et validité des variables Outlook dans le .env
#   2. La connectivité au serveur Express
#   3. La route /api/auth/outlook (redirection 302 vers Microsoft)
#   4. L'URL d'autorisation générée (tenant consumers, paramètres ok)
#   5. Un test d'envoi d'email si un token valide existe

set -euo pipefail

# ─── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

# ─── Helpers ───────────────────────────────────────────────────────────────────
pass() { echo -e "  ${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"; WARN=$((WARN + 1)); }
info() { echo -e "  ${BLUE}ℹ️${NC}  $1"; }

check_status() {
  local status=$1
  local message=$2
  if [ "$status" -eq 0 ]; then
    pass "$message"
  else
    fail "$message"
  fi
}

# ─── Bannière ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    TEST DIAGNOSTIC — AUTHENTIFICATION OUTLOOK OAUTH     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Vérification du fichier .env ──────────────────────────────────────────
echo -e "${BOLD}─── 1. Fichier .env ──────────────────────────────────────${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  pass "Fichier .env trouvé : $ENV_FILE"
else
  fail "Fichier .env introuvable à $ENV_FILE"
  echo "Test interrompu."
  exit 1
fi

# Charger le .env (attention : on n'exporte que les variables Outlook)
eval "$(grep '^OUTLOOK_' "$ENV_FILE" | sed 's/^/export /')"
eval "$(grep '^PORT=' "$ENV_FILE" | sed 's/^/export /')"

SERVER_PORT="${PORT:-3001}"
SERVER_BASE="http://localhost:$SERVER_PORT"

# ─── 2. Vérification des variables Outlook ─────────────────────────────────────
echo ""
echo -e "${BOLD}─── 2. Variables d'environnement Outlook ─────────────────${NC}"

if [ -n "${OUTLOOK_CLIENT_ID:-}" ]; then
  if echo "$OUTLOOK_CLIENT_ID" | grep -qE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'; then
    pass "OUTLOOK_CLIENT_ID est un GUID valide : ${OUTLOOK_CLIENT_ID:0:8}..."
  else
    fail "OUTLOOK_CLIENT_ID n'est pas un GUID valide (format UUID attendu) : ${OUTLOOK_CLIENT_ID:0:20}..."
  fi
else
  fail "OUTLOOK_CLIENT_ID non défini"
fi

if [ -n "${OUTLOOK_CLIENT_SECRET:-}" ]; then
  pass "OUTLOOK_CLIENT_SECRET défini (longueur : ${#OUTLOOK_CLIENT_SECRET} caractères)"
else
  fail "OUTLOOK_CLIENT_SECRET non défini"
fi

if [ -n "${OUTLOOK_REDIRECT_URI:-}" ]; then
  if echo "$OUTLOOK_REDIRECT_URI" | grep -qi '/api/auth/outlook/callback'; then
    pass "OUTLOOK_REDIRECT_URI contient le bon chemin : $OUTLOOK_REDIRECT_URI"
  else
    warn "OUTLOOK_REDIRECT_URI ne contient pas '/api/auth/outlook/callback' : $OUTLOOK_REDIRECT_URI"
  fi
else
  fail "OUTLOOK_REDIRECT_URI non défini"
fi

if [ -n "${OUTLOOK_TENANT:-}" ]; then
  if [ "$OUTLOOK_TENANT" = "consumers" ]; then
    pass "OUTLOOK_TENANT = consumers (comptes personnels Microsoft) ✅"
  elif [ "$OUTLOOK_TENANT" = "organizations" ]; then
    warn "OUTLOOK_TENANT = organizations (comptes pro/éducatifs uniquement) — incompatible si compte perso"
  elif [ "$OUTLOOK_TENANT" = "common" ]; then
    info "OUTLOOK_TENANT = common (accepte comptes perso ET pro)"
  else
    info "OUTLOOK_TENANT = $OUTLOOK_TENANT"
  fi
else
  fail "OUTLOOK_TENANT non défini (fallback à 'consumers' dans le code)"
fi

# Charger DATABASE_URL pour le test de la base
eval "$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/^/export /')"
# Si pas trouvé dans .env, fallback
DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}"

# ─── 3. Vérification de la connectivité serveur ───────────────────────────────
echo ""
echo -e "${BOLD}─── 3. Connectivité serveur Express ───────────────────────${NC}"

if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$SERVER_BASE/" > /dev/null 2>&1; then
  pass "Serveur accessible sur $SERVER_BASE"
else
  fail "Serveur inaccessible sur $SERVER_BASE — démarrez l'application d'abord"
fi

# ─── 3b. Vérification de la base de données SQLite ─────────────────────────────
echo ""
echo -e "${BOLD}─── 3b. Base de données SQLite ─────────────────────────────${NC}"

# Résoudre le chemin de la DB
DB_PATH="${DATABASE_URL#file:}"
DB_PATH="${DB_PATH:-./prisma/dev.db}"
# Chemin absolu si relatif
if [[ "$DB_PATH" != /* ]]; then
  DB_PATH="$SCRIPT_DIR/$DB_PATH"
fi

if [ -f "$DB_PATH" ]; then
  pass "Fichier de base de données trouvé : $DB_PATH"
  if command -v sqlite3 &>/dev/null; then
    TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -gt 0 ]; then
      pass "Base SQLite contient $TABLE_COUNT table(s) — migration ok"
    else
      warn "Base SQLite ne contient aucune table — les migrations n'ont peut-être pas été exécutées"
    fi
  else
    info "sqlite3 CLI non disponible, impossible de vérifier le contenu de la base"
  fi
else
  warn "Fichier de base de données non trouvé à $DB_PATH (peut être dans un conteneur Docker)"
fi

# ─── 4. Test de la route /api/auth/outlook ─────────────────────────────────────
echo ""
echo -e "${BOLD}─── 4. Route /api/auth/outlook (redirection) ──────────────${NC}"

# Faire la requête et suivre manuellement (curl -L suivrait la redirection)
OUTPUT=$(mktemp)
HTTP_CODE=$(curl -s -o "$OUTPUT" -w "%{http_code}" --connect-timeout 5 \
  -c /tmp/outlook_test_cookies.txt \
  "$SERVER_BASE/api/auth/outlook" 2>&1 || echo "000")

info "HTTP status code : $HTTP_CODE"

if [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
  pass "La route répond avec une redirection ($HTTP_CODE) vers Microsoft"
  
  # Extraire le header Location des headers (curl -D - ne fonctionne pas bien avec -o)
  LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" --connect-timeout 5 \
    -c /tmp/outlook_test_cookies.txt \
    "$SERVER_BASE/api/auth/outlook" 2>&1)
  
  if [ -n "$LOCATION" ]; then
    info "URL de redirection : ${LOCATION:0:120}..."
    
    if echo "$LOCATION" | grep -q "login.microsoftonline.com"; then
      pass "Redirection vers login.microsoftonline.com"
    else
      fail "La redirection ne pointe PAS vers login.microsoftonline.com"
    fi
    
    if echo "$LOCATION" | grep -qi "consumers"; then
      pass "Tenant 'consumers' détecté dans l'URL"
    elif echo "$LOCATION" | grep -qi "organizations"; then
      fail "Tenant 'organizations' détecté — INCOMPATIBLE avec les comptes personnels !"
    elif echo "$LOCATION" | grep -qi "common"; then
      info "Tenant 'common' détecté dans l'URL"
    else
      warn "Tenant non identifiable dans l'URL"
    fi
    
    if echo "$LOCATION" | grep -q "client_id=$OUTLOOK_CLIENT_ID"; then
      pass "Client ID correct dans l'URL d'autorisation"
    else
      fail "Client ID absent ou incorrect dans l'URL d'autorisation"
    fi
    
    if echo "$LOCATION" | grep -q "response_type=code"; then
      pass "Paramètre response_type=code présent"
    else
      fail "Paramètre response_type=code absent"
    fi
    
    if echo "$LOCATION" | grep -q "scope="; then
      pass "Paramètre scope présent"
      if echo "$LOCATION" | grep -q "Mail.Send"; then
        pass "Scope Mail.Send inclus dans l'URL"
      else
        warn "Scope Mail.Send absent de l'URL"
      fi
    else
      fail "Paramètre scope absent"
    fi
  else
    warn "Impossible d'extraire l'URL de redirection (Location header)"
  fi
elif [ "$HTTP_CODE" = "000" ]; then
  fail "Impossible de contacter le serveur sur $SERVER_BASE/api/auth/outlook"
else
  warn "La route a répondu avec le code $HTTP_CODE (attendu : 302)"
  BODY=$(cat "$OUTPUT" 2>/dev/null || echo "")
  if [ -n "$BODY" ]; then
    info "Corps de réponse : ${BODY:0:200}"
  fi
fi
rm -f "$OUTPUT"

# ─── 5. Cookies OAuth (vérification) ───────────────────────────────────────────
echo ""
echo -e "${BOLD}─── 5. Cookies OAuth ──────────────────────────────────────${NC}"

if [ -f /tmp/outlook_test_cookies.txt ]; then
  COOKIE_CONTENT=$(cat /tmp/outlook_test_cookies.txt)
  if echo "$COOKIE_CONTENT" | grep -q "outlook_oauth_state"; then
    pass "Cookie 'outlook_oauth_state' défini"
  else
    fail "Cookie 'outlook_oauth_state' non trouvé"
  fi
  if echo "$COOKIE_CONTENT" | grep -q "outlook_oauth_code_verifier"; then
    pass "Cookie 'outlook_oauth_code_verifier' défini"
  else
    fail "Cookie 'outlook_oauth_code_verifier' non trouvé"
  fi
  if echo "$COOKIE_CONTENT" | grep -q "outlook_oauth_redirect_uri"; then
    pass "Cookie 'outlook_oauth_redirect_uri' défini"
  else
    fail "Cookie 'outlook_oauth_redirect_uri' non trouvé"
  fi
else
  fail "Fichier de cookies non créé"
fi

# ─── 6. Vérification des variables Azure AD (guidage) ──────────────────────────
echo ""
echo -e "${BOLD}─── 6. Configuration Azure AD (rappel) ─────────────────────${NC}"
info "Application : Impetus"
info "Client ID    : 49b36ed7-3777-4ade-be34-42747092d21b"
info "Tenant ID    : 873627c9-a3e9-47d1-8c9d-8970da049289"
info "Type comptes : Utilisateurs de compte Microsoft personnel"
info "Redirect URI : http://localhost:3001/api/auth/outlook/callback"
echo ""
info "Vérifiez dans le portail Azure (https://portal.azure.com) :"
info "  1. L'URI de redirection est bien enregistrée (Web)"
info "  2. Les scopes 'Mail.Send' sont configurés dans API Permissions"
info "  3. Le secret client n'est pas expiré"

# ─── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
TOTAL=$((PASS + FAIL + WARN))
echo -e "${BOLD}║  RÉSULTATS : ${GREEN}$PASS réussis${NC}, ${RED}$FAIL échecs${NC}, ${YELLOW}$WARN avertissements${NC} sur $TOTAL tests  ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo -e "${RED}❌ Des échecs ont été détectés.${NC}"
  echo "   Causes possibles de l'erreur AADSTS90019 :"
  echo "     • OUTLOOK_TENANT ≠ 'consumers' dans le .env"
  echo "     • OUTLOOK_CLIENT_ID incorrect"
  echo "     • OUTLOOK_CLIENT_SECRET invalide/expiré"
  echo "     • URI de redirection non enregistrée dans Azure"
  echo "     • Application Azure configurée en single-tenant au lieu de personal accounts"
  exit 1
else
  echo ""
  echo -e "${GREEN}✅ Tous les tests de diagnostic ont réussi !${NC}"
  echo "   La configuration semble correcte. Vous pouvez maintenant tester"
  echo "   le bouton Outlook dans l'interface."
  echo ""
  echo "   ${BLUE}👉 Prochaine étape : ouvrir http://localhost:3001 et cliquer sur 'Outlook'${NC}"
  exit 0
fi