#!/bin/bash
# =============================================================================
#  diagnose-and-test.sh — Diagnostic + Test de connexion Automatisation MAIL
#  Usage: ./diagnose-and-test.sh
# =============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

CONTAINER="mailcandid-backend"
BASE_URL="http://localhost:3001"
PASS=0
FAIL=0

log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════════${NC}"
}

log_pass() {
    echo -e "  ${GREEN}✅ PASS${NC} — $1"
    PASS=$((PASS + 1))
}

log_fail() {
    echo -e "  ${RED}❌ FAIL${NC} — $1"
    FAIL=$((FAIL + 1))
}

log_info() {
    echo -e "  ${BLUE}ℹ️  INFO${NC} — $1"
}

log_warn() {
    echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"
}

# =============================================================================
# SECTION 1 : État du conteneur
# =============================================================================
log_section "1. ÉTAT DU CONTENEUR DOCKER"

# 1.1 Le conteneur tourne-t-il ?
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    log_pass "Conteneur '${CONTAINER}' en cours d'exécution"
else
    log_fail "Conteneur '${CONTAINER}' introuvable ou arrêté"
    echo ""
    echo "  Conteneurs actifs :"
    docker ps --format "  {{.Names}} ({{.Status}})"
    echo ""
    echo "  Tentative de démarrage..."
    docker compose up -d
    sleep 10
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        log_pass "Conteneur redémarré avec succès"
    else
        log_fail "Échec du redémarrage du conteneur"
        exit 1
    fi
fi

# 1.2 Logs récents
echo ""
log_info "Derniers logs du conteneur (30 lignes) :"
docker logs --tail 30 "${CONTAINER}" 2>&1 | while IFS= read -r line; do
    echo "    $line"
done

# =============================================================================
# SECTION 2 : Diagnostic de la base de données
# =============================================================================
log_section "2. DIAGNOSTIC BASE DE DONNÉES SQLite"

# 2.1 Présence du fichier dev.db
if docker exec "${CONTAINER}" test -f /app/prisma/dev.db; then
    log_pass "Fichier /app/prisma/dev.db présent"
    SIZE=$(docker exec "${CONTAINER}" stat -c%s /app/prisma/dev.db 2>/dev/null || echo "N/A")
    log_info "Taille du fichier : ${SIZE} octets"
else
    log_fail "Fichier /app/prisma/dev.db absent"
fi

# 2.2 Tables existantes
echo ""
log_info "Tables dans la base de données :"
docker exec "${CONTAINER}" sqlite3 /app/prisma/dev.db ".tables" 2>&1 || {
    log_fail "Impossible d'exécuter sqlite3 dans le conteneur"
}

# 2.3 Vérification explicite de la table User
echo ""
if docker exec "${CONTAINER}" sqlite3 /app/prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name='User';" 2>&1 | grep -q "User"; then
    log_pass "Table 'User' existe dans la base de données"
else
    log_fail "Table 'User' ABSENTE de la base de données"
fi

# 2.4 Vérification de toutes les tables attendues
echo ""
EXPECTED_TABLES=("User" "Session" "Document" "Contact")
for table in "${EXPECTED_TABLES[@]}"; do
    if docker exec "${CONTAINER}" sqlite3 /app/prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';" 2>&1 | grep -q "${table}"; then
        log_pass "Table '${table}' existe"
    else
        log_fail "Table '${table}' ABSENTE"
    fi
done

# 2.5 Migrations appliquées
echo ""
log_info "Migrations Prisma enregistrées :"
docker exec "${CONTAINER}" sqlite3 /app/prisma/dev.db "SELECT * FROM _prisma_migrations;" 2>&1 || {
    log_warn "Table _prisma_migrations inaccessible (peut-être normale si DB vide)"
}

# 2.6 Vérification du backup de migrations
echo ""
if docker exec "${CONTAINER}" test -d /app/prisma-migrations-backup/migrations; then
    log_pass "Dossier de backup des migrations présent"
    COUNT=$(docker exec "${CONTAINER}" sh -c "ls /app/prisma-migrations-backup/migrations/ 2>/dev/null | wc -l")
    log_info "${COUNT} dossiers de migration trouvés dans le backup"
else
    log_fail "Dossier de backup des migrations ABSENT"
fi

# 2.7 Vérification des migrations dans /app/prisma/migrations
echo ""
if docker exec "${CONTAINER}" test -d /app/prisma/migrations; then
    COUNT=$(docker exec "${CONTAINER}" sh -c "ls /app/prisma/migrations/ 2>/dev/null | wc -l")
    if [ "${COUNT}" -gt 0 ]; then
        log_pass "Migrations présentes dans /app/prisma/migrations (${COUNT} dossier(s))"
    else
        log_fail "Dossier /app/prisma/migrations/ VIDE — le volume écrase le contenu"
    fi
else
    log_fail "Dossier /app/prisma/migrations/ absent"
fi

# =============================================================================
# SECTION 3 : Test de l'API
# =============================================================================
log_section "3. TEST DE CONNEXION API"

# 3.1 Ping de base
echo ""
log_info "Test ping ${BASE_URL}/"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" 2>&1 || echo "000")
if [ "${HTTP_CODE}" = "200" ]; then
    log_pass "GET / → HTTP ${HTTP_CODE}"
else
    log_fail "GET / → HTTP ${HTTP_CODE} (attendu 200)"
fi

# 3.2 Test /api/me
echo ""
log_info "Test /api/me"
RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/me" 2>&1 || echo "{}")
HTTP_CODE=$(echo "${RESP}" | tail -1)
BODY=$(echo "${RESP}" | head -n -1)
if [ "${HTTP_CODE}" = "200" ]; then
    log_pass "GET /api/me → HTTP ${HTTP_CODE}"
    echo "    Réponse : ${BODY}"
elif [ "${HTTP_CODE}" = "401" ]; then
    log_pass "GET /api/me → HTTP ${HTTP_CODE} (non authentifié — normal)"
    echo "    Réponse : ${BODY}"
else
    log_warn "GET /api/me → HTTP ${HTTP_CODE} (vérifié)"
    echo "    Réponse : ${BODY}"
fi

# 3.3 Test /api/test-auth
echo ""
log_info "Test /api/test-auth"
RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/test-auth" 2>&1 || echo "{}")
HTTP_CODE=$(echo "${RESP}" | tail -1)
BODY=$(echo "${RESP}" | head -n -1)
echo "    HTTP ${HTTP_CODE} — ${BODY}"
if [ "${HTTP_CODE}" = "200" ]; then
    log_pass "GET /api/test-auth → HTTP ${HTTP_CODE}"
else
    log_warn "GET /api/test-auth → HTTP ${HTTP_CODE}"
fi

# 3.4 Test /api/auth/outlook (vérifie seulement que la route répond)
echo ""
log_info "Test /api/auth/outlook (vérification de la route OAuth)"
RESP=$(curl -s -o /dev/null -w "%{http_code}" -L --max-redirs 0 "${BASE_URL}/api/auth/outlook" 2>&1 || echo "000")
if [ "${RESP}" = "302" ] || [ "${RESP}" = "303" ] || [ "${RESP}" = "307" ] || [ "${RESP}" = "308" ]; then
    log_pass "GET /api/auth/outlook → HTTP ${RESP} (redirection OAuth OK)"
elif [ "${RESP}" = "000" ]; then
    log_fail "GET /api/auth/outlook → pas de réponse (serveur down ?)"
else
    log_info "GET /api/auth/outlook → HTTP ${RESP}"
fi

# =============================================================================
# SECTION 4 : Test de connexion Prisma depuis l'intérieur du conteneur
# =============================================================================
log_section "4. TEST CLIENT PRISMA (interne conteneur)"

docker exec "${CONTAINER}" node -e "
const { PrismaClient } = require('./src/generated/prisma');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const rawUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const adapter = new PrismaBetterSqlite3({ url: rawUrl });
const prisma = new PrismaClient({ adapter });

(async () => {
    try {
        // Test 1 : comptage des utilisateurs
        const count = await prisma.user.count();
        console.log('  ✅ prisma.user.count() = ' + count);

        // Test 2 : liste des tables (via raw query)
        const tables = await prisma.\$queryRawUnsafe(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma_%' AND name NOT LIKE 'sqlite_%' ORDER BY name\");
        console.log('  📋 Tables trouvées : ' + JSON.stringify(tables.map(t => t.name)));

        await prisma.\$disconnect();
        process.exit(0);
    } catch (e) {
        console.error('  ❌ ERREUR Prisma : ' + e.message);
        await prisma.\$disconnect().catch(() => {});
        process.exit(1);
    }
})();
" 2>&1

PRISMA_EXIT=$?
if [ ${PRISMA_EXIT} -eq 0 ]; then
    log_pass "Client Prisma interne — connexion et requête OK"
else
    log_fail "Client Prisma interne — échec de connexion"
fi

# =============================================================================
# SECTION 5 : RÉSUMÉ
# =============================================================================
log_section "5. RÉSUMÉ DU DIAGNOSTIC"

echo ""
echo -e "  ${GREEN}✅ Tests réussis : ${PASS}${NC}"
echo -e "  ${RED}❌ Tests échoués : ${FAIL}${NC}"
echo ""

TOTAL=$((PASS + FAIL))
if [ ${FAIL} -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}🎉 TOUS LES TESTS ONT RÉUSSI ! Le système est opérationnel.${NC}"
    echo ""
    echo "  Tu peux maintenant tester l'authentification Outlook :"
    echo -e "    ${CYAN}${BASE_URL}/api/auth/outlook${NC}"
    exit 0
else
    echo -e "  ${RED}${BOLD}⚠️  ${FAIL}/${TOTAL} test(s) ont échoué. Voir détails ci-dessus.${NC}"
    echo ""
    echo "  Actions correctives possibles :"
    echo "    1. Reconstruire l'image : docker compose build --no-cache"
    echo "    2. Supprimer le volume : docker compose down -v && docker compose up -d"
    echo "    3. Vérifier les logs : docker logs ${CONTAINER}"
    echo "    4. Shell dans le conteneur : docker exec -it ${CONTAINER} sh"
    exit 1
fi