/**
 * gmail-client.js
 * Client Gmail API REST pour l'envoi d'emails via le token OAuth Google.
 * Utilisé lorsque l'utilisateur est connecté via Google (authType === 'google').
 *
 * Alternative propre au Zimbra SOAP : l'email part avec l'adresse Gmail
 * de l'utilisateur, pas avec l'adresse Zimbra hardcodée.
 */

const fs   = require('fs');
const path = require('path');

// ─── Constantes ───────────────────────────────────────────────────────────────
const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// ─── Auth (pour le refresh token partagé) ─────────────────────────────────────
let _refreshGoogleToken;
function getRefreshGoogleToken() {
  if (!_refreshGoogleToken) {
    const auth = require('./auth');
    _refreshGoogleToken = auth.refreshGoogleToken;
  }
  return _refreshGoogleToken;
}

// ─── MIME boundary aléatoire ──────────────────────────────────────────────────
function generateBoundary() {
  return '----=_Part_' + Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// ─── Encoder le contenu en base64url (RFC 4648 §5, requis par Gmail API) ──────
function base64urlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── Encoder un header non-ASCII selon RFC 2047 ───────────────────────────────
function mimeEncodeHeader(text) {
  if (/^[\x00-\x7F]*$/.test(String(text))) return String(text);
  return '=?UTF-8?B?' + Buffer.from(String(text), 'utf8').toString('base64') + '?=';
}

// ─── Construire un message MIME conforme RFC 2822 ────────────────────────────
function buildMimeMessage({ from, to, subject, body, attachmentPath }) {
  const boundary = generateBoundary();
  const lines = [];

  // Headers
  lines.push(`From: ${mimeEncodeHeader(from)}`);
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${mimeEncodeHeader(subject)}`);
  lines.push('MIME-Version: 1.0');

  if (attachmentPath && fs.existsSync(attachmentPath)) {
    // Multipart/mixed avec pièce jointe
    const filename = path.basename(attachmentPath);
    const fileBuffer = fs.readFileSync(attachmentPath);
    const fileB64 = fileBuffer.toString('base64');

    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: quoted-printable');
    lines.push('');
    lines.push(body);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: application/pdf; name="${filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-Disposition: attachment; filename="${filename}"`);
    lines.push('');

    // Découper le base64 en lignes de 76 caractères max
    for (let i = 0; i < fileB64.length; i += 76) {
      lines.push(fileB64.substring(i, i + 76));
    }

    lines.push('');
    lines.push(`--${boundary}--`);
  } else {
    // Texte simple
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: quoted-printable');
    lines.push('');
    lines.push(body);
  }

  return lines.join('\r\n');
}


// ─── Envoi d'un email via l'API Gmail ────────────────────────────────────────
async function sendEmail({ accessToken, refreshToken, from, to, subject, body, attachmentPath }) {
  if (!accessToken) {
    throw new Error('Access token Google manquant. L\'utilisateur doit se reconnecter.');
  }

  // Construire le message MIME
  const rawMime = buildMimeMessage({ from, to, subject, body, attachmentPath });
  const rawBase64Url = base64urlEncode(Buffer.from(rawMime, 'utf8'));

  // Fonction d'envoi (appelable avec retry si 401)
  async function attemptSend(token) {
    const response = await fetch(GMAIL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawBase64Url }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      const error = new Error(`Gmail API error (${response.status}): ${errBody}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  try {
    // Première tentative avec l'access token actuel
    const result = await attemptSend(accessToken);
    console.log('✅ Mail envoyé via Gmail API. Message ID:', result.id);
    return { success: true, messageId: result.id };
  } catch (err) {
    // Si 401 (token expiré), tenter un refresh
    if (err.status === 401 && refreshToken) {
      console.warn('⚠️  Access token Google expiré, tentative de rafraîchissement...');
      const refreshFn = getRefreshGoogleToken();
      const newTokens = await refreshFn(refreshToken);

      // Retenter avec le nouveau token
      const result = await attemptSend(newTokens.accessToken);
      console.log('✅ Mail envoyé via Gmail API (après refresh). Message ID:', result.id);

      // Retourner les nouveaux tokens pour mise à jour en base
      return {
        success: true,
        messageId: result.id,
        newAccessToken:   newTokens.accessToken,
        newTokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
      };
    }

    throw err;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { sendEmail };
