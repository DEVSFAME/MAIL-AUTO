/* ═══════════════════════════════════════════════════════════════════════════════
   DigitalSerenity — Landing Page Animations & Effects (Vanilla JS)
   ═══════════════════════════════════════════════════════════════════════════════ */

const DigitalSerenity = {
  mouseGradient: null,
  ripples: [],
  scrolled: false,
  floatingElements: [],

  /**
   * Initialize all DigitalSerenity effects
   */
  init() {
    this.createMouseGradient();
    this.createRippleEffect();
    this.animateWords();
    this.addWordHoverEffects();
    this.initFloatingElements();
    this.addGridLinesAnimation();
  },

  /**
   * Mouse Gradient tracking — fixed radial gradient following cursor
   */
  createMouseGradient() {
    // Remove existing if any
    const existing = document.getElementById('mouse-gradient');
    if (existing) existing.remove();

    const gradient = document.createElement('div');
    gradient.id = 'mouse-gradient';
    gradient.style.cssText = `
      position: fixed;
      pointer-events: none;
      border-radius: 9999px;
      background-image: radial-gradient(circle, rgba(148, 163, 184, 0.05), rgba(107, 114, 128, 0.05), transparent 70%);
      transform: translate(-50%, -50%);
      will-change: left, top, opacity;
      transition: left 70ms linear, top 70ms linear, opacity 300ms ease-out;
      width: 20rem;
      height: 20rem;
      filter: blur(24px);
      z-index: 9998;
      opacity: 0;
      left: 0;
      top: 0;
    `;
    document.body.appendChild(gradient);
    this.mouseGradient = gradient;

    const handleMouseMove = (e) => {
      this.mouseGradient.style.left = `${e.clientX}px`;
      this.mouseGradient.style.top = `${e.clientY}px`;
      this.mouseGradient.style.opacity = '1';
    };

    const handleMouseLeave = () => {
      this.mouseGradient.style.opacity = '0';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Store for cleanup
    this._mouseMoveHandler = handleMouseMove;
    this._mouseLeaveHandler = handleMouseLeave;
  },

  /**
   * Ripple effect on click
   */
  createRippleEffect() {
    const handleClick = (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'ripple-effect';
      ripple.style.cssText = `
        position: fixed;
        width: 4px;
        height: 4px;
        background: rgba(0, 240, 255, 0.6);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        animation: digital-ripple 1s ease-out forwards;
        z-index: 9999;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
      `;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 1000);
    };

    document.addEventListener('click', handleClick);
    this._clickHandler = handleClick;
  },

  /**
   * Animate words with staggered delays via data-delay attributes
   */
  animateWords() {
    setTimeout(() => {
      const words = document.querySelectorAll('.word-animate');
      words.forEach(word => {
        const delay = parseInt(word.getAttribute('data-delay')) || 0;
        setTimeout(() => {
          word.style.animation = 'word-appear 0.8s ease-out forwards';
        }, delay);
      });
    }, 500);
  },

  /**
   * Add hover effects on word-animate elements
   */
  addWordHoverEffects() {
    const words = document.querySelectorAll('.word-animate');
    words.forEach(word => {
      word.addEventListener('mouseenter', () => {
        word.style.textShadow = '0 0 20px rgba(0, 240, 255, 0.5)';
      });
      word.addEventListener('mouseleave', () => {
        word.style.textShadow = 'none';
      });
    });
  },

  /**
   * Initialize floating elements animation on scroll
   */
  initFloatingElements() {
    this.floatingElements = document.querySelectorAll('.floating-element-animate');
    const handleScroll = () => {
      if (!this.scrolled) {
        this.scrolled = true;
        this.floatingElements.forEach((el, index) => {
          setTimeout(() => {
            el.style.animationPlayState = 'running';
            el.style.opacity = '';
          }, (parseFloat(el.style.animationDelay || '0') * 1000) + index * 100);
        });
      }
    };
    window.addEventListener('scroll', handleScroll);
    this._scrollHandler = handleScroll;
  },

  /**
   * Trigger grid-line animations with delay
   */
  addGridLinesAnimation() {
    const lines = document.querySelectorAll('.grid-line');
    lines.forEach((line, index) => {
      const delay = 0.5 + index * 0.5;
      line.style.animation = `grid-draw 2s ease-out forwards`;
      line.style.animationDelay = `${delay}s`;
    });
  },

  /**
   * Cleanup all event listeners
   */
  destroy() {
    if (this._mouseMoveHandler) document.removeEventListener('mousemove', this._mouseMoveHandler);
    if (this._mouseLeaveHandler) document.removeEventListener('mouseleave', this._mouseLeaveHandler);
    if (this._clickHandler) document.removeEventListener('click', this._clickHandler);
    if (this._scrollHandler) window.removeEventListener('scroll', this._scrollHandler);
    if (this.mouseGradient) this.mouseGradient.remove();
  }
};

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => DigitalSerenity.init());