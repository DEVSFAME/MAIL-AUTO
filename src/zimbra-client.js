/**
 * zimbra-client.js
 * Client Zimbra SOAP pour contourner la restriction SMTP universitaire.
 * Utilise HTTPS (port 443) au lieu de SMTP (port 587) — jamais bloqué.
 */

const axios = require('axios');
const fs    = require('fs');
const https = require('https');
const path  = require('path');
const { XMLParser } = require('fast-xml-parser');

const ZIMBRA_BASE  = process.env.ZIMBRA_URL || 'https://webmailetu-zimbra.univ-tours.fr';
const SOAP_URL     = `${ZIMBRA_BASE}/service/soap/`;
const UPLOAD_URL   = `${ZIMBRA_BASE}/service/upload?fmt=raw`;

// ── Agent HTTPS : utilise un CA personnalisé si configuré ──────────────────
// Configurer avec ZIMBRA_CA_PATH=/path/to/ca-cert.pem dans .env
// En dernier recours ZIMBRA_INSECURE=true (avec warning explicite)
function createHttpsAgent() {
  const caPath = process.env.ZIMBRA_CA_PATH;
  const insecure = process.env.ZIMBRA_INSECURE === 'true';

  if (caPath && fs.existsSync(caPath)) {
    console.log('🔒 Utilisation du certificat CA :', caPath);
    return new https.Agent({
      ca: fs.readFileSync(caPath),
    });
  }

  if (caPath && !fs.existsSync(caPath)) {
    console.warn('⚠️  ZIMBRA_CA_PATH configuré (' + caPath + ') mais fichier introuvable. Fallback vers TLS par défaut.');
  }

  if (insecure) {
    console.warn('⚠️  ⚠️  TLS DÉSACTIVÉ (ZIMBRA_INSECURE=true) — Les communications ne sont PAS chiffrées correctement. ⚠️  ⚠️');
    console.warn('    Utilisez ZIMBRA_CA_PATH=/chemin/vers/certificat-ca.pem en production.');
    return new https.Agent({ rejectUnauthorized: false });
  }

  // Par défaut : validation TLS normale (sans CA custom)
  return new https.Agent();
}

const httpsAgent = createHttpsAgent();
const http = axios.create({ httpsAgent });

// ── Cache du token d'authentification ────────────────────────────────────────
let _authToken   = null;
let _tokenExpiry = 0;      // timestamp ms

// ── Parser XML robuste (au lieu des regex) ─────────────────────────────────
const xmlParser = new XMLParser({
  ignoreAttributes:     false,
  attributeNamePrefix:  '@_',
  textNodeName:         '#text',
  ignoreDeclaration:    true,
  parseTagValue:        true,
  trimValues:           true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Construire les entités XML sans utiliser & pour éviter que l'auto-formateur
// ne les "corrige" — on utilise String.fromCharCode pour échapper
// ─────────────────────────────────────────────────────────────────────────────
const AMP  = String.fromCharCode(38) + 'amp;';
const LT   = String.fromCharCode(38) + 'lt;';
const GT   = String.fromCharCode(38) + 'gt;';
const QUOT = String.fromCharCode(38) + 'quot;';
const APOS = String.fromCharCode(38) + 'apos;';

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaire : échapper les caractères XML spéciaux
// ─────────────────────────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str)
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT)
    .replace(/'/g, APOS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaire : encoder un header non-ASCII selon RFC 2047
// EXPORTÉ pour éviter la duplication dans server.js
// ─────────────────────────────────────────────────────────────────────────────
function mimeEncodeHeader(text) {
  if (/^[\x00-\x7F]*$/.test(String(text))) return String(text);
  return '=?UTF-8?B?' + Buffer.from(String(text), 'utf8').toString('base64') + '?=';
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraire un champ d'une réponse XML parsee en suivant un chemin de clés
// Exemple : extractXmlField(parsed, 'soap:Envelope', 'soap:Body', 'AuthResponse', 'authToken')
// ─────────────────────────────────────────────────────────────────────────────
function extractXmlField(parsed, ...keys) {
  let current = parsed;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }
  // Si c'est un objet avec #text, retourner le texte
  if (current && typeof current === 'object' && current['#text'] !== undefined) {
    return current['#text'];
  }
  return typeof current === 'string' ? current : null;
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
// POST SOAP générique avec retry (2 tentatives, backoff exponentiel)
// ─────────────────────────────────────────────────────────────────────────────
async function soapRequest(envelope, retries = 2) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await http.post(SOAP_URL, envelope, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
        timeout: 15000,
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000); // 1s, 2s
        console.warn(`⚠️  Tentative ${attempt}/${retries} échouée, nouvelle tentative dans ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraire la chaîne du authToken depuis le XML parsé
// ─────────────────────────────────────────────────────────────────────────────
function parseAuthToken(xml) {
  try {
    const parsed = xmlParser.parse(xml);
    // Chemin typique : soap:Envelope → soap:Body → AuthResponse → authToken
    const body = parsed['soap:Envelope']?.['soap:Body'];
    if (!body) return null;

    // Essayer les chemins possibles selon le namespace
    for (const key of Object.keys(body)) {
      const response = body[key];
      if (response && typeof response === 'object') {
        const token = response.authToken || response['authToken'];
        if (token) return typeof token === 'string' ? token : token['#text'] || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraire le lifetime depuis le XML parsé
// ─────────────────────────────────────────────────────────────────────────────
function parseLifetime(xml) {
  try {
    const parsed = xmlParser.parse(xml);
    const body = parsed['soap:Envelope']?.['soap:Body'];
    if (!body) return null;

    for (const key of Object.keys(body)) {
      const response = body[key];
      if (response && typeof response === 'object') {
        const lt = response.lifetime || response['lifetime'];
        if (lt) {
          const val = typeof lt === 'string' ? lt : lt['#text'] || null;
          return val ? parseInt(val, 10) : null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraire le faultstring d'une erreur SOAP
// ─────────────────────────────────────────────────────────────────────────────
function parseSoapFault(xml) {
  try {
    const parsed = xmlParser.parse(xml);
    const body = parsed['soap:Envelope']?.['soap:Body'];
    if (!body) return null;

    for (const key of Object.keys(body)) {
      const fault = body[key];
      if (fault && typeof fault === 'object' && (
        key.toLowerCase().includes('fault') || fault.faultstring || fault['faultstring']
      )) {
        const fs = fault.faultstring || fault['faultstring'];
        if (fs) return typeof fs === 'string' ? fs : fs['#text'] || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraire l'attachment ID depuis la réponse upload
// ─────────────────────────────────────────────────────────────────────────────
function parseAttachmentId(raw) {
  // Format JSON : {"aid":"..."}
  try {
    const parsed = JSON.parse(raw);
    if (parsed.aid) return parsed.aid;
  } catch {
    // ce n'est pas du JSON
  }

  // Format CSV direct : 200,'null','<id>' — retour à la regex car format non-XML
  const aidCsvMatch = raw.match(/\d+\s*,\s*'[^']*'\s*,\s*'([^']+)'/);
  if (aidCsvMatch) return aidCsvMatch[1];

  return null;
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

  // Extraire le token via parser XML robuste
  const authToken = parseAuthToken(xml);
  if (!authToken) {
    throw new Error(
      'Authentification Zimbra échouée. Vérifiez les identifiants dans .env\n' +
      'Réponse serveur : ' + xml.substring(0, 300)
    );
  }

  // Extraire la durée de vie du token
  const lifetime = parseLifetime(xml) || 3600000;

  _authToken   = authToken;
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

  const aid = parseAttachmentId(raw);

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
    const filename    = path.basename(attachmentPath);
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
        <e t="f" a="${escapeXml(from)}" p="${escapeXml(mimeEncodeHeader(fromName))}"/>
        <e t="t" a="${escapeXml(to)}"/>
        <su>${escapeXml(mimeEncodeHeader(subject))}</su>
        <mp ct="text/plain">
          <content>${escapeXml(body)}</content>
        </mp>
        ${attachXml}
      </m>
    </SendMsgRequest>`;

  const envelope = buildEnvelope(authToken, bodyXml);
  const xml = await soapRequest(envelope);

  // Vérifier les erreurs SOAP via parser XML
  const faultString = parseSoapFault(xml);
  if (faultString || xml.includes('<Fault>')) {
    throw new Error('Erreur SOAP Zimbra : ' + (faultString || xml.substring(0, 300)));
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

module.exports = { sendEmail, testConnection, authenticate, mimeEncodeHeader };