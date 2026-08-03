/* ═══════════════════════════════════════════════════════════════════════════════
   LimelightNav — Navigation avec effet spotlights et limelight (Vanilla JS)
   ═══════════════════════════════════════════════════════════════════════════════ */

const LimelightNav = {
  nav: null,
  items: [],
  activeIndex: 0,
  limelight: null,
  itemRefs: [],
  isReady: false,

  /**
   * Initialize LimelightNav on a nav element
   * @param {string|HTMLElement} selector - CSS selector or nav element
   */
  init(selector = '.limelight-nav') {
    this.nav = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!this.nav) return;

    this.items = this.nav.querySelectorAll('.limelight-item');
    this.limelight = this.nav.querySelector('.limelight-spotlight');
    this.itemRefs = [];

    if (this.items.length === 0) return;

    // Convert NodeList to array and store refs
    this.items.forEach((item, index) => {
      this.itemRefs[index] = item;
      item.addEventListener('click', (e) => this.handleItemClick(index, item));
    });

    // Set initial active
    const initialActive = this.nav.querySelector('.limelight-item.active');
    if (initialActive) {
      const idx = Array.from(this.items).indexOf(initialActive);
      if (idx >= 0) this.activeIndex = idx;
    }

    // Position limelight after layout
    requestAnimationFrame(() => this.updateLimelightPosition());

    // Re-position on resize
    window.addEventListener('resize', () => this.updateLimelightPosition());

    // Activate after initial positioning
    setTimeout(() => {
      this.isReady = true;
      if (this.limelight) {
        this.limelight.classList.add('limelight-ready');
      }
    }, 100);
  },

  /**
   * Handle item click
   */
  handleItemClick(index, item) {
    if (index === this.activeIndex) return;

    // Update active state
    this.items.forEach((el) => el.classList.remove('active'));
    item.classList.add('active');

    this.activeIndex = index;
    this.updateLimelightPosition();

    // Dispatch custom event
    const event = new CustomEvent('limelight-change', {
      detail: { index, element: item, tab: item.dataset.tab || '' }
    });
    this.nav.dispatchEvent(event);
  },

  /**
   * Update limelight spotlight position
   */
  updateLimelightPosition() {
    if (!this.limelight || !this.itemRefs[this.activeIndex]) return;

    const activeItem = this.itemRefs[this.activeIndex];
    const navRect = this.nav.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    const left = itemRect.left - navRect.left;
    const width = itemRect.width;

    this.limelight.style.left = `${left}px`;
    this.limelight.style.width = `${width}px`;
  },

  /**
   * Navigate to a specific tab by index or data-tab value
   */
  navigateTo(target) {
    let index = -1;
    if (typeof target === 'number') {
      index = target;
    } else {
      this.items.forEach((item, i) => {
        if (item.dataset.tab === target) index = i;
      });
    }
    if (index >= 0 && index < this.items.length) {
      this.items[index].click();
    }
  },

  /**
   * Cleanup
   */
  destroy() {
    this.items.forEach((item) => {
      item.removeEventListener('click', this.handleItemClick);
    });
    window.removeEventListener('resize', () => this.updateLimelightPosition());
  }
};

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  const navElements = document.querySelectorAll('.limelight-nav');
  navElements.forEach((nav) => LimelightNav.init(nav));
});