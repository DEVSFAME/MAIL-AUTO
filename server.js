require('dotenv').config();

// ─── Filet de sécurité : capture les exceptions non rattrapées ────────────────
process.on('uncaughtException', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`\n╔══════════════════════════════════════════════════════════╗`);
  console.error(`║  UNCAUGHT EXCEPTION » ${timestamp.padEnd(26)}║`);
  console.error(`╠══════════════════════════════════════════════════════════╣`);
  console.error(`║  Message : ${(err?.message || String(err)).padEnd(38)}║`);
  console.error(`╚══════════════════════════════════════════════════════════╝`);
  console.error(err.stack || '');
  // NE PAS exit(1) — laisser le processus vivre, les requêtes futures continuent
});

process.on('unhandledRejection', (reason) => {
  const timestamp = new Date().toISOString();
  const msg = reason?.message || String(reason);
  console.error(`\n╔══════════════════════════════════════════════════════════╗`);
  console.error(`║  UNHANDLED REJECTION » ${timestamp.padEnd(25)}║`);
  console.error(`╠══════════════════════════════════════════════════════════╣`);
  console.error(`║  Message : ${msg.padEnd(42)}║`);
  console.error(`╚══════════════════════════════════════════════════════════╝`);
  console.error(reason?.stack || '');
});

// ─── Configuration fallback (si pas de fichier .env) ─────────────────────────
if (!process.env.SMTP_USER) {
  process.env.SMTP_USER  = 'anika.mohammad@etu.univ-tours.fr';
  process.env.SMTP_PASS  = 'Saeedshamsa87';
  process.env.ZIMBRA_URL = 'https://webmailetu-zimbra.univ-tours.fr';
  process.env.PORT       = '3000';
}

const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const XLSX       = require('xlsx');
const path       = require('path');
const fs         = require('fs');

// ─── Prisma (SQLite persistante) ──────────────────────────────────────────────
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('./src/generated/prisma');

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Client Zimbra SOAP (bypass restriction SMTP universitaire) ───────────────
const zimbraClient = (() => {
  try { return require('./src/zimbra-client'); } catch (_) {}
  try { return require('./zimbra-client'); }    catch (_) {}
  throw new Error('zimbra-client.js introuvable (ni dans ./src/ ni à la racine)');
})();

// ─── Auth (Lucia + OAuth) ─────────────────────────────────────────────────────
const { lucia, createUserFromZimbra, requireAuth } = require('./src/auth');

// ─── Client Gmail API (envoi via token OAuth Google) ──────────────────────────
const gmailClient = require('./src/gmail-client');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

// ─── Utilitaire de logging structuré ──────────────────────────────────────────
function logError(context, error, extra = {}) {
  const timestamp = new Date().toISOString();
  const stack = error?.stack || (error instanceof Error ? error.stack : new Error().stack);
  const message = error?.message || String(error || 'Unknown error');

  console.error(`
╔══════════════════════════════════════════════════════╗
║  ERROR » ${timestamp.padEnd(37)}║
╠══════════════════════════════════════════════════════╣
║  Context   : ${String(context).padEnd(40)}║
║  Message   : ${message.padEnd(40)}║
║  Extra     : ${JSON.stringify(extra).padEnd(40)}║
╚══════════════════════════════════════════════════════╝
${stack}`);
}

// ─── CORS — Autorise les requêtes depuis Hostinger, ngrok et localhost ────────
app.use(cors({
  origin: [
    'https://masdelsol-test.online',
    'https://www.masdelsol-test.online',
    'https://cytotropic-bipedally-ollie.ngrok-free.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true,
}));

// Pré-vol OPTIONS (ngrok en a besoin)
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));

// ─── Fichiers statiques ───────────────────────────────────────────────────────
const publicDir = path.join(__dirname, 'public');
const staticDir = fs.existsSync(publicDir) ? publicDir : __dirname;

app.use(express.static(staticDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// ─── Middleware de logging ────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Générateur de mail personnalisé ─────────────────────────────────────────
function generateEmail(contact) {
  const { name, structure, location, research } = contact;

  const subject = `Candidature Spontanée – M2 Imagerie Biomédicale Multimodale`;

  const body =
`Madame, Monsieur ${name},

Je me permets de vous adresser ma candidature spontanée au sein de ${structure}, en lien avec vos travaux de recherche en ${research}.

Actuellement étudiante en deuxième année de Master en Imagerie Biomédicale Multimodale à l'Université de Tours, je suis particulièrement intéressé par le domaine de « ${research} » développé au sein de votre équipe à ${location}.

Mon parcours m'a permis d'acquérir des compétences solides en imagerie médicale, traitement d'images et analyse de données biomédicales. Je suis convaincu que rejoindre votre laboratoire me permettrait d'approfondir ces compétences tout en contribuant activement à vos projets de recherche.

Vous trouverez en pièce jointe mon CV ainsi que ma lettre de recommandation afin de vous permettre d'évaluer mon profil.

Je reste disponible pour tout entretien ou complément d'information et vous remercie de l'attention que vous porterez à ma candidature.

Dans l'attente de vous lire,

Cordialement,

MOHAMMAD ANIKA
M2 Imagerie Biomédicale Multimodale
${process.env.SMTP_USER}`;

  return { subject, body };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH — Routes d'authentification
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/auth/zimbra — Connexion via Zimbra (SOAP) ──────────────────────
app.post('/api/auth/zimbra', async (req, res) => {
  try {
    const username = process.env.SMTP_USER;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'SMTP_USER non configuré. Vérifiez le fichier .env.',
      });
    }

    // 1. Vérifier que l'authentification Zimbra fonctionne
    try {
      await zimbraClient.authenticate();
    } catch (authErr) {
      logError('AuthZimbra-Authenticate', authErr, { username });
      return res.status(401).json({
        success: false,
        error: 'Authentification Zimbra échouée. Vérifiez les identifiants SMTP.',
      });
    }

    // 2. Créer ou récupérer l'utilisateur en base
    const user = await createUserFromZimbra(username);

    // 3. Créer une session Lucia
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    // 4. Retourner la session + infos utilisateur
    res.appendHeader('Set-Cookie', sessionCookie.serialize());
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        authType: user.authType,
      },
    });

    console.log(`✅ Connexion Zimbra réussie : ${username}`);
  } catch (err) {
    logError('AuthZimbra', err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la connexion Zimbra.',
    });
  }
});

// ─── GET /api/auth/google — Redirection Google OAuth (Arctic v3+ PKCE) ────────
app.get('/api/auth/google', (req, res) => {
  try {
    const { googleAuth } = require('./src/auth');
    const crypto = require('crypto');
    const { generateCodeVerifier } = require('arctic');
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const url = googleAuth.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/gmail.send']);
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('access_type', 'offline');
    // Stocker le state et le codeVerifier dans des cookies pour vérification au callback
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10 * 1000, // 10 min
      sameSite: 'lax',
    });
    res.cookie('oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10 * 1000, // 10 min
      sameSite: 'lax',
    });
    res.redirect(url.toString());
  } catch (err) {
    logError('AuthGoogle', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la redirection Google.' });
  }
});

// ─── Helper : parse un cookie spécifique depuis le header ──────────────────
function getCookie(name) {
  const cookies = typeof arguments[1] === 'string' ? arguments[1] : '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ─── GET /api/auth/google/callback — Callback Google OAuth ────────────────────
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { googleAuth, createUserFromGoogle } = require('./src/auth');
    const code = req.query.code;
    const state = req.query.state;
    const cookieHeader = req.headers.cookie || '';
    const storedState = getCookie('oauth_state', cookieHeader);
    const codeVerifier = getCookie('oauth_code_verifier', cookieHeader);

    if (!code || !state || state !== storedState || !codeVerifier) {
      return res.status(400).json({ success: false, error: 'OAuth invalide.' });
    }

    const tokens = await googleAuth.validateAuthorizationCode(code, codeVerifier);
    const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    const googleUser = await googleResponse.json();

    // refreshToken peut être absent (Google ne le renvoie qu'au premier échange)
    let refreshToken = null;
    try { refreshToken = tokens.refreshToken(); } catch (_) {}

    const user = await createUserFromGoogle(
      googleUser,
      tokens.accessToken(),
      refreshToken,
      new Date(Date.now() + (tokens.expiresIn || 3600) * 1000)
    );

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    res.appendHeader('Set-Cookie', sessionCookie.serialize());
    // Rediriger vers le frontend
    res.redirect('/');
  } catch (err) {
    logError('AuthGoogleCallback', err);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'authentification Google.' });
  }
});

// ─── Middleware d'authentification pour les routes protégées ───────────────
app.use('/api', (req, res, next) => {
  // Routes publiques : auth
  if (req.path.startsWith('/auth/') || req.path === '/auth') {
    return next();
  }
  // Route test-auth publique
  if (req.path === '/test-auth') {
    return next();
  }
  // Route test-send publique
  if (req.path === '/test-send') {
    return next();
  }
  requireAuth(req, res, next);
});

// ─── POST /api/auth/logout — Déconnexion ──────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  try {
    const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
    }
    res.appendHeader('Set-Cookie', lucia.createBlankSessionCookie().serialize());
    res.json({ success: true });
  } catch (err) {
    logError('AuthLogout', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la déconnexion.' });
  }
});

// ─── GET /api/me — Profil de l'utilisateur connecté ──────────────────────────
app.get('/api/me', async (req, res) => {
  try {
    const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
    if (!sessionId) return res.status(401).json({ error: 'Non authentifié.' });

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || !user) return res.status(401).json({ error: 'Session invalide.' });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      authType: user.authType,
    });
  } catch (err) {
    logError('AuthMe', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTACTS — Routes protégées par requireAuth
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/upload — Parse le fichier Excel et insère en base ──────────────
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu.' });

    const user = await getUserForSend(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const contactsData = rows
      .map(row => {
        const name      = row['Nom du Contact (PI / Responsable)'] || '';
        const structure = row['Structure / Laboratoire'] || '';
        const location  = row['Localisation'] || '';
        const research  = row['Axe de Recherche Principal'] || '';
        const email     = (row['Adresse E-mail'] || '').trim();

        if (!email) return null;

        const { subject, body } = generateEmail({ name, structure, location, research });

        return { name, structure, location, research, email, subject, body, userId: user.id };
      })
      .filter(Boolean);

    if (contactsData.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun contact valide trouvé dans le fichier.' });
    }

    await prisma.contact.createMany({ data: contactsData });

    const contacts = await prisma.contact.findMany({
      where: { userId: user.id, status: { not: 'deleted' } },
      orderBy: { id: 'asc' }
    });

    res.json({ success: true, contacts });
  } catch (err) {
    logError('UploadExcel', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/contacts — Liste des contacts actifs (filtrés par utilisateur) ─
app.get('/api/contacts', async (req, res) => {
  try {
    // Récupérer l'utilisateur connecté (nécessaire pour filtrer)
    const user = await getUserForSend(req);
    const where = { status: { not: 'deleted' } };

    if (user) {
      // Filtrer par userId OU récupérer les contacts orphelins legacy (userId: null)
      where.OR = [
        { userId: user.id },
        { userId: null },
      ];
    } else {
      // Non authentifié : ne renvoyer que les contacts orphelins (legacy)
      where.userId = null;
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { id: 'asc' }
    });
    res.json(contacts);
  } catch (err) {
    logError('GetContacts', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/contacts/:id — Modifier un mail (vérifié ownership) ────────────
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await getUserForSend(req);

    // Vérifier que le contact existe
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });

    // Vérifier la propriété (autoriser les contacts orphelins pour transition legacy)
    if (existing.userId !== null && existing.userId !== user?.id) {
      return res.status(403).json({ error: 'Accès refusé. Ce contact ne vous appartient pas.' });
    }

    const updateData = {};
    if (req.body.subject !== undefined) updateData.subject = req.body.subject;
    if (req.body.body    !== undefined) updateData.body    = req.body.body;

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, contact });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Contact introuvable.' });
    }
    logError('UpdateContact', err, { id: req.params.id });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/contacts/:id — Soft delete d'un contact (vérifié ownership) ─
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await getUserForSend(req);

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });

    // Vérifier la propriété (rejeter si le contact appartient à un autre utilisateur)
    if (existing.userId !== null && existing.userId !== user?.id) {
      return res.status(403).json({ error: 'Accès refusé. Ce contact ne vous appartient pas.' });
    }

    await prisma.contact.update({
      where: { id },
      data: { status: 'deleted' }
    });

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Contact introuvable.' });
    }
    logError('DeleteContact', err, { id: req.params.id });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Helper : récupérer l'utilisateur complet (avec tokens) depuis la session ─
async function getUserForSend(req) {
  const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
  if (!sessionId) return null;
  const { user } = await lucia.validateSession(sessionId);
  if (!user) return null;
  // Récupérer l'utilisateur complet depuis Prisma (inclut accessToken, refreshToken)
  return await prisma.user.findUnique({ where: { id: user.id } });
}

// ─── Helper : envoyer un email (branchement Gmail vs Zimbra selon authType) ──
async function sendEmailViaProvider(user, { to, subject, body, attachmentPath }) {
  if (user.authType === 'google' && user.accessToken) {
    // Envoi via Gmail API avec le token OAuth Google
    const result = await gmailClient.sendEmail({
      accessToken:   user.accessToken,
      refreshToken:  user.refreshToken,
      from:          `${user.name || 'MOHAMMAD ANIKA'} <${user.email}>`,
      to,
      subject,
      body,
      attachmentPath: attachmentPath && fs.existsSync(attachmentPath) ? attachmentPath : undefined,
    });

    // Si le token a été rafraîchi, mettre à jour en base
    if (result.newAccessToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken:    result.newAccessToken,
          tokenExpiresAt: result.newTokenExpiresAt,
        },
      });
    }

    return result;
  } else {
    // Fallback Zimbra SOAP (utilisateur zimbra ou google sans token)
    await zimbraClient.sendEmail({
      to:             to,
      subject:        subject,
      body:           body,
      attachmentPath,
    });
    return { success: true };
  }
}

// ─── POST /api/send/:id — Envoyer un mail (Gmail API ou Zimbra SOAP) ────────
app.post('/api/send/:id', async (req, res) => {
  let contact;
  try {
    const id = parseInt(req.params.id, 10);
    contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

    const user = await getUserForSend(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    // Vérifier la propriété du contact
    if (contact.userId !== null && contact.userId !== user.id) {
      return res.status(403).json({ error: 'Accès refusé. Ce contact ne vous appartient pas.' });
    }

    const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');

    await sendEmailViaProvider(user, {
      to:             contact.email,
      subject:        contact.subject,
      body:           contact.body,
      attachmentPath: fs.existsSync(attachmentPath) ? attachmentPath : undefined,
    });

    await prisma.contact.update({
      where: { id },
      data: { status: 'sent' }
    });

    const via = user.authType === 'google' ? 'Gmail API' : 'Zimbra SOAP';
    console.log(`✅ Mail envoyé à ${contact.email} via ${via} (${user.email})`);
    res.json({ success: true, via, from: user.email });
  } catch (err) {
    logError('SendEmail', err, { id: req.params.id, email: contact?.email });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/test-send — Envoyer un mail de test (avec pièce jointe) ───────
app.post('/api/test-send', async (req, res) => {
  try {
    const user = await getUserForSend(req);

    // Si non authentifié, fallback Zimbra
    const useGmail = user && user.authType === 'google' && user.accessToken;

    const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');
    const hasAttachment  = fs.existsSync(attachmentPath);
    const fromEmail = useGmail ? user.email : process.env.SMTP_USER;
    const viaStr = useGmail ? 'Gmail API' : 'Zimbra SOAP';

    await sendEmailViaProvider(user || {}, {
      to:             'hidayacine01@gmail.com',
      subject:        `Test envoi mail + pièce jointe — ${viaStr}`,
      body:           `Ceci est un mail de test envoyé via ${viaStr}.\n\nCompte expéditeur : ${fromEmail}\nServeur : ${useGmail ? 'Gmail API' : process.env.ZIMBRA_URL}\nPièce jointe : ${hasAttachment ? 'CV_LETTRE_DE_RECOMMANDATION.pdf ✅' : 'absente ❌'}`,
      attachmentPath: hasAttachment ? attachmentPath : undefined,
    });

    console.log(`✅ Mail de test (${viaStr}) envoyé à hidayacine01@gmail.com depuis ${fromEmail}`);
    res.json({ success: true, message: `Mail de test envoyé avec succès via ${viaStr} depuis ${fromEmail}` });
  } catch (err) {
    logError('TestSendEmail', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/test-auth — Tester l'authentification Zimbra ───────────────────
app.get('/api/test-auth', async (req, res) => {
  try {
    const result = await zimbraClient.testConnection();
    res.json({ success: true, message: 'Authentification Zimbra réussie ✅', ...result });
  } catch (err) {
    logError('TestAuth', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/send-all — Envoyer tous les mails en attente (filtré par user) ─
app.post('/api/send-all', async (req, res) => {
  try {
    const user = await getUserForSend(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    const pending = await prisma.contact.findMany({
      where: {
        status: 'pending',
        OR: [
          { userId: user.id },
          { userId: null },
        ],
      }
    });

    const results = [];
    const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');
    const hasAttachment = fs.existsSync(attachmentPath);

    for (const contact of pending) {
      try {
        await sendEmailViaProvider(user, {
          to:             contact.email,
          subject:        contact.subject,
          body:           contact.body,
          attachmentPath: hasAttachment ? attachmentPath : undefined,
        });

        await prisma.contact.update({
          where: { id: contact.id },
          data: { status: 'sent' }
        });

        results.push({ id: contact.id, email: contact.email, success: true });
        const via = user.authType === 'google' ? 'Gmail API' : 'Zimbra SOAP';
        console.log(`✅ Mail envoyé à ${contact.email} via ${via}`);
      } catch (err) {
        results.push({ id: contact.id, email: contact.email, success: false, error: err.message });
        logError('SendAll-Contact', err, { id: contact.id, email: contact.email });
      }

      // Délai entre chaque envoi pour éviter les limitations serveur
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    res.json({ success: true, results });
  } catch (err) {
    logError('SendAll', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENTS — Upload / gestion des pièces jointes (PDF)
// ═══════════════════════════════════════════════════════════════════════════════

const uploadsDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Multer diskStorage pour persistance des documents uploadés ───────────────
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safeName);
  },
});
const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés.'));
    }
  },
});

// ─── GET /api/documents — Liste des documents de l'utilisateur ────────────────
app.get('/api/documents', async (req, res) => {
  try {
    const user = await getUserForSend(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    const documents = await prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(documents);
  } catch (err) {
    logError('GetDocuments', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/documents/upload — Upload d'un ou plusieurs PDF ────────────────
app.post('/api/documents/upload', uploadDocument.array('documents', 5), async (req, res) => {
  try {
    const user = await getUserForSend(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun fichier reçu.' });
    }

    // Vérifier la limite de 5 documents par utilisateur
    const existingCount = await prisma.document.count({ where: { userId: user.id } });
    if (existingCount + req.files.length > 5) {
      // Nettoyer les fichiers déjà écrits sur le disque
      req.files.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, error: 'Limite de 5 documents atteinte.' });
    }

    const createdDocs = [];
    for (const file of req.files) {
      const doc = await prisma.document.create({
        data: {
          userId: user.id,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype || 'application/pdf',
          size: file.size,
        },
      });
      createdDocs.push(doc);
    }

    const documents = await prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ success: true, uploaded: createdDocs.length, documents });
  } catch (err) {
    logError('UploadDocuments', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/documents/:id — Supprimer un document ────────────────────────
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const user = await getUserForSend(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    const id = parseInt(req.params.id, 10);
    const doc = await prisma.document.findUnique({ where: { id } });

    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    if (doc.userId !== user.id) return res.status(403).json({ error: 'Accès refusé.' });

    // Supprimer le fichier physique
    const filePath = path.join(uploadsDir, doc.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    logError('DeleteDocument', err, { id: req.params.id });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Middleware global de capture d'erreurs (doit être APRÈS toutes les routes) ──
app.use((err, req, res, next) => {
  logError('GlobalErrorHandler', err, {
    method: req.method,
    path: req.path,
    body: req.body ? JSON.stringify(req.body).substring(0, 200) : null,
  });
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur.'
      : err.message || 'Erreur interne du serveur.',
  });
});

// ─── Démarrage serveur ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Application démarrée sur http://localhost:${PORT}`);
  console.log(`📧 Compte  : ${process.env.SMTP_USER}`);
  console.log(`🔗 Zimbra  : ${process.env.ZIMBRA_URL}`);
  console.log(`🧪 Test auth : http://localhost:${PORT}/api/test-auth`);
  console.log(`📁 Dossier static : ${staticDir}`);
  console.log(`🌐 Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});