/**
 * db.js — Instance Prisma unique partagée par toute l'application.
 *
 * ⚠️  Une seule instance PrismaClient doit exister dans l'application.
 *     Base de données : SQLite locale via better-sqlite3.
 */

const { PrismaClient } = require('./generated/prisma');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Résout l'URL de la DB (conserve le préfixe "file:" attendu par l'adapter Prisma 7).
// Fallback vers file:./prisma/dev.db si DATABASE_URL n'est pas défini.
const rawUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

// Prisma Better SQLite3 adapter — en Prisma 7.9+, l'adapter accepte l'URL
// directement et crée le client better-sqlite3 en interne via sa factory connect().
// L'adaptateur PrismaBetterSqlite3 attend un objet { url: string } en paramètre,
// et non une simple chaîne de caractères (cf. signature TypeScript).
const adapter = new PrismaBetterSqlite3({ url: rawUrl });

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;