/* ═══════════════════════════════════════════════════════════════════════════════
   GlowingShadow — Effet de carte avec bordures animées via CSS @property
   ═══════════════════════════════════════════════════════════════════════════════ */

const GlowingShadow = {
  cards: [],

  /**
   * Initialize GlowingShadow on all matching elements
   * @param {string} selector - CSS selector for cards (default: '.glowing-card')
   */
  init(selector = '.glowing-card') {
    const cards = document.querySelectorAll(selector);
    cards.forEach((card, index) => {
      this.enhanceCard(card, index);
    });
  },

  /**
   * Enhance a single card with glowing shadow effects
   */
  enhanceCard(card, index) {
    // Skip if already enhanced
    if (card.dataset.glowingEnhanced === 'true') return;
    card.dataset.glowingEnhanced = 'true';

    // Add the glow container wrapper structure
    const content = card.querySelector('.glowing-content');
    if (!content) return;

    // Add glow span element if not exists
    let glowSpan = card.querySelector('.glowing-glow');
    if (!glowSpan) {
      glowSpan = document.createElement('span');
      glowSpan.className = 'glowing-glow';
      card.insertBefore(glowSpan, content);
    }

    // Mouse tracking for dynamic bg position
    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--bg-x', x);
      card.style.setProperty('--bg-y', y);
    };

    card.addEventListener('mousemove', handleMouseMove);

    // Store reference for cleanup
    card._glowMouseMove = handleMouseMove;
    card._glowIndex = index;
    this.cards.push(card);
  },

  /**
   * Add GlowingShadow wrapper around an element
   * @param {HTMLElement} element - The element to wrap
   * @returns {HTMLElement} The glow container
   */
  createGlowCard(element) {
    const container = document.createElement('div');
    container.className = 'glowing-card';
    container.setAttribute('role', 'button');

    const glowSpan = document.createElement('span');
    glowSpan.className = 'glowing-glow';

    const content = document.createElement('div');
    content.className = 'glowing-content';

    // Move element content into the glow structure
    content.appendChild(element);
    container.appendChild(glowSpan);
    container.appendChild(content);

    this.enhanceCard(container, this.cards.length);
    return container;
  },

  /**
   * Refresh - re-init on dynamically added cards
   */
  refresh(selector = '.glowing-card') {
    this.init(selector);
  },

  /**
   * Cleanup
   */
  destroy() {
    this.cards.forEach((card) => {
      if (card._glowMouseMove) {
        card.removeEventListener('mousemove', card._glowMouseMove);
      }
    });
    this.cards = [];
  }
};

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  GlowingShadow.init();
});