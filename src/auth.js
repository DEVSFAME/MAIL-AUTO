/**
 * auth.js — Configuration de Lucia (session) + Google OAuth2 (Arctic)
 *
 * Fournit :
 *   - lucia           : instance Lucia configurée avec Prisma adapter
 *   - googleAuth      : client OAuth2 Google (via Arctic)
 *   - requireAuth     : middleware Express pour protéger les routes
 *   - createUserIfNotExists : helper pour créer/mettre à jour un utilisateur
 */

const { Lucia } = require('lucia');
const { PrismaAdapter } = require('@lucia-auth/adapter-prisma');
const { Google } = require('arctic');

// ─── Prisma ──────────────────────────────────────────────────────────────────
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('./generated/prisma');

const adapter   = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma    = new PrismaClient({ adapter });

// ─── Lucia ───────────────────────────────────────────────────────────────────
const lucia = new Lucia(
  new PrismaAdapter(prisma.session, prisma.user),
  {
    sessionCookie: {
      attributes: {
        secure: process.env.NODE_ENV === 'production' && !process.env.LOCAL_DEV,
        sameSite: 'lax',
      },
    },
    getUserAttributes: (attributes) => ({
      id: attributes.id,
      email: attributes.email,
      name: attributes.name,
      picture: attributes.picture,
      authType: attributes.authType,
      googleId: attributes.googleId,
      zimbraUsername: attributes.zimbraUsername,
    }),
  }
);

// ─── Google OAuth2 (via Arctic) ──────────────────────────────────────────────
const googleAuth = new Google(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ─── Middleware requireAuth ──────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  try {
    const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
    if (!sessionId) {
      return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || !user) {
      // Session invalide ou expirée
      return res.status(401).json({ error: 'Session invalide ou expirée.' });
    }

    // Attacher l'utilisateur à la requête pour utilisation dans les routes
    req.user = user;
    next();
  } catch (err) {
    console.error('Erreur auth middleware :', err.message);
    return res.status(500).json({ error: 'Erreur d\'authentification.' });
  }
}

// ─── Helper : créer ou mettre à jour un utilisateur Google ───────────────────
async function createUserFromGoogle(googleUser, accessToken, refreshToken, expiresAt) {
  const { sub: googleId, email, name, picture } = googleUser;

  // Chercher un utilisateur existant par googleId ou email
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId },
        { email: email || undefined },
      ].filter(Boolean),
    },
  });

  if (user) {
    // Mettre à jour les tokens et infos
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: googleId || user.googleId,
        email: email || user.email,
        name: name || user.name,
        picture: picture || user.picture,
        accessToken,
        refreshToken: refreshToken || user.refreshToken,
        tokenExpiresAt: expiresAt || user.tokenExpiresAt,
        authType: 'google',
      },
    });
  } else {
    // Créer un nouvel utilisateur
    user = await prisma.user.create({
      data: {
        googleId,
        email,
        name,
        picture,
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        authType: 'google',
      },
    });
  }

  return user;
}

// ─── Helper : créer ou mettre à jour un utilisateur Zimbra ───────────────────
async function createUserFromZimbra(username) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { zimbraUsername: username },
        { email: username },
      ].filter(Boolean),
    },
  });

  if (user) {
    // Rattacher les contacts existants sans userId à cet utilisateur
    await prisma.contact.updateMany({
      where: { userId: null },
      data: { userId: user.id },
    });
    return user;
  }

  // Créer un nouvel utilisateur Zimbra
  const zimbraDisplayName = process.env.ZIMBRA_DISPLAY_NAME || 'Mohammad Anika';
  user = await prisma.user.create({
    data: {
      zimbraUsername: username,
      email: username,
      name: zimbraDisplayName,
      authType: 'zimbra',
    },
  });

  // Rattacher les contacts existants (sans userId) à ce nouvel utilisateur
  await prisma.contact.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  });

  return user;
}

module.exports = {
  lucia,
  googleAuth,
  requireAuth,
  createUserFromGoogle,
  createUserFromZimbra,
  prisma,
};
