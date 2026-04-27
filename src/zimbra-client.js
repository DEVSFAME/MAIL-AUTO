/**
 * zimbra-client.js
 * Client Zimbra SOAP pour contourner la restriction SMTP universitaire.
 * Utilise HTTPS (port 443) au lieu de SMTP (port 587) — jamais bloqué.
 */

const axios = require('axios');
const fs    = require('fs');
const https = require('https');

const ZIMBRA_BASE  = process.env.ZIMBRA_URL || 'https://webmailetu-zimbra.univ-tours.fr';
const SOAP_URL     = `${ZIMBRA_BASE}/service/soap/`;
const UPLOAD_URL   = `${ZIMBRA_BASE}/service/upload?fmt=raw`;

// ── Instance Axios : ignore les certificats auto-signés universitaires ────────
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({ httpsAgent });

// ── Cache du token d'authentification ────────────────────────────────────────
let _authToken   = null;
let _tokenExpiry = 0;      // timestamp ms

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaire : échapper les caractères XML spéciaux
// ─────────────────────────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Construire une enveloppe SOAP 1.2
// ─────────────────────────────────────────────────────────────────────────────
function buildEnvelope(authToken, bodyXml) {
  const contextToken = authToken
    ? `<authToken>${authToken}</authToken>`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      ${contextToken}
    </context>
  </soap:Header>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST SOAP générique
// ─────────────────────────────────────────────────────────────────────────────
async function soapRequest(envelope) {
  const response = await http.post(SOAP_URL, envelope, {
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
    },
    timeout: 15000,
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentification → retourne le authToken Zimbra
// ─────────────────────────────────────────────────────────────────────────────
async function authenticate() {
  // Réutilise le token si encore valide (marge de 5 minutes)
  if (_authToken && Date.now() < _tokenExpiry - 5 * 60 * 1000) {
    return _authToken;
  }

  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;

  const bodyXml = `
    <AuthRequest xmlns="urn:zimbraAccount">
      <account by="name">${escapeXml(username)}</account>
      <password>${escapeXml(password)}</password>
    </AuthRequest>`;

  const envelope = buildEnvelope(null, bodyXml);
  const xml = await soapRequest(envelope);

  // Extraire le token depuis la réponse XML
  const tokenMatch = xml.match(/<authToken[^>]*>([^<]+)<\/authToken>/);
  if (!tokenMatch) {
    throw new Error(
      'Authentification Zimbra échouée. Vérifiez les identifiants dans .env\n' +
      'Réponse serveur : ' + xml.substring(0, 300)
    );
  }

  // Extraire la durée de vie du token (en ms)
  const lifetimeMatch = xml.match(/<lifetime[^>]*>([^<]+)<\/lifetime>/);
  const lifetime = lifetimeMatch ? parseInt(lifetimeMatch[1], 10) : 3600000;

  _authToken   = tokenMatch[1];
  _tokenExpiry = Date.now() + lifetime;

  console.log('🔐 Authentification Zimbra réussie. Token valide pour', Math.round(lifetime / 60000), 'minutes.');
  return _authToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload de pièce jointe → retourne l'attachment ID (aid)
// ─────────────────────────────────────────────────────────────────────────────
async function uploadAttachment(authToken, filePath, filename, contentType) {
  const fileBuffer = fs.readFileSync(filePath);

  const response = await http.post(UPLOAD_URL, fileBuffer, {
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cookie':              `ZM_AUTH_TOKEN=${authToken}`,
    },
    timeout: 30000,
  });

  // La réponse Zimbra peut être dans deux formats :
  //   Format JSON   : 200,'req-id',[[{"aid":"...","filename":"..."}]]
  //   Format direct : 200,'req-id','<upload-id>'
  const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

  console.log('📎 Réponse upload Zimbra :', raw.substring(0, 300));

  // Tentative 1 : format JSON  {"aid":"..."}
  let aid = null;
  const aidJsonMatch = raw.match(/"aid"\s*:\s*"([^"]+)"/);
  if (aidJsonMatch) {
    aid = aidJsonMatch[1];
  }

  // Tentative 2 : format CSV direct  200,'null','<id>'
  if (!aid) {
    const aidCsvMatch = raw.match(/\d+\s*,\s*'[^']*'\s*,\s*'([^']+)'/);
    if (aidCsvMatch) {
      aid = aidCsvMatch[1];
    }
  }

  if (!aid) {
    throw new Error('Upload pièce jointe échoué. Réponse : ' + raw.substring(0, 200));
  }

  console.log('📎 Attachment ID (aid) obtenu :', aid);
  return aid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envoi d'un email avec pièce jointe
// ─────────────────────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, body, attachmentPath }) {
  const authToken = await authenticate();

  // 1. Upload de la pièce jointe
  let attachXml = '';
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    const filename    = require('path').basename(attachmentPath);
    const contentType = 'application/pdf';
    const aid = await uploadAttachment(authToken, attachmentPath, filename, contentType);
    attachXml = `<attach><aid>${escapeXml(aid)}</aid></attach>`;
  }

  // 2. Construction du message SOAP
  const from     = process.env.SMTP_USER;
  const fromName = 'MOHAMMAD ANIKA';

  const bodyXml = `
    <SendMsgRequest xmlns="urn:zimbraMail">
      <m>
        <e t="f" a="${escapeXml(from)}" p="${escapeXml(fromName)}"/>
        <e t="t" a="${escapeXml(to)}"/>
        <su>${escapeXml(subject)}</su>
        <mp ct="text/plain">
          <content>${escapeXml(body)}</content>
        </mp>
        ${attachXml}
      </m>
    </SendMsgRequest>`;

  const envelope = buildEnvelope(authToken, bodyXml);
  const xml = await soapRequest(envelope);

  // Vérifier les erreurs SOAP
  if (xml.includes('soap:Fault') || xml.includes('<Fault>')) {
    const faultMatch = xml.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/);
    throw new Error('Erreur SOAP Zimbra : ' + (faultMatch ? faultMatch[1] : xml.substring(0, 300)));
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test de connexion (vérifie auth uniquement)
// ─────────────────────────────────────────────────────────────────────────────
async function testConnection() {
  const token = await authenticate();
  return { success: true, token: token.substring(0, 20) + '...' };
}

module.exports = { sendEmail, testConnection, authenticate };
