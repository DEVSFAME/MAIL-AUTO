# =============================================================================
#  DOCKERFILE — Automatisation MAIL (Backend Node.js + Prisma + PostgreSQL)
#  Multi-stage build optimisé : builder → production (image ultra-légère)
#  Améliorations :
#    - Suppression du fallback credentials en dur dans le code (sécurité)
#    - Exécution des migrations Prisma au démarrage via entrypoint
#    - Migration SQLite → PostgreSQL Neon (plus besoin de better-sqlite3)
#    - Image finale plus petite (seulement production)
#    - Healthcheck robuste avec wget
#    - Gestion des permissions fine (non-root user)
# =============================================================================

# ─── ÉTAPE 1 : Builder (node_modules complets) ────────────────────────────
FROM node:22-alpine AS builder

# Outils de build pour compiler les modules natifs (better-sqlite3)
RUN apk add --no-cache python3 make g++

# ARG pour prisma generate — DATABASE_URL est requis par prisma.config.ts
ARG DATABASE_URL=file:/app/prisma/dev.db
ENV DATABASE_URL=$DATABASE_URL

WORKDIR /app

# ── 1. Copier package.json SEUL pour cacher npm ci ──────────────────────
#    Layer 1 : si package.json ne change pas → cache hit, pas de réinstall
COPY package*.json ./

# ── 2. Installer les dépendances (sans scripts pour éviter prisma generate prématuré) ──
RUN npm ci --legacy-peer-deps --ignore-scripts

# ── 3. Copier Prisma (schéma + config) — layer séparé du npm install ───
#    Layer 2 : si seul le schéma change, node_modules reste en cache
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./

# ── 4. Générer le client Prisma ─────────────────────────────────────────
RUN npx prisma generate

# ── 5. Compiler le module natif better-sqlite3 ──────────────────────────
RUN npm rebuild better-sqlite3


# =============================================================================
# ─── ÉTAPE 2 : Production (image finale, légère et sécurisée) ───────────────
FROM node:22-alpine AS production

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

# ── 2. Code source de l'application (uniquement ce qui est nécessaire) ──────
COPY public ./public
COPY src ./src
COPY server.js ./

# ── 3. Client Prisma généré + binaires Prisma ───────────────────────────────
#    IMPORTANT : copié APRÈS le code source pour écraser tout vieux client
#    qui pourrait traîner dans src/generated/ (le .dockerignore l'exclut
#    mais ceci est une sécurité défensive supplémentaire)
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
#    migrations Prisma (pour prisma migrate deploy au démarrage)
#    ⚠️  On les copie dans /app/prisma/ pour le runtime MAIS AUSSI dans
#    /app/prisma-migrations-backup/ car le volume sqlite_data écrase /app/prisma/
#    au montage (docker-compose). L'entrypoint les restaurera au démarrage.
COPY prisma/migrations ./prisma/migrations
COPY prisma/migrations ./prisma-migrations-backup/migrations
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
