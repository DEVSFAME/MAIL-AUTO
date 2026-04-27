/**
 * config.js — Configuration de l'URL du backend
 *
 * ✅ Détection automatique de l'environnement :
 *   - En local (localhost / 127.0.0.1) → routes relatives (/api/...) directement
 *     vers le serveur Node port 3000. Pas besoin de ngrok.
 *   - En production (ngrok, Hostinger, etc.) → URL complète du backend.
 *
 * Pour lancer ngrok en production :
 *   ngrok http --domain=cytotropic-bipedally-ollie.ngrok-free.dev 3000
 */
window.API_BASE_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? ''  // Local → /api/upload, /api/contacts, etc. → servi par Node directement
  : 'https://cytotropic-bipedally-ollie.ngrok-free.dev';  // Production → ngrok
