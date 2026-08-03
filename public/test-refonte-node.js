#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   Test de refonte Superlist — Validation statique (Node.js)
   Vérifie la structure, les variables CSS, les classes critiques
   ═══════════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, component, test, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ [${component}] ${test} ${detail ? '— ' + detail : ''}`);
  } else {
    failed++;
    console.error(`❌ [${component}] ${test} ${detail ? '— ' + detail : ''}`);
  }
  return condition;
}

/* ── 1. Vérifier l'existence des fichiers ─────────────────────────────────── */
function testFilesExist() {
  const files = [
    'public/style.css',
    'public/index.html',
    'public/app.js',
    'public/config.js',
    'public/digital-serenity.js',
    'public/limelight-nav.js',
    'public/glowing-shadow.js',
    'public/test-refonte.js',
  ];
  for (const file of files) {
    assert(fs.existsSync(file), 'Fichiers', `${file} existe`);
  }
}

/* ── 2. Vérifier le CSS ───────────────────────────────────────────────────── */
function testCSS() {
  const css = fs.readFileSync('public/style.css', 'utf-8');
  assert(css.length > 1000, 'CSS', 'Fichier CSS non vide', `${css.length} octets`);

  // Variables Superlist définies
  const vars = [
    '--bg-primary', '--bg-card', '--accent', '--accent-hover',
    '--text-primary', '--text-secondary', '--text-tertiary', '--text-inverse',
    '--border', '--border-light', '--success', '--danger', '--warning',
    '--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-card-hover',
    '--radius-sm', '--radius', '--radius-md', '--radius-lg', '--radius-xl',
  ];
  for (const v of vars) {
    assert(css.includes(v), 'CSS Variables', `${v} définie`);
  }

  // Dark mode via prefers-color-scheme
  assert(css.includes('prefers-color-scheme: dark'), 'Dark Mode', 'Media query dark mode présente');

  // Classes critiques conservées
  const criticalClasses = [
    '.contact-card', '.contact-card:hover', '.contact-card.sent', '.contact-card.pending',
    '.card-header', '.card-avatar', '.card-badge', '.card-name', '.card-email',
    '.modal-overlay', '.modal', '.modal-header', '.modal-footer',
    '.btn-primary', '.btn-secondary', '.btn-success', '.btn-danger', '.btn-ghost',
    '.btn-batch', '.batch-bar', '.batch-count', '.batch-modal-icon',
    '.upload-card', '.upload-card.dragover',
    '.search-bar', '.search-bar:focus-within',
    '.toast', '.toast.success', '.toast.error', '.toast.info', '.toast.warning',
    '.progress-bar-track', '.progress-bar-fill',
    '.filter-tabs', '.filter-tab', '.filter-tab.active',
    '.documents-card', '.document-item',
    '.limelight-nav', '.limelight-item', '.limelight-spotlight',
    '.glowing-card', '.glowing-content', '.glowing-glow',
    '.checkbox-custom', '.contact-card.selected',
    '.mail-subject-input', '.mail-body-textarea',
    '.empty-state', '.research-tag', '.attachment-tag',
    '.app-header', '.header-inner', '.brand', '.brand-icon', '.brand-name',
    '.login-card', '.login-logo', '.btn-google', '.btn-zimbra',
  ];

  for (const cls of criticalClasses) {
    assert(css.includes(cls), 'CSS Classes', `${cls} présente`);
  }

  // Palette Superlist (pas l'ancien cyan neon)
  assert(css.includes('#FF6B6B'), 'Palette', 'Couleur coral #FF6B6B présente');
  assert(css.includes('#FF5252'), 'Palette', 'Couleur coral hover #FF5252 présente');
  assert(css.includes('#FF8E8E'), 'Palette', 'Couleur coral dark #FF8E8E présente');
  assert(css.includes('#FAFAFA'), 'Palette', 'Fond clair #FAFAFA présent');
  assert(css.includes('#1A1A2E'), 'Palette', 'Texte primaire #1A1A2E présent');
  assert(!css.includes('#00F0FF'), 'Palette', 'Ancien cyan neon #00F0FF retiré du dashboard');
  assert(!css.includes('#00B8C5'), 'Palette', 'Ancien cyan sombre #00B8C5 retiré du dashboard');
}

/* ── 3. Vérifier le HTML ──────────────────────────────────────────────────── */
function testHTML() {
  const html = fs.readFileSync('public/index.html', 'utf-8');
  assert(html.length > 1000, 'HTML', 'Fichier HTML non vide', `${html.length} octets`);

  // Sections critiques
  const ids = [
    'loginSection', 'appSection', 'contactsSection', 'documentsSection',
    'modalOverlay', 'batchModalOverlay', 'sendAllOverlay', 'toastContainer',
    'googleLoginBtn', 'zimbraLoginBtn', 'logoutBtn',
    'browseBtn', 'sendAllBtn', 'resetBtn', 'selectModeBtn',
    'searchInput', 'contactsGrid', 'emptyState', 'batchBar',
    'btnSend', 'btnEdit', 'btnDelete', 'btnCancel',
  ];
  for (const id of ids) {
    assert(html.includes(`id="${id}"`), 'HTML IDs', `#${id} présent`);
  }

  // Scripts chargés
  assert(html.includes('test-refonte.js'), 'HTML Scripts', 'test-refonte.js chargé');
  assert(html.includes('config.js'), 'HTML Scripts', 'config.js chargé');
  assert(html.includes('app.js'), 'HTML Scripts', 'app.js chargé');
  assert(html.includes('glowing-shadow.js'), 'HTML Scripts', 'glowing-shadow.js chargé');
  assert(html.includes('limelight-nav.js'), 'HTML Scripts', 'limelight-nav.js chargé');
  assert(html.includes('digital-serenity.js'), 'HTML Scripts', 'digital-serenity.js chargé');

  // Landing page dark conservée
  assert(html.includes('loginSection'), 'HTML Landing', 'Landing page dark conservée');
}

/* ── 4. Vérifier le JS de test ──────────────────────────────────────────── */
function testTestJS() {
  const js = fs.readFileSync('public/test-refonte.js', 'utf-8');
  assert(js.includes('testRefonte'), 'Test JS', 'Objet testRefonte défini');
  assert(js.includes('testVariables'), 'Test JS', 'Méthode testVariables');
  assert(js.includes('testDarkMode'), 'Test JS', 'Méthode testDarkMode');
  assert(js.includes('testLandingPage'), 'Test JS', 'Méthode testLandingPage');
  assert(js.includes('testJSCSSIntegration'), 'Test JS', 'Méthode testJSCSSIntegration');
  assert(js.includes('.run()'), 'Test JS', 'Méthode run()');
}

/* ── 5. Vérifier glowing-shadow.js inchangé ──────────────────────────────── */
function testGlowingShadow() {
  const js = fs.readFileSync('public/glowing-shadow.js', 'utf-8');
  assert(js.includes('GlowingShadow'), 'GlowingShadow', 'Objet GlowingShadow présent');
  assert(js.includes('.glowing-card'), 'GlowingShadow', 'Sélecteur .glowing-card conservé');
  assert(js.includes('.glowing-content'), 'GlowingShadow', 'Sélecteur .glowing-content conservé');
  assert(js.includes('.glowing-glow'), 'GlowingShadow', 'Sélecteur .glowing-glow conservé');
}

/* ── 6. Vérifier landing page dark ───────────────────────────────────────── */
function testLandingDark() {
  const css = fs.readFileSync('public/style.css', 'utf-8');
  assert(css.includes('#loginSection'), 'Landing Dark', 'Section loginSection stylée');
  assert(css.includes('linear-gradient(135deg, #020617'), 'Landing Dark', 'Fond dark #020617 conservé');
  assert(css.includes('login-particles'), 'Landing Dark', 'Particules conservées');
  assert(css.includes('backdrop-filter: blur(20px)'), 'Landing Dark', 'Glassmorphism conservé');
}

/* ── 7. Vérifier responsive ─────────────────────────────────────────────── */
function testResponsive() {
  const css = fs.readFileSync('public/style.css', 'utf-8');
  assert(css.includes('@media (max-width: 640px)'), 'Responsive', 'Media query mobile présente');
  assert(css.includes('grid-template-columns: 1fr'), 'Responsive', 'Grille responsive 1 colonne');
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function main() {
  console.log('🧪 Démarrage des tests de refonte Superlist (Node.js)...\n');

  testFilesExist();
  testCSS();
  testHTML();
  testTestJS();
  testGlowingShadow();
  testLandingDark();
  testResponsive();

  console.log(`\n📊 Résultats : ${passed + failed} tests — ${passed} ✅ / ${failed} ❌`);
  if (failed === 0) {
    console.log('🎉 Tous les tests sont passés ! La refonte Superlist est conforme.');
  } else {
    console.error(`⚠️ ${failed} test(s) en échec.`);
  }

  return { passed, failed };
}

main();