/**
 * config.js — Configuration de l'URL du backend
 *
 * ✅ Détection automatique de l'environnement :
 *   - En local (localhost / 127.0.0.1) → routes relatives (/api/...)
 *   - En production → routes relatives (même domaine, via Docker)
 *
 * Pour l'envoi OAuth2 Google, le GOOGLE_REDIRECT_URI dans .env doit correspondre
 * à l'URL utilisée (localhost, ngrok ou Hostinger).
 */
window.API_BASE_URL = '';  // Routes relatives (/api/...) — même domaine en local et Docker