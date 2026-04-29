# =============================================================================
#  DOCKERFILE — Automatisation MAIL (Backend Node.js + Prisma + SQLite)
#  Multi-stage build optimisé : builder → production (image ultra-légère)
#  Améliorations :
#    - Suppression du fallback credentials en dur dans le code (sécurité)
#    - Exécution des migrations Prisma au démarrage via entrypoint
#    - Copie complète des node_modules depuis le builder (évite les conflits
#      de peer dependencies et les recompilations de better-sqlite3)
#    - Image finale plus petite (seulement production)
#    - Healthcheck robuste avec wget
#    - Gestion des permissions fine (non-root user)
# =============================================================================

# ─── ÉTAPE 1 : Builder (node_modules complets) ────────────────────────────
FROM node:20-alpine AS builder

# Outils système nécessaires à la compilation (prisma, better-sqlite3 natif)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# ── 1. Copier package.json SEUL pour cacher npm ci ──────────────────────
#    Layer 1 : si package.json ne change pas → cache hit, pas de réinstall
COPY package*.json ./

# ── 2. Installer les dépendances ────────────────────────────────────────
#    On garde --ignore-scripts seulement pour éviter prisma generate,
#    mais better-sqlite3 nécessite sa compilation native. On la fait
#    explicitement après avec node-gyp.
#    --legacy-peer-deps nécessaire pour @lucia-auth/adapter-prisma qui n'est
#    pas compatible avec @prisma/client@7.x (conflit de peer dependencies)
RUN npm ci --legacy-peer-deps --ignore-scripts

# ── 3. Compiler le binding natif better-sqlite3 ─────────────────────────
#    Étape critique : le binding natif doit être compilé pour l'architecture
#    du conteneur (linux/arm64 + musl). Sans cette compilation, Prisma
#    échouera au runtime avec "Could not locate the bindings file".
RUN cd /app/node_modules/better-sqlite3 && \
    npx node-gyp rebuild 2>&1 && \
    node -e "require('better-sqlite3'); console.log('✅ better-sqlite3 bindings OK')"

# ── 4. Copier Prisma (schéma + config) — layer séparé du npm install ───
#    Layer 2 : si seul le schéma change, node_modules reste en cache
#    prisma.config.ts est requis par Prisma v7+ à la place de url dans le schema
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./

# ── 5. Générer le client Prisma ─────────────────────────────────────────
#    Layer 3 : ne coûte que le temps de prisma generate (rapide)
RUN npx prisma generate


# =============================================================================
# ─── ÉTAPE 2 : Production (image finale, légère et sécurisée) ───────────────
FROM node:20-alpine AS production

# Certificats pour wget (healthcheck) + tzdata pour les fuseaux horaires
RUN apk add --no-cache wget ca-certificates tzdata

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# ── 1. Copier node_modules complets depuis le builder (évite peer conflicts) ─
#    On copie TOUT node_modules car better-sqlite3 a des binaires natifs et
#    @lucia-auth/adapter-prisma a des conflits de versions. Moins optimal en
#    taille, mais garantit le fonctionnement.
COPY --from=builder /app/node_modules ./node_modules

# ── 2. Client Prisma généré + binaires Prisma ───────────────────────────────
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma

# ── 3. Code source de l'application (uniquement ce qui est nécessaire) ──────
COPY public ./public
COPY src ./src
COPY server.js ./
#    prisma.config.ts est nécessaire pour les migrations Prisma v7 au runtime
COPY --from=builder /app/prisma.config.ts ./

# ── 4. Créer les répertoires de données avec les bons droits ────────────────
RUN mkdir -p /app/uploads/documents && \
    chown -R appuser:appgroup /app/uploads && \
    chmod -R 755 /app/uploads

# ── 5. Entrypoint : exécute les migrations Prisma puis démarre l'app ───────
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ── 6. Variables d'environnement par défaut ─────────────────────────────────
ENV NODE_ENV=production \
    PORT=3001 \
    TZ=Europe/Paris

# ── 7. Exposition du port ───────────────────────────────────────────────────
EXPOSE 3001

# ── 8. Healthcheck ──────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

# ── 9. Définition de l'entrypoint et de la commande par défaut ──────────────
#    L'entrypoint exécute les migrations en root puis bascule vers appuser
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
