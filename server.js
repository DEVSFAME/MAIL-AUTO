require('dotenv').config();

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

// ─── Client Zimbra SOAP (bypass restriction SMTP universitaire) ───────────────
// Fonctionne en structure plate (public_html/) et en structure src/
const zimbraClient = (() => {
  try { return require('./src/zimbra-client'); } catch (_) {}
  try { return require('./zimbra-client'); }    catch (_) {}
  throw new Error('zimbra-client.js introuvable (ni dans ./src/ ni à la racine)');
})();

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

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
// Sert depuis public/ si le dossier existe (local), sinon depuis la racine (Hostinger)
const publicDir = path.join(__dirname, 'public');
const staticDir = fs.existsSync(publicDir) ? publicDir : __dirname;

// Configuration optimisée pour Hostinger
app.use(express.static(staticDir, {
  maxAge: '1d', // Cache 1 jour pour la production
  etag: true,
  lastModified: true
}));

// Middleware de logging pour debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── In-memory contacts store ────────────────────────────────────────────────

let contacts = [];

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

// ─── POST /api/upload — Parse le fichier Excel ────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu.' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    contacts = rows
      .map((row, index) => {
        const name      = row['Nom du Contact (PI / Responsable)'] || '';
        const structure = row['Structure / Laboratoire'] || '';
        const location  = row['Localisation'] || '';
        const research  = row['Axe de Recherche Principal'] || '';
        const email     = (row['Adresse E-mail'] || '').trim();

        if (!email) return null;

        const { subject, body } = generateEmail({ name, structure, location, research });

        return {
          id: index,
          name,
          structure,
          location,
          research,
          email,
          subject,
          body,
          status: 'pending'   // pending | sent | deleted
        };
      })
      .filter(Boolean);

    res.json({ success: true, contacts });
  } catch (err) {
    console.error('Erreur parsing Excel :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/contacts — Liste des contacts actifs ───────────────────────────
app.get('/api/contacts', (req, res) => {
  res.json(contacts.filter(c => c.status !== 'deleted'));
});

// ─── PUT /api/contacts/:id — Modifier un mail ────────────────────────────────
app.put('/api/contacts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const contact = contacts.find(c => c.id === id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

  if (req.body.subject !== undefined) contact.subject = req.body.subject;
  if (req.body.body    !== undefined) contact.body    = req.body.body;

  res.json({ success: true, contact });
});

// ─── DELETE /api/contacts/:id — Supprimer un contact ─────────────────────────
app.delete('/api/contacts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const contact = contacts.find(c => c.id === id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

  contact.status = 'deleted';
  res.json({ success: true });
});

// ─── POST /api/send/:id — Envoyer un mail via Zimbra SOAP ────────────────────
app.post('/api/send/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const contact = contacts.find(c => c.id === id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

  const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');

  if (!fs.existsSync(attachmentPath)) {
    return res.status(500).json({ success: false, error: 'Fichier CV_LETTRE_DE_RECOMMANDATION.pdf introuvable.' });
  }

  try {
    await zimbraClient.sendEmail({
      to:             contact.email,
      subject:        contact.subject,
      body:           contact.body,
      attachmentPath,
    });

    contact.status = 'sent';
    console.log(`✅ Mail envoyé à ${contact.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Erreur envoi à ${contact.email} :`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/test-send — Envoyer un mail de test (avec pièce jointe) ───────
app.post('/api/test-send', async (req, res) => {
  try {
    const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');
    const hasAttachment  = fs.existsSync(attachmentPath);

    await zimbraClient.sendEmail({
      to:             'hidayacine01@gmail.com',
      subject:        'Test envoi mail + pièce jointe — Zimbra SOAP',
      body:           `Ceci est un mail de test envoyé via l'API SOAP Zimbra.\n\nCompte : ${process.env.SMTP_USER}\nServeur : ${process.env.ZIMBRA_URL}\nPièce jointe : ${hasAttachment ? 'CV_LETTRE_DE_RECOMMANDATION.pdf ✅' : 'absente ❌'}`,
      attachmentPath: hasAttachment ? attachmentPath : undefined,
    });

    console.log('✅ Mail de test (avec pièce jointe) envoyé à hidayacine01@gmail.com');
    res.json({ success: true, message: 'Mail de test envoyé avec succès à hidayacine01@gmail.com (pièce jointe incluse)' });
  } catch (err) {
    console.error('❌ Erreur envoi mail de test :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/test-auth — Tester l'authentification Zimbra ───────────────────
app.get('/api/test-auth', async (req, res) => {
  try {
    const result = await zimbraClient.testConnection();
    res.json({ success: true, message: 'Authentification Zimbra réussie ✅', ...result });
  } catch (err) {
    console.error('❌ Erreur auth Zimbra :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/send-all — Envoyer tous les mails en attente ──────────────────
app.post('/api/send-all', async (req, res) => {
  const pending = contacts.filter(c => c.status === 'pending');
  const results = [];
  const attachmentPath = path.join(__dirname, 'CV_LETTRE_DE_RECOMMANDATION.pdf');

  for (const contact of pending) {
    try {
      await zimbraClient.sendEmail({
        to:             contact.email,
        subject:        contact.subject,
        body:           contact.body,
        attachmentPath,
      });
      contact.status = 'sent';
      results.push({ id: contact.id, email: contact.email, success: true });
      console.log(`✅ Mail envoyé à ${contact.email}`);
    } catch (err) {
      results.push({ id: contact.id, email: contact.email, success: false, error: err.message });
      console.error(`❌ Erreur envoi à ${contact.email} :`, err.message);
    }

    // Délai de 1.5s entre chaque envoi pour éviter les limitations serveur
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  res.json({ success: true, results });
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
