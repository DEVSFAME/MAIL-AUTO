require('dotenv').config();

// ─── Vérification des variables d'environnement critiques ──────────────────
const REQUIRED_ENV_VARS = ['SMTP_USER', 'SMTP_PASS', 'ZIMBRA_URL'];
for (const v of REQUIRED_ENV_VARS) {
  if (!process.env[v]) {
    console.error(`❌ Variable d'environnement manquante: ${v}`);
    console.error('   Veuillez définir ' + v + ' dans votre fichier .env ou dans les variables du conteneur.');
    process.exit(1);
  }
}

// ─── Vérification des variables Google OAuth (optionnelles mais log) ───────
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non définis.');
  console.warn('   L\'authentification Google OAuth ne fonctionnera pas.');
  console.warn('   Vérifie que le fichier .env est présent au niveau de docker-compose.yml');
}
if (!process.env.GOOGLE_REDIRECT_URI) {
  console.warn('⚠️  GOOGLE_REDIRECT_URI non définie.');
  console.warn('   L\'authentification Google OAuth ne fonctionnera pas.');
}


const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const XLSX       = require('xlsx');
const path       = require('path');
const fs         = require('fs');
const { google } = require('googleapis');

// ─── Auth (Lucia + OAuth2) ────────────────────────────────────────────────────
const { lucia, googleAuth, requireAuth, createUserFromGoogle, createUserFromZimbra, prisma } = require('./src/auth');

// ─── Client Zimbra SOAP (fallback pour utilisateurs non-Google) ──────────────
const zimbraClient = (() => {
  try { return require('./src/zimbra-client'); } catch (e) {
    console.error('Erreur chargement ./src/zimbra-client.js:', e.message);
    throw e;
  }
})();

const app    = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Configuration du stockage pour les documents PDF uploadés
const uploadsDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── CORS — Autorise les requêtes depuis Hostinger, ngrok et localhost ────────
app.use(cors({
  origin: [
    'https://masdelsol-test.online',
    'https://www.masdelsol-test.online',
    'https://cytotropic-bipedally-ollie.ngrok-free.dev',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
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
  lastModified: true,
}));

// Middleware de logging pour debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  AUTHENTIFICATION — ROUTES
// ╚══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/auth/google — Rediriger vers Google OAuth ───────────────────────
app.get('/api/auth/google', async (req, res) => {
  try {
    // Arctic v3 : createAuthorizationURL(state, codeVerifier, scopes)
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomUUID();

    const url = googleAuth.createAuthorizationURL(
      state,
      codeVerifier,
      [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.send',
      ],
    );
    // Ajouter access_type=offline et prompt=consent pour obtenir le refreshToken
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');


    // Stocker l'URL de redirection post-login dans un cookie
    const redirectTo = req.query.redirect || '/';
    res.cookie('redirect_after_login', redirectTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5 minutes
    });

    // Stocker le codeVerifier pour validation (Arctic v3 PKCE)
    res.cookie('code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5 minutes
    });

    res.redirect(url.toString());

  } catch (err) {
    console.error('Erreur génération URL Google :', err);
    res.status(500).json({ error: 'Erreur lors de la génération de l\'URL d\'authentification.' });
  }
});

// ─── GET /api/auth/google/callback — Callback Google OAuth ────────────────────
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Code d\'autorisation manquant.');
    }

    // Récupérer le codeVerifier stocké dans le cookie (Arctic v3 PKCE)
    const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
      const [k, v] = c.trim().split('=');
      if (k) acc[k] = decodeURIComponent(v || '');
      return acc;
    }, {});

    const codeVerifier = cookies.code_verifier;

    // Échanger le code contre les tokens
    console.log('🔄 Échange du code OAuth contre les tokens...');
    const tokens = await googleAuth.validateAuthorizationCode(code, codeVerifier);

    // Arctic v3.7+ : OAuth2Tokens est une classe avec des méthodes (accessToken(), refreshToken(), etc.)
    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
    const accessTokenExpiresAt = tokens.accessTokenExpiresAt();

    console.log(`🔄 Token récupéré: accessToken=${accessToken ? '✅' : '❌'}, refreshToken=${refreshToken ? '✅' : '❌'}, expiresAt=${accessTokenExpiresAt}`);

    // Récupérer les informations du profil Google
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    console.log(`🔄 Profil récupéré: id=${profile.sub}, email=${profile.email}, name=${profile.name}`);

    // Créer ou mettre à jour l'utilisateur en base
    const user = await createUserFromGoogle(
      profile,
      accessToken,
      refreshToken, // ← CRUCIAL : stocké lors de la première connexion uniquement
      accessTokenExpiresAt
    );
    console.log(`🔄 Utilisateur ${user.id} créé/mis à jour en base`);

    // Créer la session Lucia
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    // Rediriger vers l'application avec le cookie de session
    const redirectTo = cookies.redirect_after_login || '/';
    res.clearCookie('redirect_after_login');

    res.setHeader('Set-Cookie', sessionCookie.serialize());
    res.redirect(redirectTo);
  } catch (err) {
    console.error('❌ Erreur callback Google :', err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    res.status(500).send('Erreur d\'authentification Google : ' + err.message);
  }
});

// ─── POST /api/auth/zimbra — Connexion via Zimbra (compte partagé) ───────────
app.post('/api/auth/zimbra', async (req, res) => {
  try {
    const username = process.env.SMTP_USER;

    // Créer ou récupérer l'utilisateur Zimbra
    const user = await createUserFromZimbra(username);

    // Créer la session Lucia
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    const cookieHeader = sessionCookie.serialize();

    // S'assurer que les contacts existants (sans userId) sont rattachés
    // (déjà fait dans createUserFromZimbra, mais on refait par sécurité)

    res.setHeader('Set-Cookie', cookieHeader);
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, authType: user.authType } });
  } catch (err) {
    console.error('Erreur connexion Zimbra :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/auth/logout — Déconnexion ───────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  try {
    const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
    }

    // Cookie de session vide pour le nettoyage côté navigateur
    const emptyCookie = lucia.createBlankSessionCookie().serialize();
    res.setHeader('Set-Cookie', emptyCookie);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur déconnexion :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/me — Vérifier si l'utilisateur est connecté ────────────────────
app.get('/api/me', async (req, res) => {
  try {
    const sessionId = lucia.readSessionCookie(req.headers.cookie || '');
    if (!sessionId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || !user) {
      return res.status(401).json({ error: 'Session invalide.' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      authType: user.authType,
      googleId: user.googleId,
      zimbraUsername: user.zimbraUsername,
    });
  } catch (err) {
    console.error('Erreur /api/me :', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  GÉNÉRATEUR DE MAIL
// ╚══════════════════════════════════════════════════════════════════════════════

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

// ─── Utilitaire : encoder un header non-ASCII selon RFC 2047 ──────────────────
function mimeEncodeHeader(text) {
  // Si le texte ne contient QUE des caractères ASCII 7-bit, pas besoin d'encoder
  if (/^[\x00-\x7F]*$/.test(String(text))) return String(text);
  // Encoder en Base64 UTF-8 avec le préfixe RFC 2047
  return '=?UTF-8?B?' + Buffer.from(String(text), 'utf8').toString('base64') + '?=';
}

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  FONCTION D'ENVOI GMAIL (via Gmail REST API / OAuth2)
// ╚══════════════════════════════════════════════════════════════════════════════

/**
 * Envoie un email via Gmail REST API OAuth2 avec les tokens de l'utilisateur.
 * Utilise l'API REST gmail.users.messages.send (scope gmail.send) au lieu
 * du SMTP (qui nécessite le scope large mail.google.com).
 * Gère automatiquement le rafraîchissement du token si expiré.
 *
 * @param {Object} user - Utilisateur connecté (doit avoir accessToken, refreshToken)
 * @param {Object} options - { to, subject, body, attachmentPaths[] }
 */
async function sendGmail(user, { to, subject, body, attachmentPaths = [] }) {
  // 1. Configurer le client OAuth2
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.tokenExpiresAt ? new Date(user.tokenExpiresAt).getTime() : null,
  });

  // 2. Écouter l'événement de rafraîchissement des tokens
  oauth2Client.on('tokens', async (tokens) => {
    const updateData = {};
    if (tokens.access_token) updateData.accessToken = tokens.access_token;
    if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date) updateData.tokenExpiresAt = new Date(tokens.expiry_date);

    if (Object.keys(updateData).length > 0) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        console.log(`🔄 Tokens mis à jour pour ${user.email}`);
      } catch (err) {
        console.error('Erreur mise à jour tokens :', err.message);
      }
    }
  });

  // 3. Construire le message MIME RFC822 multipart/mixed avec pièces jointes
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  let mimeParts = [];

  // Partie textuelle du message
  mimeParts.push(
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    Buffer.from(body).toString('base64')
  );

  // Pièces jointes
  for (const att of attachmentPaths) {
    const filePath = path.isAbsolute(att.path) ? att.path : path.join(__dirname, att.path);
    try {
      const fileBuffer = fs.readFileSync(filePath);
      mimeParts.push(
        `--${boundary}\r\n` +
        `Content-Type: ${att.mimetype || 'application/pdf'}\r\n` +
        `Content-Disposition: attachment; filename="${att.filename.replace(/"/g, '\\"')}"\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n` +
        fileBuffer.toString('base64')
      );
    } catch (err) {
      console.warn(`⚠️  Pièce jointe introuvable : ${filePath} — ignorée`);
    }
  }

  mimeParts.push(`--${boundary}--`);

  const rawMessage = [
    `From: "${mimeEncodeHeader(user.name || 'MOHAMMAD ANIKA')}" <${user.email}>`,
    `To: ${to}`,
    `Subject: ${mimeEncodeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    mimeParts.join('\r\n'),
  ].join('\r\n');

  // 4. Encoder en base64 URL-safe (RFC 4648)
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 5. Envoyer via Gmail REST API
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.log(`✅ Mail Gmail envoyé à ${to} (Message ID: ${response.data.id})`);
    return true;
  } catch (err) {
    console.error(`❌ Erreur envoi Gmail à ${to} :`, err.message);
    if (err.response?.data?.error) {
      console.error('   Détail API:', JSON.stringify(err.response.data.error, null, 2));
    }
    throw err;
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  ROUTES PROTÉGÉES (nécessitent authentification)
// ╚══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/upload — Parse le fichier Excel et insère en base ──────────────
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu.' });

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

        return {
          userId: req.user.id,
          name, structure, location, research, email, subject, body,
        };
      })
      .filter(Boolean);

    if (contactsData.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun contact valide trouvé dans le fichier.' });
    }

    await prisma.contact.createMany({ data: contactsData });

    const contacts = await prisma.contact.findMany({
      where: { userId: req.user.id, status: { not: 'deleted' } },
      orderBy: { id: 'asc' },
    });

    res.json({ success: true, contacts });
  } catch (err) {
    console.error('Erreur parsing Excel :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/contacts — Liste des contacts actifs de l'utilisateur ──────────
app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { userId: req.user.id, status: { not: 'deleted' } },
      orderBy: { id: 'asc' },
    });
    res.json(contacts);
  } catch (err) {
    console.error('Erreur récupération contacts :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/contacts/:id — Modifier un mail ────────────────────────────────
app.put('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Vérifier que le contact appartient à l'utilisateur
    const existing = await prisma.contact.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });

    const updateData = {};
    if (req.body.subject !== undefined) updateData.subject = req.body.subject;
    if (req.body.body    !== undefined) updateData.body    = req.body.body;
    if (req.body.status  !== undefined) updateData.status  = req.body.status;

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, contact });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Contact introuvable.' });
    }
    console.error('Erreur mise à jour contact :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/contacts/:id — Soft delete d'un contact ─────────────────────
app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Vérifier que le contact appartient à l'utilisateur
    const existing = await prisma.contact.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });

    await prisma.contact.update({
      where: { id },
      data: { status: 'deleted' },
    });

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Contact introuvable.' });
    }
    console.error('Erreur suppression contact :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/send/:id — Envoyer un mail (Gmail OAuth2 ou Zimbra fallback) ──
app.post('/api/send/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const contact = await prisma.contact.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

    // Chercher les documents de l'utilisateur
    const documents = await prisma.document.findMany({
      where: { userId: req.user.id },
    });

    // Récupérer l'utilisateur complet (avec tokens)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(500).json({ error: 'Utilisateur introuvable.' });

    // ── LOG : Quels sont les tokens disponibles ? ─────────────────────────
    console.log(`📧 Envoi pour user: ${user.email}, authType: ${user.authType}`);
    console.log(`   accessToken: ${user.accessToken ? '✅ présent' : '❌ absent'}`);
    console.log(`   refreshToken: ${user.refreshToken ? '✅ présent' : '❌ absent'}`);
    console.log(`   tokenExpiresAt: ${user.tokenExpiresAt || '❌ null'}`);

    if (user.authType === 'google' && user.accessToken) {
      // ── Envoi via Gmail API OAuth2 ──────────────────────────────────────
      console.log('📧 → Branche Gmail API REST OAuth2');
      const attachmentPaths = documents.map(d => ({
        path: path.join(uploadsDir, d.userId, d.filename),
        filename: d.originalName,
        mimetype: d.mimetype,
      }));

      await sendGmail(user, {
        to: contact.email,
        subject: contact.subject,
        body: contact.body,
        attachmentPaths,
      });

    } else if (user.authType === 'google' && !user.accessToken) {
      // ── L'utilisateur est Google mais n'a pas de token → invalide ────────
      console.error('❌ Utilisateur Google sans accessToken');
      return res.status(500).json({ 
        success: false, 
        error: 'Token d\'accès Google manquant. Veuillez vous déconnecter et vous reconnecter.' 
      });

    } else {
      // ── Fallback : envoi via Zimbra SOAP ────────────────────────────────
      console.log('📧 → Branche Zimbra SOAP');
      const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');

      if (!fs.existsSync(attachmentPath)) {
        return res.status(500).json({ success: false, error: 'Fichier CV_LETTRE_DE_RECOMMANDATION.pdf introuvable.' });
      }

      await zimbraClient.sendEmail({
        to:             contact.email,
        subject:        contact.subject,
        body:           contact.body,
        attachmentPath,
      });
    }

    // Marquer le contact comme envoyé
    await prisma.contact.update({
      where: { id },
      data: { status: 'sent' },
    });

    console.log(`✅ Mail envoyé à ${contact.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Erreur envoi à ${contact.email}:`, err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/send-all — Envoyer tous les mails en attente ──────────────────
app.post('/api/send-all', requireAuth, async (req, res) => {
  try {
    const pending = await prisma.contact.findMany({
      where: { userId: req.user.id, status: 'pending' },
    });

    // Récupérer l'utilisateur complet (avec tokens)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Chercher les documents de l'utilisateur
    const documents = await prisma.document.findMany({
      where: { userId: req.user.id },
    });

    const results = [];
    const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');

    console.log(`📧 send-all: user ${user.email}, authType: ${user.authType}`);
    console.log(`   accessToken: ${user.accessToken ? '✅' : '❌'}, refreshToken: ${user.refreshToken ? '✅' : '❌'}`);

    for (const contact of pending) {
      try {
        if (user.authType === 'google' && user.accessToken) {
          console.log(`📧 send-all → Gmail API pour ${contact.email}`);
          const attachmentPaths = documents.map(d => ({
            path: path.join(uploadsDir, d.userId, d.filename),
            filename: d.originalName,
            mimetype: d.mimetype,
          }));

          await sendGmail(user, {
            to: contact.email,
            subject: contact.subject,
            body: contact.body,
            attachmentPaths,
          });
        } else if (user.authType === 'google' && !user.accessToken) {
          throw new Error('Token d\'accès Google manquant. Reconnectez-vous.');
        } else {
          console.log(`📧 send-all → Zimbra SOAP pour ${contact.email}`);
          if (!fs.existsSync(attachmentPath)) {
            throw new Error('Fichier CV_LETTRE_DE_RECOMMANDATION.pdf introuvable.');
          }

          await zimbraClient.sendEmail({
            to:             contact.email,
            subject:        contact.subject,
            body:           contact.body,
            attachmentPath,
          });
        }

        await prisma.contact.update({
          where: { id: contact.id },
          data: { status: 'sent' },
        });

        results.push({ id: contact.id, email: contact.email, success: true });
        console.log(`✅ Mail envoyé à ${contact.email}`);
      } catch (err) {
        results.push({ id: contact.id, email: contact.email, success: false, error: err.message });
        console.error(`❌ Erreur envoi à ${contact.email} :`, err.message);
      }

      // Délai de 1.5s entre chaque envoi pour éviter les limitations
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Erreur send-all :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  ROUTES DOCUMENTS (Upload PDF, jusqu'à 5)
// ╚══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/documents/upload — Upload d'un document PDF ───────────────────
app.post('/api/documents/upload', requireAuth, upload.array('documents', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun fichier reçu.' });
    }

    // Vérifier le nombre total de documents de l'utilisateur
    const existingDocs = await prisma.document.count({
      where: { userId: req.user.id },
    });

    const maxNewDocs = 5 - existingDocs;
    if (maxNewDocs <= 0) {
      return res.status(400).json({ success: false, error: 'Limite de 5 documents atteinte. Supprimez-en avant d\'en ajouter.' });
    }

    const filesToProcess = req.files.slice(0, maxNewDocs);
    const userDocsDir = path.join(uploadsDir, req.user.id);
    if (!fs.existsSync(userDocsDir)) {
      fs.mkdirSync(userDocsDir, { recursive: true });
    }

    const uploaded = [];

    for (const file of filesToProcess) {
      // Vérifier que c'est bien un PDF
      if (file.mimetype !== 'application/pdf') {
        continue; // Ignorer les fichiers non-PDF
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const safeName = `${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(userDocsDir, safeName);

      // Écrire le fichier sur le disque
      fs.writeFileSync(filePath, file.buffer);

      // Enregistrer en base
      const doc = await prisma.document.create({
        data: {
          userId: req.user.id,
          filename: safeName,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
      });

      uploaded.push(doc);
    }

    const allDocs = await prisma.document.findMany({
      where: { userId: req.user.id },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ success: true, documents: allDocs, uploaded: uploaded.length });
  } catch (err) {
    console.error('Erreur upload document :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/documents — Liste des documents de l'utilisateur ────────────────
app.get('/api/documents', requireAuth, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: req.user.id },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(documents);
  } catch (err) {
    console.error('Erreur récupération documents :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/documents/:id — Supprimer un document ────────────────────────
app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const doc = await prisma.document.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    // Supprimer le fichier du disque
    const filePath = path.join(uploadsDir, req.user.id, doc.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer de la base
    await prisma.document.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error('Erreur suppression document :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Routes de test (conservées mais non protégées par auth pour debug) ──────
app.post('/api/test-send', async (req, res) => {
  try {
    const to = req.body?.to || 'hidayacine01@gmail.com';
    const subject = req.body?.subject || 'Test envoi mail + pièce jointe — Zimbra SOAP';
    const body = req.body?.body || `Ceci est un mail de test envoyé via l'API SOAP Zimbra.\n\nCompte : ${process.env.SMTP_USER}\nServeur : ${process.env.ZIMBRA_URL}`;

    const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');
    const hasAttachment  = fs.existsSync(attachmentPath);

    await zimbraClient.sendEmail({
      to,
      subject,
      body,
      attachmentPath: hasAttachment ? attachmentPath : undefined,
    });

    console.log(`✅ Mail de test envoyé à ${to}`);
    res.json({ success: true, message: `Mail de test envoyé à ${to}` });
  } catch (err) {
    console.error('❌ Erreur envoi mail de test :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/test-auth', async (req, res) => {
  try {
    const result = await zimbraClient.testConnection();
    res.json({ success: true, message: 'Authentification Zimbra réussie ✅', ...result });
  } catch (err) {
    console.error('❌ Erreur auth Zimbra :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  DÉMARRAGE SERVEUR
// ╚══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Application démarrée sur http://localhost:${PORT}`);
  console.log(`📧 Compte Zimbra : ${process.env.SMTP_USER}`);
  console.log(`🔗 Zimbra        : ${process.env.ZIMBRA_URL}`);
  console.log(`🔐 Google OAuth2 : ${process.env.GOOGLE_CLIENT_ID ? '✅ Configuré' : '❌ Non configuré'}`);
  console.log(`📁 Dossier static : ${staticDir}`);
  console.log(`🌐 Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});
