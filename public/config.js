/**
 * config.js — Configuration de l'URL du backend
 *
 * ✅ Détection automatique de l'environnement :
 *   - En local (localhost / 127.0.0.1) → routes relatives (/api/...)
 *   - En production (Hostinger, ngrok) → URL complète du backend.
 *
 * Modes de déploiement :
 *   ngrok : `ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3000`
 *   Hostinger : définir l'URL du serveur Node.js déployé
 *
 * Pour l'envoi OAuth2 Google, le GOOGLE_REDIRECT_URI dans .env doit correspondre
 * à l'URL utilisée (localhost, ngrok ou Hostinger).
 */
window.API_BASE_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? ''  // Local → /api/... servi par Node directement
  : 'https://cytotropic-bipedally-ollie.ngrok-free.dev';  // Production → ngrok / Hostinger
