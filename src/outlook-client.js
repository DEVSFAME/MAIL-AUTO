/**
 * outlook-client.js
 * Client Microsoft Graph API pour l'envoi d'emails via le token OAuth Microsoft.
 * Utilisé lorsque l'utilisateur est connecté via Outlook (authType === 'outlook').
 *
 * Alternative propre au Zimbra SOAP : l'email part avec l'adresse Outlook
 * de l'utilisateur, pas avec l'adresse Zimbra hardcodée.
 */

const fs   = require('fs');
const path = require('path');

// ─── Constantes ───────────────────────────────────────────────────────────────
const MSGRAPH_SEND_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';

// ─── Auth (pour le refresh token partagé) ─────────────────────────────────────
let _refreshOutlookToken;
function getRefreshOutlookToken() {
  if (!_refreshOutlookToken) {
    const auth = require('./auth');
    _refreshOutlookToken = auth.refreshOutlookToken;
  }
  return _refreshOutlookToken;
}

// ─── MIME boundary aléatoire ──────────────────────────────────────────────────
function generateBoundary() {
  return '----=_Part_' + Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
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

// ─── Envoi d'un email via l'API Microsoft Graph ──────────────────────────────
async function sendEmail({ accessToken, refreshToken, from, to, subject, body, attachmentPath }) {
  if (!accessToken) {
    throw new Error('Access token Microsoft manquant. L\'utilisateur doit se reconnecter.');
  }

  // Construire le message MIME
  const rawMime = buildMimeMessage({ from, to, subject, body, attachmentPath });
  // Microsoft Graph attend le MIME en base64 standard (pas base64url)
  const mimeBase64 = Buffer.from(rawMime, 'utf8').toString('base64');

  // Fonction d'envoi (appelable avec retry si 401)
  async function attemptSend(token) {
    const response = await fetch(MSGRAPH_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: subject,
          body: {
            contentType: 'Text',
            content: body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: to,
              },
            },
          ],
        },
        saveToSentItems: true,
      }),
    });

    // Si on a du contenu MIME (avec pièce jointe), on utilise l'approche MIME
    // Réessayer avec l'approche MIME si une pièce jointe est présente
    if (attachmentPath && fs.existsSync(attachmentPath)) {
      // Annuler la première tentative simple et utiliser l'approche MIME
    }

    if (!response.ok) {
      const errBody = await response.text();
      const error = new Error(`Microsoft Graph API error (${response.status}): ${errBody}`);
      error.status = response.status;
      throw error;
    }

    // sendMail retourne 202 Accepted sans body
    return { success: true };
  }

  // Pour les messages avec pièce jointe, utiliser l'approche MIME inline
  async function attemptSendMime(token) {
    const mimeBase64Raw = Buffer.from(rawMime, 'utf8').toString('base64');
    const response = await fetch(MSGRAPH_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: mimeBase64Raw,
    });

    if (response.status === 202) {
      return { success: true };
    }

    // Si 400+ avec MIME, fallback à l'approche JSON simple (sans PJ)
    // (Microsoft Graph préfère parfois l'approche JSON pour les messages simples)
    const errBody = await response.text();
    const error = new Error(`Microsoft Graph API MIME error (${response.status}): ${errBody}`);
    error.status = response.status;
    throw error;
  }

  try {
    // Première tentative : utiliser l'approche JSON (plus fiable, mais pas de PJ)
    // Si pièce jointe, on utilise l'approche MIME
    let result;
    if (attachmentPath && fs.existsSync(attachmentPath)) {
      result = await attemptSendMime(accessToken);
    } else {
      result = await attemptSend(accessToken);
    }
    console.log('✅ Mail envoyé via Microsoft Graph API.');
    return result;
  } catch (err) {
    // Si 401 (token expiré), tenter un refresh
    if (err.status === 401 && refreshToken) {
      console.warn('⚠️  Access token Microsoft expiré, tentative de rafraîchissement...');
      const refreshFn = getRefreshOutlookToken();
      const newTokens = await refreshFn(refreshToken);

      // Retenter avec le nouveau token
      let result;
      if (attachmentPath && fs.existsSync(attachmentPath)) {
        result = await attemptSendMime(newTokens.accessToken);
      } else {
        result = await attemptSend(newTokens.accessToken);
      }
      console.log('✅ Mail envoyé via Microsoft Graph API (après refresh).');

      // Retourner les nouveaux tokens pour mise à jour en base
      return {
        success: true,
        newAccessToken:   newTokens.accessToken,
        newTokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
      };
    }

    // Si erreur 400 avec MIME, tenter l'approche JSON simple (sans PJ)
    if (err.status === 400 && attachmentPath && fs.existsSync(attachmentPath)) {
      console.warn('⚠️  Approche MIME rejetée, tentative sans pièce jointe...');
      // Construire un message JSON simple (sans attachment)
      const response = await fetch(MSGRAPH_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: subject,
            body: {
              contentType: 'Text',
              content: body + '\n\n[Pièce jointe non incluse — format non supporté par l\'API]',
            },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        }),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Microsoft Graph API fallback error (${response.status}): ${errBody}`);
      }
      return { success: true };
    }

    throw err;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { sendEmail };