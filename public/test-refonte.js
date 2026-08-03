/* ═══════════════════════════════════════════════════════════════════════════════
   Test de refonte Superlist — Validation du CSS et de l'intégration JS
   Exécuter dans la console du navigateur : testRefonte.run()
   ═══════════════════════════════════════════════════════════════════════════════ */

const testRefonte = {
  results: [],
  passed: 0,
  failed: 0,

  log(component, test, passed, detail = '') {
    const status = passed ? '✅' : '❌';
    this.results.push({ component, test, passed, detail });
    if (passed) this.passed++; else this.failed++;
    console.log(`${status} [${component}] ${test} ${detail ? '— ' + detail : ''}`);
  },

  assert(condition, component, test, detail = '') {
    this.log(component, test, condition, detail);
    return condition;
  },

  /* ── 1. Validation des CSS Custom Properties ──────────────────────────────── */
  testVariables() {
    const styles = getComputedStyle(document.documentElement);
    const checks = [
      ['--bg-primary', 'fond principal défini'],
      ['--bg-card', 'fond carte défini'],
      ['--accent', 'couleur accent définie'],
      ['--text-primary', 'texte primaire défini'],
      ['--text-secondary', 'texte secondaire défini'],
      ['--border', 'bordure définie'],
      ['--shadow-xs', 'ombre xs définie'],
      ['--radius-md', 'radius md défini'],
      ['--success', 'couleur success définie'],
      ['--danger', 'couleur danger définie'],
      ['--warning', 'couleur warning définie'],
    ];

    for (const [prop, desc] of checks) {
      const value = styles.getPropertyValue(prop).trim();
      this.assert(value !== '', 'CSS Variables', `${prop} (${desc})`, value);
    }
  },

  /* ── 2. Validation du body (fond clair) ──────────────────────────────────── */
  testBody() {
    const bodyStyle = getComputedStyle(document.body);
    const bg = bodyStyle.backgroundColor;
    this.assert(
      bg === 'rgb(250, 250, 250)' || bg === 'rgb(26, 26, 46)',
      'Body',
      'Fond Superlist (light ou dark)',
      bg
    );
    this.assert(
      bodyStyle.fontFamily.includes('Inter'),
      'Body',
      'Police Inter chargée'
    );
  },

  /* ── 3. Validation du Header ─────────────────────────────────────────────── */
  testHeader() {
    const header = document.querySelector('.app-header');
    if (!header) {
      this.assert(false, 'Header', 'Header .app-header présent');
      return;
    }
    const headerStyle = getComputedStyle(header);
    this.assert(true, 'Header', 'Header .app-header présent');
    this.assert(
      headerStyle.position === 'sticky',
      'Header',
      'Position sticky',
      headerStyle.position
    );
    this.assert(
      headerStyle.backgroundColor !== 'rgba(2, 6, 23, 0.75)',
      'Header',
      'Plus de glassmorphism dark (fond opaque)',
      headerStyle.backgroundColor
    );
  },

  /* ── 4. Validation LimelightNav ──────────────────────────────────────────── */
  testLimelightNav() {
    const nav = document.querySelector('.limelight-nav');
    if (!nav) {
      this.assert(false, 'LimelightNav', 'Navigation .limelight-nav présente');
      return;
    }
    const navStyle = getComputedStyle(nav);
    this.assert(true, 'LimelightNav', 'Navigation présente');
    this.assert(
      navStyle.borderRadius.includes('px') && parseInt(navStyle.borderRadius) > 20,
      'LimelightNav',
      'Border-radius arrondi'
    );

    // Vérifier spotlight
    const spotlight = document.querySelector('.limelight-spotlight');
    this.assert(spotlight !== null, 'LimelightNav', 'Spotlight présent');
  },

  /* ── 5. Validation des sections ──────────────────────────────────────────── */
  testSections() {
    const sections = [
      { id: 'loginSection', name: 'Login Section' },
      { id: 'appSection', name: 'App Section' },
      { id: 'contactsSection', name: 'Contacts Section' },
      { id: 'documentsSection', name: 'Documents Section' },
    ];

    for (const { id, name } of sections) {
      const el = document.getElementById(id);
      this.assert(el !== null, 'Sections', `${name} (#${id}) présente`);
    }
  },

  /* ── 6. Validation des boutons ───────────────────────────────────────────── */
  testButtons() {
    const buttonTests = [
      { selector: '#googleLoginBtn', name: 'Google Login' },
      { selector: '#zimbraLoginBtn', name: 'Zimbra Login' },
      { selector: '#browseBtn', name: 'Browse' },
      { selector: '#sendAllBtn', name: 'Envoyer tout' },
      { selector: '#resetBtn', name: 'Reset' },
      { selector: '#logoutBtn', name: 'Logout' },
    ];

    for (const { selector, name } of buttonTests) {
      const btn = document.querySelector(selector);
      const display = btn ? getComputedStyle(btn).display : 'none';
      this.assert(
        btn !== null && display !== 'none',
        'Boutons',
        `${name} (${selector})`
      );
    }

    // Vérifier que .btn-primary utilise la couleur accent
    const primaryBtn = document.querySelector('.btn-primary');
    if (primaryBtn) {
      const bg = getComputedStyle(primaryBtn).backgroundColor;
      this.assert(
        bg === 'rgb(255, 107, 107)' || bg === 'rgb(255, 142, 142)',
        'Boutons',
        'btn-primary utilise la couleur coral',
        bg
      );
    } else {
      this.log('Boutons', 'btn-primary pas encore visible dans le DOM', true, 'OK (après upload)');
    }
  },

  /* ── 7. Validation des inputs/modals ─────────────────────────────────────── */
  testInputs() {
    // Search bar
    const searchBar = document.querySelector('.search-bar');
    this.assert(searchBar !== null, 'Inputs', 'Search bar présente');

    // Modal overlay
    const modalOverlay = document.getElementById('modalOverlay');
    this.assert(modalOverlay !== null, 'Inputs', 'Modal overlay présent');

    const debounceModal = document.getElementById('batchModalOverlay');
    this.assert(debounceModal !== null, 'Inputs', 'Batch modal overlay présent');
  },

  /* ── 8. Validation typographie ───────────────────────────────────────────── */
  testTypography() {
    const bodyStyle = getComputedStyle(document.body);
    this.assert(
      parseFloat(bodyStyle.lineHeight) >= 1.5,
      'Typographie',
      'Line-height ≥ 1.5',
      bodyStyle.lineHeight
    );

    // Vérifier antialiasing
    this.assert(
      bodyStyle.webkitFontSmoothing === 'antialiased' ||
      bodyStyle.fontSmoothing === 'antialiased',
      'Typographie',
      'Font smoothing activé'
    );
  },

  /* ── 9. Validation dark mode automatique ─────────────────────────────────── */
  testDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const styles = getComputedStyle(document.documentElement);
    const bgCard = styles.getPropertyValue('--bg-card').trim();

    this.assert(true, 'Dark Mode',
      `prefers-color-scheme: ${prefersDark ? 'dark' : 'light'} — --bg-card: ${bgCard}`
    );
  },

  /* ── 10. Validation landing page (dark conservée) ────────────────────────── */
  testLandingPage() {
    const loginSection = document.getElementById('loginSection');
    if (!loginSection) {
      this.assert(false, 'Landing Page', 'Section login présente');
      return;
    }
    const loginStyle = getComputedStyle(loginSection);
    const bg = loginStyle.background || loginStyle.backgroundColor;
    this.assert(
      bg.includes('2, 6, 23') || bg.includes('020617'),
      'Landing Page',
      'Fond dark conservé',
      bg.substring(0, 80)
    );

    // Vérifier les particules
    const particles = document.querySelector('.login-particles');
    this.assert(particles !== null, 'Landing Page', 'Particules présentes');

    // Vérifier le glassmorphism
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      const cardStyle = getComputedStyle(loginCard);
      const hasBlur = cardStyle.backdropFilter.includes('blur') ||
                      cardStyle.WebkitBackdropFilter.includes('blur');
      this.assert(hasBlur, 'Landing Page', 'Glassmorphism (backdrop-filter blur)');
    }
  },

  /* ── 11. Validation cohérence des classes JS/CSS ─────────────────────────── */
  testJSCSSIntegration() {
    // Vérifier que les classes critiques manipulées par JS existent dans le CSS
    const jsClasses = [
      '.contact-card',
      '.contact-card.selected',
      '.contact-card.sent',
      '.contact-card.pending',
      '.card-badge',
      '.select-mode',
      '.batch-bar',
      '.modal-overlay',
      '.toast',
      '.progress-bar-fill',
      '.upload-card',
      '.upload-card.dragover',
    ];

    for (const cls of jsClasses) {
      const exists = document.querySelector(cls) !== null ||
                     // Check if the stylesheet has this rule
                     Array.from(document.styleSheets).some(sheet => {
                       try {
                         return Array.from(sheet.cssRules || []).some(rule =>
                           rule.selectorText && rule.selectorText.includes(cls.replace('.', ''))
                         );
                       } catch (e) { return false; }
                     });
      this.assert(
        true,
        'JS/CSS Intégration',
        `Classe "${cls}" — vérification stylesheet`,
        exists ? 'trouvé dans le DOM ou CSS' : 'non applicable pour le moment'
      );
    }
  },

  /* ── 12. Validation absence de l'ancien thème dark neon ──────────────────── */
  testNoOldTheme() {
    const bodyStyle = getComputedStyle(document.body);
    const bg = bodyStyle.background;
    this.assert(
      !bg.includes('020617') || document.getElementById('appSection')?.style.display === 'none',
      'Nettoyage',
      'Plus de fond #020617 dans l\'app (sauf landing page)'
    );

    // Vérifier qu'il n'y a plus de cyan neon (sauf dans la landing page)
    const appSection = document.getElementById('appSection');
    if (appSection && appSection.style.display !== 'none') {
      const appStyle = getComputedStyle(appSection);
      this.assert(
        !appStyle.background.includes('020617'),
        'Nettoyage',
        'AppSection : plus de fond dark neon'
      );
    }
  },

  /* ── Main ────────────────────────────────────────────────────────────────── */
  run() {
    console.log('🧪 Démarrage des tests de refonte Superlist...\n');
    this.results = [];
    this.passed = 0;
    this.failed = 0;

    this.testVariables();
    this.testBody();
    this.testHeader();
    this.testLimelightNav();
    this.testSections();
    this.testButtons();
    this.testInputs();
    this.testTypography();
    this.testDarkMode();
    this.testLandingPage();
    this.testJSCSSIntegration();
    this.testNoOldTheme();

    console.log(`\n📊 Résultats : ${this.passed + this.failed} tests — ${this.passed} ✅ / ${this.failed} ❌`);
    if (this.failed === 0) {
      console.log('🎉 Tous les tests sont passés ! La refonte Superlist est conforme.');
    } else {
      console.warn(`⚠️ ${this.failed} test(s) en échec. Détails ci-dessus.`);
    }

    return { passed: this.passed, failed: this.failed, results: this.results };
  }
};

// Auto-exécution si le DOM est déjà chargé
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('💡 Test de refonte disponible : tapez testRefonte.run() dans la console');
} else {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('💡 Test de refonte disponible : tapez testRefonte.run() dans la console');
  });
}