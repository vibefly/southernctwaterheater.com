/**
 * images.js — render window.__IMAGES into the one-pager template.
 *
 * Slots:
 *   hero    — Ken Burns slideshow behind the hero section
 *   gallery — photo grid injected before the footer
 */

(function () {
  const images = window.__IMAGES;
  if (!images || !images.length) return;

  const KB_DUR = 8; // seconds per slide

  function byTag(tag) {
    return images.filter(img => img.tag === tag);
  }

  /* ── Hero: Ken Burns ─────────────────────────────────────────────── */
  function initHero() {
    const container = document.getElementById('hero-images-slot');
    if (!container) return;

    const heroImages = byTag('hero');
    if (!heroImages.length) return;

    const n = heroImages.length;
    const animate = n > 1;

    heroImages.forEach((img, i) => {
      const slide = document.createElement('div');
      slide.className = animate ? 'kb-slide' : 'kb-slide kb-slide--static';
      slide.style.backgroundImage = `url(${img.src})`;
      if (animate) {
        slide.style.setProperty('--n', n);
        slide.style.setProperty('--i', i);
        slide.style.setProperty('--kb-dur', KB_DUR + 's');
      }
      container.appendChild(slide);
    });

    container.closest('.hero')?.classList.add('hero--has-bg');
  }

  /* ── Gallery: grid before footer ─────────────────────────────────── */
  function initGallery() {
    const galleryImages = byTag('gallery');
    if (!galleryImages.length) return;

    const footer = document.querySelector('footer');
    if (!footer) return;

    const section = document.createElement('section');
    section.className = 'site-gallery';
    section.innerHTML = `
      <div class="container">
        <div class="site-gallery__grid">
          ${galleryImages.map(img => `
            <div class="site-gallery__item">
              <img src="${escAttr(img.src)}" alt="${escAttr(img.description || 'Gallery photo')}" loading="lazy">
            </div>
          `).join('')}
        </div>
      </div>`;

    footer.parentNode.insertBefore(section, footer);
  }

  function escAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  function run() {
    initHero();
    initGallery();
  }
})();
