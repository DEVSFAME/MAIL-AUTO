/**
 * auth.js — Configuration de Lucia (session) + Google OAuth2 + Microsoft Entra ID (Arctic)
 *
 * Fournit :
 *   - lucia           : instance Lucia configurée avec Prisma adapter
 *   - googleAuth      : client OAuth2 Google (via Arctic)
 *   - getGoogleAuth   : factory pour créer un client Google avec redirect_uri dynamique
 *   - outlookAuth     : client OAuth2 Microsoft Entra ID (via Arctic)
 *   - getOutlookAuth  : factory pour créer un client Microsoft avec redirect_uri dynamique
 *   - requireAuth     : middleware Express pour protéger les routes
 *   - createUserIfNotExists : helpers pour créer/mettre à jour un utilisateur
 */

const { Lucia } = require('lucia');
const { PrismaAdapter } = require('@lucia-auth/adapter-prisma');
const { Google, MicrosoftEntraId } = require('arctic');

// ─── Prisma (instance unique partagée) ────────────────────────────────────────
const prisma = require('./db');

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
      microsoftId: attributes.microsoftId,
      zimbraUsername: attributes.zimbraUsername,
    }),
  }
);

// ─── Google OAuth2 (via Arctic) ──────────────────────────────────────────────
// Factory : permet de créer un client Google avec un redirect_uri dynamique.
// Utile pour supporter ngrok / localhost / production sans changer le .env.

function getGoogleAuth(redirectUri) {
  const uri = redirectUri || process.env.GOOGLE_REDIRECT_URI;
  if (!uri) throw new Error('GOOGLE_REDIRECT_URI non défini. Vérifiez le fichier .env');
  return new Google(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    uri
  );
}

// Instance par défaut (utilise GOOGLE_REDIRECT_URI du .env)
const googleAuth = getGoogleAuth();

// ─── Microsoft Entra ID OAuth2 (via Arctic) ──────────────────────────────────
// Tenant "organizations" pour comptes Azure AD / Microsoft 365 professionnels
// Scopes : openid, profile, email, offline_access, Mail.Send

function getOutlookAuth(redirectUri) {
  const uri = redirectUri || process.env.OUTLOOK_REDIRECT_URI;
  if (!uri) throw new Error('OUTLOOK_REDIRECT_URI non défini. Vérifiez le fichier .env');
  const tenant = process.env.OUTLOOK_TENANT || 'consumers';
  return new MicrosoftEntraId(
    tenant,
    process.env.OUTLOOK_CLIENT_ID,
    process.env.OUTLOOK_CLIENT_SECRET,
    uri
  );
}

// Instance par défaut (utilise OUTLOOK_REDIRECT_URI du .env)
const outlookAuth = getOutlookAuth();

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

// ─── Helper : créer ou mettre à jour un utilisateur Microsoft ────────────────
async function createUserFromMicrosoft(microsoftUser, accessToken, refreshToken, expiresAt) {
  const { sub: microsoftId, mail, userPrincipalName, displayName } = microsoftUser;
  // Microsoft Graph retourne `mail` (comptes Exchange Online) ou `userPrincipalName`
  const email = mail || userPrincipalName;
  const name = displayName;

  // Chercher un utilisateur existant par microsoftId ou email
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { microsoftId },
        { email: email || undefined },
      ].filter(Boolean),
    },
  });

  if (user) {
    // Mettre à jour les tokens et infos
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        microsoftId: microsoftId || user.microsoftId,
        email: email || user.email,
        name: name || user.name,
        accessToken,
        refreshToken: refreshToken || user.refreshToken,
        tokenExpiresAt: expiresAt || user.tokenExpiresAt,
        authType: 'outlook',
      },
    });
  } else {
    // Créer un nouvel utilisateur
    user = await prisma.user.create({
      data: {
        microsoftId,
        email,
        name,
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        authType: 'outlook',
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
    // ⚠️ NE PLUS rattacher automatiquement les contacts orphelins
    // (c'était la source du mélange de données multi-utilisateur)
    return user;
  }

  // Créer un nouvel utilisateur Zimbra (sans rattacher les contacts orphelins)
  const zimbraDisplayName = process.env.ZIMBRA_DISPLAY_NAME || 'Mohammad Anika';
  user = await prisma.user.create({
    data: {
      zimbraUsername: username,
      email: username,
      name: zimbraDisplayName,
      authType: 'zimbra',
    },
  });

  // ⚠️ NE PLUS rattacher automatiquement les contacts orphelins
  return user;
}

// ─── Helper : rafraîchir un access token Google (utilisé aussi par gmail-client) ──
async function refreshGoogleToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Aucun refresh token disponible.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Échec du rafraîchissement du token Google (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return {
    accessToken:  data.access_token,
    expiresIn:    data.expires_in || 3600,
  };
}

// ─── Helper : rafraîchir un access token Microsoft ───────────────────────────
async function refreshOutlookToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Aucun refresh token Microsoft disponible.');
  }

  const tenant = process.env.OUTLOOK_TENANT || 'consumers';
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      scope:         'openid profile email offline_access https://graph.microsoft.com/Mail.Send',
    }).toString(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Échec du rafraîchissement du token Microsoft (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return {
    accessToken:  data.access_token,
    expiresIn:    data.expires_in || 3600,
  };
}

module.exports = {
  lucia,
  googleAuth,
  getGoogleAuth,
  outlookAuth,
  getOutlookAuth,
  requireAuth,
  createUserFromGoogle,
  createUserFromMicrosoft,
  createUserFromZimbra,
  refreshGoogleToken,
  refreshOutlookToken,
  prisma,
};